/**
 * Game 2: 틀린그림찾기 (Spot the Difference / SPOT THE GLITCH)
 * Exports mount(container, ctx) -> { unmount() }
 *
 * Dual synchronized 1200x896 canvases with deterministic seeded anomaly selection,
 * procedural ImageData hue swaps (preserving #1E1824 outlines), seamless patch
 * removals, cel-shaded vector props, mirror crosshair, 2.0x loupe, and hint radar.
 */
import { createRng, pickDispersed } from '../core/seed.js';
import { SPOT_DIFFICULTIES, SPOT_STAGES, parseSpotMode, spotModeId } from './spot-stages.js';
import { CAFE_IMAGES, CAFE_REGIONS } from './spot-cafe-manifest.js';
import { TOUCH_HIT_SLOP, WRONG_INPUT_COOLDOWN_MS } from '../core/rules.js';

export const BASE_W = 1200;
export const BASE_H = 896;

const MISS_TIME_PENALTY_SEC = 3.0;
const FINISH_DELAY_MS = 420; // let the final ring & sparkle play before the result modal
const SHAKE_MS = 380;
const HIT_FLASH_MS = 280;
const HINT_DURATION_MS = 3500;
const FOUND_ANIM_MS = 1200;
const MAX_HINTS = 2;
const MIN_HIT_RADIUS = 0.052;
const OUTLINE_COLOR = '#1E1824';

/**
 * Overlay colours (found rings, hint radar, cursor, feedback). Defaults match the
 * design tokens and are refreshed from the live CSS variables on mount, so the canvas
 * follows the same calm palette as the rest of the shell.
 */
const COLOR = {
  success: '#3fbf92',
  successDeep: '#1f7a5c',
  gold: '#eeb44a',
  accent: '#38bdf8',
  danger: '#e06767',
};

function syncPaletteFromTokens(el) {
  const css = getComputedStyle(el);
  const read = (name) => css.getPropertyValue(name).trim();
  COLOR.success = read('--neon-emerald') || COLOR.success;
  COLOR.gold = read('--neon-gold') || COLOR.gold;
  COLOR.accent = read('--neon-cyan') || COLOR.accent;
  COLOR.danger = read('--neon-crimson') || COLOR.danger;
}

/** `#rrggbb` + alpha → rgba() string. */
function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Photo stages: hand-placed anomalies (10 per picture), each pixel-verified against
 * the 1200×896 artwork. Titles live in ./spot-stages.js.
 */
export const PHOTO_STAGES = {
  camp: {
    imageSrc: './assets/images/spot-camp.jpg',
    pool: [
      {
        id: 'camp-tent-flap',
        label: '텐트 옆 말린 창문 덮개',
        x: 0.155,
        y: 0.472,
        r: 0.052,
        kind: 'color-swap',
        rx: 0.045,
        ry: 0.038,
        hueMin: 36,
        hueMax: 70,
        minSat: 0.38,
        minLight: 0.34,
        targetHue: 326,
        satScale: 1.15,
      },
      {
        id: 'camp-sleeping-pad',
        label: '텐트 옆 말린 침낭 매트',
        x: 0.104,
        y: 0.679,
        r: 0.058,
        kind: 'color-swap',
        rx: 0.054,
        ry: 0.044,
        hueMin: 10,
        hueMax: 48,
        minSat: 0.34,
        minLight: 0.25,
        targetHue: 222,
        satScale: 1.15,
      },
      {
        id: 'camp-kettle-red',
        label: '모닥불 위 법랑 주전자 색상',
        x: 0.495,
        y: 0.593,
        r: 0.054,
        kind: 'color-swap',
        rx: 0.044,
        ry: 0.046,
        filterFn: (_h, s, l) => s <= 0.24 && l >= 0.34 && l <= 0.94,
        targetHue: 356,
        forceSat: 0.82,
        lightScale: 0.82,
      },
      {
        id: 'camp-sign-bird',
        label: '나무 이정표 위 작은 새',
        x: 0.716,
        y: 0.214,
        r: 0.052,
        kind: 'cel-prop',
        propType: 'camp-bird',
      },
      {
        id: 'camp-lantern-cyan',
        label: '그루터기 위 랜턴 불빛',
        x: 0.901,
        y: 0.555,
        r: 0.055,
        kind: 'color-swap',
        rx: 0.042,
        ry: 0.078,
        hueMin: 26,
        hueMax: 72,
        minSat: 0.3,
        minLight: 0.24,
        targetHue: 182,
        satScale: 1.15,
      },
      {
        id: 'camp-picnic-mug',
        label: '돗자리 위 머그컵 색상',
        x: 0.662,
        y: 0.824,
        r: 0.048,
        kind: 'color-swap',
        rx: 0.028,
        ry: 0.035,
        hueMin: 180,
        hueMax: 235,
        minSat: 0.18,
        minLight: 0.28,
        targetHue: 48,
        satScale: 1.4,
      },
      {
        id: 'camp-green-apple',
        label: '돗자리 위 풋사과 색상',
        x: 0.719,
        y: 0.83,
        r: 0.048,
        kind: 'color-swap',
        rx: 0.024,
        ry: 0.032,
        filterFn: (h, s, l) =>
          (h <= 14 || h >= 342) && s >= 0.62 && l >= 0.24 && l <= 0.6,
        targetHue: 102,
        satScale: 1.05,
      },
      {
        id: 'camp-bottle-pink',
        label: '배낭 옆 물병 색상',
        x: 0.916,
        y: 0.812,
        r: 0.048,
        kind: 'color-swap',
        rx: 0.018,
        ry: 0.035,
        hueMin: 180,
        hueMax: 235,
        minSat: 0.22,
        minLight: 0.25,
        targetHue: 326,
        satScale: 1.3,
      },
      {
        id: 'camp-flowers-violet',
        label: '좌하단 바위 옆 들꽃 색상',
        x: 0.058,
        y: 0.77,
        r: 0.055,
        kind: 'color-swap',
        rx: 0.044,
        ry: 0.042,
        filterFn: (h, s, l) =>
          l >= 0.34 &&
          (((h >= 312 || h <= 12) && s >= 0.32) || (h >= 28 && h <= 56 && s >= 0.45)),
        targetHue: 254,
        satScale: 1.2,
      },
      {
        id: 'camp-mushroom',
        label: '그루터기 옆 빨간 버섯',
        x: 0.768,
        y: 0.678,
        r: 0.05,
        kind: 'cel-prop',
        propType: 'camp-mushroom',
      },
    ],
  },
};

/**
 * Parses `ctx.mode` into picture, difficulty, target count and time limit.
 * Returns null for the picker mode (or an unknown id).
 * @param {string} mode
 */
export function parseModeConfig(mode) {
  const parsed = parseSpotMode(mode);
  if (!parsed) return null;
  const { stage, difficulty } = parsed;
  return {
    stage,
    difficulty,
    targetCount: difficulty.count,
    timeLimitSec: difficulty.timeSec,
    modeLabel: `${stage.shortKo} · ${difficulty.label}`,
  };
}

/** Full anomaly pool of a picture. */
export function getStagePool(stage) {
  if (stage.kind === 'photo-set') return CAFE_REGIONS;
  return PHOTO_STAGES[stage.id].pool;
}

/**
 * Resolves the two board images + deterministic round anomalies for a seeded run.
 * For `photo-set` stages (20 similar illustrations), picks 2 distinct images and
 * extracts only the regions where those 2 images actually differ.
 */
export function resolveRoundData(rng, stage, targetCount, difficultyId = 'normal') {
  if (stage.kind === 'photo-set') {
    const n = CAFE_IMAGES.length;
    const idxA = Math.floor(rng() * n);
    const idxB = (idxA + 1 + Math.floor(rng() * (n - 1))) % n;
    const imgA = CAFE_IMAGES[idxA];
    const imgB = CAFE_IMAGES[idxB];
    const pool = CAFE_REGIONS.filter((_, rIdx) => imgA.states[rIdx] !== imgB.states[rIdx]);
    const anomalies = selectRoundAnomalies(rng, pool, targetCount, difficultyId);
    return {
      leftSrc: imgA.src,
      rightSrc: imgB.src,
      leftLabel: '그림 A',
      rightLabel: '그림 B',
      pool,
      anomalies,
    };
  }
  const pool = PHOTO_STAGES[stage.id].pool;
  const anomalies = selectRoundAnomalies(rng, pool, targetCount, difficultyId);
  return {
    leftSrc: PHOTO_STAGES[stage.id].imageSrc,
    rightSrc: null,
    leftLabel: '원본 그림',
    rightLabel: '변형 그림',
    pool,
    anomalies,
  };
}

