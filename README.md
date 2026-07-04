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

Run every SQL migration in `supabase/migrations` in filename order. Migration `0002_scale_and_reply_sync.sql` adds the indexes and reply idempotency constraint used by the scheduled sync. Broad lead, draft, and reply reads are fetched in pages instead of stopping at Supabase's per-request row cap. CSV imports write up to 5,000 rows per request in 250-row batches.

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

Research accepts up to ten explicit city/state or state locations separated by semicolons and returns up to 60 deduplicated candidates per search. Google Text Search is paginated automatically. Use city/metro coverage for broader state searches because Google caps each individual text query at 60 results and does not provide an exhaustive nationwide export. “Add leads with email” inserts new public-email candidates in one batch and refreshes existing leads using their stored Google Place ID. Publicly detected email addresses still require owner verification before outreach. Run `0003_nationwide_research.sql` before using Place ID refreshes.

Do not treat Places results as a permanent scraped directory. Google permits Place IDs to be stored, while other Places content remains subject to Google Maps Platform storage, attribution, usage, and billing rules. The app stores Place IDs for deduplication and only saves complete candidate data when an owner explicitly imports it for lead review.

## Pub/Sub Reply Sync

Configure a Google Cloud Pub/Sub topic and grant Gmail publish access. Set `GOOGLE_PUBSUB_TOPIC`, then connect Gmail from Settings. The webhook route is `/api/gmail/webhook`, and manual fallback sync is `/api/gmail/sync`. Official reference: [Gmail push notifications](https://developers.google.com/workspace/gmail/api/guides/push).

The production fallback route `/api/cron/reply-sync` checks every connected workspace every five minutes and requires `Authorization: Bearer <CRON_SECRET>`. It searches recent inbox activity first and only fetches Gmail threads that match stored leads, rather than making one Gmail request per database row. `GMAIL_REPLY_LOOKBACK_DAYS` defaults to 30 and can be set from 1 to 365. `vercel.json` registers the schedule. Vercel requires Pro or Enterprise for intervals shorter than one day; on Hobby, use an external scheduler that can send the authorization header.

## Email Deliverability

There is no legitimate spam-filter bypass. The app now keeps the visible `From` address aligned with the Gmail mailbox connected through OAuth, rejects MIME header injection, and includes a reply-based `List-Unsubscribe` header. When Gmail is reconnected, Agency Settings adopts that mailbox address automatically.

Before production sending:

- For a custom sending domain, publish SPF, enable DKIM in Google Workspace, publish DMARC, and verify all three in a received message's original headers.
- Use Google Postmaster Tools to check domain reputation, authentication, delivery errors, and user-reported spam. Keep complaints below 0.1% and never let them reach 0.3%.
- Send only relevant, individually reviewed messages to verified recipients. Stop immediately on opt-out, do not use purchased lists, and increase volume gradually.
- Keep sender identity and subjects accurate. Include the business's valid physical postal address in the saved signature and confirm the message meets the laws that apply to the sender and recipient.
- The mailto unsubscribe header is useful at this app's low volume, but it is not RFC 8058 one-click unsubscribe. If the domain ever becomes a bulk sender, add an HTTPS one-click endpoint before increasing volume.

References: [Google Email sender guidelines](https://support.google.com/a/answer/81126), [Google sender FAQ](https://support.google.com/mail/answer/14229414), and the [FTC CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).

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

`vercel.json` schedules `/api/cron/follow-ups` daily and `/api/cron/reply-sync` every five minutes. Set `CRON_SECRET`; Vercel sends it as `Authorization: Bearer <CRON_SECRET>`. The follow-up route creates at most one awaiting-review follow-up draft per eligible lead and never sends automatically.

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
