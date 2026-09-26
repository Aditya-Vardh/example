import { NextResponse } from "next/server";
import { getAlerts, type AlertQuery } from "@/lib/alerts";
import { errorMessage, errorStatus } from "@/lib/http";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }

  const radiusParam = Number(params.get("radius"));
  const query: AlertQuery = {
    lat,
    lon,
    countryCode: params.get("country") ?? undefined,
    placeName: params.get("name") ?? undefined,
    admin1: params.get("admin1") ?? undefined,
    admin2: params.get("admin2") ?? undefined,
    radiusKm: Number.isFinite(radiusParam) && radiusParam > 0 && radiusParam <= 2000 ? radiusParam : 400,
  };

  try {
    const result = await getAlerts(query);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" } });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Weather alerts are unavailable.") }, { status: errorStatus(error) });
  }
}
