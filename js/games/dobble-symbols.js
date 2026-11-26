/**
 * 57 distinct, high-contrast cel-shaded vector SVG symbols for 도블 (Dobble).
 * Bold outlines (#1e1824) and distinct silhouettes ensure clarity at any scale or rotation.
 */

const S = 'stroke="#1e1824" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const S2 = 'stroke="#1e1824" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';

export const DOBBLE_SYMBOLS = [
  {
    id: 'apple',
    label: '사과',
    svg: `<path d="M32 18c-4-5-14-4-17 4-4 10 2 28 11 32 3 1 5 0 6 0s3 1 6 0c9-4 15-22 11-32-3-8-13-9-17-4z" fill="#ef4444" ${S}/><path d="M32 18c1-5 4-9 8-11" fill="none" ${S}/><path d="M33 13c4-5 11-5 13-1-4 4-9 4-13 1z" fill="#22c55e" ${S2}/><ellipse cx="22" cy="27" rx="2.5" ry="5" transform="rotate(-15 22 27)" fill="#fca5a5"/>`,
  },
  {
    id: 'banana',
    label: '바나나',
    svg: `<path d="M14 42c10 10 31 6 38-14 2-6 1-12-2-15l-4 2c2 5 0 13-6 19-7 7-18 8-24 4l-2 4z" fill="#facc15" ${S}/><path d="M47 13l3-3" fill="none" ${S}/><path d="M13 42l-2 2" fill="none" ${S}/>`,
  },
  {
    id: 'watermelon',
    label: '수박',
    svg: `<path d="M8 26a24 24 0 0 0 48 0z" fill="#16a34a" ${S}/><path d="M13 26a19 19 0 0 0 38 0z" fill="#f43f5e" ${S2}/><circle cx="24" cy="33" r="1.7" fill="#1e1824"/><circle cx="32" cy="36" r="1.7" fill="#1e1824"/><circle cx="40" cy="33" r="1.7" fill="#1e1824"/><circle cx="28" cy="29" r="1.5" fill="#1e1824"/><circle cx="36" cy="29" r="1.5" fill="#1e1824"/>`,
  },
  {
    id: 'cherry',
    label: '체리',
    svg: `<path d="M22 38c2-11 8-21 15-26M43 40c-1-10-3-20-6-28" fill="none" ${S}/><path d="M37 12c5-4 11-3 14 2-5 3-10 2-14-2z" fill="#22c55e" ${S2}/><circle cx="20" cy="44" r="10" fill="#dc2626" ${S}/><circle cx="44" cy="45" r="10" fill="#e11d48" ${S}/><circle cx="17" cy="41" r="2.3" fill="#fecaca"/><circle cx="41" cy="42" r="2.3" fill="#fecaca"/>`,
  },
  {
    id: 'lemon',
    label: '레몬',
    svg: `<path d="M12 36c-3-4-2-9 2-13 8-8 24-11 33-6 4 2 7 6 5 11-2 9-12 20-26 21-6 0-11-4-14-13z" fill="#fde047" ${S}/><path d="M14 23l-4-2M51 28l4 2" fill="none" ${S}/><circle cx="28" cy="31" r="1.6" fill="#ca8a04"/><circle cx="35" cy="28" r="1.6" fill="#ca8a04"/><circle cx="33" cy="36" r="1.6" fill="#ca8a04"/>`,
  },
  {
    id: 'strawberry',
    label: '딸기',
    svg: `<path d="M32 54c-11-6-18-20-16-30 1-5 7-7 16-7s15 2 16 7c2 10-5 24-16 30z" fill="#f43f5e" ${S}/><path d="M20 18l6-6 6 5 6-5 6 6-7 3-5-2-5 2z" fill="#22c55e" ${S2}/><circle cx="25" cy="29" r="1.4" fill="#fef08a"/><circle cx="33" cy="27" r="1.4" fill="#fef08a"/><circle cx="39" cy="31" r="1.4" fill="#fef08a"/><circle cx="28" cy="38" r="1.4" fill="#fef08a"/><circle cx="36" cy="39" r="1.4" fill="#fef08a"/><circle cx="32" cy="46" r="1.4" fill="#fef08a"/>`,
  },
  {
    id: 'carrot',
    label: '당근',
    svg: `<path d="M40 16l6-8M44 19l10-3M37 14l-1-8" fill="none" stroke="#16a34a" stroke-width="3.2" stroke-linecap="round"/><path d="M36 16c6 0 11 5 11 11 0 5-22 25-31 28-3 1-5-1-4-4 3-9 19-35 24-35z" fill="#f97316" ${S}/><path d="M31 26l5 5M24 34l4 4M19 42l3 3" fill="none" ${S2}/>`,
  },
  {
    id: 'corn',
    label: '옥수수',
    svg: `<ellipse cx="32" cy="28" rx="10" ry="18" fill="#facc15" ${S}/><path d="M23 22h18M22 29h20M23 36h18M32 11v34" fill="none" stroke="#ca8a04" stroke-width="1.6"/><path d="M22 30c-6 4-8 15-3 22 5 2 10-1 13-6" fill="#22c55e" ${S}/><path d="M42 30c6 4 8 15 3 22-5 2-10-1-13-6" fill="#16a34a" ${S}/>`,
  },
  {
    id: 'donut',
    label: '도넛',
    svg: `<circle cx="32" cy="32" r="21" fill="#d97706" ${S}/><path d="M12 29c2-11 12-18 20-18 11 0 19 8 20 18-3 4-7 1-10 3-3 2-5 5-9 3-3-2-6 3-10 1-4-2-8 1-11-7z" fill="#f472b6" ${S2}/><circle cx="32" cy="32" r="7" fill="#ffffff" ${S}/><rect x="22" y="17" width="5" height="2" rx="1" transform="rotate(25 22 17)" fill="#fef08a"/><rect x="38" y="18" width="5" height="2" rx="1" transform="rotate(-20 38 18)" fill="#38bdf8"/><rect x="42" y="27" width="5" height="2" rx="1" transform="rotate(40 42 27)" fill="#ffffff"/>`,
  },
  {
    id: 'cake',
    label: '케이크',
    svg: `<path d="M12 31l32-10 9 10v17H12z" fill="#fde68a" ${S}/><path d="M12 40h41" stroke="#f43f8e" stroke-width="4.5"/><path d="M12 31l32-10 9 10c-4 3-8 1-12 3-4 2-8-2-13 0-5 2-10-1-16 0z" fill="#fbcfe8" ${S2}/><circle cx="34" cy="20" r="5" fill="#ef4444" ${S2}/><path d="M35 15c2-4 5-6 8-5" fill="none" stroke="#16a34a" stroke-width="2.4" stroke-linecap="round"/><rect x="9" y="48" width="46" height="5" rx="2.5" fill="#cbd5e1" ${S2}/>`,
  },
  {
    id: 'pizza',
    label: '피자',
    svg: `<path d="M14 14c12-6 24-6 36 0l-18 39z" fill="#facc15" ${S}/><path d="M11 15c13-7 29-7 42 0l-3 6c-12-5-24-5-36 0z" fill="#d97706" ${S}/><circle cx="29" cy="26" r="4" fill="#ef4444" ${S2}/><circle cx="37" cy="31" r="3.5" fill="#ef4444" ${S2}/><circle cx="31" cy="39" r="3.2" fill="#ef4444" ${S2}/>`,
  },
  {
    id: 'icecream',
    label: '아이스크림',
    svg: `<polygon points="22,31 42,31 32,56" fill="#f59e0b" ${S}/><path d="M25 38h14M28 45h8" fill="none" stroke="#b45309" stroke-width="1.8"/><circle cx="25" cy="25" r="9" fill="#38bdf8" ${S}/><circle cx="39" cy="25" r="9" fill="#f472b6" ${S}/><circle cx="32" cy="17" r="9" fill="#fef08a" ${S}/>`,
  },
  {
    id: 'coffee',
    label: '커피',
    svg: `<path d="M44 26h6a5 5 0 0 1 0 10h-6" fill="none" ${S}/><path d="M16 22h28v17a12 12 0 0 1-28 0z" fill="#ffffff" ${S}/><ellipse cx="30" cy="22" rx="14" ry="3.5" fill="#78350f" ${S2}/><path d="M24 14c-2-3 2-5 0-8M31 14c-2-3 2-5 0-8M38 14c-2-3 2-5 0-8" fill="none" stroke="#94a3b8" stroke-width="2.2" stroke-linecap="round"/><rect x="12" y="50" width="36" height="4" rx="2" fill="#cbd5e1" ${S2}/>`,
  },
  {
    id: 'candy',
    label: '사탕',
    svg: `<polygon points="18,22 9,15 11,28" fill="#fb7185" ${S2}/><polygon points="46,42 55,49 53,36" fill="#fb7185" ${S2}/><circle cx="32" cy="32" r="14" fill="#f43f8e" ${S}/><path d="M23 22c4 6 14 14 18 20M20 31c6 2 18 4 24 2" fill="none" stroke="#fef08a" stroke-width="3.2" stroke-linecap="round"/>`,
  },
  {
    id: 'star',
    label: '별',
    svg: `<polygon points="32,8 39,23 55,25 43,36 46,53 32,45 18,53 21,36 9,25 25,23" fill="#fbbf24" ${S}/><polygon points="32,16 36,26 46,27 38,34 40,44 32,39 24,44 26,34 18,27 28,26" fill="#fef08a"/>`,
  },
  {
    id: 'moon',
    label: '초승달',
    svg: `<path d="M40 10a22 22 0 1 0 12 39 18 18 0 0 1-12-39z" fill="#fde047" ${S}/>`,
  },
  {
    id: 'sun',
    label: '태양',
    svg: `<path d="M32 7v7M32 50v7M7 32h7M50 32h7M14 14l5 5M45 45l5 5M50 14l-5 5M19 45l-5 5" fill="none" stroke="#f97316" stroke-width="3.6" stroke-linecap="round"/><circle cx="32" cy="32" r="14" fill="#fbbf24" ${S}/>`,
  },
  {
    id: 'cloud',
    label: '구름',
    svg: `<path d="M18 46h29a9 9 0 0 0 1-18 13 13 0 0 0-25-4 10 10 0 0 0-14 9c0 7 4 13 9 13z" fill="#bae6fd" ${S}/><path d="M20 42h25" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: 'bolt',
    label: '번개',
    svg: `<polygon points="36,8 15,35 30,35 26,56 49,27 34,27" fill="#facc15" ${S}/>`,
  },
  {
    id: 'snowflake',
    label: '눈송이',
    svg: `<g stroke="#0ea5e9" stroke-width="3.4" stroke-linecap="round"><path d="M32 8v48M11 20l42 24M53 20L11 44"/><path d="M26 14l6 5 6-5M26 50l6-5 6 5M14 27l6-3-2-6M50 37l-6 3 2 6M50 27l-6-3 2-6M14 37l6 3-2 6" fill="none" stroke-width="2.4"/></g><circle cx="32" cy="32" r="4" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>`,
  },
  {
    id: 'drop',
    label: '물방울',
    svg: `<path d="M32 9C23 22 15 31 15 40a17 17 0 0 0 34 0c0-9-8-18-17-31z" fill="#38bdf8" ${S}/><path d="M23 39a8 8 0 0 0 6 8" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: 'flame',
    label: '불꽃',
    svg: `<path d="M34 8c2 9-5 14-5 20 0 3 2 5 4 5 3-4 4-9 4-13 8 6 12 14 12 21a17 17 0 0 1-34 0c0-10 7-19 19-33z" fill="#f97316" ${S}/><path d="M33 28c4 4 6 9 6 14a7 7 0 0 1-14 0c0-5 3-10 8-14z" fill="#fde047"/>`,
  },
  {
    id: 'heart',
    label: '하트',
    svg: `<path d="M32 53S11 40 11 24a11 11 0 0 1 21-4 11 11 0 0 1 21 4c0 16-21 29-21 29z" fill="#f43f5e" ${S}/><ellipse cx="21" cy="23" rx="2.5" ry="4.5" transform="rotate(-25 21 23)" fill="#fecdd3"/>`,
  },
  {
    id: 'diamond',
    label: '다이아몬드',
    svg: `<polygon points="18,14 46,14 55,27 32,53 9,27" fill="#38bdf8" ${S}/><path d="M9 27h46M22 27l-4-13M42 27l4-13M22 27l10 26 10-26" fill="none" ${S2}/><polygon points="18,14 32,27 46,14" fill="#bae6fd" opacity="0.7"/>`,
  },
  {
    id: 'crown',
    label: '왕관',
    svg: `<path d="M11 44L9 20l13 11 10-16 10 16 13-11-2 24z" fill="#facc15" ${S}/><rect x="12" y="44" width="40" height="8" rx="2" fill="#d97706" ${S2}/><circle cx="9" cy="18" r="3" fill="#38bdf8" ${S2}/><circle cx="32" cy="13" r="3.5" fill="#f43f5e" ${S2}/><circle cx="55" cy="18" r="3" fill="#38bdf8" ${S2}/>`,
  },
  {
    id: 'trophy',
    label: '트로피',
    svg: `<path d="M18 16h-7c0 9 4 14 10 14M46 16h7c0 9-4 14-10 14" fill="none" stroke="#eab308" stroke-width="3.6" stroke-linecap="round"/><path d="M18 12h28v12c0 9-6 15-14 15s-14-6-14-15z" fill="#fbbf24" ${S}/><rect x="28" y="39" width="8" height="8" fill="#f59e0b" ${S2}/><rect x="20" y="47" width="24" height="7" rx="2" fill="#b45309" ${S2}/>`,
  },
  {
    id: 'key',
    label: '열쇠',
    svg: `<circle cx="21" cy="23" r="10" fill="#a3e635" ${S}/><circle cx="21" cy="23" r="4" fill="#ffffff" ${S2}/><path d="M28 30l22 22 5-5-5-5 4-4-6-6-4 4-11-11" fill="#a3e635" ${S}/>`,
  },
  {
    id: 'lock',
    label: '자물쇠',
    svg: `<path d="M22 28v-8a10 10 0 0 1 20 0v8" fill="none" stroke="#64748b" stroke-width="4.5" stroke-linecap="round"/><rect x="15" y="27" width="34" height="26" rx="5" fill="#fbbf24" ${S}/><circle cx="32" cy="38" r="3.5" fill="#1e1824"/><path d="M32 41v6" stroke="#1e1824" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: 'rocket',
    label: '로켓',
    svg: `<path d="M18 46l-8 8 9-2 5 6 4-10" fill="#f97316" ${S2}/><path d="M26 30l-12 3 5 9 8-4zM38 42l-3 12-9-5 4-8z" fill="#ef4444" ${S2}/><path d="M51 13c-12 0-24 8-29 20l9 9c12-5 20-17 20-29z" fill="#f8fafc" ${S}/><circle cx="38" cy="26" r="5" fill="#38bdf8" ${S2}/>`,
  },
  {
    id: 'car',
    label: '자동차',
    svg: `<path d="M12 34l6-12h24l8 12h4a4 4 0 0 1 4 4v8H8v-8a4 4 0 0 1 4-4z" fill="#ef4444" ${S}/><path d="M19 24l-3 8h28l-5-8z" fill="#bae6fd" ${S2}/><circle cx="20" cy="46" r="6" fill="#334155" ${S}/><circle cx="46" cy="46" r="6" fill="#334155" ${S}/><circle cx="20" cy="46" r="2" fill="#e2e8f0"/><circle cx="46" cy="46" r="2" fill="#e2e8f0"/>`,
  },
  {
    id: 'plane',
    label: '비행기',
    svg: `<path d="M55 15c2 2 1 6-2 9L41 36l4 18-5 3-9-13-9 6 1 7-4 2-5-8-8-5 2-4 7 1 6-9-13-9 3-5 18 4 12-12c3-3 7-4 9-2z" fill="#60a5fa" ${S}/>`,
  },
  {
    id: 'bike',
    label: '자전거',
    svg: `<circle cx="17" cy="42" r="9" fill="none" stroke="#1e1824" stroke-width="3.2"/><circle cx="47" cy="42" r="9" fill="none" stroke="#1e1824" stroke-width="3.2"/><path d="M17 42l12-16h11l7 16m-18-16l3 16h15M24 26h8M38 22h6" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'anchor',
    label: '닻',
    svg: `<circle cx="32" cy="14" r="5" fill="none" stroke="#1d4ed8" stroke-width="3.4"/><path d="M32 19v33M21 26h22M13 38a19 19 0 0 0 38 0" fill="none" stroke="#1d4ed8" stroke-width="3.8" stroke-linecap="round"/><polygon points="10,41 13,34 18,39" fill="#1d4ed8"/><polygon points="54,41 51,34 46,39" fill="#1d4ed8"/>`,
  },
  {
    id: 'compass',
    label: '나침반',
    svg: `<circle cx="32" cy="32" r="21" fill="#fbbf24" ${S}/><circle cx="32" cy="32" r="16" fill="#0f172a" ${S2}/><polygon points="42,22 35,36 28,29" fill="#ef4444"/><polygon points="22,42 29,28 36,35" fill="#38bdf8"/><circle cx="32" cy="32" r="2.8" fill="#fef08a"/>`,
  },
  {
    id: 'clock',
    label: '시계',
    svg: `<circle cx="32" cy="32" r="21" fill="#a16207" ${S}/><circle cx="32" cy="32" r="16" fill="#fefce8" ${S2}/><path d="M32 21v11l8 5" fill="none" ${S}/><circle cx="32" cy="32" r="2.4" fill="#ef4444"/>`,
  },
  {
    id: 'bulb',
    label: '전구',
    svg: `<path d="M24 41c0-6-7-9-7-17a15 15 0 1 1 30 0c0 8-7 11-7 17z" fill="#fde047" ${S}/><rect x="25" y="42" width="14" height="9" rx="2" fill="#94a3b8" ${S2}/><path d="M27 54h10M29 29l3-6 3 6" fill="none" ${S2}/>`,
  },
  {
    id: 'loupe',
    label: '돋보기',
    svg: `<path d="M39 39l14 14" stroke="#78350f" stroke-width="6.5" stroke-linecap="round"/><circle cx="27" cy="27" r="15" fill="#bae6fd" ${S}/><path d="M20 22a8 8 0 0 1 8-5" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: 'camera',
    label: '카메라',
    svg: `<path d="M21 19l3-5h16l3 5h9a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V23a4 4 0 0 1 4-4z" fill="#475569" ${S}/><circle cx="32" cy="34" r="10" fill="#0ea5e9" ${S}/><circle cx="32" cy="34" r="5" fill="#0f172a"/><circle cx="47" cy="25" r="2.5" fill="#fef08a"/>`,
  },
  {
    id: 'headphone',
    label: '헤드폰',
    svg: `<path d="M14 36v-4a18 18 0 0 1 36 0v4" fill="none" stroke="#8b5cf6" stroke-width="5" stroke-linecap="round"/><rect x="9" y="33" width="9" height="17" rx="4" fill="#a855f7" ${S}/><rect x="46" y="33" width="9" height="17" rx="4" fill="#a855f7" ${S}/>`,
  },
  {
    id: 'music',
    label: '음표',
    svg: `<path d="M25 44V17l24-5v27" fill="none" stroke="#ec4899" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 23l24-5" stroke="#ec4899" stroke-width="4.5"/><circle cx="19" cy="45" r="6.5" fill="#ec4899" ${S2}/><circle cx="43" cy="40" r="6.5" fill="#ec4899" ${S2}/>`,
  },
  {
    id: 'bell',
    label: '종',
    svg: `<path d="M32 10v4" fill="none" ${S}/><path d="M18 40c0-11 4-23 14-23s14 12 14 23l5 5H13z" fill="#fbbf24" ${S}/><path d="M27 45a5 5 0 0 0 10 0" fill="#d97706" ${S2}/>`,
  },
  {
    id: 'book',
    label: '책',
    svg: `<path d="M14 14h34v36H14a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" fill="#3b82f6" ${S}/><path d="M15 44h33v6H15a3 3 0 0 1 0-6z" fill="#f8fafc" ${S2}/><rect x="21" y="21" width="19" height="7" rx="1.5" fill="#fef08a" ${S2}/>`,
  },
  {
    id: 'pencil',
    label: '연필',
    svg: `<polygon points="15,49 18,37 43,12 52,21 27,46" fill="#facc15" ${S}/><polygon points="15,49 18,37 27,46" fill="#fde68a" ${S2}/><polygon points="15,49 17,43 21,47" fill="#1e1824"/><path d="M40 15l9 9" fill="none" ${S2}/><path d="M43 12l4-4 9 9-4 4z" fill="#f472b6" ${S2}/>`,
  },
  {
    id: 'scissors',
    label: '가위',
    svg: `<path d="M23 35l27-20M23 29l27 20" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/><circle cx="17" cy="22" r="7" fill="none" stroke="#ef4444" stroke-width="3.6"/><circle cx="17" cy="42" r="7" fill="none" stroke="#ef4444" stroke-width="3.6"/><circle cx="31" cy="32" r="2.2" fill="#1e1824"/>`,
  },
  {
    id: 'umbrella',
    label: '우산',
    svg: `<path d="M32 10v36a5 5 0 0 1-10 0" fill="none" ${S}/><path d="M9 32a23 23 0 0 1 46 0c-5-3-10-3-15 0-5-3-11-3-16 0-5-3-10-3-15 0z" fill="#8b5cf6" ${S}/><path d="M32 12c-5 6-7 13-7 19M32 12c5 6 7 13 7 19" fill="none" stroke="#ddd6fe" stroke-width="2"/>`,
  },
  {
    id: 'glasses',
    label: '안경',
    svg: `<circle cx="19" cy="34" r="10" fill="#bae6fd" ${S}/><circle cx="45" cy="34" r="10" fill="#bae6fd" ${S}/><path d="M29 33c2-2 4-2 6 0M9 32l-3-7M55 32l3-7" fill="none" ${S}/>`,
  },
  {
    id: 'hat',
    label: '모자',
    svg: `<path d="M18 35l4-18h20l4 18z" fill="#92400e" ${S}/><path d="M19 30h26" stroke="#fbbf24" stroke-width="4"/><ellipse cx="32" cy="37" rx="23" ry="5.5" fill="#b45309" ${S}/>`,
  },
  {
    id: 'gift',
    label: '선물상자',
    svg: `<rect x="14" y="25" width="36" height="27" rx="3" fill="#f43f5e" ${S}/><rect x="11" y="20" width="42" height="8" rx="2" fill="#fb7185" ${S}/><rect x="29" y="20" width="6" height="32" fill="#fde047" ${S2}/><path d="M32 20c-6-8-14-6-12 0M32 20c6-8 14-6 12 0" fill="#fde047" ${S2}/>`,
  },
  {
    id: 'balloon',
    label: '풍선',
    svg: `<path d="M32 43c0 6-3 10 1 15" fill="none" ${S2}/><ellipse cx="32" cy="25" rx="15" ry="18" fill="#ec4899" ${S}/><polygon points="29,43 35,43 32,39" fill="#ec4899" ${S2}/><ellipse cx="26" cy="18" rx="3" ry="5.5" transform="rotate(-20 26 18)" fill="#fbcfe8"/>`,
  },
  {
    id: 'dice',
    label: '주사위',
    svg: `<rect x="13" y="13" width="38" height="38" rx="7" fill="#ffffff" ${S}/><circle cx="23" cy="23" r="3.4" fill="#1e1824"/><circle cx="41" cy="23" r="3.4" fill="#1e1824"/><circle cx="32" cy="32" r="3.8" fill="#ef4444"/><circle cx="23" cy="41" r="3.4" fill="#1e1824"/><circle cx="41" cy="41" r="3.4" fill="#1e1824"/>`,
  },
  {
    id: 'ball',
    label: '축구공',
    svg: `<circle cx="32" cy="32" r="21" fill="#ffffff" ${S}/><polygon points="32,22 41,29 37,39 27,39 23,29" fill="#1e293b"/><path d="M32 22v-10M41 29l11-4M37 39l8 10M27 39l-8 10M23 29l-11-4" fill="none" stroke="#1e293b" stroke-width="2.2"/>`,
  },
  {
    id: 'clover',
    label: '네잎클로버',
    svg: `<path d="M32 34v19" fill="none" stroke="#15803d" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="22" r="8" fill="#22c55e" ${S2}/><circle cx="40" cy="22" r="8" fill="#22c55e" ${S2}/><circle cx="24" cy="36" r="8" fill="#16a34a" ${S2}/><circle cx="40" cy="36" r="8" fill="#16a34a" ${S2}/><circle cx="32" cy="29" r="3" fill="#86efac"/>`,
  },
  {
    id: 'cactus',
    label: '선인장',
    svg: `<path d="M26 51V17a6 6 0 0 1 12 0v34z" fill="#22c55e" ${S}/><path d="M26 36h-7a5 5 0 0 1-5-5v-8a3.5 3.5 0 0 1 7 0v6h5M38 32h7a5 5 0 0 0 5-5v-7a3.5 3.5 0 0 0-7 0v5h-5" fill="#16a34a" ${S}/><rect x="20" y="50" width="24" height="5" rx="2" fill="#d97706" ${S2}/>`,
  },
  {
    id: 'mushroom',
    label: '버섯',
    svg: `<path d="M25 32h14l2 19H23z" fill="#fef3c7" ${S}/><path d="M10 34C10 15 54 15 54 34c-14 3-30 3-44 0z" fill="#ef4444" ${S}/><circle cx="23" cy="24" r="4" fill="#ffffff"/><circle cx="35" cy="19" r="4.5" fill="#ffffff"/><circle cx="43" cy="27" r="3.2" fill="#ffffff"/>`,
  },
  {
    id: 'butterfly',
    label: '나비',
    svg: `<path d="M31 30C20 12 8 15 10 29c1 7 11 9 21 6z" fill="#a855f7" ${S}/><path d="M33 30C44 12 56 15 54 29c-1 7-11 9-21 6z" fill="#a855f7" ${S}/><path d="M31 35c-11 2-17 10-12 16 4 4 10 0 12-10z" fill="#f59e0b" ${S}/><path d="M33 35c11 2 17 10 12 16-4 4-10 0-12-10z" fill="#f59e0b" ${S}/><rect x="29.5" y="21" width="5" height="26" rx="2.5" fill="#1e1824"/>`,
  },
  {
    id: 'fish',
    label: '물고기',
    svg: `<polygon points="44,32 56,21 56,43" fill="#fb923c" ${S}/><ellipse cx="28" cy="32" rx="18" ry="13" fill="#f97316" ${S}/><path d="M24 20c4 7 4 17 0 24" fill="none" stroke="#fef08a" stroke-width="3"/><circle cx="18" cy="29" r="3" fill="#ffffff"/><circle cx="17.5" cy="29" r="1.4" fill="#1e1824"/>`,
  },
  {
    id: 'cat',
    label: '고양이',
    svg: `<polygon points="15,28 14,11 26,20" fill="#fb923c" ${S}/><polygon points="49,28 50,11 38,20" fill="#fb923c" ${S}/><ellipse cx="32" cy="35" rx="19" ry="16" fill="#fdba74" ${S}/><circle cx="24" cy="33" r="2.6" fill="#1e1824"/><circle cx="40" cy="33" r="2.6" fill="#1e1824"/><polygon points="29,38 35,38 32,42" fill="#f43f5e"/><path d="M27 44c2 2 4 2 5 0 1 2 3 2 5 0" fill="none" ${S2}/>`,
  },
];
