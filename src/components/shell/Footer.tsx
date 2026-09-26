"use client";

import { useDashboard } from "@/components/providers/DashboardProvider";

export function AttributionFooter() {
  const { alerts } = useDashboard();
  return (
    <footer className="rule muted-dim mt-2 flex flex-wrap items-center justify-between gap-2 pt-5 text-[10.5px]">
      <span>
        AETHER WEATHER · weather and air quality by Open-Meteo (CC BY 4.0), radar by RainViewer, places and basemaps by
        OpenStreetMap contributors, alerts by their named agencies.
      </span>
      <span className="tnum">
        {alerts.data
          ? `${alerts.data.alerts.length} active alert${alerts.data.alerts.length === 1 ? "" : "s"} matched`
          : "Alerts pending"}
      </span>
    </footer>
  );
}
