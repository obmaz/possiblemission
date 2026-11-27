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

/* ---------- Spot difference: setup → every picture on hard, clicked to completion ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
await page.waitForSelector('.setup');
out.spotCardHasSelect = await page.evaluate(() => !!document.querySelector('.game-card[data-game-id="spot-difference"] select'));
out.spotPresets = await page.$$eval('[data-preset]', (els) => els.map((e) => e.dataset.preset).join(','));
await page.click('#hud-exit-btn');
out.pickerExitNoConfirm = await page.evaluate(() => !document.querySelector('#confirm-leave-btn') && !document.querySelector('#lobby-view').hidden);

const selectSpotStage = async (label) => {
  const order = ['랜덤 (시드)', '카페', '캠프'];
  const targetIdx = order.indexOf(label);
  for (let i = 0; i < 4; i++) {
    const cur = (await page.textContent('[data-field="stageIdx"] [data-value]')).trim();
    const curIdx = order.indexOf(cur);
    if (curIdx === targetIdx) break;
    await page.click(`[data-field="stageIdx"] [data-step="${curIdx < targetIdx ? 1 : -1}"]`);
  }
};

const stages = await page.evaluate(async () => (await import('/games/spot-difference/stages.js')).SPOT_STAGES.map((s) => s.id));
const stageLabels = { cafe: '카페', camp: '캠프' };
out.spot = {};
for (const stageId of stages) {
  await page.goto(`${base}/?seed=${SEED}`);
  await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
  await page.waitForSelector('.setup');
  await selectSpotStage(stageLabels[stageId]);
  await page.click('[data-preset="hard"]');
  await page.click('[data-start]');
  await page.waitForFunction(() => !document.querySelector('[data-sd-loading]') && document.querySelector('[data-sd-canvas="orig"]'));
  await afterCountdown();
  const mode = new URL(page.url()).searchParams.get('mode');
  const targets = await page.evaluate(async ({ seed, mode }) => {
    const { createRng } = await import('/js/core/seed.js');
    const m = await import('/games/spot-difference/round.js');
    const cfg = m.parseModeConfig(mode);
    const rng = createRng(`${seed}::spot-difference::${mode}`);
    return m.resolveRoundData(rng, cfg.stage, cfg.targetCount, cfg.difficulty.id).anomalies.map((a) => ({ x: a.x, y: a.y, label: a.label }));
  }, { seed: SEED, mode });
  const box = await page.locator('[data-sd-canvas="mod"]').boundingBox();
  for (const t of targets) {
    await page.mouse.click(box.x + t.x * box.width, box.y + t.y * box.height);
    await page.waitForTimeout(40);
  }
  await page.waitForSelector('.arcade-modal', { timeout: 4000 }).catch(() => {});
  out.spot[stageId] = `${mode} · ${targets.length} diffs → ${await resultStatus()}`;
}

/* ---------- Spot difference cafe-easy: rendered diffs match anomalies 1:1 ---------- */
{
  await page.goto(`${base}/?seed=${SEED}`);
  await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
  await page.waitForSelector('.setup');
  await selectSpotStage('카페');
  await page.click('[data-preset="easy"]');
  await page.click('[data-start]');
  await page.waitForFunction(() => !document.querySelector('[data-sd-loading]') && document.querySelector('[data-sd-canvas="orig"]'));
  await afterCountdown();
  const mode = new URL(page.url()).searchParams.get('mode');
  const check = await page.evaluate(async ({ seed, mode }) => {
    const { createRng } = await import('/js/core/seed.js');
    const m = await import('/games/spot-difference/round.js');
    const cfg = m.parseModeConfig(mode);
    const rng = createRng(`${seed}::spot-difference::${mode}`);
    const anomalies = m.resolveRoundData(rng, cfg.stage, cfg.targetCount, cfg.difficulty.id).anomalies;
    const boxes = anomalies.map((a) => a.box);
    const cOrig = document.querySelector('[data-sd-canvas="orig"]');
    const cMod = document.querySelector('[data-sd-canvas="mod"]');
    const w = cOrig.width;
    const h = cOrig.height;
    const dOrig = cOrig.getContext('2d').getImageData(0, 0, w, h).data;
    const dMod = cMod.getContext('2d').getImageData(0, 0, w, h).data;
    let maxOutsideDelta = 0;
    for (let y = 0; y < h; y += 2) {
      const ny = y / h;
      for (let x = 0; x < w; x += 2) {
        const nx = x / w;
        if (boxes.some((b) => nx >= b[0] - 0.002 && nx <= b[2] + 0.002 && ny >= b[1] - 0.002 && ny <= b[3] + 0.002)) continue;
        const idx = (y * w + x) * 4;
        const delta = Math.max(
          Math.abs(dOrig[idx] - dMod[idx]),
          Math.abs(dOrig[idx + 1] - dMod[idx + 1]),
          Math.abs(dOrig[idx + 2] - dMod[idx + 2])
        );
        if (delta > maxOutsideDelta) maxOutsideDelta = delta;
      }
    }
    return {
      maxOutsideDelta,
      targets: anomalies.map((a) => ({ x: a.x, y: a.y })),
    };
  }, { seed: SEED, mode });
  const box = await page.locator('[data-sd-canvas="mod"]').boundingBox();
  for (const t of check.targets) {
    await page.mouse.click(box.x + t.x * box.width, box.y + t.y * box.height);
    await page.waitForTimeout(40);
  }
  await page.waitForSelector('.arcade-modal', { timeout: 4000 }).catch(() => {});
  out.spotCafeEasyExact = check.maxOutsideDelta <= 2 && /성공/.test((await resultStatus()) || '');
}

