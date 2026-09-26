export type AqiScale = "european" | "us";

export type AqiBand = {
  min: number;
  max: number;
  label: string;
  color: string;
  guidance: string;
};

export const EUROPEAN_AQI_BANDS: AqiBand[] = [
  { min: 0, max: 20, label: "Good", color: "#4ade80", guidance: "Air quality is good. Enjoy normal outdoor activities." },
  { min: 20, max: 40, label: "Fair", color: "#a3e635", guidance: "Air quality is fair. No action needed for most people." },
  { min: 40, max: 60, label: "Moderate", color: "#facc15", guidance: "Sensitive groups may notice mild symptoms during prolonged exertion outdoors." },
  { min: 60, max: 80, label: "Poor", color: "#fb923c", guidance: "Sensitive groups should reduce intense or prolonged outdoor exertion." },
  { min: 80, max: 100, label: "Very poor", color: "#f87171", guidance: "Everyone may begin to experience health effects. Limit prolonged outdoor exertion." },
  { min: 100, max: 500, label: "Extremely poor", color: "#c084fc", guidance: "Health alert. Avoid outdoor exertion and keep windows closed where possible." },
];

export const US_AQI_BANDS: AqiBand[] = [
  { min: 0, max: 50, label: "Good", color: "#4ade80", guidance: "Air quality is satisfactory and poses little or no risk." },
  { min: 51, max: 100, label: "Moderate", color: "#facc15", guidance: "Acceptable, though unusually sensitive people may be affected." },
  { min: 101, max: 150, label: "Unhealthy for sensitive groups", color: "#fb923c", guidance: "Sensitive groups should limit prolonged outdoor exertion." },
  { min: 151, max: 200, label: "Unhealthy", color: "#f87171", guidance: "Everyone may experience health effects. Reduce outdoor exertion." },
  { min: 201, max: 300, label: "Very unhealthy", color: "#c084fc", guidance: "Health alert. Avoid outdoor exertion." },
  { min: 301, max: 1000, label: "Hazardous", color: "#f43f5e", guidance: "Emergency conditions. Remain indoors with filtration if possible." },
];

export function aqiBands(scale: AqiScale): AqiBand[] {
  return scale === "us" ? US_AQI_BANDS : EUROPEAN_AQI_BANDS;
}

export function aqiBand(value: unknown, scale: AqiScale): AqiBand | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const bands = aqiBands(scale);
  return bands.find((b) => n >= b.min && n < b.max) ?? bands[bands.length - 1];
}

export function aqiProgress(value: unknown, scale: AqiScale): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const bands = aqiBands(scale);
  const bandIndex = bands.findIndex((b) => n >= b.min && n < b.max);
  const resolved = bandIndex === -1 ? bands.length - 1 : bandIndex;
  const share = 100 / bands.length;
  const band = bands[resolved];
  const span = band.max - band.min;
  const within = span > 0 ? Math.min(1, Math.max(0, (n - band.min) / span)) : 1;
  return Math.min(100, Math.max(0, resolved * share + within * share));
}

export type PollutantInfo = {
  key: string;
  label: string;
  symbol: string;
  unit: string;
  reference: number;
  referenceLabel: string;
  description: string;
};

export const POLLUTANTS: PollutantInfo[] = [
  {
    key: "pm2_5",
    label: "PM2.5",
    symbol: "PM₂.₅",
    unit: "µg/m³",
    reference: 15,
    referenceLabel: "WHO 24h guideline",
    description: "Fine particles under 2.5 µm that penetrate deep into the lungs and bloodstream.",
  },
  {
    key: "pm10",
    label: "PM10",
    symbol: "PM₁₀",
    unit: "µg/m³",
    reference: 45,
    referenceLabel: "WHO 24h guideline",
    description: "Coarse particles under 10 µm from dust, pollen and mechanical abrasion.",
  },
  {
    key: "ozone",
    label: "Ozone",
    symbol: "O₃",
    unit: "µg/m³",
    reference: 100,
    referenceLabel: "WHO 8h guideline",
    description: "Ground-level ozone formed by sunlight acting on traffic and industrial emissions.",
  },
  {
    key: "nitrogen_dioxide",
    label: "Nitrogen dioxide",
    symbol: "NO₂",
    unit: "µg/m³",
    reference: 25,
    referenceLabel: "WHO 24h guideline",
    description: "Mostly traffic and combustion related; irritates airways.",
  },
  {
    key: "sulphur_dioxide",
    label: "Sulphur dioxide",
    symbol: "SO₂",
    unit: "µg/m³",
    reference: 40,
    referenceLabel: "WHO 24h guideline",
    description: "Released by fuel combustion and smelting; can trigger bronchoconstriction.",
  },
  {
    key: "carbon_monoxide",
    label: "Carbon monoxide",
    symbol: "CO",
    unit: "µg/m³",
    reference: 4000,
    referenceLabel: "WHO 24h guideline",
    description: "Odourless gas from incomplete combustion that reduces oxygen transport in blood.",
  },
];

export function pollutantRatio(value: unknown, reference: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n / reference;
}
