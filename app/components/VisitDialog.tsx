import { useEffect, useState } from "react";
import { knownCoordinates } from "../place-service";
import type { Zoo } from "../zoo-data";
import type { ZooVisit } from "../visits";
import { ZooPhoto } from "./ZooPhoto";

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
      <button type="button" className="visit-modal-close" onClick={onClose} aria-label="Sluiten">×</button>
      <header className="visit-modal-heading">
        <span className="visit-modal-animal"><ZooPhoto animal={zoo.animal} alt="" /></span>
        <div><span className="eyebrow">BEZOEK REGISTREREN</span><h2 id="visit-dialog-title">Wanneer waren jullie bij {zoo.name}?</h2><p>Deze gegevens vullen jullie reiskaart en kilometerteller.</p></div>
      </header>
      <div className="visit-fields">
        <label>Datum van het bezoek<input required type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Waar vertrokken jullie?<input required value={startPoint} onChange={(event) => setStartPoint(event.target.value)} placeholder="Bijvoorbeeld: ons huis" /><small>Dit herkenbare label bewaren we bij jullie bezoek.</small></label>
        <section className="visit-route-calculator" aria-labelledby="route-calculator-title">
          <div><span className="eyebrow">AUTOMATISCH BEREKENEN</span><h3 id="route-calculator-title">Hoe ver was de autorit?</h3></div>
          <label>Plaats voor de afstandsberekening<input value={originCity} onChange={(event) => { setOriginCity(event.target.value); setRouteDistance(null); setRouteError(""); }} placeholder="Bijvoorbeeld: Tilburg" /><small>Gebruik alleen een plaatsnaam, geen volledig huisadres.</small></label>
          <div className="visit-route-actions"><button type="button" className="route-calculate" disabled={routeLoading || !originCity.trim()} onClick={() => void requestDistance({ startCity: originCity.trim() })}>{routeLoading ? "Route berekenen..." : "Bereken vanaf plaats"}</button><button type="button" className="route-current" disabled={routeLoading} onClick={useCurrentLocation}>Gebruik huidige locatie</button></div>
          {routeDistance && <div className="visit-route-result" role="status"><span><small>ENKELE REIS</small><strong>{routeDistance.oneWayKm.toLocaleString("nl-NL")} km</strong></span><span><small>HEEN EN TERUG</small><strong>{routeDistance.roundTripKm.toLocaleString("nl-NL")} km</strong></span><span><small>RIJTIJD ENKEL</small><strong>{routeDistance.durationMinutes} min</strong></span><p>De retourafstand is hieronder automatisch ingevuld. Start gevonden als {routeDistance.startLabel}.</p></div>}
          {routeError && <p className="visit-route-error" role="alert">{routeError}</p>}
          <p className="visit-route-privacy">Plaatszoeken gebeurt alleen na jouw tik via <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">OpenStreetMap Nominatim</a>. De autoroute wordt berekend door <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">OSRM</a>. Coördinaten worden niet in jullie dagboek opgeslagen.</p>
        </section>
        <label>Gereden kilometers in totaal<input required type="number" min="0" step="0.1" inputMode="decimal" value={kilometers} onChange={(event) => setKilometers(event.target.value)} placeholder="Bijvoorbeeld: 168,5" /><small>Decimalen zijn toegestaan. Vul de heen- en terugreis samen in.</small></label>
      </div>
      <footer className="visit-modal-actions">
        {visit && (confirmRemove ? <span className="visit-remove-confirm"><b>Bezoek verwijderen?</b><button type="button" onClick={() => setConfirmRemove(false)}>Nee</button><button type="button" className="danger" onClick={onRemove}>Ja</button></span> : <button type="button" className="visit-remove" onClick={() => setConfirmRemove(true)}>Niet meer als bezocht markeren</button>)}
        <button className="primary" type="submit">Bezoek opslaan</button>
      </footer>
    </form>
  </div>;
}
