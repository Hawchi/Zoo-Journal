import type { Zoo } from "../zoo-data";
import { ZooPhoto } from "./ZooPhoto";

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
  return (
    <article className="zoo-card">
      <button className="zoo-photo-frame" onClick={onOpen} aria-label={`Bekijk ${zoo.name}`}>
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
          aria-label="Verlanglijst"
        >
          {wished ? "♥" : "♡"}
        </span>
      </button>
      <div className="zoo-body">
        <small>{zoo.city} · {zoo.distance >= 999 ? (zoo.category === "aquarium" ? "aquarium" : "kaartlocatie") : `${zoo.distance} km`}</small>
        <h3>
          <button className="link-reset" onClick={onOpen}>
            {zoo.name}
          </button>
        </h3>
        <p>{zoo.intro}</p>
        <div className="tags">
          {zoo.highlights.map((x) => (
            <i key={x}>{x}</i>
          ))}
        </div>
        <footer className="zoo-card-actions">
          <button className={`visited-card-button ${visited ? "active" : ""}`} onClick={onVisited}>{visited ? "✓ Bezocht" : "Ben ik geweest?"}</button>
          <button className="zoo-open-button" onClick={onOpen}>Bekijk details →</button>
        </footer>
      </div>
    </article>
  );
}