/* ---------- 틀린그림찾기 quick start: difficulty only, picture from the room seed ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
await page.waitForSelector('.setup');
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('[data-sd-canvas="orig"]');
const quickMode1 = new URL(page.url()).searchParams.get('mode');
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
await page.waitForSelector('.setup');
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('[data-sd-canvas="orig"]');
out.spotQuickStart = quickMode1 === new URL(page.url()).searchParams.get('mode') && /-easy$/.test(quickMode1) ? quickMode1 : `mismatch ${quickMode1}`;

/* ---------- 틀린그림찾기 다같이(기억해서 찾기): 기본 60초 외우기 → 중간 시작 → 1장 변형 그림에서 찾기 ---------- */
{
  await page.goto(`${base}/?seed=${SEED}`);
  await page.click('.game-card[data-game-id="spot-difference"] [data-launch-game]');
  await page.waitForSelector('.setup');
  await page.click('[data-playmode="1"]');
  await page.click('[data-preset="easy"]');
  await page.click('[data-start]');
  await page.waitForSelector('[data-sd-party-skip]');
  const partyUrl = new URL(page.url()).searchParams.get('mode');
  await page.waitForFunction(() => document.querySelectorAll('[data-sd-loading]').length === 0);
  const memorizeState = await page.evaluate(() => {
    const origCard = document.querySelector('[data-sd-card="orig"]');
    const banner = document.querySelector('[data-sd-party-banner]');
    const footer = document.querySelector('.sd-footer');
    const origRect = origCard.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const origVis = getComputedStyle(origCard).display !== 'none';
    const modHidden = getComputedStyle(document.querySelector('[data-sd-card="mod"]')).display === 'none';
    const noOverlap = origRect.top >= bannerRect.bottom - 1 && origRect.bottom <= footerRect.top + 1;
    const timer = document.querySelector('.pm-timer')?.textContent?.trim();
    return { origVis, modHidden, noOverlap, timer };
  });
  await page.click('[data-sd-party-skip]');
  const beforeMiss = await page.textContent('.pm-timer');
  await page.mouse.click(10, 10);
  const modBox = await page.locator('[data-sd-canvas="mod"]').boundingBox();
  await page.mouse.click(modBox.x + 2, modBox.y + 2);
  await page.waitForTimeout(100);
  const afterMiss = await page.textContent('.pm-timer');
  const findState = await page.evaluate(() => ({
    origHidden: getComputedStyle(document.querySelector('[data-sd-card="orig"]')).display === 'none',
    modVis: getComputedStyle(document.querySelector('[data-sd-card="mod"]')).display !== 'none',
    callout: document.querySelector('[data-sd-callout]')?.textContent?.trim() || '',
  }));
  const parseSec = (t) => (t.includes(':') ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : parseFloat(t));
  const noPenalty = Math.abs(parseSec(beforeMiss) - parseSec(afterMiss)) <= 1;
  out.spotPartyMemory = {
    ok: /-easy-party-60$/.test(partyUrl || '')
      && memorizeState.origVis
      && memorizeState.modHidden
      && memorizeState.noOverlap
      && /^0[01]:\d{2}$/.test(memorizeState.timer || '')
      && findState.origHidden
      && findState.modVis
      && noPenalty
      && findState.callout.includes('다른 곳이 아니에요'),
    partyUrl,
    memorizeState,
    findState,
    noPenalty,
  };
}

