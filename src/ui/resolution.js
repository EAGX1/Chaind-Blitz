// Display presets for Settings → Resolution. "native" uses the real window.
// Phone vs PC layout follows the stage width (720px), not the monitor.

export const RESOLUTION_NATIVE = "native";

export const PC_RESOLUTIONS = [
  { id: "1280x720", w: 1280, h: 720, label: "1280 × 720" },
  { id: "1280x800", w: 1280, h: 800, label: "1280 × 800" },
  { id: "1366x768", w: 1366, h: 768, label: "1366 × 768" },
  { id: "1440x900", w: 1440, h: 900, label: "1440 × 900" },
  { id: "1536x864", w: 1536, h: 864, label: "1536 × 864" },
  { id: "1600x900", w: 1600, h: 900, label: "1600 × 900" },
  { id: "1680x1050", w: 1680, h: 1050, label: "1680 × 1050" },
  { id: "1920x1080", w: 1920, h: 1080, label: "1920 × 1080" },
  { id: "1920x1200", w: 1920, h: 1200, label: "1920 × 1200" },
  { id: "2560x1440", w: 2560, h: 1440, label: "2560 × 1440" },
  { id: "3840x2160", w: 3840, h: 2160, label: "3840 × 2160 (4K)" },
];

export const PHONE_RESOLUTIONS = [
  { id: "360x640", w: 360, h: 640, label: "360 × 640" },
  { id: "360x800", w: 360, h: 800, label: "360 × 800" },
  { id: "375x667", w: 375, h: 667, label: "375 × 667" },
  { id: "375x812", w: 375, h: 812, label: "375 × 812" },
  { id: "390x844", w: 390, h: 844, label: "390 × 844" },
  { id: "393x852", w: 393, h: 852, label: "393 × 852" },
  { id: "412x915", w: 412, h: 915, label: "412 × 915" },
  { id: "414x896", w: 414, h: 896, label: "414 × 896" },
  { id: "430x932", w: 430, h: 932, label: "430 × 932" },
];

const BY_ID = new Map(
  [...PC_RESOLUTIONS, ...PHONE_RESOLUTIONS].map((r) => [r.id, r]),
);

export function isKnownResolution(id) {
  return id === RESOLUTION_NATIVE || BY_ID.has(id);
}

export function parseResolution(id) {
  if (!id || id === RESOLUTION_NATIVE) return null;
  return BY_ID.get(id) || null;
}

/** Scale a preset into the window from the top-left, then center the leftover.
 *  Never shrink below 1× — 4K on a 1080p window fills the window instead of
 *  crushing cards and Settings down to unreadably small. */
export function resolutionFitTransform(presetW, presetH, viewW, viewH) {
  const fit = Math.min(viewW / presetW, viewH / presetH);
  if (fit >= 1) {
    const x = (viewW - presetW * fit) / 2;
    const y = (viewH - presetH * fit) / 2;
    return { scale: fit, x, y, layoutW: presetW, layoutH: presetH, cardScale: 1, fill: false };
  }
  const cardScale = Math.min(1.5, Math.max(1, presetW / 1920));
  return { scale: 1, x: 0, y: 0, layoutW: viewW, layoutH: viewH, cardScale, fill: true };
}

export function applyResolution(id) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const html = document.documentElement;
  const preset = parseResolution(id);
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  if (!preset) {
    html.dataset.res = "native";
    html.dataset.resolution = RESOLUTION_NATIVE;
    html.style.setProperty("--cb-res-w", `${vw}px`);
    html.style.setProperty("--cb-res-h", `${vh}px`);
    html.style.setProperty("--cb-res-transform", "none");
    html.style.setProperty("--cb-card-scale", "1");
    return;
  }
  const { scale, x, y, layoutW, layoutH, cardScale, fill } = resolutionFitTransform(
    preset.w, preset.h, vw, vh,
  );
  html.dataset.res = fill ? "fill" : "preset";
  html.dataset.resolution = preset.id;
  html.style.setProperty("--cb-res-w", `${layoutW}px`);
  html.style.setProperty("--cb-res-h", `${layoutH}px`);
  html.style.setProperty("--cb-card-scale", String(cardScale));
  html.style.setProperty(
    "--cb-res-transform",
    fill || (scale === 1 && x === 0 && y === 0)
      ? "none"
      : `translate(${x}px, ${y}px) scale(${scale})`,
  );
}
