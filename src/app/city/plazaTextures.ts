/** Procedural tiled maps for the plaza. No GLTF / HDRI. */
import * as THREE from "three";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function colorTex(canvas: HTMLCanvasElement, repeat: number, linear = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function fill(ctx: CanvasRenderingContext2D, hex: string) {
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function grassMap() {
  const { c, ctx } = makeCanvas(512);
  fill(ctx, "#2c6e32");
  const r = rng(11);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = r() > 0.5 ? "#245a28" : "#3a8840";
    ctx.beginPath();
    ctx.ellipse(r() * 512, r() * 512, 18 + r() * 40, 10 + r() * 22, r() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 9000; i++) {
    const x = r() * 512;
    const y = r() * 512;
    const h = 5 + r() * 14;
    ctx.strokeStyle = ["#3d9a42", "#58c45a", "#2e7a34", "#6ad05c", "#4aaa40", "#1f5c24"][i % 6];
    ctx.lineWidth = 1 + r() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 4, y - h);
    ctx.stroke();
  }
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = r() > 0.45 ? "#f4e8c8" : "#f0a0b8";
    ctx.fillRect(r() * 512, r() * 512, 2, 2);
  }
  return colorTex(c, 22);
}

function cobblePair() {
  const { c, ctx } = makeCanvas(512);
  const bump = makeCanvas(512);
  fill(ctx, "#6a5c50");
  fill(bump.ctx, "#404040");
  const r = rng(42);
  const rowH = 34;
  for (let y = 0; y < 540; y += rowH) {
    const ox = ((y / rowH) % 2) * 22;
    for (let x = -30; x < 540; x += 44) {
      const jx = x + ox + (r() - 0.5) * 6;
      const jy = y + (r() - 0.5) * 5;
      const w = 34 + r() * 10;
      const h = 24 + r() * 8;
      const shade = 168 + Math.floor(r() * 42);
      const warm = Math.floor(r() * 18);
      ctx.fillStyle = `rgb(${shade + 12},${shade - 4 + warm},${shade - 22})`;
      roundStone(ctx, jx, jy, w, h);
      const hi = 210 + Math.floor(r() * 20);
      ctx.fillStyle = `rgba(${hi},${hi - 12},${hi - 28},0.35)`;
      roundStone(ctx, jx + 2, jy + 2, w * 0.55, h * 0.4);
      ctx.strokeStyle = "rgba(70,58,48,0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
      bump.ctx.fillStyle = `rgb(${140 + r() * 80},${140},${140})`;
      roundStone(bump.ctx, jx, jy, w, h);
      bump.ctx.fill();
    }
  }
  return { map: colorTex(c, 8), bump: colorTex(bump.c, 8, true) };
}

function roundStone(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, 6);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

function plasterMap(tint: [number, number, number], seed: number) {
  const { c, ctx } = makeCanvas(512);
  fill(ctx, `rgb(${tint[0]},${tint[1]},${tint[2]})`);
  const r = rng(seed);
  for (let i = 0; i < 5000; i++) {
    const n = -10 + r() * 22;
    ctx.fillStyle = `rgba(${tint[0] + n},${tint[1] + n},${tint[2] + n * 0.6},${0.12 + r() * 0.2})`;
    ctx.fillRect(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 4);
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(120,100,80,${0.08 + r() * 0.1})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, r() * 512);
    ctx.lineTo(512, r() * 512);
    ctx.stroke();
  }
  return colorTex(c, 3);
}

function roofMap(base: string, dark: string, seed: number) {
  const { c, ctx } = makeCanvas(512);
  fill(ctx, dark);
  const r = rng(seed);
  const th = 18;
  for (let y = 0; y < 530; y += th) {
    const ox = ((y / th) % 2) * 14;
    for (let x = -20; x < 530; x += 28) {
      ctx.fillStyle = r() > 0.5 ? base : dark;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(x + ox, y, 26, 16, 4);
      else ctx.rect(x + ox, y, 26, 16);
      ctx.fill();
      ctx.strokeStyle = "rgba(40,20,16,0.35)";
      ctx.stroke();
    }
  }
  return colorTex(c, 4);
}