/* ---------- 도블 스피드 매치: projective plane math + KRRI/KTX + setup → full play + result buttons ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.waitForSelector('.game-card');
out.noInviteCopyBtn = await page.evaluate(() => !document.getElementById('copy-invite-btn'));
out.heroToolsInBanner = await page.evaluate(() => Boolean(
  document.querySelector('#hero-banner #lobby-mute-btn svg')
  && document.querySelector('#hero-banner .workshop-more summary svg')
));
out.compactCards = await page.evaluate(() => {
  const noOldText = !document.querySelector('.game-card__sub-en, .game-card__hook');
  const titlesInBody = document.querySelectorAll('.game-card__body .game-card__pb-bar .game-card__title').length === 8;
  const summaries = document.querySelectorAll('.game-card__pb-bar .game-card__summary').length === 8;
  const soloOnly = ['dobble', 'memory-match', 'hide-seek'].every((id) => {
    const c = document.querySelector(`.game-card[data-game-id="${id}"]`);
    return c?.querySelector('[data-player-icon="solo"]') && !c?.querySelector('[data-player-icon="group"]');
  });
  const bothModes = ['spot-difference', 'flash-anzan', 'color-trap', 'pixel-reveal', 'flash-count'].every((id) => {
    const c = document.querySelector(`.game-card[data-game-id="${id}"]`);
    return c?.querySelector('[data-player-icon="solo"]') && c?.querySelector('[data-player-icon="group"]');
  });
  return noOldText && titlesInBody && summaries && soloOnly && bothModes;
});
await page.click('.game-card[data-game-id="dobble"] [data-launch-game]');
await page.waitForSelector('.setup');
out.dobbleMathValid = await page.evaluate(async () => {
  const { buildProjectiveDeck, generateDobbleRun } = await import('/games/dobble/index.js');
  const { DOBBLE_SYMBOLS } = await import('/games/dobble/symbols.js');
  const { DOBBLE_PRESETS, parseDobbleMode } = await import('/games/dobble/settings.js');
  const { createRng } = await import('/js/core/seed.js');
  const uniformRounds = new Set(DOBBLE_PRESETS.map((p) => p.rounds)).size === 1;
  const hasKrriKtx = DOBBLE_SYMBOLS.some((s) => s.id === 'krri') && DOBBLE_SYMBOLS.some((s) => s.id === 'ktx');
  const decksOk = [5, 7, 9, 11, 13, 16].every((q) => {
    const deck = buildProjectiveDeck(q);
    for (let i = 0; i < deck.length; i += 1) {
      const a = new Set(deck[i]);
      if (a.size !== q + 1) return false;
      for (let j = i + 1; j < deck.length; j += 1) {
        let shared = 0;
        for (const s of deck[j]) if (a.has(s)) shared += 1;
        if (shared !== 1) return false;
      }
    }
    return true;
  });
  const godRun = generateDobbleRun(createRng('X::dobble::god'), parseDobbleMode('god'));
  const godIds = new Set(godRun.flatMap((r) => [...r.left, ...r.right].map((x) => x.symbol.id)));
  return uniformRounds && hasKrriKtx && decksOk && godRun[0].left.length === 17 && godIds.has('krri') && godIds.has('ktx');
});
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('.db-card');
await afterCountdown();
const dobbleMode = new URL(page.url()).searchParams.get('mode');
const dobbleMatches = await page.evaluate(async ({ seed, mode }) => {
  const { createRng } = await import('/js/core/seed.js');
  const { generateDobbleRun } = await import('/games/dobble/index.js');
  const { parseDobbleMode } = await import('/games/dobble/settings.js');
  return generateDobbleRun(createRng(`${seed}::dobble::${mode}`), parseDobbleMode(mode)).map((r) => r.matchId);
}, { seed: SEED, mode: dobbleMode });
for (const symId of dobbleMatches) {
  await page.click(`[data-db-card="left"] [data-sym="${symId}"]`);
  await page.waitForTimeout(30);
}
await page.waitForSelector('.arcade-modal', { timeout: 4000 }).catch(() => {});
out.dobble = `${await resultStatus()} · ${dobbleMatches.length} rounds`;
out.resultButtons = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.result-actions > button'));
  const rects = btns.map((b) => b.getBoundingClientRect());
  const sameRow = rects.every((r) => Math.abs(r.top - rects[0].top) < 2);
  const sameSize = rects.every((r) => Math.abs(r.width - rects[0].width) < 2 && Math.abs(r.height - rects[0].height) < 2);
  return { labels: btns.map((b) => b.textContent.trim()), sameRow, sameSize };
});

/* ---------- 플래시 암산: countdown, setup → full play ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="flash-anzan"] [data-launch-game]');
await page.waitForSelector('.setup');
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('.fa-stage');
out.countdownShown = await page.evaluate(() => !document.getElementById('stage-countdown').hidden);
await afterCountdown();
const sums = await page.evaluate(async (seed) => {
  const { createRng } = await import('/js/core/seed.js');
  const { generateAnzanRun } = await import('/games/flash-anzan/index.js');
  const { parseAnzanMode } = await import('/games/flash-anzan/settings.js');
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
await page.waitForSelector('.setup');
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('.mm-grid');
out.memoryMode = new URL(page.url()).searchParams.get('mode');

/* ---------- 숫자 숨바꼭질: setup screen → custom settings → full play ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="hide-seek"] [data-launch-game]');
await page.waitForSelector('.setup');
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
  const { generateHideSeekRun } = await import('/games/hide-seek/index.js');
  const { parseHideSeekMode } = await import('/games/hide-seek/settings.js');
  return generateHideSeekRun(createRng(`${seed}::hide-seek::${mode}`), parseHideSeekMode(mode)).targets.map((t) => t.letter);
}, { seed: SEED, mode: hsMode });
const timerText = () => page.textContent('.pm-timer');
const toSec = (t) => (t.includes(':') ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : parseFloat(t));
await afterCountdown();
// A wrong letter typed into a number's box costs WRONG_PENALTY_SEC (3 s)
const wrong = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => !plan.includes(l));
const before = toSec(await timerText());
await page.fill('[data-box="2"]', wrong);
await page.waitForTimeout(150);
out.hideSeekWrongPenaltySec = Math.round(before - toSec(await timerText()));
out.hideSeekBoxMaxLength = await page.getAttribute('[data-box="0"]', 'maxlength');
await page.waitForTimeout(500); // wrong-answer input cooldown (450 ms)
// Any order: answer the last number first
for (const i of [2, 0, 1]) {
  await page.fill(`[data-box="${i}"]`, plan[i]);
  await page.waitForTimeout(80);
}
await page.waitForSelector('.arcade-modal', { timeout: 6000 }).catch(() => {});
out.fortress = `${await page.textContent('.result-hero__status').catch(() => '?')} · ${await page.textContent('.result-hero__score').catch(() => '?')}`;
out.resultClosable = await page.evaluate(() => Boolean(document.querySelector('.arcade-modal__close')));
out.resultHasCopyButton = await page.evaluate(() => Boolean(document.querySelector('#result-copy-btn, .result-preview-line, .result-stat-box__label')));
out.resultStats = await page.$$eval('.result-stat-box', (els) => els.map((e) => e.textContent.trim()));
// "난이도 바꾸기" goes back to the setup screen
await page.click('#result-change-btn');
out.hideSeekChangeDifficulty = Boolean(await page.waitForSelector('.setup', { timeout: 4000 }).catch(() => null));
// Same symbol → same number on every tile; GOD mixes Hangul
out.hideSeekRules = await page.evaluate(async () => {
  const { createRng } = await import('/js/core/seed.js');
  const { generateHideSeekRun } = await import('/games/hide-seek/index.js');
  const { parseHideSeekMode } = await import('/games/hide-seek/settings.js');
  const run = generateHideSeekRun(createRng('X::hide-seek::god'), parseHideSeekMode('god'));
  const map = new Map();
  const consistent = run.tiles.every((t) => (map.has(t.letter) ? map.get(t.letter) === t.number : (map.set(t.letter, t.number), true)));
  const hangul = run.tiles.some((t) => /[가-힣]/.test(t.letter));
  const easy = generateHideSeekRun(createRng('X::hide-seek::easy'), parseHideSeekMode('easy'));
  const noHangulOnEasy = easy.tiles.every((t) => /[A-Z]/.test(t.letter));
  const { tilePeekAt } = await import('/games/hide-seek/index.js');
  const godCfg = parseHideSeekMode('god');
  const ranks = new Set(run.tiles.map((t) => t.hideRank));
  const fullReveal = run.tiles.every((t) => tilePeekAt(run, godCfg, t, 0.5) === 1);
  const paced = ranks.size === run.tiles.length && godCfg.revealSec >= 1.5 && run.hideBatch === godCfg.hideBatch && run.hideBatch < run.tiles.length && fullReveal;
  return consistent && hangul && noHangulOnEasy && paced;
});
// Starting again from the lobby shows the setup screen again (it used to skip it)
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="hide-seek"] [data-launch-game]');
out.hideSeekSetupAgain = Boolean(await page.waitForSelector('.setup', { timeout: 4000 }).catch(() => null));
// …and remembers the last settings
out.hideSeekRemembersLast = (await page.textContent('[data-field="revealSec"] [data-value]')) === '4초';

/* ---------- Determinism: same seed+mode twice → same layout ---------- */
out.deterministic = await page.evaluate(async () => {
  const { createRng } = await import('/js/core/seed.js');
  const df = await import('/games/hide-seek/index.js');
  const sd = await import('/games/spot-difference/round.js');
  const { parseHideSeekMode } = await import('/games/hide-seek/settings.js');
  const god = parseHideSeekMode('god');
  const a = JSON.stringify(df.generateHideSeekRun(createRng('X::hide-seek::god'), god));
  const b = JSON.stringify(df.generateHideSeekRun(createRng('X::hide-seek::god'), god));
  const cfg = sd.parseModeConfig('cafe-hard');
  const pick = () => JSON.stringify(sd.resolveRoundData(createRng('X::spot-difference::cafe-hard'), cfg.stage, 9, 'hard').anomalies.map((s) => s.id));
  return a === b && pick() === pick();
});

