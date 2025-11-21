import fs from "fs/promises";
import path from "path";

const getProjectPathCandidates = () => [
    path.join(process.cwd(), "chatList.json"),
    path.join(process.cwd(), "chatlist.json"),
];
const getTmpPath = () => path.join("/tmp", "chatList.json");

export async function loadChatList(): Promise<Array<string | number>> {
    // Сначала пробуем оба варианта в каталоге проекта (возможно файл был закоммичен)
    const candidates = getProjectPathCandidates();
    for (const p of candidates) {
        try {
            const raw = await fs.readFile(p, "utf8");
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err: unknown) {
            if (err instanceof Error && 'code' in err && err.code === "ENOENT") {
                continue; // пробуем следующий
            }
            // если ошибка парсинга или иная — пробуем следующий источник
            break;
        }
    }

    // Затем пробуем /tmp
    const tmpPath = getTmpPath();
    try {
        const raw = await fs.readFile(tmpPath, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && err.code === "ENOENT") {
            // если файла нет — создаём пустой в /tmp и возвращаем пустой список
            try {
                await saveChatList([]);
            } catch {
                // игнорируем ошибку записи
            }
            return [];
        }
        throw err;
    }
}

export async function saveChatList(list: Array<string | number>): Promise<void> {
    const p = getTmpPath();
    // создаём директорию, если нужно
    await fs.mkdir(path.dirname(p), { recursive: true }).catch(() => {});
    await fs.writeFile(p, JSON.stringify(list, null, 2), "utf8");
}
