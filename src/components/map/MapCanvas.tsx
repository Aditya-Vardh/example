"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageSource, Map as MapLibreMap, Marker, RasterTileSource } from "maplibre-gl";
import { PALETTES, fieldCoordinates, renderFieldCanvas, sampleWind, type FieldKey, type GridField } from "@/components/map/grid";
import { BASEMAPS, type BasemapInfo, type BasemapOption } from "@/lib/basemaps";
import { RADAR_MAX_ZOOM, RADAR_TILE_SIZE } from "@/lib/radar";

export type MapFocus = { lat: number; lon: number; zoom: number; token: number };
export type MapMarkerSpec = { id: string; lat: number; lon: number; label: string; tone: "place" | "pick" };
export type MapViewport = { lat: number; lon: number; latSpan: number; lonSpan: number };

export type MapCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  flyTo: (lat: number, lon: number, zoom: number) => void;
};

export type MapCanvasProps = {
  center: { lat: number; lon: number };
  zoom: number;
  focus: MapFocus | null;
  radar: { url: string; opacity: number } | null;
  field: { data: GridField; key: FieldKey; opacity: number } | null;
  wind: { data: GridField; animated: boolean; opacity: number } | null;
  markers: MapMarkerSpec[];
  basemapId: string | null;
  onPick: (lat: number, lon: number) => void;
  onViewport: (viewport: MapViewport) => void;
  onBasemap: (info: BasemapInfo | null, error: string | null) => void;
  onReady: (handle: MapCanvasHandle) => void;
  onMarkerClick?: (id: string) => void;
};

const EMPTY_STYLE = { version: 8 as const, sources: {}, layers: [] };

const RADAR_SOURCE = "aether-radar";
const RADAR_LAYER = "aether-radar-layer";
const FIELD_SOURCE = "aether-field";
const FIELD_LAYER = "aether-field-layer";

const STYLE_TIMEOUT_MS = 6000;

async function reachableStyle(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), STYLE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

function firstSymbolLayer(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type === "symbol") return layer.id;
  }
  return undefined;
}

const CIRCLE_ICON = /^circle-(\d+)$/;

function circleIcon(id: string, color: string): ImageData | null {
  const match = CIRCLE_ICON.exec(id);
  if (!match) return null;
  const size = Number(match[1]);
  if (!Number.isFinite(size) || size < 2 || size > 96) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = color;
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2);
  context.fill();
  return context.getImageData(0, 0, size, size);
}

function missingIconColor(map: MapLibreMap): string {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    const paint = layer.paint as { "text-color"?: unknown } | undefined;
    if (typeof paint?.["text-color"] === "string") return paint["text-color"];
  }
  return "#ffffff";
}

