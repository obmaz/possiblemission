/**
 * Shared UI helpers: grading, toasts, confetti burst, Slack/KakaoTalk result formatter & parser,
 * clipboard copy, shareable URL builder, pure-JS scannable QR code generator, and modal lifecycle.
 */

/**
 * Computes arcade rank grade from score and completion flag.
 * @param {number} score
 * @param {object} [opts]
 * @param {boolean} [opts.cleared=true]
 * @returns {{ grade: 'S'|'A'|'B'|'C', titleKo: string, badgeEn: string, colorVar: string, copy: string }}
 */
export function calculateGrade(score, opts = {}) {
  const cleared = opts.cleared !== false;
  const pts = Math.max(0, Number(score) || 0);

  if (!cleared) {
    return {
      grade: 'C',
      titleKo: '미션 실패',
      badgeEn: 'MISSION FAILED',
      colorVar: '--neon-crimson',
      copy: '아쉬운 실패! 패턴은 파악됐으니 재도전 각!',
    };
  }
  if (pts < 3000) {
    return {
      grade: 'C',
      titleKo: '완주 성공',
      badgeEn: 'FINISHER',
      colorVar: '--neon-magenta',
      copy: '끝까지 완주 성공! 한 판 더 도전해볼까요?',
    };
  }
  if (pts >= 6800) {
    return {
      grade: 'S',
      titleKo: '전설의 요원',
      badgeEn: 'LEGENDARY AGENT',
      colorVar: '--neon-gold',
      copy: '완벽한 퍼포먼스! 워크샵 1등 자리를 예약했습니다.',
    };
  }
  if (pts >= 5000) {
    return {
      grade: 'A',
      titleKo: '에이스 요원',
      badgeEn: 'PRO ACE',
      colorVar: '--neon-cyan',
      copy: '날카로운 집중력! 상위권 포디움 진입 유력!',
    };
  }
  return {
    grade: 'B',
    titleKo: '프로 요원',
    badgeEn: 'VETERAN CREW',
    colorVar: '--neon-emerald',
    copy: '안정적인 미션 클리어! S랭크까지 조금만 더!',
  };
}

/**
 * Displays a floating neon toast notification in #toast-root.
 * @param {string} message
 * @param {'info'|'success'|'warn'|'error'} [type='info']
 * @param {number} [durationMs=2400]
 */
