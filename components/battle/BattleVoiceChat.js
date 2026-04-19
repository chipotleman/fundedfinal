import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useMatchup } from '../../contexts/MatchupContext';
import { useVoiceChat } from '../../contexts/VoiceChatContext';
import { getBattleStreamClient } from '../../lib/battleStreamClient';

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const INVITE_TIMEOUT_MS = 30000;
const DEFAULT_ICE_CACHE_MS = 4 * 60 * 1000;

const iceServersCache = new Map(); // matchupId -> { servers, expiresAt }

async function fetchIceServers(matchupId) {
  if (!matchupId) return FALLBACK_ICE_SERVERS;
  const now = Date.now();
  const cached = iceServersCache.get(matchupId);
  if (cached && now < cached.expiresAt) {
    return cached.servers;
  }
  try {
    const resp = await fetch(
      `/api/battles/voice/ice-servers?matchupId=${encodeURIComponent(matchupId)}`,
      { credentials: 'include' },
    );
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.iceServers) && data.iceServers.length) {
        const ttlMs = Number.isFinite(data?.ttl) && data.ttl > 0
          ? Math.min(data.ttl * 1000 * 0.9, 60 * 60 * 1000)
          : DEFAULT_ICE_CACHE_MS;
        iceServersCache.set(matchupId, {
          servers: data.iceServers,
          expiresAt: now + ttlMs,
        });
        return data.iceServers;
      }
    }
  } catch (_e) {}
  return FALLBACK_ICE_SERVERS;
}

async function postSignal(type, matchupId, payload) {
  try {
    await fetch('/api/battles/voice/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type, matchupId, payload }),
    });
  } catch (_e) {}
}

