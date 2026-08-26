// Local PNG character cutout for the plaza billboard. Never uploaded.

const CUSTOM_AVATAR_KEY = "chaind-blitz-custom-avatar-v1";
export const AVATAR_CHANGED = "cb-avatar-changed";

export function opaqueBounds(data, w, h, alphaMin = 20) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let hits = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= alphaMin) {
        hits++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!hits) return null;
  return { minX, minY, maxX, maxY, hits };
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function isChromaGreen(r, g, b) {
  return g > 90 && g > r + 50 && g > b + 50;
}

export function punchChromaGreen(data) {
  let punched = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (isChromaGreen(data[i], data[i + 1], data[i + 2])) {
      data[i + 3] = 0;
      punched++;
    }
  }
  return punched;
}

export function punchCornerBackground(data, w, h) {
  const sample = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const corners = [
    sample(2, 2),
    sample(w - 3, 2),
    sample(2, h - 3),
    sample(w - 3, h - 3)
  ];
  const bg = [0, 0, 0];
  let n = 0;
  for (const c of corners) {
    if (c[3] < 8) continue;
    bg[0] += c[0];
    bg[1] += c[1];
    bg[2] += c[2];
    n++;
  }
  if (!n) return false;
  bg[0] /= n;
  bg[1] /= n;
  bg[2] /= n;
  const thresh = 38;
  let punched = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (colorDist(data[i], data[i + 1], data[i + 2], bg[0], bg[1], bg[2]) < thresh) {
      data[i + 3] = 0;
      punched++;
    }
  }
  return punched > w * h * 0.08;
}

export function cropCharacterFromImageData(imageData, { punch = true } = {}) {
  const { data, width, height } = imageData;
  const copy = new Uint8ClampedArray(data);
  let alphaHits = 0;
  for (let i = 3; i < copy.length; i += 4) if (copy[i] >= 20) alphaHits++;
  const mostlySolid = alphaHits > width * height * 0.92;
  if (punch) {
    const i = 2 * 4;
    const chroma = width > 6 && height > 6 && isChromaGreen(copy[i], copy[i + 1], copy[i + 2]);
    if (chroma) punchChromaGreen(copy);
    else if (mostlySolid) punchCornerBackground(copy, width, height);
  }
  const box = opaqueBounds(copy, width, height);
  if (!box) return { imageData, aspect: width / Math.max(1, height), width, height };
  const pad = Math.max(2, Math.round(Math.max(width, height) * 0.02));
  const x0 = Math.max(0, box.minX - pad);
  const y0 = Math.max(0, box.minY - pad);
  const x1 = Math.min(width - 1, box.maxX + pad);
  const y1 = Math.min(height - 1, box.maxY + pad);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = new ImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    const src = ((y0 + y) * width + x0) * 4;
    const dst = y * cw * 4;
    out.data.set(copy.subarray(src, src + cw * 4), dst);
  }
  return { imageData: out, aspect: cw / ch, width: cw, height: ch };
}

function canvasFromImageData(imageData) {
  const c = document.createElement("canvas");
  c.width = imageData.width;
  c.height = imageData.height;
  c.getContext("2d").putImageData(imageData, 0, 0);
  return c;
}

export const STARTER_AVATAR_SRC = "/avatars/starter-duelist.png";
export const STARTER_AVATAR_ASPECT = 510 / 768;

export function starterAvatarUrl() {
  return STARTER_AVATAR_SRC;
}

export function loadCustomAvatar() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CUSTOM_AVATAR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.url) return { url: parsed.url, aspect: Number(parsed.aspect) || 0.5 };
  } catch {
    return null;
  }
  return null;
}

export function saveCustomAvatar(payload) {
  if (typeof localStorage === "undefined") return { ok: false, reason: "No storage" };
  try {
    if (!payload) localStorage.removeItem(CUSTOM_AVATAR_KEY);
    else localStorage.setItem(CUSTOM_AVATAR_KEY, JSON.stringify(payload));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AVATAR_CHANGED));
    return { ok: true };
  } catch {
    return { ok: false, reason: "Image too large for this browser — try a smaller PNG" };
  }
}

export function activeAvatar() {
  return loadCustomAvatar() || { url: starterAvatarUrl(), aspect: STARTER_AVATAR_ASPECT };
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

/** Crop empty space (and punch a flat photo background), store a PNG cutout. */
export async function readLocalAvatarFile(file) {
  if (typeof document === "undefined" || !file) throw new Error("No file");
  const img = await loadImageFile(file);
  const max = 720;
  let w = img.width;
  let h = img.height;
  if (w > max || h > max) {
    const s = max / Math.max(w, h);
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
  }
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const ctx = src.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const cropped = cropCharacterFromImageData(ctx.getImageData(0, 0, w, h));
  let cw = cropped.width;
  let ch = cropped.height;
  const cap = 512;
  if (cw > cap || ch > cap) {
    const s = cap / Math.max(cw, ch);
    cw = Math.max(1, Math.round(cw * s));
    ch = Math.max(1, Math.round(ch * s));
  }
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d").drawImage(canvasFromImageData(cropped.imageData), 0, 0, cw, ch);
  const url = out.toDataURL("image/png");
  const saved = saveCustomAvatar({ url, aspect: cw / ch });
  if (!saved.ok) throw new Error(saved.reason);
  return { url, aspect: cw / ch };
}
