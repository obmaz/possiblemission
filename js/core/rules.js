/**
 * Cross-game fairness rules (DESIGN_SPEC §5). Every mini-game imports these so a
 * tuning change applies to all games at once instead of drifting per file.
 */

/** Input lock after a wrong click/tap/key, so spam-clicking can't brute-force answers. */
export const WRONG_INPUT_COOLDOWN_MS = 450;

/** Extra normalized hit radius added when `pointerType === 'touch'`. */
export const TOUCH_HIT_SLOP = 0.012;
