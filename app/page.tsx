"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { bucketList, zoos, type Zoo } from "./zoo-data";
import { ZooCard } from "./components/ZooCard";
import { ZooDetail } from "./components/ZooDetail";
import { ZooPhoto } from "./components/ZooPhoto";
import { REVIEW_STORAGE_KEY, type ReviewMap, type ReviewScores, type UserReview } from "./reviews";
import { MEMORY_STORAGE_KEY, type UserMemory } from "./memories";
import { ACTIVE_PROFILE_STORAGE_KEY, COUPLE_PROFILE_STORAGE_KEY, PLANS_STORAGE_KEY, defaultCoupleProfiles, defaultPackingList, type CoupleProfile, type PlannedTrip } from "./plans";
import { CoupleAccess, CoupleBar, CoupleSettings, type AccountMode } from "./components/CoupleAccount";
import { CUSTOM_PLACES_KEY, DISCOVERED_PLACES_KEY, VISITED_KEY, WISHLIST_KEY, createCustomPlace, findPlaceCoordinates, knownCoordinates, loadAllAnimalPlaces, repairAnimalPlaceCategory } from "./place-service";
import { distanceFromUser, googleMapsDirectionsUrl, wazeDirectionsUrl, type UserCoordinates } from "./route-links";

type View = "home" | "explore" | "detail" | "planner" | "journey" | "rankings" | "memories" | "wishlist" | "settings";
const flagEmoji: Record<string, string> = { NL: "🇳🇱", BE: "🇧🇪", DE: "🇩🇪" };
const DATABASE_MIGRATION_KEY = "our-zoo-journal-database-migration-v1";

type JournalPayload = {
  wishes: string[];
  visitedIds: string[];
  reviews: ReviewMap;
  memories: UserMemory[];
  customPlaces: Zoo[];
};

