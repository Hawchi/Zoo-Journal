const weatherLabels: Record<number, { label: string; kind: string }> = {
  0: { label: "Helder", kind: "sun" },
  1: { label: "Grotendeels helder", kind: "sun" },
  2: { label: "Half bewolkt", kind: "cloud" },
  3: { label: "Bewolkt", kind: "cloud" },
  45: { label: "Mistig", kind: "cloud" },
  48: { label: "Mistig", kind: "cloud" },
  51: { label: "Lichte motregen", kind: "rain" },
  53: { label: "Motregen", kind: "rain" },
  55: { label: "Stevige motregen", kind: "rain" },
  61: { label: "Lichte regen", kind: "rain" },
  63: { label: "Regen", kind: "rain" },
  65: { label: "Veel regen", kind: "rain" },
  71: { label: "Lichte sneeuw", kind: "snow" },
  73: { label: "Sneeuw", kind: "snow" },
  75: { label: "Veel sneeuw", kind: "snow" },
  80: { label: "Kans op buien", kind: "rain" },
  81: { label: "Buien", kind: "rain" },
  82: { label: "Stevige buien", kind: "rain" },
  95: { label: "Kans op onweer", kind: "storm" },
  96: { label: "Onweer", kind: "storm" },
  99: { label: "Stevig onweer", kind: "storm" },
};

function isoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lon"));
  const date = String(url.searchParams.get("date") || "");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ status: "unavailable", message: "Kies eerst een geldige datum en dierenplek." }, { status: 400 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00Z`);
  const daysAway = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (daysAway < 0) return Response.json({ status: "past", message: "Voor een afgelopen bezoek tonen we geen weersvoorspelling." });
  if (daysAway > 15) {
    const available = new Date(target);
    available.setUTCDate(available.getUTCDate() - 15);
    return Response.json({ status: "too-early", availableFrom: isoDate(available), message: "De betrouwbare voorspelling verschijnt vijftien dagen voor vertrek." });
  }

  try {
    const query = new URLSearchParams({
      latitude: String(latitude), longitude: String(longitude), timezone: "auto", start_date: date, end_date: date,
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Weerbron reageert niet.");
    const data = await response.json() as { daily?: { weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] } };
    const code = Number(data.daily?.weather_code?.[0]);
    const description = weatherLabels[code] || { label: "Wisselend weer", kind: "cloud" };
    return Response.json({
      status: "forecast",
      date,
      label: description.label,
      kind: description.kind,
      minimum: data.daily?.temperature_2m_min?.[0],
      maximum: data.daily?.temperature_2m_max?.[0],
      rainChance: data.daily?.precipitation_probability_max?.[0],
      source: "Open-Meteo",
      checkedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "public, max-age=900, s-maxage=1800" } });
  } catch {
    return Response.json({ status: "unavailable", message: "Het actuele weer kon nu niet worden opgehaald." }, { status: 503 });
  }
}
