import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.stack || e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });
await page.addInitScript(() => { window.__CB_FAST = true; });
await page.goto("http://localhost:8765/");
await page.waitForTimeout(600);

// start a PvE duel as the HUMAN (no AUTO)
await page.click("#btn-quick-duel");
await page.waitForTimeout(1500);
// dismiss the first-duel hint overlay if present
if (await page.locator("#hint-got-it").isVisible().catch(() => false)) {
  await page.click("#hint-got-it");
  await page.waitForTimeout(300);
}

const state = async () => page.evaluate(() => {
  const G = window.__CB.currentG;
  return {
    phase: G?.phase, turn: G?.turnCount, tp: G?.tp,
    hand: G?.players[0].hand.map((c) => c.id),
    prompt: document.getElementById("prompt")?.classList.contains("hidden") ? "hidden" : document.getElementById("prompt-title")?.textContent,
    options: [...document.querySelectorAll("#prompt-options button")].map((b) => b.textContent)
  };
});

console.log("TURN1:", JSON.stringify(await state()));
// if AI goes first, wait for our turn
for (let i = 0; i < 30; i++) {
  const s = await state();
  if (s.tp === 0 && s.phase === "M1") break;
  await page.waitForTimeout(500);
}
const s1 = await state();
console.log("OUR M1:", JSON.stringify(s1));

// click each hand card, report which ones yield actions
const handCards = page.locator("#hand-0 .cb-card");
const n = await handCards.count();
console.log("hand cards rendered:", n);
for (let i = 0; i < n; i++) {
  const id = await handCards.nth(i).getAttribute("data-card-id");
  const cls = await handCards.nth(i).getAttribute("class");
  await handCards.nth(i).click();
  await page.waitForTimeout(300);
  const s = await state();
  console.log(`click[${i}] ${id} class="${cls}" -> title: "${s.prompt}" options: ${JSON.stringify(s.options)}`);
  if (s.options.length > 1) {
    // take the first action (e.g. SUMMON)
    await page.locator("#prompt-options button").first().click();
    await page.waitForTimeout(500);
    const mz = await page.evaluate(() => window.__CB.currentG.players[0].mz.filter(Boolean).map((c) => c.id));
    console.log("FIELD AFTER ACTION:", JSON.stringify(mz));
    break;
  }
}

// try the phase orb to pass
await page.click("#phase-orb");
await page.waitForTimeout(600);
console.log("AFTER ORB:", JSON.stringify(await state()));

await browser.close();
console.log("done");
