"use client";

import { Settings2 } from "lucide-react";
import { useUnits } from "@/components/providers/UnitsProvider";
import { Popover } from "@/components/ui/Popover";
import { Segmented, Toggle } from "@/components/ui/Controls";
import {
  DISTANCE_UNITS,
  PRECIP_UNITS,
  PRESSURE_UNITS,
  TEMP_UNITS,
  WIND_UNITS,
  type DistanceUnit,
  type PrecipUnit,
  type PressureUnit,
  type TempUnit,
  type WindUnit,
} from "@/lib/units";

function toOptions<T extends string>(units: Array<{ id: T; label: string }>) {
  return units.map((unit) => ({ value: unit.id, label: unit.label, title: unit.label }));
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-line/70 flex flex-col gap-2 border-b py-2.5 last:border-0">
      <div>
        <p className="text-xs font-semibold text-ink-soft">{label}</p>
        {hint ? <p className="muted-dim mt-0.5 text-[10.5px]">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function UnitSettings({ compact = false }: { compact?: boolean }) {
  const { units, setUnit, applyPreset } = useUnits();

  return (
    <Popover
      label="Units"
      title="Units and formats"
      icon={<Settings2 aria-hidden className="h-4 w-4" />}
      compact={compact}
    >
      <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-soft uppercase">Measurement preset</p>
      <div className="mt-2">
        <Segmented
          ariaLabel="Measurement preset"
          value={units.temperature === "f" && units.wind === "mph" ? "imperial" : "metric"}
          onChange={(value) => applyPreset(value)}
          options={[
            { value: "metric", label: "Metric", title: "Celsius, km/h, mm, hPa" },
            { value: "imperial", label: "Imperial", title: "Fahrenheit, mph, inches, inHg" },
          ]}
        />
      </div>
      <div className="mt-2">
        <Row label="Temperature">
          <Segmented
            ariaLabel="Temperature unit"
            size="sm"
            value={units.temperature}
            onChange={(value) => setUnit("temperature", value as TempUnit)}
            options={toOptions(TEMP_UNITS)}
          />
        </Row>
        <Row label="Wind speed">
          <Segmented
            ariaLabel="Wind unit"
            size="sm"
            value={units.wind}
            onChange={(value) => setUnit("wind", value as WindUnit)}
            options={toOptions(WIND_UNITS)}
          />
        </Row>
        <Row label="Precipitation">
          <Segmented
            ariaLabel="Precipitation unit"
            size="sm"
            value={units.precipitation}
            onChange={(value) => setUnit("precipitation", value as PrecipUnit)}
            options={toOptions(PRECIP_UNITS)}
          />
        </Row>
        <Row label="Pressure">
          <Segmented
            ariaLabel="Pressure unit"
            size="sm"
            value={units.pressure}
            onChange={(value) => setUnit("pressure", value as PressureUnit)}
            options={toOptions(PRESSURE_UNITS)}
          />
        </Row>
        <Row label="Distance">
          <Segmented
            ariaLabel="Distance unit"
            size="sm"
            value={units.distance}
            onChange={(value) => setUnit("distance", value as DistanceUnit)}
            options={toOptions(DISTANCE_UNITS)}
          />
        </Row>
        <div className="py-2.5">
          <Toggle
            label="24-hour clock"
            hint="Use 24-hour local time instead of AM/PM."
            checked={!units.hour12}
            onChange={(value) => setUnit("hour12", !value)}
          />
        </div>
      </div>
      <p className="muted-dim mt-1 text-[10.5px] leading-relaxed">
        Unit changes apply instantly across every reading, chart and map legend. They are stored in this browser only.
      </p>
    </Popover>
  );
}
