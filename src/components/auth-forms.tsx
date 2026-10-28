"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";
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
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="text-accent underline">
          Create a free account
        </Link>
      </p>
    </form>
  );
}
