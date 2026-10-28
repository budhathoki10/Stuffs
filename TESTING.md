# Test report

Run on 2026-10-28 with `npm run test:all`. 200 tests, all passing. Lint and typecheck are clean.

| Suite | What it checks | Result |
|---|---|---|
| Unit (`npm test`) | Pure logic: audit rules, SSRF guard, pitches, ranking, plans, payments, emails, quote pricing, client website HTML, uptime and alert rules | 126 passed |
| Integration (`npm run test:integration`) | Real Postgres: lead delivery and limits, one-time tokens, payments, account deletion, data privacy, quotes, invoices, client sites, monitoring, follow-ups | 49 passed |
| Browser (`npm run test:e2e`) | The built app in Chrome: every page and flow a visitor, freelancer or their client uses | 25 passed |

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

**client-work.spec.ts**
- a freelancer quotes, builds the site, proves the result and gets paid, all in the app
- unpublished sites and unknown client links are not found
- emailing a lead sets a follow-up that shows on Today

**pitchcraft.spec.ts**
- visitor can audit a website and get a sample pitch without signing up
- rejects non-web URLs in the free audit
- freelancer signs up, gets leads, pitches, and tracks a win
- cron endpoint requires the secret
- cron-job.org route needs its own secret, answers at once, and runs the job
- a signed Paddle webhook upgrades the account to Pro
- Khalti callback with an unknown payment is rejected
- the emailed link confirms the address and works only once
- forgotten password can be reset by email
- legal pages are reachable from the footer
- a paying user can't delete the account until the subscription is canceled
- a free user can delete the account and all data

**security-and-billing.spec.ts**
- paying NPR with Khalti activates 30 days of Pro, exactly once
- a Khalti payment that Khalti doesn't know about never activates Pro
- freelancers can never open each other's leads
- free users get 10 pitches a week, then see an upgrade message
- changing settings updates the search
- login never redirects to another website
- signed-out visitors are sent to log in for every app page
- a report link that doesn't exist shows a friendly 404
- are limited to 5 per hour per visitor
- no page is wider than the screen

## Integration tests

**integration/accounts.test.ts › one-time email tokens**
- are stored hashed and work exactly once
- can't be used for a different purpose
- expire
- reset links last 1 hour and confirmation links 3 days
- only one of two simultaneous uses succeeds
- are counted for rate limiting per user and purpose

**integration/accounts.test.ts › accounts**
- marks the email confirmed
- signs out every device
- deleting a user removes all of their data

**integration/billing-and-data.test.ts › Pro access**
- a Khalti payment gives 30 days, and a second one stacks
- extending an expired plan starts from today, not the old end date
- Paddle sets the end date and subscription id; a null end date keeps current access

**integration/billing-and-data.test.ts › payments**
- records each provider reference once, so webhook retries are harmless
- a pending Khalti payment can be completed only once, even with simultaneous callbacks

**integration/billing-and-data.test.ts › audits**
- saves a report under a short public id and counts anonymous checks per IP

**integration/billing-and-data.test.ts › lead data**
- totals the funnel and earnings, counting only won projects
- lists newest days first, then best opportunities
- never returns another user's lead or pitch

**integration/client-work.test.ts › quotes**
- sending sets a reminder; accepting wins the lead with the quote's total and tells the freelancer
- counts only the first answer, even when two arrive at once
- can't be edited once answered, and can't be answered once expired
- only the owner can edit a quote

**integration/client-work.test.ts › invoices**
- numbers each freelancer's invoices in order, without gaps or repeats under load
- totals what's owed per currency and ignores paid and void invoices

**integration/client-work.test.ts › client websites**
- starts once per client with a unique address
- free accounts can have one live site
- stores booking requests, emails the business and the freelancer, and limits each visitor

**integration/client-work.test.ts › before and after**
- compares the finished site with the audit we pitched with
- works for a business that had no website

**integration/client-work.test.ts › monitoring**
- checks a real site and builds the client report
- emails the freelancer once when the site goes down, and again when it's back
- free accounts can monitor one site
- refuses addresses it shouldn't fetch

**integration/client-work.test.ts › follow-ups**
- lists leads still in play that are due, and emails one digest per freelancer

**integration/client-work.test.ts › clients**
- shows each won client's site, care plan and what they owe

**integration/delivery.test.ts › deliverLeads**
- does nothing until the user has picked a search
- gives a free web developer 5 leads, businesses without a website first
- audits every lead that has a website and links the saved report
- stops at the free plan's weekly limit, even on a new day
- starts a new free batch the next week
- gives Pro users a fresh batch every day and never repeats a business
- treats an expired Pro plan as free
- ranks by the freelancer's skill: SEO people get businesses that have a site to optimize
- keeps each user's leads separate

**integration/google.test.ts › Google 30-day refresh**
- only refreshes Google leads older than 29 days
- clears cached Google content when the place no longer exists, keeping the user's notes
- counts failures without stopping the rest

**integration/google.test.ts › lead delivery from Google**
- buys only one page of results when it already has enough new businesses
- stores Google businesses, skips closed ones, and audits their real websites

## Unit tests

**audit.test.ts › analyzePage**
- passes a well-built site
- finds the problems on an old site
- flags slow responses

**audit.test.ts › extractEmails**
- ignores image names and placeholder domains

