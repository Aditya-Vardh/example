"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Crosshair,
  Layers,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Minus,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  SkipBack,
  SkipForward,
  WifiOff,
  X,
} from "lucide-react";
import type { MapCanvasHandle, MapFocus, MapMarkerSpec, MapViewport } from "@/components/map/MapCanvas";
import { PALETTES, buildGridField, type FieldKey } from "@/components/map/grid";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { useLocations } from "@/components/providers/LocationsProvider";
import { useUnits } from "@/components/providers/UnitsProvider";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Card";
import { InfoHint, LegendBar, OpacitySlider, Segmented, Toggle } from "@/components/ui/Controls";
import { DataStamp, ErrorState, InlineSpinner, Skeleton, SourceNote, UnavailableState } from "@/components/ui/States";
import { HourlyRail } from "@/components/weather/ForecastRail";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { useAsyncData } from "@/hooks/useAsyncData";
import type { GridPayload, RadarPayload, ReversePayload, WeatherPayload } from "@/lib/api-types";
import { useDocumentVisible, useNetworkOnline, usePowerProfile, usePrefersReducedMotion } from "@/lib/appearance";
import { BASEMAP_OPTIONS, type BasemapInfo } from "@/lib/basemaps";
import { buildCurrent, buildDaily, buildHourly, currentHourIndex, type DayPoint } from "@/lib/forecast";
import { coordinateLabel, placeFromCoordinates, placeLabel, type Place } from "@/lib/place";
import { DEFAULT_COLOR_SCHEME, RADAR_COLOR_SCHEMES, buildTileUrl } from "@/lib/radar";
import { clockLabel, hourLabel, zoneAbbreviation } from "@/lib/time";
import { formatNumber } from "@/lib/units";
import { conditionLabel, iconVariant } from "@/lib/wmo";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas").then((module) => module.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center">
      <span className="muted text-[11.5px]">Loading the map renderer…</span>
    </div>
  ),
});

type LayerChoice = "none" | FieldKey;
type PanelId = "layers" | "radar" | "basemap";

const LAYER_OPTIONS: { value: LayerChoice; label: string; title: string }[] = [
  { value: "none", label: "Off", title: "No interpolated field overlay" },
  { value: "temperature", label: "Temp", title: "Interpolated 2 m temperature field" },
  { value: "wind", label: "Wind", title: "Interpolated 10 m wind field" },
  { value: "cloud", label: "Clouds", title: "Interpolated cloud cover field" },
  { value: "precipitation", label: "Rain", title: "Interpolated current precipitation field" },
];

