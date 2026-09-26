import { cached, fetchJson, fetchText, ProviderError } from "./http";
import { gdacsSchema, nwsAlertsSchema, sachetAlertsSchema, type GdacsFeature, type SachetAlert } from "./schemas";

export type AlertSeverity = "extreme" | "severe" | "moderate" | "minor" | "unknown";
export type AlertProviderId = "nws" | "sachet" | "gdacs" | "meteoalarm";

export type NormalizedAlert = {
  id: string;
  provider: AlertProviderId;
  providerLabel: string;
  official: boolean;
  scope: "local-warning" | "global-hazard";
  event: string;
  severity: AlertSeverity;
  color: string;
  urgency?: string;
  certainty?: string;
  area: string;
  issued: number | null;
  effective: number | null;
  expires: number | null;
  headline: string;
  description?: string;
  instruction?: string;
  language?: string;
  web?: string;
  distanceKm: number | null;
  matchReason: string;
};

export type AlertRegionStatus = {
  provider: AlertProviderId;
  label: string;
  available: boolean;
  reason: string;
  attribution: string;
  coverage: string;
};

export type AlertsResult = {
  alerts: NormalizedAlert[];
  statuses: AlertRegionStatus[];
  fetchedAt: number;
  anyProviderSucceeded: boolean;
};

const NWS_URL = "https://api.weather.gov/alerts/active";
const SACHET_JSON_URL = "https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails";
const SACHET_RSS_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml";
const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";

export const ALERT_ATTRIBUTION: Record<AlertProviderId, string> = {
  nws: "US National Weather Service (api.weather.gov)",
  sachet: "NDMA SACHET — India CAP alerts, IMD-sourced (public domain)",
  gdacs: "GDACS — Global Disaster Alert and Coordination System (JRC/UN OCHA)",
  meteoalarm: "MeteoAlarm / EUMETNET (API key required)",
};

const SEVERITY_RANK: Record<AlertSeverity, number> = { extreme: 4, severe: 3, moderate: 2, minor: 1, unknown: 0 };

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  extreme: "#f43f5e",
  severe: "#fb923c",
  moderate: "#facc15",
  minor: "#38bdf8",
  unknown: "#94a3b8",
};

export function severityRank(severity: AlertSeverity): number {
  return SEVERITY_RANK[severity];
}

function normalizeSeverity(value: string | undefined | null): AlertSeverity {
  const v = (value ?? "").toLowerCase();
  if (v === "extreme") return "extreme";
  if (v === "severe") return "severe";
  if (v === "moderate") return "moderate";
  if (v === "minor") return "minor";
  return "unknown";
}

function parseEpoch(value: string | undefined | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const SACHET_MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const SACHET_ZONE_OFFSET_MINUTES: Record<string, number> = { IST: 330, UTC: 0, GMT: 0 };

function parseSachetEpoch(value: string | undefined | null): number | null {
  if (!value) return null;
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;
  const match = /^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+([A-Za-z]{2,5})\s+(\d{4})$/.exec(
    value.trim()
  );
  if (!match) return null;
  const month = SACHET_MONTHS[match[1].toLowerCase()];
  if (month === undefined) return null;
  const zone = match[6].toUpperCase();
  const offsetMinutes = SACHET_ZONE_OFFSET_MINUTES[zone];
  if (offsetMinutes === undefined) return null;
  const utc = Date.UTC(Number(match[7]), month, Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]));
  return utc - offsetMinutes * 60000;
}

function sachetCertainty(severityLevel: string | undefined): string | undefined {
  if (!severityLevel) return undefined;
  return /likely/i.test(severityLevel) ? severityLevel : undefined;
}

