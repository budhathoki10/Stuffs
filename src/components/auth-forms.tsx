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

const link = "text-foreground underline underline-offset-4 hover:text-pen";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-5">
      <Field label="Your name" hint="Goes at the bottom of your emails.">
        <input name="name" required autoComplete="name" className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="What kind of work do you do?">
        <select name="skill" className={inputClass} defaultValue="web_dev">
          {Object.entries(SKILLS).map(([id, s]) => (
            <option key={id} value={id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-start gap-2.5 text-sm">
        <input name="terms" type="checkbox" required className="mt-1 h-3.5 w-3.5 accent-[var(--ink)]" />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className={link}>
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className={link}>
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending} className="w-full py-2.5">
        {pending ? "Creating your account…" : "Create account"}
      </Button>
      <p className="text-sm text-muted">
        Already have one?{" "}
        <Link href="/login" className={link}>
          Log in
        </Link>
      </p>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-5">
      <input type="hidden" name="next" value={next ?? "/app"} />
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending} className="w-full py-2.5">
        {pending ? "Logging in…" : "Log in"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className={link}>
          Forgot password?
        </Link>
        <Link href="/signup" className={link}>
          Create an account
        </Link>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  if (state?.success) return <FormMessage success={state.success} />;
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-5">
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending} className="w-full py-2.5">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-sm">
        <Link href="/login" className={link}>
          Back to log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Type it again">
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending} className="w-full py-2.5">
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
        Deletes your account, leads, drafts and earnings history straight away, and cancels Pro if you have it. There
        is no undo.
      </p>
      <Field label="Confirm with your password">
        <input name="password" type="password" required autoComplete="current-password" className={`${inputClass} max-w-xs`} />
      </Field>
      <FormMessage error={state?.error} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[5px] border border-pen px-3.5 py-2 text-sm font-medium text-pen hover:bg-pen hover:text-on-ink disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}

export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerification, undefined);
  return (
    <div className="border-b border-border bg-highlight/60">
      <form action={action} className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 text-[13px]">
        <span>Confirm your email address. We sent a link to {email}.</span>
        <button type="submit" disabled={pending} className="font-medium underline underline-offset-4 disabled:opacity-50">
          {pending ? "Sending…" : "Send it again"}
        </button>
        {state?.error && (
          <span role="alert" className="text-pen">
            {state.error}
          </span>
        )}
        {state?.success && <span role="status">{state.success}</span>}
      </form>
    </div>
  );
}
