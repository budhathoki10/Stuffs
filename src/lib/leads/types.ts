export type Business = {
  source: "osm" | "mock" | "google";
  sourceId: string;
  name: string;
  category: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  lat: number | null;
  lon: number | null;
};

export type GeoPoint = { lat: number; lon: number; label: string };

export type FindParams = {
  niche: string;
  lat: number;
  lon: number;
  radiusKm: number;
  /**
   * Providers that charge per request (Google) stop paging once they have this many
   * businesses the user hasn't seen. Free providers may ignore both hints.
   */
  want?: number;
  isKnown?: (sourceId: string) => boolean;
};

export interface LeadProvider {
  geocode(location: string): Promise<GeoPoint | null>;
  findBusinesses(params: FindParams): Promise<Business[]>;
}
