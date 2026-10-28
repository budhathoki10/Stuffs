type Niche = {
  label: string;
  /** OpenStreetMap key/value pairs; a business matches if it has any of them. */
  tags: readonly (readonly [string, string])[];
  /** Places API (New) `includedType` plus the words used as the text query. */
  google: { type: string; query: string };
};

/**
 * Business types a freelancer can target, with the OpenStreetMap tags and the
 * Google Places (New) type (Table A) used to find them.
 */
export const NICHES = {
  dentist: { label: "Dentists", tags: [["amenity", "dentist"]], google: { type: "dentist", query: "dentist" } },
  clinic: { label: "Clinics & doctors", tags: [["amenity", "clinic"], ["amenity", "doctors"]], google: { type: "doctor", query: "medical clinic" } },
  vet: { label: "Veterinarians", tags: [["amenity", "veterinary"]], google: { type: "veterinary_care", query: "veterinarian" } },
  restaurant: { label: "Restaurants", tags: [["amenity", "restaurant"]], google: { type: "restaurant", query: "restaurant" } },
  cafe: { label: "Cafés", tags: [["amenity", "cafe"]], google: { type: "cafe", query: "cafe" } },
  bakery: { label: "Bakeries", tags: [["shop", "bakery"]], google: { type: "bakery", query: "bakery" } },
  salon: { label: "Hair & beauty salons", tags: [["shop", "hairdresser"], ["shop", "beauty"]], google: { type: "beauty_salon", query: "beauty salon" } },
  gym: { label: "Gyms & studios", tags: [["leisure", "fitness_centre"]], google: { type: "gym", query: "gym" } },
  hotel: { label: "Hotels & guesthouses", tags: [["tourism", "hotel"], ["tourism", "guest_house"]], google: { type: "lodging", query: "hotel" } },
  lawyer: { label: "Lawyers", tags: [["office", "lawyer"]], google: { type: "lawyer", query: "lawyer" } },
  accountant: { label: "Accountants", tags: [["office", "accountant"]], google: { type: "accounting", query: "accountant" } },
  realestate: { label: "Real estate agents", tags: [["office", "estate_agent"]], google: { type: "real_estate_agency", query: "real estate agency" } },
  plumber: { label: "Plumbers", tags: [["craft", "plumber"]], google: { type: "plumber", query: "plumber" } },
  electrician: { label: "Electricians", tags: [["craft", "electrician"]], google: { type: "electrician", query: "electrician" } },
  carrepair: { label: "Car repair shops", tags: [["shop", "car_repair"]], google: { type: "car_repair", query: "car repair" } },
  florist: { label: "Florists", tags: [["shop", "florist"]], google: { type: "florist", query: "florist" } },
} as const satisfies Record<string, Niche>;

export type NicheId = keyof typeof NICHES;

export function isNiche(value: unknown): value is NicheId {
  return typeof value === "string" && value in NICHES;
}
