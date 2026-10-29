import { afterEach, describe, expect, it, vi } from "vitest";
import { unreachableChecks } from "@/lib/audit/analyze";
import type { AuditCheck } from "@/lib/audit/types";
import { buildOverpassQuery, contactEmail, osmProvider, OsmUnavailableError, overpassFailure, parsePhoton, parseOverpass } from "@/lib/leads/osm";
import { opportunityScore } from "@/lib/leads/rank";
import { weekStart } from "@/lib/plans";

describe("Overpass", () => {
  it("builds a query for every tag of the niche", () => {
    const q = buildOverpassQuery("salon", 27.7, 85.3, 5);
    expect(q).toContain('nwr["shop"="hairdresser"]["name"](around:5000,27.7,85.3);');
    expect(q).toContain('nwr["shop"="beauty"]["name"](around:5000,27.7,85.3);');
    expect(q).toContain("out center tags 150;");
  });

  it("clamps the radius", () => {
    expect(buildOverpassQuery("cafe", 0, 0, 500)).toContain("around:50000");
  });

  it("parses nodes and ways into businesses", () => {
    const businesses = parseOverpass(
      [
        {
          type: "node",
          id: 1,
          lat: 27.7,
          lon: 85.3,
          tags: { name: "Himalaya Dental", website: "himalayadental.com.np; https://other.example", phone: "+977 1 4000000", "addr:street": "Durbar Marg", "addr:housenumber": "12", "addr:city": "Kathmandu" },
        },
        { type: "way", id: 2, center: { lat: 27.71, lon: 85.31 }, tags: { name: "Smile Clinic", "contact:email": "hi@smile.np" } },
        { type: "node", id: 3, lat: 1, lon: 1, tags: { amenity: "dentist" } },
      ],
      "dentist",
    );
    expect(businesses).toHaveLength(2);
    expect(businesses[0]).toMatchObject({
      sourceId: "node/1",
      name: "Himalaya Dental",
      category: "Dentist",
      website: "http://himalayadental.com.np",
      address: "12 Durbar Marg, Kathmandu",
    });
    expect(businesses[1]).toMatchObject({ sourceId: "way/2", website: null, email: "hi@smile.np", lat: 27.71 });
  });
});

describe("OpenStreetMap servers", () => {
  const dentist = { tags: { name: "Himalaya Dental", amenity: "dentist" }, type: "node", id: 1, lat: 27.7, lon: 85.3 };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const search = () => osmProvider.findBusinesses({ niche: "dentist", lat: 27.7, lon: 85.3, radiusKm: 5 });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("treats a timed-out query as a failure, not as an empty area", () => {
    expect(overpassFailure({ remark: "runtime error: Query timed out in \"query\" at line 3 after 26 seconds." })).toMatch(/timed out/);
    expect(overpassFailure({ remark: "runtime error: Query run out of memory using about 2048 MB of RAM." })).toMatch(/memory/);
    expect(overpassFailure({})).toBeNull();
  });

  it("moves on to the next server when one is busy, refuses, or times out", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const host = new URL(url).host;
        calls.push(host);
        if (host === "overpass-api.de") return json({ elements: [], remark: "runtime error: Query timed out" });
        if (host === "overpass.private.coffee") return new Response("<html>429 Too Many Requests</html>", { status: 429 });
        return json({ elements: [dentist] });
      }),
    );
    const businesses = await search();
    expect(businesses.map((b) => b.name)).toEqual(["Himalaya Dental"]);
    expect(calls).toEqual(["overpass-api.de", "overpass.private.coffee", "maps.mail.ru"]);
  });

  it("explains what every server said when none can answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const host = new URL(url).host;
        if (host === "overpass-api.de") return new Response("busy", { status: 504 });
        if (host === "overpass.private.coffee") return new Response("<html>oops</html>", { status: 200 });
        throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
      }),
    );
    const err = await search().catch((e) => e);
    expect(err).toBeInstanceOf(OsmUnavailableError);
    expect(err.attempts).toEqual(["overpass-api.de: HTTP 504", "overpass.private.coffee: not JSON (server busy)", "maps.mail.ru: timed out"]);
  });

  it("uses OVERPASS_URL instead of the public servers when set", async () => {
    vi.stubEnv("OVERPASS_URL", "https://overpass.mine.test/api/interpreter");
    const fetchMock = vi.fn(async () => json({ elements: [dentist] }));
    vi.stubGlobal("fetch", fetchMock);
    await search();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("https://overpass.mine.test/api/interpreter");
  });

  it("finds a city with Photon when Nominatim refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) =>
        new URL(url).host === "nominatim.openstreetmap.org"
          ? new Response("Access blocked", { status: 403 })
          : json({ features: [{ geometry: { coordinates: [85.324, 27.7172] }, properties: { name: "Kathmandu", state: "Bagmati Province", country: "Nepal" } }] }),
      ),
    );
    expect(await osmProvider.geocode("Kathmandu, Nepal")).toEqual({ lat: 27.7172, lon: 85.324, label: "Kathmandu, Bagmati Province, Nepal" });
  });

  it("says nothing was found only when a geocoder actually answered", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json([])));
    expect(await osmProvider.geocode("Nowhereville")).toBeNull();
    expect(parsePhoton({ features: [] })).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    await expect(osmProvider.geocode("Kathmandu")).rejects.toThrow("nominatim: HTTP 503; photon: HTTP 503");
  });

  it("sends a real contact address, never a placeholder", () => {
    vi.stubEnv("OSM_CONTACT_EMAIL", "you@example.com");
    vi.stubEnv("SUPPORT_EMAIL", "support@yourdomain.com");
    expect(contactEmail()).toBeNull();
    vi.stubEnv("SUPPORT_EMAIL", "kushal@pitchcraft.app");
    expect(contactEmail()).toBe("kushal@pitchcraft.app");
    vi.stubEnv("OSM_CONTACT_EMAIL", "osm@pitchcraft.app");
    expect(contactEmail()).toBe("osm@pitchcraft.app");
  });
});

describe("opportunityScore", () => {
  const failed = (id: string): AuditCheck => ({ id, label: id, passed: false, severity: "major", detail: "", impact: "" });

  it("ranks businesses without a website highest for web developers", () => {
    expect(opportunityScore("web_dev", null, null)).toBe(100);
    expect(opportunityScore("speed", null, null)).toBeLessThan(30);
  });

  it("rewards problems that match the freelancer's skill", () => {
    const seoProblems = [failed("title"), failed("description")];
    expect(opportunityScore("seo", 70, seoProblems)).toBeGreaterThan(opportunityScore("speed", 70, seoProblems));
  });

  it("treats a broken site as a strong lead", () => {
    expect(opportunityScore("web_dev", 0, unreachableChecks("down", "x"))).toBe(85);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart(new Date("2026-10-28T12:00:00Z"))).toBe("2026-10-26"); // Wednesday
    expect(weekStart(new Date("2026-11-01T23:00:00Z"))).toBe("2026-10-26"); // Sunday
    expect(weekStart(new Date("2026-10-26T00:00:00Z"))).toBe("2026-10-26"); // Monday
  });
});
