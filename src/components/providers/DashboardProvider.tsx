"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocations } from "@/components/providers/LocationsProvider";
import { useAsyncData, type AsyncDataState } from "@/hooks/useAsyncData";
import type { AirQualityPayload, AlertsPayload } from "@/lib/api-types";
import type { WeatherPayload } from "@/lib/api-types";
import { buildCurrent, buildDaily, buildHourly, type CurrentSnapshot, type DayPoint, type HourPoint } from "@/lib/forecast";
import type { Place } from "@/lib/place";

export const VIEWS = ["overview", "map", "forecast", "air", "alerts"] as const;
export type ViewId = (typeof VIEWS)[number];

type DashboardContextValue = {
  place: Place | null;
  view: ViewId;
  setView: (view: ViewId) => void;
  weather: AsyncDataState<WeatherPayload>;
  air: AsyncDataState<AirQualityPayload>;
  alerts: AsyncDataState<AlertsPayload>;
  current: CurrentSnapshot | null;
  hours: HourPoint[];
  days: DayPoint[];
  timeZone: string | null;
  refreshAll: () => void;
  refreshing: boolean;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

const WEATHER_INTERVAL = 15 * 60 * 1000;
const AIR_INTERVAL = 30 * 60 * 1000;
const ALERTS_INTERVAL = 5 * 60 * 1000;

function readViewFromHash(): ViewId {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace("#", "");
  return (VIEWS as readonly string[]).includes(hash) ? (hash as ViewId) : "overview";
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { place } = useLocations();
  const [view, setViewState] = useState<ViewId>("overview");

  useEffect(() => {
    setViewState(readViewFromHash());
    const onHashChange = () => setViewState(readViewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setView = useCallback((next: ViewId) => {
    setViewState(next);
    if (typeof window !== "undefined") {
      const target = `#${next}`;
      if (window.location.hash !== target) window.history.replaceState(null, "", target);
    }
  }, []);

  const coordQuery = place ? `lat=${place.latitude}&lon=${place.longitude}` : "";
  const alertQuery = place
    ? `${coordQuery}&radius=400${place.countryCode ? `&country=${encodeURIComponent(place.countryCode)}` : ""}${
        place.name ? `&name=${encodeURIComponent(place.name)}` : ""
      }${place.admin1 ? `&admin1=${encodeURIComponent(place.admin1)}` : ""}${
        place.admin2 ? `&admin2=${encodeURIComponent(place.admin2)}` : ""
      }`
    : "";

  const weather = useAsyncData<WeatherPayload>(place ? `/api/weather?${coordQuery}` : null, {
    intervalMs: WEATHER_INTERVAL,
    staleAfterMs: 25 * 60 * 1000,
  });

  const air = useAsyncData<AirQualityPayload>(place ? `/api/air-quality?${coordQuery}` : null, {
    intervalMs: AIR_INTERVAL,
    staleAfterMs: 60 * 60 * 1000,
  });

  const alerts = useAsyncData<AlertsPayload>(place ? `/api/alerts?${alertQuery}` : null, {
    intervalMs: ALERTS_INTERVAL,
    staleAfterMs: 15 * 60 * 1000,
  });

  const current = useMemo(() => (weather.data ? buildCurrent(weather.data) : null), [weather.data]);
  const hours = useMemo(() => (weather.data ? buildHourly(weather.data) : []), [weather.data]);
  const days = useMemo(() => (weather.data ? buildDaily(weather.data) : []), [weather.data]);
  const timeZone = weather.data?.timezone ?? place?.timezone ?? null;

  const refreshAll = useCallback(() => {
    weather.refresh();
    air.refresh();
    alerts.refresh();
  }, [weather, air, alerts]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      place,
      view,
      setView,
      weather,
      air,
      alerts,
      current,
      hours,
      days,
      timeZone,
      refreshAll,
      refreshing: weather.refreshing || air.refreshing || alerts.refreshing,
    }),
    [place, view, setView, weather, air, alerts, current, hours, days, timeZone, refreshAll]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used inside DashboardProvider");
  return context;
}
