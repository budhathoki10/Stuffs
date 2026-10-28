# Pitchcraft

**Find clients without Upwork.** Every day Pitchcraft gives a freelancer 5 real local businesses that need their skill, checks each business's website for problems, and writes a personal pitch built from those problems. The freelancer sends it from their own inbox, wins the client directly and keeps 100% of the money. Pitchcraft earns from a subscription ($19/month, or NPR 999 with Khalti in Nepal).

The research behind the idea is in [`research/consumer-earning-app-research.md`](research/consumer-earning-app-research.md).

## Features

| Feature | Where |
|---|---|
| Free website check on the landing page (no sign-up), with a shareable report link | `src/app/page.tsx`, `src/app/r/[id]` |
| 13-point website audit: HTTPS, mobile, speed, title, description, contact, booking, outdated footer and more, plus an optional Google PageSpeed score | `src/lib/audit` |
| AI pitch writer (Claude), with a built-in template when no API key is set | `src/lib/pitch` |
| Lead finder using OpenStreetMap (free, worldwide), 16 business types, ranked for the freelancer's skill | `src/lib/leads` |
| Daily lead delivery (cron) and a "Find my leads now" button | `src/lib/services/delivery.ts`, `src/app/api/cron/daily-leads` |
| Pipeline (New → Pitch sent → Replied → Call → Won) and an "Earned with Pitchcraft" total | `src/app/app` |
| Free and Pro plans with weekly and daily limits | `src/lib/plans.ts` |
| Billing: Paddle (USD, worldwide) and Khalti (NPR, Nepal) | `src/lib/billing`, `src/app/api/webhooks/paddle`, `src/app/api/billing/khalti/callback` |
| Email and password accounts with server-side sessions | `src/lib/auth` |

**Security built in:**
- Audits are protected against SSRF: private and internal IPs are blocked, including through redirects and DNS rebinding.
- Anonymous audits and pitches are rate-limited per IP; only a hash of the IP is stored.
- Paddle webhooks are checked with HMAC signatures.
- Khalti payments are always confirmed with Khalti's lookup API before Pro is granted, and each payment can be credited only once.
- Session tokens are stored hashed.

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Postgres + Drizzle ORM · Anthropic SDK · Vitest · Playwright

## Run it locally

You need Node 20+ and a Postgres database (a local install, Docker, or a free Neon or Supabase project).

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL and the other values
npm run db:migrate
npm run dev                   # http://localhost:3000
```

To try the whole flow offline with fake businesses, set `LEADS_PROVIDER=mock` and `AUDIT_ALLOW_PRIVATE_HOSTS=1`, then run `node e2e/fixture-sites/server.mjs` in a second terminal.

## Environment variables

See [`.env.example`](.env.example) for all of them. The important ones:

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `APP_URL` | yes | Public URL, used in report links and payment return URLs |
| `CRON_SECRET` | yes | Protects `/api/cron/daily-leads` |
| `OSM_CONTACT_EMAIL` | yes | OpenStreetMap's usage policy requires a contact address |
| `ANTHROPIC_API_KEY` | recommended | Enables AI-written pitches. Without it, a decent template is used. |
| `PITCH_MODEL` | no | Defaults to `claude-opus-5-5` (about $0.01 per pitch). `claude-haiku-5-5` is about 40x cheaper. |
| `PAGESPEED_API_KEY` | recommended | Free Google key; the keyless quota is tiny |
| `NEXT_PUBLIC_PADDLE_*`, `PADDLE_WEBHOOK_SECRET` | for USD billing | See below |
| `KHALTI_SECRET_KEY` | for NPR billing | See below |

## Deploy (Vercel + Neon/Supabase)

1. Create a Postgres database. Run `DATABASE_URL=... npm run db:migrate` once.
2. Import the repo in Vercel and add the environment variables. Use **Vercel Pro**: the Hobby plan is non-commercial only.
3. `vercel.json` already schedules the daily lead job at 01:17 UTC. Vercel sends `CRON_SECRET` automatically.

### Paddle (USD, worldwide)

1. Create a Paddle account. Nepal is not on Paddle's blocked list, but confirm onboarding with their support before going live.
2. In the sandbox, create a "Pitchcraft Pro" product with two prices: $19/month and $149/year. Copy their price IDs into `NEXT_PUBLIC_PADDLE_PRICE_MONTHLY` and `NEXT_PUBLIC_PADDLE_PRICE_YEARLY`.
3. Create a client-side token and put it in `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
4. Add a notification destination pointing to `https://YOUR_DOMAIN/api/webhooks/paddle`, with events `subscription.*` and `transaction.completed`. Copy its secret into `PADDLE_WEBHOOK_SECRET`.
5. Set your domain as the default payment link. When everything works, switch `PADDLE_ENV=production` and replace the keys.

### Khalti (NPR, Nepal)

1. You need a registered firm and a PAN to receive live payouts. For testing, a sandbox merchant at <https://test-admin.khalti.com> is enough.
2. Put the secret key in `KHALTI_SECRET_KEY`. Keep `KHALTI_ENV=sandbox` until you go live.
3. The return URL is `https://YOUR_DOMAIN/api/billing/khalti/callback`. Each payment gives 30 days of Pro.

## Tests

```bash
npm run lint && npm run typecheck
npm test               # 48 unit tests: audit, SSRF guard, pitch, OpenStreetMap parsing, ranking, Paddle and Khalti
npm run test:e2e       # 6 browser tests: builds the app and runs the full flow against a test database
```

The end-to-end suite needs Postgres. By default it uses `postgres://pitchcraft:pitchcraft@localhost:5432/pitchcraft_test`; override it with `TEST_DATABASE_URL`. It uses fake businesses and local fixture websites, so it needs no internet access.

## Project structure

```
src/
  app/                  pages, server actions (app/actions), API routes (app/api)
    app/                signed-in area: today, pipeline, settings, billing, leads/[id]
    r/[id]/             public audit report
  components/           UI
  db/                   Drizzle schema and client
  lib/
    audit/              safe fetch, HTML analysis, scoring, PageSpeed
    leads/              OpenStreetMap + mock providers, niches, ranking
    pitch/              Claude pitch writer + template fallback
    billing/            Paddle signature checks, Khalti client
    services/           database-backed operations (audits, delivery, leads, billing)
drizzle/                SQL migrations
e2e/                    Playwright tests and fixture websites
tests/                  Vitest unit tests
research/               market research behind the product
```

## Known limits and next steps

- **Data:** OpenStreetMap coverage varies by city, and many businesses have no email listed. The lead page then suggests calling or using the business's contact form. Google Places could be added as a second provider.
- **Accounts:** password reset and email verification are not built yet. They need an email provider such as Resend.
- **Leads:** delivery runs one user at a time to respect OpenStreetMap's fair-use policy. With many users, move it to a queue and consider a paid Overpass instance.
- **Rate limits:** they are stored in Postgres, so they work across serverless instances.
