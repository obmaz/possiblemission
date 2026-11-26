/**
 * Game 3: 네온 메모리 매치 (NEON MEMORY)
 * Pure static ES module exporting mount(container, ctx) -> { unmount() }.
 */
import { pickSeeded, shuffleSeeded } from '../core/seed.js';

export const MODE_CONFIG = {
  '4x3': {
    id: '4x3',
    modeLabel: '4×3 웜업',
    pairs: 6,
    timeLimitSec: 45,
    landscapeCols: 4,
    landscapeRows: 3,
    portraitCols: 3,
    portraitRows: 4,
  },
  '4x4': {
    id: '4x4',
    modeLabel: '4×4 스탠다드',
    pairs: 8,
    timeLimitSec: 60,
    landscapeCols: 4,
    landscapeRows: 4,
    portraitCols: 4,
    portraitRows: 4,
  },
  '6x4': {
    id: '6x4',
    modeLabel: '6×4 마스터',
    pairs: 12,
    timeLimitSec: 80,
    landscapeCols: 6,
    landscapeRows: 4,
    portraitCols: 4,
    portraitRows: 6,
  },
};

const PREVIEW_DURATION_MS = 2000;
const PREVIEW_STAGGER_MS = 10;
const FLIP_DURATION_MS = 320;
const MISMATCH_LOCK_MS = 680;
const FINISH_DELAY_MS = 560;
const FLOAT_BADGE_MS = 940;

/**
 * 12 ultra-crisp custom vector SVG arcade & workshop symbols with unique gradients.
 */
