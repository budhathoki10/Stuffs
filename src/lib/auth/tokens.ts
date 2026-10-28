import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "./session";

export type TokenPurpose = "reset_password" | "verify_email";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  reset_password: 60 * 60 * 1000,
  verify_email: 3 * 24 * 60 * 60 * 1000,
};

/** Create a one-time token and return the raw value to put in the emailed link. */
export async function createAuthToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.authTokens).values({
    id: hashToken(token),
    userId,
    purpose,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
  });
  return token;
}

function validWhere(token: string, purpose: TokenPurpose) {
  return and(
    eq(schema.authTokens.id, hashToken(token)),
    eq(schema.authTokens.purpose, purpose),
    isNull(schema.authTokens.usedAt),
    gt(schema.authTokens.expiresAt, new Date()),
  );
}

/** Check a token without using it up (e.g. to show the reset form). */
export async function isTokenValid(token: string, purpose: TokenPurpose): Promise<boolean> {
  const [row] = await db.select({ id: schema.authTokens.id }).from(schema.authTokens).where(validWhere(token, purpose)).limit(1);
  return !!row;
}

/** Mark a token used and return its user id. Only the first caller succeeds. */
export async function consumeAuthToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const [row] = await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(validWhere(token, purpose))
    .returning({ userId: schema.authTokens.userId });
  return row?.userId ?? null;
}

export async function tokensSentRecently(userId: string, purpose: TokenPurpose, windowMs: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.userId, userId),
        eq(schema.authTokens.purpose, purpose),
        gt(schema.authTokens.createdAt, new Date(Date.now() - windowMs)),
      ),
    );
  return row.n;
}
