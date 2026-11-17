# AI-HAS: AI-Powered Enterprise Helpdesk & Workflow Automation System

Capstone project, WPH Academy, 4th Year BSIT.

AI-HAS is a 24/7 IT support assistant for a fictional company, **Meridian Group**. Employees chat with it in plain language. It answers from the company's own IT manuals (with sources), fixes routine problems by itself after the employee confirms, and hands everything else to a human agent as a ticket with a written summary. Managers get a live dashboard of how support is doing.

---

## What's inside

### From the capstone brief
| Objective | Where it lives |
|---|---|
| Smart document search (RAG) that answers only from manuals | `src/lib/ai/rag.ts`, `src/lib/server/kb.ts`. Manuals are split by section, scored with BM25 + IT synonyms, and answered only above a 0.42 confidence threshold, with numbered citations |
| Automated background tasks (password reset, ticket logging) | `src/lib/server/automations.ts`. Seven workflows, each asks before running and is logged step by step; runs are forwarded to an n8n/Make webhook |
| Escalation to a human ticket | `src/lib/server/tickets.ts`. Priority, SLA and least-busy assignment, plus an AI hand-off note; forwarded to a Jira-style webhook |
| Employee chat window | `/chat`. Message bubbles, typing indicator with live status, quick-reply buttons, voice input |
| Manager KPI dashboard | `/dashboard`. Resolution rate, response time, escalations, CSAT, hours saved, SLA, trends |
| Safety shields | `src/lib/ai/guardrails.ts`. Redacts passwords, phone, card and ID numbers, and API keys; blocks prompt injection, abuse and acting on other people's accounts; redirects payroll/HR/banking; rate limits |
| Database: users, chat logs, knowledge base | `src/lib/server/schema.ts` (13 tables, PostgreSQL) |
| AI prompt design (accuracy, tone) | `src/lib/ai/openai.ts` → `SYSTEM_PROMPT` |

### Extra features added
- **"Under the hood" panel** in chat: safety check, detected intent, retrieval confidence vs threshold, and the exact manual sections used. Click any citation to open the manual with the section highlighted.
- **3D assistant**: a front-desk service bell on a piece of desk hardware. Ring it to ask for help (with a synthesized bell sound). Its LCD eyes follow the cursor, the LEDs show state (green idle, orange working, red when shields trip), the knobs spin while it thinks, and the front slot prints a ticket slip whenever something gets resolved.
- **IT agent workspace**: ticket queue (list + board), SLA countdowns, internal notes, AI-drafted replies grounded on manuals, assign-to-me.
- **Knowledge loop**: turn a solved ticket into a new manual in one click. The assistant can answer it immediately.
- **Knowledge gaps**: questions the manuals couldn't answer are counted and listed, with a "Write manual" shortcut.
- **Retrieval playground**: type any question and see ranked sections, BM25 scores, stemmed terms, intent and confidence. Useful for the defense.
- **Manual uploads**: PDF, Markdown or text, indexed instantly; edit and re-index in place.
- **System status + incidents**: IT posts an incident and the assistant warns employees who ask about that service.
- **Security page**: event log plus a shield sandbox to test any message.
- **Automation controls**: pause or enable each workflow; full run log with every step.
- **Answer feedback** (thumbs up/down) feeding the CSAT metric.
- **CSV export** of the report (formula-injection safe).
- **Design**: desk-hardware look (aluminium, carbon black, signal orange; Archivo wide + JetBrains Mono). Command palette (Ctrl + K), dark mode, synthesized key-click and bell sounds (toggle), reduced-motion support, mobile layouts.
- **Accounts**: sign in, self sign-up for employees, one-click demo seats for each role.

---

## Demo accounts

The sign-in page has one-click buttons for each role. With email instead:

| Role | Email | Lands on |
|---|---|---|
| Employee | `maria.santos@meridian.example` | Assistant |
| IT agent | `paolo.reyes@meridian.example` | Ticket queue |
| IT manager | `grace.lim@meridian.example` | Dashboard |

The shared demo password is the `DEMO_PASSWORD` constant in `src/lib/server/seed.ts`. Set `DEMO_LOGIN=off` to hide the one-click buttons.

The database is seeded with 12 manuals and 60 days of realistic history (about 1,000 conversations, tickets, automation runs and security events) so the dashboard has something to show.

---

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No database or API key is needed. An embedded PostgreSQL (PGlite) starts in memory and seeds itself on the first request (takes a few seconds).

```bash
npm test          # unit tests: RAG retrieval, guardrails, intent detection
npm run typecheck
npm run build
```

