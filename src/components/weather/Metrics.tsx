"use client";

import { InfoHint } from "@/components/ui/Controls";

export function MetricTile({
  label,
  value,
  unit,
  detail,
  info,
  icon,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  info?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="border-line/70 flex flex-col border-b pb-3 last:border-0 sm:pb-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="muted-dim flex items-center gap-1.5 text-[9.5px] font-semibold tracking-[0.2em] uppercase">
          {icon}
          {label}
        </span>
        {info ? <InfoHint label={`About ${label}`}>{info}</InfoHint> : null}
      </div>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span
          className="tnum text-[26px] leading-none font-semibold tracking-[-0.02em]"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </span>
        {unit ? <span className="muted text-[11.5px] font-medium">{unit}</span> : null}
      </p>
      {detail ? <p className="muted mt-1 text-[11px] leading-snug">{detail}</p> : null}
    </div>
  );
}

export function WindCompass({
  direction,
  label,
  speedLabel,
  gustLabel,
  unit,
}: {
  direction: number | null;
  label: string;
  speedLabel: string;
  gustLabel: string | null;
  unit: string;
}) {
  const rotation = direction === null ? 0 : direction;
  return (
    <div className="flex flex-col gap-3">
      <div className="relative grid h-32 w-32 place-items-center self-center">
        <span className="muted-dim absolute top-0 text-[9px] font-bold tracking-[0.1em]">N</span>
        <span className="muted-dim absolute right-0 text-[9px] tracking-[0.1em]">E</span>
        <span className="muted-dim absolute bottom-0 text-[9px] font-bold tracking-[0.1em]">S</span>
        <span className="muted-dim absolute left-0 text-[9px] tracking-[0.1em]">W</span>
        <span className="absolute inset-3 rounded-full border border-line" />
        <span className="absolute inset-6 rounded-full border border-dashed border-line" />
        <svg
          viewBox="0 0 40 40"
          className="absolute inset-0 h-full w-full"
          style={{ transform: `rotate(${rotation}deg)`, transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)" }}
        >
          <path d="M20 5.5l4.6 13.5-4.6-2.9-4.6 2.9z" fill="#8ce7f5" />
          <path d="M20 34.5l-4.6-13.5 4.6 2.9 4.6-2.9z" fill="rgba(255,255,255,0.22)" />
        </svg>
        <span className="tnum text-[19px] font-semibold text-ink">
          {speedLabel}
          <span className="muted ml-1 text-[10px] font-medium">{unit}</span>
        </span>
      </div>
      <div className="text-center">
        <p className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Wind</p>
        <p className="mt-1 text-[12.5px] font-semibold text-ink-soft">
          From {label}
          {direction !== null ? ` · ${Math.round(direction)}°` : ""}
        </p>
        {gustLabel ? (
          <p className="muted-dim mt-0.5 text-[11px]">
            Gusts {gustLabel} {unit}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SunArc({
  sunrise,
  sunset,
  now,
  progress,
  lockedLabel,
  tone = "dark",
}: {
  sunrise: string;
  sunset: string;
  now: string;
  progress: number | null;
  lockedLabel: string;
  tone?: "dark" | "light";
}) {
  const clamped = progress === null ? null : Math.max(0, Math.min(1, progress));
  const angle = clamped === null ? null : Math.PI * clamped;
  const x = angle === null ? null : 50 - Math.cos(angle) * 42;
  const y = angle === null ? null : 60 - Math.sin(angle) * 46;
  const light = tone === "light";
  const track = light ? "rgba(12,14,20,0.16)" : "rgba(255,255,255,0.16)";
  const baseline = light ? "rgba(12,14,20,0.2)" : "rgba(255,255,255,0.2)";
  const sun = light ? "#c98a2c" : "#e8c583";
  const sunGlow = light ? "rgba(201,138,44,0.18)" : "rgba(232,197,131,0.18)";
  return (
    <div>
      <svg viewBox="0 0 100 70" className="h-[104px] w-full">
        <defs>
          <linearGradient id={`sun-arc-${tone}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={sun} stopOpacity="0.2" />
            <stop offset="50%" stopColor={sun} stopOpacity="0.95" />
            <stop offset="100%" stopColor={sun} stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path d="M8 60 A 42 46 0 0 1 92 60" fill="none" stroke={track} strokeWidth="1.4" strokeDasharray="4 4" />
        {clamped !== null ? (
          <path
            d="M8 60 A 42 46 0 0 1 92 60"
            fill="none"
            stroke={`url(#sun-arc-${tone})`}
            strokeWidth="2"
            pathLength={1}
            style={{ strokeDasharray: `${clamped} 1` }}
          />
        ) : null}
        <line x1="6" y1="60" x2="94" y2="60" stroke={baseline} strokeWidth="1" />
        {x !== null && y !== null ? (
          <>
            <circle cx={x} cy={y} r="9" fill={sunGlow} />
            <circle cx={x} cy={y} r="4.4" fill={sun} />
          </>
        ) : null}
      </svg>
      <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="muted-dim text-[9.5px] font-semibold tracking-[0.16em] uppercase">Sunrise</p>
          <p className="tnum mt-1 text-[13px] font-semibold text-ink">{sunrise}</p>
        </div>
        <div>
          <p className="muted-dim text-[9.5px] font-semibold tracking-[0.16em] uppercase">Local time</p>
          <p className={`tnum mt-1 text-[13px] font-semibold ${light ? "text-[#0d7a8c]" : "text-cyan"}`}>{now}</p>
        </div>
        <div>
          <p className="muted-dim text-[9.5px] font-semibold tracking-[0.16em] uppercase">Sunset</p>
          <p className="tnum mt-1 text-[13px] font-semibold text-ink">{sunset}</p>
        </div>
      </div>
      {clamped === null ? <p className="muted-dim mt-2 text-center text-[10.5px]">{lockedLabel}</p> : null}
    </div>
  );
}

export function ProgressRow({
  label,
  value,
  max,
  display,
  color,
  info,
}: {
  label: string;
  value: number | null;
  max: number;
  display: string;
  color: string;
  info?: React.ReactNode;
}) {
  const percent = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="muted flex items-center gap-1.5 text-[11px] font-medium">
          {label}
          {info ? <InfoHint label={`About ${label}`}>{info}</InfoHint> : null}
        </span>
        <span className="tnum text-[11px] font-semibold text-ink-soft">{display}</span>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.09]">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}