export const SYMBOLS = [
  {
    id: 'rocket',
    label: '우주 로켓',
    shortLabel: '로켓',
    accent: '#22d3ee',
    bgA: 'rgba(34, 211, 238, 0.36)',
    bgB: '#0d1b3e',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-r1-${uid}" x1="16" y1="8" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="55%" stop-color="#bae6fd"/>
            <stop offset="100%" stop-color="#38bdf8"/>
          </linearGradient>
          <linearGradient id="mm-r2-${uid}" x1="26" y1="42" x2="20" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="55%" stop-color="#fb923c"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
        </defs>
        <path d="M18 46L10 54L19 52L24 58L28 48" fill="url(#mm-r2-${uid})" stroke="#090d20" stroke-width="2" stroke-linejoin="round"/>
        <path d="M26 30L14 33L19 42L27 38Z" fill="#f43f8e" stroke="#090d20" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M38 42L35 54L26 49L30 41Z" fill="#f43f8e" stroke="#090d20" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M52 12C40 12 28 20 22 33L31 42C44 36 52 24 52 12Z" fill="url(#mm-r1-${uid})" stroke="#090d20" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M43 14L50 21C51 18 52 15 52 12C49 12 46 13 43 14Z" fill="#f43f8e"/>
        <circle cx="38" cy="26" r="5.5" fill="#0f172a" stroke="#22d3ee" stroke-width="2.2"/>
        <circle cx="36.5" cy="24.5" r="2" fill="#e0f2fe"/>
        <circle cx="14" cy="18" r="2" fill="#fef08a"/>
        <circle cx="51" cy="44" r="2.2" fill="#22d3ee"/>
      </svg>
    `,
  },
  {
    id: 'trophy',
    label: '골든 트로피',
    shortLabel: '트로피',
    accent: '#fbbf24',
    bgA: 'rgba(251, 191, 36, 0.34)',
    bgB: '#2a1808',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-t1-${uid}" x1="18" y1="10" x2="46" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="50%" stop-color="#fbbf24"/>
            <stop offset="100%" stop-color="#d97706"/>
          </linearGradient>
        </defs>
        <path d="M18 16H10C10 26 15 31 21 31" stroke="#fbbf24" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M46 16H54C54 26 49 31 43 31" stroke="#fbbf24" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M18 12H46V24C46 33 40 39 32 39C24 39 18 33 18 24V12Z" fill="url(#mm-t1-${uid})" stroke="#090d20" stroke-width="2.4" stroke-linejoin="round"/>
        <rect x="28" y="38" width="8" height="9" fill="#f59e0b" stroke="#090d20" stroke-width="2.2"/>
        <rect x="20" y="47" width="24" height="7" rx="3" fill="#b45309" stroke="#090d20" stroke-width="2.2"/>
        <path d="M32 17L34.2 21.5L39 22.2L35.5 25.6L36.3 30.4L32 28.1L27.7 30.4L28.5 25.6L25 22.2L29.8 21.5Z" fill="#fffbeb" stroke="#92400e" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M23 16V24" stroke="#fef9c3" stroke-width="2" stroke-linecap="round" opacity="0.75"/>
      </svg>
    `,
  },
  {
    id: 'gamepad',
    label: '네온 게임패드',
    shortLabel: '게임패드',
    accent: '#a855f7',
    bgA: 'rgba(168, 85, 247, 0.36)',
    bgB: '#1d103a',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-gp-${uid}" x1="10" y1="18" x2="54" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#312e81"/>
            <stop offset="50%" stop-color="#4c1d95"/>
            <stop offset="100%" stop-color="#1e1b4b"/>
          </linearGradient>
        </defs>
        <path d="M32 13V19" stroke="#22d3ee" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M20 20H44C50 20 55 25 56 34L57 42C57.5 46 54 49 50.5 48C47.5 47 45 43 42 40H22C19 43 16.5 47 13.5 48C10 49 6.5 46 7 42L8 34C9 25 14 20 20 20Z" fill="url(#mm-gp-${uid})" stroke="#c084fc" stroke-width="2.3" stroke-linejoin="round"/>
        <path d="M20 26V34M16 30H24" stroke="#22d3ee" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="44" cy="27" r="2.6" fill="#fbbf24"/>
        <circle cx="49" cy="31" r="2.6" fill="#f43f8e"/>
        <circle cx="39" cy="31" r="2.6" fill="#34d399"/>
        <circle cx="44" cy="35" r="2.6" fill="#38bdf8"/>
        <rect x="28.5" y="29" width="7" height="3" rx="1.5" fill="#cbd5e1"/>
      </svg>
    `,
  },
  {
    id: 'espresso',
    label: '에스프레소 머신',
    shortLabel: '에스프레소',
    accent: '#fb923c',
    bgA: 'rgba(251, 146, 60, 0.34)',
    bgB: '#28150d',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-es-${uid}" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fed7aa"/>
            <stop offset="50%" stop-color="#f97316"/>
            <stop offset="100%" stop-color="#9a3412"/>
          </linearGradient>
        </defs>
        <rect x="14" y="12" width="36" height="12" rx="4" fill="url(#mm-es-${uid})" stroke="#090d20" stroke-width="2.3"/>
        <rect x="18" y="24" width="28" height="22" fill="#1e293b" stroke="#090d20" stroke-width="2.2"/>
        <rect x="12" y="46" width="40" height="7" rx="3" fill="#cbd5e1" stroke="#090d20" stroke-width="2.2"/>
        <rect x="26" y="24" width="12" height="5" rx="1.5" fill="#94a3b8" stroke="#090d20" stroke-width="1.8"/>
        <path d="M38 26.5H49" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>
        <path d="M32 29V34" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M25 35H39V41C39 44 36.5 46 32 46C27.5 46 25 44 25 41V35Z" fill="#fef3c7" stroke="#090d20" stroke-width="2"/>
        <circle cx="22" cy="18" r="2.6" fill="#22d3ee"/>
        <circle cx="32" cy="18" r="2.6" fill="#fef08a"/>
        <circle cx="42" cy="18" r="2.6" fill="#34d399"/>
      </svg>
    `,
  },
  {
    id: 'diamond',
    label: '다이아몬드',
    shortLabel: '다이아몬드',
    accent: '#38bdf8',
    bgA: 'rgba(56, 189, 248, 0.36)',
    bgB: '#0c203f',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-dm-${uid}" x1="12" y1="14" x2="52" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f0f9ff"/>
            <stop offset="45%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#2563eb"/>
          </linearGradient>
        </defs>
        <polygon points="18,14 46,14 56,27 32,53 8,27" fill="url(#mm-dm-${uid})" stroke="#090d20" stroke-width="2.4" stroke-linejoin="round"/>
        <polygon points="18,14 32,27 46,14" fill="#e0f2fe" opacity="0.85"/>
        <polygon points="8,27 22,27 32,53" fill="#0284c7" opacity="0.72"/>
        <polygon points="56,27 42,27 32,53" fill="#1d4ed8" opacity="0.72"/>
        <path d="M8 27H56M22 27L18 14M42 27L46 14M22 27L32 53L42 27" stroke="#090d20" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M50 9L52 13L56 15L52 17L50 21L48 17L44 15L48 13Z" fill="#fef08a"/>
      </svg>
    `,
  },
  {
    id: 'dragon',
    label: '픽셀 드래곤',
    shortLabel: '드래곤',
    accent: '#34d399',
    bgA: 'rgba(52, 211, 153, 0.34)',
    bgB: '#08261f',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-dr-${uid}" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#6ee7b7"/>
            <stop offset="60%" stop-color="#10b981"/>
            <stop offset="100%" stop-color="#047857"/>
          </linearGradient>
        </defs>
        <!-- Crisp pixel-block silhouette -->
        <path d="M16 12H22V18H28V14H34V20H46V26H52V36H40V42H48V48H30V54H16V42H12V24H16V12Z" fill="url(#mm-dr-${uid})" stroke="#090d20" stroke-width="2.4" stroke-linejoin="miter"/>
        <rect x="20" y="24" width="6" height="6" fill="#fef08a" stroke="#090d20" stroke-width="1.6"/>
        <rect x="22" y="26" width="2.5" height="2.5" fill="#090d20"/>
        <rect x="44" y="30" width="4" height="3" fill="#090d20"/>
        <rect x="16" y="42" width="12" height="10" fill="#fde68a" opacity="0.88"/>
        <!-- Pixel fire breath -->
        <rect x="52" y="38" width="5" height="5" fill="#fbbf24"/>
        <rect x="56" y="34" width="4" height="4" fill="#f97316"/>
        <rect x="55" y="43" width="5" height="4" fill="#ef4444"/>
      </svg>
    `,
  },
  {
    id: 'potion',
    label: '마법 물약',
    shortLabel: '마법 물약',
    accent: '#f43f8e',
    bgA: 'rgba(244, 63, 142, 0.36)',
    bgB: '#2d0c24',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-pt-${uid}" x1="16" y1="26" x2="48" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f472b6"/>
            <stop offset="55%" stop-color="#ec4899"/>
            <stop offset="100%" stop-color="#9333ea"/>
          </linearGradient>
        </defs>
        <rect x="26" y="9" width="12" height="7" rx="2" fill="#d97706" stroke="#090d20" stroke-width="2.2"/>
        <path d="M24 16H40V22L48 31C51 35 52 40 50 45C48 51 41 55 32 55C23 55 16 51 14 45C12 40 13 35 16 31L24 22V16Z" fill="#1e1b4b" stroke="#e0f2fe" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M16.5 36C21 34 27 38 32 36C37 34 43 35 47.5 37C49 41 48 45 46 48C43 51.5 38 53 32 53C26 53 21 51.5 18 48C16 45 15 40 16.5 36Z" fill="url(#mm-pt-${uid})"/>
        <circle cx="26" cy="43" r="3" fill="#fbcfe8"/>
        <circle cx="37" cy="46" r="2.2" fill="#fef08a"/>
        <circle cx="34" cy="39" r="1.8" fill="#ffffff"/>
        <path d="M21 16H43" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `,
  },
  {
    id: 'compass',
    label: '나침반',
    shortLabel: '나침반',
    accent: '#2dd4bf',
    bgA: 'rgba(45, 212, 191, 0.34)',
    bgB: '#0c2430',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-cp-${uid}" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="100%" stop-color="#d97706"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="11" r="4" stroke="#fbbf24" stroke-width="2.5"/>
        <circle cx="32" cy="35" r="21" fill="url(#mm-cp-${uid})" stroke="#090d20" stroke-width="2.4"/>
        <circle cx="32" cy="35" r="16" fill="#0f172a" stroke="#2dd4bf" stroke-width="1.8"/>
        <path d="M32 21V24M32 46V49M18 35H21M43 35H46" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
        <polygon points="41,26 35,38 29,32" fill="#ef4444" stroke="#090d20" stroke-width="1.4" stroke-linejoin="round"/>
        <polygon points="23,44 29,32 35,38" fill="#22d3ee" stroke="#090d20" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="32" cy="35" r="3" fill="#fef08a" stroke="#090d20" stroke-width="1.5"/>
      </svg>
    `,
  },
  {
    id: 'cassette',
    label: '레트로 카세트',
    shortLabel: '카세트',
    accent: '#fb7185',
    bgA: 'rgba(251, 113, 133, 0.34)',
    bgB: '#2a1026',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-cs-${uid}" x1="8" y1="16" x2="56" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fda4af"/>
            <stop offset="50%" stop-color="#fb7185"/>
            <stop offset="100%" stop-color="#e11d48"/>
          </linearGradient>
        </defs>
        <rect x="8" y="16" width="48" height="32" rx="4" fill="#1e293b" stroke="#fb7185" stroke-width="2.3"/>
        <rect x="13" y="21" width="38" height="16" rx="2.5" fill="url(#mm-cs-${uid})" stroke="#090d20" stroke-width="1.8"/>
        <rect x="24" y="26" width="16" height="6" rx="1.5" fill="#0f172a"/>
        <circle cx="20" cy="29" r="4.5" fill="#f8fafc" stroke="#090d20" stroke-width="1.8"/>
        <circle cx="44" cy="29" r="4.5" fill="#f8fafc" stroke="#090d20" stroke-width="1.8"/>
        <circle cx="20" cy="29" r="1.6" fill="#090d20"/>
        <circle cx="44" cy="29" r="1.6" fill="#090d20"/>
        <polygon points="18,48 22,41 42,41 46,48" fill="#334155" stroke="#090d20" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="24" cy="45" r="1.5" fill="#fef08a"/>
        <circle cx="40" cy="45" r="1.5" fill="#22d3ee"/>
      </svg>
    `,
  },
  {
    id: 'crown',
    label: '황금 왕관',
    shortLabel: '황금 왕관',
    accent: '#facc15',
    bgA: 'rgba(250, 204, 21, 0.36)',
    bgB: '#26183b',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-cr-${uid}" x1="10" y1="16" x2="54" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fef9c3"/>
            <stop offset="50%" stop-color="#facc15"/>
            <stop offset="100%" stop-color="#ca8a04"/>
          </linearGradient>
        </defs>
        <path d="M10 43L8 21L21 31L32 16L43 31L56 21L54 43H10Z" fill="url(#mm-cr-${uid})" stroke="#090d20" stroke-width="2.4" stroke-linejoin="round"/>
        <rect x="11" y="43" width="42" height="8" rx="2.5" fill="#d97706" stroke="#090d20" stroke-width="2.2"/>
        <circle cx="8" cy="19" r="3.2" fill="#22d3ee" stroke="#090d20" stroke-width="1.6"/>
        <circle cx="32" cy="14" r="3.8" fill="#f43f8e" stroke="#090d20" stroke-width="1.6"/>
        <circle cx="56" cy="19" r="3.2" fill="#22d3ee" stroke="#090d20" stroke-width="1.6"/>
        <polygon points="32,29 36,34 32,39 28,34" fill="#f43f8e" stroke="#090d20" stroke-width="1.4"/>
        <circle cx="21" cy="47" r="2" fill="#fef08a"/>
        <circle cx="32" cy="47" r="2.2" fill="#22d3ee"/>
        <circle cx="43" cy="47" r="2" fill="#fef08a"/>
      </svg>
    `,
  },
  {
    id: 'cake',
    label: '체리 케이크',
    shortLabel: '체리 케이크',
    accent: '#f472b6',
    bgA: 'rgba(244, 114, 182, 0.34)',
    bgB: '#2b1029',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-ck-${uid}" x1="12" y1="24" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="100%" stop-color="#f59e0b"/>
          </linearGradient>
        </defs>
        <path d="M12 32L44 21L54 32V49H12V32Z" fill="url(#mm-ck-${uid})" stroke="#090d20" stroke-width="2.3" stroke-linejoin="round"/>
        <path d="M12 39H54" stroke="#f43f8e" stroke-width="4"/>
        <path d="M12 32L44 21L54 32C50 35 46 33 42 35C38 37 33 33 28 35C23 37 17 34 12 35V32Z" fill="#fbcfe8" stroke="#090d20" stroke-width="2" stroke-linejoin="round"/>
        <path d="M35 16C37 11 41 9 44 10" stroke="#34d399" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="34" cy="20" r="5.5" fill="#ef4444" stroke="#090d20" stroke-width="2"/>
        <circle cx="32" cy="18" r="1.8" fill="#fecaca"/>
        <rect x="8" y="49" width="48" height="5" rx="2.5" fill="#e2e8f0" stroke="#090d20" stroke-width="2"/>
      </svg>
    `,
  },
  {
    id: 'key',
    label: '시크릿 열쇠',
    shortLabel: '시크릿 열쇠',
    accent: '#a3e635',
    bgA: 'rgba(163, 230, 53, 0.32)',
    bgB: '#122614',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-ky-${uid}" x1="12" y1="14" x2="52" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="55%" stop-color="#a3e635"/>
            <stop offset="100%" stop-color="#10b981"/>
          </linearGradient>
        </defs>
        <path d="M26 24C26 30.6 20.6 36 14 36C7.4 36 2 30.6 2 24" opacity="0"/>
        <circle cx="21" cy="24" r="11" fill="url(#mm-ky-${uid})" stroke="#090d20" stroke-width="2.4"/>
        <circle cx="21" cy="24" r="4.5" fill="#090d20"/>
        <path d="M29 31L51 53L56 48L51 43L55 39L49 33L44 38L34 28" fill="url(#mm-ky-${uid})" stroke="#090d20" stroke-width="2.4" stroke-linejoin="round"/>
        <circle cx="21" cy="17" r="1.8" fill="#ffffff"/>
        <path d="M44 14L46 18L50 20L46 22L44 26L42 22L38 20L42 18Z" fill="#22d3ee"/>
      </svg>
    `,
  },
];

/**
 * Resolves mode config with safe fallback to 4x4.
 * @param {string} mode
 */
export function resolveModeConfig(mode) {
  return MODE_CONFIG[mode] || MODE_CONFIG['4x4'];
}

/**
 * Deterministically picks `pairs` symbols and shuffles the doubled deck via seeded RNG.
 * @param {() => number} rng
 * @param {string} mode
 */
export function buildSeededDeck(rng, mode) {
  const cfg = resolveModeConfig(mode);
  const chosen = pickSeeded(rng, SYMBOLS, cfg.pairs);
  const doubled = [];
  chosen.forEach((symbol) => {
    doubled.push({ symbolId: symbol.id, symbol, pairIndex: 0 });
    doubled.push({ symbolId: symbol.id, symbol, pairIndex: 1 });
  });
  return shuffleSeeded(rng, doubled).map((card, index) => ({
    ...card,
    index,
    isFlipped: false,
    isMatched: false,
  }));
}

function renderCardBackHtml() {
  return `
    <div class="mm-back-emblem">
      <svg class="mm-back-sigil" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5" fill="rgba(161,137,232,0.12)" stroke="#a189e8" stroke-width="1.6"/>
        <polygon points="20,8 30,14 30,26 20,32 10,26 10,14" stroke="rgba(148,163,184,0.55)" stroke-width="1.2" stroke-dasharray="3 2"/>
        <path d="M16.8 15.5C16.8 13.8 18.2 12.6 20.1 12.6C22.1 12.6 23.4 13.8 23.4 15.4C23.4 16.9 22.3 17.7 21.1 18.4C20.2 19 19.9 19.6 19.9 20.7V21.5" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="20" cy="25.5" r="1.5" fill="#fbbf24"/>
      </svg>
      <span class="mm-back-brand">POSSIBLE<br/>MISSION</span>
    </div>
  `;
}

/**
 * Mounts Neon Memory Match inside #game-stage.
 * @param {HTMLElement} container
 * @param {object} ctx
 * @returns {{ unmount: () => void }}
 */
export function mount(container, ctx) {
  const cfg = resolveModeConfig(ctx.mode);
  const deck = buildSeededDeck(ctx.rng, cfg.id);
  const totalPairs = cfg.pairs;

  let phase = 'preview'; // 'preview' | 'playing' | 'ended'
  const maxStaggerMs = Math.max(0, (deck.length - 1) * PREVIEW_STAGGER_MS);
  let previewRevealStarted = false;
  let previewRevealWaitMs = maxStaggerMs + FLIP_DURATION_MS;
  let previewRemainingMs = PREVIEW_DURATION_MS;
  let remainingMs = cfg.timeLimitSec * 1000;
  let elapsedActiveMs = 0;

  let isPaused = false;
  let finished = false;
  let mismatchLock = false;
  let mismatchRemainingMs = 0;
  let mismatchPair = null;

  let flippedIndices = [];
  let moves = 0;
  let matchedPairs = 0;
  let combo = 0;
  let maxCombo = 0;
  let matchScore = 0;

  let lastPreviewTickSec = -1;
  let lastPlayTickSec = -1;
  let lastTopbarCueKey = '';
  let lastTopbarHintKey = '';
  let lastTopbarComboKey = '';
  let lastTopbarMeterHidden = null;
  let lastTopbarMeterRatio = '';
  let lastTopbarSkipHidden = null;
  let lastHudTimerKey = '';
  let lastHudScore = -1;
  let lastHudProgressKey = '';
  let lastHudRatioKey = '';
  let lastHudExtraKey = '';
  let rafId = 0;
  let revealRafId = 0;
  let lastFrameTs = 0;
  let finishTimeoutId = 0;
  let resizeObserver = null;
  let activeCols = cfg.landscapeCols;
  let activeRows = cfg.landscapeRows;
  const fxTimeouts = new Set();

  // Build Root DOM
  const root = document.createElement('div');
  root.className = 'game-root game-memory';
  root.innerHTML = `
    <div class="mm-head">
      <div class="mm-head__text">
        <p class="mm-cue" data-mm-cue>
          <span class="mm-cue__title">2초 안에 카드를 외우세요</span>
          <span class="mm-cue__count" data-mm-count data-active="2" aria-hidden="true"><b data-step="2">2</b><span class="mm-cue__arrow">→</span><b data-step="1">1</b></span>
        </p>
        <p class="mm-hint" data-mm-hint hidden>카드를 뒤집어 같은 그림 짝을 찾으세요</p>
      </div>
      <span class="mm-combo" data-mm-combo hidden></span>
      <button type="button" class="mm-skip" data-mm-preview-skip title="프리뷰 즉시 건너뛰기 (Space)">
        프리뷰 건너뛰기 <span class="mm-skip__key">Space</span>
      </button>
    </div>
    <div class="mm-preview-meter" aria-hidden="true">
      <div class="mm-preview-meter__fill"></div>
    </div>
    <div class="mm-board-wrap">
      <div class="mm-grid" role="grid" aria-label="네온 메모리 매치 카드 보드"></div>
      <div class="mm-fx-layer" aria-hidden="true"></div>
    </div>
  `;
  container.appendChild(root);

  const cueEl = root.querySelector('[data-mm-cue]');
  const cueCountEl = root.querySelector('[data-mm-count]');
  const hintEl = root.querySelector('[data-mm-hint]');
  const comboEl = root.querySelector('[data-mm-combo]');
  const skipLinkEl = root.querySelector('[data-mm-preview-skip]');
  const previewMeterEl = root.querySelector('.mm-preview-meter');
  const boardWrapEl = root.querySelector('.mm-board-wrap');
  const gridEl = root.querySelector('.mm-grid');
  const fxLayerEl = root.querySelector('.mm-fx-layer');

  const cardButtons = deck.map((card, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mm-card';
    btn.dataset.index = String(idx);
    btn.style.setProperty('--mm-stagger', `${idx * PREVIEW_STAGGER_MS}ms`);
    btn.setAttribute('aria-label', `${idx + 1}번 카드: ${card.symbol.label} (미리보기)`);
    btn.innerHTML = `
      <div class="mm-card__motion">
        <div class="mm-card__inner">
          <div class="mm-card__face mm-card__back">${renderCardBackHtml()}</div>
          <div
            class="mm-card__face mm-card__front"
            style="--mm-accent: ${card.symbol.accent}; --mm-bg-a: ${card.symbol.bgA}; --mm-bg-b: ${card.symbol.bgB};"
          >
            <div class="mm-card__icon-wrap">${card.symbol.renderSvg(idx)}</div>
            <span class="mm-card__label">${card.symbol.shortLabel}</span>
          </div>
        </div>
      </div>
    `;
    gridEl.appendChild(btn);
    return btn;
  });

  revealRafId = requestAnimationFrame(() => {
    revealRafId = 0;
    if (finished || phase !== 'preview') return;
    previewRevealStarted = true;
    cardButtons.forEach((btn) => btn.classList.add('is-preview'));
  });

  function updateBoardLayout() {
    if (!boardWrapEl || !gridEl) return;
    const wrapW = boardWrapEl.clientWidth;
    const wrapH = boardWrapEl.clientHeight;
    if (wrapW <= 0 || wrapH <= 0) return;

    const isPortrait = wrapW < 560 && wrapH > wrapW;
    activeCols = isPortrait ? cfg.portraitCols : cfg.landscapeCols;
    activeRows = isPortrait ? cfg.portraitRows : cfg.landscapeRows;

    const gap = Math.max(8, Math.min(16, Math.round(Math.min(wrapW, wrapH) * 0.022)));
    const maxCellW = (wrapW - gap * (activeCols - 1)) / activeCols;
    const maxCellH = (wrapH - gap * (activeRows - 1)) / activeRows;

    const cellH = Math.max(36, Math.min(maxCellH, maxCellW / 0.78));
    const cellW = Math.max(36, Math.min(maxCellW, cellH * 0.94));

    const gridW = Math.floor(cellW * activeCols + gap * (activeCols - 1));
    const gridH = Math.floor(cellH * activeRows + gap * (activeRows - 1));

    gridEl.style.setProperty('--mm-cols', String(activeCols));
    gridEl.style.setProperty('--mm-rows', String(activeRows));
    gridEl.style.setProperty('--mm-gap', `${gap}px`);
    gridEl.style.setProperty('--mm-grid-w', `${gridW}px`);
    gridEl.style.setProperty('--mm-grid-h', `${gridH}px`);
  }

  function updateCardAria(idx) {
    const card = deck[idx];
    const btn = cardButtons[idx];
    if (!card || !btn) return;
    if (card.isMatched) {
      btn.setAttribute('aria-label', `${idx + 1}번 카드: ${card.symbol.label} (매칭 완료)`);
    } else if (phase === 'preview') {
      btn.setAttribute('aria-label', `${idx + 1}번 카드: ${card.symbol.label} (미리보기)`);
    } else if (card.isFlipped) {
      btn.setAttribute('aria-label', `${idx + 1}번 카드: ${card.symbol.label} (앞면)`);
    } else {
      btn.setAttribute('aria-label', `${idx + 1}번 카드 (뒷면)`);
    }
  }

  function buildHudExtra() {
    const pill = document.createElement('span');
    pill.className = 'hud-pill';
    pill.textContent = `시도 ${moves}회`;
    return pill;
  }

  function syncHud() {
    const ratio = Math.max(0, Math.min(1, remainingMs / (cfg.timeLimitSec * 1000)));
    const remSec = Math.max(0, remainingMs / 1000);
    const timerKey =
      phase === 'preview'
        ? 'preview'
        : remSec < 10
          ? remSec.toFixed(1)
          : `${Math.ceil(remSec)}:${remSec <= 15 ? 'warn' : 'norm'}`;
    const progressKey = `${matchedPairs}/${totalPairs}`;
    const ratioKey = ratio.toFixed(4);
    const extraKey = `moves:${moves}`;

    const hudPatch = {};
    if (timerKey !== lastHudTimerKey) {
      lastHudTimerKey = timerKey;
      hudPatch.timer =
        phase === 'preview'
          ? cfg.timeLimitSec
          : remSec;
    }
    if (matchScore !== lastHudScore) {
      lastHudScore = matchScore;
      hudPatch.score = matchScore;
    }
    if (progressKey !== lastHudProgressKey) {
      lastHudProgressKey = progressKey;
      hudPatch.progress = `${matchedPairs} / ${totalPairs}쌍`;
    }
    if (ratioKey !== lastHudRatioKey) {
      lastHudRatioKey = ratioKey;
      hudPatch.progressRatio = ratio;
    }
    if (extraKey !== lastHudExtraKey) {
      lastHudExtraKey = extraKey;
      hudPatch.extra = buildHudExtra();
    }

    if (Object.keys(hudPatch).length > 0) {
      ctx.updateHud(hudPatch);
    }
  }

  function syncHint() {
    const remainingPairs = Math.max(0, totalPairs - matchedPairs);
    const hintKey = `${matchedPairs}:${remainingPairs}:${phase}`;
    if (hintKey === lastTopbarHintKey) return;
    lastTopbarHintKey = hintKey;
    if (remainingPairs === 0) {
      hintEl.textContent = '모든 쌍을 찾았습니다!';
    } else if (remainingPairs <= 3) {
      hintEl.innerHTML = `<span class="mm-hint__accent">마지막 ${remainingPairs}쌍!</span> 콤보를 이어가세요!`;
    } else if (matchedPairs === 0) {
      hintEl.textContent = '카드를 뒤집어 같은 그림 짝을 찾으세요';
    } else {
      hintEl.textContent = `남은 쌍 ${remainingPairs} · 콤보를 이어가세요!`;
    }
  }

  function syncCombo() {
    const showCombo = combo >= 2 && phase === 'playing';
    const comboKey = showCombo ? `combo:${combo}` : 'off';
    if (comboKey === lastTopbarComboKey) return;
    lastTopbarComboKey = comboKey;
    comboEl.hidden = !showCombo;
    if (showCombo) comboEl.textContent = `×${combo} COMBO`;
  }

  function syncTopbar() {
    if (phase === 'preview') {
      const countDigit = Math.max(1, Math.ceil(previewRemainingMs / 1000));
      const cueKey = `preview:${countDigit}`;
      if (cueKey !== lastTopbarCueKey) {
        lastTopbarCueKey = cueKey;
        cueEl.hidden = false;
        hintEl.hidden = true;
        cueCountEl.dataset.active = String(countDigit);
      }
      if (lastTopbarMeterHidden !== false) {
        lastTopbarMeterHidden = false;
        previewMeterEl.classList.remove('is-hidden');
      }
      const ratioStr = (previewRemainingMs / PREVIEW_DURATION_MS).toFixed(4);
      if (ratioStr !== lastTopbarMeterRatio) {
        lastTopbarMeterRatio = ratioStr;
        previewMeterEl.style.setProperty('--mm-preview-ratio', ratioStr);
      }
      if (lastTopbarSkipHidden !== false) {
        lastTopbarSkipHidden = false;
        skipLinkEl.hidden = false;
      }
      syncCombo();
      return;
    }

    if (lastTopbarCueKey !== 'play') {
      lastTopbarCueKey = 'play';
      cueEl.hidden = true;
      hintEl.hidden = false;
    }
    if (lastTopbarMeterHidden !== true) {
      lastTopbarMeterHidden = true;
      previewMeterEl.classList.add('is-hidden');
    }
    if (lastTopbarSkipHidden !== true) {
      lastTopbarSkipHidden = true;
      skipLinkEl.hidden = true;
    }

    syncHint();
    syncCombo();
  }

  function spawnFloatBadge(targetCardEl, text, isCombo) {
    if (!fxLayerEl || !boardWrapEl || !targetCardEl) return;
    const wrapRect = boardWrapEl.getBoundingClientRect();
    const cardRect = targetCardEl.getBoundingClientRect();
    const rawX = cardRect.left - wrapRect.left + cardRect.width / 2;
    const rawY = cardRect.top - wrapRect.top + cardRect.height * 0.35;

    const badge = document.createElement('div');
    badge.className = `mm-float-badge ${isCombo ? 'mm-float-badge--combo' : ''}`;
    badge.textContent = text;
    fxLayerEl.appendChild(badge);

    const halfW = (badge.offsetWidth || 120) / 2;
    const padX = 8;
    const minX = Math.min(wrapRect.width / 2, halfW + padX);
    const maxX = Math.max(minX, wrapRect.width - halfW - padX);
    const x = Math.max(minX, Math.min(maxX, rawX));
    const minY = Math.min(wrapRect.height / 2, 42);
    const maxY = Math.max(minY, wrapRect.height - 20);
    const y = Math.max(minY, Math.min(maxY, rawY));

    badge.style.left = `${x}px`;
    badge.style.top = `${y}px`;

    const tid = window.setTimeout(() => {
      fxTimeouts.delete(tid);
      badge.remove();
    }, FLOAT_BADGE_MS);
    fxTimeouts.add(tid);
  }

  function beginPlayPhase({ playFlipSfx = true } = {}) {
    if (phase !== 'preview' || finished) return;
    if (revealRafId) {
      cancelAnimationFrame(revealRafId);
      revealRafId = 0;
    }
    phase = 'playing';
    cardButtons.forEach((btn, idx) => {
      btn.classList.remove('is-preview');
      btn.style.setProperty('--mm-stagger', '0ms');
      updateCardAria(idx);
    });
    if (playFlipSfx) {
      ctx.audio.playFlip();
    }
    syncTopbar();
    syncHud();
  }

  function finishGame(cleared) {
    if (finished) return;
    finished = true;
    phase = 'ended';
    mismatchLock = false;
    syncTopbar();

    const remainingSec = cleared ? Math.max(0, remainingMs / 1000) : 0;
    const timeBonus = cleared ? Math.round(remainingSec * 55) : 0;
    const efficiencyBonus = cleared ? Math.max(0, (2 * totalPairs - moves) * 100) : 0;
    const perfectBonus = cleared && moves === totalPairs ? 1200 : 0;
    const totalScore = Math.max(0, matchScore + timeBonus + efficiencyBonus + perfectBonus);
    const accuracy = moves > 0 ? Math.round((matchedPairs / moves) * 100) : 0;
    const finalTimeMs = Math.round(elapsedActiveMs);

    ctx.updateHud({
      timer: cleared ? remainingSec : 0,
      score: totalScore,
      progress: `${matchedPairs} / ${totalPairs}쌍`,
      progressRatio: cleared ? remainingSec / cfg.timeLimitSec : 0,
      extra: maxCombo >= 2 ? `MAX ×${maxCombo}` : null,
    });

    const deliverResult = () => {
      ctx.completeGame({
        score: totalScore,
        timeMs: finalTimeMs,
        accuracy,
        cleared,
        modeLabel: cfg.modeLabel,
        details: [
          { label: '매칭 진행', value: `${matchedPairs} / ${totalPairs}쌍` },
          { label: '시도 / 정확도', value: `${moves}회 · ${accuracy}%` },
          { label: '최대 콤보', value: `×${Math.max(1, maxCombo)} COMBO` },
          {
            label: '남은 시간 보너스',
            value: cleared ? `${remainingSec.toFixed(1)}초 (+${timeBonus.toLocaleString('en-US')})` : '시간 종료',
          },
        ],
      });
    };

    if (cleared) {
      finishTimeoutId = window.setTimeout(() => {
        finishTimeoutId = 0;
        deliverResult();
      }, FINISH_DELAY_MS);
    } else {
      deliverResult();
    }
  }

  function resolveMismatchPair() {
    if (!mismatchPair) return;
    const [i1, i2] = mismatchPair;
    [i1, i2].forEach((idx) => {
      deck[idx].isFlipped = false;
      const btn = cardButtons[idx];
      btn.classList.remove('is-flipped', 'is-mismatch');
      updateCardAria(idx);
    });
    mismatchPair = null;
    flippedIndices = [];
    mismatchLock = false;
    ctx.audio.playFlip();
  }

  function handleCardActivate(idx) {
    if (finished || isPaused || phase !== 'playing' || mismatchLock) return;
    const card = deck[idx];
    if (!card || card.isMatched || card.isFlipped) return;

    card.isFlipped = true;
    cardButtons[idx].classList.add('is-flipped');
    updateCardAria(idx);
    ctx.audio.playFlip();
    flippedIndices.push(idx);

    if (flippedIndices.length < 2) return;

    const [firstIdx, secondIdx] = flippedIndices;
    moves += 1;

    if (deck[firstIdx].symbolId === deck[secondIdx].symbolId) {
      // Match: 0ms input lock — immediately allow next card!
      flippedIndices = [];
      deck[firstIdx].isMatched = true;
      deck[secondIdx].isMatched = true;
      [firstIdx, secondIdx].forEach((mIdx) => {
        const btn = cardButtons[mIdx];
        btn.classList.remove('is-flipped');
        btn.classList.add('is-matched', 'is-just-matched');
        btn.setAttribute('aria-disabled', 'true');
        updateCardAria(mIdx);
      });

      matchedPairs += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const pts = 300 + Math.min(combo - 1, 5) * 120;
      matchScore += pts;

      ctx.audio.playMatch(combo);
      const badgeLabel = combo >= 2 ? `+${pts} ×${combo}` : `+${pts}`;
      spawnFloatBadge(cardButtons[secondIdx], badgeLabel, combo >= 2);

      syncTopbar();
      syncHud();

      if (matchedPairs === totalPairs) {
        finishGame(true);
      }
    } else {
      // Mismatch: MISMATCH_LOCK_MS input lock while cards shake and flip back
      combo = 0;
      mismatchLock = true;
      mismatchRemainingMs = MISMATCH_LOCK_MS;
      mismatchPair = [firstIdx, secondIdx];
      cardButtons[firstIdx].classList.add('is-mismatch');
      cardButtons[secondIdx].classList.add('is-mismatch');
      ctx.audio.playError();
      syncTopbar();
      syncHud();
    }
  }

  // Event Listeners
  const onGridClick = (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.mm-card') : null;
    if (!btn || !gridEl.contains(btn)) return;
    const idx = Number(btn.dataset.index);
    if (Number.isInteger(idx)) {
      handleCardActivate(idx);
    }
  };

  const onGridKeyDown = (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.mm-card') : null;
    if (!btn || !gridEl.contains(btn)) return;
    const idx = Number(btn.dataset.index);
    if (!Number.isInteger(idx)) return;

    const total = cardButtons.length;
    let nextIdx = -1;
    if (e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % total;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + total) % total;
    } else if (e.key === 'ArrowDown') {
      nextIdx = idx + activeCols < total ? idx + activeCols : idx % activeCols;
    } else if (e.key === 'ArrowUp') {
      if (idx - activeCols >= 0) {
        nextIdx = idx - activeCols;
      } else {
        const col = idx % activeCols;
        const lastRowBase = Math.floor((total - 1) / activeCols) * activeCols;
        nextIdx = lastRowBase + col < total ? lastRowBase + col : lastRowBase + col - activeCols;
      }
    }

    if (nextIdx >= 0 && cardButtons[nextIdx]) {
      e.preventDefault();
      cardButtons[nextIdx].focus();
    }
  };

  const onPreviewSkipClick = () => {
    if (finished || isPaused || phase !== 'preview') return;
    ctx.audio.playClick();
    previewRemainingMs = 0;
    beginPlayPhase({ playFlipSfx: true });
  };

  const onPreviewSkipKeyDown = (e) => {
    if (finished || isPaused || phase !== 'preview') return;
    if (e.code !== 'Space' && e.key !== ' ') return;
    e.preventDefault();
    onPreviewSkipClick();
  };

  const onPauseChange = (e) => {
    isPaused = Boolean(e?.detail?.paused);
    if (!isPaused) {
      lastFrameTs = performance.now();
    }
  };

  const onWindowResize = () => {
    updateBoardLayout();
  };

  gridEl.addEventListener('click', onGridClick);
  gridEl.addEventListener('keydown', onGridKeyDown);
  skipLinkEl.addEventListener('click', onPreviewSkipClick);
  window.addEventListener('keydown', onPreviewSkipKeyDown);
  window.addEventListener('pm:pausechange', onPauseChange);
  window.addEventListener('resize', onWindowResize);

  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => updateBoardLayout());
    resizeObserver.observe(boardWrapEl);
  }

  // Main Pause-Aware Animation Frame Loop
  const tickFrame = (now) => {
    if (finished) {
      rafId = 0;
      return;
    }
    if (!lastFrameTs) lastFrameTs = now;
    const dt = isPaused ? 0 : Math.min(100, Math.max(0, now - lastFrameTs));
    lastFrameTs = now;

    if (!isPaused && dt > 0) {
      if (phase === 'preview') {
        if (previewRevealStarted) {
          if (previewRevealWaitMs > 0) {
            previewRevealWaitMs = Math.max(0, previewRevealWaitMs - dt);
          } else {
            previewRemainingMs = Math.max(0, previewRemainingMs - dt);
            const tickSec = Math.ceil(previewRemainingMs / 1000);
            if (tickSec >= 1 && tickSec !== lastPreviewTickSec) {
              lastPreviewTickSec = tickSec;
              ctx.audio.playTick();
            }
          }
        }
        syncTopbar();
        if (previewRemainingMs <= 0) {
          beginPlayPhase({ playFlipSfx: true });
        }
      } else if (phase === 'playing') {
        elapsedActiveMs += dt;
        remainingMs = Math.max(0, remainingMs - dt);

        if (mismatchLock) {
          mismatchRemainingMs = Math.max(0, mismatchRemainingMs - dt);
          if (mismatchRemainingMs <= 0) {
            resolveMismatchPair();
          }
        }

        const wholeSec = Math.ceil(remainingMs / 1000);
        if (wholeSec <= 10 && wholeSec >= 1 && wholeSec !== lastPlayTickSec) {
          lastPlayTickSec = wholeSec;
          ctx.audio.playTick();
        }

        syncHud();
        if (remainingMs <= 0) {
          finishGame(false);
          rafId = 0;
          return;
        }
      }
    }

    rafId = requestAnimationFrame(tickFrame);
  };

  updateBoardLayout();
  syncTopbar();
  syncHud();
  lastFrameTs = performance.now();
  rafId = requestAnimationFrame(tickFrame);

  return {
    unmount() {
      finished = true;
      if (revealRafId) {
        cancelAnimationFrame(revealRafId);
        revealRafId = 0;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (finishTimeoutId) {
        clearTimeout(finishTimeoutId);
        finishTimeoutId = 0;
      }
      for (const tid of fxTimeouts) {
        clearTimeout(tid);
      }
      fxTimeouts.clear();

      gridEl.removeEventListener('click', onGridClick);
      gridEl.removeEventListener('keydown', onGridKeyDown);
      skipLinkEl.removeEventListener('click', onPreviewSkipClick);
      window.removeEventListener('keydown', onPreviewSkipKeyDown);
      window.removeEventListener('pm:pausechange', onPauseChange);
      window.removeEventListener('resize', onWindowResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      container.innerHTML = '';
    },
  };
}
