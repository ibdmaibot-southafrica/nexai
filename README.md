# NexAI - Autonomous AI Company OS (Vercel Edition)

Self-running AI company hosted on Vercel. Five autonomous agents manage
products, marketing, finances, and operations 24/7 via Vercel Cron Jobs.

## Architecture

```
Vercel Frontend (Next.js)
    │
    ├── /api/status  → Company overview + agent logs
    ├── /api/logs    → Live agent activity
    │
    └── Cron Jobs (Vercel Scheduled Functions)
        ├── /api/cron/marketing  → every 5 min
        ├── /api/cron/analytics  → every 10 min
        ├── /api/cron/finance    → every 15 min
        ├── /api/cron/ceo        → every 20 min
        └── /api/cron/tech       → every 30 min
```

## Deploy to Vercel (1-Click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo/nexai)

Or manually:

```bash
cd vercel-app
npx vercel
```

## Setup

### 1. Get a Free AI API Key

Go to [openrouter.ai/keys](https://openrouter.ai/keys) and get a free API key.
Free tier includes Llama 3.1 8B and many other models.

### 2. Set Environment Variable

In your Vercel dashboard → Project Settings → Environment Variables:

```
OPENROUTER_API_KEY = your_key_here
```

### 3. Deploy

```bash
npx vercel --prod
```

Vercel will automatically:
- Build the Next.js dashboard
- Deploy serverless API routes
- Set up cron jobs from `vercel.json`

## Agent Schedule

| Agent | Route | Frequency |
|-------|-------|-----------|
| Marketing | `/api/cron/marketing` | Every 5 min |
| Analytics | `/api/cron/analytics` | Every 10 min |
| Finance | `/api/cron/finance` | Every 15 min |
| CEO | `/api/cron/ceo` | Every 20 min |
| Tech | `/api/cron/tech` | Every 30 min |

## Local Development

```bash
cd vercel-app
npm install
npm run dev
# Open http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes* | Free API key from openrouter.ai |
| `VERCEL_URL` | Auto | Set by Vercel automatically |

*If not set, falls back to local Ollama (requires Ollama running locally)

## Tech Stack

- **Frontend:** Next.js 14 + React 18
- **AI:** OpenRouter (free tier) / Ollama (local fallback)
- **Hosting:** Vercel (free tier)
- **Scheduling:** Vercel Cron Jobs
- **Runtime:** Node.js serverless functions
- **State:** File-based (swap to database for production)
