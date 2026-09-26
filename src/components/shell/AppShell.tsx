"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bookmark, BookmarkCheck, Crosshair, Loader2, Menu, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDashboard, type ViewId } from "@/components/providers/DashboardProvider";
import { useLocations } from "@/components/providers/LocationsProvider";
import { Onboarding } from "@/components/shell/Onboarding";
import { AttributionFooter } from "@/components/shell/Footer";
import { PlaceHeader } from "@/components/shell/PlaceHeader";
import { BottomNav, Brand, NAV_ITEMS, SectionDock } from "@/components/shell/ShellNav";
import { SearchBox } from "@/components/shell/SearchBox";
import { SavedPlaces } from "@/components/shell/SavedPlaces";
import { UnitSettings } from "@/components/shell/UnitSettings";
import { OfflineNotice } from "@/components/ui/States";
import { AlertsView } from "@/components/views/AlertsView";
import { AirQualityView } from "@/components/views/AirQualityView";
import { ForecastView } from "@/components/views/ForecastView";
import { MapView } from "@/components/views/MapView";
import { OverviewView } from "@/components/views/OverviewView";
import { WeatherBackground } from "@/components/weather/WeatherBackground";
import { useNetworkOnline } from "@/lib/appearance";
import { weatherIntensity, sceneVariant } from "@/lib/wmo";

function ViewBody({ view }: { view: ViewId }) {
  switch (view) {
    case "map":
      return <MapView />;
    case "forecast":
      return <ForecastView />;
    case "air":
      return <AirQualityView />;
    case "alerts":
      return <AlertsView />;
    default:
      return <OverviewView />;
  }
}

function TopControls() {
  const { place, refreshAll, refreshing, weather } = useDashboard();
  const { toggleSaved, isSaved, locationStatus, requestMyLocation } = useLocations();
  const saved = place ? isSaved(place.id) : false;
  const locating = locationStatus === "locating";

  return (
    <div className="dock-shell flex items-center gap-0.5 rounded-full p-1">
      <button
        type="button"
        onClick={() => place && toggleSaved(place)}
        disabled={!place}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved locations" : "Save this location"}
        title={saved ? "Remove from saved locations" : "Save this location"}
        className={`focus-ring grid h-9 w-9 place-items-center rounded-full transition disabled:opacity-40 ${
          saved ? "bg-white/[0.12] text-cyan" : "text-ink-soft hover:bg-white/[0.08] hover:text-ink"
        }`}
      >
        {saved ? <BookmarkCheck aria-hidden className="h-4 w-4" /> : <Bookmark aria-hidden className="h-4 w-4" />}
      </button>
      <SavedPlaces compact />
      <UnitSettings compact />
      <button
        type="button"
        onClick={requestMyLocation}
        disabled={locating}
        aria-label="Use my current location"
        title="Use my current location (asks the browser for permission)"
        className="focus-ring text-ink-soft hover:text-ink grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/[0.08] disabled:opacity-50"
      >
        {locating ? <Loader2 aria-hidden className="anim-spin h-4 w-4" /> : <Crosshair aria-hidden className="h-4 w-4" />}
      </button>
      <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
      <button
        type="button"
        onClick={refreshAll}
        disabled={refreshing}
        aria-label="Refresh weather data"
        title="Fetch the latest observation and forecast from Open-Meteo"
        className="focus-ring text-ink-soft hover:text-ink grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/[0.08] disabled:opacity-50"
      >
        {refreshing ? <Loader2 aria-hidden className="anim-spin h-4 w-4" /> : <RefreshCw aria-hidden className="h-4 w-4" />}
      </button>
      {weather.stale ? (
        <span
          title="The last successful response is older than the expected refresh window."
          className="mr-1 ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber shadow-[0_0_10px_rgba(232,197,131,0.9)]"
        />
      ) : null}
    </div>
  );
}

