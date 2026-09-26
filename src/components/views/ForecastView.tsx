"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  Clock,
  CloudRain,
  Droplets,
  Eye,
  Gauge,
  Snowflake,
  Sun,
  Thermometer,
} from "lucide-react";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { useUnits } from "@/components/providers/UnitsProvider";
import { PanelHeader, Reveal } from "@/components/ui/Card";
import { ErrorState, Skeleton, SourceNote } from "@/components/ui/States";
import { Segmented, Toggle } from "@/components/ui/Controls";
import { DailyRail, HourlyRail } from "@/components/weather/ForecastRail";
import { MetricTile, SunArc, WindCompass } from "@/components/weather/Metrics";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { currentHourIndex, precipitationType, type DayPoint, type HourPoint } from "@/lib/forecast";
import { dateLabel, dayLabel, durationLabel, hourLabel, isSameZoneDay } from "@/lib/time";
import { compassPoint, formatNumber, uvBand } from "@/lib/units";
import { conditionLabel, iconVariant } from "@/lib/wmo";

const TONE_COLORS: Record<string, string> = {
  emerald: "#7ee0b0",
  amber: "#f6c667",
  orange: "#f59e6b",
  rose: "#ff7a7a",
  violet: "#a597ff",
};

const snowDepth = (centimetres: number | null, imperial: boolean): number | null =>
  centimetres === null ? null : imperial ? centimetres * 0.393701 : centimetres;

type ChartPoint = {
  key: string;
  label: string;
  date: string;
  epoch: number | null;
  index: number;
  observed: boolean;
  temp: number | null;
  feels: number | null;
  pop: number | null;
  tempObs: number | null;
  tempFc: number | null;
  feelsObs: number | null;
  feelsFc: number | null;
};

function bridgeSeries(points: ChartPoint[]) {
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const point = points[i];
    if (point.observed && !previous.observed) {
      previous.tempObs = point.tempObs;
      previous.feelsObs = point.feelsObs;
    }
    if (!point.observed && previous.observed) {
      previous.tempFc = point.tempFc;
      previous.feelsFc = point.feelsFc;
    }
  }
  return points;
}

function HourTooltip({
  active,
  payload,
  tempSymbol,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  tempSymbol: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-line bg-[rgba(9,10,14,0.97)] px-3 py-2 shadow-[var(--shadow-panel)]">
      <p className="muted-dim text-[10px] font-semibold tracking-[0.12em] uppercase">
        {point.date} · {point.label}
      </p>
      <p className="tnum mt-1 text-sm font-semibold text-ink">
        {point.temp === null ? "—" : `${formatNumber(point.temp, 0)}${tempSymbol}`}
        <span className="muted ml-2 text-[11px] font-normal">
          feels {point.feels === null ? "—" : `${formatNumber(point.feels, 0)}${tempSymbol}`}
        </span>
      </p>
      <p className="muted mt-1 text-[11px]">
        Precipitation chance {point.pop === null ? "—" : `${formatNumber(point.pop, 0)}%`}
      </p>
      <p className={`mt-1 text-[10px] font-semibold tracking-[0.1em] uppercase ${point.observed ? "text-mint" : "text-cyan"}`}>
        {point.observed ? "Observed window" : "Forecast"}
      </p>
    </div>
  );
}

