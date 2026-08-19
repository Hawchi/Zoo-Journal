"use client";

import { useEffect, useMemo, useState } from "react";
import type { Zoo } from "../zoo-data";

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

const money = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const liveProviders = new Set(["apenheul", "burgers", "gaia", "blijdorp", "pairi", "antwerpen", "leipzig", "berlin"]);

function amountLabel(item: PriceLine) {
  if (item.qualifier === "range" && item.maxAmount !== undefined) return `${money.format(item.amount)} – ${money.format(item.maxAmount)}`;
  if (item.qualifier === "from") return `vanaf ${money.format(item.amount)}`;
  return money.format(item.amount);
}

export function LiveTicketPrices({ zoo }: { zoo: Zoo }) {
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
    ? new Date(payload.checkedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
    : "", [payload?.checkedAt]);

  return <section className="live-prices-panel" aria-live="polite">
    <header className="live-prices-head">
      <div>
        <span className="live-source-badge"><i /> LIVE VAN OFFICIËLE BRON</span>
        <h3>Actuele ticketprijzen</h3>
        <p>Kies jullie bezoekdatum; wij vragen de officiële bron opnieuw op.</p>
      </div>
      <label>Bezoekdatum<input type="date" min={localDate()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </header>

    {loading ? <div className="live-price-loading"><span /><span /><span /></div> : failed ? <div className="live-price-message error"><strong>De prijscheck kon niet worden geladen.</strong><p>Er staat expres geen oud bedrag. Probeer opnieuw of ga direct naar de officiële website.</p></div> : payload && <>
      {payload.prices.length > 0 ? <div className="live-price-grid">{payload.prices.map((item) => <article key={item.label}>
        <span>{item.label}</span>
        <strong>{amountLabel(item)}</strong>
        <small>{payload.precision === "exact-date" ? (item.availability === "sold-out" ? "Niet beschikbaar" : "Voor gekozen datum") : item.qualifier === "from" ? "Officiële vanafprijs" : item.qualifier === "range" ? "Officieel prijsbereik" : "Officieel tarief"}</small>
      </article>)}</div> : <div className="live-price-message"><strong>Prijs alleen zichtbaar in de officiële kalender</strong><p>Deze ticketshop geeft de datumprijs niet betrouwbaar door aan andere websites. Daarom gokken we geen bedrag.</p></div>}

      <div className="live-price-trust-row">
        <span className={`precision-pill ${payload.precision === "exact-date" ? "exact" : "published"}`}>{payload.precision === "exact-date" ? "✓ Exact voor deze datum" : payload.prices.length ? "Actueel gepubliceerd tarief" : "Officiële kalender nodig"}</span>
        <p>{payload.note}</p>
      </div>
      <div className="live-price-footer">
        <p>Gecontroleerd om {checked} bij <a href={payload.sourceUrl} target="_blank" rel="noreferrer">{payload.sourceName}</a></p>
        <div>
          <button type="button" onClick={() => setRefresh((value) => value + 1)}>↻ Opnieuw controleren</button>
          <a className="primary" href={payload.bookingUrl} target="_blank" rel="noreferrer">Beschikbaarheid en tickets</a>
        </div>
      </div>
    </>}

    {!loading && !failed && !payload && <div className="live-price-message"><strong>Geen gekoppelde officiële prijsbron</strong><p>Voor deze dierenplek hebben we nog geen veilige live koppeling. We laten daarom geen voorbeeldprijs zien.</p></div>}

    {failed && <div className="live-price-footer"><p>De officiële website blijft de bron van waarheid.</p><div><button type="button" onClick={() => setRefresh((value) => value + 1)}>Opnieuw proberen</button>{zoo.website && <a className="primary" href={zoo.website} target="_blank" rel="noreferrer">Officiële website</a>}</div></div>}
    {!loading && !failed && !payload && zoo.website && <div className="live-price-footer"><p>Controleer de gekozen datum rechtstreeks bij de locatie.</p><div><a className="primary" href={zoo.website} target="_blank" rel="noreferrer">Officiële ticketpagina</a></div></div>}
  </section>;
}
