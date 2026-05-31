/**
 * /battle/rush/[id] — routed Rush match page.
 *
 * This is the deep-link / refresh fallback for a Rush match (the primary
 * experience runs inside QuickMatchModal). It polls the server-authoritative
 * state, subscribes to the SSE channel for instant updates, and renders the
 * shared <RushFlow> for the current phase (accept → confirmed → picking →
 * live → round_result → completed, plus cancelled). All match logic lives on
 * the server; this page only reads state and posts the three player actions
 * (accept / pick / continue).
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import TopNavbar from '../../../components/TopNavbar';
import RushFlow from '../../../components/battle/rush/RushFlow';
import { getBattleStreamClient } from '../../../lib/battleStreamClient';

const POLL_MS = 1000;

export default function RushMatchPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);
  const aliveRef = useRef(true);

  const fetchState = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/battles/rush/${id}/state`);
      if (!res.ok) {
        if (res.status === 404) setError('Match not found.');
        else if (res.status === 403) setError('You are not in this match.');
        return;
      }
      const json = await res.json();
      if (aliveRef.current) {
        setData(json);
        setError(null);
      }
    } catch (_e) {
      /* transient; next poll retries */
    }
  }, [id]);

  // Poll loop.
  useEffect(() => {
    aliveRef.current = true;
    if (!id || status === 'loading') return undefined;
    fetchState();
    pollRef.current = setInterval(fetchState, POLL_MS);
    return () => {
      aliveRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, status, fetchState]);

  // SSE: refetch immediately on rush updates for this matchup.
  useEffect(() => {
    if (!id) return undefined;
    const client = getBattleStreamClient();
    const unsub = client.subscribe((evt) => {
      if (!evt) return;
      if (evt.type === 'matchup:rush:update' && String(evt.matchupId) === String(id)) {
        fetchState();
      }
      if (evt.type === 'piks:reconnected') fetchState();
    });
    return unsub;
  }, [id, fetchState]);

  const post = useCallback(async (action, body) => {
    if (!id) return null;
    setBusy(true);
    try {
      const res = await fetch(`/api/battles/rush/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      await fetchState();
      return json;
    } catch (_e) {
      return null;
    } finally {
      setBusy(false);
    }
  }, [id, fetchState]);

  const goHome = useCallback(() => router.push('/battle'), [router]);

  const startNewMatch = useCallback(async (stake) => {
    setBusy(true);
    try {
      const res = await fetch('/api/battles/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameMode: 'rush', buyIn: stake }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.matched && json?.matchup?.id) {
        router.replace(`/battle/rush/${json.matchup.id}`);
      } else {
        router.push('/battle?quickmatch=rush');
      }
    } catch (_e) {
      router.push('/battle');
    } finally {
      setBusy(false);
    }
  }, [router]);

  const rush = data?.rush;
  const matchup = data?.matchup;

  return (
    <>
      <Head><title>Rush Match · Piks</title></Head>
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
        <TopNavbar />
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 14px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {error && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#94a3b8', marginBottom: 16 }}>{error}</p>
              <button onClick={goHome} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 800, cursor: 'pointer' }}>Back to Battle</button>
            </div>
          )}
          {!error && !rush && (
            <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading match…</div>
          )}
          {!error && rush && matchup && userId && (
            <RushFlow
              rush={rush}
              matchup={matchup}
              userId={userId}
              busy={busy}
              onAccept={() => post('accept')}
              onDecline={goHome}
              onPick={(optionKey) => post('pick', { optionKey })}
              onContinue={() => post('continue')}
              onViewResults={() => {}}
              onRematch={(stake) => startNewMatch(stake)}
              onNewOpponent={() => startNewMatch(parseFloat(matchup?.startingBalance) || 10000)}
              onHome={goHome}
              onExit={goHome}
              onBack={goHome}
            />
          )}
        </div>
      </div>
    </>
  );
}
