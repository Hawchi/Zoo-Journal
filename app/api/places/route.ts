import { loadAllAnimalPlacesFromMap, loadAllAnimalPlacesFromWikidata } from "../../place-service";
import { zoos } from "../../zoo-data";

export async function GET() {
  try {
    const places = await loadAllAnimalPlacesFromWikidata();
    return Response.json(
      { places, checkedAt: new Date().toISOString(), source: "wikidata-live" },
      { headers: { "Cache-Control": "public, max-age=21600, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    try {
      const places = await loadAllAnimalPlacesFromMap();
      return Response.json(
        { places, checkedAt: new Date().toISOString(), source: "openstreetmap-live" },
        { headers: { "Cache-Control": "public, max-age=21600, s-maxage=86400, stale-while-revalidate=604800" } },
      );
    } catch {
      return Response.json(
        { places: zoos, checkedAt: new Date().toISOString(), source: "curated-fallback" },
        { headers: { "Cache-Control": "public, max-age=900, s-maxage=1800, stale-while-revalidate=86400" } },
      );
    }
  }
}
