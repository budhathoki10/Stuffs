/**
 * Checks every OpenStreetMap service Pitchcraft uses, one at a time, and prints what each
 * answered. Run it from the machine that has the problem (your laptop or your server):
 *
 *   npm run check:osm -- "Kathmandu, Nepal" dentist 5
 */
import {
  buildOverpassQuery,
  contactEmail,
  osmProvider,
  overpassFailure,
  overpassServers,
} from "../src/lib/leads/osm";
import { isNiche, NICHES } from "../src/lib/leads/niches";

const [location = "Kathmandu, Nepal", nicheArg = "dentist", radiusArg = "5"] =
  process.argv.slice(2);
const niche = isNiche(nicheArg) ? nicheArg : "dentist";
const radiusKm = Number(radiusArg) || 5;
const contact = contactEmail();
const ua = `Pitchcraft/1.0${contact ? ` (${contact})` : ""}`;
const ok = (s: string) => console.log(`  OK    ${s}`);
const bad = (s: string) => console.log(`  FAIL  ${s}`);

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const value = await fn();
  return [value, Date.now() - start];
}

async function main() {
  console.log(
    `\nContact email sent to OpenStreetMap: ${contact ?? "none. Set OSM_CONTACT_EMAIL to your real address; Nominatim blocks requests without one."}`,
  );

  console.log(`\n1. Finding "${location}"`);
  let point: { lat: number; lon: number } | null = null;
  for (const [name, url] of [
    [
      "Nominatim",
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(location)}`,
    ],
    [
      "Photon",
      `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(location)}`,
    ],
  ] as const) {
    try {
      const [res, ms] = await timed(() =>
        fetch(url, {
          headers: { "user-agent": ua },
          signal: AbortSignal.timeout(10_000),
        }),
      );
      const body = await res.text();
      if (res.ok) ok(`${name}: HTTP ${res.status} in ${ms} ms`);
      else
        bad(
          `${name}: HTTP ${res.status} in ${ms} ms: ${body.slice(0, 120).replace(/\s+/g, " ")}`,
        );
    } catch (err) {
      bad(`${name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  try {
    point = await osmProvider.geocode(location);
    if (point) ok(`Using ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`);
    else bad("No place found with that name. Try adding the country.");
  } catch (err) {
    bad(err instanceof Error ? err.message : String(err));
  }

  if (point) {
    console.log(
      `\n2. Searching for ${NICHES[niche].label.toLowerCase()} within ${radiusKm} km`,
    );
    const query = buildOverpassQuery(niche, point.lat, point.lon, radiusKm);
    for (const server of overpassServers()) {
      try {
        const [res, ms] = await timed(() =>
          fetch(server, {
            method: "POST",
            headers: {
              "user-agent": ua,
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ data: query }),
            signal: AbortSignal.timeout(35_000),
          }),
        );
        const text = await res.text();
        let data: { elements?: unknown[]; remark?: string } = {};
        try {
          data = JSON.parse(text);
        } catch {
          // reported below
        }
        const host = new URL(server).host;
        if (!res.ok)
          bad(
            `${host}: HTTP ${res.status} in ${ms} ms: ${text.slice(0, 120).replace(/\s+/g, " ")}`,
          );
        else if (!Array.isArray(data.elements))
          bad(
            `${host}: answered in ${ms} ms but not with results (server busy?)`,
          );
        else if (overpassFailure(data))
          bad(`${host}: ${overpassFailure(data)}`);
        else ok(`${host}: ${data.elements.length} businesses in ${ms} ms`);
      } catch (err) {
        bad(
          `${new URL(server).host}: ${err instanceof Error && err.name === "TimeoutError" ? "timed out" : err instanceof Error ? err.message : err}`,
        );
      }
    }
    try {
      const businesses = await osmProvider.findBusinesses({
        niche,
        lat: point.lat,
        lon: point.lon,
        radiusKm,
      });
      const withSite = businesses.filter((b) => b.website).length;
      ok(
        `Pitchcraft would get ${businesses.length} businesses (${withSite} with a website).`,
      );
      for (const b of businesses.slice(0, 5))
        console.log(
          `        ${b.name}${b.website ? ` · ${b.website}` : " · no website"}`,
        );
    } catch (err) {
      bad(err instanceof Error ? err.message : String(err));
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
