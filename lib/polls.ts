import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Модели
/*
Пример структуры БД (PostgreSQL):

CREATE TABLE logical_polls (
    id UUID PRIMARY KEY,
    question TEXT NOT NULL,
    options TEXT[] NOT NULL,
    is_anonymous BOOLEAN DEFAULT true,
    allows_multiple_answers BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE poll_messages (
    id SERIAL PRIMARY KEY,
    logical_poll_id UUID REFERENCES logical_polls(id) ON DELETE CASCADE,
    telegram_poll_id TEXT NOT NULL,
    chat_id BIGINT NOT NULL,
    message_id INTEGER NOT NULL,
    UNIQUE(telegram_poll_id)
);

CREATE TABLE poll_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logical_poll_id UUID REFERENCES logical_polls(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    option_indices INTEGER[] NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(logical_poll_id, telegram_user_id)
);
*/
export type LogicalPoll = {
    id: string; // UUID
    question: string;
    options: string[];
    is_anonymous?: boolean;
    allows_multiple_answers?: boolean;
    created_at: string;
};

export type PollMessage = {
    logical_poll_id: string;
    telegram_poll_id: string;
    chat_id: number | string;
    message_id: number;
};

export type PollResponse = {
    id: string; // UUID
    logical_poll_id: string;
    telegram_user_id: number;
    option_indices: number[];
    responded_at: string;
    option_texts?: string[]; // Для inline кнопок
};

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

const getPollsPath = () => {
    return path.join("/var/task", "data", "polls.json");
};

const getLogicalPollsPath = () => {
    return path.join("/var/task", "data", "logical_polls.json");
};

const getPollMessagesPath = () => {
    return path.join("/var/task", "data", "poll_messages.json");
};

const getPollResponsesPath = () => {
    return path.join("/var/task", "data", "poll_responses.json");
};

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

// Новые функции для логических опросов
export async function loadLogicalPolls(): Promise<LogicalPoll[]> {
    const p = getLogicalPollsPath();
    try {
        const raw = await fs.readFile(p, "utf8");
        return JSON.parse(raw) || [];
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === "ENOENT") {
            return [];
        }
        throw err;
    }
}

export async function saveLogicalPolls(polls: LogicalPoll[]): Promise<void> {
    const p = getLogicalPollsPath();
    await fs.mkdir(path.dirname(p), { recursive: true }).catch(() => {});
    await fs.writeFile(p, JSON.stringify(polls, null, 2), "utf8");
}

export async function createLogicalPoll(question: string, options: string[], is_anonymous = true, allows_multiple_answers = false): Promise<LogicalPoll> {
    const poll: LogicalPoll = {
        id: randomUUID(),
        question,
        options,
        is_anonymous,
        allows_multiple_answers,
        created_at: new Date().toISOString(),
    };
    const polls = await loadLogicalPolls();
    polls.push(poll);
    await saveLogicalPolls(polls);
    return poll;
}

export async function loadPollMessages(): Promise<PollMessage[]> {
    const p = getPollMessagesPath();
    try {
        const raw = await fs.readFile(p, "utf8");
        return JSON.parse(raw) || [];
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === "ENOENT") {
            return [];
        }
        throw err;
    }
}

export async function savePollMessages(messages: PollMessage[]): Promise<void> {
    const p = getPollMessagesPath();
    await fs.mkdir(path.dirname(p), { recursive: true }).catch(() => {});
    await fs.writeFile(p, JSON.stringify(messages, null, 2), "utf8");
}

export async function addPollMessage(message: PollMessage): Promise<void> {
    const messages = await loadPollMessages();
    messages.push(message);
    await savePollMessages(messages);
}

export async function findLogicalPollIdByTelegramPollId(telegram_poll_id: string): Promise<string | null> {
    const messages = await loadPollMessages();
    const msg = messages.find(m => m.telegram_poll_id === telegram_poll_id);
    return msg ? msg.logical_poll_id : null;
}

export async function loadPollResponses(): Promise<PollResponse[]> {
    const p = getPollResponsesPath();
    try {
        const raw = await fs.readFile(p, "utf8");
        return JSON.parse(raw) || [];
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === "ENOENT") {
            return [];
        }
        throw err;
    }
}

export async function savePollResponses(responses: PollResponse[]): Promise<void> {
    const p = getPollResponsesPath();
    await fs.mkdir(path.dirname(p), { recursive: true }).catch(() => {});
    await fs.writeFile(p, JSON.stringify(responses, null, 2), "utf8");
}

export async function addPollResponse(response: Omit<PollResponse, 'id' | 'responded_at'>): Promise<void> {
    const responses = await loadPollResponses();
    // Check for duplicate
    const existing = responses.find(r => r.logical_poll_id === response.logical_poll_id && r.telegram_user_id === response.telegram_user_id);
    if (existing) {
        // Update existing
        existing.option_indices = response.option_indices;
        existing.responded_at = new Date().toISOString();
    } else {
        // Add new
        const newResponse: PollResponse = {
            ...response,
            id: randomUUID(),
            responded_at: new Date().toISOString(),
        };
        responses.push(newResponse);
    }
    await savePollResponses(responses);
}

export async function hasUserAnsweredPoll(logical_poll_id: string, telegram_user_id: number): Promise<boolean> {
    const responses = await loadPollResponses();
    return responses.some(r => r.logical_poll_id === logical_poll_id && r.telegram_user_id === telegram_user_id);
}

export async function getUserPollResponse(logical_poll_id: string, telegram_user_id: number): Promise<PollResponse | null> {
    const responses = await loadPollResponses();
    return responses.find(r => r.logical_poll_id === logical_poll_id && r.telegram_user_id === telegram_user_id) || null;
}
