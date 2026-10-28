import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/auth-forms";
import { SettingsForm } from "@/components/settings-form";
import { PaymentDetailsForm } from "@/components/workspace/payment-details-form";
import { requireUser } from "@/lib/auth/session";
import { activeSearch } from "@/lib/services/delivery";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const user = await requireUser();
  const [{ welcome }, search] = await Promise.all([searchParams, activeSearch(user.id)]);
  const isWelcome = welcome === "1" && !search;
  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-4xl font-medium tracking-tight">{isWelcome ? "One more step" : "Settings"}</h1>
      <p className="mt-1.5 text-sm text-muted">
        {isWelcome ? "Tell us who you'd like as clients and we'll find the first five." : "Changes apply from your next batch of leads."}
      </p>
      <div className="mt-10">
        <SettingsForm
          welcome={isWelcome}
          defaults={{
            name: user.name,
            skill: user.skill,
            portfolioUrl: user.portfolioUrl ?? "",
            niche: search?.niche ?? "",
            location: search?.location ?? "",
            radiusKm: search?.radiusKm ?? 10,
          }}
        />
      </div>
      {!isWelcome && (
        <section id="payment" className="mt-16 scroll-mt-6 border-t border-border pt-8">
          <h2 className="font-serif text-xl font-medium">How clients pay you</h2>
          <p className="mb-6 mt-1 text-sm text-muted">
            Printed on every invoice. Clients pay you directly, and Pitchcraft never holds or touches the money.
          </p>
          <PaymentDetailsForm details={user.paymentDetails} />
        </section>
      )}
      {!isWelcome && (
        <section className="mt-16 border-t border-border pt-8">
          <h2 className="font-serif text-xl font-medium">Delete account</h2>
          <div className="mt-3">
            <DeleteAccountForm />
          </div>
        </section>
      )}
    </div>
  );
}
