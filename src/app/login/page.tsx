import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { Card, Logo } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/app");
  const { next } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <Link href="/" aria-label="Pitchcraft home">
        <Logo />
      </Link>
      <h1 className="mb-6 mt-8 text-2xl font-bold">Welcome back</h1>
      <Card>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </Card>
    </main>
  );
}
