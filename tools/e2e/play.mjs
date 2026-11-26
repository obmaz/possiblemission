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
// Every real run starts with a 3 · 2 · 1 countdown overlay
const afterCountdown = () => page.waitForFunction(() => document.getElementById('stage-countdown')?.hidden, null, { timeout: 8000 });
const resultStatus = () => page.textContent('.result-hero__status').catch(() => null);

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
  await page.click('[data-browse]');
  await page.click(`.sd-pick-card[data-stage="${stageId}"]`);
  await page.click('[data-view="levels"] [data-level="hard"]');
  await page.waitForFunction(() => !document.querySelector('[data-sd-loading]') && document.querySelector('[data-sd-canvas="orig"]'));
  await afterCountdown();
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
  out.spot[stageId] = `${mode} · ${targets.length} diffs → ${await resultStatus()}`;
}

/* ---------- 틀린그림찾기 quick start: difficulty only, picture from the room seed ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
await page.click('[data-view="start"] [data-level="easy"]');
await page.waitForSelector('[data-sd-canvas="orig"]');
const quickMode1 = new URL(page.url()).searchParams.get('mode');
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
await page.click('[data-view="start"] [data-level="easy"]');
await page.waitForSelector('[data-sd-canvas="orig"]');
out.spotQuickStart = quickMode1 === new URL(page.url()).searchParams.get('mode') && /-easy$/.test(quickMode1) ? quickMode1 : `mismatch ${quickMode1}`;

/* ---------- 플래시 암산: countdown, setup → full play ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="flash-anzan"] [data-launch-game]');
await page.waitForSelector('.fa-setup');
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('.fa-stage');
out.countdownShown = await page.evaluate(() => !document.getElementById('stage-countdown').hidden);
await afterCountdown();
const sums = await page.evaluate(async (seed) => {
  const { createRng } = await import('/js/core/seed.js');
  const { generateAnzanRun } = await import('/js/games/flash-anzan.js');
  const { parseAnzanMode } = await import('/js/games/flash-anzan-settings.js');
  return generateAnzanRun(createRng(`${seed}::flash-anzan::easy`), parseAnzanMode('easy')).map((p) => p.total);
}, SEED);
for (const total of sums) {
  await page.waitForSelector('[data-answer]:not([hidden])', { timeout: 15000 });
  await page.fill('[data-input]', String(total));
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-answer]', { state: 'hidden' });
}
await page.waitForSelector('.arcade-modal', { timeout: 8000 }).catch(() => {});
out.anzan = `${await resultStatus()} · ${(await page.$$eval('.result-stat-box', (els) => els.map((e) => e.textContent.trim()))).join(' / ')}`;

/* ---------- 메모리 매치: lobby → in-game difficulty ---------- */
await page.goto(`${base}/?seed=${SEED}`);
out.lobbyHasSelect = await page.evaluate(() => Boolean(document.querySelector('.game-card select, #hall-of-fame, .game-card__pb-pill')));
await page.click('.game-card[data-game-id="memory-match"] [data-launch-game]');
await page.waitForSelector('.mm-setup');
await page.click('[data-level="4x3"]');
await page.waitForSelector('.mm-grid');
out.memoryMode = new URL(page.url()).searchParams.get('mode');

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
const overlayGone = () => page.waitForFunction(() => document.querySelector('[data-df-overlay]').hidden, null, { timeout: 8000 });
const timerText = () => page.textContent('#hud-timer');
const toSec = (t) => (t.includes(':') ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : parseFloat(t));
await overlayGone();
// A wrong answer typed into the answer box costs WRONG_PENALTY_SEC (3 s)
const wrong = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => l !== plan[0][0]);
const before = toSec(await timerText());
await page.fill('[data-df-input]', wrong);
await page.waitForTimeout(150);
out.hideSeekWrongPenaltySec = Math.round(before - toSec(await timerText()));
await page.waitForTimeout(500); // wrong-answer cooldown
for (let r = 0; r < plan.length; r += 1) {
  if (r > 0) {
    await page.waitForFunction(() => !document.querySelector('[data-df-overlay]').hidden);
    await overlayGone();
  }
  for (const letter of plan[r]) {
    await page.fill('[data-df-input]', letter);
    await page.waitForTimeout(80);
  }
}
await page.waitForSelector('.arcade-modal', { timeout: 6000 }).catch(() => {});
out.fortress = `${await page.textContent('.result-hero__status').catch(() => '?')} · ${await page.textContent('.result-hero__score').catch(() => '?')}`;
out.resultHasCopyButton = await page.evaluate(() => Boolean(document.querySelector('#result-copy-btn, .result-preview-line, .result-stat-box__label')));
out.resultStats = await page.$$eval('.result-stat-box', (els) => els.map((e) => e.textContent.trim()));
// "난이도 바꾸기" goes back to the setup screen
await page.click('#result-change-btn');
out.hideSeekChangeDifficulty = Boolean(await page.waitForSelector('.df-setup', { timeout: 4000 }).catch(() => null));
// Same symbol → same number on every tile; GOD mixes Hangul
out.hideSeekRules = await page.evaluate(async () => {
  const { createRng } = await import('/js/core/seed.js');
  const { generateFortressRun } = await import('/js/games/despair-fortress.js');
  const { parseHideSeekMode } = await import('/js/games/hide-seek-settings.js');
  const run = generateFortressRun(createRng('X::despair-fortress::god'), parseHideSeekMode('god'));
  const consistent = run.every((r) => {
    const map = new Map();
    return r.tiles.every((t) => (map.has(t.letter) ? map.get(t.letter) === t.number : (map.set(t.letter, t.number), true)));
  });
  const hangul = run.some((r) => r.tiles.some((t) => /[가-힣]/.test(t.letter)));
  const easy = generateFortressRun(createRng('X::despair-fortress::easy'), parseHideSeekMode('easy'));
  const noHangulOnEasy = easy.every((r) => r.tiles.every((t) => /[A-Z]/.test(t.letter)));
  return consistent && hangul && noHangulOnEasy;
});
// Starting again from the lobby shows the setup screen again (it used to skip it)
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="despair-fortress"] [data-launch-game]');
out.hideSeekSetupAgain = Boolean(await page.waitForSelector('.df-setup', { timeout: 4000 }).catch(() => null));
// …and remembers the last settings
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
const cleared = (v) => typeof v === 'string' && v.includes('성공');
Object.entries(out.spot).forEach(([k, v]) => cleared(v) || failures.push(`spot ${k}: ${v}`));
if (!cleared(out.fortress)) failures.push(`fortress: ${out.fortress}`);
if (out.hideSeekWrongPenaltySec !== 3) failures.push(`wrong answer penalty: ${out.hideSeekWrongPenaltySec}s`);
if (out.resultHasCopyButton) failures.push('result modal still shows copy / labels');
if (!out.hideSeekRules) failures.push('hide & seek symbol/number rules');
if (!/-easy$/.test(out.spotQuickStart)) failures.push(`spot quick start: ${out.spotQuickStart}`);
if (out.lobbyHasSelect) failures.push('lobby still shows a select / hall of fame / record pill');
if (out.memoryMode !== '4x3') failures.push(`memory in-game difficulty: ${out.memoryMode}`);
if (!out.hideSeekChangeDifficulty) failures.push('result "난이도 바꾸기" did not open setup');
if (!out.hideSeekSetupAgain) failures.push('lobby start skipped the hide & seek setup');
if (!out.countdownShown) failures.push('no start countdown');
if (!/^성공 · 🧮 5\/5 정답/.test(out.anzan || '')) failures.push(`flash anzan: ${out.anzan}`);
if (out.spotCardHasSelect || out.pickerCards !== 10 || !out.pickerExitNoConfirm) failures.push('spot picker flow');
if (!out.deterministic) failures.push('determinism');
if (out.hideSeekPresets !== 'easy,medium,hard,extreme,insane,god') failures.push('hide & seek presets');
if (!/^custom-60-30-5-6-11-35-0$/.test(out.hideSeekMode || '')) failures.push(`hide & seek custom mode: ${out.hideSeekMode}`);
if (!out.hideSeekRemembersLast) failures.push('hide & seek setup does not remember the last settings');
if (out.consoleErrors.length) failures.push(`console errors: ${out.consoleErrors.length}`);
if (failures.length) {
  console.error(`\nFAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll checks passed.');
