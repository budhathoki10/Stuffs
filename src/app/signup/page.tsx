import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { Card, Logo } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <Link href="/" aria-label="Pitchcraft home">
        <Logo />
      </Link>
      <h1 className="mb-1 mt-8 text-2xl font-bold">Find your next client</h1>
      <p className="mb-6 text-muted">Free forever plan. No card needed.</p>
      <Card>
        <SignupForm />
      </Card>
    </main>
  );
}
