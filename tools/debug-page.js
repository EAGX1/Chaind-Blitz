import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.stack || e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });
await page.addInitScript(() => { window.__CB_FAST = true; });
await page.goto("http://localhost:8765/");
await page.waitForTimeout(2500);
const hasCB = await page.evaluate(() => typeof window.__CB);
console.log("__CB:", hasCB);
await browser.close();
