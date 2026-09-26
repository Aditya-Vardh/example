"use client";

import { motion, useReducedMotion } from "motion/react";
import { CloudRain, Droplets, Snowflake, Wind } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useUnits } from "@/components/providers/UnitsProvider";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import type { DayPoint, HourPoint } from "@/lib/forecast";
import { dateLabel, dayLabel, hourLabel, isSameZoneDay, shortHourLabel } from "@/lib/time";
import { compassPoint, formatNumber } from "@/lib/units";
import { conditionLabel, iconVariant } from "@/lib/wmo";

function useRailDrag(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 });
  const [dragging, setDragging] = useState(false);

  const end = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
  };

  return {
    ref,
    dragging,
    suppressClick: () => {
      if (drag.current.moved <= 5) return false;
      drag.current.moved = 0;
      return true;
    },
    handlers: {
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        const node = ref.current;
        if (!enabled || event.pointerType !== "mouse" || !node) return;
        drag.current = { active: true, startX: event.clientX, startScroll: node.scrollLeft, moved: 0 };
        setDragging(true);
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        const node = ref.current;
        if (!drag.current.active || !node) return;
        const delta = event.clientX - drag.current.startX;
        drag.current.moved = Math.max(drag.current.moved, Math.abs(delta));
        node.scrollLeft = drag.current.startScroll - delta;
      },
      onPointerUp: end,
      onPointerLeave: end,
      onPointerCancel: end,
    },
  };
}

function useTilt(disabled: boolean) {
  const reset = (node: HTMLElement) => {
    node.style.setProperty("--tilt-x", "0deg");
    node.style.setProperty("--tilt-y", "0deg");
  };
  if (disabled) return { className: "", onPointerMove: undefined, onPointerLeave: undefined };
  return {
    className: "tilt",
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const node = event.currentTarget;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      node.style.setProperty("--tilt-y", `${((event.clientX - rect.left) / rect.width - 0.5) * 7}deg`);
      node.style.setProperty("--tilt-x", `${-((event.clientY - rect.top) / rect.height - 0.5) * 8}deg`);
    },
    onPointerLeave: (event: React.PointerEvent<HTMLElement>) => reset(event.currentTarget),
  };
}

function useRailProgress(nodeRef: React.RefObject<HTMLDivElement | null>) {
  const [progress, setProgress] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const update = () => {
      const max = node.scrollWidth - node.clientWidth;
      setScrollable(max > 6);
      setProgress(max > 6 ? node.scrollLeft / max : 0);
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [nodeRef]);
  return { progress, scrollable };
}

