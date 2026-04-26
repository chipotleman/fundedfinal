import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { formatSeenAgo } from '../../utils/relativeTime';
import ActiveStatus, { isUserOnline } from '../ActiveStatus';
import UserAvatar, { UserNameLink } from '../UserAvatar';
import { useMatchup } from '../../contexts/MatchupContext';

const ACTIVE_BATTLE_BLOCK_MESSAGE = "You're already in a battle — finish it before inviting someone else.";

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// Local Avatar wrapper kept as a thin alias so older call sites continue to
// work; under the hood it renders the new shared UserAvatar with deterministic
// colored initials and optional profile linking.
function Avatar(props) {
  return <UserAvatar {...props} />;
}

// Scroll only the inner chat container — never call scrollIntoView, which can
// scroll the outer page if the chat body isn't itself the nearest scrollable
// ancestor. This fixes the long-standing scroll-hijack bug.
function scrollToBottom(scrollEl) {
  if (!scrollEl) return;
  scrollEl.scrollTop = scrollEl.scrollHeight;
}

const MAX_VOICE_MS = 60000;

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function VoiceBubble({ url, durationMs, mine }) {
  return (
    <div className="flex items-center gap-2">
      <audio
        controls
        preload="metadata"
        src={url}
        style={{ height: 32, maxWidth: 200 }}
      />
      <span
        className="text-[10px] tabular-nums"
        style={{ color: mine ? 'rgba(255,255,255,0.85)' : '#9ca3af' }}
      >
        {formatDuration(durationMs)}
      </span>
    </div>
  );
}

const WAVEFORM_BAR_COUNT = 36;

// Custom waveform-style scrubber for the voice preview row, replacing the
// browser's default <audio controls> element. We decode the recorded blob in
// an AudioContext to extract per-bar peaks, then render the same kind of
// vertical bars used by the live recording level meter so the preview UI
// feels visually consistent with the recording UI.
function VoiceWaveformPreview({ blob, url, durationMs }) {
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const [peaks, setPeaks] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const totalMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;

  // Decode the blob into a small array of normalized amplitudes that we use
  // to size each bar. If decoding fails (e.g. unsupported codec on Safari)
  // we fall back to a flat baseline so the UI still renders something.
  useEffect(() => {
    if (!blob) { setPeaks(null); return undefined; }
    let cancelled = false;
    let ctx = null;
    (async () => {
      try {
        const Ctx = typeof window !== 'undefined'
          ? (window.AudioContext || window.webkitAudioContext)
          : null;
        if (!Ctx) { if (!cancelled) setPeaks(new Array(WAVEFORM_BAR_COUNT).fill(0.4)); return; }
        const arrBuf = await blob.arrayBuffer();
        ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(arrBuf.slice(0));
        if (cancelled) return;
        const channel = decoded.getChannelData(0);
        const samplesPerBar = Math.max(1, Math.floor(channel.length / WAVEFORM_BAR_COUNT));
        const out = new Array(WAVEFORM_BAR_COUNT).fill(0);
        let max = 0;
        for (let b = 0; b < WAVEFORM_BAR_COUNT; b++) {
          let peak = 0;
          const start = b * samplesPerBar;
          const end = Math.min(channel.length, start + samplesPerBar);
          for (let i = start; i < end; i++) {
            const v = Math.abs(channel[i]);
            if (v > peak) peak = v;
          }
          out[b] = peak;
          if (peak > max) max = peak;
        }
        const norm = max > 0 ? out.map((v) => Math.min(1, (v / max) * 1.1)) : out;
        if (!cancelled) setPeaks(norm);
      } catch {
        if (!cancelled) setPeaks(new Array(WAVEFORM_BAR_COUNT).fill(0.4));
      } finally {
        if (ctx) { try { await ctx.close(); } catch {} }
      }
    })();
    return () => { cancelled = true; };
  }, [blob]);

  // Reset transport state when a new blob comes in (e.g. after re-record).
  useEffect(() => {
    setPlaying(false);
    setCurrentMs(0);
  }, [url]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      try { a.pause(); } catch {}
    } else {
      // If we ended previously, rewind so play resumes from the start.
      if (totalMs > 0 && currentMs >= totalMs - 50) {
        try { a.currentTime = 0; } catch {}
        setCurrentMs(0);
      }
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  };

  const seekFromClientX = (clientX) => {
    const a = audioRef.current;
    const track = trackRef.current;
    if (!a || !track || totalMs <= 0) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const ms = ratio * totalMs;
    try { a.currentTime = ms / 1000; } catch {}
    setCurrentMs(ms);
  };

  // Drag-to-scrub via Pointer Events: a single press seeks (just like the
  // previous click handler), and any subsequent movement before release keeps
  // updating the playback position in real time. setPointerCapture means we
  // keep getting events even when the finger/cursor leaves the bar.
  const draggingRef = useRef(false);

  const handlePointerDown = (e) => {
    if (totalMs <= 0) return;
    // Only react to the primary mouse button (or touch/pen presses, which
    // report button === 0 too). Skip right-clicks etc.
    if (e.button !== undefined && e.button !== 0) return;
    const track = trackRef.current;
    if (track && typeof track.setPointerCapture === 'function') {
      try { track.setPointerCapture(e.pointerId); } catch {}
    }
    draggingRef.current = true;
    seekFromClientX(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    // Prevent the browser from interpreting the gesture as a scroll/swipe
    // while we're actively scrubbing.
    if (e.cancelable) e.preventDefault();
    seekFromClientX(e.clientX);
  };

  const endDrag = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const track = trackRef.current;
    if (track && typeof track.releasePointerCapture === 'function') {
      try { track.releasePointerCapture(e.pointerId); } catch {}
    }
    seekFromClientX(e.clientX);
  };

  const handleTrackKeyDown = (e) => {
    const a = audioRef.current;
    if (!a || totalMs <= 0) return;
    const step = Math.max(250, totalMs * 0.05);
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = Math.max(0, currentMs - step);
      try { a.currentTime = next / 1000; } catch {}
      setCurrentMs(next);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = Math.min(totalMs, currentMs + step);
      try { a.currentTime = next / 1000; } catch {}
      setCurrentMs(next);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      togglePlay();
    }
  };

  const progress = totalMs > 0 ? Math.min(1, Math.max(0, currentMs / totalMs)) : 0;
  const displayMs = playing || currentMs > 0
    ? Math.max(0, totalMs - currentMs)
    : totalMs;
  const bars = peaks ?? new Array(WAVEFORM_BAR_COUNT).fill(0.25);

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentMs(totalMs); }}
        onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pause voice preview' : 'Play voice preview'}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white"
        style={{
          backgroundColor: '#3b82f6',
          boxShadow: '0 0 10px rgba(59,130,246,0.5)',
        }}
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <rect x="2.5" y="2" width="2.5" height="8" rx="0.5" />
            <rect x="7" y="2" width="2.5" height="8" rx="0.5" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M3 1.6 L10 6 L3 10.4 Z" />
          </svg>
        )}
      </button>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleTrackKeyDown}
        role="slider"
        aria-label="Voice preview scrubber"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, Math.round(totalMs))}
        aria-valuenow={Math.round(currentMs)}
        tabIndex={0}
        className="flex items-center gap-[2px] h-8 cursor-pointer min-w-0 flex-1 outline-none"
        // touch-action: none keeps the browser from stealing horizontal drags
        // for page scroll/back-swipe while the user is scrubbing.
        style={{ touchAction: 'none' }}
      >
        {bars.map((p, i) => {
          const h = Math.max(2, Math.round(p * 24));
          const played = (i + 0.5) / WAVEFORM_BAR_COUNT <= progress;
          return (
            <span
              key={i}
              className="block rounded-sm"
              style={{
                width: 2,
                height: `${h}px`,
                backgroundColor: played ? '#3b82f6' : 'rgba(96,165,250,0.35)',
                transition: 'background-color 60ms linear',
              }}
            />
          );
        })}
      </div>
      <span
        className="text-[10px] tabular-nums flex-shrink-0"
        style={{ color: '#9ca3af' }}
      >
        {formatDuration(displayMs)}
      </span>
    </div>
  );
}

