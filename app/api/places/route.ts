import { loadAllAnimalPlacesFromMap } from "../../place-service";

export async function GET() {
  try {
    const places = await loadAllAnimalPlacesFromMap();
    return Response.json(
      { places, checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, max-age=21600, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return Response.json(
      { error: "De centrale dierenplekkenlijst kon nu niet worden vernieuwd." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
