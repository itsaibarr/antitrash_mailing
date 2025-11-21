import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";

const token = process.env.TELEGRAM_BOT_TOKEN!;
const webhookUrl = process.env.WEBHOOK_URL!;

export async function POST(req: Request) {
    try {
        console.log("🔧 Начинаем настройку webhook");

        if (!token) {
            return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN не задан" }, { status: 500 });
        }

        if (!webhookUrl) {
            return NextResponse.json({ error: "WEBHOOK_URL не задан" }, { status: 500 });
        }

        const bot = new Telegraf(token);

        // Устанавливаем webhook
        const result = await bot.telegram.setWebhook(webhookUrl);

        if (result) {
            console.log(`✅ Webhook успешно установлен: ${webhookUrl}`);

            // Получаем информацию о webhook
            const webhookInfo = await bot.telegram.getWebhookInfo();
            console.log("📋 Информация о webhook:", webhookInfo);

            return NextResponse.json({
                success: true,
                message: `Webhook установлен: ${webhookUrl}`,
                webhookInfo
            });
        } else {
            console.log("❌ Ошибка установки webhook");
            return NextResponse.json({ error: "Не удалось установить webhook" }, { status: 500 });
        }

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка при настройке webhook:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        console.log("🔧 Удаляем webhook");

        if (!token) {
            return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN не задан" }, { status: 500 });
        }

        const bot = new Telegraf(token);

        // Удаляем webhook
        const result = await bot.telegram.deleteWebhook();

        if (result) {
            console.log("✅ Webhook успешно удален");

            return NextResponse.json({
                success: true,
                message: "Webhook удален"
            });
        } else {
            console.log("❌ Ошибка удаления webhook");
            return NextResponse.json({ error: "Не удалось удалить webhook" }, { status: 500 });
        }

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка при удалении webhook:", msg);
        return NextResponse.json({ error: `Ошибка сервера: ${msg}` }, { status: 500 });
    }
}
