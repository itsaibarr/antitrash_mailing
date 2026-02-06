import { Telegraf } from "telegraf";
import {
    addPollAnswer,
    PollAnswer,
    findLogicalPollIdByTelegramPollId,
    addPollResponse,
    hasUserAnsweredPoll,
    loadLogicalPolls
} from "./polls";
import { addSubscriber } from "./db";

const token = process.env.TELEGRAM_BOT_TOKEN!;
const logBotToken = process.env.LOG_BOT_TOKEN!;
const logChatId = process.env.LOG_CHAT_ID!;

export async function handlePollAnswer(update: any) {
    if (!update.poll_answer) return;

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

export async function handleCallbackQuery(update: any) {
    if (!update.callback_query) return;

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

    if (data.startsWith('poll:')) {
        await handlePollCallback(callbackQuery, user, data, message, token);
    } else {
        await handleButtonCallback(callbackQuery, user, data, message, token, logBotToken, logChatId);
    }
}

async function handlePollCallback(callbackQuery: any, user: any, data: string, message: any, botToken: string) {
    const parts = data.split(':');
    if (parts.length >= 3) {
        const logical_poll_id = parts[1];
        const option_index = parseInt(parts[2]);
        const telegram_user_id = user.id;

        // Check if already answered
        const alreadyAnswered = await hasUserAnsweredPoll(logical_poll_id, telegram_user_id);

        if (alreadyAnswered) {
            try {
                const bot = new Telegraf(botToken);
                await bot.telegram.answerCbQuery(callbackQuery.id, "Вы уже ответили на этот опрос", {
                    show_alert: false
                });
                console.log("⚠️ User already answered poll:", { logical_poll_id, telegram_user_id });
            } catch (error) {
                console.error("❌ Failed to answer callback query for duplicate:", error);
            }
        } else {
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
                const bot = new Telegraf(botToken);
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
                    const bot = new Telegraf(botToken);
                    await bot.telegram.answerCbQuery(callbackQuery.id, "Ошибка обработки ответа", {
                        show_alert: true
                    });
                } catch (answerError) {
                    console.error("❌ Failed to answer callback on error:", answerError);
                }
            }
        }
    } else {
        try {
            const bot = new Telegraf(botToken);
            await bot.telegram.answerCbQuery(callbackQuery.id, "Неверный формат данных опроса", {
                show_alert: true
            });
        } catch (error) {
            console.error("❌ Failed to answer invalid poll callback:", error);
        }
    }
}

async function handleButtonCallback(callbackQuery: any, user: any, data: string, message: any, botToken: string, logBotToken: string, logChatId: string) {
    const userTag = user.username ? `@${user.username}` : `${user.first_name || 'Unknown'} ${user.last_name || ''}`.trim();
    let question = 'Вопрос';
    let buttonText = data;

    if (data.includes('|')) {
        const parts = data.split('|');
        if (parts.length >= 2) {
            question = parts[0];
            buttonText = parts[1];
        }
    } else {
        if (message && message.text) {
            question = message.text;
        }
        buttonText = data;
    }

    const groupChatId = "-1003090304051";
    try {
        const bot = new Telegraf(botToken);
        const groupMessage = `❓ **${question}**\n\n` +
            `👤 ${userTag} (ID: ${user.id})\n` +
            `🔘 Нажал кнопку: "${buttonText}"`;
        await bot.telegram.sendMessage(groupChatId, groupMessage);
        console.log("✅ Button press logged to group:", { userId: user.id, question, buttonText });
    } catch (groupError) {
        console.error("❌ Failed to send button press to group:", groupError);
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

    try {
        const bot = new Telegraf(botToken);
        await bot.telegram.answerCbQuery(callbackQuery.id, "Спасибо за отправку!", {
            show_alert: false
        });
    } catch (answerError) {
        console.error("❌ Failed to answer callback query:", answerError);
    }

    if (message) {
        try {
            const bot = new Telegraf(botToken);
            const newText = `${message.text}\n\n✅ Спасибо за отправку!`;
            await bot.telegram.editMessageText(message.chat.id, message.message_id, undefined, newText, {
                reply_markup: { inline_keyboard: [] }
            });
        } catch (editError) {
            console.error("❌ Failed to edit message:", editError);
        }
    }
}

export async function handleMessage(update: any, token: string) {
    if (!update.message) return;

    const message = update.message;
    const chat = message.chat;
    const user = message.from;
    const text = message.text;

    if (chat.type === 'private' && text === '/start') {
        try {
            await addSubscriber(chat.id, {
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name
            });

            const bot = new Telegraf(token);
            const welcomeMessage = `👋 Добро пожаловать!\n\n` +
                `Вы успешно подписались на рассылку. Теперь вы будете получать все важные обновления и опросы.`;

            await bot.telegram.sendMessage(chat.id, welcomeMessage);
            console.log(`✅ User subscribed: ${chat.id} (${user.username || user.first_name})`);
        } catch (error) {
            console.error("❌ Failed to handle /start command:", error);
        }
    }

    if (chat.type === 'private') {
        console.log("Private message received:", {
            chatId: chat.id,
            userId: user.id,
            username: user.username,
            text: text
        });
    }
}
