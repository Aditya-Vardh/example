import type { AirQualityData, OpenMeteoForecast } from "./schemas";
import { localIsoToEpoch } from "./time";

export type HourPoint = {
  index: number;
  epoch: number | null;
  iso: string;
  temperature: number | null;
  apparent: number | null;
  precipProbability: number | null;
  precipitation: number | null;
  rain: number | null;
  showers: number | null;
  snowfall: number | null;
  weatherCode: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  humidity: number | null;
  uvIndex: number | null;
  cloudCover: number | null;
  visibility: number | null;
  dewPoint: number | null;
  pressure: number | null;
  isForecast: boolean;
};

export type DayPoint = {
  index: number;
  epoch: number | null;
  iso: string;
  weatherCode: number | null;
  tempMax: number | null;
  tempMin: number | null;
  apparentMax: number | null;
  apparentMin: number | null;
  sunrise: number | null;
  sunset: number | null;
  daylightSeconds: number | null;
  uvMax: number | null;
  precipProbabilityMax: number | null;
  precipitationSum: number | null;
  rainSum: number | null;
  showersSum: number | null;
  snowfallSum: number | null;
  windMax: number | null;
  gustMax: number | null;
  windDirection: number | null;
};

export type CurrentSnapshot = {
  epoch: number | null;
  iso: string | null;
  temperature: number | null;
  apparent: number | null;
  humidity: number | null;
  precipitation: number | null;
  rain: number | null;
  showers: number | null;
  snowfall: number | null;
  weatherCode: number | null;
  cloudCover: number | null;
  pressure: number | null;
  surfacePressure: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  windGust: number | null;
  uvIndex: number | null;
  dewPoint: number | null;
  visibility: number | null;
  isDay: boolean;
};