export default function App() {
  const [view, setView] = useState<View>("home");
  const [wishes, setWishes] = useState<string[]>([]);
  const [country, setCountry] = useState("ALL");
  const [sort, setSort] = useState("distance");
  const [placeType, setPlaceType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [visiblePlaceCount, setVisiblePlaceCount] = useState(18);
  const [selected, setSelected] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewMap>({});
  const [userMemories, setUserMemories] = useState<UserMemory[]>([]);
  const [plannedTrips, setPlannedTrips] = useState<PlannedTrip[]>([]);
  const [plannerIntent, setPlannerIntent] = useState(0);
  const [customPlaces, setCustomPlaces] = useState<Zoo[]>([]);
  const [loadedPlaces, setLoadedPlaces] = useState<Zoo[]>([]);
  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesMessage, setPlacesMessage] = useState("");
  const [userLocation, setUserLocation] = useState<UserCoordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [accountMode, setAccountMode] = useState<AccountMode>("loading");
  const [profiles, setProfiles] = useState<CoupleProfile[]>(defaultCoupleProfiles);
  const [activeProfileId, setActiveProfileId] = useState(defaultCoupleProfiles[0].id);
  const [inviteCode, setInviteCode] = useState("");
  const [accountError, setAccountError] = useState("");

  const applyAccountState = (payload: { state?: AccountMode; profile?: { userId: string }; profiles?: Array<{ userId: string; email?: string; displayName: string; role: "owner" | "partner" }>; inviteCode?: string }) => {
    if (payload.state) setAccountMode(payload.state);
    if (payload.profiles?.length) setProfiles(payload.profiles.map((profile) => ({ id: profile.userId, email: profile.email, displayName: profile.displayName, role: profile.role })));
    if (payload.profile?.userId) setActiveProfileId(payload.profile.userId);
    setInviteCode(payload.inviteCode || "");
  };

  const loadCoupleAccount = async () => {
    setAccountError("");
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      const savedProfiles = window.localStorage.getItem(COUPLE_PROFILE_STORAGE_KEY);
      const storedProfiles = savedProfiles ? JSON.parse(savedProfiles) as CoupleProfile[] : defaultCoupleProfiles;
      const nextProfiles = storedProfiles.map((profile) => profile.id === "partner" && profile.displayName === "Mijn vriend" ? { ...profile, displayName: "Yida" } : profile);
      if (nextProfiles.some((profile, index) => profile.displayName !== storedProfiles[index]?.displayName)) window.localStorage.setItem(COUPLE_PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
      setProfiles(nextProfiles);
      setActiveProfileId(window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || nextProfiles[0].id);
      setAccountMode("demo");
      return;
    }
    try {
      const response = await fetch("/api/couple", { cache: "no-store" });
      const payload = await response.json() as Parameters<typeof applyAccountState>[0] & { error?: string };
      if (response.status === 401) return setAccountMode("signed-out");
      if (!response.ok) throw new Error(payload.error || "De accounts konden niet worden geladen.");
      applyAccountState(payload);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "De accounts konden niet worden geladen.");
      setAccountMode("error");
    }
  };

  const loadSharedPlans = async () => {
    try {
      const response = await fetch("/api/plans", { cache: "no-store" });
      if (!response.ok) throw new Error("Planningen konden niet worden geladen.");
      const payload = await response.json() as { trips: PlannedTrip[] };
      setPlannedTrips(payload.trips);
    } catch {
      setAccountError("De gedeelde planningen konden nu niet worden geladen.");
    }
  };

  const applyJournalState = (payload: JournalPayload) => {
    setWishes(payload.wishes || []);
    setVisitedIds(payload.visitedIds || []);
    setReviews(payload.reviews || {});
    setUserMemories(payload.memories || []);
    setCustomPlaces((payload.customPlaces || []).map(repairAnimalPlaceCategory));
  };

  const localJournalSnapshot = () => ({
    wishes: JSON.parse(window.localStorage.getItem(WISHLIST_KEY) || "[]") as string[],
    visitedIds: JSON.parse(window.localStorage.getItem(VISITED_KEY) || "[]") as string[],
    reviews: JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY) || "{}") as ReviewMap,
    memories: (JSON.parse(window.localStorage.getItem(MEMORY_STORAGE_KEY) || "[]") as UserMemory[]).filter((memory) => !memory.id.startsWith("sample-")),
    customPlaces: JSON.parse(window.localStorage.getItem(CUSTOM_PLACES_KEY) || "[]") as Zoo[],
  });

  const loadSharedJournal = async () => {
    try {
      let response: Response;
      if (!window.localStorage.getItem(DATABASE_MIGRATION_KEY)) {
        response = await fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", snapshot: localJournalSnapshot() }) });
        if (!response.ok) throw new Error("Jullie gegevens konden niet online worden gezet.");
        const localPlans = JSON.parse(window.localStorage.getItem(PLANS_STORAGE_KEY) || "[]") as PlannedTrip[];
        for (const trip of localPlans) {
          const planResponse = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...trip, requestApproval: false }) });
          if (!planResponse.ok) throw new Error("Een bestaande planning kon niet online worden gezet.");
        }
        window.localStorage.setItem(DATABASE_MIGRATION_KEY, "done");
      } else {
        response = await fetch("/api/journal", { cache: "no-store" });
      }
      const payload = await response.json() as JournalPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Jullie dagboek kon niet worden geladen.");
      applyJournalState(payload);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Jullie dagboek kon niet worden geladen.");
    }
  };

  const saveJournalAction = async (body: Record<string, unknown>, applyResult = false) => {
    const response = await fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as JournalPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Online opslaan is niet gelukt.");
    if (applyResult) applyJournalState(payload);
    return payload;
  };

  useEffect(() => {
    try {
      const cleanSlateKey = "our-zoo-journal-sample-reset-v1";
      if (!window.localStorage.getItem(cleanSlateKey)) {
        const savedWishes = JSON.parse(window.localStorage.getItem(WISHLIST_KEY) || "[]") as string[];
        const savedVisited = JSON.parse(window.localStorage.getItem(VISITED_KEY) || "[]") as string[];
        const savedMemories = JSON.parse(window.localStorage.getItem(MEMORY_STORAGE_KEY) || "[]") as UserMemory[];
        window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(savedWishes.filter((id) => !["pairi", "apenheul"].includes(id))));
        window.localStorage.setItem(VISITED_KEY, JSON.stringify(savedVisited.filter((id) => !["burgers", "gaia", "blijdorp"].includes(id))));
        window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(savedMemories.filter((memory) => !memory.id.startsWith("sample-"))));
        window.localStorage.removeItem("our-zoo-journal-hidden-memories-v1");
        window.localStorage.setItem(cleanSlateKey, "done");
      }
      const saved = window.localStorage.getItem(REVIEW_STORAGE_KEY);
      if (saved) setReviews(JSON.parse(saved) as ReviewMap);
      const savedMemories = window.localStorage.getItem(MEMORY_STORAGE_KEY);
      if (savedMemories) setUserMemories(JSON.parse(savedMemories) as UserMemory[]);
      const savedPlans = window.localStorage.getItem(PLANS_STORAGE_KEY);
      if (savedPlans) setPlannedTrips(JSON.parse(savedPlans) as PlannedTrip[]);
      const savedCustomPlaces = window.localStorage.getItem(CUSTOM_PLACES_KEY);
      if (savedCustomPlaces) setCustomPlaces(JSON.parse(savedCustomPlaces) as Zoo[]);
      const discoveredPlaces = window.localStorage.getItem(DISCOVERED_PLACES_KEY);
      if (discoveredPlaces) {
        const repairedPlaces = (JSON.parse(discoveredPlaces) as Zoo[]).map(repairAnimalPlaceCategory);
        setLoadedPlaces(repairedPlaces);
        window.localStorage.setItem(DISCOVERED_PLACES_KEY, JSON.stringify(repairedPlaces));
      }
      const savedWishes = window.localStorage.getItem(WISHLIST_KEY);
      if (savedWishes) setWishes(JSON.parse(savedWishes) as string[]);
      const savedVisited = window.localStorage.getItem(VISITED_KEY);
      if (savedVisited) setVisitedIds(JSON.parse(savedVisited) as string[]);
    } catch {
      // Een beschadigde lokale waarde mag de journal nooit onbruikbaar maken.
    }
  }, []);

  useEffect(() => { void loadCoupleAccount(); }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    return () => window.cancelAnimationFrame(frame);
  }, [view, selected]);

  useEffect(() => {
    if (accountMode !== "ready") return;
    const refresh = () => { void loadCoupleAccount(); void loadSharedPlans(); void loadSharedJournal(); };
    refresh();
    const timer = window.setInterval(() => { void loadSharedPlans(); void loadSharedJournal(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [accountMode]);

  const allPlaces = useMemo(() => {
    const places = new Map<string, Zoo>();
    const idByName = new Map<string, string>();
    for (const place of [...zoos, ...customPlaces, ...loadedPlaces]) {
      const name = place.name.toLocaleLowerCase("nl").replace(/[^a-z0-9]/g, "");
      const existingId = idByName.get(name);
      if (existingId) {
        const existing = places.get(existingId);
        if (existing && place.source === "openstreetmap") {
          places.set(existingId, {
            ...existing,
            latitude: place.latitude ?? existing.latitude,
            longitude: place.longitude ?? existing.longitude,
            openingHours: place.openingHours || existing.openingHours,
            address: place.address || existing.address,
            phone: place.phone || existing.phone,
            wikipedia: place.wikipedia || existing.wikipedia,
            website: existing.website || place.website,
          });
        }
        continue;
      }
      idByName.set(name, place.id);
      places.set(place.id, place);
    }
    return [...places.values()].map((place) => {
      if (!userLocation) return place;
      const distance = distanceFromUser(userLocation, place);
      return distance == null ? place : { ...place, distance };
    });
  }, [customPlaces, loadedPlaces, userLocation]);

  const filtered = useMemo(
    () =>
      allPlaces
        .filter((z) => (country === "ALL" || z.country === country) && (placeType === "ALL" || (z.category || "zoo") === placeType) && z.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => (sort === "az" ? a.name.localeCompare(b.name) : a.distance - b.distance)),
    [allPlaces, country, placeType, sort, search]
  );
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  const partnerProfile = profiles.find((profile) => profile.id !== activeProfile?.id) || null;
  const incomingRequestCount = plannedTrips.filter((trip) => trip.approvalStatus === "pending" && trip.requestedFromId === activeProfile?.id).length;

  useEffect(() => setVisiblePlaceCount(18), [country, placeType, sort, search]);

  const wish = (id: string) => setWishes((current) => {
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    if (accountMode === "demo") window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
    else void saveJournalAction({ action: "place-state", zooId: id, wished: next.includes(id) }).catch(() => setAccountError("De wishlist kon niet online worden bijgewerkt."));
    return next;
  });
  const toggleVisited = (id: string) => setVisitedIds((current) => {
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    if (accountMode === "demo") window.localStorage.setItem(VISITED_KEY, JSON.stringify(next));
    else void saveJournalAction({ action: "place-state", zooId: id, visited: next.includes(id) }).catch(() => setAccountError("Bezocht kon niet online worden bijgewerkt."));
    return next;
  });
  const open = (id: string) => {
    setSelected(id);
    setView("detail");
  };
  const plan = (id?: string) => {
    if (id) setSelected(id);
    setPlannerIntent((current) => current + 1);
    setView("planner");
  };
  const selectedZoo = allPlaces.find((z) => z.id === selected) || null;
  const saveReview = (review: UserReview) => {
    setReviews((current) => {
      const next = { ...current, [review.zooId]: review };
      if (accountMode === "demo") window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(next));
      else void saveJournalAction({ action: "review", review }).catch(() => setAccountError("De beoordeling kon niet online worden opgeslagen."));
      return next;
    });
  };
  const startReview = (zooId: string) => {
    setSelected(zooId);
    setReviewTarget(zooId);
    setView("rankings");
  };
  const accountAction = async (action: "setup" | "join" | "rename", name: string, code?: string) => {
    setAccountError("");
    const response = await fetch("/api/couple", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, name, code }) });
    const payload = await response.json() as Parameters<typeof applyAccountState>[0] & { error?: string };
    if (!response.ok) { setAccountError(payload.error || "Het account kon niet worden bijgewerkt."); return; }
    applyAccountState(payload);
  };
  const switchProfile = (id: string) => {
    if (accountMode !== "demo") return;
    setActiveProfileId(id);
    window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, id);
  };
  const renameProfile = async (id: string, name: string) => {
    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) return;
    if (accountMode === "demo") {
      const next = profiles.map((profile) => profile.id === id ? { ...profile, displayName: cleanName } : profile);
      setProfiles(next);
      window.localStorage.setItem(COUPLE_PROFILE_STORAGE_KEY, JSON.stringify(next));
      return;
    }
    if (id === activeProfileId) await accountAction("rename", cleanName);
  };
  const saveMemory = async (memory: UserMemory) => {
    const next = [memory, ...userMemories.filter((item) => item.id !== memory.id)];
    if (accountMode === "demo") {
      try {
        window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(next));
        setUserMemories(next);
        return true;
      } catch { return false; }
    }
    const previous = userMemories;
    setUserMemories(next);
    try {
      await saveJournalAction({ action: "memory", memory }, true);
      return true;
    } catch (error) {
      setUserMemories(previous);
      setAccountError(error instanceof Error ? error.message : "De herinnering kon niet online worden opgeslagen.");
      return false;
    }
  };
  const deleteMemory = (id: string) => {
    const next = userMemories.filter((memory) => memory.id !== id);
    setUserMemories(next);
    if (accountMode === "demo") {
      window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(next));
      return;
    }
    void fetch(`/api/journal?resource=memory&id=${encodeURIComponent(id)}`, { method: "DELETE" }).then(async (response) => {
      const payload = await response.json() as JournalPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Verwijderen is niet gelukt.");
      applyJournalState(payload);
    }).catch((error) => setAccountError(error instanceof Error ? error.message : "Verwijderen is niet gelukt."));
  };
  const savePlannedTrip = (trip: PlannedTrip) => {
    const existing = plannedTrips.find((item) => item.id === trip.id);
    const requestApproval = Boolean(trip.requestApproval && partnerProfile);
    const nextTrip: PlannedTrip = { ...trip, createdById: existing?.createdById || activeProfile.id, requestedFromId: requestApproval ? partnerProfile?.id : null, approvalStatus: requestApproval ? "pending" : "approved" };
    const next = [nextTrip, ...plannedTrips.filter((item) => item.id !== trip.id)];
    setPlannedTrips(next);
    if (accountMode === "demo") {
      window.localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(next));
      return;
    }
    void fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...trip, requestApproval }) }).then(async (response) => {
      const payload = await response.json() as { trips?: PlannedTrip[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Voorstel kon niet worden verstuurd.");
      if (payload.trips) setPlannedTrips(payload.trips);
    }).catch((error) => setAccountError(error instanceof Error ? error.message : "Voorstel kon niet worden verstuurd."));
  };
  const deletePlannedTrip = (id: string) => {
    const next = plannedTrips.filter((trip) => trip.id !== id);
    setPlannedTrips(next);
    if (accountMode === "demo") {
      window.localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(next));
      return;
    }
    void fetch(`/api/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then((response) => response.json() as Promise<{ trips?: PlannedTrip[] }>).then((payload) => { if (payload.trips) setPlannedTrips(payload.trips); });
  };
  const toggleTripPacking = (tripId: string, itemId: string) => {
    const next = plannedTrips.map((trip) => trip.id === tripId ? { ...trip, packing: trip.packing.map((item) => item.id === itemId ? { ...item, checked: !item.checked } : item) } : trip);
    setPlannedTrips(next);
    const updated = next.find((trip) => trip.id === tripId);
    if (accountMode === "demo") {
      window.localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(next));
      return;
    }
    if (updated) void fetch("/api/plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tripId, action: "packing", packing: updated.packing }) });
  };
  const respondToTrip = (id: string, response: "approved" | "declined") => {
    const next = plannedTrips.map((trip) => trip.id === id ? { ...trip, approvalStatus: response } : trip);
    setPlannedTrips(next);
    if (accountMode === "demo") {
      window.localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(next));
      return;
    }
    void fetch("/api/plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: response === "approved" ? "approve" : "decline" }) }).then((result) => result.json() as Promise<{ trips?: PlannedTrip[] }>).then((payload) => { if (payload.trips) setPlannedTrips(payload.trips); });
  };
  const discoverPlaces = async () => {
    setPlacesLoading(true);
    setPlacesMessage("");
    try {
      const places = await loadAllAnimalPlaces();
      setLoadedPlaces(places);
      window.localStorage.setItem(DISCOVERED_PLACES_KEY, JSON.stringify(places));
      setPlacesMessage(`${places.length} zoo’s en aquariums gevonden in Nederland, België en Duitsland.`);
    } catch {
      setPlacesMessage("De live kaartlijst kon nu niet worden geladen. Probeer het straks opnieuw of voeg een plek handmatig toe.");
    } finally {
      setPlacesLoading(false);
    }
  };
  useEffect(() => {
    if (view !== "explore" || loadedPlaces.length || placesLoading) return;
    if (window.localStorage.getItem(DISCOVERED_PLACES_KEY)) return;
    void discoverPlaces();
  }, [view]);
  const locateUser = () => {
    if (!("geolocation" in navigator)) {
      setLocationMessage("Je browser kan geen locatie bepalen. De routeknoppen werken wel gewoon.");
      return;
    }
    setLocating(true); setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false); setLocationMessage("Afstanden zijn nu hemelsbreed vanaf jouw huidige locatie berekend.");
      },
      () => {
        setLocating(false); setLocationMessage("Locatie is niet gedeeld. Je vaste voorbeeldafstanden blijven zichtbaar.");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  };
  const addCustomPlace = (place: Zoo) => {
    const next = [place, ...customPlaces];
    setCustomPlaces(next);
    if (accountMode === "demo") window.localStorage.setItem(CUSTOM_PLACES_KEY, JSON.stringify(next));
    else void saveJournalAction({ action: "custom-place", place }).catch(() => setAccountError("De dierenplek kon niet online worden opgeslagen."));
    setPlacesMessage(`${place.name} is toegevoegd aan Dierenplekken en de kaart.`);
  };

  if (["loading", "signed-out", "setup", "join", "error"].includes(accountMode)) {
    return <CoupleAccess mode={accountMode} error={accountError} onSetup={(name) => accountAction("setup", name)} onJoin={(name, code) => accountAction("join", name, code)} />;
  }

  return (
    <main className="journal-shell">
      <Sidebar view={view} go={setView} />
      <section className="journal-main">
      <Header profiles={profiles} currentProfileId={activeProfile.id} wishlistCount={wishes.length} requestCount={incomingRequestCount} onLogo={() => setView("home")} onWishlist={() => setView("wishlist")} onAccounts={() => setView("settings")} />
      <CoupleBar profiles={profiles} currentId={activeProfile.id} mode={accountMode} requestCount={incomingRequestCount} onSwitch={switchProfile} onPlanner={() => setView("planner")} onSettings={() => setView("settings")} />
      {view === "home" && <DashboardHome setView={setView} plan={plan} open={open} places={allPlaces} wishes={wishes} visitedIds={visitedIds} reviews={reviews} onWish={wish} onVisited={toggleVisited} locationActive={Boolean(userLocation)} locating={locating} locationMessage={locationMessage} onLocate={locateUser} />}
      {view === "explore" && (
        <>
          <PageIntro kicker="VIND ONS VOLGENDE AVONTUUR" title="Ontdek dierenplekken" text="Van dichtbij tot roadtrip — welke dieren gaan we hierna ontmoeten?" animal="monkey" />
          <PlaceDiscovery loading={placesLoading} message={placesMessage} placeCount={allPlaces.length} locationMessage={locationMessage} locating={locating} locationActive={Boolean(userLocation)} onLocate={locateUser} onDiscover={discoverPlaces} onAdd={addCustomPlace} />
          <section className="filters">
            <label className="search">
              ⌕ <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek een dierentuin..." />
            </label>
            <div className="country-tabs">
              {["ALL", "NL", "BE", "DE"].map((x) => (
                <button className={country === x ? "active" : ""} onClick={() => setCountry(x)} key={x}>
                  {x === "ALL" ? "Alles" : `${flagEmoji[x]} ${x}`}
                </button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="distance">Dichtstbij eerst</option>
              <option value="az">A–Z</option>
            </select>
            <select value={placeType} onChange={(e) => setPlaceType(e.target.value)} aria-label="Soort dierenplek">
              <option value="ALL">Alle dierenplekken</option>
              <option value="zoo">Dierentuinen</option>
              <option value="aquarium">Aquariums</option>
              <option value="petting-zoo">Kinderboerderijen</option>
              <option value="animal-park">Dieren- & wildlifeparken</option>
            </select>
          </section>
          <div className="explore-result-summary" aria-live="polite">
            <strong>{filtered.length}</strong> {filtered.length === 1 ? "dierenplek gevonden" : "dierenplekken gevonden"}
            {filtered.length > visiblePlaceCount && <span>· je ziet er nu {visiblePlaceCount}</span>}
          </div>
          <section className="zoo-grid">
            {filtered.slice(0, visiblePlaceCount).map((z) => (
              <ZooCard key={z.id} zoo={z} wished={wishes.includes(z.id)} visited={visitedIds.includes(z.id)} onWish={() => wish(z.id)} onVisited={() => toggleVisited(z.id)} onOpen={() => open(z.id)} />
            ))}
          </section>
          {filtered.length === 0 && <div className="explore-empty">Geen dierenplekken gevonden. Pas je zoekopdracht of filters aan.</div>}
          {visiblePlaceCount < filtered.length && (
            <button className="show-more-places" onClick={() => setVisiblePlaceCount((count) => count + 18)}>
              Meer dierenplekken tonen
            </button>
          )}
        </>
      )}
      {view === "detail" && selectedZoo && (
        <ZooDetail
          zoo={{ ...selectedZoo, visited: visitedIds.includes(selectedZoo.id) }}
          wished={wishes.includes(selectedZoo.id)}
          onWish={() => wish(selectedZoo.id)}
          onBack={() => setView("explore")}
          onPlan={() => plan(selectedZoo.id)}
          review={reviews[selectedZoo.id]}
          onReview={() => startReview(selectedZoo.id)}
          locationActive={Boolean(userLocation)}
        />
      )}
      {view === "planner" && <Planner selected={selected} intent={plannerIntent} places={allPlaces} trips={plannedTrips} currentProfile={activeProfile} partnerProfile={partnerProfile} onSave={savePlannedTrip} onDelete={deletePlannedTrip} onTogglePacking={toggleTripPacking} onRespond={respondToTrip} />}
      {view === "journey" && <JourneyView places={allPlaces} wishes={wishes} visitedIds={visitedIds} onWish={wish} onVisited={toggleVisited} />}
      {view === "rankings" && (
        <Rankings
          reviews={reviews}
          onSave={saveReview}
          initialZooId={reviewTarget}
          onReviewTargetHandled={() => setReviewTarget(null)}
          places={allPlaces}
        />
      )}
      {view === "memories" && <Memories memories={userMemories} onSave={saveMemory} onDelete={deleteMemory} places={allPlaces} />}
      {view === "wishlist" && (
        <>
          <PageIntro kicker="BEWAARD VOOR LATER" title="Onze wishlist" text={`${wishes.length} wilde dates om samen van te dromen.`} animal="redpanda" />
          <section className="zoo-grid">
            {allPlaces
              .filter((z) => wishes.includes(z.id))
              .map((z) => (
                <ZooCard key={z.id} zoo={z} wished visited={visitedIds.includes(z.id)} onWish={() => wish(z.id)} onVisited={() => toggleVisited(z.id)} onOpen={() => open(z.id)} />
              ))}
          </section>
        </>
      )}
      {view === "settings" && <Settings profiles={profiles} currentProfileId={activeProfile.id} accountMode={accountMode} inviteCode={inviteCode} onRename={renameProfile} />}
      </section>
      <Nav view={view} go={setView} />
    </main>
  );
}

function UiIcon({ name }: { name: string }) {
  return <img className="ui-icon" src={`/icons-clean/${name}.png`} alt="" aria-hidden="true" />;
}

function Sidebar({ view, go }: { view: View; go: (view: View) => void }) {
  const items: [View, string, string][] = [
    ["home", "home", "Start"], ["explore", "paw", "Dierenplekken"], ["planner", "calendar", "Agenda"],
    ["journey", "map", "Reiskaart"], ["rankings", "trophy", "Ranglijst"], ["memories", "camera", "Herinneringen"],
    ["wishlist", "heart", "Verlanglijst"], ["settings", "settings", "Instellingen"],
  ];
  return (
    <aside className="journal-sidebar">
      <button className="side-brand" onClick={() => go("home")} aria-label="Ga naar home">
        <ZooPhoto animal="redpanda" alt="" /><span>ONZE ZOO<br />AVONTUREN</span>
      </button>
      <nav aria-label="Hoofdnavigatie">
        {items.map(([target, icon, label]) => (
          <button key={target} className={view === target || (view === "detail" && target === "explore") ? "active" : ""} onClick={() => go(target)}>
            <UiIcon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="side-note"><span>❧</span><p>Twee mensen.<br />Drie landen.<br />Heel veel dieren om te ontmoeten.</p><b>♥</b></div>
    </aside>
  );
}

function Header({ profiles, currentProfileId, wishlistCount, requestCount, onLogo, onWishlist, onAccounts }: { profiles: CoupleProfile[]; currentProfileId: string; wishlistCount: number; requestCount: number; onLogo: () => void; onWishlist: () => void; onAccounts: () => void }) {
  const current = profiles.find((profile) => profile.id === currentProfileId) || profiles[0];
  const partner = profiles.find((profile) => profile.id !== current?.id);
  const initial = (profile?: CoupleProfile) => profile?.displayName.trim().charAt(0).toUpperCase() || "?";
  return (
    <header className="topbar">
      <button className="logo" onClick={onLogo}>
        <span>ons</span> zoo dagboek <b>♥</b>
      </button>
      <div className="header-actions">
        <button onClick={onWishlist} className="round-button" aria-label="Open verlanglijst">
          <UiIcon name="heart" />
          {wishlistCount > 0 && <b className="header-count-badge">{wishlistCount > 99 ? "99+" : wishlistCount}</b>}
        </button>
        <button className="couple-avatar-button" onClick={onAccounts} aria-label={`Open accounts van ${current?.displayName || "Paulien"}${partner ? ` en ${partner.displayName}` : ""}`}>
          <span className="couple-avatar-circle current">{initial(current)}</span>
          {partner && <span className="couple-avatar-circle partner">{initial(partner)}</span>}
          {requestCount > 0 && <b className="header-request-badge" aria-label={`${requestCount} nieuwe voorstellen`}>{requestCount}</b>}
        </button>
      </div>
    </header>
  );
}

function PageIntro({ kicker, title, text, animal }: { kicker: string; title: string; text: string; animal: Zoo["animal"] }) {
  return (
    <section className="page-intro">
      <div>
        <span className="eyebrow">{kicker}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="paint-corner">
        <ZooPhoto animal={animal} alt="" />
      </div>
    </section>
  );
}

function Home({
  setView,
  plan,
  open,
  wishes,
  wish,
}: {
  setView: (v: View) => void;
  plan: (id?: string) => void;
  open: (id: string) => void;
  wishes: string[];
  wish: (id: string) => void;
}) {
  const visited = zoos.filter((z) => z.visited);
  const totalKm = visited.reduce((sum, z) => sum + z.distance, 0);
  const avgRating = visited.length ? (visited.reduce((s, z) => s + (z.scores?.overall || 0), 0) / visited.length).toFixed(1) : "–";
  const pick = [...zoos].filter((z) => !z.visited).sort((a, b) => a.distance - b.distance)[0] || zoos[0];
  const nextUp = [...zoos].filter((z) => !z.visited).sort((a, b) => a.distance - b.distance)[0];

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">OUR LITTLE WILD ADVENTURE</span>
          <h1>
            Two hearts,
            <br />
            <em>a world of animals.</em>
          </h1>
          <p>Van eerste giraffenblik tot laatste ijsje — hier bewaren we iedere wilde date.</p>
          <button onClick={() => plan()} className="primary">
            Plan our next date <span>→</span>
          </button>
        </div>
        <div className="hero-art">
          <div className="sun" />
          <div className="leaf">❧</div>
          <div className="polaroid polaroid-a">
            <div className="photo">
              <ZooPhoto animal="giraffe" alt="giraffe" />
            </div>
            <span>you &amp; me</span>
          </div>
          <div className="polaroid polaroid-b">
            <div className="photo">
              <ZooPhoto animal="elephant" alt="olifant" />
            </div>
            <span>wild days</span>
          </div>
          <div className="tape tape-a" />
          <div className="tape tape-b" />
          <div className="sticker">
            adventure
            <br />
            awaits!
          </div>
        </div>
      </section>

      <section className="progress-card">
        <div>
          <small>OUR ZOO STORY</small>
          <strong>{visited.length}</strong>
          <span>zoos visited</span>
        </div>
        <div>
          <small>&nbsp;</small>
          <strong>{zoos.length - visited.length}</strong>
          <span>to go</span>
        </div>
        <div>
          <small>&nbsp;</small>
          <strong>{totalKm.toLocaleString("nl-NL")}</strong>
          <span>km traveled</span>
        </div>
        <div className="progress-visual">
          <span>
            {visited.length} of {zoos.length}
          </span>
          <div className="bar">
            <i style={{ width: `${(visited.length / zoos.length) * 100}%` }} />
          </div>
          <small>gemiddelde score {avgRating}</small>
        </div>
      </section>

      <section className="section-head">
        <div>
          <span className="eyebrow">NEXT ADVENTURE</span>
          <h2>Where to next?</h2>
        </div>
        <button onClick={() => setView("explore")} className="text-button">
          Explore all zoos →
        </button>
      </section>
      <section className="featured-card">
        <div className="featured-image">
          <span className="country">
            {flagEmoji[pick.country]} {pick.countryName.toUpperCase()}
          </span>
          <ZooPhoto animal={pick.animal} alt={pick.name} />
        </div>
        <div className="featured-copy">
          <div>
            <span className="eyebrow">OUR PICK FOR YOU</span>
            <h3>{pick.name}</h3>
            <p>
              {pick.city} · {pick.distance} km away
            </p>
          </div>
          <p className="description">{pick.intro}</p>
          <div className="price-row">
            <strong>Live prijs <small>op bezoekdatum</small></strong>
            <span>✓ via officiële bron</span>
          </div>
          <div className="actions">
            <button onClick={() => open(pick.id)} className="primary">
              Bekijk deze date
            </button>
            <button onClick={() => wish(pick.id)} className={`heart ${wishes.includes(pick.id) ? "active" : ""}`}>
              {wishes.includes(pick.id) ? "♥" : "♡"}
            </button>
          </div>
        </div>
      </section>

      <section className="home-widgets">
        <div className="widget-card map-widget">
          <div className="widget-head">
            <span className="eyebrow">OUR JOURNEY</span>
            <h3>Onze route tot nu toe</h3>
          </div>
          <div className="mini-map">
            <span className="mini-pin mini-pin-1" />
            <span className="mini-pin mini-pin-2" />
            <span className="mini-pin mini-pin-3" />
            <span className="mini-route" />
          </div>
          <div className="legend">
            <span>
              <i className="dot dot-visited" /> Visited
            </span>
            <span>
              <i className="dot dot-planned" /> Planned
            </span>
            <span>
              <i className="dot dot-wishlist" /> Wishlist
            </span>
          </div>
          {nextUp && (
            <div className="next-note">
              <span className="eyebrow">NEXT ADVENTURE</span>
              <strong>{nextUp.name}</strong>
              <small>
                {nextUp.countryName} · {nextUp.distance} km away
              </small>
            </div>
          )}
        </div>
        <div className="widget-card bucket-card">
          <div className="widget-head">
            <span className="eyebrow">ZOO BUCKET LIST</span>
            <h3>
              {bucketList.filter((b) => b.done).length} / {bucketList.length} gedaan
            </h3>
          </div>
          <div className="bucket-progress">
            <i style={{ width: `${(bucketList.filter((b) => b.done).length / bucketList.length) * 100}%` }} />
          </div>
          <ul className="bucket-items">
            {bucketList.map((b) => (
              <li key={b.label} className={b.done ? "done" : ""}>
                <span className="check">{b.done ? "✓" : "○"}</span>
                {b.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <QuickLinks go={setView} />
    </>
  );
}

function PlaceDiscovery({ loading, message, placeCount, locationMessage, locating, locationActive, onLocate, onDiscover, onAdd }: { loading: boolean; message: string; placeCount: number; locationMessage: string; locating: boolean; locationActive: boolean; onLocate: () => void; onDiscover: () => void; onAdd: (place: Zoo) => void }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState<"NL" | "BE" | "DE">("NL");
  const [category, setCategory] = useState<"zoo" | "aquarium" | "petting-zoo" | "animal-park">("zoo");
  const [website, setWebsite] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const coordinates = await findPlaceCoordinates(name, city, country);
    onAdd(createCustomPlace({ name, city, country, category, website, ...coordinates }));
    setSaving(false); setAdding(false); setName(""); setCity(""); setWebsite("");
  };

  return <section className="place-discovery">
    <div className="place-discovery-copy"><span className="eyebrow">COMPLETE LIVE LIJST</span><h2>{placeCount} zoo’s, aquariums & dierenparken</h2><p>Openbare kaartdata uit heel Nederland, België en Duitsland. De lijst wordt automatisch geladen en lokaal onthouden.</p><a className="place-data-source" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
    <div className="place-discovery-actions">
      <button className="location-button" onClick={onLocate} disabled={locating}>{locating ? "Locatie bepalen…" : locationActive ? "✓ Mijn locatie actief" : "⌖ Gebruik mijn locatie"}</button>
      <details className="place-manage-menu">
        <summary>Meer opties</summary>
        <div>
          <button className="discover-button" onClick={onDiscover} disabled={loading}>{loading ? "Heel NL, BE & DE laden…" : "↻ Lijst vernieuwen"}</button>
          <button className="add-place-button" onClick={() => setAdding((value) => !value)}>＋ Zelf een plek toevoegen</button>
        </div>
      </details>
    </div>
    {message && <p className="place-message" role="status">{message}</p>}
    {locationMessage && <p className="place-message location-message" role="status">{locationMessage}</p>}
    {adding && <form className="add-place-form" onSubmit={submit}>
      <label>Naam<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Bijvoorbeeld: Zeehondencentrum" /></label>
      <label>Plaats<input required value={city} onChange={(event) => setCity(event.target.value)} placeholder="Bijvoorbeeld: Pieterburen" /></label>
      <label>Land<select value={country} onChange={(event) => setCountry(event.target.value as "NL" | "BE" | "DE")}><option value="NL">🇳🇱 Nederland</option><option value="BE">🇧🇪 België</option><option value="DE">🇩🇪 Duitsland</option></select></label>
      <label>Soort<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}><option value="zoo">Dierentuin</option><option value="aquarium">Aquarium</option><option value="petting-zoo">Kinderboerderij</option><option value="animal-park">Ander dierenuitje</option></select></label>
      <label className="place-website">Website <small>(optioneel)</small><input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://..." /></label>
      <button className="primary" disabled={saving}>{saving ? "Plek op de kaart zoeken…" : "Toevoegen aan journal ♥"}</button>
    </form>}
  </section>;
}

function JourneyMap({
  compact = false,
  places,
  wishes,
  visitedIds,
  onWish,
  onVisited,
}: {
  compact?: boolean;
  places: Zoo[];
  wishes: string[];
  visitedIds: string[];
  onWish: (id: string) => void;
  onVisited: (id: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const mapPlaces = useMemo(() => places.map((place) => {
    const coords = place.latitude != null && place.longitude != null ? [place.latitude, place.longitude] : knownCoordinates[place.id];
    return coords ? { id: place.id, name: place.name, lat: coords[0], lng: coords[1], category: place.category || "zoo", website: place.website } : null;
  }).filter(Boolean), [places]);
  const syncMap = () => frame.current?.contentWindow?.postMessage({ type: "zoo-state", places: mapPlaces, wishes, visitedIds }, "*");

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== "zoo-action") return;
      if (event.data.action === "wish") onWish(event.data.id);
      if (event.data.action === "visited") onVisited(event.data.id);
    };
    window.addEventListener("message", receive);
    syncMap();
    return () => window.removeEventListener("message", receive);
  });

  return (
    <div className={`live-map ${compact ? "compact" : ""}`}>
      <iframe ref={frame} onLoad={syncMap} title="Interactieve kaart met onze dierentuinen" src="/map.html" loading="lazy" />
      <div className="map-legend" aria-label="Legenda">
        <span><i className="dot dot-visited" /> Bezocht</span>
        <span><i className="dot dot-planned" /> Gepland</span>
        <span><i className="dot dot-wishlist" /> Wishlist</span>
      </div>
    </div>
  );
}

function DashboardHome({ setView, plan, open, places, wishes, visitedIds, reviews, onWish, onVisited, locationActive, locating, locationMessage, onLocate }: { setView: (v: View) => void; plan: (id?: string) => void; open: (id: string) => void; places: Zoo[]; wishes: string[]; visitedIds: string[]; reviews: ReviewMap; onWish: (id: string) => void; onVisited: (id: string) => void; locationActive: boolean; locating: boolean; locationMessage: string; onLocate: () => void }) {
  const visited = places.filter((zoo) => visitedIds.includes(zoo.id));
  const wishlist = places.filter((zoo) => wishes.includes(zoo.id));
  const homePlaces = places.filter((zoo) => visitedIds.includes(zoo.id) || wishes.includes(zoo.id));
  const upcoming = wishlist.filter((zoo) => !visitedIds.includes(zoo.id)).sort((a, b) => a.distance - b.distance)[0];
  const memories = visited.slice(0, 3);
  const reviewedScores = visited.map((zoo) => reviews[zoo.id]?.scores.overall).filter((score): score is number => typeof score === "number");
  const avg = reviewedScores.length ? (reviewedScores.reduce((sum, score) => sum + score, 0) / reviewedScores.length).toFixed(1) : "–";
  const totalKm = visited.filter((zoo) => zoo.distance < 999).reduce((sum, zoo) => sum + zoo.distance, 0);
  return (
    <div className="dashboard-page">
      <header className="dashboard-title">
        <span className="botanical">❧</span>
        <div><h1>Onze Zoo Avonturen</h1><p>alleen onze bezoeken en droomdates, op één plek <b>♥</b></p></div>
        <ZooPhoto animal="redpanda" alt="" />
      </header>

      <section className="dashboard-stats" aria-label="Onze statistieken">
        <div><strong>{visited.length}</strong><span>Bezocht</span></div>
        <div><strong>{wishlist.length}</strong><span>Op de verlanglijst</span></div>
        <button className="dashboard-stat-button" onClick={onLocate} disabled={locating} title="Bereken hemelsbrede afstanden vanaf je huidige locatie"><strong>{locating ? "…" : locationActive ? `${totalKm.toLocaleString("nl-NL")} km` : "⌖"}</strong><span>{locationActive ? "Som vanaf jouw locatie" : "Afstand berekenen"}</span></button>
        <div><strong>★ {avg}</strong><span>Eigen gemiddelde</span></div>
      </section>
      {locationMessage && <p className="dashboard-location-message" role="status">{locationMessage}</p>}

      <section className="dashboard-map-card">
        <JourneyMap compact places={homePlaces} wishes={wishes} visitedIds={visitedIds} onWish={onWish} onVisited={onVisited} />
        {upcoming && <button className="next-adventure-note" onClick={() => open(upcoming.id)}>
          <span className="eyebrow">VOLGENDE DROOMDATE</span><strong>{upcoming.name}</strong>
          <small>{upcoming.countryName}<br />{upcoming.distance >= 999 ? "afstand onbekend" : `${upcoming.distance} km`}</small>
          <ZooPhoto animal={upcoming.animal} alt="" />
        </button>}
      </section>

      <section className="dashboard-lower">
        <div className="recent-panel">
          <div className="panel-heading"><h2>Onze bezochte dierentuinen</h2>{memories.length > 0 && <button onClick={() => setView("memories")}>Alle herinneringen →</button>}</div>
          <div className={`memory-row ${!memories.length ? "is-empty" : ""}`}>
            {memories.map((z) => <button className="memory-mini" onClick={() => open(z.id)} key={z.id}>
              <span className="memory-mini-photo"><ZooPhoto animal={z.animal} alt={z.name} /></span>
              <strong>{z.name}</strong><small>Bezocht</small>
            </button>)}
            {!memories.length && <div className="dashboard-empty-state"><p className="dashboard-empty-copy">Markeer bij Dierenplekken jullie eerste bezochte locatie.</p><button className="soft-action" onClick={() => setView("explore")}>Ontdek dierenplekken →</button></div>}
          </div>
        </div>
        <div className="bucket-panel wishlist-home-panel">
          <div className="panel-heading"><h2>Verlanglijst</h2>{wishlist.length > 0 && <button onClick={() => setView("wishlist")}>Bekijk alles →</button>}</div>
          <ul>{wishlist.slice(0, 4).map((zoo) => <li key={zoo.id}><button onClick={() => open(zoo.id)}><span>♡</span><b>{zoo.name}</b><small>{zoo.city}</small></button></li>)}</ul>
          {!wishlist.length && <p className="dashboard-empty-copy">Nog niets bewaard. Geef bij Dierenplekken een locatie een hartje.</p>}
          <button className="soft-action" onClick={() => upcoming ? plan(upcoming.id) : setView("explore")}>{upcoming ? "Plan de volgende droomdate →" : "Ontdek dierenplekken →"}</button>
        </div>
      </section>
    </div>
  );
}

function JourneyView({ places, wishes, visitedIds, onWish, onVisited }: { places: Zoo[]; wishes: string[]; visitedIds: string[]; onWish: (id: string) => void; onVisited: (id: string) => void }) {
  const visited = places.filter((zoo) => visitedIds.includes(zoo.id));
  const totalKm = visited.filter((zoo) => zoo.distance < 999).reduce((sum, zoo) => sum + zoo.distance, 0);
  return <>
    <PageIntro kicker="ONZE AFGELEGDE KILOMETERS" title="Onze reiskaart" text="Sleep, zoom, filter en klik op een pictogram om jullie dierenplekken te bekijken." animal="elephant" />
    <section className="journey-live-card"><JourneyMap places={places} wishes={wishes} visitedIds={visitedIds} onWish={onWish} onVisited={onVisited} /><div className="trip-stats">
      <div><strong>{totalKm.toLocaleString("nl-NL")}</strong><span>opgetelde kilometers</span></div>
      <div><strong>{new Set(visited.map((z) => z.country)).size}</strong><span>landen bezocht</span></div>
      <div><strong>{visited.length}</strong><span>dierendates</span></div>
    </div></section>
  </>;
}

function Settings({ profiles, currentProfileId, accountMode, inviteCode, onRename }: { profiles: CoupleProfile[]; currentProfileId: string; accountMode: AccountMode; inviteCode: string; onRename: (id: string, name: string) => Promise<void> }) {
  return <><PageIntro kicker="MAAK HET VAN JULLIE" title="Instellingen" text="Kleine keuzes voor jullie eigen dagboek." animal="bear" />
    <section className="settings-card"><CoupleSettings profiles={profiles} currentId={currentProfileId} mode={accountMode} inviteCode={inviteCode} onRename={onRename} /><h2>Voorkeuren</h2>
      <label><span>Afstanden tonen in kilometers</span><input type="checkbox" defaultChecked /></label>
      <label><span>Kortingen markeren bij Dierenplekken</span><input type="checkbox" defaultChecked /></label>
      <label><span>Herinnering vóór een geplande date</span><input type="checkbox" defaultChecked /></label>
    </section></>;
}

function QuickLinks({ go }: { go: (v: View) => void }) {
  return (
    <section className="quick-grid">
      {[
        ["journey", "map", "Our journey", "Bekijk onze route door drie landen"],
        ["rankings", "trophy", "Zoo ranking", "Welke zoo staat op nummer één?"],
        ["memories", "camera", "Memory box", "Herbeleef onze favoriete momenten"],
      ].map(([v, e, t, p]) => (
        <button key={v} onClick={() => go(v as View)}>
          <UiIcon name={e} />
          <span>
            <strong>{t}</strong>
            <small>{p}</small>
          </span>
          <i aria-hidden="true">→</i>
        </button>
      ))}
    </section>
  );
}

function addTripMinutes(time: string, minutes: number) {
  const [hours, minute] = time.split(":").map(Number);
  const total = hours * 60 + minute + minutes;
  const nextHours = Math.floor((total % (24 * 60)) / 60).toString().padStart(2, "0");
  const nextMinutes = (total % 60).toString().padStart(2, "0");
  return `${nextHours}:${nextMinutes}`;
}

function tripItinerary(trip: Pick<PlannedTrip, "leave" | "start">, zoo: Zoo) {
  const arrive = addTripMinutes(trip.leave, zoo.driveMinutes);
  return [
    [trip.leave, `Vertrek van ${trip.start}`],
    [arrive, `Aankomst bij ${zoo.name}`],
    [addTripMinutes(arrive, 180), "Lunchtijd"],
    [addTripMinutes(arrive, 300), `${zoo.highlights[0] || "Favoriete dieren spotten"}!`],
    [addTripMinutes(arrive, zoo.driveMinutes >= 240 ? 480 : 420), "Terug naar huis"],
  ];
}

function formatPlannedDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("nl-NL", options || { weekday: "short", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));
}

function Planner({ selected, intent, places, trips, currentProfile, partnerProfile, onSave, onDelete, onTogglePacking, onRespond }: { selected: string | null; intent: number; places: Zoo[]; trips: PlannedTrip[]; currentProfile: CoupleProfile; partnerProfile: CoupleProfile | null; onSave: (trip: PlannedTrip) => void; onDelete: (id: string) => void; onTogglePacking: (tripId: string, itemId: string) => void; onRespond: (id: string, response: "approved" | "declined") => void }) {
  const firstZooId = selected || places[0].id;
  const [zooId, setZooId] = useState(firstZooId);
  const [date, setDate] = useState("2026-09-12");
  const [leave, setLeave] = useState("09:15");
  const [start, setStart] = useState("Ons huis");
  const [budget, setBudget] = useState(70);
  const [tickets, setTickets] = useState<"nee" | "ja">("ja");
  const [note, setNote] = useState("");
  const [packing, setPacking] = useState(defaultPackingList("ja"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [done, setDone] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState("2026-09");
  const [requestApproval, setRequestApproval] = useState(true);
  const editorRef = useRef<HTMLElement>(null);
  const chosen = places.find((z) => z.id === zooId) || places[0];
  const activeTrip = trips.find((trip) => trip.id === activeTripId) || null;
  const activeZoo = activeTrip ? places.find((zoo) => zoo.id === activeTrip.zooId) || places[0] : null;
  const canManageActive = Boolean(activeTrip && (!activeTrip.createdById || activeTrip.createdById === currentProfile.id));
  const canRespondToActive = Boolean(activeTrip && activeTrip.approvalStatus === "pending" && activeTrip.requestedFromId === currentProfile.id);
  const draftItinerary = tripItinerary({ leave, start }, chosen);
  const sortedTrips = [...trips].sort((a, b) => a.date.localeCompare(b.date) || a.leave.localeCompare(b.leave));
  const incomingRequests = sortedTrips.filter((trip) => trip.approvalStatus === "pending" && trip.requestedFromId === currentProfile.id);
  const profileName = (id?: string | null) => {
    if (id === currentProfile.id) return currentProfile.displayName;
    if (partnerProfile && id === partnerProfile.id) return partnerProfile.displayName;
    return "je partner";
  };

  useEffect(() => {
    if (!selected) return;
    setZooId(selected);
  }, [selected]);

  useEffect(() => {
    if (!intent) return;
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [intent]);

  useEffect(() => {
    if (!activeTrip) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveTripId(null);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [activeTrip]);

  const resetForm = (nextZooId = selected || places[0].id) => {
    setEditingId(null); setZooId(nextZooId); setDate("2026-09-12"); setLeave("09:15"); setStart("Ons huis"); setBudget(70); setTickets("nee"); setNote(""); setPacking(defaultPackingList("nee")); setRequestApproval(Boolean(partnerProfile)); setDone(false);
  };
  const beginNewTrip = () => {
    resetForm();
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const beginEditTrip = (trip: PlannedTrip) => {
    setEditingId(trip.id); setZooId(trip.zooId); setDate(trip.date); setLeave(trip.leave); setStart(trip.start); setBudget(trip.budget); setTickets(trip.tickets); setNote(trip.note); setPacking(trip.packing); setRequestApproval(Boolean(partnerProfile)); setDone(false); setActiveTripId(null); setConfirmDelete(false);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const changeTickets = (value: "nee" | "ja") => {
    setTickets(value);
    setPacking((current) => current.map((item) => item.id === "tickets" ? { ...item, checked: value === "ja" } : item));
  };
  const submitTrip = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const existing = editingId ? trips.find((trip) => trip.id === editingId) : undefined;
    const trip: PlannedTrip = {
      id: editingId || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `trip-${Date.now()}`),
      zooId, date, leave, start: start.trim(), budget, tickets, note: note.trim(), packing,
      createdAt: existing?.createdAt || new Date().toISOString(), requestApproval,
    };
    onSave(trip);
    setCalendarMonth(date.slice(0, 7));
    setEditingId(null);
    setDone(true);
    setActiveTripId(trip.id);
  };

  const [calendarYear, calendarMonthNumber] = calendarMonth.split("-").map(Number);
  const daysInMonth = new Date(calendarYear, calendarMonthNumber, 0).getDate();
  const leadingDays = (new Date(calendarYear, calendarMonthNumber - 1, 1).getDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(calendarYear, calendarMonthNumber - 1, 1));
  const changeCalendarMonth = (delta: number) => {
    const next = new Date(calendarYear, calendarMonthNumber - 1 + delta, 1);
    setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <>
      <PageIntro kicker="MAAK ER EEN DAGJE UIT VAN" title="Uitjesplanner" text="Plan de dag, bewaar hem in de kalender en vergeet helemaal niets." animal="tiger" />

      {incomingRequests.length > 0 && <section className="plan-request-inbox" aria-label="Nieuwe voorstellen"><div className="plan-request-heading"><span className="eyebrow">NIEUW VOOR JOU</span><h2>{incomingRequests.length === 1 ? "Je hebt een voorstel" : `Je hebt ${incomingRequests.length} voorstellen`}</h2><p>{partnerProfile?.displayName || "Je partner"} wil graag iets met je plannen. Wat vind jij?</p></div><div className="plan-request-list">{incomingRequests.map((trip) => { const zoo = places.find((place) => place.id === trip.zooId) || places[0]; return <article className="plan-request-card" key={trip.id}><div className="plan-request-animal"><ZooPhoto animal={zoo.animal} alt="" /></div><div><small>{profileName(trip.createdById)} vraagt</small><h3>“Zullen we naar {zoo.name} gaan?”</h3><p>{formatPlannedDate(trip.date, { weekday: "long", day: "numeric", month: "long" })} · vertrek om {trip.leave}</p>{trip.note && <em>“{trip.note}”</em>}</div><div className="plan-request-actions"><button className="decline" onClick={() => onRespond(trip.id, "declined")}>Liever niet</button><button className="approve" onClick={() => onRespond(trip.id, "approved")}>Ja, leuk! ♥</button></div></article>; })}</div></section>}

      <section className="planner-dashboard">
        <div className="planner-section-heading">
          <div><span className="eyebrow">ONZE VOLGENDE AVONTUREN</span><h2>Geplande dierendates</h2><p>Alles wat jullie hebben opgeslagen staat hier én in de kalender.</p></div>
          <button className="planner-new-button" onClick={beginNewTrip}>＋ Nieuwe date</button>
        </div>
        <div className="planner-overview-grid">
          <div className="upcoming-trips">
            {sortedTrips.length === 0 ? <div className="planner-empty"><span aria-hidden="true">♡</span><h3>Nog geen uitjes gepland</h3><p>Kies een dierenplek en sla jullie eerste avontuur op.</p><button onClick={beginNewTrip}>Plan ons eerste uitje</button></div> : sortedTrips.map((trip) => {
              const zoo = places.find((place) => place.id === trip.zooId) || places[0];
              const checked = trip.packing.filter((item) => item.checked).length;
              return <button className="planned-trip-card" key={trip.id} onClick={() => { setActiveTripId(trip.id); setConfirmDelete(false); }}>
                <span className="planned-trip-date"><b>{new Date(`${trip.date}T12:00:00`).getDate()}</b><small>{formatPlannedDate(trip.date, { month: "short" })}</small></span>
                <span className="planned-trip-animal"><ZooPhoto animal={zoo.animal} alt="" /></span>
                <span className="planned-trip-copy"><small>{trip.leave} · vertrek vanaf {trip.start}</small><strong>{zoo.name}</strong><span>{zoo.city} · {zoo.distance} km</span><b className={`trip-status ${trip.approvalStatus || "approved"}`}>{trip.approvalStatus === "pending" ? trip.createdById === currentProfile.id ? `Wacht op ${profileName(trip.requestedFromId)}` : "Jouw antwoord nodig" : trip.approvalStatus === "declined" ? "Afgewezen" : "Samen afgesproken ✓"}</b></span>
                <span className="planned-trip-progress">{checked}/{trip.packing.length}<small>ingepakt</small></span>
                <i aria-hidden="true">→</i>
              </button>;
            })}
          </div>

          <aside className="planner-calendar-card" aria-label="Kalender met geplande dates">
            <div className="calendar-heading"><button onClick={() => changeCalendarMonth(-1)} aria-label="Vorige maand">‹</button><h3>{monthLabel}</h3><button onClick={() => changeCalendarMonth(1)} aria-label="Volgende maand">›</button></div>
            <div className="calendar-weekdays">{["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-days">
              {Array.from({ length: leadingDays }, (_, index) => <span className="calendar-blank" key={`blank-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const dateKey = `${calendarMonth}-${String(day).padStart(2, "0")}`;
                const dayTrips = sortedTrips.filter((trip) => trip.date === dateKey && (!trip.approvalStatus || trip.approvalStatus === "approved"));
                return dayTrips.length ? <button className="calendar-day has-trip" key={dateKey} onClick={() => { setActiveTripId(dayTrips[0].id); setConfirmDelete(false); }} aria-label={`${dayTrips.length} geplande date op ${formatPlannedDate(dateKey)}`}><span>{day}</span><i>{dayTrips.length > 1 ? dayTrips.length : "♥"}</i></button> : <span className="calendar-day" key={dateKey}><span>{day}</span></span>;
              })}
            </div>
            <p className="calendar-legend"><i /> Geplande zoo date · klik voor het hele plan</p>
          </aside>
        </div>
      </section>

      <section className="planner-editor" ref={editorRef}>
        <div className="planner-section-heading compact"><div><span className="eyebrow">{editingId ? "PAS ONS UITJE AAN" : "PLAN IETS WILDS"}</span><h2>{editingId ? "Uitje aanpassen" : "Nieuw uitje plannen"}</h2></div></div>
        <div className="planner-layout">
          <form className="paper-form" onSubmit={submitTrip}>
            <label>Dierentuin<select value={zooId} onChange={(event) => setZooId(event.target.value)}>{places.map((zoo) => <option value={zoo.id} key={zoo.id}>{zoo.name}</option>)}</select></label>
            <div className="form-row">
              <label>Datum<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
              <label>Vertrektijd<input required type="time" value={leave} onChange={(event) => setLeave(event.target.value)} /></label>
            </div>
            <label>Startpunt<input required value={start} onChange={(event) => setStart(event.target.value)} /></label>
            <div className="form-row">
              <label>Budget<input type="number" min={0} value={budget} onChange={(event) => setBudget(Number(event.target.value))} /></label>
              <label>Tickets<select value={tickets} onChange={(event) => changeTickets(event.target.value as "nee" | "ja")}><option value="nee">Nog niet gekocht</option><option value="ja">Gekocht</option></select></label>
            </div>
            <div className="budget-summary"><span>Jullie ingestelde budget</span><strong>€{budget.toFixed(2).replace(".", ",")}</strong><span className="ok">zelf bepaald</span></div>
            <label>Kleine notitie<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Picknick meenemen, bijpassende outfits…" /></label>
            {partnerProfile && <label className="partner-request-toggle"><input type="checkbox" checked={requestApproval} onChange={(event) => setRequestApproval(event.target.checked)} /><span><strong>Vraag {partnerProfile.displayName} om goedkeuring</strong><small>Er verschijnt een voorstel in het andere account.</small></span></label>}
            <div className="planner-form-actions">{editingId && <button type="button" className="secondary" onClick={() => resetForm()}>Annuleren</button>}<button className="primary">{editingId ? requestApproval ? "Wijziging voorstellen ♥" : "Wijzigingen opslaan ♥" : requestApproval ? `Voorstel sturen naar ${partnerProfile?.displayName} ♥` : "Uitje opslaan ♥"}</button></div>
            {done && <p className="success">✓ {requestApproval ? `Voorstel verstuurd naar ${partnerProfile?.displayName}.` : "Uitje staat in jullie kalender!"}</p>}
          </form>

          <div className="planner-side">
            <aside className="itinerary-card"><span className="eyebrow">DAGPLANNING</span><h2>Het plan</h2><ol className="itinerary-list">{draftItinerary.map(([time, label]) => <li key={label}><span className="time">{time}</span><span>{label}</span></li>)}</ol></aside>
            <aside className="checklist"><span className="eyebrow">PACKING LIST</span><h2>Don&rsquo;t forget…</h2>{packing.map((item) => <label key={item.id}><input type="checkbox" checked={item.checked} onChange={() => setPacking((current) => current.map((entry) => entry.id === item.id ? { ...entry, checked: !entry.checked } : entry))} /><span>{item.label}</span></label>)}</aside>
          </div>
        </div>
      </section>

      {activeTrip && activeZoo && <div className="trip-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveTripId(null); }}>
        <section className="trip-modal" role="dialog" aria-modal="true" aria-labelledby="trip-modal-title">
          <button className="trip-modal-close" onClick={() => setActiveTripId(null)} aria-label="Planning sluiten">×</button>
          <header className="trip-modal-header"><div className="trip-modal-animal"><ZooPhoto animal={activeZoo.animal} alt="" /></div><div><span className="eyebrow">GEPLAND DIERENUITJE</span><h2 id="trip-modal-title">{activeZoo.name}</h2><p>{formatPlannedDate(activeTrip.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · vertrek om {activeTrip.leave}</p></div></header>
          <div className={`trip-approval-banner ${activeTrip.approvalStatus || "approved"}`}>{activeTrip.approvalStatus === "pending" ? canRespondToActive ? <><span><b>{profileName(activeTrip.createdById)} heeft dit voorgesteld</b><small>Wil je dit samen plannen?</small></span><div><button onClick={() => onRespond(activeTrip.id, "declined")}>Liever niet</button><button className="approve" onClick={() => onRespond(activeTrip.id, "approved")}>Ja, leuk! ♥</button></div></> : <span><b>Voorstel verstuurd</b><small>Wacht op het antwoord van {profileName(activeTrip.requestedFromId)}.</small></span> : activeTrip.approvalStatus === "declined" ? <span><b>Dit voorstel is afgewezen</b><small>De maker kan het aanpassen en opnieuw voorstellen.</small></span> : <span><b>Samen afgesproken ✓</b><small>Dit uitje staat in jullie kalender.</small></span>}</div>
          <div className="trip-modal-facts"><span><small>Startpunt</small><strong>{activeTrip.start}</strong></span><span><small>Budget</small><strong>€{activeTrip.budget}</strong></span><span><small>Tickets</small><strong>{activeTrip.tickets === "ja" ? "Gekocht ✓" : "Nog kopen"}</strong></span></div>
          <div className="route-action-links trip-route-links"><a href={googleMapsDirectionsUrl(activeZoo)} target="_blank" rel="noreferrer">Route in Google Maps <span>↗</span></a><a href={wazeDirectionsUrl(activeZoo)} target="_blank" rel="noreferrer">Open in Waze <span>↗</span></a></div>
          {activeTrip.note && <p className="trip-modal-note">“{activeTrip.note}”</p>}
          <div className="trip-modal-grid">
            <div><span className="eyebrow">DAGPLANNING</span><h3>Dit gaan we doen</h3><ol className="itinerary-list">{tripItinerary(activeTrip, activeZoo).map(([time, label]) => <li key={label}><span className="time">{time}</span><span>{label}</span></li>)}</ol></div>
            <div><span className="eyebrow">PACKING LIST</span><h3>Klaar voor vertrek?</h3><div className="trip-modal-checklist">{activeTrip.packing.map((item) => <label key={item.id}><input type="checkbox" checked={item.checked} onChange={() => onTogglePacking(activeTrip.id, item.id)} /><span>{item.label}</span></label>)}</div></div>
          </div>
          <footer className="trip-modal-actions">
            {canManageActive && (confirmDelete ? <div className="trip-delete-confirm"><span>Deze planning verwijderen?</span><button onClick={() => setConfirmDelete(false)}>Nee</button><button className="danger" onClick={() => { onDelete(activeTrip.id); setActiveTripId(null); setConfirmDelete(false); }}>Ja, verwijderen</button></div> : <button className="trip-delete-button" onClick={() => setConfirmDelete(true)}>Verwijderen</button>)}
            {canManageActive && <button className="secondary" onClick={() => beginEditTrip(activeTrip)}>✎ Planning aanpassen</button>}
          </footer>
        </section>
      </div>}
    </>
  );
}

