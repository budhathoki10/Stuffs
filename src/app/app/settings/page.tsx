import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/auth-forms";
import { SettingsForm } from "@/components/settings-form";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { activeSearch } from "@/lib/services/delivery";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const user = await requireUser();
  const [{ welcome }, search] = await Promise.all([searchParams, activeSearch(user.id)]);
  const isWelcome = welcome === "1" && !search;
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isWelcome ? "Welcome! Who do you want to work with?" : "Settings"}</h1>
        <p className="text-muted">We use this to find the right businesses and write pitches in your name.</p>
      </div>
      <Card>
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
      </Card>
      {!isWelcome && (
        <Card className="border-danger/40">
          <h2 className="mb-2 font-semibold">Delete account</h2>
          <DeleteAccountForm />
        </Card>
      )}
    </div>
  );
}