export function showToast(message, type = 'info', durationMs = 2400) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  while (root.children.length >= 4) {
    root.firstElementChild?.remove();
  }

  const toast = document.createElement('div');
  toast.className = `arcade-toast arcade-toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = String(message ?? '');
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 260);
  }, Math.max(800, durationMs));
}

let confettiRafId = 0;

/**
 * Fires GPU-friendly particle confetti on #confetti-canvas (auto-stops after 3.5s).
 * Respects prefers-reduced-motion; spawns 90 particles desktop / 45 mobile.
 * @param {'S'|'A'|'B'|'C'} [tier='S']
 */
export function launchConfetti(tier = 'S') {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (confettiRafId) {
    cancelAnimationFrame(confettiRafId);
    confettiRafId = 0;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const palettes = {
    S: ['#fbbf24', '#22d3ee', '#f43f8e', '#ffffff', '#a855f7'],
    A: ['#22d3ee', '#34d399', '#a855f7', '#f8fafc'],
    B: ['#34d399', '#22d3ee', '#fbbf24'],
    C: ['#f43f8e', '#a855f7', '#22d3ee'],
  };
  const colors = palettes[tier] || palettes.S;
  const count = w < 640 ? 45 : 90;

  const particles = Array.from({ length: count }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const originX = fromLeft ? w * 0.22 : w * 0.78;
    const originY = h * 0.58;
    const angle = (fromLeft ? -Math.PI * 0.35 : -Math.PI * 0.65) + (Math.random() - 0.5) * 0.75;
    const speed = 6 + Math.random() * 10;
    return {
      x: originX + (Math.random() - 0.5) * 40,
      y: originY + (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.24,
      color: colors[i % colors.length],
      shape: i % 3 === 0 ? 'circle' : 'rect',
    };
  });

  const start = performance.now();
  const duration = 3500;

  const frame = (now) => {
    const elapsed = now - start;
    if (elapsed >= duration) {
      ctx.clearRect(0, 0, w, h);
      confettiRafId = 0;
      return;
    }

    ctx.clearRect(0, 0, w, h);
    const fade = elapsed > duration - 700 ? Math.max(0, (duration - elapsed) / 700) : 1;

    for (const p of particles) {
      p.vy += 0.28;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vRot;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      }
      ctx.restore();
    }

    confettiRafId = requestAnimationFrame(frame);
  };

  confettiRafId = requestAnimationFrame(frame);
}

/**
 * Formats a single-line Slack / KakaoTalk workshop scorecard string.
 * `emoji` comes from the game catalog in app.js (single source of game metadata).
 * `[POSSIBLE MISSION] <emoji> <gameTitle> (<modeLabel>) | <nickname>(<team>) | <grade>랭크 <score>점 (<timeSec>초) | 정확도 <accuracy>% | 시드: <seed>`
 */
export function formatResultText({
  emoji = '🎮',
  gameTitle,
  modeLabel,
  player,
  grade,
  score,
  timeMs,
  accuracy,
  seed,
}) {
  const nick = (player?.nickname || '익명요원').trim() || '익명요원';
  const team = (player?.team || '').trim();
  const playerStr = team ? `${nick}(${team})` : nick;
  const formattedScore = Math.max(0, Math.round(Number(score) || 0)).toLocaleString('en-US');
  const timeSec = (Math.max(0, Number(timeMs) || 0) / 1000).toFixed(1);
  const acc = Math.max(0, Math.min(100, Math.round(Number(accuracy) || 0)));

  return `[POSSIBLE MISSION] ${emoji} ${gameTitle} (${modeLabel}) | ${playerStr} | ${grade}랭크 ${formattedScore}점 (${timeSec}초) | 정확도 ${acc}% | 시드: ${seed}`;
}

/**
 * Parses pasted Slack/KakaoTalk result lines for the Hall of Fame projector importer.
 * @param {string} rawText
 * @returns {Array<{ gameTitle: string, modeLabel: string, nickname: string, team: string, grade: string, score: number, timeSec: number, accuracy: number, seed: string }>}
 */
export function parseResultLines(rawText) {
  const lines = String(rawText ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = [];
  const lineRegex =
    /\[POSSIBLE MISSION\]\s*\S*\s*(.+?)\s+\(([^)]+)\)\s*\|\s*([^|]+?)\s*\|\s*([SABC])랭크\s+([\d,]+)점\s+\(([\d.]+)초\)\s*\|\s*정확도\s+(\d+)%\s*\|\s*시드:\s*([A-Z0-9-_]+)/i;

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (!match) continue;

    const rawPlayer = match[3].trim();
    const playerMatch = rawPlayer.match(/^(.+?)\(([^)]+)\)$/);
    const nickname = (playerMatch ? playerMatch[1] : rawPlayer).trim();
    const team = (playerMatch ? playerMatch[2] : '').trim();

    parsed.push({
      gameTitle: match[1].trim(),
      modeLabel: match[2].trim(),
      nickname,
      team,
      grade: match[4].toUpperCase(),
      score: parseInt(match[5].replace(/,/g, ''), 10) || 0,
      timeSec: parseFloat(match[6]) || 0,
      accuracy: parseInt(match[7], 10) || 0,
      seed: match[8].toUpperCase(),
    });
  }

  return parsed.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timeSec - b.timeSec;
  });
}

/**
 * Copies text via navigator.clipboard with textarea execCommand fallback for WebViews.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return Boolean(ok);
  } catch {
    return false;
  }
}

/**
 * Builds an absolute shareable URL preserving the current pathname (GitHub Pages subpath safe).
 * @param {{ seed: string, game?: string, mode?: string }} params
 * @returns {string}
 */
export function buildShareUrl({ seed, game, mode }) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  if (seed) url.searchParams.set('seed', seed);
  if (game) url.searchParams.set('game', game);
  if (mode && game) url.searchParams.set('mode', mode);
  return url.toString();
}

/* ============================================================================
 * Pure-JS ISO/IEC 18004 QR Code Encoder (Byte Mode, Error Correction Level M)
 * Versions 1..10 (up to 216 UTF-8 bytes) — zero external dependencies.
 * ========================================================================== */

const QR_GF_EXP = new Uint8Array(512);
const QR_GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    QR_GF_EXP[i] = x;
    QR_GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    QR_GF_EXP[i] = QR_GF_EXP[i - 255];
  }
})();

function qrGfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return QR_GF_EXP[QR_GF_LOG[a] + QR_GF_LOG[b]];
}

function qrRsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = QR_GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= qrGfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function qrRsEncode(dataBytes, ecLen) {
  const gen = qrRsGeneratorPoly(ecLen);
  const res = new Uint8Array(dataBytes.length + ecLen);
  res.set(dataBytes);
  for (let i = 0; i < dataBytes.length; i += 1) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j += 1) {
        res[i + j] ^= qrGfMul(gen[j], coef);
      }
    }
  }
  return res.slice(dataBytes.length);
}

// Level M capacity & block tables for Versions 1..10
const QR_SPEC_M = [
  null,
  { totalData: 16, ecPerBlock: 10, blocks: [[1, 16]], align: [] },
  { totalData: 28, ecPerBlock: 16, blocks: [[1, 28]], align: [6, 18] },
  { totalData: 44, ecPerBlock: 26, blocks: [[1, 44]], align: [6, 22] },
  { totalData: 64, ecPerBlock: 18, blocks: [[2, 32]], align: [6, 26] },
  { totalData: 86, ecPerBlock: 24, blocks: [[2, 43]], align: [6, 30] },
  { totalData: 108, ecPerBlock: 16, blocks: [[4, 27]], align: [6, 34] },
  { totalData: 124, ecPerBlock: 18, blocks: [[4, 31]], align: [6, 22, 38] },
  { totalData: 154, ecPerBlock: 22, blocks: [[2, 38], [2, 39]], align: [6, 24, 42] },
  { totalData: 182, ecPerBlock: 22, blocks: [[3, 36], [2, 37]], align: [6, 26, 46] },
  { totalData: 216, ecPerBlock: 26, blocks: [[4, 43], [1, 44]], align: [6, 28, 50] },
];

function encodeQrMatrix(text) {
  const utf8 = new TextEncoder().encode(String(text ?? ''));
  let version = 1;
  while (version <= 10) {
    const charCountBits = version <= 9 ? 8 : 16;
    const overheadBits = 4 + charCountBits;
    const capBytes = QR_SPEC_M[version].totalData;
    if (overheadBits + utf8.length * 8 <= capBytes * 8) break;
    version += 1;
  }
  if (version > 10) {
    throw new Error('URL too long for QR V10-M');
  }

  const spec = QR_SPEC_M[version];
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode 0100 (Byte), Char count, Payload
  pushBits(0b0100, 4);
  pushBits(utf8.length, version <= 9 ? 8 : 16);
  for (const byte of utf8) pushBits(byte, 8);

  const totalBits = spec.totalData * 8;
  const terminatorLen = Math.min(4, totalBits - bits.length);
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx += 1;
  }

  const dataBytes = new Uint8Array(spec.totalData);
  for (let i = 0; i < spec.totalData; i += 1) {
    let b = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      b = (b << 1) | bits[i * 8 + bit];
    }
    dataBytes[i] = b;
  }

  // Split into RS blocks & interleave
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (const [count, len] of spec.blocks) {
    for (let b = 0; b < count; b += 1) {
      const slice = dataBytes.slice(offset, offset + len);
      offset += len;
      dataBlocks.push(slice);
      ecBlocks.push(qrRsEncode(slice, spec.ecPerBlock));
    }
  }

  const codewords = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i += 1) {
    for (const block of dataBlocks) {
      if (i < block.length) codewords.push(block[i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const block of ecBlocks) {
      codewords.push(block[i]);
    }
  }

  // Build matrix
  const size = 17 + version * 4;
  const grid = Array.from({ length: size }, () => new Int8Array(size)); // 0/1
  const isFn = Array.from({ length: size }, () => new Uint8Array(size));

  const setFn = (r, c, val) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    grid[r][c] = val ? 1 : 0;
    isFn[r][c] = 1;
  };

  const drawFinder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        const inRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFn(r, c, !inBorder && (inRing || inCore));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Alignment patterns (before timing patterns so centers on row/col 6 in V7+ are not skipped)
  const align = spec.align;
  for (const rCenter of align) {
    for (const cCenter of align) {
      if (isFn[rCenter][cCenter]) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const dark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          setFn(rCenter + dr, cCenter + dc, dark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    if (!isFn[6][i]) setFn(6, i, i % 2 === 0);
    if (!isFn[i][6]) setFn(i, 6, i % 2 === 0);
  }

  // Dark module
  setFn(4 * version + 9, 8, 1);

  // Reserve format info cells
  for (let i = 0; i < 9; i += 1) {
    if (!isFn[8][i]) isFn[8][i] = 1;
    if (!isFn[i][8]) isFn[i][8] = 1;
  }
  for (let i = 0; i < 8; i += 1) {
    if (!isFn[8][size - 1 - i]) isFn[8][size - 1 - i] = 1;
    if (!isFn[size - 1 - i][8]) isFn[size - 1 - i][8] = 1;
  }

  // Version info for V7+
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vBits = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const bit = (vBits >>> i) & 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit);
      setFn(b, a, bit);
    }
  }

  // Place data bits in zig-zag columns
  const allDataBits = [];
  for (const cw of codewords) {
    for (let b = 7; b >= 0; b -= 1) allDataBits.push((cw >>> b) & 1);
  }
  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (!isFn[r][c]) {
          grid[r][c] = bitIdx < allDataBits.length ? allDataBits[bitIdx] : 0;
          bitIdx += 1;
        }
      }
    }
    upward = !upward;
  }

  // Evaluate 8 mask patterns & select lowest penalty
  const maskFns = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  const writeFormat = (mGrid, maskId) => {
    const data5 = (0b00 << 3) | maskId; // EC Level M = 00
    let rem = data5;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fmt = ((data5 << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i += 1) mGrid[i][8] = (fmt >>> i) & 1;
    mGrid[7][8] = (fmt >>> 6) & 1;
    mGrid[8][8] = (fmt >>> 7) & 1;
    mGrid[8][7] = (fmt >>> 8) & 1;
    for (let i = 9; i < 15; i += 1) mGrid[8][14 - i] = (fmt >>> i) & 1;
    for (let i = 0; i < 8; i += 1) mGrid[8][size - 1 - i] = (fmt >>> i) & 1;
    for (let i = 8; i < 15; i += 1) mGrid[size - 15 + i][8] = (fmt >>> i) & 1;
  };

  const scorePenalty = (mGrid) => {
    let penalty = 0;
    // Rule 1: 5+ consecutive same color in row/col
    for (let r = 0; r < size; r += 1) {
      let runRow = 1;
      let runCol = 1;
      for (let i = 1; i < size; i += 1) {
        if (mGrid[r][i] === mGrid[r][i - 1]) runRow += 1;
        else {
          if (runRow >= 5) penalty += 3 + (runRow - 5);
          runRow = 1;
        }
        if (mGrid[i][r] === mGrid[i - 1][r]) runCol += 1;
        else {
          if (runCol >= 5) penalty += 3 + (runCol - 5);
          runCol = 1;
        }
      }
      if (runRow >= 5) penalty += 3 + (runRow - 5);
      if (runCol >= 5) penalty += 3 + (runCol - 5);
    }
    // Rule 2: 2x2 blocks
    for (let r = 0; r < size - 1; r += 1) {
      for (let c = 0; c < size - 1; c += 1) {
        const v = mGrid[r][c];
        if (v === mGrid[r][c + 1] && v === mGrid[r + 1][c] && v === mGrid[r + 1][c + 1]) {
          penalty += 3;
        }
      }
    }
    return penalty;
  };

  let bestMask = 0;
  let bestScore = Infinity;
  let bestGrid = null;

  for (let m = 0; m < 8; m += 1) {
    const candidate = grid.map((row) => Int8Array.from(row));
    const fn = maskFns[m];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (!isFn[r][c] && fn(r, c)) {
          candidate[r][c] ^= 1;
        }
      }
    }
    writeFormat(candidate, m);
    const score = scorePenalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestMask = m;
      bestGrid = candidate;
    }
  }

  return { size, grid: bestGrid, version, mask: bestMask };
}

/**
 * Draws a crisp, scannable QR matrix onto a <canvas> using pure JS (zero external CDN).
 * @param {HTMLCanvasElement} canvas
 * @param {string} text
 * @param {object} [opts] - { size?: number, fg?: string, bg?: string }
 */
export function renderQrCode(canvas, text, opts = {}) {
  if (!canvas) return;
  const targetSize = Math.max(120, Number(opts.size) || 220);
  const fg = opts.fg || '#070914';
  const bg = opts.bg || '#ffffff';

  const { size, grid } = encodeQrMatrix(text);
  const quiet = 3;
  const totalModules = size + quiet * 2;
  const cell = Math.max(2, Math.floor(targetSize / totalModules));
  const actualPx = totalModules * cell;

  canvas.width = actualPx;
  canvas.height = actualPx;
  canvas.style.width = `${targetSize}px`;
  canvas.style.height = `${targetSize}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, actualPx, actualPx);

  ctx.fillStyle = fg;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (grid[r][c]) {
        ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
    }
  }
}

