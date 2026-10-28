"use client";

import { useActionState, useMemo, useState } from "react";
import { saveSite } from "@/app/actions/work";
import { renderSiteHtml, servicesHeading } from "@/lib/work/site";
import { SITE_ACCENTS, SITE_TEMPLATES, type SiteAccent, type SiteContent, type SiteService, type SiteTemplate } from "@/lib/work/types";
import { Button, Field, FormMessage, inputClass } from "../ui";
import { keepInputOnSubmit } from "../use-keep-input";

type TextKey = "businessName" | "tagline" | "about" | "phone" | "whatsapp" | "email" | "address" | "hours" | "cta";

const ACCENT_NAMES: Record<SiteAccent, string> = { forest: "Forest", ocean: "Ocean", clay: "Clay", plum: "Plum", charcoal: "Charcoal" };

export function SiteEditor({
  leadId,
  siteId,
  initialTemplate,
  initialContent,
  builtBy,
}: {
  leadId: string;
  siteId: string;
  initialTemplate: SiteTemplate;
  initialContent: SiteContent;
  builtBy: { name: string; url?: string | null };
}) {
  const [state, action, pending] = useActionState(saveSite, undefined);
  const [template, setTemplate] = useState(initialTemplate);
  const [content, setContent] = useState(initialContent);
  const [device, setDevice] = useState<"phone" | "desktop">("phone");

  const set = (key: TextKey) => (e: { target: { value: string } }) => setContent((c) => ({ ...c, [key]: e.target.value }));
  const text = (key: TextKey) => ({ name: key, value: content[key], onChange: set(key), className: inputClass });
  const setService = (i: number, patch: Partial<SiteService>) =>
    setContent((c) => ({ ...c, services: c.services.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  // Rendered client-side so the preview follows every keystroke.
  const preview = useMemo(() => renderSiteHtml(content, { template, formAction: "#", builtBy }), [content, template, builtBy]);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,26rem)_1fr]">
      <form onSubmit={keepInputOnSubmit(action)} className="space-y-6">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="accent" value={content.accent} />
        <input type="hidden" name="services" value={JSON.stringify(content.services)} />

        <fieldset className="space-y-4">
          <legend className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Look</legend>
          <Field label="Kind of business">
            <select name="template" value={template} onChange={(e) => setTemplate(e.target.value as SiteTemplate)} className={inputClass}>
              {Object.entries(SITE_TEMPLATES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
            {(Object.keys(SITE_ACCENTS) as SiteAccent[]).map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={content.accent === a}
                aria-label={ACCENT_NAMES[a]}
                title={ACCENT_NAMES[a]}
                onClick={() => setContent((c) => ({ ...c, accent: a }))}
                className={`size-8 rounded-full ring-offset-2 ring-offset-background ${content.accent === a ? "ring-2 ring-ink" : "ring-1 ring-border"}`}
                style={{ background: SITE_ACCENTS[a] }}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Words</legend>
          <Field label="Business name">
            <input {...text("businessName")} required />
          </Field>
          <Field label="Headline" hint="One line under the name. Say what they do and where.">
            <input {...text("tagline")} />
          </Field>
          <Field label="About">
            <textarea {...text("about")} rows={5} />
          </Field>
          <Field label="Main button">
            <input {...text("cta")} />
          </Field>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{servicesHeading(template)}</legend>
          <ol className="space-y-3">
            {content.services.map((s, i) => (
              <li key={i} className="space-y-1.5 rounded-md border border-border bg-surface p-3">
                <div className="flex gap-2">
                  <input
                    value={s.name}
                    onChange={(e) => setService(i, { name: e.target.value })}
                    aria-label={`Item ${i + 1} name`}
                    placeholder="Name"
                    className={`${inputClass} font-medium`}
                  />
                  <input
                    value={s.price ?? ""}
                    onChange={(e) => setService(i, { price: e.target.value || undefined })}
                    aria-label={`Item ${i + 1} price`}
                    placeholder="Price"
                    className={`${inputClass} w-28`}
                  />
                </div>
                <textarea
                  value={s.description}
                  onChange={(e) => setService(i, { description: e.target.value })}
                  aria-label={`Item ${i + 1} description`}
                  placeholder="A sentence about it"
                  rows={2}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setContent((c) => ({ ...c, services: c.services.filter((_, j) => j !== i) }))}
                  className="text-[13px] text-muted hover:text-pen"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          {content.services.length < 12 && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 px-0!"
              onClick={() => setContent((c) => ({ ...c, services: [...c.services, { name: "", description: "" }] }))}
            >
              Add one
            </Button>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Contact</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input {...text("phone")} inputMode="tel" />
            </Field>
            <Field label="WhatsApp" hint="With country code, e.g. +977 98...">
              <input {...text("whatsapp")} inputMode="tel" />
            </Field>
          </div>
          <Field label="Email" hint="Booking requests from the site go here and to you.">
            <input {...text("email")} type="email" />
          </Field>
          <Field label="Address">
            <input {...text("address")} />
          </Field>
          <Field label="Opening hours">
            <textarea {...text("hours")} rows={3} placeholder={"Sun to Fri, 9am to 6pm\nSaturday closed"} />
          </Field>
        </fieldset>

        <div className="sticky bottom-0 -mx-1 space-y-2 bg-background/95 px-1 py-3 backdrop-blur">
          <FormMessage error={state?.error} success={state?.success} />
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Preview</p>
          <div role="group" aria-label="Preview size" className="flex rounded-[5px] border border-border text-[13px]">
            {(["phone", "desktop"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={`px-2.5 py-1 capitalize ${device === d ? "bg-ink text-on-ink" : "text-muted hover:text-foreground"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-strong-border bg-white">
          <iframe
            title="Website preview"
            srcDoc={preview}
            sandbox=""
            className={`mx-auto block h-[640px] border-0 ${device === "phone" ? "w-full max-w-[390px]" : "w-full"}`}
          />
        </div>
      </div>
    </div>
  );
}
