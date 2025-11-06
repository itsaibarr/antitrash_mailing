import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { loadChatList } from "../../../lib/chatList";

const token = process.env.TELEGRAM_BOT_TOKEN!;

export async function POST(req: Request) {
    try {
        const bot = new Telegraf(token);
        const { message, image } = await req.json();
        if (!message && !image) return NextResponse.json({ error: "Пустое сообщение и нет изображения" }, { status: 400 });

        // читаем список chatID безопасно через lib
        const users = await loadChatList();

        // если передано изображение — подготовим Buffer
        let imgBuffer: Buffer | null = null;
        if (image && image.data) {
            try {
                imgBuffer = Buffer.from(image.data, "base64");
            } catch (err: unknown) {
                console.error("Ошибка при декодировании изображения:", err);
                // не прерываем — просто оставляем imgBuffer null
            }
        }

        for (const id of users) {
            try {
                if (imgBuffer) {
                    // отправляем фото с подписью (если есть текст)
                    await bot.telegram.sendPhoto(id, { source: imgBuffer }, { caption: message || undefined });
                    console.log("✅ Фото отправлено:", id);
                } else {
                    await bot.telegram.sendMessage(id, message);
                    console.log("✅ Отправлено:", id);
                }
                await new Promise((r) => setTimeout(r, 1000));
            } catch (err: unknown) {
                console.error(`❌ Ошибка при ${id}:`, err);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка на сервере:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}
