import { NextResponse } from "next/server";
import { addPollAnswer, type PollAnswer, findLogicalPollIdByTelegramPollId, addPollResponse, hasUserAnsweredPoll, getUserPollResponse, loadLogicalPolls } from "../../../lib/polls";
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
            const telegram_poll_id = update.poll_answer.poll_id;
            const telegram_user_id = update.poll_answer.user.id;
            const option_ids = update.poll_answer.option_ids;

            // Найти логический poll_id по telegram_poll_id
            const logical_poll_id = await findLogicalPollIdByTelegramPollId(telegram_poll_id);

            if (logical_poll_id) {
                // Сохранить ответ с привязкой к logical_poll_id
                await addPollResponse({
                    logical_poll_id,
                    telegram_user_id,
                    option_indices: option_ids,
                });
                console.log("Poll response recorded:", { logical_poll_id, telegram_user_id, option_ids });
            } else {
                // Fallback to old logic if not found
                const pollAnswer: PollAnswer = {
                    poll_id: telegram_poll_id,
                    user: update.poll_answer.user,
                    option_ids,
                };
                await addPollAnswer(pollAnswer);
                console.log("Fallback poll answer recorded:", pollAnswer);
            }
        }

        // Handle callback_query
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

            // Handle poll callbacks
            if (data.startsWith('poll:')) {
                const parts = data.split(':');
                if (parts.length >= 3) {
                    const logical_poll_id = parts[1];
                    const option_index = parseInt(parts[2]);
                    const telegram_user_id = user.id;

                    // Check if already answered
                    const alreadyAnswered = await hasUserAnsweredPoll(logical_poll_id, telegram_user_id);

                    if (alreadyAnswered) {
                        // Already answered
                        try {
                            const bot = new Telegraf(token);
                            await bot.telegram.answerCbQuery(callbackQuery.id, "Вы уже ответили на этот опрос", {
                                show_alert: false
                            });
                            console.log("⚠️ User already answered poll:", { logical_poll_id, telegram_user_id });
                        } catch (error) {
                            console.error("❌ Failed to answer callback query for duplicate:", error);
                        }
                    } else {
                        // First time answer
                        try {
                            // Get poll details
                            const polls = await loadLogicalPolls();
                            const poll = polls.find(p => p.id === logical_poll_id);
                            const option_text = poll ? poll.options[option_index] : `Вариант ${option_index + 1}`;

                            // Save response
                            await addPollResponse({
                                logical_poll_id,
                                telegram_user_id,
                                option_indices: [option_index],
                                option_texts: [option_text],
                            });

                            // Create user tag
                            const userTag = user.username ? `@${user.username}` : `${user.first_name || 'Unknown'} ${user.last_name || ''}`.trim();

                            // Send notification to mentors
                            const groupChatId = "-1003090304051";
                            const question = poll ? poll.question : 'Опрос';
                            const bot = new Telegraf(token);
                            const groupMessage = `❓ **${question}**\n\n` +
                                `👤 ${userTag} (ID: ${user.id})\n` +
                                `🔘 Выбрал: "${option_text}"`;
                            await bot.telegram.sendMessage(groupChatId, groupMessage);

                            // Answer callback with success
                            await bot.telegram.answerCbQuery(callbackQuery.id, "Спасибо, ваш ответ принят!", {
                                show_alert: false
                            });

                            // Edit message to remove buttons or show answered
                            if (message) {
                                const newText = `${message.text}\n\n✅ Вы ответили: "${option_text}"`;
                                await bot.telegram.editMessageText(message.chat.id, message.message_id, undefined, newText, {
                                    reply_markup: { inline_keyboard: [] } // Remove buttons
                                });
                            }

                            console.log("✅ Poll response saved and notified:", { logical_poll_id, telegram_user_id, option_text });
                        } catch (error) {
                            console.error("❌ Failed to process poll callback:", error);
                            try {
                                const bot = new Telegraf(token);
                                await bot.telegram.answerCbQuery(callbackQuery.id, "Ошибка обработки ответа", {
                                    show_alert: true
                                });
                            } catch (answerError) {
                                console.error("❌ Failed to answer callback on error:", answerError);
                            }
                        }
                    }
                } else {
                    // Invalid poll data
                    try {
                        const bot = new Telegraf(token);
                        await bot.telegram.answerCbQuery(callbackQuery.id, "Неверный формат данных опроса", {
                            show_alert: true
                        });
                    } catch (error) {
                        console.error("❌ Failed to answer invalid poll callback:", error);
                    }
                }
            } else {
                // Handle other callback buttons - always send to group
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

                // Answer the callback query with success message
                try {
                    const bot = new Telegraf(token);
                    await bot.telegram.answerCbQuery(callbackQuery.id, "Спасибо за отправку!", {
                        show_alert: false
                    });
                    console.log("✅ Callback query answered");
                } catch (answerError) {
                    console.error("❌ Failed to answer callback query:", answerError);
                }

                // Edit the message to remove buttons and show thank you
                if (message) {
                    try {
                        const bot = new Telegraf(token);
                        const newText = `${message.text}\n\n✅ Спасибо за отправку!`;
                        await bot.telegram.editMessageText(message.chat.id, message.message_id, undefined, newText, {
                            reply_markup: { inline_keyboard: [] } // Remove buttons
                        });
                        console.log("✅ Message edited: buttons removed, thank you added");
                    } catch (editError) {
                        console.error("❌ Failed to edit message:", editError);
                    }
                }
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
