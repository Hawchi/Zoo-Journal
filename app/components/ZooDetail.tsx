import { useEffect, useState } from "react";
import { loadAnimalMedia, loadPlaceEnrichment, type PlaceEnrichment, type PlaceMedia } from "../place-enrichment";
import { googleMapsDirectionsUrl, wazeDirectionsUrl } from "../route-links";
import type { Rating1to5, Zoo } from "../zoo-data";
import type { UserReview } from "../reviews";
import { LiveTicketPrices } from "./LiveTicketPrices";
import { ZooPhoto } from "./ZooPhoto";

const flagEmoji: Record<string, string> = { NL: "🇳🇱", BE: "🇧🇪", DE: "🇩🇪" };
const tabs = ["Overzicht", "Dieren", "Bezoekinfo", "Foto’s", "Beoordelingen"] as const;
type Tab = (typeof tabs)[number];

const week = [
  ["Mo", "Maandag"], ["Tu", "Dinsdag"], ["We", "Woensdag"], ["Th", "Donderdag"],
  ["Fr", "Vrijdag"], ["Sa", "Zaterdag"], ["Su", "Zondag"],
] as const;

function RatingRow({ label, icon, value }: { label: string; icon: string; value: Rating1to5 }) {
  return <div className="potential-row"><span>{label}</span><span className="potential-icons" aria-label={`${value} van 5`}>{Array.from({ length: 5 }).map((_, index) => <i key={index} className={index < value ? "on" : ""}>{icon}</i>)}</span></div>;
}

function weeklySchedule(value?: string) {
  const rows = week.map(([code, label]) => ({ code, label, hours: "Niet opgegeven" }));
  if (!value) return rows;
  if (value.trim() === "24/7") return rows.map((row) => ({ ...row, hours: "24 uur geopend" }));
  for (const part of value.split(";")) {
    const match = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+(.+)$/);
    if (!match) continue;
    const start = week.findIndex(([code]) => code === match[1]);
    const end = match[2] ? week.findIndex(([code]) => code === match[2]) : start;
    for (let index = start; index <= end; index += 1) rows[index].hours = match[3].replace(/,/g, " en ");
  }
  return rows;
}

function RouteMenu({ zoo }: { zoo: Zoo }) {
  return <details className="route-menu">
    <summary><img src="/icons-clean/map.png" alt="" /> Route openen</summary>
    <div>
      <a href={googleMapsDirectionsUrl(zoo)} target="_blank" rel="noreferrer"><img src="/icons-clean/map.png" alt="" /><span><b>Google Maps</b><small>Autoroute en actuele rijtijd</small></span></a>
      <a href={wazeDirectionsUrl(zoo)} target="_blank" rel="noreferrer"><i className="waze-route-mark">W</i><span><b>Waze</b><small>Direct navigeren</small></span></a>
    </div>
  </details>;
}

