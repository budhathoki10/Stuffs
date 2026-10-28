import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, schema } from "@/db";
import { deliverLeads } from "@/lib/services/delivery";
import { needsRefresh, refreshStaleGoogleLeads } from "@/lib/services/google-refresh";
import { DAY, makeSearch, makeUser, resetDb, WEDNESDAY } from "./helpers";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const site = (page: string) => `${process.env.MOCK_SITE_BASE}/${page}`;

beforeEach(async () => {
  await resetDb();
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  process.env.LEADS_PROVIDER = "google";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_MAPS_API_KEY;
  process.env.LEADS_PROVIDER = "mock";
});

async function addGoogleLead(userId: string, sourceId: string, fetchedDaysAgo: number) {
  const [lead] = await db
    .insert(schema.leads)
    .values({
      userId,
      source: "google",
      sourceId,
      name: "Old Name",
      category: "Dentist",
      address: "Old address",
      phone: "old phone",
      website: "https://old.example",
      lat: 1,
      lon: 1,
      notes: "Called on Monday",
      deliveredOn: "2026-09-01",
      detailsFetchedAt: new Date(Date.now() - fetchedDaysAgo * DAY),
    })
    .returning();
  return lead;
}

describe("Google 30-day refresh", () => {
  it("only refreshes Google leads older than 29 days", async () => {
    const user = await makeUser();
    const stale = await addGoogleLead(user.id, "stale", 40);
    const fresh = await addGoogleLead(user.id, "fresh", 3);
    expect(needsRefresh(stale)).toBe(true);
    expect(needsRefresh(fresh)).toBe(false);
    expect(needsRefresh({ ...stale, source: "osm" })).toBe(false);

    const fetchMock = vi.fn().mockResolvedValue(
      json({ id: "stale", displayName: { text: "New Name" }, formattedAddress: "New address", internationalPhoneNumber: "+977 1-5000000", location: { latitude: 27.7, longitude: 85.3 } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await refreshStaleGoogleLeads()).toEqual({ refreshed: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://places.googleapis.com/v1/places/stale");

    const [after] = await db.select().from(schema.leads).where(eq(schema.leads.id, stale.id));
    expect(after).toMatchObject({ name: "New Name", address: "New address", phone: "+977 1-5000000", website: null, lat: 27.7, notes: "Called on Monday" });
    expect(needsRefresh(after)).toBe(false);

    const [untouched] = await db.select().from(schema.leads).where(eq(schema.leads.id, fresh.id));
    expect(untouched.phone).toBe("old phone");
  });

  it("clears cached Google content when the place no longer exists, keeping the user's notes", async () => {
    const user = await makeUser();
    const lead = await addGoogleLead(user.id, "deleted", 45);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: { message: "Not found" } }, 404)));

    await refreshStaleGoogleLeads();

    const [after] = await db.select().from(schema.leads).where(eq(schema.leads.id, lead.id));
    expect(after).toMatchObject({ name: "Old Name", address: null, phone: null, website: null, lat: null, lon: null, notes: "Called on Monday" });
  });

  it("counts failures without stopping the rest", async () => {
    const user = await makeUser();
    await addGoogleLead(user.id, "one", 40);
    await addGoogleLead(user.id, "two", 50);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(json({ error: { message: "quota" } }, 429)).mockResolvedValueOnce(json({ id: "one", displayName: { text: "One" } })),
    );
    expect(await refreshStaleGoogleLeads()).toEqual({ refreshed: 1, failed: 1 });
  });
});

describe("lead delivery from Google", () => {
  it("buys only one page of results when it already has enough new businesses", async () => {
    const user = await makeUser();
    await makeSearch(user.id);
    const places = Array.from({ length: 20 }, (_, i) => ({ id: `g${i}`, displayName: { text: `Dental ${i}` } }));
    const fetchMock = vi.fn().mockResolvedValue(json({ places, nextPageToken: "page2" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await deliverLeads(user, WEDNESDAY)).toEqual({ delivered: 5, reason: "ok" });
    // 20 new businesses on page 1 covers the 15 needed, so page 2 is never bought.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stores Google businesses, skips closed ones, and audits their real websites", async () => {
    const user = await makeUser({ skill: "web_dev" });
    await makeSearch(user.id);
    const places = [
      { id: "g-nosite", displayName: { text: "Himal Dental" }, internationalPhoneNumber: "+977 1-4100000" },
      { id: "g-old", displayName: { text: "Old Site Dental" }, websiteUri: site("old.html") },
      { id: "g-good", displayName: { text: "Good Site Dental" }, websiteUri: site("good.html") },
      { id: "g-closed", displayName: { text: "Closed Dental" }, businessStatus: "CLOSED_PERMANENTLY" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ places })));

    expect(await deliverLeads(user, WEDNESDAY)).toEqual({ delivered: 3, reason: "ok" });

    const leads = await db.select().from(schema.leads).where(eq(schema.leads.userId, user.id));
    expect(leads.every((l) => l.source === "google")).toBe(true);
    expect(leads.map((l) => l.sourceId).sort()).toEqual(["g-good", "g-nosite", "g-old"]);
    expect(leads.find((l) => l.sourceId === "g-nosite")).toMatchObject({ name: "Himal Dental", phone: "+977 1-4100000", website: null, auditId: null });
    // Google never returns emails, so the audit finds one on the business's own page.
    const old = leads.find((l) => l.sourceId === "g-old");
    expect(old?.auditId).not.toBeNull();
    expect(old?.email).toBe("owner.maple@mail.test");
  });
});
