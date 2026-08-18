type AnimalIndexStatus = "official" | "curated" | "unavailable";

type AnimalIndexResponse = {
  status: AnimalIndexStatus;
  zooId: string;
  checkedAt: string;
  sourceName: string;
  sourceUrl: string;
  names: string[];
  complete: boolean;
  note: string;
};

type OfficialAnimalSource = {
  name: string;
  url: string;
  fallback: string[];
};

const officialSources: Record<string, OfficialAnimalSource> = {
  burgers: {
    name: "Burgers’ Zoo: dierenwiki",
    url: "https://www.burgerszoo.nl/wiki/dieren",
    fallback: ["leeuw", "okapi", "gorilla", "haai", "zeekoe", "aardvarken", "chimpansee", "rode panda"],
  },
  gaia: {
    name: "GaiaZOO: dieren",
    url: "https://www.gaiazoo.nl/dieren/",
    fallback: ["giraffe", "witte neushoorn", "leeuw", "gorilla", "flamingo", "wolf", "rode panda", "veelvraat"],
  },
  blijdorp: {
    name: "Diergaarde Blijdorp: dieren en planten",
    url: "https://diergaardeblijdorp.nl/nl/ontdek/dieren-planten",
    fallback: ["Aziatische olifant", "haai", "rog", "ijsbeer", "giraffe", "gorilla", "rode panda", "okapi"],
  },
  pairi: {
    name: "Pairi Daiza: dierenoverzicht",
    url: "https://www.pairidaiza.eu/nl/nederland/",
    fallback: ["reuzenpanda", "koala", "olifant", "walrus", "orang-oetan", "Siberische tijger", "rode panda", "pinguïn", "ijsbeer", "gorilla", "wombat", "maraboe-ooievaar"],
  },
  antwerpen: {
    name: "ZOO Antwerpen: parkoverzicht",
    url: "https://www.zooantwerpen.be/nl/zoo-antwerpen/",
    fallback: ["olifant", "giraffe", "leeuw", "okapi", "gorilla", "chimpansee", "uilenkopmeerkat", "Kaapse buffel", "koala", "Goodfellowboomkangoeroe", "zwartvoetpinguïn", "zeehond"],
  },
  apenheul: {
    name: "Apenheul: Apen-ABC",
    url: "https://www.apenheul.nl/ontdek-apenheul",
    fallback: ["gorilla", "doodshoofdaap", "orang-oetan", "bonobo", "brulaap", "maki", "neusaap", "berberaap"],
  },
  leipzig: {
    name: "Zoo Leipzig: Tierlexikon",
    url: "https://www.zoo-leipzig.de/tiere-erlebniswelten/tierlexikon/",
    fallback: ["Mississippi-Alligator", "Rothschildgiraffe", "Sibirisches Moschustier", "Ostafrikanisches Spitzmaulnashorn", "Strahlenschildkröte", "Sumatra-Orang-Utan", "Okapi", "Schabrackentapir", "Riesenotter", "Przewalskipferd", "Scharlachsichler", "Säbelantilope"],
  },
  berlin: {
    name: "Zoo Berlin: tierische bewoners",
    url: "https://www.zoo-berlin.de/de/zoo-erleben/tiere-erlebniswelten",
    fallback: ["Afrikanischer Löwe", "Asiatischer Elefant", "Amurtiger", "Brillenpinguin", "Capybara", "Erdferkel", "Gorilla", "Großer Panda", "Jaguar", "Okapi", "Panzernashorn", "Sumatra-Orang-Utan", "Zwergflusspferd", "Zwergotter"],
  },
};

