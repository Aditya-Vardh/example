"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Atom, Gauge, Leaf, RefreshCw, Waves } from "lucide-react";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { Segmented } from "@/components/ui/Controls";
import { PanelHeader, Reveal } from "@/components/ui/Card";
import { DataStamp, ErrorState, Skeleton, SourceNote, UnavailableState } from "@/components/ui/States";
import { MetricTile, ProgressRow } from "@/components/weather/Metrics";
import { POLLUTANTS, aqiBand, aqiBands, aqiProgress, pollutantRatio, type AqiScale } from "@/lib/aqi";
import { buildAirHours } from "@/lib/forecast";
import { dateLabel, shortHourLabel } from "@/lib/time";
import { formatNumber, uvBand } from "@/lib/units";

const LIGHT_TONES: Array<{ limit: number; color: string }> = [
  { limit: 0.5, color: "#1f8f63" },
  { limit: 1, color: "#9a7412" },
  { limit: 2, color: "#bf5316" },
  { limit: Infinity, color: "#b8262b" },
];

const pollutantLightColor = (ratio: number): string =>
  LIGHT_TONES.find((tone) => ratio <= tone.limit)?.color ?? "#5a616d";

const TONE_COLORS: Record<string, string> = {
  emerald: "#7ee0b0",
  amber: "#f6c667",
  orange: "#f59e6b",
  rose: "#ff7a7a",
  violet: "#a597ff",
};

const SCALE_LABELS: Record<AqiScale, string> = {
  european: "European AQI",
  us: "US AQI",
};

const SCALE_NOTES: Record<AqiScale, string> = {
  european:
    "The European AQI from the Copernicus Atmosphere Monitoring Service ensemble, reported on the EEA five-band index that runs from 0 upwards.",
  us: "The US AQI from the Copernicus Atmosphere Monitoring Service ensemble, reported on the EPA six-band index where 100 matches the national air quality standard.",
};

type AirChartPoint = {
  label: string;
  date: string;
  epoch: number | null;
  observed: boolean;
  value: number | null;
  valueObs: number | null;
  valueFc: number | null;
  pm25: number | null;
};

type PollutantRow = {
  key: string;
  symbol: string;
  label: string;
  unit: string;
  value: number;
  ratio: number;
  reference: number;
  referenceLabel: string;
  description: string;
  color: string;
  lightColor: string;
};

function AirTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: AirChartPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-line bg-[rgba(9,10,14,0.97)] px-3 py-2 shadow-[var(--shadow-panel)]">
      <p className="muted-dim text-[10px] font-semibold tracking-[0.12em] uppercase">
        {point.date} · {point.label}
      </p>
      <p className="tnum mt-1 text-sm font-semibold text-ink">
        {point.value === null ? "—" : formatNumber(point.value, 0)}
        <span className="muted ml-2 text-[11px] font-normal">index</span>
      </p>
      {point.pm25 !== null ? (
        <p className="muted mt-1 text-[11px]">PM₂.₅ {formatNumber(point.pm25, 1)} µg/m³</p>
      ) : null}
      <p className={`mt-1 text-[10px] font-semibold tracking-[0.1em] uppercase ${point.observed ? "text-mint" : "text-cyan"}`}>
        {point.observed ? "Observed window" : "Forecast"}
      </p>
    </div>
  );
}