const at = (series: Array<number | null> | undefined, index: number): number | null => {
  if (!series) return null;
  const value = series[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const strAt = (series: Array<string | null> | undefined, index: number): string | null => {
  if (!series) return null;
  const value = series[index];
  return typeof value === "string" ? value : null;
};

export function buildCurrent(data: OpenMeteoForecast): CurrentSnapshot | null {
  const current = data.current;
  if (!current) return null;
  const epoch = current.time ? localIsoToEpoch(current.time, data.utc_offset_seconds) : null;
  return {
    epoch,
    iso: current.time ?? null,
    temperature: current.temperature_2m ?? null,
    apparent: current.apparent_temperature ?? null,
    humidity: current.relative_humidity_2m ?? null,
    precipitation: current.precipitation ?? null,
    rain: current.rain ?? null,
    showers: current.showers ?? null,
    snowfall: current.snowfall ?? null,
    weatherCode: current.weather_code ?? null,
    cloudCover: current.cloud_cover ?? null,
    pressure: current.pressure_msl ?? null,
    surfacePressure: current.surface_pressure ?? null,
    windSpeed: current.wind_speed_10m ?? null,
    windDirection: current.wind_direction_10m ?? null,
    windGust: current.wind_gusts_10m ?? null,
    uvIndex: current.uv_index ?? null,
    dewPoint: current.dew_point_2m ?? null,
    visibility: current.visibility ?? null,
    isDay: current.is_day === 1,
  };
}

export function buildHourly(data: OpenMeteoForecast, now: number = Date.now()): HourPoint[] {
  const hourly = data.hourly;
  if (!hourly) return [];
  return hourly.time.map((iso, index) => {
    const epoch = localIsoToEpoch(iso, data.utc_offset_seconds);
    return {
      index,
      epoch,
      iso,
      temperature: at(hourly.temperature_2m, index),
      apparent: at(hourly.apparent_temperature, index),
      precipProbability: at(hourly.precipitation_probability, index),
      precipitation: at(hourly.precipitation, index),
      rain: at(hourly.rain, index),
      showers: at(hourly.showers, index),
      snowfall: at(hourly.snowfall, index),
      weatherCode: at(hourly.weather_code, index),
      windSpeed: at(hourly.wind_speed_10m, index),
      windGust: at(hourly.wind_gusts_10m, index),
      windDirection: at(hourly.wind_direction_10m, index),
      humidity: at(hourly.relative_humidity_2m, index),
      uvIndex: at(hourly.uv_index, index),
      cloudCover: at(hourly.cloud_cover, index),
      visibility: at(hourly.visibility, index),
      dewPoint: at(hourly.dew_point_2m, index),
      pressure: at(hourly.pressure_msl, index),
      isForecast: epoch !== null && epoch > now,
    };
  });
}

export function buildDaily(data: OpenMeteoForecast): DayPoint[] {
  const daily = data.daily;
  if (!daily) return [];
  return daily.time.map((iso, index) => ({
    index,
    epoch: localIsoToEpoch(iso, data.utc_offset_seconds),
    iso,
    weatherCode: at(daily.weather_code, index),
    tempMax: at(daily.temperature_2m_max, index),
    tempMin: at(daily.temperature_2m_min, index),
    apparentMax: at(daily.apparent_temperature_max, index),
    apparentMin: at(daily.apparent_temperature_min, index),
    sunrise: localIsoToEpoch(strAt(daily.sunrise, index), data.utc_offset_seconds),
    sunset: localIsoToEpoch(strAt(daily.sunset, index), data.utc_offset_seconds),
    daylightSeconds: at(daily.daylight_duration, index),
    uvMax: at(daily.uv_index_max, index),
    precipProbabilityMax: at(daily.precipitation_probability_max, index),
    precipitationSum: at(daily.precipitation_sum, index),
    rainSum: at(daily.rain_sum, index),
    showersSum: at(daily.showers_sum, index),
    snowfallSum: at(daily.snowfall_sum, index),
    windMax: at(daily.wind_speed_10m_max, index),
    gustMax: at(daily.wind_gusts_10m_max, index),
    windDirection: at(daily.wind_direction_10m_dominant, index),
  }));
}

export function currentHourIndex(hours: HourPoint[], now: number): number {
  let index = hours.findIndex((hour) => hour.epoch !== null && hour.epoch >= now - 1800000);
  if (index === -1) index = hours.length - 1;
  return Math.max(0, index);
}

export function upcomingHours(hours: HourPoint[], now: number, count: number): HourPoint[] {
  const start = currentHourIndex(hours, now);
  return hours.slice(start, start + count);
}

export function nextHoursFrom(hours: HourPoint[], startIndex: number, count: number): HourPoint[] {
  return hours.slice(startIndex, startIndex + count);
}

export type AirHourPoint = {
  index: number;
  epoch: number | null;
  iso: string;
  europeanAqi: number | null;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  nitrogenDioxide: number | null;
  sulphurDioxide: number | null;
  carbonMonoxide: number | null;
  dust: number | null;
  uvIndex: number | null;
  aerosolOpticalDepth: number | null;
  isForecast: boolean;
};

export function buildAirHours(data: AirQualityData, now: number = Date.now()): AirHourPoint[] {
  const hourly = data.hourly;
  if (!hourly) return [];
  return hourly.time.map((iso, index) => {
    const epoch = localIsoToEpoch(iso, data.utc_offset_seconds);
    return {
      index,
      epoch,
      iso,
      europeanAqi: at(hourly.european_aqi, index),
      usAqi: at(hourly.us_aqi, index),
      pm25: at(hourly.pm2_5, index),
      pm10: at(hourly.pm10, index),
      ozone: at(hourly.ozone, index),
      nitrogenDioxide: at(hourly.nitrogen_dioxide, index),
      sulphurDioxide: at(hourly.sulphur_dioxide, index),
      carbonMonoxide: at(hourly.carbon_monoxide, index),
      dust: at(hourly.dust, index),
      uvIndex: at(hourly.uv_index, index),
      aerosolOpticalDepth: at(hourly.aerosol_optical_depth, index),
      isForecast: epoch !== null && epoch > now,
    };
  });
}

export function peakIndex(values: Array<number | null>): number | null {
  let bestIndex: number | null = null;
  let best = -Infinity;
  values.forEach((value, index) => {
    if (typeof value === "number" && value > best) {
      best = value;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function precipitationType(code: number | null, snowfall: number | null, showers: number | null, rain: number | null): string {
  if (snowfall !== null && snowfall > 0) return "Snow";
  if (code !== null && code >= 95) return "Thunderstorm";
  if (showers !== null && showers > 0) return "Showers";
  if (rain !== null && rain > 0) return "Rain";
  return "Precipitation";
}
