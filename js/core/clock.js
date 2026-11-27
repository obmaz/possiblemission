/**
 * Countdown display helpers. Every mini-game owns its own timer element; this module only
 * formats time and avoids touching the DOM when the visible value did not change.
 */

const WARN_SEC = 15;
const DANGER_SEC = 7;

/**
 * Formats the time left: `01:05`, or one decimal below ten seconds (`7.3s`).
 * @param {number} seconds
 * @returns {{ text: string, state: 'normal' | 'warn' | 'danger' }}
 */
export function formatClock(seconds) {
  const sec = Math.max(0, Number(seconds) || 0);
  const state = sec <= DANGER_SEC ? 'danger' : sec <= WARN_SEC ? 'warn' : 'normal';
  if (sec < 10) return { text: `${sec.toFixed(1)}s`, state };
  const whole = Math.ceil(sec);
  const text = `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
  return { text, state };
}

/**
 * Binds a timer element and returns `update(secondsLeft)`. It is safe to call every frame:
 * the text and `data-state` (`normal` | `warn` | `danger`) are only written when they change.
 * @param {HTMLElement | null} el
 * @returns {(seconds: number) => void}
 */
export function bindClock(el) {
  let lastText = '';
  let lastState = '';
  return (seconds) => {
    if (!el) return;
    const { text, state } = formatClock(seconds);
    if (text !== lastText) {
      lastText = text;
      el.textContent = text;
    }
    if (state !== lastState) {
      lastState = state;
      el.dataset.state = state;
    }
  };
}

/**
 * Binds a score element and returns `update(points)` (writes only on change).
 * @param {HTMLElement | null} el
 * @returns {(points: number) => void}
 */
export function bindScore(el) {
  let last = -1;
  return (points) => {
    if (!el) return;
    const pts = Math.max(0, Math.round(Number(points) || 0));
    if (pts === last) return;
    last = pts;
    el.textContent = `${pts.toLocaleString('en-US')}점`;
  };
}
