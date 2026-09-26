export type WeatherFamily =
  | "clear"
  | "mainly-clear"
  | "partly-cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "freezing-drizzle"
  | "rain"
  | "freezing-rain"
  | "snow"
  | "snow-grains"
  | "rain-showers"
  | "snow-showers"
  | "thunderstorm"
  | "thunderstorm-hail"
  | "unknown";

export type IconVariant =
  | "clear-day"
  | "clear-night"
  | "partly-day"
  | "partly-night"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy-rain"
  | "freezing-rain"
  | "snow"
  | "sleet"
  | "showers"
  | "thunderstorm"
  | "hail"
  | "unknown";

export type SceneVariant =
  | "clear-day"
  | "clear-night"
  | "partly-day"
  | "partly-night"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy-rain"
  | "thunderstorm"
  | "snow"
  | "unknown";

type CodeMeta = {
  code: number;
  label: string;
  family: WeatherFamily;
  day: IconVariant;
  night: IconVariant;
  scene: SceneVariant;
  intensity: 0 | 1 | 2 | 3;
};

const CODES: CodeMeta[] = [
  { code: 0, label: "Clear sky", family: "clear", day: "clear-day", night: "clear-night", scene: "clear-day", intensity: 0 },
  { code: 1, label: "Mainly clear", family: "mainly-clear", day: "clear-day", night: "clear-night", scene: "clear-day", intensity: 0 },
  { code: 2, label: "Partly cloudy", family: "partly-cloudy", day: "partly-day", night: "partly-night", scene: "partly-day", intensity: 0 },
  { code: 3, label: "Overcast", family: "overcast", day: "cloudy", night: "cloudy", scene: "overcast", intensity: 0 },
  { code: 45, label: "Fog", family: "fog", day: "fog", night: "fog", scene: "fog", intensity: 1 },
  { code: 48, label: "Depositing rime fog", family: "fog", day: "fog", night: "fog", scene: "fog", intensity: 1 },
  { code: 51, label: "Light drizzle", family: "drizzle", day: "drizzle", night: "drizzle", scene: "drizzle", intensity: 1 },
  { code: 53, label: "Moderate drizzle", family: "drizzle", day: "drizzle", night: "drizzle", scene: "drizzle", intensity: 1 },
  { code: 55, label: "Dense drizzle", family: "drizzle", day: "drizzle", night: "drizzle", scene: "drizzle", intensity: 2 },
  { code: 56, label: "Light freezing drizzle", family: "freezing-drizzle", day: "sleet", night: "sleet", scene: "drizzle", intensity: 2 },
  { code: 57, label: "Dense freezing drizzle", family: "freezing-drizzle", day: "sleet", night: "sleet", scene: "drizzle", intensity: 2 },
  { code: 61, label: "Slight rain", family: "rain", day: "rain", night: "rain", scene: "rain", intensity: 1 },
  { code: 63, label: "Moderate rain", family: "rain", day: "rain", night: "rain", scene: "rain", intensity: 2 },
  { code: 65, label: "Heavy rain", family: "rain", day: "heavy-rain", night: "heavy-rain", scene: "heavy-rain", intensity: 3 },
  { code: 66, label: "Light freezing rain", family: "freezing-rain", day: "freezing-rain", night: "freezing-rain", scene: "rain", intensity: 2 },
  { code: 67, label: "Heavy freezing rain", family: "freezing-rain", day: "freezing-rain", night: "freezing-rain", scene: "heavy-rain", intensity: 3 },
  { code: 71, label: "Slight snowfall", family: "snow", day: "snow", night: "snow", scene: "snow", intensity: 1 },
  { code: 73, label: "Moderate snowfall", family: "snow", day: "snow", night: "snow", scene: "snow", intensity: 2 },
  { code: 75, label: "Heavy snowfall", family: "snow", day: "snow", night: "snow", scene: "snow", intensity: 3 },
  { code: 77, label: "Snow grains", family: "snow-grains", day: "snow", night: "snow", scene: "snow", intensity: 1 },
  { code: 80, label: "Slight rain showers", family: "rain-showers", day: "showers", night: "showers", scene: "rain", intensity: 1 },
  { code: 81, label: "Moderate rain showers", family: "rain-showers", day: "showers", night: "showers", scene: "rain", intensity: 2 },
  { code: 82, label: "Violent rain showers", family: "rain-showers", day: "heavy-rain", night: "heavy-rain", scene: "heavy-rain", intensity: 3 },
  { code: 85, label: "Slight snow showers", family: "snow-showers", day: "snow", night: "snow", scene: "snow", intensity: 1 },
  { code: 86, label: "Heavy snow showers", family: "snow-showers", day: "snow", night: "snow", scene: "snow", intensity: 3 },
  { code: 95, label: "Thunderstorm", family: "thunderstorm", day: "thunderstorm", night: "thunderstorm", scene: "thunderstorm", intensity: 2 },
  { code: 96, label: "Thunderstorm with slight hail", family: "thunderstorm-hail", day: "hail", night: "hail", scene: "thunderstorm", intensity: 3 },
  { code: 99, label: "Thunderstorm with heavy hail", family: "thunderstorm-hail", day: "hail", night: "hail", scene: "thunderstorm", intensity: 3 },
];

const UNKNOWN: CodeMeta = {
  code: -1,
  label: "Conditions unavailable",
  family: "unknown",
  day: "unknown",
  night: "unknown",
  scene: "unknown",
  intensity: 0,
};

const BY_CODE = new Map(CODES.map((c) => [c.code, c]));

export function describeCode(code: unknown): CodeMeta {
  const n = typeof code === "number" ? code : Number(code);
  if (!Number.isFinite(n)) return UNKNOWN;
  return BY_CODE.get(n) ?? UNKNOWN;
}

export function conditionLabel(code: unknown): string {
  return describeCode(code).label;
}

export function iconVariant(code: unknown, isDay: boolean): IconVariant {
  const meta = describeCode(code);
  return isDay ? meta.day : meta.night;
}

export function sceneVariant(code: unknown, isDay: boolean): SceneVariant {
  const meta = describeCode(code);
  if (!isDay) {
    if (meta.scene === "clear-day") return "clear-night";
    if (meta.scene === "partly-day") return "partly-night";
  }
  return meta.scene;
}

export function weatherIntensity(code: unknown): number {
  return describeCode(code).intensity;
}

export function isPrecipitating(code: unknown): boolean {
  const family = describeCode(code).family;
  return (
    family === "drizzle" ||
    family === "rain" ||
    family === "rain-showers" ||
    family === "snow" ||
    family === "snow-showers" ||
    family === "snow-grains" ||
    family === "freezing-rain" ||
    family === "freezing-drizzle" ||
    family === "thunderstorm" ||
    family === "thunderstorm-hail"
  );
}

export function isThunder(code: unknown): boolean {
  const family = describeCode(code).family;
  return family === "thunderstorm" || family === "thunderstorm-hail";
}
