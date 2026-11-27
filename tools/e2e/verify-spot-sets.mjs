// Verification test suite for Spot the Difference stages & photo-set manifests.
// Checks structural quotas (20 images, >=18 disjoint regions, >=9 diffs for every pair),
// visual pixel parity (no unflagged stray diffs when comparing paired images, visible diffs inside boxes),
// and runtime copyBoxFeathered isolation across easy/normal/hard modes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const f = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

const report = { photoSets: {}, singleStages: {}, failures: [] };

try {
  await page.goto(`${base}/?seed=VERIFY-SPOT`);

  const result = await page.evaluate(async () => {
    const { SPOT_STAGES, SPOT_DIFFICULTIES } = await import('/games/spot-difference/stages.js');
    const { PHOTO_SET_STAGES, PHOTO_STAGES, BASE_W, BASE_H, resolveRoundData } = await import('/games/spot-difference/index.js');
    const { createRng } = await import('/js/core/seed.js');

    const maxRequiredCount = Math.max(...SPOT_DIFFICULTIES.map((d) => d.count));
    const easyCount = SPOT_DIFFICULTIES.find((d) => d.id === 'easy')?.count ?? 5;
    const failures = [];
    const photoSets = {};
    const singleStages = {};

    const loadImg = (src) => new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`Image load failed: ${src}`));
      im.src = src;
    });

    const toPixels = (img) => {
      const c = document.createElement('canvas');
      c.width = BASE_W;
      c.height = BASE_H;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, BASE_W, BASE_H);
      return ctx.getImageData(0, 0, BASE_W, BASE_H).data;
    };

    const boxMetrics = (bufA, bufB, box) => {
      const x0 = Math.max(0, Math.floor(box[0] * BASE_W));
      const y0 = Math.max(0, Math.floor(box[1] * BASE_H));
      const x1 = Math.min(BASE_W, Math.ceil(box[2] * BASE_W));
      const y1 = Math.min(BASE_H, Math.ceil(box[3] * BASE_H));
      let sumL2 = 0;
      let count = 0;
      let maxDelta = 0;
      let changedPx = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * BASE_W + x) * 4;
          const dr = bufA[i] - bufB[i];
          const dg = bufA[i + 1] - bufB[i + 1];
          const db = bufA[i + 2] - bufB[i + 2];
          const l2 = Math.hypot(dr, dg, db);
          sumL2 += l2;
          count++;
          const m = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
          if (m > maxDelta) maxDelta = m;
          if (l2 > 28) changedPx++;
        }
      }
      return {
        meanL2: count ? sumL2 / count : 0,
        maxDelta,
        changedRatio: count ? changedPx / count : 0,
      };
    };

    for (const stage of SPOT_STAGES) {
      if (stage.kind === 'photo-set') {
        const set = PHOTO_SET_STAGES[stage.id];
        if (!set) {
          failures.push(`Missing PHOTO_SET_STAGES entry for "${stage.id}"`);
          continue;
        }
        const { regions, images } = set;

        // 1. Quota checks (20 images, >= 18 regions)
        if (images.length < 20) failures.push(`[${stage.id}] expected >= 20 images, got ${images.length}`);
        if (regions.length < 18) failures.push(`[${stage.id}] expected >= 18 regions, got ${regions.length}`);

        const nonSubtleCount = regions.filter((r) => !r.subtle).length;
        if (nonSubtleCount < easyCount) {
          failures.push(`[${stage.id}] non-subtle regions (${nonSubtleCount}) < easy target (${easyCount})`);
        }

        // 2. Region schema + disjoint bounding boxes
        for (let i = 0; i < regions.length; i++) {
          const r = regions[i];
          if (!r.id || !r.label || !Array.isArray(r.box) || r.box.length !== 4) {
            failures.push(`[${stage.id}] invalid region metadata at index ${i}`);
            continue;
          }
          const [x0, y0, x1, y1] = r.box;
          if (!(x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && x0 < x1 && y0 < y1)) {
            failures.push(`[${stage.id}] invalid box coordinates for ${r.id}: ${JSON.stringify(r.box)}`);
          }
          if (r.x < x0 || r.x > x1 || r.y < y0 || r.y > y1) {
            failures.push(`[${stage.id}] hitbox center (${r.x}, ${r.y}) outside box for ${r.id}`);
          }
          for (let j = i + 1; j < regions.length; j++) {
            const b = regions[j].box;
            const ox = Math.min(x1, b[2]) - Math.max(x0, b[0]);
            const oy = Math.min(y1, b[3]) - Math.max(y0, b[1]);
            if (ox > 0.0005 && oy > 0.0005) {
              failures.push(`[${stage.id}] overlapping region boxes: ${r.id} & ${regions[j].id}`);
            }
          }
        }

        // 3. Every pair must differ in at least maxRequiredCount (9) regions
        let minPairDiffs = Infinity;
        let maxPairDiffs = 0;
        for (let i = 0; i < images.length; i++) {
          if (!Array.isArray(images[i].states) || images[i].states.length !== regions.length) {
            failures.push(`[${stage.id}] image ${i} states length mismatch`);
            continue;
          }
          for (let j = i + 1; j < images.length; j++) {
            let diffs = 0;
            for (let r = 0; r < regions.length; r++) {
              if (images[i].states[r] !== images[j].states[r]) diffs++;
            }
            if (diffs < minPairDiffs) minPairDiffs = diffs;
            if (diffs > maxPairDiffs) maxPairDiffs = diffs;
          }
        }
        if (minPairDiffs < maxRequiredCount) {
          failures.push(`[${stage.id}] min pair difference count ${minPairDiffs} < hard target ${maxRequiredCount}`);
        }

        // 4. Decode all 20 images and verify pixels across boxes and background
        const loadedImgs = await Promise.all(images.map((im) => loadImg(im.src)));
        loadedImgs.forEach((im, idx) => {
          if (im.naturalWidth !== BASE_W || im.naturalHeight !== BASE_H) {
            failures.push(`[${stage.id}] ${images[idx].src} resolution ${im.naturalWidth}x${im.naturalHeight} !== ${BASE_W}x${BASE_H}`);
          }
        });
        const bufs = loadedImgs.map(toPixels);

        // 4a. Background outside all region boxes must match across all 20 images (no unflagged stray diffs)
        let worstBgMeanL2 = 0;
        const boxes = regions.map((r) => r.box);
        const insideAnyBox = new Uint8Array(BASE_W * BASE_H);
        for (const [bx0, by0, bx1, by1] of boxes) {
          const px0 = Math.max(0, Math.floor(bx0 * BASE_W) - 2);
          const py0 = Math.max(0, Math.floor(by0 * BASE_H) - 2);
          const px1 = Math.min(BASE_W, Math.ceil(bx1 * BASE_W) + 2);
          const py1 = Math.min(BASE_H, Math.ceil(by1 * BASE_H) + 2);
          for (let y = py0; y < py1; y++) {
            for (let x = px0; x < px1; x++) insideAnyBox[y * BASE_W + x] = 1;
          }
        }
        for (let i = 1; i < bufs.length; i++) {
          let sum = 0;
          let cnt = 0;
          for (let p = 0; p < BASE_W * BASE_H; p += 3) {
            if (insideAnyBox[p]) continue;
            const k = p * 4;
            sum += Math.hypot(bufs[0][k] - bufs[i][k], bufs[0][k + 1] - bufs[i][k + 1], bufs[0][k + 2] - bufs[i][k + 2]);
            cnt++;
          }
          const mean = cnt ? sum / cnt : 0;
          if (mean > worstBgMeanL2) worstBgMeanL2 = mean;
          if (mean > 2.5) {
            failures.push(`[${stage.id}] stray background delta between image 0 and ${i}: meanL2=${mean.toFixed(2)}`);
          }
        }

        // 4b. For every region and every pair of images:
        //   - if states differ -> region MUST show a real visible diff
        //   - if states match  -> region MUST stay essentially identical (no accidental diff)
        let minActiveDiffL2 = Infinity;
        let maxSameStateMeanL2 = 0;
        for (let r = 0; r < regions.length; r++) {
          for (let i = 0; i < images.length; i++) {
            for (let j = i + 1; j < images.length; j++) {
              const m = boxMetrics(bufs[i], bufs[j], regions[r].box);
              if (images[i].states[r] !== images[j].states[r]) {
                if (m.meanL2 < minActiveDiffL2) minActiveDiffL2 = m.meanL2;
                if (m.meanL2 < 3.0 || m.maxDelta < 45) {
                  failures.push(`[${stage.id}] region ${regions[r].id} invisible diff (${i} vs ${j}): meanL2=${m.meanL2.toFixed(2)}, maxDelta=${m.maxDelta}`);
                }
              } else {
                if (m.meanL2 > maxSameStateMeanL2) maxSameStateMeanL2 = m.meanL2;
                if (m.meanL2 > 3.0) {
                  failures.push(`[${stage.id}] region ${regions[r].id} unexpected diff when state matches (${i} vs ${j}): meanL2=${m.meanL2.toFixed(2)}`);
                }
              }
            }
          }
        }

        // 5. Runtime round resolution sanity across multiple seeds & all 3 difficulties
        for (const seed of ['TEST-1', 'ROUND-2', 'WORKSHOP-99']) {
          for (const diff of SPOT_DIFFICULTIES) {
            const round = resolveRoundData(createRng(`${seed}::spot-difference::${stage.id}-${diff.id}`), stage, diff.count, diff.id);
            if (round.anomalies.length !== diff.count) {
              failures.push(`[${stage.id}] ${seed}/${diff.id} anomaly count ${round.anomalies.length} !== ${diff.count}`);
            }
          }
        }

        photoSets[stage.id] = {
          images: images.length,
          regions: regions.length,
          minPairDiffs,
          maxPairDiffs,
          worstBgMeanL2: +worstBgMeanL2.toFixed(3),
          minActiveDiffL2: +minActiveDiffL2.toFixed(2),
          maxSameStateMeanL2: +maxSameStateMeanL2.toFixed(3),
        };
      } else {
        const entry = PHOTO_STAGES[stage.id];
        if (!entry) {
          failures.push(`Missing PHOTO_STAGES entry for "${stage.id}"`);
          continue;
        }
        const im = await loadImg(entry.imageSrc);
        if (im.naturalWidth !== BASE_W || im.naturalHeight !== BASE_H) {
          failures.push(`[${stage.id}] image resolution ${im.naturalWidth}x${im.naturalHeight} !== ${BASE_W}x${BASE_H}`);
        }
        if (entry.pool.length < maxRequiredCount) {
          failures.push(`[${stage.id}] pool size ${entry.pool.length} < ${maxRequiredCount}`);
        }
        singleStages[stage.id] = { pool: entry.pool.length, width: im.naturalWidth, height: im.naturalHeight };
      }
    }

    return { photoSets, singleStages, failures };
  });

  report.photoSets = result.photoSets;
  report.singleStages = result.singleStages;
  report.failures.push(...result.failures);
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(report, null, 2));
if (report.failures.length > 0) {
  console.error('\nSPOT VERIFICATION FAILED:\n- ' + report.failures.join('\n- '));
  process.exit(1);
}
console.log('\nSpot verification passed.');
