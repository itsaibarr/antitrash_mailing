import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { getActiveSubscribers, deactivateSubscriber, initDatabase } from "../../../../lib/db";
import { createLogicalPoll, addPollMessage } from "../../../../lib/polls";
import { safeTelegramSend } from "../../../../lib/telegramHelpers";
import { checkAdminAuth } from "../../../../lib/adminAuth";

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
    logical_poll_id?: string;
};

export async function POST(req: Request) {
    const guard = checkAdminAuth(req);
    if (guard) return guard;
    try {
        // Initialize database tables if needed
        await initDatabase();

        console.log("🔄 Начинаем отправку цепочки сообщений");

        const { messages }: { messages: Message[] } = await req.json();

        console.log(`📨 Получено ${messages?.length || 0} сообщений для отправки`);

        if (!messages || messages.length === 0) {
            console.log("❌ Ошибка: нет сообщений для отправки");
            return NextResponse.json({ error: "Нет сообщений для отправки" }, { status: 400 });
        }

        // Получаем список активных подписчиков из базы данных
        const subscribers = await getActiveSubscribers();
        const users = subscribers.map(s => s.chat_id);
        console.log(`👥 Загружено ${users.length} подписчиков из базы данных`);

        if (users.length === 0) {
            return NextResponse.json({ error: "Нет активных подписчиков" }, { status: 400 });
        }

        // Проверяем токен
        if (!token) {
            console.error("❌ TELEGRAM_BOT_TOKEN не установлен");
            return NextResponse.json({ error: "Бот токен не настроен" }, { status: 500 });
        }

        const bot = new Telegraf(token);

        // Обработать polls: создать logical polls
        const processedMessages = await Promise.all(messages.map(async (msg) => {
            if (msg.type === 'poll' && msg.poll) {
                const logicalPoll = await createLogicalPoll(msg.poll.question, msg.poll.options, msg.poll.is_anonymous, msg.poll.allows_multiple_answers);
                return { ...msg, logical_poll_id: logicalPoll.id };
            }
            return msg;
        }));

        // Начинаем асинхронную отправку
        const sendPromise = (async () => {
            const results: Array<{
                chatId: string | number;
                messageIndex: number;
                success: boolean;
                error?: string;
            }> = [];

            for (const userId of users) {
                for (let i = 0; i < processedMessages.length; i++) {
                    const msg = processedMessages[i];

                    const result = await safeTelegramSend(userId, async () => {
                        if (msg.type === 'text') {
                            return await bot.telegram.sendMessage(userId, msg.content);
                        } else if (msg.type === 'image' && msg.media) {
                            const imgBuffer = Buffer.from(msg.media.data, "base64");
                            return await bot.telegram.sendPhoto(userId, { source: imgBuffer }, {
                                caption: msg.caption || undefined
                            });
                        } else if (msg.type === 'video' && msg.media) {
                            const videoBuffer = Buffer.from(msg.media.data, "base64");
                            return await bot.telegram.sendVideo(userId, { source: videoBuffer }, {
                                caption: msg.caption || undefined
                            });
                        } else if (msg.type === 'file' && msg.media) {
                            const fileBuffer = Buffer.from(msg.media.data, "base64");
                            return await bot.telegram.sendDocument(userId, {
                                source: fileBuffer,
                                filename: msg.media.name
                            }, {
                                caption: msg.caption || undefined
                            });
                        } else if (msg.type === 'poll' && msg.poll) {
                            // Создать inline клавиатуру для опроса
                            const inlineKeyboard = msg.poll.options.map((option, index) => [{
                                text: option,
                                callback_data: `poll:${msg.logical_poll_id!}:${index}`
                            }]);

                            const pollMessage = await bot.telegram.sendMessage(userId, msg.poll.question, {
                                reply_markup: {
                                    inline_keyboard: inlineKeyboard
                                }
                            });

                            // Return message for later use in result handling if needed, 
                            // though safeTelegramSend handles the result return.
                            // We need to store the message_id for saving to DB.
                            return pollMessage;
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

                            return await bot.telegram.sendMessage(userId, msg.buttonText || msg.content || 'Выберите действие:', {
                                reply_markup: {
                                    inline_keyboard: inlineKeyboard
                                }
                            });
                        }
                    });

                    if (result.success) {
                        if (msg.type === 'poll' && msg.poll && result.messageId) {
                            // Сохранить связь
                            try {
                                await addPollMessage({
                                    logical_poll_id: msg.logical_poll_id!,
                                    telegram_poll_id: `button_poll_${msg.logical_poll_id!}`,
                                    chat_id: userId,
                                    message_id: result.messageId,
                                });
                            } catch (e) {
                                console.error("Error saving poll message", e);
                            }
                        }

                        console.log(`✅ Сообщение ${i + 1} отправлено пользователю ${userId}`);
                        results.push({
                            chatId: userId,
                            messageIndex: i,
                            success: true
                        });

                        // Задержка между сообщениями
                        await new Promise(r => setTimeout(r, 1000));

                    } else {
                        results.push({
                            chatId: userId,
                            messageIndex: i,
                            success: false,
                            error: result.error
                        });
                        // Break user loop on error? Original code didn't break explicitly but went to next iteration.
                        // We continue to next message for same user? Or stop?
                        // Original code caught error and continued loop.
                    }
                }

                // Задержка между пользователями
                await new Promise(r => setTimeout(r, 2000));
            }

            console.log(`📊 Отправка завершена. Результаты:`, results);
        })();

        // Возвращаем ответ сразу, не дожидаясь завершения отправки
        sendPromise.catch(err => console.error("Ошибка в фоновой отправке:", err));

        return NextResponse.json({
            success: true,
            message: `Отправка начата для ${users.length} пользователей`,
            userCount: users.length,
            messageCount: messages.length
        });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка на сервере:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}
