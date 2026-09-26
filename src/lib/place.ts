import type { GeocodeResult } from "./schemas";

export type Place = {
  id: string;
  name: string;
  admin1?: string;
  admin2?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  elevation?: number;
  population?: number;
  source: "search" | "geolocation" | "suggested";
  addedAt: number;
};

export function placeFromGeocode(result: GeocodeResult, source: Place["source"] = "search"): Place {
  return {
    id: `g:${result.id}`,
    name: result.name,
    admin1: result.admin1,
    admin2: result.admin2,
    country: result.country,
    countryCode: result.country_code?.toUpperCase(),
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
    elevation: result.elevation,
    population: result.population,
    source,
    addedAt: Date.now(),
  };
}

export function placeFromCoordinates(
  lat: number,
  lon: number,
  resolved?: Partial<Place>,
  source: Place["source"] = "geolocation"
): Place {
  const name = resolved?.name ?? (source === "geolocation" ? "Current location" : coordinateLabel({ latitude: lat, longitude: lon }));
  return {
    id: `c:${lat.toFixed(3)},${lon.toFixed(3)}`,
    name,
    admin1: resolved?.admin1,
    admin2: resolved?.admin2,
    country: resolved?.country,
    countryCode: resolved?.countryCode,
    latitude: lat,
    longitude: lon,
    timezone: resolved?.timezone,
    source,
    addedAt: Date.now(),
  };
}

export function placeLabel(place: Place): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

export function placeSubtitle(place: Place): string {
  const parts = [place.admin2, place.admin1, place.country].filter((part): part is string => Boolean(part));
  const unique = parts.filter((part, index) => parts.indexOf(part) === index && part !== place.name);
  return unique.join(" · ");
}

export function samePlace(a: Place | null, b: Place | null): boolean {
  if (!a || !b) return false;
  return a.id === b.id;
}

export function coordinateLabel(point: Pick<Place, "latitude" | "longitude">): string {
  const lat = `${Math.abs(point.latitude).toFixed(3)}°${point.latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(point.longitude).toFixed(3)}°${point.longitude >= 0 ? "E" : "W"}`;
  return `${lat} ${lon}`;
}

export const SUGGESTED_CITIES = ["Mumbai", "London", "New York", "Tokyo", "Singapore", "Dubai", "São Paulo", "Nairobi"];
