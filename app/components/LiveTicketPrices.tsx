"use client";

import { useEffect, useMemo, useState } from "react";
import type { Zoo } from "../zoo-data";
import { useLanguage } from "../i18n";

type PriceLine = {
  label: string;
  amount: number;
  maxAmount?: number;
  currency: "EUR";
  qualifier: "exact" | "from" | "range";
  availability?: "available" | "sold-out" | "unknown";
};

type LivePricePayload = {
  status: "live" | "official-only" | "unavailable";
  precision: "exact-date" | "published-rate" | "none";
  checkedAt: string;
  sourceName: string;
  sourceUrl: string;
  bookingUrl: string;
  prices: PriceLine[];
  note: string;
};

function localDate(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const liveProviders = new Set(["apenheul", "burgers", "gaia", "blijdorp", "pairi", "antwerpen", "leipzig", "berlin"]);

function amountLabel(item: PriceLine, language: "nl" | "en") {
  const money = new Intl.NumberFormat(language === "en" ? "en-GB" : "nl-NL", { style: "currency", currency: "EUR" });
  if (item.qualifier === "range" && item.maxAmount !== undefined) return `${money.format(item.amount)} – ${money.format(item.maxAmount)}`;
  if (item.qualifier === "from") return `${language === "en" ? "from" : "vanaf"} ${money.format(item.amount)}`;
  return money.format(item.amount);
}

export function LiveTicketPrices({ zoo }: { zoo: Zoo }) {
  const { language, t, ui } = useLanguage();
  const supported = liveProviders.has(zoo.id);
  const [date, setDate] = useState(() => localDate(1));
  const [payload, setPayload] = useState<LivePricePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!supported) {
      setLoading(false);
      setFailed(false);
      setPayload(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch(`/api/prices?zooId=${encodeURIComponent(zoo.id)}&date=${date}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Prijscheck mislukt");
        return response.json() as Promise<LivePricePayload>;
      })
      .then(setPayload)
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [zoo.id, date, refresh, supported]);

  const checked = useMemo(() => payload?.checkedAt
    ? new Date(payload.checkedAt).toLocaleTimeString(language === "en" ? "en-GB" : "nl-NL", { hour: "2-digit", minute: "2-digit" })
    : "", [payload?.checkedAt, language]);

  return <section className="live-prices-panel" aria-live="polite">
    <header className="live-prices-head">
      <div>
        <span className="live-source-badge"><i /> {t("LIVE VAN OFFICIËLE BRON", "LIVE FROM OFFICIAL SOURCE")}</span>
        <h3>{t("Actuele ticketprijzen", "Current ticket prices")}</h3>
        <p>{t("Kies jullie bezoekdatum; wij vragen de officiële bron opnieuw op.", "Choose your visit date and we will check the official source again.")}</p>
      </div>
      <label>{t("Bezoekdatum", "Visit date")}<input type="date" min={localDate()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </header>

    {loading ? <div className="live-price-loading"><span /><span /><span /></div> : failed ? <div className="live-price-message error"><strong>{t("De prijscheck kon niet worden geladen.", "The price check could not be loaded.")}</strong><p>{t("Er staat expres geen oud bedrag. Probeer opnieuw of ga direct naar de officiële website.", "We intentionally do not show an old price. Try again or visit the official website.")}</p></div> : payload && <>
      {payload.prices.length > 0 ? <div className="live-price-grid">{payload.prices.map((item) => <article key={item.label}>
        <span>{ui(item.label)}</span>
        <strong>{amountLabel(item, language)}</strong>
        <small>{payload.precision === "exact-date" ? (item.availability === "sold-out" ? t("Niet beschikbaar", "Unavailable") : t("Voor gekozen datum", "For selected date")) : item.qualifier === "from" ? t("Officiële vanafprijs", "Official starting price") : item.qualifier === "range" ? t("Officieel prijsbereik", "Official price range") : t("Officieel tarief", "Official rate")}</small>
      </article>)}</div> : <div className="live-price-message"><strong>{t("Prijs alleen zichtbaar in de officiële kalender", "Price only available in the official calendar")}</strong><p>{t("Deze ticketshop geeft de datumprijs niet betrouwbaar door aan andere websites. Daarom gokken we geen bedrag.", "This ticket shop does not reliably share date-specific prices with other websites, so we do not guess.")}</p></div>}

      <div className="live-price-trust-row">
        <span className={`precision-pill ${payload.precision === "exact-date" ? "exact" : "published"}`}>{payload.precision === "exact-date" ? t("✓ Exact voor deze datum", "✓ Exact for this date") : payload.prices.length ? t("Actueel gepubliceerd tarief", "Current published rate") : t("Officiële kalender nodig", "Official calendar required")}</span>
        <p>{ui(payload.note)}</p>
      </div>
      <div className="live-price-footer">
        <p>{t("Gecontroleerd om", "Checked at")} {checked} {t("bij", "via")} <a href={payload.sourceUrl} target="_blank" rel="noreferrer">{payload.sourceName}</a></p>
        <div>
          <button type="button" onClick={() => setRefresh((value) => value + 1)}>↻ {t("Opnieuw controleren", "Check again")}</button>
          <a className="primary" href={payload.bookingUrl} target="_blank" rel="noreferrer">{t("Beschikbaarheid en tickets", "Availability and tickets")}</a>
        </div>
      </div>
    </>}

    {!loading && !failed && !payload && <div className="live-price-message"><strong>{t("Geen gekoppelde officiële prijsbron", "No connected official price source")}</strong><p>{t("Voor deze dierenplek hebben we nog geen veilige live koppeling. We laten daarom geen voorbeeldprijs zien.", "We do not have a secure live connection for this attraction yet, so no example price is shown.")}</p></div>}

    {failed && <div className="live-price-footer"><p>{t("De officiële website blijft de bron van waarheid.", "The official website remains the source of truth.")}</p><div><button type="button" onClick={() => setRefresh((value) => value + 1)}>{t("Opnieuw proberen", "Try again")}</button>{zoo.website && <a className="primary" href={zoo.website} target="_blank" rel="noreferrer">{t("Officiële website", "Official website")}</a>}</div></div>}
    {!loading && !failed && !payload && zoo.website && <div className="live-price-footer"><p>{t("Controleer de gekozen datum rechtstreeks bij de locatie.", "Check the selected date directly with the attraction.")}</p><div><a className="primary" href={zoo.website} target="_blank" rel="noreferrer">{t("Officiële ticketpagina", "Official ticket page")}</a></div></div>}
  </section>;
}