export function ZooDetail({ zoo, wished, onWish, onBack, onPlan, review, onReview, locationActive }: {
  zoo: Zoo;
  wished: boolean;
  onWish: () => void;
  onBack: () => void;
  onPlan: () => void;
  review?: UserReview;
  onReview: () => void;
  locationActive: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Overzicht");
  const [enrichment, setEnrichment] = useState<PlaceEnrichment>({ media: [] });
  const [enrichmentLoading, setEnrichmentLoading] = useState(true);
  const [animalMedia, setAnimalMedia] = useState<PlaceMedia[]>([]);
  const [animalsLoading, setAnimalsLoading] = useState(false);
  const [animalMediaLoadedFor, setAnimalMediaLoadedFor] = useState("");

  useEffect(() => {
    let active = true;
    setEnrichmentLoading(true);
    loadPlaceEnrichment(zoo).then((result) => { if (active) setEnrichment(result); }).finally(() => { if (active) setEnrichmentLoading(false); });
    return () => { active = false; };
  }, [zoo.id]);

  useEffect(() => {
    if (tab !== "Dieren" || !zoo.animalNames?.length || animalMediaLoadedFor === zoo.id || animalsLoading) return;
    setAnimalMediaLoadedFor(zoo.id);
    setAnimalsLoading(true);
    loadAnimalMedia(zoo.animalNames).then(setAnimalMedia).finally(() => setAnimalsLoading(false));
  }, [tab, zoo.id, zoo.animalNames, animalMediaLoadedFor, animalsLoading]);

  const animalHighlights = zoo.animalNames?.length ? zoo.animalNames : zoo.animalsText.split(/[,.]/).map((item) => item.trim()).filter((item) => item.length > 2).slice(0, 12);
  const schedule = weeklySchedule(zoo.openingHours);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayHours = schedule[todayIndex]?.hours;
  const categoryLabel = zoo.category === "aquarium" ? "AQUARIUM" : zoo.category === "petting-zoo" ? "KINDERBOERDERIJ" : zoo.category === "animal-park" ? "DIERENPARK" : "DIERENTUIN";

  return <section className="zoo-detail">
    <div className="detail-back-row"><button className="back-link" onClick={onBack}><span aria-hidden="true">←</span> Terug naar alle dierenplekken</button><span>Ontdekken / {zoo.name}</span></div>

    <div className="detail-top">
      <div className="detail-photo"><ZooPhoto animal={zoo.animal} alt={zoo.name} /></div>
      <div className="detail-copy">
        <div className="detail-heading"><div><span className="eyebrow">{categoryLabel}</span><h1>{zoo.name}</h1></div><button className={`heart ${wished ? "active" : ""}`} onClick={onWish} aria-label={wished ? "Verwijder van wishlist" : "Zet op wishlist"}>{wished ? "♥" : "♡"}</button></div>
        <p className="detail-location">{flagEmoji[zoo.country]} {zoo.city}, {zoo.countryName}</p>
        <div className="chip-row"><span className="chip">📍 {zoo.distance >= 999 ? "Afstand nog bepalen" : `${zoo.distance} km ${locationActive ? "vanaf jou" : "indicatie"}`}</span>{zoo.visited && <span className="chip chip-visited">✓ Bezocht</span>}</div>
        <p className="detail-intro">{zoo.intro}</p>
        <div className="detail-main-actions">
          <button className="primary" onClick={onPlan}>Uitje plannen</button>
          <RouteMenu zoo={zoo} />
          {zoo.website && <a className="official-website-link" href={zoo.website} target="_blank" rel="noreferrer">Officiële website <span aria-hidden="true">↗</span></a>}
        </div>
      </div>
    </div>

    <div className="detail-body">
      <label className="detail-tab-select">Onderwerp<select value={tab} onChange={(event) => setTab(event.target.value as Tab)}>{tabs.map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="tab-row" role="tablist" aria-label="Informatie over deze dierenplek">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>

      <div className="tab-panel">
        {tab === "Overzicht" && <div className="detail-content-grid"><article className="detail-story-card"><span className="eyebrow">WAAROM HIERHEEN?</span><h2>Alles wat je vooraf wilt weten</h2><p>{zoo.about}</p>{enrichmentLoading ? <p className="detail-loading">Informatie wordt geladen…</p> : enrichment.summary && <><p>{enrichment.summary}</p>{enrichment.summarySource && <a className="detail-source-link" href={enrichment.summarySource} target="_blank" rel="noreferrer">Bron bekijken ↗</a>}</>}</article><aside className="potential-card"><span className="eyebrow">UITJE-SCORE</span><RatingRow label="Romantisch" icon="♥" value={zoo.potential.romantic} /><RatingRow label="Dieren" icon="🐾" value={zoo.potential.animals} /><RatingRow label="Eten" icon="🍴" value={zoo.potential.food} /><RatingRow label="Reis" icon="🚗" value={zoo.potential.travel} /></aside></div>}

        {tab === "Dieren" && <section className="animals-section"><div className="animals-heading"><span className="eyebrow">DIERENLIJST</span><h2>Welke dieren kun je ontmoeten?</h2><p>{zoo.animalsText}</p></div>{animalsLoading ? <div className="animal-photo-loading">Dierenfoto’s worden geladen…</div> : animalMedia.length > 0 && <div className="animal-photo-grid">{animalMedia.map((media) => <a key={media.title} href={media.sourceUrl} target="_blank" rel="noreferrer"><img src={media.thumbnailUrl} alt={media.title} loading="lazy" /><strong>{media.title}</strong></a>)}</div>}<div className="animal-name-list">{animalHighlights.map((animal) => <span key={animal}>{animal}</span>)}</div><p className="detail-freshness-note">Dit is de bekende dierenlijst in het dagboek. De samenstelling kan veranderen door verzorging, seizoen en verhuizingen.</p></section>}

        {tab === "Bezoekinfo" && <section className="visit-section">
          <div className="today-hours-card"><span className="eyebrow">VANDAAG</span><h2>{todayHours === "Niet opgegeven" ? "Geen actuele tijden beschikbaar" : `Geopend: ${todayHours}`}</h2><p>{zoo.address || `${zoo.name}, ${zoo.city}`}</p><RouteMenu zoo={zoo} /></div>
          <div className="week-hours-card"><h3>Openingstijden deze week</h3><ul>{schedule.map((day, index) => <li className={index === todayIndex ? "today" : ""} key={day.code}><span>{day.label}</span><strong>{day.hours}</strong></li>)}</ul>{!zoo.openingHours && zoo.website && <a href={zoo.website} target="_blank" rel="noreferrer">Officiële openingstijden ↗</a>}</div>
          <div className="visit-practical-card"><h3>Praktische informatie</h3><p>{zoo.infoText}</p><dl><div><dt>Afstand</dt><dd>{zoo.distance >= 999 ? "Nog niet berekend" : `${zoo.distance} km`}</dd></div><div><dt>Contact</dt><dd>{zoo.phone || "Via de officiële aanbieder"}</dd></div></dl></div>
          <LiveTicketPrices zoo={zoo} />
        </section>}

        {tab === "Foto’s" && <section className="media-section"><div className="media-heading"><h2>Fotoalbum van {zoo.name}</h2></div>{enrichmentLoading ? <div className="media-loading">Foto’s worden geladen…</div> : enrichment.media.length ? <div className="public-media-grid clean">{enrichment.media.map((media) => <a href={media.sourceUrl} target="_blank" rel="noreferrer" key={media.sourceUrl}><img src={media.thumbnailUrl} alt={media.title} loading="lazy" /></a>)}</div> : <div className="media-empty"><div><ZooPhoto animal={zoo.animal} alt={zoo.name} /></div><p>Nog geen passend fotoalbum beschikbaar.</p></div>}</section>}

        {tab === "Beoordelingen" && <div>{review ? <article className="review-note"><strong>Jullie opgeslagen beoordeling</strong>{review.note && <p>{review.note}</p>}<span className="review-score">{review.scores.overall.toFixed(1)} / 10</span></article> : <p className="muted-note">Nog geen beoordeling — hier komt jullie mening zodra jullie zijn geweest.</p>}<button className="review-detail-button" onClick={onReview}>{review ? "Beoordeling wijzigen" : "＋ Beoordeling toevoegen"}</button></div>}
      </div>
    </div>
  </section>;
}
