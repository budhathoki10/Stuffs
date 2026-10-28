import { NICHES, type NicheId } from "./niches";
import type { Business, GeoPoint, LeadProvider } from "./types";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";

function userAgent() {
  // Both services require an identifying User-Agent with contact details.
  return `Pitchcraft/1.0 (${process.env.OSM_CONTACT_EMAIL ?? "contact@example.com"})`;
}

export function buildOverpassQuery(niche: NicheId, lat: number, lon: number, radiusKm: number, limit = 150): string {
  const radius = Math.round(Math.min(Math.max(radiusKm, 1), 50) * 1000);
  const selectors = NICHES[niche].tags
    .map(([k, v]) => `nwr["${k}"="${v}"]["name"](around:${radius},${lat},${lon});`)
    .join("\n  ");
  return `[out:json][timeout:25];\n(\n  ${selectors}\n);\nout center tags ${limit};`;
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function cleanWebsite(raw: string | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/[;\s]/)[0].trim();
  if (!first) return null;
  return /^https?:\/\//i.test(first) ? first : `http://${first}`;
}

export function parseOverpass(elements: OverpassElement[], niche: NicheId): Business[] {
  const label = NICHES[niche].label.replace(/s$/, "");
  return elements
    .filter((e) => e.tags?.name)
    .map((e) => {
      const t = e.tags!;
      const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
      const address = [street, t["addr:city"]].filter(Boolean).join(", ") || null;
      return {
        source: "osm" as const,
        sourceId: `${e.type}/${e.id}`,
        name: t.name,
        category: label,
        address,
        website: cleanWebsite(t.website ?? t["contact:website"] ?? t.url),
        phone: t.phone ?? t["contact:phone"] ?? null,
        email: t.email ?? t["contact:email"] ?? null,
        lat: e.lat ?? e.center?.lat ?? null,
        lon: e.lon ?? e.center?.lon ?? null,
      };
    });
}

export const osmProvider: LeadProvider = {
  async geocode(location: string): Promise<GeoPoint | null> {
    const url = new URL(NOMINATIM);
    url.searchParams.set("q", location);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, { headers: { "user-agent": userAgent() }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    return hit ? { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name } : null;
  },

  async findBusinesses({ niche, lat, lon, radiusKm }) {
    const query = buildOverpassQuery(niche as NicheId, lat, lon, radiusKm);
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "user-agent": userAgent(), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Business search failed (${res.status})`);
    const data = (await res.json()) as { elements: OverpassElement[] };
    return parseOverpass(data.elements, niche as NicheId);
  },
};
