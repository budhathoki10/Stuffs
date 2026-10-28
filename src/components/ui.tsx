import Link from "next/link";
import { cloneElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-on-ink hover:bg-ink-hover disabled:opacity-50",
  secondary: "border border-strong-border bg-surface text-foreground hover:border-ink disabled:opacity-50",
  ghost: "text-muted underline-offset-4 hover:text-foreground hover:underline",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[5px] px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-md border border-border bg-surface p-5 ${className}`}>{children}</div>;
}

/** Small uppercase label used above sections and table columns. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-medium uppercase tracking-[0.08em] text-muted ${className}`}>{children}</p>;
}

const BADGES = {
  neutral: "border-border text-muted",
  good: "border-transparent bg-money-soft text-money",
  warn: "border-strong-border text-foreground",
  bad: "border-transparent bg-pen-soft text-pen",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-[3px] border px-1.5 py-px text-xs font-medium ${BADGES[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Label + control + optional hint. The hint is linked with aria-describedby rather than
 * nested in the label, so screen readers announce "Email", not "Email We'll never share…".
 */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactElement<ControlProps> }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      {cloneElement(children, { id, "aria-describedby": hint ? hintId : undefined })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

type ControlProps = { id?: string; "aria-describedby"?: string };

export const inputClass =
  "w-full rounded-[5px] border border-strong-border px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-ink focus:ring-1 focus:ring-ink";

export function scoreTone(score: number): keyof typeof BADGES {
  return score >= 80 ? "good" : score >= 50 ? "warn" : "bad";
}

/** Website score as a number with a thin 20-step meter. */
export function ScoreMeter({ score }: { score: number }) {
  const filled = Math.round(score / 5);
  const color = score >= 80 ? "bg-money" : score >= 50 ? "bg-ink" : "bg-pen";
  return (
    <div className="w-40" role="img" aria-label={`Website score ${score} out of 100`}>
      <p className="font-mono text-4xl font-medium tabular-nums tracking-tight">
        {score}
        <span className="text-base text-faint">/100</span>
      </p>
      <div className="mt-2 flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-[1px] ${i < filled ? color : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}

export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error)
    return (
      <p role="alert" className="border-l-2 border-pen bg-pen-soft px-3 py-2 text-sm text-pen">
        {error}
      </p>
    );
  if (success)
    return (
      <p role="status" className="border-l-2 border-money bg-money-soft px-3 py-2 text-sm text-money">
        {success}
      </p>
    );
  return null;
}

export function Logo() {
  return (
    <span className="relative inline-block font-serif text-[22px] font-semibold leading-none tracking-tight">
      Pitchcraft
      <svg className="absolute -bottom-1.5 left-[52%] w-[46%]" viewBox="0 0 100 8" aria-hidden="true">
        <path d="M2 5.5c18-3.5 40-4.5 62-3 12 .8 22 1.8 34 .5" fill="none" stroke="var(--pen)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
