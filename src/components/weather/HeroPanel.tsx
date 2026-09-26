"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { useUnits } from "@/components/providers/UnitsProvider";
import { PlaceHeader } from "@/components/shell/PlaceHeader";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { WeatherStage, stageSky } from "@/components/weather/WeatherStage";
import { useDocumentVisible, useNetworkOnline } from "@/lib/appearance";
import { currentHourIndex, precipitationType } from "@/lib/forecast";
import { clockLabel, hourLabel, isSameZoneDay, relativeFromNow, zoneAbbreviation } from "@/lib/time";
import { beaufort, compassPoint, formatNumber, humidityBand, uvBand } from "@/lib/units";
import { conditionLabel, iconVariant, sceneVariant, weatherIntensity } from "@/lib/wmo";

function useSlowNow(intervalMs: number): number {
  const visible = useDocumentVisible();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [visible, intervalMs]);
  return now;
}

function useLiveClock(timeZone: string | null, hour12: boolean) {
  const visible = useDocumentVisible();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [visible]);
  return { now, label: clockLabel(now, timeZone ?? undefined, hour12), zone: zoneAbbreviation(now, timeZone ?? undefined) };
}

function LiveChip({
  online,
  stale,
  refreshing,
  lastUpdated,
}: {
  online: boolean;
  stale: boolean;
  refreshing: boolean;
  lastUpdated: number | null;
}) {
  const label = !online ? "Offline" : refreshing ? "Updating" : stale ? "Delayed" : "Live";
  const delayed = !online || stale;
  const explanation = !online
    ? "Your browser reports no network connection, so this page is showing the last response it received."
    : refreshing
      ? "A fresh request to Open-Meteo is in flight. Values below are from the previous successful response until it returns."
      : stale
        ? "The last successful Open-Meteo response is older than the expected refresh window, so these values may not reflect the most recent model hour."
        : `Current conditions come from the Open-Meteo forecast endpoint's current-hour values, refetched every 15 minutes. Last successful response ${relativeFromNow(lastUpdated)}. These are modelled grid values for these coordinates, not a station observation.`;
  return (
    <span
      title={explanation}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-[5px] text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur-md ${
        delayed ? "border-amber/40 bg-amber/10 text-amber" : "border-mint/40 bg-mint/10 text-mint"
      }`}
    >
      <span className="live-dot" data-tone={delayed ? "delayed" : undefined} />
      {label}
      <span className="sr-only">{explanation}</span>
    </span>
  );
}

function StripStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-[128px] flex-1">
      <p className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">{label}</p>
      <p className="tnum mt-1 text-[15px] leading-tight font-semibold text-ink">{value}</p>
      {hint ? <p className="muted-dim mt-0.5 truncate text-[10px]">{hint}</p> : null}
    </div>
  );
}

export function HeroPanel() {
  const { place, current, weather, hours, days, timeZone, refreshing } = useDashboard();
  const { units, convert, symbol } = useUnits();
  const reduced = useReducedMotion();
  const online = useNetworkOnline();
  const now = useSlowNow(30000);
  const heroRef = useRef<HTMLElement | null>(null);

  if (!place || !current) return null;

  const zone = timeZone ?? undefined;
  const scene = sceneVariant(current.weatherCode, current.isDay);
  const intensity = Math.min(1, weatherIntensity(current.weatherCode) / 3);
  const today = days.find((day) => day.epoch !== null && isSameZoneDay(day.epoch, now, zone)) ?? days[0] ?? null;
  const sunProgress =
    today?.sunrise && today?.sunset && today.sunset > today.sunrise
      ? Math.max(0, Math.min(1, (now - today.sunrise) / (today.sunset - today.sunrise)))
      : null;

  const hourStart = currentHourIndex(hours, now);
  const next3h = hours.slice(hourStart, hourStart + 3);
  const next3Precip = next3h.reduce((total, hour) => total + (hour.precipitation ?? 0), 0);
  const next3Snow = next3h.reduce((total, hour) => total + (hour.snowfall ?? 0), 0);
  const next3Showers = next3h.reduce((total, hour) => total + (hour.showers ?? 0), 0);
  const next3Rain = next3h.reduce((total, hour) => total + (hour.rain ?? 0), 0);
  const next3Peak = next3h.length ? Math.max(...next3h.map((hour) => hour.precipProbability ?? 0)) : null;

  const temp = convert.temp(current.temperature);
  const feels = convert.temp(current.apparent);
  const high = today ? convert.temp(today.tempMax) : null;
  const low = today ? convert.temp(today.tempMin) : null;
  const wind = beaufort(current.windSpeed);
  const uv = uvBand(current.uvIndex);

  const skyNote = [
    humidityBand(current.humidity),
    current.cloudCover !== null
      ? current.cloudCover > 80
        ? "sky almost fully covered by modelled cloud"
        : current.cloudCover > 40
          ? "broken cloud across the modelled sky"
          : current.cloudCover > 10
            ? "scattered cloud in the modelled sky"
            : "sky modelled as essentially clear"
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const daylightRemaining =
    today?.sunset && today.sunset > now
      ? (() => {
          const minutes = Math.round((today.sunset - now) / 60000);
          return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
        })()
      : null;

  return (
    <section
      ref={heroRef}
      onPointerMove={(event) => {
        if (reduced) return;
        const node = heroRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        node.style.setProperty("--mx", `${(x * 100).toFixed(2)}%`);
        node.style.setProperty("--my", `${(y * 100).toFixed(2)}%`);
        node.style.setProperty("--px", `${((x - 0.5) * 2).toFixed(3)}`);
        node.style.setProperty("--py", `${((y - 0.5) * 2).toFixed(3)}`);
      }}
      className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden"
    >
      <div aria-hidden className="absolute inset-0">
        <AnimatePresence initial={false}>
          <motion.div
            key={scene}
            className="absolute inset-0"
            style={{ background: stageSky(scene) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </AnimatePresence>
      </div>

      <div
        aria-hidden
        className="absolute inset-0"
        style={{ transform: "translate3d(calc(var(--px, 0) * 10px), calc(var(--py, 0) * 8px), 0)" }}
      >
        <WeatherStage
          scene={scene}
          cloudCover={current.cloudCover}
          windSpeed={current.windSpeed}
          windDirection={current.windDirection}
          intensity={intensity}
          daylightProgress={sunProgress}
        />
      </div>

      <div aria-hidden className="haze z-[2]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background:
            "radial-gradient(760px circle at var(--mx, 50%) var(--my, 32%), rgba(255,255,255,0.1), transparent 62%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 z-[3]"
        style={{
          background:
            "linear-gradient(180deg, rgba(3,4,6,0.68) 0%, rgba(3,4,6,0.04) 22%, rgba(3,4,6,0.32) 58%, rgba(3,4,6,0.9) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1340px] flex-1 flex-col justify-center gap-7 px-4 pt-[96px] pb-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_236px] lg:items-end lg:gap-12 lg:pt-[132px] lg:pr-8 lg:pl-[124px]">
        <div className="flex min-w-0 flex-col gap-6">
          <PlaceHeader
            variant="hero"
            place={place}
            timeZoneLabel={weather.data?.timezone_abbreviation ?? weather.data?.timezone ?? null}
            isDay={current.isDay}
            refreshing={refreshing}
            lastUpdated={weather.lastUpdated}
            stale={weather.stale}
          />

          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <LiveChip online={online} stale={weather.stale} refreshing={refreshing} lastUpdated={weather.lastUpdated} />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.05] px-2.5 py-[5px] text-[10px] font-semibold tracking-[0.12em] text-ink-soft uppercase backdrop-blur-md">
                {isSameZoneDay(current.epoch ?? now, now, zone) ? "Observed" : "Latest reading"}
                <span className="tnum text-cyan">{hourLabel(current.epoch, zone, units.hour12)}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-5 sm:gap-x-12">
              <p className="flex items-start">
                <span className="tnum text-[76px] leading-[0.8] font-semibold tracking-[-0.05em] text-ink sm:text-[122px] lg:text-[150px]">
                  {formatNumber(temp, 0)}
                </span>
                <span className="mt-2 text-2xl font-medium text-ink-soft sm:mt-4 sm:text-3xl">{symbol.temp}</span>
              </p>
              <div className="flex flex-col gap-2.5">
                <WeatherIcon
                  variant={iconVariant(current.weatherCode, current.isDay)}
                  size={76}
                  animate={!reduced}
                  className="drop-shadow-[0_16px_42px_rgba(0,0,0,0.5)]"
                />
                <p className="text-base font-semibold text-ink sm:text-lg">{conditionLabel(current.weatherCode)}</p>
              </div>
            </div>

            <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-ink-soft">
              Feels like <span className="tnum font-semibold text-ink">{formatNumber(feels, 0)}{symbol.temp}</span>
              {high !== null && low !== null ? (
                <>
                  {" · "}today runs <span className="tnum font-semibold text-ink">{formatNumber(high, 0)}°</span>
                  <span className="muted"> / {formatNumber(low, 0)}°</span>
                </>
              ) : null}
              {current.dewPoint !== null ? ` · dew point ${formatNumber(convert.temp(current.dewPoint), 0)}${symbol.temp}` : ""}
            </p>

            {skyNote ? <p className="muted-dim max-w-[58ch] text-[11px] leading-relaxed lg:hidden">{skyNote}.</p> : null}
          </motion.div>
        </div>

        <div className="hidden flex-col gap-5 lg:flex lg:items-end lg:text-right">
          {sunProgress !== null ? (
            <div className="w-full">
              <p className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Daylight progress</p>
              <p className="tnum mt-1 text-[22px] leading-none font-semibold text-ink">
                {daylightRemaining ? daylightRemaining : "After sunset"}
              </p>
              <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.5),#8ce7f5)]"
                  style={{ width: `${Math.round(sunProgress * 100)}%` }}
                />
              </div>
              {today?.sunrise && today?.sunset ? (
                <p className="tnum muted mt-2 text-[10.5px]">
                  Rise {hourLabel(today.sunrise, zone, units.hour12)} · Set {hourLabel(today.sunset, zone, units.hour12)}
                </p>
              ) : null}
            </div>
          ) : null}
          {skyNote ? <p className="muted max-w-[30ch] text-[11px] leading-relaxed capitalize">{skyNote}.</p> : null}
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1340px] px-4 pb-9 sm:px-6 lg:pr-8 lg:pl-[124px]">
        <div className="dock-shell flex flex-wrap items-stretch gap-x-8 gap-y-5 rounded-[26px] px-5 py-4 sm:px-6">
          <HeroClock timeZone={timeZone} hour12={units.hour12} />
          <StripStat
            label="Wind"
            value={`${formatNumber(convert.wind(current.windSpeed), 0)} ${symbol.wind}`}
            hint={compassPoint(current.windDirection) + (wind ? ` · Beaufort ${wind.force}` : "")}
          />
          <StripStat label="Humidity" value={`${formatNumber(current.humidity, 0)}%`} hint={humidityBand(current.humidity) ?? undefined} />
          <StripStat label="Cloud cover" value={`${formatNumber(current.cloudCover, 0)}%`} />
          <StripStat label="UV index" value={uv ? uv.label : formatNumber(current.uvIndex, 1)} hint={uv ? formatNumber(current.uvIndex, 1) : undefined} />
          <StripStat
            label="Next 3 hours"
            value={
              next3h.length
                ? `${formatNumber(convert.precip(next3Precip), units.precipitation === "in" ? 2 : 1)} ${symbol.precip}`
                : "No hourly series"
            }
            hint={
              next3h.length
                ? next3Precip > 0 || next3Snow > 0
                  ? `${precipitationType(next3h[0]?.weatherCode ?? null, next3Snow, next3Showers, next3Rain)} · peak ${formatNumber(next3Peak, 0)}%`
                  : "No measurable precipitation signalled"
                : undefined
            }
          />
        </div>
      </div>
    </section>
  );
}

function HeroClock({ timeZone, hour12 }: { timeZone: string | null; hour12: boolean }) {
  const { label, zone } = useLiveClock(timeZone, hour12);
  return (
    <div className="min-w-[132px] flex-1">
      <p className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Local time</p>
      <p className="tnum mt-1 text-[22px] leading-none font-semibold text-ink">{label}</p>
      <p className="muted-dim mt-0.5 flex items-center gap-1 text-[10px]">
        <Clock aria-hidden className="h-3 w-3" />
        {zone ? `Wall clock here · ${zone}` : "Wall clock here"}
      </p>
    </div>
  );
}
