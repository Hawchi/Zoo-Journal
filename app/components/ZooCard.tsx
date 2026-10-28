"use client";

import type { Zoo } from "../zoo-data";
import { ZooPhoto } from "./ZooPhoto";
import { useLanguage } from "../i18n";

const flagEmoji: Record<string, string> = { NL: "🇳🇱", BE: "🇧🇪", DE: "🇩🇪" };

export function ZooCard({
  zoo,
  wished,
  onWish,
  onOpen,
  visited,
  onVisited,
}: {
  zoo: Zoo;
  wished: boolean;
  onWish: () => void;
  onOpen: () => void;
  visited?: boolean;
  onVisited?: () => void;
}) {
  const { t, ui } = useLanguage();
  return (
    <article className="zoo-card">
      <button className="zoo-photo-frame" onClick={onOpen} aria-label={`${t("Bekijk", "View")} ${zoo.name}`}>
        <ZooPhoto animal={zoo.animal} alt={zoo.name} />
        <span className="flag">
          {flagEmoji[zoo.country]} {zoo.country}
        </span>
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onWish();
          }}
          className={`mini-heart ${wished ? "active" : ""}`}
          aria-label={t("Verlanglijst", "Wishlist")}
        >
          {wished ? "♥" : "♡"}
        </span>
      </button>
      <div className="zoo-body">
        <small>{zoo.city} · {zoo.distance >= 999 ? (zoo.category === "aquarium" ? t("aquarium", "aquarium") : t("kaartlocatie", "map location")) : `${zoo.distance} km`}</small>
        <h3>
          <button className="link-reset" onClick={onOpen}>
            {zoo.name}
          </button>
        </h3>
        <p>{ui(zoo.intro)}</p>
        <div className="tags">
          {zoo.highlights.map((x) => (
            <i key={x}>{ui(x)}</i>
          ))}
        </div>
        <footer className="zoo-card-actions">
          <button className={`visited-card-button ${visited ? "active" : ""}`} onClick={onVisited}>{visited ? t("Bezoekgegevens", "Visit details") : t("Bezoek registreren", "Record visit")}</button>
          <button className="zoo-open-button" onClick={onOpen}>{t("Bekijk details", "View details")} →</button>
        </footer>
      </div>
    </article>
  );
}
