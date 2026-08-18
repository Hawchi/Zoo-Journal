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
