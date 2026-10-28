import { describe, expect, it } from "vitest";
import { unreachableChecks } from "@/lib/audit/analyze";
import type { AuditCheck } from "@/lib/audit/types";
import { buildOverpassQuery, parseOverpass } from "@/lib/leads/osm";
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