export function ConversationThread({ friend, ctx, myId, onStartBattle }) {
  const { hasActiveMatchup } = useMatchup();
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  // True only when the most recent pause came from the auto-pause-on-hidden
  // effect, so we can show a one-line "we paused for you" hint without the
  // user wondering whether something broke. Manual Pause taps leave this
  // false so the hint stays out of the way.
  const [autoPaused, setAutoPaused] = useState(false);
  const [pauseSupported, setPauseSupported] = useState(true);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [voiceError, setVoiceError] = useState(null);
  const LEVEL_BAR_COUNT = 18;
  const [audioLevels, setAudioLevels] = useState(() => new Array(LEVEL_BAR_COUNT).fill(0));
  const [voicePreview, setVoicePreview] = useState(null);
  // True when the preview is backed by a still-alive (paused) MediaRecorder so
  // the user can tap "Continue" to resume the same take instead of starting
  // over. False when the take was finalized via a full stop (no resume path).
  const [resumableTake, setResumableTake] = useState(false);
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStartRef = useRef(0);
  // Accumulated elapsed ms from previously-completed segments (i.e. the time
  // captured before the current pause/resume cycle). The visible elapsed time
  // is this plus the current segment's running time.
  const recordAccumRef = useRef(0);
  const recordPausedRef = useRef(false);
  const recordTimerRef = useRef(null);
  const recordCancelledRef = useRef(false);
  const recordMimeRef = useRef('audio/webm');
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioRafRef = useRef(null);
  const scrollRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const lastTypingFriendRef = useRef(null);
  const inputRef = useRef(null);
  const isTyping = !!friend?.id && ctx.typingSenderIds?.has?.(friend.id);

  useEffect(() => {
    if (!friend?.id) return undefined;
    const key = `message:${friend.id}`;
    ctx.setSuppress?.(key, true);
    return () => ctx.setSuppress?.(key, false);
  }, [friend?.id, ctx]);

  useEffect(() => {
    if (!friend?.id) return undefined;
    let cancelled = false;
    let timer = null;

    const fetchThread = async ({ initial }) => {
      if (initial) { setLoading(true); setLoadError(null); }
      try {
        const res = await fetch(`/api/messages?friendId=${friend.id}`, { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled && initial) {
            setLoadError(res.status === 403 ? 'You can only message friends.' : 'Could not load messages.');
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const next = data.messages || [];
        setThread((prev) => {
          const prevIds = new Set(prev.map((m) => m.id));
          const incomingFromFriend = next.some(
            (m) => !prevIds.has(m.id) && m.senderId === friend.id
          );
          if (incomingFromFriend) ctx.clearTyping?.(friend.id);
          return next;
        });
      } catch {
        if (!cancelled && initial) setLoadError('Could not load messages.');
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };

    fetchThread({ initial: true });
    timer = setInterval(() => fetchThread({ initial: false }), 5000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchThread({ initial: false });
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [friend?.id]);

  useEffect(() => {
    if (!friend?.id || typeof window === 'undefined') return undefined;
    const handler = (e) => {
      const m = e?.detail;
      if (!m || !m.id) return;
      const fromFriend = m.senderId === friend.id && (myId == null || m.receiverId === myId);
      const fromMeToFriend = myId != null && m.senderId === myId && m.receiverId === friend.id;
      if (!fromFriend && !fromMeToFriend) return;
      setThread((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      if (fromFriend) ctx.clearTyping?.(friend.id);
    };
    window.addEventListener('piks:message:new', handler);
    return () => window.removeEventListener('piks:message:new', handler);
  }, [friend?.id, myId, ctx]);

  // Scroll the *inner* container only. Never use scrollIntoView (which can
  // scroll the outer page when the chat body isn't the nearest scrollable
  // ancestor or fits within the viewport).
  useEffect(() => {
    scrollToBottom(scrollRef.current);
  }, [thread, loading]);

  useEffect(() => {
    // If we were broadcasting typing in a previous chat, send a stop ping so
    // the previous friend's open thread clears their indicator immediately
    // instead of waiting for the TTL to expire.
    const prevTypingFriend = lastTypingFriendRef.current;
    if (prevTypingFriend && prevTypingFriend !== friend?.id) {
      ctx.notifyStoppedTyping?.(prevTypingFriend);
    }
    lastTypingSentRef.current = 0;
    lastTypingFriendRef.current = null;
    setReply('');
    setSendError(null);
    inputRef.current?.focus();
  }, [friend?.id]);

  // On unmount (navigating away from the messenger entirely, closing the
  // panel, etc.) make sure we tell the friend we stopped typing so their
  // indicator doesn't linger for the full TTL. ctxRef avoids re-running
  // the cleanup on every context value identity change.
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; }, [ctx]);
  useEffect(() => {
    return () => {
      const f = lastTypingFriendRef.current;
      if (f) {
        ctxRef.current?.notifyStoppedTyping?.(f);
        lastTypingFriendRef.current = null;
      }
    };
  }, []);

  const handleReplyChange = (e) => {
    const v = e.target.value;
    const prev = reply;
    setReply(v);
    if (sendError) setSendError(null);
    if (voiceError) setVoiceError(null);
    if (!friend?.id) return;
    // Clearing the input after typing — proactively tell the friend we
    // stopped so their indicator clears immediately rather than after TTL.
    if (!v.trim()) {
      if (prev.trim() && lastTypingFriendRef.current === friend.id) {
        ctx.notifyStoppedTyping?.(friend.id);
        lastTypingFriendRef.current = null;
        lastTypingSentRef.current = 0;
      }
      return;
    }
    const now = Date.now();
    // Throttle to once every 2 s. The receiver TTL is 4 s, so each ping
    // refreshes well before the indicator would expire mid-typing.
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    lastTypingFriendRef.current = friend.id;
    ctx.notifyTyping?.(friend.id);
  };

  const sendMessagePayload = useCallback(async (payload) => {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return res;
  }, []);

  const stopRecordingTimer = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const computeElapsedMs = () => {
    const segment = recordPausedRef.current
      ? 0
      : Math.max(0, Date.now() - recordStartRef.current);
    return recordAccumRef.current + segment;
  };

  const cleanupRecorderStream = () => {
    const rec = recorderRef.current;
    if (rec?.stream) {
      try { rec.stream.getTracks().forEach((t) => t.stop()); } catch {}
    }
    recorderRef.current = null;
  };

  const stopAudioMeter = () => {
    if (audioRafRef.current != null && typeof cancelAnimationFrame !== 'undefined') {
      try { cancelAnimationFrame(audioRafRef.current); } catch {}
    }
    audioRafRef.current = null;
    analyserRef.current = null;
    const ac = audioContextRef.current;
    audioContextRef.current = null;
    if (ac && typeof ac.close === 'function') {
      try { ac.close(); } catch {}
    }
  };

  const startAudioMeter = (stream) => {
    if (typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || typeof requestAnimationFrame === 'undefined') return;
    let ctx;
    try { ctx = new AC(); } catch { return; }
    let source;
    try {
      source = ctx.createMediaStreamSource(stream);
    } catch {
      try { ctx.close(); } catch {}
      return;
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.fftSize);
    let last = 0;
    const tick = (t) => {
      // Analyser was torn down (stop / cancel / error / unmount) — bail out.
      if (analyserRef.current !== analyser) return;
      audioRafRef.current = requestAnimationFrame(tick);
      // Throttle to ~14fps so we don't churn React on every paint.
      if (t - last < 70) return;
      last = t;
      // While the take is paused, freeze the visualizer at zero so the
      // indicator visibly "flatlines" — even though the underlying mic
      // stream is still live, we shouldn't be drawing new activity.
      if (recordPausedRef.current) {
        setAudioLevels((prev) => {
          const next = prev.slice(1);
          next.push(0);
          return next;
        });
        return;
      }
      try { analyser.getByteTimeDomainData(data); } catch { return; }
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(1, rms * 3.2);
      setAudioLevels((prev) => {
        const next = prev.slice(1);
        next.push(level);
        return next;
      });
    };
    audioRafRef.current = requestAnimationFrame(tick);
  };

  const sendVoiceBlob = async (blob, durationMs) => {
    if (!friend?.id) return false;
    setSending(true);
    setSendError(null);
    setVoiceError(null);
    try {
      const { attachmentUrl, attachmentDurationMs } = await uploadVoiceBlob(blob, durationMs);
      const res = await sendMessagePayload({
        receiverId: friend.id,
        content: '',
        messageType: 'voice',
        attachmentUrl,
        attachmentDurationMs,
      });
      if (!res.ok) {
        setSendError(res.status === 403 ? 'You can only message friends.' : 'Could not send voice note.');
        return false;
      }
      const data = await res.json();
      if (data?.message) {
        setThread((prev) => [...prev, data.message]);
        if (typeof window !== 'undefined') {
          const m = data.message;
          window.dispatchEvent(
            new CustomEvent('piks:message:new', {
              detail: {
                id: m.id,
                senderId: m.senderId,
                receiverId: m.receiverId,
                content: m.content,
                messageType: m.messageType || 'voice',
                attachmentUrl: m.attachmentUrl || attachmentUrl,
                attachmentDurationMs: m.attachmentDurationMs ?? attachmentDurationMs,
                createdAt:
                  m.createdAt instanceof Date
                    ? m.createdAt.toISOString()
                    : m.createdAt,
              },
            })
          );
        }
      }
      ctx.refresh?.();
      return true;
    } catch (err) {
      setSendError('Could not send voice note.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const uploadVoiceBlob = async (blob, durationMs) => {
    const ext = blob.type.includes('mp4') ? 'm4a'
      : blob.type.includes('ogg') ? 'ogg'
      : 'webm';
    const filename = `voice-${Date.now()}.${ext}`;
    const reqRes = await fetch('/api/uploads/request-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: filename,
        size: blob.size,
        contentType: blob.type || 'audio/webm',
        kind: 'voice-note',
      }),
    });
    if (!reqRes.ok) throw new Error('upload-url-failed');
    const { uploadURL, objectPath } = await reqRes.json();
    const putRes = await fetch(uploadURL, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body: blob,
    });
    if (!putRes.ok) throw new Error('upload-failed');
    return { attachmentUrl: objectPath, attachmentDurationMs: durationMs };
  };

  const handleStartRecording = async () => {
    if (recording || sending) return;
    setVoiceError(null);
    setSendError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Recording not supported on this device.');
      return;
    }
    if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
      setVoiceError('Recording not supported on this device.');
      return;
    }
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = 'audio/webm';
      try {
        if (!window.MediaRecorder.isTypeSupported('audio/webm')) {
          if (window.MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else mimeType = '';
        }
      } catch { mimeType = ''; }
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);
      recordMimeRef.current = recorder.mimeType || mimeType || 'audio/webm';
      recordChunksRef.current = [];
      recordCancelledRef.current = false;
      recordAccumRef.current = 0;
      recordPausedRef.current = false;
      setPaused(false);
      setAutoPaused(false);
      setPauseSupported(
        typeof recorder.pause === 'function' && typeof recorder.resume === 'function'
      );
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        try { stopRecordingTimer(); } catch {}
        try { stopAudioMeter(); } catch {}
        const elapsed = computeElapsedMs();
        const chunks = recordChunksRef.current;
        recordChunksRef.current = [];
        recordAccumRef.current = 0;
        recordPausedRef.current = false;
        try { cleanupRecorderStream(); } catch {}
        setRecording(false);
        setPaused(false);
        setAutoPaused(false);
        setRecordElapsed(0);
        setAudioLevels(new Array(LEVEL_BAR_COUNT).fill(0));
        if (recordCancelledRef.current) {
          recordCancelledRef.current = false;
          return;
        }
        if (!chunks.length) {
          setVoiceError('Recording was empty. Try again.');
          return;
        }
        const mime = recordMimeRef.current || 'audio/webm';
        const blob = new Blob(chunks, { type: mime });
        let url = '';
        try {
          if (typeof URL !== 'undefined' && URL.createObjectURL) {
            url = URL.createObjectURL(blob);
          }
        } catch {}
        setVoicePreview({ blob, url, durationMs: elapsed, mime });
      };
      recorderRef.current = recorder;
      recordStartRef.current = Date.now();
      setRecordElapsed(0);
      setAudioLevels(new Array(LEVEL_BAR_COUNT).fill(0));
      recorder.start();
      setRecording(true);
      try { startAudioMeter(stream); } catch {}
      recordTimerRef.current = setInterval(() => {
        const elapsed = computeElapsedMs();
        setRecordElapsed(elapsed);
        if (elapsed >= MAX_VOICE_MS) {
          try { recorder.stop(); } catch {}
        }
      }, 100);
    } catch (err) {
      try { stopRecordingTimer(); } catch {}
      try { stopAudioMeter(); } catch {}
      if (stream) {
        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
      }
      recorderRef.current = null;
      recordChunksRef.current = [];
      recordCancelledRef.current = false;
      recordAccumRef.current = 0;
      recordPausedRef.current = false;
      setRecording(false);
      setPaused(false);
      setAutoPaused(false);
      setRecordElapsed(0);
      setAudioLevels(new Array(LEVEL_BAR_COUNT).fill(0));
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setVoiceError('Microphone access denied.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setVoiceError('No microphone available.');
      } else {
        setVoiceError('Could not start recording. Try again.');
      }
    }
  };

  // Build a preview blob from the chunks captured so far (after a flushing
  // requestData) and surface it via voicePreview. The recorder/stream stay
  // alive in the paused state so a subsequent "Continue" can resume the same
  // continuous take. durationMs is the elapsed time captured at pause.
  const finalizePreviewFromChunks = (durationMs) => {
    const chunks = recordChunksRef.current;
    if (!chunks.length) {
      setVoiceError('Recording was empty. Try again.');
      tearDownLingeringRecorder();
      return;
    }
    const mime = recordMimeRef.current || 'audio/webm';
    const blob = new Blob(chunks, { type: mime });
    let url = '';
    try {
      if (typeof URL !== 'undefined' && URL.createObjectURL) {
        url = URL.createObjectURL(blob);
      }
    } catch {}
    setVoicePreview({ blob, url, durationMs, mime });
    setRecording(false);
    // Only enable Continue if there's still recording budget; otherwise the
    // user has already maxed out and resuming would just immediately stop.
    setResumableTake(durationMs < MAX_VOICE_MS - 200);
  };

  // Pause the live recorder and capture a preview blob from the data flushed
  // by requestData(). Throws if the underlying calls fail; the caller should
  // fall back to a full stop in that case so the take isn't lost.
  const pauseForPreview = (rec) => {
    const wasRecording = rec.state === 'recording';
    if (wasRecording) {
      // Same accounting handlePauseRecording does — snapshot the in-flight
      // segment into the accumulator so durationMs is accurate.
      recordAccumRef.current += Math.max(0, Date.now() - recordStartRef.current);
    }
    recordPausedRef.current = true;
    const elapsedAtPause = recordAccumRef.current;
    const onceData = () => {
      rec.removeEventListener('dataavailable', onceData);
      // Defer one task so the property ondataavailable handler also gets to
      // push the flushed chunk into recordChunksRef before we read it.
      setTimeout(() => finalizePreviewFromChunks(elapsedAtPause), 0);
    };
    rec.addEventListener('dataavailable', onceData);
    try {
      rec.requestData();
    } catch (e) {
      rec.removeEventListener('dataavailable', onceData);
      throw e;
    }
    if (wasRecording) {
      try {
        rec.pause();
      } catch (e) {
        rec.removeEventListener('dataavailable', onceData);
        throw e;
      }
    }
    stopRecordingTimer();
    setPaused(true);
    setRecordElapsed(elapsedAtPause);
  };

  // Synchronously dispose of the lingering paused recorder. We detach
  // handlers and refs first so the async onstop can't clobber state from a
  // freshly-started take (e.g. when the user immediately taps Re-record).
  const tearDownLingeringRecorder = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    try { rec.ondataavailable = null; } catch {}
    try { rec.onstop = null; } catch {}
    try { stopRecordingTimer(); } catch {}
    try { stopAudioMeter(); } catch {}
    try { if (rec.state !== 'inactive') rec.stop(); } catch {}
    if (rec.stream) {
      try { rec.stream.getTracks().forEach((t) => t.stop()); } catch {}
    }
    recordChunksRef.current = [];
    recordAccumRef.current = 0;
    recordPausedRef.current = false;
    recordCancelledRef.current = false;
    setRecording(false);
    setPaused(false);
    setRecordElapsed(0);
    setAudioLevels(new Array(LEVEL_BAR_COUNT).fill(0));
  };

  const handleStopRecording = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    recordCancelledRef.current = false;
    // Prefer keeping the recorder alive (paused) so the preview row can offer
    // "Continue" — appending more audio to the same take instead of starting
    // a new one. Requires browser support for pause + requestData. Otherwise
    // we fall back to fully stopping, matching the original behavior.
    if (
      pauseSupported &&
      (rec.state === 'recording' || rec.state === 'paused') &&
      typeof rec.requestData === 'function' &&
      typeof rec.pause === 'function'
    ) {
      try {
        pauseForPreview(rec);
        return;
      } catch {
        // Pause/flush failed — fall through to the plain stop path below so
        // the user still gets their preview.
      }
    }
    try { rec.stop(); } catch {}
  };

  const handlePauseRecording = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording' || recordPausedRef.current) return;
    if (typeof rec.pause !== 'function') return;
    try { rec.pause(); } catch { return; }
    // Snapshot the current segment's elapsed ms into the accumulator and
    // freeze the visible timer at that value. computeElapsedMs() returns
    // just the accumulator while paused.
    recordAccumRef.current += Math.max(0, Date.now() - recordStartRef.current);
    recordPausedRef.current = true;
    setPaused(true);
    setRecordElapsed(recordAccumRef.current);
    setAudioLevels(new Array(LEVEL_BAR_COUNT).fill(0));
  };

  const handleResumeRecording = () => {
    const rec = recorderRef.current;
    if (!rec || !recordPausedRef.current) return;
    if (typeof rec.resume !== 'function') return;
    try { rec.resume(); } catch { return; }
    // Re-base the segment start so computeElapsedMs() resumes counting
    // from the point we paused at, never losing the prior take.
    recordStartRef.current = Date.now();
    recordPausedRef.current = false;
    setPaused(false);
    setAutoPaused(false);
  };

  const handleCancelRecording = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    recordCancelledRef.current = true;
    // stop() works on both 'recording' and 'paused' states and finalizes
    // the take, firing onstop where we'll discard the chunks.
    try { if (rec.state !== 'inactive') rec.stop(); } catch {}
  };

  const clearVoicePreview = useCallback(() => {
    setVoicePreview((prev) => {
      if (prev?.url) {
        try { URL.revokeObjectURL(prev.url); } catch {}
      }
      return null;
    });
  }, []);

  // Discard the current take and immediately arm the recorder for a fresh
  // attempt — saves the user a tap when they didn't like what they heard.
  const handleRerecordPreview = () => {
    if (sending || recording) return;
    setVoiceError(null);
    setSendError(null);
    tearDownLingeringRecorder();
    setResumableTake(false);
    clearVoicePreview();
    handleStartRecording();
  };

  // Resume the same take from the preview row — appends new audio onto the
  // existing recorder/chunks so the final blob is one continuous clip rather
  // than two separately-encoded segments stitched together.
  const handleContinueRecording = () => {
    if (sending || recording) return;
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'paused') return;
    // Drop the preview blob (revoke its URL) without touching the recorder
    // or chunks — the existing chunks are the prefix of the final clip.
    setVoicePreview((prev) => {
      if (prev?.url) {
        try { URL.revokeObjectURL(prev.url); } catch {}
      }
      return null;
    });
    setVoiceError(null);
    setSendError(null);
    setResumableTake(false);
    try {
      rec.resume();
    } catch {
      // Couldn't resume — fall back to a clean slate so the user isn't stuck.
      tearDownLingeringRecorder();
      return;
    }
    recordStartRef.current = Date.now();
    recordPausedRef.current = false;
    setPaused(false);
    setRecording(true);
    // Restart the visible elapsed timer (we cleared it during pauseForPreview)
    // so the running counter and MAX_VOICE_MS auto-stop continue working.
    recordTimerRef.current = setInterval(() => {
      const elapsed = computeElapsedMs();
      setRecordElapsed(elapsed);
      if (elapsed >= MAX_VOICE_MS) {
        try { rec.stop(); } catch {}
      }
    }, 100);
  };

  const handleSendPreview = async () => {
    if (sending) return;
    if (!voicePreview?.blob) return;
    const { blob, durationMs } = voicePreview;
    const ok = await sendVoiceBlob(blob, durationMs);
    if (ok) {
      tearDownLingeringRecorder();
      setResumableTake(false);
      clearVoicePreview();
    }
  };

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      stopAudioMeter();
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') {
        recordCancelledRef.current = true;
        try { rec.stop(); } catch {}
      }
      recordAccumRef.current = 0;
      recordPausedRef.current = false;
      cleanupRecorderStream();
      setVoicePreview((prev) => {
        if (prev?.url) {
          try { URL.revokeObjectURL(prev.url); } catch {}
        }
        return null;
      });
    };
  }, []);

  // Auto-pause an in-progress take when the messenger tab becomes hidden or
  // the window loses focus (e.g. the user clicks into another app on the same
  // desktop without backgrounding the tab) so we don't silently capture dead
  // air while the user is elsewhere. The recorder stays paused on return —
  // the user must tap Resume to continue. handlePauseRecording is itself a
  // no-op if the recorder isn't actively recording or pause isn't supported,
  // so the guard here is just to avoid attaching the listener when there's
  // nothing to pause.
  useEffect(() => {
    if (!recording || paused) return undefined;
    if (typeof document === 'undefined') return undefined;
    // Mirrors handlePauseRecording's own guards so we only mark a pause as
    // "auto" when it actually took effect (rec was live and pause is
    // supported). Otherwise the hint could appear without an actual pause.
    const pauseFromAuto = () => {
      const rec = recorderRef.current;
      if (!rec || rec.state !== 'recording' || recordPausedRef.current) return;
      handlePauseRecording();
      if (recordPausedRef.current) setAutoPaused(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      pauseFromAuto();
    };
    const onWindowBlur = () => {
      pauseFromAuto();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', onWindowBlur);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', onWindowBlur);
      }
    };
  }, [recording, paused]);

  // Switching to a different conversation should drop any pending preview so
  // the recorded blob isn't accidentally sent to the wrong friend.
  useEffect(() => {
    tearDownLingeringRecorder();
    setResumableTake(false);
    clearVoicePreview();
    setVoiceError(null);
    // tearDownLingeringRecorder is intentionally not in deps — it's defined
    // inline each render and only needs to fire when the active friend
    // changes (same intent as the existing clearVoicePreview behavior).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend?.id, clearVoicePreview]);

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = reply.trim();
    if (!text || !friend?.id || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await sendMessagePayload({ receiverId: friend.id, content: text });
      if (!res.ok) {
        setSendError(res.status === 403 ? 'You can only message friends.' : 'Could not send.');
        return;
      }
      const data = await res.json();
      if (data?.message) {
        setThread((prev) => [...prev, data.message]);
        if (typeof window !== 'undefined') {
          const m = data.message;
          window.dispatchEvent(
            new CustomEvent('piks:message:new', {
              detail: {
                id: m.id,
                senderId: m.senderId,
                receiverId: m.receiverId,
                content: m.content,
                createdAt:
                  m.createdAt instanceof Date
                    ? m.createdAt.toISOString()
                    : m.createdAt,
              },
            })
          );
        }
      }
      setReply('');
      // Sending implicitly ends the typing session — tell the friend so their
      // indicator clears the moment our message lands, not 4 s later. Also
      // reset the throttle so a follow-up message broadcasts on first stroke.
      if (lastTypingFriendRef.current === friend.id) {
        ctx.notifyStoppedTyping?.(friend.id);
        lastTypingFriendRef.current = null;
      }
      lastTypingSentRef.current = 0;
      ctx.refresh?.();
    } catch {
      setSendError('Could not send.');
    } finally {
      setSending(false);
    }
  };

  const cardBorder = 'rgba(59,130,246,0.18)';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';
  const inputBg = '#0a1220';

  let lastOutgoingIdx = -1;
  for (let i = thread.length - 1; i >= 0; i--) {
    if (thread[i].senderId === myId) { lastOutgoingIdx = i; break; }
  }
  const showSeen = lastOutgoingIdx >= 0 && thread[lastOutgoingIdx].read;

  // Quiet "invite cancelled / declined / expired" note in the header. Driven
  // by a window event fired from PlayFriendModal so the same note shows up
  // regardless of where the invite was started (messenger, battle page,
  // friend's profile). Auto-clears after a few seconds so it stays unobtrusive.
  const [inviteEndedNote, setInviteEndedNote] = useState(null);
  useEffect(() => {
    if (!friend?.id || typeof window === 'undefined') return undefined;
    const handler = (e) => {
      const d = e?.detail;
      if (!d || d.otherUserId !== friend.id) return;
      const name = friend.username || d.otherUsername || 'They';
      const text =
        d.reason === 'declined' ? `${name} declined the battle invite`
        : d.reason === 'expired' ? 'Battle invite expired'
        : 'Battle invite cancelled';
      setInviteEndedNote(text);
    };
    window.addEventListener('piks:invite:ended', handler);
    return () => window.removeEventListener('piks:invite:ended', handler);
  }, [friend?.id, friend?.username]);
  useEffect(() => {
    if (!inviteEndedNote) return undefined;
    const t = setTimeout(() => setInviteEndedNote(null), 6000);
    return () => clearTimeout(t);
  }, [inviteEndedNote]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex flex-col flex-shrink-0"
        style={{ borderBottom: `1px solid ${cardBorder}` }}
      >
      <div className="flex items-center gap-3 px-4 py-3">
        <UserAvatar
          user={friend}
          isOnline={friend?.isOnline ?? isUserOnline(friend?.lastSeenAt)}
          onlineDotBorderColor={'#0a0a0a'}
          link
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
            <UserNameLink user={friend} style={{ color: textPrimary }} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <ActiveStatus
              isOnline={friend.isOnline}
              lastSeenAt={friend.lastSeenAt}
              size="xs"
            />
            {(friend.battleWins != null || friend.battleLosses != null) && (
              <span className="text-[10px]" style={{ color: textSecondary }}>
                · {friend.battleWins || 0}W - {friend.battleLosses || 0}L
              </span>
            )}
          </div>
        </div>
        {onStartBattle && (
          <>
            {/* Mobile: square icon-only button. Same blue gradient + glow as
                the standard "Start a Battle" CTA on the Battle page so the
                visual language is identical no matter where the flow starts. */}
            <button
              type="button"
              onClick={() => {
                if (hasActiveMatchup) {
                  if (typeof window !== 'undefined') window.alert(ACTIVE_BATTLE_BLOCK_MESSAGE);
                  return;
                }
                onStartBattle(friend);
              }}
              disabled={hasActiveMatchup}
              className="sm:hidden relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-white border border-blue-500/40 overflow-hidden flex-shrink-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 12px rgba(59,130,246,0.45)' }}
              title={hasActiveMatchup ? ACTIVE_BATTLE_BLOCK_MESSAGE : 'Start Battle'}
              aria-label={hasActiveMatchup ? ACTIVE_BATTLE_BLOCK_MESSAGE : `Start battle with ${friend?.username || 'friend'}`}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500" />
              <svg className="w-4 h-4 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
            {/* Desktop: compact icon + label pill, same blue treatment. */}
            <button
              type="button"
              onClick={() => {
                if (hasActiveMatchup) {
                  if (typeof window !== 'undefined') window.alert(ACTIVE_BATTLE_BLOCK_MESSAGE);
                  return;
                }
                onStartBattle(friend);
              }}
              disabled={hasActiveMatchup}
              className="hidden sm:inline-flex relative items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white border border-blue-500/40 overflow-hidden flex-shrink-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 12px rgba(59,130,246,0.45)' }}
              title={hasActiveMatchup ? ACTIVE_BATTLE_BLOCK_MESSAGE : undefined}
              aria-label={hasActiveMatchup ? ACTIVE_BATTLE_BLOCK_MESSAGE : `Start battle with ${friend?.username || 'friend'}`}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500" />
              <svg className="w-3.5 h-3.5 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="relative">{hasActiveMatchup ? 'In a battle' : 'Start Battle'}</span>
            </button>
          </>
        )}
        {hasActiveMatchup && onStartBattle && (
          <span className="sr-only">{ACTIVE_BATTLE_BLOCK_MESSAGE}</span>
        )}
      </div>
      {inviteEndedNote && (
        <div
          className="px-4 pb-2 -mt-1 text-[11px] flex items-center gap-1.5"
          style={{ color: textSecondary }}
          aria-live="polite"
        >
          <span aria-hidden="true">⚔️</span>
          <span>{inviteEndedNote}</span>
        </div>
      )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-2 min-h-0"
      >
        {loading && (
          <div className="text-center text-xs py-6" style={{ color: textSecondary }}>Loading…</div>
        )}
        {!loading && loadError && (
          <div className="text-center text-xs py-6 text-red-400">{loadError}</div>
        )}
        {!loading && !loadError && thread.length === 0 && (
          <div className="text-center text-xs py-6" style={{ color: textSecondary }}>
            No messages yet. Say hi!
          </div>
        )}
        {!loading && !loadError && thread.map((m, idx) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.senderId === myId ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug break-words ${
                m.senderId === myId
                  ? 'bg-blue-500 text-white rounded-br-sm'
                  : 'text-white rounded-bl-sm'
              }`}
              style={
                m.senderId === myId
                  ? { boxShadow: '0 0 14px rgba(59,130,246,0.35)' }
                  : { backgroundColor: '#0f1622', border: '1px solid rgba(59,130,246,0.18)' }
              }
            >
              {m.messageType === 'voice' && m.attachmentUrl ? (
                <VoiceBubble
                  url={m.attachmentUrl}
                  durationMs={m.attachmentDurationMs}
                  mine={m.senderId === myId}
                />
              ) : (
                m.content
              )}
            </div>
            {showSeen && idx === lastOutgoingIdx && (
              <p className="text-[10px] mt-0.5 mr-0.5" style={{ color: textSecondary }}>
                {thread[lastOutgoingIdx].readAt
                  ? `Seen ${formatSeenAgo(thread[lastOutgoingIdx].readAt)}`
                  : 'Seen'}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="h-5 px-4 flex-shrink-0" aria-live="polite">
        {isTyping && (
          <div className="flex items-center gap-1.5 text-[11px] italic text-blue-300">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '240ms' }} />
            </span>
            <span>{friend.username || 'Friend'} is typing…</span>
          </div>
        )}
      </div>

      {!loadError && (
        <form onSubmit={handleSend} className="p-3 flex-shrink-0" style={{ borderTop: `1px solid ${cardBorder}` }}>
          {voicePreview && !recording ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg flex-wrap"
              style={{
                backgroundColor: inputBg,
                border: '1px solid rgba(59,130,246,0.4)',
              }}
            >
              <VoiceWaveformPreview
                blob={voicePreview.blob}
                url={voicePreview.url}
                durationMs={voicePreview.durationMs}
              />
              <div className="ml-auto flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleRerecordPreview}
                  disabled={sending}
                  aria-label="Re-record voice note"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: '#1f1f1f',
                    color: '#fca5a5',
                    border: '1px solid rgba(239,68,68,0.4)',
                  }}
                >
                  Re-record
                </button>
                {resumableTake && (
                  <button
                    type="button"
                    onClick={handleContinueRecording}
                    disabled={sending}
                    aria-label="Continue recording from where you left off"
                    title="Add more to this recording"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{
                      backgroundColor: '#0f1622',
                      color: '#bfdbfe',
                      border: '1px solid rgba(59,130,246,0.45)',
                    }}
                  >
                    Continue
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSendPreview}
                  disabled={sending}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-500 disabled:opacity-50"
                  style={{ boxShadow: '0 0 14px rgba(59,130,246,0.5)' }}
                >
                  {sending ? '…' : 'Send'}
                </button>
              </div>
            </div>
          ) : recording ? (
            <>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{
                backgroundColor: inputBg,
                border: paused
                  ? '1px solid rgba(156,163,175,0.4)'
                  : '1px solid rgba(239,68,68,0.4)',
              }}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${paused ? 'bg-gray-400' : 'bg-red-500'}`}
                style={
                  paused
                    ? undefined
                    : { boxShadow: '0 0 10px rgba(239,68,68,0.7)', animation: 'piksRecPulse 1s ease-in-out infinite' }
                }
              />
              <span
                className="text-xs font-medium"
                style={{ color: paused ? '#9ca3af' : '#fca5a5' }}
              >
                {paused ? 'Paused' : 'Recording'}
              </span>
              <div
                className="flex items-end gap-[2px] h-3.5"
                aria-hidden="true"
                style={{ minWidth: 56 }}
              >
                {audioLevels.map((lvl, i) => {
                  const h = Math.max(2, Math.round(lvl * 14));
                  return (
                    <span
                      key={i}
                      className={`block w-[2px] rounded-sm ${paused ? 'bg-gray-500' : 'bg-red-400'}`}
                      style={{
                        height: `${h}px`,
                        opacity: paused ? 0.5 : 0.55 + lvl * 0.45,
                        transition: 'height 80ms linear, opacity 80ms linear',
                      }}
                    />
                  );
                })}
              </div>
              <span className="text-xs tabular-nums" style={{ color: textSecondary }}>
                {formatDuration(recordElapsed)} / {formatDuration(MAX_VOICE_MS)}
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelRecording}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: '#1f1f1f', color: '#e5e7eb', border: `1px solid ${cardBorder}` }}
                >
                  Cancel
                </button>
                {pauseSupported && (
                  paused ? (
                    <button
                      type="button"
                      onClick={handleResumeRecording}
                      aria-label="Resume recording"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{
                        backgroundColor: '#7f1d1d',
                        border: '1px solid rgba(239,68,68,0.5)',
                      }}
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePauseRecording}
                      aria-label="Pause recording"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        backgroundColor: '#1f1f1f',
                        color: '#e5e7eb',
                        border: `1px solid ${cardBorder}`,
                      }}
                    >
                      Pause
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={handleStopRecording}
                  aria-label="Finish recording and preview"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-500"
                  style={{ boxShadow: '0 0 14px rgba(59,130,246,0.5)' }}
                >
                  Done
                </button>
              </div>
              <style>{`@keyframes piksRecPulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
            </div>
            {paused && autoPaused && (
              <p
                className="mt-1 text-[11px] flex items-start gap-1.5"
                style={{ color: textSecondary }}
                aria-live="polite"
              >
                <span aria-hidden="true">⏸</span>
                <span>Paused because you switched tabs — tap Resume to continue.</span>
              </p>
            )}
            </>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={reply}
                onChange={handleReplyChange}
                placeholder="Write a message…"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-400"
                style={{
                  backgroundColor: inputBg,
                  border: `1px solid ${cardBorder}`,
                  color: textPrimary,
                  boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.05)',
                  fontSize: 16,
                  lineHeight: '20px',
                }}
                maxLength={1000}
                disabled={sending}
              />
              {!reply.trim() ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  disabled={sending}
                  aria-label="Record voice message"
                  className="px-3 py-2 rounded-lg text-white disabled:opacity-50"
                  style={{
                    backgroundColor: '#0d1310',
                    border: `1px solid ${cardBorder}`,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-shadow"
                  style={{
                    boxShadow: !reply.trim() || sending
                      ? 'none'
                      : '0 0 14px rgba(59,130,246,0.5)',
                  }}
                >
                  {sending ? '…' : 'Send'}
                </button>
              )}
            </div>
          )}
          {(voiceError || sendError) && (
            <div role="alert" className="text-red-400 text-[11px] mt-1">{voiceError || sendError}</div>
          )}
        </form>
      )}
    </div>
  );
}

function NotFriendsCard({ userId, onFriendAdded }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [requestStatus, setRequestStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setProfile(null);
    setRequestStatus(null);
    setSendError(null);
    (async () => {
      try {
        const res = await fetch(`/api/profiles/${userId}`, { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setLoadError(res.status === 404 ? 'User not found.' : 'Could not load user.');
          return;
        }
        const data = await res.json();
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) setLoadError('Could not load user.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleAdd = async () => {
    if (sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendId: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (/already friends/i.test(data?.error || '')) {
          onFriendAdded?.();
          return;
        }
        setSendError(data?.error || 'Could not send friend request.');
        return;
      }
      const status = data?.status === 'accepted' ? 'accepted' : 'pending';
      setRequestStatus(status);
      if (status === 'accepted') onFriendAdded?.();
    } catch {
      setSendError('Could not send friend request.');
    } finally {
      setSending(false);
    }
  };

  const cardBorder = 'rgba(59,130,246,0.18)';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';
  const cardBg = '#0a0a0a';
  const innerBg = '#0a1220';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${cardBorder}` }}
      >
        <Avatar
          user={profile || {}}
          isOnline={profile?.isOnline ?? isUserOnline(profile?.lastSeenAt)}
          onlineDotBorderColor={cardBg}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
            {loading ? 'Loading…' : (profile?.username || 'Player')}
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-8 min-h-0">
        {loading ? (
          <div className="text-xs" style={{ color: textSecondary }}>Loading…</div>
        ) : loadError ? (
          <div className="text-xs text-red-400 text-center">{loadError}</div>
        ) : (
          <div
            className="w-full max-w-sm rounded-xl p-5 text-center"
            style={{ backgroundColor: innerBg, border: `1px solid ${cardBorder}` }}
          >
            <div className="text-sm font-semibold mb-1" style={{ color: textPrimary }}>
              You're not friends yet
            </div>
            <p className="text-xs mb-4" style={{ color: textSecondary }}>
              You can only message friends — send {profile?.username || 'this player'} a friend request first.
            </p>
            {requestStatus === 'pending' && (
              <div className="text-xs mb-3" style={{ color: textSecondary }}>
                Friend request sent. You'll be able to message them once they accept.
              </div>
            )}
            {requestStatus === 'accepted' && (
              <div className="text-xs mb-3 text-blue-400">You're now friends!</div>
            )}
            {!requestStatus && (
              <button
                type="button"
                onClick={handleAdd}
                disabled={sending}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                {sending ? 'Sending…' : 'Add friend'}
              </button>
            )}
            {sendError && (
              <div className="text-red-400 text-[11px] mt-2">{sendError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function applyIncomingMessage(prev, msg, myId, selectedId) {
  if (!msg || !myId) return prev;
  const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
  if (!otherId) return prev;
  const idx = prev.findIndex((c) => c.friend?.id === otherId);
  if (idx === -1) return null;
  const target = prev[idx];
  const existingTs = target.lastMessage?.createdAt
    ? new Date(target.lastMessage.createdAt).getTime()
    : 0;
  const incomingTs = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now();
  if (incomingTs < existingTs) return prev;
  const fromMe = msg.senderId === myId;
  const next = prev.slice();
  next[idx] = {
    ...target,
    lastMessage: {
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      content: msg.content,
      preview: (msg.content || '').slice(0, 120),
      createdAt:
        typeof msg.createdAt === 'string'
          ? msg.createdAt
          : new Date(incomingTs).toISOString(),
      fromMe,
      unread: !fromMe && otherId !== selectedId,
    },
  };
  return next;
}

export default function MessagesPanel({
  selectedId,
  onSelect,
  ctx,
  myId,
  variant = 'card', // 'card' | 'fullpage'
  minHeight = 520,
  onStartBattle,
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [friendsError, setFriendsError] = useState(false);

  const liveUnreadIds = useMemo(() => {
    const s = new Set();
    (ctx.unreadMessages || []).forEach((m) => { if (m.sender?.id) s.add(m.sender.id); });
    return s;
  }, [ctx.unreadMessages]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/conversations', { credentials: 'include' });
      if (!res.ok) {
        setFriendsError(true);
        return;
      }
      const data = await res.json();
      setConversations(data.conversations || []);
      setFriendsError(false);
    } catch {
      setFriendsError(true);
    } finally { setLoading(false); }
  }, []);

  const loadFriends = fetchConversations;

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const unreadKey = useMemo(
    () => Array.from(liveUnreadIds).sort().join(','),
    [liveUnreadIds]
  );
  useEffect(() => {
    if (loading) return;
    fetchConversations();
  }, [unreadKey, selectedId, fetchConversations]);

  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const myIdRef = useRef(myId);
  useEffect(() => { myIdRef.current = myId; }, [myId]);
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const seenMessageIdsRef = useRef(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (e) => {
      const msg = e?.detail;
      if (!msg) return;
      if (msg.id) {
        if (seenMessageIdsRef.current.has(msg.id)) return;
        seenMessageIdsRef.current.add(msg.id);
        if (seenMessageIdsRef.current.size > 200) {
          const arr = Array.from(seenMessageIdsRef.current);
          seenMessageIdsRef.current = new Set(arr.slice(-100));
        }
      }
      const next = applyIncomingMessage(
        conversationsRef.current,
        msg,
        myIdRef.current,
        selectedIdRef.current
      );
      if (next === null) {
        fetchConversations();
        return;
      }
      if (next !== conversationsRef.current) setConversations(next);
    };
    window.addEventListener('piks:message:new', handler);
    return () => window.removeEventListener('piks:message:new', handler);
  }, [fetchConversations]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? conversations.filter((c) => (c.friend?.username || '').toLowerCase().includes(q))
      : conversations;
    return [...filtered].sort((a, b) => {
      const au = (a.lastMessage?.unread || liveUnreadIds.has(a.friend.id)) ? 1 : 0;
      const bu = (b.lastMessage?.unread || liveUnreadIds.has(b.friend.id)) ? 1 : 0;
      if (au !== bu) return bu - au;

      const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (at !== bt) return bt - at;

      return (a.friend?.username || '').localeCompare(b.friend?.username || '');
    });
  }, [conversations, query, liveUnreadIds]);

  const selectedFriend = useMemo(
    () => conversations.find((c) => c.friend?.id === selectedId)?.friend || null,
    [conversations, selectedId]
  );

  const cardBg = '#0a0a0a';
  const cardBorder = 'rgba(59,130,246,0.22)';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';
  const inputBg = '#0a1220';
  const rowHover = 'rgba(59,130,246,0.06)';
  const rowSelected = 'rgba(59,130,246,0.12)';
  const cardShadow = '0 0 0 1px rgba(59,130,246,0.08), 0 8px 32px -8px rgba(59,130,246,0.18)';

  const isFullpage = variant === 'fullpage';
  const containerStyle = isFullpage
    ? { backgroundColor: cardBg, border: `1px solid ${cardBorder}`, height: '100%', boxShadow: cardShadow }
    : { backgroundColor: cardBg, border: `1px solid ${cardBorder}`, minHeight, boxShadow: cardShadow };

  const sidebarMaxHeight = isFullpage ? undefined : 480;

  return (
    <div
      className={`rounded-2xl overflow-hidden flex flex-col md:flex-row ${isFullpage ? 'h-full' : ''}`}
      style={containerStyle}
    >
      <div
        className={`md:w-72 flex-shrink-0 flex flex-col ${selectedId ? 'hidden md:flex' : 'flex'}`}
        style={{ borderRight: `1px solid ${cardBorder}` }}
      >
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${cardBorder}` }}>
          <div className="text-sm font-bold mb-2" style={{ color: textPrimary }}>Messages</div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends…"
            className="w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-blue-500"
            style={{ backgroundColor: inputBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
          />
        </div>
        <div
          className="overflow-y-auto flex-1 min-h-0"
          style={sidebarMaxHeight ? { maxHeight: sidebarMaxHeight } : undefined}
        >
          {loading && (
            <div className="text-center text-xs py-6" style={{ color: textSecondary }}>Loading…</div>
          )}
          {!loading && sorted.length === 0 && (
            <div className="text-center text-xs py-8 px-4" style={{ color: textSecondary }}>
              {query ? 'No matches.' : 'No friends yet. Add friends to start messaging.'}
            </div>
          )}
          {!loading && sorted.map((c) => {
            const f = c.friend;
            const last = c.lastMessage;
            const isSelected = selectedId === f.id;
            const unread = (last?.unread || liveUnreadIds.has(f.id)) && !isSelected;
            const isTyping = ctx.typingSenderIds?.has?.(f.id);
            const previewText = last
              ? `${last.fromMe ? 'You: ' : ''}${last.preview || last.content || ''}`
              : `${f.battleWins || 0}W-${f.battleLosses || 0}L`;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect(f.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors relative"
                style={{
                  backgroundColor: isSelected ? rowSelected : 'transparent',
                  borderBottom: `1px solid ${cardBorder}`,
                  borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = rowHover; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <UserAvatar
                  user={f}
                  size={36}
                  isOnline={f.isOnline ?? isUserOnline(f.lastSeenAt)}
                  onlineDotBorderColor={isSelected ? rowSelected : cardBg}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm truncate flex-1 min-w-0 ${unread ? 'font-bold' : 'font-medium'}`}
                      style={{ color: textPrimary }}
                    >
                      {f.username || 'Player'}
                    </span>
                    {last?.createdAt && (
                      <span className="text-[10px] flex-shrink-0" style={{ color: textSecondary }}>
                        {timeAgo(last.createdAt)}
                      </span>
                    )}
                    {unread && (c.unreadCount > 0 ? (
                      <span
                        className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-blue-500 text-white flex-shrink-0 flex items-center justify-center"
                        style={{ boxShadow: '0 0 8px rgba(59,130,246,0.65)' }}
                      >
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    ) : (
                      <span
                        className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"
                        style={{ boxShadow: '0 0 8px rgba(59,130,246,0.85)' }}
                      />
                    ))}
                  </div>
                  <div
                    className={`text-[11px] truncate ${unread ? 'font-semibold' : ''}`}
                    style={{ color: unread ? textPrimary : textSecondary }}
                  >
                    {isTyping ? (
                      <span className="text-blue-300 italic">typing…</span>
                    ) : (
                      previewText
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`flex-1 min-w-0 ${selectedId ? 'flex' : 'hidden md:flex'} flex-col`}>
        {selectedId && (
          <div className="md:hidden px-3 pt-2">
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to messages
            </button>
          </div>
        )}
        {selectedFriend ? (
          <ConversationThread
            key={selectedFriend.id}
            friend={selectedFriend}
            ctx={ctx}
            myId={myId}
            onStartBattle={onStartBattle}
          />
        ) : selectedId && !loading && !friendsError ? (
          <NotFriendsCard
            key={selectedId}
            userId={selectedId}
            onFriendAdded={loadFriends}
          />
        ) : selectedId && friendsError ? (
          <div
            className="flex-1 flex items-center justify-center text-sm px-6 text-center text-red-400"
            style={{ minHeight: 320 }}
          >
            Could not load your friends list. Please try again.
          </div>
        ) : selectedId ? (
          <div
            className="flex-1 flex items-center justify-center text-sm px-6 text-center"
            style={{ color: textSecondary, minHeight: 320 }}
          >
            Loading…
          </div>
        ) : (
          <div
            className="flex-1 flex items-center justify-center text-sm px-6 text-center"
            style={{ color: textSecondary, minHeight: 320 }}
          >
            Select a friend to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}
