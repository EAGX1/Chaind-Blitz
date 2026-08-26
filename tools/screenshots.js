import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

mkdirSync("shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto("http://localhost:8765/");
await page.waitForTimeout(800);
await page.screenshot({ path: "shots/01-hub-play.png" });

await page.click('[data-tab="collection"]');
await page.waitForTimeout(400);
await page.screenshot({ path: "shots/02-collection.png" });

await page.click('[data-tab="rogue"]');
await page.click("#btn-run-start").catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: "shots/03-rogue-map.png" });

await page.click('[data-tab="modes"]');
await page.waitForTimeout(300);
await page.click('[data-mode="brawl"]');
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/04-modes-brawl.png" });

await page.click('[data-tab="rulebook"]');
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/05-rulebook.png", fullPage: true });

// duel: AI vs AI spectate to catch mid-game board + maybe a lane reveal
await page.click('[data-tab="play"]');
await page.selectOption("#ava-a", "ignis");
await page.selectOption("#ava-b", "abyss");
await page.click("#btn-ava");
await page.waitForTimeout(3500);
await page.screenshot({ path: "shots/06-duel-early.png" });
await page.waitForTimeout(9000);
await page.screenshot({ path: "shots/07-duel-mid.png" });

await browser.close();
console.log("done");
