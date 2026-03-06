# Better Articles

Analyze your website, plan content with AI-suggested titles and keywords, and write SEO-optimized articles with infographics and internal links. Publish to WordPress, Ghost, Medium, Wix, Odoo, or any platform via webhooks.

## Features

- **Projects** - Create projects with homepage URL
- **Crawl** - Auto-crawl (sitemap or homepage links) or add URLs manually
- **Crawl job streaming** - Real-time progress via Server-Sent Events (SSE)
- **Content calendar** - AI-suggested article titles, keywords, and publishing schedule with calendar view
- **Article writing** - Research, outline, and full article generation with infographics and internal links
- **Multi-language** - Write articles in 14+ languages (English, Spanish, French, German, etc.)
- **Universal LLM** - Supports OpenAI, Anthropic, OpenRouter, Google AI, LiteLLM, Together, Groq (configure in Settings)
- **LLM model fetching** - Fetch available models from each provider; custom model input per provider
- **Universal publishing** - WordPress, Ghost, Medium, Webhook (Odoo, Wix, custom)
- **Email notifications** - Nodemailer + Gmail for crawl complete, calendar generated, article published
- **In-app cron worker** - Background crawl job processing (polls every 60 seconds, no Vercel required)

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`
3. Run `npm run dev`
4. Open Settings and configure your LLM provider (API key, model) via the UI

## Configuration (UI)

All configuration is done in the app UI, not in `.env`:

### LLM Provider (Settings)

Configure your AI model provider in **Settings > LLM Provider**:

| Provider | Description | API Key |
|----------|-------------|---------|
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4-turbo | [OpenAI API](https://platform.openai.com/api-keys) |
| **Anthropic** | Claude 3.5 Sonnet, Opus, Haiku | [Anthropic Console](https://console.anthropic.com/) |
| **OpenRouter** | Access 100+ models (OpenAI, Anthropic, Google, Meta, etc.) | [OpenRouter](https://openrouter.ai/keys) |
| **Google AI** | Gemini 1.5 Pro, Flash | [Google AI Studio](https://aistudio.google.com/) |
| **LiteLLM** | Self-hosted proxy for any provider | Your LiteLLM proxy URL + API key |
| **Together AI** | Llama, Mixtral | [Together AI](https://api.together.xyz/) |
| **Groq** | Fast Llama inference | [Groq](https://console.groq.com/) |

- **Fetch models** - Click "Fetch models" to load available models from the provider's API
- **Custom model** - Enter a custom model name in the input field to use models not in the dropdown

For **LiteLLM**, set the Base URL (e.g. `https://your-litellm-proxy.com/v1`).

### Article Language (Write page)

When writing an article, choose the output language from the dropdown. Supported languages: English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Russian, Japanese, Chinese, Korean, Arabic, Hindi.

### Publishing (Project page)

Configure publishing per project in **Project > Publishing**:

| Platform | Fields | Notes |
|----------|--------|-------|
| **WordPress** | siteUrl, username, appPassword | Use Application Password from Users > Profile |
| **Ghost** | adminUrl, apiKey | Admin API URL + Content API key |
| **Medium** | integrationToken, userId | Integration token + User ID |
| **Webhook** | webhookUrl | POSTs `{ title, content, excerpt?, tags? }` to your URL |

**Webhook** works with Odoo, Wix, custom CMS, or any system that accepts HTTP POST. Configure your endpoint to receive the payload.

### Notifications (Settings)

Configure email notifications in **Settings > Notifications**:

- **Notification email** - Where to send alerts
- **Gmail** - Use Gmail with App Password (recommended)
- **Custom SMTP** - Host, port, user, pass for other providers
- **Events** - Crawl complete, Calendar generated, Article published

For Gmail: enable 2FA, create an App Password in Google Account settings, use that as the password.

## Database

Uses SQLite (better-sqlite3). Data is stored in `./data/app.db` by default. Set `DATABASE_PATH` in `.env.local` to customize.

**Tables**:
- `crawl_result_pages` - Per-page crawl data: url, title, meta_description, content_preview (first 2000 chars), status_code
- `crawl_job_logs` - Crawl process logs (info, warn, error)

**Note**: SQLite requires a writable filesystem. For Vercel deployment, consider Railway, Render, or a platform that supports persistent storage. Alternatively, migrate to Turso or Postgres.

## Cron / Background Jobs

The app includes an **in-app cron worker** that runs when the app starts (via `instrumentation.ts`):

- Polls every **60 seconds** for pending crawl jobs
- Processes jobs using the same logic as `/api/cron/process-jobs`
- No external cron or Vercel required
- DB is persistent; jobs continue after app restart

**Manual trigger** (optional): `GET /api/cron/process-jobs?key=YOUR_CRON_SECRET`

## Crawl Flow

1. **Start crawl** - Creates a job and redirects to the job stream view
2. **Stream view** - Connects to `GET /api/projects/[id]/crawl/[jobId]/stream` for real-time progress via SSE
3. **Job history** - View logs and crawled pages (URL, title, meta description, content preview, status code) for any job

## Content Calendar & Articles

- **One article per crawl URL** - Each calendar suggestion is based on one URL from the crawl. Scheduling is driven by crawled URLs.
- **Target URL** - Every suggestion has a `targetUrl` (the crawl URL it expands/complements). AI uses this for internal linking.
- **Mark as done** - When article content is generated, the calendar item is marked "completed".
- **Mark as published** - When you publish to WordPress/Ghost/etc., the article is marked "published" and the live URL is stored.
- **Published articles context** - When generating new articles, the AI receives the list of already-published blog URLs so it can add internal links and backlinks.
- **Calendar view** - Uses react-big-calendar for month/week/agenda views.
- **Simulate AI** - Generates mock calendar items without calling the LLM (no API key needed).
- **Generate with AI** - Uses configured LLM for real suggestions.

## UI Layout

- **Full-width** - Max width 7xl (1280px) for main content
- **Responsive sidebar** - Project navigation (Overview, Crawl, Calendar) on desktop
- **Top nav** - Mobile-friendly hamburger menu for project navigation

## Flow

1. Create a project (name, homepage URL)
2. Go to Crawl - run auto crawl or add manual URLs
3. Go to Content calendar - generate AI suggestions or simulate
4. Click "Write article" on any suggestion - generate research, outline, content
5. Choose language and generate
6. Publish to your site (configure in Project > Publishing first)

## API Keys (optional)

For cron auth and fallback defaults, you can set in `.env.local`:

- `CRON_SECRET` - Required for `/api/cron/process-jobs`
- `DATABASE_PATH` - Custom SQLite path (default: `./data/app.db`)

LLM API keys are configured in the UI only.
