// E2E: roguelike run — start, battle node, AUTO duel, spoils, persistence.
import { test, expect } from "@playwright/test";
import { classicHubInit } from "./boot.js";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(classicHubInit());
});

test("roguelike run: start -> battle -> reward -> map advances -> survives reload", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");

  // start a run from the PLAY tab
  await page.click("#btn-rogue");
  await expect(page.locator(".rogue-map")).toBeVisible();
  const run0 = await page.evaluate(() => ({
    hp: window.__CB.profile.rogue.hp,
    deck: window.__CB.profile.rogue.deck.length,
    open: document.querySelectorAll(".rogue-node.open").length
  }));
  expect(run0.hp).toBe(20);
  expect(run0.deck).toBe(20);
  expect(run0.open).toBeGreaterThan(0);

  // enter the first open battle node
  await page.locator(".rogue-node.open").first().click();
  await expect(page.locator("#screen-duel")).toBeVisible();
  // LP persists at run HP (20) for the runner
  await page.click("#btn-auto");
  await expect(page.locator("#gameover")).toBeVisible({ timeout: 120000 });
  await page.click("#btn-go-hub");

  const after = await page.evaluate(() => {
    const r = window.__CB.profile.rogue;
    return r ? { over: false, pending: !!r.pendingReward || !!r.pendingRelic, hp: r.hp, floor: r.floor }
             : { over: true };
  });

  if (!after.over) {
    // won: spoils screen (card and/or relic) must be claimable, then map returns
    if (await page.locator("#run-reward-grid").isVisible()) {
      await page.locator("#reward-pick-0").click();
    }
    if (await page.locator("#run-relic-grid").isVisible()) {
      await page.locator("#relic-pick-0").click();
    }
    await expect(page.locator(".rogue-map")).toBeVisible();
    expect(after.floor).toBe(1);
    expect(after.hp).toBeGreaterThan(0);
    // deck grew if a card was picked
    const deckN = await page.evaluate(() => window.__CB.profile.rogue.deck.length);
    expect(deckN).toBeGreaterThanOrEqual(20);

    // persistence across reload
    await page.reload();
    const persisted = await page.evaluate(() => ({
      hasRun: !!window.__CB.profile.rogue,
      floor: window.__CB.profile.rogue?.floor,
      hp: window.__CB.profile.rogue?.hp
    }));
    expect(persisted.hasRun).toBe(true);
    expect(persisted.floor).toBe(1);
    expect(persisted.hp).toBe(after.hp);
    // RUN tab renders the map again after reload
    await page.click('[data-tab="rogue"]');
    await expect(page.locator(".rogue-map")).toBeVisible();
  } else {
    // lost the duel: run claimed, profile.rogue cleared, start screen back
    await expect(page.locator("#btn-run-start")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("roguelike: rest site heals through the UI", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  // start a run, force-open a rest node via the save, then use the UI
  await page.click("#btn-rogue");
  await expect(page.locator(".rogue-map")).toBeVisible();
  await page.evaluate(() => {
    const { profile, save } = window.__CB;
    const run = profile.rogue;
    run.hp = 10;
    const rest = run.map.flat().find((n) => n.type === "rest");
    rest.state = "open";
    save();
  });
  await page.click('[data-tab="rogue"]');
  await page.locator(".rogue-node.open.rest").first().click();
  await expect(page.locator("#btn-rest-heal")).toBeVisible();
  await page.click("#btn-rest-heal");
  const hp = await page.evaluate(() => window.__CB.profile.rogue.hp);
  expect(hp).toBe(16);
  expect(errors).toEqual([]);
});
