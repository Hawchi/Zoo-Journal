type DealResponse = {
  status: "live" | "none" | "unavailable";
  zooId: string;
  checkedAt: string;
  sourceName: "Social Deal";
  sourceUrl: string;
  dealUrl: string;
  discountPercent?: number;
  regularPrice?: number;
  dealPrice?: number;
  note: string;
};

const sourceUrl = "https://www.socialdeal.nl/inspirations/wildlife-weeks-75f326a308/arnhem/";
const zooAliases: Record<string, string> = {
  burgers: "Burgers' Zoo",
  gaia: "GaiaZOO",
  blijdorp: "Diergaarde Blijdorp",
  pairi: "Pairi Daiza",
  antwerpen: "ZOO Antwerpen",
  apenheul: "Apenheul",
  leipzig: "Zoo Leipzig",
  berlin: "Zoo Berlin",
};
const dealLandingPages: Record<string, string> = {
  burgers: "https://www.socialdeal.nl/bedrijf/arnhem/burgers-zoo/",
  apenheul: "https://www.socialdeal.nl/bedrijf/apeldoorn-deventer/apenheul/",
  gaia: "https://www.socialdeal.nl/bedrijf/parkstad/gaiazoo/",
};

function textFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function amount(value: string) {
  return Number(value.replace(".", "").replace(",", "."));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function directDealUrl(html: string, alias: string) {
  const image = html.match(new RegExp(`alt="[^"]*${escapeRegExp(alias)}[^"]*"`, "i"));
  if (image?.index === undefined) return sourceUrl;
  const anchorStart = html.lastIndexOf("<a ", image.index);
  if (anchorStart < 0) return sourceUrl;
  const anchor = html.slice(anchorStart, image.index);
  const href = anchor.match(/href="([^"]+)"/i)?.[1]?.replace(/&amp;/g, "&");
  try {
    const url = new URL(href ?? "", sourceUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.href : sourceUrl;
  } catch {
    return sourceUrl;
  }
}

export async function GET(request: Request) {
  const zooId = new URL(request.url).searchParams.get("zooId") ?? "";
  const alias = zooAliases[zooId];
  if (!alias) {
    return Response.json({ error: "Onbekende dierenplek." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const base: Omit<DealResponse, "status" | "dealUrl" | "note"> = {
    zooId,
    checkedAt: new Date().toISOString(),
    sourceName: "Social Deal",
    sourceUrl,
  };

  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Our-Zoo-Journal-Deal-Checker/1.0" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`Social Deal gaf status ${response.status}`);
    const html = await response.text();
    const text = textFromHtml(html);
    const deal = text.match(new RegExp(`(\\d{1,2})%[^%]{0,110}?${escapeRegExp(alias)}[^%]{0,260}?Regulier\\s*€\\s*([0-9]+(?:[.,][0-9]{1,2})?)\\s*€\\s*([0-9]+)(?:\\s*,\\s*([0-9]{2}))?`, "i"));
    if (!deal) {
      const payload: DealResponse = {
        ...base,
        status: "none",
        dealUrl: sourceUrl,
        note: "Geen actuele Social Deal voor deze dierenplek gevonden.",
      };
      return Response.json(payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const payload: DealResponse = {
      ...base,
      status: "live",
      dealUrl: dealLandingPages[zooId] ?? directDealUrl(html, alias),
      discountPercent: Number(deal[1]),
      regularPrice: amount(deal[2]),
      dealPrice: Number(deal[3]) + (deal[4] ? Number(deal[4]) / 100 : 0),
      note: "Actueel aangetroffen in het dierentuinoverzicht van Social Deal. Beschikbaarheid en voorwaarden kunnen veranderen.",
    };
    return Response.json(payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    const payload: DealResponse = {
      ...base,
      status: "unavailable",
      dealUrl: sourceUrl,
      note: "De actuele dealcheck reageert nu niet. Open Social Deal om handmatig te controleren.",
    };
    return Response.json(payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