function Journey() {
  const visited = zoos.filter((z) => z.visited);
  const totalKm = visited.reduce((s, z) => s + z.distance, 0);
  const countries = new Set(visited.map((z) => z.country)).size;
  return (
    <>
      <PageIntro kicker="OUR WANDERED KILOMETERS" title="Journey map" text="Elke lijn is een date, ieder pinnetje een herinnering." animal="elephant" />
      <section className="map-card">
        <div className="legend legend-map">
          <span>
            <i className="dot dot-visited" /> Visited
          </span>
          <span>
            <i className="dot dot-planned" /> Planned
          </span>
          <span>
            <i className="dot dot-wishlist" /> Wishlist
          </span>
        </div>
        <div className="map-bg">
          <span className="map-label nl">NETHERLANDS</span>
          <span className="map-label be">BELGIUM</span>
          <span className="map-label de">GERMANY</span>
          <i className="route r1" />
          <i className="route r2" />
          <b className="pin p1">
            ♥<small>Arnhem</small>
          </b>
          <b className="pin p2">
            ♥<small>Kerkrade</small>
          </b>
          <b className="pin p3">
            ♥<small>Rotterdam</small>
          </b>
        </div>
        <div className="trip-stats">
          <div>
            <strong>{totalKm.toLocaleString("nl-NL")}</strong>
            <span>kilometers together</span>
          </div>
          <div>
            <strong>{countries}</strong>
            <span>countries explored</span>
          </div>
          <div>
            <strong>{visited.length}</strong>
            <span>wild dates</span>
          </div>
        </div>
      </section>
    </>
  );
}

