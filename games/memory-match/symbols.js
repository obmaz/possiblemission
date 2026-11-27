/**
 * 18 vector symbols: 12 arcade/workshop items + 6 railway icons.
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
  // --- Railway set (한국철도연구원 워크숍용 철도 테마 아이콘, generic shapes, no logos) ---
  {
    id: 'bullet-train',
    label: '고속열차',
    shortLabel: '고속열차',
    accent: '#2563eb',
    bgA: 'rgba(37, 99, 235, 0.22)',
    bgB: '#0c1a3b',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-bt-${uid}" x1="6" y1="22" x2="6" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#cbd5e1"/>
          </linearGradient>
        </defs>
        <path d="M2 47H62" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M5 41V29C5 24 8 22 12 22H38C50 22 57 29 61 38V41Z" fill="url(#mm-bt-${uid})" stroke="#090d20" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M5 34H59" stroke="#1d4ed8" stroke-width="3.5"/>
        <path d="M43 24C50 24 55 28 58 32H45Z" fill="#1e293b" stroke="#090d20" stroke-width="1.6" stroke-linejoin="round"/>
        <rect x="10" y="25.5" width="6" height="4.5" rx="1" fill="#1e3a8a"/>
        <rect x="19" y="25.5" width="6" height="4.5" rx="1" fill="#1e3a8a"/>
        <rect x="28" y="25.5" width="6" height="4.5" rx="1" fill="#1e3a8a"/>
        <circle cx="13" cy="43" r="3.2" fill="#334155" stroke="#090d20" stroke-width="1.5"/>
        <circle cx="23" cy="43" r="3.2" fill="#334155" stroke="#090d20" stroke-width="1.5"/>
        <circle cx="42" cy="43" r="3.2" fill="#334155" stroke="#090d20" stroke-width="1.5"/>
        <circle cx="52" cy="43" r="3.2" fill="#334155" stroke="#090d20" stroke-width="1.5"/>
      </svg>
    `,
  },
  {
    id: 'tram',
    label: '트램',
    shortLabel: '트램',
    accent: '#059669',
    bgA: 'rgba(5, 150, 105, 0.22)',
    bgB: '#082a1f',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-tr-${uid}" x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#6ee7b7"/>
            <stop offset="100%" stop-color="#059669"/>
          </linearGradient>
        </defs>
        <path d="M6 6H58" stroke="#64748b" stroke-width="2"/>
        <path d="M26 15L32 6L38 15" stroke="#090d20" stroke-width="2.2" stroke-linejoin="round"/>
        <rect x="16" y="15" width="32" height="34" rx="7" fill="url(#mm-tr-${uid})" stroke="#090d20" stroke-width="2.4"/>
        <rect x="20" y="20" width="24" height="13" rx="3" fill="#e0f2fe" stroke="#090d20" stroke-width="1.8"/>
        <circle cx="22.5" cy="41" r="2.6" fill="#fef08a" stroke="#090d20" stroke-width="1.2"/>
        <circle cx="41.5" cy="41" r="2.6" fill="#fef08a" stroke="#090d20" stroke-width="1.2"/>
        <rect x="27" y="38" width="10" height="5" rx="1.5" fill="#064e3b"/>
        <path d="M14 57L22 49M50 57L42 49" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `,
  },
  {
    id: 'rail-track',
    label: '철로',
    shortLabel: '철로',
    accent: '#b45309',
    bgA: 'rgba(180, 83, 9, 0.2)',
    bgB: '#2a1708',
    renderSvg: () => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M12 52H52M15.5 43H48.5M19 34H45M21.5 26H42.5M24 19H40M26 13H38" stroke="#92400e" stroke-width="4" stroke-linecap="round"/>
        <path d="M14 58L28 10M50 58L36 10" stroke="#475569" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M14 58L28 10M50 58L36 10" stroke="#cbd5e1" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="32" cy="7" r="3" fill="#fbbf24"/>
      </svg>
    `,
  },
  {
    id: 'rail-signal',
    label: '철도 신호기',
    shortLabel: '신호기',
    accent: '#dc2626',
    bgA: 'rgba(220, 38, 38, 0.18)',
    bgB: '#2a0d0d',
    renderSvg: () => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="29.5" y="36" width="5" height="22" fill="#64748b" stroke="#090d20" stroke-width="1.8"/>
        <rect x="22" y="56" width="20" height="4" rx="1.5" fill="#475569" stroke="#090d20" stroke-width="1.6"/>
        <rect x="21" y="5" width="22" height="33" rx="7" fill="#1e293b" stroke="#090d20" stroke-width="2.4"/>
        <circle cx="32" cy="13" r="4.2" fill="#ef4444" stroke="#090d20" stroke-width="1.4"/>
        <circle cx="32" cy="22" r="4.2" fill="#fbbf24" stroke="#090d20" stroke-width="1.4"/>
        <circle cx="32" cy="31" r="4.2" fill="#22c55e" stroke="#090d20" stroke-width="1.4"/>
        <circle cx="30.6" cy="11.6" r="1.3" fill="#fecaca"/>
      </svg>
    `,
  },
  {
    id: 'maglev',
    label: '자기부상열차',
    shortLabel: '자기부상',
    accent: '#7c3aed',
    bgA: 'rgba(124, 58, 237, 0.2)',
    bgB: '#1d1038',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="mm-mg-${uid}" x1="8" y1="20" x2="60" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#eef2ff"/>
            <stop offset="100%" stop-color="#a5b4fc"/>
          </linearGradient>
        </defs>
        <rect x="27" y="50" width="10" height="10" fill="#94a3b8" stroke="#090d20" stroke-width="1.8"/>
        <rect x="4" y="44" width="56" height="7" rx="2" fill="#cbd5e1" stroke="#090d20" stroke-width="2"/>
        <path d="M14 37.5q3 2.5 0 5M26 37.5q3 2.5 0 5M38 37.5q3 2.5 0 5M50 37.5q3 2.5 0 5" stroke="#06b6d4" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 34V26C7 22 10 19 14 19H42C53 19 58 26 61 33V34Z" fill="url(#mm-mg-${uid})" stroke="#090d20" stroke-width="2.4" stroke-linejoin="round"/>
        <rect x="9" y="34" width="50" height="3.5" rx="1.5" fill="#475569" stroke="#090d20" stroke-width="1.4"/>
        <path d="M45 21C52 21 56 25 58 29H47Z" fill="#312e81"/>
        <rect x="12" y="23" width="6" height="4.5" rx="1" fill="#4338ca"/>
        <rect x="21" y="23" width="6" height="4.5" rx="1" fill="#4338ca"/>
        <rect x="30" y="23" width="6" height="4.5" rx="1" fill="#4338ca"/>
      </svg>
    `,
  },
  {
    id: 'rail-wheel',
    label: '열차 바퀴',
    shortLabel: '열차 바퀴',
    accent: '#475569',
    bgA: 'rgba(71, 85, 105, 0.2)',
    bgB: '#1b2230',
    renderSvg: (uid) => `
      <svg class="mm-card__svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="mm-wh-${uid}" cx="32" cy="32" r="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f1f5f9"/>
            <stop offset="100%" stop-color="#94a3b8"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="25" stroke="#475569" stroke-width="3.5"/>
        <circle cx="32" cy="32" r="21" fill="url(#mm-wh-${uid})" stroke="#090d20" stroke-width="2.4"/>
        <circle cx="32" cy="19" r="3.2" fill="#64748b"/>
        <circle cx="44.4" cy="28" r="3.2" fill="#64748b"/>
        <circle cx="39.6" cy="42.5" r="3.2" fill="#64748b"/>
        <circle cx="24.4" cy="42.5" r="3.2" fill="#64748b"/>
        <circle cx="19.6" cy="28" r="3.2" fill="#64748b"/>
        <circle cx="32" cy="32" r="7" fill="#475569" stroke="#090d20" stroke-width="2"/>
        <circle cx="32" cy="32" r="2.6" fill="#0f172a"/>
      </svg>
    `,
  },
];
