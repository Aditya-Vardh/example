import { NextResponse } from "next/server";
import { errorMessage, errorStatus } from "@/lib/http";
import { getForecast, OPEN_METEO_ATTRIBUTION } from "@/lib/openmeteo";

function parseCoord(value: string | null, limit: number): number | null {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = parseCoord(params.get("lat"), 90);
  const lon = parseCoord(params.get("lon"), 180);
  if (lat === null || lon === null) {
    return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }

  try {
    const forecast = await getForecast(lat, lon);
    return NextResponse.json(
      { ...forecast, attribution: OPEN_METEO_ATTRIBUTION, fetchedAt: Date.now() },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=900" } }
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Weather data is unavailable.") }, { status: errorStatus(error) });
  }
}
