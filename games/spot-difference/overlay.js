/** Canvas overlay drawing for 틀린그림찾기: found rings, hint radar and the mirrored cursor. */
import { COLOR, withAlpha } from './palette.js';
import { BASE_H, BASE_W } from './stages.js';

export const MIN_HIT_RADIUS = 0.052;
export const HINT_DURATION_MS = 3500;
export const FOUND_ANIM_MS = 1200;

export function drawFoundMarker(ctx2d, spot, nowMs, orderNum) {
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

export function drawHintBeacon(ctx2d, hintState, nowMs) {
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

export function drawMirrorCrosshair(ctx2d, pointerState, targetSide) {
  if (!pointerState.active || pointerState.side === targetSide) return;
  const x = pointerState.nx * BASE_W;
  const y = pointerState.ny * BASE_H;

  ctx2d.save();
  ctx2d.translate(x, y);

  ctx2d.fillStyle = withAlpha(COLOR.accent, 0.28);
  ctx2d.strokeStyle = '#ffffff';
  ctx2d.lineWidth = 2.5;
  ctx2d.shadowColor = withAlpha(COLOR.accent, 0.75);
  ctx2d.shadowBlur = 8;

  ctx2d.beginPath();
  ctx2d.arc(0, 0, 16, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.stroke();

  ctx2d.shadowBlur = 0;
  ctx2d.strokeStyle = withAlpha(COLOR.accent, 0.9);
  ctx2d.lineWidth = 1.5;
  ctx2d.stroke();

  ctx2d.restore();
}

/**
 * Paints the 2× magnifier: a circular crop of `source` centred on the normalized point (nx, ny).
 * `boardWidth` is the on-screen width of the canvas being inspected.
 */
export function drawLoupe(loupeCanvas, source, nx, ny, boardWidth) {
  const lCtx = loupeCanvas.getContext('2d');
  if (!lCtx) return;
  const size = loupeCanvas.width;
  const half = size / 2;
  const zoom = 2.0;
  const span = (size / boardWidth) * (BASE_W / zoom);

  lCtx.clearRect(0, 0, size, size);
  lCtx.save();
  lCtx.beginPath();
  lCtx.arc(half, half, half - 1, 0, Math.PI * 2);
  lCtx.clip();
  lCtx.fillStyle = '#070914';
  lCtx.fillRect(0, 0, size, size);
  lCtx.drawImage(source, nx * BASE_W - span / 2, ny * BASE_H - span / 2, span, span, 0, 0, size, size);

  // Reticle
  lCtx.strokeStyle = withAlpha(COLOR.accent, 0.72);
  lCtx.lineWidth = 1.5;
  lCtx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    lCtx.moveTo(half + dx * 4, half + dy * 4);
    lCtx.lineTo(half + dx * 14, half + dy * 14);
  }
  lCtx.stroke();
  lCtx.restore();
}

/** Hit sparkles plus floating labels (found-difference chips and miss crosses). */
export function drawEffects(g, particles, popups, nowMs) {
  for (const p of particles) {
    const age = nowMs - p.bornAt;
    const t = age / p.life;
    if (t < 0 || t >= 1) continue;
    g.save();
    g.globalAlpha = 1 - t;
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x + p.vx * (age * 0.055), p.y + p.vy * (age * 0.055), p.size * (1 - t * 0.4), 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  for (const pop of popups) {
    const age = nowMs - pop.bornAt;
    const t = age / pop.life;
    if (t < 0 || t >= 1) continue;
    g.save();
    g.globalAlpha = t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3);
    const y = pop.y - t * 32;

    if (pop.type === 'miss') {
      g.strokeStyle = COLOR.danger;
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(pop.x - 14, pop.y - 14);
      g.lineTo(pop.x + 14, pop.y + 14);
      g.moveTo(pop.x + 14, pop.y - 14);
      g.lineTo(pop.x - 14, pop.y + 14);
      g.stroke();
      g.font = '900 22px "Outfit", "Pretendard Variable", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.lineWidth = 5;
      g.strokeStyle = '#070914';
      g.strokeText(pop.text, pop.x, y - 14);
      g.fillStyle = pop.color;
      g.fillText(pop.text, pop.x, y - 14);
    } else {
      // Name chip so players learn what they spotted
      g.font = '800 21px "Pretendard Variable", "Outfit", sans-serif';
      const chipH = 34;
      const chipW = g.measureText(pop.text).width + 26;
      const chipX = Math.max(8, Math.min(BASE_W - chipW - 8, pop.x - chipW / 2));
      const chipY = Math.max(6, y - 14 - chipH + 7);
      g.beginPath();
      if (typeof g.roundRect === 'function') g.roundRect(chipX, chipY, chipW, chipH, 10);
      else g.rect(chipX, chipY, chipW, chipH);
      g.fillStyle = 'rgba(9, 15, 22, 0.9)';
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = withAlpha(COLOR.success, 0.75);
      g.stroke();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ecfdf5';
      g.fillText(pop.text, pop.x, chipY + chipH / 2);
    }
    g.restore();
  }
}
