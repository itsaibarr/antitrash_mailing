import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { getActiveSubscribers, initDatabase } from "../../../lib/db";
import { safeTelegramSend } from "../../../lib/telegramHelpers";

const token = process.env.TELEGRAM_BOT_TOKEN!;

export async function POST(req: Request) {
    try {
        await initDatabase();

        const bot = new Telegraf(token);
        const { message, image } = await req.json();
        if (!message && !image) return NextResponse.json({ error: "Пустое сообщение и нет изображения" }, { status: 400 });

        const subscribers = await getActiveSubscribers();
        const chatIds = subscribers.map(s => s.chat_id);

        if (chatIds.length === 0) {
            return NextResponse.json({ error: "Нет активных подписчиков" }, { status: 400 });
        }

        let imgBuffer: Buffer | null = null;
        if (image && image.data) {
            try {
                imgBuffer = Buffer.from(image.data, "base64");
            } catch (err: unknown) {
                console.error("Ошибка при декодировании изображения:", err);
            }
        }

        let successCount = 0;
        let errorCount = 0;

        for (const chatId of chatIds) {
            const result = await safeTelegramSend(chatId, async () => {
                if (imgBuffer) {
                    return await bot.telegram.sendPhoto(chatId, { source: imgBuffer }, { caption: message || undefined });
                } else {
                    return await bot.telegram.sendMessage(chatId, message);
                }
            });

            if (result.success) {
                successCount++;
                console.log("✅ Отправлено:", chatId);
            } else {
                errorCount++;
            }
            await new Promise((r) => setTimeout(r, 1000));
        }

        console.log(`📊 Рассылка завершена: ${successCount} успешно, ${errorCount} ошибок`);

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка на сервере:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}