### Environment variables
Copy `.env.example` to `.env.local`. All are optional locally.

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Signs session cookies. Optional when `DATABASE_URL` is set (a key is derived from it); set your own to control it (`openssl rand -base64 32`). |
| `DATABASE_URL` | PostgreSQL connection string. Without it, data lives in memory and resets on restart. |
| `OPENAI_API_KEY` | Turns on GPT-4o-mini answers, grounded on the retrieved sections. Without it, the built-in extractive engine quotes the sections directly. |
| `OPENAI_MODEL` | Defaults to `gpt-4o-mini`. |
| `AUTOMATION_WEBHOOK_URL` | n8n / Make webhook that receives every automation run as JSON. |
| `TICKET_WEBHOOK_URL` | Jira / ticketing webhook that receives every escalated ticket as JSON. |
| `DEMO_LOGIN` | `off` hides the one-click demo seats. |

---

## Deploy (Vercel + Neon Postgres)

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project**, import the repo. Framework is detected as Next.js; no build settings to change.
3. In the project, open **Storage → Create Database → Neon (Postgres)** and connect it. Vercel adds `DATABASE_URL` for you. The schema and seed data are created automatically on the first request.
4. Optional: add `AUTH_SECRET` and `OPENAI_API_KEY` under **Settings → Environment Variables**.
5. Redeploy.

> Without `DATABASE_URL` the app still runs on Vercel, but each serverless instance keeps its own in-memory database, so chats and tickets can disappear between requests. Use Postgres for anything you show to others.

---

## How a message flows

```
Employee types
   │
   ▼
Safety shields ── injection / abuse ──► polite refusal + security log
   │  (PII redacted before anything is stored)
   ▼
Intent analysis ── payroll / HR ──► redirect to HR
   │            ── security incident / hardware / "talk to a person" ──► ticket (P1–P3, SLA, assignee, AI summary)
   │            ── routine (password, unlock, MFA, VPN, software, printer, mailbox) ──► offer automation ─► confirm ─► run + log + webhook
   ▼
Active incident check (status page) ──► banner in the reply
   ▼
Retrieval over manual sections (BM25 + synonyms)
   ├─ confidence ≥ 0.42 ──► answer with citations (GPT-4o-mini or extractive)
   └─ below ──► "I'd rather not guess" + knowledge gap logged + offer ticket
```

## Tech stack

| Layer | Brief suggested | Used | Why |
|---|---|---|---|
| Frontend | Next.js / React | Next.js 16 (App Router), React 19, Tailwind CSS 4, Framer Motion, React Three Fiber | One deployable app; 3D bell assistant and motion for the UI |
| Backend | FastAPI or Node.js | Next.js route handlers (Node.js) | Same codebase and deploy as the UI |
| Database | Pinecone / ChromaDB / SQL | PostgreSQL (Neon in production, PGlite locally) | Users, chats, tickets and the manual index in one place |
| Retrieval | Vector DB | BM25 sparse retrieval with synonym expansion | Runs with no external service, is explainable in the playground, and takes milliseconds over the 43 seeded sections |
| LLM | OpenAI GPT-4o-mini | GPT-4o-mini (optional) + extractive fallback | Works without a key; never makes things up either way |
| Automation | n8n / Make / Webhooks | Built-in workflows + outgoing webhooks | Simulated connectors locally; real execution through n8n |

## Project structure

```
src/
  app/                 pages and API routes
    (app)/             signed-in screens: chat, tickets, knowledge, automations, security, status, dashboard
    api/               JSON endpoints (auth, chat stream, tickets, kb, metrics, ...)
  components/          UI: chat, dashboard charts, tickets, knowledge, 3D terminal, landing
  lib/
    ai/                rag.ts, guardrails.ts, intents.ts, openai.ts (pure, unit-tested)
    server/            db, schema, seed, auth, engine (the chat brain), automations, tickets, kb
tests/                 node:test unit tests
```

## Security notes
- Passwords hashed with bcrypt; sessions are signed, HTTP-only cookies.
- Every API route checks the session and role; employees only see their own chats and tickets.
- PII is redacted before saving and before any text reaches the model.
- Automations act only on the signed-in user, after explicit confirmation, with an audit trail.
- Rate limits on chat, sign-in and sign-up. Security headers set in `next.config.ts`.

## Suggested defense demo (5 minutes)
1. Landing page: click the bell. Point at the LCD cycling through answer, fix and hand-off, and the ticket slip printing out.
2. Sign in as **Employee**. Ask "VPN keeps disconnecting". Show the incident banner, citations, and the Under the hood panel. Click a citation.
3. Ask "I forgot my password", then **Run it**. Watch the steps.
4. Type "my password is Hunter2 and my number is 0917 123 4567". Show the redaction.
5. Ask "how do I set up the SAP Concur plugin", then **Open a ticket**.
6. Sign in as **IT agent**. Open the new ticket, read the hand-off note, **Draft with AI**, send. **Publish as manual**.
7. Sign in as **Manager**. Walk the dashboard, then the Security sandbox with "Ignore all previous instructions".
