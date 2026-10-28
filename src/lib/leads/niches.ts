/** Business types a freelancer can target, mapped to OpenStreetMap tags. */
export const NICHES = {
  dentist: { label: "Dentists", tags: [["amenity", "dentist"]] },
  clinic: { label: "Clinics & doctors", tags: [["amenity", "clinic"], ["amenity", "doctors"]] },
  vet: { label: "Veterinarians", tags: [["amenity", "veterinary"]] },
  restaurant: { label: "Restaurants", tags: [["amenity", "restaurant"]] },
  cafe: { label: "Cafés", tags: [["amenity", "cafe"]] },
  bakery: { label: "Bakeries", tags: [["shop", "bakery"]] },
  salon: { label: "Hair & beauty salons", tags: [["shop", "hairdresser"], ["shop", "beauty"]] },
  gym: { label: "Gyms & studios", tags: [["leisure", "fitness_centre"]] },
  hotel: { label: "Hotels & guesthouses", tags: [["tourism", "hotel"], ["tourism", "guest_house"]] },
  lawyer: { label: "Lawyers", tags: [["office", "lawyer"]] },
  accountant: { label: "Accountants", tags: [["office", "accountant"]] },
  realestate: { label: "Real estate agents", tags: [["office", "estate_agent"]] },
  plumber: { label: "Plumbers", tags: [["craft", "plumber"]] },
  electrician: { label: "Electricians", tags: [["craft", "electrician"]] },
  carrepair: { label: "Car repair shops", tags: [["shop", "car_repair"]] },
  florist: { label: "Florists", tags: [["shop", "florist"]] },
} as const satisfies Record<string, { label: string; tags: readonly (readonly [string, string])[] }>;

export type NicheId = keyof typeof NICHES;

export function isNiche(value: unknown): value is NicheId {
  return typeof value === "string" && value in NICHES;
}
