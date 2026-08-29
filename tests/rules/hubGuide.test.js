import { describe, it, expect } from "vitest";
import { HUB_TAB_GUIDE, hubGuideLine } from "../../src/ui/hubGuide.js";

const HUB_TABS = ["play", "deck", "collection", "shop", "ranked", "rogue", "modes", "rulebook"];

describe("hub tab guide", () => {
  it("has a line for every hub tab", () => {
    expect(Object.keys(HUB_TAB_GUIDE).sort()).toEqual([...HUB_TABS].sort());
  });

  it("each line names the tab so the menu explains itself", () => {
    expect(HUB_TAB_GUIDE.play).toMatch(/^PLAY —/);
    expect(HUB_TAB_GUIDE.deck).toMatch(/^DECK —/);
    expect(HUB_TAB_GUIDE.collection).toMatch(/^CARDS —/);
    expect(HUB_TAB_GUIDE.shop).toMatch(/^SHOP —/);
    expect(HUB_TAB_GUIDE.ranked).toMatch(/^RANK —/);
    expect(HUB_TAB_GUIDE.rogue).toMatch(/^RUN —/);
    expect(HUB_TAB_GUIDE.modes).toMatch(/^MORE —/);
    expect(HUB_TAB_GUIDE.rulebook).toMatch(/^RULES —/);
  });

  it("unknown tabs fall back to PLAY", () => {
    expect(hubGuideLine("nope")).toBe(HUB_TAB_GUIDE.play);
    expect(hubGuideLine()).toBe(HUB_TAB_GUIDE.play);
  });
});
