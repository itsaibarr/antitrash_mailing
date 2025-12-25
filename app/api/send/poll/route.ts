import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { loadChatList } from "../../../../lib/chatList";
import { createLogicalPoll, addPollMessage } from "../../../../lib/polls";
import { initDatabase } from "../../../../lib/db";

const token = process.env.TELEGRAM_BOT_TOKEN!;

type PollOptions = {
    question: string;
    options: string[];
    is_anonymous?: boolean;
    allows_multiple_answers?: boolean;
};

export async function POST(req: Request) {
    try {
        // Initialize database tables if needed
        await initDatabase();

        const bot = new Telegraf(token);
        const { question, options, is_anonymous = true, allows_multiple_answers = false }: PollOptions = await req.json();

        if (!question || !options || options.length < 2) {
            return NextResponse.json({ error: "Вопрос и минимум 2 варианта ответа обязательны" }, { status: 400 });
        }

        // Создать логический опрос
        const logicalPoll = await createLogicalPoll(question, options, is_anonymous, allows_multiple_answers);

        const users = await loadChatList();

        const results: { chatId: string | number; messageId?: number; pollId?: string; logicalPollId: string }[] = [];

        for (const id of users) {
            try {
                // Создать inline клавиатуру для опроса
                const inlineKeyboard = options.map((option, index) => [{
                    text: option,
                    callback_data: `poll:${logicalPoll.id}:${index}`
                }]);

                const pollMessage = await bot.telegram.sendMessage(id, question, {
                    reply_markup: {
                        inline_keyboard: inlineKeyboard
                    }
                });

                // Сохранить связь message_id (без poll_id, поскольку это кнопки)
                await addPollMessage({
                    logical_poll_id: logicalPoll.id,
                    telegram_poll_id: `button_poll_${logicalPoll.id}`, // Фиктивный ID для кнопок
                    chat_id: id,
                    message_id: pollMessage.message_id,
                });

                results.push({
                    chatId: id,
                    messageId: pollMessage.message_id,
                    pollId: `button_poll_${logicalPoll.id}`,
                    logicalPollId: logicalPoll.id,
                });
                console.log("✅ Опрос отправлен:", id);
                await new Promise((r) => setTimeout(r, 1000));
            } catch (err: unknown) {
                console.error(`❌ Ошибка при отправке опроса ${id}:`, err);
                results.push({ chatId: id, logicalPollId: logicalPoll.id });
            }
        }

        return NextResponse.json({ success: true, logicalPollId: logicalPoll.id, results });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка на сервере:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}
