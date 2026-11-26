/**
 * POSSIBLE MISSION — Game 1: 숨은그림찾기 (Hidden Object)
 * Exports mount(container, ctx) -> { unmount() } and deterministic generateStageLayout().
 */
import { pickDispersed, pickSeeded } from '../core/seed.js';
import { WRONG_INPUT_COOLDOWN_MS } from '../core/rules.js';

const SCENE_WIDTH = 1376;
const SCENE_HEIGHT = 768;
const MAX_HINTS = 2;
const MISS_TIME_PENALTY_SEC = 3.0;
const FINISH_DELAY_MS = 460; // let the last found ring play before the result modal
const LONG_PRESS_LOUPE_MS = 180;
const HINT_BEACON_MS = 4000;
const ZOOM_SCALE = 1.6;
const LOUPE_SCALE = 2.0;

/**
 * 18 bespoke cel-shaded inline SVG illustrated props (48x48 viewBox).
 * Uses layered flat+shaded paths with #1a1728 dark outlines and zero global <defs> IDs
 * so every prop renders identically across the scene, target dock, and optical loupe.
 */
export const PROP_LIBRARY = [
  {
    id: 'golden-key',
    name: '황금 열쇠',
    svgBody: `
      <circle cx="15" cy="24" r="9.5" fill="#fbbf24" stroke="#1a1728" stroke-width="2.4"/>
      <circle cx="15" cy="24" r="4" fill="#fef3c7" stroke="#1a1728" stroke-width="2"/>
      <path d="M24 21.5h17.5a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H39v4.5h-4v-4.5h-3.5v3.5h-4v-3.5H24z" fill="#f59e0b" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M11 18.5a5.5 5.5 0 0 1 6-1" fill="none" stroke="#fffbeb" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  {
    id: 'mini-rocket',
    name: '미니 로켓',
    svgBody: `
      <path d="M17 34l-5 6 7-2z" fill="#fb923c" stroke="#1a1728" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M14 27l-5 1 4-6zM21 34l-1 5 6-4z" fill="#ef4444" stroke="#1a1728" stroke-width="2.3" stroke-linejoin="round"/>
      <path d="M18 30c-2-7 5-17 19-21 1 13-9 21-16 19z" fill="#f8fafc" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M29 11c3 0 6 2 8 4-2-4-5-6-8-6z" fill="#ef4444"/>
      <path d="M30 10c3 1 5 3 7 6l4-7z" fill="#ef4444" stroke="#1a1728" stroke-width="2.3" stroke-linejoin="round"/>
      <circle cx="26.5" cy="21.5" r="4" fill="#22d3ee" stroke="#1a1728" stroke-width="2.2"/>
      <circle cx="25.5" cy="20.5" r="1.4" fill="#ecfeff"/>
    `,
  },
  {
    id: 'lucky-dice',
    name: '럭키 주사위',
    svgBody: `
      <rect x="8" y="13" width="24" height="24" rx="5" fill="#f8fafc" stroke="#1a1728" stroke-width="2.4"/>
      <path d="M32 18l8-5v21l-8 5z" fill="#cbd5e1" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M8 15l9-6h22l-7 6z" fill="#e2e8f0" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="14.5" cy="19.5" r="2.2" fill="#ef4444"/>
      <circle cx="25.5" cy="19.5" r="2.2" fill="#1a1728"/>
      <circle cx="20" cy="25" r="2.2" fill="#ef4444"/>
      <circle cx="14.5" cy="30.5" r="2.2" fill="#1a1728"/>
      <circle cx="25.5" cy="30.5" r="2.2" fill="#1a1728"/>
    `,
  },
  {
    id: 'magic-potion',
    name: '마법 포션',
    svgBody: `
      <rect x="20" y="6" width="8" height="6" rx="1.5" fill="#d97706" stroke="#1a1728" stroke-width="2.2"/>
      <path d="M18 12h12v4l-2 2 9 10a9 9 0 0 1-7 14H18a9 9 0 0 1-7-14l9-10-2-2z" fill="#a855f7" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M13 29c3-2 7 1 11 0s7-2 11 0a7.5 7.5 0 0 1-5 11H18a7.5 7.5 0 0 1-5-11z" fill="#22d3ee"/>
      <path d="M16 12h16" stroke="#1a1728" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="20" cy="33" r="2" fill="#ecfeff"/>
      <circle cx="27" cy="35" r="1.5" fill="#ecfeff"/>
      <path d="M15 26l3-5" stroke="#f5d0fe" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  {
    id: 'cassette-tape',
    name: '카세트 테이프',
    svgBody: `
      <rect x="6" y="12" width="36" height="24" rx="3.5" fill="#fb923c" stroke="#1a1728" stroke-width="2.4"/>
      <rect x="10" y="16" width="28" height="12" rx="2" fill="#fef3c7" stroke="#1a1728" stroke-width="2"/>
      <rect x="15" y="19" width="18" height="6" rx="1.5" fill="#334155"/>
      <circle cx="17.5" cy="22" r="2.5" fill="#f8fafc" stroke="#1a1728" stroke-width="1.6"/>
      <circle cx="30.5" cy="22" r="2.5" fill="#f8fafc" stroke="#1a1728" stroke-width="1.6"/>
      <path d="M14 36l2-5h16l2 5z" fill="#475569" stroke="#1a1728" stroke-width="2" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'espresso-cup',
    name: '에스프레소 잔',
    svgBody: `
      <ellipse cx="22" cy="37" rx="14" ry="4" fill="#cbd5e1" stroke="#1a1728" stroke-width="2.2"/>
      <path d="M32 21h4.5a4 4 0 0 1 0 8H32" fill="none" stroke="#1a1728" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M12 18h20v11a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" fill="#f8fafc" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <ellipse cx="22" cy="18" rx="10" ry="3.2" fill="#78350f" stroke="#1a1728" stroke-width="2"/>
      <path d="M18 12c-1-2 1-4 0-6M25 12c-1-2 1-4 0-6" fill="none" stroke="#fef3c7" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  {
    id: 'pixel-trophy',
    name: '픽셀 트로피',
    svgBody: `
      <path d="M13 13H8v7c0 3 2.5 5 5 5M35 13h5v7c0 3-2.5 5-5 5" fill="none" stroke="#1a1728" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M13 10h22v11c0 6-4.5 10-11 10s-11-4-11-10z" fill="#fbbf24" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <rect x="21" y="31" width="6" height="5" fill="#f59e0b" stroke="#1a1728" stroke-width="2.2"/>
      <rect x="15" y="36" width="18" height="5" rx="1.5" fill="#b45309" stroke="#1a1728" stroke-width="2.2"/>
      <path d="M24 14l1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.6-3 1.6.6-3.2-2.4-2.3 3.3-.5z" fill="#fef9c3"/>
    `,
  },
  {
    id: 'paper-plane',
    name: '종이 비행기',
    svgBody: `
      <path d="M6 22l36-13-11 30-9-9z" fill="#f8fafc" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M22 30l20-21-15 24z" fill="#bae6fd" stroke="#1a1728" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M22 30l3 8 5-5" fill="#7dd3fc" stroke="#1a1728" stroke-width="2.2" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'brass-compass',
    name: '나침반',
    svgBody: `
      <circle cx="24" cy="9" r="3" fill="none" stroke="#1a1728" stroke-width="2.2"/>
      <circle cx="24" cy="26" r="15" fill="#fbbf24" stroke="#1a1728" stroke-width="2.4"/>
      <circle cx="24" cy="26" r="11" fill="#ecfeff" stroke="#1a1728" stroke-width="2"/>
      <path d="M24 17l3.5 9-3.5 9-3.5-9z" fill="#1a1728"/>
      <path d="M24 17l3.5 9h-7z" fill="#ef4444" stroke="#1a1728" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="24" cy="26" r="2" fill="#fbbf24"/>
    `,
  },
  {
    id: 'cherry-macaron',
    name: '체리 마카롱',
    svgBody: `
      <path d="M9 21c0-6 6.5-10 15-10s15 4 15 10z" fill="#f43f8e" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <rect x="8" y="21" width="32" height="6" rx="3" fill="#fef3c7" stroke="#1a1728" stroke-width="2.2"/>
      <path d="M9 27h30c0 5.5-6.5 9.5-15 9.5S9 32.5 9 27z" fill="#fb7185" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M15 15c3-2 7-2.5 11-2" fill="none" stroke="#fbcfe8" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="24" cy="10" r="3.5" fill="#e11d48" stroke="#1a1728" stroke-width="2"/>
    `,
  },
  {
    id: 'royal-crown',
    name: '미니 왕관',
    svgBody: `
      <path d="M7 33L9 15l8 8 7-11 7 11 8-8 2 18z" fill="#fbbf24" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <rect x="8" y="33" width="32" height="6" rx="2" fill="#f59e0b" stroke="#1a1728" stroke-width="2.4"/>
      <circle cx="24" cy="26" r="3" fill="#22d3ee" stroke="#1a1728" stroke-width="1.8"/>
      <circle cx="15" cy="27" r="2" fill="#f43f8e"/>
      <circle cx="33" cy="27" r="2" fill="#f43f8e"/>
      <circle cx="24" cy="11" r="2.2" fill="#fef08a" stroke="#1a1728" stroke-width="1.8"/>
    `,
  },
  {
    id: 'loupe-charm',
    name: '황동 돋보기',
    svgBody: `
      <path d="M29 29l11 11" stroke="#1a1728" stroke-width="8.4" stroke-linecap="round"/>
      <path d="M29 29l11 11" stroke="#b45309" stroke-width="4.2" stroke-linecap="round"/>
      <circle cx="20" cy="20" r="12.5" fill="#fbbf24" stroke="#1a1728" stroke-width="2.4"/>
      <circle cx="20" cy="20" r="8.5" fill="#a5f3fc" stroke="#1a1728" stroke-width="2"/>
      <path d="M15 16a6 6 0 0 1 6-2" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
    `,
  },
  {
    id: 'ruby-gem',
    name: '루비 보석',
    svgBody: `
      <polygon points="15,10 33,10 41,20 24,40 7,20" fill="#f43f5e" stroke="#1a1728" stroke-width="2.4" stroke-linejoin="round"/>
      <polygon points="15,10 33,10 29,20 19,20" fill="#fda4af"/>
      <polygon points="19,20 29,20 24,40" fill="#e11d48"/>
      <path d="M7 20h34M15 10l4 10 5 20M33 10l-4 10-5 20" fill="none" stroke="#1a1728" stroke-width="1.8" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'bolt-badge',
    name: '번개 배지',
    svgBody: `
      <circle cx="24" cy="24" r="16.5" fill="#1e293b" stroke="#1a1728" stroke-width="2.4"/>
      <circle cx="24" cy="24" r="13" fill="#0f172a" stroke="#22d3ee" stroke-width="2"/>
      <polygon points="26,10 15,26 23,26 21,38 33,22 25,22" fill="#fde047" stroke="#1a1728" stroke-width="2.2" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'retro-gamepad',
    name: '레트로 게임패드',
    svgBody: `
      <rect x="6" y="15" width="36" height="20" rx="9" fill="#e2e8f0" stroke="#1a1728" stroke-width="2.4"/>
      <path d="M15 21v8M11 25h8" stroke="#1a1728" stroke-width="3" stroke-linecap="round"/>
      <circle cx="31" cy="23" r="2.2" fill="#f43f8e" stroke="#1a1728" stroke-width="1.4"/>
      <circle cx="35.5" cy="26.5" r="2.2" fill="#22d3ee" stroke="#1a1728" stroke-width="1.4"/>
      <rect x="21" y="25" width="5" height="2.4" rx="1" fill="#475569"/>
    `,
  },
  {
    id: 'hourglass',
    name: '모래시계',
    svgBody: `
      <rect x="12" y="7" width="24" height="4.5" rx="1.5" fill="#d97706" stroke="#1a1728" stroke-width="2.2"/>
      <rect x="12" y="36.5" width="24" height="4.5" rx="1.5" fill="#d97706" stroke="#1a1728" stroke-width="2.2"/>
      <path d="M15 11.5h18c0 7-6 10.5-9 12.5 3 2 9 5.5 9 12.5H15c0-7 6-10.5 9-12.5-3-2-9-5.5-9-12.5z" fill="#e0f2fe" stroke="#1a1728" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M17.5 35.5c1-4 4-6 6.5-6s5.5 2 6.5 6z" fill="#fbbf24"/>
      <path d="M18.5 16h11c-.8 2.5-3 4.2-5.5 5-2.5-.8-4.7-2.5-5.5-5z" fill="#fbbf24"/>
    `,
  },
  {
    id: 'neon-headphones',
    name: '네온 헤드폰',
    svgBody: `
      <path d="M11 26v-3a13 13 0 0 1 26 0v3" fill="none" stroke="#1a1728" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M11 26v-3a13 13 0 0 1 26 0v3" fill="none" stroke="#22d3ee" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="7" y="24" width="8" height="14" rx="3.5" fill="#a855f7" stroke="#1a1728" stroke-width="2.3"/>
      <rect x="33" y="24" width="8" height="14" rx="3.5" fill="#a855f7" stroke="#1a1728" stroke-width="2.3"/>
      <rect x="12" y="26" width="3" height="10" rx="1.5" fill="#f43f8e"/>
      <rect x="33" y="26" width="3" height="10" rx="1.5" fill="#f43f8e"/>
    `,
  },
  {
    id: 'star-donut',
    name: '별 도넛',
    svgBody: `
      <circle cx="24" cy="24" r="15" fill="#f59e0b" stroke="#1a1728" stroke-width="2.4"/>
      <path d="M10 23c2-7 8-12 14-12 7 0 13 5 14 12-2 2-5 1-7 3-2 2-5 1-7 0s-4 2-7 1-5-2-7-4z" fill="#f472b6" stroke="#1a1728" stroke-width="2"/>
      <circle cx="24" cy="24" r="5" fill="#090d1f" stroke="#1a1728" stroke-width="2.2"/>
      <circle cx="17" cy="17" r="1.5" fill="#fef08a"/>
      <circle cx="30" cy="16" r="1.5" fill="#22d3ee"/>
      <circle cx="32" cy="22" r="1.5" fill="#ffffff"/>
    `,
  },
];

/**
 * Measured art bounds of every prop inside its 48×48 viewBox: [x0, y0, x1, y1].
 * Used to rest a prop's real bottom edge on a surface and to centre its hitbox.
 */
const PROP_BOX = {
  'golden-key': [5.5, 14.5, 43.5, 33.5],
  'mini-rocket': [9, 9, 41, 40],
  'lucky-dice': [8, 9, 40, 39],
  'magic-potion': [9.5, 6, 38.5, 42],
  'cassette-tape': [6, 12, 42, 36],
  'espresso-cup': [8, 6, 40.5, 41],
  'pixel-trophy': [8, 10, 40, 41],
  'paper-plane': [6, 9, 42, 39],
  'brass-compass': [9, 6, 39, 41],
  'cherry-macaron': [8, 6.5, 40, 36.5],
  'royal-crown': [7, 8.8, 41, 39],
  'loupe-charm': [7.5, 7.5, 40, 40],
  'ruby-gem': [7, 10, 41, 40],
  'bolt-badge': [7.5, 7.5, 40.5, 40.5],
  'retro-gamepad': [6, 15, 42, 35],
  hourglass: [12, 7, 36, 41],
  'neon-headphones': [7, 10, 41, 38],
  'star-donut': [9, 9, 39, 39],
};

/** Base scale applied on top of each spot's perspective scale. */
const PROP_BASE_SCALE = 1.3;

/**
 * Stage scenes. Props are hidden ON real surfaces (shelves, tables, sofa seats, floor)
 * so they read as part of the room instead of stickers floating over walls and windows.
 *
 * - `props`: only items that belong in that room AND are not already drawn in the art
 *   (the lounge already has mugs, dice, headphones and a rocket; the observatory has
 *   potions, crystals, a compass and a star trophy), so players never tap the
 *   background's own copy and eat a penalty.
 * - spot `x, y`: the point on the surface where the prop's bottom edge rests
 *   (normalised to the art). `scale` follows the scene's perspective.
 * - `pinned`: hung on a board (centred, no contact shadow); `only` limits which props fit.
 */
export const STAGES = {
  stage1: {
    key: 'stage1',
    title: '크리에이티브 오피스 대소동',
    shortTitle: '라운지',
    subEn: 'CREATIVE LOUNGE',
    image: './assets/images/hidden-workshop.jpg',
    // Warm window light: pull the flat prop colours toward the room's amber grade
    propFilter: 'saturate(0.86) sepia(0.14) brightness(0.97)',
    props: [
      'cassette-tape', 'retro-gamepad', 'paper-plane', 'cherry-macaron', 'star-donut', 'golden-key',
      'hourglass', 'pixel-trophy', 'loupe-charm', 'bolt-badge', 'brass-compass', 'royal-crown',
    ],
    spots: [
      { id: 's1-shelf-top', x: 0.16, y: 0.125, scale: 0.6 },
      { id: 's1-sill', x: 0.362, y: 0.547, scale: 0.7 },
      { id: 's1-arcade-top', x: 0.61, y: 0.31, scale: 0.68 },
      { id: 's1-espresso-top', x: 0.163, y: 0.655, scale: 0.78 },
      { id: 's1-counter', x: 0.1, y: 0.915, scale: 1.05 },
      { id: 's1-sofa-seat', x: 0.47, y: 0.718, scale: 0.88 },
      { id: 's1-floor-sofa', x: 0.47, y: 0.87, scale: 0.98 },
      { id: 's1-table-end', x: 0.643, y: 0.758, scale: 0.82 },
      { id: 's1-table-under', x: 0.585, y: 0.835, scale: 0.7 },
      { id: 's1-rug', x: 0.63, y: 0.905, scale: 1.0 },
      { id: 's1-desk-left', x: 0.668, y: 0.59, scale: 0.7 },
      { id: 's1-desk-front', x: 0.8, y: 0.745, scale: 0.85 },
      { id: 's1-board', x: 0.885, y: 0.3, scale: 0.62, rotDeg: 8, pinned: true, only: ['bolt-badge', 'paper-plane'] },
    ],
  },
  stage2: {
    key: 'stage2',
    title: '궤도 천문대 라운지',
    shortTitle: '관측소',
    subEn: 'ORBITAL OBSERVATORY',
    image: './assets/images/hidden-space.jpg',
    // Dim teal/violet cabin light
    propFilter: 'saturate(0.84) hue-rotate(-6deg) brightness(0.9)',
    props: [
      'hourglass', 'royal-crown', 'mini-rocket', 'espresso-cup', 'lucky-dice', 'star-donut',
      'cherry-macaron', 'neon-headphones', 'retro-gamepad', 'cassette-tape', 'paper-plane', 'golden-key',
    ],
    spots: [
      { id: 's2-back-counter', x: 0.322, y: 0.594, scale: 0.62 },
      { id: 's2-sofa-left', x: 0.3, y: 0.705, scale: 0.85 },
      { id: 's2-floor-holo', x: 0.43, y: 0.77, scale: 0.85 },
      { id: 's2-pit-shelf', x: 0.495, y: 0.825, scale: 0.7 },
      { id: 's2-wall-shelf', x: 0.69, y: 0.522, scale: 0.55 },
      { id: 's2-right-alcove', x: 0.775, y: 0.553, scale: 0.55 },
      { id: 's2-round-table', x: 0.705, y: 0.662, scale: 0.6 },
      { id: 's2-back-sofa', x: 0.755, y: 0.628, scale: 0.65 },
      { id: 's2-pouf', x: 0.672, y: 0.85, scale: 0.85 },
      { id: 's2-front-table', x: 0.818, y: 0.84, scale: 0.75 },
      { id: 's2-right-sofa', x: 0.905, y: 0.885, scale: 0.95 },
    ],
  },
};

/**
 * Parses `ctx.mode` into stage config, difficulty, item count, and time limit.
 * Supports canonical modes (`stage1-normal`, `stage1-hard`, `stage2-normal`, `stage2-hard`)
 * plus bare `normal` / `hard` fallbacks.
 * @param {string} mode
 */
export function parseModeConfig(mode) {
  const raw = String(mode || 'stage1-normal').toLowerCase();
  const stageKey = raw.includes('stage2') ? 'stage2' : 'stage1';
  const isHard = raw.includes('hard');
  const stage = STAGES[stageKey];
  const targetCount = isHard ? 10 : 7;
  const timeLimitSec = isHard ? 90 : 75;
  const diffLabel = isHard ? '하드' : '노말';

  return {
    stage,
    stageKey,
    isHard,
    targetCount,
    timeLimitSec,
    diffLabel,
    modeLabel: `${stage.shortTitle} · ${diffLabel}`,
  };
}

/**
 * Places one prop on one spot: returns the SVG transform plus the visual centre
 * (normalised) and hit radius (scene px) used by tap tests, hints and FX.
 */
export function placeProp(prop, spot) {
  const [x0, y0, x1, y1] = PROP_BOX[prop.id] || [6, 6, 42, 42];
  const s = spot.scale * PROP_BASE_SCALE;
  const rot = spot.rotDeg || 0;
  const boxCx = (x0 + x1) / 2;
  const boxCy = (y0 + y1) / 2;
  const anchorY = spot.pinned ? boxCy : y1;
  const baseX = spot.x * SCENE_WIDTH;
  const baseY = spot.y * SCENE_HEIGHT;
  const centerY = baseY - (anchorY - boxCy) * s;
  const halfSize = (Math.max(x1 - x0, y1 - y0) / 2) * s;
  return {
    transform: `translate(${baseX.toFixed(1)}, ${baseY.toFixed(1)}) rotate(${rot}) scale(${s.toFixed(3)}) translate(${(-boxCx).toFixed(1)}, ${(-anchorY).toFixed(1)})`,
    // Soft contact shadow under resting props, in the prop's own viewBox units
    shadow: spot.pinned
      ? ''
      : `<ellipse class="ho-prop-shadow" cx="${boxCx}" cy="${y1}" rx="${((x1 - x0) * 0.44).toFixed(1)}" ry="${((x1 - x0) * 0.1).toFixed(1)}"/>`,
    x: spot.x,
    y: centerY / SCENE_HEIGHT,
    hitRadiusPx: Math.max(26, halfSize + 12),
  };
}

/**
 * Deterministically builds the hidden target layout using `ctx.rng`.
 * Identical `(seed, mode)` inputs always yield identical items at identical spots.
 * @param {() => number} rng
 * @param {string} mode
 */
export function generateStageLayout(rng, mode) {
  const config = parseModeConfig(mode);
  const { stage, targetCount } = config;
  const stageProps = stage.props.map((id) => PROP_LIBRARY.find((p) => p.id === id)).filter(Boolean);
  const pickedProps = pickSeeded(rng, stageProps, targetCount);
  const pickedIds = new Set(pickedProps.map((p) => p.id));

  // A restricted spot (e.g. the cork board) is only eligible if a fitting prop was picked
  const eligibleSpots = stage.spots.filter((spot) => !spot.only || spot.only.some((id) => pickedIds.has(id)));
  const pickedSpots = pickDispersed(rng, eligibleSpots, targetCount, 0.12);

  // Fill restricted spots first so a fitting prop is still available for them
  const orderedSpots = [...pickedSpots].sort((a, b) => Number(Boolean(b.only)) - Number(Boolean(a.only)));
  const remaining = [...pickedProps];
  const items = [];
  for (const spot of orderedSpots) {
    const idx = remaining.findIndex((prop) => !spot.only || spot.only.includes(prop.id));
    if (idx < 0) continue;
    const [prop] = remaining.splice(idx, 1);
    items.push({ ...prop, spotId: spot.id, ...placeProp(prop, spot), found: false });
  }
  // Dock order follows the seeded prop pick, not the spot fill order
  const pickOrder = new Map(pickedProps.map((p, i) => [p.id, i]));
  items.sort((a, b) => pickOrder.get(a.id) - pickOrder.get(b.id));

  return { config, items };
}

/**
 * Computes score according to the arcade grading formula.
 */
function computeScore({ foundCount, targetCount, remainingSec, maxStreak, hintsUsed, wrongTaps, cleared }) {
  const base = foundCount * 500;
  const timeBonus = cleared && foundCount === targetCount ? Math.round(Math.max(0, remainingSec) * 45) : 0;
  const streakBonus = maxStreak * 100;
  const perfectBonus = cleared && foundCount === targetCount && wrongTaps === 0 && hintsUsed === 0 ? 1000 : 0;
  const penalty = hintsUsed * 250 + wrongTaps * 50;
  return Math.max(0, base + timeBonus + streakBonus + perfectBonus - penalty);
}

/**
 * Mounts Hidden Object inside `#game-stage`.
 * @param {HTMLElement} container
 * @param {object} ctx
 * @returns {{ unmount: () => void }}
 */
export function mount(container, ctx) {
  const { config, items } = generateStageLayout(ctx.rng, ctx.mode);
  const { stage, targetCount, timeLimitSec, diffLabel, modeLabel } = config;

  let remainingSec = timeLimitSec;
  let activeElapsedMs = 0;
  let foundCount = 0;
  let streak = 0;
  let maxStreak = 0;
  let wrongTaps = 0;
  let hintsUsed = 0;
  let isPaused = false;
  let roundLocked = false;
  let finished = false;
  let unmounted = false;
  let cooldownUntil = 0;
  let lastCountdownBeepSec = null;
  let lastTapNorm = { x: 0.5, y: 0.5 };

  // Loupe & 1.6x Zoom state
  let loupeEnabled = true;
  let zoomEnabled = false;
  let panX = 0;
  let panY = 0;
  let frameW = 0;
  let frameH = 0;

  // Pointer gesture tracking
  let activePointer = null;
  let longPressTimerId = 0;
  let hintClearTimerId = 0;
  let finishDelayTimerId = 0;
  let shakeTimerId = 0;
  let rafId = 0;
  let lastFrameNow = performance.now();
  const pendingTimers = new Set();

  const registerTimeout = (fn, ms) => {
    const id = window.setTimeout(() => {
      pendingTimers.delete(id);
      if (!unmounted) fn();
    }, ms);
    pendingTimers.add(id);
    return id;
  };

  // Build root DOM
  const root = document.createElement('div');
  root.className = 'game-root game-hidden';

  const propGroupMarkup = (idSuffix = '') =>
    items
      .map(
        (item) => `
          <g transform="${item.transform}">
            <g class="ho-prop-node" data-prop-id="${item.id}${idSuffix}">${item.shadow}${item.svgBody}</g>
          </g>
        `
      )
      .join('');

  root.innerHTML = `
    <div class="ho-toolbar">
      <div class="ho-stage-info">
        <span class="ho-stage-badge">🔍 ${stage.title}</span>
        <span class="ho-stage-sub">${stage.subEn} · ${diffLabel} (${targetCount}개)</span>
        <span class="ho-shortcuts">H 힌트 · M 돋보기 · Z 확대</span>
        <span class="ho-streak-pill" data-ho-streak>🔥 x0 COMBO</span>
      </div>
      <div class="ho-controls">
        <button type="button" class="ho-tool-btn" data-ho-hint>
          <span>💡 힌트</span>
          <span class="ho-hint-count" data-ho-hint-left>${MAX_HINTS}/${MAX_HINTS} 무료</span>
          <span class="ho-key-cap">H</span>
        </button>
        <button type="button" class="ho-tool-btn ${loupeEnabled ? 'is-active' : ''}" data-ho-loupe aria-pressed="${loupeEnabled}">
          <span>🔍 돋보기</span>
          <span class="ho-key-cap">M</span>
        </button>
        <button type="button" class="ho-tool-btn ho-tool-btn--zoom" data-ho-zoom aria-pressed="false" aria-label="1.6x 확대">
          <span aria-hidden="true">🔎</span>
          <span>확대</span>
        </button>
      </div>
    </div>

    <div class="ho-viewport" data-ho-viewport>
      <div class="ho-stage-frame" data-ho-frame>
        <div class="ho-scene-transform" data-ho-transform>
          <img class="ho-bg-img" src="${stage.image}" alt="${stage.title} 배경" draggable="false" />
          <svg class="ho-props-layer" style="filter: ${stage.propFilter}" viewBox="0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
            ${propGroupMarkup('')}
          </svg>
          <div class="ho-fx-layer" data-ho-fx></div>
        </div>

        <div class="ho-zoom-pill" data-ho-zoom-pill hidden>1.6x 확대 · 드래그로 이동</div>

        <div class="ho-loupe" data-ho-loupe-lens hidden aria-hidden="true">
          <div class="ho-loupe__world" data-ho-loupe-world>
            <img class="ho-bg-img" src="${stage.image}" alt="" draggable="false" />
            <svg class="ho-props-layer" style="filter: ${stage.propFilter}" viewBox="0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}" preserveAspectRatio="none">
              ${propGroupMarkup('-loupe')}
            </svg>
          </div>
          <div class="ho-loupe__reticle"></div>
          <span class="ho-loupe__tag">2.0x</span>
        </div>
      </div>
    </div>

    <div class="ho-dock" aria-label="찾아야 할 아이템 목록">
      <div class="ho-dock__progress" role="progressbar" aria-label="발견 진행도" aria-valuemin="0" aria-valuemax="${targetCount}" aria-valuenow="0" data-ho-dock-progress>
        <span class="ho-dock__progress-fill" data-ho-dock-progress-fill></span>
      </div>
      <div class="ho-dock__header">
        <span class="ho-dock__title" data-ho-dock-title>찾을 물건 ${targetCount}개 · 0/${targetCount} 발견</span>
        <span class="ho-dock__tip">모바일: 꾹 누르면 2.0x 루페 · 오답 시 -${MISS_TIME_PENALTY_SEC}초 페널티!</span>
      </div>
      <div class="ho-dock__list" data-ho-dock data-count="${targetCount}">
        ${items
          .map(
            (item) => `
            <div class="ho-target-card" data-dock-id="${item.id}">
              <div class="ho-target-card__icon">
                <svg viewBox="0 0 48 48" aria-hidden="true">${item.svgBody}</svg>
              </div>
              <span class="ho-target-card__name">${item.name}</span>
              <span class="ho-target-card__check" aria-hidden="true">✓</span>
            </div>
          `
          )
          .join('')}
      </div>
    </div>
  `;

  container.appendChild(root);

  // Cache DOM refs
  const viewportEl = root.querySelector('[data-ho-viewport]');
  const frameEl = root.querySelector('[data-ho-frame]');
  const transformEl = root.querySelector('[data-ho-transform]');
  const fxEl = root.querySelector('[data-ho-fx]');
  const loupeEl = root.querySelector('[data-ho-loupe-lens]');
  const loupeWorldEl = root.querySelector('[data-ho-loupe-world]');
  const zoomPillEl = root.querySelector('[data-ho-zoom-pill]');
  const streakEl = root.querySelector('[data-ho-streak]');
  const hintBtn = root.querySelector('[data-ho-hint]');
  const hintLeftEl = root.querySelector('[data-ho-hint-left]');
  const zoomBtn = root.querySelector('[data-ho-zoom]');
  const loupeBtn = root.querySelector('[data-ho-loupe]');
  const dockTitleEl = root.querySelector('[data-ho-dock-title]');
  const dockProgressEl = root.querySelector('[data-ho-dock-progress]');
  const dockProgressFillEl = root.querySelector('[data-ho-dock-progress-fill]');

  // Dock found/total summary + progress bar
  const syncDockState = () => {
    if (dockTitleEl) {
      dockTitleEl.textContent = `찾을 물건 ${targetCount}개 · ${foundCount}/${targetCount} 발견`;
    }
    if (dockProgressEl) dockProgressEl.setAttribute('aria-valuenow', String(foundCount));
    if (dockProgressFillEl) dockProgressFillEl.style.width = `${(foundCount / targetCount) * 100}%`;
  };

  // Sync HUD helper
  const syncHud = () => {
    if (finished || unmounted) return;
    const liveScore = computeScore({
      foundCount,
      targetCount,
      remainingSec,
      maxStreak,
      hintsUsed,
      wrongTaps,
      cleared: false,
    });
    const hintsLeft = MAX_HINTS - hintsUsed;
    ctx.updateHud({
      timer: remainingSec,
      score: liveScore,
      progress: `${foundCount} / ${targetCount}`,
      progressRatio: foundCount / targetCount,
      extra: streak >= 2 ? `🔥 x${streak} COMBO` : `힌트 ${hintsLeft}회`,
    });

    if (streakEl) {
      streakEl.textContent = `🔥 x${streak} COMBO`;
      streakEl.classList.toggle('is-active', streak >= 2);
    }
  };

  // Aspect-ratio lock sizing via ResizeObserver
  const updateFrameGeometry = () => {
    if (!viewportEl || !frameEl) return;
    const vw = viewportEl.clientWidth;
    const vh = viewportEl.clientHeight;
    if (vw <= 0 || vh <= 0) return;

    const targetAspect = SCENE_WIDTH / SCENE_HEIGHT;
    let w = vw;
    let h = w / targetAspect;
    if (h > vh) {
      h = vh;
      w = h * targetAspect;
    }
    frameW = Math.max(200, Math.floor(w));
    frameH = Math.max(112, Math.floor(h));
    frameEl.style.width = `${frameW}px`;
    frameEl.style.height = `${frameH}px`;

    applySceneTransform();
  };

  const clampPan = (nx, ny) => {
    if (!zoomEnabled || frameW <= 0 || frameH <= 0) return { x: 0, y: 0 };
    const minX = -frameW * (ZOOM_SCALE - 1);
    const minY = -frameH * (ZOOM_SCALE - 1);
    return {
      x: Math.max(minX, Math.min(0, nx)),
      y: Math.max(minY, Math.min(0, ny)),
    };
  };

  const applySceneTransform = () => {
    if (!transformEl) return;
    if (!zoomEnabled) {
      panX = 0;
      panY = 0;
      transformEl.style.transform = 'translate3d(0px, 0px, 0) scale(1)';
    } else {
      const clamped = clampPan(panX, panY);
      panX = clamped.x;
      panY = clamped.y;
      transformEl.style.transform = `translate3d(${panX.toFixed(1)}px, ${panY.toFixed(1)}px, 0) scale(${ZOOM_SCALE})`;
    }
    frameEl?.classList.toggle('is-zoomed', zoomEnabled);
    if (zoomPillEl) zoomPillEl.hidden = !zoomEnabled;
  };

  const setZoom = (enabled, focusNorm = lastTapNorm) => {
    zoomEnabled = Boolean(enabled);
    if (zoomEnabled && frameW > 0 && frameH > 0) {
      panX = -frameW * (ZOOM_SCALE - 1) * focusNorm.x;
      panY = -frameH * (ZOOM_SCALE - 1) * focusNorm.y;
    }
    applySceneTransform();
    zoomBtn?.classList.toggle('is-active', zoomEnabled);
    zoomBtn?.setAttribute('aria-pressed', String(zoomEnabled));
    hideLoupe();
  };

  const hideLoupe = () => {
    if (loupeEl) loupeEl.hidden = true;
  };

  const positionLoupe = (clientX, clientY, isTouch) => {
    if (!loupeEl || !loupeWorldEl || !frameEl || !transformEl || frameW <= 0 || frameH <= 0) return;
    const frameRect = frameEl.getBoundingClientRect();
    const transRect = transformEl.getBoundingClientRect();
    if (transRect.width <= 0 || transRect.height <= 0) return;

    // Normalized point under pointer
    const nx = (clientX - transRect.left) / transRect.width;
    const ny = (clientY - transRect.top) / transRect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
      hideLoupe();
      return;
    }

    const localX = clientX - frameRect.left;
    const localY = clientY - frameRect.top;

    // Offset lens upward on touch so finger doesn't cover the center
    let lensX = localX;
    let lensY = localY;
    if (isTouch) {
      lensY = localY < 105 ? localY + 78 : localY - 78;
      lensX = Math.max(66, Math.min(frameW - 66, lensX));
      lensY = Math.max(66, Math.min(frameH - 66, lensY));
    }

    loupeEl.style.left = `${lensX.toFixed(1)}px`;
    loupeEl.style.top = `${lensY.toFixed(1)}px`;
    loupeEl.hidden = false;

    const fallbackRadius = window.innerWidth <= 767 ? 63 : 73;
    const lensRadius = loupeEl.offsetWidth ? loupeEl.offsetWidth / 2 : fallbackRadius;
    const effectiveZoom = zoomEnabled ? ZOOM_SCALE * 1.55 : LOUPE_SCALE;
    const worldW = frameW * effectiveZoom;
    const worldH = frameH * effectiveZoom;

    loupeWorldEl.style.width = `${worldW.toFixed(1)}px`;
    loupeWorldEl.style.height = `${worldH.toFixed(1)}px`;
    const tx = lensRadius - nx * worldW;
    const ty = lensRadius - ny * worldH;
    loupeWorldEl.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
  };

  // Visual FX helpers
  const spawnFoundFx = (item) => {
    if (!fxEl) return;
    const leftPct = `${(item.x * 100).toFixed(2)}%`;
    const topPct = `${(item.y * 100).toFixed(2)}%`;

    const ring = document.createElement('div');
    ring.className = 'ho-found-ring';
    ring.style.left = leftPct;
    ring.style.top = topPct;
    fxEl.appendChild(ring);
    registerTimeout(() => ring.remove(), 700);

    const badge = document.createElement('div');
    badge.className = 'ho-found-badge';
    badge.style.left = leftPct;
    badge.style.top = topPct;
    badge.textContent = streak >= 2 ? `+500 · x${streak}!` : '+500';
    fxEl.appendChild(badge);
    registerTimeout(() => badge.remove(), 950);

    const colors = ['#34d399', '#22d3ee', '#fbbf24', '#f8fafc'];
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      const dist = 24 + (i % 3) * 12;
      const dot = document.createElement('div');
      dot.className = 'ho-sparkle';
      dot.style.left = leftPct;
      dot.style.top = topPct;
      dot.style.backgroundColor = colors[i % colors.length];
      dot.style.setProperty('--dx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
      dot.style.setProperty('--dy', `${(Math.sin(angle) * dist).toFixed(1)}px`);
      fxEl.appendChild(dot);
      registerTimeout(() => dot.remove(), 620);
    }
  };

  const spawnMissFx = (nx, ny) => {
    if (!fxEl) return;
    const leftPct = `${(nx * 100).toFixed(2)}%`;
    const topPct = `${(ny * 100).toFixed(2)}%`;

    const ripple = document.createElement('div');
    ripple.className = 'ho-miss-ripple';
    ripple.style.left = leftPct;
    ripple.style.top = topPct;
    fxEl.appendChild(ripple);
    registerTimeout(() => ripple.remove(), 550);

    const label = document.createElement('div');
    label.className = 'ho-miss-label';
    label.style.left = leftPct;
    label.style.top = topPct;
    label.textContent = `-${MISS_TIME_PENALTY_SEC}초 페널티!`;
    fxEl.appendChild(label);
    registerTimeout(() => label.remove(), 980);

    if (frameEl) {
      frameEl.classList.remove('is-shake');
      void frameEl.offsetWidth;
      frameEl.classList.add('is-shake');
      window.clearTimeout(shakeTimerId);
      shakeTimerId = registerTimeout(() => frameEl.classList.remove('is-shake'), 340);
    }
  };

  const clearHintBeacon = () => {
    fxEl?.querySelectorAll('.ho-hint-beacon').forEach((el) => el.remove());
    root.querySelectorAll('.ho-target-card.is-hinted').forEach((el) => el.classList.remove('is-hinted'));
  };

  const finishRound = (cleared) => {
    if (finished || unmounted) return;
    finished = true;
    hideLoupe();
    clearHintBeacon();
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    const totalInputs = foundCount + wrongTaps;
    const accuracy = totalInputs > 0 ? Math.round((foundCount / totalInputs) * 100) : 0;
    const finalScore = computeScore({
      foundCount,
      targetCount,
      remainingSec,
      maxStreak,
      hintsUsed,
      wrongTaps,
      cleared,
    });

    ctx.completeGame({
      score: finalScore,
      timeMs: activeElapsedMs,
      accuracy,
      cleared,
      modeLabel,
      details: [
        { label: '발견 오브젝트', value: `${foundCount} / ${targetCount}개` },
        { label: '플레이 시간', value: `${(activeElapsedMs / 1000).toFixed(1)}초` },
        { label: '정확도 (오답)', value: `${accuracy}% (${wrongTaps}회)` },
        { label: '최대 콤보 / 힌트', value: `x${maxStreak} · ${hintsUsed}/${MAX_HINTS}회` },
      ],
    });
  };

  const handleSceneTap = (clientX, clientY, pointerType) => {
    if (finished || roundLocked || foundCount >= targetCount || isPaused || unmounted || !transformEl) return;
    const now = performance.now();
    if (now < cooldownUntil) return;

    const rect = transformEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;

    lastTapNorm = { x: nx, y: ny };
    const scenePerScreenPx = SCENE_WIDTH / rect.width;
    const touchSlopPx = pointerType === 'touch' ? 14 * scenePerScreenPx : 0;
    const minTouchRadiusPx = pointerType === 'touch' ? 22 * scenePerScreenPx : 0;
    const getHitRadius = (item) => Math.max(item.hitRadiusPx + touchSlopPx, minTouchRadiusPx);

    // 1. Find closest unfound item within hitbox radius (in 1376x768 base space)
    let matchedItem = null;
    let matchedDist = Infinity;

    for (const item of items) {
      if (item.found) continue;
      const distPx = Math.hypot((nx - item.x) * SCENE_WIDTH, (ny - item.y) * SCENE_HEIGHT);
      const r = getHitRadius(item);
      if (distPx <= r && distPx < matchedDist) {
        matchedItem = item;
        matchedDist = distPx;
      }
    }

    if (matchedItem) {
      matchedItem.found = true;
      foundCount += 1;
      streak += 1;
      if (streak > maxStreak) maxStreak = streak;

      ctx.audio.playMatch(streak);

      // Update scene prop, loupe prop, and dock card
      const sceneNode = root.querySelector(`[data-prop-id="${matchedItem.id}"]`);
      sceneNode?.classList.add('is-found');
      const loupeNode = root.querySelector(`[data-prop-id="${matchedItem.id}-loupe"]`);
      if (loupeNode) loupeNode.style.display = 'none';

      const dockCard = root.querySelector(`[data-dock-id="${matchedItem.id}"]`);
      if (dockCard) {
        dockCard.classList.add('is-found', 'is-just-found');
        dockCard.classList.remove('is-hinted');
        registerTimeout(() => dockCard.classList.remove('is-just-found'), 420);
      }
      syncDockState();

      // Remove hint beacon if this item was hinted
      const hintedBeacon = fxEl?.querySelector(`[data-hint-id="${matchedItem.id}"]`);
      if (hintedBeacon) {
        hintedBeacon.remove();
      }

      spawnFoundFx(matchedItem);
      syncHud();

      if (foundCount >= targetCount) {
        roundLocked = true;
        activePointer = null;
        window.clearTimeout(longPressTimerId);
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        hideLoupe();
        ctx.ui.showToast('모든 숨은 오브젝트를 찾았습니다!', 'success', 1800);
        finishDelayTimerId = registerTimeout(() => finishRound(true), FINISH_DELAY_MS);
      }
      return;
    }

    // 2. Check if tapped an already-found item (no penalty!)
    for (const item of items) {
      if (!item.found) continue;
      const distPx = Math.hypot((nx - item.x) * SCENE_WIDTH, (ny - item.y) * SCENE_HEIGHT);
      if (distPx <= getHitRadius(item)) {
        ctx.ui.showToast('이미 찾은 아이템입니다!', 'info', 1200);
        return;
      }
    }

    // 3. Miss penalty: deduct MISS_TIME_PENALTY_SEC from the countdown + shared input cooldown
    wrongTaps += 1;
    streak = 0;
    cooldownUntil = now + WRONG_INPUT_COOLDOWN_MS;
    remainingSec = Math.max(0, remainingSec - MISS_TIME_PENALTY_SEC);

    ctx.audio.playError();
    spawnMissFx(nx, ny);
    syncHud();

    if (remainingSec <= 0) {
      finishRound(false);
    }
  };

  // Trigger Hint: highlights unfound item farthest from last tap
  const triggerHint = () => {
    if (finished || roundLocked || foundCount >= targetCount || isPaused || unmounted) return;
    if (hintsUsed >= MAX_HINTS) {
      ctx.ui.showToast(`무료 힌트 ${MAX_HINTS}회를 모두 사용했습니다!`, 'warn', 1600);
      return;
    }

    const unfound = items.filter((item) => !item.found);
    if (unfound.length === 0) return;

    let target = unfound[0];
    let bestDist = -1;
    for (const item of unfound) {
      const d = Math.hypot(item.x - lastTapNorm.x, item.y - lastTapNorm.y);
      if (d > bestDist) {
        bestDist = d;
        target = item;
      }
    }

    hintsUsed += 1;
    ctx.audio.playHint();

    const hintsLeft = MAX_HINTS - hintsUsed;
    if (hintLeftEl) hintLeftEl.textContent = `${hintsLeft}/${MAX_HINTS} 무료`;
    if (hintBtn && hintsLeft <= 0) hintBtn.disabled = true;

    clearHintBeacon();

    if (fxEl) {
      const beacon = document.createElement('div');
      beacon.className = 'ho-hint-beacon';
      beacon.dataset.hintId = target.id;
      beacon.style.left = `${(target.x * 100).toFixed(2)}%`;
      beacon.style.top = `${(target.y * 100).toFixed(2)}%`;
      fxEl.appendChild(beacon);
    }

    const dockCard = root.querySelector(`[data-dock-id="${target.id}"]`);
    dockCard?.classList.add('is-hinted');
    dockCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    if (zoomEnabled) {
      setZoom(true, { x: target.x, y: target.y });
    }

    window.clearTimeout(hintClearTimerId);
    hintClearTimerId = registerTimeout(clearHintBeacon, HINT_BEACON_MS);
    ctx.ui.showToast(`레이더 힌트 발동! [${target.name}] 근처를 살펴보세요.`, 'info', 2200);
    syncHud();
  };

  // Event handlers
  const onHintClick = () => {
    if (finished || roundLocked || foundCount >= targetCount || isPaused || unmounted) return;
    ctx.audio.playClick();
    triggerHint();
  };

  const onZoomClick = () => {
    if (finished || roundLocked || foundCount >= targetCount || isPaused || unmounted) return;
    ctx.audio.playClick();
    setZoom(!zoomEnabled, lastTapNorm);
  };

  const onLoupeClick = () => {
    if (finished || roundLocked || foundCount >= targetCount || isPaused || unmounted) return;
    ctx.audio.playClick();
    loupeEnabled = !loupeEnabled;
    loupeBtn?.classList.toggle('is-active', loupeEnabled);
    loupeBtn?.setAttribute('aria-pressed', String(loupeEnabled));
    if (!loupeEnabled) hideLoupe();
  };

  const onPointerDown = (e) => {
    if (finished || roundLocked || foundCount >= targetCount || isPaused || unmounted || e.button > 0) return;
    frameEl?.setPointerCapture?.(e.pointerId);

    activePointer = {
      id: e.pointerId,
      type: e.pointerType || 'mouse',
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      startTime: performance.now(),
      moved: false,
      loupeActive: false,
    };

    window.clearTimeout(longPressTimerId);
    if (activePointer.type === 'touch' && loupeEnabled && !zoomEnabled) {
      longPressTimerId = registerTimeout(() => {
        if (
          !roundLocked &&
          foundCount < targetCount &&
          loupeEnabled &&
          activePointer &&
          activePointer.id === e.pointerId &&
          !activePointer.moved
        ) {
          activePointer.loupeActive = true;
          positionLoupe(activePointer.lastX, activePointer.lastY, true);
        }
      }, LONG_PRESS_LOUPE_MS);
    }
  };

  const onPointerMove = (e) => {
    if (finished || roundLocked || foundCount >= targetCount || isPaused || unmounted) return;

    if (activePointer && activePointer.id === e.pointerId) {
      const dx = e.clientX - activePointer.lastX;
      const dy = e.clientY - activePointer.lastY;
      const totalDist = Math.hypot(e.clientX - activePointer.startX, e.clientY - activePointer.startY);
      activePointer.lastX = e.clientX;
      activePointer.lastY = e.clientY;

      if (totalDist >= 8) {
        activePointer.moved = true;
        window.clearTimeout(longPressTimerId);
      }

      if (zoomEnabled && activePointer.moved) {
        frameEl?.classList.add('is-dragging');
        panX += dx;
        panY += dy;
        applySceneTransform();
        hideLoupe();
        return;
      }

      if (
        activePointer.type === 'touch' &&
        loupeEnabled &&
        !zoomEnabled &&
        (activePointer.loupeActive || activePointer.moved)
      ) {
        activePointer.loupeActive = true;
        positionLoupe(e.clientX, e.clientY, true);
        return;
      }
    }

    if ((e.pointerType || 'mouse') !== 'touch' && loupeEnabled && !activePointer?.moved) {
      positionLoupe(e.clientX, e.clientY, false);
    }
  };

  const onPointerUp = (e) => {
    if (!activePointer || activePointer.id !== e.pointerId) return;
    window.clearTimeout(longPressTimerId);
    frameEl?.classList.remove('is-dragging');

    const wasDragOrLoupe = activePointer.moved || activePointer.loupeActive;
    const pType = activePointer.type;
    activePointer = null;

    if (pType === 'touch') {
      hideLoupe();
    }

    if (finished || roundLocked || foundCount >= targetCount || isPaused || unmounted) return;

    if (!wasDragOrLoupe) {
      handleSceneTap(e.clientX, e.clientY, pType);
    }
  };

  const onPointerCancel = (e) => {
    if (activePointer && activePointer.id === e.pointerId) {
      window.clearTimeout(longPressTimerId);
      activePointer = null;
      frameEl?.classList.remove('is-dragging');
      hideLoupe();
    }
  };

  const onPointerLeave = () => {
    if (!activePointer) hideLoupe();
  };

  const onKeyDown = (e) => {
    if (finished || roundLocked || foundCount >= targetCount || isPaused || unmounted) return;
    // Leave browser/OS shortcuts (Cmd+H, Ctrl+M…) alone, and ignore auto-repeat so a
    // held H cannot burn both hints at once.
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const key = e.key.toLowerCase();
    if (key === 'h') {
      e.preventDefault();
      ctx.audio.playClick();
      triggerHint();
    } else if (key === 'z') {
      e.preventDefault();
      ctx.audio.playClick();
      setZoom(!zoomEnabled, lastTapNorm);
    } else if (key === 'm') {
      e.preventDefault();
      ctx.audio.playClick();
      onLoupeClick();
    }
  };

  const onPauseChange = (e) => {
    const nextPaused = Boolean(e.detail?.paused);
    if (nextPaused === isPaused) return;
    isPaused = nextPaused;
    if (!isPaused) {
      lastFrameNow = performance.now();
    } else {
      hideLoupe();
      activePointer = null;
      window.clearTimeout(longPressTimerId);
    }
  };

  // Wire listeners
  hintBtn?.addEventListener('click', onHintClick);
  zoomBtn?.addEventListener('click', onZoomClick);
  loupeBtn?.addEventListener('click', onLoupeClick);
  frameEl?.addEventListener('pointerdown', onPointerDown);
  frameEl?.addEventListener('pointermove', onPointerMove);
  frameEl?.addEventListener('pointerup', onPointerUp);
  frameEl?.addEventListener('pointercancel', onPointerCancel);
  frameEl?.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pm:pausechange', onPauseChange);
  window.addEventListener('resize', updateFrameGeometry);

  const resizeObserver =
    typeof ResizeObserver !== 'undefined' && viewportEl
      ? new ResizeObserver(() => updateFrameGeometry())
      : null;
  if (resizeObserver && viewportEl) {
    resizeObserver.observe(viewportEl);
  }

  // Initial sizing & HUD sync
  updateFrameGeometry();
  syncHud();
  syncDockState();

  // Main countdown & play-time RAF loop
  const tick = (now) => {
    if (unmounted || finished) return;
    const dtMs = Math.max(0, Math.min(250, now - lastFrameNow));
    lastFrameNow = now;

    if (!isPaused && foundCount < targetCount) {
      activeElapsedMs += dtMs;
      remainingSec = Math.max(0, remainingSec - dtMs / 1000);

      if (remainingSec <= 10 && remainingSec > 0) {
        const wholeSec = Math.ceil(remainingSec);
        if (wholeSec !== lastCountdownBeepSec) {
          lastCountdownBeepSec = wholeSec;
          ctx.audio.playTick();
        }
      }

      syncHud();

      if (remainingSec <= 0) {
        finishRound(false);
        return;
      }
    }

    rafId = requestAnimationFrame(tick);
  };

  lastFrameNow = performance.now();
  rafId = requestAnimationFrame(tick);

  return {
    unmount() {
      unmounted = true;
      finished = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      window.clearTimeout(longPressTimerId);
      window.clearTimeout(hintClearTimerId);
      window.clearTimeout(finishDelayTimerId);
      window.clearTimeout(shakeTimerId);
      for (const tid of pendingTimers) {
        window.clearTimeout(tid);
      }
      pendingTimers.clear();

      resizeObserver?.disconnect();
      hintBtn?.removeEventListener('click', onHintClick);
      zoomBtn?.removeEventListener('click', onZoomClick);
      loupeBtn?.removeEventListener('click', onLoupeClick);
      frameEl?.removeEventListener('pointerdown', onPointerDown);
      frameEl?.removeEventListener('pointermove', onPointerMove);
      frameEl?.removeEventListener('pointerup', onPointerUp);
      frameEl?.removeEventListener('pointercancel', onPointerCancel);
      frameEl?.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pm:pausechange', onPauseChange);
      window.removeEventListener('resize', updateFrameGeometry);

      container.innerHTML = '';
    },
  };
}