function sachetOffice(author: string | undefined): string | null {
  if (!author) return null;
  const parenthetical = /\(([^)]+)\)/.exec(author);
  if (parenthetical) return parenthetical[1].trim();
  const email = /^[^@\s]+@([^@\s]+)$/.exec(author.trim());
  if (email) return email[1];
  return author.trim();
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function stripHtml(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function extractTag(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return match ? decodeEntities(match[1]) : undefined;
}

export type AlertQuery = {
  lat: number;
  lon: number;
  countryCode?: string;
  placeName?: string;
  admin1?: string;
  admin2?: string;
  radiusKm?: number;
};

function tokenize(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function textMatchScore(text: string, tokens: string[]): number {
  const haystack = text.toLowerCase();
  return tokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

export function isUnitedStates(countryCode: string | undefined): boolean {
  if (!countryCode) return false;
  const code = countryCode.toUpperCase();
  return code === "US" || code === "PR" || code === "VI" || code === "GU" || code === "AS" || code === "MP";
}

export function isIndia(countryCode: string | undefined): boolean {
  return (countryCode ?? "").toUpperCase() === "IN";
}

async function fetchNwsAlerts(query: AlertQuery): Promise<NormalizedAlert[]> {
  const url = new URL(NWS_URL);
  url.search = new URLSearchParams({
    point: `${query.lat.toFixed(4)},${query.lon.toFixed(4)}`,
    status: "actual",
  }).toString();
  const data = await cached(`nws:${query.lat.toFixed(2)}:${query.lon.toFixed(2)}`, 3 * 60 * 1000, () =>
    fetchJson(url.toString(), {
      provider: "NWS alerts",
      schema: nwsAlertsSchema,
      revalidateSeconds: 180,
      headers: { Accept: "application/geo+json" },
    })
  );
  return (data.features ?? []).map((feature, index) => {
    const p = feature.properties;
    const severity = normalizeSeverity(p.severity);
    const issued = parseEpoch(p.sent) ?? parseEpoch(p.effective);
    return {
      id: p.id || `nws-${index}`,
      provider: "nws" as const,
      providerLabel: p.senderName ? `NWS · ${p.senderName}` : "NWS",
      official: true,
      scope: "local-warning" as const,
      event: p.event ?? "Weather alert",
      severity,
      color: SEVERITY_COLOR[severity],
      urgency: p.urgency,
      certainty: p.certainty,
      area: p.areaDesc ?? "Area not specified",
      issued,
      effective: parseEpoch(p.effective) ?? parseEpoch(p.onset),
      expires: parseEpoch(p.ends) ?? parseEpoch(p.expires),
      headline: p.headline ?? p.event ?? "Weather alert",
      description: p.description ? stripHtml(p.description) : undefined,
      instruction: p.instruction ? stripHtml(p.instruction) : undefined,
      language: "en",
      web: p.web ?? feature.id ?? undefined,
      distanceKm: null,
      matchReason: "Active for this exact point",
    };
  });
}

function parseSachetRss(xml: string): Array<{ id: string; title: string; link?: string; issued: number | null; category?: string; author?: string }> {
  const items: Array<{ id: string; title: string; link?: string; issued: number | null; category?: string; author?: string }> = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const title = extractTag(block, "title");
    if (!title) continue;
    const guid = extractTag(block, "guid");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    items.push({
      id: guid ?? link ?? title.slice(0, 60),
      title,
      link,
      issued: pubDate ? parseEpoch(pubDate) : null,
      category: extractTag(block, "category"),
      author: extractTag(block, "author"),
    });
  }
  return items;
}

function severityFromImdColor(color: string | undefined, severityText: string | undefined): AlertSeverity {
  const c = (color ?? "").toLowerCase();
  if (c.includes("red")) return "extreme";
  if (c.includes("orange")) return "severe";
  if (c.includes("yellow")) return "moderate";
  if (c.includes("green")) return "minor";
  const s = (severityText ?? "").toUpperCase();
  if (s.includes("ALERT")) return "extreme";
  if (s.includes("WARNING")) return "severe";
  if (s.includes("WATCH")) return "moderate";
  return "unknown";
}

function parseCentroid(centroid: string | undefined): { lat: number; lon: number } | null {
  if (!centroid) return null;
  const parts = centroid.split(",").map((p) => Number(p.trim()));
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  return { lon: parts[0], lat: parts[1] };
}

async function fetchSachetAlerts(query: AlertQuery, radiusKm: number): Promise<NormalizedAlert[]> {
  const tokens = [...tokenize(query.placeName), ...tokenize(query.admin2), ...tokenize(query.admin1)];
  const origin = { lat: query.lat, lon: query.lon };

  const [rssResult, jsonResult] = await Promise.allSettled([
    cached("sachet:rss", 4 * 60 * 1000, () =>
      fetchText(SACHET_RSS_URL, { provider: "SACHET RSS", revalidateSeconds: 240, timeoutMs: 12000 })
    ),
    cached("sachet:json", 4 * 60 * 1000, () =>
      fetchJson(SACHET_JSON_URL, { provider: "SACHET alerts", schema: sachetAlertsSchema, revalidateSeconds: 240, timeoutMs: 15000 })
    ),
  ]);

  const alerts: NormalizedAlert[] = [];
  const seen = new Set<string>();

  if (rssResult.status === "fulfilled") {
    for (const item of parseSachetRss(rssResult.value)) {
      const score = textMatchScore(item.title, tokens);
      const isWeather = (item.category ?? "").toLowerCase().includes("met") || !item.category;
      if (score === 0 || !isWeather) continue;
      const id = `sachet-rss-${item.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const office = sachetOffice(item.author);
      alerts.push({
        id,
        provider: "sachet",
        providerLabel: office ? `SACHET · ${office}` : "SACHET",
        official: true,
        scope: "local-warning",
        event: item.title.split(/[.:]/)[0].slice(0, 90),
        severity: "unknown",
        color: SEVERITY_COLOR.unknown,
        area: query.admin1 ?? query.placeName ?? "India",
        issued: item.issued,
        effective: item.issued,
        expires: null,
        headline: item.title,
        description: item.title,
        language: "en",
        web: item.link,
        distanceKm: null,
        matchReason: `Official CAP text mentions ${score > 1 ? "this district/state" : "this area"}`,
      });
    }
  }

  if (jsonResult.status === "fulfilled") {
    for (const raw of jsonResult.value as SachetAlert[]) {
      const point = parseCentroid(raw.centroid);
      const distanceKm = point ? haversineKm(origin, point) : null;
      const text = `${raw.area_description ?? ""} ${raw.disaster_type ?? ""} ${raw.warning_message ?? ""}`;
      const score = textMatchScore(text, tokens);
      const near = distanceKm !== null && distanceKm <= radiusKm;
      if (!near && score === 0) continue;
      const id = `sachet-json-${raw.identifier ?? raw.alert_id_sdma_autoinc ?? alerts.length}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const severity = severityFromImdColor(raw.severity_color, raw.severity);
      alerts.push({
        id,
        provider: "sachet",
        providerLabel: raw.alert_source ? `SACHET · ${raw.alert_source}` : "SACHET",
        official: true,
        scope: "local-warning",
        event: raw.disaster_type ?? "Weather warning",
        severity,
        color: raw.severity_color && /red|orange|yellow|green/i.test(raw.severity_color) ? raw.severity_color : SEVERITY_COLOR[severity],
        certainty: sachetCertainty(raw.severity_level),
        area: raw.area_description ?? "Area not specified",
        issued: parseSachetEpoch(raw.effective_start_time) ?? parseSachetEpoch(raw.disseminated),
        effective: parseSachetEpoch(raw.effective_start_time),
        expires: parseSachetEpoch(raw.effective_end_time),
        headline: raw.disaster_type ? `${raw.disaster_type} — ${raw.severity ?? "warning"}` : "Weather warning",
        description: raw.warning_message,
        language: raw.actual_lang ?? "en",
        web: raw.identifier ? `https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=${raw.identifier}` : undefined,
        distanceKm,
        matchReason: near
          ? `Alert centroid ${Math.round(distanceKm ?? 0)} km from this location`
          : "Official alert text matches this district",
      });
    }
  }

  if (rssResult.status === "rejected" && jsonResult.status === "rejected") {
    throw rssResult.reason instanceof Error ? rssResult.reason : new ProviderError("SACHET alerts unavailable.", { kind: "network", provider: "SACHET" });
  }

  return alerts;
}

function gdacsPointCoordinates(feature: GdacsFeature): { lat: number; lon: number } | null {
  const geometry = feature.geometry;
  if (!geometry) return null;
  if (geometry.type === "Point") {
    const coords = geometry.coordinates as unknown;
    if (Array.isArray(coords) && coords.length >= 2 && Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]))) {
      return { lon: Number(coords[0]), lat: Number(coords[1]) };
    }
    return null;
  }
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as unknown;
    if (!Array.isArray(rings) || !Array.isArray(rings[0])) return null;
    const ring = rings[0] as unknown[];
    const points = ring
      .map((pair) => (Array.isArray(pair) && pair.length >= 2 ? { lon: Number(pair[0]), lat: Number(pair[1]) } : null))
      .filter((p): p is { lon: number; lat: number } => p !== null && Number.isFinite(p.lon) && Number.isFinite(p.lat));
    if (points.length === 0) return null;
    return {
      lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
      lon: points.reduce((sum, p) => sum + p.lon, 0) / points.length,
    };
  }
  return null;
}

