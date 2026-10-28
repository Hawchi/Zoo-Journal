import { useEffect, useState } from "react";
import { knownCoordinates } from "../place-service";
import type { Zoo } from "../zoo-data";
import { useLanguage } from "../i18n";

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

function shortDate(value: string | undefined, language: "nl" | "en") {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "nl-NL", { day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

export function TripWeather({ zoo, date, compact = false }: { zoo: Zoo; date: string; compact?: boolean }) {
  const { language, t, ui } = useLanguage();
  const [weather, setWeather] = useState<WeatherPayload>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
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
  }, [latitude, longitude, date, canLoad, refreshKey]);

  const visibleWeather = canLoad ? weather : { status: "unavailable", message: !date ? "Kies eerst een datum voor jullie uitje." : "Voor deze dierenplek ontbreken nog kaartcoördinaten." } satisfies WeatherPayload;

  return <aside className={`trip-weather ${compact ? "compact" : ""}`} aria-live="polite">
    <span className={`weather-mark ${visibleWeather.kind || "cloud"}`} aria-hidden="true"><i /></span>
    <div><small>{t("WEER BIJ", "WEATHER AT")} {zoo.name.toLocaleUpperCase(language)}</small>
      {visibleWeather.status === "loading" && <><strong>Voorspelling ophalen…</strong><p>Even de locatie en datum controleren.</p></>}
      {visibleWeather.status === "forecast" && <><strong>{Math.round(visibleWeather.maximum || 0)}° / {Math.round(visibleWeather.minimum || 0)}° · {ui(visibleWeather.label || "")}</strong><p>{t(`${visibleWeather.rainChance ?? 0}% kans op neerslag. Ververs bij het openen automatisch.`, `${visibleWeather.rainChance ?? 0}% chance of rain. Refreshes automatically when opened.`)}</p></>}
      {visibleWeather.status === "too-early" && <><strong>Nog te vroeg voor een voorspelling</strong><p>{t("Het live weer verschijnt vanaf", "The live forecast will appear from")} {shortDate(visibleWeather.availableFrom, language)}.</p></>}
      {visibleWeather.status === "past" && <><strong>Dit bezoek is al geweest</strong><p>{ui(visibleWeather.message || "")}</p></>}
      {visibleWeather.status === "unavailable" && <><strong>Het weer is tijdelijk niet bereikbaar</strong><p>{ui(visibleWeather.message || "")}</p>{canLoad && <button type="button" className="weather-retry" onClick={() => setRefreshKey((value) => value + 1)}>Opnieuw proberen</button>}</>}
    </div>
  </aside>;
}
