"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

export function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="focus-ring muted-dim grid h-4 w-4 place-items-center rounded-full border border-line text-[9px] font-bold transition hover:border-line-strong hover:text-ink-soft"
      >
        i
      </button>
      <AnimatePresence>
        {open ? (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-60 -translate-x-1/2 rounded-xl border border-line-strong bg-[rgba(8,9,12,0.97)] p-3 text-[11px] leading-relaxed font-normal text-ink-soft shadow-[var(--shadow-glow)]"
          >
            {children}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-full border border-line bg-white/[0.03] p-[3px]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title ?? option.label}
            onClick={() => onChange(option.value)}
            className={`focus-ring relative rounded-full font-semibold transition ${
              size === "sm" ? "px-2.5 py-1 text-[10.5px]" : "px-3.5 py-1.5 text-xs"
            } ${active ? "text-obsidian" : "muted hover:text-ink"}`}
          >
            {active ? (
              reduced ? (
                <span className="absolute inset-0 rounded-full bg-pearl" />
              ) : (
                <motion.span
                  layoutId={`seg-${ariaLabel}`}
                  className="absolute inset-0 rounded-full bg-pearl"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
  disabledHint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div className={`flex items-center justify-between gap-3 ${disabled ? "opacity-55" : ""}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-soft">{label}</p>
        <p className="muted-dim mt-0.5 text-[10.5px] leading-snug">{disabled ? (disabledHint ?? hint) : hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`focus-ring relative h-[22px] w-[40px] shrink-0 rounded-full border transition disabled:cursor-not-allowed ${
          checked ? "border-white/40 bg-white/22" : "border-line bg-white/[0.05]"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[16px] w-[16px] rounded-full transition-all ${
            checked ? "left-[21px] bg-pearl" : "left-[2px] bg-[rgba(200,214,235,0.7)]"
          }`}
          style={reduced ? { transition: "none" } : undefined}
        />
      </button>
    </div>
  );
}

export function LegendBar({
  stops,
  minLabel,
  maxLabel,
  title,
}: {
  stops: string[];
  minLabel: string;
  maxLabel: string;
  title: string;
}) {
  return (
    <div className="mt-2">
      <p className="muted-dim mb-1 text-[10px] font-semibold tracking-[0.12em] uppercase">{title}</p>
      <div className="h-2 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(", ")})` }} />
      <div className="muted-dim tnum mt-1 flex justify-between text-[10px]">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export function OpacitySlider({
  value,
  onChange,
  label = "Opacity",
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  return (
    <label className="mt-3 block">
      <span className="muted mb-1 flex items-center justify-between text-[10.5px] font-semibold tracking-[0.1em] uppercase">
        {label}
        <span className="tnum text-ink-soft">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/18 accent-[#e9ecf1]"
      />
    </label>
  );
}