/* ---------- Hide & Seek invariant: staggered hiding, hidden count <= hideBatch, never all at once ---------- */
out.hideSeekWaveInvariant = await page.evaluate(async () => {
  const { createRng } = await import('/js/core/seed.js');
  const { HIDE_SEEK_PRESETS, parseHideSeekMode } = await import('/games/hide-seek/settings.js');
  const { generateHideSeekRun, tilePeekAt } = await import('/games/hide-seek/index.js');

  for (const preset of HIDE_SEEK_PRESETS) {
    const settings = parseHideSeekMode(preset.id);
    const wall = generateHideSeekRun(createRng(`WAVE-TEST::hide-seek::${preset.id}`), settings);
    const seenHiddenCount = new Array(wall.tiles.length).fill(0);
    const fullyVisibleCount = new Array(wall.tiles.length).fill(0);

    // Immediately after revealSec, only 1 tile should begin hiding (never all hideBatch at once)
    let startHidden = 0;
    for (let i = 0; i < wall.tiles.length; i++) {
      if (tilePeekAt(wall, settings, wall.tiles[i], settings.revealSec + 0.05) < 0.999) startHidden++;
    }
    if (startHidden > 1) {
      return `${preset.id}: ${startHidden} tiles hid immediately after revealSec`;
    }

    for (let t = settings.revealSec; t <= settings.timeSec; t += 0.05) {
      let hiddenCount = 0;
      for (let i = 0; i < wall.tiles.length; i++) {
        const v = tilePeekAt(wall, settings, wall.tiles[i], t);
        if (v < 0.999) {
          hiddenCount++;
          seenHiddenCount[i]++;
        } else {
          fullyVisibleCount[i]++;
        }
      }
      if (hiddenCount > settings.hideBatch) {
        return `${preset.id}: hiddenCount ${hiddenCount} > hideBatch ${settings.hideBatch} at t=${t.toFixed(2)}`;
      }
    }
    if (seenHiddenCount.some((c) => c === 0) || fullyVisibleCount.some((c) => c === 0)) {
      return `${preset.id}: some tiles never hid or never returned during round`;
    }
  }
  return 'ok';
});

