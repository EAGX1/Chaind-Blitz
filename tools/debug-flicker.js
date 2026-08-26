import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.stack || e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });
await page.addInitScript(() => { window.__CB_FAST = true; });
await page.goto("http://localhost:8765/");
await page.waitForTimeout(500);

await page.click("#btn-quick-duel");
await page.waitForTimeout(600);
await page.click("#btn-auto"); // let the AI pilot both sides at max speed

// wait for any monster to be on either field
let uid = null, side = 0;
for (let i = 0; i < 60 && !uid; i++) {
  const found = await page.evaluate(() => {
    for (const p of [0, 1]) {
      const el = document.querySelector(`#mz-${p} .cb-card`);
      if (el) return { uid: el.dataset.uid, p };
    }
    return null;
  });
  if (found) { uid = found.uid; side = found.p; }
  else await page.waitForTimeout(400);
}
if (!uid) { console.log("NO MONSTER APPEARED — cannot test flicker"); process.exit(1); }
console.log(`watching card uid=${uid} on mz-${side}`);

// sample element identity over 6 seconds of live play
let recreated = 0, lastEl = null;
for (let i = 0; i < 12; i++) {
  const handle = await page.$(`#mz-${side} [data-uid="${uid}"]`);
  if (!handle) { console.log("card left the field (destroyed) — flicker window passed"); break; }
  if (lastEl) {
    const same = await page.evaluate(([a, b]) => a === b, [lastEl, handle]);
    if (!same) recreated++;
  }
  lastEl = handle;
  await page.waitForTimeout(500);
}
console.log(recreated === 0 ? "PASS: element persisted (no flicker)" : `FAIL: element recreated ${recreated}x`);
await browser.close();
