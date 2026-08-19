import { requireMember } from "../_shared/couple-db";

type Coordinates = { latitude: number; longitude: number };

function validCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as Coordinates;
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && point.latitude >= 45 && point.latitude <= 58 && point.longitude >= 1 && point.longitude <= 16;
}

async function cityCoordinates(city: string): Promise<(Coordinates & { label: string }) | null> {
  const query = new URLSearchParams({ city, format: "jsonv2", limit: "1", countrycodes: "nl,be,de" });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
    headers: {
      "Accept-Language": "nl",
      "User-Agent": "OurZooJournal/1.0 (+https://our-zoo-journal.xhawchi.chatgpt.site)",
      Referer: "https://our-zoo-journal.xhawchi.chatgpt.site/",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const first = rows[0];
  if (!first) return null;
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!validCoordinates({ latitude, longitude })) return null;
  return { latitude, longitude, label: String(first.display_name || city).slice(0, 180) };
}

async function drivingRoute(start: Coordinates, destination: Coordinates) {
  const coordinates = `${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({ overview: "false", alternatives: "false", steps: "false" });
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?${params}`, {
    headers: { "User-Agent": "OurZooJournal/1.0 (+https://our-zoo-journal.xhawchi.chatgpt.site)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { code?: string; routes?: Array<{ distance?: number; duration?: number }> };
  const route = payload.routes?.[0];
  if (payload.code !== "Ok" || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return null;
  return { distanceMeters: Number(route.distance), durationSeconds: Number(route.duration) };
}

export async function POST(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json() as { startCity?: string; start?: Coordinates; destination?: Coordinates };
    if (!validCoordinates(body.destination)) return Response.json({ error: "De locatie van deze dierenplek ontbreekt." }, { status: 400 });

    let start: Coordinates;
    let startLabel = "Huidige locatie";
    if (validCoordinates(body.start)) {
      start = body.start;
    } else {
      const city = String(body.startCity || "").trim().slice(0, 80);
      if (city.length < 2 || /\d/.test(city)) return Response.json({ error: "Vul alleen een plaatsnaam in, bijvoorbeeld Tilburg." }, { status: 400 });
      const matched = await cityCoordinates(city);
      if (!matched) return Response.json({ error: "Deze vertrekplaats kon niet worden gevonden. Controleer de spelling." }, { status: 404 });
      start = matched;
      startLabel = matched.label;
    }

    const route = await drivingRoute(start, body.destination);
    if (!route) return Response.json({ error: "Er kon nu geen autoroute worden berekend." }, { status: 502 });
    const oneWayKm = Math.round(route.distanceMeters / 100) / 10;
    const roundTripKm = Math.round(route.distanceMeters / 50) / 10;
    return Response.json({
      oneWayKm,
      roundTripKm,
      durationMinutes: Math.max(1, Math.round(route.durationSeconds / 60)),
      startLabel,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "De routeberekening reageert nu niet. Probeer het straks opnieuw." }, { status: 502 });
  }
}
