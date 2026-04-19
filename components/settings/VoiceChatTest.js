import { useEffect, useRef, useState } from 'react';

const STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

export default function VoiceChatTest() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState(null);
  const pcRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
        pcRef.current = null;
      }
    };
  }, []);

  const cleanup = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
  };

  const runTest = async () => {
    cleanup();
    setStatus(STATUS.RUNNING);
    setMessage('Checking your network…');
    setDetails(null);

    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      setStatus(STATUS.ERROR);
      setMessage('Voice chat is not supported in this browser.');
      return;
    }

    let iceServers;
    try {
      const resp = await fetch('/api/battles/voice/ice-servers?selfTest=1');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      iceServers = data.iceServers || [];
    } catch (err) {
      setStatus(STATUS.ERROR);
      setMessage("Couldn't reach the voice chat server. Check your connection and try again.");
      return;
    }

    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'all' });
    } catch (err) {
      setStatus(STATUS.ERROR);
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
      setStatus(resultStatus);
      setMessage(resultMessage);
      setDetails(found);
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        if (found.relay > 0) {
          finish(STATUS.SUCCESS, 'Voice chat should work on this network.');
        } else if (found.srflx > 0 || found.host > 0) {
          finish(STATUS.WARNING, 'Your network may block voice chat — try mobile data or a different network.');
        } else {
          finish(STATUS.ERROR, "Couldn't gather any network candidates. Voice chat is unlikely to work here.");
        }
        return;
      }
      const type = e.candidate.type;
      if (type && found[type] !== undefined) found[type] += 1;
      if (type === 'relay') {
        finish(STATUS.SUCCESS, 'Voice chat should work on this network.');
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete' && !finished) {
        if (found.relay > 0) {
          finish(STATUS.SUCCESS, 'Voice chat should work on this network.');
        } else if (found.srflx > 0 || found.host > 0) {
          finish(
            STATUS.WARNING,
            'Your network may block voice chat — try mobile data or a different network.'
          );
        } else {
          finish(STATUS.ERROR, "Couldn't gather any network candidates. Voice chat is unlikely to work here.");
        }
      }
    };

    try {
      pc.createDataChannel('probe');
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
    } catch (err) {
      finish(STATUS.ERROR, 'Voice chat could not start a test connection on this device.');
      return;
    }

    timeoutRef.current = setTimeout(() => {
      if (found.relay > 0) {
        finish(STATUS.SUCCESS, 'Voice chat should work on this network.');
      } else if (found.srflx > 0 || found.host > 0) {
        finish(
          STATUS.WARNING,
          'Your network may block voice chat — try mobile data or a different network.'
        );
      } else {
        finish(STATUS.ERROR, "Couldn't gather any network candidates. Voice chat is unlikely to work here.");
      }
    }, 8000);
  };

  const colorClass =
    status === STATUS.SUCCESS ? 'text-green-400' :
    status === STATUS.WARNING ? 'text-yellow-400' :
    status === STATUS.ERROR ? 'text-red-400' :
    status === STATUS.RUNNING ? 'text-gray-300' : 'text-gray-400';

  return (
    <div className="bg-[#111] backdrop-blur-lg rounded-2xl border border-[#1a1a1a] p-8 mb-8">
      <h2 className="text-xl font-bold text-white mb-2">Voice Chat</h2>
      <p className="text-gray-400 text-sm mb-6">
        Run a quick test to check whether your network can reach our voice chat relay before joining a live battle.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={runTest}
          disabled={status === STATUS.RUNNING}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            status === STATUS.RUNNING
              ? 'bg-[#1a1a1a] text-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-black'
          }`}
        >
          {status === STATUS.RUNNING ? 'Testing…' : 'Test voice chat'}
        </button>
        {status !== STATUS.IDLE && (
          <div className={`text-sm ${colorClass}`}>
            {message}
            {details && status !== STATUS.RUNNING && (
              <div className="text-gray-500 text-xs mt-1">
                Candidates found — relay: {details.relay}, server-reflexive: {details.srflx}, host: {details.host}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