const GDACS_EVENT_LABELS: Record<string, string> = {
  TC: "Tropical cyclone",
  FL: "Flood",
  EQ: "Earthquake",
  WF: "Wildfire",
  DR: "Drought",
  VO: "Volcano",
  TS: "Tsunami",
};

async function fetchGdacsAlerts(query: AlertQuery, radiusKm: number): Promise<NormalizedAlert[]> {
  const latSpan = radiusKm / 111;
  const lonSpan = radiusKm / Math.max(20, 111 * Math.cos((query.lat * Math.PI) / 180));
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const bbox = [query.lon - lonSpan, query.lat - latSpan, query.lon + lonSpan, query.lat + latSpan]
    .map((v) => v.toFixed(3))
    .join(",");
  const url = new URL(GDACS_URL);
  url.search = new URLSearchParams({
    bbox,
    fromDate: iso(from),
    toDate: iso(now),
    eventlist: "TC;FL;EQ;WF;DR;VO;TS",
    pageSize: "40",
  }).toString();

  const data = await cached(`gdacs:${bbox}`, 15 * 60 * 1000, () =>
    fetchJson(url.toString(), {
      provider: "GDACS",
      schema: gdacsSchema,
      revalidateSeconds: 900,
      timeoutMs: 12000,
    })
  );

  const origin = { lat: query.lat, lon: query.lon };
  const alerts: NormalizedAlert[] = [];
  for (const feature of data.features ?? []) {
    const point = gdacsPointCoordinates(feature);
    if (!point) continue;
    const distanceKm = haversineKm(origin, point);
    if (distanceKm > radiusKm) continue;
    const p = feature.properties;
    const level = (p.alertlevel ?? p.episodealertlevel ?? "Green").toLowerCase();
    const severity: AlertSeverity = level.startsWith("red") ? "extreme" : level.startsWith("orange") ? "severe" : "minor";
    const eventLabel = GDACS_EVENT_LABELS[p.eventtype ?? ""] ?? p.eventtype ?? "Hazard";
    const eventId = `${p.eventtype ?? "XX"}${p.eventid ?? ""}`;
    alerts.push({
      id: `gdacs-${eventId}-${p.episodeid ?? 0}`,
      provider: "gdacs",
      providerLabel: `GDACS · ${p.source ?? "JRC"}`,
      official: true,
      scope: "global-hazard",
      event: `${eventLabel}${p.eventname ? ` — ${p.eventname}` : ""}`,
      severity,
      color: severity === "extreme" ? "#f43f5e" : severity === "severe" ? "#fb923c" : "#38bdf8",
      area: p.country ? `${p.country}${p.iso3 ? ` (${p.iso3})` : ""}` : "Region not specified",
      issued: parseEpoch(p.fromdate),
      effective: parseEpoch(p.fromdate),
      expires: parseEpoch(p.todate),
      headline: p.htmldescription ? stripHtml(p.htmldescription) : p.name ?? eventLabel,
      description: p.htmldescription ? stripHtml(p.htmldescription) : p.description,
      language: "en",
      web: p.url?.report ?? p.url?.details,
      distanceKm,
      matchReason: `Hazard centre ${Math.round(distanceKm)} km from this location`,
    });
  }
  return alerts;
}

