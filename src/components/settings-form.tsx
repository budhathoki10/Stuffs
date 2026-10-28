"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/actions/app";
import { NICHES } from "@/lib/leads/niches";
import { SKILLS } from "@/lib/skills";
import { Button, Field, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export type SettingsDefaults = {
  name: string;
  skill: string;
  portfolioUrl: string;
  niche: string;
  location: string;
  radiusKm: number;
};

export function SettingsForm({ defaults, welcome }: { defaults: SettingsDefaults; welcome: boolean }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-5">
      {welcome && <input type="hidden" name="welcome" value="1" />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name">
          <input name="name" required defaultValue={defaults.name} className={inputClass} />
        </Field>
        <Field label="Portfolio or website" hint="Optional. Added under your name in pitches.">
          <input name="portfolioUrl" defaultValue={defaults.portfolioUrl} placeholder="yourname.com" className={inputClass} />
        </Field>
      </div>
      <Field label="What do you offer?" hint="This decides which businesses we pick for you and how pitches are written.">
        <select name="skill" defaultValue={defaults.skill} className={inputClass}>
          {Object.entries(SKILLS).map(([id, s]) => (
            <option key={id} value={id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Type of business">
          <select name="niche" defaultValue={defaults.niche} required className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {Object.entries(NICHES).map(([id, n]) => (
              <option key={id} value={id}>
                {n.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City" hint="Any city in the world. Tip: target cities where clients pay well.">
          <input name="location" required defaultValue={defaults.location} placeholder="Austin, TX" className={inputClass} />
        </Field>
        <Field label="Distance">
          <select name="radiusKm" defaultValue={String(defaults.radiusKm)} className={inputClass}>
            {[2, 5, 10, 25, 50].map((km) => (
              <option key={km} value={km}>
                Within {km} km
              </option>
            ))}
          </select>
        </Field>
      </div>
      <FormMessage error={state?.error} success={state?.success} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : welcome ? "Save and get my leads" : "Save settings"}
      </Button>
    </form>
  );
}
