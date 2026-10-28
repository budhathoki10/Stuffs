# Test report

Run on 2026-10-28 with `npm run test:all`. **118 tests, all passing.** Lint and typecheck are clean.

| Suite | What it checks | Result |
|---|---|---|
| Unit (`npm test`) | Pure logic: audit rules, SSRF guard, pitches, ranking, plans, payments, emails | ✅ 70 passed |
| Integration (`npm run test:integration`) | Real Postgres: lead delivery and limits, one-time tokens, payments, account deletion, data privacy | ✅ 27 passed |
| Browser (`npm run test:e2e`) | The built app in Chrome: every page and flow a visitor or freelancer uses | ✅ 21 passed |

## Not covered here (needs your real accounts)

The tests use fake versions of these outside services, because the test machine can't reach them:
- OpenStreetMap: fake businesses and fixture websites stand in.
- Claude: pitches use the built-in template.
- Google PageSpeed.
- Resend: emails are written to a file.
- Paddle checkout popup: the signed webhook itself is tested.
- Khalti: a fake Khalti server stands in.

They get checked live after deployment.

## Browser tests

**pitchcraft.spec.ts**
- ✅ visitor can audit a website and get a sample pitch without signing up
- ✅ rejects non-web URLs in the free audit
- ✅ freelancer signs up, gets leads, pitches, and tracks a win
- ✅ cron endpoint requires the secret
- ✅ a signed Paddle webhook upgrades the account to Pro
- ✅ Khalti callback with an unknown payment is rejected
- ✅ the emailed link confirms the address and works only once
- ✅ forgotten password can be reset by email
- ✅ legal pages are reachable from the footer
- ✅ a paying user can't delete the account until the subscription is canceled
- ✅ a free user can delete the account and all data

**security-and-billing.spec.ts**
- ✅ paying NPR with Khalti activates 30 days of Pro, exactly once
- ✅ a Khalti payment that Khalti doesn't know about never activates Pro
- ✅ freelancers can never open each other's leads
- ✅ free users get 10 pitches a week, then see an upgrade message
- ✅ changing settings updates the search
- ✅ login never redirects to another website
- ✅ signed-out visitors are sent to log in for every app page
- ✅ a report link that doesn't exist shows a friendly 404
- ✅ anonymous free checks › are limited to 5 per hour per visitor
- ✅ on a phone › no page is wider than the screen

## Integration tests

**integration/delivery.test.ts › deliverLeads**
- ✅ does nothing until the user has picked a search
- ✅ gives a free web developer 5 leads, businesses without a website first
- ✅ audits every lead that has a website and links the saved report
- ✅ stops at the free plan's weekly limit, even on a new day
- ✅ starts a new free batch the next week
- ✅ gives Pro users a fresh batch every day and never repeats a business
- ✅ treats an expired Pro plan as free
- ✅ ranks by the freelancer's skill: SEO people get businesses that have a site to optimize
- ✅ keeps each user's leads separate

**integration/billing-and-data.test.ts › Pro access**
- ✅ a Khalti payment gives 30 days, and a second one stacks
- ✅ extending an expired plan starts from today, not the old end date
- ✅ Paddle sets the end date and subscription id; a null end date keeps current access

**integration/billing-and-data.test.ts › payments**
- ✅ records each provider reference once, so webhook retries are harmless
- ✅ a pending Khalti payment can be completed only once, even with simultaneous callbacks

**integration/billing-and-data.test.ts › audits**
- ✅ saves a report under a short public id and counts anonymous checks per IP

**integration/billing-and-data.test.ts › lead data**
- ✅ totals the funnel and earnings, counting only won projects
- ✅ lists newest days first, then best opportunities
- ✅ never returns another user's lead or pitch

**integration/accounts.test.ts › one-time email tokens**
- ✅ are stored hashed and work exactly once
- ✅ can't be used for a different purpose
- ✅ expire
- ✅ reset links last 1 hour and confirmation links 3 days
- ✅ only one of two simultaneous uses succeeds
- ✅ are counted for rate limiting per user and purpose

**integration/accounts.test.ts › accounts**
- ✅ marks the email confirmed
- ✅ signs out every device
- ✅ deleting a user removes all of their data

## Unit tests