export function AppShell() {
  const { hydrated } = useLocations();
  const { place, view, setView, current, weather, refreshAll, refreshing } = useDashboard();
  const [drawer, setDrawer] = useState(false);
  const reduced = useReducedMotion();
  const online = useNetworkOnline();

  useEffect(() => {
    setDrawer(false);
  }, [view]);

  if (!hydrated) {
    return (
      <div className="relative min-h-dvh">
        <div className="canvas-base" />
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 py-16">
          <div className="glass-float h-52 rounded-[26px] p-6">
            <div className="skeleton h-8 w-44 rounded-lg" />
            <div className="skeleton mt-4 h-4 w-full rounded" />
            <div className="skeleton mt-2 h-4 w-2/3 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const scene = place ? sceneVariant(current?.weatherCode ?? null, current?.isDay ?? true) : "clear-night";
  const intensity = weatherIntensity(current?.weatherCode ?? null);
  const fullBleed = view === "map" && Boolean(place);
  const flush = view === "overview" && Boolean(place);

  return (
    <div className="relative min-h-dvh">
      <div className="canvas-base" />
      <WeatherBackground scene={scene} intensity={intensity} />
      <div className="grain" />

      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 hidden lg:block">
        <div className="pointer-events-auto absolute top-6 left-5">
          <Brand />
        </div>
        {place ? (
          <div className="pointer-events-auto absolute top-3 left-1/2 w-[min(520px,38vw)] -translate-x-1/2">
            <SearchBox variant="capsule" />
          </div>
        ) : null}
        <div className="pointer-events-auto absolute top-4 right-5">
          <TopControls />
        </div>
      </div>

      {place ? <SectionDock view={view} onSelect={setView} /> : null}

      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 lg:hidden">
        <div className="pointer-events-auto m-3 flex items-center gap-3 rounded-full px-3 py-2 dock-shell">
          <button
            type="button"
            aria-label="Open navigation and controls"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
            className="focus-ring text-ink-soft hover:text-ink grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-white/[0.04]"
          >
            <Menu aria-hidden className="h-4 w-4" />
          </button>
          <Brand className="shrink-0" />
          <span className="muted ml-auto min-w-0 truncate text-[11px]">{place?.name ?? "Choose a location"}</span>
        </div>
      </div>

      <AnimatePresence>
        {drawer ? (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
              onClick={() => setDrawer(false)}
            />
            <motion.div
              initial={reduced ? { opacity: 0 } : { x: -320 }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: -320 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="glass-float scroll-thin absolute inset-y-3 left-3 flex w-[300px] flex-col overflow-y-auto rounded-[28px] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <Brand />
                <button
                  type="button"
                  aria-label="Close navigation"
                  onClick={() => setDrawer(false)}
                  className="focus-ring muted hover:text-ink grid h-8 w-8 place-items-center rounded-full border border-line"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5">
                <SearchBox variant="capsule" />
              </div>

              <nav aria-label="Dashboard sections" className="mt-5 flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const active = item.id === view;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setView(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={`focus-ring relative flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        active ? "text-ink" : "text-mist"
                      }`}
                    >
                      {active ? (
                        <motion.span
                          layoutId="drawer-active"
                          className="absolute inset-0 rounded-2xl border border-white/15 bg-[linear-gradient(118deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02))]"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      ) : null}
                      <Icon className={`relative z-10 h-[18px] w-[18px] shrink-0 ${active ? "text-cyan" : ""}`} />
                      <span className="relative z-10 min-w-0">
                        <span className="block text-[13px] font-semibold">{item.label}</span>
                        <span className="muted-dim block truncate text-[10.5px]">{item.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="rule mt-5 space-y-3 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SavedPlaces />
                  <UnitSettings />
                </div>
                <button
                  type="button"
                  onClick={refreshAll}
                  disabled={refreshing}
                  className="focus-ring text-ink-soft flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 py-2.5 text-xs font-semibold disabled:opacity-55"
                >
                  {refreshing ? <Loader2 aria-hidden className="anim-spin h-3.5 w-3.5" /> : <RefreshCw aria-hidden className="h-3.5 w-3.5" />}
                  Refresh all data
                </button>
              </div>

              <p className="muted-dim mt-auto pt-6 text-[10px] leading-relaxed">
                Weather and air quality by Open-Meteo (CC BY 4.0), radar by RainViewer, places and basemaps by OpenStreetMap
                contributors, alerts by their named agencies.
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main
        className={
          fullBleed
            ? "relative z-10 h-dvh w-full"
            : flush
              ? "relative z-10 w-full"
              : "relative z-10 px-4 pt-[84px] pb-28 sm:px-6 lg:pr-8 lg:pb-14 lg:pl-[96px] lg:pt-[104px]"
        }
      >
        {!place ? (
          <Onboarding />
        ) : fullBleed || flush ? (
          <ViewBody view={view} />
        ) : (
          <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-6">
            {!online && weather.data ? <OfflineNotice onRetry={refreshAll} /> : null}
            <PlaceHeader
              place={place}
              timeZoneLabel={weather.data?.timezone_abbreviation ?? weather.data?.timezone ?? null}
              isDay={current ? current.isDay : null}
              refreshing={refreshing}
              lastUpdated={weather.lastUpdated}
              stale={weather.stale}
            />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <ViewBody view={view} />
              </motion.div>
            </AnimatePresence>

            <AttributionFooter />
          </div>
        )}
      </main>
      <BottomNav view={view} onSelect={setView} />
    </div>
  );
}
