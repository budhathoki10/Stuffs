import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong disabled:opacity-60",
  secondary: "border border-border bg-surface text-foreground hover:border-accent disabled:opacity-60",
  ghost: "text-muted hover:text-foreground",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
  return <div className={`rounded-xl border border-border bg-surface p-5 ${className}`}>{children}</div>;
}

const BADGES = {
  neutral: "bg-border/60 text-muted",
  good: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  bad: "bg-danger-soft text-danger",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGES[tone]}`}>{children}</span>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export function scoreTone(score: number): keyof typeof BADGES {
  return score >= 80 ? "good" : score >= 50 ? "warn" : "bad";
}

export function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--accent)" : score >= 50 ? "var(--warn)" : "var(--danger)";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      {/* A zero-length arc with round caps would still draw a dot, so skip it. */}
      {score > 0 && (
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          transform="rotate(-90 50 50)"
        />
      )}
      <text x="50" y="56" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--foreground)">
        {score}
      </text>
    </svg>
  );
}

export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>;
  if (success) return <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{success}</p>;
  return null;
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="var(--accent)" />
        <path d="M7 16.5 12 7l5 9.5h-3.2L12 13l-1.8 3.5z" fill="white" />
      </svg>
      Pitchcraft
    </span>
  );
}
