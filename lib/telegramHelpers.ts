import { Telegraf } from "telegraf";
import { deactivateSubscriber } from "./db";

// Helper type for the common result structure
export type SendResult = {
    chatId: string | number;
    success: boolean;
    error?: string;
    messageId?: number;
};

// Generic sender function that handles errors and deactivation
export async function safeTelegramSend(
    chatId: string | number,
    action: () => Promise<any>
): Promise<SendResult> {
    try {
        const result = await action();
        // Return success and message_id if available (useful for polls/chains)
        return {
            chatId,
            success: true,
            messageId: result?.message_id,
        };
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Error sending to ${chatId}:`, errorMsg);

        // Handle specific Telegram errors for deactivation
        if (
            errorMsg.includes('chat not found') ||
            errorMsg.includes('bot was blocked') ||
            errorMsg.includes('user is deactivated') ||
            errorMsg.includes('chat was deactivated') ||
            errorMsg.includes('group chat was upgraded')
        ) {
            try {
                // Ensure chatId is a number
                const numericChatId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
                if (!isNaN(numericChatId)) {
                    await deactivateSubscriber(numericChatId);
                    console.log(`🚫 Subscriber deactivated: ${chatId}`);
                }
            } catch (deactivateError) {
                console.error(`❌ Failed to deactivate subscriber ${chatId}:`, deactivateError);
            }
        }

        return {
            chatId,
            success: false,
            error: errorMsg,
        };
    }
}
