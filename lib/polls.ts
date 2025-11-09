import fs from "fs/promises";
import path from "path";

export type PollAnswer = {
    poll_id: string;
    user?: {
        id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
    };
    option_ids: number[];
};

export type PollData = {
    [pollId: string]: PollAnswer[];
};

const getPollsPath = () => path.join("/tmp", "polls.json");

export async function loadPolls(): Promise<PollData> {
    const p = getPollsPath();
    try {
        const raw = await fs.readFile(p, "utf8");
        const parsed = JSON.parse(raw);
        return parsed || {};
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === "ENOENT") {
            return {};
        }
        throw err;
    }
}

export async function savePolls(data: PollData): Promise<void> {
    const p = getPollsPath();
    await fs.mkdir(path.dirname(p), { recursive: true }).catch(() => {});
    await fs.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

export async function addPollAnswer(answer: PollAnswer): Promise<void> {
    const data = await loadPolls();
    if (!data[answer.poll_id]) {
        data[answer.poll_id] = [];
    }
    // Check if user already answered, update if so
    const existingIndex = data[answer.poll_id].findIndex(a => a.user?.id === answer.user?.id);
    if (existingIndex >= 0) {
        data[answer.poll_id][existingIndex] = answer;
    } else {
        data[answer.poll_id].push(answer);
    }
    await savePolls(data);
}
