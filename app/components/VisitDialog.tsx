import { useEffect, useState } from "react";
import { knownCoordinates } from "../place-service";
import type { Zoo } from "../zoo-data";
import type { ZooVisit } from "../visits";
import { ZooPhoto } from "./ZooPhoto";
import { useLanguage } from "../i18n";

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type RouteDistance = {
  oneWayKm: number;
  roundTripKm: number;
  durationMinutes: number;
  startLabel: string;
};

export function VisitDialog({ zoo, visit, onClose, onSave, onRemove }: {
  zoo: Zoo;
  visit?: ZooVisit;
  onClose: () => void;
  onSave: (visit: ZooVisit) => void;
  onRemove: () => void;
}) {
  const { language, t } = useLanguage();
  const [date, setDate] = useState(visit?.date || today());
  const [startPoint, setStartPoint] = useState(visit?.startPoint || "Ons huis");
  const [originCity, setOriginCity] = useState("");
  const [kilometers, setKilometers] = useState(visit?.kilometers ? String(visit.kilometers) : "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [routeDistance, setRouteDistance] = useState<RouteDistance | null>(null);
  const [routeError, setRouteError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [onClose]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({
      zooId: zoo.id,
      date,
      startPoint: startPoint.trim(),
      kilometers: Math.max(0, Number(kilometers.replace(",", ".")) || 0),
      updatedAt: new Date().toISOString(),
    });
  };

  const destination = {
    latitude: zoo.latitude ?? knownCoordinates[zoo.id]?.[0],
    longitude: zoo.longitude ?? knownCoordinates[zoo.id]?.[1],
  };

  const requestDistance = async (start: { startCity: string } | { start: { latitude: number; longitude: number } }) => {
    if (!Number.isFinite(destination.latitude) || !Number.isFinite(destination.longitude)) {
      setRouteError("De locatie van deze dierenplek is nog niet bekend.");
      return;
    }
    setRouteLoading(true);
    setRouteError("");
    setRouteDistance(null);
    try {
      const response = await fetch("/api/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...start, destination }),
      });
      const payload = await response.json() as RouteDistance & { error?: string };
      if (!response.ok) throw new Error(payload.error || "De route kon niet worden berekend.");
      setRouteDistance(payload);
      setKilometers(String(payload.roundTripKm));
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "De route kon niet worden berekend.");
    } finally {
      setRouteLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setRouteError("Je telefoon ondersteunt geen locatiebepaling.");
      return;
    }
    setRouteLoading(true);
    setRouteError("");
    navigator.geolocation.getCurrentPosition(
      (position) => { void requestDistance({ start: { latitude: position.coords.latitude, longitude: position.coords.longitude } }); },
      () => { setRouteLoading(false); setRouteError("Je locatie is niet gedeeld. Vul anders een vertrekplaats in."); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  };

  return <div className="visit-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="visit-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="visit-dialog-title">
      <button type="button" className="visit-modal-close" onClick={onClose} aria-label={t("Sluiten", "Close")}>×</button>
      <header className="visit-modal-heading">
        <span className="visit-modal-animal"><ZooPhoto animal={zoo.animal} alt="" /></span>
        <div><span className="eyebrow">{t("BEZOEK REGISTREREN", "RECORD A VISIT")}</span><h2 id="visit-dialog-title">{t("Wanneer waren jullie bij", "When did you visit")} {zoo.name}?</h2><p>{t("Deze gegevens vullen jullie reiskaart en kilometerteller.", "These details update your journey map and kilometre counter.")}</p></div>
      </header>
      <div className="visit-fields">
        <label>{t("Datum van het bezoek", "Date of visit")}<input required type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} /></label>
        <label>{t("Waar vertrokken jullie?", "Where did you leave from?")}<input required value={startPoint} onChange={(event) => setStartPoint(event.target.value)} placeholder={t("Bijvoorbeeld: ons huis", "For example: our home")} /><small>{t("Dit herkenbare label bewaren we bij jullie bezoek.", "We save this recognisable label with your visit.")}</small></label>
        <section className="visit-route-calculator" aria-labelledby="route-calculator-title">
          <div><span className="eyebrow">{t("AUTOMATISCH BEREKENEN", "CALCULATE AUTOMATICALLY")}</span><h3 id="route-calculator-title">{t("Hoe ver was de autorit?", "How far was the drive?")}</h3></div>
          <label>{t("Plaats voor de afstandsberekening", "Starting city for the distance calculation")}<input value={originCity} onChange={(event) => { setOriginCity(event.target.value); setRouteDistance(null); setRouteError(""); }} placeholder={t("Bijvoorbeeld: Tilburg", "For example: Tilburg")} /><small>{t("Gebruik alleen een plaatsnaam, geen volledig huisadres.", "Use a city name only, not a full home address.")}</small></label>
          <div className="visit-route-actions"><button type="button" className="route-calculate" disabled={routeLoading || !originCity.trim()} onClick={() => void requestDistance({ startCity: originCity.trim() })}>{routeLoading ? t("Route berekenen...", "Calculating route...") : t("Bereken vanaf plaats", "Calculate from city")}</button><button type="button" className="route-current" disabled={routeLoading} onClick={useCurrentLocation}>{t("Gebruik huidige locatie", "Use current location")}</button></div>
          {routeDistance && <div className="visit-route-result" role="status"><span><small>{t("ENKELE REIS", "ONE WAY")}</small><strong>{routeDistance.oneWayKm.toLocaleString(language === "en" ? "en-GB" : "nl-NL")} km</strong></span><span><small>{t("HEEN EN TERUG", "ROUND TRIP")}</small><strong>{routeDistance.roundTripKm.toLocaleString(language === "en" ? "en-GB" : "nl-NL")} km</strong></span><span><small>{t("RIJTIJD ENKEL", "ONE-WAY DRIVE")}</small><strong>{routeDistance.durationMinutes} min</strong></span><p>{t("De retourafstand is hieronder automatisch ingevuld. Start gevonden als", "The round-trip distance has been filled in below. Starting point found as")} {routeDistance.startLabel}.</p></div>}
          {routeError && <p className="visit-route-error" role="alert">{routeError}</p>}
          <p className="visit-route-privacy">Plaatszoeken gebeurt alleen na jouw tik via <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">OpenStreetMap Nominatim</a>. De autoroute wordt berekend door <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">OSRM</a>. Coördinaten worden niet in jullie dagboek opgeslagen.</p>
        </section>
        <label>{t("Gereden kilometers in totaal", "Total kilometres driven")}<input required type="number" min="0" step="0.1" inputMode="decimal" value={kilometers} onChange={(event) => setKilometers(event.target.value)} placeholder={t("Bijvoorbeeld: 168,5", "For example: 168.5")} /><small>{t("Decimalen zijn toegestaan. Vul de heen- en terugreis samen in.", "Decimals are allowed. Enter the full round trip.")}</small></label>
      </div>
      <footer className="visit-modal-actions">
        {visit && (confirmRemove ? <span className="visit-remove-confirm"><b>{t("Bezoek verwijderen?", "Remove visit?")}</b><button type="button" onClick={() => setConfirmRemove(false)}>{t("Nee", "No")}</button><button type="button" className="danger" onClick={onRemove}>{t("Ja", "Yes")}</button></span> : <button type="button" className="visit-remove" onClick={() => setConfirmRemove(true)}>{t("Niet meer als bezocht markeren", "Remove visited status")}</button>)}
        <button className="primary" type="submit">{t("Bezoek opslaan", "Save visit")}</button>
      </footer>
    </form>
  </div>;
}