const animalWords = [
  "aardvarken", "adelaar", "alligator", "alpaca", "antilope", "ara", "beer", "bever", "bizon", "boa", "bonobo", "boomkangoeroe", "buffel", "capybara", "chimpansee", "dolfijn", "dromedaris", "dwergnijlpaard", "eland", "flamingo", "gibbon", "gier", "giraffe", "gorilla", "haai", "hert", "hyena", "ijsbeer", "jaguar", "kameel", "kangoeroe", "koala", "krokodil", "lama", "leeuw", "leguaan", "luiaard", "maki", "mangoest", "miereneter", "nijlpaard", "neushoorn", "okapi", "olifant", "orang-oetan", "otter", "panda", "panter", "papegaai", "pinguïn", "python", "ratelslang", "rog", "schildpad", "stokstaartje", "takin", "tapir", "tijger", "uil", "varaan", "veelvraat", "vleermuis", "walrus", "wasbeer", "wolf", "wombat", "zebra", "zeehond", "zeekoe", "zeeleeuw",
  "affe", "alligator", "ameisenbär", "antilope", "bär", "elefant", "erdferkel", "erdmännchen", "faultier", "flamingo", "frosch", "giraffe", "gorilla", "jaguar", "känguru", "kiwi", "löwe", "nashorn", "orang-utan", "otter", "panda", "pinguin", "schaf", "schildkröte", "seelöwe", "takin", "tapir", "tiger", "vogel", "wolf", "zebra", "ziege",
  "lion", "elephant", "giraffe", "gorilla", "panda", "penguin", "rhino", "rhinoceros", "tiger", "turtle", "walrus", "wolf",
];

const genericLabels = new Set([
  "dieren", "animal", "animals", "tiere", "tier", "diersoorten", "tierarten", "onze dieren", "alle dieren", "meer dieren", "meer informatie", "lees meer", "bekijk", "ontdek", "home", "menu", "tickets", "nieuws", "bezoek", "bezoekinfo", "over ons", "contact", "image", "foto", "video", "terug", "volgende", "vorige", "laden", "meer laden", "erlebniswelten", "dieren en planten", "planten",
]);

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, ", ")
    .replace(/&auml;/gi, "ä")
    .replace(/&ouml;/gi, "ö")
    .replace(/&uuml;/gi, "ü")
    .replace(/&szlig;/gi, "ß")
    .replace(/&eacute;/gi, "é")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function plainText(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalized(value: string) {
  return value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function cleanAnimalName(value: string) {
  const cleaned = plainText(value)
    .replace(/^(image|foto|afbeelding|tier|dier)\s*:?\s*/i, "")
    .replace(/\s+(lees meer|meer informatie|bekijk)\s*$/i, "")
    .replace(/^[•·|–\u2014-]+|[•·|–\u2014-]+$/g, "")
    .trim();
  if (cleaned.length < 3 || cleaned.length > 58 || cleaned.split(/\s+/).length > 6) return "";
  if (/\d|[.!?;:]|\b(?:ticket|opening|restaurant|agenda|nieuws|route|website|shop|wereld|gebied|verblijf|programma|ervaring|project)\b/i.test(cleaned)) return "";
  const key = normalized(cleaned);
  if (genericLabels.has(key)) return "";
  const animalLike = animalWords.some((word) => key.includes(normalized(word)));
  return animalLike ? cleaned : "";
}

function collectAnimalNames(html: string) {
  const names = new Map<string, string>();
  const add = (value: string) => {
    const name = cleanAnimalName(value);
    if (name) names.set(normalized(name), name);
  };

  for (const match of html.matchAll(/<(?:h2|h3|h4|h5|figcaption)[^>]*>([\s\S]*?)<\/(?:h2|h3|h4|h5|figcaption)>/gi)) add(match[1]);
  for (const match of html.matchAll(/<img[^>]+(?:alt|title)=["']([^"']+)["'][^>]*>/gi)) add(match[1]);
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']*(?:dier|animal|tier|species|soort|apen)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) add(match[2]);

  const pageText = normalized(plainText(html));
  for (const word of animalWords) {
    const key = normalized(word);
    if (new RegExp(`(^|[^a-zäöüßé])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zäöüßé]|$)`, "i").test(pageText)) add(word);
  }
  return [...names.values()].slice(0, 180);
}

function safePublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchHtml(url: URL) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Our-Zoo-Journal-Animal-Index/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Officiële bron gaf status ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) throw new Error("Bron is geen webpagina");
  return (await response.text()).slice(0, 2_500_000);
}

