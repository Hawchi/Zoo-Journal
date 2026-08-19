import { useEffect, useState } from "react";
import { loadAnimalMedia, loadOfficialAnimalIndex, loadPlaceEnrichment, type OfficialAnimalIndex, type PlaceEnrichment, type PlaceMedia } from "../place-enrichment";
import { googleMapsDirectionsUrl, wazeDirectionsUrl } from "../route-links";
import type { Rating1to5, Zoo } from "../zoo-data";
import { averageReviewScores, reviewForUser, type UserReview } from "../reviews";
import type { CoupleProfile } from "../plans";
import { LiveTicketPrices } from "./LiveTicketPrices";
import { ZooHeroPrice } from "./ZooHeroPrice";
import { ZooPhoto } from "./ZooPhoto";

const flagEmoji: Record<string, string> = { NL: "🇳🇱", BE: "🇧🇪", DE: "🇩🇪" };
const tabs = ["Overzicht", "Dieren", "Bezoekinfo", "Foto’s", "Beoordelingen"] as const;
type Tab = (typeof tabs)[number];
type HoursResult = { hours: string; status: "idle" | "loading" | "official" | "map" | "unavailable"; sourceName?: string; sourceUrl?: string; googleUrl?: string; message?: string };

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

export function ZooDetail({ zoo, wished, onWish, onBack, onPlan, reviews, currentProfile, profiles, onReview, locationActive }: {
  zoo: Zoo;
  wished: boolean;
  onWish: () => void;
  onBack: () => void;
  onPlan: () => void;
  reviews: UserReview[];
  currentProfile: CoupleProfile;
  profiles: CoupleProfile[];
  onReview: () => void;
  locationActive: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Overzicht");
  const [enrichment, setEnrichment] = useState<PlaceEnrichment>({ media: [] });
  const [enrichmentLoading, setEnrichmentLoading] = useState(true);
  const [animalMedia, setAnimalMedia] = useState<PlaceMedia[]>([]);
  const [animalIndex, setAnimalIndex] = useState<OfficialAnimalIndex | null>(null);
  const [animalsLoading, setAnimalsLoading] = useState(false);
  const [animalSearch, setAnimalSearch] = useState("");
  const [showAllAnimals, setShowAllAnimals] = useState(false);
  const [hoursResult, setHoursResult] = useState<HoursResult>({ hours: "", status: "idle" });

  useEffect(() => {
    let active = true;
    setEnrichmentLoading(true);
    loadPlaceEnrichment(zoo).then((result) => { if (active) setEnrichment(result); }).finally(() => { if (active) setEnrichmentLoading(false); });
    return () => { active = false; };
  }, [zoo.id]);

  useEffect(() => {
    if (tab !== "Dieren") return;
    let active = true;
    setAnimalsLoading(true);
    setAnimalIndex(null);
    setAnimalMedia([]);
    setAnimalSearch("");
    setShowAllAnimals(false);
    loadOfficialAnimalIndex(zoo)
      .then(async (result) => {
        if (!active) return;
        setAnimalIndex(result);
        const names = result.names.length ? result.names : zoo.animalNames ?? [];
        const media = await loadAnimalMedia(names, zoo.country);
        if (active) setAnimalMedia(media);
      })
      .catch(async () => {
        if (!active) return;
        const names = zoo.animalNames ?? [];
        setAnimalIndex({
          status: names.length ? "curated" : "unavailable", zooId: zoo.id, checkedAt: new Date().toISOString(),
          sourceName: names.length ? "Dierenhighlights in het dagboek" : "Geen dierenlijst beschikbaar", sourceUrl: zoo.website,
          names, complete: false,
          note: names.length ? "De officiële bron reageert nu niet. Dit zijn tijdelijk alleen de bekende highlights." : "Er kon geen betrouwbare dierenlijst worden gevonden. Daarom toont het dagboek geen gegokte dieren.",
        });
        const media = await loadAnimalMedia(names, zoo.country);
        if (active) setAnimalMedia(media);
      })
      .finally(() => { if (active) setAnimalsLoading(false); });
    return () => { active = false; };
  }, [tab, zoo.id, zoo.website, zoo.country]);

  useEffect(() => {
    if (tab !== "Bezoekinfo" || zoo.openingHours) return;
    let active = true;
    const query = new URLSearchParams({ name: zoo.name, city: zoo.city, country: zoo.country, website: zoo.website || "" });
    fetch(`/api/hours?${query}`, { cache: "no-store" })
      .then(async (response) => await response.json() as Omit<HoursResult, "status"> & { status: HoursResult["status"] })
      .then((result) => { if (active) setHoursResult(result); })
      .catch(() => { if (active) setHoursResult({ hours: "", status: "unavailable", message: "De openingstijden konden nu niet worden gecontroleerd." }); });
    return () => { active = false; };
  }, [tab, zoo.id, zoo.name, zoo.city, zoo.country, zoo.website, zoo.openingHours]);

  const animalNames = animalIndex?.names ?? zoo.animalNames ?? [];
  const filteredAnimalNames = animalSearch.trim()
    ? animalNames.filter((animal) => animal.toLocaleLowerCase("nl").includes(animalSearch.trim().toLocaleLowerCase("nl")))
    : animalNames;
  const visibleAnimalNames = showAllAnimals || animalSearch.trim() ? filteredAnimalNames : filteredAnimalNames.slice(0, 24);
  const effectiveOpeningHours = zoo.openingHours || hoursResult.hours;
  const checkingHours = tab === "Bezoekinfo" && !zoo.openingHours && hoursResult.status === "idle";
  const schedule = weeklySchedule(effectiveOpeningHours);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayHours = schedule[todayIndex]?.hours;
  const categoryLabel = zoo.category === "aquarium" ? "AQUARIUM" : zoo.category === "petting-zoo" ? "KINDERBOERDERIJ" : zoo.category === "animal-park" ? "DIERENPARK" : "DIERENTUIN";
  const currentReview = reviewForUser(reviews, currentProfile.id);
  const combinedScores = averageReviewScores(reviews);

  return <section className="zoo-detail">
    <div className="detail-back-row"><button className="back-link" onClick={onBack}><span aria-hidden="true">←</span> Terug naar alle dierenplekken</button><span>Ontdekken / {zoo.name}</span></div>

    <div className="detail-top">
      <div className="detail-photo"><ZooPhoto animal={zoo.animal} alt={zoo.name} /></div>
      <div className="detail-copy">
        <div className="detail-heading"><div><span className="eyebrow">{categoryLabel}</span><h1>{zoo.name}</h1></div><button className={`heart ${wished ? "active" : ""}`} onClick={onWish} aria-label={wished ? "Verwijder van wishlist" : "Zet op wishlist"}>{wished ? "♥" : "♡"}</button></div>
        <p className="detail-location">{flagEmoji[zoo.country]} {zoo.city}, {zoo.countryName}</p>
        <div className="chip-row"><span className="chip">📍 {zoo.distance >= 999 ? "Afstand nog bepalen" : `${zoo.distance} km ${locationActive ? "vanaf jou" : "indicatie"}`}</span>{zoo.visited && <span className="chip chip-visited">✓ Bezocht</span>}</div>
        <ZooHeroPrice zoo={zoo} />
        <p className="detail-intro">{zoo.intro}</p>
        <div className="detail-main-actions">
          <button className="primary" onClick={onPlan}>Uitje plannen</button>
          <RouteMenu zoo={zoo} />
          {zoo.website && <a className="official-website-link" href={zoo.website} target="_blank" rel="noreferrer">Officiële website</a>}
        </div>
      </div>
    </div>

    <div className="detail-body">
      <label className="detail-tab-select">Onderwerp<select value={tab} onChange={(event) => setTab(event.target.value as Tab)}>{tabs.map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="tab-row" role="tablist" aria-label="Informatie over deze dierenplek">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>

      <div className="tab-panel">
        {tab === "Overzicht" && <div className="detail-content-grid"><article className="detail-story-card"><span className="eyebrow">WAAROM HIERHEEN?</span><h2>Alles wat je vooraf wilt weten</h2><p>{zoo.about}</p>{enrichmentLoading ? <p className="detail-loading">Informatie wordt geladen…</p> : enrichment.summary && <><p>{enrichment.summary}</p>{enrichment.summarySource && <a className="detail-source-link" href={enrichment.summarySource} target="_blank" rel="noreferrer">Bron bekijken</a>}</>}</article><aside className="potential-card"><span className="eyebrow">UITJE-SCORE</span><RatingRow label="Romantisch" icon="♥" value={zoo.potential.romantic} /><RatingRow label="Dieren" icon="🐾" value={zoo.potential.animals} /><RatingRow label="Eten" icon="🍴" value={zoo.potential.food} /><RatingRow label="Reis" icon="🚗" value={zoo.potential.travel} /></aside></div>}

        {tab === "Dieren" && <section className="animals-section">
          <div className="animals-heading"><span className="eyebrow">DIERENOVERZICHT</span><h2>Welke dieren kun je hier ontmoeten?</h2><p>De dierenlijst komt waar mogelijk rechtstreeks van de officiële dierenplek. De foto’s zijn afzonderlijke soortfoto’s, zodat het dier op ieder kaartje echt klopt.</p></div>
          {animalIndex && <div className={`animal-source-card ${animalIndex.status}`}><span><i aria-hidden="true" />{animalIndex.status === "official" ? "GECONTROLEERD VIA OFFICIËLE WEBSITE" : animalIndex.status === "curated" ? "TIJDELIJKE HIGHLIGHTS" : "GEEN BETROUWBARE LIJST"}</span>{animalIndex.sourceUrl ? <a href={animalIndex.sourceUrl} target="_blank" rel="noreferrer">{animalIndex.sourceName}</a> : <strong>{animalIndex.sourceName}</strong>}</div>}
          {animalsLoading ? <div className="animal-photo-loading">Officiële dierenlijst en soortfoto’s worden geladen…</div> : animalMedia.length > 0 && <><h3 className="animal-section-title">Een paar bewoners uitgelicht</h3><div className="animal-photo-grid">{animalMedia.map((media) => <a key={media.title} href={media.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${media.title}: open de bron van deze soortfoto`}><div className="animal-photo-frame"><img src={media.thumbnailUrl} alt={`Soortfoto van ${media.title}`} loading="lazy" /><span>SOORTFOTO</span></div><div className="animal-photo-caption"><strong>{media.title}</strong><small>{media.credit}</small></div></a>)}</div></>}
          {!animalsLoading && animalNames.length > 0 && <div className="animal-list-panel"><div className="animal-list-head"><div><span className="eyebrow">BEKENDE DIEREN</span><h3>{animalNames.length} {animalNames.length === 1 ? "dier" : "dieren"} gevonden</h3></div>{animalNames.length > 12 && <label className="animal-search"><span className="sr-only">Zoek in de dierenlijst</span><input type="search" value={animalSearch} onChange={(event) => setAnimalSearch(event.target.value)} placeholder="Zoek een dier…" /></label>}</div><div className="animal-name-list">{visibleAnimalNames.map((animal) => <span key={animal}>{animal}</span>)}</div>{!animalSearch && filteredAnimalNames.length > 24 && <button className="animal-show-all" onClick={() => setShowAllAnimals((current) => !current)}>{showAllAnimals ? "Toon minder" : `Toon alle ${filteredAnimalNames.length} dieren`}</button>}{animalSearch && filteredAnimalNames.length === 0 && <p className="animal-no-results">Geen dier gevonden met “{animalSearch}”.</p>}</div>}
          {!animalsLoading && animalNames.length === 0 && <div className="animal-empty-state"><span aria-hidden="true">🐾</span><div><h3>Hier is nog geen betrouwbare dierenlijst</h3><p>De officiële website publiceert geen lijst die de app veilig kan uitlezen. We laten dit bewust leeg, zodat je geen verkeerde dieren te zien krijgt.</p>{zoo.website && <a href={zoo.website} target="_blank" rel="noreferrer">Bekijk de officiële website</a>}</div></div>}
          {animalIndex && <p className="detail-freshness-note">{animalIndex.note} Dieren kunnen door seizoen, verzorging of verhuizing tijdelijk niet zichtbaar zijn.</p>}
        </section>}

        {tab === "Bezoekinfo" && <section className="visit-section">
          <div className="today-hours-card"><span className="eyebrow">VANDAAG</span><h2>{checkingHours ? "Openingstijden controleren…" : todayHours === "Niet opgegeven" ? "Controleer de tijden bij de locatie" : `Geopend: ${todayHours}`}</h2><p>{zoo.address || `${zoo.name}, ${zoo.city}`}</p><RouteMenu zoo={zoo} /></div>
          <div className="week-hours-card"><h3>Openingstijden deze week</h3><ul>{schedule.map((day, index) => <li className={index === todayIndex ? "today" : ""} key={day.code}><span>{day.label}</span><strong>{day.hours}</strong></li>)}</ul>{hoursResult.sourceUrl && <a href={hoursResult.sourceUrl} target="_blank" rel="noreferrer">Bron: {hoursResult.sourceName}</a>}{!effectiveOpeningHours && hoursResult.googleUrl && <a href={hoursResult.googleUrl} target="_blank" rel="noreferrer">Controleer openingstijden via Google</a>}{!effectiveOpeningHours && !hoursResult.googleUrl && zoo.website && <a href={zoo.website} target="_blank" rel="noreferrer">Officiële openingstijden</a>}</div>
          <div className="visit-practical-card"><h3>Praktische informatie</h3><p>{zoo.infoText}</p><dl><div><dt>Afstand</dt><dd>{zoo.distance >= 999 ? "Nog niet berekend" : `${zoo.distance} km`}</dd></div><div><dt>Contact</dt><dd>{zoo.phone || "Via de officiële aanbieder"}</dd></div></dl></div>
          <LiveTicketPrices zoo={zoo} />
        </section>}

        {tab === "Foto’s" && <section className="media-section"><div className="media-heading"><h2>Fotoalbum van {zoo.name}</h2></div>{enrichmentLoading ? <div className="media-loading">Foto’s worden geladen…</div> : enrichment.media.length ? <div className="public-media-grid clean">{enrichment.media.map((media) => <a href={media.sourceUrl} target="_blank" rel="noreferrer" key={media.sourceUrl}><img src={media.thumbnailUrl} alt={media.title} loading="lazy" /></a>)}</div> : <div className="media-empty"><div><ZooPhoto animal={zoo.animal} alt={zoo.name} /></div><p>Nog geen passend fotoalbum beschikbaar.</p></div>}</section>}

        {tab === "Beoordelingen" && <section className="detail-reviews">
          <header className="detail-reviews-heading"><div><span className="eyebrow">JULLIE MENINGEN</span><h2>Twee reviews, één gemiddelde</h2></div>{combinedScores && <strong><span>{combinedScores.overall.toFixed(1)}</span><small> samen</small></strong>}</header>
          <div className="review-duo-grid">{profiles.map((profile) => {
            const personalReview = reviewForUser(reviews, profile.id);
            return <article className={`review-person-card ${personalReview ? "filled" : "empty"}`} key={profile.id}>
              <span className="review-person-avatar">{profile.displayName.slice(0, 1).toLocaleUpperCase("nl")}</span>
              <div><small>BEOORDELING VAN</small><h3>{profile.displayName}</h3>{personalReview?.visitDate && <time>{new Date(`${personalReview.visitDate}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</time>}</div>
              {personalReview ? <><strong className="review-score">{personalReview.scores.overall.toFixed(1)} / 10</strong><p>{personalReview.note || "Geen notitie toegevoegd."}</p></> : <p>Nog geen eigen beoordeling toegevoegd.</p>}
            </article>;
          })}</div>
          <button className="review-detail-button" onClick={onReview}>{currentReview ? "Mijn beoordeling wijzigen" : "＋ Mijn beoordeling toevoegen"}</button>
        </section>}
      </div>
    </div>
  </section>;
}
