import { NICHES, type NicheId } from "./niches";
import type { Business, LeadProvider } from "./types";

// Fixture websites (see e2e/fixture-sites) let tests and offline development
// exercise the full lead + audit flow without calling OpenStreetMap.
const FIXTURES: { slug: string; name: string; site: "good" | "slow" | "old" | "none" | "down" }[] = [
  { slug: "sunrise", name: "Sunrise", site: "none" },
  { slug: "maple", name: "Maple Street", site: "old" },
  { slug: "riverside", name: "Riverside", site: "slow" },
  { slug: "summit", name: "Summit", site: "good" },
  { slug: "harbor", name: "Harbor", site: "down" },
  { slug: "oak", name: "Oak & Pine", site: "none" },
  { slug: "lotus", name: "Lotus", site: "old" },
  { slug: "cedar", name: "Cedar", site: "none" },
];

export const mockProvider: LeadProvider = {
  async geocode(location) {
    return { lat: 27.7172, lon: 85.324, label: `${location} (mock)` };
  },
  async findBusinesses({ niche, lat, lon }) {
    const base = process.env.MOCK_SITE_BASE ?? "http://127.0.0.1:4100";
    const label = NICHES[niche as NicheId]?.label.replace(/s$/, "") ?? "Business";
    return FIXTURES.map((f, i): Business => ({
      source: "mock",
      sourceId: `${niche}/${f.slug}`,
      name: `${f.name} ${label}`,
      category: label,
      address: `${10 + i} Main Street`,
      website: f.site === "none" ? null : f.site === "down" ? `${base}/missing-page` : `${base}/${f.site}.html`,
      phone: `+1 555 010${i}`,
      email: f.site === "none" ? null : `hello@${f.slug}.test`,
      lat: lat + i * 0.001,
      lon: lon + i * 0.001,
    }));
  },
};
