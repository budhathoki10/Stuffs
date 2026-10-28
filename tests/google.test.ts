import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leadProvider } from "@/lib/leads";
import { boundingBox, GooglePlacesError, googleProvider, placeDetails, textSearchBody } from "@/lib/leads/google";
import { mockProvider } from "@/lib/leads/mock";
import { osmProvider } from "@/lib/leads/osm";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function place(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    displayName: { text: `Clinic ${id}` },
    formattedAddress: `${id} Durbar Marg, Kathmandu`,
    location: { latitude: 27.71, longitude: 85.32 },
    businessStatus: "OPERATIONAL",
    ...extra,
  };
}

beforeEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.LEADS_PROVIDER;
});

describe("boundingBox", () => {
  it("is centred on the search point and roughly radius-sized", () => {
    const box = boundingBox(27.7172, 85.324, 10);
    expect((box.low.latitude + box.high.latitude) / 2).toBeCloseTo(27.7172, 6);
    expect((box.low.longitude + box.high.longitude) / 2).toBeCloseTo(85.324, 6);
    // 10 km is about 0.09 degrees of latitude each way.
    expect(box.high.latitude - box.low.latitude).toBeCloseTo(0.18, 2);
    // Longitude degrees are shorter away from the equator, so the box is wider in degrees.
    expect(box.high.longitude - box.low.longitude).toBeGreaterThan(box.high.latitude - box.low.latitude);
  });

  it("clamps the radius to 1 to 50 km", () => {
    const tiny = boundingBox(0, 0, 0);
    const huge = boundingBox(0, 0, 900);
    expect(tiny.high.latitude).toBeCloseTo(1 / 111.32, 6);
    expect(huge.high.latitude).toBeCloseTo(50 / 111.32, 6);
  });
});

describe("textSearchBody", () => {
  it("restricts to the niche's Google type inside the box", () => {
    const body = textSearchBody("hotel", 27.7, 85.3, 5);
    expect(body).toMatchObject({ textQuery: "hotel", includedType: "lodging", strictTypeFiltering: true, pageSize: 20 });
    expect(body.locationRestriction.rectangle.low.latitude).toBeLessThan(27.7);
    expect(body).not.toHaveProperty("pageToken");
    expect(textSearchBody("hotel", 27.7, 85.3, 5, "tok")).toMatchObject({ pageToken: "tok" });
  });
});

describe("googleProvider.findBusinesses", () => {
  it("sends the key and a field mask, and maps places to businesses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        places: [
          place("a", { websiteUri: "https://a.example", internationalPhoneNumber: "+977 1-4000000" }),
          place("b", { nationalPhoneNumber: "01-4111111" }),
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const found = await googleProvider.findBusinesses({ niche: "dentist", lat: 27.7, lon: 85.3, radiusKm: 10 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-key");
    expect(init.headers["X-Goog-FieldMask"]).toContain("places.websiteUri");
    expect(init.headers["X-Goog-FieldMask"]).toContain("nextPageToken");
    expect(JSON.parse(init.body)).toMatchObject({ includedType: "dentist" });

    expect(found).toEqual([
      {
        source: "google",
        sourceId: "a",
        name: "Clinic a",
        category: "Dentist",
        address: "a Durbar Marg, Kathmandu",
        website: "https://a.example",
        phone: "+977 1-4000000",
        email: null,
        lat: 27.71,
        lon: 85.32,
      },
      expect.objectContaining({ sourceId: "b", website: null, phone: "01-4111111" }),
    ]);
  });

  it("skips businesses that have closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json({ places: [place("open"), place("gone", { businessStatus: "CLOSED_PERMANENTLY" }), place("paused", { businessStatus: "CLOSED_TEMPORARILY" })] }),
      ),
    );
    const found = await googleProvider.findBusinesses({ niche: "cafe", lat: 0, lon: 0, radiusKm: 5 });
    expect(found.map((b) => b.sourceId)).toEqual(["open"]);
  });

  it("pages only until it has enough businesses the user hasn't seen", async () => {
    const page = (prefix: string, next?: string) =>
      json({ places: Array.from({ length: 20 }, (_, i) => place(`${prefix}${i}`)), ...(next ? { nextPageToken: next } : {}) });
    const fetchMock = vi.fn().mockResolvedValueOnce(page("seen", "p2")).mockResolvedValueOnce(page("new", "p3")).mockResolvedValueOnce(page("more"));
    vi.stubGlobal("fetch", fetchMock);

    const found = await googleProvider.findBusinesses({
      niche: "dentist",
      lat: 0,
      lon: 0,
      radiusKm: 5,
      want: 15,
      isKnown: (id) => id.startsWith("seen"),
    });

    // Page 1 was all known, page 2 had 20 new: no need to pay for page 3.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ pageToken: "p2" });
    expect(found).toHaveLength(40);
  });

  it("never asks for more than 3 pages", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({ places: [place(`x${Math.random()}`)], nextPageToken: "again" }));
    vi.stubGlobal("fetch", fetchMock);
    await googleProvider.findBusinesses({ niche: "dentist", lat: 0, lon: 0, radiusKm: 5, want: 100, isKnown: () => false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("explains Google's errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: { code: 403, message: "Places API (New) has not been used in project 123 before or it is disabled." } }, 403)),
    );
    const err = await googleProvider.findBusinesses({ niche: "dentist", lat: 0, lon: 0, radiusKm: 5 }).catch((e) => e);
    expect(err).toBeInstanceOf(GooglePlacesError);
    expect(err.status).toBe(403);
    expect(err.message).toContain("has not been used in project");
  });

  it("refuses to run without a key", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    await expect(googleProvider.findBusinesses({ niche: "dentist", lat: 0, lon: 0, radiusKm: 5 })).rejects.toThrow("GOOGLE_MAPS_API_KEY");
  });
});

describe("googleProvider.geocode", () => {
  it("turns a city into coordinates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ places: [{ location: { latitude: 28.2096, longitude: 83.9856 }, formattedAddress: "Pokhara, Nepal" }] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await googleProvider.geocode("Pokhara")).toEqual({ lat: 28.2096, lon: 83.9856, label: "Pokhara, Nepal" });
    expect(fetchMock.mock.calls[0][1].headers["X-Goog-FieldMask"]).toBe("places.location,places.formattedAddress");
  });

  it("returns null for a place Google can't find", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({})));
    expect(await googleProvider.geocode("Nowhereville 12345")).toBeNull();
  });
});

describe("placeDetails", () => {
  it("fetches one place by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(place("abc")));
    vi.stubGlobal("fetch", fetchMock);
    expect(await placeDetails("abc")).toMatchObject({ id: "abc" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://places.googleapis.com/v1/places/abc");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("returns null when the place no longer exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: { message: "Not found" } }, 404)));
    expect(await placeDetails("deleted")).toBeNull();
  });
});

describe("leadProvider", () => {
  it("uses Google when a key is set, OpenStreetMap otherwise, and honours LEADS_PROVIDER", () => {
    expect(leadProvider()).toBe(googleProvider);
    delete process.env.GOOGLE_MAPS_API_KEY;
    expect(leadProvider()).toBe(osmProvider);
    process.env.LEADS_PROVIDER = "mock";
    expect(leadProvider()).toBe(mockProvider);
    process.env.LEADS_PROVIDER = "google";
    expect(leadProvider()).toBe(googleProvider);
  });
});
