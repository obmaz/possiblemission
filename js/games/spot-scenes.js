/**
 * Procedural vector scenes for 틀린그림찾기 (1200×896, cel style with dark outlines).
 *
 * A scene is data: a background painter plus an ordered list of objects made of simple
 * shapes. A difference is a small, declarative edit of one object (recolour, remove,
 * add, move, scale, flip or replace shapes). Because both pictures are rendered from the
 * same data, every difference is guaranteed to be visible exactly where its hitbox is —
 * the hitbox is computed from the shapes that actually changed.
 */

export const SCENE_W = 1200;
export const SCENE_H = 896;
const OUTLINE = '#1E1824';
const OUTLINE_W = 3;
const TAU = Math.PI * 2;
const PI = Math.PI;

/* --- Shape constructors ----------------------------------------------------
 * inner: drawn with its own outline on top of the object's fills (details)
 * flat:  no outline at all
 */
const R = (x, y, w, h, fill, o = {}) => ({ t: 'rect', x, y, w, h, fill, ...o });
const C = (x, y, r, fill, o = {}) => ({ t: 'circle', x, y, r, fill, ...o });
const E = (x, y, rx, ry, fill, rot = 0, o = {}) => ({ t: 'ellipse', x, y, rx, ry, rot, fill, ...o });
const P = (pts, fill, o = {}) => ({ t: 'poly', pts, fill, ...o });
const W = (x, y, r, a0, a1, fill, o = {}) => ({ t: 'wedge', x, y, r, a0, a1, fill, ...o });
const L = (pts, stroke = OUTLINE, lw = OUTLINE_W, o = {}) => ({ t: 'line', pts, stroke, lw, ...o });
const Q = (pts, stroke = OUTLINE, lw = OUTLINE_W, o = {}) => ({ t: 'curve', pts, stroke, lw, ...o });
const T = (x, y, text, size, fill, o = {}) => ({ t: 'text', x, y, text, size, fill, ...o });
const obj = (id, shapes) => ({ id, shapes });
const inner = { inner: true };
const flat = { flat: true };

function star(cx, cy, rOut, rIn, fill, o = {}) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const a = -PI / 2 + (i * PI) / 5;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return P(pts, fill, o);
}

function rotRect(cx, cy, w, h, angle, fill, o = {}) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const pts = [];
  for (const [dx, dy] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
    pts.push(cx + dx * c - dy * s, cy + dx * s + dy * c);
  }
  return P(pts, fill, o);
}

/* --- Rendering -------------------------------------------------------------- */
function trace(g, s) {
  g.beginPath();
  switch (s.t) {
    case 'rect':
      if (s.r && typeof g.roundRect === 'function') g.roundRect(s.x, s.y, s.w, s.h, s.r);
      else g.rect(s.x, s.y, s.w, s.h);
      break;
    case 'circle':
      g.arc(s.x, s.y, s.r, 0, TAU);
      break;
    case 'ellipse':
      g.ellipse(s.x, s.y, s.rx, s.ry, s.rot || 0, 0, TAU);
      break;
    case 'wedge':
      g.moveTo(s.x, s.y);
      g.arc(s.x, s.y, s.r, s.a0, s.a1);
      g.closePath();
      break;
    case 'poly':
    case 'line':
      g.moveTo(s.pts[0], s.pts[1]);
      for (let i = 2; i < s.pts.length; i += 2) g.lineTo(s.pts[i], s.pts[i + 1]);
      if (s.t === 'poly') g.closePath();
      break;
    case 'curve': // x0 y0 (cx cy x y)+ quadratic chain
      g.moveTo(s.pts[0], s.pts[1]);
      for (let i = 2; i + 3 < s.pts.length; i += 4) g.quadraticCurveTo(s.pts[i], s.pts[i + 1], s.pts[i + 2], s.pts[i + 3]);
      break;
    default:
      break;
  }
}

const isStroke = (s) => s.t === 'line' || s.t === 'curve';

