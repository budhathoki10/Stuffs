import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-forms";
import { ButtonLink, Card, Logo } from "@/components/ui";
import { isTokenValid } from "@/lib/auth/tokens";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  const valid = await isTokenValid(token, "reset_password");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <Link href="/" aria-label="Pitchcraft home">
        <Logo />
      </Link>
      <h1 className="mb-6 mt-8 text-2xl font-bold">{valid ? "Choose a new password" : "This link has expired"}</h1>
      <Card>
        {valid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <p className="text-muted">Reset links work once and expire after 1 hour. Ask for a new one below.</p>
            <ButtonLink href="/forgot-password">Send a new link</ButtonLink>
          </div>
        )}
      </Card>
    </main>
  );
}
