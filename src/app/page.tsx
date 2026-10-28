import { AuditForm } from "@/components/audit-form";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ButtonLink, Card, FormMessage } from "@/components/ui";
import { PLAN_LIMITS, PRICES } from "@/lib/plans";

const STEPS = [
  {
    title: "Tell us what you do",
    body: "Pick your skill (web design, SEO, speed, booking setup), the type of business you like working with, and your target city.",
  },
  {
    title: "Get 5 warm leads every day",
    body: "We find real local businesses and check each website for problems: no site at all, slow on phones, \"Not secure\" warnings, no way to book.",
  },
  {
    title: "Send a pitch that's actually about them",
    body: "Each lead comes with a personal email built from that business's real problems, plus a free report link to prove it. Send it from your own inbox.",
  },
  {
    title: "Win clients and keep 100%",
    body: "Track replies and wins in your pipeline. No 20% platform cut, no paying per proposal, no bidding against 50 other freelancers.",
  },
];

const FAQ = [
  {
    q: "Is this spam?",
    a: "No. You send one personal email at a time, from your own address, about a real, specific problem with that business's website. We never send bulk email for you.",
  },
  {
    q: "Where do the businesses come from?",
    a: "From OpenStreetMap, the open map database, filtered by business type and distance from your city. Contact details come from the map listing or the business's own website.",
  },
  {
    q: "I'm in Nepal. Can I pay locally?",
    a: `Yes. Pay NPR ${PRICES.monthlyNpr} for 30 days of Pro with Khalti. Everyone else pays in USD by card.`,
  },
  {
    q: "Do I need a portfolio?",
    a: "It helps, but the free report does a lot of the convincing: it shows the owner exactly what's wrong, so your pitch isn't just a claim.",
  },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {deleted === "1" && (
          <div className="mx-auto max-w-6xl px-4 pt-6">
            <FormMessage success="Your account and data have been deleted. Thanks for trying Pitchcraft." />
          </div>
        )}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
              For freelance web designers, developers & SEO pros
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Stop bidding on Upwork. Get clients who actually need you.
            </h1>
            <p className="mt-5 text-lg text-muted">
              Every day Pitchcraft finds 5 local businesses with website problems you can fix, and writes the email
              that gets you hired. You keep 100% of what you earn.
            </p>
          </div>
          <Card className="mt-10 max-w-3xl p-6">
            <h2 className="font-semibold">Try it now: check any business website</h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              Get the free report and a ready-to-send pitch in under a minute. No sign-up needed.
            </p>
            <AuditForm />
          </Card>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="space-y-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ["73%", "of freelancers say finding clients is their biggest challenge (Payoneer survey, 122 countries)."],
              ["$3+", "is what one Upwork proposal can cost in Connects, even when the client never reads it."],
              ["1 client", "at $500 pays for more than two years of Pitchcraft Pro."],
            ].map(([stat, text]) => (
              <Card key={stat}>
                <p className="text-3xl font-bold text-accent">{stat}</p>
                <p className="mt-2 text-sm text-muted">{text}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold tracking-tight">Simple pricing</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <Card>
                <h3 className="text-lg font-semibold">Free</h3>
                <p className="mt-1 text-3xl font-bold">$0</p>
                <ul className="mt-4 space-y-2 text-sm text-muted">
                  <li>✓ {PLAN_LIMITS.free.leadsPerWeek} leads per week</li>
                  <li>✓ {PLAN_LIMITS.free.pitchesPerWeek} personal pitches per week</li>
                  <li>✓ Website audits and shareable reports</li>
                  <li>✓ Pipeline and earnings tracker</li>
                </ul>
                <ButtonLink href="/signup" variant="secondary" className="mt-6 w-full">
                  Start free
                </ButtonLink>
              </Card>
              <Card className="border-accent ring-2 ring-accent/20">
                <h3 className="text-lg font-semibold">Pro</h3>
                <p className="mt-1 text-3xl font-bold">
                  ${PRICES.monthlyUsd}
                  <span className="text-base font-normal text-muted">/month</span>
                </p>
                <p className="text-sm text-muted">
                  or ${PRICES.yearlyUsd}/year · NPR {PRICES.monthlyNpr}/month with Khalti
                </p>
                <ul className="mt-4 space-y-2 text-sm text-muted">
                  <li>✓ {PLAN_LIMITS.pro.leadsPerDay} fresh leads every day</li>
                  <li>✓ Unlimited AI pitches</li>
                  <li>✓ Everything in Free</li>
                </ul>
                <ButtonLink href="/signup" className="mt-6 w-full">
                  Start free, upgrade anytime
                </ButtonLink>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight">Questions</h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1 text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
