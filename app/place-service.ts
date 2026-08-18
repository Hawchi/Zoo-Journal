import type { AnimalKey, Country, Zoo } from "./zoo-data";

export const CUSTOM_PLACES_KEY = "our-zoo-journal-custom-places-v1";
export const DISCOVERED_PLACES_KEY = "our-zoo-journal-discovered-places-v1";
export const WISHLIST_KEY = "our-zoo-journal-wishlist-v1";
export const VISITED_KEY = "our-zoo-journal-visited-v1";

export const knownCoordinates: Record<string, [number, number]> = {
  burgers: [51.985, 5.9], gaia: [50.866, 6.045], blijdorp: [51.927, 4.449],
  apenheul: [52.216, 5.921], antwerpen: [51.216, 4.421], pairi: [50.584, 3.887],
  leipzig: [51.349, 12.373], berlin: [52.508, 13.337],
};

const animals: AnimalKey[] = ["redpanda", "elephant", "giraffe", "monkey", "tiger", "bear", "flamingo", "lion"];
const countryNames: Record<Country, string> = { NL: "Nederland", BE: "België", DE: "Duitsland" };
const animalParkTypes = ["wildlife_park", "safari_park", "bird_park", "butterfly_garden"];
const pettingPlaceTerms = [
  "kinderboerderij", "kinder-boerderij", "stadsboerderij", "dierenweide", "knuffelboerderij",
  "petting zoo", "petting farm", "streichelzoo", "streichelgehege", "kinderbauernhof", "erlebnisbauernhof",
];

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function normalizedText(values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ").toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function looksLikePettingPlace(values: Array<string | undefined>) {
  const text = normalizedText(values);
  return pettingPlaceTerms.some((term) => text.includes(term));
}

function classifyPlace(tags: Record<string, string>, name: string): Zoo["category"] {
  if (tags.tourism === "aquarium" || tags.zoo === "aquarium") return "aquarium";
  if (tags.zoo === "petting_zoo" || looksLikePettingPlace([
    name, tags.description, tags.operator, tags["name:nl"], tags["name:de"], tags["official_name"], tags["short_name"],
  ])) return "petting-zoo";
  if (animalParkTypes.includes(tags.zoo)) return "animal-park";
  return "zoo";
}

export function repairAnimalPlaceCategory(place: Zoo): Zoo {
  if (place.source !== "openstreetmap" || place.category === "aquarium") return place;
  const shouldBePettingPlace = place.category === "petting-zoo" || looksLikePettingPlace([
    place.name, place.intro, place.about, place.animalsText, ...place.highlights,
  ]);
  if (!shouldBePettingPlace || place.category === "petting-zoo") return place;
  return {
    ...place,
    category: "petting-zoo",
    intro: "Een kinderboerderij uit de actuele dierenplekkenlijst om samen te ontdekken.",
    highlights: ["Kinderboerderij", ...place.highlights.filter((item) => item !== "Dierentuin").slice(0, 2)],
    about: `${place.name} is een kinderboerderij in ${place.city}. De detailpagina vult deze kaartgegevens aan met openbare achtergrondinformatie en foto’s.`,
  };
}

