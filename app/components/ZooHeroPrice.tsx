"use client";

import { useEffect, useMemo, useState } from "react";
import type { Zoo } from "../zoo-data";

type PriceLine = { label: string; amount: number; maxAmount?: number; qualifier: "exact" | "from" | "range"; availability?: string };
type PricePayload = { precision: "exact-date" | "published-rate" | "none"; prices: PriceLine[]; bookingUrl: string };
type DealPayload = { status: "live" | "none" | "unavailable"; dealUrl: string; discountPercent?: number; regularPrice?: number; dealPrice?: number };

const supported = new Set(["apenheul", "burgers", "gaia", "blijdorp", "pairi", "antwerpen", "leipzig", "berlin"]);
const money = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function adultPrice(prices: PriceLine[]) {
  return prices.find((item) => /(volwassen|adult|erwachsene|vanaf 10|vanaf 12|vanaf 13)/i.test(item.label) && item.amount > 0)
    ?? prices.find((item) => item.amount > 0);
}

function priceLabel(item: PriceLine) {
  if (item.qualifier === "range" && item.maxAmount !== undefined) return `${money.format(item.amount)} – ${money.format(item.maxAmount)}`;
  if (item.qualifier === "from") return `vanaf ${money.format(item.amount)}`;
  return money.format(item.amount);
}

export function ZooHeroPrice({ zoo }: { zoo: Zoo }) {
  const canCheck = supported.has(zoo.id);
  const [price, setPrice] = useState<PricePayload | null>(null);
  const [deal, setDeal] = useState<DealPayload | null>(null);
  const [loading, setLoading] = useState(canCheck);
  const date = useMemo(tomorrow, []);

  useEffect(() => {
    if (!canCheck) return;
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      fetch(`/api/prices?zooId=${encodeURIComponent(zoo.id)}&date=${date}`, { cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<PricePayload> : null),
      fetch(`/api/deals?zooId=${encodeURIComponent(zoo.id)}`, { cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<DealPayload> : null),
    ]).then(([nextPrice, nextDeal]) => { setPrice(nextPrice); setDeal(nextDeal); }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canCheck, date, zoo.id]);

  const adult = adultPrice(price?.prices ?? []);
  if (!canCheck) return <div className="hero-price-row"><a className="hero-price-card unavailable" href={zoo.website} target="_blank" rel="noreferrer"><span>ENTREEPRIJS</span><strong>Bekijk bij locatie</strong><small>Officiële website ↗</small></a></div>;

  return <div className="hero-price-row" aria-live="polite">
    <a className={`hero-price-card official ${loading ? "loading" : ""}`} href={price?.bookingUrl || zoo.website} target="_blank" rel="noreferrer">
      <span><i /> PRIJS VOOR MORGEN</span>
      <strong>{loading ? "Prijs ophalen…" : adult ? priceLabel(adult) : "Bekijk datumprijs"}</strong>
      <small>{adult ? price?.precision === "exact-date" ? "Exact · volwassene" : adult.qualifier === "from" ? "Officiële vanafprijs" : adult.qualifier === "range" ? "Officieel prijsbereik" : "Actueel officieel tarief" : "Officiële ticketkalender"} ↗</small>
    </a>
    <a className={`hero-price-card deal ${deal?.status === "live" ? "active" : ""}`} href={deal?.dealUrl || "https://www.socialdeal.nl/inspirations/wildlife-weeks-75f326a308/arnhem/"} target="_blank" rel="noreferrer">
      <span>SOCIAL DEAL {deal?.status === "live" && <b>−{deal.discountPercent}%</b>}</span>
      {deal?.status === "live" && deal.dealPrice !== undefined ? <strong>{money.format(deal.dealPrice)} <s>{deal.regularPrice !== undefined ? money.format(deal.regularPrice) : ""}</s></strong> : <strong>{loading ? "Dealcheck…" : "Bekijk actuele deals"}</strong>}
      <small>{deal?.status === "live" ? "Actuele aanbieding gevonden" : "Geen vaste korting beloofd"} ↗</small>
    </a>
  </div>;
}
