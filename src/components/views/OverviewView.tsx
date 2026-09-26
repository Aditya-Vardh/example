"use client";

import { useState } from "react";
import {
  ArrowRight,
  Cloud,
  CloudRain,
  Compass,
  Droplets,
  Eye,
  Gauge,
  Sun,
  Thermometer,
} from "lucide-react";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { useUnits } from "@/components/providers/UnitsProvider";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Card";
import { ErrorState, OfflineNotice, Skeleton, SourceNote } from "@/components/ui/States";
import { AttributionFooter } from "@/components/shell/Footer";
import { DailyRail, HourlyRail } from "@/components/weather/ForecastRail";
import { HeroPanel } from "@/components/weather/HeroPanel";
import { MetricTile, SunArc, WindCompass } from "@/components/weather/Metrics";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { aqiBand, aqiProgress } from "@/lib/aqi";
import { currentHourIndex, peakIndex, precipitationType } from "@/lib/forecast";
import { dateLabel, dayLabel, durationLabel, hourLabel, isSameZoneDay } from "@/lib/time";
import { beaufort, compassPoint, formatNumber, humidityBand, uvBand, visibilityBand } from "@/lib/units";
import { conditionLabel, iconVariant } from "@/lib/wmo";
import { useNetworkOnline } from "@/lib/appearance";

