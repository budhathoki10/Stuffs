# Pitchcraft

Pitchcraft finds local businesses whose websites are losing them customers, audits each site, and drafts a short email a freelancer can send the owner. The freelancer wins the work directly and keeps all of it. Pitchcraft charges a subscription: $19 a month, or NPR 999 for 30 days through Khalti.

The market research behind the idea is in [`research/consumer-earning-app-research.md`](research/consumer-earning-app-research.md).

## How it works

1. A freelancer picks a skill, a type of business and a city.
2. Every morning a cron job pulls matching businesses from OpenStreetMap and fetches each website. It runs 13 checks (HTTPS, mobile viewport, response time, title, description, contact links, booking, footer year and so on), plus Google PageSpeed when a key is set.
3. The businesses are ranked for that freelancer's skill. A web designer sees businesses with no website first. An SEO freelancer sees sites Google can barely read.
4. For each lead the freelancer can draft an email. Claude writes it from the audit findings; without an API key, a hand-written template per finding does the job. The email links to a public report the owner can open.
5. The freelancer sends it from Gmail or their own mail app and tracks the lead through a pipeline. A won project's value adds to the "earned" figure on the dashboard.

## Stack

Next.js 16 (App Router, server actions), TypeScript, Tailwind 4, Postgres with Drizzle, the Anthropic SDK, Vitest and Playwright.

The code is organised like this:

```
src/
  app/                pages, server actions (app/actions) and route handlers (app/api)
    app/              signed-in area: today, pipeline, settings, billing, leads/[id]
    r/[id]/           public audit report
  components/         UI
  db/                 Drizzle schema and client
  lib/
    audit/            SSRF-safe fetch, HTML checks, scoring, PageSpeed
    leads/            OpenStreetMap and mock providers, niches, ranking
    pitch/            Claude pitch writer and template fallback
    billing/          Paddle signature checks and cancellation, Khalti client
    services/         database-backed operations
    email.ts          Resend sender and templates
drizzle/              SQL migrations
tests/                unit tests; tests/integration runs against Postgres
e2e/                  Playwright tests, fixture websites, fake Khalti
```

## Running it locally

You need Node 20+ and Postgres.

```bash
npm install
cp .env.example .env   # set DATABASE_URL at minimum
npm run db:migrate
npm run dev
```

To work offline with fake businesses, set `LEADS_PROVIDER=mock` and `AUDIT_ALLOW_PRIVATE_HOSTS=1`, then run `node e2e/fixture-sites/server.mjs` in a second terminal. Without `RESEND_API_KEY`, emails are printed to the console, so you can follow reset and confirmation links from there.

## Configuration

Every variable is listed in [`.env.example`](.env.example). These matter most:

| Variable | Needed for |
|---|---|
| `DATABASE_URL`, `APP_URL`, `CRON_SECRET` | Always |
| `OSM_CONTACT_EMAIL` | OpenStreetMap's usage policy asks for a contact address |
| `ANTHROPIC_API_KEY`, `PITCH_MODEL` | AI-written emails. Defaults to `claude-opus-5-5`, about a cent per draft. `claude-haiku-5-5` costs far less. |
| `PAGESPEED_API_KEY` | Google's phone speed score. The keyless quota is tiny. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Password resets and email confirmation |
| `LEGAL_OPERATOR_NAME`, `SUPPORT_EMAIL`, `LEGAL_COUNTRY` | The Terms, Privacy and Refund pages |
| `NEXT_PUBLIC_PADDLE_*`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_API_KEY` | Card payments |
| `KHALTI_SECRET_KEY` | Payments in Nepal |

## Deploying

Vercel plus Neon or Supabase is the simplest setup.

1. Create the database and run `DATABASE_URL=... npm run db:migrate`.
2. Import the repo into Vercel and add the variables above. Use the Pro plan, because Hobby doesn't allow commercial use.
3. `vercel.json` schedules the daily lead job for 01:17 UTC, and Vercel sends `CRON_SECRET` with it automatically.

**Paddle.** Nepal isn't on Paddle's blocked list, but confirm with their support before you rely on it. Then:
1. Create a product with a $19 monthly and a $149 yearly price, and put the price IDs in `NEXT_PUBLIC_PADDLE_PRICE_MONTHLY` and `NEXT_PUBLIC_PADDLE_PRICE_YEARLY`.
2. Create a client-side token for `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
3. Create a server API key that can write subscriptions, for `PADDLE_API_KEY`.
4. Point a notification destination at `/api/webhooks/paddle` for `subscription.*` and `transaction.completed`, and put its secret in `PADDLE_WEBHOOK_SECRET`.

Paddle reviews `/terms`, `/privacy` and `/refund` during approval.

**Khalti.** Live payouts need a registered firm and a PAN. The sandbox at test-admin.khalti.com is enough to test. The return URL is `/api/billing/khalti/callback`, and each payment adds 30 days of Pro.

**Resend.** Verify your sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`.

## Security notes

- The audit fetcher only reaches public addresses. It checks every redirect, and it checks the resolved IP when it connects, so DNS rebinding can't reach internal services.
- Session tokens, reset links and confirmation links are stored as SHA-256 hashes. Links expire and work once.
- "Forgot password" answers the same way whether or not an account exists, and sends at most three emails an hour.
- Free audits and sample drafts are rate-limited per visitor. Only a hash of the IP is stored.
- Paddle webhooks are verified with HMAC and a five-minute timestamp window. Khalti payments are confirmed with Khalti's lookup API, and a payment can only be credited once.
- Deleting an account cancels any Paddle subscription first, then removes every row that belongs to the user.

## Tests

```bash
npm test                  # unit tests, no database needed
npm run test:integration  # services against a real Postgres (creates pitchcraft_integration)
npm run test:e2e          # builds the app and drives it in Chrome (uses pitchcraft_test)
npm run test:all          # all of the above, plus lint and typecheck
```

[`TESTING.md`](TESTING.md) lists every test from the last run. The integration and browser suites need no internet access. They use fake businesses, local fixture websites and a fake Khalti server. Override the databases with `INTEGRATION_DATABASE_URL` and `TEST_DATABASE_URL`.

## Known limitations

- OpenStreetMap coverage varies by city, and many listings have no email address. The lead page then suggests calling or using the business's contact form. Google Places would make a good second source.
- Email confirmation is a reminder, not a gate. If fake signups become a problem, require `emailVerifiedAt` before delivering leads.
- Lead delivery runs one user at a time to stay within OpenStreetMap's fair-use policy. With many users it should move to a queue, probably with a paid Overpass instance.
- The legal pages are a plain-language starting point. Have a lawyer read them before you grow.