/**
 * Deterministically selects `count` dispersed anomalies for a round using `rng`.
 * Easy rounds skip anomalies flagged `subtle` whenever enough obvious ones exist.
 * @param {() => number} rng
 * @param {Array<object>} pool
 * @param {number} count
 * @param {string} [difficultyId]
 */
export function selectRoundAnomalies(rng, pool, count, difficultyId = 'normal') {
  const obvious = pool.filter((spot) => !spot.subtle);
  const source = difficultyId === 'easy' && obvious.length >= count ? obvious : pool;
  return pickDispersed(rng, source, count, 0.12).map((spot, idx) => ({
    ...spot,
    index: idx,
    found: false,
    foundAtMs: 0,
  }));
}

/* === Pure Color Conversion Helpers (RGB <-> HSL) === */
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
      break;
  }
  return [h * 60, s, l];
}

function hueToRgb(p, q, t) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(hDeg, s, l) {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ];
}

function inHueRange(h, minH, maxH) {
  if (minH <= maxH) return h >= minH && h <= maxH;
  return h >= minH || h <= maxH;
}

/* === Procedural Anomaly Rendering onto Modified Base Canvas === */
function applyColorSwap(ctx2d, spot) {
  const cx = Math.round(spot.x * BASE_W);
  const cy = Math.round(spot.y * BASE_H);
  const rx = Math.round((spot.rx || spot.r) * BASE_W);
  const ry = Math.round((spot.ry || spot.r) * BASE_H);
  const x0 = Math.max(0, cx - rx);
  const y0 = Math.max(0, cy - ry);
  const x1 = Math.min(BASE_W, cx + rx);
  const y1 = Math.min(BASE_H, cy + ry);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return;

  const imgData = ctx2d.getImageData(x0, y0, w, h);
  const data = imgData.data;

  for (let py = 0; py < h; py += 1) {
    const dy = (y0 + py - cy) / ry;
    for (let px = 0; px < w; px += 1) {
      const dx = (x0 + px - cx) / rx;
      const ellip = dx * dx + dy * dy;
      if (ellip > 1) continue;

      const idx = (py * w + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const [hue, sat, lum] = rgbToHsl(r, g, b);
      // Preserve dark cel-shaded outlines (#1E1824) 100%
      if (lum < (spot.minLight ?? 0.2)) continue;
      if (spot.maxLight !== undefined && lum > spot.maxLight) continue;
      if (spot.minSat !== undefined && sat < spot.minSat) continue;
      if (spot.maxSat !== undefined && sat > spot.maxSat) continue;

      if (typeof spot.filterFn === 'function') {
        if (!spot.filterFn(hue, sat, lum)) continue;
      } else if (spot.hueMin !== undefined && spot.hueMax !== undefined) {
        if (!inHueRange(hue, spot.hueMin, spot.hueMax)) continue;
      }

      const nextHue =
        spot.targetHue !== undefined ? spot.targetHue : hue + (spot.hueShift || 150);
      const nextSat =
        spot.forceSat !== undefined
          ? spot.forceSat
          : Math.min(0.95, sat * (spot.satScale || 1.0));
      const nextLum =
        spot.lightScale !== undefined
          ? Math.max(0.18, Math.min(0.92, lum * spot.lightScale))
          : lum;

      const [nr, ng, nb] = hslToRgb(nextHue, nextSat, nextLum);
      // Soft feather near ellipse boundary (0.78..1.0)
      const alpha = ellip > 0.78 ? Math.max(0, (1 - ellip) / 0.22) : 1;
      data[idx] = Math.round(r + (nr - r) * alpha);
      data[idx + 1] = Math.round(g + (ng - g) * alpha);
      data[idx + 2] = Math.round(b + (nb - b) * alpha);
    }
  }

  ctx2d.putImageData(imgData, x0, y0);
}

function applyPatchRemove(ctx2d, spot) {
  const cx = Math.round(spot.x * BASE_W);
  const cy = Math.round(spot.y * BASE_H);
  const rx = Math.round((spot.rx || spot.r) * BASE_W);
  const ry = Math.round((spot.ry || spot.r) * BASE_H);
  const sx = cx + Math.round((spot.srcDx || 0.03) * BASE_W);
  const sy = cy + Math.round((spot.srcDy || 0.03) * BASE_H);

  const x0 = Math.max(0, cx - rx);
  const y0 = Math.max(0, cy - ry);
  const w = Math.min(BASE_W, cx + rx) - x0;
  const h = Math.min(BASE_H, cy + ry) - y0;
  if (w <= 0 || h <= 0) return;

  const sx0 = Math.max(0, Math.min(BASE_W - w, sx - rx));
  const sy0 = Math.max(0, Math.min(BASE_H - h, sy - ry));

  const dstData = ctx2d.getImageData(x0, y0, w, h);
  const srcData = ctx2d.getImageData(sx0, sy0, w, h);
  const d = dstData.data;
  const s = srcData.data;

  for (let py = 0; py < h; py += 1) {
    const dy = (y0 + py - cy) / ry;
    for (let px = 0; px < w; px += 1) {
      const dx = (x0 + px - cx) / rx;
      const ellip = dx * dx + dy * dy;
      if (ellip > 1) continue;
      const alpha = ellip > 0.65 ? Math.max(0, (1 - ellip) / 0.35) : 1;
      const idx = (py * w + px) * 4;
      d[idx] = Math.round(d[idx] + (s[idx] - d[idx]) * alpha);
      d[idx + 1] = Math.round(d[idx + 1] + (s[idx + 1] - d[idx + 1]) * alpha);
      d[idx + 2] = Math.round(d[idx + 2] + (s[idx + 2] - d[idx + 2]) * alpha);
    }
  }
  ctx2d.putImageData(dstData, x0, y0);
}

function drawClockHandsProp(ctx2d, spot) {
  const cx = spot.x * BASE_W;
  const cy = spot.y * BASE_H;

  ctx2d.save();
  // Clean inner cream clock dial preserving tick marks & brown frame
  ctx2d.beginPath();
  ctx2d.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx2d.fillStyle = '#faf3e2';
  ctx2d.fill();

  // Subtle dial shadow ring
  ctx2d.beginPath();
  ctx2d.arc(cx, cy, 31.5, 0, Math.PI * 2);
  ctx2d.strokeStyle = 'rgba(120, 96, 72, 0.14)';
  ctx2d.lineWidth = 1.5;
  ctx2d.stroke();

  // Hour hand -> ~3:30 (slightly past 3 o'clock, +15 deg below horizontal)
  ctx2d.lineCap = 'round';
  ctx2d.strokeStyle = OUTLINE_COLOR;
  ctx2d.lineWidth = 4.5;
  ctx2d.beginPath();
  ctx2d.moveTo(cx, cy);
  ctx2d.lineTo(cx + Math.cos(0.26) * 20, cy + Math.sin(0.26) * 20);
  ctx2d.stroke();

  // Minute hand -> 6 o'clock (pointing straight down)
  ctx2d.lineWidth = 3.6;
  ctx2d.beginPath();
  ctx2d.moveTo(cx, cy);
  ctx2d.lineTo(cx, cy + 28);
  ctx2d.stroke();

  // Accent red second hand -> ~10 o'clock
  ctx2d.strokeStyle = '#dc2626';
  ctx2d.lineWidth = 1.8;
  ctx2d.beginPath();
  ctx2d.moveTo(cx + 6, cy + 4);
  ctx2d.lineTo(cx - 21, cy - 16);
  ctx2d.stroke();

  // Center pivot pin
  ctx2d.beginPath();
  ctx2d.arc(cx, cy, 3.6, 0, Math.PI * 2);
  ctx2d.fillStyle = '#d97706';
  ctx2d.fill();
  ctx2d.lineWidth = 1.6;
  ctx2d.strokeStyle = OUTLINE_COLOR;
  ctx2d.stroke();
  ctx2d.restore();
}

function drawCafeBirdProp(ctx2d, spot) {
  const cx = spot.x * BASE_W;
  const cy = spot.y * BASE_H;

  ctx2d.save();
  ctx2d.translate(cx, cy);
  ctx2d.lineJoin = 'round';
  ctx2d.lineCap = 'round';

  // Back wing
  ctx2d.fillStyle = '#e11d48';
  ctx2d.strokeStyle = OUTLINE_COLOR;
  ctx2d.lineWidth = 2.2;
  ctx2d.beginPath();
  ctx2d.moveTo(-2, -3);
  ctx2d.quadraticCurveTo(4, -22, 16, -15);
  ctx2d.quadraticCurveTo(10, -5, 2, -1);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.stroke();

  // Tail feathers
  ctx2d.fillStyle = '#be123c';
  ctx2d.beginPath();
  ctx2d.moveTo(10, 2);
  ctx2d.lineTo(24, -2);
  ctx2d.lineTo(21, 5);
  ctx2d.lineTo(10, 6);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.stroke();

  // Bird body
  ctx2d.fillStyle = '#f43f5e';
  ctx2d.beginPath();
  ctx2d.ellipse(0, 2, 14, 9, -0.18, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.stroke();

  // Cream belly highlight
  ctx2d.fillStyle = '#fff1f2';
  ctx2d.beginPath();
  ctx2d.ellipse(-2, 5.5, 9, 4.2, -0.15, 0, Math.PI);
  ctx2d.fill();

  // Front wing
  ctx2d.fillStyle = '#fb7185';
  ctx2d.beginPath();
  ctx2d.moveTo(-4, 0);
  ctx2d.quadraticCurveTo(-8, -21, 7, -17);
  ctx2d.quadraticCurveTo(6, -5, 2, 2);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.stroke();

  // Beak
  ctx2d.fillStyle = COLOR.gold;
  ctx2d.beginPath();
  ctx2d.moveTo(-13, 0);
  ctx2d.lineTo(-21, 2);
  ctx2d.lineTo(-13, 5);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.stroke();

  // Eye
  ctx2d.fillStyle = OUTLINE_COLOR;
  ctx2d.beginPath();
  ctx2d.arc(-8.5, 0, 1.8, 0, Math.PI * 2);
  ctx2d.fill();

  ctx2d.restore();
}

function drawCampBirdProp(ctx2d, spot) {
  const cx = spot.x * BASE_W;
  const cy = spot.y * BASE_H;

  ctx2d.save();
  ctx2d.translate(cx, cy);
  ctx2d.lineJoin = 'round';
  ctx2d.lineCap = 'round';
  ctx2d.strokeStyle = OUTLINE_COLOR;
  ctx2d.lineWidth = 2.2;

  // Tiny legs perched on signpost top
  ctx2d.beginPath();
  ctx2d.moveTo(-4, 11);
  ctx2d.lineTo(-5, 17);
  ctx2d.moveTo(4, 11);
  ctx2d.lineTo(3, 17);
  ctx2d.stroke();

  // Tail
  ctx2d.fillStyle = '#ea580c';
  ctx2d.beginPath();
  ctx2d.moveTo(9, 4);
  ctx2d.lineTo(24, -4);
  ctx2d.lineTo(22, 4);
  ctx2d.lineTo(10, 9);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.stroke();

  // Plump body
  ctx2d.fillStyle = COLOR.gold;
  ctx2d.beginPath();
  ctx2d.ellipse(0, 3, 13, 10.5, -0.1, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.stroke();

  // Warm orange breast
  ctx2d.fillStyle = '#fb923c';
  ctx2d.beginPath();
  ctx2d.ellipse(-4, 6, 7.5, 5.5, 0, 0, Math.PI * 2);
  ctx2d.fill();

  // Head
  ctx2d.fillStyle = '#fcd34d';
  ctx2d.beginPath();
  ctx2d.arc(-7, -7, 8, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.stroke();

  // Folded wing
  ctx2d.fillStyle = '#f59e0b';
  ctx2d.beginPath();
  ctx2d.ellipse(3, 3, 8, 5, 0.25, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.stroke();

  // Beak
  ctx2d.fillStyle = '#ea580c';
  ctx2d.beginPath();
  ctx2d.moveTo(-14, -7);
  ctx2d.lineTo(-22, -4.5);
  ctx2d.lineTo(-14, -2);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.stroke();

  // Eye + highlight
  ctx2d.fillStyle = OUTLINE_COLOR;
  ctx2d.beginPath();
  ctx2d.arc(-9.5, -8.5, 1.9, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.fillStyle = '#ffffff';
  ctx2d.beginPath();
  ctx2d.arc(-10, -9.1, 0.7, 0, Math.PI * 2);
  ctx2d.fill();

  ctx2d.restore();
}

function drawCampMushroomProp(ctx2d, spot) {
  const cx = spot.x * BASE_W;
  const cy = spot.y * BASE_H;

  ctx2d.save();
  ctx2d.translate(cx, cy);
  ctx2d.lineJoin = 'round';
  ctx2d.lineCap = 'round';

  // Soft grass ground shadow
  ctx2d.fillStyle = 'rgba(20, 35, 10, 0.36)';
  ctx2d.beginPath();
  ctx2d.ellipse(0, 17, 18, 5.5, 0, 0, Math.PI * 2);
  ctx2d.fill();

  // Cream stem
  ctx2d.fillStyle = '#fef3c7';
  ctx2d.strokeStyle = OUTLINE_COLOR;
  ctx2d.lineWidth = 2.2;
  ctx2d.beginPath();
  ctx2d.moveTo(-7, 2);
  ctx2d.quadraticCurveTo(-8, 15, -5, 17);
  ctx2d.lineTo(6, 17);
  ctx2d.quadraticCurveTo(8, 14, 7, 2);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.stroke();

  // Red mushroom cap
  ctx2d.fillStyle = COLOR.danger;
  ctx2d.beginPath();
  ctx2d.moveTo(-21, 3);
  ctx2d.bezierCurveTo(-21, -18, 21, -18, 21, 3);
  ctx2d.quadraticCurveTo(0, 7, -21, 3);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.stroke();

  // Cel highlight band
  ctx2d.fillStyle = 'rgba(254, 202, 202, 0.45)';
  ctx2d.beginPath();
  ctx2d.ellipse(-7, -7, 6, 3, -0.35, 0, Math.PI * 2);
  ctx2d.fill();

  // Crisp white polka spots
  ctx2d.fillStyle = '#fffbeb';
  const spots = [
    [-9, -3, 3.3],
    [1, -9, 3.8],
    [10, -2, 3.0],
    [-1, 0, 2.5],
  ];
  for (const [sx, sy, sr] of spots) {
    ctx2d.beginPath();
    ctx2d.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.lineWidth = 1.2;
    ctx2d.stroke();
  }

  ctx2d.restore();
}

function applyCelProp(ctx2d, spot) {
  switch (spot.propType) {
    case 'clock-hands':
      drawClockHandsProp(ctx2d, spot);
      break;
    case 'cafe-bird':
      drawCafeBirdProp(ctx2d, spot);
      break;
    case 'camp-bird':
      drawCampBirdProp(ctx2d, spot);
      break;
    case 'camp-mushroom':
      drawCampMushroomProp(ctx2d, spot);
      break;
    default:
      break;
  }
}

function applyAnomalyToBuffer(ctx2d, spot) {
  if (spot.kind === 'color-swap') {
    applyColorSwap(ctx2d, spot);
  } else if (spot.kind === 'patch-remove') {
    applyPatchRemove(ctx2d, spot);
  } else if (spot.kind === 'cel-prop') {
    applyCelProp(ctx2d, spot);
  }
}

/* === Canvas Overlay Drawing Helpers === */
function drawFoundMarker(ctx2d, spot, nowMs, orderNum) {
  const x = spot.x * BASE_W;
  const y = spot.y * BASE_H;
  const rPx = Math.max(spot.r, MIN_HIT_RADIUS) * BASE_W * 0.92;
  const age = Math.max(0, nowMs - spot.foundAtMs);
  // Pulse only during the discovery window so the board settles into a static frame.
  const settle = 1 - Math.min(1, age / FOUND_ANIM_MS);
  const pulse = 1 + Math.sin(nowMs * 0.006 + spot.index) * 0.055 * settle;
  const popScale = age < 260 ? 0.65 + (age / 260) * 0.42 : 1;

  ctx2d.save();
  ctx2d.translate(x, y);

  // Outer soft emerald glow ring
  ctx2d.beginPath();
  ctx2d.arc(0, 0, rPx * pulse * popScale, 0, Math.PI * 2);
  ctx2d.fillStyle = withAlpha(COLOR.success, 0.14);
  ctx2d.fill();
  ctx2d.lineWidth = 4;
  ctx2d.strokeStyle = COLOR.success;
  ctx2d.shadowColor = withAlpha(COLOR.success, 0.55);
  ctx2d.shadowBlur = 8;
  ctx2d.stroke();

  // Inner gold dashed accent ring
  ctx2d.shadowBlur = 0;
  ctx2d.setLineDash([7, 6]);
  ctx2d.lineWidth = 2;
  ctx2d.strokeStyle = COLOR.gold;
  ctx2d.beginPath();
  ctx2d.arc(0, 0, (rPx - 6) * popScale, 0, Math.PI * 2);
  ctx2d.stroke();
  ctx2d.setLineDash([]);

  // Top-right check badge pill
  const bx = rPx * 0.72;
  const by = -rPx * 0.72;
  ctx2d.beginPath();
  ctx2d.arc(bx, by, 14, 0, Math.PI * 2);
  ctx2d.fillStyle = COLOR.successDeep;
  ctx2d.fill();
  ctx2d.lineWidth = 2.5;
  ctx2d.strokeStyle = '#ecfdf5';
  ctx2d.stroke();

  ctx2d.fillStyle = '#ffffff';
  ctx2d.font = '900 14px "Space Grotesk", sans-serif';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.fillText(`${orderNum}`, bx, by + 0.5);

  ctx2d.restore();
}

function drawHintBeacon(ctx2d, hintState, nowMs) {
  if (!hintState || nowMs >= hintState.untilMs) return;
  const spot = hintState.spot;
  if (spot.found) return;

  const x = spot.x * BASE_W;
  const y = spot.y * BASE_H;
  const baseR = 0.095 * BASE_W;
  const t = (nowMs % 900) / 900;
  const remainingRatio = Math.max(0, (hintState.untilMs - nowMs) / HINT_DURATION_MS);

  ctx2d.save();
  ctx2d.globalAlpha = Math.min(1, remainingRatio * 2.2);

  // Expanding radar wave
  ctx2d.beginPath();
  ctx2d.arc(x, y, baseR * (0.45 + t * 0.75), 0, Math.PI * 2);
  ctx2d.lineWidth = 3;
  ctx2d.strokeStyle = withAlpha(COLOR.gold, (1 - t) * 0.9);
  ctx2d.stroke();

  // Rotating dashed gold zone
  ctx2d.translate(x, y);
  ctx2d.rotate(nowMs * 0.0022);
  ctx2d.setLineDash([12, 8]);
  ctx2d.beginPath();
  ctx2d.arc(0, 0, baseR, 0, Math.PI * 2);
  ctx2d.fillStyle = withAlpha(COLOR.gold, 0.12);
  ctx2d.fill();
  ctx2d.lineWidth = 3.5;
  ctx2d.strokeStyle = COLOR.gold;
  ctx2d.stroke();

  ctx2d.restore();
}

function drawMirrorCrosshair(ctx2d, pointerState, targetSide) {
  if (!pointerState.active || pointerState.side === targetSide) return;
  const x = pointerState.nx * BASE_W;
  const y = pointerState.ny * BASE_H;

  ctx2d.save();
  ctx2d.translate(x, y);

  ctx2d.strokeStyle = withAlpha(COLOR.accent, 0.92);
  ctx2d.lineWidth = 2.2;
  ctx2d.shadowColor = withAlpha(COLOR.accent, 0.85);
  ctx2d.shadowBlur = 8;

  ctx2d.beginPath();
  ctx2d.arc(0, 0, 18, 0, Math.PI * 2);
  ctx2d.stroke();

  ctx2d.beginPath();
  ctx2d.moveTo(-26, 0);
  ctx2d.lineTo(-10, 0);
  ctx2d.moveTo(10, 0);
  ctx2d.lineTo(26, 0);
  ctx2d.moveTo(0, -26);
  ctx2d.lineTo(0, -10);
  ctx2d.moveTo(0, 10);
  ctx2d.lineTo(0, 26);
  ctx2d.stroke();

  ctx2d.beginPath();
  ctx2d.arc(0, 0, 3, 0, Math.PI * 2);
  ctx2d.fillStyle = COLOR.gold;
  ctx2d.fill();

  ctx2d.restore();
}

/* === Main Game Entry Point === */
export function mount(container, ctx) {
  const config = parseModeConfig(ctx.mode);
  if (!config) return mountPicker(container, ctx);
  const { stage, difficulty, targetCount, timeLimitSec, modeLabel } = config;
  const roundData = resolveRoundData(ctx.rng, stage, targetCount, difficulty.id);
  const anomalies = roundData.anomalies;

  let unmounted = false;
  let isPaused = false;
  let finished = false;
  let remainingSec = timeLimitSec;
  let activePlayMs = 0;
  let lastFrameMs = performance.now();
  let lastTickWholeSec = Math.ceil(timeLimitSec);

  let foundCount = 0;
  let wrongTaps = 0;
  let hintsUsed = 0;
  let streak = 0;
  let maxStreak = 0;
  let cooldownUntilMs = 0;
  let lastTapNorm = { x: 0.5, y: 0.5 };
  let activeHint = null; // { spot, untilMs }
  let loupeEnabled = false;
  let mobileView = 'both'; // 'both' | 'orig' | 'mod'
  let imageReady = false;

  const particles = [];
  const popups = [];
  const pointerMirror = { active: false, side: 'orig', nx: 0.5, ny: 0.5 };
  const touchGesture = {
    active: false,
    pointerId: null,
    side: null,
    startClientX: 0,
    startClientY: 0,
    moved: false,
    startMs: 0,
  };

  let rafId = 0;
  let finishTimerId = 0;
  let shakeTimerId = 0;
  let hitFlashTimerId = 0;
  let needsRender = true;

  function markDirty() {
    needsRender = true;
  }

  // Render Scoped DOM
  const root = document.createElement('div');
  root.className = 'game-root game-spot';
  root.innerHTML = `
    <div class="sd-toolbar">
      <div class="sd-toolbar__left">
        <span class="sd-stage-badge">
          <span>${stage.titleKo}</span>
          <span class="sd-stage-badge__sub">${difficulty.label}</span>
          <span class="sd-stage-badge__sub">${targetCount}곳</span>
        </span>
        <div class="sd-counter" aria-label="발견한 차이점 개수">
          <span class="sd-counter__text" data-sd-count>0 / ${targetCount}</span>
          <div class="sd-dots" data-sd-dots>
            ${anomalies
              .map(
                (_, i) =>
                  `<span class="sd-dot" data-sd-dot="${i}" title="차이점 ${i + 1}">${i + 1}</span>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="sd-toolbar__actions">
        <div class="sd-view-tabs" role="tablist" aria-label="모바일 보기 전환">
          <button type="button" class="sd-view-tab is-active" data-sd-view="both" role="tab" aria-selected="true">함께보기</button>
          <button type="button" class="sd-view-tab" data-sd-view="orig" role="tab" aria-selected="false">${roundData.leftLabel}</button>
          <button type="button" class="sd-view-tab" data-sd-view="mod" role="tab" aria-selected="false">${roundData.rightLabel}</button>
        </div>
        <button type="button" class="sd-tool-btn sd-tool-btn--loupe" data-sd-loupe aria-pressed="false" title="확대경 토글 (M)">
          🔍 돋보기
        </button>
        <button type="button" class="sd-tool-btn sd-tool-btn--hint" data-sd-hint title="힌트 사용 (H)">
          💡 힌트 (${MAX_HINTS})
        </button>
      </div>
    </div>

    <div class="sd-arena" data-sd-arena data-mobile-view="both">
      <section class="sd-board-card sd-board-card--orig" data-sd-card="orig">
        <header class="sd-board-header">
          <span class="sd-board-label">
            <span class="sd-board-label__dot" aria-hidden="true"></span>
            <span>${roundData.leftLabel}</span>
          </span>
        </header>
        <div class="sd-canvas-wrap" data-sd-wrap="orig">
          <canvas class="sd-canvas" data-sd-canvas="orig" width="${BASE_W}" height="${BASE_H}" tabindex="0" role="img" aria-label="${roundData.leftLabel}. 차이점을 클릭해 찾고, Enter 또는 Space로 힌트를 사용할 수 있습니다."></canvas>
          <canvas class="sd-loupe" data-sd-loupe-canvas="orig" width="146" height="146" aria-hidden="true"></canvas>
          <div class="sd-loading" data-sd-loading>스테이지 이미지 로딩 중...</div>
        </div>
      </section>

      <section class="sd-board-card sd-board-card--mod" data-sd-card="mod">
        <header class="sd-board-header">
          <span class="sd-board-label">
            <span class="sd-board-label__dot" aria-hidden="true"></span>
            <span>${roundData.rightLabel}</span>
          </span>
        </header>
        <div class="sd-canvas-wrap" data-sd-wrap="mod">
          <canvas class="sd-canvas" data-sd-canvas="mod" width="${BASE_W}" height="${BASE_H}" tabindex="0" role="img" aria-label="${roundData.rightLabel}. 다른 부분을 클릭해 찾으세요."></canvas>
          <canvas class="sd-loupe" data-sd-loupe-canvas="mod" width="146" height="146" aria-hidden="true"></canvas>
          <div class="sd-loading" data-sd-loading>이미지 준비 중...</div>
        </div>
      </section>
    </div>

    <div class="sd-footer">
      <div class="sd-callout" data-sd-callout data-tone="info">
        <span>👀 좌우 그림에서 다른 부분 ${targetCount}곳을 터치하세요! (어느 쪽을 눌러도 인정)</span>
      </div>
      <span class="sd-shortcuts">단축키: [H] 힌트 · [M] 돋보기 · 캔버스에서 [Enter] 힌트</span>
    </div>
  `;
  container.appendChild(root);
  syncPaletteFromTokens(root);

  // DOM References
  const origCanvas = root.querySelector('[data-sd-canvas="orig"]');
  const modCanvas = root.querySelector('[data-sd-canvas="mod"]');
  const origCtx = origCanvas.getContext('2d');
  const modCtx = modCanvas.getContext('2d');
  const origLoupeCanvas = root.querySelector('[data-sd-loupe-canvas="orig"]');
  const modLoupeCanvas = root.querySelector('[data-sd-loupe-canvas="mod"]');
  const origCard = root.querySelector('[data-sd-card="orig"]');
  const modCard = root.querySelector('[data-sd-card="mod"]');
  const arenaEl = root.querySelector('[data-sd-arena]');
  const countEl = root.querySelector('[data-sd-count]');
  const dotsWrap = root.querySelector('[data-sd-dots]');
  const hintBtn = root.querySelector('[data-sd-hint]');
  const loupeBtn = root.querySelector('[data-sd-loupe]');
  const calloutEl = root.querySelector('[data-sd-callout]');
  const loadingEls = Array.from(root.querySelectorAll('[data-sd-loading]'));
  const viewTabEls = Array.from(root.querySelectorAll('[data-sd-view]'));

  // Offscreen base buffers (1200x896)
  const origBase = document.createElement('canvas');
  origBase.width = BASE_W;
  origBase.height = BASE_H;
  const origBaseCtx = origBase.getContext('2d');

  const modBase = document.createElement('canvas');
  modBase.width = BASE_W;
  modBase.height = BASE_H;
  const modBaseCtx = modBase.getContext('2d', { willReadFrequently: true });

  function computeScore() {
    const base = foundCount * 600;
    const cleared = foundCount === targetCount;
    const timeBonus = cleared ? Math.round(Math.max(0, remainingSec) * 50) : 0;
    const streakBonus = maxStreak * 120;
    const perfectBonus = cleared && wrongTaps === 0 && hintsUsed === 0 ? 1000 : 0;
    return Math.max(
      0,
      base + timeBonus + streakBonus + perfectBonus - hintsUsed * 350 - wrongTaps * 50
    );
  }

  function syncHud() {
    ctx.updateHud({
      timer: remainingSec,
      score: computeScore(),
      progress: `${foundCount} / ${targetCount}`,
      progressRatio: Math.max(0, Math.min(1, remainingSec / timeLimitSec)),
      extra: streak >= 2 ? `🔥 x${streak} COMBO` : '',
    });
  }

  function setCallout(text, tone = 'info') {
    if (!calloutEl) return;
    calloutEl.dataset.tone = tone;
    calloutEl.textContent = text;
  }

  function updateCounterUi() {
    if (countEl) {
      countEl.textContent = `${foundCount} / ${targetCount}`;
    }
    const dotEls = dotsWrap?.querySelectorAll('.sd-dot');
    if (dotEls) {
      // Dots are identity slots: dot N lights up for the Nth seeded anomaly,
      // so the hint pulse and the found check live on the same slot.
      dotEls.forEach((dot, idx) => {
        if (anomalies[idx]?.found) {
          dot.classList.add('is-found');
          dot.textContent = '✓';
        }
      });
    }
  }

  function updateHintBtn() {
    if (!hintBtn) return;
    const rem = Math.max(0, MAX_HINTS - hintsUsed);
    hintBtn.textContent = `💡 힌트 (${rem})`;
    hintBtn.disabled = rem === 0 || finished;
  }

  function clearHintedDots() {
    dotsWrap?.querySelectorAll('.sd-dot.is-hinted').forEach((dot) => {
      dot.classList.remove('is-hinted');
    });
  }

  function markHintedDot() {
    clearHintedDots();
    if (!activeHint) return;
    dotsWrap
      ?.querySelector(`[data-sd-dot="${activeHint.spot.index}"]`)
      ?.classList.add('is-hinted');
  }

  function hideLoupes() {
    origLoupeCanvas?.classList.remove('is-visible');
    modLoupeCanvas?.classList.remove('is-visible');
  }

  function renderLoupeFor(side, clientX, clientY, isTouch) {
    if (!loupeEnabled || !imageReady || isPaused || finished) {
      hideLoupes();
      return;
    }
    const targetCanvas = side === 'orig' ? origCanvas : modCanvas;
    const loupeCanvas = side === 'orig' ? origLoupeCanvas : modLoupeCanvas;
    const otherLoupe = side === 'orig' ? modLoupeCanvas : origLoupeCanvas;
    const sourceBuffer = side === 'orig' ? origBase : modBase;
    if (!targetCanvas || !loupeCanvas) return;

    otherLoupe?.classList.remove('is-visible');

    const rect = targetCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const nx = Math.max(0, Math.min(1, localX / rect.width));
    const ny = Math.max(0, Math.min(1, localY / rect.height));

    const lSize = loupeCanvas.width;
    const half = lSize / 2;
    // Offset loupe above finger on touch so finger never obscures magnified target
    let offsetY = isTouch ? -76 : 0;
    if (isTouch && localY < 100) offsetY = 76;

    const tx = Math.max(-12, Math.min(rect.width - lSize + 12, localX - half));
    const ty = Math.max(-12, Math.min(rect.height - lSize + 12, localY + offsetY - half));
    loupeCanvas.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    loupeCanvas.classList.add('is-visible');

    const lCtx = loupeCanvas.getContext('2d');
    if (!lCtx) return;

    const zoom = 2.0;
    const srcSpan = (lSize / rect.width) * (BASE_W / zoom);
    const sx = nx * BASE_W - srcSpan / 2;
    const sy = ny * BASE_H - srcSpan / 2;

    lCtx.clearRect(0, 0, lSize, lSize);
    lCtx.save();
    lCtx.beginPath();
    lCtx.arc(half, half, half - 1, 0, Math.PI * 2);
    lCtx.clip();

    lCtx.fillStyle = '#070914';
    lCtx.fillRect(0, 0, lSize, lSize);
    lCtx.drawImage(sourceBuffer, sx, sy, srcSpan, srcSpan, 0, 0, lSize, lSize);

    // Subtle reticle crosshair inside loupe
    lCtx.strokeStyle = withAlpha(COLOR.accent, 0.72);
    lCtx.lineWidth = 1.5;
    lCtx.beginPath();
    lCtx.moveTo(half - 14, half);
    lCtx.lineTo(half - 4, half);
    lCtx.moveTo(half + 4, half);
    lCtx.lineTo(half + 14, half);
    lCtx.moveTo(half, half - 14);
    lCtx.lineTo(half, half - 4);
    lCtx.moveTo(half, half + 4);
    lCtx.lineTo(half, half + 14);
    lCtx.stroke();
    lCtx.restore();
  }

  function spawnFeedback(nx, ny, type, labelText, ringRPx = 0) {
    const now = performance.now();
    if (type === 'hit') {
      const colors = [COLOR.success, COLOR.gold, COLOR.accent, '#ffffff'];
      for (let i = 0; i < 14; i += 1) {
        const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.25;
        const speed = 1.8 + Math.random() * 3.4;
        particles.push({
          x: nx * BASE_W,
          y: ny * BASE_H,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8,
          size: 3.5 + Math.random() * 3.5,
          color: colors[i % colors.length],
          bornAt: now,
          life: 620,
        });
      }
      popups.push({
        x: nx * BASE_W,
        y: ny * BASE_H - Math.max(ringRPx, 48) - 12,
        text: labelText,
        color: COLOR.success,
        bornAt: now,
        life: 1250,
        type: 'hit',
      });
    } else {
      popups.push({
        x: nx * BASE_W,
        y: ny * BASE_H,
        text: labelText,
        color: COLOR.danger,
        bornAt: now,
        life: 820,
        type: 'miss',
      });
    }
  }

  function triggerShake() {
    origCard?.classList.remove('is-shaking');
    modCard?.classList.remove('is-shaking');
    void origCard?.offsetWidth;
    origCard?.classList.add('is-shaking');
    modCard?.classList.add('is-shaking');
    clearTimeout(shakeTimerId);
    shakeTimerId = window.setTimeout(() => {
      origCard?.classList.remove('is-shaking');
      modCard?.classList.remove('is-shaking');
    }, SHAKE_MS);
  }

  function triggerHitFlash() {
    origCard?.classList.add('is-hit');
    modCard?.classList.add('is-hit');
    clearTimeout(hitFlashTimerId);
    hitFlashTimerId = window.setTimeout(() => {
      origCard?.classList.remove('is-hit');
      modCard?.classList.remove('is-hit');
    }, HIT_FLASH_MS);
  }

  function finishGame(cleared) {
    if (finished || unmounted) return;
    finished = true;
    hideLoupes();
    activeHint = null;
    clearHintedDots();
    hintBtn?.classList.remove('is-active');
    markDirty();
    updateHintBtn();
    deliverResult(cleared);
  }

  // Single source for the result payload (time-out finish and full-clear finish)
  function deliverResult(cleared) {
    const totalInputs = foundCount + wrongTaps;
    const accuracy = totalInputs > 0 ? Math.round((foundCount / totalInputs) * 100) : 0;
    ctx.completeGame({
      score: computeScore(),
      timeMs: Math.round(activePlayMs),
      accuracy,
      cleared,
      modeLabel,
      details: [
        { value: `🔍 ${foundCount}/${targetCount} 차이` },
        { value: `⏱ ${(activePlayMs / 1000).toFixed(1)}초` },
        { value: `❌ 오답 ${wrongTaps}회` },
        { value: `💡 힌트 ${hintsUsed}회` },
      ],
    });
  }

  function handleCanvasTap(side, clientX, clientY, pointerType) {
    if (!imageReady || isPaused || finished) return;
    const now = performance.now();
    if (now < cooldownUntilMs) return;

    const canvas = side === 'orig' ? origCanvas : modCanvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    lastTapNorm = { x: nx, y: ny };

    const slop = pointerType === 'touch' ? TOUCH_HIT_SLOP : 0;

    // Check unfound anomalies first (closest within radius)
    let matchedSpot = null;
    let bestDist = Infinity;
    for (const spot of anomalies) {
      if (spot.found) continue;
      const dx = nx - spot.x;
      const dy = (ny - spot.y) * (BASE_H / BASE_W); // Aspect-corrected circular hit test
      const dist = Math.hypot(dx, dy);
      const hitR = Math.max(spot.r, MIN_HIT_RADIUS) + slop;
      if (dist <= hitR && dist < bestDist) {
        bestDist = dist;
        matchedSpot = spot;
      }
    }

    if (matchedSpot) {
      matchedSpot.found = true;
      matchedSpot.foundAtMs = now;
      foundCount += 1;
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);

      ctx.audio.playMatch(streak);
      triggerHitFlash();
      updateCounterUi();
      syncHud();

      const bonusTag = streak >= 2 ? ` · ${streak}연속!` : '';
      const ringRPx = Math.max(matchedSpot.r, MIN_HIT_RADIUS) * BASE_W * 0.92;
      spawnFeedback(matchedSpot.x, matchedSpot.y, 'hit', `${matchedSpot.label} +600${bonusTag}`, ringRPx);
      setCallout(`✨ 「${matchedSpot.label}」 발견! (${foundCount}/${targetCount})`, 'success');

      if (activeHint && activeHint.spot.id === matchedSpot.id) {
        activeHint = null;
        clearHintedDots();
        hintBtn?.classList.remove('is-active');
      }
      markDirty();

      if (foundCount >= targetCount) {
        updateHintBtn();
        // Brief celebration window so the player sees the final ring & sparkle
        finished = true;
        hideLoupes();
        finishTimerId = window.setTimeout(() => {
          if (unmounted) return;
          deliverResult(true);
        }, FINISH_DELAY_MS);
      }
      return;
    }

    // Check if user tapped an already-found difference (zero penalty!)
    for (const spot of anomalies) {
      if (!spot.found) continue;
      const dx = nx - spot.x;
      const dy = (ny - spot.y) * (BASE_H / BASE_W);
      const hitR = Math.max(spot.r, MIN_HIT_RADIUS) + slop;
      if (Math.hypot(dx, dy) <= hitR) {
        ctx.ui.showToast('이미 찾은 차이점이에요!', 'info', 1400);
        return;
      }
    }

    // Wrong tap penalty
    wrongTaps += 1;
    streak = 0;
    cooldownUntilMs = now + WRONG_INPUT_COOLDOWN_MS;
    remainingSec = Math.max(0, remainingSec - MISS_TIME_PENALTY_SEC);

    ctx.audio.playError();
    triggerShake();
    spawnFeedback(nx, ny, 'miss', `-${MISS_TIME_PENALTY_SEC}초 페널티!`);
    setCallout(`❌ 다른 곳이 아니에요! (-${MISS_TIME_PENALTY_SEC}초 페널티)`, 'error');
    syncHud();
    markDirty();

    if (remainingSec <= 0) {
      finishGame(false);
    }
  }

  function triggerHint() {
    if (!imageReady || isPaused || finished) return;
    if (hintsUsed >= MAX_HINTS) {
      ctx.ui.showToast('힌트를 모두 사용했습니다!', 'warn', 1600);
      return;
    }
    const unfound = anomalies.filter((s) => !s.found);
    if (unfound.length === 0) return;

    // Pick unfound anomaly farthest from last tap for helpful coverage
    let target = unfound[0];
    let maxD = -1;
    for (const s of unfound) {
      const d = Math.hypot(s.x - lastTapNorm.x, s.y - lastTapNorm.y);
      if (d > maxD) {
        maxD = d;
        target = s;
      }
    }

    hintsUsed += 1;
    activeHint = { spot: target, untilMs: performance.now() + HINT_DURATION_MS };
    // Expose the hinted slot in the counter so the dot matches the radar zone.
    markHintedDot();
    hintBtn?.classList.add('is-active');
    markDirty();
    ctx.audio.playHint();
    updateHintBtn();
    syncHud();
    setCallout(`💡 힌트 레이더 가동! 노란 점선 영역 안을 자세히 보세요.`, 'hint');
  }

  function toggleLoupe(forceState) {
    loupeEnabled = typeof forceState === 'boolean' ? forceState : !loupeEnabled;
    root.classList.toggle('is-loupe-on', loupeEnabled);
    if (loupeBtn) {
      loupeBtn.classList.toggle('is-active', loupeEnabled);
      loupeBtn.setAttribute('aria-pressed', String(loupeEnabled));
      loupeBtn.textContent = loupeEnabled ? '🔍 돋보기 ON' : '🔍 돋보기';
    }
    if (!loupeEnabled) {
      hideLoupes();
    } else {
      ctx.ui.showToast('2.0x 돋보기 활성화! 그림 위를 움직여 보세요.', 'info', 1800);
    }
  }

  /* === Render Loop (Dual Synchronized Canvases) === */
  function renderBoards(nowMs) {
    if (!imageReady) return;

    const drawOverlay = (targetCtx, side) => {
      // Found markers (synchronized on both canvases)
      for (const spot of anomalies) {
        if (spot.found) {
          // Badge matches the counter dot label for the same anomaly slot.
          drawFoundMarker(targetCtx, spot, nowMs, spot.index + 1);
        }
      }

      // Hint beacon (synchronized on both canvases)
      if (activeHint) {
        drawHintBeacon(targetCtx, activeHint, nowMs);
      }

      // Mirror crosshair on opposite canvas
      drawMirrorCrosshair(targetCtx, pointerMirror, side);

      // Particles
      for (const p of particles) {
        const age = nowMs - p.bornAt;
        const t = age / p.life;
        if (t < 0 || t >= 1) continue;
        targetCtx.save();
        targetCtx.globalAlpha = 1 - t;
        targetCtx.fillStyle = p.color;
        targetCtx.beginPath();
        targetCtx.arc(p.x + p.vx * (age * 0.055), p.y + p.vy * (age * 0.055), p.size * (1 - t * 0.4), 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.restore();
      }

      // Floating popups / miss X
      for (const pop of popups) {
        const age = nowMs - pop.bornAt;
        const t = age / pop.life;
        if (t < 0 || t >= 1) continue;
        targetCtx.save();
        targetCtx.globalAlpha = t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3);
        const py = pop.y - t * 32;

        if (pop.type === 'miss') {
          targetCtx.strokeStyle = COLOR.danger;
          targetCtx.lineWidth = 5;
          targetCtx.lineCap = 'round';
          targetCtx.beginPath();
          targetCtx.moveTo(pop.x - 14, pop.y - 14);
          targetCtx.lineTo(pop.x + 14, pop.y + 14);
          targetCtx.moveTo(pop.x + 14, pop.y - 14);
          targetCtx.lineTo(pop.x - 14, pop.y + 14);
          targetCtx.stroke();
        }

        if (pop.type === 'hit') {
          // Korean anomaly name chip so players learn what they spotted.
          targetCtx.font = '800 21px "Pretendard Variable", "Outfit", sans-serif';
          const chipH = 34;
          const chipW = targetCtx.measureText(pop.text).width + 26;
          const chipX = Math.max(8, Math.min(BASE_W - chipW - 8, pop.x - chipW / 2));
          const chipY = Math.max(6, py - 14 - chipH + 7);
          targetCtx.beginPath();
          if (typeof targetCtx.roundRect === 'function') {
            targetCtx.roundRect(chipX, chipY, chipW, chipH, 10);
          } else {
            targetCtx.rect(chipX, chipY, chipW, chipH);
          }
          targetCtx.fillStyle = 'rgba(9, 15, 22, 0.9)';
          targetCtx.fill();
          targetCtx.lineWidth = 1.5;
          targetCtx.strokeStyle = withAlpha(COLOR.success, 0.75);
          targetCtx.stroke();
          targetCtx.textAlign = 'center';
          targetCtx.textBaseline = 'middle';
          targetCtx.fillStyle = '#ecfdf5';
          targetCtx.fillText(pop.text, pop.x, chipY + chipH / 2);
          targetCtx.restore();
          continue;
        }

        targetCtx.font = '900 22px "Outfit", "Pretendard Variable", sans-serif';
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'bottom';
        targetCtx.lineWidth = 5;
        targetCtx.strokeStyle = '#070914';
        targetCtx.strokeText(pop.text, pop.x, py - 14);
        targetCtx.fillStyle = pop.color;
        targetCtx.fillText(pop.text, pop.x, py - 14);
        targetCtx.restore();
      }
    };

    origCtx.clearRect(0, 0, BASE_W, BASE_H);
    origCtx.drawImage(origBase, 0, 0);
    drawOverlay(origCtx, 'orig');

    modCtx.clearRect(0, 0, BASE_W, BASE_H);
    modCtx.drawImage(modBase, 0, 0);
    drawOverlay(modCtx, 'mod');

    needsRender = false;
  }

  /** True while any canvas overlay is still animating and must be repainted. */
  function hasActiveAnimation(nowMs) {
    if (isPaused) return false;
    if (particles.length > 0 || popups.length > 0) return true;
    if (activeHint && nowMs < activeHint.untilMs) return true;
    for (const spot of anomalies) {
      if (spot.found && nowMs - spot.foundAtMs < FOUND_ANIM_MS) return true;
    }
    return false;
  }

  function expireHintIfNeeded(nowMs) {
    if (!activeHint || nowMs < activeHint.untilMs) return;
    activeHint = null;
    clearHintedDots();
    hintBtn?.classList.remove('is-active');
    markDirty();
  }

  function frame(nowMs) {
    if (unmounted) return;
    const dtMs = Math.max(0, Math.min(120, nowMs - lastFrameMs));
    lastFrameMs = nowMs;

    if (imageReady && !isPaused && !finished) {
      activePlayMs += dtMs;
      remainingSec = Math.max(0, remainingSec - dtMs / 1000);

      const wholeSec = Math.ceil(remainingSec);
      if (wholeSec !== lastTickWholeSec) {
        lastTickWholeSec = wholeSec;
        if (wholeSec > 0 && wholeSec <= 10) {
          ctx.audio.playTick();
        }
      }

      syncHud();

      if (remainingSec <= 0) {
        finishGame(false);
        if (unmounted) return;
      }
    }

    expireHintIfNeeded(nowMs);

    // Prune expired particles & popups (and repaint once to erase the last frame of them)
    let prunedAny = false;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (nowMs - particles[i].bornAt >= particles[i].life) {
        particles.splice(i, 1);
        prunedAny = true;
      }
    }
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      if (nowMs - popups[i].bornAt >= popups[i].life) {
        popups.splice(i, 1);
        prunedAny = true;
      }
    }
    if (prunedAny) markDirty();

    // Dirty-flag loop: repaint only on state changes or while overlays animate.
    if (needsRender || hasActiveAnimation(nowMs)) {
      renderBoards(nowMs);
    }
    rafId = requestAnimationFrame(frame);
  }

  /* === Pointer & Keyboard Event Wiring === */
  function updatePointerMirror(side, clientX, clientY) {
    const canvas = side === 'orig' ? origCanvas : modCanvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerMirror.active = true;
    pointerMirror.side = side;
    pointerMirror.nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    pointerMirror.ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    markDirty();
  }

  function attachCanvasEvents(canvas, side) {
    const onPointerDown = (e) => {
      if (!imageReady || isPaused || finished) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      if (e.pointerType === 'touch') {
        touchGesture.active = true;
        touchGesture.pointerId = e.pointerId;
        touchGesture.side = side;
        touchGesture.startClientX = e.clientX;
        touchGesture.startClientY = e.clientY;
        touchGesture.moved = false;
        touchGesture.startMs = performance.now();

        if (loupeEnabled) {
          canvas.setPointerCapture?.(e.pointerId);
          renderLoupeFor(side, e.clientX, e.clientY, true);
        }
        return;
      }

      // Mouse / Pen: instant responsive click
      handleCanvasTap(side, e.clientX, e.clientY, e.pointerType);
    };

    const onPointerMove = (e) => {
      if (!imageReady || isPaused || finished) return;

      if (e.pointerType === 'touch') {
        if (!touchGesture.active || touchGesture.pointerId !== e.pointerId) return;
        const dist = Math.hypot(
          e.clientX - touchGesture.startClientX,
          e.clientY - touchGesture.startClientY
        );
        if (dist >= 8) touchGesture.moved = true;
        if (loupeEnabled && (touchGesture.moved || performance.now() - touchGesture.startMs >= 160)) {
          renderLoupeFor(side, e.clientX, e.clientY, true);
          updatePointerMirror(side, e.clientX, e.clientY);
        }
        return;
      }

      updatePointerMirror(side, e.clientX, e.clientY);
      if (loupeEnabled) {
        renderLoupeFor(side, e.clientX, e.clientY, false);
      }
    };

    const onPointerUp = (e) => {
      if (e.pointerType !== 'touch') return;
      if (!touchGesture.active || touchGesture.pointerId !== e.pointerId) return;
      const elapsed = performance.now() - touchGesture.startMs;
      const wasDrag = touchGesture.moved || (loupeEnabled && elapsed >= 180);
      touchGesture.active = false;
      hideLoupes();

      if (!wasDrag) {
        handleCanvasTap(side, e.clientX, e.clientY, 'touch');
      }
    };

    const onPointerLeave = (e) => {
      if (e.pointerType !== 'touch') {
        if (pointerMirror.side === side) pointerMirror.active = false;
        hideLoupes();
        markDirty(); // erase the mirror crosshair
      }
    };

    const onPointerCancel = () => {
      touchGesture.active = false;
      hideLoupes();
    };

    const onCanvasKeyDown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      if (isPaused || finished) return;
      e.preventDefault();
      if (e.repeat) return;
      triggerHint();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('keydown', onCanvasKeyDown);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('keydown', onCanvasKeyDown);
    };
  }

  const detachOrig = attachCanvasEvents(origCanvas, 'orig');
  const detachMod = attachCanvasEvents(modCanvas, 'mod');

  const onHintClick = () => {
    ctx.audio.playClick();
    triggerHint();
  };
  const onLoupeClick = () => {
    ctx.audio.playClick();
    toggleLoupe();
  };
  hintBtn?.addEventListener('click', onHintClick);
  loupeBtn?.addEventListener('click', onLoupeClick);

  const viewTabCleanups = viewTabEls.map((btn) => {
    const handler = () => {
      ctx.audio.playClick();
      mobileView = btn.dataset.sdView || 'both';
      if (arenaEl) arenaEl.dataset.mobileView = mobileView;
      viewTabEls.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
    };
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  function isTypingTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
    if (target instanceof HTMLSelectElement) return true;
    return Boolean(
      target.closest('[contenteditable=""], [contenteditable="true"], [role="textbox"]')
    );
  }

  const onKeyDown = (e) => {
    if (isPaused || finished) return;
    // Ignore auto-repeat so a held H cannot burn both hints at once
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (isTypingTarget(e.target)) return;
    const key = e.key.toLowerCase();
    if (key === 'h') {
      e.preventDefault();
      triggerHint();
    } else if (key === 'm' || key === 'z') {
      e.preventDefault();
      toggleLoupe();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const onResize = () => markDirty();
  window.addEventListener('resize', onResize, { passive: true });

  const onPauseChange = (e) => {
    isPaused = Boolean(e.detail?.paused);
    if (isPaused) {
      hideLoupes();
      pointerMirror.active = false;
    } else {
      lastFrameMs = performance.now();
    }
    markDirty();
  };
  window.addEventListener('pm:pausechange', onPauseChange);

  /* === Load Stage Image & Build Original + Modified Buffers === */
  syncHud();
  updateHintBtn();

  function startRound() {
    imageReady = true;
    lastFrameMs = performance.now();
    loadingEls.forEach((el) => el.remove());
    needsRender = true;
    renderBoards(lastFrameMs);
    rafId = requestAnimationFrame(frame);
  }

  const imgs = [];
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`Failed to load ${src}`));
      im.src = src;
      imgs.push(im);
    });

  if (stage.kind === 'photo-set') {
    Promise.all([loadImage(roundData.leftSrc), loadImage(roundData.rightSrc)])
      .then(([leftImg, rightImg]) => {
        if (unmounted) return;
        origBaseCtx.drawImage(leftImg, 0, 0, BASE_W, BASE_H);
        modBaseCtx.drawImage(rightImg, 0, 0, BASE_W, BASE_H);
        startRound();
      })
      .catch(() => {
        if (unmounted) return;
        loadingEls.forEach((el) => {
          el.textContent = '이미지를 불러오지 못했습니다.';
        });
        ctx.ui.showToast('스테이지 이미지를 불러오는 데 실패했습니다.', 'error');
      });
  } else {
    loadImage(roundData.leftSrc)
      .then((loaded) => {
        if (unmounted) return;
        origBaseCtx.drawImage(loaded, 0, 0, BASE_W, BASE_H);
        modBaseCtx.drawImage(loaded, 0, 0, BASE_W, BASE_H);
        // Apply ONLY the N seeded anomalies onto the modified buffer
        for (const spot of anomalies) applyAnomalyToBuffer(modBaseCtx, spot);
        startRound();
      })
      .catch(() => {
        if (unmounted) return;
        loadingEls.forEach((el) => {
          el.textContent = '이미지를 불러오지 못했습니다.';
        });
        ctx.ui.showToast('스테이지 이미지를 불러오는 데 실패했습니다.', 'error');
      });
  }

  return {
    unmount() {
      unmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (finishTimerId) clearTimeout(finishTimerId);
      if (shakeTimerId) clearTimeout(shakeTimerId);
      if (hitFlashTimerId) clearTimeout(hitFlashTimerId);

      detachOrig();
      detachMod();
      hintBtn?.removeEventListener('click', onHintClick);
      loupeBtn?.removeEventListener('click', onLoupeClick);
      viewTabCleanups.forEach((fn) => fn());
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pm:pausechange', onPauseChange);

      for (const im of imgs) {
        im.onload = null;
        im.onerror = null;
      }
      container.innerHTML = '';
    },
  };
}

/**
 * Entry screen for the `pick` mode:
 * - "바로 하기": choose a difficulty and play the picture the room seed picks, so
 *   everyone in the same room gets the same picture without coordinating.
 * - "그림 골라서 하기": choose a picture, then a difficulty.
 * It never scores anything: choosing calls ctx.switchMode(), which relaunches the
 * game in the chosen mode so the URL, room seed sync and records keep working.
 * @param {HTMLElement} container
 * @param {object} ctx
 */
function mountPicker(container, ctx) {
  const levelButtons = SPOT_DIFFICULTIES.map(
    (d) => `
      <button type="button" class="sd-level-btn sd-level-btn--${d.id}" data-level="${d.id}">
        <span class="sd-level-btn__label">${d.label}</span>
        <span class="sd-level-btn__meta">차이 ${d.count}곳 · ${d.timeSec}초</span>
        <span class="sd-level-btn__note">${d.note}</span>
      </button>`
  ).join('');

  const root = document.createElement('div');
  root.className = 'game-root game-spot sd-picker';
  root.innerHTML = `
    <div class="sd-picker__head">
      <h2 class="sd-picker__title" data-sd-pick-title>난이도를 고르세요</h2>
      <p class="sd-picker__sub" data-sd-pick-sub>같은 룸 시드라면 모두에게 같은 그림과 차이점이 나옵니다.</p>
    </div>

    <div class="sd-picker__start" data-view="start">
      <div class="sd-picker__level-list">${levelButtons}</div>
      <button type="button" class="sd-picker__browse" data-browse>🖼️ 그림 골라서 하기</button>
    </div>

    <div class="sd-picker__grid" data-view="grid" hidden>
      ${SPOT_STAGES.map(
        (stage) => `
        <button type="button" class="sd-pick-card" data-stage="${stage.id}">
          <span class="sd-pick-card__thumb" data-thumb="${stage.id}">
            ${stage.thumb ? `<img src="${stage.thumb}" alt="" loading="lazy" />` : ''}
          </span>
          <span class="sd-pick-card__title">${stage.titleKo}</span>
        </button>`
      ).join('')}
      <button type="button" class="sd-picker__back" data-back="start">← 난이도로 돌아가기</button>
    </div>

    <div class="sd-picker__levels" data-view="levels" hidden>
      <div class="sd-picker__chosen" data-sd-pick-chosen></div>
      <div class="sd-picker__level-list">${levelButtons}</div>
      <button type="button" class="sd-picker__back" data-back="grid">← 다른 그림 고르기</button>
    </div>
  `;
  container.appendChild(root);

  const titleEl = root.querySelector('[data-sd-pick-title]');
  const chosenEl = root.querySelector('[data-sd-pick-chosen]');
  const TITLES = { start: '난이도를 고르세요', grid: '그림을 고르세요' };
  let chosen = null; // picture picked in the grid; null = let the room seed pick

  const show = (view) => {
    root.querySelectorAll('[data-view]').forEach((el) => {
      el.hidden = el.dataset.view !== view;
    });
    if (view !== 'levels') chosen = null;
    titleEl.textContent = TITLES[view] || `${chosen.titleKo} · 난이도를 고르세요`;
    root.querySelector(`[data-view="${view}"] button`)?.focus({ preventScroll: true });
  };

  /** Same room seed → same picture for everyone. */
  const seededStage = () => {
    const rng = createRng(`${ctx.seed}::spot-difference::picture`);
    return SPOT_STAGES[Math.floor(rng() * SPOT_STAGES.length)];
  };

  const onClick = (e) => {
    const card = e.target.closest('[data-stage]');
    const level = e.target.closest('[data-level]');
    const back = e.target.closest('[data-back]');
    if (card) {
      ctx.audio.playClick();
      chosen = SPOT_STAGES.find((st) => st.id === card.dataset.stage);
      chosenEl.replaceChildren(card.querySelector('.sd-pick-card__thumb').cloneNode(true));
      show('levels');
    } else if (level) {
      ctx.audio.playClick();
      ctx.switchMode(spotModeId((chosen || seededStage()).id, level.dataset.level));
    } else if (e.target.closest('[data-browse]')) {
      ctx.audio.playClick();
      show('grid');
    } else if (back) {
      ctx.audio.playClick();
      show(back.dataset.back);
    }
  };
  root.addEventListener('click', onClick);
  ctx.updateHud({ timer: { text: '--:--', state: 'normal' }, score: 0, progress: '난이도 선택', progressRatio: 1 });
  root.querySelector('[data-view="start"] [data-level="normal"]')?.focus({ preventScroll: true });

  return {
    idle: true,
    unmount() {
      root.removeEventListener('click', onClick);
      container.innerHTML = '';
    },
  };
}
