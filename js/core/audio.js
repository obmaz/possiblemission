/**
 * Web Audio synthesizer for all sound effects (no audio files) with a persistent mute flag.
 * Every call is a safe no-op when muted or when the browser has no AudioContext.
 */
import { getMuted, setMutedFlag } from './storage.js';

const MASTER_VOLUME = 0.75;
const PENTATONIC_HZ = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

let audioCtx = null;
let masterGain = null;
let noiseBuffer = null;
let mutedState = getMuted();

function ensureContext() {
  if (mutedState) return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  try {
    if (!audioCtx) {
      audioCtx = new AudioCtor();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(MASTER_VOLUME, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone({ type = 'sine', startFreq, endFreq = startFreq, duration, gain = 0.14, delay = 0 }) {
  const ctx = ensureContext();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + delay;
    const t1 = t0 + duration;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t0);
    if (endFreq !== startFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t1);

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.01, duration * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(env);
    env.connect(masterGain);
    osc.start(t0);
    osc.stop(t1 + 0.01);
  } catch {
    // A failed effect must never break the game
  }
}

/** One decaying noise burst, built once and reused by every card flip. */
function getNoiseBuffer(ctx, seconds) {
  if (!noiseBuffer) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  return noiseBuffer;
}

export const playClick = () => playTone({ type: 'triangle', startFreq: 660, endFreq: 440, duration: 0.018, gain: 0.1 });

/** Card whoosh: a sine sweep over a short band-passed noise burst. */
export function playFlip() {
  const ctx = ensureContext();
  if (!ctx) return;
  const duration = 0.07;
  playTone({ type: 'sine', startFreq: 280, endFreq: 520, duration, gain: 0.09 });
  try {
    const t0 = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx, duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t0);
    filter.Q.setValueAtTime(1.8, t0);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.08, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    noise.connect(filter);
    filter.connect(env);
    env.connect(masterGain);
    noise.start(t0);
    noise.stop(t0 + duration + 0.005);
  } catch {
    // A failed effect must never break the game
  }
}

/** Rising pentatonic ping; the pitch climbs with the combo (capped at 6). */
export function playMatch(combo = 1) {
  const root = PENTATONIC_HZ[Math.max(0, Math.min(PENTATONIC_HZ.length - 1, Math.floor(combo) - 1))];
  playTone({ type: 'triangle', startFreq: root, endFreq: root * 1.25, duration: 0.14, gain: 0.16 });
  playTone({ startFreq: root * 1.5, duration: 0.16, gain: 0.08, delay: 0.045 });
}

export const playError = () => playTone({ type: 'sawtooth', startFreq: 150, endFreq: 110, duration: 0.16, gain: 0.09 });

export function playHint() {
  playTone({ startFreq: 880, duration: 0.16, gain: 0.12 });
  playTone({ startFreq: 1320, duration: 0.22, gain: 0.1, delay: 0.06 });
}

/** Short woodblock tick for the last seconds and countdowns. */
export const playTick = () => playTone({ type: 'triangle', startFreq: 1000, endFreq: 680, duration: 0.035, gain: 0.1 });

/** Victory arpeggio (C5-E5-G5-C6). */
export function playClear() {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    playTone({ type: 'triangle', startFreq: freq, duration: i === 3 ? 0.34 : 0.14, gain: 0.16, delay: i * 0.085 });
  });
}

/** Failure siren: two descending pulses. */
export function playAlarm() {
  playTone({ type: 'sawtooth', startFreq: 520, endFreq: 260, duration: 0.17, gain: 0.11 });
  playTone({ type: 'sawtooth', startFreq: 520, endFreq: 260, duration: 0.2, gain: 0.11, delay: 0.2 });
}

/** Persists the mute flag; effects already queued are silenced right away. */
export function setMuted(muted) {
  mutedState = Boolean(muted);
  setMutedFlag(mutedState);
  try {
    if (audioCtx) {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setValueAtTime(mutedState ? 0 : MASTER_VOLUME, audioCtx.currentTime);
    }
  } catch {
    // Nothing to silence
  }
}

export const isMuted = () => mutedState;
