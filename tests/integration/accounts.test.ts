import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/auth/session";
import { consumeAuthToken, createAuthToken, isTokenValid, tokensSentRecently } from "@/lib/auth/tokens";
import { deleteAllSessions, deleteUser, markEmailVerified } from "@/lib/services/account";
import { makeSearch, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("one-time email tokens", () => {
  it("are stored hashed and work exactly once", async () => {
    const user = await makeUser();
    const token = await createAuthToken(user.id, "reset_password");
    const [row] = await db.select().from(schema.authTokens);
    expect(row.id).toBe(hashToken(token));
    expect(row.id).not.toContain(token);

    expect(await isTokenValid(token, "reset_password")).toBe(true);
    expect(await consumeAuthToken(token, "reset_password")).toBe(user.id);
    expect(await consumeAuthToken(token, "reset_password")).toBeNull();
    expect(await isTokenValid(token, "reset_password")).toBe(false);
  });

  it("can't be used for a different purpose", async () => {
    const user = await makeUser();
    const token = await createAuthToken(user.id, "verify_email");
    expect(await consumeAuthToken(token, "reset_password")).toBeNull();
    expect(await consumeAuthToken(token, "verify_email")).toBe(user.id);
  });

  it("expire", async () => {
    const user = await makeUser();
    const token = await createAuthToken(user.id, "reset_password");
    await db.update(schema.authTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await isTokenValid(token, "reset_password")).toBe(false);
    expect(await consumeAuthToken(token, "reset_password")).toBeNull();
  });

  it("reset links last 1 hour and confirmation links 3 days", async () => {
    const user = await makeUser();
    await createAuthToken(user.id, "reset_password");
    await createAuthToken(user.id, "verify_email");
    const rows = await db.select().from(schema.authTokens);
    const hours = (p: string) => {
      const r = rows.find((x) => x.purpose === p)!;
      return Math.round((r.expiresAt.getTime() - r.createdAt.getTime()) / 3_600_000);
    };
    expect(hours("reset_password")).toBe(1);
    expect(hours("verify_email")).toBe(72);
  });

  it("only one of two simultaneous uses succeeds", async () => {
    const user = await makeUser();
    const token = await createAuthToken(user.id, "reset_password");
    const results = await Promise.all([consumeAuthToken(token, "reset_password"), consumeAuthToken(token, "reset_password")]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("are counted for rate limiting per user and purpose", async () => {
    const user = await makeUser();
    const other = await makeUser();
    await createAuthToken(user.id, "reset_password");
    await createAuthToken(user.id, "reset_password");
    await createAuthToken(user.id, "verify_email");
    await createAuthToken(other.id, "reset_password");
    expect(await tokensSentRecently(user.id, "reset_password", 60_000)).toBe(2);
    expect(await tokensSentRecently(user.id, "verify_email", 60_000)).toBe(1);
  });
});

describe("accounts", () => {
  it("marks the email confirmed", async () => {
    const user = await makeUser();
    expect(user.emailVerifiedAt).toBeNull();
    await markEmailVerified(user.id);
    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(after.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("signs out every device", async () => {
    const user = await makeUser();
    const other = await makeUser();
    const future = new Date(Date.now() + 60_000);
    await db.insert(schema.sessions).values([
      { id: "s1", userId: user.id, expiresAt: future },
      { id: "s2", userId: user.id, expiresAt: future },
      { id: "s3", userId: other.id, expiresAt: future },
    ]);
    await deleteAllSessions(user.id);
    const left = await db.select().from(schema.sessions);
    expect(left.map((s) => s.id)).toEqual(["s3"]);
  });

  it("deleting a user removes all of their data", async () => {
    const user = await makeUser();
    const keep = await makeUser();
    const search = await makeSearch(user.id);
    await makeSearch(keep.id);
    const [lead] = await db
      .insert(schema.leads)
      .values({ userId: user.id, searchId: search.id, source: "mock", sourceId: "x", name: "Biz", category: "Dentist", deliveredOn: "2026-10-28" })
      .returning();
    await db.insert(schema.pitches).values({ userId: user.id, leadId: lead.id, subject: "s", body: "b", model: "template" });
    await db.insert(schema.payments).values({ userId: user.id, provider: "khalti", providerRef: "p1", status: "completed", amountMinor: 1, currency: "NPR" });
    await db.insert(schema.sessions).values({ id: "sess", userId: user.id, expiresAt: new Date(Date.now() + 60_000) });
    await createAuthToken(user.id, "verify_email");

    await deleteUser(user.id);

    const counts = await db.execute<{ t: string; n: number }>(sql`
      select 'users' t, count(*)::int n from users where id = ${user.id}
      union all select 'searches', count(*)::int from searches where user_id = ${user.id}
      union all select 'leads', count(*)::int from leads where user_id = ${user.id}
      union all select 'pitches', count(*)::int from pitches where user_id = ${user.id}
      union all select 'payments', count(*)::int from payments where user_id = ${user.id}
      union all select 'sessions', count(*)::int from sessions where user_id = ${user.id}
      union all select 'auth_tokens', count(*)::int from auth_tokens where user_id = ${user.id}`);
    for (const row of counts) expect(row.n, row.t).toBe(0);
    // Other users are untouched.
    expect(await db.select().from(schema.searches).where(eq(schema.searches.userId, keep.id))).toHaveLength(1);
  });
});
