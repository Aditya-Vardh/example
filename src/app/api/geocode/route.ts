import { NextResponse } from "next/server";
import { errorMessage, errorStatus } from "@/lib/http";
import { reverseGeocode, searchPlaces } from "@/lib/openmeteo";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode");

  if (mode === "reverse") {
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
    }
    try {
      const place = await reverseGeocode(lat, lon);
      return NextResponse.json({ place });
    } catch (error) {
      return NextResponse.json({ error: errorMessage(error, "Reverse geocoding is unavailable.") }, { status: errorStatus(error) });
    }
  }

  const query = params.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchPlaces(query, 8);
    return NextResponse.json({ results, query });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Location search is unavailable.") }, { status: errorStatus(error) });
  }
}
