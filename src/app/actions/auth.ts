"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { SKILLS, type SkillId } from "@/lib/skills";

export type AuthState = { error?: string } | undefined;

const SignupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  email: z.email("Please enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  skill: z.enum(Object.keys(SKILLS) as [SkillId, ...SkillId[]]).default("web_dev"),
});

const LoginSchema = z.object({
  email: z.email("Please enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Please enter your password"),
});

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
    .returning({ id: schema.users.id });
  await createSession(user.id);
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
