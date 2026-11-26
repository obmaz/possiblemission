// Full-play E2E: plays every game to completion using the same seeded generators the
// games use, so any hitbox / determinism / flow regression fails loudly.
// Usage (from tools/e2e):  npm install && npx playwright install chromium && npm test
// Set CHROMIUM_PATH to use an already-installed Chromium instead.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const out = {};
const SEED = 'E2E-42';
const resultSubtitle = () => page.textContent('.arcade-modal__subtitle').catch(() => null);

/* ---------- Spot difference: picker → every picture on hard, clicked to completion ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
await page.waitForSelector('.sd-picker');
out.spotCardHasSelect = await page.evaluate(() => !!document.querySelector('.game-card[data-game-id="spot-difference"] select'));
out.pickerCards = await page.$$eval('.sd-pick-card', (els) => els.length);
await page.click('#hud-exit-btn');
out.pickerExitNoConfirm = await page.evaluate(() => !document.querySelector('#confirm-leave-btn') && !document.querySelector('#lobby-view').hidden);

const stages = await page.evaluate(async () => (await import('/js/games/spot-stages.js')).SPOT_STAGES.map((s) => s.id));
out.spot = {};
for (const stageId of stages) {
  await page.goto(`${base}/?seed=${SEED}`);
  await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
  await page.click(`.sd-pick-card[data-stage="${stageId}"]`);
  await page.click('[data-level="hard"]');
  await page.waitForFunction(() => !document.querySelector('[data-sd-loading]') && document.querySelector('[data-sd-canvas="orig"]'));
  const mode = new URL(page.url()).searchParams.get('mode');
  const targets = await page.evaluate(async ({ seed, mode }) => {
    const { createRng } = await import('/js/core/seed.js');
    const m = await import('/js/games/spot-difference.js');
    const cfg = m.parseModeConfig(mode);
    const rng = createRng(`${seed}::spot-difference::${mode}`);
    return m.selectRoundAnomalies(rng, m.getStagePool(cfg.stage), cfg.targetCount, cfg.difficulty.id).map((a) => ({ x: a.x, y: a.y, label: a.label }));
  }, { seed: SEED, mode });
  const box = await page.locator('[data-sd-canvas="mod"]').boundingBox();
  for (const t of targets) {
    await page.mouse.click(box.x + t.x * box.width, box.y + t.y * box.height);
    await page.waitForTimeout(40);
  }
  await page.waitForSelector('.arcade-modal', { timeout: 4000 }).catch(() => {});
  out.spot[stageId] = `${mode} · ${targets.length} diffs → ${await resultSubtitle()}`;
}

/* ---------- 숫자 숨바꼭질: setup screen → custom settings → full play ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="despair-fortress"] [data-launch-game]');
await page.waitForSelector('.df-setup');
out.hideSeekPresets = await page.$$eval('[data-preset]', (els) => els.map((e) => e.dataset.preset).join(','));
await page.click('[data-preset="hard"]');
// One step longer reveal turns the HARD preset into custom settings
await page.click('[data-field="revealSec"] [data-step="1"]');
await page.click('[data-start]');
await page.waitForSelector('[data-df-canvas]');
const hsMode = new URL(page.url()).searchParams.get('mode');
out.hideSeekMode = hsMode;
const plan = await page.evaluate(async ({ seed, mode }) => {
  const { createRng } = await import('/js/core/seed.js');
  const { generateFortressRun } = await import('/js/games/despair-fortress.js');
  const { parseHideSeekMode } = await import('/js/games/hide-seek-settings.js');
  return generateFortressRun(createRng(`${seed}::despair-fortress::${mode}`), parseHideSeekMode(mode)).map((r) => r.targets.map((t) => t.letter));
}, { seed: SEED, mode: hsMode });
const hearts = () => page.$eval('[data-df-shields]', (el) => (el.textContent.match(/♥/g) || []).length);
const overlayGone = () => page.waitForFunction(() => document.querySelector('[data-df-overlay]').hidden, null, { timeout: 8000 });
await overlayGone();
const wrong = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => l !== plan[0][0]);
const before = await hearts();
await page.keyboard.down(wrong);
await page.waitForTimeout(600);
for (let i = 0; i < 4; i += 1) { await page.keyboard.down(wrong); await page.waitForTimeout(500); }
await page.keyboard.up(wrong);
out.fortressShieldsLostToHeldKey = before - (await hearts());
for (let r = 0; r < plan.length; r += 1) {
  if (r > 0) {
    await page.waitForFunction(() => !document.querySelector('[data-df-overlay]').hidden);
    await overlayGone();
  }
  for (const letter of plan[r]) { await page.keyboard.press(letter); await page.waitForTimeout(60); }
}
await page.waitForSelector('.arcade-modal', { timeout: 6000 }).catch(() => {});
out.fortress = `${await resultSubtitle()} · ${await page.textContent('.result-hero__score').catch(() => '?')}`;
// The setup screen remembers the last settings
await page.goto(`${base}/?seed=${SEED}&game=despair-fortress&mode=setup`);
await page.waitForSelector('.df-setup');
out.hideSeekRemembersLast = (await page.textContent('[data-field="revealSec"] [data-value]')) === '3초';

/* ---------- Determinism: same seed+mode twice → same layout ---------- */
out.deterministic = await page.evaluate(async () => {
  const { createRng } = await import('/js/core/seed.js');
  const df = await import('/js/games/despair-fortress.js');
  const sd = await import('/js/games/spot-difference.js');
  const { parseHideSeekMode } = await import('/js/games/hide-seek-settings.js');
  const god = parseHideSeekMode('god');
  const a = JSON.stringify(df.generateFortressRun(createRng('X::despair-fortress::god'), god));
  const b = JSON.stringify(df.generateFortressRun(createRng('X::despair-fortress::god'), god));
  const cfg = sd.parseModeConfig('city-hard');
  const pick = () => JSON.stringify(sd.selectRoundAnomalies(createRng('X'), sd.getStagePool(cfg.stage), 9, 'hard').map((s) => s.id));
  return a === b && pick() === pick();
});

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();

// Fail the run on any regression
const failures = [];
const cleared = (v) => typeof v === 'string' && v.includes('MISSION ACCOMPLISHED');
Object.entries(out.spot).forEach(([k, v]) => cleared(v) || failures.push(`spot ${k}: ${v}`));
if (!cleared(out.fortress)) failures.push(`fortress: ${out.fortress}`);
if (out.fortressShieldsLostToHeldKey !== 1) failures.push('held key drained more than one shield');
if (out.spotCardHasSelect || out.pickerCards !== 10 || !out.pickerExitNoConfirm) failures.push('spot picker flow');
if (!out.deterministic) failures.push('determinism');
if (out.hideSeekPresets !== 'easy,medium,hard,extreme,insane,god') failures.push('hide & seek presets');
if (!/^custom-60-30-5-6-11-35$/.test(out.hideSeekMode || '')) failures.push(`hide & seek custom mode: ${out.hideSeekMode}`);
if (!out.hideSeekRemembersLast) failures.push('hide & seek setup does not remember the last settings');
if (out.consoleErrors.length) failures.push(`console errors: ${out.consoleErrors.length}`);
if (failures.length) {
  console.error(`\nFAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll checks passed.');
