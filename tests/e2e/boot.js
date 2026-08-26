/** Boot the classic hub so Playwright can click PLAY / tabs (plaza is default). */
export function classicHubInit() {
  return () => {
    window.__CB_FAST = true;
    localStorage.setItem("chaind-blitz-settings-v1", JSON.stringify({
      classicHub: true,
      music: 0,
      sfx: 0,
      chainMode: "off",
      uiScale: 1,
      board3d: false
    }));
  };
}
