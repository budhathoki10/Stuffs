import { AuditForm } from "@/components/audit-form";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ButtonLink, Eyebrow, FormMessage } from "@/components/ui";
import { PLAN_LIMITS, PRICES } from "@/lib/plans";

const EXAMPLE_LEADS = [
  { name: "Sunrise Bakery", problem: "No website at all", score: null },
  { name: "Maple Street Dental", problem: "Takes 6.8 seconds to load on a phone", score: 31 },
  { name: "Riverside Physio", problem: 'Browsers label it "Not secure"', score: 38 },
  { name: "Lotus Thai Kitchen", problem: "No way to order or book online", score: 47 },
  { name: "Oak & Pine Florist", problem: "Footer still says © 2016", score: 58 },
];

const FAQ = [
  {
    q: "Isn't this just cold email?",
    a: "It's one email, written to one owner, about one problem you can see on their site. You send it yourself, from your own address. Pitchcraft never sends anything on your behalf, and there's no bulk sending.",
  },
  {
    q: "Where do the businesses come from?",
    a: "OpenStreetMap, filtered by the type of business you pick and the distance from your city. Contact details come from the map listing or the business's own site. Coverage is good in most cities and patchy in some small towns.",
  },
  {
    q: "Do I need a portfolio?",
    a: "It helps. But the report link carries a lot of weight on its own: the owner can open it and see the slow load time or the security warning for themselves.",
  },
  {
    q: "I'm in Nepal. Can I pay in rupees?",
    a: `Yes. NPR ${PRICES.monthlyNpr} buys 30 days of Pro through Khalti. It doesn't renew automatically.`,
  },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {deleted === "1" && (
          <div className="mx-auto max-w-5xl px-5 pt-6">
            <FormMessage success="Your account and everything in it has been deleted." />
          </div>
        )}

        <section className="mx-auto grid max-w-5xl gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <Eyebrow>For freelance web designers, developers and SEO people</Eyebrow>
            <h1 className="mt-4 font-serif text-[2.75rem] font-medium leading-[1.05] tracking-tight sm:text-6xl">
              Your next client already has a <span className="pen-mark italic">broken</span> website.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted">
              Every morning Pitchcraft picks five local businesses whose websites are losing them customers, marks up
              what&apos;s wrong, and drafts a short email from you to the owner. You send it from your own inbox. Nobody
              takes a cut.
            </p>
            <div className="mt-9 max-w-lg">
              <p className="mb-2 text-sm font-medium">Try it on any business website</p>
              <AuditForm />
            </div>
          </div>

          <Specimen />
        </section>

        <section id="how" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-20">
            <h2 className="font-serif text-4xl font-medium tracking-tight">What&apos;s waiting for you each morning</h2>
            <p className="mt-3 max-w-2xl text-muted">
              Five businesses near the city you choose, sorted by how much they need you. A web designer sees the ones
              with no site first. An SEO person sees the ones Google can barely read.
            </p>

            <div className="mt-10 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-background text-[11px] uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Business</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Biggest problem</th>
                    <th className="px-4 py-2.5 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {EXAMPLE_LEADS.map((l) => (
                    <tr key={l.name}>
                      <td className="px-4 py-3">
                        <span className="font-medium">{l.name}</span>
                        <span className="block text-[13px] text-pen sm:hidden">{l.problem}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-pen sm:table-cell">{l.problem}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">{l.score ?? "n/a"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-14 grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="font-serif text-xl font-medium">How a business gets picked</h3>
                <p className="mt-2 text-muted">
                  We pull businesses of your chosen type from the map, load each website, and run thirteen checks: HTTPS,
                  phone layout, load time, page title, search description, contact links, online booking, the year in the
                  footer, and a few more. A site with no website at all goes straight to the top for web designers.
                </p>
              </div>
              <div>
                <h3 className="font-serif text-xl font-medium">Why the email gets read</h3>
                <p className="mt-2 text-muted">
                  It opens with something the owner can check in ten seconds, like &ldquo;your site takes seven seconds to
                  load on a phone&rdquo;, and links to a one-page report that shows it. No templates about
                  &ldquo;taking your business to the next level&rdquo;. Edit it, then send it from Gmail or your own mail
                  app.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-20">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <h2 className="font-serif text-4xl font-medium tracking-tight">Why not just bid on Upwork?</h2>
            <div className="space-y-4 text-muted">
              <p>
                Because you&apos;re one of fifty proposals, each one costs you Connects, and most clients never open
                them. Fiverr keeps 20% of every order. Both platforms reported fewer active buyers this year than last.
              </p>
              <p>
                Meanwhile the dentist down the road with a site from 2017 has never posted a job, because she doesn&apos;t
                know she needs one. Nobody is competing for that work. You just have to be the one who points it out.
              </p>
              <p className="text-sm text-faint">
                Sources: Upwork Q2 2026 results (active clients down 4%), Fiverr Q2 2026 results (active buyers down
                21.9%), Upwork Connects pricing.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-20">
            <h2 className="font-serif text-4xl font-medium tracking-tight">Pricing</h2>
            <p className="mt-3 text-muted">One client at $500 pays for two years of Pro.</p>
            <div className="mt-10 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-background text-left">
                  <tr>
                    <th className="px-4 py-4 sm:w-1/2" />
                    <th className="px-4 py-4">
                      <span className="block font-medium">Free</span>
                      <span className="font-mono text-2xl tabular-nums">$0</span>
                    </th>
                    <th className="px-4 py-4">
                      <span className="block font-medium">Pro</span>
                      <span className="font-mono text-2xl tabular-nums">${PRICES.monthlyUsd}</span>
                      <span className="text-muted"> / month</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["New leads", `${PLAN_LIMITS.free.leadsPerWeek} a week`, `${PLAN_LIMITS.pro.leadsPerDay} every day`],
                    ["Drafted pitches", `${PLAN_LIMITS.free.pitchesPerWeek} a week`, "As many as you need"],
                    ["Website reports you can share", "Yes", "Yes"],
                    ["Pipeline and earnings tracking", "Yes", "Yes"],
                  ].map(([row, free, pro]) => (
                    <tr key={row}>
                      <td className="px-4 py-3 text-muted">{row}</td>
                      <td className="px-4 py-3">{free}</td>
                      <td className="px-4 py-3">{pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ButtonLink href="/signup">Start free</ButtonLink>
              <p className="text-sm text-muted">
                Pro is also ${PRICES.yearlyUsd} a year, or NPR {PRICES.monthlyNpr} for 30 days with Khalti. 14-day
                refund, no questions.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="font-serif text-4xl font-medium tracking-tight">Questions</h2>
          <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1.5 text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/** A static example of one lead, so visitors see the product rather than a description of it. */
function Specimen() {
  return (
    <figure className="self-start rounded-md border border-border bg-surface shadow-[0_1px_0_var(--border),0_12px_32px_-16px_rgba(27,26,23,0.18)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <Eyebrow>Example lead</Eyebrow>
        <span className="font-mono text-xs text-faint">Wed 28 Oct</span>
      </div>
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-2xl font-medium leading-tight">Maple Street Dental</p>
            <p className="text-sm text-muted">Dentist · 11 Main St, Austin TX</p>
          </div>
          <p className="font-mono text-3xl tabular-nums leading-none">
            31<span className="text-sm text-faint">/100</span>
          </p>
        </div>
        <ul className="mt-5 space-y-2 text-sm">
          <li>
            <span className="pen-mark">Takes 6.8s to load on a phone</span>
          </li>
          <li>
            <span className="pen-mark">No HTTPS, so Chrome shows &ldquo;Not secure&rdquo;</span>
          </li>
          <li>
            <span className="pen-mark">Footer says © 2017</span>
          </li>
        </ul>
      </div>
      <div className="border-t border-dashed border-strong-border bg-background/60 px-5 py-4 text-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Your draft</p>
        <p className="mt-2 text-foreground">Hi Dr. Patel,</p>
        <p className="mt-2 text-foreground">
          I opened your website on my phone this morning and it took almost seven seconds to load. Most people looking
          for a dentist nearby won&apos;t wait that long. They tap the next result.
        </p>
        <p className="mt-2 text-muted">I fix exactly this kind of thing for local practices…</p>
      </div>
    </figure>
  );
}
