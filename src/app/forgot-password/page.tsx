import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { Card, Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <Link href="/" aria-label="Pitchcraft home">
        <Logo />
      </Link>
      <h1 className="mb-6 mt-8 text-2xl font-bold">Reset your password</h1>
      <Card>
        <ForgotPasswordForm />
      </Card>
    </main>
  );
}