export async function getAlerts(query: AlertQuery): Promise<AlertsResult> {
  const radiusKm = query.radiusKm ?? 400;
  const statuses: AlertRegionStatus[] = [];
  const alerts: NormalizedAlert[] = [];
  let succeeded = 0;

  const tasks: Array<Promise<void>> = [];

  if (isUnitedStates(query.countryCode)) {
    tasks.push(
      fetchNwsAlerts(query)
        .then((result) => {
          alerts.push(...result);
          succeeded += 1;
          statuses.push({
            provider: "nws",
            label: "US National Weather Service",
            available: true,
            reason: result.length > 0 ? `${result.length} active alert(s) for this point.` : "No active alerts for this point right now.",
            attribution: ALERT_ATTRIBUTION.nws,
            coverage: "United States and territories",
          });
        })
        .catch((error: unknown) => {
          statuses.push({
            provider: "nws",
            label: "US National Weather Service",
            available: false,
            reason: error instanceof Error ? error.message : "NWS alerts could not be reached.",
            attribution: ALERT_ATTRIBUTION.nws,
            coverage: "United States and territories",
          });
        })
    );
  } else {
    statuses.push({
      provider: "nws",
      label: "US National Weather Service",
      available: false,
      reason: "This location is outside NWS coverage, which is limited to the United States and its territories.",
      attribution: ALERT_ATTRIBUTION.nws,
      coverage: "United States and territories",
    });
  }

  if (isIndia(query.countryCode)) {
    tasks.push(
      fetchSachetAlerts(query, radiusKm)
        .then((result) => {
          alerts.push(...result);
          succeeded += 1;
          statuses.push({
            provider: "sachet",
            label: "IMD warnings via NDMA SACHET",
            available: true,
            reason:
              result.length > 0
                ? `${result.length} official alert(s) matched this location.`
                : "No currently published IMD CAP alerts match this district or state.",
            attribution: ALERT_ATTRIBUTION.sachet,
            coverage: "India (district and state level)",
          });
        })
        .catch((error: unknown) => {
          statuses.push({
            provider: "sachet",
            label: "IMD warnings via NDMA SACHET",
            available: false,
            reason: error instanceof Error ? error.message : "SACHET alerts could not be reached.",
            attribution: ALERT_ATTRIBUTION.sachet,
            coverage: "India (district and state level)",
          });
        })
    );
  } else {
    statuses.push({
      provider: "sachet",
      label: "IMD warnings via NDMA SACHET",
      available: false,
      reason: "SACHET publishes alerts for India only.",
      attribution: ALERT_ATTRIBUTION.sachet,
      coverage: "India (district and state level)",
    });
  }

  statuses.push({
    provider: "meteoalarm",
    label: "MeteoAlarm (Europe)",
    available: false,
    reason: process.env.METEOALARM_API_KEY
      ? "A MeteoAlarm key is configured but this integration is not enabled in this build."
      : "MeteoAlarm requires an approved API key from EUMETNET and is not configured, so European official warnings are not shown.",
    attribution: ALERT_ATTRIBUTION.meteoalarm,
    coverage: "Europe (EUMETNET members)",
  });

  tasks.push(
    fetchGdacsAlerts(query, radiusKm)
      .then((result) => {
        alerts.push(...result);
        succeeded += 1;
        statuses.push({
          provider: "gdacs",
          label: "GDACS global hazard alerts",
          available: true,
          reason:
            result.length > 0
              ? `${result.length} large-scale hazard(s) within ${radiusKm} km. These are not local meteorological warnings.`
              : `No large-scale hazards recorded within ${radiusKm} km in the last 30 days.`,
          attribution: ALERT_ATTRIBUTION.gdacs,
          coverage: "Global (large-scale hazards only)",
        });
      })
      .catch((error: unknown) => {
        statuses.push({
          provider: "gdacs",
          label: "GDACS global hazard alerts",
          available: false,
          reason: error instanceof Error ? error.message : "GDACS could not be reached.",
          attribution: ALERT_ATTRIBUTION.gdacs,
          coverage: "Global (large-scale hazards only)",
        });
      })
  );

  await Promise.all(tasks);

  const now = Date.now();
  const active = alerts.filter((alert) => alert.expires === null || alert.expires > now - 6 * 3600000);

  active.sort((a, b) => {
    const rank = severityRank(b.severity) - severityRank(a.severity);
    if (rank !== 0) return rank;
    return (b.issued ?? 0) - (a.issued ?? 0);
  });

  return { alerts: active, statuses, fetchedAt: Date.now(), anyProviderSucceeded: succeeded > 0 };
}
