import { NextResponse } from "next/server";
import { addPollAnswer, type PollAnswer } from "../../../lib/polls";
import { Telegraf } from "telegraf";
import crypto from "crypto";

const token = process.env.TELEGRAM_BOT_TOKEN!;
const logBotToken = process.env.LOG_BOT_TOKEN!;
const logChatId = process.env.LOG_CHAT_ID!;

function verifyTelegramUpdate(body: string, secret: string): boolean {
    const secretKey = crypto.createHash("sha256").update(token).digest();
    const hmac = crypto.createHmac("sha256", secretKey).update(body).digest("hex");
    return hmac === secret;
}

export async function POST(req: Request) {
    try {
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

        // Handle callback_query (button presses) - always send to group
        if (update.callback_query) {
            const callbackQuery = update.callback_query;
            const user = callbackQuery.from;
            const data = callbackQuery.data;
            const message = callbackQuery.message;

            console.log("🔘 Callback query received:", {
                userId: user.id,
                username: user.username,
                data: data,
                hasMessage: !!message,
                messageText: message?.text,
                messageType: message ? Object.keys(message).filter(k => message[k] !== undefined) : []
            });

            // Create user tag
            const userTag = user.username ? `@${user.username}` : `${user.first_name || 'Unknown'} ${user.last_name || ''}`.trim();

            // Extract question and button text from callback_data or message text
            let question = 'Вопрос';
            let buttonText = data;

            // For callback buttons, data contains "question|button" format
            if (data.includes('|')) {
                const parts = data.split('|');
                if (parts.length >= 2) {
                    question = parts[0];
                    buttonText = parts[1];
                    console.log("📝 Using question and button from callback_data:", { question, buttonText });
                }
            } else {
                // For other button types, try to get question from message text
                if (message && message.text) {
                    question = message.text;
                    console.log("📝 Using question from message text:", question);
                }
                console.log("📝 Using buttonText from data:", data);
                buttonText = data;
            }

            // Always send notification to the group (use the group chat ID from chatlist)
            const groupChatId = "-1003090304051"; // Your group chat ID
            try {
                const bot = new Telegraf(token);
                const groupMessage = `❓ **${question}**\n\n` +
                    `👤 ${userTag} (ID: ${user.id})\n` +
                    `🔘 Нажал кнопку: "${buttonText}"`;
                await bot.telegram.sendMessage(groupChatId, groupMessage);
                console.log("✅ Button press logged to group:", { userId: user.id, question, buttonText, sourceChatId: message?.chat?.id });
            } catch (groupError) {
                console.error("❌ Failed to send button press to group:", {
                    error: groupError,
                    groupChatId,
                    question,
                    buttonText,
                    userId: user.id
                });

                // Try to send error message to log chat instead
                try {
                    const logBot = new Telegraf(logBotToken);
                    const errorMessage = `❌ Ошибка отправки в группу:\n${JSON.stringify({
                        error: String(groupError),
                        groupChatId,
                        question,
                        buttonText,
                        userId: user.id
                    }, null, 2)}`;
                    await logBot.telegram.sendMessage(logChatId, errorMessage);
                } catch (logError) {
                    console.error("❌ Failed to send error to log chat:", logError);
                }
            }

            // Answer the callback query to remove loading state
            try {
                const bot = new Telegraf(token);
                await bot.telegram.answerCbQuery(callbackQuery.id);
                console.log("✅ Callback query answered");
            } catch (answerError) {
                console.error("❌ Failed to answer callback query:", answerError);
            }
        }

        // Handle messages (for getting chat IDs) - disabled to prevent spam
        if (update.message) {
            const message = update.message;
            const chat = message.chat;
            const user = message.from;

            // Only log chat ID for private messages or specific commands
            if (chat.type === 'private') {
                console.log("Private message received:", {
                    chatId: chat.id,
                    userId: user.id,
                    username: user.username,
                    text: message.text
                });
            }
            // Group chat ID logging disabled to prevent spam
        }

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Webhook error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
