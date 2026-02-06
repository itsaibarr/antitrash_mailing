import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { getActiveSubscribers, initDatabase } from "../../../../lib/db";
import { createLogicalPoll, addPollMessage } from "../../../../lib/polls";
import { safeTelegramSend } from "../../../../lib/telegramHelpers";

const token = process.env.TELEGRAM_BOT_TOKEN!;

type PollOptions = {
    question: string;
    options: string[];
    is_anonymous?: boolean;
    allows_multiple_answers?: boolean;
};

export async function POST(req: Request) {
    try {
        await initDatabase();

        const bot = new Telegraf(token);
        const { question, options, is_anonymous = true, allows_multiple_answers = false }: PollOptions = await req.json();

        if (!question || !options || options.length < 2) {
            return NextResponse.json({ error: "Вопрос и минимум 2 варианта ответа обязательны" }, { status: 400 });
        }

        const logicalPoll = await createLogicalPoll(question, options, is_anonymous, allows_multiple_answers);
        const subscribers = await getActiveSubscribers();
        const users = subscribers.map(s => s.chat_id);

        if (users.length === 0) {
            return NextResponse.json({ error: "Нет активных подписчиков" }, { status: 400 });
        }

        const results: { chatId: string | number; messageId?: number; pollId?: string; logicalPollId: string }[] = [];

        for (const id of users) {
            const inlineKeyboard = options.map((option, index) => [{
                text: option,
                callback_data: `poll:${logicalPoll.id}:${index}`
            }]);

            const result = await safeTelegramSend(id, async () => {
                return await bot.telegram.sendMessage(id, question, {
                    reply_markup: {
                        inline_keyboard: inlineKeyboard
                    }
                });
            });

            if (result.success && result.messageId) {
                await addPollMessage({
                    logical_poll_id: logicalPoll.id,
                    telegram_poll_id: `button_poll_${logicalPoll.id}`,
                    chat_id: id,
                    message_id: result.messageId,
                });

                results.push({
                    chatId: id,
                    messageId: result.messageId,
                    pollId: `button_poll_${logicalPoll.id}`,
                    logicalPollId: logicalPoll.id,
                });
                console.log("✅ Опрос отправлен:", id);
            } else {
                results.push({ chatId: id, logicalPollId: logicalPoll.id });
            }
            await new Promise((r) => setTimeout(r, 1000));
        }

        return NextResponse.json({ success: true, logicalPollId: logicalPoll.id, results });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка на сервере:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}
