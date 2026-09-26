import type { GridPayload } from "@/lib/api-types";
import type { GridSample } from "@/lib/openmeteo";

export type FieldKey = "temperature" | "wind" | "cloud" | "precipitation";

export type GridField = {
  columns: number;
  rows: number;
  cells: GridSample[];
  latAxis: number[];
  lonAxis: number[];
  bounds: GridPayload["bounds"];
  attribution: string;
  method: string;
  fetchedAt: number;
};

export function buildGridField(payload: GridPayload): GridField {
  const latAxis: number[] = [];
  const lonAxis: number[] = [];
  for (let row = 0; row < payload.rows; row += 1) {
    latAxis.push(payload.samples[row * payload.columns]?.lat ?? 0);
  }
  for (let column = 0; column < payload.columns; column += 1) {
    lonAxis.push(payload.samples[column]?.lon ?? 0);
  }
  return {
    columns: payload.columns,
    rows: payload.rows,
    cells: payload.samples,
    latAxis,
    lonAxis,
    bounds: payload.bounds,
    attribution: payload.attribution,
    method: payload.method,
    fetchedAt: payload.fetchedAt,
  };
}

type Bracket = { low: number; high: number; t: number };

function bracket(axis: number[], value: number): Bracket {
  const last = axis.length - 1;
  if (last <= 0) return { low: 0, high: 0, t: 0 };
  if (value <= axis[0]) return { low: 0, high: 0, t: 0 };
  if (value >= axis[last]) return { low: last, high: last, t: 0 };
  for (let index = 0; index < last; index += 1) {
    const a = axis[index];
    const b = axis[index + 1];
    if (value >= Math.min(a, b) && value <= Math.max(a, b)) {
      const span = b - a;
      return { low: index, high: index + 1, t: span === 0 ? 0 : (value - a) / span };
    }
  }
  return { low: last, high: last, t: 0 };
}

type CellKey = "temperature" | "cloudCover" | "precipitation";

function cornersAt(field: GridField, lat: number, lon: number): { cells: Array<GridSample | undefined>; weights: number[] } {
  const rows = bracket(field.latAxis, lat);
  const columns = bracket(field.lonAxis, lon);
  return {
    cells: [
      field.cells[rows.low * field.columns + columns.low],
      field.cells[rows.low * field.columns + columns.high],
      field.cells[rows.high * field.columns + columns.low],
      field.cells[rows.high * field.columns + columns.high],
    ],
    weights: [
      (1 - rows.t) * (1 - columns.t),
      (1 - rows.t) * columns.t,
      rows.t * (1 - columns.t),
      rows.t * columns.t,
    ],
  };
}

export function sampleCell(field: GridField, key: CellKey, lat: number, lon: number): number | null {
  const { cells, weights } = cornersAt(field, lat, lon);
  let sum = 0;
  let weight = 0;
  for (let index = 0; index < cells.length; index += 1) {
    const value = cells[index]?.[key] ?? null;
    if (value === null || !Number.isFinite(value)) continue;
    sum += value * weights[index];
    weight += weights[index];
  }
  return weight > 0 ? sum / weight : null;
}

export type WindSample = { speed: number; direction: number; u: number; v: number };

export function sampleWind(field: GridField, lat: number, lon: number): WindSample | null {
  const { cells, weights } = cornersAt(field, lat, lon);
  let u = 0;
  let v = 0;
  let weight = 0;
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    const share = weights[index];
    if (!cell || share <= 0 || cell.windSpeed === null || cell.windDirection === null) continue;
    const radians = (cell.windDirection * Math.PI) / 180;
    u += -cell.windSpeed * Math.sin(radians) * share;
    v += -cell.windSpeed * Math.cos(radians) * share;
    weight += share;
  }
  if (weight <= 0) return null;
  const eastward = u / weight;
  const northward = v / weight;
  const speed = Math.hypot(eastward, northward);
  const degrees = (Math.atan2(-eastward, -northward) * 180) / Math.PI;
  return { speed, direction: (degrees + 360) % 360, u: eastward, v: northward };
}

export type FieldUnitKind = "temperature" | "wind" | "cloud" | "precipitation";

export type FieldPalette = {
  key: FieldKey;
  title: string;
  legendTitle: string;
  unitKind: FieldUnitKind;
  min: number;
  max: number;
  baseAlpha: number;
  rampAlpha: boolean;
  stops: Array<[number, [number, number, number]]>;
};