/* ---------- Short mobile & landscape viewports: HUD does not overlap stage + SVG icons ---------- */
{
  const checkViewport = async (width, height, gameId, titleSel) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/?seed=${SEED}`);
    await page.click(`.game-card[data-game-id="${gameId}"] [data-launch-game]`);
    await page.waitForSelector(titleSel);
    return page.evaluate((sel) => {
      const hud = document.getElementById('game-hud').getBoundingClientRect();
      const root = document.querySelector('#game-stage .game-root').getBoundingClientRect();
      const title = document.querySelector(sel).getBoundingClientRect();
      const hasIcons = Boolean(
        document.querySelector('#hud-exit-btn svg')
        && document.querySelector('#hud-pause-btn svg')
        && document.querySelector('#hud-more-btn svg')
      );
      return {
        ok: hasIcons && root.top >= hud.bottom - 1 && title.top >= hud.bottom - 1,
        hasIcons,
        hudBottom: Math.round(hud.bottom),
        rootTop: Math.round(root.top),
        titleTop: Math.round(title.top),
      };
    }, titleSel);
  };
  const mob = await checkViewport(375, 580, 'hide-seek', '.setup__title');
  const land = await checkViewport(667, 375, 'flash-anzan', '.setup__title');
  out.mobileHudNoOverlap = { ok: mob.ok && land.ok, mob, land };
  await page.setViewportSize({ width: 1440, height: 900 });
}

/* ---------- 컬러 트랩: setup → solo full play + party mode check ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="color-trap"] [data-launch-game]');
await page.waitForSelector('.setup');
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('.ct-stage');
await afterCountdown();
const ctMode = new URL(page.url()).searchParams.get('mode');
const ctAnswers = await page.evaluate(async ({ seed, mode }) => {
  const { createRng } = await import('/js/core/seed.js');
  const { generateColorTrapRun } = await import('/games/color-trap/index.js');
  const { parseColorTrapMode } = await import('/games/color-trap/settings.js');
  return generateColorTrapRun(createRng(`${seed}::color-trap::${mode}`), parseColorTrapMode(mode)).map((q) => q.answerId);
}, { seed: SEED, mode: ctMode });
for (const ans of ctAnswers) {
  await page.click(`[data-choice="${ans}"]`);
  await page.waitForTimeout(30);
}
await page.waitForSelector('.arcade-modal', { timeout: 4000 }).catch(() => {});
out.colorTrapSolo = `${await resultStatus()} · ${ctAnswers.length}q`;

await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="color-trap"] [data-launch-game]');
await page.waitForSelector('.setup');
await page.click('[data-playmode="1"]');
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('.ct-party-controls');
await afterCountdown();
await page.click('[data-mc-reveal]');
out.colorTrapParty = await page.evaluate(() => Boolean(document.querySelector('.ct-reveal-pill') && !document.querySelector('.party-team-btn')));

/* ---------- 플래시 암산 다같이(한 화면) 모드 ---------- */
await page.goto(`${base}/?seed=${SEED}&game=flash-anzan&mode=easy-party`);
await page.waitForSelector('.fa-stage');
out.anzanParty = await page.evaluate(() => Boolean(document.querySelector('.game-flash-anzan.is-party') && document.querySelector('.fa-party-panel')));

/* ---------- 모자이크 줌아웃: 100-image pool + setup → solo full play + party no-overlap layout check ---------- */
out.pixelRevealPool = await page.evaluate(async () => {
  const { REVEAL_ITEMS } = await import('/games/pixel-reveal/items.js');
  const ids = new Set(REVEAL_ITEMS.map((x) => x.id));
  const labels = new Set(REVEAL_ITEMS.map((x) => x.label));
  const statuses = await Promise.all(REVEAL_ITEMS.map((x) => fetch(x.src, { method: 'HEAD' }).then((r) => r.status)));
  return { count: REVEAL_ITEMS.length, uniqueIds: ids.size, uniqueLabels: labels.size, allOk: statuses.every((s) => s === 200) };
});
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="pixel-reveal"] [data-launch-game]');
await page.waitForSelector('.setup');
await page.click('[data-playmode="1"]');
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('.pr-canvas');
await afterCountdown();
out.pixelRevealNoOverlap = await page.evaluate(() => {
  const c = document.querySelector('[data-pr-canvas]').getBoundingClientRect();
  const m = document.querySelector('.pr-meter').getBoundingClientRect();
  const b = document.querySelector('.pr-bottom').getBoundingClientRect();
  const h = document.querySelector('.pr-header').getBoundingClientRect();
  return c.top >= h.bottom - 1 && c.bottom <= m.top + 1 && m.bottom <= b.top + 1 && !document.querySelector('.party-team-btn');
});

await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="pixel-reveal"] [data-launch-game]');
await page.waitForSelector('.setup');
await page.click('[data-playmode="0"]');
await page.click('[data-preset="easy"]');
await page.click('[data-start]');
await page.waitForSelector('.pr-canvas');
await afterCountdown();
const prMode = new URL(page.url()).searchParams.get('mode');
const prAnswers = await page.evaluate(async ({ seed, mode }) => {
  const { createRng } = await import('/js/core/seed.js');
  const { generatePixelRevealRun } = await import('/games/pixel-reveal/index.js');
  const { parsePixelRevealMode } = await import('/games/pixel-reveal/settings.js');
  return generatePixelRevealRun(createRng(`${seed}::pixel-reveal::${mode}`), parsePixelRevealMode(mode)).map((r) => r.item.label);
}, { seed: SEED, mode: prMode });
for (const label of prAnswers) {
  await page.waitForSelector(`[data-choice="${label}"]:not([disabled])`, { timeout: 5000 });
  await page.click(`[data-choice="${label}"]`);
}
await page.waitForSelector('.arcade-modal', { timeout: 5000 }).catch(() => {});
out.pixelRevealSolo = `${await resultStatus()} · ${prAnswers.length}q`;

/* ---------- 찰나의 카운팅: setup → solo full play + party mode check ---------- */
await page.goto(`${base}/?seed=${SEED}`);
await page.click('.game-card[data-game-id="flash-count"] [data-launch-game]');
await page.waitForSelector('.setup');
await page.click('[data-preset="easy"]');
await page.click('[data-field="flashSec"] [data-step="1"]');
await page.click('[data-start]');
await page.waitForSelector('.fc-arena');
await afterCountdown();
const fcMode = new URL(page.url()).searchParams.get('mode');
const fcAnswers = await page.evaluate(async ({ seed, mode }) => {
  const { createRng } = await import('/js/core/seed.js');
  const { generateFlashCountRun } = await import('/games/flash-count/index.js');
  const { parseFlashCountMode } = await import('/games/flash-count/settings.js');
  return generateFlashCountRun(createRng(`${seed}::flash-count::${mode}`), parseFlashCountMode(mode)).map((p) => p.targetCount);
}, { seed: SEED, mode: fcMode });
for (const cnt of fcAnswers) {
  await page.waitForSelector(`[data-count="${cnt}"]`, { timeout: 8000 });
  await page.click(`[data-count="${cnt}"]`);
}
await page.waitForSelector('.arcade-modal', { timeout: 5000 }).catch(() => {});
out.flashCountSolo = `${await resultStatus()} · ${fcAnswers.length}q`;

/* ---------- Shared chrome: no timer/score in the top bar, fullscreen toggle, hide / show layout ---------- */
await page.goto(`${base}/?seed=${SEED}&game=dobble&mode=easy`);
await page.waitForSelector('.db-card');
await afterCountdown();
out.chrome = await page.evaluate(async () => {
  const visible = (el) => Boolean(el) && !el.hidden && el.getBoundingClientRect().width > 0;
  const fsSupported = Boolean(document.fullscreenEnabled);
  const shell = {
    hudMatchesStageWidth: Math.abs(document.getElementById('game-hud').getBoundingClientRect().width - document.querySelector('#game-stage > .game-root').getBoundingClientRect().width) <= 2,
    noSharedTimerOrScore: !document.querySelector('#game-hud .pm-timer, #game-hud .pm-score, #hud-timer, #hud-score'),
    gameOwnsTimer: Boolean(document.querySelector('#game-stage .pm-timer')) && Boolean(document.querySelector('#game-stage .pm-score')),
    fullscreenButton: !fsSupported || (visible(document.getElementById('hud-fullscreen-btn')) && /전체화면/.test(document.getElementById('hud-fullscreen-btn').textContent)),
    layoutButtonNextToFullscreen: document.getElementById('hud-fullscreen-btn').nextElementSibling?.id === 'hud-layout-btn',
  };
  return shell;
});
// Headless Chromium cannot really enter fullscreen, so stub the API and verify the button wiring
await page.evaluate(() => {
  let fake = null;
  Object.defineProperty(document, 'fullscreenElement', { get: () => fake, configurable: true });
  document.documentElement.requestFullscreen = async () => { fake = document.documentElement; document.dispatchEvent(new Event('fullscreenchange')); };
  document.exitFullscreen = async () => { fake = null; document.dispatchEvent(new Event('fullscreenchange')); };
});
const fsLabel = () => page.textContent('#hud-fullscreen-btn');
await page.click('#hud-fullscreen-btn');
out.chrome.fullscreenEntered = /축소하기/.test(await fsLabel());
await page.click('#hud-fullscreen-btn');
out.chrome.fullscreenExited = /전체화면/.test(await fsLabel());
const stageHeight = () => page.evaluate(() => document.getElementById('game-stage').getBoundingClientRect().height);
const heightWithBar = await stageHeight();
await page.click('#hud-layout-btn');
out.chrome.hidden = await page.evaluate(() => {
  const shown = (sel) => document.querySelector(sel).getBoundingClientRect().width > 0;
  return document.getElementById('game-view').dataset.layout === 'hidden'
    && !shown('#hud-game-title') && !shown('#hud-pause-btn') && !shown('#hud-more-btn')
    && shown('#hud-layout-btn') && /보이기/.test(document.getElementById('hud-layout-btn').getAttribute('aria-label'));
});
out.chrome.stageGrew = (await stageHeight()) > heightWithBar + 10;
await page.click('#hud-layout-btn');
out.chrome.restored = await page.evaluate(() => document.getElementById('hud-game-title').getBoundingClientRect().width > 0 && document.getElementById('game-view').dataset.layout === 'shown');

/* ---------- Registry: every games/<id>/ folder is complete and registered ---------- */
out.registry = await page.evaluate(async () => {
  const { GAME_IDS } = await import('/games/registry.js');
  const cards = [...document.querySelectorAll('.game-card')].length;
  return { ids: GAME_IDS.length, cards };
});
out.registryFolders = (() => {
  const gamesDir = path.join(root, 'games');
  const onDisk = fs
    .readdirSync(gamesDir)
    .filter((n) => !n.startsWith('_') && fs.statSync(path.join(gamesDir, n)).isDirectory());
  const missing = [];
  for (const id of onDisk) {
    for (const file of ['manifest.js', 'index.js', 'style.css', 'index.html']) {
      if (!fs.existsSync(path.join(gamesDir, id, file))) missing.push(`${id}/${file}`);
    }
  }
  return { onDisk, missing };
})();
// Each game folder also runs on its own (games/<id>/index.html), without the lobby
out.standalone = {};
for (const id of await page.evaluate(async () => (await import('/games/registry.js')).GAME_IDS)) {
  await page.goto(`${base}/games/${id}/index.html?seed=${SEED}`);
  const mounted = await page.waitForSelector('#game-stage .game-root', { timeout: 6000 }).catch(() => null);
  out.standalone[id] = Boolean(mounted) && (await page.evaluate(() => !document.querySelector('.game-card, #game-hud')));
}

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();

// Fail the run on any regression
const failures = [];
const cleared = (v) => typeof v === 'string' && v.includes('성공');
Object.entries(out.spot).forEach(([k, v]) => cleared(v) || failures.push(`spot ${k}: ${v}`));
if (!cleared(out.fortress)) failures.push(`fortress: ${out.fortress}`);
if (out.hideSeekBoxMaxLength !== '1') failures.push('answer box accepts more than one character');
if (out.resultClosable) failures.push('result modal can be dismissed');
// The clock shows whole seconds (rounded up), so a 3 s penalty can read as 3 or 4
if (![3, 4].includes(out.hideSeekWrongPenaltySec)) failures.push(`wrong answer penalty: ${out.hideSeekWrongPenaltySec}s`);
if (out.resultHasCopyButton) failures.push('result modal still shows copy / labels');
if (!out.hideSeekRules) failures.push('hide & seek symbol/number rules');
if (!/-easy$/.test(out.spotQuickStart)) failures.push(`spot quick start: ${out.spotQuickStart}`);
if (out.lobbyHasSelect) failures.push('lobby still shows a select / hall of fame / record pill');
if (out.memoryMode !== 'easy') failures.push(`memory in-game difficulty: ${out.memoryMode}`);
if (!out.hideSeekChangeDifficulty) failures.push('result "난이도 바꾸기" did not open setup');
if (!out.hideSeekSetupAgain) failures.push('lobby start skipped the hide & seek setup');
if (!out.countdownShown) failures.push('no start countdown');
if (!/^성공 · 🧮 5\/5 정답/.test(out.anzan || '')) failures.push(`flash anzan: ${out.anzan}`);
if (out.spotCardHasSelect || out.spotPresets !== 'easy,medium,hard' || !out.pickerExitNoConfirm) failures.push('spot setup flow');
if (!out.spotCafeEasyExact) failures.push('spot cafe-easy 1:1 visual/logic match');
if (!out.spotPartyMemory?.ok) failures.push(`spot party memory mode: ${JSON.stringify(out.spotPartyMemory)}`);
if (!out.dobbleMathValid || !cleared(out.dobble)) failures.push(`dobble: ${out.dobbleMathValid} / ${out.dobble}`);
if (!out.noInviteCopyBtn || !out.heroToolsInBanner || !out.compactCards) failures.push('lobby hero tools / compact cards');
if (!out.mobileHudNoOverlap?.ok) failures.push(`mobile HUD overlap or icons: ${JSON.stringify(out.mobileHudNoOverlap)}`);
if (out.resultButtons?.labels?.join(',') !== '로비,난이도 변경,재도전' || !out.resultButtons?.sameRow || !out.resultButtons?.sameSize) {
  failures.push(`resultButtons: ${JSON.stringify(out.resultButtons)}`);
}
if (!out.deterministic) failures.push('determinism');
if (out.hideSeekPresets !== 'easy,medium,hard,extreme,insane,god') failures.push('hide & seek presets');
if (!/^custom-60-40-4-20-11-60-0-0$/.test(out.hideSeekMode || '')) failures.push(`hide & seek custom mode: ${out.hideSeekMode}`);
if (out.hideSeekWaveInvariant !== 'ok') failures.push(`hide & seek wave invariant: ${out.hideSeekWaveInvariant}`);
if (!out.hideSeekRemembersLast) failures.push('hide & seek setup does not remember the last settings');
if (!cleared(out.colorTrapSolo) || !out.colorTrapParty) failures.push(`color-trap: ${out.colorTrapSolo} / party=${out.colorTrapParty}`);
if (!out.anzanParty) failures.push('flash-anzan party mode');
if (!out.pixelRevealNoOverlap || !cleared(out.pixelRevealSolo)) failures.push(`pixel-reveal: overlapOk=${out.pixelRevealNoOverlap} / ${out.pixelRevealSolo}`);
if (out.pixelRevealPool?.count !== 100 || out.pixelRevealPool?.uniqueIds !== 100 || out.pixelRevealPool?.uniqueLabels !== 100 || !out.pixelRevealPool?.allOk) {
  failures.push(`pixel-reveal pool: ${JSON.stringify(out.pixelRevealPool)}`);
}
if (!cleared(out.flashCountSolo)) failures.push(`flash-count: ${out.flashCountSolo}`);
if (!out.chrome?.hudMatchesStageWidth || !out.chrome?.noSharedTimerOrScore || !out.chrome?.gameOwnsTimer) failures.push(`game owns timer/score or width mismatch: ${JSON.stringify(out.chrome)}`);
if (!out.chrome?.fullscreenButton || !out.chrome?.layoutButtonNextToFullscreen) failures.push(`fullscreen / layout buttons: ${JSON.stringify(out.chrome)}`);
if (out.chrome?.fullscreenEntered === false || out.chrome?.fullscreenExited === false) failures.push(`fullscreen toggle: ${JSON.stringify(out.chrome)}`);
if (!out.chrome?.hidden || !out.chrome?.stageGrew || !out.chrome?.restored) failures.push(`hide / show layout: ${JSON.stringify(out.chrome)}`);
if (out.registry?.cards !== out.registry?.ids) failures.push(`registry: ${JSON.stringify(out.registry)}`);
if (out.registryFolders?.missing.length || out.registryFolders?.onDisk.length !== out.registry?.ids) failures.push(`games folders: ${JSON.stringify(out.registryFolders)}`);
if (Object.values(out.standalone || {}).some((ok) => !ok) || !Object.keys(out.standalone || {}).length) failures.push(`standalone game pages: ${JSON.stringify(out.standalone)}`);
if (out.consoleErrors.length) failures.push(`console errors: ${out.consoleErrors.length}`);
if (failures.length) {
  console.error(`\nFAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll checks passed.');
