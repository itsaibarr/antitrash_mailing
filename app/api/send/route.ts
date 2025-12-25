import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { getActiveSubscribers, deactivateSubscriber } from "../../../lib/db";

const token = process.env.TELEGRAM_BOT_TOKEN!;

export async function POST(req: Request) {
    try {
        const bot = new Telegraf(token);
        const { message, image } = await req.json();
        if (!message && !image) return NextResponse.json({ error: "Пустое сообщение и нет изображения" }, { status: 400 });

        // Получаем список активных подписчиков из базы данных
        const subscribers = await getActiveSubscribers();
        const chatIds = subscribers.map(s => s.chat_id);

        if (chatIds.length === 0) {
            return NextResponse.json({ error: "Нет активных подписчиков" }, { status: 400 });
        }

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

        let successCount = 0;
        let errorCount = 0;

        for (const chatId of chatIds) {
            try {
                if (imgBuffer) {
                    // отправляем фото с подписью (если есть текст)
                    await bot.telegram.sendPhoto(chatId, { source: imgBuffer }, { caption: message || undefined });
                    console.log("✅ Фото отправлено:", chatId);
                } else {
                    await bot.telegram.sendMessage(chatId, message);
                    console.log("✅ Отправлено:", chatId);
                }
                successCount++;
                await new Promise((r) => setTimeout(r, 1000));
            } catch (err: unknown) {
                console.error(`❌ Ошибка при отправке ${chatId}:`, err);

                // Handle specific Telegram errors
                const errorMessage = err instanceof Error ? err.message : String(err);
                if (errorMessage.includes('chat not found') ||
                    errorMessage.includes('bot was blocked') ||
                    errorMessage.includes('user is deactivated') ||
                    errorMessage.includes('chat was deactivated')) {
                    // Deactivate subscriber if chat is unavailable
                    try {
                        await deactivateSubscriber(chatId);
                        console.log(`🚫 Подписчик деактивирован: ${chatId}`);
                    } catch (deactivateError) {
                        console.error(`❌ Не удалось деактивировать подписчика ${chatId}:`, deactivateError);
                    }
                }
                errorCount++;
            }
        }

        console.log(`📊 Рассылка завершена: ${successCount} успешно, ${errorCount} ошибок`);

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка на сервере:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}
