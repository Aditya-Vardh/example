"use client";

import { Activity, LayoutDashboard, Map as MapIcon, PanelLeftOpen, ShieldAlert, Wind } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ViewId } from "@/components/providers/DashboardProvider";

export const NAV_ITEMS: Array<{
  id: ViewId;
  label: string;
  short: string;
  hint: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "overview",
    label: "Overview",
    short: "Now",
    hint: "Current conditions and the next 24 hours",
    blurb: "Right now, in depth",
    icon: LayoutDashboard,
  },
  {
    id: "map",
    label: "Live map",
    short: "Map",
    hint: "Radar, layers and sampled weather fields",
    blurb: "Radar and fields",
    icon: MapIcon,
  },
  {
    id: "forecast",
    label: "Forecast",
    short: "Forecast",
    hint: "Hourly charts and the multi-day outlook",
    blurb: "Hourly and daily",
    icon: Activity,
  },
  {
    id: "air",
    label: "Air quality",
    short: "Air",
    hint: "AQI bands and pollutant breakdown",
    blurb: "What you breathe",
    icon: Wind,
  },
  {
    id: "alerts",
    label: "Alerts",
    short: "Alerts",
    hint: "Official warnings and global hazards",
    blurb: "Official warnings",
    icon: ShieldAlert,
  },
];

export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-2.5 ${className}`}>
      <span className="text-[14px] leading-none font-semibold tracking-[0.46em] text-ink">AETHER</span>
      <span className="muted-dim hidden text-[8.5px] leading-none tracking-[0.32em] uppercase sm:inline">
        Weather intelligence
      </span>
    </span>
  );
}

export function SectionDock({ view, onSelect }: { view: ViewId; onSelect: (view: ViewId) => void }) {
  const reduced = useReducedMotion();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timer = useRef<number | null>(null);
  const expanded = pinned || hovered;

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      className="fixed top-1/2 left-4 z-40 hidden -translate-y-1/2 lg:block"
      onMouseEnter={() => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setHovered(true), 420);
      }}
      onMouseLeave={() => {
        if (timer.current) window.clearTimeout(timer.current);
        setHovered(false);
      }}
    >
      <motion.div
        layout={!reduced}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="dock-shell flex flex-col gap-1 overflow-hidden rounded-[26px] p-2"
      >
        <span className="muted-dim flex h-6 items-center justify-center text-[8.5px] font-semibold tracking-[0.3em]">
          {expanded ? "SECTIONS" : "•••"}
        </span>
        {NAV_ITEMS.map((item) => {
          const active = item.id === view;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={`group focus-ring relative flex h-11 items-center rounded-[18px] transition ${
                active ? "text-ink" : "text-mist hover:text-ink"
              }`}
            >
              {active ? (
                reduced ? (
                  <span className="absolute inset-0 rounded-[18px] border border-white/20 bg-[linear-gradient(118deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))] shadow-[0_14px_36px_-16px_rgba(255,255,255,0.5)]" />
                ) : (
                  <motion.span
                    layoutId="dock-active"
                    className="absolute inset-0 rounded-[18px] border border-white/20 bg-[linear-gradient(118deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))] shadow-[0_14px_36px_-16px_rgba(255,255,255,0.5)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )
              ) : (
                <span className="absolute inset-0 rounded-[18px] opacity-0 transition group-hover:bg-white/[0.06] group-hover:opacity-100" />
              )}
              <span className="relative z-10 grid w-11 shrink-0 place-items-center">
                <Icon className={`h-[18px] w-[18px] ${active ? "text-cyan" : ""}`} />
                {active ? (
                  <span className="absolute -left-[3px] h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_12px_rgba(140,231,245,0.9)]" />
                ) : null}
              </span>
              <motion.span
                initial={false}
                animate={{ width: expanded ? 138 : 0, opacity: expanded ? 1 : 0 }}
                transition={{ duration: reduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 overflow-hidden text-left"
              >
                <span className="block text-[12.5px] font-semibold whitespace-nowrap">{item.label}</span>
                <span className="muted-dim block text-[9.5px] whitespace-nowrap">{item.blurb}</span>
              </motion.span>
              <AnimatePresence>
                {!expanded ? (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, delay: 0.12 }}
                    className="dock-shell pointer-events-none absolute top-1/2 left-[calc(100%+14px)] z-50 -translate-y-1/2 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap text-ink opacity-0 transition-opacity delay-100 duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    {item.label}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPinned((value) => !value)}
          aria-expanded={expanded}
          aria-label={pinned ? "Collapse section labels" : "Expand section labels"}
          title={pinned ? "Collapse section labels" : "Expand section labels"}
          className="focus-ring muted-dim hover:text-ink relative flex h-8 items-center rounded-[16px] transition hover:bg-white/[0.06]"
        >
          <span className="grid w-11 shrink-0 place-items-center">
            <PanelLeftOpen
              aria-hidden
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </span>
          <motion.span
            initial={false}
            animate={{ width: expanded ? 138 : 0, opacity: expanded ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden text-left"
          >
            <span className="block text-[10.5px] font-semibold whitespace-nowrap">{pinned ? "Hide labels" : "Pin labels"}</span>
          </motion.span>
        </button>
      </motion.div>
    </div>
  );
}

export function BottomNav({ view, onSelect }: { view: ViewId; onSelect: (view: ViewId) => void }) {
  const reduced = useReducedMotion();
  return (
    <nav
      aria-label="Dashboard sections"
      className="dock-shell fixed inset-x-3 bottom-3 z-50 flex items-stretch rounded-full px-1.5 py-1.5 lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {NAV_ITEMS.map((item) => {
        const active = item.id === view;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            title={item.hint}
            className={`focus-ring relative flex flex-1 flex-col items-center gap-1 rounded-full px-1 py-2 transition ${
              active ? "text-ink" : "text-mist"
            }`}
          >
            {active ? (
              reduced ? (
                <span className="absolute inset-0 rounded-full border border-white/15 bg-white/[0.1]" />
              ) : (
                <motion.span
                  layoutId="nav-bottom"
                  className="absolute inset-0 rounded-full border border-white/15 bg-white/[0.1]"
                  transition={{ type: "spring", stiffness: 440, damping: 34 }}
                />
              )
            ) : null}
            <Icon className={`relative z-10 h-[17px] w-[17px] ${active ? "text-cyan" : ""}`} />
            <span className="relative z-10 text-[9.5px] leading-none font-semibold tracking-[0.04em]">{item.short}</span>
          </button>
        );
      })}
    </nav>
  );
}
