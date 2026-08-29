// E2E: the flows unit tests can't see — contact fusion click-through,
// first-duel teach highlight, and the deck editor save round-trip.
import { test, expect } from "@playwright/test";
import { classicHubInit } from "./boot.js";

function watchErrors(page, errors) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
}

async function keepHandIfAsked(page) {
  const keep = page.getByRole("button", { name: /KEEP HAND/i });
  await keep.click({ timeout: 6000 }).catch(() => {});
}

async function waitForCb(page) {
  await page.waitForFunction(() => !!window.__CB?.hub && typeof window.__CB?.startGateDuel === "function");
}

test("contact fusion clicks through from the labs board", async ({ page }) => {
  const errors = [];
  watchErrors(page, errors);
  await page.addInitScript(classicHubInit());
  await page.goto("/");
  await waitForCb(page);
  await page.evaluate(() => window.__CB.startGateDuel("labs_contact"));
  await expect(page.locator("#screen-duel")).toBeVisible();
  await keepHandIfAsked(page);
  const fuseBtn = page.getByRole("button", { name: /Contact Fusion Pyre Wyrm/i });
  await expect(fuseBtn).toBeVisible({ timeout: 20000 });
  await fuseBtn.click();
  const zone = page.locator('[data-zone="mz-0-2"]');
  await zone.click({ timeout: 8000 }).catch(() => {});
  await expect(page.locator("#duel-log")).toContainText("Pyre Wyrm", { timeout: 20000 });
  const fused = await page.evaluate(() =>
    window.__CB.currentG?.players?.[0]?.mz?.some((c) => c && c.id === "fusion_pyre_wyrm"));
  expect(fused).toBe(true);
  expect(errors).toEqual([]);
});

test("first duel highlights the next teaching click", async ({ page }) => {
  const errors = [];
  watchErrors(page, errors);
  await page.addInitScript(() => {
    // Fresh profile, real pacing (no __CB_FAST) so the teach duel arms.
    localStorage.setItem("chaind-blitz-settings-v1", JSON.stringify({
      classicHub: true, music: 0, sfx: 0, chainMode: "off", uiScale: 1, board3d: false
    }));
  });
  await page.goto("/");
  const ignis = page.getByRole("button", { name: /Ignis Rush/i });
  await ignis.click({ timeout: 10000 }).catch(() => {});
  await page.click("#btn-quick-duel");
  await expect(page.locator("#screen-duel")).toBeVisible();
  await keepHandIfAsked(page);
  await expect(page.locator(".teach-next").first()).toBeVisible({ timeout: 20000 });
  expect(errors).toEqual([]);
});

test("deck editor saves a starter copy that appears in PLAY", async ({ page }) => {
  const errors = [];
  watchErrors(page, errors);
  await page.addInitScript(classicHubInit());
  await page.goto("/");
  await waitForCb(page);
  await page.click('[data-tab="deck"]');
  await expect(page.locator("#deck-load")).toBeVisible({ timeout: 10000 });
  await page.selectOption("#deck-load", "starter:ignis");
  await page.fill("#deck-name", "E2E Ignis Copy");
  await page.click("#deck-save");
  await expect(page.locator("#deck-status")).toContainText("Saved", { timeout: 10000 });
  const saved = await page.evaluate(() => {
    const d = window.__CB.profile?.decks?.["E2E Ignis Copy"];
    return d ? d.main.length : 0;
  });
  expect(saved).toBe(40);
  expect(errors).toEqual([]);
});
