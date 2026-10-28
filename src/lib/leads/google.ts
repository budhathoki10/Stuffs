import { NICHES, type NicheId } from "./niches";
import type { Business, FindParams, GeoPoint, LeadProvider } from "./types";

// Places API (New): https://developers.google.com/maps/documentation/places/web-service/text-search
const API = "https://places.googleapis.com/v1";

/** Text Search returns at most 3 pages of 20. Each page is a billed request. */
const MAX_PAGES = 3;
const PAGE_SIZE = 20;

/**
 * Only the fields we use. Website and phone put the request in the Enterprise SKU,
 * so adding fields here changes the price per request.
 */
const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "websiteUri",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "businessStatus",
];

export class GooglePlacesError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
};

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new GooglePlacesError("GOOGLE_MAPS_API_KEY is not set", 0);
  return key;
}

async function call<T>(path: string, init: { method: "GET" | "POST"; fieldMask: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": init.fieldMask,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new GooglePlacesError(`Google Places ${path} failed (${res.status}): ${data.error?.message ?? "unknown error"}`, res.status);
  }
  return data;
}

/** A box around the search centre. Text Search only accepts rectangles as a hard restriction. */
export function boundingBox(lat: number, lon: number, radiusKm: number) {
  const km = Math.min(Math.max(radiusKm, 1), 50);
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const clampLat = (v: number) => Math.min(90, Math.max(-90, v));
  return {
    low: { latitude: clampLat(lat - dLat), longitude: lon - dLon },
    high: { latitude: clampLat(lat + dLat), longitude: lon + dLon },
  };
}

export function toBusiness(place: GooglePlace, category: string): Business {
  return {
    source: "google",
    sourceId: place.id,
    name: place.displayName?.text ?? "Unnamed business",
    category,
    address: place.formattedAddress ?? null,
    website: place.websiteUri ?? null,
    phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
    // Google never returns email addresses; the website audit looks for one instead.
    email: null,
    lat: place.location?.latitude ?? null,
    lon: place.location?.longitude ?? null,
  };
}

export function textSearchBody(niche: NicheId, lat: number, lon: number, radiusKm: number, pageToken?: string) {
  const { type, query } = NICHES[niche].google;
  return {
    textQuery: query,
    includedType: type,
    strictTypeFiltering: true,
    locationRestriction: { rectangle: boundingBox(lat, lon, radiusKm) },
    pageSize: PAGE_SIZE,
    languageCode: "en",
    ...(pageToken ? { pageToken } : {}),
  };
}

/** Current details for one place, used to refresh stored leads within Google's caching limits. */
export async function placeDetails(placeId: string): Promise<GooglePlace | null> {
  try {
    return await call<GooglePlace>(`/places/${encodeURIComponent(placeId)}`, { method: "GET", fieldMask: PLACE_FIELDS.join(",") });
  } catch (err) {
    if (err instanceof GooglePlacesError && err.status === 404) return null;
    throw err;
  }
}

export const googleProvider: LeadProvider = {
  async geocode(location: string): Promise<GeoPoint | null> {
    const data = await call<{ places?: GooglePlace[] }>("/places:searchText", {
      method: "POST",
      fieldMask: "places.location,places.formattedAddress",
      body: { textQuery: location, pageSize: 1, languageCode: "en" },
    });
    const place = data.places?.[0];
    if (!place?.location) return null;
    return { lat: place.location.latitude, lon: place.location.longitude, label: place.formattedAddress ?? location };
  },

  async findBusinesses({ niche, lat, lon, radiusKm, want, isKnown }: FindParams): Promise<Business[]> {
    const id = niche as NicheId;
    const category = NICHES[id].label.replace(/s$/, "");
    const found: Business[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await call<{ places?: GooglePlace[]; nextPageToken?: string }>("/places:searchText", {
        method: "POST",
        fieldMask: [...PLACE_FIELDS.map((f) => `places.${f}`), "nextPageToken"].join(","),
        body: textSearchBody(id, lat, lon, radiusKm, pageToken),
      });
      for (const place of data.places ?? []) {
        if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;
        found.push(toBusiness(place, category));
      }
      // Stop paying for more pages once there are enough businesses the user hasn't seen.
      const fresh = isKnown ? found.filter((b) => !isKnown(b.sourceId)).length : found.length;
      if (!data.nextPageToken || (want !== undefined && fresh >= want)) break;
      pageToken = data.nextPageToken;
    }
    return found;
  },
};