export default function BattleVoiceChat() {
  const { data: session, status: authStatus } = useSession();
  const { matchup, opponent, hasActiveMatchup } = useMatchup();

  const userId = session?.user?.id;
  const matchupId = matchup?.id;
  const isAuthed = authStatus === 'authenticated' && !!userId;
  const eligible = isAuthed && hasActiveMatchup && !!matchupId && !!opponent && !matchup?.isFakeOpponent;

  // Call states: 'idle' | 'requesting' | 'inviting' | 'incoming' | 'connecting' | 'connected' | 'ended'
  const [state, setState] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [incomingSender, setIncomingSender] = useState(null);
  const [muted, setMuted] = useState(false);
  const [mySpeaking, setMySpeaking] = useState(false);
  const { oppSpeaking, setOppSpeaking } = useVoiceChat();

  const lastStateRef = useRef('idle');
  useEffect(() => { lastStateRef.current = state; }, [state]);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const isCallerRef = useRef(false);
  const pendingIceRef = useRef([]);
  const remoteDescSetRef = useRef(false);
  const inviteTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const meterRafRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const remoteAnalyserRef = useRef(null);

  const cleanupAudioMeters = useCallback(() => {
    if (meterRafRef.current) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    localAnalyserRef.current = null;
    remoteAnalyserRef.current = null;
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (_e) {}
      audioCtxRef.current = null;
    }
    setMySpeaking(false);
    setOppSpeaking(false);
  }, []);

  const teardown = useCallback((reason, opts = {}) => {
    // Best-effort: tell the opponent we're gone so their UI tears down
    // immediately instead of waiting for WebRTC disconnect/timeouts.
    // Skip when the teardown was triggered by a remote leave/decline
    // (we've already handled it) or when we were never in a call.
    if (!opts.skipNotify && matchupIdRef.current) {
      const s = lastStateRef.current;
      if (s === 'inviting' || s === 'connecting' || s === 'connected' || s === 'requesting') {
        try { postSignal('voice:leave', matchupIdRef.current); } catch (_e) {}
      }
    }
    if (inviteTimerRef.current) {
      clearTimeout(inviteTimerRef.current);
      inviteTimerRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.onicecandidate = null; pcRef.current.ontrack = null; pcRef.current.onconnectionstatechange = null; } catch (_e) {}
      try { pcRef.current.close(); } catch (_e) {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks().forEach(t => t.stop()); } catch (_e) {}
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    if (remoteAudioRef.current) {
      try { remoteAudioRef.current.srcObject = null; } catch (_e) {}
    }
    pendingIceRef.current = [];
    remoteDescSetRef.current = false;
    isCallerRef.current = false;
    cleanupAudioMeters();
    setMuted(false);
    setIncomingSender(null);
    if (reason) setStatusMessage(reason);
    setState('idle');
  }, [cleanupAudioMeters]);

  // Tear down when no longer eligible (battle ended, navigated away, etc.)
  useEffect(() => {
    if (!eligible && state !== 'idle') {
      teardown('Battle ended');
    }
  }, [eligible, state, teardown]);

  // Listen for voice events on the shared battle SSE singleton so we don't
  // open a second EventSource (which would race with the existing
  // MatchupContext / NotificationsContext subscribers).
  useEffect(() => {
    if (!isAuthed || typeof window === 'undefined') return;
    const client = getBattleStreamClient();
    if (!client) return;
    const unsubscribe = client.subscribe((ev) => {
      if (!ev?.type || !ev.type.startsWith('voice:')) return;
      if (ev.matchupId && matchupIdRef.current && ev.matchupId !== matchupIdRef.current) return;
      handleSignalRef.current && handleSignalRef.current(ev);
    });
    return unsubscribe;
  }, [isAuthed]);

  // Refs so the SSE handler always sees current values
  const matchupIdRef = useRef(matchupId);
  useEffect(() => { matchupIdRef.current = matchupId; }, [matchupId]);

  const setupAudioMeters = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;

      const makeAnalyser = (stream) => {
        if (!stream || stream.getAudioTracks().length === 0) return null;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        return analyser;
      };

      localAnalyserRef.current = makeAnalyser(localStreamRef.current);
      remoteAnalyserRef.current = makeAnalyser(remoteStreamRef.current);

      const buf = new Uint8Array(localAnalyserRef.current?.frequencyBinCount || 256);
      const tick = () => {
        const computeLevel = (analyser) => {
          if (!analyser) return 0;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          return Math.sqrt(sum / buf.length);
        };
        const localLvl = computeLevel(localAnalyserRef.current);
        const remoteLvl = computeLevel(remoteAnalyserRef.current);
        setMySpeaking(!muted && localLvl > 0.04);
        setOppSpeaking(remoteLvl > 0.04);
        meterRafRef.current = requestAnimationFrame(tick);
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch (_e) {}
  }, [muted]);

  const ensurePeer = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    const iceServers = await fetchIceServers(matchupIdRef.current);
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (e) => {
      if (e.candidate && matchupIdRef.current) {
        postSignal('voice:ice', matchupIdRef.current, { candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
      remoteStreamRef.current = stream;
      if (remoteAudioRef.current) {
        try {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        } catch (_e) {}
      }
      // (Re)build meters so we pick up the remote stream
      cleanupAudioMeters();
      setupAudioMeters();
    };
    pc.onconnectionstatechange = () => {
      const cs = pc.connectionState;
      if (cs === 'connected') {
        setState('connected');
        setStatusMessage('');
      } else if (cs === 'failed' || cs === 'closed') {
        teardown(cs === 'failed' ? 'Connection failed' : null);
      } else if (cs === 'disconnected') {
        setStatusMessage('Reconnecting...');
      }
    };
    pcRef.current = pc;
    return pc;
  }, [cleanupAudioMeters, setupAudioMeters, teardown]);

  const startLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Microphone not supported in this browser');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const handleSignal = useCallback(async (ev) => {
    const t = ev.type;
    try {
      if (t === 'voice:invite') {
        if (state !== 'idle') return;
        setIncomingSender(ev.sender || { username: opponent?.username, avatar: opponent?.avatar });
        setState('incoming');
        setStatusMessage('');
        return;
      }
      if (t === 'voice:cancel') {
        if (state === 'incoming') teardown('Caller cancelled', { skipNotify: true });
        return;
      }
      if (t === 'voice:decline') {
        if (state === 'inviting' || state === 'connecting') {
          teardown('Opponent declined', { skipNotify: true });
        }
        return;
      }
      if (t === 'voice:leave') {
        if (state !== 'idle') teardown('Opponent left the call', { skipNotify: true });
        return;
      }
      if (t === 'voice:accept') {
        // Opponent accepted — caller now creates the offer.
        if (!isCallerRef.current || !matchupIdRef.current) return;
        if (inviteTimerRef.current) { clearTimeout(inviteTimerRef.current); inviteTimerRef.current = null; }
        setState('connecting');
        setStatusMessage('Connecting...');
        const pc = await ensurePeer();
        const stream = await startLocalStream();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        setupAudioMeters();
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        await postSignal('voice:offer', matchupIdRef.current, { sdp: pc.localDescription });
        return;
      }
      if (t === 'voice:offer') {
        // Callee receives offer. We should already be in 'connecting' (after accept).
        if (!ev.payload?.sdp || !matchupIdRef.current) return;
        const pc = await ensurePeer();
        if (!localStreamRef.current) {
          const stream = await startLocalStream();
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
          setupAudioMeters();
        }
        await pc.setRemoteDescription(new RTCSessionDescription(ev.payload.sdp));
        remoteDescSetRef.current = true;
        for (const c of pendingIceRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_e) {}
        }
        pendingIceRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSignal('voice:answer', matchupIdRef.current, { sdp: pc.localDescription });
        return;
      }
      if (t === 'voice:answer') {
        if (!ev.payload?.sdp || !pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(ev.payload.sdp));
        remoteDescSetRef.current = true;
        for (const c of pendingIceRef.current) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch (_e) {}
        }
        pendingIceRef.current = [];
        return;
      }
      if (t === 'voice:ice') {
        const cand = ev.payload?.candidate;
        if (!cand) return;
        if (!pcRef.current || !remoteDescSetRef.current) {
          pendingIceRef.current.push(cand);
        } else {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)); } catch (_e) {}
        }
        return;
      }
    } catch (err) {
      console.error('voice signal handler error', err);
      teardown('Voice connection error');
    }
  }, [state, opponent, ensurePeer, startLocalStream, setupAudioMeters, teardown]);

  const handleSignalRef = useRef(handleSignal);
  useEffect(() => { handleSignalRef.current = handleSignal; }, [handleSignal]);

  const handleStartCall = useCallback(async () => {
    if (!eligible || state !== 'idle') return;
    setState('requesting');
    setStatusMessage('Requesting microphone...');
    fetchIceServers(matchupIdRef.current);
    try {
      await startLocalStream();
    } catch (err) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : err?.name === 'NotFoundError'
          ? 'No microphone found'
          : 'Could not access microphone';
      teardown(msg, { skipNotify: true });
      return;
    }
    isCallerRef.current = true;
    setState('inviting');
    setStatusMessage('Ringing opponent...');
    await postSignal('voice:invite', matchupIdRef.current);
    inviteTimerRef.current = setTimeout(() => {
      if (lastStateRef.current === 'inviting' || pcRef.current?.connectionState !== 'connected') {
        // No accept — give up.
        if (matchupIdRef.current) postSignal('voice:cancel', matchupIdRef.current);
        teardown('Opponent did not answer', { skipNotify: true });
      }
    }, INVITE_TIMEOUT_MS);
  }, [eligible, state, startLocalStream, teardown]);

  const handleAcceptIncoming = useCallback(async () => {
    if (state !== 'incoming') return;
    isCallerRef.current = false;
    setState('connecting');
    setStatusMessage('Connecting...');
    try {
      await startLocalStream();
    } catch (err) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : 'Could not access microphone';
      if (matchupIdRef.current) postSignal('voice:decline', matchupIdRef.current);
      teardown(msg, { skipNotify: true });
      return;
    }
    if (matchupIdRef.current) await postSignal('voice:accept', matchupIdRef.current);
  }, [state, startLocalStream, teardown]);

  const handleDeclineIncoming = useCallback(() => {
    if (state !== 'incoming') return;
    if (matchupIdRef.current) postSignal('voice:decline', matchupIdRef.current);
    teardown(null, { skipNotify: true });
  }, [state, teardown]);

  const handleLeave = useCallback(() => {
    // teardown will emit voice:leave for us when in an active call state.
    teardown(null);
  }, [teardown]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !muted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
  }, [muted]);

  // Auto-clear transient status messages after a few seconds
  useEffect(() => {
    if (state !== 'idle' || !statusMessage) return;
    const t = setTimeout(() => setStatusMessage(''), 5000);
    return () => clearTimeout(t);
  }, [state, statusMessage]);

  // Tear down on unmount
  useEffect(() => () => teardown(null), [teardown]);

  if (!eligible && state === 'idle' && !statusMessage) return null;

  const oppName = incomingSender?.username || opponent?.username || 'Opponent';
  const oppAvatar = incomingSender?.avatar || opponent?.avatar || null;

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Floating Voice button — shown when eligible and idle */}
      {eligible && state === 'idle' && (
        <button
          onClick={handleStartCall}
          className="fixed z-[55] flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg transition-all"
          style={{
            right: '16px',
            bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#fff',
            border: '1px solid rgba(96,165,250,0.5)',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
          }}
          title={`Voice chat with ${oppName}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider">Voice</span>
        </button>
      )}

      {/* Status toast for failure / informational messages */}
      {state === 'idle' && statusMessage && (
        <div
          className="fixed z-[70] left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium text-white shadow-lg"
          style={{
            bottom: 'calc(120px + env(safe-area-inset-bottom, 0px))',
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid #333',
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Incoming call modal */}
      {state === 'incoming' && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleDeclineIncoming} />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 text-center"
            style={{ background: '#0a0a0a', border: '1px solid #2563eb', boxShadow: '0 0 40px rgba(37,99,235,0.4)' }}
          >
            <style>{`
              @keyframes voice-ring { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37,99,235,0.6); } 50% { transform: scale(1.05); box-shadow: 0 0 0 16px rgba(37,99,235,0); } }
              .voice-ring-pulse { animation: voice-ring 1.4s ease-in-out infinite; }
            `}</style>
            <div className="flex flex-col items-center">
              <div
                className="w-20 h-20 rounded-full overflow-hidden mb-3 voice-ring-pulse flex items-center justify-center"
                style={{ background: '#111', border: '3px solid #2563eb' }}
              >
                {oppAvatar ? (
                  <img src={oppAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-white">{(oppName[0] || '?').toUpperCase()}</span>
                )}
              </div>
              <p className="text-white text-base font-bold">{oppName}</p>
              <p className="text-blue-400 text-xs uppercase tracking-wider mt-1">Incoming voice call</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={handleDeclineIncoming}
                className="py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#dc2626' }}
              >
                Decline
              </button>
              <button
                onClick={handleAcceptIncoming}
                className="py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#16a34a' }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-call / connecting / inviting widget */}
      {(state === 'inviting' || state === 'connecting' || state === 'connected' || state === 'requesting') && (
        <div
          className="fixed z-[60] rounded-2xl px-3 py-2 flex items-center gap-3 shadow-lg"
          style={{
            right: '16px',
            bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            background: 'rgba(10,10,10,0.95)',
            border: '1px solid #1f2937',
            backdropFilter: 'blur(8px)',
            minWidth: 240,
          }}
        >
          <div
            className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{
              background: '#111',
              border: `2px solid ${oppSpeaking ? '#22c55e' : '#374151'}`,
              transition: 'border-color 120ms ease',
            }}
          >
            {oppAvatar ? (
              <img src={oppAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-black text-white">{(oppName[0] || '?').toUpperCase()}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold truncate">{oppName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: state === 'connected' ? '#22c55e' : state === 'connecting' ? '#facc15' : '#3b82f6',
                  animation: state !== 'connected' ? 'voice-ring 1.4s ease-in-out infinite' : 'none',
                }}
              />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">
                {state === 'inviting' ? 'Ringing...' : state === 'connecting' ? 'Connecting...' : state === 'requesting' ? 'Mic...' : 'Connected'}
              </span>
              {state === 'connected' && mySpeaking && (
                <span className="text-[10px] text-green-400 font-bold">• You</span>
              )}
            </div>
          </div>

          {state === 'connected' && (
            <button
              onClick={toggleMute}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: muted ? '#dc2626' : '#1f2937',
                color: '#fff',
              }}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zM14.98 11.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              )}
            </button>
          )}

          <button
            onClick={handleLeave}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: '#dc2626', color: '#fff' }}
            title="Leave call"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
