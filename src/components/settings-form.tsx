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
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-10">
      {welcome && <input type="hidden" name="welcome" value="1" />}
      <fieldset className="space-y-5">
        <legend className="mb-4 font-serif text-xl font-medium">Who you want to work with</legend>
        <div className="grid gap-5 sm:grid-cols-[1.2fr_1.2fr_0.8fr]">
          <Field label="Type of business">
            <select name="niche" defaultValue={defaults.niche} required className={inputClass}>
              <option value="" disabled>
                Choose one
              </option>
              {Object.entries(NICHES).map(([id, n]) => (
                <option key={id} value={id}>
                  {n.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City">
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
        <p className="text-[13px] text-muted">
          The city doesn&apos;t have to be yours. Businesses in places where web work pays well are worth trying from
          anywhere.
        </p>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-4 font-serif text-xl font-medium">About you</legend>
        <Field label="What kind of work do you do?" hint="Decides which businesses come first and what the emails offer.">
          <select name="skill" defaultValue={defaults.skill} className={`${inputClass} max-w-md`}>
            {Object.entries(SKILLS).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name">
            <input name="name" required defaultValue={defaults.name} className={inputClass} />
          </Field>
          <Field label="Portfolio or website" hint="Optional. Goes under your name in emails.">
            <input name="portfolioUrl" defaultValue={defaults.portfolioUrl} placeholder="yourname.com" className={inputClass} />
          </Field>
        </div>
      </fieldset>

      <div className="space-y-3">
        <FormMessage error={state?.error} success={state?.success} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : welcome ? "Save and find leads" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
