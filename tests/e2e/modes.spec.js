// E2E: game modes — draft flow, brawl modifier, highlander, tournament, sealed.
import { test, expect } from "@playwright/test";
import { classicHubInit } from "./boot.js";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(classicHubInit());
});

test("draft: 40 picks build a deck, gauntlet duel resolves, state persists", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__CB?.hub);
  await page.click('[data-tab="modes"]');
  await page.click("#btn-draft-start");

  // make all 40 picks
  for (let i = 0; i < 40; i++) {
    await expect(page.locator("#draft-choice-0")).toBeVisible();
    await page.click("#draft-choice-0");
  }
  await expect(page.locator("#btn-gauntlet-play")).toBeVisible();
  const deckN = await page.evaluate(() => window.__CB.profile.modes.draft.picks.length);
  expect(deckN).toBe(40);

  // play gauntlet round 1 via AUTO
  await page.click("#btn-gauntlet-play");
  await expect(page.locator("#screen-duel")).toBeVisible();
  await page.click("#btn-auto");
  await expect(page.locator("#gameover")).toBeVisible({ timeout: 120000 });
  await page.click("#btn-go-hub");
  await page.click('[data-tab="modes"]');

  const st = await page.evaluate(() => window.__CB.profile.modes.draft);
  expect(st.round).toBe(1);
  // persistence across reload
  await page.reload();
  await page.waitForFunction(() => !!window.__CB?.hub);
  const st2 = await page.evaluate(() => window.__CB.profile.modes.draft);
  expect(st2.round).toBe(1);
  expect(st2.picks.length).toBe(40);
  expect(errors).toEqual([]);
});

test("tavern brawl: weekly modifier applies to the duel", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__CB?.hub);
  await page.click('[data-tab="modes"]');
  await page.click('[data-mode="brawl"]');
  await page.click("#btn-brawl-start");
  await expect(page.locator("#screen-duel")).toBeVisible();
  // verify the active brawl actually changed the opening state
  const check = await page.evaluate(() => {
    const G = window.__CB.currentG;
    if (!G) return null;
    return {
      lp: G.players.map((p) => p.lp),
      ep: G.players.map((p) => p.ep),
      lanes: G.lanes.map((l) => l.revealed),
      decks: G.players.map((p) => p.deck.length)
    };
  });
  const brawlId = await page.evaluate(() => window.__CB.activeBrawl);
  if (check) {
    if (brawlId === "sudden_death") expect(check.lp).toEqual([10, 10]);
    else if (brawlId === "mana_surge") expect(check.ep[0]).toBeGreaterThanOrEqual(3);
    else if (brawlId === "landslide") expect(check.lanes).toEqual([true, true, true]);
    else if (brawlId === "evolutionary_war") expect(check.ep).toEqual([4, 4]);
  }
  await page.click("#btn-auto");
  await expect(page.locator("#gameover")).toBeVisible({ timeout: 120000 });
  await page.click("#btn-go-hub");
  expect(errors).toEqual([]);
});

test("tournament: bracket starts, match resolves, result persists", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__CB?.hub);
  await page.click('[data-tab="modes"]');
  await page.click('[data-mode="tourney"]');
  await page.click("#btn-tourney-start");
  await page.click("#btn-tourney-play");
  await expect(page.locator("#screen-duel")).toBeVisible();
  await page.click("#btn-auto");
  await expect(page.locator("#gameover")).toBeVisible({ timeout: 120000 });
  await page.click("#btn-go-hub");
  const t = await page.evaluate(() => window.__CB.profile.modes.tourney);
  expect(t.round === 1 || t.alive === false).toBe(true);
  expect(errors).toEqual([]);
});

test("sealed: open packs and pool renders; highlander duel starts", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__CB?.hub);
  await page.click('[data-tab="modes"]');
  await page.click('[data-mode="sealed"]');
  await page.click("#btn-sealed-open");
  await expect(page.locator("#sealed-pool-grid .cb-card").first()).toBeVisible();
  const poolN = await page.evaluate(() => window.__CB.profile.modes.sealed.pool.length);
  expect(poolN).toBe(36);

  await page.click('[data-mode="highlander"]');
  await page.click("#btn-hl-start");
  await expect(page.locator("#screen-duel")).toBeVisible();
  // decks are singleton
  const singleton = await page.evaluate(() => {
    const G = window.__CB.currentG;
    if (!G) return true;
    return G.players.every((p) => {
      const ids = p.deck.map((c) => c.id);
      return new Set(ids).size === ids.length;
    });
  });
  expect(singleton).toBe(true);
  await page.click("#btn-auto");
  await expect(page.locator("#gameover")).toBeVisible({ timeout: 120000 });
  expect(errors).toEqual([]);
});
