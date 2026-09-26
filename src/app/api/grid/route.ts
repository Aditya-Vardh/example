import { NextResponse } from "next/server";
import { errorMessage, errorStatus } from "@/lib/http";
import { getGridSamples, OPEN_METEO_ATTRIBUTION, type GridPoint } from "@/lib/openmeteo";

const MAX_POINTS = 48;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const span = Number(params.get("span"));
  const nx = Math.round(Number(params.get("nx")));
  const ny = Math.round(Number(params.get("ny")));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }
  if (!Number.isFinite(span) || span <= 0 || span > 120) {
    return NextResponse.json({ error: "Span must be between 0 and 120 degrees." }, { status: 400 });
  }

  const columns = Math.min(Math.max(nx || 6, 2), 8);
  const rows = Math.min(Math.max(ny || 6, 2), 8);
  if (columns * rows > MAX_POINTS) {
    return NextResponse.json({ error: `Grid is limited to ${MAX_POINTS} sample points per request.` }, { status: 400 });
  }

  const latSpan = span / 2;
  const lonSpan = span / 2 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const points: GridPoint[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const latOffset = rows === 1 ? 0 : (row / (rows - 1) - 0.5) * 2;
      const lonOffset = columns === 1 ? 0 : (column / (columns - 1) - 0.5) * 2;
      const pointLat = Math.max(-85, Math.min(85, lat + latOffset * latSpan));
      const rawLon = lon + lonOffset * lonSpan;
      const pointLon = ((((rawLon + 180) % 360) + 360) % 360) - 180;
      points.push({ lat: pointLat, lon: pointLon });
    }
  }

  try {
    const samples = await getGridSamples(points);
    return NextResponse.json(
      {
        samples,
        columns,
        rows,
        span,
        center: { lat, lon },
        bounds: {
          north: Math.max(...samples.map((s) => s.lat)),
          south: Math.min(...samples.map((s) => s.lat)),
          east: Math.max(...samples.map((s) => s.lon)),
          west: Math.min(...samples.map((s) => s.lon)),
        },
        attribution: OPEN_METEO_ATTRIBUTION,
        method: `Bilinear interpolation of ${samples.length} real Open-Meteo sample points — an estimate, not a gridded model field.`,
        fetchedAt: Date.now(),
      },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=900" } }
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Sampled weather grid is unavailable.") }, { status: errorStatus(error) });
  }
}
