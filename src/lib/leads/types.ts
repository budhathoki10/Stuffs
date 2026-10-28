export type Business = {
  source: "osm" | "mock";
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

export interface LeadProvider {
  geocode(location: string): Promise<GeoPoint | null>;
  findBusinesses(params: { niche: string; lat: number; lon: number; radiusKm: number }): Promise<Business[]>;
}
