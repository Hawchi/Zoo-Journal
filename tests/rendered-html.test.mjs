import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Zoo Journal account entry", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Ons Zoo Dagboek<\/title>/i);
  assert.match(html, /Jullie dagboek wordt geopend/);
  assert.match(html, /couple-access/);
  assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon-v2\.png"/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});

test("keeps account and shared-plan storage wired to the site", async () => {
  const [page, account, coupleApi, plansApi, hosting, schema, migrations] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CoupleAccount.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/couple/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/plans/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readdir(new URL("../drizzle/", import.meta.url)),
  ]);
  assert.match(page, /incomingRequestCount/);
  assert.match(page, /respondToTrip/);
  assert.match(account, /TWEEDE ACCOUNT/);
  assert.match(coupleApi, /invite_code/);
  assert.match(plansApi, /approval_status/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(schema, /sharedTrips/);
  assert.ok(migrations.some((file) => file.endsWith(".sql")));
});

test("stores the shared journal and memory photos online", async () => {
  const [page, journalApi, journalDb, mediaApi, hosting, schema, migrations] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/journal/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_shared/journal-db.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_normal_bullseye.sql", import.meta.url), "utf8"),
  ]);
  assert.match(page, /DATABASE_MIGRATION_KEY/);
  assert.match(page, /loadSharedJournal/);
  assert.match(journalApi, /requireMember/);
  assert.match(journalDb, /shared_place_states/);
  assert.match(journalDb, /shared_reviews/);
  assert.match(journalDb, /shared_memories/);
  assert.match(journalDb, /shared_custom_places/);
  assert.match(journalDb, /mediaBucket\(\)\.put/);
  assert.match(mediaApi, /Cache-Control/);
  assert.match(hosting, /"r2": "MEDIA"/);
  assert.match(schema, /sharedMemories/);
  assert.match(migrations, /CREATE TABLE `shared_memories`/);
});

test("keeps zoos, animal parks and petting zoos in separate filters", async () => {
  const [page, places, map] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/place-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/map.html", import.meta.url), "utf8"),
  ]);
  assert.match(places, /kinderboerderij/);
  assert.match(places, /repairAnimalPlaceCategory/);
  assert.match(page, /\.map\(repairAnimalPlaceCategory\)/);
  assert.match(map, /data-kind="animal-park">Dierenparken/);
  assert.match(map, /activeKind==='all'\|\|place\.category===activeKind/);
  assert.doesNotMatch(map, /activeKind==='zoo'&&place\.category==='animal-park'/);
});

test("preloads and progressively reveals the complete animal-place list", async () => {
  const [page, places, placesApi, appCss, plannerCss] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/place-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/places/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/app.css", import.meta.url), "utf8"),
    readFile(new URL("../app/planner.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /\["ready", "demo"\]\.includes\(accountMode\)/);
  assert.match(page, /DISCOVERED_PLACES_REFRESHED_KEY/);
  assert.match(page, /IntersectionObserver/);
  assert.doesNotMatch(page, /Meer dierenplekken tonen/);
  assert.match(places, /fetch\("\/api\/places"/);
  assert.match(placesApi, /s-maxage=86400/);
  assert.doesNotMatch(appCss, /overflow-wrap:anywhere/);
  assert.match(plannerCss, /font-size:clamp\(25px,7vw,30px\)/);
});

test("loads an official price when a map marker is opened", async () => {
  const [page, map] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/map.html", import.meta.url), "utf8"),
  ]);
  assert.match(page, /website: place\.website/);
  assert.match(map, /\/api\/prices\?zooId=/);
  assert.match(map, /popupopen/);
  assert.match(map, /Actuele prijs ophalen/);
  assert.match(map, /geen gegokt bedrag/);
});

test("shows a live official price and verified Social Deal in the zoo hero", async () => {
  const [detail, hero, deals] = await Promise.all([
    readFile(new URL("../app/components/ZooDetail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ZooHeroPrice.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/deals/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(detail, /<ZooHeroPrice zoo=\{zoo\}/);
  assert.match(hero, /PRIJS VOOR MORGEN/);
  assert.match(hero, /SOCIAL DEAL/);
  assert.match(deals, /status: "none"/);
  assert.match(deals, /Cache-Control.*no-store/);
});

test("shows sourced animal lists and matching species photos", async () => {
  const [detail, enrichment, animalsApi] = await Promise.all([
    readFile(new URL("../app/components/ZooDetail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/place-enrichment.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/animals/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(detail, /GECONTROLEERD VIA OFFICIËLE WEBSITE/);
  assert.match(detail, /Toon alle \$\{filteredAnimalNames\.length\} dieren/);
  assert.match(detail, /Soortfoto van/);
  assert.match(enrichment, /wikipedia\.org\/w\/api\.php/);
  assert.match(enrichment, /loadOfficialAnimalIndex/);
  assert.match(animalsApi, /gaiazoo\.nl\/dieren/);
  assert.match(animalsApi, /zoo-leipzig\.de\/tiere-erlebniswelten\/tierlexikon/);
  assert.match(animalsApi, /Daarom verzint het dagboek geen dieren/);
});

test("publishes the red panda as the Apple home-screen icon", async () => {
  const [layout, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /apple-touch-icon-v2\.png/);
  assert.match(layout, /apple-touch-icon-precomposed/);
  assert.match(manifest, /app-icon-192-v2\.png/);
  assert.match(manifest, /app-icon-512-v2\.png/);
  assert.match(serviceWorker, /zoo-journal-v13/);
  assert.match(serviceWorker, /apple-touch-icon-v2\.png/);
});