function bestAnimalPage(html: string, base: URL) {
  const scored: Array<{ url: URL; score: number }> = [];
  for (const match of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const candidate = new URL(decodeHtml(match[1]), base);
      if (candidate.origin !== base.origin || !['http:', 'https:'].includes(candidate.protocol)) continue;
      const haystack = normalized(`${candidate.pathname} ${plainText(match[2])}`);
      let score = 0;
      if (/dieren|animals|tiere|tierlexikon|tierarten|species|apen-abc/.test(haystack)) score += 5;
      if (/ontdek|bewoners|fauna|wiki/.test(haystack)) score += 2;
      if (/nieuws|ticket|shop|agenda|blog|vacature/.test(haystack)) score -= 6;
      if (score > 0) scored.push({ url: candidate, score });
    } catch {
      // Sla ongeldige links over.
    }
  }
  return scored.sort((a, b) => b.score - a.score || a.url.pathname.length - b.url.pathname.length)[0]?.url;
}

function mergeNames(...groups: string[][]) {
  const unique = new Map<string, string>();
  for (const group of groups) for (const name of group) unique.set(normalized(name), name);
  return [...unique.values()];
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const zooId = params.get("zooId")?.slice(0, 120) ?? "";
  const website = params.get("website")?.slice(0, 1000) ?? "";
  const configured = officialSources[zooId];
  const requestedUrl = configured ? new URL(configured.url) : safePublicUrl(website);
  const checkedAt = new Date().toISOString();

  if (!zooId || !requestedUrl) {
    const payload: AnimalIndexResponse = {
      status: "unavailable", zooId, checkedAt, sourceName: "Geen officiële dierenlijst", sourceUrl: website,
      names: [], complete: false,
      note: "Deze dierenplek heeft geen bruikbare officiële website in de kaartgegevens. Daarom verzint het dagboek geen dieren.",
    };
    return Response.json(payload, { headers: { "Cache-Control": "public, max-age=1800" } });
  }

  try {
    let sourceUrl = requestedUrl;
    let html = await fetchHtml(requestedUrl);
    if (!configured) {
      const discovered = bestAnimalPage(html, requestedUrl);
      if (discovered && discovered.href !== requestedUrl.href) {
        sourceUrl = discovered;
        html = await fetchHtml(discovered);
      }
    }
    const parsed = collectAnimalNames(html);
    const names = mergeNames(configured?.fallback ?? [], parsed);
    const payload: AnimalIndexResponse = {
      status: "official",
      zooId,
      checkedAt,
      sourceName: configured?.name ?? `${sourceUrl.hostname.replace(/^www\./, "")}: officiële dierenpagina`,
      sourceUrl: sourceUrl.href,
      names,
      complete: false,
      note: names.length
        ? "Deze namen zijn gecontroleerd via de officiële website. Het overzicht kan een selectie zijn wanneer de locatie haar volledige collectie niet als leesbare lijst publiceert."
        : "De officiële website is bereikbaar, maar publiceert hier geen uitleesbare dierenlijst. Open de bron voor het actuele aanbod.",
    };
    return Response.json(payload, { headers: { "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400" } });
  } catch {
    const fallback = configured?.fallback ?? [];
    const payload: AnimalIndexResponse = {
      status: fallback.length ? "curated" : "unavailable",
      zooId,
      checkedAt,
      sourceName: configured?.name ?? "Officiële website",
      sourceUrl: requestedUrl.href,
      names: fallback,
      complete: false,
      note: fallback.length
        ? "De officiële dierenpagina reageert nu niet. Daarom toont het dagboek tijdelijk alleen de eerder gecontroleerde highlights."
        : "De officiële dierenpagina reageert nu niet. Er worden geen dieren gegokt; probeer later opnieuw of open de officiële website.",
    };
    return Response.json(payload, { headers: { "Cache-Control": "public, max-age=900" } });
  }
}
