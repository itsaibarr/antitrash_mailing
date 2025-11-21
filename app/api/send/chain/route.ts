import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { loadChatList } from "../../../../lib/chatList";

const token = process.env.TELEGRAM_BOT_TOKEN!;

type Message = {
    id: string;
    type: 'text' | 'image' | 'video' | 'file' | 'poll' | 'buttons';
    content: string;
    media?: {
        data: string;
        name: string;
        type: string;
    };
    caption?: string;
    poll?: {
        question: string;
        options: string[];
        is_anonymous: boolean;
        allows_multiple_answers: boolean;
    };
    buttons?: Array<{
        text: string;
        action: string;
        value: string;
    }>;
    buttonText?: string;
    replyTo?: string;
};

export async function POST(req: Request) {
    try {
        console.log("🔄 Начинаем отправку цепочки сообщений");

        const bot = new Telegraf(token);
        const { messages }: { messages: Message[] } = await req.json();

        console.log(`📨 Получено ${messages?.length || 0} сообщений для отправки`);
        console.log("📋 Сообщения:", messages);

        if (!messages || messages.length === 0) {
            console.log("❌ Ошибка: нет сообщений для отправки");
            return NextResponse.json({ error: "Нет сообщений для отправки" }, { status: 400 });
        }

        const users = await loadChatList();
        const results: Array<{
            chatId: string | number;
            messageIndex: number;
            success: boolean;
            error?: string;
        }> = [];

        for (const userId of users) {
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                try {
                    if (msg.type === 'text') {
                        await bot.telegram.sendMessage(userId, msg.content);
                    } else if (msg.type === 'image' && msg.media) {
                        const imgBuffer = Buffer.from(msg.media.data, "base64");
                        await bot.telegram.sendPhoto(userId, { source: imgBuffer }, {
                            caption: msg.caption || undefined
                        });
                    } else if (msg.type === 'video' && msg.media) {
                        const videoBuffer = Buffer.from(msg.media.data, "base64");
                        await bot.telegram.sendVideo(userId, { source: videoBuffer }, {
                            caption: msg.caption || undefined
                        });
                    } else if (msg.type === 'file' && msg.media) {
                        const fileBuffer = Buffer.from(msg.media.data, "base64");
                        await bot.telegram.sendDocument(userId, {
                            source: fileBuffer,
                            filename: msg.media.name
                        }, {
                            caption: msg.caption || undefined
                        });
                    } else if (msg.type === 'poll' && msg.poll) {
                        await bot.telegram.sendPoll(userId, msg.poll.question, msg.poll.options, {
                            is_anonymous: msg.poll.is_anonymous,
                            allows_multiple_answers: msg.poll.allows_multiple_answers,
                        });
                    } else if (msg.type === 'buttons' && msg.buttons) {
                        // Для кнопок создаем inline клавиатуру с расширенными callback_data
                        const inlineKeyboard = [msg.buttons.map(btn => {
                            if (btn.action === 'url') {
                                return { text: btn.text, url: btn.value };
                            } else if (btn.action === 'callback') {
                                // Создаем callback_data: вопрос|кнопка (макс 64 байта)
                                const q = (msg.buttonText || msg.content || 'Вопрос').substring(0, 20);
                                const b = btn.text.substring(0, 20);
                                const callbackData = `${q}|${b}`;
                                return { text: btn.text, callback_data: callbackData.substring(0, 64) };
                            } else {
                                return { text: btn.text, callback_data: btn.value };
                            }
                        })];

                        await bot.telegram.sendMessage(userId, msg.buttonText || msg.content || 'Выберите действие:', {
                            reply_markup: {
                                inline_keyboard: inlineKeyboard
                            }
                        });
                    }

                    results.push({
                        chatId: userId,
                        messageIndex: i,
                        success: true
                    });

                    console.log(`✅ Сообщение ${i + 1} отправлено пользователю ${userId}`);

                    // Задержка между сообщениями
                    await new Promise(r => setTimeout(r, 1000));

                } catch (err: unknown) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    console.error(`❌ Ошибка при отправке сообщения ${i + 1} пользователю ${userId}:`, errorMsg);

                    results.push({
                        chatId: userId,
                        messageIndex: i,
                        success: false,
                        error: errorMsg
                    });
                }
            }

            // Задержка между пользователями
            await new Promise(r => setTimeout(r, 2000));
        }

        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;

        return NextResponse.json({
            success: true,
            message: `Отправлено ${successCount} из ${totalCount} сообщений`,
            results
        });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка на сервере:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}
