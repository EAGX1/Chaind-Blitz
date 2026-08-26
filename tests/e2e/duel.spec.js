// E2E: full duels in a real browser with zero console errors.
import { test, expect } from "@playwright/test";
import { classicHubInit } from "./boot.js";

function watchErrors(page, errors) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(classicHubInit());
});

test("PvE duel completes via AUTO mode with no errors", async ({ page }) => {
  const errors = [];
  watchErrors(page, errors);
  await page.goto("/");
  await page.click("#btn-quick-duel");
  await expect(page.locator("#screen-duel")).toBeVisible();
  await expect(page.locator("#mz-0 .zone")).toHaveCount(6);
  await expect(page.locator("#stz-1 .zone")).toHaveCount(6);
  await expect(page.locator("#lanes .lane")).toHaveCount(3);
  await page.click("#btn-auto");
  await expect(page.locator("#gameover")).toBeVisible({ timeout: 120000 });
  const title = await page.locator("#go-title").textContent();
  expect(["VICTORY", "DEFEAT", "DRAW"]).toContain(title);
  expect(errors).toEqual([]);
});

test("AI vs AI spectate completes with no errors", async ({ page }) => {
  const errors = [];
  watchErrors(page, errors);
  await page.goto("/");
  await page.click("#btn-ava");
  await expect(page.locator("#screen-duel")).toBeVisible();
  await expect(page.locator("#gameover")).toBeVisible({ timeout: 120000 });
  expect(errors).toEqual([]);
});

test("hub renders and lanes/hud are present", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand h1")).toHaveText("CHAIND BLITZ");
  await page.click("#btn-quick-duel");
  await expect(page.locator("#hud-0")).toBeVisible();
  await expect(page.locator("#orb-phase")).not.toBeEmpty();
  await expect(page.locator("#lanes .lane").first()).toBeVisible();
});

test("plaza PLAY dock reaches the play screen from city mode", async ({ page }) => {
  await page.addInitScript(() => {
    window.__CB_FAST = true;
    localStorage.setItem("chaind-blitz-settings-v1", JSON.stringify({
      classicHub: false, music: 0, sfx: 0, chainMode: "off", uiScale: 1
    }));
  });
  await page.goto("/");
  await page.locator(".city-dock-btn", { hasText: "PLAY" }).click();
  await expect(page.locator("#btn-quick-duel")).toBeVisible();
});