function normalizePlace(element: OverpassElement, country: Country, index: number): Zoo | null {
  const tags = element.tags || {};
  const name = tags.name || tags["name:nl"] || tags["name:de"];
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!name || latitude == null || longitude == null) return null;
  const category = classifyPlace(tags, name);
  const city = tags["addr:city"] || tags["addr:place"] || tags["is_in:city"] || countryNames[country];
  const website = tags.website || tags["contact:website"] || "";
  const address = [tags["addr:street"], tags["addr:housenumber"], tags["addr:postcode"], city].filter(Boolean).join(" ");
  const openingHours = tags.opening_hours || "";
  const kind = category === "aquarium" ? "aquarium of onderwaterwereld" : category === "petting-zoo" ? "kinderboerderij" : category === "animal-park" ? "dierenpark of wildlifepark" : "dierentuin";
  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    city,
    country,
    countryName: countryNames[country],
    distance: 999,
    driveMinutes: 0,
    price: 0,
    website,
    visited: false,
    animal: animals[index % animals.length],
    color: category === "aquarium" ? "#b9d2ce" : "#bac99d",
    intro: `Een ${kind} uit de actuele dierenplekkenlijst om samen te ontdekken.`,
    highlights: [category === "aquarium" ? "Onderwaterwereld" : category === "petting-zoo" ? "Kinderboerderij" : category === "animal-park" ? "Wildlifepark" : "Dierentuin", city, "Live kaartdata"],
    about: `${name} is een ${kind} in ${city}. De detailpagina vult deze kaartgegevens aan met openbare achtergrondinformatie en foto’s.`,
    animalsText: tags.description || `Het actuele dierenaanbod van ${name} kan per seizoen veranderen. Bekijk de highlights en openbare achtergrondinformatie op de detailpagina.`,
    infoText: [openingHours ? `Openingstijden: ${openingHours}.` : "Openingstijden worden door de locatie beheerd.", address ? `Adres: ${address}.` : "Open de routeknop voor het juiste adres."].join(" "),
    potential: { romantic: 3, animals: 4, food: 3, travel: 3 },
    category,
    latitude,
    longitude,
    source: "openstreetmap",
    openingHours,
    address,
    phone: tags.phone || tags["contact:phone"] || "",
    wikipedia: tags.wikipedia || "",
  };
}

async function loadCountry(country: Country): Promise<Zoo[]> {
  const query = `[out:json][timeout:60];area["ISO3166-1"="${country}"][admin_level=2]->.searchArea;(nwr["tourism"="zoo"](area.searchArea);nwr["tourism"="aquarium"](area.searchArea););out center tags;`;
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let data: { elements?: OverpassElement[] } | null = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: `data=${encodeURIComponent(query)}` });
      if (!response.ok) continue;
      data = await response.json() as { elements?: OverpassElement[] };
      break;
    } catch {
      // Probeer de volgende openbare kaartserver.
    }
  }
  if (!data) throw new Error(`Kaartgegevens voor ${country} zijn niet beschikbaar.`);
  return (data.elements || []).map((element, index) => normalizePlace(element, country, index)).filter((place): place is Zoo => Boolean(place));
}

export async function loadAllAnimalPlaces(): Promise<Zoo[]> {
  const results = await Promise.allSettled([loadCountry("NL"), loadCountry("BE"), loadCountry("DE")]);
  const unique = new Map<string, Zoo>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const place of result.value) unique.set(place.name.toLowerCase(), place);
  }
  if (!unique.size) throw new Error("Geen kaartgegevens beschikbaar.");
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function findPlaceCoordinates(name: string, city: string, country: Country): Promise<{ latitude?: number; longitude?: number }> {
  try {
    const query = new URLSearchParams({ q: `${name}, ${city}`, format: "jsonv2", limit: "1", countrycodes: country.toLowerCase() });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, { headers: { "Accept-Language": "nl" } });
    if (!response.ok) return {};
    const results = await response.json() as Array<{ lat: string; lon: string }>;
    return results[0] ? { latitude: Number(results[0].lat), longitude: Number(results[0].lon) } : {};
  } catch {
    return {};
  }
}

export function createCustomPlace(input: {
  name: string; city: string; country: Country; category: Zoo["category"]; website: string; latitude?: number; longitude?: number;
}): Zoo {
  return {
    id: `custom-${Date.now()}`,
    name: input.name.trim(), city: input.city.trim(), country: input.country, countryName: countryNames[input.country],
    distance: 999, driveMinutes: 0, price: 0, website: input.website.trim(), visited: false,
    animal: input.category === "aquarium" ? "flamingo" : "redpanda", color: input.category === "aquarium" ? "#b9d2ce" : "#bac99d",
    intro: input.category === "aquarium" ? "Een zelf toegevoegd aquarium of onderwateruitje." : "Een zelf toegevoegde dierenlocatie.",
    highlights: [input.category === "aquarium" ? "Aquarium" : "Dierenplek", "Zelf toegevoegd"],
    about: "Deze dierenlocatie hebben jullie zelf aan het journal toegevoegd.", animalsText: "Voeg na jullie bezoek eigen herinneringen en een review toe.",
    infoText: "Vul praktische informatie later verder aan.", potential: { romantic: 3, animals: 4, food: 3, travel: 3 },
    category: input.category, latitude: input.latitude, longitude: input.longitude, source: "custom",
  };
}
