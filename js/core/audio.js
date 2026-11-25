/**
 * Pure Web Audio API retro arcade synthesizer with persistent mute state.
 * Safely no-ops if muted or AudioContext is unavailable.
 */
import { getMuted, setMutedFlag } from './storage.js';

let audioCtx = null;
let masterGain = null;
let mutedState = getMuted();

function ensureContext() {
  if (mutedState) return null;
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;

  try {
    if (!audioCtx) {
      audioCtx = new AudioCtor();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(mutedState ? 0 : 0.75, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone({ type = 'sine', startFreq, endFreq, duration, gain = 0.14, delay = 0 }) {
  const ctx = ensureContext();
  if (!ctx || !masterGain) return;
  try {
    const t0 = ctx.currentTime + delay;
    const t1 = t0 + duration;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t0);
    if (endFreq && endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t1);
    }

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.01, duration * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(env);
    env.connect(masterGain);
    osc.start(t0);
    osc.stop(t1 + 0.01);
  } catch {
    // Safe no-op
  }
}

/**
 * Crisp 18ms UI tap (triangle 660Hz -> 440Hz).
 */
export function playClick() {
  playTone({ type: 'triangle', startFreq: 660, endFreq: 440, duration: 0.018, gain: 0.1 });
}

/**
 * 70ms card whoosh/flip (filtered noise + sine sweep 280->520Hz).
 */
export function playFlip() {
  const ctx = ensureContext();
  if (!ctx || !masterGain) return;
  try {
    const t0 = ctx.currentTime;
    const dur = 0.07;

    // Sine sweep
    playTone({ type: 'sine', startFreq: 280, endFreq: 520, duration: dur, gain: 0.09 });

    // Short filtered noise burst
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t0);
    filter.Q.setValueAtTime(1.8, t0);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.08, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    noise.connect(filter);
    filter.connect(env);
    env.connect(masterGain);
    noise.start(t0);
    noise.stop(t0 + dur + 0.005);
  } catch {
    // Safe no-op
  }
}

const PENTATONIC_HZ = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

/**
 * Rising pentatonic ping; pitch scales with combo (capped at combo=6).
 * @param {number} [combo=1]
 */
export function playMatch(combo = 1) {
  const idx = Math.max(0, Math.min(5, Math.floor(combo) - 1));
  const root = PENTATONIC_HZ[idx];
  playTone({ type: 'triangle', startFreq: root, endFreq: root * 1.25, duration: 0.14, gain: 0.16 });
  playTone({ type: 'sine', startFreq: root * 1.5, endFreq: root * 1.5, duration: 0.16, gain: 0.08, delay: 0.045 });
}

/**
 * 160ms low sawtooth buzz (150Hz -> 110Hz), soft gain.
 */
export function playError() {
  playTone({ type: 'sawtooth', startFreq: 150, endFreq: 110, duration: 0.16, gain: 0.09 });
}

/**
 * 220ms dual-tone radar chime (880Hz + 1320Hz).
 */
export function playHint() {
  playTone({ type: 'sine', startFreq: 880, endFreq: 880, duration: 0.16, gain: 0.12 });
  playTone({ type: 'sine', startFreq: 1320, endFreq: 1320, duration: 0.22, gain: 0.1, delay: 0.06 });
}

/**
 * 35ms sharp woodblock/clock tick (1000Hz) for final 10s / memorize countdown.
 */
export function playTick() {
  playTone({ type: 'triangle', startFreq: 1000, endFreq: 680, duration: 0.035, gain: 0.1 });
}

/**
 * 4-note bright arcade victory arpeggio (C5-E5-G5-C6).
 */
export function playClear() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    playTone({
      type: 'triangle',
      startFreq: freq,
      endFreq: freq,
      duration: i === 3 ? 0.34 : 0.14,
      gain: 0.16,
      delay: i * 0.085,
    });
  });
}

/**
 * Urgent double-pulse descending siren (520Hz->260Hz x2) for blackout/fail.
 */
export function playAlarm() {
  playTone({ type: 'sawtooth', startFreq: 520, endFreq: 260, duration: 0.17, gain: 0.11, delay: 0 });
  playTone({ type: 'sawtooth', startFreq: 520, endFreq: 260, duration: 0.2, gain: 0.11, delay: 0.2 });
}

/**
 * Persists mute flag and immediately silences/restores master gain.
 * @param {boolean} bool
 */
export function setMuted(bool) {
  mutedState = Boolean(bool);
  setMutedFlag(mutedState);
  try {
    if (audioCtx && masterGain) {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setValueAtTime(mutedState ? 0 : 0.75, audioCtx.currentTime);
    }
  } catch {
    // Safe no-op
  }
}

/**
 * @returns {boolean}
 */
export function isMuted() {
  return mutedState;
}
