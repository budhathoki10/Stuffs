"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  deleteAccount,
  login,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signup,
} from "@/app/actions/auth";
import { SKILLS } from "@/lib/skills";
import { Button, Field, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-4">
      <Field label="Your name" hint="Used to sign your pitches.">
        <input name="name" required autoComplete="name" className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="What do you offer?">
        <select name="skill" className={inputClass} defaultValue="web_dev">
          {Object.entries(SKILLS).map(([id, s]) => (
            <option key={id} value={id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input name="terms" type="checkbox" required className="mt-0.5 h-4 w-4 accent-accent" />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="text-accent underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="text-accent underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create free account"}
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/app"} />
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging in…" : "Log in"}
      </Button>
      <div className="flex justify-between text-sm text-muted">
        <Link href="/forgot-password" className="text-accent underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-accent underline">
          Create a free account
        </Link>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  if (state?.success) return <FormMessage success={state.success} />;
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-4">
      <Field label="Email" hint="We'll email you a link to choose a new password.">
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Repeat new password">
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-4">
      <p className="text-sm text-muted">
        This permanently deletes your account, leads, pitches and earnings history, and cancels any Pro subscription.
        It can&apos;t be undone.
      </p>
      <Field label="Confirm with your password">
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <FormMessage error={state?.error} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}

export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerification, undefined);
  return (
    <div className="border-b border-border bg-warn-soft">
      <form
        action={action}
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm text-warn"
      >
        <span>Please confirm your email: we sent a link to {email}.</span>
        <button type="submit" disabled={pending} className="font-semibold underline disabled:opacity-60">
          {pending ? "Sending…" : "Resend link"}
        </button>
        {state?.error && <span role="alert">{state.error}</span>}
        {state?.success && <span role="status">{state.success}</span>}
      </form>
    </div>
  );
}
