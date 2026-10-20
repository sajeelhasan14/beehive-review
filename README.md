# Beehive Reviews

QR review funnels, a multi-tenant admin and per-client dashboards for EMRG Media.
Next.js 16 (App Router, Cache Components) on Railway Postgres. Mario's `beehive-multitenant-demo.html` is the spec.

## What's where

| URL | What |
|---|---|
| `/c/{funnel-slug}` | Public funnel (the QR code target). Happy → review link, unhappy → private feedback. |
| `/api/public/submit` | Funnel form posts here. Saves contact + rating; copies the row to the client's Google Sheet. |
| `/login` | Email + password for admins and client owners. |
| `/admin` | Master admin: client cards, add client (smart fill), tier/dashboard switches, publish, copy package, CSV, print kit, unhappy alerts, all contacts. |
| `/admin/kit/{client}/qr.png` · `table-tent.pdf` · `stickers.pdf` | Print kit, generated on request. |
| `/d/{client-slug}` | Client dashboard: money view, automations by tier, rating breakdown, birthday engine (hospitality) or recall list (dental), alerts, guest list. Tier 1 / dashboard off shows the upgrade wall. |
| `/d/{client-slug}/contacts.csv` | That client's contacts only. |
| `/api/health` | 200 when Postgres is reachable (Railway health check). |

Tenant isolation lives in `lib/auth/dal.ts`: every dashboard read goes through `requireClientAccess()`; a client login can only ever load its own `client_id`.

## Run locally

```bash
cp .env.example .env.local   # paste DATABASE_URL (Railway Postgres → DATABASE_PUBLIC_URL)
npm install
npm run db:migrate           # creates/updates tables
npm run db:seed              # Mario's 5 clients (safe to run twice)
npm run user:create -- --role admin --email you@emrgmedia.com --name "Your Name"
npm run dev
```

## Deploy (Railway)

`railway.json` runs `npm run db:migrate` before each deploy, starts with `npm start` and health checks `/api/health`.
Service variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, plus any of the optional keys in `.env.example`.

## Optional features

- **AI smart fill**: set `ANTHROPIC_API_KEY`. Without it the form uses the instant pattern fill.
- **Google Sheets**: set `GOOGLE_SERVICE_ACCOUNT_JSON` (+ `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SHEETS_SHARE_WITH`). A sheet is created when a client is added (or on the first submission for older clients); every submission is appended. Failures show as "sync error" with Retry on the client card and never block a customer.

- **Find on Google**: set `GOOGLE_MAPS_API_KEY` (Places API (New) enabled). Add client then searches Google by name and fills the review link (`https://search.google.com/local/writereview?placeid=…`). The key stays on the server.
- **Their website**: no key needed. Add client reads the client's site for name, logo, brand color, fonts and theme (`lib/brand/read-website.ts`).

## Not in Phase 1

Texting (Twilio), the cron worker (alerts, birthdays, win back), monthly report card emails and 5-minute health checks are Phase 2.