const rankingTabs = [
  { key: "overall", label: "Beste totaal" },
  { key: "animals", label: "Beste dieren" },
  { key: "pretty", label: "Mooiste park" },
  { key: "food", label: "Beste eten" },
  { key: "date", label: "Beste date" },
  { key: "value", label: "Beste prijs-kwaliteit" },
] as const;
type RankKey = (typeof rankingTabs)[number]["key"];

const emptyScores: ReviewScores = { overall: 7.5, animals: 7.5, pretty: 7.5, food: 7.5, date: 7.5, value: 7.5 };

function Rankings({
  reviews,
  onSave,
  initialZooId,
  onReviewTargetHandled,
  places,
}: {
  reviews: ReviewMap;
  onSave: (review: UserReview) => void;
  initialZooId: string | null;
  onReviewTargetHandled: () => void;
  places: Zoo[];
}) {
  const [metric, setMetric] = useState<RankKey>("overall");
  const [editing, setEditing] = useState(false);
  const [zooId, setZooId] = useState(places[0].id);
  const [visitDate, setVisitDate] = useState("");
  const [note, setNote] = useState("");
  const [scores, setScores] = useState<ReviewScores>(emptyScores);
  const [savedMessage, setSavedMessage] = useState("");

  const loadReview = (id: string) => {
    const ownReview = reviews[id];
    setZooId(id);
    setVisitDate(ownReview?.visitDate || "");
    setNote(ownReview?.note || "");
    setScores(ownReview?.scores || emptyScores);
  };

  const beginReview = (id = zooId) => {
    loadReview(id);
    setSavedMessage("");
    setEditing(true);
    window.setTimeout(() => document.querySelector(".review-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  useEffect(() => {
    if (!initialZooId) return;
    beginReview(initialZooId);
    onReviewTargetHandled();
    // Dit effect hoort alleen te reageren op een nieuw doel vanuit een detailpagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialZooId]);

  const ranked = places
    .filter((zoo) => Boolean(reviews[zoo.id]))
    .map((zoo) => ({ zoo, scores: reviews[zoo.id].scores }))
    .sort((a, b) => b.scores[metric] - a.scores[metric]);

  const setScore = (key: RankKey, value: number) => setScores((current) => ({ ...current, [key]: value }));
  const submitReview = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentZoo = places.find((zoo) => zoo.id === zooId);
    if (!currentZoo) return;
    onSave({ zooId, visitDate, note: note.trim(), scores, updatedAt: new Date().toISOString() });
    setEditing(false);
    setSavedMessage(`Beoordeling van ${currentZoo.name} is opgeslagen ♥`);
  };

  return (
    <>
      <PageIntro kicker="ONZE OFFICIËLE LIJST" title="Zoo-ranglijst" text="Bloedserieus beoordeeld op dieren, sfeer, eten en dategevoel." animal="bear" />
      <section className="rankings-toolbar">
        <div>
          <strong>Jullie persoonlijke ranglijst</strong>
          <span>Voeg een beoordeling toe en de volgorde wordt meteen opnieuw berekend.</span>
        </div>
        <button className="review-add-button" onClick={() => beginReview()}>
          <span aria-hidden="true">＋</span> Beoordeling toevoegen
        </button>
      </section>
      {savedMessage && <p className="review-success" role="status">✓ {savedMessage}</p>}
      {editing && (
        <form className="review-form-card" onSubmit={submitReview}>
          <div className="review-form-heading">
            <div>
              <span className="eyebrow">JULLIE EIGEN BEOORDELING</span>
              <h2>Hoe was deze zoo date?</h2>
            </div>
            <button type="button" className="review-close" onClick={() => setEditing(false)} aria-label="Formulier sluiten">×</button>
          </div>
          <div className="review-form-grid">
            <div className="review-copy-fields">
              <label>
                Dierentuin
                <select value={zooId} onChange={(event) => loadReview(event.target.value)}>
                  {places.map((zoo) => <option key={zoo.id} value={zoo.id}>{zoo.name} · {zoo.city}</option>)}
                </select>
              </label>
              <label>
                Datum van jullie bezoek <small>(optioneel)</small>
                <input type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} />
              </label>
              <label>
                Wat vonden jullie ervan?
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={6} placeholder="Bijvoorbeeld: de rode panda's waren ons hoogtepunt..." />
              </label>
            </div>
            <fieldset className="rating-fields">
              <legend>Geef punten van 1 tot 10</legend>
              {rankingTabs.map((item) => (
                <label className="rating-control" key={item.key}>
                  <span>{item.label}</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={scores[item.key]}
                    onChange={(event) => setScore(item.key, Number(event.target.value))}
                  />
                  <output>{scores[item.key].toFixed(1)}</output>
                </label>
              ))}
            </fieldset>
          </div>
          <div className="review-form-actions">
            <button type="button" className="review-cancel" onClick={() => setEditing(false)}>Annuleren</button>
            <button type="submit" className="primary">Beoordeling opslaan ♥</button>
          </div>
        </form>
      )}
      <section className="rankings-tabs">
        {rankingTabs.map((t) => (
          <button key={t.key} className={metric === t.key ? "active" : ""} onClick={() => setMetric(t.key)}>
            {t.label}
          </button>
        ))}
      </section>
      <section className="ranking-list">
        {ranked.length === 0 && <div className="ranking-empty"><span>☆</span><h3>Nog geen beoordelingen</h3><p>Voeg na jullie eerste bezoek een beoordeling toe. Daarna ontstaat jullie ranglijst vanzelf.</p><button onClick={() => beginReview()}>＋ Eerste beoordeling toevoegen</button></div>}
        {ranked.map(({ zoo: z, scores: zooScores }, i) => {
          const ownReview = reviews[z.id];
          const displayNote = ownReview.note || "Geen notitie toegevoegd.";
          return (
          <article key={z.id} className="review-row">
            <b className="rank">{i + 1}</b>
            <span className="rank-animal">
              <ZooPhoto animal={z.animal} alt={z.name} />
            </span>
            <div>
              <small>{z.city}{ownReview ? " · jullie review" : ""}</small>
              <h3>{z.name}</h3>
              <p>{displayNote}</p>
            </div>
            <strong className="score">
              {zooScores[metric].toFixed(1)}
              <small>/ 10</small>
            </strong>
            <button className="rank-review-button" onClick={() => beginReview(z.id)}>{ownReview ? "Wijzig" : "Beoordeel"}</button>
          </article>
        )})}
      </section>
    </>
  );
}

function Memories({ memories, onSave, onDelete, places }: { memories: UserMemory[]; onSave: (memory: UserMemory) => Promise<boolean>; onDelete: (id: string) => void; places: Zoo[] }) {
  const [adding, setAdding] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<UserMemory | null>(null);
  const [zooId, setZooId] = useState(places[0].id);
  const [date, setDate] = useState("");
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!adding && !selectedMemory) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAdding(false);
      setSelectedMemory(null);
      setPendingDeleteId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [adding, selectedMemory]);

  const resetForm = () => {
    setEditingId(null); setZooId(places[0].id); setDate(""); setCaption(""); setNote(""); setImageDataUrl(undefined);
  };
  const openAddMemory = () => {
    resetForm(); setSelectedMemory(null); setStatus(""); setAdding(true);
  };
  const editMemory = (memory: UserMemory) => {
    setEditingId(memory.id); setZooId(memory.zooId); setDate(memory.date); setCaption(memory.caption); setNote(memory.note); setImageDataUrl(memory.imageDataUrl);
    setSelectedMemory(null); setPendingDeleteId(null); setStatus(""); setAdding(true);
  };
  const openMemory = (memory: UserMemory) => {
    setPendingDeleteId(null);
    setSelectedMemory(memory);
  };
  const openMemoryWithKeyboard = (event: React.KeyboardEvent<HTMLElement>, memory: UserMemory) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openMemory(memory);
  };
  const deleteMemoryFromCard = (memory: UserMemory) => {
    onDelete(memory.id);
    setPendingDeleteId(null);
    setSelectedMemory(null);
    setStatus("Herinnering verwijderd.");
  };

  const choosePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Kies alsjeblieft een afbeelding.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        setImageDataUrl(canvas.toDataURL("image/jpeg", 0.82));
        setStatus("");
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const submitMemory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const existing = editingId ? memories.find((memory) => memory.id === editingId) : undefined;
    const id = editingId || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `memory-${Date.now()}`);
    const wasEditing = Boolean(editingId);
    const saved = await onSave({ id, zooId, date, caption: caption.trim(), note: note.trim(), imageDataUrl, createdAt: existing?.createdAt || new Date().toISOString() });
    setSaving(false);
    if (!saved) {
      setStatus("Online opslaan is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
      return;
    }
    setAdding(false);
    resetForm();
    setStatus(wasEditing ? "Herinnering aangepast en online opgeslagen ♥" : "Herinnering online opgeslagen ♥");
  };

  return (
    <>
      <PageIntro kicker="ONS WILDE KLEINE ARCHIEF" title="Herinneringen" text="De momenten die we nooit kwijt willen." animal="flamingo" />
      <section className="memory-toolbar">
        <div><strong>Jullie eigen fotoalbum</strong><span>Bewaar een foto, datum en verhaal bij iedere dierendate.</span></div>
        <button onClick={openAddMemory}>＋ Herinnering toevoegen</button>
      </section>
      {status && <p className="memory-status" role="status">{status}</p>}
      {adding && (
        <div className="memory-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdding(false); }}>
          <form className="memory-form memory-modal" onSubmit={submitMemory} role="dialog" aria-modal="true" aria-labelledby="memory-form-title">
            <div className="memory-form-heading"><div><span className="eyebrow">{editingId ? "HERINNERING BEWERKEN" : "NIEUWE HERINNERING"}</span><h2 id="memory-form-title">{editingId ? "Pas jullie herinnering aan" : "Bewaar dit moment"}</h2></div><button type="button" onClick={() => setAdding(false)} aria-label="Sluiten" autoFocus>×</button></div>
            <div className="memory-form-grid">
              <label className="memory-upload">
                {imageDataUrl ? <img src={imageDataUrl} alt="Voorvertoning" /> : <><b>＋</b><strong>Kies een foto</strong><small>JPG, PNG of WebP</small></>}
                <input type="file" accept="image/*" onChange={choosePhoto} />
              </label>
              <div className="memory-fields">
                <label>Dierentuin<select value={zooId} onChange={(event) => setZooId(event.target.value)}>{places.map((zoo) => <option value={zoo.id} key={zoo.id}>{zoo.name}</option>)}</select></label>
                <label>Datum<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                <label>Titel<input required value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Bijvoorbeeld: Onze eerste rode panda" /></label>
                <label>Jullie verhaal<textarea required rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Wat maakte deze dag bijzonder?" /></label>
                <button className="primary" type="submit" disabled={saving}>{saving ? "Online opslaan…" : editingId ? "Wijzigingen opslaan ♥" : "Herinnering opslaan ♥"}</button>
              </div>
            </div>
          </form>
        </div>
      )}
      {selectedMemory && (
        <div className="memory-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMemory(null); }}>
          <section className="memory-reader memory-modal" role="dialog" aria-modal="true" aria-labelledby="memory-reader-title">
            <button className="memory-reader-close" onClick={() => setSelectedMemory(null)} aria-label="Memory sluiten" autoFocus>×</button>
            <div className="memory-reader-visual">
              {selectedMemory.imageDataUrl ? <img src={selectedMemory.imageDataUrl} alt={selectedMemory.caption} /> : <ZooPhoto animal={places.find((zoo) => zoo.id === selectedMemory.zooId)?.animal || "redpanda"} alt={selectedMemory.caption} />}
            </div>
            <div className="memory-reader-copy">
              <span className="eyebrow">{places.find((zoo) => zoo.id === selectedMemory.zooId)?.name} · {selectedMemory.date || "Datum onbekend"}</span>
              <h2 id="memory-reader-title">{selectedMemory.caption}</h2><p>{selectedMemory.note}</p>
            </div>
          </section>
        </div>
      )}
      <section className="memory-grid">
        {memories.map((memory, i) => {
          const zoo = places.find((item) => item.id === memory.zooId) || places[0];
          return <article className={`memory memory-clickable m${i % 4}`} key={memory.id} role="button" tabIndex={0} aria-label={`Open herinnering ${memory.caption}`} onClick={() => openMemory(memory)} onKeyDown={(event) => openMemoryWithKeyboard(event, memory)}>
            <span className="memory-card-tools" onClick={(event) => event.stopPropagation()}>
              <button onClick={() => editMemory(memory)} aria-label={`Bewerk ${memory.caption}`} title="Bewerken">✎</button>
              <button className="delete" onClick={() => setPendingDeleteId(memory.id)} aria-label={`Verwijder ${memory.caption}`} title="Verwijderen">×</button>
            </span>
            {pendingDeleteId === memory.id && <span className="memory-card-confirm" onClick={(event) => event.stopPropagation()}>
              <strong>Herinnering verwijderen?</strong><span>Dit kun je niet terugdraaien.</span>
              <span className="memory-card-confirm-actions"><button onClick={() => setPendingDeleteId(null)}>Nee</button><button className="danger" onClick={() => deleteMemoryFromCard(memory)}>Ja, verwijderen</button></span>
            </span>}
            <div>{memory.imageDataUrl ? <img className="memory-user-photo" src={memory.imageDataUrl} alt={memory.caption} /> : <ZooPhoto animal={zoo.animal} alt={memory.caption} />}</div>
            <small>{zoo.name} · {memory.date || "datum onbekend"}</small>
            <h3>{memory.caption}</h3><p>{memory.note}</p>
            <span className="memory-open-hint">Bekijk herinnering →</span>
          </article>;
        })}
        <button className="add-memory" onClick={openAddMemory}>
          <b>＋</b>
          <strong>Herinnering toevoegen</strong>
          <span>Foto&rsquo;s en jullie beoordeling</span>
        </button>
      </section>
    </>
  );
}

function Nav({ view, go }: { view: View; go: (v: View) => void }) {
  const items: [View, string, string][] = [
    ["home", "home", "Start"],
    ["explore", "paw", "Ontdek"],
    ["planner", "calendar", "Plannen"],
    ["journey", "map", "Kaart"],
    ["memories", "camera", "Herinneringen"],
  ];
  return (
    <nav className="bottom-nav" aria-label="Hoofdnavigatie">
      {items.map(([v, i, l]) => (
        <button
          key={v}
          aria-current={view === v || (view === "detail" && v === "explore") ? "page" : undefined}
          aria-label={l}
          className={`${view === v || (view === "detail" && v === "explore") ? "active" : ""} ${v === "planner" ? "plan" : ""}`}
          onClick={() => go(v)}
        >
          <UiIcon name={i} />
          <span className="nav-label">{l}</span>
        </button>
      ))}
    </nav>
  );
}
