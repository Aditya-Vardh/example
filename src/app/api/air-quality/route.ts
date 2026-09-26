import { NextResponse } from "next/server";
import { errorMessage, errorStatus } from "@/lib/http";
import { getAirQuality, OPEN_METEO_ATTRIBUTION } from "@/lib/openmeteo";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }

  try {
    const data = await getAirQuality(lat, lon);
    return NextResponse.json(
      { ...data, attribution: `${OPEN_METEO_ATTRIBUTION} · CAMS European/Global ensemble`, fetchedAt: Date.now() },
      { headers: { "Cache-Control": "private, max-age=600, stale-while-revalidate=1800" } }
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Air quality data is unavailable.") }, { status: errorStatus(error) });
  }
}
