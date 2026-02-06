# Antitrash Mailing Bot

A Next.js application for managing Telegram mailing lists, creating polls, and sending logical chains of messages.

## Features

- **Mass Mailing**: Send text, images, videos, and files to all subscribers.
- **Polls**: Create logical polls with anonymous options and multiple answers.
- **Chains**: Send sequences of messages with logic.
- **Automatic Cleanup**: Automatically deactivates users who block the bot or delete their account.

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (e.g., Vercel Postgres, Neon)
- Telegram Bot Token

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/antitrash-mailing.git
   cd antitrash-mailing
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` (or create `.env`) and add your secrets:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   DATABASE_URL=your_postgres_url
   LOG_BOT_TOKEN=optional_logging_bot_token
   LOG_CHAT_ID=optional_logging_chat_id
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

### Deployment

This project is optimized for deployment on [Vercel](https://vercel.com).

1. Push your code to GitHub.
2. Import the project in Vercel.
3. Add the Environment Variables in the Vercel dashboard.
4. Deploy!

## Project Structure

- `app/api/`: API routes for sending messages and handling webhooks.
- `lib/`: Shared utilities (`db.ts`, `telegramHelpers.ts`, `webhookLogic.ts`, `polls.ts`).
- `lib/telegramHelpers.ts`: Centralized logic for safe message sending and error handling.