export function AirQualityView() {
  const { air, timeZone } = useDashboard();
  const tz = timeZone ?? undefined;

  const now = Date.now();
  const [scale, setScale] = useState<AqiScale>("european");
  const [range, setRange] = useState<"24" | "48" | "72">("24");

  const airHours = useMemo(() => (air.data ? buildAirHours(air.data) : []), [air.data]);
  const startIndex = useMemo(() => {
    const found = airHours.findIndex((hour) => hour.epoch !== null && hour.epoch >= now - 1800000);
    return found === -1 ? Math.max(0, airHours.length - 1) : found;
  }, [airHours, now]);

  const availableForecast = airHours.length - startIndex;
  const rangeCount = range === "24" ? 24 : range === "48" ? 48 : 72;
  const rangeHours = airHours.slice(startIndex, startIndex + Math.min(rangeCount, Math.max(availableForecast, 0)));

  const chartData = useMemo<AirChartPoint[]>(() => {
    const points = rangeHours.map((hour) => {
      const value = scale === "us" ? hour.usAqi : hour.europeanAqi;
      return {
        label: shortHourLabel(hour.epoch, tz, true),
        date: dateLabel(hour.epoch, tz),
        epoch: hour.epoch,
        observed: !hour.isForecast,
        value,
        valueObs: hour.isForecast ? null : value,
        valueFc: hour.isForecast ? value : null,
        pm25: hour.pm25,
      };
    });
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      if (point.observed && !previous.observed) {
        previous.valueObs = point.valueObs;
      }
      if (!point.observed && previous.observed) {
        previous.valueFc = point.valueFc;
      }
    }
    return points;
  }, [rangeHours, scale, tz]);

  const peak = useMemo(() => {
    let best: AirChartPoint | null = null;
    for (const point of chartData) {
      if (point.value === null) continue;
      if (!best || (best.value !== null && point.value > best.value)) best = point;
    }
    return best;
  }, [chartData]);

  if (air.loading && !air.data) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-[30px] p-6 sm:p-8">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-6 h-16 w-44" />
          <Skeleton className="mt-6 h-24 w-full" />
        </div>
        <div className="glass rounded-[30px] p-6 sm:p-8">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-5 h-40 w-full" />
        </div>
      </div>
    );
  }

  if (air.error && !air.data) {
    return <ErrorState title="Air quality unavailable" message={air.error} onRetry={air.refresh} />;
  }

  if (!air.data) {
    return (
      <UnavailableState
        title="No air quality response"
        message="The air quality endpoint returned no usable payload for these coordinates. Try refreshing or choosing a different place."
        icon={<RefreshCw aria-hidden className="h-5 w-5" />}
      />
    );
  }

  const currentRaw = air.data.current ?? null;
  const readCurrent = (key: string): number | null => {
    const raw = currentRaw ? (currentRaw as Record<string, unknown>)[key] : undefined;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  };

  const scaleKey = scale === "us" ? "us_aqi" : "european_aqi";
  const aqiNow = readCurrent(scaleKey);
  const band = aqiBand(aqiNow, scale);
  const progress = aqiNow === null ? null : aqiProgress(aqiNow, scale);
  const bands = aqiBands(scale);
  const otherAqi = readCurrent(scale === "us" ? "european_aqi" : "us_aqi");
  const bandPosition =
    band && aqiNow !== null
      ? (bands.findIndex((entry) => entry.label === band.label) +
          Math.max(0, Math.min(1, (aqiNow - band.min) / Math.max(1, band.max - band.min)))) /
        bands.length
      : null;

  const pollutants: PollutantRow[] = POLLUTANTS.map((info) => {
    const value = readCurrent(info.key);
    if (value === null) return null;
    const ratio = pollutantRatio(value, info.reference);
    if (ratio === null) return null;
    return {
      key: info.key,
      symbol: info.symbol,
      label: info.label,
      unit: info.unit,
      value,
      ratio,
      reference: info.reference,
      referenceLabel: info.referenceLabel,
      description: info.description,
      color: ratio <= 0.5 ? "#7ee0b0" : ratio <= 1 ? "#f6c667" : ratio <= 2 ? "#fb923c" : "#f87171",
      lightColor: pollutantLightColor(ratio),
    };
  }).filter((row): row is PollutantRow => row !== null);

  const peakPollutant = pollutants.reduce<PollutantRow | null>(
    (worst, row) => (!worst || row.ratio > worst.ratio ? row : worst),
    null
  );

  const uv = uvBand(readCurrent("uv_index"));
  const dust = readCurrent("dust");
  const aerosol = readCurrent("aerosol_optical_depth");
  const rangeOptions = (["24", "48", "72"] as const).filter((option) => {
    const count = option === "24" ? 24 : option === "48" ? 48 : 72;
    return availableForecast >= Math.min(count, 12);
  });

  return (
    <div className="space-y-7">
      <Reveal>
        <section className="relative overflow-hidden rounded-[30px] border border-line/60 bg-[radial-gradient(120%_150%_at_100%_-10%,rgba(255,255,255,0.075),rgba(255,255,255,0.014)_55%,transparent)] px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
          <PanelHeader
            title="Air quality now"
            subtitle={SCALE_NOTES[scale]}
            icon={<Leaf className="h-4 w-4" />}
            action={
              <Segmented
                value={scale}
                onChange={setScale}
                size="sm"
                ariaLabel="Air quality index scale"
                options={[
                  { value: "european", label: "European", title: "European AQI (EEA five-band index)" },
                  { value: "us", label: "US", title: "US AQI (EPA six-band index)" },
                ]}
              />
            }
          />

          {aqiNow === null || !band ? (
            <div className="mt-5">
              <UnavailableState
                title={`${SCALE_LABELS[scale]} not published here`}
                message="The air quality model returned no index value for these coordinates, so no band, guidance or pollutant summary can be shown. Pollutant values below are only displayed when the model supplies them."
              />
            </div>
          ) : (
            <div className="mt-5 grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <p className="tnum text-[84px] leading-[0.86] font-semibold tracking-[-0.05em]" style={{ color: band.color }}>
                    {formatNumber(aqiNow, 0)}
                  </p>
                  <div className="pb-2">
                    <p className="text-[18px] font-semibold text-ink">{band.label}</p>
                    <p className="muted-dim mt-0.5 text-[11px]">
                      {SCALE_LABELS[scale]} · band {formatNumber(band.min, 0)}–{formatNumber(band.max, 0)}
                      {progress === null ? "" : ` · ${formatNumber(progress, 0)}% of the displayed scale`}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="relative">
                    <div className="flex h-[6px] w-full overflow-hidden rounded-full">
                      {bands.map((entry) => (
                        <span
                          key={entry.label}
                          className="h-full flex-1"
                          style={{ background: entry.color, opacity: entry.label === band.label ? 0.95 : 0.28 }}
                        />
                      ))}
                    </div>
                    {bandPosition !== null ? (
                      <span
                        aria-hidden
                        className="absolute -top-[4px] h-[14px] w-[3px] -translate-x-1/2 rounded-full bg-pearl shadow-[0_0_0_3px_rgba(4,5,7,0.7)]"
                        style={{ left: `${Math.max(2, Math.min(98, bandPosition * 100))}%` }}
                      />
                    ) : null}
                  </div>
                  <div className="mt-2.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[10px]">
                    {bands.map((entry) => (
                      <span
                        key={entry.label}
                        title={`${entry.min}–${entry.max}: ${entry.guidance}`}
                        className={entry.label === band.label ? "font-semibold text-ink" : "muted-dim"}
                      >
                        {entry.label}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="muted mt-4 max-w-[62ch] text-[12px] leading-relaxed">{band.guidance}</p>
              </div>

              <div className="min-w-0">
                <dl className="space-y-3.5">
                  <div className="rule pt-3.5">
                    <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Peak in window</dt>
                    <dd className="tnum mt-1.5 flex items-baseline gap-1.5 text-[30px] leading-none font-semibold text-ink">
                      {peak && peak.value !== null ? formatNumber(peak.value, 0) : "—"}
                      <span className="muted text-[11px] font-medium">index</span>
                    </dd>
                    <p className="muted mt-1 text-[11px]">
                      {peak ? `${peak.date} around ${peak.label}` : "No hourly index in this window"}
                    </p>
                  </div>
                  <div className="rule pt-3.5">
                    <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Worst pollutant</dt>
                    <dd className="mt-1.5 flex items-baseline gap-2 text-[30px] leading-none font-semibold text-ink">
                      {peakPollutant ? peakPollutant.symbol : "—"}
                    </dd>
                    <p className="muted mt-1 text-[11px]">
                      {peakPollutant
                        ? `${formatNumber(peakPollutant.ratio * 100, 0)}% of the ${peakPollutant.referenceLabel}`
                        : "No pollutant values returned"}
                    </p>
                  </div>
                  <div className="rule pt-3.5">
                    <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">
                      {scale === "us" ? "European" : "US"} index at this point
                    </dt>
                    <dd className="tnum mt-1.5 flex items-baseline gap-1.5 text-[30px] leading-none font-semibold text-ink">
                      {otherAqi === null ? "—" : formatNumber(otherAqi, 0)}
                      <span className="muted text-[11px] font-medium">index</span>
                    </dd>
                    <p className="muted mt-1 text-[11px]">
                      Returned by the same model run on the other published scale.
                    </p>
                  </div>
                </dl>
              </div>
            </div>
          )}

          <DataStamp
            lastUpdated={air.lastUpdated}
            stale={air.stale}
            refreshing={air.refreshing}
            staleLabel="Air quality reading is older than expected."
          />
          <SourceNote>
            {air.data.attribution} · current values timestamped{" "}
            {air.data.current?.time ? `${air.data.current.time} (${air.data.timezone})` : "not supplied"}
          </SourceNote>
        </section>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="grid gap-x-8 gap-y-5 rounded-[26px] border border-line/60 bg-white/[0.022] px-5 py-5 sm:grid-cols-2 sm:px-7 xl:grid-cols-4">
          <MetricTile
            label="PM₂.₅"
            icon={<Atom className="h-3.5 w-3.5" />}
            value={readCurrent("pm2_5") === null ? "—" : formatNumber(readCurrent("pm2_5"), 1)}
            unit={readCurrent("pm2_5") === null ? undefined : "µg/m³"}
            detail={
              readCurrent("pm2_5") === null
                ? "Not returned"
                : `${formatNumber(((readCurrent("pm2_5") ?? 0) / 15) * 100, 0)}% of the WHO 24-hour guideline`
            }
            info="Fine particulate matter with a diameter under 2.5 µm, the pollutant most closely linked to health effects. Guideline: 15 µg/m³ as a 24-hour mean."
          />
          <MetricTile
            label="PM₁₀"
            icon={<Atom className="h-3.5 w-3.5" />}
            value={readCurrent("pm10") === null ? "—" : formatNumber(readCurrent("pm10"), 0)}
            unit={readCurrent("pm10") === null ? undefined : "µg/m³"}
            detail={
              readCurrent("pm10") === null
                ? "Not returned"
                : `${formatNumber(((readCurrent("pm10") ?? 0) / 45) * 100, 0)}% of the WHO 24-hour guideline`
            }
            info="Coarse particulate matter with a diameter under 10 µm. Guideline: 45 µg/m³ as a 24-hour mean."
          />
          <MetricTile
            label="UV index"
            icon={<Waves className="h-3.5 w-3.5" />}
            value={uv ? formatNumber(readCurrent("uv_index"), 0) : "—"}
            accent={uv ? TONE_COLORS[uv.tone] : undefined}
            detail={uv ? uv.label : "Not returned for this location"}
            info="UV index from the same CAMS model run as the air quality values."
          />
          <MetricTile
            label="Aerosol optical depth"
            icon={<Waves className="h-3.5 w-3.5" />}
            value={aerosol === null ? "—" : formatNumber(aerosol, 2)}
            detail={aerosol === null ? "Not returned" : "Column extinction of sunlight by aerosols"}
            info="A unitless measure of how much sunlight is blocked by airborne particles through the whole atmospheric column."
          />
        </section>
      </Reveal>

      <Reveal delay={0.09}>
        <section className="glass-pearl relative overflow-hidden rounded-[30px] px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <p className="text-[9.5px] font-semibold tracking-[0.22em] text-[#5a616d] uppercase">Pollutant breakdown</p>
              <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.01em] text-[#12141a]">
                Current concentrations against WHO guideline values
              </h2>
            </div>
            {peakPollutant ? (
              <p className="max-w-[42ch] text-[11.5px] leading-relaxed text-[#5a616d]">
                {peakPollutant.label} is the highest reading here, at{" "}
                {formatNumber(peakPollutant.ratio * 100, 0)}% of its guideline.
              </p>
            ) : null}
          </div>

          {pollutants.length === 0 ? (
            <p className="mt-5 text-xs text-[#5a616d]">
              The model did not return individual pollutant concentrations for these coordinates, so a breakdown cannot be drawn.
            </p>
          ) : (
            <div className="pearl-rule mt-6 grid gap-x-12 gap-y-6 pt-6 sm:grid-cols-2">
              {pollutants.map((row) => (
                <div key={row.key}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[12.5px] font-semibold text-[#12141a]" title={row.description}>
                      {row.label}
                      <span className="ml-2 text-[11px] font-medium text-[#5a616d]">{row.symbol}</span>
                    </span>
                    <span className="tnum text-[15px] font-semibold text-[#12141a]">
                      {formatNumber(row.value, row.value < 10 ? 1 : 0)}
                      <span className="ml-1 text-[10.5px] font-medium text-[#5a616d]">{row.unit}</span>
                    </span>
                  </div>
                  <div className="mt-2.5 h-[5px] w-full overflow-hidden rounded-full bg-[rgba(12,14,20,0.1)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${Math.min(100, row.ratio * 100)}%`, background: row.lightColor }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-[#5a616d]">
                    {formatNumber(row.ratio * 100, 0)}% of the {row.referenceLabel} ({formatNumber(row.reference, 0)} {row.unit})
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="pearl-rule mt-6 pt-4 text-[10.5px] leading-relaxed text-[#5a616d]">
            Guideline values are the WHO global air quality guidelines; concentrations come from the CAMS ensemble and are model
            output on a grid, not measurements from a physical monitoring station.
          </p>
        </section>
      </Reveal>

      <Reveal delay={0.13}>
        <section className="rule pt-6">
          <PanelHeader
            title="Index forecast"
            subtitle="Only the hours returned by the provider are charted; the solid line is the observed window and the dashed line is modelled forecast."
            icon={<Activity className="h-4 w-4" />}
            action={
              rangeOptions.length > 1 ? (
                <Segmented
                  value={range}
                  onChange={setRange}
                  size="sm"
                  ariaLabel="Air quality chart range"
                  options={rangeOptions.map((option) => ({ value: option, label: `${option}h`, title: `Show ${option} hours` }))}
                />
              ) : null
            }
          />
          {chartData.length === 0 ? (
            <div className="mt-4">
              <UnavailableState
                title="No hourly index returned"
                message="The provider did not include hourly air quality values for these coordinates, so no forecast chart is available. Current values above are shown exactly as returned."
              />
            </div>
          ) : (
            <>
              <div className="mt-4 h-[268px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 10, bottom: 0, left: -12 }}>
                    <defs>
                      <linearGradient id="aq-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={band?.color ?? "#8ce7f5"} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={band?.color ?? "#8ce7f5"} stopOpacity={0.015} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.055)" />
                    <XAxis
                      dataKey="label"
                      interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
                      tick={{ fill: "#8c93a0", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#8c93a0", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={38}
                      domain={["dataMin - 5", "dataMax + 5"]}
                    />
                    <Tooltip cursor={{ stroke: "rgba(255,255,255,0.28)", strokeWidth: 1 }} content={<AirTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name={SCALE_LABELS[scale]}
                      stroke="none"
                      fill="url(#aq-area)"
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="valueObs"
                      name="Observed"
                      stroke="#f7f8fa"
                      strokeWidth={2.2}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="valueFc"
                      name="Forecast"
                      stroke={band?.color ?? "#8ce7f5"}
                      strokeWidth={2.2}
                      strokeDasharray="5 4"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="muted-dim mt-3 flex flex-wrap items-center gap-4 text-[10.5px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-[2px] w-5 rounded-full bg-pearl" /> Observed window
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-[2px] w-5 rounded-full"
                    style={{
                      backgroundImage: `repeating-linear-gradient(90deg,${band?.color ?? "#8ce7f5"} 0 4px,transparent 4px 7px)`,
                    }}
                  />{" "}
                  Forecast
                </span>
                <span>Timestamps are local to {air.data.timezone}</span>
              </div>
            </>
          )}
        </section>
      </Reveal>

      <Reveal delay={0.17}>
        <section className="rule pt-6">
          <PanelHeader
            title="Model detail"
            subtitle="Extra variables returned by the same air quality request."
            icon={<Gauge className="h-4 w-4" />}
          />
          <div className="mt-4 grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ProgressRow
              label="PM₂.₅ share of WHO guideline"
              value={readCurrent("pm2_5")}
              max={60}
              display={readCurrent("pm2_5") === null ? "—" : `${formatNumber(((readCurrent("pm2_5") ?? 0) / 15) * 100, 0)}%`}
              color="linear-gradient(90deg,#f7f8fa,#8c93a0)"
              info="Current PM2.5 divided by the WHO 24-hour guideline of 15 µg/m³. The bar is capped at four times the guideline."
            />
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
              <MetricTile
                label="Dust"
                icon={<Atom className="h-3.5 w-3.5" />}
                value={dust === null ? "—" : formatNumber(dust, dust < 10 ? 1 : 0)}
                unit={dust === null ? undefined : "µg/m³"}
                detail={dust === null ? "Not returned" : "Desert dust fraction of particulate matter"}
                info="Desert dust concentration returned by the CAMS model."
              />
              <MetricTile
                label="Ozone"
                icon={<Leaf className="h-3.5 w-3.5" />}
                value={readCurrent("ozone") === null ? "—" : formatNumber(readCurrent("ozone"), 0)}
                unit={readCurrent("ozone") === null ? undefined : "µg/m³"}
                detail="Ground-level ozone from the same model run"
                info="Ground-level ozone, which peaks on sunny afternoons when traffic and industrial emissions react in sunlight."
              />
              <MetricTile
                label="Nitrogen dioxide"
                icon={<Atom className="h-3.5 w-3.5" />}
                value={readCurrent("nitrogen_dioxide") === null ? "—" : formatNumber(readCurrent("nitrogen_dioxide"), 1)}
                unit={readCurrent("nitrogen_dioxide") === null ? undefined : "µg/m³"}
                detail={
                  readCurrent("nitrogen_dioxide") === null
                    ? "Not returned"
                    : `${formatNumber(((readCurrent("nitrogen_dioxide") ?? 0) / 25) * 100, 0)}% of the WHO 24-hour guideline`
                }
                info="Nitrogen dioxide, mostly from traffic and combustion. Guideline: 25 µg/m³ as a 24-hour mean."
              />
            </div>
          </div>
          <SourceNote>
            Values are model output on a grid, not measurements from a physical monitoring station. Local street-level conditions can
            differ.
          </SourceNote>
        </section>
      </Reveal>
    </div>
  );
}