function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function IconButton({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={`focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? "border-white/40 bg-white/12 text-ink"
          : "border-transparent text-muted hover:border-line hover:bg-white/[0.06] hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function PanelHead({
  title,
  icon,
  onClose,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="muted-dim shrink-0">{icon}</span>
      <h2 className="flex-1 text-[11px] font-semibold tracking-[0.28em] text-ink-soft uppercase">{title}</h2>
      {action}
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close the ${title} panel`}
        className="focus-ring muted rounded-lg border border-line p-1 transition hover:text-ink"
      >
        <X aria-hidden className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function BasemapRow({
  label,
  detail,
  active,
  onSelect,
}: {
  label: string;
  detail?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`focus-ring w-full rounded-xl border px-3 py-2 text-left transition ${
        active ? "border-white/40 bg-white/[0.09]" : "border-line bg-white/[0.02] hover:border-line-strong"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="flex-1 text-[11.5px] font-semibold text-ink-soft">{label}</span>
        {active ? <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink" /> : null}
      </span>
      {detail ? <span className="muted-dim mt-0.5 block text-[10px] leading-snug">{detail}</span> : null}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="muted-dim text-[9.5px] font-semibold tracking-[0.12em] uppercase">{label}</span>
      <span className="tnum text-[13px] font-semibold text-ink-soft">{value}</span>
    </span>
  );
}

function isDayFor(epoch: number | null, days: DayPoint[]): boolean {
  if (epoch === null) return true;
  for (const day of days) {
    if (day.epoch === null) continue;
    if (epoch >= day.epoch && epoch < day.epoch + 86400000) {
      if (day.sunrise === null || day.sunset === null) return true;
      return epoch >= day.sunrise && epoch <= day.sunset;
    }
  }
  return true;
}

function coverage(viewport: MapViewport): number {
  const cosine = Math.abs(Math.cos((viewport.lat * Math.PI) / 180));
  const span = Math.max(viewport.latSpan, viewport.lonSpan * cosine) * 1.15;
  return Math.min(60, Math.max(0.5, span));
}

export function MapView() {
  const { place, selectPlace, requestMyLocation, locationError, locationStatus } = useLocations();
  const { timeZone } = useDashboard();
  const { units, convert, symbol } = useUnits();
  const reducedMotion = usePrefersReducedMotion();
  const power = usePowerProfile();
  const visible = useDocumentVisible();
  const online = useNetworkOnline();
  const now = useMinuteNow();

  const [radarOn, setRadarOn] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(0.78);
  const [scheme, setScheme] = useState(DEFAULT_COLOR_SCHEME);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [layer, setLayer] = useState<LayerChoice>("none");
  const [layerOpacity, setLayerOpacity] = useState(0.62);
  const [particles, setParticles] = useState(true);
  const [pinned, setPinned] = useState<{ lat: number; lon: number } | null>(null);
  const [pinResolved, setPinResolved] = useState<Partial<Place> | null>(null);
  const [pinStatus, setPinStatus] = useState<"idle" | "resolving" | "resolved" | "unnamed">("idle");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedHourIso, setSelectedHourIso] = useState<string | null>(null);
  const [basemapId, setBasemapId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapInfo | null>(null);
  const [basemapError, setBasemapError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [gridCenter, setGridCenter] = useState<{ lat: number; lon: number; span: number } | null>(null);
  const [ready, setReady] = useState(false);
  const handleRef = useRef<MapCanvasHandle | null>(null);

  const radar = useAsyncData<RadarPayload>(radarOn ? "/api/radar" : null, {
    intervalMs: 120000,
    staleAfterMs: 6 * 60 * 1000,
  });
  const frames = radar.data?.frames ?? [];
  const activeIndex = frames.length ? Math.min(frameIndex, frames.length - 1) : 0;
  const activeFrame = frames.length ? frames[activeIndex] : null;

  useEffect(() => {
    setFrameIndex(frames.length ? frames.length - 1 : 0);
    setPlaying(false);
  }, [radar.data, frames.length]);

  useEffect(() => {
    if (!playing || frames.length < 2 || !radarOn) return;
    const id = window.setInterval(() => setFrameIndex((index) => (index + 1) % frames.length), 700);
    return () => window.clearInterval(id);
  }, [playing, frames.length, radarOn]);

  useEffect(() => {
    if (!visible || !radarOn) setPlaying(false);
  }, [visible, radarOn]);

  useEffect(() => {
    if (!place) return;
    setFocus({ lat: place.latitude, lon: place.longitude, zoom: 6.5, token: Date.now() });
  }, [place]);

  useEffect(() => {
    if (!pinned) {
      setPinResolved(null);
      setPinStatus("idle");
      setSelectedHourIso(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setPinStatus("resolving");
    setPinResolved(null);
    setSelectedHourIso(null);
    fetch(`/api/geocode?mode=reverse&lat=${pinned.lat.toFixed(4)}&lon=${pinned.lon.toFixed(4)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as ReversePayload;
        if (!body.place) return null;
        const named = typeof body.place.name === "string" && body.place.name.length > 0;
        return { place: body.place, named };
      })
      .then((resolved) => {
        if (cancelled) return;
        setPinResolved(resolved ? resolved.place : null);
        setPinStatus(!resolved ? "unnamed" : resolved.named ? "resolved" : "unnamed");
      })
      .catch(() => {
        if (cancelled) return;
        setPinResolved(null);
        setPinStatus("unnamed");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pinned]);

  const pinUrl = pinned && sheetOpen ? `/api/weather?lat=${pinned.lat.toFixed(4)}&lon=${pinned.lon.toFixed(4)}` : null;
  const pinWeather = useAsyncData<WeatherPayload>(pinUrl, { intervalMs: 15 * 60 * 1000, staleAfterMs: 25 * 60 * 1000 });

  const pinCurrent = useMemo(() => (pinWeather.data ? buildCurrent(pinWeather.data) : null), [pinWeather.data]);
  const pinDays = useMemo(() => (pinWeather.data ? buildDaily(pinWeather.data) : []), [pinWeather.data]);
  const pinHours = useMemo(() => {
    if (!pinWeather.data) return [];
    const all = buildHourly(pinWeather.data, now);
    const start = currentHourIndex(all, now);
    return all.slice(start, start + 24);
  }, [pinWeather.data, now]);
  const pinZone = pinWeather.data?.timezone ?? place?.timezone ?? undefined;
  const selectedHour = pinHours.find((hour) => hour.iso === selectedHourIso) ?? pinHours[0] ?? null;

  const pinPlace = useMemo(
    () => (pinned ? placeFromCoordinates(pinned.lat, pinned.lon, pinResolved ?? undefined, "search") : null),
    [pinned, pinResolved]
  );
  const pinTitle = pinResolved?.name ?? (pinPlace ? coordinateLabel(pinPlace) : "Pinned point");
  const pinSubtitle =
    pinStatus === "resolving"
      ? "Resolving the place name…"
      : [pinResolved?.admin1, pinResolved?.country]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(" · ");

  const tileUrl = useMemo(() => {
    if (!radarOn || !radar.data || !activeFrame) return null;
    return buildTileUrl(radar.data.host, activeFrame, { size: 256, colorScheme: scheme, smooth: true, snow: true });
  }, [radarOn, radar.data, activeFrame, scheme]);

  const radarProp = useMemo(() => (tileUrl ? { url: tileUrl, opacity: radarOpacity } : null), [tileUrl, radarOpacity]);

  const handleViewport = useCallback((next: MapViewport) => {
    setGridCenter((current) => {
      if (!current) return { lat: next.lat, lon: next.lon, span: coverage(next) };
      const drift = Math.max(Math.abs(next.lat - current.lat), Math.abs(next.lon - current.lon));
      const ratio = next.latSpan / Math.max(current.span, 0.05);
      if (drift > next.latSpan * 0.12 || ratio > 1.3 || ratio < 0.75) {
        return { lat: next.lat, lon: next.lon, span: coverage(next) };
      }
      return current;
    });
  }, []);

  const gridUrl =
    layer === "none" || !gridCenter
      ? null
      : `/api/grid?lat=${gridCenter.lat.toFixed(3)}&lon=${gridCenter.lon.toFixed(3)}&span=${gridCenter.span.toFixed(
          3
        )}&nx=6&ny=6`;
  const grid = useAsyncData<GridPayload>(gridUrl, { intervalMs: 5 * 60 * 1000, staleAfterMs: 12 * 60 * 1000 });
  const gridField = useMemo(() => (grid.data ? buildGridField(grid.data) : null), [grid.data]);

  const fieldProp = useMemo(
    () => (layer !== "none" && gridField ? { data: gridField, key: layer, opacity: layerOpacity } : null),
    [layer, gridField, layerOpacity]
  );

  const animatedWind = particles && !reducedMotion && power === "full" && visible;
  const windProp = useMemo(
    () => (layer === "wind" && gridField ? { data: gridField, animated: animatedWind, opacity: 0.85 } : null),
    [layer, gridField, animatedWind]
  );

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = [];
    if (place) {
      list.push({ id: "place", lat: place.latitude, lon: place.longitude, label: placeLabel(place), tone: "place" });
    }
    if (pinned) {
      list.push({
        id: "pin",
        lat: pinned.lat,
        lon: pinned.lon,
        label: `${pinned.lat.toFixed(3)}, ${pinned.lon.toFixed(3)}`,
        tone: "pick",
      });
    }
    return list;
  }, [place, pinned]);

  const mapCenter = useMemo(
    () => ({ lat: place?.latitude ?? 20, lon: place?.longitude ?? 10 }),
    [place?.latitude, place?.longitude]
  );

  const recentre = useCallback(() => {
    if (!place) return;
    setFocus({ lat: place.latitude, lon: place.longitude, zoom: 8, token: Date.now() });
  }, [place]);

  const handlePick = useCallback((lat: number, lon: number) => {
    setPinned({ lat, lon });
    setSheetOpen(true);
  }, []);

  const handleMarkerClick = useCallback(
    (id: string) => {
      if (id === "pin") {
        setSheetOpen(true);
        return;
      }
      if (!place) return;
      setFocus({ lat: place.latitude, lon: place.longitude, zoom: 9, token: Date.now() });
    },
    [place]
  );

  const usePinnedPlace = useCallback(() => {
    if (!pinned) return;
    selectPlace(placeFromCoordinates(pinned.lat, pinned.lon, pinResolved ?? undefined, "search"));
    setPinned(null);
    setSheetOpen(false);
  }, [pinned, pinResolved, selectPlace]);

  const clearPin = useCallback(() => {
    setPinned(null);
    setSheetOpen(false);
  }, []);

  const legend = useMemo(() => {
    if (layer === "none") return null;
    const palette = PALETTES[layer];
    const span = palette.max - palette.min || 1;
    const stops = palette.stops.map(([value, color]) => {
      const position = Math.round(((value - palette.min) / span) * 100);
      return `rgb(${color[0]} ${color[1]} ${color[2]}) ${position}%`;
    });
    const convertEdge = (value: number): string => {
      if (layer === "temperature") return formatNumber(convert.temp(value), 0);
      if (layer === "wind") return formatNumber(convert.wind(value), 0);
      if (layer === "precipitation") return formatNumber(convert.precip(value), 2);
      return formatNumber(value, 0);
    };
    const title =
      layer === "temperature"
        ? `Temperature (${symbol.temp})`
        : layer === "wind"
          ? `Wind speed (${symbol.wind})`
          : layer === "precipitation"
            ? `Precipitation now (${symbol.precip})`
            : "Cloud cover (%)";
    return { stops, title, minLabel: convertEdge(palette.min), maxLabel: convertEdge(palette.max) };
  }, [layer, convert, symbol]);

  const canAnimateParticles = !reducedMotion && power === "full";
  const togglePanel = (id: PanelId) => setPanel((current) => (current === id ? null : id));
  const radarTime = activeFrame ? hourLabel(activeFrame.epoch * 1000, timeZone ?? undefined, units.hour12) : "—";
  const radarZone = activeFrame ? zoneAbbreviation(activeFrame.epoch * 1000, timeZone ?? undefined) : "";

  return (
    <div className="relative h-full min-h-[400px] w-full overflow-hidden">
      <MapCanvas
        center={mapCenter}
        zoom={place ? 6.5 : 1.6}
        focus={focus}
        radar={radarProp}
        field={fieldProp}
        wind={windProp}
        markers={markers}
        basemapId={basemapId}
        onPick={handlePick}
        onViewport={handleViewport}
        onBasemap={(info, error) => {
          setBasemap(info);
          setBasemapError(error);
        }}
        onReady={(handle) => {
          handleRef.current = handle;
          setReady(true);
        }}
        onMarkerClick={handleMarkerClick}
      />

      <div className="pointer-events-none absolute top-3 left-3 z-30 flex max-w-[calc(100%-11.5rem)] flex-col items-start gap-1.5 lg:top-4 lg:left-4 lg:max-w-[360px]">
        <div className="glass-float pointer-events-auto flex min-w-0 items-center gap-1 rounded-2xl p-1 pr-1.5">
          <button
            type="button"
            onClick={recentre}
            disabled={!place}
            title={place ? `Recentre on ${placeLabel(place)}` : "No location selected"}
            className="focus-ring flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.06] disabled:opacity-55"
          >
            <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-cyan" />
            <span className="min-w-0 truncate text-[11.5px] font-semibold text-ink-soft">
              {place ? place.name : "No location"}
            </span>
            <Crosshair aria-hidden className="h-3 w-3 shrink-0 text-muted-dim" />
          </button>
          <span aria-hidden className="h-6 w-px bg-white/10" />
          <IconButton
            label="Use my location"
            title="Use my location"
            disabled={locationStatus === "locating"}
            onClick={requestMyLocation}
          >
            {locationStatus === "locating" ? <InlineSpinner /> : <LocateFixed aria-hidden className="h-4 w-4" />}
          </IconButton>
        </div>

        {!online ? (
          <span className="glass-soft pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-amber">
            <WifiOff aria-hidden className="h-3 w-3" />
            Offline — showing the last responses
          </span>
        ) : null}
        {basemapError ? (
          <span
            title={basemapError}
            className="glass-soft pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-amber"
          >
            Base tiles unreachable
          </span>
        ) : null}
        {locationError ? (
          <span
            title={locationError}
            className="glass-soft pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-coral"
          >
            Location unavailable
          </span>
        ) : null}
        <span className="glass-soft pointer-events-none hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] text-muted lg:inline-flex">
          <Crosshair aria-hidden className="h-3 w-3 text-cyan" />
          Click the map to pin a point and read its conditions.
        </span>
      </div>

      <div className="glass-float absolute top-3 right-3 z-30 flex items-center gap-1 rounded-2xl p-1 lg:top-4 lg:right-4">
        <IconButton
          label="Layer controls"
          title="Field layers"
          active={panel === "layers"}
          onClick={() => togglePanel("layers")}
        >
          <Layers aria-hidden className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Radar controls"
          title="Precipitation radar"
          active={panel === "radar"}
          onClick={() => togglePanel("radar")}
        >
          <Radar aria-hidden className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Basemap style"
          title="Basemap style"
          active={panel === "basemap"}
          onClick={() => togglePanel("basemap")}
        >
          <MapIcon aria-hidden className="h-4 w-4" />
        </IconButton>
        <span aria-hidden className="hidden h-6 w-px bg-white/10 lg:block" />
        <span className="hidden items-center gap-1 lg:flex">
          <IconButton label="Zoom in" disabled={!ready} onClick={() => handleRef.current?.zoomIn()}>
            <Plus aria-hidden className="h-4 w-4" />
          </IconButton>
          <IconButton label="Zoom out" disabled={!ready} onClick={() => handleRef.current?.zoomOut()}>
            <Minus aria-hidden className="h-4 w-4" />
          </IconButton>
        </span>
      </div>

      <div className="pointer-events-none absolute top-[64px] right-3 z-40 w-[min(340px,calc(100%-1.5rem))] lg:top-[72px] lg:right-4 lg:w-[360px]">
        <AnimatePresence mode="wait" initial={false}>
          {panel ? (
            <motion.div
              key={panel}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="glass-float scroll-thin pointer-events-auto max-h-[min(62vh,540px)] overflow-y-auto rounded-[22px] p-4"
            >
              {panel === "radar" ? (
                <>
                  <PanelHead
                    title="Precipitation radar"
                    icon={<Radar aria-hidden className="h-4 w-4" />}
                    onClose={() => setPanel(null)}
                    action={
                      <InfoHint label="About the radar layer">
                        RainViewer publishes a public radar manifest. Every frame is a tile path from that manifest; nothing
                        is simulated. Recent frames are observed radar composites, later frames are provider nowcasts when
                        available.
                      </InfoHint>
                    }
                  />
                  <Toggle
                    checked={radarOn}
                    onChange={(value) => {
                      setRadarOn(value);
                      if (!value) setPlaying(false);
                    }}
                    label="Radar overlay"
                    hint="Composite precipitation tiles from the RainViewer public manifest."
                  />
                  {radarOn ? (
                    <div className="mt-4">
                      {radar.loading && !radar.data ? (
                        <div className="grid gap-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      ) : radar.error && !radar.data ? (
                        <ErrorState compact message={radar.error} onRetry={radar.refresh} title="Radar unavailable" />
                      ) : radar.data?.unavailable || !frames.length ? (
                        <UnavailableState
                          title="Radar frames unavailable"
                          message="RainViewer did not return any radar frames for this moment. The base map, location search and field layers still work."
                        />
                      ) : (
                        <>
                          <label className="mt-1 block">
                            <span className="muted mb-1 block text-[10.5px] font-semibold tracking-[0.1em] uppercase">
                              Colour scheme
                            </span>
                            <select
                              value={scheme}
                              aria-label="Radar colour scheme"
                              onChange={(event) => setScheme(Number(event.target.value))}
                              className="focus-ring w-full rounded-lg border border-line bg-[#101216] px-2 py-1.5 text-xs text-ink-soft"
                            >
                              {RADAR_COLOR_SCHEMES.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <OpacitySlider value={radarOpacity} onChange={setRadarOpacity} label="Radar opacity" />
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <DataStamp lastUpdated={radar.lastUpdated} stale={radar.stale} refreshing={radar.refreshing} />
                            <Button variant="quiet" title="Request the manifest again" onClick={radar.refresh}>
                              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                              Refresh
                            </Button>
                          </div>
                          <SourceNote>
                            Frames and tile host come from the RainViewer public manifest; times use the selected location&apos;s
                            zone. RainViewer publishes radar tiles up to zoom 7, so closer zooms scale the last available
                            level instead of requesting imagery that does not exist. {radar.data?.attribution}{" "}
                            <a
                              href={radar.data?.termsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan underline decoration-dotted"
                            >
                              RainViewer API terms
                            </a>
                            .
                          </SourceNote>
                        </>
                      )}
                    </div>
                  ) : (
                    <SourceNote>
                      The radar overlay is off. Base tiles, field layers and the pinned-point forecast keep working.
                    </SourceNote>
                  )}
                </>
              ) : null}

              {panel === "layers" ? (
                <>
                  <PanelHead
                    title="Field layers"
                    icon={<Layers aria-hidden className="h-4 w-4" />}
                    onClose={() => setPanel(null)}
                    action={
                      <InfoHint label="About field layers">
                        A 6×6 lattice of real forecast sample points is requested for the current viewport, then bilinearly
                        interpolated into an image. This is an estimate for orientation, not a gridded model field, and it is
                        not radar imagery.
                      </InfoHint>
                    }
                  />
                  <Segmented ariaLabel="Field layer" size="sm" value={layer} options={LAYER_OPTIONS} onChange={setLayer} />
                  {layer === "none" ? (
                    <SourceNote>Pick a field to sample the atmosphere over the visible area.</SourceNote>
                  ) : grid.error && !grid.data ? (
                    <div className="mt-3">
                      <ErrorState compact title="Field data unavailable" message={grid.error} onRetry={grid.refresh} />
                    </div>
                  ) : !grid.data ? (
                    <div className="mt-3 grid gap-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <p className="muted-dim text-[10.5px] leading-relaxed">
                        {gridCenter
                          ? "Sampling real Open-Meteo points across the visible area…"
                          : "Waiting for the map to report its visible area before sampling."}
                      </p>
                    </div>
                  ) : (
                    <>
                      {legend ? (
                        <LegendBar
                          stops={legend.stops}
                          title={legend.title}
                          minLabel={legend.minLabel}
                          maxLabel={legend.maxLabel}
                        />
                      ) : null}
                      <OpacitySlider value={layerOpacity} onChange={setLayerOpacity} label="Layer opacity" />
                      {layer === "wind" ? (
                        <div className="mt-3">
                          <Toggle
                            checked={particles && canAnimateParticles}
                            onChange={setParticles}
                            disabled={!canAnimateParticles}
                            label="Wind particles"
                            hint="Particles drift with the sampled wind vectors. Length and brightness scale with speed."
                            disabledHint={
                              reducedMotion
                                ? "Your device asks for reduced motion, so a static wind field is shown instead."
                                : "Low-power mode is active, so a static wind field is shown instead."
                            }
                          />
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <DataStamp lastUpdated={grid.lastUpdated} stale={grid.stale} refreshing={grid.refreshing} />
                        <Button variant="quiet" title="Sample the visible area again" onClick={grid.refresh}>
                          <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                          Refresh
                        </Button>
                      </div>
                      <SourceNote>{grid.data?.method}</SourceNote>
                      <SourceNote>{grid.data?.attribution}</SourceNote>
                    </>
                  )}
                </>
              ) : null}

              {panel === "basemap" ? (
                <>
                  <PanelHead
                    title="Basemap style"
                    icon={<MapIcon aria-hidden className="h-4 w-4" />}
                    onClose={() => setPanel(null)}
                  />
                  <div className="grid gap-2">
                    <BasemapRow
                      label="Auto"
                      detail="Try each provider in order and use the first that responds."
                      active={basemapId === null}
                      onSelect={() => setBasemapId(null)}
                    />
                    {BASEMAP_OPTIONS.map((option) => (
                      <BasemapRow
                        key={option.id}
                        label={option.label}
                        detail={option.attribution}
                        active={basemapId === option.id}
                        onSelect={() => setBasemapId(option.id)}
                      />
                    ))}
                  </div>
                  {basemapError ? (
                    <p className="mt-3 rounded-xl border border-amber/30 bg-amber/[0.08] px-3 py-2 text-[11px] leading-relaxed text-amber">
                      {basemapError}
                    </p>
                  ) : null}
                  <SourceNote>
                    {basemap
                      ? `Active style: ${basemap.label} — ${basemap.attribution}`
                      : "Vector styles are fetched from the providers above. If a style cannot be reached, the previous one stays on screen."}
                  </SourceNote>
                </>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {!sheetOpen ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-[104px] z-30 lg:inset-x-auto lg:bottom-4 lg:left-1/2 lg:ml-[-236px] lg:w-[472px]">
          {radarOn ? (
            frames.length ? (
              <div className="glass-float pointer-events-auto rounded-[20px] px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPlaying((value) => !value)}
                    aria-label={playing ? "Pause radar playback" : "Play radar playback"}
                    title={playing ? "Pause" : "Play"}
                    className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pearl text-obsidian transition hover:brightness-110"
                  >
                    {playing ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
                  </button>
                  <IconButton
                    label="Previous radar frame"
                    disabled={activeIndex === 0}
                    onClick={() => {
                      setFrameIndex(Math.max(0, activeIndex - 1));
                      setPlaying(false);
                    }}
                  >
                    <SkipBack aria-hidden className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="Next radar frame"
                    disabled={activeIndex >= frames.length - 1}
                    onClick={() => {
                      setFrameIndex(Math.min(frames.length - 1, activeIndex + 1));
                      setPlaying(false);
                    }}
                  >
                    <SkipForward aria-hidden className="h-3.5 w-3.5" />
                  </IconButton>
                  <div className="mx-1 min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink-soft">
                      <span className="tnum">{radarTime}</span>
                      <span className="muted-dim ml-1.5 text-[10px] font-normal">{radarZone}</span>
                    </p>
                    <p className="muted-dim tnum text-[10px]">
                      Frame {activeIndex + 1} of {frames.length}
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex">
                    {activeFrame ? (
                      activeFrame.kind === "nowcast" ? (
                        <Chip tone="iris">Provider nowcast</Chip>
                      ) : (
                        <Chip tone="cyan">Observed</Chip>
                      )
                    ) : null}
                  </span>
                  <span className="hidden sm:block">
                    <Button
                      variant="quiet"
                      title="Jump to the most recent frame"
                      onClick={() => {
                        setFrameIndex(frames.length - 1);
                        setPlaying(false);
                      }}
                    >
                      Latest
                    </Button>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, frames.length - 1)}
                  step={1}
                  value={activeIndex}
                  aria-label="Radar frame"
                  onChange={(event) => {
                    setFrameIndex(Number(event.target.value));
                    setPlaying(false);
                  }}
                  className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/18 accent-[#e9ecf1]"
                />
              </div>
            ) : radar.error && !radar.data ? (
              <div className="glass-float pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-coral">
                <span className="flex-1">Radar frames are unavailable right now.</span>
                <Button variant="quiet" onClick={radar.refresh}>
                  <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            ) : (
              <div className="glass-float pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-muted">
                <InlineSpinner />
                Loading radar frames…
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {legend && !sheetOpen && panel !== "layers" ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden w-[236px] lg:block">
          <div className="glass-float rounded-2xl p-3">
            <LegendBar stops={legend.stops} title={legend.title} minLabel={legend.minLabel} maxLabel={legend.maxLabel} />
            <SourceNote>Sampled at 6×6 real Open-Meteo points over this viewport, then interpolated for display.</SourceNote>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {sheetOpen && pinned ? (
          <motion.section
            key="pin-sheet"
            aria-label="Pinned point forecast"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 22 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="glass-float scroll-thin absolute inset-x-3 bottom-[104px] z-40 max-h-[62vh] overflow-y-auto rounded-[22px] p-4 lg:inset-x-auto lg:bottom-4 lg:left-1/2 lg:ml-[-290px] lg:max-h-[min(560px,72vh)] lg:w-[580px]"
          >
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 lg:hidden" />
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-cyan">
                <MapPin aria-hidden className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-ink">{pinTitle}</h2>
                <p className="muted-dim mt-0.5 text-[10.5px] leading-relaxed">
                  {pinSubtitle ||
                    (pinStatus === "unnamed"
                      ? "OpenStreetMap Nominatim found no place name here, so this point is labelled by its coordinates."
                      : "Pinned map point")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close the pinned point forecast"
                className="focus-ring muted shrink-0 rounded-lg border border-line p-1.5 transition hover:text-ink"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

            {pinWeather.loading && !pinWeather.data ? (
              <div className="mt-4 grid gap-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : pinWeather.error && !pinWeather.data ? (
              <div className="mt-4">
                <ErrorState
                  compact
                  title="Conditions unavailable here"
                  message={pinWeather.error}
                  onRetry={pinWeather.refresh}
                />
              </div>
            ) : pinCurrent ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <WeatherIcon variant={iconVariant(pinCurrent.weatherCode, pinCurrent.isDay)} size={54} />
                  <div className="min-w-0">
                    <p className="tnum text-3xl leading-none font-semibold text-ink">
                      {formatNumber(convert.temp(pinCurrent.temperature), 0)}
                      <span className="text-base font-medium text-ink-soft">{symbol.temp}</span>
                    </p>
                    <p className="muted mt-1.5 text-xs">
                      {conditionLabel(pinCurrent.weatherCode)} · feels like{" "}
                      <span className="tnum">
                        {formatNumber(convert.temp(pinCurrent.apparent), 0)}
                        {symbol.temp}
                      </span>
                    </p>
                  </div>
                  <div className="ml-auto shrink-0 text-right">
                    <p className="muted-dim text-[9.5px] font-semibold tracking-[0.12em] uppercase">Local time</p>
                    <p className="tnum mt-0.5 text-xs font-semibold text-ink-soft">
                      {clockLabel(now, pinZone, units.hour12)}
                    </p>
                  </div>
                </div>

                <HourlyRail
                  className="mt-4"
                  hours={pinHours}
                  timeZone={pinZone}
                  selectedIso={selectedHour?.iso ?? null}
                  onSelect={(hour) => setSelectedHourIso(hour.iso)}
                  isDayAt={(epoch) => isDayFor(epoch, pinDays)}
                  nowIndexIso={pinHours[0]?.iso ?? null}
                />

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="muted-dim text-[10px] font-semibold tracking-[0.12em] uppercase">Selected hour</span>
                  <span className="flex items-center gap-2">
                    <span className="tnum text-[11.5px] font-semibold text-ink-soft">
                      {selectedHour ? hourLabel(selectedHour.epoch, pinZone, units.hour12) : "—"}
                    </span>
                    {selectedHour ? (
                      selectedHour.iso === pinHours[0]?.iso ? (
                        <Chip tone="cyan">Now</Chip>
                      ) : (
                        <Chip tone="iris">Forecast</Chip>
                      )
                    ) : null}
                  </span>
                </div>
                {selectedHour ? (
                  <div className="glass-inset mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5 sm:grid-cols-4">
                    <Stat
                      label="Temp"
                      value={`${formatNumber(convert.temp(selectedHour.temperature), 0)}${symbol.temp}`}
                    />
                    <Stat label="Feels" value={`${formatNumber(convert.temp(selectedHour.apparent), 0)}${symbol.temp}`} />
                    <Stat label="Precip chance" value={`${formatNumber(selectedHour.precipProbability, 0)}%`} />
                    <Stat
                      label="Wind"
                      value={`${formatNumber(convert.wind(selectedHour.windSpeed), 0)} ${symbol.wind}`}
                    />
                  </div>
                ) : null}

                <DataStamp
                  lastUpdated={pinWeather.lastUpdated}
                  stale={pinWeather.stale}
                  refreshing={pinWeather.refreshing}
                />
                <SourceNote>
                  Forecast and observed model hours for this point come from Open-Meteo (CC BY 4.0); the place name comes from
                  OpenStreetMap Nominatim. Hours are shown in the point&apos;s own timezone.
                </SourceNote>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="solid" ariaLabel="Use this location" onClick={usePinnedPlace}>
                    Use this location
                  </Button>
                  <Button variant="ghost" onClick={clearPin}>
                    Clear pin
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-4">
                <UnavailableState
                  title="No conditions returned"
                  message="Open-Meteo returned no current conditions for this point. Try another point on the map."
                />
              </div>
            )}
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
