import { NICHES, type NicheId } from "./niches";
import type { Business, GeoPoint, LeadProvider } from "./types";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Free geocoder built on OpenStreetMap data, used when Nominatim refuses or is down.
const PHOTON = "https://photon.komoot.io/api/";

/**
 * Public Overpass servers, tried in order. The main one is busy and often turns away
 * requests from cloud hosts, so a refusal there moves on to the next. OVERPASS_URL
 * (comma-separated) replaces the list, e.g. with your own instance.
 */
const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export function overpassServers(): string[] {
  const configured = (process.env.OVERPASS_URL ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  return configured.length ? configured : OVERPASS_SERVERS;
}

/** A real address the OpenStreetMap operators can write to. Placeholders like you@example.com get blocked, so they count as none. */
export function contactEmail(): string | null {
  for (const candidate of [process.env.OSM_CONTACT_EMAIL, process.env.SUPPORT_EMAIL]) {
    const v = candidate?.trim();
    if (v && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v) && !/@(example\.(com|org|net)|yourdomain\.com)$/i.test(v)) return v;
  }
  return null;
}

function userAgent() {
  // Both services require an identifying User-Agent, ideally with a way to reach the operator.
  const contact = contactEmail();
  return `Pitchcraft/1.0${contact ? ` (${contact})` : ""}`;
}

/** OpenStreetMap's public servers couldn't answer. `attempts` says what each one did, for the logs. */
export class OsmUnavailableError extends Error {
  constructor(
    readonly step: "geocode" | "search",
    readonly attempts: string[],
  ) {
    super(`OpenStreetMap ${step === "geocode" ? "location lookup" : "business search"} failed: ${attempts.join("; ")}`);
    this.name = "OsmUnavailableError";
  }
}

const host = (url: string) => new URL(url).host;
const reason = (err: unknown) => (err instanceof Error ? (err.name === "TimeoutError" ? "timed out" : err.message) : String(err));

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

async function nominatim(location: string): Promise<GeoPoint | null> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", location);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  const contact = contactEmail();
  if (contact) url.searchParams.set("email", contact);
  const res = await fetch(url, { headers: { "user-agent": userAgent() }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return hit ? { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name } : null;
}

type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> };

export function parsePhoton(data: { features?: PhotonFeature[] }): GeoPoint | null {
  const f = data.features?.[0];
  if (!f) return null;
  const p = f.properties;
  const label = [p.name, p.city !== p.name ? p.city : undefined, p.state, p.country].filter(Boolean).join(", ");
  return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], label };
}

async function photon(location: string): Promise<GeoPoint | null> {
  const url = new URL(PHOTON);
  url.searchParams.set("q", location);
  url.searchParams.set("limit", "1");
  const res = await fetch(url, { headers: { "user-agent": userAgent() }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parsePhoton(await res.json());
}

/**
 * Overpass reports a query that ran out of time or memory as HTTP 200 with a "remark" and
 * an empty or partial list. That has to count as a failure, not as "no businesses here".
 */
export function overpassFailure(data: { remark?: string }): string | null {
  const remark = data.remark ?? "";
  return /runtime error|timed out|out of memory|rate_limited|too many/i.test(remark) ? remark.slice(0, 160) : null;
}

async function overpass(server: string, query: string): Promise<OverpassElement[]> {
  const res = await fetch(server, {
    method: "POST",
    headers: { "user-agent": userAgent(), "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(35_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let data: { elements?: OverpassElement[]; remark?: string };
  try {
    data = JSON.parse(text);
  } catch {
    // Busy servers sometimes answer with an HTML error page.
    throw new Error("not JSON (server busy)");
  }
  const failure = overpassFailure(data);
  if (failure) throw new Error(failure);
  if (!Array.isArray(data.elements)) throw new Error("no results list");
  return data.elements;
}

export const osmProvider: LeadProvider = {
  async geocode(location: string): Promise<GeoPoint | null> {
    const attempts: string[] = [];
    for (const [name, lookup] of [
      ["nominatim", nominatim],
      ["photon", photon],
    ] as const) {
      try {
        return await lookup(location);
      } catch (err) {
        attempts.push(`${name}: ${reason(err)}`);
      }
    }
    throw new OsmUnavailableError("geocode", attempts);
  },

  async findBusinesses({ niche, lat, lon, radiusKm }) {
    const query = buildOverpassQuery(niche as NicheId, lat, lon, radiusKm);
    const attempts: string[] = [];
    for (const server of overpassServers()) {
      try {
        return parseOverpass(await overpass(server, query), niche as NicheId);
      } catch (err) {
        attempts.push(`${host(server)}: ${reason(err)}`);
      }
    }
    throw new OsmUnavailableError("search", attempts);
  },
};
