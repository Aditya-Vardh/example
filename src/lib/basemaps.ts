export type BasemapOption = { id: string; label: string; url: string; attribution: string };
export type BasemapInfo = Omit<BasemapOption, "url">;

export const BASEMAPS: BasemapOption[] = [
  {
    id: "openfreemap-dark",
    label: "OpenFreeMap · Dark",
    url: "https://tiles.openfreemap.org/styles/dark",
    attribution: "OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors",
  },
  {
    id: "carto-dark-matter",
    label: "CARTO · Dark Matter",
    url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    attribution: "CARTO · © OpenStreetMap contributors · © CARTO",
  },
  {
    id: "maplibre-demo",
    label: "MapLibre · Demo tiles",
    url: "https://demotiles.maplibre.org/style.json",
    attribution: "MapLibre demo tiles · © OpenStreetMap contributors",
  },
];

export const BASEMAP_OPTIONS: BasemapInfo[] = BASEMAPS.map(({ id, label, attribution }) => ({
  id,
  label,
  attribution,
}));
