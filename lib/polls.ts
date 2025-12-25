import { randomUUID } from "crypto";
import { sql } from "./db";

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
    option_texts TEXT[],
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

export type PollResults = {
    poll: LogicalPoll;
    totalResponses: number;
    optionCounts: { [optionIndex: number]: number };
    responses: PollResponse[];
};

// Database functions for logical polls
export async function createLogicalPoll(question: string, options: string[], is_anonymous = true, allows_multiple_answers = false): Promise<LogicalPoll> {
    const id = randomUUID();
    const created_at = new Date().toISOString();

    await sql`
        INSERT INTO logical_polls (id, question, options, is_anonymous, allows_multiple_answers, created_at)
        VALUES (${id}, ${question}, ARRAY[${options.map(o => `'${o.replace(/'/g, "''")}'`).join(',')}]::text[], ${is_anonymous}, ${allows_multiple_answers}, ${created_at})
    `;

    return {
        id,
        question,
        options,
        is_anonymous,
        allows_multiple_answers,
        created_at,
    };
}

export async function getLogicalPoll(id: string): Promise<LogicalPoll | null> {
    const result = await sql`
        SELECT * FROM logical_polls WHERE id = ${id}
    `;

    if (result.rows.length === 0) {
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = result.rows[0];
    return {
        id: row.id,
        question: row.question,
        options: row.options,
        is_anonymous: row.is_anonymous,
        allows_multiple_answers: row.allows_multiple_answers,
        created_at: row.created_at.toISOString(),
    };
}

export async function loadLogicalPolls(): Promise<LogicalPoll[]> {
    const result = await sql`
        SELECT * FROM logical_polls ORDER BY created_at DESC
    `;

    return result.rows.map((row: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: row.id,
        question: row.question,
        options: row.options,
        is_anonymous: row.is_anonymous,
        allows_multiple_answers: row.allows_multiple_answers,
        created_at: row.created_at.toISOString(),
    }));
}

// Poll messages functions
export async function addPollMessage(message: PollMessage): Promise<void> {
    await sql`
        INSERT INTO poll_messages (logical_poll_id, telegram_poll_id, chat_id, message_id)
        VALUES (${message.logical_poll_id}, ${message.telegram_poll_id}, ${message.chat_id}, ${message.message_id})
    `;
}

export async function findLogicalPollIdByTelegramPollId(telegram_poll_id: string): Promise<string | null> {
    const result = await sql`
        SELECT logical_poll_id FROM poll_messages WHERE telegram_poll_id = ${telegram_poll_id}
    `;

    return result.rows.length > 0 ? result.rows[0].logical_poll_id : null;
}

// Poll responses functions
export async function addPollResponse(response: Omit<PollResponse, 'id' | 'responded_at'>): Promise<void> {
    const responded_at = new Date().toISOString();

    const optionIndicesSql = `ARRAY[${response.option_indices.join(',')}]::integer[]`;
    const optionTextsSql = response.option_texts ? `ARRAY[${response.option_texts.map(o => `'${o.replace(/'/g, "''")}'`).join(',')}]::text[]` : 'NULL';

    await sql`
        INSERT INTO poll_responses (logical_poll_id, telegram_user_id, option_indices, option_texts, responded_at)
        VALUES (${response.logical_poll_id}, ${response.telegram_user_id}, ${(sql as any).unsafe(optionIndicesSql)}, ${(sql as any).unsafe(optionTextsSql)}, ${responded_at})
        ON CONFLICT (logical_poll_id, telegram_user_id)
        DO UPDATE SET
            option_indices = EXCLUDED.option_indices,
            option_texts = EXCLUDED.option_texts,
            responded_at = EXCLUDED.responded_at
    `;
}

export async function hasUserAnsweredPoll(logical_poll_id: string, telegram_user_id: number): Promise<boolean> {
    const result = await sql`
        SELECT COUNT(*) as count FROM poll_responses
        WHERE logical_poll_id = ${logical_poll_id} AND telegram_user_id = ${telegram_user_id}
    `;

    return result.rows[0].count > 0;
}

export async function getUserPollResponse(logical_poll_id: string, telegram_user_id: number): Promise<PollResponse | null> {
    const result = await sql`
        SELECT * FROM poll_responses
        WHERE logical_poll_id = ${logical_poll_id} AND telegram_user_id = ${telegram_user_id}
    `;

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    return {
        id: row.id,
        logical_poll_id: row.logical_poll_id,
        telegram_user_id: row.telegram_user_id,
        option_indices: row.option_indices,
        option_texts: row.option_texts,
        responded_at: row.responded_at.toISOString(),
    };
}

// Aggregation functions
export async function getPollResults(logical_poll_id: string): Promise<PollResults | null> {
    // Get poll details
    const poll = await getLogicalPoll(logical_poll_id);
    if (!poll) {
        return null;
    }

    // Get all responses
    const responsesResult = await sql`
        SELECT * FROM poll_responses
        WHERE logical_poll_id = ${logical_poll_id}
        ORDER BY responded_at DESC
    `;

    const responses: PollResponse[] = responsesResult.rows.map(row => ({
        id: row.id,
        logical_poll_id: row.logical_poll_id,
        telegram_user_id: row.telegram_user_id,
        option_indices: row.option_indices,
        option_texts: row.option_texts,
        responded_at: row.responded_at.toISOString(),
    }));

    // Calculate option counts
    const optionCounts: { [optionIndex: number]: number } = {};
    responses.forEach(response => {
        response.option_indices.forEach(index => {
            optionCounts[index] = (optionCounts[index] || 0) + 1;
        });
    });

    return {
        poll,
        totalResponses: responses.length,
        optionCounts,
        responses,
    };
}

// Legacy functions for backward compatibility (deprecated)
export async function loadPolls(): Promise<PollData> {
    // This function is deprecated and should not be used
    console.warn("loadPolls is deprecated. Use database functions instead.");
    return {};
}

export async function savePolls(data: PollData): Promise<void> {
    // This function is deprecated and should not be used
    console.warn("savePolls is deprecated. Use database functions instead.");
}

export async function addPollAnswer(answer: PollAnswer): Promise<void> {
    // This function is deprecated and should not be used
    console.warn("addPollAnswer is deprecated. Use addPollResponse instead.");
}
