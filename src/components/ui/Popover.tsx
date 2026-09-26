"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

export function Popover({
  label,
  icon,
  children,
  align = "right",
  width = "w-72",
  tone = "default",
  badge,
  title,
  compact = false,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  width?: string;
  tone?: "default" | "primary" | "active";
  badge?: string | number;
  title?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  const toneClass =
    tone === "primary"
      ? "border-cyan/45 bg-cyan/12 text-cyan hover:bg-cyan/20"
      : tone === "active"
        ? "border-cyan/35 bg-white/[0.06] text-cyan"
        : "border-line bg-white/[0.04] text-ink-soft hover:bg-white/[0.09]";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={title ?? label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`focus-ring relative inline-flex items-center gap-2 border text-xs font-semibold transition ${toneClass} ${
          compact ? "h-9 w-9 justify-center rounded-full" : "rounded-xl px-3 py-2"
        }`}
      >
        {icon}
        <span className={compact ? "sr-only" : "hidden sm:inline"}>{label}</span>
        {badge !== undefined && badge !== 0 ? (
          <span
            className={`tnum absolute grid h-4 min-w-4 place-items-center rounded-full bg-cyan px-1 text-[10px] font-bold text-[#06131a] ${
              compact ? "-top-0.5 -right-0.5" : "-top-1.5 -right-1.5"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label={label}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute top-[calc(100%+8px)] z-50 ${width} ${
              align === "right" ? "right-0" : "left-0"
            } scroll-thin max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-[rgba(9,10,14,0.97)] p-3 shadow-[var(--shadow-panel)] backdrop-blur-xl`}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
