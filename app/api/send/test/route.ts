import { NextResponse } from "next/server";
import { Telegraf } from "telegraf";

const token = process.env.TELEGRAM_BOT_TOKEN;

type ImageLike = { data: string; name?: string; type?: string };
type Body = { chatId?: string | number; message?: string; image?: ImageLike };

export async function POST(req: Request) {
    if (!token) {
        return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN не задан" }, { status: 500 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Невалидный JSON: ${msg}` }, { status: 400 });
    }

    const parsed = (body ?? {}) as Body;
    const { chatId, message, image } = parsed;
    if (!chatId) return NextResponse.json({ error: "chatId обязателен" }, { status: 400 });
    if (!message && !image) return NextResponse.json({ error: "message или image обязателен" }, { status: 400 });

    try {
        const bot = new Telegraf(token);
        let imgBuffer: Buffer | null = null;
        if (image && image.data) {
            try {
                imgBuffer = Buffer.from(image.data, "base64");
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                return NextResponse.json({ error: `Ошибка декодирования изображения: ${msg}` }, { status: 400 });
            }
        }

        if (imgBuffer) {
            const filename = image?.name ?? "photo.jpg";
            await bot.telegram.sendPhoto(
                chatId,
                { source: imgBuffer, filename },
                { caption: message || undefined }
            );
        } else if (typeof message === "string") {
            await bot.telegram.sendMessage(chatId, message);
        } else {
            return NextResponse.json(
                { error: "message обязателен, если изображение отсутствует" },
                { status: 400 }
            );
        }


        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}


