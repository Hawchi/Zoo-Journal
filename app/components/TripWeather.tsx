import { useEffect, useState } from "react";
import { knownCoordinates } from "../place-service";
import type { Zoo } from "../zoo-data";

type WeatherPayload = {
  status: "loading" | "forecast" | "too-early" | "past" | "unavailable";
  label?: string;
  kind?: string;
  minimum?: number;
  maximum?: number;
  rainChance?: number;
  availableFrom?: string;
  message?: string;
};

function shortDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

export function TripWeather({ zoo, date, compact = false }: { zoo: Zoo; date: string; compact?: boolean }) {
  const [weather, setWeather] = useState<WeatherPayload>({ status: "loading" });
  const latitude = zoo.latitude ?? knownCoordinates[zoo.id]?.[0];
  const longitude = zoo.longitude ?? knownCoordinates[zoo.id]?.[1];
  const canLoad = Boolean(latitude && longitude && date);

  useEffect(() => {
    if (!canLoad) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setWeather({ status: "loading" });
      fetch(`/api/weather?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&date=${encodeURIComponent(date)}`, { cache: "no-store" })
        .then(async (response) => await response.json() as WeatherPayload)
        .then((payload) => { if (active) setWeather(payload); })
        .catch(() => { if (active) setWeather({ status: "unavailable", message: "Het actuele weer kon nu niet worden opgehaald." }); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [latitude, longitude, date, canLoad]);

  const visibleWeather = canLoad ? weather : { status: "unavailable", message: "Kies een locatie en datum voor het weer." } satisfies WeatherPayload;

  return <aside className={`trip-weather ${compact ? "compact" : ""}`} aria-live="polite">
    <span className={`weather-mark ${visibleWeather.kind || "cloud"}`} aria-hidden="true"><i /></span>
    <div><small>WEER BIJ {zoo.name.toLocaleUpperCase("nl")}</small>
      {visibleWeather.status === "loading" && <><strong>Voorspelling ophalen…</strong><p>Even de locatie en datum controleren.</p></>}
      {visibleWeather.status === "forecast" && <><strong>{Math.round(visibleWeather.maximum || 0)}° / {Math.round(visibleWeather.minimum || 0)}° · {visibleWeather.label}</strong><p>{visibleWeather.rainChance ?? 0}% kans op neerslag. Ververs bij het openen automatisch.</p></>}
      {visibleWeather.status === "too-early" && <><strong>Nog te vroeg voor een voorspelling</strong><p>Het live weer verschijnt vanaf {shortDate(visibleWeather.availableFrom)}.</p></>}
      {(visibleWeather.status === "past" || visibleWeather.status === "unavailable") && <><strong>Geen voorspelling beschikbaar</strong><p>{visibleWeather.message}</p></>}
    </div>
  </aside>;
}
