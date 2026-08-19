type JsonObject = Record<string, unknown>;

const dayCodes: Record<string, string> = {
  monday: "Mo", tuesday: "Tu", wednesday: "We", thursday: "Th", friday: "Fr", saturday: "Sa", sunday: "Su",
};

function objects(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(objects);
  if (!value || typeof value !== "object") return [];
  const object = value as JsonObject;
  return [object, ...Object.values(object).flatMap(objects)];
}

function normalizeDay(value: unknown) {
  const text = String(value || "").toLocaleLowerCase("en").split(/[/#]/).pop() || "";
  return dayCodes[text] || "";
}

function hoursFromJsonLd(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      for (const object of objects(parsed)) {
        const direct = object.openingHours;
        if (typeof direct === "string" && direct.trim()) return direct.trim();
        if (Array.isArray(direct) && direct.length) return direct.map(String).join("; ");
        const specification = object.openingHoursSpecification;
        if (!specification) continue;
        const rows = (Array.isArray(specification) ? specification : [specification]).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const row = item as JsonObject;
          const days = (Array.isArray(row.dayOfWeek) ? row.dayOfWeek : [row.dayOfWeek]).map(normalizeDay).filter(Boolean);
          const opens = String(row.opens || "").slice(0, 5);
          const closes = String(row.closes || "").slice(0, 5);
          if (!days.length || !opens || !closes) return [];
          return days.map((day) => `${day} ${opens}-${closes}`);
        });
        if (rows.length) return rows.join("; ");
      }
    } catch {
      // Een kapot JSON-LD-blok mag een andere bron niet blokkeren.
    }
  }
  return "";
}

async function hoursFromOfficialWebsite(website: string) {
  if (!website) return "";
  try {
    const response = await fetch(website, {
      headers: { "Accept-Language": "nl,en;q=0.8", "User-Agent": "OurZooJournal/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return "";
    return hoursFromJsonLd((await response.text()).slice(0, 2_000_000));
  } catch { return ""; }
}

async function hoursFromMap(name: string, city: string, country: string) {
  try {
    const query = new URLSearchParams({ q: `${name}, ${city}`, format: "jsonv2", limit: "1", countrycodes: country.toLowerCase(), extratags: "1" });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
      headers: { "Accept-Language": "nl", "User-Agent": "OurZooJournal/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return "";
    const results = await response.json() as Array<{ extratags?: { opening_hours?: string } }>;
    return results[0]?.extratags?.opening_hours || "";
  } catch { return ""; }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = String(url.searchParams.get("name") || "").trim();
  const city = String(url.searchParams.get("city") || "").trim();
  const country = String(url.searchParams.get("country") || "NL").trim();
  const website = String(url.searchParams.get("website") || "").trim();
  if (!name) return Response.json({ hours: "", status: "unavailable" }, { status: 400 });

  const official = await hoursFromOfficialWebsite(website);
  if (official) return Response.json({ hours: official, status: "official", sourceName: "Officiële website", sourceUrl: website }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } });
  const mapped = await hoursFromMap(name, city, country);
  if (mapped) return Response.json({ hours: mapped, status: "map", sourceName: "OpenStreetMap", sourceUrl: `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${name} ${city}`)}` }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } });

  return Response.json({
    hours: "",
    status: "unavailable",
    googleUrl: `https://www.google.com/search?q=${encodeURIComponent(`${name} ${city} openingstijden`)}`,
    message: "De officiële website en openbare kaartgegevens geven geen uitleesbare tijden.",
  }, { headers: { "Cache-Control": "public, max-age=1800, s-maxage=3600" } });
}
