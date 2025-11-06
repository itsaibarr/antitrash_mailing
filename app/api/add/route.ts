import { NextResponse } from "next/server";
import fs from "fs/promises";

export async function POST(req: Request) {
    const { chatId } = await req.json();
    if (!chatId) return NextResponse.json({ error: "Нет chatId" }, { status: 400 });

    const file = await fs.readFile("chatList.json", "utf-8");
    const list = JSON.parse(file);

    if (!list.includes(chatId)) {
        list.push(chatId);
        await fs.writeFile("chatList.json", JSON.stringify(list, null, 2));
    }

    return NextResponse.json({ success: true, list });
}

