import { cached, fetchJson, ProviderError } from "./http";
import {
  airQualitySchema,
  geocodeResponseSchema,
  nominatimSchema,
  openMeteoForecastSchema,
  openMeteoMultiSchema,
  type AirQualityData,
  type GeocodeResult,
  type OpenMeteoForecast,
} from "./schemas";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export const OPEN_METEO_ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)";
export const NOMINATIM_ATTRIBUTION = "Reverse geocoding © OpenStreetMap contributors (ODbL)";

export const CURRENT_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "surface_pressure",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "uv_index",
  "dew_point_2m",
  "visibility",
].join(",");

export const HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "relative_humidity_2m",
  "uv_index",
  "cloud_cover",
  "visibility",
  "dew_point_2m",
  "pressure_msl",
].join(",");

export const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "sunrise",
  "sunset",
  "daylight_duration",
  "uv_index_max",
  "precipitation_probability_max",
  "precipitation_sum",
  "rain_sum",
  "showers_sum",
  "snowfall_sum",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
].join(",");

const GRID_FIELDS = ["temperature_2m", "wind_speed_10m", "wind_direction_10m", "cloud_cover", "precipitation"].join(",");

export type ForecastWindow = { pastHours: number; forecastHours: number; forecastDays: number };

export const DEFAULT_WINDOW: ForecastWindow = { pastHours: 6, forecastHours: 72, forecastDays: 14 };

export function buildForecastUrl(lat: number, lon: number, window: ForecastWindow = DEFAULT_WINDOW): string {
  const url = new URL(FORECAST_URL);
  url.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    timezone: "auto",
    past_hours: String(window.pastHours),
    forecast_hours: String(window.forecastHours),
    forecast_days: String(window.forecastDays),
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
  }).toString();
  return url.toString();
}

export function getForecast(lat: number, lon: number): Promise<OpenMeteoForecast> {
  const key = `forecast:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  return cached(key, 10 * 60 * 1000, () =>
    fetchJson(buildForecastUrl(lat, lon), {
      provider: "Open-Meteo forecast",
      schema: openMeteoForecastSchema,
      revalidateSeconds: 600,
    })
  );
}

export type GridPoint = { lat: number; lon: number };
export type GridSample = { lat: number; lon: number; temperature: number | null; windSpeed: number | null; windDirection: number | null; cloudCover: number | null; precipitation: number | null };

export function buildGridUrl(points: GridPoint[]): string {
  const url = new URL(FORECAST_URL);
  url.search = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(4)).join(","),
    longitude: points.map((p) => p.lon.toFixed(4)).join(","),
    timezone: "UTC",
    current: GRID_FIELDS,
    forecast_days: "1",
  }).toString();
  return url.toString();
}

export async function getGridSamples(points: GridPoint[]): Promise<GridSample[]> {
  if (points.length === 0) return [];
  const rounded = points.map((p) => ({ lat: Number(p.lat.toFixed(3)), lon: Number(p.lon.toFixed(3)) }));
  const key = `grid:${rounded.map((p) => `${p.lat},${p.lon}`).join(";")}`;
  return cached(key, 10 * 60 * 1000, async () => {
    const responses = await fetchJson(buildGridUrl(rounded), {
      provider: "Open-Meteo grid sampler",
      schema: openMeteoMultiSchema,
      revalidateSeconds: 600,
      timeoutMs: 15000,
    });
    if (responses.length !== rounded.length) {
      throw new ProviderError("Open-Meteo grid sampler returned an unexpected number of points.", {
        kind: "invalid-response",
        provider: "Open-Meteo grid sampler",
      });
    }
    return responses.map((res, index) => ({
      lat: rounded[index].lat,
      lon: rounded[index].lon,
      temperature: res.current?.temperature_2m ?? null,
      windSpeed: res.current?.wind_speed_10m ?? null,
      windDirection: res.current?.wind_direction_10m ?? null,
      cloudCover: res.current?.cloud_cover ?? null,
      precipitation: res.current?.precipitation ?? null,
    }));
  });
}

export function getAirQuality(lat: number, lon: number): Promise<AirQualityData> {
  const url = new URL(AIR_QUALITY_URL);
  url.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    timezone: "auto",
    forecast_days: "5",
    past_hours: "6",
    forecast_hours: "72",
    current: [
      "european_aqi",
      "us_aqi",
      "pm2_5",
      "pm10",
      "carbon_monoxide",
      "nitrogen_dioxide",
      "sulphur_dioxide",
      "ozone",
      "dust",
      "uv_index",
      "aerosol_optical_depth",
    ].join(","),
    hourly: [
      "european_aqi",
      "us_aqi",
      "pm2_5",
      "pm10",
      "carbon_monoxide",
      "nitrogen_dioxide",
      "sulphur_dioxide",
      "ozone",
      "dust",
      "uv_index",
      "aerosol_optical_depth",
    ].join(","),
  }).toString();
  const key = `aq:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  return cached(key, 20 * 60 * 1000, () =>
    fetchJson(url.toString(), {
      provider: "Open-Meteo air quality",
      schema: airQualitySchema,
      revalidateSeconds: 1200,
    })
  );
}

export async function searchPlaces(query: string, count = 8): Promise<GeocodeResult[]> {
  const url = new URL(GEOCODE_URL);
  url.search = new URLSearchParams({ name: query, count: String(count), language: "en", format: "json" }).toString();
  const key = `geo:${query.trim().toLowerCase()}:${count}`;
  return cached(key, 10 * 60 * 1000, async () => {
    const data = await fetchJson(url.toString(), {
      provider: "Open-Meteo geocoding",
      schema: geocodeResponseSchema,
      revalidateSeconds: 3600,
    });
    return data.results ?? [];
  });
}

export type ResolvedPlace = {
  name?: string;
  admin1?: string;
  admin2?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export async function reverseGeocode(lat: number, lon: number): Promise<ResolvedPlace> {
  const url = new URL(REVERSE_URL);
  url.search = new URLSearchParams({
    lat: lat.toFixed(4),
    lon: lon.toFixed(4),
    format: "jsonv2",
    zoom: "10",
    addressdetails: "1",
  }).toString();
  const key = `rev:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  return cached(key, 60 * 60 * 1000, async () => {
    try {
      const data = await fetchJson(url.toString(), {
        provider: "Nominatim reverse geocoding",
        schema: nominatimSchema,
        revalidateSeconds: 86400,
        timeoutMs: 7000,
      });
      const address = data.address ?? {};
      const name =
        address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? data.name ?? undefined;
      return {
        name: name && name.length > 0 ? name : undefined,
        admin1: address.state,
        admin2: address.state_district,
        country: address.country,
        countryCode: address.country_code ? address.country_code.toUpperCase() : undefined,
        latitude: lat,
        longitude: lon,
      };
    } catch {
      return { latitude: lat, longitude: lon };
    }
  });
}
