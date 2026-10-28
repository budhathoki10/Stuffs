import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { createAuthToken } from "@/lib/auth/tokens";
import { resetPasswordMessage, sendEmail, verifyEmailMessage } from "@/lib/email";
import { appUrl } from "@/lib/util";

export async function sendVerificationEmail(user: Pick<User, "id" | "email" | "name">) {
  const token = await createAuthToken(user.id, "verify_email");
  await sendEmail(verifyEmailMessage(user.email, user.name, appUrl(`/verify-email/${token}`)));
}

export async function sendPasswordResetEmail(user: Pick<User, "id" | "email">) {
  const token = await createAuthToken(user.id, "reset_password");
  await sendEmail(resetPasswordMessage(user.email, appUrl(`/reset-password/${token}`)));
}

export async function markEmailVerified(userId: string) {
  await db
    .update(schema.users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(schema.users.id, userId));
}

/** Delete the user; foreign-key cascades remove sessions, searches, leads, pitches, payments and tokens. */
export async function deleteUser(userId: string) {
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

/** Sign the user out on every device. */
export async function deleteAllSessions(userId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
