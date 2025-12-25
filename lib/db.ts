import { sql } from '@vercel/postgres';

export { sql };

// Initialize database tables
export async function initDatabase() {
  try {
    // Create logical_polls table
    await sql`
      CREATE TABLE IF NOT EXISTS logical_polls (
        id UUID PRIMARY KEY,
        question TEXT NOT NULL,
        options TEXT[] NOT NULL,
        is_anonymous BOOLEAN DEFAULT true,
        allows_multiple_answers BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Create poll_messages table
    await sql`
      CREATE TABLE IF NOT EXISTS poll_messages (
        id SERIAL PRIMARY KEY,
        logical_poll_id UUID REFERENCES logical_polls(id) ON DELETE CASCADE,
        telegram_poll_id TEXT NOT NULL,
        chat_id BIGINT NOT NULL,
        message_id INTEGER NOT NULL,
        UNIQUE(telegram_poll_id)
      );
    `;

    // Create poll_responses table
    await sql`
      CREATE TABLE IF NOT EXISTS poll_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        logical_poll_id UUID REFERENCES logical_polls(id) ON DELETE CASCADE,
        telegram_user_id BIGINT NOT NULL,
        option_indices INTEGER[] NOT NULL,
        option_texts TEXT[],
        responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(logical_poll_id, telegram_user_id)
      );
    `;

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}
