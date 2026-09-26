export type TempUnit = "c" | "f";
export type WindUnit = "kmh" | "mph" | "ms" | "kn";
export type PrecipUnit = "mm" | "in";
export type PressureUnit = "hpa" | "inhg";
export type DistanceUnit = "km" | "mi";

export type UnitPrefs = {
  temperature: TempUnit;
  wind: WindUnit;
  precipitation: PrecipUnit;
  pressure: PressureUnit;
  distance: DistanceUnit;
  hour12: boolean;
};

export const DEFAULT_UNITS: UnitPrefs = {
  temperature: "c",
  wind: "kmh",
  precipitation: "mm",
  pressure: "hpa",
  distance: "km",
  hour12: false,
};

export const IMPERIAL_UNITS: UnitPrefs = {
  temperature: "f",
  wind: "mph",
  precipitation: "in",
  pressure: "inhg",
  distance: "mi",
  hour12: true,
};

export const TEMP_UNITS: Array<{ id: TempUnit; label: string; short: string }> = [
  { id: "c", label: "Celsius", short: "°C" },
  { id: "f", label: "Fahrenheit", short: "°F" },
];

export const WIND_UNITS: Array<{ id: WindUnit; label: string; short: string }> = [
  { id: "kmh", label: "Kilometres per hour", short: "km/h" },
  { id: "mph", label: "Miles per hour", short: "mph" },
  { id: "ms", label: "Metres per second", short: "m/s" },
  { id: "kn", label: "Knots", short: "kn" },
];

export const PRECIP_UNITS: Array<{ id: PrecipUnit; label: string; short: string }> = [
  { id: "mm", label: "Millimetres", short: "mm" },
  { id: "in", label: "Inches", short: "in" },
];

export const PRESSURE_UNITS: Array<{ id: PressureUnit; label: string; short: string }> = [
  { id: "hpa", label: "Hectopascals", short: "hPa" },
  { id: "inhg", label: "Inches of mercury", short: "inHg" },
];

export const DISTANCE_UNITS: Array<{ id: DistanceUnit; label: string; short: string }> = [
  { id: "km", label: "Kilometres", short: "km" },
  { id: "mi", label: "Miles", short: "mi" },
];

export const tempSymbol = (u: TempUnit) => (u === "f" ? "°F" : "°C");
export const windSymbol = (u: WindUnit) => WIND_UNITS.find((w) => w.id === u)?.short ?? "km/h";
export const precipSymbol = (u: PrecipUnit) => (u === "in" ? "in" : "mm");
export const pressureSymbol = (u: PressureUnit) => (u === "inhg" ? "inHg" : "hPa");
export const distanceSymbol = (u: DistanceUnit) => (u === "mi" ? "mi" : "km");

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function convertTemp(celsius: unknown, unit: TempUnit): number | null {
  const c = num(celsius);
  if (c === null) return null;
  return unit === "f" ? c * 9 / 5 + 32 : c;
}

export function convertTempDelta(deltaC: unknown, unit: TempUnit): number | null {
  const c = num(deltaC);
  if (c === null) return null;
  return unit === "f" ? c * 9 / 5 : c;
}

export function convertWind(kmh: unknown, unit: WindUnit): number | null {
  const v = num(kmh);
  if (v === null) return null;
  if (unit === "mph") return v * 0.621371;
  if (unit === "ms") return v / 3.6;
  if (unit === "kn") return v / 1.852;
  return v;
}

export function convertPrecip(mm: unknown, unit: PrecipUnit): number | null {
  const v = num(mm);
  if (v === null) return null;
  return unit === "in" ? v / 25.4 : v;
}

export function convertPressure(hpa: unknown, unit: PressureUnit): number | null {
  const v = num(hpa);
  if (v === null) return null;
  return unit === "inhg" ? v * 0.0295299830714 : v;
}

export function convertDistance(km: unknown, unit: DistanceUnit): number | null {
  const v = num(km);
  if (v === null) return null;
  return unit === "mi" ? v * 0.621371 : v;
}

export function formatNumber(value: unknown, digits = 0, fallback = "—"): string {
  const v = num(value);
  if (v === null) return fallback;
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatSigned(value: number | null, digits = 1): string {
  if (value === null) return "—";
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

export function compassPoint(degrees: unknown): string {
  const d = num(degrees);
  if (d === null) return "—";
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round((((d % 360) + 360) % 360) / 22.5) % 16];
}

export function beaufort(kmh: unknown): { force: number; label: string } | null {
  const v = num(kmh);
  if (v === null) return null;
  const thresholds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
  const labels = [
    "Calm",
    "Light air",
    "Light breeze",
    "Gentle breeze",
    "Moderate breeze",
    "Fresh breeze",
    "Strong breeze",
    "Near gale",
    "Gale",
    "Strong gale",
    "Storm",
    "Violent storm",
  ];
  let force = 0;
  for (let i = 0; i < thresholds.length; i += 1) if (v >= thresholds[i]) force = i + 1;
  return { force, label: force >= 12 ? "Hurricane force" : labels[force] };
}

export function uvBand(value: unknown): { label: string; tone: string } | null {
  const v = num(value);
  if (v === null) return null;
  if (v < 3) return { label: "Low", tone: "emerald" };
  if (v < 6) return { label: "Moderate", tone: "amber" };
  if (v < 8) return { label: "High", tone: "orange" };
  if (v < 11) return { label: "Very high", tone: "rose" };
  return { label: "Extreme", tone: "violet" };
}

export function visibilityBand(km: unknown): string | null {
  const v = num(km);
  if (v === null) return null;
  if (v < 0.05) return "Dense fog";
  if (v < 0.2) return "Thick fog";
  if (v < 1) return "Fog";
  if (v < 4) return "Poor";
  if (v < 10) return "Moderate";
  if (v < 20) return "Good";
  return "Excellent";
}

export function humidityBand(value: unknown): string | null {
  const v = num(value);
  if (v === null) return null;
  if (v < 25) return "Very dry";
  if (v < 40) return "Dry";
  if (v < 65) return "Comfortable";
  if (v < 80) return "Humid";
  return "Very humid";
}
