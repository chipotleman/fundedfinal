import { useEffect, useRef } from 'react';
import { triggerHaptic } from '../utils/haptics';

const HAPTIC_KEY = 'piks_lead_cue_haptics';
const SOUND_KEY = 'piks_lead_cue_sound';
const QUIET_KEY = 'piks_quiet_mode';
const COOLDOWN_MS = 30_000;

function readPref(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'on' || v === 'true' || v === '1';
  } catch {
    return fallback;
  }
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function tryVibrate() {
  // Delegates to the shared haptics util so we get the iOS Safari 18+
  // checkbox-switch workaround for free in addition to the Vibration API.
  try {
    return triggerHaptic('tap');
  } catch {
    return false;
  }
}

function playBlip(audioCtxRef) {
  if (typeof window === 'undefined') return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  try {
    if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // Silently swallow audio errors so cues never break the page.
  }
}

/**
 * Fires a brief haptic and/or audio cue when a tracked game's leader flips
 * on the close-games rail.
 *
 * `leadChanges` is the same `{ [gameId]: timestamp }` map produced in
 * `pages/index.js`. We only fire for entries whose timestamp is newer than
 * the last one we've already cued for that game (with a per-game cooldown
 * to prevent rapid-fire repeats during ties going back and forth).
 */
export default function useLeadChangeCue(leadChanges) {
  const lastFiredRef = useRef(new Map());
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (!leadChanges || typeof leadChanges !== 'object') return;
    const entries = Object.entries(leadChanges);
    if (entries.length === 0) return;

    if (prefersReducedMotion()) return;
    if (readPref(QUIET_KEY, false)) return;

    const hapticsOn = readPref(HAPTIC_KEY, true);
    const soundOn = readPref(SOUND_KEY, false);
    if (!hapticsOn && !soundOn) return;

    const now = Date.now();
    let fired = false;
    for (const [gameId, ts] of entries) {
      if (typeof ts !== 'number') continue;
      const last = lastFiredRef.current.get(gameId) || 0;
      // The state map keeps each event's original detection timestamp, so we
      // only fire when it's both fresh (within the highlight window) and
      // outside the cooldown since our last cue for this same game.
      if (ts <= last) continue;
      if (now - last < COOLDOWN_MS) continue;
      if (now - ts > COOLDOWN_MS) continue;

      if (hapticsOn) tryVibrate();
      if (soundOn && !fired) playBlip(audioCtxRef);
      lastFiredRef.current.set(gameId, now);
      fired = true;
    }

    // Drop bookkeeping for games that have aged out of the map entirely so
    // it can't grow unbounded over a long session.
    const live = new Set(entries.map(([id]) => id));
    for (const id of Array.from(lastFiredRef.current.keys())) {
      if (!live.has(id) && now - lastFiredRef.current.get(id) > COOLDOWN_MS * 4) {
        lastFiredRef.current.delete(id);
      }
    }
  }, [leadChanges]);
}

export const LEAD_CUE_STORAGE_KEYS = {
  HAPTIC_KEY,
  SOUND_KEY,
  QUIET_KEY,
};
