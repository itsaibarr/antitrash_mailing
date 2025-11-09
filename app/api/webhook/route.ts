import { NextResponse } from "next/server";
import { addPollAnswer, type PollAnswer } from "../../../lib/polls";
import crypto from "crypto";

const token = process.env.TELEGRAM_BOT_TOKEN!;

function verifyTelegramUpdate(body: string, secret: string): boolean {
    const secretKey = crypto.createHash("sha256").update(token).digest();
    const hmac = crypto.createHmac("sha256", secretKey).update(body).digest("hex");
    return hmac === secret;
}

export async function POST(req: Request) {
    try {
        const body = await req.text();
        const secret = req.headers.get("x-telegram-bot-api-secret-token");

        if (secret && !verifyTelegramUpdate(body, secret)) {
            return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
        }

        const update = JSON.parse(body);

        // Handle poll_answer
        if (update.poll_answer) {
            const pollAnswer: PollAnswer = {
                poll_id: update.poll_answer.poll_id,
                user: update.poll_answer.user,
                option_ids: update.poll_answer.option_ids,
            };
            await addPollAnswer(pollAnswer);
            console.log("Poll answer recorded:", pollAnswer);
        }

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Webhook error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
