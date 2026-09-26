import { NextResponse } from "next/server";
import { errorMessage, errorStatus } from "@/lib/http";
import { getRadarState, RADAR_COLOR_SCHEMES, RAINVIEWER_TERMS_URL } from "@/lib/radar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getRadarState();
    return NextResponse.json(
      {
        ...state,
        colorSchemes: RADAR_COLOR_SCHEMES,
        termsUrl: RAINVIEWER_TERMS_URL,
      },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Radar imagery is currently unavailable."), frames: [], unavailable: true },
      { status: errorStatus(error) }
    );
  }
}
