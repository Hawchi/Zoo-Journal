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

const enrichmentCache = new Map<string, PlaceEnrichment>();
const animalMediaCache = new Map<string, PlaceMedia | null>();

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

async function loadOneAnimalImage(animalName: string): Promise<PlaceMedia | null> {
  if (animalMediaCache.has(animalName)) return animalMediaCache.get(animalName) || null;
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: animalName, gsrnamespace: "6", gsrlimit: "4",
    prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: "600", format: "json", origin: "*",
  });
  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
    if (!response.ok) return null;
    const payload = await response.json() as { query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string; mime?: string; extmetadata?: { Artist?: { value?: string }; Credit?: { value?: string } } }> }> } };
    const page = Object.values(payload.query?.pages || {}).find((item) => item.imageinfo?.[0]?.mime?.startsWith("image/"));
    const image = page?.imageinfo?.[0];
    const result = page && image && (image.thumburl || image.url) ? {
      title: animalName,
      thumbnailUrl: image.thumburl || image.url || "",
      sourceUrl: image.descriptionurl || image.url || "",
      credit: textOnly(image.extmetadata?.Artist?.value || image.extmetadata?.Credit?.value),
    } : null;
    animalMediaCache.set(animalName, result);
    return result;
  } catch {
    return null;
  }
}

export async function loadAnimalMedia(animalNames: string[]) {
  const results = await Promise.all(animalNames.slice(0, 8).map(loadOneAnimalImage));
  return results.filter((item): item is PlaceMedia => Boolean(item));
}
