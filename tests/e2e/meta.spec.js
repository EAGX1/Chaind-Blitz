// E2E: meta systems in the browser — shop, ranked LP, save persistence.
import { test, expect } from "@playwright/test";
import { classicHubInit } from "./boot.js";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(classicHubInit());
});

test("profile persists across reload and shop spends gems", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__CB?.profile);
  const gemsBefore = await page.evaluate(() => window.__CB.profile.gems);
  expect(gemsBefore).toBeGreaterThan(0);

  // open a pack in the shop
  await page.click('[data-tab="shop"]');
  await page.click("#btn-pack");
  await expect(page.locator("#pack-reveal .pack-slam-card")).toHaveCount(10, { timeout: 5000 });
  const gemsAfter = await page.evaluate(() => window.__CB.profile.gems);
  expect(gemsAfter).toBe(gemsBefore - 100);

  // collection gained cards; profile survives reload
  await page.click('[data-tab="collection"]');
  await page.reload();
  await page.waitForFunction(() => !!window.__CB?.profile);
  const gemsReloaded = await page.evaluate(() => window.__CB.profile.gems);
  expect(gemsReloaded).toBe(gemsAfter);
  expect(errors).toEqual([]);
});

test("ranked duel applies LP and persists", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__CB?.profile);
  await page.click('[data-tab="ranked"]');
  await page.click("#btn-queue");
  await expect(page.locator("#screen-duel")).toBeVisible();
  await page.click("#btn-auto");
  await expect(page.locator("#gameover")).toBeVisible({ timeout: 120000 });
  const reason = await page.locator("#go-reason").textContent();
  expect(reason).toMatch(/LP|gems/);
  const rankState = await page.evaluate(() => JSON.stringify(window.__CB.profile.rank));
  await page.reload();
  await page.waitForFunction(() => !!window.__CB?.profile);
  const rankReloaded = await page.evaluate(() => JSON.stringify(window.__CB.profile.rank));
  expect(rankReloaded).toBe(rankState);
});

test("crafting a card updates dust and collection", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__CB?.profile);
  await page.evaluate(() => {
    window.__CB.profile.dust.N = 30;
    window.__CB.save();
  });
  await page.click('[data-tab="collection"]');
  await page.uncheck("#col-owned");
  const ownedBefore = await page.evaluate(() => window.__CB.profile.collection["chrono_mite"] || 0);
  // find chrono_mite's craft button: search card wraps by dataset cardId
  const btn = page.locator(".card-wrap", { has: page.locator('[data-card-id="chrono_mite"]') }).locator("button", { hasText: "CRAFT" });
  await expect(btn).toBeEnabled();
  await btn.click();
  const state = await page.evaluate(() => ({
    dust: window.__CB.profile.dust.N,
    owned: window.__CB.profile.collection["chrono_mite"] || 0
  }));
  expect(state.dust).toBe(0);
  expect(state.owned).toBe(ownedBefore + 1);
});
