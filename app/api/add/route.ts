import { NextResponse } from "next/server";
import fs from "fs/promises";

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

    // допускаем оба имени файла и создаём/обновляем соответствующий
    const possible = ["chatList.json", "chatlist.json"];
    let filePath: string | null = null;
    let content: string | null = null;

    for (const p of possible) {
        try {
            content = await fs.readFile(p, "utf-8");
            filePath = p;
            break;
        } catch {
            // пробуем следующий
        }
    }

    if (!filePath || content === null) {
        // создаём новый файл chatList.json
        const list = [chatId];
        try {
            await fs.writeFile("chatList.json", JSON.stringify(list, null, 2));
            return NextResponse.json({ success: true, list });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return NextResponse.json({ error: `Не удалось записать файл: ${msg}` }, { status: 500 });
        }
    }

    try {
        const list = JSON.parse(content) as Array<string | number>;
        if (!Array.isArray(list)) {
            return NextResponse.json({ error: "Файл chatlist не содержит массив" }, { status: 500 });
        }

        if (!list.includes(chatId)) {
            list.push(chatId);
            await fs.writeFile(filePath, JSON.stringify(list, null, 2));
        }

        return NextResponse.json({ success: true, list });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Ошибка обработки файла: ${msg}` }, { status: 500 });
    }
};
