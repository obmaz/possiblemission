/**
 * Pure-JS ISO/IEC 18004 QR code encoder (byte mode, error correction level M, versions 1..10,
 * up to 216 UTF-8 bytes) with a canvas renderer. No external dependencies.
 */

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
