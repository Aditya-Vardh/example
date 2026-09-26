import { cached, fetchJson, ProviderError } from "./http";
import { rainViewerSchema, type RainViewerManifest } from "./schemas";

const MANIFEST_URL = "https://api.rainviewer.com/public/weather-maps.json";

export const RAINVIEWER_ATTRIBUTION = "Radar: RainViewer";
export const RAINVIEWER_TERMS_URL = "https://www.rainviewer.com/api.html";

export type RadarFrame = {
  id: string;
  epoch: number;
  tilePath: string;
  kind: "past" | "nowcast";
};

export type RadarState = {
  host: string;
  generated: number;
  frames: RadarFrame[];
  nowcastAvailable: boolean;
  satelliteAvailable: boolean;
  attribution: string;
  fetchedAt: number;
  stale: boolean;
};

export type RadarColorScheme = { id: number; label: string };

export const RADAR_COLOR_SCHEMES: RadarColorScheme[] = [
  { id: 0, label: "Original" },
  { id: 1, label: "Universal blue" },
  { id: 2, label: "TITAN" },
  { id: 3, label: "The Weather Channel" },
  { id: 4, label: "Meteored" },
  { id: 5, label: "NEXRAD level III" },
  { id: 6, label: "Rainbow SELEX-IS" },
  { id: 7, label: "Dark Sky" },
];

export const DEFAULT_COLOR_SCHEME = 4;
export const DEFAULT_SMOOTH = true;
export const DEFAULT_SNOW = true;
export const RADAR_TILE_SIZE = 256;
export const RADAR_MAX_ZOOM = 7;

export function buildTileUrl(
  host: string,
  frame: RadarFrame,
  options: { size?: 256 | 512; colorScheme?: number; smooth?: boolean; snow?: boolean } = {}
): string {
  const { size = 256, colorScheme = DEFAULT_COLOR_SCHEME, smooth = DEFAULT_SMOOTH, snow = DEFAULT_SNOW } = options;
  const smoothFlag = smooth ? 1 : 0;
  const snowFlag = snow ? 1 : 0;
  const normalizedHost = host.endsWith("/") ? host.slice(0, -1) : host;
  return `${normalizedHost}${frame.tilePath}/${size}/{z}/{x}/{y}/${colorScheme}/${smoothFlag}_${snowFlag}.png`;
}

export async function getRadarState(): Promise<RadarState> {
  const manifest = await cached<RainViewerManifest>("rainviewer:manifest", 2 * 60 * 1000, () =>
    fetchJson(MANIFEST_URL, {
      provider: "RainViewer",
      schema: rainViewerSchema,
      revalidateSeconds: 120,
      timeoutMs: 9000,
    })
  );

  const past = manifest.radar?.past ?? [];
  const nowcast = manifest.radar?.nowcast ?? [];
  const infrared = manifest.satellite?.infrared ?? [];

  const frames: RadarFrame[] = [
    ...past.map((frame, index) => ({
      id: `past-${frame.time}-${index}`,
      epoch: frame.time,
      tilePath: frame.path,
      kind: "past" as const,
    })),
    ...nowcast.map((frame, index) => ({
      id: `nowcast-${frame.time}-${index}`,
      epoch: frame.time,
      tilePath: frame.path,
      kind: "nowcast" as const,
    })),
  ].sort((a, b) => a.epoch - b.epoch);

  if (!manifest.host) {
    throw new ProviderError("RainViewer manifest did not include a tile host.", {
      kind: "invalid-response",
      provider: "RainViewer",
    });
  }

  return {
    host: manifest.host,
    generated: manifest.generated,
    frames,
    nowcastAvailable: nowcast.length > 0,
    satelliteAvailable: infrared.length > 0,
    attribution: RAINVIEWER_ATTRIBUTION,
    fetchedAt: Date.now(),
    stale: false,
  };
}
