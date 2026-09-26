"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useLocations } from "@/components/providers/LocationsProvider";
import { InfoHint } from "@/components/ui/Controls";
import { InlineSpinner } from "@/components/ui/States";
import { coordinateLabel, placeSubtitle, type Place } from "@/lib/place";
import { relativeFromNow } from "@/lib/time";

export function PlaceHeader({
  place,
  timeZoneLabel,
  isDay,
  refreshing,
  lastUpdated,
  stale,
  variant = "bar",
}: {
  place: Place;
  timeZoneLabel: string | null;
  isDay: boolean | null;
  refreshing: boolean;
  lastUpdated: number | null;
  stale: boolean;
  variant?: "bar" | "hero";
}) {
  const { locationError, clearLocationError } = useLocations();
  const hero = variant === "hero";

  return (
    <header className="flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1
            className={
              hero
                ? "text-[30px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-[40px]"
                : "truncate text-2xl font-semibold tracking-tight text-ink sm:text-[28px]"
            }
          >
            {place.name}
          </h1>
          {isDay !== null && !hero ? (
            <span className="muted-dim rounded-full border border-line px-2 py-[2px] text-[10px] font-semibold tracking-[0.12em] uppercase">
              {isDay ? "Day" : "Night"}
            </span>
          ) : null}
        </div>
        <p className={`muted mt-1.5 truncate ${hero ? "text-xs" : "text-xs"}`}>
          {[placeSubtitle(place), timeZoneLabel].filter(Boolean).join(" · ") || coordinateLabel(place)}
        </p>
      </div>

      <div className="muted flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
        <span className="tnum inline-flex items-center gap-1.5">
          {coordinateLabel(place)}
          <InfoHint label="About coordinates">
            Coordinates come from the Open-Meteo geocoding database for searched places, or from the browser Geolocation API for
            “My location”. Every reading on this dashboard is fetched for exactly these coordinates.
          </InfoHint>
        </span>
        <span aria-hidden className="hidden h-3 w-px bg-white/12 sm:block" />
        <span className="tnum">
          {refreshing ? (
            <span className="inline-flex items-center gap-1.5 text-cyan">
              <InlineSpinner /> Fetching latest
            </span>
          ) : lastUpdated ? (
            `Data updated ${relativeFromNow(lastUpdated)}`
          ) : (
            "Awaiting first response"
          )}
        </span>
        {stale ? (
          <span className="rounded-full border border-amber/35 bg-amber/10 px-2 py-[2px] font-semibold text-amber">
            Older than expected — refresh for the latest
          </span>
        ) : null}
      </div>

      <AnimatePresence>
        {locationError ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/[0.08] px-3 py-2 text-xs text-amber">
              <span className="flex-1 leading-relaxed">{locationError}</span>
              <button
                type="button"
                aria-label="Dismiss location message"
                onClick={clearLocationError}
                className="focus-ring rounded-full p-0.5 transition hover:text-ink"
              >
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
