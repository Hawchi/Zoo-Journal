import { useEffect, useState } from "react";
import type { Zoo } from "../zoo-data";
import type { ZooVisit } from "../visits";
import { ZooPhoto } from "./ZooPhoto";

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function VisitDialog({ zoo, visit, onClose, onSave, onRemove }: {
  zoo: Zoo;
  visit?: ZooVisit;
  onClose: () => void;
  onSave: (visit: ZooVisit) => void;
  onRemove: () => void;
}) {
  const [date, setDate] = useState(visit?.date || today());
  const [startPoint, setStartPoint] = useState(visit?.startPoint || "Ons huis");
  const [kilometers, setKilometers] = useState(visit?.kilometers ? String(visit.kilometers) : "");
  const [confirmRemove, setConfirmRemove] = useState(false);

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
      kilometers: Math.max(0, Number(kilometers) || 0),
      updatedAt: new Date().toISOString(),
    });
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
        <label>Vertrokken vanaf<input required value={startPoint} onChange={(event) => setStartPoint(event.target.value)} placeholder="Bijvoorbeeld: ons huis in Tilburg" /></label>
        <label>Gereden kilometers in totaal<input required type="number" min="0" step="1" inputMode="numeric" value={kilometers} onChange={(event) => setKilometers(event.target.value)} placeholder="Bijvoorbeeld: 168" /><small>Vul de heen- en terugreis samen in. Zo blijft de teller eerlijk.</small></label>
      </div>
      <footer className="visit-modal-actions">
        {visit && (confirmRemove ? <span className="visit-remove-confirm"><b>Bezoek verwijderen?</b><button type="button" onClick={() => setConfirmRemove(false)}>Nee</button><button type="button" className="danger" onClick={onRemove}>Ja</button></span> : <button type="button" className="visit-remove" onClick={() => setConfirmRemove(true)}>Niet meer als bezocht markeren</button>)}
        <button className="primary" type="submit">Bezoek opslaan</button>
      </footer>
    </form>
  </div>;
}
