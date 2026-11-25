/**
 * Game 2: 틀린그림찾기 (Spot the Difference / SPOT THE GLITCH)
 * Exports mount(container, ctx) -> { unmount() }
 *
 * Dual synchronized 1200x896 canvases with deterministic seeded anomaly selection,
 * procedural ImageData hue swaps (preserving #1E1824 outlines), seamless patch
 * removals, cel-shaded vector props, mirror crosshair, 2.0x loupe, and hint radar.
 */
import { pickDispersed } from '../core/seed.js';

export const BASE_W = 1200;
export const BASE_H = 896;

const PENALTY_SEC = 3.0;
const COOLDOWN_MS = 450;
const HINT_DURATION_MS = 3500;
const MAX_HINTS = 2;
const TOUCH_HIT_SLOP = 0.012;
const MIN_HIT_RADIUS = 0.052;
const OUTLINE_COLOR = '#1E1824';

/**
 * Curated Stage Definitions (10 distinct anomalies per stage).
 * All coordinates are normalized [0..1] against 1200x896 source artwork.
 */
export const STAGES = {
  stage1: {
    id: 'stage1',
    titleKo: '보드게임 디저트 카페',
    shortKo: '카페',
    imageSrc: './assets/images/spot-cafe.jpg',
    pool: [
      {
        id: 'cafe-lamp-blue',
        label: '왼쪽 펜던트 조명 색상',
        x: 0.397,
        y: 0.166,
        r: 0.055,
        kind: 'color-swap',
        rx: 0.038,
        ry: 0.048,
        hueMin: 175,
        hueMax: 235,
        minSat: 0.22,
        minLight: 0.22,
        targetHue: 14,
        satScale: 1.15,
      },
      {
        id: 'cafe-clock-hands',
        label: '벽시계 바늘 시각',
        x: 0.295,
        y: 0.169,
        r: 0.06,
        kind: 'cel-prop',
        propType: 'clock-hands',
      },
      {
        id: 'cafe-mug-middle',
        label: '쇼케이스 위 가운데 머그',
        x: 0.195,
        y: 0.562,
        r: 0.048,
        kind: 'color-swap',
        rx: 0.028,
        ry: 0.028,
        hueMin: 120,
        hueMax: 185,
        minSat: 0.14,
        minLight: 0.22,
        targetHue: 306,
        satScale: 1.55,
      },
      {
        id: 'cafe-cake-frosting',
        label: '진열장 상단 중앙 케이크 크림',
        x: 0.245,
        y: 0.642,
        r: 0.052,
        kind: 'color-swap',
        rx: 0.048,
        ry: 0.028,
        hueMin: 295,
        hueMax: 357,
        minSat: 0.18,
        minLight: 0.46,
        targetHue: 150,
        satScale: 1.1,
      },
      {
        id: 'cafe-vase-flowers',
        label: '카운터 좌측 꽃병 꽃잎',
        x: 0.085,
        y: 0.543,
        r: 0.052,
        kind: 'color-swap',
        rx: 0.036,
        ry: 0.038,
        filterFn: (h, s, l) =>
          l >= 0.32 &&
          l <= 0.78 &&
          (((h >= 312 || h <= 8) && s >= 0.34) || (h >= 40 && h <= 58 && s >= 0.56)),
        targetHue: 215,
        satScale: 1.25,
      },
      {
        id: 'cafe-barista-apron',
        label: '바리스타 앞치마 색상',
        x: 0.391,
        y: 0.558,
        r: 0.06,
        kind: 'color-swap',
        rx: 0.042,
        ry: 0.072,
        hueMin: 10,
        hueMax: 40,
        minSat: 0.16,
        maxSat: 0.65,
        minLight: 0.2,
        maxLight: 0.56,
        targetHue: 164,
        satScale: 1.35,
      },
      {
        id: 'cafe-girl-shirt',
        label: '창가 여성 티셔츠 색상',
        x: 0.729,
        y: 0.602,
        r: 0.055,
        kind: 'color-swap',
        rx: 0.032,
        ry: 0.038,
        hueMin: 40,
        hueMax: 68,
        minSat: 0.4,
        minLight: 0.45,
        targetHue: 272,
        satScale: 1.0,
      },
      {
        id: 'cafe-green-pawn',
        label: '앞 테이블 초록 말 제거',
        x: 0.82,
        y: 0.848,
        r: 0.05,
        kind: 'patch-remove',
        rx: 0.02,
        ry: 0.042,
        srcDx: -0.025,
        srcDy: 0.032,
      },
      {
        id: 'cafe-card-suit',
        label: '앞 테이블 카드 문양',
        x: 0.735,
        y: 0.854,
        r: 0.052,
        kind: 'cel-prop',
        propType: 'card-spade',
      },
      {
        id: 'cafe-window-bird',
        label: '창밖 하늘 날아가는 새',
        x: 0.885,
        y: 0.178,
        r: 0.055,
        kind: 'cel-prop',
        propType: 'cafe-bird',
      },
    ],
  },

  stage2: {
    id: 'stage2',
    titleKo: '황혼의 모험 캠프',
    shortKo: '캠프',
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
        hueMin: 15,
        hueMax: 60,
        minSat: 0.3,
        minLight: 0.22,
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
        ry: 0.034,
        filterFn: (h, s, l) =>
          (h <= 16 || h >= 340) && s >= 0.52 && l >= 0.22 && l <= 0.64,
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
 * Parses `ctx.mode` into stage config, difficulty, target count, and timer limit.
 * @param {string} mode
 */
export function parseModeConfig(mode) {
  const safeMode = String(mode || 'stage1-normal');
  const isStage2 = safeMode.startsWith('stage2');
  const isHard = safeMode.endsWith('hard');
  const stage = isStage2 ? STAGES.stage2 : STAGES.stage1;
  const targetCount = isHard ? 8 : 6;
  const timeLimitSec = isHard ? 75 : 60;
  const diffLabel = isHard ? '하드' : '노말';
  return {
    stage,
    isHard,
    targetCount,
    timeLimitSec,
    modeLabel: `${stage.shortKo} · ${diffLabel}`,
  };
}

/**
 * Deterministically selects `count` dispersed anomalies for a round using `rng`.
 * @param {() => number} rng
 * @param {object} stage
 * @param {number} count
 */
export function selectRoundAnomalies(rng, stage, count) {
  return pickDispersed(rng, stage.pool, count, 0.12).map((spot, idx) => ({
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

function drawCardSpadeProp(ctx2d, spot) {
  const cx = spot.x * BASE_W;
  const cy = spot.y * BASE_H;

  ctx2d.save();
  ctx2d.translate(cx, cy);
  // Card perspective tilt matches the foreground heart card
  ctx2d.rotate(-0.42);

  // Patch center red heart with clean off-white card surface
  ctx2d.fillStyle = '#f8f4eb';
  ctx2d.beginPath();
  ctx2d.ellipse(0, -1, 21, 19, 0, 0, Math.PI * 2);
  ctx2d.fill();

  // Draw crisp black spade (♠)
  ctx2d.fillStyle = OUTLINE_COLOR;
  ctx2d.beginPath();
  ctx2d.moveTo(0, -11);
  ctx2d.bezierCurveTo(10, -3, 13, 3, 7, 7.5);
  ctx2d.bezierCurveTo(4, 9.5, 1.5, 7, 1, 5);
  ctx2d.lineTo(4, 11.5);
  ctx2d.lineTo(-4, 11.5);
  ctx2d.lineTo(-1, 5);
  ctx2d.bezierCurveTo(-1.5, 7, -4, 9.5, -7, 7.5);
  ctx2d.bezierCurveTo(-13, 3, -10, -3, 0, -11);
  ctx2d.closePath();
  ctx2d.fill();
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
  ctx2d.fillStyle = '#fbbf24';
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
  ctx2d.fillStyle = '#fbbf24';
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
  ctx2d.fillStyle = '#ef4444';
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
    case 'card-spade':
      drawCardSpadeProp(ctx2d, spot);
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
  const pulse = 1 + Math.sin(nowMs * 0.006 + spot.index) * 0.055;
  const age = Math.max(0, nowMs - spot.foundAtMs);
  const popScale = age < 260 ? 0.65 + (age / 260) * 0.42 : 1;

  ctx2d.save();
  ctx2d.translate(x, y);

  // Outer soft emerald glow ring
  ctx2d.beginPath();
  ctx2d.arc(0, 0, rPx * pulse * popScale, 0, Math.PI * 2);
  ctx2d.fillStyle = 'rgba(52, 211, 153, 0.14)';
  ctx2d.fill();
  ctx2d.lineWidth = 4;
  ctx2d.strokeStyle = '#34d399';
  ctx2d.shadowColor = 'rgba(52, 211, 153, 0.85)';
  ctx2d.shadowBlur = 14;
  ctx2d.stroke();

  // Inner gold dashed accent ring
  ctx2d.shadowBlur = 0;
  ctx2d.setLineDash([7, 6]);
  ctx2d.lineWidth = 2;
  ctx2d.strokeStyle = '#fbbf24';
  ctx2d.beginPath();
  ctx2d.arc(0, 0, (rPx - 6) * popScale, 0, Math.PI * 2);
  ctx2d.stroke();
  ctx2d.setLineDash([]);

  // Top-right check badge pill
  const bx = rPx * 0.72;
  const by = -rPx * 0.72;
  ctx2d.beginPath();
  ctx2d.arc(bx, by, 14, 0, Math.PI * 2);
  ctx2d.fillStyle = '#059669';
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
  ctx2d.strokeStyle = `rgba(251, 191, 36, ${(1 - t) * 0.9})`;
  ctx2d.stroke();

  // Rotating dashed gold zone
  ctx2d.translate(x, y);
  ctx2d.rotate(nowMs * 0.0022);
  ctx2d.setLineDash([12, 8]);
  ctx2d.beginPath();
  ctx2d.arc(0, 0, baseR, 0, Math.PI * 2);
  ctx2d.fillStyle = 'rgba(251, 191, 36, 0.12)';
  ctx2d.fill();
  ctx2d.lineWidth = 3.5;
  ctx2d.strokeStyle = '#fbbf24';
  ctx2d.stroke();

  ctx2d.restore();
}

function drawMirrorCrosshair(ctx2d, pointerState, targetSide) {
  if (!pointerState.active || pointerState.side === targetSide) return;
  const x = pointerState.nx * BASE_W;
  const y = pointerState.ny * BASE_H;

  ctx2d.save();
  ctx2d.translate(x, y);

  ctx2d.strokeStyle = 'rgba(34, 211, 238, 0.92)';
  ctx2d.lineWidth = 2.2;
  ctx2d.shadowColor = 'rgba(34, 211, 238, 0.85)';
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
  ctx2d.fillStyle = '#fbbf24';
  ctx2d.fill();

  ctx2d.restore();
}

/* === Main Game Entry Point === */
export function mount(container, ctx) {
  const { stage, targetCount, timeLimitSec, modeLabel } = parseModeConfig(ctx.mode);
  const anomalies = selectRoundAnomalies(ctx.rng, stage, targetCount);

  let isUnmounted = false;
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

  // Render Scoped DOM
  const root = document.createElement('div');
  root.className = 'game-root game-spot';
  root.innerHTML = `
    <div class="sd-toolbar">
      <div class="sd-toolbar__left">
        <span class="sd-stage-badge">
          <span>${stage.titleKo}</span>
          <span class="sd-stage-badge__sub">${targetCount} GLITCHES</span>
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
          <button type="button" class="sd-view-tab" data-sd-view="orig" role="tab" aria-selected="false">원본</button>
          <button type="button" class="sd-view-tab" data-sd-view="mod" role="tab" aria-selected="false">변형</button>
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
            <span>원본 (Original)</span>
          </span>
          <span class="sd-board-sub">ORIGINAL // A</span>
        </header>
        <div class="sd-canvas-wrap" data-sd-wrap="orig">
          <canvas class="sd-canvas" data-sd-canvas="orig" width="${BASE_W}" height="${BASE_H}"></canvas>
          <canvas class="sd-loupe" data-sd-loupe-canvas="orig" width="146" height="146" aria-hidden="true"></canvas>
          <div class="sd-loading" data-sd-loading>스테이지 이미지 로딩 중...</div>
        </div>
      </section>

      <section class="sd-board-card sd-board-card--mod" data-sd-card="mod">
        <header class="sd-board-header">
          <span class="sd-board-label">
            <span class="sd-board-label__dot" aria-hidden="true"></span>
            <span>다른 곳 찾기 (Modified)</span>
          </span>
          <span class="sd-board-sub">MODIFIED // B</span>
        </header>
        <div class="sd-canvas-wrap" data-sd-wrap="mod">
          <canvas class="sd-canvas" data-sd-canvas="mod" width="${BASE_W}" height="${BASE_H}"></canvas>
          <canvas class="sd-loupe" data-sd-loupe-canvas="mod" width="146" height="146" aria-hidden="true"></canvas>
          <div class="sd-loading" data-sd-loading>변형 레이어 생성 중...</div>
        </div>
      </section>
    </div>

    <div class="sd-footer">
      <div class="sd-callout" data-sd-callout data-tone="info">
        <span>👀 좌우 그림에서 다른 부분 ${targetCount}곳을 터치하세요! (어느 쪽을 눌러도 인정)</span>
      </div>
      <span class="sd-shortcuts">단축키: [H] 힌트 · [M] 2.0x 돋보기</span>
    </div>
  `;
  container.appendChild(root);

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
      let marked = 0;
      dotEls.forEach((dot) => {
        if (marked < foundCount) {
          dot.classList.add('is-found');
          dot.textContent = '✓';
          marked += 1;
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
    lCtx.strokeStyle = 'rgba(34, 211, 238, 0.72)';
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

  function spawnFeedback(nx, ny, type, labelText) {
    const now = performance.now();
    if (type === 'hit') {
      const colors = ['#34d399', '#fbbf24', '#22d3ee', '#ffffff'];
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
        y: ny * BASE_H - 28,
        text: labelText,
        color: '#34d399',
        bornAt: now,
        life: 950,
        type: 'hit',
      });
    } else {
      popups.push({
        x: nx * BASE_W,
        y: ny * BASE_H,
        text: labelText,
        color: '#ef4444',
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
    }, 380);
  }

  function triggerHitFlash() {
    origCard?.classList.add('is-hit');
    modCard?.classList.add('is-hit');
    clearTimeout(hitFlashTimerId);
    hitFlashTimerId = window.setTimeout(() => {
      origCard?.classList.remove('is-hit');
      modCard?.classList.remove('is-hit');
    }, 280);
  }

  function finishGame(cleared) {
    if (finished || isUnmounted) return;
    finished = true;
    hideLoupes();
    updateHintBtn();

    const totalInputs = foundCount + wrongTaps;
    const accuracy = totalInputs > 0 ? Math.round((foundCount / totalInputs) * 100) : 0;
    const finalScore = computeScore();
    const elapsedSec = (activePlayMs / 1000).toFixed(1);

    const details = [
      { label: '발견한 차이점', value: `${foundCount} / ${targetCount}` },
      { label: '실제 플레이', value: `${elapsedSec}초` },
      { label: '최대 콤보 / 실수', value: `${maxStreak}콤보 · ${wrongTaps}회` },
      { label: '사용한 힌트', value: `${hintsUsed} / ${MAX_HINTS}회` },
    ];

    ctx.completeGame({
      score: finalScore,
      timeMs: Math.round(activePlayMs),
      accuracy,
      cleared,
      modeLabel,
      details,
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

      const bonusTag = streak >= 2 ? ` (${streak}연속!)` : '';
      spawnFeedback(matchedSpot.x, matchedSpot.y, 'hit', `+600${bonusTag}`);
      setCallout(`✨ 「${matchedSpot.label}」 발견! (${foundCount}/${targetCount})`, 'success');

      if (activeHint && activeHint.spot.id === matchedSpot.id) {
        activeHint = null;
      }

      if (foundCount >= targetCount) {
        updateHintBtn();
        // Brief 420ms celebration window so player sees the final emerald ring & sparkle
        finished = true;
        hideLoupes();
        finishTimerId = window.setTimeout(() => {
          if (isUnmounted) return;
          const totalInputs = foundCount + wrongTaps;
          const accuracy = totalInputs > 0 ? Math.round((foundCount / totalInputs) * 100) : 0;
          ctx.completeGame({
            score: computeScore(),
            timeMs: Math.round(activePlayMs),
            accuracy,
            cleared: true,
            modeLabel,
            details: [
              { label: '발견한 차이점', value: `${foundCount} / ${targetCount}` },
              { label: '실제 플레이', value: `${(activePlayMs / 1000).toFixed(1)}초` },
              { label: '최대 콤보 / 실수', value: `${maxStreak}콤보 · ${wrongTaps}회` },
              { label: '사용한 힌트', value: `${hintsUsed} / ${MAX_HINTS}회` },
            ],
          });
        }, 420);
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
    cooldownUntilMs = now + COOLDOWN_MS;
    remainingSec = Math.max(0, remainingSec - PENALTY_SEC);

    ctx.audio.playError();
    triggerShake();
    spawnFeedback(nx, ny, 'miss', '+3초 페널티!');
    setCallout(`❌ 다른 곳이 아니에요! (-${PENALTY_SEC.toFixed(0)}초 페널티)`, 'error');
    syncHud();

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
      let order = 0;
      for (const spot of anomalies) {
        if (spot.found) {
          order += 1;
          drawFoundMarker(targetCtx, spot, nowMs, order);
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
          targetCtx.strokeStyle = '#ef4444';
          targetCtx.lineWidth = 5;
          targetCtx.lineCap = 'round';
          targetCtx.beginPath();
          targetCtx.moveTo(pop.x - 14, pop.y - 14);
          targetCtx.lineTo(pop.x + 14, pop.y + 14);
          targetCtx.moveTo(pop.x + 14, pop.y - 14);
          targetCtx.lineTo(pop.x - 14, pop.y + 14);
          targetCtx.stroke();
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
  }

  function frame(nowMs) {
    if (isUnmounted) return;
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
        return;
      }
    }

    // Prune expired particles & popups
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (nowMs - particles[i].bornAt >= particles[i].life) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      if (nowMs - popups[i].bornAt >= popups[i].life) popups.splice(i, 1);
    }

    renderBoards(nowMs);
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
      }
    };

    const onPointerCancel = () => {
      touchGesture.active = false;
      hideLoupes();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointercancel', onPointerCancel);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointercancel', onPointerCancel);
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

  const onKeyDown = (e) => {
    if (isPaused || finished) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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

  const onPauseChange = (e) => {
    isPaused = Boolean(e.detail?.paused);
    if (isPaused) {
      hideLoupes();
      pointerMirror.active = false;
    } else {
      lastFrameMs = performance.now();
    }
  };
  window.addEventListener('pm:pausechange', onPauseChange);

  /* === Load Stage Image & Build Original + Modified Buffers === */
  syncHud();
  updateHintBtn();

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if (isUnmounted) return;

    origBaseCtx.clearRect(0, 0, BASE_W, BASE_H);
    origBaseCtx.drawImage(img, 0, 0, BASE_W, BASE_H);

    modBaseCtx.clearRect(0, 0, BASE_W, BASE_H);
    modBaseCtx.drawImage(img, 0, 0, BASE_W, BASE_H);

    // Apply ONLY the N seeded anomalies onto Modified buffer
    for (const spot of anomalies) {
      applyAnomalyToBuffer(modBaseCtx, spot);
    }

    imageReady = true;
    lastFrameMs = performance.now();
    loadingEls.forEach((el) => el.remove());
    renderBoards(lastFrameMs);
    rafId = requestAnimationFrame(frame);
  };

  img.onerror = () => {
    if (isUnmounted) return;
    loadingEls.forEach((el) => {
      el.textContent = '이미지를 불러오지 못했습니다.';
    });
    ctx.ui.showToast('스테이지 이미지를 불러오는 데 실패했습니다.', 'error');
  };

  img.src = stage.imageSrc;

  return {
    unmount() {
      isUnmounted = true;
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
      window.removeEventListener('pm:pausechange', onPauseChange);

      img.onload = null;
      img.onerror = null;
      container.innerHTML = '';
    },
  };
}
