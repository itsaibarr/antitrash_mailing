import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { loadChatList } from "../../../../lib/chatList";

const token = process.env.TELEGRAM_BOT_TOKEN!;

type PollOptions = {
    question: string;
    options: string[];
    is_anonymous?: boolean;
    allows_multiple_answers?: boolean;
};

export async function POST(req: Request) {
    try {
        const bot = new Telegraf(token);
        const { question, options, is_anonymous = true, allows_multiple_answers = false }: PollOptions = await req.json();

        if (!question || !options || options.length < 2) {
            return NextResponse.json({ error: "Вопрос и минимум 2 варианта ответа обязательны" }, { status: 400 });
        }

        const users = await loadChatList();

        const results: { chatId: string | number; messageId?: number; pollId?: string }[] = [];

        for (const id of users) {
            try {
                const pollMessage = await bot.telegram.sendPoll(id, question, options, {
                    is_anonymous,
                    allows_multiple_answers,
                });
                results.push({
                    chatId: id,
                    messageId: pollMessage.message_id,
                    pollId: pollMessage.poll?.id,
                });
                console.log("✅ Опрос отправлен:", id);
                await new Promise((r) => setTimeout(r, 1000));
            } catch (err: unknown) {
                console.error(`❌ Ошибка при отправке опроса ${id}:`, err);
                results.push({ chatId: id });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка на сервере:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}