**audit.test.ts › SSRF protection**
- isPrivateAddress(127.0.0.1) = true
- isPrivateAddress(10.1.2.3) = true
- isPrivateAddress(172.20.0.1) = true
- isPrivateAddress(192.168.1.1) = true
- isPrivateAddress(169.254.169.254) = true
- isPrivateAddress(100.64.0.1) = true
- isPrivateAddress(::1) = true
- isPrivateAddress(fd00::1) = true
- isPrivateAddress(::ffff:127.0.0.1) = true
- isPrivateAddress(8.8.8.8) = false
- isPrivateAddress(2606:4700::1111) = false
- normalizes bare domains to https
- blocks http://localhost:3000
- blocks http://10.0.0.5/
- blocks ftp://example.com
- blocks https://user:pw@example.com
- blocks http://example.com:8080
- blocks http://[::1]/
- blocks public-looking hostnames that resolve to private addresses at connect time

**audit.test.ts › safeFetch and runAudit against a local server**
- follows redirects
- scores an erroring site 0 instead of throwing
- audits a working site
- refuses private hosts when the override is off

**billing.test.ts › verifyPaddleSignature**
- accepts a valid signature
- accepts any matching h1 during secret rotation
- rejects a tampered body, wrong secret, stale timestamp or missing header

**billing.test.ts › interpretPaddleEvent**
- maps an active subscription to a Pro end date
- does not shorten access when a subscription is canceled
- records completed transactions
- ignores events without our user id

**billing.test.ts › Khalti client**
- initiates a payment with the secret key against the sandbox
- surfaces API errors
- requires a secret key

**billing.test.ts › cancelPaddleSubscription**
- cancels immediately through the sandbox API
- treats an already-canceled subscription as done
- fails loudly on other errors or a missing key

**core.test.ts › plans**
- Pro is active only before its end date
- free users get weekly limits, Pro users get daily leads
- dates use UTC

**core.test.ts › util**
- shortId is URL-safe, unambiguous and unique
- hashIp never stores the raw IP
- clientIp takes the first forwarded address
- formats money and app links

**core.test.ts › audit edge cases**
- handles an empty page without crashing
- counts a booking link and a copyright range
- rejects a title that is too long for Google
- scores missing and broken websites 0 with one clear reason

**core.test.ts › pitches for every skill**
- web_dev: prompt and template mention the freelancer's offer
- seo: prompt and template mention the freelancer's offer
- speed: prompt and template mention the freelancer's offer
- booking: prompt and template mention the freelancer's offer
- validates skill ids

**core.test.ts › emails**
- verification and reset emails contain the link in text and HTML
- sends through Resend when a key is set
- reports Resend errors

**cron.test.ts › secretMatches**
- compares exactly, whatever the lengths
- refuses everything when no secret is configured

**cron.test.ts › cron-job.org authentication**
- accepts the secret as a Bearer header or a ?key= parameter
- keeps the Vercel secret and the cron-job.org secret separate

**google.test.ts › boundingBox**
- is centred on the search point and roughly radius-sized
- clamps the radius to 1 to 50 km

**google.test.ts › textSearchBody**
- restricts to the niche's Google type inside the box

**google.test.ts › googleProvider.findBusinesses**
- sends the key and a field mask, and maps places to businesses
- skips businesses that have closed
- pages only until it has enough businesses the user hasn't seen
- never asks for more than 3 pages
- explains Google's errors
- refuses to run without a key

**google.test.ts › googleProvider.geocode**
- turns a city into coordinates
- returns null for a place Google can't find

**google.test.ts › placeDetails**
- fetches one place by id
- returns null when the place no longer exists

**google.test.ts › leadProvider**
- uses Google when a key is set, OpenStreetMap otherwise, and honours LEADS_PROVIDER

**leads.test.ts › Overpass**
- builds a query for every tag of the niche
- clamps the radius
- parses nodes and ways into businesses

**leads.test.ts › opportunityScore**
- ranks businesses without a website highest for web developers
- rewards problems that match the freelancer's skill
- treats a broken site as a strong lead

**leads.test.ts › weekStart**
- returns the Monday of the week

**pitch.test.ts › templatePitch**
- builds on the top audit issue and signs with the freelancer's name
- pitches a website when the business has none

**pitch.test.ts › buildPitchPrompt**
- includes only facts from the audit

**pitch.test.ts › generatePitch**
- uses the template when no API key is configured

**work.test.ts › quotes from an audit**
- prices a new site and hosting when there's no website
- treats an unreachable 'website' check like no website
- turns each failed check into one line, grouping checks that are the same job
- doesn't charge twice for slow loading
- returns nothing for a site that passes
- converts other currencies to round numbers

**work.test.ts › amounts people type**
- 35,000
- undefined
- 1 200.50
- 12.5
- 0
- rejects ""
- rejects "abc"
- rejects "1.2.3"
- rejects "999999999999"
- round-trips through the input box
- formats money without needless decimals

**work.test.ts › currency from the client's address**
- Thamel, Kathmandu 44600, Nepal -> NPR
- Lakeside, Pokhara -> NPR
- Connaught Place, New Delhi, India -> INR
- 12 High St, London -> GBP
- Austin, TX -> USD
- null -> USD

**work.test.ts › dates**
- adds days across month ends in UTC
- formats strings and Dates the same way

**work.test.ts › client websites**
- picks a template from the category
- passes every check in our own audit
- escapes everything the freelancer types
- drops a portfolio link that isn't a plain web address
- has a booking form when hosted, and contact buttons when downloaded
- makes short, readable slugs

**work.test.ts › payment details**
- needs at least one real way to pay

**work.test.ts › uptime summary**
- is empty before the first check
- counts an outage only after two failures in a row
- reports an outage that's still going

**work.test.ts › monitor alerts**
- waits for a second failure, alerts once, then says when it's back
- warns once about a certificate that's about to expire
- stays quiet about a certificate with months left
