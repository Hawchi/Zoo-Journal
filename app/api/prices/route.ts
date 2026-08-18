type PriceQualifier = "exact" | "from" | "range";

type PriceLine = {
  label: string;
  amount: number;
  maxAmount?: number;
  currency: "EUR";
  qualifier: PriceQualifier;
  availability?: "available" | "sold-out" | "unknown";
};

type LivePriceResponse = {
  status: "live" | "official-only" | "unavailable";
  precision: "exact-date" | "published-rate" | "none";
  zooId: string;
  visitDate: string;
  checkedAt: string;
  sourceName: string;
  sourceUrl: string;
  bookingUrl: string;
  prices: PriceLine[];
  note: string;
};

type Provider = {
  name: string;
  sourceUrl: string;
  bookingUrl: string;
  load: (date: string) => Promise<Pick<LivePriceResponse, "status" | "precision" | "prices" | "note">>;
};

const euro = (value: string) => Number(value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value);

function textFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;|&#8217;/gi, "’")
    .replace(/\s+/g, " ")
    .trim();
}

async function officialText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Our-Zoo-Journal-Live-Price-Checker/1.0",
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Officiële bron gaf status ${response.status}`);
  return textFromHtml(await response.text());
}

const price = (label: string, amount: number, qualifier: PriceQualifier = "exact", maxAmount?: number): PriceLine => ({
  label,
  amount,
  ...(maxAmount === undefined ? {} : { maxAmount }),
  currency: "EUR",
  qualifier,
  availability: "unknown",
});

function officialOnly(note: string): Pick<LivePriceResponse, "status" | "precision" | "prices" | "note"> {
  return { status: "official-only", precision: "none", prices: [], note };
}

async function loadApenheul(date: string) {
  const endpoint = `https://tickets.apenheul.nl/api/v1/pricetypes/tickets/${date}/nl-NL`;
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Ticketservice gaf status ${response.status}`);
  const json = await response.json() as { data?: Array<{
    category?: { name?: string };
    priceTypeName?: string;
    price?: number;
    priceKeyCapacity?: Array<{ availableCapacity?: number; slotPrice?: number }>;
  }> } | Array<{
    category?: { name?: string };
    priceTypeName?: string;
    price?: number;
    priceKeyCapacity?: Array<{ availableCapacity?: number; slotPrice?: number }>;
  }>;
  const records = Array.isArray(json) ? json : json.data ?? [];
  const wanted = records.filter((item) => {
    const name = item.priceTypeName ?? "";
    return item.category?.name === "Tickets"
      && /(Volwassenen \(vanaf 13 jaar\)|Kind 3 t\/m 12 jaar|0 t\/m 2 jaar)/i.test(name)
      && !/(zonder datum|parkeren)/i.test(name);
  });
  const seen = new Set<string>();
  const prices = wanted.flatMap((item) => {
    const label = (item.priceTypeName ?? "Ticket").trim();
    if (seen.has(label)) return [];
    seen.add(label);
    const slots = (item.priceKeyCapacity ?? []).filter((slot) => typeof slot.slotPrice === "number" && (slot.availableCapacity ?? 1) > 0);
    const amount = slots.length ? Math.min(...slots.map((slot) => slot.slotPrice as number)) : item.price;
    if (typeof amount !== "number") return [];
    const hasCapacity = (item.priceKeyCapacity ?? []).length > 0;
    return [{ ...price(label, amount), availability: slots.length ? "available" as const : hasCapacity ? "sold-out" as const : "unknown" as const }];
  });
  if (!prices.length) return officialOnly("Voor deze datum kon de officiële ticketservice geen losse dagtickets teruggeven. Controleer de ticketkalender.");
  return {
    status: "live" as const,
    precision: "exact-date" as const,
    prices,
    note: "Deze bedragen komen rechtstreeks uit de officiële ticketservice en horen bij de gekozen bezoekdatum.",
  };
}

async function loadBurgers() {
  const text = await officialText("https://www.burgerszoo.nl/plan-uw-bezoek/prijzen");
  const block = text.match(/Online dagkaart op datum([\s\S]{0,320}?)(?:Groepstarieven|U krijgt 1 euro korting)/i)?.[1] ?? "";
  const child = block.match(/4 t\/m 9 jaar(?: per kind)?\s*\|?\s*€\s*([0-9.,]+)/i)?.[1];
  const adult = block.match(/Volwassene\s*\|?\s*€\s*([0-9.,]+)/i)?.[1];
  if (!child || !adult) return officialOnly("De officiële prijspagina is bereikbaar, maar de bedragen konden niet betrouwbaar worden uitgelezen.");
  return {
    status: "live" as const,
    precision: "published-rate" as const,
    prices: [price("Volwassene", euro(adult)), price("Kind 4 t/m 9 jaar", euro(child)), price("Kind 0 t/m 3 jaar", 0)],
    note: "Actuele online dagkaarttarieven van de officiële prijspagina. Deze dierentuin publiceert één online tarief in plaats van een datumprijs.",
  };
}

const monthNumber: Record<string, number> = { januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5, juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11 };

async function loadGaia(date: string) {
  const text = await officialText("https://tickets.gaiazoo.nl/nl/tickets");
  const visit = new Date(`${date}T12:00:00Z`);
  const headings = [...text.matchAll(/Reguliere tickets van (\d{1,2}) ([a-z]+) t\/m (\d{1,2}) ([a-z]+)/gi)];
  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    const startMonth = monthNumber[match[2].toLowerCase()];
    const endMonth = monthNumber[match[4].toLowerCase()];
    if (startMonth === undefined || endMonth === undefined) continue;
    const start = new Date(Date.UTC(visit.getUTCFullYear(), startMonth, Number(match[1])));
    const end = new Date(Date.UTC(visit.getUTCFullYear(), endMonth, Number(match[3]), 23, 59, 59));
    if (visit < start || visit > end) continue;
    const segmentStart = (match.index ?? 0) + match[0].length;
    const segmentEnd = headings[index + 1]?.index ?? Math.min(text.length, segmentStart + 900);
    const block = text.slice(segmentStart, segmentEnd);
    const adult = block.match(/Vanaf 10 jaar[\s\S]{0,120}?€\s*([0-9.,]+)/i)?.[1];
    const child = block.match(/3 t\/m 9 jaar[\s\S]{0,120}?€\s*([0-9.,]+)/i)?.[1];
    if (adult && child) return {
      status: "live" as const,
      precision: "published-rate" as const,
      prices: [price("Vanaf 10 jaar", euro(adult)), price("Kind 3 t/m 9 jaar", euro(child)), price("Kind 0 t/m 2 jaar", 0)],
      note: `Actuele officiële tarieven voor de bezoekperiode ${match[1]} ${match[2]} t/m ${match[3]} ${match[4]}. Beschikbaarheid controleer je in de ticketshop.`,
    };
  }
  return officialOnly("De gekozen datum valt niet in een ticketperiode die de officiële ticketshop nu publiceert. Open de kalender voor beschikbaarheid.");
}

async function loadBlijdorp() {
  const text = await officialText("https://diergaardeblijdorp.nl/nl/bezoek/tickets?btm=BTM1");
  const amount = text.match(/Ticket op datum[\s\S]{0,180}?vanaf\s*€\s*([0-9.,]+)/i)?.[1];
  if (!amount) return officialOnly("Blijdorp berekent de exacte prijs pas in de datumkalender. Open de officiële ticketshop voor het bedrag van jouw dag.");
  return {
    status: "live" as const,
    precision: "published-rate" as const,
    prices: [price("Ticket op datum", euro(amount), "from")],
    note: "Dit is de actuele officiële vanafprijs. De definitieve prijs kan per bezoekdatum verschillen.",
  };
}

async function loadPairi() {
  const text = await officialText("https://www.pairidaiza.eu/nl/dagtickets/");
  const adult = text.match(/Volwassenen van 12 tot 64 jaar[\s\S]{0,260}?vanaf\s*€\s*([0-9.,]+)[\s\S]{0,180}?maximum van\s*€\s*([0-9.,]+)/i);
  const child = text.match(/Kinderen van 3 tot 11 jaar[\s\S]{0,260}?vanaf\s*€\s*([0-9.,]+)[\s\S]{0,180}?maximum van\s*€\s*([0-9.,]+)/i);
  if (!adult || !child) return officialOnly("Pairi Daiza gebruikt datumprijzen. Open de officiële kalender voor de actuele prijs van de gekozen dag.");
  return {
    status: "live" as const,
    precision: "published-rate" as const,
    prices: [price("Volwassene", euro(adult[1]), "range", euro(adult[2])), price("Kind 3 t/m 11 jaar", euro(child[1]), "range", euro(child[2])), price("Kind onder 3 jaar", 0)],
    note: "Actueel officieel prijsbereik; de exacte prijs hangt af van de bezoekdatum en beschikbaarheid.",
  };
}

async function loadLeipzig(date: string) {
  const text = await officialText("https://www.zoo-leipzig.de/zoobesuch-planen/preise-tickets/");
  const visit = new Date(`${date}T12:00:00Z`);
  const month = visit.getUTCMonth() + 1;
  const day = visit.getUTCDate();
  const summer = month > 3 && month < 11 || (month === 3 && day >= 21);
  const block = text.match(/Tageskarten\*?\s+Sommer[\s\S]{0,1800}?(?:Freier Eintritt|Abendkarten)/i)?.[0] ?? "";
  const adult = block.match(/Erwachsene[\s\S]{0,100}?([0-9]+(?:,[0-9]+)?),?-\s*€[\s\S]{0,40}?([0-9]+(?:,[0-9]+)?),?-\s*€/i);
  const child = block.match(/Kinder \(6 bis 16 Jahre\)[\s\S]{0,160}?([0-9]+(?:,[0-9]+)?),?-\s*€[\s\S]{0,40}?([0-9]+(?:,[0-9]+)?),?-\s*€/i);
  if (!adult || !child) return officialOnly("De officiële seizoenstarieven zijn bereikbaar, maar konden niet betrouwbaar worden uitgelezen.");
  const seasonIndex = summer ? 1 : 2;
  return {
    status: "live" as const,
    precision: "published-rate" as const,
    prices: [price("Volwassene", euro(adult[seasonIndex])), price("Kind 6 t/m 16 jaar", euro(child[seasonIndex])), price("Kind onder 6 jaar", 0)],
    note: `Actueel officieel ${summer ? "zomer" : "winter"}tarief voor de gekozen datum.`,
  };
}

async function loadBerlin() {
  const text = await officialText("https://www.zoo-berlin.de/de/tickets-service/tickets-preise");
  const zooBlock = text.match(/Zoo-Tickets[\s\S]{0,1800}?(?:Aquarium-Tickets|Zoo & Aquarium|Jahreskarten)/i)?.[0] ?? text;
  const adult = zooBlock.match(/Erwachsene[\s\S]{0,180}?Zoo\s+Online:\s+ab\s*([0-9.,]+)\s*€/i)?.[1];
  const child = zooBlock.match(/Kinder[\s\S]{0,180}?Zoo\s+Online:\s+ab\s*([0-9.,]+)\s*€/i)?.[1];
  if (!adult || !child) return officialOnly("Zoo Berlin gebruikt dynamische datumprijzen. Open de officiële kalender voor het bedrag van jouw dag.");
  return {
    status: "live" as const,
    precision: "published-rate" as const,
    prices: [price("Volwassene — Zoo", euro(adult), "from"), price("Kind — Zoo", euro(child), "from")],
    note: "Actuele officiële vanafprijzen. De exacte prijs wordt in de ticketkalender voor de gekozen dag berekend.",
  };
}

const providers: Record<string, Provider> = {
  apenheul: { name: "Apenheul Ticketcounter", sourceUrl: "https://tickets.apenheul.nl/nl-NL/tickets", bookingUrl: "https://tickets.apenheul.nl/nl-NL/tickets", load: loadApenheul },
  burgers: { name: "Burgers’ Zoo", sourceUrl: "https://www.burgerszoo.nl/plan-uw-bezoek/prijzen", bookingUrl: "https://webshop.burgerszoo.nl/", load: loadBurgers },
  gaia: { name: "GaiaZOO ticketshop", sourceUrl: "https://tickets.gaiazoo.nl/nl/tickets", bookingUrl: "https://tickets.gaiazoo.nl/nl/tickets", load: loadGaia },
  blijdorp: { name: "Diergaarde Blijdorp", sourceUrl: "https://diergaardeblijdorp.nl/nl/bezoek/tickets?btm=BTM1", bookingUrl: "https://diergaardeblijdorp.nl/nl/dagtickets-kopen?offer=19029", load: loadBlijdorp },
  pairi: { name: "Pairi Daiza", sourceUrl: "https://www.pairidaiza.eu/nl/dagtickets/", bookingUrl: "https://tickets.pairidaiza.eu/", load: loadPairi },
  antwerpen: { name: "ZOO Antwerpen", sourceUrl: "https://www.zooantwerpen.be/nl/dagtickets/", bookingUrl: "https://webshop.zooantwerpen.be/", load: async () => officialOnly("ZOO Antwerpen publiceert dynamische datumprijzen alleen in de interactieve ticketkalender. Daarom toont het dagboek hier geen gegokt bedrag.") },
  leipzig: { name: "Zoo Leipzig", sourceUrl: "https://www.zoo-leipzig.de/zoobesuch-planen/preise-tickets/", bookingUrl: "https://www.zoo-leipzig.de/zoobesuch-planen/tickets/", load: loadLeipzig },
  berlin: { name: "Zoo Berlin", sourceUrl: "https://www.zoo-berlin.de/de/tickets-service/tickets-preise", bookingUrl: "https://shop.zoo-berlin.de/", load: loadBerlin },
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const zooId = url.searchParams.get("zooId") ?? "";
  const visitDate = url.searchParams.get("date") ?? "";
  const provider = providers[zooId];
  if (!provider || !validDate(visitDate)) {
    return Response.json({ error: "Onbekende dierenplek of ongeldige datum." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let result: Pick<LivePriceResponse, "status" | "precision" | "prices" | "note">;
  try {
    result = await provider.load(visitDate);
  } catch {
    result = {
      status: "unavailable",
      precision: "none",
      prices: [],
      note: "De officiële prijsbron reageert nu niet. Er wordt daarom geen mogelijk verouderd bedrag getoond; probeer opnieuw of open de ticketshop.",
    };
  }

  const payload: LivePriceResponse = {
    ...result,
    zooId,
    visitDate,
    checkedAt: new Date().toISOString(),
    sourceName: provider.name,
    sourceUrl: provider.sourceUrl,
    bookingUrl: provider.bookingUrl,
  };
  return Response.json(payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