const TONE_COLORS: Record<string, string> = {
  emerald: "#97dfbd",
  amber: "#e8c583",
  orange: "#eda27b",
  rose: "#f0958f",
  violet: "#b3b8c4",
};

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="muted-dim truncate text-[9.5px] font-semibold tracking-[0.18em] uppercase">{label}</dt>
      <dd className="tnum mt-1 truncate text-[14px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function SectionHeading({
  index,
  title,
  subtitle,
  action,
}: {
  index: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-[70ch]">
        <p className="muted-dim flex items-center gap-2 text-[9.5px] font-semibold tracking-[0.3em] uppercase">
          <span className="tnum">{index}</span>
          <span aria-hidden className="h-px w-8 bg-white/20" />
          <span>{title}</span>
        </p>
        {subtitle ? <p className="muted mt-2 text-xs leading-relaxed">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function OverviewView() {
  const { weather, air, alerts, current, hours, days, timeZone, place, setView } = useDashboard();
  const { units, convert, symbol } = useUnits();
  const online = useNetworkOnline();
  const [selectedHourIso, setSelectedHourIso] = useState<string | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);

  if (weather.loading && !weather.data) {
    return (
      <div className="flex min-h-[80svh] flex-col justify-end gap-5 px-4 pb-12 sm:px-6 lg:pl-[124px]">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-20 w-full max-w-3xl rounded-[24px]" />
      </div>
    );
  }

  if (weather.error && !weather.data) {
    return (
      <div className="px-4 py-24 sm:px-6 lg:pl-[124px]">
        <ErrorState title="Weather data unavailable" message={weather.error} onRetry={weather.refresh} />
      </div>
    );
  }

  if (!current || !place) {
    return (
      <div className="px-4 py-24 sm:px-6 lg:pl-[124px]">
        <ErrorState
          title="No observation returned"
          message="Open-Meteo responded without a current observation for these coordinates. Try refreshing or selecting a nearby place."
          onRetry={weather.refresh}
        />
      </div>
    );
  }

  const now = Date.now();
  const zone = timeZone ?? undefined;
  const today = days.find((day) => day.epoch !== null && isSameZoneDay(day.epoch, now, zone)) ?? days[0] ?? null;
  const hourStart = currentHourIndex(hours, now);
  const next24 = hours.slice(hourStart, hourStart + 24);
  const week = days.slice(0, 7);
  const uv = uvBand(current.uvIndex);
  const wind = beaufort(current.windSpeed);
  const visibility = current.visibility !== null ? convert.distance(current.visibility / 1000) : null;
  const peakUvDay = days.length ? days[peakIndex(days.map((day) => day.uvMax ?? null)) ?? 0] : null;

  const sunProgress =
    today?.sunrise && today?.sunset && today.sunset > today.sunrise
      ? Math.max(0, Math.min(1, (now - today.sunrise) / (today.sunset - today.sunrise)))
      : null;

  const airCurrent = air.data?.current ?? null;
  const airBands = aqiBand(airCurrent?.european_aqi ?? null, "european");
  const airProgress = airCurrent?.european_aqi != null ? aqiProgress(airCurrent.european_aqi, "european") : null;

  const selectedHour = next24.find((hour) => hour.iso === selectedHourIso) ?? next24[0] ?? null;
  const selectedDay = week.find((day) => day.iso === selectedDayIso) ?? week[0] ?? null;

  let weekMin = Infinity;
  let weekMax = -Infinity;
  for (const day of week) {
    const low = convert.temp(day.tempMin);
    const high = convert.temp(day.tempMax);
    if (low !== null) weekMin = Math.min(weekMin, low);
    if (high !== null) weekMax = Math.max(weekMax, high);
  }
  const weekBounds =
    Number.isFinite(weekMin) && Number.isFinite(weekMax) && weekMax > weekMin ? { min: weekMin, max: weekMax } : null;

  return (
    <div className="flex flex-col">
      <HeroPanel />

      <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-16 px-4 pt-14 pb-28 sm:px-6 lg:pr-8 lg:pb-16 lg:pl-[124px]">
        {!online && weather.data ? <OfflineNotice onRetry={weather.refresh} /> : null}

        <section aria-labelledby="overview-readings">
          <SectionHeading
            index="01"
            title="Readings"
            subtitle="Every value is the current reading from the Open-Meteo forecast endpoint for these exact coordinates, converted to your selected units."
          />
          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)]">
            <div id="overview-readings" className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
              <MetricTile
                label="Humidity"
                icon={<Droplets className="h-3.5 w-3.5" />}
                value={formatNumber(current.humidity, 0)}
                unit="%"
                detail={humidityBand(current.humidity) ?? undefined}
                info="Relative humidity of the air at 2 metres above ground from the current observation."
              />
              <MetricTile
                label="Pressure"
                icon={<Gauge className="h-3.5 w-3.5" />}
                value={formatNumber(convert.pressure(current.pressure), units.pressure === "inhg" ? 2 : 0)}
                unit={symbol.pressure}
                detail={
                  current.surfacePressure !== null
                    ? `Surface ${formatNumber(convert.pressure(current.surfacePressure), units.pressure === "inhg" ? 2 : 0)} ${symbol.pressure}`
                    : undefined
                }
                info="Mean sea level pressure is used for comparison between locations; surface pressure is the actual pressure at this elevation."
              />
              <MetricTile
                label="Cloud cover"
                icon={<Cloud className="h-3.5 w-3.5" />}
                value={formatNumber(current.cloudCover, 0)}
                unit="%"
                detail={
                  current.cloudCover !== null
                    ? current.cloudCover > 80
                      ? "Overcast"
                      : current.cloudCover > 40
                        ? "Broken cloud"
                        : current.cloudCover > 10
                          ? "Scattered"
                          : "Mostly clear"
                    : undefined
                }
                info="Total cloud cover fraction in the current hour."
              />
              <MetricTile
                label="UV index"
                icon={<Sun className="h-3.5 w-3.5" />}
                value={formatNumber(current.uvIndex, 1)}
                detail={uv ? `${uv.label} exposure band` : "Not reported for this hour"}
                accent={uv ? TONE_COLORS[uv.tone] : undefined}
                info="UV index comes from the same Open-Meteo hourly model that drives the forecast charts; it is reported as-is with no interpolation."
              />
              <MetricTile
                label="Precipitation"
                icon={<CloudRain className="h-3.5 w-3.5" />}
                value={formatNumber(convert.precip(current.precipitation), units.precipitation === "in" ? 2 : 1)}
                unit={symbol.precip}
                detail={`${precipitationType(current.weatherCode, current.snowfall, current.showers, current.rain)} in the current hour`}
                info="Total precipitation (rain, showers and snowfall water equivalent) for the current hour."
              />
              <MetricTile
                label="Visibility"
                icon={<Eye className="h-3.5 w-3.5" />}
                value={formatNumber(visibility, units.distance === "mi" ? 1 : 0)}
                unit={symbol.distance}
                detail={visibilityBand(current.visibility === null ? null : current.visibility / 1000) ?? "Not reported"}
                info="Visibility at ground level as modelled for this hour."
              />
              <MetricTile
                label="Dew point"
                icon={<Thermometer className="h-3.5 w-3.5" />}
                value={formatNumber(convert.temp(current.dewPoint), 0)}
                unit={symbol.temp}
                detail={
                  current.dewPoint !== null
                    ? current.dewPoint >= 20
                      ? "Muggy air"
                      : current.dewPoint >= 12
                        ? "Comfortable moisture"
                        : "Dry air"
                    : undefined
                }
                info="The temperature at which air would saturate. Values above roughly 20 °C feel humid."
              />
              <MetricTile
                label="Wind character"
                icon={<Compass className="h-3.5 w-3.5" />}
                value={wind ? String(wind.force) : "—"}
                unit="Bft"
                detail={wind ? `${wind.label} on the Beaufort scale` : undefined}
                info="The Beaufort force is derived from the measured wind speed, which stays in km/h from Open-Meteo and is converted for display only."
              />
            </div>

            <Reveal className="lg:pt-1">
              <div className="halo-light rounded-[28px] border border-line/80 bg-[linear-gradient(165deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))] px-5 py-6 backdrop-blur-xl">
                <p className="muted-dim text-[9.5px] font-semibold tracking-[0.3em] uppercase">Wind vector</p>
                <div className="mt-5">
                  <WindCompass
                    direction={current.windDirection}
                    label={compassPoint(current.windDirection)}
                    speedLabel={formatNumber(convert.wind(current.windSpeed), 0)}
                    gustLabel={current.windGust !== null ? formatNumber(convert.wind(current.windGust), 0) : null}
                    unit={symbol.wind}
                  />
                </div>
                <SourceNote>{weather.data?.attribution}</SourceNote>
              </div>
            </Reveal>
          </div>
        </section>

        <section>
          <SectionHeading
            index="02"
            title="Next 24 hours"
            subtitle="Drag the rail sideways, or swipe on touch. The scrubber jumps anywhere in the sequence; selecting a snapshot loads that hour below."
          />
          {next24.length === 0 ? (
            <p className="muted text-xs">The hourly series was not returned for this location.</p>
          ) : (
            <>
              <HourlyRail
                hours={next24}
                timeZone={zone}
                selectedIso={selectedHour?.iso ?? null}
                onSelect={(hour) => setSelectedHourIso(hour.iso)}
                isDayAt={(epoch) => isDayAt(epoch, today)}
                nowIndexIso={hours[hourStart]?.iso ?? null}
              />
              {selectedHour ? (
                <div className="border-line/70 mt-4 flex flex-wrap items-center gap-x-10 gap-y-5 border-t pt-5">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <WeatherIcon
                      variant={iconVariant(selectedHour.weatherCode, isDayAt(selectedHour.epoch, today))}
                      size={44}
                      animate={false}
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">
                        {dateLabel(selectedHour.epoch, zone)} · {hourLabel(selectedHour.epoch, zone, units.hour12)}
                      </p>
                      <p className="muted mt-0.5 text-[11px]">
                        {conditionLabel(selectedHour.weatherCode)}
                        <span className={selectedHour.isForecast ? "text-cyan" : "text-mint"}>
                          {` · ${selectedHour.isForecast ? "forecast hour" : "observed window"}`}
                        </span>
                      </p>
                    </div>
                  </div>
                  <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
                    <DetailStat label="Temperature" value={`${formatNumber(convert.temp(selectedHour.temperature), 0)}${symbol.temp}`} />
                    <DetailStat label="Feels like" value={`${formatNumber(convert.temp(selectedHour.apparent), 0)}${symbol.temp}`} />
                    <DetailStat
                      label="Precip. chance"
                      value={selectedHour.precipProbability === null ? "—" : `${formatNumber(selectedHour.precipProbability, 0)}%`}
                    />
                    <DetailStat
                      label="Precipitation"
                      value={`${formatNumber(convert.precip(selectedHour.precipitation), units.precipitation === "in" ? 2 : 1)} ${symbol.precip}`}
                    />
                    <DetailStat
                      label="Wind"
                      value={`${formatNumber(convert.wind(selectedHour.windSpeed), 0)} ${symbol.wind} ${compassPoint(selectedHour.windDirection)}`}
                    />
                    <DetailStat label="Humidity" value={`${formatNumber(selectedHour.humidity, 0)}%`} />
                  </dl>
                </div>
              ) : null}
              <SourceNote>
                Times use the {timeZone ?? "location"} zone reported by the provider. Hours from the current one onward are forecast
                values; earlier hours come from the provider&apos;s analysis window.
              </SourceNote>
            </>
          )}
        </section>

        <section>
          <SectionHeading
            index="03"
            title="Seven-day outlook"
            subtitle={`${days.length} days returned by Open-Meteo for these coordinates. Select a day to open its full detail below the rail.`}
            action={
              <Button variant="ghost" onClick={() => setView("forecast")} title="Open the full forecast explorer">
                Forecast <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          {week.length === 0 ? (
            <p className="muted text-xs">No daily series was returned for this location.</p>
          ) : (
            <>
              <DailyRail
                days={week}
                timeZone={zone}
                selectedIso={selectedDay?.iso ?? null}
                onSelect={(day) => setSelectedDayIso(day.iso)}
                bounds={weekBounds}
              />
              {selectedDay ? (
                <div className="border-line/70 mt-4 flex flex-wrap items-center gap-x-10 gap-y-5 border-t pt-5">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <WeatherIcon variant={iconVariant(selectedDay.weatherCode, true)} size={44} animate={false} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">
                        {isSameZoneDay(selectedDay.epoch ?? now, now, zone) ? "Today" : dayLabel(selectedDay.epoch, zone, "long")} ·{" "}
                        {dateLabel(selectedDay.epoch, zone)}
                      </p>
                      <p className="muted mt-0.5 text-[11px]">{conditionLabel(selectedDay.weatherCode)}</p>
                    </div>
                  </div>
                  <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
                    <DetailStat
                      label="High / low"
                      value={`${formatNumber(convert.temp(selectedDay.tempMax), 0)}° / ${formatNumber(convert.temp(selectedDay.tempMin), 0)}°`}
                    />
                    <DetailStat
                      label="Precip. chance"
                      value={selectedDay.precipProbabilityMax === null ? "—" : `${formatNumber(selectedDay.precipProbabilityMax, 0)}%`}
                    />
                    <DetailStat
                      label="Precipitation"
                      value={`${formatNumber(convert.precip(selectedDay.precipitationSum), units.precipitation === "in" ? 2 : 1)} ${symbol.precip}`}
                    />
                    <DetailStat label="Max wind" value={`${formatNumber(convert.wind(selectedDay.windMax), 0)} ${symbol.wind}`} />
                    <DetailStat label="UV max" value={formatNumber(selectedDay.uvMax, 1)} />
                    <DetailStat
                      label="Sunrise / sunset"
                      value={`${hourLabel(selectedDay.sunrise, zone, units.hour12)} / ${hourLabel(selectedDay.sunset, zone, units.hour12)}`}
                    />
                  </dl>
                </div>
              ) : null}
            </>
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-12">
          <section className="glass-pearl rounded-[28px] px-6 py-6 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[9.5px] font-semibold tracking-[0.3em] uppercase" style={{ color: "var(--pearl-muted)" }}>
                  04 · Air quality
                </p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--pearl-muted)" }}>
                  European AQI from the Open-Meteo air quality endpoint for these coordinates.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setView("air")} title="Open the air quality section">
                Details <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {air.loading && !air.data ? (
              <div className="mt-5 space-y-2">
                <Skeleton className="h-12 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : air.error && !air.data ? (
              <ErrorState compact title="Air quality unavailable" message={air.error} onRetry={air.refresh} />
            ) : airBands ? (
              <div className="mt-5">
                <div className="flex items-end gap-4">
                  <p className="tnum text-[56px] leading-none font-semibold tracking-[-0.03em]" style={{ color: airBands.color }}>
                    {formatNumber(airCurrent?.european_aqi, 0)}
                  </p>
                  <div className="pb-1.5">
                    <p className="text-sm font-semibold" style={{ color: airBands.color }}>
                      {airBands.label}
                    </p>
                    <p className="text-[10.5px]" style={{ color: "var(--pearl-muted)" }}>
                      European AQI (EEA five-band index)
                    </p>
                  </div>
                </div>
                {airProgress !== null ? (
                  <div className="mt-4 h-[5px] w-full overflow-hidden rounded-full" style={{ background: "rgba(12,14,20,0.1)" }}>
                    <div className="h-full rounded-full" style={{ width: `${airProgress}%`, background: airBands.color }} />
                  </div>
                ) : null}
                <p className="mt-4 text-[11.5px] leading-relaxed" style={{ color: "var(--pearl-muted)" }}>
                  {airBands.guidance}
                </p>
              </div>
            ) : (
              <p className="mt-5 text-xs" style={{ color: "var(--pearl-muted)" }}>
                No AQI value was returned for these coordinates.
              </p>
            )}
            <SourceNote>{air.data?.attribution ?? "Air quality data by Open-Meteo (CAMS ensemble)."}</SourceNote>
          </section>

          <Reveal>
            <section className="halo-light flex h-full flex-col rounded-[28px] border border-line/80 bg-[linear-gradient(165deg,rgba(255,255,255,0.055),rgba(255,255,255,0.012))] px-5 py-6 backdrop-blur-xl">
              <p className="muted-dim text-[9.5px] font-semibold tracking-[0.3em] uppercase">05 · Sun cycle</p>
              <p className="muted mt-2 text-xs">
                {today ? `${dayLabel(today.epoch, zone, "long")} · ${dateLabel(today.epoch, zone)}` : "Sunrise and sunset for today"}
              </p>
              <div className="mt-4">
                {today?.sunrise && today?.sunset ? (
                  <SunArc
                    sunrise={hourLabel(today.sunrise, zone, units.hour12)}
                    sunset={hourLabel(today.sunset, zone, units.hour12)}
                    now={hourLabel(now, zone, units.hour12)}
                    progress={sunProgress}
                    lockedLabel="Daylight progress needs both sunrise and sunset for today."
                  />
                ) : (
                  <p className="muted text-xs">No sunrise or sunset was returned for this location and date.</p>
                )}
              </div>
              {today?.sunrise && today?.sunset ? (
                <p className="muted-dim mt-auto pt-4 text-[10.5px]">
                  Daylight {durationLabel(today.daylightSeconds)}
                  {peakUvDay?.uvMax != null ? ` · peak UV this week ${formatNumber(peakUvDay.uvMax, 1)}` : ""}
                </p>
              ) : null}
            </section>
          </Reveal>
        </div>

        <section>
          <SectionHeading
            index="06"
            title="Warnings"
            subtitle="Alerts matched to these coordinates by the official agencies listed in the alerts section."
            action={
              <Button variant="ghost" onClick={() => setView("alerts")} title="Open the alerts section">
                All alerts <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          {alerts.loading && !alerts.data ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : alerts.data && alerts.data.alerts.length > 0 ? (
            <ol className="flex flex-col">
              {alerts.data.alerts.slice(0, 3).map((alert) => (
                <li key={alert.id} className="border-line/70 border-t py-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
                    <span
                      className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[10px] font-semibold tracking-[0.12em] uppercase"
                      style={{ borderColor: `${alert.color}55`, color: alert.color, background: `${alert.color}18` }}
                    >
                      {alert.severity} · {alert.providerLabel}
                    </span>
                    <p className="text-[15px] font-semibold text-ink">{alert.event}</p>
                  </div>
                  <p className="muted mt-1.5 max-w-[92ch] text-xs leading-relaxed">{alert.headline}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted text-xs">
              No active alert matched this location in the last refresh. The alerts section lists which agencies were queried and
              whether each one answered.
            </p>
          )}
          {alerts.data && alerts.data.alerts.length > 3 ? (
            <p className="muted-dim mt-3 text-[10.5px]">
              +{alerts.data.alerts.length - 3} more active alert{alerts.data.alerts.length - 3 === 1 ? "" : "s"} matched within the
              search radius.
            </p>
          ) : null}
          {alerts.data ? (
            <SourceNote>
              {alerts.data.statuses.filter((status) => status.available).length} of {alerts.data.statuses.length} alert sources
              answered for this location.
              {alerts.data.anyProviderSucceeded
                ? ""
                : " No provider responded, so an empty list here is not evidence that no warnings exist."}
            </SourceNote>
          ) : null}
        </section>

        <AttributionFooter />
      </div>
    </div>
  );
}

function isDayAt(epoch: number | null, today: { sunrise: number | null; sunset: number | null } | null): boolean {
  if (epoch === null || !today?.sunrise || !today?.sunset) return true;
  return epoch >= today.sunrise && epoch <= today.sunset;
}
