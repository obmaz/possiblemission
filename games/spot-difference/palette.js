/**
 * Overlay palette for the canvas boards (found rings, hint radar, cursor, feedback).
 * Defaults match the design tokens and are refreshed from the live CSS variables on mount.
 */
export const COLOR = {
  success: '#3fbf92',
  successDeep: '#1f7a5c',
  gold: '#eeb44a',
  accent: '#38bdf8',
  danger: '#e06767',
};

export function syncPaletteFromTokens(el) {
  const css = getComputedStyle(el);
  const read = (name) => css.getPropertyValue(name).trim();
  COLOR.success = read('--neon-emerald') || COLOR.success;
  COLOR.gold = read('--neon-gold') || COLOR.gold;
  COLOR.accent = read('--neon-cyan') || COLOR.accent;
  COLOR.danger = read('--neon-crimson') || COLOR.danger;
}

/** `#rrggbb` + alpha → rgba() string. */
export function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