let activeModalCloseCb = null;
let activeEscHandler = null;
let previousFocusedEl = null;

/**
 * Opens a shared accessible modal inside #modal-root.
 * Closes on ESC key or backdrop click unless { lockBackdrop: true }.
 */
export function openModal({
  title = '',
  subtitle = '',
  contentEl,
  className = '',
  onClose = null,
  lockBackdrop = false,
}) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  closeModal(true);
  previousFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModalCloseCb = typeof onClose === 'function' ? onClose : null;

  root.innerHTML = '';
  root.hidden = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'arcade-modal-backdrop';

  const dialog = document.createElement('div');
  dialog.className = `arcade-modal ${className}`.trim();
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (title) dialog.setAttribute('aria-label', title);

  const header = document.createElement('div');
  header.className = 'arcade-modal__header';

  const titles = document.createElement('div');
  titles.className = 'arcade-modal__titles';
  if (subtitle) {
    const subEl = document.createElement('p');
    subEl.className = 'arcade-modal__subtitle';
    subEl.textContent = subtitle;
    titles.appendChild(subEl);
  }
  if (title) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'arcade-modal__title';
    titleEl.textContent = title;
    titles.appendChild(titleEl);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'arcade-modal__close';
  closeBtn.setAttribute('aria-label', '닫기');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeModal());

  header.append(titles, closeBtn);
  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = 'arcade-modal__body';
  if (contentEl instanceof HTMLElement) {
    body.appendChild(contentEl);
  } else if (typeof contentEl === 'string') {
    body.innerHTML = contentEl;
  }
  dialog.appendChild(body);

  backdrop.appendChild(dialog);
  root.appendChild(backdrop);

  if (!lockBackdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  activeEscHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };
  window.addEventListener('keydown', activeEscHandler);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    closeBtn.focus({ preventScroll: true });
  });
}

/**
 * Closes the currently open modal in #modal-root.
 * @param {boolean} [silent=false]
 */
export function closeModal(silent = false) {
  const root = document.getElementById('modal-root');
  if (activeEscHandler) {
    window.removeEventListener('keydown', activeEscHandler);
    activeEscHandler = null;
  }
  const cb = activeModalCloseCb;
  activeModalCloseCb = null;

  if (root) {
    root.hidden = true;
    root.innerHTML = '';
  }

  if (!silent && cb) {
    cb();
  }
  if (!silent && previousFocusedEl && previousFocusedEl.isConnected) {
    previousFocusedEl.focus({ preventScroll: true });
  }
  previousFocusedEl = null;
}
