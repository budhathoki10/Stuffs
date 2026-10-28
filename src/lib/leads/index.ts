import { mockProvider } from "./mock";
import { osmProvider } from "./osm";
import type { LeadProvider } from "./types";

export function leadProvider(): LeadProvider {
  return process.env.LEADS_PROVIDER === "mock" ? mockProvider : osmProvider;
}

export { NICHES, isNiche, type NicheId } from "./niches";
export type { Business } from "./types";