**billing.test.ts › verifyPaddleSignature**
- ✅ accepts a valid signature
- ✅ accepts any matching h1 during secret rotation
- ✅ rejects a tampered body, wrong secret, stale timestamp or missing header

**billing.test.ts › interpretPaddleEvent**
- ✅ maps an active subscription to a Pro end date
- ✅ does not shorten access when a subscription is canceled
- ✅ records completed transactions
- ✅ ignores events without our user id

**billing.test.ts › Khalti client**
- ✅ initiates a payment with the secret key against the sandbox
- ✅ surfaces API errors
- ✅ requires a secret key

**billing.test.ts › cancelPaddleSubscription**
- ✅ cancels immediately through the sandbox API
- ✅ treats an already-canceled subscription as done
- ✅ fails loudly on other errors or a missing key

**audit.test.ts › analyzePage**
- ✅ passes a well-built site
- ✅ finds the problems on an old site
- ✅ flags slow responses

**audit.test.ts › extractEmails**
- ✅ ignores image names and placeholder domains

**audit.test.ts › SSRF protection**
- ✅ isPrivateAddress(127.0.0.1) = true
- ✅ isPrivateAddress(10.1.2.3) = true
- ✅ isPrivateAddress(172.20.0.1) = true
- ✅ isPrivateAddress(192.168.1.1) = true
- ✅ isPrivateAddress(169.254.169.254) = true
- ✅ isPrivateAddress(100.64.0.1) = true
- ✅ isPrivateAddress(::1) = true
- ✅ isPrivateAddress(fd00::1) = true
- ✅ isPrivateAddress(::ffff:127.0.0.1) = true
- ✅ isPrivateAddress(8.8.8.8) = false
- ✅ isPrivateAddress(2606:4700::1111) = false
- ✅ normalizes bare domains to https
- ✅ blocks http://localhost:3000
- ✅ blocks http://10.0.0.5/
- ✅ blocks ftp://example.com
- ✅ blocks https://user:pw@example.com
- ✅ blocks http://example.com:8080
- ✅ blocks http://[::1]/
- ✅ blocks public-looking hostnames that resolve to private addresses at connect time

**audit.test.ts › safeFetch and runAudit against a local server**
- ✅ follows redirects
- ✅ scores an erroring site 0 instead of throwing
- ✅ audits a working site
- ✅ refuses private hosts when the override is off

**leads.test.ts › Overpass**
- ✅ builds a query for every tag of the niche
- ✅ clamps the radius
- ✅ parses nodes and ways into businesses

**leads.test.ts › opportunityScore**
- ✅ ranks businesses without a website highest for web developers
- ✅ rewards problems that match the freelancer's skill
- ✅ treats a broken site as a strong lead

**leads.test.ts › weekStart**
- ✅ returns the Monday of the week

**core.test.ts › plans**
- ✅ Pro is active only before its end date
- ✅ free users get weekly limits, Pro users get daily leads
- ✅ dates use UTC

**core.test.ts › util**
- ✅ shortId is URL-safe, unambiguous and unique
- ✅ hashIp never stores the raw IP
- ✅ clientIp takes the first forwarded address
- ✅ formats money and app links

**core.test.ts › audit edge cases**
- ✅ handles an empty page without crashing
- ✅ counts a booking link and a copyright range
- ✅ rejects a title that is too long for Google
- ✅ scores missing and broken websites 0 with one clear reason

**core.test.ts › pitches for every skill**
- ✅ web_dev: prompt and template mention the freelancer's offer
- ✅ seo: prompt and template mention the freelancer's offer
- ✅ speed: prompt and template mention the freelancer's offer
- ✅ booking: prompt and template mention the freelancer's offer
- ✅ validates skill ids

**core.test.ts › emails**
- ✅ verification and reset emails contain the link in text and HTML
- ✅ sends through Resend when a key is set
- ✅ reports Resend errors

**pitch.test.ts › templatePitch**
- ✅ builds on the top audit issue and signs with the freelancer's name
- ✅ pitches a website when the business has none

**pitch.test.ts › buildPitchPrompt**
- ✅ includes only facts from the audit

**pitch.test.ts › generatePitch**
- ✅ uses the template when no API key is configured