function PearlStat({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-[9.5px] font-semibold tracking-[0.2em] text-[#5a616d] uppercase">{label}</p>
      <p className="tnum mt-1.5 flex items-baseline gap-1 text-[23px] leading-none font-semibold tracking-[-0.02em] text-[#12141a]">
        {value}
        {unit ? <span className="text-[11.5px] font-medium text-[#5a616d]">{unit}</span> : null}
      </p>
      {detail ? <p className="mt-1 text-[11px] leading-snug text-[#5a616d]">{detail}</p> : null}
    </div>
  );
}

export function ForecastView() {
  const { weather, hours, days, timeZone, place } = useDashboard();
  const { units, convert, symbol } = useUnits();
  const tz = timeZone ?? undefined;

  const now = Date.now();
  const hourStart = currentHourIndex(hours, now);
  const forecastHourCount = hours.filter((hour) => hour.isForecast).length;

  const [range, setRange] = useState<"48" | "72">("48");
  const [showFeels, setShowFeels] = useState(true);
  const [showPop, setShowPop] = useState(true);
  const [selectedHourIndex, setSelectedHourIndex] = useState<number | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [dayRange, setDayRange] = useState<"7" | "14">("7");

  const rangeHours = useMemo(() => {
    const count = range === "48" ? 48 : 72;
    return hours.slice(hourStart, hourStart + count);
  }, [hours, hourStart, range]);

  const chartData = useMemo<ChartPoint[]>(() => {
    const points = rangeHours.map((hour) => {
      const temp = convert.temp(hour.temperature);
      const feels = convert.temp(hour.apparent);
      const label = hourLabel(hour.epoch, tz, units.hour12);
      const date = dateLabel(hour.epoch, tz);
      return {
        key: `${date} ${label}`,
        label,
        date,
        epoch: hour.epoch,
        index: hour.index,
        observed: !hour.isForecast,
        temp,
        feels,
        pop: hour.precipProbability,
        tempObs: hour.isForecast ? null : temp,
        tempFc: hour.isForecast ? temp : null,
        feelsObs: hour.isForecast ? null : feels,
        feelsFc: hour.isForecast ? feels : null,
      };
    });
    return bridgeSeries(points);
  }, [rangeHours, convert, tz, units.hour12]);

  const nowKey = useMemo(() => {
    const observed = chartData.filter((point) => point.observed);
    return observed.length > 0 ? observed[observed.length - 1].key : chartData[0]?.key ?? null;
  }, [chartData]);

  const cursorKey = useMemo(() => {
    if (selectedHourIndex === null) return null;
    return chartData.find((point) => point.index === selectedHourIndex)?.key ?? null;
  }, [chartData, selectedHourIndex]);

  const activeHour: HourPoint | null =
    selectedHourIndex !== null
      ? hours[selectedHourIndex] ?? null
      : rangeHours[0] ?? hours[hourStart] ?? null;

  const visibleDays = useMemo(
    () => days.slice(0, dayRange === "7" ? 7 : 14),
    [days, dayRange]
  );

  const activeDay: DayPoint | null =
    selectedDayIndex !== null ? days[selectedDayIndex] ?? null : visibleDays[0] ?? days[0] ?? null;

  const dayBounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const day of visibleDays) {
      const low = convert.temp(day.tempMin);
      const high = convert.temp(day.tempMax);
      if (low !== null) min = Math.min(min, low);
      if (high !== null) max = Math.max(max, high);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    return { min, max };
  }, [visibleDays, convert]);

  if (weather.loading && !weather.data) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-[30px] p-6 sm:p-8">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-6 h-14 w-44" />
          <Skeleton className="mt-6 h-56 w-full" />
        </div>
        <div className="glass rounded-[30px] p-6 sm:p-8">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-5 h-24 w-full" />
        </div>
      </div>
    );
  }

  if (weather.error && !weather.data) {
    return <ErrorState title="Forecast unavailable" message={weather.error} onRetry={weather.refresh} />;
  }

  if (hours.length === 0 || days.length === 0) {
    return (
      <ErrorState
        title="No forecast series returned"
        message="Open-Meteo answered without an hourly or daily series for these coordinates. Try refreshing or choosing a nearby place."
        onRetry={weather.refresh}
      />
    );
  }

  const uv = activeHour ? uvBand(activeHour.uvIndex) : null;
  const activeDayUv = activeDay ? uvBand(activeDay.uvMax) : null;
  const selectedDayIsToday = activeDay ? isSameZoneDay(activeDay.epoch ?? now, now, tz) : false;
  const daySunProgress =
    activeDay?.sunrise && activeDay?.sunset && activeDay.sunset > activeDay.sunrise && selectedDayIsToday
      ? (now - activeDay.sunrise) / (activeDay.sunset - activeDay.sunrise)
      : null;

  const chartInterval = Math.max(0, Math.floor(chartData.length / 8));

  const handleChartClick = (state: unknown) => {
    const next = state as { activeTooltipIndex?: number | string | null; activeLabel?: string | number | null };
    const index =
      typeof next.activeTooltipIndex === "number"
        ? next.activeTooltipIndex
        : chartData.findIndex((point) => point.key === next.activeLabel);
    if (index >= 0 && index < chartData.length) setSelectedHourIndex(chartData[index].index);
  };

  const precipChance = activeDay?.precipProbabilityMax ?? null;
  const precipPercent = precipChance === null ? 0 : Math.max(0, Math.min(100, precipChance));

  return (
    <div className="space-y-7">
      <Reveal>
        <section className="relative overflow-hidden rounded-[30px] border border-line/60 bg-[radial-gradient(130%_150%_at_0%_-10%,rgba(255,255,255,0.075),rgba(255,255,255,0.014)_55%,transparent)] px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
          <PanelHeader
            title="Hourly outlook"
            icon={<Thermometer className="h-4 w-4" />}
            subtitle={`Temperature, feels-like and precipitation chance for ${place?.name ?? "this location"}, labelled in its own time zone.`}
            action={
              <Segmented
                ariaLabel="Hourly range"
                size="sm"
                value={range}
                onChange={(value) => setRange(value)}
                options={[
                  { value: "48", label: "48 h", title: "Next 48 hours" },
                  { value: "72", label: "72 h", title: "Next 72 hours" },
                ]}
              />
            }
          />

          {!activeHour ? (
            <p className="muted mt-5 text-xs">No hour is available to inspect.</p>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
                <div className="min-w-0">
                  <p className="tnum text-[68px] leading-[0.88] font-semibold tracking-[-0.045em] text-ink sm:text-[84px]">
                    {formatNumber(convert.temp(activeHour.temperature), 0)}
                    <span className="ml-1.5 text-[24px] font-medium tracking-normal text-ink-soft">{symbol.temp}</span>
                  </p>
                  <p className="mt-3 text-[15px] font-medium text-ink-soft">{conditionLabel(activeHour.weatherCode)}</p>
                  <p className="muted mt-1.5 text-[11.5px]">
                    {dateLabel(activeHour.epoch, tz)} · {hourLabel(activeHour.epoch, tz, units.hour12)} ·{" "}
                    {place?.name ?? "this location"}
                  </p>
                  <p className="muted-dim mt-1 flex items-center gap-1.5 text-[10.5px]">
                    <Clock aria-hidden className="h-3 w-3" />
                    Local time {hourLabel(now, tz, units.hour12)}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <WeatherIcon
                    variant={iconVariant(activeHour.weatherCode, isDayAt(activeHour.epoch, activeDay))}
                    size={76}
                    animate
                  />
                  <div>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ${
                        activeHour.isForecast
                          ? "border-cyan/35 bg-cyan/10 text-cyan"
                          : "border-mint/35 bg-mint/10 text-mint"
                      }`}
                    >
                      {activeHour.isForecast ? "Forecast" : "Observed window"}
                    </span>
                    <p className="muted-dim mt-1.5 text-[10.5px]">
                      Feels like {formatNumber(convert.temp(activeHour.apparent), 0)}
                      {symbol.temp} · {formatNumber(activeHour.precipProbability, 0)}% precipitation chance
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 h-[280px] w-full">
                {chartData.length === 0 ? (
                  <p className="muted text-xs">The hourly series was not returned for this location.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                      onClick={handleChartClick as never}
                    >
                      <defs>
                        <linearGradient id="fx-pop" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8ce7f5" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#8ce7f5" stopOpacity="0.015" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} />
                      <XAxis
                        dataKey="key"
                        interval={chartInterval}
                        minTickGap={16}
                        tickMargin={8}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#8c93a0", fontSize: 10 }}
                        tickFormatter={(value: string, index: number) => chartData[index]?.label ?? value}
                      />
                      <YAxis
                        yAxisId="temp"
                        width={36}
                        domain={["dataMin - 3", "dataMax + 3"]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#8c93a0", fontSize: 10 }}
                        tickFormatter={(value: number) => `${Math.round(value)}°`}
                      />
                      <YAxis
                        yAxisId="pop"
                        orientation="right"
                        width={34}
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#666d7b", fontSize: 10 }}
                        tickFormatter={(value: number) => `${value}%`}
                      />
                      <Tooltip
                        cursor={{ stroke: "rgba(255,255,255,0.28)", strokeWidth: 1 }}
                        content={<HourTooltip tempSymbol={symbol.temp} />}
                      />
                      {showPop ? (
                        <Area
                          yAxisId="pop"
                          type="monotone"
                          dataKey="pop"
                          name="Precipitation chance"
                          stroke="#8ce7f5"
                          strokeOpacity={0.55}
                          strokeWidth={1}
                          fill="url(#fx-pop)"
                          isAnimationActive={false}
                        />
                      ) : null}
                      {nowKey ? (
                        <ReferenceLine
                          yAxisId="temp"
                          x={nowKey}
                          stroke="rgba(247,248,250,0.5)"
                          strokeDasharray="3 3"
                          label={{ value: "now", position: "insideTopRight", fill: "#d3d8e0", fontSize: 10 }}
                        />
                      ) : null}
                      {cursorKey && cursorKey !== nowKey ? (
                        <ReferenceLine
                          yAxisId="temp"
                          x={cursorKey}
                          stroke="rgba(232,197,131,0.65)"
                          strokeDasharray="2 3"
                          label={{ value: "selected", position: "insideTopLeft", fill: "#e8c583", fontSize: 10 }}
                        />
                      ) : null}
                      <Line
                        yAxisId="temp"
                        type="monotone"
                        dataKey="tempObs"
                        name="Observed"
                        stroke="#f7f8fa"
                        strokeWidth={2.2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="temp"
                        type="monotone"
                        dataKey="tempFc"
                        name="Forecast"
                        stroke="#8ce7f5"
                        strokeWidth={2.2}
                        strokeDasharray="5 4"
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      {showFeels ? (
                        <>
                          <Line
                            yAxisId="temp"
                            type="monotone"
                            dataKey="feelsObs"
                            name="Feels like (observed)"
                            stroke="#b3b8c4"
                            strokeWidth={1.4}
                            dot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                          <Line
                            yAxisId="temp"
                            type="monotone"
                            dataKey="feelsFc"
                            name="Feels like (forecast)"
                            stroke="#b3b8c4"
                            strokeWidth={1.4}
                            strokeDasharray="4 4"
                            dot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        </>
                      ) : null}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10.5px]">
                <span className="inline-flex items-center gap-1.5 text-ink-soft">
                  <span className="h-[2px] w-5 rounded-full bg-pearl" /> Observed window
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink-soft">
                  <span
                    className="h-[2px] w-5 rounded-full"
                    style={{ backgroundImage: "repeating-linear-gradient(90deg,#8ce7f5 0 4px,transparent 4px 7px)" }}
                  />{" "}
                  Forecast
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink-soft">
                  <span className="h-[2px] w-5 rounded-full bg-iris" /> Feels like
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink-soft">
                  <span className="h-2 w-3 rounded-sm bg-cyan/30" /> Precipitation chance
                </span>
              </div>

              <div className="rule mt-4 flex flex-wrap items-center justify-between gap-3 pt-4">
                <div className="flex flex-wrap gap-4">
                  <div className="w-[188px]">
                    <Toggle checked={showFeels} onChange={setShowFeels} label="Feels-like line" hint="Apparent temperature" />
                  </div>
                  <div className="w-[188px]">
                    <Toggle checked={showPop} onChange={setShowPop} label="Precipitation chance" hint="Hourly probability band" />
                  </div>
                </div>
                <p className="muted-dim text-[10.5px]">Click or tap anywhere on the chart to inspect that hour.</p>
              </div>

              <div className="rule mt-4 pt-4">
                <p className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Hour by hour</p>
                <p className="muted mt-1 text-[11px]">
                  Drag the rail sideways, or swipe on touch. Selecting a card loads it into the readout above.
                </p>
                <HourlyRail
                  className="mt-2"
                  hours={rangeHours}
                  timeZone={tz}
                  selectedIso={activeHour.iso}
                  onSelect={(hour) => setSelectedHourIndex(hour.index)}
                  isDayAt={(epoch) => isDayAt(epoch, activeDay)}
                  nowIndexIso={rangeHours[0]?.iso ?? null}
                />
              </div>
            </>
          )}

          <SourceNote>
            Hours from the current one onward are forecast values; hours before it come from the provider&apos;s analysis window and
            are marked “Observed window”. Day and night icons use the sunrise and sunset of the selected day.{" "}
            {forecastHourCount < Number(range)
              ? `Only ${forecastHourCount} forecast hours were returned, so the chart ends early.`
              : `${forecastHourCount} forecast hours were returned by the provider.`}
          </SourceNote>
        </section>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Feels like"
            icon={<Thermometer className="h-3.5 w-3.5" />}
            value={activeHour ? formatNumber(convert.temp(activeHour.apparent), 0) : "—"}
            unit={symbol.temp}
            info="Apparent temperature combines wind chill, humidity and solar radiation as modelled for this hour."
          />
          <MetricTile
            label="Precipitation"
            icon={<CloudRain className="h-3.5 w-3.5" />}
            value={activeHour ? formatNumber(convert.precip(activeHour.precipitation), units.precipitation === "in" ? 2 : 1) : "—"}
            unit={symbol.precip}
            detail={activeHour ? precipitationType(activeHour.weatherCode, activeHour.snowfall, activeHour.showers, activeHour.rain) : undefined}
            info="Rain, showers and the water equivalent of snowfall combined for the hour."
          />
          <MetricTile
            label="Humidity"
            icon={<Droplets className="h-3.5 w-3.5" />}
            value={activeHour ? formatNumber(activeHour.humidity, 0) : "—"}
            unit="%"
          />
          <MetricTile
            label="UV index"
            icon={<Sun className="h-3.5 w-3.5" />}
            value={activeHour ? formatNumber(activeHour.uvIndex, 1) : "—"}
            detail={uv ? uv.label : "Not reported"}
            accent={uv ? TONE_COLORS[uv.tone] : undefined}
          />
          <MetricTile
            label="Cloud cover"
            icon={<CloudRain className="h-3.5 w-3.5" />}
            value={activeHour ? formatNumber(activeHour.cloudCover, 0) : "—"}
            unit="%"
          />
          <MetricTile
            label="Visibility"
            icon={<Eye className="h-3.5 w-3.5" />}
            value={
              activeHour
                ? formatNumber(
                    activeHour.visibility === null ? null : convert.distance(activeHour.visibility / 1000),
                    units.distance === "mi" ? 1 : 0
                  )
                : "—"
            }
            unit={symbol.distance}
          />
          <MetricTile
            label="Pressure"
            icon={<Gauge className="h-3.5 w-3.5" />}
            value={activeHour ? formatNumber(convert.pressure(activeHour.pressure), units.pressure === "inhg" ? 2 : 0) : "—"}
            unit={symbol.pressure}
          />
          <div className="border-line/70 flex flex-col justify-center border-b pb-3.5">
            <WindCompass
              direction={activeHour?.windDirection ?? null}
              label={compassPoint(activeHour?.windDirection ?? null)}
              speedLabel={activeHour ? formatNumber(convert.wind(activeHour.windSpeed), 0) : "—"}
              gustLabel={
                activeHour && activeHour.windGust !== null ? formatNumber(convert.wind(activeHour.windGust), 0) : null
              }
              unit={symbol.wind}
            />
          </div>
          {activeHour && activeHour.snowfall !== null && activeHour.snowfall > 0 ? (
            <MetricTile
              label="Snowfall"
              icon={<Snowflake className="h-3.5 w-3.5" />}
              value={formatNumber(snowDepth(activeHour.snowfall, units.precipitation === "in"), units.precipitation === "in" ? 2 : 1)}
              unit={units.precipitation === "in" ? "in" : "cm"}
              info="Snowfall depth reported by the provider for this hour, converted from centimetres."
            />
          ) : null}
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <section className="rule pt-6">
          <PanelHeader
            title="Daily outlook"
            icon={<CalendarDays className="h-4 w-4" />}
            subtitle={`${days.length} days returned for these coordinates. Select a day to load it into the detail surface below.`}
            action={
              days.length > 7 ? (
                <Segmented
                  ariaLabel="Daily range"
                  size="sm"
                  value={dayRange}
                  onChange={(value) => setDayRange(value)}
                  options={[
                    { value: "7", label: "7 days" },
                    { value: "14", label: "14 days" },
                  ]}
                />
              ) : null
            }
          />
          {visibleDays.length === 0 ? (
            <p className="muted mt-4 text-xs">No daily series was returned for this location.</p>
          ) : (
            <DailyRail
              className="mt-3"
              days={visibleDays}
              timeZone={tz}
              selectedIso={activeDay?.iso ?? null}
              onSelect={(day) => setSelectedDayIndex(day.index)}
              bounds={dayBounds}
            />
          )}
          <SourceNote>
            Highs, lows and precipitation chance as returned by Open-Meteo for the whole local day at this location.
          </SourceNote>
        </section>
      </Reveal>

      <Reveal delay={0.14}>
        <section className="glass-pearl relative overflow-hidden rounded-[30px] px-5 py-6 sm:px-8 sm:py-8">
          {!activeDay ? (
            <p className="text-xs text-[#5a616d]">No day is available to inspect.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-6">
                <div className="min-w-0">
                  <p className="text-[9.5px] font-semibold tracking-[0.22em] text-[#5a616d] uppercase">Selected day</p>
                  <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.01em] text-[#12141a]">
                    {dayLabel(activeDay.epoch, tz, "long")}
                    <span className="ml-2 font-normal text-[#5a616d]">{dateLabel(activeDay.epoch, tz)}</span>
                  </h2>
                  <p className="tnum mt-4 text-[58px] leading-none font-semibold tracking-[-0.04em] text-[#12141a]">
                    {formatNumber(convert.temp(activeDay.tempMax), 0)}°
                    <span className="ml-2 text-[26px] font-medium text-[#5a616d]">
                      / {formatNumber(convert.temp(activeDay.tempMin), 0)}°
                    </span>
                  </p>
                  <p className="mt-2 flex items-center gap-2.5 text-[13px] text-[#12141a]">
                    <WeatherIcon variant={iconVariant(activeDay.weatherCode, true)} size={26} animate={false} />
                    {conditionLabel(activeDay.weatherCode)}
                  </p>
                  <p className="mt-2 max-w-[46ch] text-[11.5px] leading-relaxed text-[#5a616d]">
                    Feels-like range {formatNumber(convert.temp(activeDay.apparentMax), 0)}° /{" "}
                    {formatNumber(convert.temp(activeDay.apparentMin), 0)}° · wind to{" "}
                    {formatNumber(convert.wind(activeDay.windMax), 0)} {symbol.wind} from {compassPoint(activeDay.windDirection)}
                    {activeDay.snowfallSum !== null && activeDay.snowfallSum > 0
                      ? ` · snowfall ${formatNumber(snowDepth(activeDay.snowfallSum, units.precipitation === "in"), units.precipitation === "in" ? 2 : 1)} ${units.precipitation === "in" ? "in" : "cm"}`
                      : ""}
                  </p>
                </div>

                <div className="w-[248px] max-w-full">
                  {activeDay.sunrise && activeDay.sunset ? (
                    <SunArc
                      tone="light"
                      sunrise={hourLabel(activeDay.sunrise, tz, units.hour12)}
                      sunset={hourLabel(activeDay.sunset, tz, units.hour12)}
                      now={hourLabel(now, tz, units.hour12)}
                      progress={daySunProgress}
                      lockedLabel="Progress along the arc is only drawn for today; sunrise and sunset are shown for the selected date."
                    />
                  ) : (
                    <p className="text-xs text-[#5a616d]">No sunrise or sunset was returned for this date.</p>
                  )}
                </div>
              </div>

              <div className="pearl-rule mt-6 pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[9.5px] font-semibold tracking-[0.2em] text-[#5a616d] uppercase">
                    Precipitation chance
                  </span>
                  <span className="tnum text-[13px] font-semibold text-[#12141a]">
                    {precipChance === null ? "—" : `${formatNumber(precipChance, 0)}%`}
                  </span>
                </div>
                <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[rgba(12,14,20,0.12)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${precipPercent}%`, background: "linear-gradient(90deg,#12141a,#8b929d)" }}
                  />
                </div>
              </div>

              <div className="pearl-rule mt-5 grid gap-x-8 gap-y-5 pt-5 sm:grid-cols-2 xl:grid-cols-4">
                <PearlStat
                  label="Total precipitation"
                  value={formatNumber(convert.precip(activeDay.precipitationSum), units.precipitation === "in" ? 2 : 1)}
                  unit={symbol.precip}
                  detail={`Rain ${formatNumber(convert.precip(activeDay.rainSum), units.precipitation === "in" ? 2 : 1)} · Showers ${formatNumber(convert.precip(activeDay.showersSum), units.precipitation === "in" ? 2 : 1)}`}
                />
                <PearlStat
                  label="UV index max"
                  value={formatNumber(activeDay.uvMax, 1)}
                  detail={activeDayUv ? activeDayUv.label : "Not reported"}
                />
                <PearlStat label="Daylight" value={durationLabel(activeDay.daylightSeconds)} />
                <PearlStat
                  label="Wind max"
                  value={formatNumber(convert.wind(activeDay.windMax), 0)}
                  unit={symbol.wind}
                  detail={`Gusts ${formatNumber(convert.wind(activeDay.gustMax), 0)} ${symbol.wind}`}
                />
                <PearlStat
                  label="Dominant wind"
                  value={compassPoint(activeDay.windDirection)}
                  unit={activeDay.windDirection === null ? undefined : `${Math.round(activeDay.windDirection)}°`}
                />
                <PearlStat
                  label="Feels-like high"
                  value={formatNumber(convert.temp(activeDay.apparentMax), 0)}
                  unit={symbol.temp}
                />
                <PearlStat
                  label="Feels-like low"
                  value={formatNumber(convert.temp(activeDay.apparentMin), 0)}
                  unit={symbol.temp}
                />
                {activeDay.snowfallSum !== null && activeDay.snowfallSum > 0 ? (
                  <PearlStat
                    label="Snowfall"
                    value={formatNumber(snowDepth(activeDay.snowfallSum, units.precipitation === "in"), units.precipitation === "in" ? 2 : 1)}
                    unit={units.precipitation === "in" ? "in" : "cm"}
                  />
                ) : null}
              </div>
            </>
          )}
        </section>
      </Reveal>
    </div>
  );
}

function isDayAt(epoch: number | null, day: DayPoint | null): boolean {
  if (epoch === null || !day?.sunrise || !day?.sunset) return true;
  return epoch >= day.sunrise && epoch <= day.sunset;
}
