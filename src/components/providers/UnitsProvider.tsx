"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  DEFAULT_UNITS,
  IMPERIAL_UNITS,
  convertDistance,
  convertPrecip,
  convertPressure,
  convertTemp,
  convertWind,
  distanceSymbol,
  precipSymbol,
  pressureSymbol,
  tempSymbol,
  windSymbol,
  type UnitPrefs,
} from "@/lib/units";

type UnitsContextValue = {
  units: UnitPrefs;
  setUnit: <K extends keyof UnitPrefs>(key: K, value: UnitPrefs[K]) => void;
  applyPreset: (preset: "metric" | "imperial") => void;
  convert: {
    temp: (celsius: unknown) => number | null;
    wind: (kmh: unknown) => number | null;
    precip: (mm: unknown) => number | null;
    pressure: (hpa: unknown) => number | null;
    distance: (km: unknown) => number | null;
  };
  symbol: { temp: string; wind: string; precip: string; pressure: string; distance: string };
};

const UnitsContext = createContext<UnitsContextValue | null>(null);

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnits] = useState<UnitPrefs>(DEFAULT_UNITS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUnits(readStorage<UnitPrefs>(STORAGE_KEYS.units, DEFAULT_UNITS));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStorage(STORAGE_KEYS.units, units);
  }, [units, hydrated]);

  const setUnit = useCallback<UnitsContextValue["setUnit"]>((key, value) => {
    setUnits((current) => ({ ...current, [key]: value }));
  }, []);

  const applyPreset = useCallback((preset: "metric" | "imperial") => {
    setUnits(preset === "imperial" ? IMPERIAL_UNITS : DEFAULT_UNITS);
  }, []);

  const value = useMemo<UnitsContextValue>(
    () => ({
      units,
      setUnit,
      applyPreset,
      convert: {
        temp: (celsius) => convertTemp(celsius, units.temperature),
        wind: (kmh) => convertWind(kmh, units.wind),
        precip: (mm) => convertPrecip(mm, units.precipitation),
        pressure: (hpa) => convertPressure(hpa, units.pressure),
        distance: (km) => convertDistance(km, units.distance),
      },
      symbol: {
        temp: tempSymbol(units.temperature),
        wind: windSymbol(units.wind),
        precip: precipSymbol(units.precipitation),
        pressure: pressureSymbol(units.pressure),
        distance: distanceSymbol(units.distance),
      },
    }),
    [units, setUnit, applyPreset]
  );

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextValue {
  const context = useContext(UnitsContext);
  if (!context) throw new Error("useUnits must be used inside UnitsProvider");
  return context;
}
