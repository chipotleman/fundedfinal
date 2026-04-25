import { useCallback, useEffect, useRef, useState } from 'react';

export const VOICE_PROBE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

const FRESHNESS_MS = 10 * 60 * 1000;
const PROBE_TIMEOUT_MS = 8000;
const IDLE_SNAPSHOT = {
  status: VOICE_PROBE_STATUS.IDLE,
  message: '',
  details: null,
  timestamp: 0,
};

let cached = null;
const subscribers = new Set();

function publish(snap) {
  cached = snap;
  subscribers.forEach((fn) => {
    try { fn(snap); } catch (_e) {}
  });
}

function invalidate() {
  if (!cached) return;
  if (cached.status === VOICE_PROBE_STATUS.RUNNING) return;
  cached = null;
  subscribers.forEach((fn) => {
    try { fn(IDLE_SNAPSHOT); } catch (_e) {}
  });
}

if (typeof window !== 'undefined' && !window.__voiceProbeCacheBound) {
  window.__voiceProbeCacheBound = true;
  window.addEventListener('online', invalidate);
  window.addEventListener('offline', invalidate);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') invalidate();
    });
  }
}

function isFresh(snap) {
  if (!snap) return false;
  if (snap.status === VOICE_PROBE_STATUS.RUNNING) return false;
  if (snap.status === VOICE_PROBE_STATUS.IDLE) return false;
  return Date.now() - snap.timestamp < FRESHNESS_MS;
}

async function runProbeInternal() {
  if (cached && cached.status === VOICE_PROBE_STATUS.RUNNING) return;

  publish({
    status: VOICE_PROBE_STATUS.RUNNING,
    message: 'Checking your network…',
    details: null,
    timestamp: Date.now(),
  });

  if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
    publish({
      status: VOICE_PROBE_STATUS.ERROR,
      message: 'Voice chat is not supported in this browser.',
      details: null,
      timestamp: Date.now(),
    });
    return;
  }

  let iceServers;
  try {
    const resp = await fetch('/api/battles/voice/ice-servers?selfTest=1');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    iceServers = data.iceServers || [];
  } catch (_err) {
    publish({
      status: VOICE_PROBE_STATUS.ERROR,
      message: "Couldn't reach the voice chat server. Check your connection and try again.",
      details: null,
      timestamp: Date.now(),
    });
    return;
  }

  let pc;
  try {
    pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'all' });
  } catch (_err) {
    publish({
      status: VOICE_PROBE_STATUS.ERROR,
      message: 'Voice chat could not be initialized on this device.',
      details: null,
      timestamp: Date.now(),
    });
    return;
  }

  const found = { host: 0, srflx: 0, relay: 0 };
  let finished = false;
  let timeoutId = null;

  const finish = (status, message) => {
    if (finished) return;
    finished = true;
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
    try { pc.close(); } catch (_e) {}
    publish({
      status,
      message,
      details: { ...found },
      timestamp: Date.now(),
    });
  };

  const conclude = () => {
    if (found.relay > 0) {
      finish(VOICE_PROBE_STATUS.SUCCESS, 'Voice chat should work on this network.');
    } else if (found.srflx > 0 || found.host > 0) {
      finish(
        VOICE_PROBE_STATUS.WARNING,
        'Your network may block voice chat — try mobile data or a different network.',
      );
    } else {
      finish(
        VOICE_PROBE_STATUS.ERROR,
        "Couldn't gather any network candidates. Voice chat is unlikely to work here.",
      );
    }
  };

  pc.onicecandidate = (e) => {
    if (!e.candidate) { conclude(); return; }
    const type = e.candidate.type;
    if (type && found[type] !== undefined) found[type] += 1;
    if (type === 'relay') {
      finish(VOICE_PROBE_STATUS.SUCCESS, 'Voice chat should work on this network.');
    }
  };

  pc.onicegatheringstatechange = () => {
    if (pc.iceGatheringState === 'complete' && !finished) conclude();
  };

  try {
    pc.createDataChannel('probe');
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
  } catch (_err) {
    finish(VOICE_PROBE_STATUS.ERROR, 'Voice chat could not start a test connection on this device.');
    return;
  }

  timeoutId = setTimeout(conclude, PROBE_TIMEOUT_MS);
}

export default function useVoiceChatProbe() {
  const [snap, setSnap] = useState(() => cached || IDLE_SNAPSHOT);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const fn = (s) => { if (mountedRef.current) setSnap(s || IDLE_SNAPSHOT); };
    subscribers.add(fn);
    if (cached) setSnap(cached);
    return () => {
      mountedRef.current = false;
      subscribers.delete(fn);
    };
  }, []);

  const runProbe = useCallback((opts) => {
    const force = opts === true || (opts && opts.force === true);
    if (!force && isFresh(cached)) {
      if (mountedRef.current && cached) setSnap(cached);
      return;
    }
    runProbeInternal();
  }, []);

  return {
    status: snap.status,
    message: snap.message,
    details: snap.details,
    runProbe,
  };
}
