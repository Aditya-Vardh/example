"use client";

import { Crosshair, Loader2, MapPin } from "lucide-react";
import { useState } from "react";
import { useLocations } from "@/components/providers/LocationsProvider";
import { SearchBox } from "@/components/shell/SearchBox";
import { Brand } from "@/components/shell/ShellNav";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { placeFromGeocode, SUGGESTED_CITIES } from "@/lib/place";
import type { GeocodeResult } from "@/lib/schemas";

export function Onboarding() {
  const { selectPlace, savePlace, requestMyLocation, locationStatus, locationError, clearLocationError } = useLocations();
  const [pending, setPending] = useState<string | null>(null);

  const resolveSuggestion = async (name: string) => {
    setPending(name);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(name)}`, { headers: { Accept: "application/json" } });
      const body = (await response.json().catch(() => null)) as { results?: GeocodeResult[] } | null;
      const first = body?.results?.[0];
      if (!first) return;
      const place = placeFromGeocode(first, "suggested");
      savePlace(place);
      selectPlace(place);
    } catch {
      return;
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-1 py-10 sm:py-16">
      <div className="glass w-full rounded-[22px] p-6 sm:p-9">
        <Brand />
        <div className="mt-7 flex items-start gap-4">
          <WeatherIcon variant="partly-day" size={72} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-ink sm:text-3xl">
              Understand the atmosphere
            </h1>
            <p className="muted mt-2 text-sm leading-relaxed">
              AETHER shows live observations, forecasts, air quality, radar and official warnings for a real place. No default city
              is hardcoded — pick anywhere on Earth to begin.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <SearchBox variant="hero" />
        </div>

        <button
          type="button"
          onClick={requestMyLocation}
          disabled={locationStatus === "locating"}
          className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan/40 bg-cyan/12 px-4 py-2.5 text-sm font-semibold text-cyan transition hover:bg-cyan/20 disabled:opacity-60"
        >
          {locationStatus === "locating" ? <Loader2 aria-hidden className="anim-spin h-4 w-4" /> : <Crosshair aria-hidden className="h-4 w-4" />}
          {locationStatus === "locating" ? "Reading device position…" : "Use my current location"}
        </button>
        <p className="muted-dim mt-2 text-center text-[10.5px] leading-relaxed">
          Your browser asks for permission only after you press this button. Coordinates are used to request weather data and are
          never stored on a server.
        </p>

        {locationError ? (
          <button
            type="button"
            onClick={clearLocationError}
            className="focus-ring mt-3 w-full rounded-xl border border-amber/30 bg-amber/[0.08] px-3 py-2 text-left text-xs leading-relaxed text-amber"
          >
            {locationError}
          </button>
        ) : null}

        <div className="mt-7">
          <p className="muted-dim mb-2 text-[10.5px] font-semibold tracking-[0.18em] uppercase">Or start with a city</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_CITIES.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => resolveSuggestion(city)}
                disabled={pending !== null}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-cyan/35 hover:text-cyan disabled:opacity-50"
              >
                {pending === city ? <Loader2 aria-hidden className="anim-spin h-3 w-3" /> : <MapPin aria-hidden className="h-3 w-3" />}
                {city}
              </button>
            ))}
          </div>
          <p className="muted-dim mt-3 text-[10.5px] leading-relaxed">
            Each shortcut resolves live through the Open-Meteo geocoding API, so the coordinates you see afterwards are the real
            database result rather than a value baked into this page.
          </p>
        </div>
      </div>

      <div className="muted-dim mt-6 grid w-full gap-2 text-[10.5px] sm:grid-cols-2">
        <p className="glass-soft rounded-xl px-3 py-2.5">
          Weather, forecast and air quality: Open-Meteo (CC BY 4.0). Radar: RainViewer. Alerts: US NWS, NDMA SACHET and GDACS.
          Place names and reverse geocoding: OpenStreetMap Nominatim. Basemaps: OpenFreeMap, OpenMapTiles and OpenStreetMap
          contributors.
        </p>
        <p className="glass-soft rounded-xl px-3 py-2.5">
          Basemaps and geocoding attribution appear on the map and in each panel, with the exact provider named next to the data it
          produced.
        </p>
      </div>
    </div>
  );
}