function drawText(g, s) {
  g.font = `900 ${s.size}px "Outfit", "Pretendard Variable", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = s.fill;
  g.fillText(s.text, s.x, s.y);
}

function drawObject(g, o) {
  g.save();
  const tf = o.tf;
  if (tf) {
    const b = objectBounds(o.shapes);
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    g.translate(cx + (tf.dx || 0), cy + (tf.dy || 0));
    g.scale((tf.flip ? -1 : 1) * (tf.k || 1), tf.k || 1);
    g.translate(-cx, -cy);
  }
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // Pass 1: one merged silhouette outline behind the whole object
  g.strokeStyle = OUTLINE;
  g.lineWidth = OUTLINE_W * 2;
  for (const s of o.shapes) {
    if (s.inner || s.flat || isStroke(s) || s.t === 'text' || !s.fill) continue;
    trace(g, s);
    g.stroke();
  }
  // Pass 2: fills (+ outlines for inner details), strokes and text in order
  for (const s of o.shapes) {
    if (s.t === 'text') {
      drawText(g, s);
      continue;
    }
    trace(g, s);
    if (isStroke(s)) {
      g.strokeStyle = s.stroke;
      g.lineWidth = s.lw;
      g.stroke();
      continue;
    }
    if (s.fill) {
      g.fillStyle = s.fill;
      g.fill();
    }
    if (s.stroke) {
      g.strokeStyle = s.stroke;
      g.lineWidth = s.lw || OUTLINE_W;
      g.stroke();
    } else if (s.inner && !s.flat) {
      g.strokeStyle = OUTLINE;
      g.lineWidth = 2.5;
      g.stroke();
    }
  }
  g.restore();
}

/* --- Bounds & differences ----------------------------------------------------- */
function shapeBounds(s) {
  switch (s.t) {
    case 'rect':
      return [s.x, s.y, s.x + s.w, s.y + s.h];
    case 'circle':
    case 'wedge':
      return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
    case 'ellipse': {
      const m = Math.max(s.rx, s.ry);
      return [s.x - m, s.y - m, s.x + m, s.y + m];
    }
    case 'text': {
      const w = s.size * 0.62 * s.text.length;
      return [s.x - w / 2, s.y - s.size / 2, s.x + w / 2, s.y + s.size / 2];
    }
    default: {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < s.pts.length; i += 2) {
        x0 = Math.min(x0, s.pts[i]);
        x1 = Math.max(x1, s.pts[i]);
        y0 = Math.min(y0, s.pts[i + 1]);
        y1 = Math.max(y1, s.pts[i + 1]);
      }
      return [x0, y0, x1, y1];
    }
  }
}

function union(a, b) {
  if (!a) return b;
  if (!b) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

function objectBounds(shapes) {
  return shapes.reduce((acc, s) => union(acc, shapeBounds(s)), null) || [0, 0, 0, 0];
}

function transformBounds(b, tf, pivot) {
  if (!tf) return b;
  const cx = (pivot[0] + pivot[2]) / 2;
  const cy = (pivot[1] + pivot[3]) / 2;
  const k = tf.k || 1;
  const xs = [b[0], b[2]].map((x) => cx + (tf.dx || 0) + (x - cx) * k * (tf.flip ? -1 : 1));
  const ys = [b[1], b[3]].map((y) => cy + (tf.dy || 0) + (y - cy) * k);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Returns the scene's object list with the given differences applied. */
function applyDiffs(objects, diffs) {
  let list = objects.map((o) => ({ ...o }));
  for (const d of diffs) {
    const idx = list.findIndex((o) => o.id === d.obj);
    if (d.kind === 'add') {
      const at = d.after ? list.findIndex((o) => o.id === d.after) + 1 : list.length;
      list.splice(at, 0, d.add);
      continue;
    }
    if (idx < 0) continue;
    const o = list[idx];
    if (d.kind === 'remove') {
      list = list.filter((x) => x.id !== d.obj);
    } else if (d.kind === 'recolor') {
      o.shapes = o.shapes.map((s, i) =>
        d.shapes.includes(i) ? (isStroke(s) ? { ...s, stroke: d.to } : { ...s, fill: d.to }) : s
      );
    } else if (d.kind === 'replace') {
      o.shapes = d.with(o.shapes);
    } else if (d.kind === 'move' || d.kind === 'scale' || d.kind === 'flip') {
      o.tf = { ...(o.tf || {}), dx: d.dx, dy: d.dy, k: d.k, flip: d.kind === 'flip' };
    }
  }
  return list;
}

/**
 * Bounds of exactly what differs between the original and modified picture, or null
 * when the edit changes nothing. Shapes are compared as a multiset, so removing one
 * shape does not mark every later (index-shifted) shape as changed.
 */
function diffBounds(objects, d) {
  const orig = objects.find((o) => o.id === d.obj);
  if (d.kind === 'add') return objectBounds(d.add.shapes);
  if (!orig) return null;
  if (d.kind === 'remove') return objectBounds(orig.shapes);
  const [mod] = applyDiffs([orig], [d]);
  if (mod.tf) {
    const b = objectBounds(orig.shapes);
    return union(b, transformBounds(b, mod.tf, b));
  }
  const remaining = new Map();
  for (const sh of mod.shapes) {
    const key = JSON.stringify(sh);
    remaining.set(key, (remaining.get(key) || 0) + 1);
  }
  let box = null;
  for (const sh of orig.shapes) {
    const key = JSON.stringify(sh);
    if (remaining.get(key)) remaining.set(key, remaining.get(key) - 1);
    else box = union(box, shapeBounds(sh));
  }
  for (const sh of mod.shapes) {
    const key = JSON.stringify(sh);
    if (remaining.get(key)) {
      remaining.set(key, remaining.get(key) - 1);
      box = union(box, shapeBounds(sh));
    }
  }
  return box;
}

/**
 * Renders a scene (optionally with differences applied) into a 2D context.
 * The context may be scaled beforehand (e.g. for thumbnails).
 */
export function renderScene(g, scene, diffs = []) {
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  scene.background(g);
  for (const o of applyDiffs(scene.objects, diffs)) drawObject(g, o);
  g.restore();
}

/**
 * Anomaly pool in the same shape the photo stages use:
 * { id, label, x, y, r (normalised to width), subtle, diff }.
 */
export function buildScenePool(scene) {
  const pool = [];
  for (const d of scene.diffs) {
    const b = diffBounds(scene.objects, d);
    if (!b) {
      // A difference that changes nothing would be unfindable: never ship it
      console.error(`[spot-scenes] ${scene.id}/${d.id} changes nothing and was skipped`);
      continue;
    }
    const pad = 10;
    const halfW = (b[2] - b[0]) / 2 + pad;
    const halfH = (b[3] - b[1]) / 2 + pad;
    pool.push({
      id: `${scene.id}-${d.id}`,
      label: d.label,
      x: (b[0] + b[2]) / 2 / SCENE_W,
      y: (b[1] + b[3]) / 2 / SCENE_H,
      r: Math.max(halfW, halfH) / SCENE_W,
      subtle: Boolean(d.subtle),
      diff: d,
    });
  }
  return pool;
}

/* --- Background helpers ------------------------------------------------------ */
function vGradient(g, y0, y1, c0, c1) {
  const grad = g.createLinearGradient(0, y0, 0, y1);
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);
  return grad;
}

function dots(g, color, list, r = 2) {
  g.fillStyle = color;
  for (let i = 0; i < list.length; i += 2) {
    g.beginPath();
    g.arc(list[i], list[i + 1], r, 0, TAU);
    g.fill();
  }
}

/* ============================================================================
 * 1. 해변 BEACH
 * ========================================================================== */
const beach = {
  id: 'beach',
  background(g) {
    g.fillStyle = vGradient(g, 0, 430, '#7cc6ee', '#d7f0fb');
    g.fillRect(0, 0, SCENE_W, 430);
    g.fillStyle = vGradient(g, 430, 600, '#2b8cc4', '#1f6e9e');
    g.fillRect(0, 430, SCENE_W, 170);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 3;
    for (const [x, y] of [[80, 465], [330, 500], [560, 455], [980, 490], [1110, 530], [220, 545], [700, 540]]) {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 20, y - 8, x + 40, y);
      g.stroke();
    }
    g.fillStyle = '#f2d7a0';
    g.beginPath();
    g.moveTo(0, 590);
    g.quadraticCurveTo(300, 555, 600, 588);
    g.quadraticCurveTo(900, 620, 1200, 575);
    g.lineTo(1200, 896);
    g.lineTo(0, 896);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(0, 590);
    g.quadraticCurveTo(300, 555, 600, 588);
    g.quadraticCurveTo(900, 620, 1200, 575);
    g.stroke();
    dots(g, 'rgba(160,120,60,0.25)', [120, 700, 260, 760, 560, 690, 700, 820, 880, 700, 1000, 860, 1150, 760, 420, 850], 3);
  },
  objects: [
    obj('sun', [C(1050, 105, 58, '#ffd23f'), C(1050, 105, 40, '#ffe680', flat)]),
    obj('cloud-big', [E(180, 120, 62, 30, '#ffffff'), E(240, 100, 52, 38, '#ffffff'), E(295, 122, 58, 28, '#ffffff')]),
    obj('cloud-small', [E(640, 80, 40, 20, '#ffffff'), E(682, 68, 36, 26, '#ffffff'), E(722, 82, 38, 19, '#ffffff')]),
    obj('gull-1', [Q([520, 200, 537, 182, 554, 200, 571, 182, 588, 200], OUTLINE, 4)]),
    obj('gull-2', [Q([610, 245, 624, 231, 638, 245, 652, 231, 666, 245], OUTLINE, 4)]),
    obj('boat-mast', [R(817, 360, 7, 112, '#7a4b2a')]),
    obj('boat-sail', [P([828, 368, 828, 462, 890, 462], '#fffdf5')]),
    obj('boat-hull', [P([740, 470, 900, 470, 878, 505, 762, 505], '#e4572e'), R(772, 480, 96, 7, '#ffffff', flat)]),
    obj('palm-trunk', [P([92, 670, 126, 670, 178, 350, 160, 344], '#a0703c'), L([118, 600, 104, 596], OUTLINE, 2), L([132, 520, 116, 515], OUTLINE, 2), L([146, 440, 130, 435], OUTLINE, 2)]),
    obj('palm-leaves', [
      E(108, 338, 72, 17, '#3fa34d', -0.3), E(232, 334, 72, 17, '#3fa34d', 0.3), E(128, 300, 62, 15, '#4cb85a', -0.95),
      E(206, 298, 62, 15, '#4cb85a', 0.95), E(170, 290, 50, 14, '#3fa34d', 1.57),
    ]),
    obj('coconuts', [C(158, 356, 11, '#6b4423'), C(181, 358, 11, '#6b4423')]),
    obj('umbrella-red-pole', [R(417, 548, 7, 165, '#e8e8e8')]),
    obj('umbrella-red', [W(420, 560, 95, PI, TAU, '#e94f64'), W(420, 560, 95, PI + PI / 3, PI + (2 * PI) / 3, '#ffffff', inner)]),
    obj('umbrella-blue-pole', [R(857, 590, 7, 160, '#e8e8e8')]),
    obj('umbrella-blue', [W(860, 600, 90, PI, TAU, '#3d9be9'), W(860, 600, 90, PI + PI / 3, PI + (2 * PI) / 3, '#ffe066', inner)]),
    obj('towel-yellow', [
      P([330, 715, 500, 715, 525, 775, 355, 775], '#ffb703'),
      P([370, 715, 390, 715, 415, 775, 395, 775], '#fb8500', flat), P([440, 715, 460, 715, 485, 775, 465, 775], '#fb8500', flat),
    ]),
    obj('sunglasses', [C(392, 744, 12, '#264653'), C(424, 744, 12, '#264653'), L([404, 742, 412, 742], OUTLINE, 3)]),
    obj('towel-blue', [P([760, 770, 905, 770, 925, 830, 780, 830], '#8ecae6'), P([820, 770, 845, 770, 865, 830, 840, 830], '#219ebc', flat)]),
    obj('beach-ball', [
      C(630, 730, 36, '#ffffff'), W(630, 730, 36, -PI / 2, PI / 6, '#e63946', inner),
      W(630, 730, 36, (5 * PI) / 6, (3 * PI) / 2, '#457b9d', inner), C(630, 730, 7, '#ffffff', inner),
    ]),
    obj('sandcastle', [
      R(950, 660, 150, 72, '#e9c46a'), R(940, 600, 44, 70, '#e9c46a'), R(1066, 600, 44, 70, '#e9c46a'),
      R(940, 588, 12, 14, '#e9c46a'), R(956, 588, 12, 14, '#e9c46a'), R(972, 588, 12, 14, '#e9c46a'),
      R(1066, 588, 12, 14, '#e9c46a'), R(1082, 588, 12, 14, '#e9c46a'), R(1098, 588, 12, 14, '#e9c46a'),
      R(1010, 690, 30, 42, '#b5883e', { ...inner, r: 12 }),
    ]),
    obj('castle-flag', [R(1086, 536, 4, 54, '#7a4b2a'), P([1090, 538, 1120, 549, 1090, 560], '#e63946')]),
    obj('crab', [
      L([276, 840, 258, 862], OUTLINE, 4), L([292, 846, 284, 868], OUTLINE, 4), L([308, 846, 316, 868], OUTLINE, 4), L([324, 840, 342, 862], OUTLINE, 4),
      E(300, 830, 36, 22, '#e63946'), C(258, 808, 11, '#e63946'), C(342, 808, 11, '#e63946'),
      C(290, 806, 6, '#ffffff', inner), C(310, 806, 6, '#ffffff', inner), C(290, 806, 2.5, OUTLINE, flat), C(310, 806, 2.5, OUTLINE, flat),
    ]),
    obj('bucket', [P([1020, 800, 1076, 800, 1068, 856, 1028, 856], '#2a9d8f'), R(1020, 812, 56, 6, '#ffffff', flat)]),
    obj('bucket-handle', [Q([1022, 802, 1048, 768, 1074, 802], OUTLINE, 3)]),
    obj('starfish', [star(540, 850, 26, 11, '#f4a261')]),
    obj('shell', [W(720, 868, 22, PI, TAU, '#ffc8dd'), L([720, 868, 720, 848], OUTLINE, 2), L([720, 868, 706, 852], OUTLINE, 2), L([720, 868, 734, 852], OUTLINE, 2)]),
  ],
  diffs: [
    { id: 'umbrella', label: '빨간 파라솔 색', obj: 'umbrella-red', kind: 'recolor', shapes: [0], to: '#52b788' },
    { id: 'sail', label: '돛단배의 돛', obj: 'boat-sail', kind: 'remove' },
    { id: 'sun', label: '해 크기', obj: 'sun', kind: 'scale', k: 0.7 },
    { id: 'crab', label: '게 색깔', obj: 'crab', kind: 'recolor', shapes: [4, 5, 6], to: '#f4a261' },
    { id: 'ball', label: '비치볼 무늬 색', obj: 'beach-ball', kind: 'recolor', shapes: [1], to: '#ffd23f' },
    { id: 'flag', label: '모래성 깃발', obj: 'castle-flag', kind: 'remove' },
    { id: 'gull', label: '갈매기 한 마리', obj: 'gull-2', kind: 'remove' },
    { id: 'coconut', label: '야자열매 개수', obj: 'coconuts', kind: 'replace', with: (s) => [...s, C(170, 378, 11, '#6b4423')], subtle: true },
    { id: 'towel', label: '파란 수건 색', obj: 'towel-blue', kind: 'recolor', shapes: [0], to: '#ffafcc' },
    { id: 'handle', label: '양동이 손잡이', obj: 'bucket-handle', kind: 'remove', subtle: true },
    { id: 'starfish', label: '불가사리', obj: 'starfish', kind: 'remove' },
    { id: 'cloud', label: '작은 구름', obj: 'cloud-small', kind: 'remove' },
    { id: 'glasses', label: '선글라스 색', obj: 'sunglasses', kind: 'recolor', shapes: [0, 1], to: '#e63946', subtle: true },
  ],
};

/* ============================================================================
 * 2. 도시 야경 NIGHT CITY
 * ========================================================================== */
function building(id, x, top, w, wall, lit) {
  const shapes = [R(x, top, w, 640 - top, wall)];
  const cols = Math.max(2, Math.floor((w - 20) / 36));
  const gap = (w - cols * 22) / (cols + 1);
  let n = 0;
  for (let y = top + 24; y < 600; y += 44) {
    for (let c = 0; c < cols; c += 1) {
      const on = lit.includes(n);
      shapes.push(R(x + gap + c * (22 + gap), y, 22, 26, on ? '#ffd166' : '#22264a', inner));
      n += 1;
    }
  }
  return obj(id, shapes);
}

function streetLamp(id, x) {
  return obj(id, [R(x, 520, 8, 125, '#8d99ae'), R(x - 10, 505, 28, 14, '#8d99ae', { r: 4 }), C(x + 4, 522, 12, '#ffe8a3', inner)]);
}

const cityWindowsLit = [1, 3, 4, 8, 9, 12, 14, 17, 21, 22, 26];
const city = {
  id: 'city',
  background(g) {
    g.fillStyle = vGradient(g, 0, 640, '#141b3d', '#4b2f7a');
    g.fillRect(0, 0, SCENE_W, 640);
    dots(g, 'rgba(255,255,255,0.8)', [60, 60, 150, 140, 330, 50, 420, 120, 560, 70, 690, 150, 760, 40, 880, 110, 940, 30, 1150, 180, 240, 200, 620, 200], 2);
    g.fillStyle = '#4a4e69';
    g.fillRect(0, 640, SCENE_W, 60);
    g.fillStyle = '#2b2d42';
    g.fillRect(0, 700, SCENE_W, 196);
    g.fillStyle = '#ffd166';
    for (let x = 30; x < SCENE_W; x += 140) g.fillRect(x, 790, 70, 8);
  },
  objects: [
    obj('moon', [C(1030, 110, 48, '#f5f3c1'), C(1012, 98, 9, '#e1dca0', flat), C(1046, 126, 6, '#e1dca0', flat)]),
    obj('star-cluster', [star(470, 230, 10, 4, '#fff6b0'), star(505, 260, 7, 3, '#fff6b0')]),
    obj('antenna', [R(298, 150, 5, 62, '#8d99ae'), C(300, 148, 7, '#ff4d6d')]),
    building('b1', 40, 300, 170, '#3a3f73', cityWindowsLit),
    building('b2', 230, 210, 140, '#4b3f72', [0, 2, 5, 7, 8, 11, 13, 16, 19]),
    building('b3', 390, 340, 190, '#2f4d6e', [1, 2, 6, 9, 10, 13, 15]),
    building('b4', 600, 250, 150, '#5a3d6b', [0, 3, 4, 7, 10, 12, 15]),
    obj('billboard', [R(612, 182, 126, 58, '#ff4d8d', { r: 8 }), R(632, 240, 6, 12, '#8d99ae'), R(712, 240, 6, 12, '#8d99ae'), T(675, 212, 'CITY', 30, '#ffffff')]),
    building('b5', 770, 320, 200, '#3a3f73', [2, 3, 5, 8, 9, 12, 14]),
    obj('cat', [E(840, 308, 22, 13, '#111111'), C(820, 296, 11, '#111111'), P([812, 290, 814, 277, 822, 286], '#111111'), P([822, 286, 830, 276, 830, 290], '#111111'), Q([860, 304, 878, 296, 874, 280], '#111111', 5), C(816, 296, 2, '#ffe066', flat), C(824, 296, 2, '#ffe066', flat)]),
    building('b6', 990, 230, 180, '#47406e', [1, 4, 5, 6, 9, 11, 14, 17]),
    streetLamp('lamp-1', 160),
    streetLamp('lamp-2', 560),
    streetLamp('lamp-3', 960),
    obj('traffic-light', [R(1120, 520, 10, 128, '#8d99ae'), R(1100, 410, 50, 112, '#22223b', { r: 8 }), C(1125, 432, 12, '#ff4d6d', inner), C(1125, 466, 12, '#5c4d2e', inner), C(1125, 500, 12, '#1f4d3f', inner)]),
    obj('car-pink', [R(340, 660, 110, 40, '#ef476f', { r: 12 }), R(300, 690, 190, 50, '#ef476f', { r: 14 }), R(352, 668, 40, 26, '#bde0fe', inner), R(398, 668, 40, 26, '#bde0fe', inner), C(486, 708, 7, '#ffd166', inner), C(345, 742, 20, '#222222'), C(445, 742, 20, '#222222'), C(345, 742, 8, '#adb5bd', inner), C(445, 742, 8, '#adb5bd', inner)]),
    obj('car-green', [R(810, 735, 110, 40, '#06d6a0', { r: 12 }), R(770, 765, 200, 52, '#06d6a0', { r: 14 }), R(822, 743, 42, 26, '#bde0fe', inner), R(870, 743, 42, 26, '#bde0fe', inner), C(776, 784, 7, '#ffd166', inner), C(815, 818, 20, '#222222'), C(925, 818, 20, '#222222'), C(815, 818, 8, '#adb5bd', inner), C(925, 818, 8, '#adb5bd', inner)]),
  ],
  diffs: [
    { id: 'antenna', label: '옥상 안테나', obj: 'antenna', kind: 'remove' },
    { id: 'window', label: '불 켜진 창문', obj: 'b3', kind: 'recolor', shapes: [4], to: '#ffd166' },
    { id: 'billboard', label: '전광판 글자', obj: 'billboard', kind: 'replace', with: (s) => s.map((x) => (x.t === 'text' ? { ...x, text: 'CTIY' } : x)), subtle: true },
    { id: 'lamp', label: '꺼진 가로등', obj: 'lamp-2', kind: 'recolor', shapes: [2], to: '#5c677d' },
    { id: 'car', label: '분홍 자동차 색', obj: 'car-pink', kind: 'recolor', shapes: [0, 1], to: '#4cc9f0' },
    { id: 'cat', label: '지붕 위 고양이', obj: 'cat', kind: 'remove' },
    { id: 'signal', label: '신호등 불빛', obj: 'traffic-light', kind: 'recolor', shapes: [2], to: '#5c1f2e' },
    { id: 'moon', label: '달 크기', obj: 'moon', kind: 'scale', k: 0.72 },
    { id: 'stars', label: '반짝이는 별', obj: 'star-cluster', kind: 'remove', subtle: true },
    { id: 'wheel', label: '초록 차 바퀴 휠', obj: 'car-green', kind: 'recolor', shapes: [7, 8], to: '#ffd166', subtle: true },
    { id: 'b6-window', label: '오른쪽 빌딩 창문', obj: 'b6', kind: 'recolor', shapes: [2], to: '#22264a', subtle: true },
  ],
};

/* ============================================================================
 * 3. 농장 FARM
 * ========================================================================== */
function windmillBlades(angle) {
  return [0, 1, 2, 3].map((i) => {
    const a = angle + (i * PI) / 2;
    return rotRect(260 + Math.cos(a) * 52, 330 + Math.sin(a) * 52, 96, 22, a, '#f1faee');
  });
}

const farm = {
  id: 'farm',
  background(g) {
    g.fillStyle = vGradient(g, 0, 480, '#9bd4f5', '#e8f6ff');
    g.fillRect(0, 0, SCENE_W, 480);
    g.fillStyle = '#a5d36b';
    g.beginPath();
    g.ellipse(300, 520, 520, 120, 0, 0, TAU);
    g.ellipse(950, 510, 480, 110, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#7cb342';
    g.fillRect(0, 520, SCENE_W, 376);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < SCENE_W; x += 90) g.fillRect(x, 610 + ((x / 90) % 3) * 70, 40, 6);
  },
  objects: [
    obj('sun', [C(140, 110, 55, '#ffd54f')]),
    obj('cloud', [E(520, 110, 55, 26, '#ffffff'), E(570, 92, 48, 34, '#ffffff'), E(620, 112, 52, 25, '#ffffff')]),
    obj('windmill-tower', [P([236, 570, 284, 570, 270, 330, 250, 330], '#eceff1'), R(250, 520, 20, 50, '#8d6e63', inner)]),
    obj('windmill-blades', [...windmillBlades(PI / 4), C(260, 330, 11, '#795548')]),
    obj('fence', [
      ...[40, 110, 180, 250, 320, 390, 460, 530, 600].map((x) => R(x, 540, 12, 72, '#a1887f')),
      R(30, 556, 594, 10, '#bcaaa4'), R(30, 584, 594, 10, '#bcaaa4'),
    ]),
    obj('tree-trunk', [R(498, 400, 34, 170, '#795548')]),
    obj('tree-top', [C(515, 360, 85, '#43a047'), C(462, 395, 55, '#43a047'), C(572, 390, 60, '#43a047')]),
    obj('apples', [C(478, 360, 10, '#e53935'), C(520, 330, 10, '#e53935'), C(556, 372, 10, '#e53935'), C(500, 410, 10, '#e53935'), C(585, 410, 10, '#e53935')]),
    obj('barn', [
      P([720, 380, 850, 300, 980, 380, 980, 570, 720, 570], '#c62828'),
      P([700, 392, 850, 286, 1000, 392, 988, 402, 850, 304, 712, 402], '#5d4037'),
      R(805, 460, 90, 110, '#8d1c1c', inner), L([805, 460, 895, 570], '#ffffff', 5), L([895, 460, 805, 570], '#ffffff', 5),
      C(850, 378, 22, '#fff3e0', inner),
    ]),
    obj('silo', [R(1000, 330, 80, 240, '#b0bec5'), W(1040, 330, 40, PI, TAU, '#90a4ae'), L([1000, 400, 1080, 400], OUTLINE, 2), L([1000, 480, 1080, 480], OUTLINE, 2)]),
    obj('cow', [
      R(306, 715, 14, 50, '#ffffff'), R(334, 718, 14, 50, '#ffffff'), R(380, 718, 14, 50, '#ffffff'), R(406, 715, 14, 50, '#ffffff'),
      E(360, 690, 80, 45, '#ffffff'), E(448, 662, 30, 24, '#ffffff'), P([430, 642, 424, 626, 440, 638], '#ffffff'),
      E(330, 676, 22, 16, '#2b2b2b', 0.3, flat), E(392, 702, 18, 13, '#2b2b2b', -0.2, flat), E(372, 668, 12, 9, '#2b2b2b', 0, flat),
      E(466, 672, 15, 11, '#f8bbd0', 0, inner), C(452, 656, 3.5, OUTLINE, flat),
    ]),
    obj('chicken-1', [C(600, 790, 24, '#ffffff'), C(622, 768, 13, '#ffffff'), P([616, 756, 622, 746, 628, 756], '#e53935'), P([634, 768, 646, 772, 634, 776], '#fb8c00'), C(624, 765, 2.5, OUTLINE, flat)]),
    obj('chicken-2', [C(690, 820, 22, '#ffffff'), C(710, 800, 12, '#ffffff'), P([704, 790, 710, 780, 716, 790], '#e53935'), P([720, 800, 732, 804, 720, 808], '#fb8c00'), C(712, 797, 2.5, OUTLINE, flat)]),
    obj('scarecrow', [R(1076, 620, 8, 200, '#8d6e63'), R(1030, 660, 100, 10, '#8d6e63'), P([1050, 650, 1110, 650, 1104, 740, 1056, 740], '#1e88e5'), C(1080, 622, 26, '#ffe0b2'), P([1040, 606, 1120, 606, 1098, 592, 1062, 592], '#fbc02d'), R(1062, 574, 36, 22, '#fbc02d')]),
    obj('pumpkin', [C(150, 800, 32, '#fb8c00'), L([150, 772, 150, 830], '#e65100', 2), R(146, 760, 8, 14, '#558b2f')]),
    obj('flowers', [C(250, 860, 10, '#f06292'), C(290, 850, 10, '#ffd54f'), C(330, 865, 10, '#ba68c8'), C(880, 860, 10, '#f06292'), C(920, 850, 10, '#4fc3f7')]),
  ],
  diffs: [
    { id: 'blades', label: '풍차 날개 각도', obj: 'windmill-blades', kind: 'replace', with: () => [...windmillBlades(0), C(260, 330, 11, '#795548')] },
    { id: 'barn-door', label: '헛간 문 X자', obj: 'barn', kind: 'replace', with: (s) => s.filter((_, i) => i !== 3 && i !== 4) },
    { id: 'silo', label: '사일로 지붕 색', obj: 'silo', kind: 'recolor', shapes: [1], to: '#e53935' },
    { id: 'apples', label: '사과 개수', obj: 'apples', kind: 'replace', with: (s) => s.slice(0, 3), subtle: true },
    { id: 'cow', label: '젖소 얼룩', obj: 'cow', kind: 'replace', with: (s) => s.filter((_, i) => i !== 7) },
    { id: 'chicken', label: '닭 한 마리', obj: 'chicken-2', kind: 'remove' },
    { id: 'hat', label: '허수아비 모자 색', obj: 'scarecrow', kind: 'recolor', shapes: [4, 5], to: '#6d4c41' },
    { id: 'pumpkin', label: '호박', obj: 'pumpkin', kind: 'remove' },
    { id: 'sun', label: '해 크기', obj: 'sun', kind: 'scale', k: 0.68 },
    { id: 'fence', label: '울타리 기둥', obj: 'fence', kind: 'replace', with: (s) => s.filter((_, i) => i !== 5), subtle: true },
    { id: 'loft', label: '헛간 다락 창문', obj: 'barn', kind: 'replace', with: (s) => s.map((x, i) => (i === 5 ? R(830, 358, 40, 40, '#fff3e0', inner) : x)), subtle: true },
    { id: 'flower', label: '꽃 색깔', obj: 'flowers', kind: 'recolor', shapes: [1], to: '#e53935', subtle: true },
  ],
};

/* ============================================================================
 * 4. 바닷속 UNDERWATER
 * ========================================================================== */
function fish(id, x, y, s, body, dir = 1, extra = []) {
  const f = (dx) => x + dx * s * dir;
  return obj(id, [
    P([f(-58), y, f(-92), y - 28 * s, f(-92), y + 28 * s], body),
    E(x, y, 60 * s, 34 * s, body),
    ...extra.map((e) => e(f, s)),
    C(f(34), y - 8 * s, 7 * s, '#ffffff', inner),
    C(f(36), y - 8 * s, 3 * s, OUTLINE, flat),
  ]);
}

const stripe = (dx) => (f, s) => R(f(dx) - 6 * s, 270, 12 * s, 60 * s, '#ffffff', flat);

const underwater = {
  id: 'sea',
  background(g) {
    g.fillStyle = vGradient(g, 0, 896, '#2bb3d6', '#0a3d5c');
    g.fillRect(0, 0, SCENE_W, 896);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (const x of [120, 420, 760, 1020]) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 90, 0);
      g.lineTo(x + 230, 760);
      g.lineTo(x + 120, 760);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#e0c48a';
    g.beginPath();
    g.moveTo(0, 780);
    g.quadraticCurveTo(400, 740, 700, 775);
    g.quadraticCurveTo(950, 800, 1200, 760);
    g.lineTo(1200, 896);
    g.lineTo(0, 896);
    g.closePath();
    g.fill();
  },
  objects: [
    obj('seaweed-1', [P([400, 790, 420, 790, 445, 640, 405, 560, 430, 470, 410, 470, 385, 560, 420, 640], '#2d6a4f')]),
    obj('seaweed-2', [P([460, 790, 480, 790, 495, 680, 470, 600, 490, 540, 472, 540, 450, 600, 474, 680], '#40916c')]),
    obj('seaweed-3', [P([1100, 780, 1122, 780, 1150, 620, 1110, 520, 1132, 430, 1112, 430, 1088, 520, 1126, 620], '#2d6a4f')]),
    obj('coral-red', [P([150, 790, 170, 700, 140, 640, 160, 630, 185, 690, 200, 610, 222, 620, 208, 700, 240, 650, 258, 662, 220, 740, 230, 790], '#ff6b6b')]),
    obj('coral-purple', [P([940, 790, 955, 710, 925, 660, 945, 650, 970, 700, 990, 630, 1012, 640, 995, 710, 1030, 672, 1046, 686, 1010, 750, 1020, 790], '#c77dff')]),
    fish('fish-clown', 300, 300, 1, '#ff8c42', 1, [stripe(-14), stripe(18)]),
    fish('fish-blue', 820, 220, 0.9, '#4361ee', -1),
    fish('fish-yellow', 650, 430, 0.6, '#ffd60a', 1),
    obj('jellyfish', [
      Q([970, 380, 960, 420, 975, 460], '#f7aef8', 5), Q([990, 380, 985, 425, 995, 470], '#f7aef8', 5), Q([1010, 380, 1015, 425, 1005, 470], '#f7aef8', 5), Q([1030, 380, 1040, 420, 1025, 460], '#f7aef8', 5),
      W(1000, 382, 50, PI, TAU, '#f7aef8'),
    ]),
    obj('submarine', [
      R(755, 498, 50, 44, '#ffd166', { r: 8 }), L([780, 498, 780, 470, 800, 470], OUTLINE, 5), E(780, 565, 115, 46, '#ffd166'),
      C(720, 565, 13, '#8ecae6', inner), C(770, 565, 13, '#8ecae6', inner), C(820, 565, 13, '#8ecae6', inner),
      P([895, 565, 920, 540, 920, 590], '#f4a261'),
    ]),
    obj('chest', [R(590, 735, 120, 62, '#8b5a2b', { r: 6 }), R(585, 712, 130, 30, '#a0522d', { r: 10 }), C(620, 708, 9, '#ffd166', inner), C(645, 704, 9, '#ffd166', inner), R(642, 737, 16, 22, '#ffd166', inner)]),
    obj('starfish', [star(300, 825, 32, 13, '#ff9f1c')]),
    obj('rock', [E(1040, 810, 80, 38, '#6c757d'), E(1010, 800, 26, 12, '#868e96', 0, flat)]),
    obj('bubbles-1', [C(380, 260, 9, 'rgba(255,255,255,0.4)', inner), C(395, 228, 7, 'rgba(255,255,255,0.4)', inner), C(386, 200, 5, 'rgba(255,255,255,0.4)', inner)]),
    obj('bubbles-2', [C(560, 120, 10, 'rgba(255,255,255,0.4)', inner), C(575, 88, 7, 'rgba(255,255,255,0.4)', inner)]),
    obj('shell', [W(860, 815, 24, PI, TAU, '#ffc8dd'), L([860, 815, 860, 793], OUTLINE, 2), L([860, 815, 845, 798], OUTLINE, 2), L([860, 815, 875, 798], OUTLINE, 2)]),
  ],
  diffs: [
    { id: 'clown', label: '흰 줄무늬 물고기', obj: 'fish-clown', kind: 'replace', with: (s) => s.filter((_, i) => i !== 2) },
    { id: 'blue', label: '파란 물고기 색', obj: 'fish-blue', kind: 'recolor', shapes: [0, 1], to: '#2ec4b6' },
    { id: 'yellow', label: '노란 물고기 방향', obj: 'fish-yellow', kind: 'flip' },
    { id: 'jelly', label: '해파리 색', obj: 'jellyfish', kind: 'recolor', shapes: [0, 1, 2, 3, 4], to: '#90e0ef' },
    { id: 'lock', label: '보물상자 자물쇠', obj: 'chest', kind: 'recolor', shapes: [4], to: '#adb5bd' },
    { id: 'porthole', label: '잠수함 창문 개수', obj: 'submarine', kind: 'replace', with: (s) => s.filter((_, i) => i !== 5) },
    { id: 'starfish', label: '불가사리', obj: 'starfish', kind: 'remove' },
    { id: 'coral', label: '보라 산호 색', obj: 'coral-purple', kind: 'recolor', shapes: [0], to: '#ffbe0b' },
    { id: 'seaweed', label: '해초 한 줄기', obj: 'seaweed-2', kind: 'remove' },
    { id: 'bubbles', label: '물방울 개수', obj: 'bubbles-2', kind: 'remove', subtle: true },
    { id: 'coin', label: '보물 금화', obj: 'chest', kind: 'replace', with: (s) => s.filter((_, i) => i !== 2), subtle: true },
    { id: 'shell', label: '조개 색', obj: 'shell', kind: 'recolor', shapes: [0], to: '#bde0fe', subtle: true },
  ],
};

/* ============================================================================
 * 5. 겨울 마을 SNOW VILLAGE
 * ========================================================================== */
function house(id, x, w, wall, roof, window = '#ffe08a') {
  const base = 600;
  const top = base - 150;
  return obj(id, [
    R(x + w * 0.68, top - 70, 30, 70, '#6d597a'),
    R(x, top, w, 150, wall),
    P([x - 22, top + 4, x + w / 2, top - 96, x + w + 22, top + 4], roof),
    P([x - 6, top - 6, x + w / 2, top - 96, x + w + 6, top - 6, x + w / 2, top - 76], '#f8fbff', flat),
    R(x + w * 0.16, top + 40, 46, 42, window, inner),
    R(x + w * 0.58, top + 66, 44, 84, '#5c4033', inner),
  ]);
}

function pine(id, x, base, s) {
  return obj(id, [
    R(x - 10 * s, base - 30 * s, 20 * s, 30 * s, '#6f4e37'),
    P([x - 70 * s, base - 30 * s, x, base - 130 * s, x + 70 * s, base - 30 * s], '#2d6a4f'),
    P([x - 55 * s, base - 95 * s, x, base - 185 * s, x + 55 * s, base - 95 * s], '#40916c'),
    P([x - 40 * s, base - 150 * s, x, base - 230 * s, x + 40 * s, base - 150 * s], '#52b788'),
  ]);
}

const snow = {
  id: 'snow',
  background(g) {
    g.fillStyle = vGradient(g, 0, 620, '#5d6fd6', '#c3cfff');
    g.fillRect(0, 0, SCENE_W, 620);
    g.fillStyle = '#eef3ff';
    g.beginPath();
    g.moveTo(0, 600);
    g.quadraticCurveTo(300, 560, 650, 600);
    g.quadraticCurveTo(950, 630, 1200, 590);
    g.lineTo(1200, 896);
    g.lineTo(0, 896);
    g.closePath();
    g.fill();
    dots(g, 'rgba(255,255,255,0.9)', [80, 80, 200, 160, 330, 60, 470, 140, 610, 90, 740, 170, 880, 60, 960, 230, 1130, 250, 40, 300, 560, 300, 820, 320, 700, 40, 280, 250], 4);
  },
  objects: [
    obj('moon', [C(1090, 100, 40, '#fff8d6')]),
    obj('smoke', [C(272, 362, 14, '#e9ecef', inner), C(286, 330, 18, '#e9ecef', inner), C(276, 292, 22, '#e9ecef', inner)]),
    house('house-red', 100, 230, '#d1495b', '#5a3d5c'),
    house('house-yellow', 430, 240, '#edae49', '#3d405b'),
    obj('wreath', [C(600, 545, 17, 'rgba(0,0,0,0)', { stroke: '#2d6a4f', lw: 7 }), C(600, 530, 5, '#e63946', flat)]),
    house('house-teal', 790, 210, '#00798c', '#5a3d5c'),
    pine('pine-left', 60, 660, 0.9),
    pine('pine-mid', 730, 640, 0.8),
    obj('pine-star', [star(730, 450, 18, 7, '#ffd60a')]),
    pine('pine-right', 1110, 670, 1),
    obj('lamp', [R(1000, 480, 9, 160, '#495057'), R(988, 466, 32, 22, '#495057', { r: 4 }), C(1004, 490, 11, '#ffe08a', inner)]),
    obj('sled', [Q([260, 830, 300, 850, 400, 850, 420, 830], OUTLINE, 5), R(285, 800, 110, 28, '#c1121f', { r: 6 }), L([300, 828, 300, 848], OUTLINE, 4), L([380, 828, 380, 848], OUTLINE, 4)]),
    obj('snowman', [
      C(640, 790, 62, '#ffffff'), C(640, 708, 46, '#ffffff'), C(640, 644, 34, '#ffffff'),
      R(604, 668, 72, 16, '#e63946', { r: 6 }), R(650, 676, 16, 40, '#e63946', inner),
      R(612, 604, 56, 10, '#22223b'), R(622, 566, 36, 42, '#22223b'),
      P([640, 646, 676, 654, 640, 660], '#f77f00'),
      C(628, 636, 4, OUTLINE, flat), C(652, 636, 4, OUTLINE, flat),
      C(640, 700, 5, OUTLINE, flat), C(640, 722, 5, OUTLINE, flat), C(640, 770, 6, OUTLINE, flat),
    ]),
  ],
  diffs: [
    { id: 'smoke', label: '굴뚝 연기', obj: 'smoke', kind: 'remove' },
    { id: 'window', label: '노란 집 창문 불빛', obj: 'house-yellow', kind: 'recolor', shapes: [4], to: '#3d405b' },
    { id: 'nose', label: '눈사람 당근 코', obj: 'snowman', kind: 'replace', with: (s) => s.filter((_, i) => i !== 7) },
    { id: 'scarf', label: '눈사람 목도리 색', obj: 'snowman', kind: 'recolor', shapes: [3, 4], to: '#4361ee' },
    { id: 'sled', label: '썰매 색', obj: 'sled', kind: 'recolor', shapes: [1], to: '#2a9d8f' },
    { id: 'chimney', label: '청록 집 굴뚝', obj: 'house-teal', kind: 'replace', with: (s) => s.slice(1) },
    { id: 'star', label: '트리 꼭대기 별', obj: 'pine-star', kind: 'remove' },
    { id: 'moon', label: '달 크기', obj: 'moon', kind: 'scale', k: 0.65 },
    { id: 'wreath', label: '문 위 리스', obj: 'wreath', kind: 'remove', subtle: true },
    { id: 'button', label: '눈사람 단추 개수', obj: 'snowman', kind: 'replace', with: (s) => s.filter((_, i) => i !== 11), subtle: true },
    { id: 'lamp', label: '가로등 불빛', obj: 'lamp', kind: 'recolor', shapes: [2], to: '#868e96', subtle: true },
    { id: 'roof', label: '빨간 집 지붕 색', obj: 'house-red', kind: 'recolor', shapes: [2], to: '#2a9d8f' },
  ],
};

/* ============================================================================
 * 6. 우주 탐사 SPACE
 * ========================================================================== */
const space = {
  id: 'space',
  background(g) {
    g.fillStyle = vGradient(g, 0, 896, '#0b1026', '#2a1d55');
    g.fillRect(0, 0, SCENE_W, 896);
    g.fillStyle = 'rgba(155, 93, 229, 0.18)';
    g.beginPath();
    g.ellipse(520, 260, 300, 90, -0.3, 0, TAU);
    g.fill();
    dots(g, 'rgba(255,255,255,0.85)', [50, 40, 130, 210, 260, 70, 360, 280, 470, 40, 520, 180, 640, 300, 760, 60, 980, 360, 1100, 60, 1160, 300, 300, 420, 80, 460, 700, 440, 1060, 470], 2.2);
    g.fillStyle = '#8d939a';
    g.beginPath();
    g.moveTo(0, 690);
    g.quadraticCurveTo(320, 650, 620, 690);
    g.quadraticCurveTo(900, 720, 1200, 670);
    g.lineTo(1200, 896);
    g.lineTo(0, 896);
    g.closePath();
    g.fill();
    g.fillStyle = '#767c83';
    for (const [x, y, rx] of [[140, 800, 50], [520, 840, 36], [980, 780, 44], [760, 870, 28]]) {
      g.beginPath();
      g.ellipse(x, y, rx, rx * 0.32, 0, 0, TAU);
      g.fill();
    }
  },
  objects: [
    obj('planet-blue', [C(210, 150, 42, '#4cc9f0'), E(196, 140, 14, 8, '#90e0ef', -0.4, flat)]),
    obj('planet-ringed', [C(920, 200, 80, '#f4a261'), R(845, 175, 150, 14, '#e76f51', flat), R(850, 214, 140, 12, '#e9c46a', flat), E(920, 208, 135, 26, 'rgba(0,0,0,0)', -0.15, { stroke: '#ffd6a5', lw: 9 })]),
    obj('comet', [P([620, 112, 760, 60, 768, 76, 626, 128], 'rgba(255,255,255,0.35)', flat), C(616, 122, 14, '#ffffff')]),
    obj('satellite', [R(95, 372, 58, 22, '#4361ee', inner), R(203, 372, 58, 22, '#4361ee', inner), R(150, 362, 56, 42, '#adb5bd'), L([178, 362, 178, 340], OUTLINE, 3), C(178, 338, 5, '#ff4d6d', flat)]),
    obj('rocket-flame', [P([578, 498, 622, 498, 600, 570], '#ffb703'), P([588, 498, 612, 498, 600, 540], '#fb5607', flat)]),
    obj('rocket', [
      P([570, 440, 540, 500, 572, 486], '#e63946'), P([630, 440, 660, 500, 628, 486], '#e63946'),
      R(570, 320, 60, 180, '#f1faee', { r: 28 }), P([572, 340, 600, 262, 628, 340], '#e63946'),
      C(600, 382, 17, '#4cc9f0', inner), R(586, 440, 28, 8, '#adb5bd', flat),
    ]),
    obj('flag', [R(430, 520, 5, 180, '#ced4da'), R(435, 525, 90, 54, '#e63946'), star(480, 552, 14, 6, '#ffd60a', flat)]),
    obj('astronaut', [
      R(284, 600, 22, 62, '#adb5bd', { r: 6 }), R(300, 596, 64, 82, '#ffffff', { r: 16 }), R(306, 676, 22, 40, '#ffffff', { r: 8 }), R(336, 676, 22, 40, '#ffffff', { r: 8 }),
      R(360, 606, 40, 18, '#ffffff', { r: 9 }), C(332, 560, 38, '#ffffff'), E(340, 560, 24, 18, '#264653', 0, inner), R(316, 620, 32, 20, '#4cc9f0', inner),
    ]),
    obj('rover', [R(780, 690, 150, 48, '#ffd166', { r: 10 }), R(800, 660, 60, 34, '#e9c46a', inner), L([900, 690, 900, 640], OUTLINE, 3), C(900, 636, 7, '#4cc9f0', flat), C(800, 745, 18, '#495057'), C(855, 745, 18, '#495057'), C(910, 745, 18, '#495057')]),
    obj('alien', [E(1090, 690, 34, 30, '#80ed99'), C(1078, 684, 8, '#ffffff', inner), C(1102, 684, 8, '#ffffff', inner), C(1078, 685, 3.5, OUTLINE, flat), C(1102, 685, 3.5, OUTLINE, flat), L([1080, 662, 1072, 640], OUTLINE, 3), L([1100, 662, 1108, 640], OUTLINE, 3), C(1072, 638, 5, '#ff4d6d', flat), C(1108, 638, 5, '#ff4d6d', flat)]),
    obj('moon-rock', [E(1090, 722, 70, 34, '#6c757d')]),
  ],
  diffs: [
    { id: 'ring', label: '토성 고리 색', obj: 'planet-ringed', kind: 'recolor', shapes: [3], to: '#80ed99' },
    { id: 'window', label: '로켓 창문 색', obj: 'rocket', kind: 'recolor', shapes: [4], to: '#ff4d6d' },
    { id: 'flame', label: '로켓 불꽃', obj: 'rocket-flame', kind: 'remove' },
    { id: 'flag-star', label: '깃발의 별', obj: 'flag', kind: 'replace', with: (s) => s.slice(0, 2) },
    { id: 'panel', label: '인공위성 날개 색', obj: 'satellite', kind: 'recolor', shapes: [0, 1], to: '#f72585' },
    { id: 'comet', label: '혜성', obj: 'comet', kind: 'remove' },
    { id: 'alien', label: '숨어 있는 외계인', obj: 'alien', kind: 'remove' },
    { id: 'wheel', label: '탐사차 바퀴 개수', obj: 'rover', kind: 'replace', with: (s) => s.filter((_, i) => i !== 5) },
    { id: 'visor', label: '우주인 헬멧 유리', obj: 'astronaut', kind: 'recolor', shapes: [6], to: '#ffb703' },
    { id: 'planet', label: '파란 행성 크기', obj: 'planet-blue', kind: 'scale', k: 0.66 },
    { id: 'antenna', label: '탐사차 안테나', obj: 'rover', kind: 'replace', with: (s) => s.filter((_, i) => i !== 2 && i !== 3), subtle: true },
    { id: 'badge', label: '우주복 가슴 패치', obj: 'astronaut', kind: 'recolor', shapes: [7], to: '#ffd60a', subtle: true },
  ],
};

/* ============================================================================
 * 7. 주방 KITCHEN
 * ========================================================================== */
function cup(x, color) {
  return [R(x, 300, 34, 38, color, { r: 4 }), C(x + 38, 318, 9, 'rgba(0,0,0,0)', { stroke: OUTLINE, lw: 4 })];
}

const kitchen = {
  id: 'kitchen',
  background(g) {
    g.fillStyle = '#fdf0d5';
    g.fillRect(0, 0, SCENE_W, 560);
    g.strokeStyle = 'rgba(170, 130, 90, 0.18)';
    g.lineWidth = 2;
    for (let y = 40; y < 560; y += 50) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(SCENE_W, y);
      g.stroke();
    }
    g.fillStyle = '#c9a27c';
    g.fillRect(0, 560, SCENE_W, 336);
    g.strokeStyle = 'rgba(90, 60, 30, 0.25)';
    for (let y = 600; y < 896; y += 60) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(SCENE_W, y);
      g.stroke();
    }
  },
  objects: [
    obj('cabinet-left', [R(40, 50, 330, 170, '#8ecae6', { r: 6 }), R(60, 66, 135, 138, '#a8dadc', inner), R(215, 66, 135, 138, '#a8dadc', inner), C(180, 140, 6, '#ffb703', inner), C(230, 140, 6, '#ffb703', inner)]),
    obj('window', [R(470, 70, 270, 200, '#ffffff', { r: 6 }), R(486, 86, 238, 168, '#bde0fe', inner), R(600, 86, 10, 168, '#ffffff', flat), R(486, 164, 238, 10, '#ffffff', flat)]),
    obj('curtains', [P([450, 60, 520, 60, 500, 280, 450, 280], '#e63946'), P([690, 60, 760, 60, 760, 280, 710, 280], '#e63946')]),
    obj('clock', [C(860, 130, 46, '#ffffff'), L([860, 130, 860, 98], OUTLINE, 4), L([860, 130, 884, 142], OUTLINE, 4), C(860, 130, 4, OUTLINE, flat)]),
    obj('shelf', [R(470, 338, 300, 14, '#a47148')]),
    obj('cups', [...cup(490, '#ff6b6b'), ...cup(560, '#4cc9f0'), ...cup(630, '#ffd166'), ...cup(700, '#80ed99')]),
    obj('fridge', [R(960, 230, 190, 460, '#e9ecef', { r: 14 }), L([960, 400, 1150, 400], OUTLINE, 3), R(1124, 300, 10, 70, '#adb5bd', inner), R(1124, 420, 10, 90, '#adb5bd', inner), C(1010, 290, 12, '#ff4d6d', inner), C(1050, 470, 12, '#4361ee', inner), R(990, 520, 40, 30, '#ffd166', inner)]),
    obj('counter', [R(30, 470, 720, 40, '#adb5bd', { r: 6 }), R(40, 510, 700, 190, '#ffb703'), R(60, 530, 150, 150, '#fcbf49', inner), R(230, 530, 150, 150, '#fcbf49', inner), R(400, 530, 150, 150, '#fcbf49', inner), R(570, 530, 150, 150, '#fcbf49', inner), C(195, 605, 6, OUTLINE, flat), C(245, 605, 6, OUTLINE, flat), C(535, 605, 6, OUTLINE, flat), C(585, 605, 6, OUTLINE, flat)]),
    obj('steam', [Q([190, 380, 175, 360, 190, 340, 205, 320, 190, 300], '#ffffff', 5), Q([230, 380, 215, 360, 230, 340, 245, 320, 230, 300], '#ffffff', 5)]),
    obj('pot', [R(150, 400, 130, 72, '#6c757d', { r: 10 }), R(132, 412, 22, 12, '#495057'), R(276, 412, 22, 12, '#495057'), R(144, 392, 142, 12, '#868e96', { r: 6 }), C(215, 386, 8, '#495057')]),
    obj('plant', [E(635, 395, 14, 40, '#52b788', -0.5), E(665, 390, 14, 44, '#40916c', 0.4), E(650, 380, 12, 46, '#52b788', 0), P([620, 420, 680, 420, 672, 470, 628, 470], '#bc6c25')]),
    obj('table', [R(420, 760, 16, 110, '#7f5539'), R(764, 760, 16, 110, '#7f5539'), R(380, 740, 440, 26, '#9c6644', { r: 6 })]),
    obj('fruits', [C(560, 702, 24, '#e63946'), C(602, 694, 26, '#f9c74f'), C(642, 704, 22, '#90be6d'), L([560, 678, 564, 668], '#6b4423', 4)]),
    obj('bowl', [W(600, 712, 78, 0, PI, '#e07a5f')]),
    obj('cat', [E(300, 840, 60, 28, '#6c584c'), C(250, 820, 24, '#6c584c'), P([234, 806, 236, 786, 250, 800], '#6c584c'), P([254, 800, 264, 784, 268, 804], '#6c584c'), Q([356, 840, 390, 830, 384, 800], '#6c584c', 8), C(242, 818, 3, '#ffd166', flat), C(258, 818, 3, '#ffd166', flat)]),
  ],
  diffs: [
    { id: 'curtain', label: '오른쪽 커튼 색', obj: 'curtains', kind: 'recolor', shapes: [1], to: '#2a9d8f' },
    { id: 'clock', label: '시계 바늘 시각', obj: 'clock', kind: 'replace', with: (s) => s.map((x, i) => (i === 2 ? L([860, 130, 836, 148], OUTLINE, 4) : x)) },
    { id: 'cup', label: '컵 색깔', obj: 'cups', kind: 'recolor', shapes: [2], to: '#9b5de5' },
    { id: 'magnet', label: '냉장고 자석', obj: 'fridge', kind: 'replace', with: (s) => s.filter((_, i) => i !== 5) },
    { id: 'steam', label: '냄비 김', obj: 'steam', kind: 'remove' },
    { id: 'fruit', label: '빨간 사과 색', obj: 'fruits', kind: 'recolor', shapes: [0], to: '#f77f00' },
    { id: 'plant', label: '화분 잎 개수', obj: 'plant', kind: 'replace', with: (s) => s.filter((_, i) => i !== 1) },
    { id: 'knob', label: '찬장 손잡이', obj: 'cabinet-left', kind: 'replace', with: (s) => s.filter((_, i) => i !== 4), subtle: true },
    { id: 'window', label: '창문 가로살', obj: 'window', kind: 'replace', with: (s) => s.filter((_, i) => i !== 3), subtle: true },
    { id: 'cat', label: '바닥의 고양이', obj: 'cat', kind: 'remove' },
    { id: 'note', label: '냉장고 메모지 색', obj: 'fridge', kind: 'recolor', shapes: [6], to: '#80ed99', subtle: true },
    { id: 'bowl', label: '과일 그릇 색', obj: 'bowl', kind: 'recolor', shapes: [0], to: '#4361ee' },
  ],
};

/* ============================================================================
 * 8. 공원 PARK
 * ========================================================================== */
function tree(id, x, base, s, leaf) {
  return obj(id, [R(x - 16 * s, base - 150 * s, 32 * s, 150 * s, '#7f5539'), C(x, base - 200 * s, 80 * s, leaf), C(x - 60 * s, base - 160 * s, 55 * s, leaf), C(x + 60 * s, base - 165 * s, 58 * s, leaf)]);
}

const park = {
  id: 'park',
  background(g) {
    g.fillStyle = vGradient(g, 0, 430, '#a2d2ff', '#e7f3ff');
    g.fillRect(0, 0, SCENE_W, 430);
    g.fillStyle = '#80b918';
    g.fillRect(0, 430, SCENE_W, 466);
    g.fillStyle = '#e9d8a6';
    g.beginPath();
    g.moveTo(520, 430);
    g.quadraticCurveTo(470, 600, 600, 700);
    g.quadraticCurveTo(720, 800, 640, 896);
    g.lineTo(860, 896);
    g.quadraticCurveTo(920, 790, 760, 690);
    g.quadraticCurveTo(620, 600, 600, 430);
    g.closePath();
    g.fill();
  },
  objects: [
    obj('sun', [C(1100, 90, 50, '#ffd60a')]),
    obj('cloud', [E(300, 90, 55, 26, '#ffffff'), E(350, 72, 48, 34, '#ffffff'), E(400, 92, 52, 25, '#ffffff')]),
    tree('tree-left', 150, 520, 1, '#55a630'),
    tree('tree-right', 1060, 500, 0.9, '#2b9348'),
    obj('kite-string', [Q([470, 220, 420, 420, 370, 600], 'rgba(30,24,36,0.6)', 2)]),
    obj('kite', [P([470, 120, 510, 170, 470, 230, 430, 170], '#ff006e'), L([430, 170, 510, 170], OUTLINE, 2), L([470, 120, 470, 230], OUTLINE, 2), Q([470, 230, 455, 260, 470, 290, 485, 320, 470, 350], '#ffbe0b', 4)]),
    obj('child', [R(352, 650, 14, 50, '#264653'), R(372, 650, 14, 50, '#264653'), R(346, 590, 46, 66, '#3a86ff', { r: 12 }), C(369, 566, 26, '#f1c27d'), P([345, 556, 369, 532, 393, 556], '#6b4423')]),
    obj('bench', [R(560, 540, 14, 50, '#6c584c'), R(706, 540, 14, 50, '#6c584c'), R(545, 524, 190, 18, '#bc6c25', { r: 4 }), R(545, 480, 190, 16, '#bc6c25', { r: 4 }), R(560, 496, 10, 30, '#6c584c'), R(710, 496, 10, 30, '#6c584c')]),
    obj('fountain', [E(900, 650, 120, 34, '#4a4e69'), E(900, 642, 104, 24, '#a9def9', 0, inner), R(888, 560, 24, 84, '#adb5bd'), E(900, 560, 46, 14, '#adb5bd'), Q([900, 548, 860, 500, 830, 630], '#caf0f8', 5), Q([900, 548, 940, 500, 970, 630], '#caf0f8', 5), Q([900, 548, 900, 500, 900, 470], '#caf0f8', 5)]),
    obj('balloons', [L([1000, 520, 980, 420], OUTLINE, 2), L([1000, 520, 1012, 410], OUTLINE, 2), L([1000, 520, 1040, 428], OUTLINE, 2), E(980, 395, 22, 28, '#ff595e'), E(1012, 382, 22, 28, '#ffca3a'), E(1042, 402, 22, 28, '#8ac926')]),
    obj('pond', [E(200, 780, 150, 60, '#90e0ef')]),
    obj('duck-1', [E(170, 770, 28, 16, '#ffd60a'), C(192, 750, 13, '#ffd60a'), P([203, 750, 216, 754, 203, 758], '#fb8500'), C(195, 747, 2.5, OUTLINE, flat)]),
    obj('duck-2', [E(240, 800, 24, 14, '#ffd60a'), C(259, 783, 11, '#ffd60a'), P([268, 783, 280, 787, 268, 790], '#fb8500'), C(262, 780, 2.5, OUTLINE, flat)]),
    obj('dog', [R(610, 790, 10, 34, '#b08968'), R(660, 790, 10, 34, '#b08968'), E(640, 780, 46, 24, '#b08968'), C(692, 758, 20, '#b08968'), E(704, 744, 8, 14, '#7f5539', 0.4, inner), Q([594, 774, 578, 760, 584, 744], '#b08968', 6), E(632, 772, 12, 8, '#7f5539', 0, flat), C(698, 755, 3, OUTLINE, flat)]),
    obj('blanket', [P([840, 780, 1060, 780, 1100, 870, 820, 870], '#e63946'), P([890, 780, 930, 780, 945, 870, 900, 870], '#ffffff', flat), P([980, 780, 1020, 780, 1045, 870, 1000, 870], '#ffffff', flat)]),
    obj('basket', [R(930, 790, 70, 40, '#bc6c25', { r: 6 }), Q([935, 790, 965, 755, 995, 790], OUTLINE, 4)]),
    obj('flowers', [C(80, 640, 10, '#ff006e'), C(110, 660, 10, '#ffbe0b'), C(60, 670, 10, '#8338ec'), C(1150, 640, 10, '#ff006e'), C(1120, 665, 10, '#3a86ff')]),
  ],
  diffs: [
    { id: 'kite', label: '연 색깔', obj: 'kite', kind: 'recolor', shapes: [0], to: '#3a86ff' },
    { id: 'balloon', label: '풍선 개수', obj: 'balloons', kind: 'replace', with: (s) => s.filter((_, i) => i !== 2 && i !== 5) },
    { id: 'bench', label: '벤치 색', obj: 'bench', kind: 'recolor', shapes: [2, 3], to: '#277da1' },
    { id: 'dog', label: '강아지 점', obj: 'dog', kind: 'replace', with: (s) => s.filter((_, i) => i !== 6), subtle: true },
    { id: 'duck', label: '오리 한 마리', obj: 'duck-2', kind: 'remove' },
    { id: 'fountain', label: '분수 물줄기', obj: 'fountain', kind: 'replace', with: (s) => s.filter((_, i) => i !== 6) },
    { id: 'shirt', label: '아이 옷 색', obj: 'child', kind: 'recolor', shapes: [2], to: '#ff9f1c' },
    { id: 'blanket', label: '돗자리 색', obj: 'blanket', kind: 'recolor', shapes: [0], to: '#2a9d8f' },
    { id: 'basket', label: '바구니 손잡이', obj: 'basket', kind: 'replace', with: (s) => s.slice(0, 1), subtle: true },
    { id: 'sun', label: '해 크기', obj: 'sun', kind: 'scale', k: 0.66 },
    { id: 'kite-tail', label: '연 꼬리', obj: 'kite', kind: 'replace', with: (s) => s.slice(0, 3) },
    { id: 'flower', label: '꽃 색깔', obj: 'flowers', kind: 'recolor', shapes: [4], to: '#ffbe0b', subtle: true },
  ],
};

export const VECTOR_SCENES = [beach, city, farm, underwater, snow, space, kitchen, park];
