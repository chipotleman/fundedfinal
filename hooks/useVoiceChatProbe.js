import { useCallback, useEffect, useRef, useState } from 'react';

export const VOICE_PROBE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

export default function useVoiceChatProbe() {
  const [status, setStatus] = useState(VOICE_PROBE_STATUS.IDLE);
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState(null);
  const pcRef = useRef(null);
  const timeoutRef = useRef(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (_e) {}
      pcRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const runProbe = useCallback(async () => {
    cleanup();
    if (!mountedRef.current) return;
    setStatus(VOICE_PROBE_STATUS.RUNNING);
    setMessage('Checking your network…');
    setDetails(null);

    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      if (!mountedRef.current) return;
      setStatus(VOICE_PROBE_STATUS.ERROR);
      setMessage('Voice chat is not supported in this browser.');
      return;
    }

    let iceServers;
    try {
      const resp = await fetch('/api/battles/voice/ice-servers?selfTest=1');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      iceServers = data.iceServers || [];
    } catch (_err) {
      if (!mountedRef.current) return;
      setStatus(VOICE_PROBE_STATUS.ERROR);
      setMessage("Couldn't reach the voice chat server. Check your connection and try again.");
      return;
    }

    if (!mountedRef.current) return;

    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'all' });
    } catch (_err) {
      if (!mountedRef.current) return;
      setStatus(VOICE_PROBE_STATUS.ERROR);
      setMessage('Voice chat could not be initialized on this device.');
      return;
    }
    pcRef.current = pc;

    const found = { host: 0, srflx: 0, relay: 0 };
    let finished = false;

    const finish = (resultStatus, resultMessage) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (!mountedRef.current) return;
      setStatus(resultStatus);
      setMessage(resultMessage);
      setDetails({ ...found });
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
      if (!e.candidate) {
        conclude();
        return;
      }
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

    timeoutRef.current = setTimeout(conclude, 8000);
  }, [cleanup]);

  return { status, message, details, runProbe };
}