export const PALETTES: Record<FieldKey, FieldPalette> = {
  temperature: {
    key: "temperature",
    title: "Temperature",
    legendTitle: "Temperature (°C)",
    unitKind: "temperature",
    min: -35,
    max: 45,
    baseAlpha: 0.58,
    rampAlpha: false,
    stops: [
      [-35, [44, 66, 152]],
      [-20, [58, 108, 198]],
      [-10, [74, 168, 216]],
      [0, [118, 208, 198]],
      [10, [150, 220, 142]],
      [20, [240, 220, 122]],
      [28, [246, 172, 92]],
      [35, [240, 112, 92]],
      [45, [190, 62, 112]],
    ],
  },
  wind: {
    key: "wind",
    title: "Wind",
    legendTitle: "Wind speed (km/h)",
    unitKind: "wind",
    min: 0,
    max: 140,
    baseAlpha: 0.5,
    rampAlpha: false,
    stops: [
      [0, [38, 86, 108]],
      [15, [70, 178, 180]],
      [30, [130, 210, 142]],
      [50, [246, 202, 110]],
      [75, [246, 142, 92]],
      [100, [232, 92, 112]],
      [140, [180, 80, 202]],
    ],
  },
  cloud: {
    key: "cloud",
    title: "Cloud cover",
    legendTitle: "Cloud cover (%)",
    unitKind: "cloud",
    min: 0,
    max: 100,
    baseAlpha: 0.72,
    rampAlpha: true,
    stops: [
      [0, [78, 108, 148]],
      [40, [140, 166, 196]],
      [75, [206, 220, 236]],
      [100, [250, 252, 255]],
    ],
  },
  precipitation: {
    key: "precipitation",
    title: "Precipitation",
    legendTitle: "Precipitation now (mm)",
    unitKind: "precipitation",
    min: 0,
    max: 12,
    baseAlpha: 0.8,
    rampAlpha: true,
    stops: [
      [0, [58, 162, 212]],
      [1, [72, 202, 220]],
      [4, [92, 150, 246]],
      [8, [132, 112, 240]],
      [12, [192, 92, 220]],
    ],
  },
};

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function paletteColor(palette: FieldPalette, value: number, opacity: number): [number, number, number, number] {
  const clamped = Math.max(palette.min, Math.min(palette.max, value));
  const stops = palette.stops;
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let index = 0; index < stops.length - 1; index += 1) {
    if (clamped >= stops[index][0] && clamped <= stops[index + 1][0]) {
      lower = stops[index];
      upper = stops[index + 1];
      break;
    }
  }
  const span = upper[0] - lower[0];
  const t = span === 0 ? 0 : (clamped - lower[0]) / span;
  const r = Math.round(mix(lower[1][0], upper[1][0], t));
  const g = Math.round(mix(lower[1][1], upper[1][1], t));
  const b = Math.round(mix(lower[1][2], upper[1][2], t));
  const position = (clamped - palette.min) / (palette.max - palette.min || 1);
  const alpha = palette.baseAlpha * opacity * (palette.rampAlpha ? 0.06 + 0.94 * position : 1);
  return [r, g, b, Math.round(Math.max(0, Math.min(1, alpha)) * 255)];
}

export function paletteGradient(palette: FieldPalette): string {
  const span = palette.max - palette.min || 1;
  return palette.stops
    .map(([value, color], index) => {
      const position = Math.round(((value - palette.min) / span) * 100);
      const alpha = palette.rampAlpha ? (index === 0 ? 0.1 : 0.9) : 0.9;
      return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha}) ${position}%`;
    })
    .join(", ");
}

export function fieldValue(field: GridField, key: FieldKey, lat: number, lon: number): number | null {
  if (key === "wind") {
    const wind = sampleWind(field, lat, lon);
    return wind ? wind.speed : null;
  }
  if (key === "temperature") return sampleCell(field, "temperature", lat, lon);
  if (key === "cloud") return sampleCell(field, "cloudCover", lat, lon);
  return sampleCell(field, "precipitation", lat, lon);
}

export function renderFieldCanvas(field: GridField, palette: FieldPalette, size = 224): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(size, size);
  const { north, south, east, west } = field.bounds;
  const latSpan = north - south || 1;
  const lonSpan = east - west || 1;
  for (let y = 0; y < size; y += 1) {
    const lat = north - ((y + 0.5) / size) * latSpan;
    for (let x = 0; x < size; x += 1) {
      const lon = west + ((x + 0.5) / size) * lonSpan;
      const index = (y * size + x) * 4;
      const value = fieldValue(field, palette.key, lat, lon);
      if (value === null) continue;
      const [r, g, b, a] = paletteColor(palette, value, 1);
      image.data[index] = r;
      image.data[index + 1] = g;
      image.data[index + 2] = b;
      image.data[index + 3] = a;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function fieldCoordinates(field: GridField): [[number, number], [number, number], [number, number], [number, number]] {
  const { north, south, east, west } = field.bounds;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}
