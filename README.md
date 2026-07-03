# OutreachFlow

OutreachFlow is a production-minded, single-owner outreach app for a small web-design agency. It helps one owner manage low-volume, personalized cold email without scraping, bulk sending, auto-send sequences, or unsupported claims.

## Features

- Dashboard with lead metrics, funnel breakdown, recent activity, interested-reply notifications, quick actions, and follow-up reminders.
- Safe local-business research with Google Places, public website observations, verified contact import, and demo candidates when Places is not configured.
- Searchable and filterable leads table with pagination and export-only bulk selection.
- Manual lead entry with client and server validation.
- CSV import workflow with preview, column mapping, duplicate handling, row errors, and a fictional template.
- Lead detail workspace for editable observations, notes, draft review, final send confirmation, reply history, classification override, and timeline.
- Template manager with safe variables, live preview, missing-variable badges, and mandatory opt-out protection.
- Settings for sender profile, daily send limit, follow-up delay, OpenAI key storage, Gmail OAuth status, and workspace owner state.
- Server-side OpenAI Responses API routes, Gmail OAuth/draft/send structure, Pub/Sub webhook, manual sync route, and scheduled follow-up checks.

## Tech Stack

- Next.js App Router, TypeScript, React Server Components, Server Actions, and Route Handlers
- Tailwind CSS with local shadcn-style UI primitives and Lucide icons
- Supabase PostgreSQL, Auth, RLS, SQL migrations, and typed database access
- Zod, React Hook Form, Vitest, and Playwright
- OpenAI Responses API, Gmail API, Google Cloud Pub/Sub, and Vercel Cron

## Architecture

Business rules live in `lib/business-rules.ts` and are reused by UI, API routes, cron checks, and tests. Validation schemas live in `lib/schemas.ts`. External services are isolated in `lib/ai`, `lib/gmail`, `lib/security`, and `lib/supabase`.

The app renders fictional demo data when Supabase env vars are absent. With Supabase configured for local use, server-side storage uses the service-role key and assigns rows to the first Supabase Auth user in the project.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

See `.env.example`. Never prefix secrets with `NEXT_PUBLIC_`. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-safe Supabase values; service role keys, encryption keys, OAuth secrets, refresh tokens, and OpenAI keys must stay server-side.

Generate `APP_ENCRYPTION_KEY_BASE64` with 32 random bytes:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_outreachflow.sql`.
3. Create the owner user in Supabase Auth.
4. Set `SEED_OWNER_ID` to the owner user's UUID if you want to seed fictional sample data.
5. Run `npm run seed` to load fictional sample data.

## Single-Owner Auth

The app has no public signup, teams, or roles. For local single-workspace use, create one Supabase Auth user and connect Gmail from Settings.

## OpenAI Setup

You can either set `OPENAI_API_KEY` server-side or enter a key in Settings. Stored keys are encrypted with `APP_ENCRYPTION_KEY_BASE64` and never returned to the browser. The AI routes use structured JSON output with the Responses API and validate drafts before saving. Official reference: [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses/create).

## Gmail Setup

Create a Google OAuth client and configure:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

The app requests Gmail compose/modify scopes, creates Gmail drafts by default, and sends only after final confirmation. Gmail drafts are MIME messages encoded as base64url, matching Google's draft guidance: [Gmail draft API](https://developers.google.com/workspace/gmail/api/guides/drafts).

## Local Research Setup

Set `GOOGLE_PLACES_API_KEY` to use Google Places Text Search for live local-business discovery. Without it, the Research page returns fictional demo candidates. Website observations are limited to public page signals and are saved as reviewable notes; emails must be verified before sending.

## Pub/Sub Reply Sync

Configure a Google Cloud Pub/Sub topic and grant Gmail publish access. Set `GOOGLE_PUBSUB_TOPIC`, then connect Gmail from Settings. The webhook route is `/api/gmail/webhook`, and manual fallback sync is `/api/gmail/sync`. Official reference: [Gmail push notifications](https://developers.google.com/workspace/gmail/api/guides/push).

## Running Tests

```bash
npm run typecheck
npm test
npm run test:e2e
```

Playwright runs against the demo data and does not require real OpenAI, Gmail, or Supabase credentials.

## Deploying To Vercel

1. Import the repository into Vercel.
2. Add all required env vars.
3. Deploy the Next.js app.
4. Configure Supabase Auth redirect URLs for your Vercel domain.
5. Run migrations and seed data against Supabase.

## Scheduled Follow-Ups

`vercel.json` schedules `/api/cron/follow-ups` daily. If `CRON_SECRET` is set, call the route with `Authorization: Bearer <CRON_SECRET>` from a scheduler that supports headers. The route creates at most one awaiting-review follow-up draft per eligible lead and never sends automatically.

## Security Notes

- Secrets are server-only and encrypted at rest when stored.
- RLS is enabled for every table.
- Email bodies, refresh tokens, API keys, and service-role keys should not be logged.
- AI and Gmail endpoints are rate limited.
- Website research is rate limited, shallow, and review-only.
- Stop statuses block drafts, sends, and follow-ups.

## Limitations And Non-Goals

OutreachFlow is intentionally not a campaign tool. It does not send bulk email, auto-send initial emails, auto-send follow-ups, manage teams, or support public signup.

## CSV Import Format

Recommended columns:

```csv
business_name,contact_name,email,website_url,industry,location,observed_website_issues,issue_details,notes
```

The importer validates emails and URLs, flags duplicate emails and website domains, and imports only confirmed valid rows.

## Sample Data

The seed includes fictional leads only:

- Maple Street Bakery
- BrightSmile Dental
- Northside Auto Repair
- Riverbend Fitness Studio
- Willow & Pine Florist
