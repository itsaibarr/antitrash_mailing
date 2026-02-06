import { NextResponse } from "next/server";
import { initDatabase } from "../../../lib/db";
import crypto from "crypto";
import { handlePollAnswer, handleCallbackQuery, handleMessage } from "../../../lib/webhookLogic";

const token = process.env.TELEGRAM_BOT_TOKEN!;

function verifyTelegramUpdate(body: string, secret: string): boolean {
    const secretKey = crypto.createHash("sha256").update(token).digest();
    const hmac = crypto.createHmac("sha256", secretKey).update(body).digest("hex");
    return hmac === secret;
}

export async function POST(req: Request) {
    try {
        await initDatabase();

        const body = await req.text();
        const secret = req.headers.get("x-telegram-bot-api-secret-token");

        console.log("🔗 Webhook received:", {
            hasSecret: !!secret,
            bodyLength: body.length,
            timestamp: new Date().toISOString()
        });

        if (secret && !verifyTelegramUpdate(body, secret)) {
            console.error("❌ Invalid webhook secret token");
            return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
        }

        const update = JSON.parse(body);

        console.log("📨 Update type:", Object.keys(update).filter(key => update[key] !== undefined));

        if (update.poll_answer) {
            await handlePollAnswer(update);
        }

        if (update.callback_query) {
            await handleCallbackQuery(update);
        }

        if (update.message) {
            await handleMessage(update, token);
        }

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Webhook error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
