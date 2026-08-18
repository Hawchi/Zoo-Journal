import type { Zoo } from "./zoo-data";

export type PlaceMedia = {
  title: string;
  thumbnailUrl: string;
  sourceUrl: string;
  credit: string;
};

export type PlaceEnrichment = {
  summary?: string;
  summarySource?: string;
  media: PlaceMedia[];
};

export type OfficialAnimalIndex = {
  status: "official" | "curated" | "unavailable";
  zooId: string;
  checkedAt: string;
  sourceName: string;
  sourceUrl: string;
  names: string[];
  complete: boolean;
  note: string;
};

const enrichmentCache = new Map<string, PlaceEnrichment>();
const animalMediaCache = new Map<string, PlaceMedia | null>();
const animalIndexCache = new Map<string, OfficialAnimalIndex>();

function textOnly(value?: string) {
  if (!value) return "Wikimedia Commons";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Wikimedia Commons";
}

async function loadSummary(zoo: Zoo) {
  const language = zoo.country === "DE" ? "de" : "nl";
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: zoo.name, gsrlimit: "1", prop: "extracts|info",
    exintro: "1", explaintext: "1", inprop: "url", format: "json", origin: "*",
  });
  const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`);
  if (!response.ok) return {};
  const payload = await response.json() as { query?: { pages?: Record<string, { extract?: string; fullurl?: string }> } };
  const page = Object.values(payload.query?.pages || {})[0];
  return { summary: page?.extract, summarySource: page?.fullurl };
}

async function loadMedia(zoo: Zoo): Promise<PlaceMedia[]> {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: zoo.name, gsrnamespace: "6", gsrlimit: "8",
    prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: "900", format: "json", origin: "*",
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
  if (!response.ok) return [];
  const payload = await response.json() as { query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string; mime?: string; extmetadata?: { Artist?: { value?: string }; Credit?: { value?: string } } }> }> } };
  return Object.values(payload.query?.pages || {}).flatMap((page) => {
    const image = page.imageinfo?.[0];
    if (!image || !image.mime?.startsWith("image/") || !(image.thumburl || image.url)) return [];
    return [{
      title: page.title.replace(/^File:/, ""),
      thumbnailUrl: image.thumburl || image.url || "",
      sourceUrl: image.descriptionurl || image.url || "",
      credit: textOnly(image.extmetadata?.Artist?.value || image.extmetadata?.Credit?.value),
    }];
  }).slice(0, 6);
}

export async function loadPlaceEnrichment(zoo: Zoo): Promise<PlaceEnrichment> {
  const cached = enrichmentCache.get(zoo.id);
  if (cached) return cached;
  const [summary, media] = await Promise.all([
    loadSummary(zoo).catch(() => ({})),
    loadMedia(zoo).catch(() => []),
  ]);
  const enrichment = { ...summary, media };
  enrichmentCache.set(zoo.id, enrichment);
  return enrichment;
}

async function loadOneAnimalImage(animalName: string, country: Zoo["country"]): Promise<PlaceMedia | null> {
  const language = country === "DE" ? "de" : "nl";
  const cacheKey = `${language}:${animalName.toLocaleLowerCase(language)}`;
  if (animalMediaCache.has(cacheKey)) return animalMediaCache.get(cacheKey) || null;
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: `"${animalName}" ${language === "de" ? "Tier" : "dier"}`,
    gsrnamespace: "0", gsrlimit: "5", prop: "pageimages|info", piprop: "thumbnail", pithumbsize: "720",
    inprop: "url", format: "json", origin: "*",
  });
  try {
    const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`);
    if (!response.ok) return null;
    const payload = await response.json() as { query?: { pages?: Record<string, { title: string; index?: number; fullurl?: string; thumbnail?: { source?: string } }> } };
    const page = Object.values(payload.query?.pages || {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99)).find((item) => item.thumbnail?.source && item.fullurl);
    const result = page?.thumbnail?.source && page.fullurl ? {
      title: animalName,
      thumbnailUrl: page.thumbnail.source,
      sourceUrl: page.fullurl,
      credit: `${language === "de" ? "Wikipedia (DE)" : "Wikipedia (NL)"} — ${page.title}`,
    } : null;
    animalMediaCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

export async function loadAnimalMedia(animalNames: string[], country: Zoo["country"]) {
  const results = await Promise.all(animalNames.slice(0, 8).map((animalName) => loadOneAnimalImage(animalName, country)));
  return results.filter((item): item is PlaceMedia => Boolean(item));
}

export async function loadOfficialAnimalIndex(zoo: Zoo): Promise<OfficialAnimalIndex> {
  const cached = animalIndexCache.get(zoo.id);
  if (cached) return cached;
  const params = new URLSearchParams({ zooId: zoo.id });
  if (zoo.website) params.set("website", zoo.website);
  const response = await fetch(`/api/animals?${params.toString()}`);
  if (!response.ok) throw new Error("De officiële dierenlijst kon niet worden geladen.");
  const result = await response.json() as OfficialAnimalIndex;
  animalIndexCache.set(zoo.id, result);
  return result;
}
