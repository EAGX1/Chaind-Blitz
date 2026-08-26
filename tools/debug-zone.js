import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.stack || e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });
await page.addInitScript(() => { window.__CB_FAST = true; });
await page.goto("http://localhost:8765/");
await page.waitForTimeout(500);

await page.click("#btn-quick-duel");
await page.waitForTimeout(1200);

// wait for our M1
for (let i = 0; i < 40; i++) {
  const st = await page.evaluate(() => ({ tp: window.__CB.currentG?.tp, phase: window.__CB.currentG?.phase }));
  if (st.tp === 0 && st.phase === "M1") break;
  await page.waitForTimeout(400);
}

// pass phases until we have a selectable monster in hand during our M1
let clicked = false;
for (let t = 0; t < 8 && !clicked; t++) {
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(() => ({ tp: window.__CB.currentG?.tp, phase: window.__CB.currentG?.phase, over: window.__CB.currentG?.over }));
    if (st.over) break;
    if (st.tp === 0 && st.phase === "M1") break;
    await page.waitForTimeout(300);
  }
  const handCards = page.locator("#hand-0 .cb-card.selectable:not(.spell)");
  const n = await handCards.count();
  console.log(`M1 check: selectable monsters = ${n}`);
  if (n > 0) {
    await handCards.first().click();
    await page.waitForTimeout(300);
    clicked = true;
    break;
  }
  // end M1, then end battle when prompted
  const endM1 = page.locator("#prompt-options button", { hasText: "END M1" });
  if (await endM1.count()) { await endM1.first().click(); await page.waitForTimeout(400); }
  const endBp = page.locator("#prompt-options button", { hasText: "END BATTLE" });
  if (await endBp.count()) { await endBp.first().click(); await page.waitForTimeout(400); }
  const endM2 = page.locator("#prompt-options button", { hasText: "END M2" });
  if (await endM2.count()) { await endM2.first().click(); await page.waitForTimeout(400); }
}
if (!clicked) { console.log("could never summon — FAIL"); process.exit(1); }

// click the Summon action
const summonBtn = page.locator("#prompt-options button", { hasText: "Summon" });
await summonBtn.first().click();
await page.waitForTimeout(300);

// zone picker should be up
const title = await page.locator("#prompt-title").textContent();
const pickables = await page.locator(".zone.zone-selectable").count();
console.log(`picker title: "${title}" | selectable zones: ${pickables}`);

// click zone index 4 (5th slot)
await page.locator('[data-zone="mz-0-4"]').click();
await page.waitForTimeout(600);

const placed = await page.evaluate(() => {
  const G = window.__CB.currentG;
  const c = G.players[0].mz[4];
  return { mz4: c ? c.id : null, promptHidden: document.getElementById("prompt").classList.contains("hidden") };
});
console.log("RESULT:", JSON.stringify(placed));
console.log(placed.mz4 ? "PASS: monster summoned into chosen zone 4" : "FAIL: zone choice ignored");
await browser.close();
