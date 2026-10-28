"use client";

import { useEffect, useMemo, useState } from "react";
import type { Zoo } from "../zoo-data";
import { useLanguage } from "../i18n";

type PriceLine = { label: string; amount: number; maxAmount?: number; qualifier: "exact" | "from" | "range"; availability?: string };
type PricePayload = { precision: "exact-date" | "published-rate" | "none"; prices: PriceLine[]; bookingUrl: string };
type DealPayload = { status: "live" | "none" | "unavailable"; dealUrl: string; discountPercent?: number; regularPrice?: number; dealPrice?: number };

const supported = new Set(["apenheul", "burgers", "gaia", "blijdorp", "pairi", "antwerpen", "leipzig", "berlin"]);
function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function adultPrice(prices: PriceLine[]) {
  return prices.find((item) => /(volwassen|adult|erwachsene|vanaf 10|vanaf 12|vanaf 13)/i.test(item.label) && item.amount > 0)
    ?? prices.find((item) => item.amount > 0);
}

function priceLabel(item: PriceLine, language: "nl" | "en") {
  const money = new Intl.NumberFormat(language === "en" ? "en-GB" : "nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (item.qualifier === "range" && item.maxAmount !== undefined) return `${money.format(item.amount)} – ${money.format(item.maxAmount)}`;
  if (item.qualifier === "from") return `${language === "en" ? "from" : "vanaf"} ${money.format(item.amount)}`;
  return money.format(item.amount);
}

export function ZooHeroPrice({ zoo }: { zoo: Zoo }) {
  const { language, t } = useLanguage();
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
  if (!canCheck) return <div className="hero-price-row"><a className="hero-price-card unavailable" href={zoo.website} target="_blank" rel="noreferrer"><span>{t("ENTREEPRIJS", "ADMISSION PRICE")}</span><strong>{t("Bekijk bij locatie", "View at attraction")}</strong><small>{t("Officiële website", "Official website")}</small></a></div>;

  return <div className="hero-price-row" aria-live="polite">
    <a className={`hero-price-card official ${loading ? "loading" : ""}`} href={price?.bookingUrl || zoo.website} target="_blank" rel="noreferrer">
      <span><i /> {t("PRIJS VOOR MORGEN", "PRICE FOR TOMORROW")}</span>
      <strong>{loading ? t("Prijs ophalen…", "Loading price…") : adult ? priceLabel(adult, language) : t("Bekijk datumprijs", "View date price")}</strong>
      <small>{adult ? price?.precision === "exact-date" ? t("Exact · volwassene", "Exact · adult") : adult.qualifier === "from" ? t("Officiële vanafprijs", "Official starting price") : adult.qualifier === "range" ? t("Officieel prijsbereik", "Official price range") : t("Actueel officieel tarief", "Current official rate") : t("Officiële ticketkalender", "Official ticket calendar")}</small>
    </a>
    <a className={`hero-price-card deal ${deal?.status === "live" ? "active" : ""}`} href={deal?.dealUrl || "https://www.socialdeal.nl/inspirations/wildlife-weeks-75f326a308/arnhem/"} target="_blank" rel="noreferrer">
      <span>SOCIAL DEAL {deal?.status === "live" && <b>−{deal.discountPercent}%</b>}</span>
      {deal?.status === "live" && deal.dealPrice !== undefined ? <strong>{new Intl.NumberFormat(language === "en" ? "en-GB" : "nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(deal.dealPrice)} <s>{deal.regularPrice !== undefined ? new Intl.NumberFormat(language === "en" ? "en-GB" : "nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(deal.regularPrice) : ""}</s></strong> : <strong>{loading ? t("Dealcheck…", "Checking deals…") : t("Bekijk actuele deals", "View current deals")}</strong>}
      <small>{deal?.status === "live" ? t("Actuele aanbieding gevonden", "Current offer found") : t("Geen vaste korting beloofd", "No fixed discount promised")}</small>
    </a>
  </div>;
}
