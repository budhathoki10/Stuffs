import { describe, expect, it } from "vitest";
import { unreachableChecks } from "@/lib/audit/analyze";
import type { AuditCheck } from "@/lib/audit/types";
import { buildPitchPrompt, generatePitch, templatePitch, type PitchInput } from "@/lib/pitch";

const slowCheck: AuditCheck = {
  id: "speed",
  label: "Responds quickly",
  passed: false,
  severity: "major",
  detail: "The server took 4.2s to deliver the page.",
  impact: "Every extra second of loading time noticeably increases the number of visitors who give up.",
};

const base: PitchInput = {
  freelancerName: "Kushal",
  skill: "speed",
  portfolioUrl: "https://kushal.dev",
  businessName: "Riverside Café",
  category: "Café",
  city: "Pokhara",
  website: "https://riverside.example",
  issues: [slowCheck],
  reportUrl: "https://pitchcraft.app/r/abc123",
};

describe("templatePitch", () => {
  it("builds on the top audit issue and signs with the freelancer's name", () => {
    const pitch = templatePitch(base);
    expect(pitch.model).toBe("template");
    expect(pitch.subject).toContain("Riverside Café");
    expect(pitch.body).toContain("4.2s");
    expect(pitch.body).toContain("https://pitchcraft.app/r/abc123");
    expect(pitch.body.trim().endsWith("https://kushal.dev")).toBe(true);
    expect(pitch.body).toContain("Kushal");
  });

  it("pitches a website when the business has none", () => {
    const pitch = templatePitch({ ...base, skill: "web_dev", website: null, issues: unreachableChecks("none", ""), reportUrl: null });
    expect(pitch.subject).toBe("A website for Riverside Café?");
    expect(pitch.body).toContain("doesn't have a website");
    expect(pitch.body).toContain("in Pokhara");
  });
});

describe("buildPitchPrompt", () => {
  it("includes only facts from the audit", () => {
    const prompt = buildPitchPrompt(base);
    expect(prompt).toContain("Riverside Café (Café, Pokhara)");
    expect(prompt).toContain("4.2s");
    expect(prompt).toContain("Free report link: https://pitchcraft.app/r/abc123");
    expect(prompt).toContain("speeding up slow websites");
  });
});

describe("generatePitch", () => {
  it("uses the template when no API key is configured", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect((await generatePitch(base)).model).toBe("template");
    } finally {
      if (saved) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});
