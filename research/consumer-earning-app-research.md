# Consumer "earn money" app for a solo developer in Nepal

*Research date: 28 October 2026. Some sites were blocked during research (Reddit, sacra.com, several Nepali news sites), so a few figures come from search-engine snippets or secondary sources. Items marked [verify] need checking before you depend on them.*

## Question

What consumer (non-business) app can a solo developer in Nepal build, where ordinary people (freelancers, creators, students, side-hustlers) **earn money through the app**, so they are happy to pay the developer?

## Answer

**Pitchcraft:** a client finder for freelancers who want to leave Upwork and Fiverr. Each day it gives a freelancer five real businesses that need their skill, an automatic audit of each business's website, and a personalised pitch to send. Users earn by winning clients directly with no platform fee. You earn from a $19/month subscription (NPR 999 in Nepal). Users' money never passes through you.

---

## 1. Constraints for a Nepal-based founder

| Constraint | Finding | Consequence |
|---|---|---|
| Holding or paying out user money | Stripe Connect cross-border payouts only work for platforms based in the US, UK, EEA, Canada or Switzerland ([Stripe](https://docs.stripe.com/connect/cross-border-payouts)). A Nepal Rastra Bank payment licence needs at least NPR 5 crore of paid-up capital ([ShareSansar](https://www.sharesansar.com/newsdetail/nrb-increases-the-paid-up-capital-criteria-for-companies-conducting-payments-and-remittances-services-here-are-the-list-of-major-highlights-2023-01-06)). | **No marketplace, wallet, cash-out or "earn per task" features.** |
| Crypto and stablecoins | Banned by NRB since 2021, including for Nepali citizens living abroad ([b360](https://b360nepal.com/cryptocurrency-networking-businesses-illegal-nrb/)). | No crypto rewards or USDC payouts. |
| "Earn money" apps | NRB warns against easy-profit apps (Oct 2025, Jan 2026), and the telecom regulator (NTA) orders ISPs to block Ponzi platforms ([eKantipur](https://ekantipur.com/madhesh-pradesh/2026/01/23/en/nepal-rastra-bank-concerned-over-increase-in-digital-scams-53-24.html), [Techlekh](https://techlekh.com/nta-isp-block-crypto-trading-gambling-platforms-nepal)). | Position the product as a productivity tool, not an "earn money" app. |
| PayPal and Stripe | PayPal can send but not receive in Nepal. Stripe merchant accounts aren't available ([NepaliTelecom](https://nepalitelecom.com/paypal-in-nepal), [doola](https://www.doola.com/stripe-guide/how-to-open-a-stripe-account-in-nepal/)). | Bill through a Merchant of Record. |
| Collecting USD | Nepal is not on Paddle's unsupported-country list, and Paddle pays out via Payoneer or SWIFT ([Paddle](https://www.paddle.com/help/start/account-verification/which-countries-are-supported-by-paddle)) [verify onboarding]. Dodo Payments is the backup. | **Use Paddle Billing.** |
| Collecting NPR | Khalti and eSewa merchant accounts need firm registration, a PAN and tax clearance ([Khalti](https://khalti.com/info/terms/merchant/)). | Register a sole proprietorship and PAN, then use Khalti ePayment. |
| App stores | Google Play: Nepal can register as a developer but not as a merchant ([Google](https://support.google.com/googleplay/android-developer/answer/9306917)). | **Build web-first.** |
| Tax | Individual IT-export income: 5% final tax; FY25/26 adds a 75% exemption for IT exporters ([Kathmandu Post](https://kathmandupost.com/money/2025/05/30/budget-2025-26-introduces-sweeping-tax-incentives-for-tech-exports-startups-and-green-hydrogen-firms-while-raising-duties-on-alcohol-tobacco-and-luxury-goods)). | Positive for you. The threshold is unclear [verify with the Inland Revenue Department]. |

## 2. Market landscape (2024–2026)

- **Freelance marketplaces are shrinking while their fees rise.**
  - Upwork Q2-2026: gross services volume (GSV) $966M, down 4%. Active clients 763K, down 4%. Guidance cut, 25% of staff laid off ([Upwork IR](https://investors.upwork.com/news-releases/news-release-details/upwork-reports-second-quarter-2026-financial-results)).
  - Fiverr Q2-2026: active buyers 2.7M, down 21.9%. Take rate 28% ([StockTitan](https://www.stocktitan.net/news/FVRR/fiverr-announces-second-quarter-2026-o0quisjjfetp.html)).
- **AI is removing low-end gigs.** Job posts for writing and coding work fell 21% within 8 months of ChatGPT's release ([Management Science 2025](https://spiral.imperial.ac.uk/entities/publication/88113a91-b994-4717-8526-dadac657f1cb)).
- **Creator storefronts are saturated.** Stan (about $35M ARR), Whop (about $142M annualized), Gumroad, Ko-fi and Linktree, plus hundreds of €3/mo clones.
- **General freelancer back-office tools are consolidating.** Bonsai was sold to Zoom, and Fiverr shut down AND.CO on 1 March 2026.
- **What works for solo founders: narrow tools attached to how people already earn.**

| Product | Disclosed revenue |
|---|---|
| GigRadar (Upwork automation) | $106K MRR |
| UpworkScribe (AI proposal writer) | $68K MRR, Stripe-verified |
| Rezi (resumes, solo founder) | about $215K MRR |
| Vollna (Upwork job alerts) | Pricing: $4 / $19 / $49 per month |
| Buy Me a Coffee | about $4.9M ARR |

## 3. Demand evidence

- **Finding clients is the #1 problem:** 73% of 2,000+ freelancers across 122 countries named it ([Payoneer 2023](https://www.businesswire.com/news/home/20230321005195/en)).
- **Bidding is expensive:** about $3 per Upwork proposal in Connects, with no refund on ghost jobs ([Upwork Community](https://community.upwork.com/t5/Freelancers/Upwork-s-Exorbitant-Connects-Policy-A-Barrier-to-Job/td-p/1560061)). One Fiverr seller paid $10K+ in fees on $54K of earnings.
- **People say they would pay:** "Would you pay $15–20/mo for leads?" got positive replies, and client-finding is sold at $15/week in r/ForHireFreelance.
- **Late payment:** 71% of freelancers have had trouble collecting ([Freelancers Union](https://onlabor.org/wp-content/uploads/2017/05/FU_NonpaymentReport_r3.pdf)). The pain is real, but invoicing tools churn.
- **Why products fail:**
  - Admin tools don't visibly earn the user money.
  - Usage stops once a freelancer is fully booked.
  - Budgets are low in developing countries.
  - Free ChatGPT replaces generic AI writers.

## 4. Ranked shortlist

| # | Idea | Verdict |
|---|---|---|
| **1** | **Off-platform client finder and pitch writer (Pitchcraft)** | Biggest pain, visible ROI, no money custody, no dependence on another platform's terms |
| 2 | Upwork bid co-pilot (alerts, client and scam scoring, Connects ROI) | Strongest proof that people pay, but Upwork ToS risk and a shrinking platform |
| 3 | AI-trainer gig hub (Outlier, DataAnnotation, Mercor) | Little competition, but no data access and gigs come and go |
| 4 | Micro-creator sponsorship kit | A commission model would need money flows |
| 5 | South Asia payout-fee comparator | Affiliate income only, small ceiling |

## 5. Pitchcraft economics

- **Pricing:** Free, 5 leads a week. Pro, $19/mo or $149/yr. Nepal, NPR 999/mo.
- **Running costs:**
  - LLM about $0.001 per pitch.
  - PageSpeed API free.
  - OpenStreetMap free; Google Places optional at about $0.03 per search.
  - Hosting $20–45/mo.
  - About 3 Pro users cover all costs.
- **Revenue targets:** 100 Pro users ≈ $1.9K MRR; 500 ≈ $9.5K MRR.
- **Risks and mitigations:**
  - **Spam laws:** pitches are one-to-one, sent from the user's own inbox, with daily caps.
  - **Google Places ToS:** start with OpenStreetMap.
  - **Churn:** offer an annual plan and a "pause" option.