function RailScrubber({ nodeRef, railId }: { nodeRef: React.RefObject<HTMLDivElement | null>; railId: string }) {
  const { progress, scrollable } = useRailProgress(nodeRef);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef(false);
  const reduced = useReducedMotion();

  const scrubTo = (clientX: number) => {
    const node = nodeRef.current;
    const track = trackRef.current;
    if (!node || !track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    node.scrollLeft = ratio * (node.scrollWidth - node.clientWidth);
  };

  if (!scrollable) return null;

  return (
    <div
      ref={trackRef}
      role="scrollbar"
      aria-controls={railId}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-label="Scroll this forecast rail"
      tabIndex={0}
      onPointerDown={(event) => {
        pointer.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrubTo(event.clientX);
      }}
      onPointerMove={(event) => {
        if (pointer.current) scrubTo(event.clientX);
      }}
      onPointerUp={(event) => {
        pointer.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        const node = nodeRef.current;
        if (!node) return;
        if (event.key === "ArrowRight") node.scrollLeft += 160;
        if (event.key === "ArrowLeft") node.scrollLeft -= 160;
      }}
      className="group/scrub focus-ring relative mt-1.5 flex h-4 cursor-pointer items-center"
    >
      <span className="h-px w-full rounded-full bg-white/10">
        <span
          className="block h-px rounded-full bg-white/35"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </span>
      <span
        aria-hidden
        className={`absolute top-1/2 h-2.5 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-[rgba(12,15,20,0.9)] transition-opacity ${
          reduced ? "" : "transition-transform duration-150"
        }`}
        style={{ left: `calc(18px + ${progress} * (100% - 36px))` }}
      />
    </div>
  );
}

function Rail({ children, className = "", enabled }: { children: React.ReactNode; className?: string; enabled: boolean }) {
  const drag = useRailDrag(enabled);
  const railId = useId();
  return (
    <div className={className}>
      <div
        ref={drag.ref}
        id={railId}
        {...drag.handlers}
        onClickCapture={(event) => {
          if (drag.suppressClick()) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className={`snap-rail no-scrollbar rail-mask -mx-1 flex gap-2.5 overflow-x-auto px-1 pt-1 pb-1 select-none ${
          drag.dragging ? "cursor-grabbing" : enabled ? "cursor-grab" : ""
        }`}
      >
        {children}
      </div>
      <RailScrubber nodeRef={drag.ref} railId={railId} />
    </div>
  );
}

function WindMark({ direction, speed, unit }: { direction: number | null; speed: string; unit: string }) {
  return (
    <span className="muted-dim inline-flex items-center gap-1 text-[10px]">
      {direction !== null ? (
        <svg viewBox="0 0 12 12" aria-hidden className="h-2.5 w-2.5" style={{ transform: `rotate(${direction}deg)` }}>
          <path d="M6 1l2.6 7L6 6.2 3.4 8z" fill="currentColor" />
        </svg>
      ) : (
        <Wind aria-hidden className="h-2.5 w-2.5" />
      )}
      <span className="tnum">
        {speed} {unit}
      </span>
    </span>
  );
}

function Precip({ chance, amount, unit }: { chance: number | null; amount: number | null; unit: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Droplets aria-hidden className="h-2.5 w-2.5 text-cyan" />
      <span className="tnum text-[10px] text-ink-soft">{chance === null ? "—" : `${formatNumber(chance, 0)}%`}</span>
      {amount !== null && amount > 0 ? (
        <span className="tnum muted-dim text-[10px]">
          {formatNumber(amount, 1)}
          {unit}
        </span>
      ) : null}
    </span>
  );
}

export function HourlyRail({
  hours,
  timeZone,
  selectedIso,
  onSelect,
  isDayAt,
  nowIndexIso = null,
  className = "",
}: {
  hours: HourPoint[];
  timeZone?: string;
  selectedIso: string | null;
  onSelect: (hour: HourPoint) => void;
  isDayAt: (epoch: number | null) => boolean;
  nowIndexIso?: string | null;
  className?: string;
}) {
  const { units, convert, symbol } = useUnits();
  const reduced = useReducedMotion();
  const tilt = useTilt(Boolean(reduced));

  return (
    <Rail className={className} enabled={!reduced}>
      {hours.map((hour, position) => {
        const active = selectedIso === hour.iso;
        const snowing = (hour.snowfall ?? 0) > 0;
        const wet = (hour.precipProbability ?? 0) >= 35 || (hour.precipitation ?? 0) > 0;
        const isNow = hour.iso === nowIndexIso;
        const daylight = isDayAt(hour.epoch);
        return (
          <motion.button
            key={hour.iso}
            type="button"
            onClick={() => onSelect(hour)}
            aria-pressed={active}
            aria-label={`${dateLabel(hour.epoch, timeZone)} ${hourLabel(hour.epoch, timeZone, units.hour12)} — ${conditionLabel(hour.weatherCode)}, ${formatNumber(convert.temp(hour.temperature), 0)}${symbol.temp}`}
            title={`${dateLabel(hour.epoch, timeZone)} ${hourLabel(hour.epoch, timeZone, units.hour12)} — ${conditionLabel(hour.weatherCode)}`}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: Math.min(position, 10) * 0.025, ease: [0.22, 1, 0.36, 1] }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            {...tilt}
            className={`focus-ring snap-item group/hour relative flex shrink-0 flex-col items-center gap-2 overflow-hidden rounded-[22px] border px-2 pt-3 pb-2.5 transition ${
              isNow ? "w-[128px]" : "w-[104px]"
            } ${
              active
                ? "border-cyan/45 bg-[linear-gradient(180deg,rgba(140,231,245,0.14),rgba(140,231,245,0.03))]"
                : daylight
                  ? "border-line/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.015))] hover:border-white/25"
                  : "border-line/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.008))] hover:border-white/20"
            }`}
          >
            {wet ? (
              <span
                aria-hidden
                className="absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(140,231,245,0.75),transparent)]"
              />
            ) : null}
            <span
              className={`text-[10px] font-semibold tracking-[0.08em] uppercase ${
                isNow ? "text-cyan" : hour.isForecast ? "text-ink-soft" : "text-mint"
              }`}
            >
              {isNow ? "Now" : shortHourLabel(hour.epoch, timeZone, units.hour12)}
            </span>
            <WeatherIcon variant={iconVariant(hour.weatherCode, daylight)} size={isNow ? 38 : 30} animate={active || isNow} />
            <span className={`tnum leading-none font-semibold text-ink ${isNow ? "text-[24px]" : "text-[17px]"}`}>
              {formatNumber(convert.temp(hour.temperature), 0)}
              <span className="text-[11px] font-medium text-ink-soft">{symbol.temp}</span>
            </span>
            <span className="text-[10px] leading-none text-ink-soft/80">{conditionLabel(hour.weatherCode)}</span>
            <Precip chance={hour.precipProbability} amount={convert.precip(hour.precipitation)} unit={symbol.precip} />
            <WindMark direction={hour.windDirection} speed={formatNumber(convert.wind(hour.windSpeed), 0)} unit={symbol.wind} />
            {snowing ? (
              <span className="muted-dim inline-flex items-center gap-1 text-[10px]">
                <Snowflake aria-hidden className="h-2.5 w-2.5" />
                <span className="tnum">{formatNumber(hour.snowfall, 1)}cm</span>
              </span>
            ) : null}
          </motion.button>
        );
      })}
    </Rail>
  );
}

export function DailyRail({
  days,
  timeZone,
  selectedIso,
  onSelect,
  bounds,
  className = "",
}: {
  days: DayPoint[];
  timeZone?: string;
  selectedIso: string | null;
  onSelect: (day: DayPoint) => void;
  bounds: { min: number; max: number } | null;
  className?: string;
}) {
  const { convert, symbol } = useUnits();
  const reduced = useReducedMotion();
  const tilt = useTilt(Boolean(reduced));
  const now = Date.now();

  return (
    <Rail className={className} enabled={!reduced}>
      {days.map((day, position) => {
        const active = selectedIso === day.iso;
        const low = convert.temp(day.tempMin);
        const high = convert.temp(day.tempMax);
        const left = bounds && low !== null ? ((low - bounds.min) / (bounds.max - bounds.min)) * 100 : 0;
        const width = bounds && low !== null && high !== null ? Math.max(5, ((high - low) / (bounds.max - bounds.min)) * 100) : 0;
        const todayCard = isSameZoneDay(day.epoch ?? now, now, timeZone);
        const wet = (day.precipProbabilityMax ?? 0) >= 40;
        return (
          <motion.button
            key={day.iso}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={active}
            aria-label={`${dayLabel(day.epoch, timeZone, "long")} ${dateLabel(day.epoch, timeZone)} — ${conditionLabel(day.weatherCode)}, high ${formatNumber(high, 0)}${symbol.temp}, low ${formatNumber(low, 0)}${symbol.temp}`}
            title={`${dayLabel(day.epoch, timeZone, "long")} ${dateLabel(day.epoch, timeZone)} — ${conditionLabel(day.weatherCode)}`}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: Math.min(position, 10) * 0.03, ease: [0.22, 1, 0.36, 1] }}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            {...tilt}
            className={`focus-ring snap-item relative flex shrink-0 flex-col gap-2.5 overflow-hidden rounded-[22px] border px-3.5 pt-3.5 pb-3 text-left transition ${
              todayCard ? "w-[190px]" : "w-[166px]"
            } ${
              active
                ? "border-cyan/45 bg-[linear-gradient(170deg,rgba(140,231,245,0.13),rgba(255,255,255,0.02))]"
                : wet
                  ? "border-line bg-[linear-gradient(170deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015))] hover:border-cyan/30"
                  : "border-line/75 bg-[linear-gradient(170deg,rgba(255,255,255,0.06),rgba(255,255,255,0.012))] hover:border-white/25"
            }`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-ink-soft">
                  {todayCard ? "Today" : dayLabel(day.epoch, timeZone, "short")}
                </span>
                <span className="muted-dim block text-[10px]">{dateLabel(day.epoch, timeZone)}</span>
              </span>
              <WeatherIcon variant={iconVariant(day.weatherCode, true)} size={todayCard ? 38 : 30} animate={active || todayCard} />
            </span>

            <span className="flex items-baseline gap-1.5">
              <span className={`tnum leading-none font-semibold text-ink ${todayCard ? "text-[26px]" : "text-[20px]"}`}>
                {formatNumber(high, 0)}
                <span className="text-[11px] font-medium text-ink-soft">{symbol.temp}</span>
              </span>
              <span className="muted tnum text-[12px]">/ {formatNumber(low, 0)}°</span>
            </span>

            <span className="relative block h-px w-full overflow-visible bg-white/10">
              {bounds ? (
                <span
                  className="absolute -top-[2px] h-[5px] rounded-full"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: wet
                      ? "linear-gradient(90deg,rgba(140,231,245,0.45),#8ce7f5)"
                      : "linear-gradient(90deg,rgba(255,255,255,0.4),rgba(232,197,131,0.9))",
                  }}
                />
              ) : null}
            </span>

            <span className="flex items-center justify-between gap-2">
              <Precip chance={day.precipProbabilityMax} amount={convert.precip(day.precipitationSum)} unit={symbol.precip} />
              <WindMark direction={day.windDirection} speed={formatNumber(convert.wind(day.windMax), 0)} unit={symbol.wind} />
            </span>

            <span className="muted-dim flex items-center gap-1 text-[10px]">
              <CloudRain aria-hidden className="h-2.5 w-2.5" />
              <span className="truncate">{conditionLabel(day.weatherCode)}</span>
              {day.windDirection !== null ? <span className="sr-only">{compassPoint(day.windDirection)}</span> : null}
            </span>
          </motion.button>
        );
      })}
    </Rail>
  );
}