export function MapCanvas({
  center,
  zoom,
  focus,
  radar,
  field,
  wind,
  markers,
  basemapId,
  onPick,
  onViewport,
  onBasemap,
  onReady,
  onMarkerClick,
}: MapCanvasProps) {
  const radarUrl = radar?.url ?? null;
  const radarOpacity = radar?.opacity ?? 0;
  const fieldData = field?.data ?? null;
  const fieldKey = field?.key ?? null;
  const fieldOpacity = field?.opacity ?? 0;
  const windData = wind?.data ?? null;
  const windAnimated = wind?.animated ?? false;
  const windOpacity = wind?.opacity ?? 0;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const windCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const moduleRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markerMapRef = useRef<Map<string, Marker>>(new Map());
  const callbacksRef = useRef({ onPick, onViewport, onBasemap, onReady, onMarkerClick });
  const initialViewRef = useRef({ center, zoom });
  const windOpacityRef = useRef(windOpacity);
  const radarUrlRef = useRef<string | null>(null);
  const overlaysRef = useRef({ radarUrl, radarOpacity, fieldData, fieldKey, fieldOpacity });
  const applyRef = useRef<{ radar: () => void; field: () => void } | null>(null);
  const activeBasemapRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onPick, onViewport, onBasemap, onReady, onMarkerClick };
  });

  useEffect(() => {
    overlaysRef.current = { radarUrl, radarOpacity, fieldData, fieldKey, fieldOpacity };
  }, [radarUrl, radarOpacity, fieldData, fieldKey, fieldOpacity]);

  useEffect(() => {
    windOpacityRef.current = windOpacity;
  }, [windOpacity]);

  useEffect(() => {
    initialViewRef.current = { center, zoom };
  }, [center, zoom]);

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;
    let viewportHandler: (() => void) | null = null;
    let clickHandler: ((event: { lngLat: { lat: number; lng: number } }) => void) | null = null;
    const markerMap = markerMapRef.current;

    const boot = async () => {
      let style: string | typeof EMPTY_STYLE = EMPTY_STYLE;
      let candidate: BasemapOption | null = null;
      let styleError: string | null = "No basemap style could be reached. Base tiles are unavailable — overlays still work.";

      for (const option of BASEMAPS) {
        if (cancelled) return;
        if (await reachableStyle(option.url)) {
          style = option.url;
          candidate = option;
          styleError = null;
          break;
        }
      }
      if (cancelled || !containerRef.current) return;

      const maplibre = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      moduleRef.current = maplibre;

      const applyRadar = () => {
        const map = mapRef.current;
        if (!map) return;
        const { radarUrl: url, radarOpacity: opacity } = overlaysRef.current;
        if (!url) {
          radarUrlRef.current = null;
          if (map.getLayer(RADAR_LAYER)) map.setLayoutProperty(RADAR_LAYER, "visibility", "none");
          return;
        }
        const source = map.getSource(RADAR_SOURCE) as RasterTileSource | undefined;
        if (!source) {
          map.addSource(RADAR_SOURCE, {
            type: "raster",
            tiles: [url],
            tileSize: RADAR_TILE_SIZE,
            minzoom: 0,
            maxzoom: RADAR_MAX_ZOOM,
            attribution: "Radar © RainViewer",
          });
          const before = map.getLayer(FIELD_LAYER) ? FIELD_LAYER : firstSymbolLayer(map);
          map.addLayer(
            {
              id: RADAR_LAYER,
              type: "raster",
              source: RADAR_SOURCE,
              paint: { "raster-opacity": opacity, "raster-fade-duration": 0 },
            },
            before
          );
          radarUrlRef.current = url;
          return;
        }
        if (radarUrlRef.current !== url) {
          source.setTiles([url]);
          radarUrlRef.current = url;
        }
        map.setPaintProperty(RADAR_LAYER, "raster-opacity", opacity);
        map.setLayoutProperty(RADAR_LAYER, "visibility", "visible");
      };

      const applyField = () => {
        const map = mapRef.current;
        if (!map) return;
        const { fieldData: data, fieldKey: key, fieldOpacity: opacity } = overlaysRef.current;
        if (!data || !key) {
          if (map.getLayer(FIELD_LAYER)) map.setLayoutProperty(FIELD_LAYER, "visibility", "none");
          return;
        }
        const canvas = renderFieldCanvas(data, PALETTES[key]);
        if (!canvas) return;
        const url = canvas.toDataURL("image/png");
        const coordinates = fieldCoordinates(data);
        const source = map.getSource(FIELD_SOURCE) as ImageSource | undefined;
        if (source) {
          source.updateImage({ url, coordinates });
          map.setPaintProperty(FIELD_LAYER, "raster-opacity", opacity);
          map.setLayoutProperty(FIELD_LAYER, "visibility", "visible");
          return;
        }
        map.addSource(FIELD_SOURCE, { type: "image", url, coordinates });
        map.addLayer(
          {
            id: FIELD_LAYER,
            type: "raster",
            source: FIELD_SOURCE,
            paint: { "raster-opacity": opacity, "raster-fade-duration": 0, "raster-resampling": "linear" },
          },
          firstSymbolLayer(map)
        );
      };

      applyRef.current = { radar: applyRadar, field: applyField };

      const start = initialViewRef.current;
      instance = new maplibre.Map({
        container: containerRef.current,
        style,
        center: [start.center.lon, start.center.lat],
        zoom: start.zoom,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
      mapRef.current = instance;
      activeBasemapRef.current = candidate?.id ?? null;
      instance.addControl(new maplibre.ScaleControl({ maxWidth: 96, unit: "metric" }), "bottom-right");
      instance.touchZoomRotate.disableRotation();
      instance.getCanvas().style.cursor = "crosshair";

      instance.on("styleimagemissing", (event: { id: string }) => {
        const map = mapRef.current;
        if (!map || map.hasImage(event.id)) return;
        const image = circleIcon(event.id, missingIconColor(map));
        if (image) map.addImage(event.id, image);
      });

      const reportViewport = () => {
        if (!instance) return;
        const bounds = instance.getBounds();
        const current = instance.getCenter();
        callbacksRef.current.onViewport({
          lat: current.lat,
          lon: current.lng,
          latSpan: Math.min(Math.max(bounds.getNorth() - bounds.getSouth(), 0.05), 170),
          lonSpan: Math.min(Math.max(bounds.getEast() - bounds.getWest(), 0.05), 360),
        });
      };
      viewportHandler = reportViewport;

      const onPickClick = (event: { lngLat: { lat: number; lng: number } }) => {
        callbacksRef.current.onPick(event.lngLat.lat, event.lngLat.lng);
      };
      clickHandler = onPickClick;

      instance.on("style.load", () => {
        radarUrlRef.current = null;
        applyRef.current?.radar();
        applyRef.current?.field();
      });

      instance.on("load", () => {
        const map = mapRef.current;
        if (cancelled || !map) return;
        callbacksRef.current.onBasemap(candidate, styleError);
        setReady(true);
        callbacksRef.current.onReady({
          zoomIn: () => map.zoomIn(),
          zoomOut: () => map.zoomOut(),
          flyTo: (lat, lon, zoomLevel) =>
            map.flyTo({ center: [lon, lat], zoom: zoomLevel, duration: 900, essential: true }),
        });
        reportViewport();
      });

      instance.on("click", onPickClick);
      instance.on("moveend", reportViewport);

      if (containerRef.current) {
        observer = new ResizeObserver(() => instance?.resize());
        observer.observe(containerRef.current);
      }
    };

    boot();

    return () => {
      cancelled = true;
      observer?.disconnect();
      for (const marker of markerMap.values()) marker.remove();
      markerMap.clear();
      radarUrlRef.current = null;
      activeBasemapRef.current = null;
      applyRef.current = null;
      setReady(false);
      mapRef.current = null;
      if (instance) {
        if (viewportHandler) instance.off("moveend", viewportHandler);
        if (clickHandler) instance.off("click", clickHandler);
        instance.remove();
      }
      instance = null;
      moduleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !ready || !focus) return;
    instance.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom, duration: 900, essential: true });
  }, [ready, focus]);

  useEffect(() => {
    if (!ready) return;
    applyRef.current?.radar();
    applyRef.current?.field();
  }, [ready, radarUrl, radarOpacity, fieldData, fieldKey, fieldOpacity]);

  useEffect(() => {
    if (!ready) return;
    const current = mapRef.current;
    if (!current) return;
    if (basemapId && basemapId === activeBasemapRef.current) return;
    let cancelled = false;

    const resolve = async (): Promise<BasemapOption | null> => {
      if (basemapId) {
        const chosen = BASEMAPS.find((option) => option.id === basemapId) ?? null;
        if (!chosen) return null;
        return (await reachableStyle(chosen.url)) ? chosen : null;
      }
      for (const option of BASEMAPS) {
        if (cancelled) return null;
        if (await reachableStyle(option.url)) return option;
      }
      return null;
    };

    resolve().then((next) => {
      if (cancelled) return;
      const map = mapRef.current;
      if (!map) return;
      if (!next) {
        callbacksRef.current.onBasemap(
          null,
          `The ${basemapId ? "selected" : "preferred"} basemap style could not be reached. Showing the previous style.`
        );
        return;
      }
      if (next.id === activeBasemapRef.current) {
        callbacksRef.current.onBasemap({ id: next.id, label: next.label, attribution: next.attribution }, null);
        return;
      }
      activeBasemapRef.current = next.id;
      radarUrlRef.current = null;
      map.setStyle(next.url);
      callbacksRef.current.onBasemap({ id: next.id, label: next.label, attribution: next.attribution }, null);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, basemapId]);

  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !ready) return;
    const seen = new Set<string>();
    const maplibre = moduleRef.current;
    if (!maplibre) return;
    for (const spec of markers) {
      seen.add(spec.id);
      const existing = markerMapRef.current.get(spec.id);
      if (existing) {
        existing.setLngLat([spec.lon, spec.lat]);
        const node = existing.getElement();
        node.dataset.tone = spec.tone;
        node.title = spec.label;
        node.setAttribute("aria-label", spec.label);
        continue;
      }
      const node = document.createElement("button");
      node.type = "button";
      node.className = "aether-marker";
      node.dataset.tone = spec.tone;
      node.title = spec.label;
      node.setAttribute("aria-label", spec.label);
      node.innerHTML = '<span class="aether-marker-ring"></span><span class="aether-marker-dot"></span>';
      node.onclick = (event) => {
        event.stopPropagation();
        callbacksRef.current.onMarkerClick?.(spec.id);
      };
      const marker = new maplibre.Marker({ element: node, anchor: "center" })
        .setLngLat([spec.lon, spec.lat])
        .addTo(instance);
      markerMapRef.current.set(spec.id, marker);
    }
    for (const [id, marker] of markerMapRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markerMapRef.current.delete(id);
      }
    }
  }, [ready, markers]);

  useEffect(() => {
    const instance = mapRef.current;
    const canvas = windCanvasRef.current;
    if (!instance || !ready || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    type Particle = { lat: number; lon: number; u: number; v: number; speed: number; age: number; life: number; bucket: number };

    let particles: Particle[] = [];
    let frame = 0;
    let lastTime = performance.now();
    let disposed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
    };

    const clear = () => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = [];
    };

    const spawn = (): Particle | null => {
      if (!windData) return null;
      const { north, south, east, west } = windData.bounds;
      return {
        lat: south + Math.random() * (north - south),
        lon: west + Math.random() * Math.max(0, east - west),
        u: 0,
        v: 0,
        speed: 0,
        age: 0,
        life: 40 + Math.random() * 60,
        bucket: 0,
      };
    };

    const density = () => {
      const rect = canvas.getBoundingClientRect();
      return Math.max(160, Math.min(Math.round((rect.width * rect.height) / 5200), 900));
    };

    const paintStatic = () => {
      const rect = canvas.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, rect.height);
      if (!windData) return;
      const step = 26;
      for (let x = step / 2; x < rect.width; x += step) {
        for (let y = step / 2; y < rect.height; y += step) {
          const point = instance.unproject([x, y]);
          const sample = sampleWind(windData, point.lat, point.lng);
          if (!sample) continue;
          const length = Math.min(12, 2 + sample.speed * 0.32);
          const radians = (sample.direction * Math.PI) / 180;
          const dx = Math.sin(radians) * length;
          const dy = -Math.cos(radians) * length;
          context.strokeStyle = `rgba(196, 232, 240, ${Math.min(0.72, 0.16 + sample.speed / 190) * windOpacityRef.current})`;
          context.lineWidth = 1.1;
          context.beginPath();
          context.moveTo(x - dx * 0.5, y - dy * 0.5);
          context.lineTo(x + dx * 0.5, y + dy * 0.5);
          context.stroke();
        }
      }
    };

    const step = (delta: number) => {
      const nudge = 2600 * delta;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        const sample = windData ? sampleWind(windData, particle.lat, particle.lon) : null;
        if (!sample) {
          particle.age += particle.life;
        } else {
          particle.u = sample.u;
          particle.v = sample.v;
          particle.speed = sample.speed;
          particle.lon += (sample.u * nudge) / (111320 * Math.max(0.15, Math.cos((particle.lat * Math.PI) / 180)));
          particle.lat += (sample.v * nudge) / 111320;
          particle.age += 1;
        }
        if (particle.age > particle.life || Math.abs(particle.lat) > 89) {
          const replacement = spawn();
          if (replacement) particles[index] = replacement;
          else {
            particle.age = 0;
            particle.life = 1;
          }
        }
        particles[index].bucket = Math.max(0, Math.min(7, Math.floor(Math.min(particles[index].speed, 130) / 17)));
      }
    };

    const draw = () => {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      const delta = Math.min(0.05, Math.max(0.004, (performance.now() - lastTime) / 1000));
      lastTime = performance.now();
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "rgba(0, 0, 0, 0.09)";
      context.fillRect(0, 0, rect.width, rect.height);
      context.globalCompositeOperation = "source-over";
      const opacity = windOpacityRef.current;
      if (!windData) {
        frame = requestAnimationFrame(draw);
        return;
      }
      while (particles.length < density()) {
        const particle = spawn();
        if (!particle) break;
        particles.push(particle);
      }
      step(delta);
      context.lineCap = "round";
      for (let bucket = 0; bucket < 8; bucket += 1) {
        context.strokeStyle = `rgba(214, 244, 250, ${(0.2 + bucket * 0.062) * opacity})`;
        context.lineWidth = 0.9 + bucket * 0.14;
        context.beginPath();
        for (const particle of particles) {
          if (particle.bucket !== bucket || particle.speed <= 0) continue;
          const head = instance.project([particle.lon, particle.lat]);
          const tail = instance.project([
            particle.lon - (particle.u * 2600 * 0.05) / (111320 * Math.max(0.15, Math.cos((particle.lat * Math.PI) / 180))),
            particle.lat - (particle.v * 2600 * 0.05) / 111320,
          ]);
          context.moveTo(tail.x, tail.y);
          context.lineTo(head.x, head.y);
        }
        context.stroke();
      }
      frame = requestAnimationFrame(draw);
    };

    const onMoveStart = () => {
      clear();
    };
    const onMoveEnd = () => {
      if (!windAnimated) paintStatic();
    };

    resize();
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!windAnimated) paintStatic();
    });
    resizeObserver.observe(canvas);
    instance.on("movestart", onMoveStart);
    instance.on("zoomstart", onMoveStart);
    instance.on("moveend", onMoveEnd);
    instance.on("zoomend", onMoveEnd);

    if (windAnimated && windData) {
      frame = requestAnimationFrame(draw);
    } else if (windData) {
      paintStatic();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      instance.off("movestart", onMoveStart);
      instance.off("zoomstart", onMoveStart);
      instance.off("moveend", onMoveEnd);
      instance.off("zoomend", onMoveEnd);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      particles = [];
    };
  }, [ready, windData, windAnimated]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      <canvas ref={windCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#05080f]/70 via-[#05080f]/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#05080f]/75 via-[#05080f]/25 to-transparent" />
      {ready ? null : (
        <div className="absolute inset-0 grid place-items-center bg-[#070d18]/60 backdrop-blur-sm">
          <span className="muted text-[11.5px]">Initialising the map renderer…</span>
        </div>
      )}
    </div>
  );
}
