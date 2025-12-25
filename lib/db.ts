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

    // Create subscribers table for mailing list
    await sql`
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      );
    `;

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Subscriber management functions
export interface Subscriber {
  id: number;
  chat_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  subscribed_at: Date;
  is_active: boolean;
}

export async function addSubscriber(chatId: number, user?: { username?: string; first_name?: string; last_name?: string }): Promise<void> {
  try {
    await sql`
      INSERT INTO subscribers (chat_id, username, first_name, last_name)
      VALUES (${chatId}, ${user?.username || null}, ${user?.first_name || null}, ${user?.last_name || null})
      ON CONFLICT (chat_id) DO NOTHING
    `;
    console.log(`✅ Subscriber added/updated: ${chatId}`);
  } catch (error) {
    console.error('❌ Failed to add subscriber:', error);
    throw error;
  }
}

export async function getActiveSubscribers(): Promise<Subscriber[]> {
  try {
    const result = await sql`
      SELECT * FROM subscribers
      WHERE is_active = true
      ORDER BY subscribed_at DESC
    `;
    return result.rows as Subscriber[];
  } catch (error) {
    console.error('❌ Failed to get subscribers:', error);
    throw error;
  }
}

export async function deactivateSubscriber(chatId: number): Promise<void> {
  try {
    await sql`
      UPDATE subscribers
      SET is_active = false
      WHERE chat_id = ${chatId}
    `;
    console.log(`✅ Subscriber deactivated: ${chatId}`);
  } catch (error) {
    console.error('❌ Failed to deactivate subscriber:', error);
    throw error;
  }
}

export async function isSubscriber(chatId: number): Promise<boolean> {
  try {
    const result = await sql`
      SELECT 1 FROM subscribers
      WHERE chat_id = ${chatId} AND is_active = true
      LIMIT 1
    `;
    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ Failed to check subscriber status:', error);
    throw error;
  }
}

// Migration function to import users from JSON file
export async function migrateFromJsonFile(): Promise<void> {
  try {
    // Import the old chatList functions temporarily for migration
    const fs = await import('fs/promises');
    const path = await import('path');

    const getProjectPathCandidates = () => [
      path.join(process.cwd(), "chatList.json"),
      path.join(process.cwd(), "chatlist.json"),
    ];

    // Try to load from existing JSON file
    let chatIds: Array<string | number> = [];
    const candidates = getProjectPathCandidates();
    for (const p of candidates) {
      try {
        const raw = await fs.readFile(p, "utf8");
        const parsed = JSON.parse(raw);
        chatIds = Array.isArray(parsed) ? parsed : [];
        console.log(`📁 Found ${chatIds.length} chat IDs in ${p}`);
        break;
      } catch (err) {
        continue;
      }
    }

    if (chatIds.length === 0) {
      console.log('ℹ️ No existing chat IDs found for migration');
      return;
    }

    let migrated = 0;
    for (const chatId of chatIds) {
      try {
        // Convert to number if it's a string
        const numericChatId = typeof chatId === 'string' ? parseInt(chatId) : chatId;
        if (!isNaN(numericChatId)) {
          await addSubscriber(numericChatId);
          migrated++;
        }
      } catch (error) {
        console.error(`❌ Failed to migrate chat ID ${chatId}:`, error);
      }
    }

    console.log(`✅ Migration completed: ${migrated} subscribers migrated`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
