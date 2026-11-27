/**
 * Pixel-level anomaly drawing for 틀린그림찾기: recolouring regions of the right-hand picture,
 * painting small cel-shaded props, and the feathered copy used by photo-set stages.
 * Dark outlines (#1E1824) are preserved so edits blend with the artwork.
 */
import { COLOR } from './palette.js';
import { BASE_H, BASE_W } from './stages.js';

const OUTLINE_COLOR = '#1E1824';

/* === RGB <-> HSL === */
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

/* === Anomalies === */
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

const CEL_PROPS = {
  'camp-bird': drawCampBirdProp,
  'camp-mushroom': drawCampMushroomProp,
};

/** Applies one anomaly (`color-swap` or `cel-prop`) to the modified-picture buffer. */
export function applyAnomalyToBuffer(ctx2d, spot) {
  if (spot.kind === 'color-swap') applyColorSwap(ctx2d, spot);
  else if (spot.kind === 'cel-prop') CEL_PROPS[spot.propType]?.(ctx2d, spot);
}

export function copyBoxFeathered(srcCtx, dstCtx, box, featherPx = 6) {
  const [nx0, ny0, nx1, ny1] = box;
  const x0 = Math.max(0, Math.floor(nx0 * BASE_W));
  const y0 = Math.max(0, Math.floor(ny0 * BASE_H));
  const x1 = Math.min(BASE_W, Math.ceil(nx1 * BASE_W));
  const y1 = Math.min(BASE_H, Math.ceil(ny1 * BASE_H));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return;

  const srcData = srcCtx.getImageData(x0, y0, w, h);
  const dstData = dstCtx.getImageData(x0, y0, w, h);
  const s = srcData.data;
  const d = dstData.data;

  for (let py = 0; py < h; py += 1) {
    let ay = 1;
    if (y0 > 2 && py < featherPx) ay = Math.min(ay, (py + 1) / (featherPx + 1));
    if (y1 < BASE_H - 2 && h - 1 - py < featherPx) ay = Math.min(ay, (h - py) / (featherPx + 1));
    for (let px = 0; px < w; px += 1) {
      let ax = 1;
      if (x0 > 2 && px < featherPx) ax = Math.min(ax, (px + 1) / (featherPx + 1));
      if (x1 < BASE_W - 2 && w - 1 - px < featherPx) ax = Math.min(ax, (w - px) / (featherPx + 1));
      const a = ax * ay;
      const idx = (py * w + px) * 4;
      d[idx] = Math.round(d[idx] + (s[idx] - d[idx]) * a);
      d[idx + 1] = Math.round(d[idx + 1] + (s[idx + 1] - d[idx + 1]) * a);
      d[idx + 2] = Math.round(d[idx + 2] + (s[idx + 2] - d[idx + 2]) * a);
    }
  }
  dstCtx.putImageData(dstData, x0, y0);
}
