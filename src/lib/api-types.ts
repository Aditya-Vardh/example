import type { AlertsResult } from "./alerts";
import type { GridSample } from "./openmeteo";
import type { Place } from "./place";
import type { RadarColorScheme, RadarState } from "./radar";
import type { AirQualityData, GeocodeResult, OpenMeteoForecast } from "./schemas";

export type WeatherPayload = OpenMeteoForecast & { attribution: string; fetchedAt: number };
export type AirQualityPayload = AirQualityData & { attribution: string; fetchedAt: number };
export type RadarPayload = RadarState & { colorSchemes: RadarColorScheme[]; termsUrl: string; unavailable?: boolean };
export type AlertsPayload = AlertsResult;
export type GeocodePayload = { results: GeocodeResult[]; query: string };
export type ReversePayload = { place: Partial<Place> };

export type GridPayload = {
  samples: GridSample[];
  columns: number;
  rows: number;
  span: number;
  center: { lat: number; lon: number };
  bounds: { north: number; south: number; east: number; west: number };
  attribution: string;
  method: string;
  fetchedAt: number;
};
