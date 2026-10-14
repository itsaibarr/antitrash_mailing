# Antitrash mailing bot

A Telegram mailing admin for the AntiTrash Astana channel. I built it as a one-off between late 2025 and early 2026 and no longer maintain it. It sends broadcasts, runs polls, and chains messages into sequences from a small Next.js admin page.

## What it does

People subscribe through the bot. The admin page composes a message, a poll, or a chain of messages, and the app fans it out to every subscriber. Anyone who blocks the bot gets deactivated on the next send. Poll answers land in Postgres.

## Run it yourself

You need Node 18+, a Postgres database, and a bot token from BotFather. Neon has a free tier that fits this app.

```
npm install
cp .env.example .env.local   # fill in your tokens
npm run dev
```

Create the tables, then point Telegram at your deployment:

```
curl -X POST localhost:3000/api/migrate
curl -X POST localhost:3000/api/webhook/setup
```

All variables live in `.env.example`. `ADMIN_SECRET` is optional. Set it and the send, migrate, and webhook-setup routes require it as a bearer token. Leave it unset and the routes stay open, which is how the original deployment ran. Do not run it that way on a public URL.

## Layout

| Path | What lives there |
| --- | --- |
| `app/page.tsx` | admin console: message, poll, and chain builders |
| `app/api/send/*` | broadcast, poll, and chain fan-out |
| `app/api/webhook/*` | Telegram updates and webhook setup |
| `app/api/polls/*` | poll reads and per-respondent results |
| `app/api/migrate` | creates tables, migrates the legacy JSON store |
| `lib/db.ts`, `lib/polls.ts` | Postgres access via `@vercel/postgres` |
| `lib/webhookLogic.ts` | subscribe, poll answers, forwards to the log group |
| `lib/adminAuth.ts` | opt-in bearer guard for the write routes |

## Status

Unmaintained one-off. The last Vercel deployment still serves poll reads. Sending needs the owner's bot token and database, so treat this as readable history, not a service.
