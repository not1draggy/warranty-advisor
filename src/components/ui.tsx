import type { ReactNode } from "react";
import { BASIS } from "../../shared/format";
import type { Basis } from "../../shared/analysis";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 break-inside-avoid sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

/** A titled block of the report. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="animate-rise">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <p className="text-[0.9375rem] leading-relaxed text-ink/90">{children}</p>;
}

export function Bullets({ items, tone = "neutral" }: { items: string[]; tone?: "good" | "bad" | "neutral" }) {
  const dot =
    tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : "bg-subtle";

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink/90">
          <span aria-hidden="true" className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "good" | "warn" | "bad" | "accent" | "neutral";
  title?: string;
}) {
  const tones = {
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    accent: "bg-accent-soft text-accent",
    neutral: "bg-raised text-muted",
  } as const;

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Labels a claim as a measured fact, a reasoned estimate, or expert judgement. */
export function BasisChip({ basis }: { basis: Basis }) {
  const { label, explanation } = BASIS[basis];
  return (
    <Chip tone={basis === "fact" ? "accent" : "neutral"} title={explanation}>
      {label}
    </Chip>
  );
}

export function Meter({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-raised"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}

/** Two-column split that stacks on narrow screens. */
export function Split({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
