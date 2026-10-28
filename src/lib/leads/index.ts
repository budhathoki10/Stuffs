import { googleProvider } from "./google";
import { mockProvider } from "./mock";
import { osmProvider } from "./osm";
import type { LeadProvider } from "./types";

/**
 * LEADS_PROVIDER picks the source explicitly. Without it, Google is used when a key
 * is configured and OpenStreetMap otherwise.
 */
export function leadProvider(): LeadProvider {
  switch (process.env.LEADS_PROVIDER) {
    case "mock":
      return mockProvider;
    case "osm":
      return osmProvider;
    case "google":
      return googleProvider;
    default:
      return process.env.GOOGLE_MAPS_API_KEY ? googleProvider : osmProvider;
  }
}

export function leadSourceName(): "google" | "osm" | "mock" {
  const p = leadProvider();
  return p === googleProvider ? "google" : p === mockProvider ? "mock" : "osm";
}

export { NICHES, isNiche, type NicheId } from "./niches";
export type { Business } from "./types";
