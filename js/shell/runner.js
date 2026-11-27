/**
 * Game lifecycle: builds the `ctx` handed to a game, mounts/unmounts it, runs the 3·2·1 start
 * countdown and the pause curtain, and opens the result popup. It knows nothing about the lobby,
 * the URL or the shell bar, which keeps it reusable by the standalone game pages.
 */
import { createRng } from '../core/seed.js';
import * as audio from '../core/audio.js';
import * as storage from '../core/storage.js';
import * as ui from '../core/ui.js';
import { importGameModule, resolveMode } from './registry.js';
import { openResultModal } from './result-modal.js';

const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 900;
const COUNTDOWN_GO_MS = 650;

function createOverlays(view) {
  const countdown = document.createElement('div');
  countdown.id = 'stage-countdown';
  countdown.className = 'stage-countdown';
  countdown.hidden = true;
  countdown.setAttribute('aria-live', 'assertive');
  countdown.innerHTML = `
    <p class="stage-countdown__label">준비</p>
    <div class="stage-countdown__circle"><span data-countdown-num>3</span></div>
  `;

  const curtain = document.createElement('div');
  curtain.id = 'pause-curtain';
  curtain.className = 'pause-curtain';
  curtain.hidden = true;
  curtain.innerHTML = `
    <div class="pause-curtain__card">
      <p class="pause-curtain__sub">PAUSED // FAIR PLAY LOCK</p>
      <h2 class="pause-curtain__title">잠깐 쉬는 중!</h2>
      <p class="pause-curtain__desc">공정한 플레이를 위해 화면이 가려졌습니다.</p>
      <button type="button" class="btn-neon-primary" data-resume>▶ 미션 재개</button>
    </div>
  `;

  view.append(countdown, curtain);
  return { countdown, countdownNum: countdown.querySelector('[data-countdown-num]'), curtain };
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.view   element that hosts the overlays (position: relative)
 * @param {HTMLElement} opts.stage  element the game mounts into
 * @param {object} [opts.hooks]
 * @param {(entry: object) => void} [opts.hooks.onEnter]       a game/chooser was mounted
 * @param {(paused: boolean) => void} [opts.hooks.onPauseChange]
 * @param {(entry: object) => void} [opts.hooks.onFinish]      the run ended (result popup opens)
 * @param {(gameId: string, mode: string) => void} [opts.hooks.onRelaunch]  retry / switchMode
 * @param {() => void} [opts.hooks.onExit]                     player asked to leave the game
 */
export function createRunner({ view, stage, hooks = {} }) {
  const overlays = createOverlays(view);
  let active = null;
  let runCounter = 0;
  let countdownTimer = 0;
  let pauseListeners = new Set();

  const emitPause = (paused) => pauseListeners.forEach((fn) => fn(paused));

  function stopCountdown() {
    window.clearTimeout(countdownTimer);
    countdownTimer = 0;
    overlays.countdown.hidden = true;
    overlays.countdown.classList.remove('is-go');
    overlays.countdownNum.classList.remove('is-tick', 'is-go');
  }

  /** 3·2·1 before every real run: the game is mounted but held paused under an opaque overlay. */
  function runCountdown(entry) {
    const num = overlays.countdownNum;
    entry.countdown = true;
    emitPause(true);
    overlays.countdown.hidden = false;
    let n = COUNTDOWN_FROM;

    const restartAnimation = (cls) => {
      num.classList.remove('is-tick', 'is-go');
      void num.offsetWidth;
      num.classList.add(cls);
    };

    const tick = () => {
      if (active !== entry) return stopCountdown();
      if (entry.paused) {
        countdownTimer = window.setTimeout(tick, 200);
        return undefined;
      }
      if (n === 0) {
        num.textContent = 'Go!';
        overlays.countdown.classList.add('is-go');
        restartAnimation('is-go');
        entry.countdown = false;
        audio.playHint();
        emitPause(false);
        countdownTimer = window.setTimeout(stopCountdown, COUNTDOWN_GO_MS);
        return undefined;
      }
      num.textContent = String(n);
      restartAnimation('is-tick');
      audio.playTick();
      n -= 1;
      countdownTimer = window.setTimeout(tick, COUNTDOWN_STEP_MS);
      return undefined;
    };
    tick();
  }

  function setPaused(paused) {
    if (!active || active.finished) return;
    const next = Boolean(paused);
    if (active.paused === next) return;
    active.paused = next;
    overlays.curtain.hidden = !next;
    hooks.onPauseChange?.(next);
    // While the start countdown runs the game stays frozen; the countdown releases it
    if (!next && active.countdown) return;
    emitPause(next);
  }

  function unmount() {
    stopCountdown();
    if (!active) return;
    try {
      active.instance?.unmount?.();
    } catch (err) {
      console.error('Error during game unmount:', err);
    }
    active = null;
    pauseListeners = new Set();
    stage.replaceChildren();
    overlays.curtain.hidden = true;
  }

  function buildContext(entry, game, seed) {
    const player = storage.getProfile();
    const isCurrent = () => active === entry;

    return {
      seed,
      mode: entry.mode,
      player,
      rng: createRng(`${seed}::${game.id}::${entry.mode}`),
      audio,
      ui,
      storage,
      /** Subscribes to pause / resume (pause button, hidden tab, start countdown). */
      onPause(fn) {
        pauseListeners.add(fn);
        return () => pauseListeners.delete(fn);
      },
      completeGame({ score = 0, timeMs = 0, cleared = true, modeLabel, details = [] } = {}) {
        if (!isCurrent() || entry.finished) return;
        entry.finished = true;
        overlays.curtain.hidden = true;
        hooks.onFinish?.(entry);

        const result = {
          score: Math.max(0, Math.round(Number(score) || 0)),
          timeMs: Math.max(0, Math.round(Number(timeMs) || 0)),
        };
        const label = modeLabel || entry.modeLabel;
        const grade = ui.calculateGrade(result.score, { cleared });
        const { isNewRecord } = storage.recordRun({ gameId: game.id, mode: entry.mode, cleared, ...result });

        if (cleared) {
          audio.playClear();
          if (grade === 'S' || grade === 'A') ui.launchConfetti(grade);
        } else {
          audio.playAlarm();
        }

        openResultModal({
          title: `${game.title} (${label})`,
          score: result.score,
          timeMs: result.timeMs,
          cleared,
          isNewRecord,
          details,
          actions: {
            onLobby: () => hooks.onExit?.(),
            onChangeLevel: () => hooks.onRelaunch?.(game.id, game.defaultMode),
            onRetry: () => hooks.onRelaunch?.(game.id, entry.mode),
          },
        });
      },
      /** Relaunches this game in another mode (setup screens and pickers use this). */
      switchMode(nextMode) {
        if (isCurrent()) hooks.onRelaunch?.(game.id, nextMode);
      },
      exitToHub() {
        if (isCurrent()) hooks.onExit?.();
      },
    };
  }

  /**
   * Mounts `game` in `modeId` (falling back to its default mode) for the given room seed.
   * @returns {Promise<{ mode: string, modeLabel: string } | null>} null when the mount failed
   */
  async function launch(game, modeId, seed) {
    unmount();
    ui.closeModal(true);

    const { id: mode, label: modeLabel } = resolveMode(game, modeId);
    runCounter += 1;
    const entry = { id: game.id, mode, modeLabel, instance: null, finished: false, paused: false, countdown: false, idle: false, token: runCounter };
    active = entry;
    hooks.onEnter?.(entry);

    try {
      const mod = await importGameModule(game.id);
      if (active !== entry) return null;
      if (typeof mod.mount !== 'function') throw new Error(`games/${game.id}/index.js does not export mount()`);
      entry.instance = mod.mount(stage, buildContext(entry, game, seed));
      // Choosers (setup / picker screens) have no run to lose: no exit confirm, no pause
      entry.idle = Boolean(entry.instance?.idle);
      hooks.onMounted?.(entry);
      if (!entry.idle) runCountdown(entry);
      return { mode, modeLabel };
    } catch (err) {
      console.error(`Failed to mount game "${game.id}":`, err);
      ui.showToast('게임 모듈을 불러오는 중 오류가 발생했습니다.', 'error');
      hooks.onExit?.();
      return null;
    }
  }

  overlays.curtain.querySelector('[data-resume]').addEventListener('click', () => {
    audio.playClick();
    setPaused(false);
  });

  // Fair play: leaving the tab pauses (and hides) a running game
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && active && !active.finished && !active.idle) setPaused(true);
  });

  return {
    launch,
    unmount,
    setPaused,
    togglePause: () => active && setPaused(!active.paused),
    get active() {
      return active;
    },
  };
}
