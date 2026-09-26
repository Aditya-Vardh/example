"use client";

import { motion, useReducedMotion } from "motion/react";

export function Panel({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`relative rounded-[26px] border border-line/60 bg-[linear-gradient(178deg,rgba(255,255,255,0.038),rgba(255,255,255,0.006))] ${
        padded ? "p-5 sm:p-7" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? <span className="muted-dim shrink-0">{icon}</span> : null}
          <h2 className="truncate text-[11px] font-semibold tracking-[0.3em] text-ink-soft uppercase">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {subtitle ? <p className="muted mt-2 max-w-[74ch] text-[11.5px] leading-relaxed">{subtitle}</p> : null}
      <div className="rule mt-4" />
    </div>
  );
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "cyan" | "amber" | "coral" | "mint" | "iris";
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line text-muted",
    cyan: "border-cyan/35 text-cyan bg-cyan/10",
    amber: "border-amber/35 text-amber bg-amber/10",
    coral: "border-coral/35 text-coral bg-coral/10",
    mint: "border-mint/35 text-mint bg-mint/10",
    iris: "border-iris/35 text-iris bg-iris/10",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[10.5px] font-semibold tracking-[0.1em] uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
