import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.stack || e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });
await page.addInitScript(() => { window.__CB_FAST = true; });
await page.goto("http://localhost:8765/");
await page.evaluate(() => { window.__CB.profile.dust.N = 30; });
await page.click("#tab-collect");
const info = await page.evaluate(() => {
  const el = document.querySelector('[data-card-id="chrono_mite"]');
  const wrap = el?.closest(".card-wrap");
  const btns = [...(wrap?.querySelectorAll("button") || [])].map((b) => ({ text: b.textContent, disabled: b.disabled }));
  return { dust: window.__CB.profile.dust.N, btns };
});
console.log(JSON.stringify(info));
await browser.close();