function barkMap() {
  const { c, ctx } = makeCanvas(256);
  fill(ctx, "#4a2e1c");
  const r = rng(7);
  for (let x = 0; x < 256; x += 7) {
    ctx.strokeStyle = r() > 0.5 ? "#2e1a10" : "#6a4430";
    ctx.lineWidth = 2 + r() * 3;
    ctx.beginPath();
    ctx.moveTo(x + r() * 4, 0);
    ctx.lineTo(x + (r() - 0.5) * 8, 256);
    ctx.stroke();
  }
  for (let i = 0; i < 80; i++) {
    ctx.strokeStyle = "rgba(20,10,6,0.45)";
    ctx.beginPath();
    ctx.moveTo(r() * 256, r() * 256);
    ctx.lineTo(r() * 256, r() * 256);
    ctx.stroke();
  }
  return colorTex(c, 2);
}

function canopyMap(kind: "blossom" | "leaf") {
  const { c, ctx } = makeCanvas(256);
  fill(ctx, kind === "blossom" ? "#e8789a" : "#2e8a38");
  const r = rng(kind === "blossom" ? 19 : 23);
  for (let i = 0; i < 2200; i++) {
    const x = r() * 256;
    const y = r() * 256;
    if (kind === "blossom") {
      ctx.fillStyle = ["#f2a0b8", "#f8c8d4", "#d45a7a", "#fff0f4", "#c04068"][i % 5];
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + r() * 5, 2 + r() * 4, r() * 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = ["#3d9a42", "#1f6a28", "#58c45a", "#246830"][i % 4];
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + r() * 7, 2 + r() * 4, r() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return colorTex(c, 2);
}

function woodMap() {
  const { c, ctx } = makeCanvas(256);
  fill(ctx, "#6a4430");
  const r = rng(3);
  for (let y = 0; y < 256; y += 18) {
    ctx.fillStyle = r() > 0.5 ? "#7a5238" : "#5a3824";
    ctx.fillRect(0, y, 256, 16);
    ctx.strokeStyle = "rgba(30,16,8,0.4)";
    ctx.strokeRect(0, y, 256, 16);
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(90,60,30,${0.2 + r() * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(0, r() * 256);
    ctx.bezierCurveTo(80, r() * 256, 160, r() * 256, 256, r() * 256);
    ctx.stroke();
  }
  return colorTex(c, 2);
}

function feltMap() {
  const { c, ctx } = makeCanvas(256);
  fill(ctx, "#16382c");
  const r = rng(5);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = r() > 0.5 ? "#1c4a38" : "#0e281e";
    ctx.fillRect(r() * 256, r() * 256, 2, 2);
  }
  ctx.strokeStyle = "rgba(201,162,39,0.55)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.stroke();
  return colorTex(c, 1);
}

function waterMap() {
  const { c, ctx } = makeCanvas(256);
  fill(ctx, "#3aa8c0");
  const r = rng(9);
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = `rgba(180,240,255,${0.15 + r() * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(128, 128, 10 + i * 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(r() * 256, r() * 256, 8 + r() * 16, 3, r() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = colorTex(c, 2);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function brickMap() {
  const { c, ctx } = makeCanvas(256);
  fill(ctx, "#6a4030");
  const r = rng(13);
  const bh = 16;
  for (let y = 0; y < 270; y += bh) {
    const ox = ((y / bh) % 2) * 14;
    for (let x = -20; x < 270; x += 28) {
      ctx.fillStyle = r() > 0.5 ? "#a45a40" : "#8a4a34";
      ctx.fillRect(x + ox + 1, y + 1, 25, 13);
    }
  }
  return colorTex(c, 4);
}

export type PlazaTextures = ReturnType<typeof buildPlazaTextures>;

function buildPlazaTextures() {
  const cobble = cobblePair();
  return {
    grass: grassMap(),
    cobble: cobble.map,
    cobbleBump: cobble.bump,
    plaster: plasterMap([236, 226, 210], 21),
    plasterCool: plasterMap([210, 230, 232], 27),
    plasterSand: plasterMap([232, 214, 190], 33),
    roofClay: roofMap("#c45a3a", "#8a3424", 8),
    roofTeal: roofMap("#3a8a88", "#24605e", 12),
    roofSlate: roofMap("#4a6a9a", "#2a4068", 16),
    roofAmber: roofMap("#d4783a", "#9a4a18", 18),
    bark: barkMap(),
    blossom: canopyMap("blossom"),
    leaf: canopyMap("leaf"),
    wood: woodMap(),
    felt: feltMap(),
    water: waterMap(),
    brick: brickMap(),
  };
}

let cache: PlazaTextures | null = null;

export function getPlazaTextures() {
  if (typeof document === "undefined") return null;
  if (!cache) cache = buildPlazaTextures();
  return cache;
}
