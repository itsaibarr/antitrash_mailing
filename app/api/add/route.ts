import { NextResponse } from "next/server";
import { loadChatList, saveChatList } from "../../../lib/chatList";

type Body = { chatId?: string | number };

export const POST = async (req: Request) => {
    let body: unknown;
    try {
        body = await req.json();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Невалидный JSON: ${msg}` }, { status: 400 });
    }

    const parsed = (body ?? {}) as Body;
    const { chatId } = parsed;
    if (!chatId) return NextResponse.json({ error: "Нет chatId" }, { status: 400 });

    try {
        const list = await loadChatList();
        if (!list.includes(chatId)) {
            list.push(chatId);
            await saveChatList(list);
        }
        return NextResponse.json({ success: true, list });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Ошибка при сохранении списка: ${msg}` }, { status: 500 });
    }
};
