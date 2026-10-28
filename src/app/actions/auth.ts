"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { consumeAuthToken, tokensSentRecently } from "@/lib/auth/tokens";
import { cancelPaddleSubscription } from "@/lib/billing/paddle";
import {
  deleteAllSessions,
  deleteUser,
  markEmailVerified,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/services/account";
import { SITE } from "@/lib/site";
import { SKILLS, type SkillId } from "@/lib/skills";

export type AuthState = { error?: string; success?: string } | undefined;

const password = z.string().min(8, "Password must be at least 8 characters").max(200);
const email = z.email("Enter a valid email").trim().toLowerCase();

const SignupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email,
  password,
  skill: z.enum(Object.keys(SKILLS) as [SkillId, ...SkillId[]]).default("web_dev"),
  terms: z.literal("on", "Accept the Terms and Privacy Policy to continue"),
});

const LoginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

const ResetSchema = z
  .object({ token: z.string().min(20), password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, "The two passwords don't match");

const MAX_RESETS_PER_HOUR = 3;
const VERIFY_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

/** Only allow same-site relative redirects after login. */
function safeNext(value: FormDataEntryValue | null, fallback: string) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, skill } = parsed.data;

  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (existing) return { error: "An account with this email already exists. Try logging in." };

  const [user] = await db
    .insert(schema.users)
    .values({ name, email, skill, passwordHash: await hashPassword(password) })
    .returning({ id: schema.users.id, email: schema.users.email, name: schema.users.name });
  await createSession(user.id);
  try {
    await sendVerificationEmail(user);
  } catch (err) {
    // Signing up should still work if the email provider is down; they can resend later.
    console.error("Verification email failed", err);
  }
  redirect("/app/settings?welcome=1");
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email));
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Wrong email or password." };
  }
  await createSession(user.id);
  redirect(safeNext(formData.get("next"), "/app"));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function deleteAccount(_: AuthState, formData: FormData): Promise<AuthState> {
  const user = await requireUser();
  const given = String(formData.get("password") ?? "");
  if (!(await verifyPassword(given, user.passwordHash))) return { error: "That password isn't right." };

  if (user.paddleSubscriptionId) {
    try {
      await cancelPaddleSubscription(user.paddleSubscriptionId);
    } catch (err) {
      console.error("Paddle cancel before account deletion failed", err);
      return {
        error: `We couldn't cancel your subscription automatically, so your account wasn't deleted. Email ${SITE.supportEmail} and we'll do it for you.`,
      };
    }
  }
  await deleteUser(user.id);
  await destroySession();
  redirect("/?deleted=1");
}

export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email" };
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data));
  // Same answer whether or not the account exists, so this can't be used to find out who has an account.
  const done = { success: "If an account exists for that email, we've sent a link to reset your password. Check your inbox." };
  if (!user || (await tokensSentRecently(user.id, "reset_password", 60 * 60 * 1000)) >= MAX_RESETS_PER_HOUR) return done;
  try {
    await sendPasswordResetEmail(user);
  } catch (err) {
    console.error("Password reset email failed", err);
    return { error: "We couldn't send the email right now. Try again in a few minutes." };
  }
  return done;
}

export async function resetPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = ResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const userId = await consumeAuthToken(parsed.data.token, "reset_password");
  if (!userId) return { error: "This reset link has expired or was already used. Ask for a new one." };

  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(eq(schema.users.id, userId));
  await deleteAllSessions(userId);
  // Opening the emailed link proves they own the address.
  await markEmailVerified(userId);
  await createSession(userId);
  redirect("/app?reset=1");
}

export async function resendVerification(_: AuthState): Promise<AuthState> {
  const user = await requireUser();
  if (user.emailVerifiedAt) return { success: "Your email is already confirmed." };
  if ((await tokensSentRecently(user.id, "verify_email", VERIFY_RESEND_COOLDOWN_MS)) > 0) {
    return { error: "We sent one a minute ago. Give it a couple of minutes and check your spam folder." };
  }
  try {
    await sendVerificationEmail(user);
  } catch (err) {
    console.error("Verification email failed", err);
    return { error: "We couldn't send the email right now. Try again later." };
  }
  return { success: `Sent to ${user.email}.` };
}
