import { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import useRushAvailability from '../../hooks/useRushAvailability';
import haptic from '../../utils/haptics';
import UserAvatar from '../UserAvatar';
import { CartoonChipStyles } from './CartoonChip';
import { navigateToBattleStart } from '../../lib/battleStartNavigation';
import { useGames } from '../../contexts/GamesContext';
import { getBattleStreamClient } from '../../lib/battleStreamClient';
import { useBetaMode } from '../../contexts/SiteConfigContext';

// Rush in-popup flow constants. The modal carries the user all the way
// from "MATCH FOUND" → live-game voting → ready check → 3-2-1 countdown →
// the actual 6-question gameplay → result, so the experience feels like
// a single trivia-crack-style ritual instead of a page swap. The
// /battle/rush/[id] routed page still exists as a fallback for
// refresh / back / deep-link, but the popup is the primary surface.
const RUSH_VOTE_GAME_LIMIT = 3;
const RUSH_FOUND_TO_VOTE_DELAY_MS = 1400;
const RUSH_COUNTDOWN_TICK_MS = 800;
const RUSH_GO_DURATION_MS = 600;
const RUSH_STATE_POLL_MS = 750;
// How long the result slide stays visible before we route the user
// back to /battle (where the result popup picks up via SSE plumbing).
const RUSH_RESULT_AUTO_EXIT_MS = 12000;

const GAME_MODE_OPTIONS = [
  {
    id: 'rush',
    label: 'RUSH',
    icon: '⚡',
    tagline: 'FAST · INTENSE',
    description: 'Pick 6 props from a live game',
    coins: 10000,
    durationMinutes: 180,
    durationType: 'rush',
    color: '#10b981',
  },
  {
    id: 'original',
    label: 'ORIGINAL',
    icon: '🏆',
    tagline: 'BALANCED · COMPETITIVE',
    description: 'Highest balance after all games end wins',
    coins: 10000,
    durationMinutes: 1440,
    durationType: 'original',
    recommended: true,
    color: '#3b82f6',
  },
  {
    id: 'tournament',
    label: 'TOURNAMENT',
    icon: '👑',
    tagline: 'BIG STAKES · BIGGER WINS',
    description: '3-day battle with a massive bankroll',
    coins: 100000,
    durationMinutes: 4320,
    durationType: 'tournament',
    color: '#f97316',
  },
];

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];

const FAKE_NAMES = [
  'ShadowBet', 'CryptoKing', 'LuckyDraw', 'BetMaster', 'SharpShooter',
  'OddsWizard', 'ClutchPlay', 'BigStack', 'IceVeins', 'MoneyLine',
  'ParlayCash', 'UnderdogX', 'GoldRush', 'NitroPickz', 'AceHigh',
];

const FAKE_RECORDS = [
  '12-3', '8-5', '15-7', '10-4', '6-2', '20-9', '9-6', '14-3', '11-8', '7-1',
  '18-5', '13-6', '5-3', '16-4', '22-10',
];

const TIPS = [
  'Diversify your picks across different sports',
  'Best players win about 60% of their battles',
  "Don't chase losses — stick to your strategy",
  'Higher-odds picks = higher potential payout',
  'Parlays are risky but can swing a battle fast',
  'Check injury reports before locking in picks',
  'Underdogs hit more often than you think',
  'Bankroll management is key to winning long-term',
  'Watch line movement for sharp money signals',
  'Live betting can turn a losing battle around',
];

function rankFromWins(wins) {
  const w = Number(wins) || 0;
  if (w >= 100) return { label: 'LEGEND', color: '#10b981', icon: '👑' };
  if (w >= 50) return { label: 'ELITE', color: '#fb923c', icon: '👑' };
  if (w >= 10) return { label: 'PRO', color: '#facc15', icon: '👑' };
  return { label: 'ROOKIE', color: '#3b82f6', icon: '🎯' };
}

function MatchFoundContent({
  isBeta,
  buyIn,
  potSize,
  payout,
  gameMode,
  selectedMode,
  userName,
  userAvatar,
  userProfile,
  matchedOpponent,
  matchedAvatar,
  th,
  onContinue,
  onCancel,
}) {
  const CONFIRM_SECONDS = 10;
  const [secondsLeft, setSecondsLeft] = useState(CONFIRM_SECONDS);
  const firedRef = useRef(false);

  // Auto-confirm countdown for non-rush modes. Rush has its own
  // auto-advance into the live-game vote, so don't double-fire.
  useEffect(() => {
    if (gameMode === 'rush') return undefined;
    if (firedRef.current) return undefined;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          if (!firedRef.current) {
            firedRef.current = true;
            try { onContinue(); } catch (_) {}
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [gameMode, onContinue]);

  const userWins = Number(userProfile?.battleWins) || 0;
  const oppWins = Number(matchedOpponent?.battleWins) || 0;
  const userRank = rankFromWins(userWins);
  const oppRank = rankFromWins(oppWins);
  const winStreak = Number(userProfile?.winStreak) || Math.min(userWins, 9);
  const xpBonus = 50;

  // Compact label format: "10K" / "1.2M" so the buy-in pill always
  // fits on a single line even with beta's larger coin numbers. The
  // long-form "10,000 Coin Buy-In · Win 18,000 Pot" was wrapping to
  // two lines and crushing the layout vs the cartoon reference.
  const compact = (n) => {
    const v = Number(n || 0);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 ? 1 : 0)}K`;
    return String(v);
  };
  const fmt = (n) => Number(n || 0).toLocaleString();
  const betaBuyIn = buyIn || 10000;
  const betaPot = Math.round(betaBuyIn * 2 * 0.9);
  const buyInLabel = isBeta ? `${compact(betaBuyIn)} Coins` : `$${fmt(buyIn)} Buy-In`;
  const potLabel = isBeta ? `Win ${compact(betaPot)}` : `Win $${fmt(payout)} Pot`;

  const totalSegments = 10;
  const filledSegments = Math.max(0, Math.min(totalSegments, Math.ceil((secondsLeft / CONFIRM_SECONDS) * totalSegments)));

  const Bolt = ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13 2L3 14h7l-2 8 11-13h-7l3-7z"
        fill="#facc15"
        stroke="#0a0a0a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Mode label + 24h-style countdown chip (purely visual — the actual
  // match timer is enforced server-side later). Falls back gracefully
  // for non-original modes.
  const modeLabel = (gameMode || 'original').toUpperCase();
  const timeChipLabel = gameMode === 'rush' ? 'LIVE NOW' : '24H';

  return (
    <div className="relative z-10">
      {/* Confetti / spark backdrop — pure CSS so the whole panel feels
          like the arcade "you're matched" reference instead of a flat
          dialog. Lives behind everything (z-0) with pointer-events:none. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background:
            'radial-gradient(circle at 18% 12%, rgba(251,191,36,0.18), transparent 18%),' +
            'radial-gradient(circle at 82% 10%, rgba(236,72,153,0.16), transparent 20%),' +
            'radial-gradient(circle at 50% 95%, rgba(6,182,212,0.18), transparent 30%),' +
            'radial-gradient(circle at 8% 70%, rgba(16,185,129,0.14), transparent 22%),' +
            'radial-gradient(circle at 92% 78%, rgba(249,115,22,0.18), transparent 24%)',
        }}
      />

      {/* ─── Hero title ──────────────────────────────────────────────
          Big neon italic "YOU'RE MATCHED!" with yellow→orange gradient
          fill, thick black outline, and multi-layer pink/orange/cyan
          glow to match the arcade reference. Lightning bolts on each
          side stay on the same baseline. */}
      <div className="px-5 pt-7 pb-2 text-center relative">
        <div className="flex items-center justify-center gap-3">
          <span
            aria-hidden="true"
            style={{
              fontSize: 32,
              lineHeight: 1,
              color: '#facc15',
              filter:
                'drop-shadow(0 0 14px rgba(251,146,60,0.9)) drop-shadow(0 0 22px rgba(236,72,153,0.55)) drop-shadow(0 2px 0 #0a0a0a)',
              animation: 'qm-bolt-flicker 1.1s ease-in-out infinite',
            }}
          >
            ⚡
          </span>
          <h3
            className="font-black uppercase text-center"
            style={{
              fontSize: 'clamp(34px, 9.5vw, 52px)',
              lineHeight: 0.9,
              letterSpacing: '0.01em',
              fontStyle: 'italic',
              WebkitTextStroke: '2px #0a0a0a',
              textShadow:
                '0 4px 0 #0a0a0a,' +
                '0 0 18px rgba(251,146,60,0.95),' +
                '0 0 34px rgba(236,72,153,0.7),' +
                '0 0 52px rgba(168,85,247,0.45)',
              background: 'linear-gradient(180deg, #fef08a 0%, #facc15 45%, #fb923c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              whiteSpace: 'nowrap',
              margin: 0,
              animation: 'qm-banner-bounce 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.05s both',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            You're Matched!
          </h3>
          <span
            aria-hidden="true"
            style={{
              fontSize: 32,
              lineHeight: 1,
              color: '#facc15',
              filter:
                'drop-shadow(0 0 14px rgba(251,146,60,0.9)) drop-shadow(0 0 22px rgba(236,72,153,0.55)) drop-shadow(0 2px 0 #0a0a0a)',
              animation: 'qm-bolt-flicker 1.1s ease-in-out infinite 0.15s',
            }}
          >
            ⚡
          </span>
        </div>

        {/* Green "BATTLE STARTED" pill */}
        <div className="mt-3 flex justify-center">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black uppercase whitespace-nowrap"
            style={{
              background: 'linear-gradient(180deg,#10b981,#047857)',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a, 0 0 18px rgba(16,185,129,0.55)',
              color: '#ffffff',
              letterSpacing: '0.22em',
              textShadow: '0 1px 0 rgba(0,0,0,0.35)',
            }}
          >
            <span aria-hidden="true" style={{ color: '#fef08a' }}>★</span>
            Battle Started
            <span aria-hidden="true" style={{ color: '#fef08a' }}>★</span>
          </span>
        </div>
      </div>

      {/* ─── Mode / pot / timer strip ────────────────────────────────
          Trophy · MODE · WIN X COINS · 24H · coin — single neon
          capsule with cyan border so it reads as one bar of meta info,
          matching the reference. */}
      <div className="px-4 pb-3 relative z-10">
        <div
          className="mx-auto rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2 sm:gap-3 whitespace-nowrap"
          style={{
            background: 'linear-gradient(180deg,#0b1220,#080a14)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 4px 0 #0a0a0a, 0 0 22px rgba(6,182,212,0.35)',
            maxWidth: 420,
          }}
        >
          <span style={{ fontSize: 20 }} aria-hidden="true">🏆</span>
          <span className="text-white font-extrabold text-[11px] sm:text-xs" style={{ letterSpacing: '0.14em' }}>
            {modeLabel}
          </span>
          <span aria-hidden="true" style={{ width: 1.5, height: 16, background: '#1e293b' }} />
          <span className="font-extrabold text-[11px] sm:text-xs" style={{ color: '#facc15', letterSpacing: '0.06em' }}>
            {potLabel}
          </span>
          <span aria-hidden="true" style={{ width: 1.5, height: 16, background: '#1e293b' }} />
          <span className="inline-flex items-center gap-1.5">
            <span style={{ fontSize: 14 }} aria-hidden="true">⏱️</span>
            <span className="text-white font-extrabold text-[11px] sm:text-xs" style={{ letterSpacing: '0.08em' }}>
              {timeChipLabel}
            </span>
          </span>
          <span style={{ fontSize: 20 }} aria-hidden="true">🪙</span>
        </div>
      </div>

      {/* Avatars + VS — diagonal split between opponents.
          A blue half on the YOU side and orange half on the OPP side
          meet on a slanted diagonal so the row reads as two opposing
          territories. Both layers are absolutely positioned behind the
          avatars (z-0) with pointer-events:none; the avatars and VS
          stay on top (z-10/z-20) and are unaffected. */}
      <div
        className="flex items-center justify-center gap-4 md:gap-8 py-4 px-4 relative overflow-hidden"
        style={{ background: '#0a0a0a' }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(59,130,246,0.22) 0%, rgba(59,130,246,0.06) 55%, transparent 60%)',
            clipPath: 'polygon(0 0, 58% 0, 42% 100%, 0 100%)',
            zIndex: 0,
          }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(225deg, rgba(251,146,60,0.22) 0%, rgba(251,146,60,0.06) 55%, transparent 60%)',
            clipPath: 'polygon(58% 0, 100% 0, 100% 100%, 42% 100%)',
            zIndex: 0,
          }}
        />
        {/* Hairline diagonal seam down the middle of the split. */}
        <span
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            top: 0,
            bottom: 0,
            left: '50%',
            width: '2px',
            transform: 'translateX(-50%) skewX(-18deg)',
            background:
              'linear-gradient(180deg, rgba(250,204,21,0) 0%, rgba(250,204,21,0.55) 50%, rgba(250,204,21,0) 100%)',
            zIndex: 1,
          }}
        />
        {/* YOU side */}
        <div
          className="flex flex-col items-center relative z-10"
          style={{ animation: 'qm-slam-from-left 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          {/* Crown — visual flair to match the arcade reference. The
              royal/winner connotation makes the YOU avatar feel like
              the hero of the screen even before the match starts. */}
          <span
            aria-hidden="true"
            className="absolute"
            style={{
              top: -18,
              fontSize: 24,
              filter: 'drop-shadow(0 2px 0 #0a0a0a) drop-shadow(0 0 10px rgba(250,204,21,0.85))',
              animation: 'qm-banner-bounce 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.25s both',
              zIndex: 20,
            }}
          >
            👑
          </span>
          <div className="relative mb-2">
            <div
              className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
              style={{
                border: '4px solid #3b82f6',
                boxShadow: '0 0 0 2px #0a0a0a, 0 0 22px rgba(59,130,246,0.65)',
                background: th.avatarBg1,
              }}
            >
              <UserAvatar
                user={{ id: userProfile?.id, username: userName, avatar: userAvatar }}
                size={96}
              />
            </div>
          </div>
          <p
            className="text-white text-[11px] md:text-xs font-extrabold uppercase truncate max-w-[120px] text-center px-2.5 py-1 rounded-md"
            style={{
              background: '#1a1a1a',
              letterSpacing: '0.08em',
            }}
          >
            {userName}
          </p>
          <span
            className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase"
            style={{
              background: '#0f1424',
              border: `1.5px solid ${userRank.color}`,
              color: userRank.color,
              letterSpacing: '0.14em',
            }}
          >
            <span aria-hidden="true">{userRank.icon}</span>
            RANK: {userRank.label}
          </span>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center relative z-20">
          <div
            className="text-3xl md:text-5xl font-black italic"
            style={{
              color: '#facc15',
              animation: 'qm-vs-explode 0.65s cubic-bezier(0.34,1.56,0.64,1) 0.4s both',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            VS
          </div>
          {(userWins > 0 || oppWins > 0) && (
            <div
              className="mt-1 text-[10px] font-extrabold text-white px-2 py-0.5 rounded-md"
              style={{
                background: '#1a1a1a',
                letterSpacing: '0.1em',
              }}
            >
              ({userWins}-{oppWins})
            </div>
          )}
        </div>

        {/* OPP side */}
        <div
          className="flex flex-col items-center relative z-10"
          style={{ animation: 'qm-slam-from-right 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <div className="relative mb-2">
            <div
              className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
              style={{
                border: '4px solid #fb923c',
                boxShadow: '0 0 0 2px #0a0a0a, 0 0 22px rgba(251,146,60,0.65)',
                background: th.avatarBg2,
              }}
            >
              <UserAvatar
                user={{
                  id: matchedOpponent?.id,
                  username: matchedOpponent?.username || 'Opponent',
                  avatar: matchedAvatar,
                }}
                size={96}
              />
            </div>
          </div>
          <p
            className="text-white text-[11px] md:text-xs font-extrabold uppercase truncate max-w-[120px] text-center px-2.5 py-1 rounded-md"
            style={{
              background: '#1a1a1a',
              letterSpacing: '0.08em',
            }}
          >
            {matchedOpponent?.username || 'Opponent'}
          </p>
          <span
            className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase"
            style={{
              background: '#0f1424',
              border: `1.5px solid ${oppRank.color}`,
              color: oppRank.color,
              letterSpacing: '0.14em',
            }}
          >
            <span aria-hidden="true">{oppRank.icon}</span>
            RANK: {oppRank.label}
          </span>
        </div>
      </div>

      {/* Mini chip row: Win Streak / Bonus XP / Daily Challenge */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-3 gap-2">
          <div
            className="rounded-xl px-2 py-2 flex items-center gap-1.5"
            style={{
              background: '#1a0b0b',
              border: '2px solid #ef4444',
            }}
          >
            <span style={{ fontSize: 18 }} aria-hidden="true">🔥</span>
            <div className="min-w-0">
              <div className="text-[8.5px] font-extrabold uppercase text-red-300 leading-none" style={{ letterSpacing: '0.1em' }}>Win Streak</div>
              <div className="text-white font-extrabold text-xs mt-0.5 leading-none">{winStreak} {winStreak === 1 ? 'Win' : 'Wins'}</div>
            </div>
          </div>
          <div
            className="rounded-xl px-2 py-2 flex items-center gap-1.5"
            style={{
              background: '#1a1505',
              border: '2px solid #facc15',
            }}
          >
            <span style={{ fontSize: 18 }} aria-hidden="true">⭐</span>
            <div className="min-w-0">
              <div className="text-[8.5px] font-extrabold uppercase text-yellow-300 leading-none" style={{ letterSpacing: '0.1em' }}>Bonus XP</div>
              <div className="text-white font-extrabold text-xs mt-0.5 leading-none">+{xpBonus} XP</div>
            </div>
          </div>
          <div
            className="rounded-xl px-2 py-2 flex items-center gap-1.5"
            style={{
              background: '#052016',
              border: '2px solid #10b981',
            }}
          >
            <span style={{ fontSize: 18 }} aria-hidden="true">🎯</span>
            <div className="min-w-0">
              <div className="text-[8.5px] font-extrabold uppercase text-emerald-300 leading-none" style={{ letterSpacing: '0.1em' }}>Daily Challenge</div>
              <div className="text-white font-extrabold text-[10px] mt-0.5 leading-none">In Progress</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── CTA + lock footer ──────────────────────────────────────
          Big arcade "LET'S GO!" button with chevron arrows on each
          side + neon orange→pink fill + chunky black border / hard
          shadow. Footer underneath reads "BATTLE LOCKED IN — Both
          players must be ready" with a padlock to match the reference. */}
      <div className="px-4 pt-1 pb-5 relative z-10">
        {gameMode === 'rush' ? (
          <div
            className="w-full py-3.5 rounded-2xl text-center font-extrabold text-white uppercase flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 4px 0 #0a0a0a',
              letterSpacing: '0.14em',
              fontSize: 13,
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: '#fbbf24', boxShadow: '0 0 10px #fbbf24', animation: 'qm-bolt-flicker 0.9s ease-in-out infinite' }}
            />
            <span style={{ color: '#fbbf24' }}>Loading live games…</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => { firedRef.current = true; onContinue(); }}
              className="msg-cartoon-btn w-full py-4 rounded-2xl font-black uppercase flex items-center justify-center gap-3 sm:gap-4 relative"
              style={{
                background: 'linear-gradient(180deg,#fde047 0%, #f97316 60%, #ea580c 100%)',
                border: '3px solid #0a0a0a',
                boxShadow: '0 5px 0 #0a0a0a, 0 0 28px rgba(249,115,22,0.6), 0 0 48px rgba(236,72,153,0.35)',
                letterSpacing: '0.1em',
                color: '#0a0a0a',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: 'clamp(22px, 6vw, 30px)',
                fontStyle: 'italic',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '1.4em', lineHeight: 1, color: '#0a0a0a' }}>«</span>
              <span style={{ textShadow: '0 2px 0 rgba(255,255,255,0.35)' }}>Let's Go!</span>
              <span aria-hidden="true" style={{ fontSize: '1.4em', lineHeight: 1, color: '#0a0a0a' }}>»</span>
            </button>

            {/* Lock footer */}
            <div className="mt-3 text-center">
              <div
                className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase"
                style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}
              >
                <span aria-hidden="true" style={{ fontSize: 12 }}>🔒</span>
                Battle Locked In
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>
                Both players must be ready
                {gameMode !== 'rush' && (
                  <>
                    <span className="mx-1.5" style={{ color: '#475569' }}>·</span>
                    <span style={{ color: '#7dd3fc' }}>{secondsLeft}s</span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => { firedRef.current = true; onCancel?.(); }}
              className="block mx-auto mt-3 text-gray-500 text-[11px] font-bold underline-offset-4 hover:text-white hover:underline transition-colors"
              style={{ background: 'transparent' }}
            >
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function QuickMatchModal({ isOpen, onClose, onBack, userId, onMatchFound, presetMatch = null }) {
  useModalScrollLock(isOpen);
  const [step, setStep] = useState('config');
  const [buyIn, setBuyIn] = useState(10);
  const [gameMode, setGameMode] = useState('original');
  // Beta mode: force every match to ORIGINAL with no real-money buy-in.
  // The visual chooser still renders, but RUSH / TOURNAMENT are faded
  // and uninteractive, the buy-in row is hidden, and a beta notice is
  // shown in its place. Server enforces the same constraints.
  const isBeta = useBetaMode();
  useEffect(() => {
    if (isBeta) {
      setGameMode('original');
      setBuyIn(0);
    }
  }, [isBeta]);
  // Rush requires a live game — lock the chip when none are available.
  // We deliberately do NOT auto-downgrade rush → original here: doing so
  // silently turned a user's intended Rush match into a 24-hour Original
  // bet-balance battle whenever live games briefly disappeared. Instead
  // we keep the user's selection and block at submit time below with a
  // visible error so they can pick a different mode (or wait for a
  // live game) intentionally.
  const rushAvailable = useRushAvailability(isOpen);
  const [searchTime, setSearchTime] = useState(0);
  const [error, setError] = useState('');
  const [avatars, setAvatars] = useState([]);
  const [currentAvatarIdx, setCurrentAvatarIdx] = useState(0);
  const [avatarFlip, setAvatarFlip] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [currentRecord, setCurrentRecord] = useState('');
  const [matchedOpponent, setMatchedOpponent] = useState(null);
  const [matchedMatchup, setMatchedMatchup] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(false);
  // Rush in-popup flow state
  const [rushState, setRushState] = useState(null);
  const [serverLiveGames, setServerLiveGames] = useState([]);
  const [rushVoteError, setRushVoteError] = useState('');
  const [pendingVoteId, setPendingVoteId] = useState(null);
  const [countdownNum, setCountdownNum] = useState(3);
  const [voteDeadlineTick, setVoteDeadlineTick] = useState(0);
  const [pendingReady, setPendingReady] = useState(false);
  const [readyError, setReadyError] = useState('');
  const [pickedAnswer, setPickedAnswer] = useState(null); // { questionId, answerKey }
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const lastQuestionIdRef = useRef(null);
  const games = useGames();
  const apiGames = games?.apiGames;
  const { data: session } = useSession();
  const router = useRouter();
  const intervalRef = useRef(null);
  const pollRef = useRef(null);
  const avatarCycleRef = useRef(null);
  const flipTimeoutRef = useRef(null);
  const tipCycleRef = useRef(null);
  const tipFadeTimeoutRef = useRef(null);
  const cancelledRef = useRef(false);

  const cleanupAllTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pollRef.current) clearTimeout(pollRef.current);
    if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    if (tipCycleRef.current) clearInterval(tipCycleRef.current);
    if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
    intervalRef.current = null;
    pollRef.current = null;
    avatarCycleRef.current = null;
    flipTimeoutRef.current = null;
    tipCycleRef.current = null;
    tipFadeTimeoutRef.current = null;
  };

  useEffect(() => {
    if (isOpen) {
      cancelledRef.current = false;
      // When opened with a pre-resolved match, jump directly to the
      // "found" step so the modal acts as a hand-off popup for an
      // externally-driven matchmaking flow (e.g. the in-card search on
      // the homepage YouVsCard) without ever showing config/searching.
      if (presetMatch?.matchup) {
        cleanupAllTimers();
        setStep('found');
        setMatchedOpponent(presetMatch.opponent || null);
        setMatchedMatchup(presetMatch.matchup);
        if (typeof presetMatch.buyIn === 'number') setBuyIn(presetMatch.buyIn);
        if (typeof presetMatch.gameMode === 'string') setGameMode(presetMatch.gameMode);
        setError('');
      }
      fetch('/api/admin/battle-avatars')
        .then(r => r.json())
        .then(data => {
          if (data.avatars && data.avatars.length > 0) {
            setAvatars(data.avatars);
          }
        })
        .catch(() => {});
    }
    if (!isOpen) {
      cancelledRef.current = true;
      cleanupAllTimers();
      setStep('config');
      setSearchTime(0);
      setError('');
      setAvatarFlip(false);
      setCurrentAvatarIdx(0);
      setCurrentName('');
      setCurrentRecord('');
      setMatchedOpponent(null);
      setMatchedMatchup(null);
      setTipIndex(0);
      // Reset rush in-popup flow state so a fresh open doesn't carry
      // stale vote/state from a previous match into the next session.
      setRushState(null);
      setServerLiveGames([]);
      setRushVoteError('');
      setPendingVoteId(null);
      setCountdownNum(3);
      setPendingReady(false);
      setReadyError('');
      setPickedAnswer(null);
      setSubmittingAnswer(false);
      lastQuestionIdRef.current = null;
    }
    return () => { cleanupAllTimers(); };
    // `presetMatch` is included so a fresh hand-off (new opponent +
    // matchup pushed in while the modal is already mounted-but-closed
    // or even open) re-seeds the `found` step instead of being missed
    // until the next open/close cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, presetMatch]);

  useEffect(() => {
    if (isOpen && session?.user?.id) {
      fetch(`/api/profiles/${session.user.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setUserProfile(data.profile || data);
        })
        .catch(() => {});
    }
  }, [isOpen, session?.user?.id]);

  useEffect(() => {
    if (step === 'searching') {
      setCurrentName(FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)]);
      setCurrentRecord(FAKE_RECORDS[Math.floor(Math.random() * FAKE_RECORDS.length)]);

      avatarCycleRef.current = setInterval(() => {
        setAvatarFlip(true);
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        flipTimeoutRef.current = setTimeout(() => {
          setCurrentAvatarIdx(prev => {
            const pool = avatars.length > 0 ? avatars.length : 1;
            return (prev + 1 + Math.floor(Math.random() * Math.max(pool - 1, 1))) % pool;
          });
          setCurrentName(FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)]);
          setCurrentRecord(FAKE_RECORDS[Math.floor(Math.random() * FAKE_RECORDS.length)]);
          setAvatarFlip(false);
        }, 250);
      }, 1000);

      tipCycleRef.current = setInterval(() => {
        setTipFade(true);
        if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
        tipFadeTimeoutRef.current = setTimeout(() => {
          setTipIndex(prev => (prev + 1) % TIPS.length);
          setTipFade(false);
        }, 300);
      }, 4000);

      return () => {
        if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        if (tipCycleRef.current) clearInterval(tipCycleRef.current);
        if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
      };
    }
  }, [step, avatars]);

  // ========================================================================
  // Rush in-popup flow effects
  //
  // These power the trivia-crack-style ritual the user goes through when
  // a Rush match is found: brief "MATCH FOUND" beat → live-game vote →
  // rules slide → 3-2-1 countdown → handoff to /battle/rush/[id] for the
  // question gameplay. We poll the same /api/battles/rush/[id]/state
  // endpoint the routed page uses (and subscribe to its SSE channel) so
  // the modal stays in lock-step with the server-authoritative state
  // machine — votes, deadline expiry, and the voting→playing flip all
  // come from the same source of truth.
  // ========================================================================

  // Auto-advance from "MATCH FOUND" to the live-game vote slide for Rush.
  // Other modes (original / tournament) still show the Continue button.
  useEffect(() => {
    if (!isOpen) return;
    if (step !== 'found') return;
    if (gameMode !== 'rush') return;
    if (!matchedMatchup?.id) return;
    const t = setTimeout(() => {
      if (cancelledRef.current) return;
      setStep('rush-vote');
    }, RUSH_FOUND_TO_VOTE_DELAY_MS);
    return () => clearTimeout(t);
  }, [isOpen, step, gameMode, matchedMatchup?.id]);

  // Poll + SSE the rush state for the matched matchup whenever we're in
  // any rush sub-step. Polling at 750ms keeps the deadline countdown
  // smooth; SSE delivers near-instant updates for the voting→playing
  // flip and the opponent's vote landing.
  useEffect(() => {
    if (!isOpen) return;
    const inRushFlow =
      step === 'rush-vote' ||
      step === 'rush-ready' ||
      step === 'rush-countdown' ||
      step === 'rush-playing' ||
      step === 'rush-completed';
    if (!inRushFlow) return;
    const matchupId = matchedMatchup?.id;
    if (!matchupId) return;

    let cancelled = false;
    const fetchRush = async () => {
      try {
        const res = await fetch(`/api/battles/rush/${matchupId}/state`);
        if (cancelled || !res.ok) return;
        const j = await res.json();
        if (!cancelled) setRushState(j.rush || null);
      } catch {}
    };
    fetchRush();
    const t = setInterval(fetchRush, RUSH_STATE_POLL_MS);

    let unsub = null;
    try {
      const client = getBattleStreamClient();
      if (client) {
        unsub = client.subscribe((ev) => {
          if (!ev) return;
          if (ev.type === 'matchup:rush:update' && ev.matchupId === matchupId) fetchRush();
          else if (ev.type === 'piks:reconnected') fetchRush();
        });
      }
    } catch {}

    return () => {
      cancelled = true;
      clearInterval(t);
      if (unsub) { try { unsub(); } catch {} }
    };
  }, [isOpen, step, matchedMatchup?.id]);

  // Tick once a second on the vote slide so the deadline ring stays in
  // sync without us having to lean on the polling response time.
  useEffect(() => {
    if (step !== 'rush-vote') return;
    const t = setInterval(() => setVoteDeadlineTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  // Load the live-game list from the dedicated endpoint while voting.
  // We merge this with the dashboard's GamesContext stream below so
  // demo / simulated live games still show up here.
  useEffect(() => {
    if (step !== 'rush-vote') return;
    let cancelled = false;
    fetch('/api/goalserve/live')
      .then(r => r.json())
      .then(j => { if (!cancelled) setServerLiveGames(j?.games || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [step]);

  // Detect server-side voting resolution → advance to ready slide.
  // We hold on the vote slide for 3 full seconds once the phase flips
  // so the user can actually see the opponent's checkmark on the game
  // card they picked (and the "Locked!" / "Host wins" pill) before
  // the modal jumps to the rules / ready slide. The vote slide also
  // shows a "Continue" button during this window so users can skip
  // the wait if they've already registered the opponent's pick.
  useEffect(() => {
    if (step !== 'rush-vote') return;
    const phase = rushState?.phase;
    if (phase !== 'ready_check' && phase !== 'playing' && phase !== 'completed') return;
    const t = setTimeout(() => {
      if (cancelledRef.current) return;
      setStep('rush-ready');
    }, 3000);
    return () => clearTimeout(t);
  }, [step, rushState?.phase]);

  // Deadlock guard: if the vote deadline has passed and neither player
  // ever voted, the server-side resolveVotingIfReady() leaves phase as
  // 'voting' indefinitely (chosen vote is null, no question generation
  // possible). Without this guard the modal would spin forever waiting
  // for a phase flip that never comes. After a 4s grace past deadline
  // we hand off to the routed rush page where the full forfeit /
  // refund UX lives.
  useEffect(() => {
    if (step !== 'rush-vote') return;
    if (!rushState || rushState.phase !== 'voting') return;
    const deadline = rushState.voteDeadline ? new Date(rushState.voteDeadline).getTime() : null;
    if (!deadline) return;
    const matchupId = matchedMatchup?.id;
    if (!matchupId) return;
    const myVote = userId ? rushState.gameVotes?.[userId] : null;
    const opponentId = matchedOpponent?.id;
    const oppVote = opponentId ? rushState.gameVotes?.[opponentId] : null;
    // Only kick in when nobody voted — single-vote expiry is handled
    // server-side and will flip to 'playing' on the next state read.
    if (myVote || oppVote) return;
    const overdueBy = Date.now() - deadline;
    if (overdueBy <= 4000) return;
    onClose();
    router.push(`/battle/rush/${matchupId}`);
  }, [step, rushState, matchedMatchup?.id, matchedOpponent?.id, userId, voteDeadlineTick, onClose, router]);

  // Ready slide → 3-2-1 countdown. Both players have to tap "Ready"
  // (the bot is auto-readied server-side after 3s); the moment the
  // server flips phase to 'playing' we kick the countdown.
  useEffect(() => {
    if (step !== 'rush-ready') return;
    if (rushState?.phase === 'playing' || rushState?.phase === 'completed') {
      setCountdownNum(3);
      setStep('rush-countdown');
    }
  }, [step, rushState?.phase]);

  // 3-2-1-GO countdown ticker. After the GO! flash we transition to
  // the in-popup gameplay step (the routed /battle/rush/[id] page is
  // still available as a fallback for refresh / deep-link).
  useEffect(() => {
    if (step !== 'rush-countdown') return;
    if (countdownNum > 0) {
      const t = setTimeout(() => {
        if (cancelledRef.current) return;
        setCountdownNum(n => n - 1);
        haptic.tap?.();
      }, RUSH_COUNTDOWN_TICK_MS);
      return () => clearTimeout(t);
    }
    // countdownNum === 0 → show "GO!" briefly, then advance to the
    // in-popup playing slide.
    const t = setTimeout(() => {
      if (cancelledRef.current) return;
      const matchupId = matchedMatchup?.id;
      if (!matchupId) return;
      setStep('rush-playing');
    }, RUSH_GO_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, countdownNum, matchedMatchup?.id]);

  // Reset the locally-picked answer whenever the question rolls over so
  // the "your pick" highlight doesn't bleed across questions.
  useEffect(() => {
    if (step !== 'rush-playing') return;
    const currQ = rushState?.questions?.[rushState?.currentQuestionIndex];
    if (currQ && currQ.id !== lastQuestionIdRef.current) {
      lastQuestionIdRef.current = currQ.id;
      setPickedAnswer(null);
    }
  }, [step, rushState?.questions, rushState?.currentQuestionIndex]);

  // Detect server-side completion → flip to result slide. We pick this
  // up from rushState.phase rather than waiting on the answer POST so
  // a deadline expiry on the final question still triggers the result.
  useEffect(() => {
    if (step !== 'rush-playing') return;
    if (rushState?.phase === 'completed') {
      setStep('rush-completed');
    }
  }, [step, rushState?.phase]);

  // Result slide auto-exits to /battle after a beat so the user lands
  // back where the result-popup SSE plumbing can take over.
  useEffect(() => {
    if (step !== 'rush-completed') return;
    const t = setTimeout(() => {
      if (cancelledRef.current) return;
      onClose();
      router.push('/battle');
    }, RUSH_RESULT_AUTO_EXIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Stale ready-check escape: server flips rushState.phase to
  // 'cancelled' after READY_STALE_CANCEL_MS when an opponent ghosts
  // the ready check. Close the in-popup ritual and route back to
  // /battle so the user isn't stranded — no penalty, no payout.
  useEffect(() => {
    const inRushSubStep =
      step === 'rush-vote' ||
      step === 'rush-ready' ||
      step === 'rush-countdown' ||
      step === 'rush-playing';
    if (!inRushSubStep) return;
    if (rushState?.phase !== 'cancelled') return;
    if (cancelledRef.current) return;
    onClose();
    router.push('/battle?rushCancelled=1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, rushState?.phase]);

  // Live games for the vote slide. Merge server list + GamesContext
  // (mirrors the routed rush page's logic) so demo / simulated live
  // games surface here too. Cap at RUSH_VOTE_GAME_LIMIT so the slide
  // stays a snappy 3-card pick rather than a long scroll.
  const liveGamesForVote = useMemo(() => {
    const seen = new Set();
    const out = [];
    const push = (g) => {
      if (!g) return;
      const key = `${g.sport_key || ''}::${g.id ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(g);
    };
    // Pull from GamesContext FIRST so the rush vote slide shows the
    // exact same live games (in the same order) the user is already
    // seeing on the dashboard. The server list is a backstop in case
    // GamesContext hasn't hydrated yet.
    if (Array.isArray(apiGames)) {
      apiGames.forEach((g) => { if (g && g.isLive) push(g); });
    }
    serverLiveGames.forEach(push);
    return out.slice(0, RUSH_VOTE_GAME_LIMIT);
  }, [serverLiveGames, apiGames]);

  const submitRushVote = async (game) => {
    const matchupId = matchedMatchup?.id;
    if (!matchupId || pendingVoteId) return;
    setPendingVoteId(String(game.id));
    setRushVoteError('');
    haptic.tap?.();
    try {
      // Normalize across API/Goalserve and simulated/demo shapes so the
      // server-side question generator (lib/rush.js) always sees populated
      // team / sport fields regardless of where the live game came from.
      const snapshot = {
        id: game.id,
        sport_key: game.sport_key || game.sport || null,
        sport_title: game.sport_title || game.sportName || game.sport || 'LIVE',
        home_team: game.home_team || game.homeTeamFull || game.homeTeam || 'Home',
        away_team: game.away_team || game.awayTeamFull || game.awayTeam || 'Away',
        scores: game.scores,
        status: game.status,
        isLive: !!(game.isLive || game.status === 'IN_PROGRESS' || game.status === 'live'),
      };
      const res = await fetch(`/api/battles/rush/${matchupId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: String(game.id), gameSnapshot: snapshot }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setRushVoteError(j.error || 'Failed to vote');
      } else {
        // Refetch immediately so the local state shows our vote without
        // waiting for the next 750ms poll tick.
        try {
          const j = await fetch(`/api/battles/rush/${matchupId}/state`).then(r => r.json());
          setRushState(j.rush || null);
        } catch {}
      }
    } catch (err) {
      setRushVoteError(err?.message || 'Network error');
    } finally {
      setPendingVoteId(null);
    }
  };

  const submitRushReady = async () => {
    const matchupId = matchedMatchup?.id;
    if (!matchupId || pendingReady) return;
    setPendingReady(true);
    setReadyError('');
    haptic.tap?.();
    try {
      // Send an explicit empty body so Next.js' body parser doesn't
      // hit "Unexpected end of JSON input" on Content-Type:
      // application/json with no payload (some edge runtimes treat
      // this as an error and reject the request before our handler
      // ever runs, which surfaces to the user as "Failed to mark
      // ready").
      const res = await fetch(`/api/battles/rush/${matchupId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        // 409 = phase already past ready_check; harmless.
        if (res.status !== 409) {
          // Surface the real server error (e.g. 'Matchup already
          // cancelled', 'Not in ready_check phase') instead of a
          // generic message so we can actually diagnose what went
          // wrong from the user's screen.
          setReadyError(j.error || `Ready failed (HTTP ${res.status})`);
        }
      }
      // Refetch immediately so the local state reflects our ready
      // without waiting for the next 750ms poll tick.
      try {
        const j = await fetch(`/api/battles/rush/${matchupId}/state`).then(r => r.json());
        setRushState(j.rush || null);
      } catch {}
    } catch (err) {
      setReadyError(err?.message || 'Network error');
    } finally {
      setPendingReady(false);
    }
  };

  const submitRushAnswer = async (questionId, answerKey) => {
    const matchupId = matchedMatchup?.id;
    if (!matchupId || submittingAnswer) return;
    setSubmittingAnswer(true);
    setPickedAnswer({ questionId, answerKey });
    haptic.tap?.();
    try {
      const res = await fetch(`/api/battles/rush/${matchupId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answerKey }),
      });
      if (!res.ok && res.status !== 409) {
        // 409 just means the server already advanced — not an error.
        // No-op; the next poll will resync.
      }
      try {
        const j = await fetch(`/api/battles/rush/${matchupId}/state`).then(r => r.json());
        setRushState(j.rush || null);
      } catch {}
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const isInRushFlow =
    step === 'rush-vote' ||
    step === 'rush-ready' ||
    step === 'rush-countdown' ||
    step === 'rush-playing' ||
    step === 'rush-completed';

  // Closing the modal mid-rush would orphan the user in an active
  // matchup. Instead, hand them off to the routed gameplay page so
  // they can finish (or forfeit) from there.
  const handleClose = () => {
    if (isInRushFlow && matchedMatchup?.id) {
      onClose();
      router.push(`/battle/rush/${matchedMatchup.id}`);
      return;
    }
    onClose();
  };

  const handleMatchFound = (opponent, matchup) => {
    if (cancelledRef.current) return;
    cleanupAllTimers();
    if (!matchup) {
      setError('Matchmaking timed out. Please try again.');
      setStep('config');
      return;
    }
    if (opponent) setMatchedOpponent(opponent);
    setMatchedMatchup(matchup);
    setStep('found');
  };

  const handleContinue = () => {
    onClose();
    if (onMatchFound && matchedMatchup) onMatchFound(matchedMatchup, matchedOpponent);
    else navigateToBattleStart(router, matchedMatchup);
  };

  const startSearch = async () => {
    // Hard guard: if the user has Rush selected but no live games are
    // available right now, abort with a visible error instead of letting
    // the queue silently start an Original-mode battle.
    if (gameMode === 'rush' && rushAvailable === false) {
      setError('Rush needs a live game in progress. Pick another mode or try again when one tips off.');
      haptic.warning && haptic.warning();
      return;
    }

    cancelledRef.current = false;
    setStep('searching');
    setSearchTime(0);
    setError('');

    intervalRef.current = setInterval(() => {
      setSearchTime(t => t + 1);
    }, 1000);

    try {
      const res = await fetch('/api/battles/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyIn, gameMode }),
      });
      if (cancelledRef.current) return;
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Matchmaking failed');
        setStep('config');
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      const data = await res.json();

      if (data.matched) {
        handleMatchFound(data.opponent, data.matchup);
      } else {
        pollForMatch();
      }
    } catch {
      if (cancelledRef.current) return;
      setError('Failed to start matchmaking');
      setStep('config');
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const pollForMatch = () => {
    let attempts = 0;
    const poll = async () => {
      if (cancelledRef.current) return;
      attempts++;
      try {
        const res = await fetch('/api/matchups/current');
        if (cancelledRef.current) return;
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'active' || data.status === 'matched') {
          if (data.matchup) {
            handleMatchFound(data.opponent, data.matchup);
            return;
          }
        }
      } catch {}

      if (cancelledRef.current) return;

      // Scan real eligible players for ~16s (8 polls × 2s) before
      // handing off to the bot pool. Combined with the initial 2s
      // wait this keeps total wait under 20s as designed.
      if (attempts < 8) {
        pollRef.current = setTimeout(poll, 2000);
      } else {
        try {
          const fakeRes = await fetch('/api/matchups/assign-opponent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          if (cancelledRef.current) return;
          const fakeData = fakeRes.ok ? await fakeRes.json() : null;
          handleMatchFound(fakeData?.opponent, fakeData?.matchup);
        } catch {
          if (cancelledRef.current) return;
          setError('Matchmaking timed out. Please try again.');
          setStep('config');
          cleanupAllTimers();
        }
      }
    };
    pollRef.current = setTimeout(poll, 2000);
  };

  const cancelSearch = async () => {
    cancelledRef.current = true;
    cleanupAllTimers();
    try {
      await fetch('/api/battles/matchmaking', { method: 'DELETE' });
      await fetch('/api/matchups/queue', { method: 'DELETE' });
    } catch {}
    setStep('config');
    setSearchTime(0);
  };

  if (!isOpen) return null;

  const potSize = buyIn * 2;
  const payout = potSize * 0.9;
  const currentAvatar = avatars.length > 0 ? avatars[currentAvatarIdx % avatars.length] : null;
  const userName = userProfile?.username || session?.user?.name || 'You';
  const userAvatar = userProfile?.avatar || null;
  const selectedMode = GAME_MODE_OPTIONS.find(m => m.id === gameMode);
  const matchedAvatar = matchedOpponent?.avatar || currentAvatar || null;

  const th = {
    overlay: 'bg-black/85',
    cardBg: '#0d0d0d',
    cardBorder: '#1a1a1a',
    headerText: 'text-white',
    subText: 'text-gray-400',
    labelText: 'text-gray-400',
    btnBg: '#111',
    btnBorder: '#1a1a1a',
    btnText: 'text-gray-300',
    modeText: 'text-white',
    modeDesc: 'text-gray-500',
    modeBtnBg: '#111',
    infoBg: '#111',
    infoBorder: '#1a1a1a',
    infoLabel: 'text-gray-400',
    infoValue: 'text-white',
    avatarBg1: '#0c1a35',
    avatarBg2: '#1a0a00',
    nameText: 'text-white',
    cancelText: 'text-gray-300',
    closeBtn: 'text-gray-400 hover:text-white',
    fallbackText: 'text-white/60',
  };

  // Portal the entire modal to <body> so its `fixed inset-0` overlay
  // always covers the viewport. Without this, callers that mount the
  // modal inside a CSS-transformed/filtered/contained ancestor (e.g.
  // YouVsCard inside the dashboard's LiveBattlesSection) would have
  // the overlay clipped to that ancestor's containing block, making
  // the popup appear to "fill the card" instead of opening as a real
  // modal. Every other battle modal (BattleModeChooser,
  // PlayFriendModal, PrivateMatchModal, PreMatchPopup) already does
  // this — bringing QuickMatchModal in line.
  if (typeof window === 'undefined' || !document?.body) {
    return null;
  }

  const modalContent = (
    <>
      {/* Ensure the shared cartoon-chip keyframes are present even when
          the modal opens from a page that doesn't render
          LiveBattlesSection. Safe to render alongside the LiveBattles
          copy — duplicate @keyframes are idempotent. */}
      <CartoonChipStyles />
      <style>{`
        @keyframes qm-pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.12); opacity: 0.15; }
          100% { transform: scale(1); opacity: 0.5; }
        }
        @keyframes qm-avatar-flip-in {
          0% { transform: rotateY(90deg) scale(0.8); opacity: 0; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes qm-avatar-flip-out {
          0% { transform: rotateY(0deg) scale(1); opacity: 1; }
          100% { transform: rotateY(-90deg) scale(0.8); opacity: 0; }
        }
        @keyframes qm-vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes qm-bolt-flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes qm-sparkle-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes qm-ring-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes qm-matched-slam {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes qm-green-flash {
          0% { opacity: 0; }
          25% { opacity: 0.4; }
          100% { opacity: 0; }
        }
        @keyframes qm-avatar-lock {
          0% { transform: scale(1.2); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8); }
          50% { transform: scale(1.02); box-shadow: 0 0 30px 8px rgba(16, 185, 129, 0.4); }
          100% { transform: scale(1); box-shadow: 0 0 15px 4px rgba(16, 185, 129, 0.2); }
        }
        @keyframes qm-found-ring-expand {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes qm-tip-fade-in {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes qm-user-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(59,130,246,0.4); }
          50% { box-shadow: 0 0 30px rgba(59,130,246,0.6); }
        }
        @keyframes qm-opp-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(251,146,60,0.4); }
          50% { box-shadow: 0 0 30px rgba(251,146,60,0.6); }
        }
        @keyframes qm-timer-tick {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes qm-name-slide {
          0% { transform: translateX(15px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes qm-topo-shift {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
        /* Gamified amplifiers (cartoon dial-up) */
        @keyframes qm-streak {
          0%   { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
          20%  { opacity: 0.85; }
          80%  { opacity: 0.85; }
          100% { transform: translateX(120%) skewX(-20deg); opacity: 0; }
        }
        @keyframes qm-spark-twinkle {
          0%, 100% { transform: scale(0.4) rotate(0deg); opacity: 0; }
          50%      { transform: scale(1) rotate(180deg);  opacity: 1; }
        }
        @keyframes qm-orbit {
          from { transform: rotate(0deg) translateX(48px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(48px) rotate(-360deg); }
        }
        @keyframes qm-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes qm-banner-bounce {
          0%   { transform: translateY(-30px) scale(0.6) rotate(-4deg); opacity: 0; }
          55%  { transform: translateY(8px)   scale(1.08) rotate(2deg);  opacity: 1; }
          75%  { transform: translateY(-4px)  scale(0.96) rotate(-1deg); }
          100% { transform: translateY(0)     scale(1)    rotate(0deg);  opacity: 1; }
        }
        @keyframes qm-found-flash {
          0%   { opacity: 0; }
          20%  { opacity: 0.55; }
          100% { opacity: 0; }
        }
        @keyframes qm-shake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-3px, 1px); }
          20% { transform: translate(3px, -1px); }
          30% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); }
          50% { transform: translate(-2px, 1px); }
          60% { transform: translate(2px, 1px); }
          70% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); }
          90% { transform: translate(-1px, 0); }
        }
        @keyframes qm-slam-from-left {
          0%   { transform: translateX(-260px) rotate(-18deg) scale(0.6); opacity: 0; }
          70%  { transform: translateX(14px)   rotate(6deg)   scale(1.08); opacity: 1; }
          100% { transform: translateX(0)      rotate(0deg)   scale(1);   opacity: 1; }
        }
        @keyframes qm-slam-from-right {
          0%   { transform: translateX(260px) rotate(18deg)  scale(0.6); opacity: 0; }
          70%  { transform: translateX(-14px) rotate(-6deg)  scale(1.08); opacity: 1; }
          100% { transform: translateX(0)     rotate(0deg)   scale(1);   opacity: 1; }
        }
        @keyframes qm-impact-burst {
          0%   { transform: scale(0); opacity: 0; }
          25%  { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes qm-impact-line {
          0%   { transform: scaleX(0); opacity: 0; }
          30%  { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(1.3); opacity: 0; }
        }
        @keyframes qm-vs-explode {
          0%   { transform: scale(0.2) rotate(-30deg); opacity: 0; }
          55%  { transform: scale(1.6) rotate(8deg);   opacity: 1; }
          75%  { transform: scale(0.92) rotate(-3deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes qm-confetti-fall {
          0%   { transform: translate3d(0, -40px, 0) rotate(0deg);    opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(var(--qm-x, 0px), 320px, 0) rotate(720deg); opacity: 0; }
        }
        @keyframes qm-cta-throb {
          0%, 100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 4px 0 #0a0a0a, 0 0 20px rgba(59,130,246,0.45);
          }
          50% {
            transform: translateY(-2px) scale(1.025);
            box-shadow: 0 6px 0 #0a0a0a, 0 0 36px rgba(59,130,246,0.85);
          }
        }
        @keyframes qm-pot-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .qm-amp, .qm-amp * { animation: none !important; }
        }
      `}</style>
      <div data-allow-fixed-overlay="true" className={`fixed inset-0 ${th.overlay} backdrop-blur-sm z-50 overflow-y-auto`} onClick={() => {
        // 'found' is a hard pause — clicks outside don't dismiss it.
        // The new rush sub-steps are also non-dismissable on backdrop
        // click since the user is already in an active matchup; the
        // explicit close button (which routes to /battle/rush/[id])
        // remains the only way out.
        if (step === 'found' || isInRushFlow) return;
        if (step === 'searching') { cancelSearch(); }
        onClose();
      }}>
        {/* Inner wrapper handles centering. We use min-h-full + flex so that
            when the modal is shorter than the viewport it stays vertically
            centered, but when the modal is TALLER than the viewport (very
            common on iPhone with the iOS browser chrome eating ~150px of
            vertical space) the wrapper grows with the content and the
            outer overlay scrolls naturally. Without this split the classic
            `items-center` flexbox bug clips the top of the modal and makes
            the header unreachable on small viewports. */}
        <div className="min-h-full flex items-center justify-center p-4">
        <div
          className="qm-frame max-w-md w-full overflow-hidden relative"
          style={{
            background: 'linear-gradient(180deg, #0b1830 0%, #061022 55%, #03070f 100%)',
            border: '2.5px solid #0a0a0a',
            borderRadius: 22,
            boxShadow:
              '0 4px 0 #0a0a0a, 0 10px 60px rgba(0,0,0,0.7), 0 0 90px rgba(6,182,212,0.25), inset 0 0 0 1.5px rgba(6,182,212,0.55), inset 0 0 30px rgba(6,182,212,0.08)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Cyan corner brackets — give the modal a "gaming HUD" frame. */}
          {['tl','tr','bl','br'].map(pos => {
            const base = { position: 'absolute', width: 22, height: 22, pointerEvents: 'none', zIndex: 3 };
            const stroke = '2.5px solid #06b6d4';
            const glow = { filter: 'drop-shadow(0 0 6px rgba(6,182,212,0.8))' };
            const map = {
              tl: { top: 8, left: 8, borderTop: stroke, borderLeft: stroke, borderTopLeftRadius: 8 },
              tr: { top: 8, right: 8, borderTop: stroke, borderRight: stroke, borderTopRightRadius: 8 },
              bl: { bottom: 8, left: 8, borderBottom: stroke, borderLeft: stroke, borderBottomLeftRadius: 8 },
              br: { bottom: 8, right: 8, borderBottom: stroke, borderRight: stroke, borderBottomRightRadius: 8 },
            };
            return <span key={pos} aria-hidden="true" style={{ ...base, ...map[pos], ...glow }} />;
          })}
          {step === 'config' && (
            <>
              {/* Header — mirrors PlayFriendModal exactly so the two
                  popups read as one design system. The only thing
                  that changes between them is the title copy and the
                  "challenging" card below. */}
              <div className="px-5 pt-7 pb-0 flex-shrink-0 relative">
                {/* Floating close button — sits in the top-right HUD
                    corner instead of competing with the centered title. */}
                <button
                  aria-label="Close"
                  onClick={onClose}
                  className="msg-cartoon-btn w-9 h-9 rounded-full flex items-center justify-center absolute"
                  style={{ top: 18, right: 18, backgroundColor: '#0a0f1c', border: '2px solid #06b6d4', boxShadow: '0 3px 0 #0a0a0a, 0 0 10px rgba(6,182,212,0.6)', zIndex: 5 }}
                >
                  <svg className="w-4 h-4" style={{ color: '#7dd3fc' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <button
                  aria-label="Back"
                  onClick={onBack || onClose}
                  className="msg-cartoon-btn w-9 h-9 rounded-full flex items-center justify-center absolute"
                  style={{ top: 18, left: 18, backgroundColor: '#0a0f1c', border: '2px solid #06b6d4', boxShadow: '0 3px 0 #0a0a0a, 0 0 10px rgba(6,182,212,0.6)', zIndex: 5 }}
                >
                  <svg className="w-4 h-4" style={{ color: '#7dd3fc' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {/* Centered hero title — full-width "QUICK MATCH" with
                    decorative lightning bolts flanking it on both sides.
                    Padded horizontally so the title never slides under
                    the back / close HUD buttons. */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 mt-1 px-12 sm:px-14">
                  <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 0 12px rgba(250,204,21,0.85)) drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                  <h2
                    id="qm-title"
                    className="font-black uppercase text-center"
                    style={{
                      fontSize: 'clamp(28px, 8vw, 44px)',
                      lineHeight: 0.92,
                      letterSpacing: '0.01em',
                      fontStyle: 'italic',
                      WebkitTextStroke: '1.5px #0a0a0a',
                      textShadow: '0 3px 0 #0a0a0a, 0 0 38px rgba(6,182,212,0.75), 0 0 18px rgba(255,255,255,0.45)',
                      background: 'linear-gradient(180deg, #ffffff 0%, #94a3b8 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }}
                  >
                    Quick Match
                  </h2>
                  <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 0 12px rgba(250,204,21,0.85)) drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: 'linear-gradient(90deg, transparent, #06b6d4)', boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
                  <p
                    className="font-black uppercase whitespace-nowrap text-center"
                    style={{
                      color: '#7dd3fc',
                      fontSize: '11px',
                      letterSpacing: '0.22em',
                      textShadow: '0 0 10px rgba(6,182,212,0.7)',
                      margin: 0,
                    }}
                  >
                    Instant Matchmaking · Real Competition
                  </p>
                  <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: 'linear-gradient(270deg, transparent, #06b6d4)', boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
                </div>
              </div>

              <div className="px-5 pb-5 space-y-4">
                {error && (
                  <div
                    className="rounded-2xl px-3 py-2.5 text-xs leading-snug"
                    style={{
                      background: 'linear-gradient(180deg, rgba(248,113,113,0.16), rgba(248,113,113,0.06))',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 4px 0 #0a0a0a',
                      color: '#fecaca',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* "Random opponent" card — visual analogue of the
                    "CHALLENGING {friend}" card in PlayFriendModal so
                    the layout is identical, but the eyebrow + label
                    explain that matchmaking will pick a stranger
                    instead of expecting the user to pick someone. */}
                {/* Opponent "Random Match — we'll find you someone of
                    similar skill" row removed — read as a technical
                    matchmaker disclaimer instead of a gamified prompt.
                    The mode tiles + Find Opponent CTA below already
                    communicate "tap to draw a stranger". */}

                {/* Buy-in tiles — hidden during beta (ranking-only, no $). */}
                {isBeta ? (
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                      style={{
                        background: 'linear-gradient(180deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a, 0 0 18px rgba(16,185,129,0.35)',
                      }}
                    >
                      <span className="text-sm leading-none" aria-hidden="true">🛡️</span>
                      <span
                        className="font-black uppercase"
                        style={{ color: '#34d399', fontSize: 10, letterSpacing: '0.22em' }}
                      >
                        Beta · Ranking Enabled
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: '#94a3b8', lineHeight: 1.4 }}>
                      Climb the leaderboard. Prove you're the best.
                    </p>
                  </div>
                ) : (
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider mb-2 block" style={{ color: '#6b7280' }}>Buy-In</label>
                  <div className="grid grid-cols-5 gap-2">
                    {BUY_IN_OPTIONS.map(amount => {
                      const selected = buyIn === amount;
                      return (
                        <button
                          key={amount}
                          onClick={() => setBuyIn(amount)}
                          className="msg-cartoon-btn py-2 rounded-xl text-sm font-extrabold"
                          style={
                            selected
                              ? {
                                  background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                  color: '#fff',
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(59,130,246,0.45)',
                                  textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                                }
                              : {
                                  backgroundColor: '#111',
                                  color: '#9ca3af',
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: '0 3px 0 #0a0a0a',
                                }
                          }
                        >
                          ${amount}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* Game-mode rich tiles — the high-information layout
                    the user explicitly called out as the better one.
                    Identical to PlayFriendModal so both modals share
                    one mental model. */}
                <div>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.45))' }} />
                    <span
                      className="font-black uppercase whitespace-nowrap"
                      style={{
                        color: '#bfdbfe',
                        fontSize: 10,
                        letterSpacing: '0.28em',
                        textShadow: '0 0 10px rgba(59,130,246,0.4)',
                      }}
                    >
                      ◆ Choose Your Game Mode ◆
                    </span>
                    <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, transparent, rgba(96,165,250,0.45))' }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {GAME_MODE_OPTIONS.map(mode => {
                      const selected = gameMode === mode.id;
                      const betaLocked = isBeta && mode.id !== 'original';
                      const locked = betaLocked || (mode.id === 'rush' && rushAvailable === false);
                      const isRush = mode.id === 'rush';
                      const rushLive = !betaLocked && isRush && rushAvailable === true;
                      const hex = (mode.color || '#3b82f6').replace('#', '');
                      const r = parseInt(hex.substring(0, 2), 16);
                      const g = parseInt(hex.substring(2, 4), 16);
                      const b = parseInt(hex.substring(4, 6), 16);
                      const glow = `rgba(${r},${g},${b},0.45)`;
                      const tint = `rgba(${r},${g},${b},0.18)`;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => { if (!locked) setGameMode(mode.id); }}
                          aria-disabled={locked || undefined}
                          aria-pressed={selected}
                          title={betaLocked ? 'Available after the public beta — Original is the only mode during beta.' : (locked ? 'Rush needs a live game in progress — try again when one tips off.' : undefined)}
                          className={`msg-cartoon-btn flex flex-col items-center text-center px-1.5 pt-6 rounded-2xl relative overflow-hidden ${betaLocked ? 'pb-7' : 'pb-2.5'}`}
                          style={
                            betaLocked
                              ? {
                                  background: `linear-gradient(180deg, ${tint} 0%, rgba(${r},${g},${b},0.06) 100%), #0a0a0a`,
                                  border: `2.5px solid ${mode.color}`,
                                  boxShadow: `0 4px 0 #0a0a0a, 0 0 18px ${glow}`,
                                  cursor: 'not-allowed',
                                  minHeight: 132,
                                }
                              : selected
                              ? {
                                  background: `linear-gradient(180deg, rgba(${r},${g},${b},0.32) 0%, rgba(${r},${g},${b},0.08) 100%), #0a0a0a`,
                                  border: `2.5px solid ${mode.color}`,
                                  boxShadow: `0 4px 0 #0a0a0a, 0 0 26px ${glow}, inset 0 0 0 1px rgba(255,255,255,0.06)`,
                                  opacity: locked ? 0.5 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 132,
                                }
                              : {
                                  background: `linear-gradient(180deg, ${tint} 0%, rgba(${r},${g},${b},0.05) 100%), #0a0a0a`,
                                  border: `2.5px solid ${mode.color}`,
                                  boxShadow: `0 4px 0 #0a0a0a, 0 0 18px ${glow}`,
                                  opacity: locked ? 0.5 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 132,
                                }
                          }
                        >
                          {betaLocked && (
                            <>
                              {/* Dark veil + heavy desaturation so the
                                  tile reads as inactive at a glance,
                                  without losing its mode-color identity
                                  completely. */}
                              <span
                                aria-hidden="true"
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  background:
                                    'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.6) 100%)',
                                  backdropFilter: 'grayscale(0.5)',
                                  WebkitBackdropFilter: 'grayscale(0.5)',
                                  borderRadius: 'inherit',
                                  zIndex: 1,
                                }}
                              />
                              {/* Full-width yellow "🔒 COMING SOON" footer
                                  bar — unmistakable inactivity signal
                                  spanning the entire bottom edge of the
                                  tile, with reserved tile padding so
                                  the icon/label/coins still sit above
                                  the bar instead of overlapping it. */}
                              <span
                                aria-hidden="true"
                                className="absolute left-0 right-0 bottom-0 inline-flex items-center justify-center gap-1 pointer-events-none font-black uppercase select-none"
                                style={{
                                  fontSize: 9,
                                  letterSpacing: '0.18em',
                                  color: '#0a0a0a',
                                  background: 'linear-gradient(180deg,#fde047,#facc15)',
                                  borderTop: '2px solid #0a0a0a',
                                  padding: '4px 4px 5px',
                                  lineHeight: 1,
                                  zIndex: 4,
                                  whiteSpace: 'nowrap',
                                  textShadow: 'none',
                                }}
                              >
                                <span style={{ fontSize: 10 }}>🔒</span>
                                Coming Soon
                              </span>
                            </>
                          )}
                          {mode.recommended && (
                            // Sit the Popular badge *inside* the tile
                            // (top: 6) rather than overflowing above
                            // it. The parent button uses
                            // overflow-hidden to clip the betaLocked
                            // dark veil to the rounded corners, which
                            // was also clipping a `-top-2` badge and
                            // cutting it off at the modal's top edge.
                            <span
                              className="absolute left-1/2 -translate-x-1/2 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                top: 6,
                                background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                                zIndex: 2,
                              }}
                            >
                              Popular
                            </span>
                          )}
                          {rushLive && (
                            <span
                              className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                top: 6,
                                background: 'linear-gradient(180deg,#f59e0b,#d97706)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                                zIndex: 2,
                              }}
                              aria-hidden="true"
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: '50%',
                                  backgroundColor: '#fff',
                                  boxShadow: '0 0 6px rgba(255,255,255,0.95)',
                                }}
                              />
                              Live
                            </span>
                          )}
                          {/* Non-beta lock pill (e.g. Rush has no live
                              game). The beta-locked case now uses the
                              full-tile blackout + COMING SOON watermark
                              instead of a top pill that overlapped the
                              "Popular" badge on the neighboring tile. */}
                          {locked && !betaLocked && (
                            <span
                              className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                top: 6,
                                background: 'linear-gradient(180deg,#374151,#1f2937)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                                zIndex: 2,
                              }}
                              aria-hidden="true"
                            >
                              <span style={{ fontSize: 9, lineHeight: 1 }}>🔒</span>
                              Locked
                            </span>
                          )}
                          {/* Internal radial color glow — gives each tile
                              the "trading card" look from the mockup. */}
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `radial-gradient(ellipse at 50% 38%, ${glow} 0%, transparent 60%)`,
                              borderRadius: 'inherit',
                              opacity: betaLocked ? 0.55 : 0.9,
                            }}
                          />
                          {/* Mode-specific themed backdrop. Each tile gets
                              its own decorative pattern so RUSH feels like
                              electric speed, ORIGINAL like a balanced
                              trophy stage, and TOURNAMENT like a royal
                              crown arena. */}
                          {mode.id === 'rush' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 pointer-events-none overflow-hidden"
                              style={{ borderRadius: 'inherit', opacity: betaLocked ? 0.3 : 0.9 }}
                            >
                              <span
                                className="absolute inset-0"
                                style={{
                                  background:
                                    'repeating-linear-gradient(115deg, rgba(16,185,129,0.18) 0 6px, transparent 6px 16px)',
                                }}
                              />
                              <span style={{ position: 'absolute', top: 8, left: 6, fontSize: 16, opacity: 0.55, color: '#fde047', filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.8))' }}>⚡</span>
                              <span style={{ position: 'absolute', bottom: 30, right: 6, fontSize: 14, opacity: 0.5, color: '#fde047', filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.8))', transform: 'rotate(18deg)' }}>⚡</span>
                            </span>
                          )}
                          {mode.id === 'original' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 pointer-events-none overflow-hidden"
                              style={{ borderRadius: 'inherit', opacity: betaLocked ? 0.3 : 0.85 }}
                            >
                              <span
                                className="absolute inset-0"
                                style={{
                                  background:
                                    'radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.22) 0%, transparent 55%)',
                                }}
                              />
                              <span
                                className="absolute"
                                style={{
                                  top: 14, left: '50%', transform: 'translateX(-50%)',
                                  width: 56, height: 26, borderRadius: '50%',
                                  background: 'radial-gradient(ellipse, rgba(250,204,21,0.45), transparent 70%)',
                                  filter: 'blur(2px)',
                                }}
                              />
                              <span style={{ position: 'absolute', top: 10, left: 8, fontSize: 9, color: '#facc15', opacity: 0.7 }}>★</span>
                              <span style={{ position: 'absolute', top: 10, right: 8, fontSize: 9, color: '#facc15', opacity: 0.7 }}>★</span>
                            </span>
                          )}
                          {mode.id === 'tournament' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 pointer-events-none overflow-hidden"
                              style={{ borderRadius: 'inherit', opacity: betaLocked ? 0.3 : 0.9 }}
                            >
                              <span
                                className="absolute inset-0"
                                style={{
                                  background:
                                    'repeating-linear-gradient(180deg, rgba(249,115,22,0.14) 0 3px, transparent 3px 9px)',
                                }}
                              />
                              <span
                                className="absolute"
                                style={{
                                  inset: 0,
                                  background:
                                    'radial-gradient(circle at 50% 28%, rgba(250,204,21,0.35) 0%, transparent 45%)',
                                }}
                              />
                              <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 9, color: '#fde047', opacity: 0.8 }}>♦</span>
                              <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, color: '#fde047', opacity: 0.8 }}>♦</span>
                              <span style={{ position: 'absolute', bottom: 28, left: 8, fontSize: 9, color: '#fb923c', opacity: 0.7 }}>♛</span>
                              <span style={{ position: 'absolute', bottom: 28, right: 8, fontSize: 9, color: '#fb923c', opacity: 0.7 }}>♛</span>
                            </span>
                          )}
                          <span
                            className="leading-none mb-2 relative"
                            style={{
                              fontSize: 38,
                              filter: `drop-shadow(0 0 14px ${glow}) drop-shadow(0 2px 0 #000)`,
                              animation: mode.id === 'rush'
                                ? 'qm-bolt-flicker 1.4s ease-in-out infinite'
                                : mode.id === 'tournament'
                                ? 'qm-banner-bounce 0.9s cubic-bezier(0.34,1.56,0.64,1)'
                                : undefined,
                            }}
                          >
                            {mode.icon}
                          </span>
                          <span className="font-black text-[13px] leading-tight uppercase tracking-wider relative" style={{ color: '#fff', textShadow: '0 1px 0 #000' }}>{mode.label}</span>
                          {mode.tagline && (
                            <span
                              className="text-[8px] font-extrabold uppercase mt-1 leading-none relative"
                              style={{ color: '#e2e8f0', letterSpacing: '0.16em', opacity: 0.9 }}
                            >
                              {mode.tagline}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 mt-2 relative">
                            <span className="font-black text-[15px] leading-none" style={{ color: '#fff', textShadow: '0 1px 0 #000' }}>{mode.coins.toLocaleString()}</span>
                            <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1, filter: 'drop-shadow(0 0 6px #fbbf24)' }}>🪙</span>
                          </span>
                          <span className="text-[8px] uppercase tracking-[0.18em] mt-0.5 leading-none font-bold relative" style={{ color: '#94a3b8' }}>coins</span>
                          {selected && !betaLocked && (
                            <span
                              aria-hidden="true"
                              className="absolute left-1/2 -translate-x-1/2 inline-flex items-center justify-center rounded-full"
                              style={{
                                bottom: -10,
                                width: 22,
                                height: 22,
                                background: 'linear-gradient(180deg,#06b6d4,#0891b2)',
                                border: '2.5px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a, 0 0 14px rgba(6,182,212,0.9)',
                                zIndex: 3,
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {rushAvailable === false && (
                    <div
                      className="mt-2 rounded-2xl px-3 py-2.5 text-[11px] leading-snug flex items-start gap-2"
                      style={{
                        background: 'linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a',
                        color: '#fde68a',
                      }}
                      aria-live="polite"
                    >
                      <span aria-hidden="true" className="text-sm leading-none mt-0.5">⚡</span>
                      <div>
                        <div
                          className="font-extrabold uppercase mb-0.5"
                          style={{ color: '#ffffff', fontSize: '9px', letterSpacing: '0.18em' }}
                        >
                          Rush locked
                        </div>
                        Rush needs a live game in progress. No games are live right now — Rush will unlock the moment one tips off.
                      </div>
                    </div>
                  )}
                  {selectedMode && (
                    <p
                      aria-live="polite"
                      className="mt-3 text-center text-[10.5px] leading-snug"
                      style={{ color: '#94a3b8', letterSpacing: '0.04em' }}
                    >
                      <span className="font-black uppercase" style={{ color: selectedMode.color, letterSpacing: '0.16em', textShadow: `0 0 8px ${selectedMode.color}66` }}>
                        {selectedMode.label}
                      </span>
                      <span className="mx-1.5 text-gray-600">·</span>
                      <span style={{ color: '#cbd5e1' }}>{selectedMode.description}</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={startSearch}
                  className="msg-cartoon-btn w-full text-white font-black uppercase rounded-2xl flex flex-col items-stretch justify-center relative overflow-hidden p-0"
                  style={{
                    background: 'linear-gradient(180deg,#3b82f6 0%,#1d4ed8 100%)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 5px 0 #0a0a0a, 0 0 32px rgba(6,182,212,0.55), inset 0 0 0 1.5px rgba(6,182,212,0.55)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                  }}
                >
                  <span className="flex items-center justify-between gap-2 px-3 pt-3 pb-2.5">
                    <span
                      aria-hidden="true"
                      className="qm-cta-chev inline-flex items-center justify-center rounded-full flex-shrink-0"
                      style={{
                        width: 30,
                        height: 30,
                        background: 'linear-gradient(180deg,#0e1b3a,#050a18)',
                        border: '2px solid #06b6d4',
                        boxShadow: '0 0 12px rgba(6,182,212,0.7), inset 0 0 6px rgba(6,182,212,0.3)',
                        color: '#7dd3fc',
                        fontSize: 15,
                      }}
                    >»</span>
                    <span style={{ fontSize: 19, letterSpacing: '0.06em' }}>Find Opponent</span>
                    <span
                      aria-hidden="true"
                      className="qm-cta-chev inline-flex items-center justify-center rounded-full flex-shrink-0"
                      style={{
                        width: 30,
                        height: 30,
                        background: 'linear-gradient(180deg,#0e1b3a,#050a18)',
                        border: '2px solid #06b6d4',
                        boxShadow: '0 0 12px rgba(6,182,212,0.7), inset 0 0 6px rgba(6,182,212,0.3)',
                        color: '#7dd3fc',
                        fontSize: 15,
                      }}
                    >«</span>
                  </span>
                  <span
                    className="block text-center"
                    style={{
                      background: 'linear-gradient(180deg,#050a18,#020611)',
                      borderTop: '1.5px solid rgba(6,182,212,0.35)',
                      padding: '6px 0 7px',
                      fontSize: 10,
                      letterSpacing: '0.32em',
                      color: '#7dd3fc',
                      textShadow: '0 0 8px rgba(6,182,212,0.6)',
                    }}
                  >
                    Play Now · Win Big
                  </span>
                </button>
                <style jsx>{`
                  @keyframes qmCtaChev {
                    0%, 100% { transform: translateX(0); opacity: 0.9; }
                    50% { transform: translateX(3px); opacity: 1; }
                  }
                  .qm-cta-chev:first-child { animation: qmCtaChev 1.2s ease-in-out infinite; }
                  .qm-cta-chev:last-child { animation: qmCtaChev 1.2s ease-in-out infinite reverse; }
                `}</style>
              </div>
            </>
          )}

          {step === 'searching' && (() => {
            // Mode-themed searching container — every accent color
            // (banner, opponent glow, phase pill, payout card, loading
            // dots, footer timer) is derived from the selected mode so
            // the loader visually matches the mode the user picked.
            const modeColor = selectedMode?.color || '#3b82f6';
            const mHex = modeColor.replace('#', '');
            const mR = parseInt(mHex.substring(0, 2), 16);
            const mG = parseInt(mHex.substring(2, 4), 16);
            const mB = parseInt(mHex.substring(4, 6), 16);
            const modeGlow = `rgba(${mR},${mG},${mB},0.45)`;
            const modeTint = `rgba(${mR},${mG},${mB},0.18)`;
            const modeSoft = `rgba(${mR},${mG},${mB},0.06)`;
            const modeStrong = `rgba(${mR},${mG},${mB},0.65)`;

            // Phase derived from elapsed seconds so the user always
            // sees forward motion: scanning real players → expanding
            // the net → bringing in a challenger from the bot pool.
            // Aligns with the polling logic above (~16s real scan,
            // then bot fallback).
            let phase;
            if (searchTime < 8) {
              phase = { label: 'Scanning live players', dotColor: '#10b981' };
            } else if (searchTime < 15) {
              phase = { label: 'Expanding the net', dotColor: '#22d3ee' };
            } else {
              phase = { label: 'Bringing in a challenger', dotColor: '#fbbf24' };
            }

            // Mock player names that scroll under the avatars to make
            // the "scanning" feel real. Duplicated to make a seamless
            // marquee loop with translateX(-50%).
            const SCAN_NAMES = [
              'PropKing', 'BetWizard', 'SlipMaster', 'OddsHunter', 'JuiceMan',
              'SharpEdge', 'LineMover', 'ParlayPro', 'LockSmith', 'StakeKing',
              'ChalkBuster', 'DimePlayer', 'FadeQueen', 'HotStreak', 'BankrollKid',
            ];
            return (
            <div className="qm-amp relative overflow-hidden" style={{
              background: `radial-gradient(ellipse at top, ${modeSoft} 0%, transparent 60%)`,
            }}>
              {/* Centered hero title — same brushed-silver + gold-bolt
                  treatment as the config step so the two phases read
                  as one cohesive popup. */}
              <div className="px-5 pt-7 pb-1 flex-shrink-0 relative">
                <div className="flex items-center justify-center gap-2.5">
                  <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 0 10px rgba(250,204,21,0.85)) drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                  <h2
                    className="font-black uppercase text-center"
                    style={{
                      fontSize: 'clamp(28px, 8vw, 38px)',
                      lineHeight: 0.95,
                      letterSpacing: '0.015em',
                      fontStyle: 'italic',
                      WebkitTextStroke: '1.2px #0a0a0a',
                      textShadow: '0 3px 0 #0a0a0a, 0 0 28px rgba(6,182,212,0.7), 0 0 14px rgba(255,255,255,0.4)',
                      background: 'linear-gradient(180deg, #ffffff 0%, #94a3b8 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }}
                  >
                    Finding Opponent
                  </h2>
                  <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 0 10px rgba(250,204,21,0.85)) drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: 'linear-gradient(90deg, transparent, #06b6d4)', boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
                  <p
                    className="font-black uppercase whitespace-nowrap text-center"
                    style={{ color: '#7dd3fc', fontSize: 10, letterSpacing: '0.24em', textShadow: '0 0 10px rgba(6,182,212,0.7)', margin: 0 }}
                  >
                    Matchmaking In Progress
                  </p>
                  <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: 'linear-gradient(270deg, transparent, #06b6d4)', boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
                </div>
              </div>
              {/* Cartoon mode banner — anchors the loader to the mode
                  and surfaces buy-in + max payout up top so there's
                  no negative space at the start of the popup. */}
              <div className="px-4 pt-3 pb-3">
                <div
                  className="rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2"
                  style={{
                    background: `linear-gradient(180deg, ${modeTint}, ${modeSoft})`,
                    border: '2.5px solid #0a0a0a',
                    boxShadow: `0 4px 0 #0a0a0a, 0 0 18px ${modeStrong}`,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base"
                      style={{
                        background: `linear-gradient(180deg, ${modeColor}, ${modeColor}cc)`,
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                      }}
                      aria-hidden="true"
                    >
                      {selectedMode?.icon}
                    </span>
                    <div className="min-w-0">
                      <div
                        className="inline-block text-white text-[9px] font-black uppercase tracking-[0.18em] truncate px-2 py-0.5 rounded-md"
                        style={{
                          background: `linear-gradient(180deg, ${modeColor}, ${modeColor}cc)`,
                          border: '2px solid #0a0a0a',
                          boxShadow: '0 2px 0 #0a0a0a',
                        }}
                      >
                        {selectedMode?.label} Match
                      </div>
                      <div className="text-white text-[12px] font-black truncate mt-1" style={{ letterSpacing: '0.02em' }}>
                        {isBeta
                          ? <><span style={{ color: '#facc15' }}>10K Coins</span> <span className="text-gray-400">·</span> <span style={{ color: '#facc15' }}>Win 18K</span></>
                          : <><span style={{ color: '#facc15' }}>${buyIn} Buy-In</span> <span className="text-gray-400">·</span> <span style={{ color: '#facc15' }}>${potSize} Pot</span></>}
                      </div>
                    </div>
                  </div>
                  {isBeta ? (
                    /* Cartoon BETA stamp — single chunky pill with a
                       glowing star + the word BETA in an Impact-stack
                       so it reads like a sticker on the card instead
                       of a two-line "BETA / No Risk" disclaimer. */
                    <div
                      className="qmm-beta-stamp flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0"
                      style={{
                        background: 'linear-gradient(180deg,#facc15 0%,#eab308 55%,#ca8a04 100%)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a, 0 0 14px rgba(250,204,21,0.45)',
                        transform: 'rotate(3deg)',
                      }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }} aria-hidden="true">⭐</span>
                      <span
                        className="font-black uppercase"
                        style={{
                          color: '#0a0a0a',
                          fontFamily: 'Impact, "Arial Black", sans-serif',
                          fontSize: 16,
                          letterSpacing: '0.12em',
                          lineHeight: 1,
                          WebkitTextStroke: '0.5px #0a0a0a',
                        }}
                      >
                        BETA
                      </span>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center px-2.5 py-1 rounded-xl flex-shrink-0"
                      style={{
                        background: 'linear-gradient(180deg,#facc15,#ca8a04)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a',
                      }}
                    >
                      <span className="text-[#0a0a0a] text-[8px] font-black uppercase tracking-[0.18em]">Win Up To</span>
                      <span className="text-[#0a0a0a] text-sm font-black leading-none mt-0.5">${payout}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 md:gap-8 relative px-4" style={{ minHeight: '220px' }}>
                {/* Both side columns are pinned to a fixed width so the
                    cycling opponent name on the right can change length
                    without nudging the entire row (and the user's
                    avatar on the left) horizontally each tick. */}
                <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ width: 120 }}>
                  <div className="relative mb-2">
                    <div
                      className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                      style={{
                        border: '3.5px solid #0a0a0a',
                        background: th.avatarBg1,
                        boxShadow: '0 3px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.45), inset 0 0 0 2.5px #3b82f6',
                        animation: 'qm-user-glow 2s ease-in-out infinite',
                      }}
                    >
                      <UserAvatar
                        user={{ id: userProfile?.id, username: userName, avatar: userAvatar }}
                        size={96}
                      />
                    </div>
                  </div>
                  <p
                    className="text-white text-[11px] md:text-xs font-extrabold uppercase truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                    style={{
                      background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 2px 0 #0a0a0a',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {userName}
                  </p>
                  <p
                    className="text-white text-[10px] font-black uppercase mt-1.5 px-2 py-0.5 rounded-md"
                    style={{
                      background: 'linear-gradient(180deg,#10b981,#047857)',
                      border: '2px solid #0a0a0a',
                      boxShadow: '0 2px 0 #0a0a0a',
                      letterSpacing: '0.16em',
                    }}
                  >
                    Ready
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center flex-shrink-0 relative z-20">
                  <div className="relative flex flex-col items-center">
                    <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, marginBottom: 2, filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.6))' }}>👑</span>

                    <div
                      className="text-3xl md:text-4xl font-black italic text-transparent bg-clip-text"
                      style={{
                        backgroundImage: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
                        WebkitBackgroundClip: 'text',
                        animation: 'qm-vs-pulse 1.5s ease-in-out infinite',
                        textShadow: '0 0 20px rgba(250,204,21,0.4)',
                      }}
                    >
                      VS
                    </div>

                    <div
                      className="mt-2 flex flex-col items-center px-2.5 py-1 rounded-xl"
                      style={{
                        background: 'linear-gradient(180deg,#1a1a1a,#0a0a0a)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a, 0 0 12px rgba(250,204,21,0.35)',
                      }}
                    >
                      <span className="font-black uppercase" style={{ color: '#facc15', fontSize: 8, letterSpacing: '0.22em', lineHeight: 1 }}>Stake</span>
                      <span className="inline-flex items-center gap-1 mt-0.5">
                        <span className="font-black text-white" style={{ fontSize: 13, lineHeight: 1 }}>
                          {isBeta ? '10,000' : `$${buyIn}`}
                        </span>
                        {isBeta && <span aria-hidden="true" style={{ fontSize: 11, lineHeight: 1 }}>🪙</span>}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ width: 120 }}>
                  <div className="relative mb-2" style={{ perspective: '400px' }}>
                    <div
                      className="absolute -inset-3 rounded-full"
                      style={{
                        border: `1px solid ${modeGlow}`,
                        animation: 'qm-ring-spin 3s linear infinite',
                      }}
                    />
                    <div
                      className="absolute -inset-3 rounded-full"
                      style={{
                        background: `conic-gradient(from 0deg, transparent 0deg, ${modeStrong} 40deg, transparent 80deg)`,
                        animation: 'qm-ring-spin 2s linear infinite',
                      }}
                    />

                    <div
                      key={currentAvatarIdx}
                      style={{
                        animation: avatarFlip ? 'qm-avatar-flip-out 0.25s ease-in forwards' : 'qm-avatar-flip-in 0.25s ease-out forwards',
                      }}
                    >
                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                        style={{
                          border: '3.5px solid #0a0a0a',
                          background: th.avatarBg2,
                          boxShadow: `0 3px 0 #0a0a0a, 0 0 22px ${modeGlow}, inset 0 0 0 2.5px ${modeColor}`,
                        }}
                      >
                        {currentAvatar ? (
                          <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl md:text-3xl" style={{ color: modeColor, opacity: 0.6 }}>?</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {currentName ? (
                    <div key={currentName} style={{ animation: 'qm-name-slide 0.3s ease-out' }} className="flex flex-col items-center">
                      <p
                        className="text-white text-[11px] md:text-xs font-extrabold uppercase mt-1 truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                        style={{
                          background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                          border: '2.5px solid #0a0a0a',
                          boxShadow: '0 2px 0 #0a0a0a',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {currentName}
                      </p>
                      <p
                        className="text-white text-[10px] font-black mt-1 px-2 py-0.5 rounded-md"
                        style={{
                          background: '#0a0a0a',
                          border: `2px solid ${modeColor}`,
                          boxShadow: `0 2px 0 #0a0a0a, 0 0 8px ${modeColor}66`,
                          letterSpacing: '0.1em',
                        }}
                      >
                        ({currentRecord})
                      </p>
                    </div>
                  ) : (
                    <p
                      className="text-white text-[11px] md:text-xs font-extrabold uppercase mt-1 px-2 py-0.5 rounded-md"
                      style={{
                        background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.14em',
                      }}
                    >
                      Searching…
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full"
                        style={{
                          backgroundColor: modeColor,
                          animation: 'qm-bolt-flicker 1s ease-in-out infinite',
                          animationDelay: `${i * 0.25}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Phase status card — radar + label + subtitle + waveform.
                  Bigger than a pill so it carries the matchmaker beat
                  visually and tells the user we're actively looking. */}
              <div className="px-4 pt-2 pb-1">
                <div
                  key={phase.label}
                  className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
                  style={{
                    background: `linear-gradient(180deg, ${phase.dotColor}22, ${phase.dotColor}08)`,
                    border: `2.5px solid ${phase.dotColor}`,
                    boxShadow: `0 4px 0 #0a0a0a, 0 0 14px ${phase.dotColor}55`,
                    animation: 'qm-tip-fade-in 0.3s ease-out',
                  }}
                >
                  <div
                    className="relative flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32 }}
                    aria-hidden="true"
                  >
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{
                        border: `2px solid ${phase.dotColor}`,
                        opacity: 0.5,
                        animation: 'qm-ring-spin 2.4s linear infinite',
                      }}
                    />
                    <span
                      className="absolute rounded-full"
                      style={{
                        inset: 6,
                        background: `conic-gradient(from 0deg, transparent 0deg, ${phase.dotColor} 80deg, transparent 120deg)`,
                        animation: 'qm-ring-spin 1.6s linear infinite',
                      }}
                    />
                    <span
                      className="relative rounded-full"
                      style={{
                        width: 8,
                        height: 8,
                        backgroundColor: phase.dotColor,
                        boxShadow: `0 0 10px ${phase.dotColor}`,
                        animation: 'qm-bolt-flicker 0.9s ease-in-out infinite',
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-black uppercase" style={{ fontSize: 12, letterSpacing: '0.16em', lineHeight: 1.1 }}>
                      {phase.label}
                    </div>
                    <div className="font-bold mt-0.5" style={{ color: '#94a3b8', fontSize: 10, letterSpacing: '0.04em' }}>
                      Finding the best matchup…
                    </div>
                  </div>
                  <div className="flex items-end gap-[3px] flex-shrink-0" aria-hidden="true" style={{ height: 22 }}>
                    {[0, 1, 2, 3, 4, 5, 6].map(i => (
                      <span
                        key={i}
                        style={{
                          width: 2.5,
                          background: phase.dotColor,
                          borderRadius: 1,
                          boxShadow: `0 0 4px ${phase.dotColor}88`,
                          animation: `qm-wave-${i % 3} 0.9s ease-in-out ${i * 0.08}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <style jsx>{`
                @keyframes qm-wave-0 { 0%,100% { height: 5px; } 50% { height: 20px; } }
                @keyframes qm-wave-1 { 0%,100% { height: 10px; } 50% { height: 16px; } }
                @keyframes qm-wave-2 { 0%,100% { height: 14px; } 50% { height: 6px; } }
              `}</style>

              <div className="px-5 pb-3 pt-1">
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2 min-h-[36px]"
                  style={{
                    background: 'linear-gradient(180deg,#0f1424,#0a0e1c)',
                    border: '2.5px solid #06b6d4',
                    boxShadow: '0 3px 0 #0a0a0a, 0 0 10px rgba(6,182,212,0.35)',
                  }}
                >
                  <span style={{ fontSize: 16, filter: 'drop-shadow(0 2px 0 #0a0a0a)' }} aria-hidden="true">💡</span>
                  <p
                    className="text-white text-[11px] font-bold leading-snug flex-1 transition-opacity duration-300 uppercase"
                    style={{
                      opacity: tipFade ? 0 : 1,
                      animation: tipFade ? 'none' : 'qm-tip-fade-in 0.3s ease-out',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {TIPS[tipIndex]}
                  </p>
                  <span aria-hidden="true" style={{ color: '#06b6d4', fontSize: 14, lineHeight: 1, fontWeight: 900 }}>›</span>
                </div>
              </div>

              <div className="px-5 pb-5 flex items-center justify-between">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(180deg,#0f1424,#0a0e1c)',
                    border: `2.5px solid ${modeColor}`,
                    boxShadow: `0 3px 0 #0a0a0a, 0 0 8px ${modeColor}55`,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1, filter: `drop-shadow(0 0 6px ${modeColor})` }}>⏱</span>
                  <div className="flex flex-col leading-none">
                    <span
                      className="text-white font-black font-mono"
                      style={{
                        fontSize: 14,
                        letterSpacing: '0.04em',
                        animation: 'qm-timer-tick 1s ease-in-out infinite',
                      }}
                    >
                      {`0:${String(searchTime).padStart(2, '0')}`}
                    </span>
                    <span className="font-black uppercase mt-0.5" style={{ color: '#94a3b8', fontSize: 7, letterSpacing: '0.24em' }}>
                      Elapsed
                    </span>
                  </div>
                </div>
                <button
                  onClick={cancelSearch}
                  className="msg-cartoon-btn px-4 py-2 text-white rounded-xl text-[12px] font-black uppercase"
                  style={{
                    background: 'linear-gradient(180deg,#ef4444,#b91c1c)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a',
                    letterSpacing: '0.14em',
                    textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
            );
          })()}

          {step === 'found' && (
            <div
              className="qm-amp relative overflow-hidden"
              style={{
                background: 'transparent',
                animation: 'qm-shake 0.6s ease-out 0.05s 1',
              }}
            >
              {/* Full-modal flash on entry — quick gold pulse that sells
                  the moment of impact. Pointer-events-none so it never
                  blocks clicks. */}
              <div
                className="absolute inset-0 pointer-events-none z-40"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.55) 0%, rgba(16,185,129,0.25) 45%, transparent 70%)',
                  animation: 'qm-found-flash 0.55s ease-out forwards',
                }}
                aria-hidden="true"
              />
              {/* Confetti shower — 16 cartoon shards in mode/accent colors
                  fall and rotate; CSS-only so cheap on the main thread.
                  Distinct --qm-x per piece spreads them sideways. */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-30" aria-hidden="true">
                {Array.from({ length: 16 }).map((_, i) => {
                  const colors = ['#10b981', '#facc15', '#3b82f6', '#fb923c', '#06b6d4', '#ef4444'];
                  const c = colors[i % colors.length];
                  const left = (i * 7 + 4) % 100;
                  const dx = ((i * 17) % 80) - 40;
                  const delay = (i % 6) * 0.07;
                  const dur = 1.4 + ((i * 13) % 7) * 0.12;
                  const w = 6 + (i % 3) * 2;
                  const h = 10 + (i % 3) * 2;
                  return (
                    <span
                      key={i}
                      style={{
                        position: 'absolute',
                        top: -20,
                        left: `${left}%`,
                        width: w,
                        height: h,
                        background: c,
                        borderRadius: 2,
                        boxShadow: `0 0 6px ${c}cc`,
                        '--qm-x': `${dx}px`,
                        animation: `qm-confetti-fall ${dur}s ease-in ${delay}s forwards`,
                      }}
                    />
                  );
                })}
              </div>

              <MatchFoundContent
                isBeta={isBeta}
                buyIn={buyIn}
                potSize={potSize}
                payout={payout}
                gameMode={gameMode}
                selectedMode={selectedMode}
                userName={userName}
                userAvatar={userAvatar}
                userProfile={userProfile}
                matchedOpponent={matchedOpponent}
                matchedAvatar={matchedAvatar}
                th={th}
                onContinue={handleContinue}
                onCancel={handleClose}
              />
            </div>
          )}

          {step === 'rush-vote' && (
            <RushVoteSlide
              rushState={rushState}
              userId={session?.user?.id}
              opponent={matchedOpponent}
              userName={userName}
              userAvatar={userAvatar}
              userProfileId={userProfile?.id}
              matchupId={matchedMatchup?.id}
              liveGames={liveGamesForVote}
              pendingVoteId={pendingVoteId}
              onVote={submitRushVote}
              onAdvance={() => {
                if (cancelledRef.current) return;
                setStep('rush-ready');
              }}
              onClose={handleClose}
              error={rushVoteError}
            />
          )}

          {step === 'rush-ready' && (
            <RushReadySlide
              rushState={rushState}
              userId={session?.user?.id}
              opponent={matchedOpponent}
              pendingReady={pendingReady}
              onReady={submitRushReady}
              onClose={handleClose}
              error={readyError}
            />
          )}

          {step === 'rush-countdown' && (
            <RushCountdownSlide num={countdownNum} />
          )}

          {step === 'rush-playing' && (
            <RushPlayingSlide
              rushState={rushState}
              userId={session?.user?.id}
              opponent={matchedOpponent}
              pickedAnswer={pickedAnswer}
              submittingAnswer={submittingAnswer}
              onAnswer={submitRushAnswer}
              onOpenFullView={handleClose}
            />
          )}

          {step === 'rush-completed' && (
            <RushCompletedSlide
              rushState={rushState}
              matchup={matchedMatchup}
              userId={session?.user?.id}
              opponent={matchedOpponent}
              onExit={() => {
                onClose();
                router.push('/battle');
              }}
            />
          )}
        </div>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

// ===========================================================================
// Rush in-popup sub-slides
//
// Three small presentational components that render the cartoon-themed
// vote → rules → countdown ritual inside QuickMatchModal. They share the
// same design language (2.5px black borders, 4px hard shadow, blue=YOU /
// orange=OPP color split) so the whole flow reads as one continuous
// trivia-crack-style sequence rather than four disconnected screens.
// ===========================================================================

const SELF_COLOR = '#3b82f6';
const SELF_COLOR_DEEP = '#1d4ed8';
const OPP_COLOR = '#fb923c';
const OPP_COLOR_DEEP = '#c2410c';

function RushVoteSlide({
  rushState,
  userId,
  opponent,
  liveGames,
  pendingVoteId,
  onVote,
  onAdvance,
  onClose,
  error,
}) {
  const myVote = userId ? rushState?.gameVotes?.[userId] : null;
  const opponentId = opponent?.id;
  const oppVote = opponentId ? rushState?.gameVotes?.[opponentId] : null;
  const bothVoted = !!myVote && !!oppVote;
  const sameGame = bothVoted && String(myVote?.gameId) === String(oppVote?.gameId);

  // Live deadline countdown — rushState.voteDeadline is ISO from the
  // server; we render seconds-remaining based on Date.now() so it
  // ticks even between polls.
  const deadline = rushState?.voteDeadline ? new Date(rushState.voteDeadline).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const remaining = deadline ? Math.max(0, deadline - now) : null;
  const remainingSec = remaining != null ? Math.ceil(remaining / 1000) : null;
  const urgent = remainingSec != null && remainingSec <= 5;

  const noLive = liveGames.length === 0;

  return (
    <div className="relative">
      <style>{`
        @keyframes rvCardIn {
          0% { opacity: 0; transform: translateY(8px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rvBadgePop {
          0% { transform: scale(0); }
          60% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes rvUrgentPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes rvBoltSwing {
          0%, 100% { transform: rotate(-8deg) scale(1); }
          50% { transform: rotate(8deg) scale(1.1); }
        }
        .rv-card { animation: rvCardIn 220ms cubic-bezier(0.22,1,0.36,1) both; }
        .rv-card:nth-child(1) { animation-delay: 30ms; }
        .rv-card:nth-child(2) { animation-delay: 90ms; }
        .rv-card:nth-child(3) { animation-delay: 150ms; }
        .rv-badge { animation: rvBadgePop 280ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .rv-bolt { animation: rvBoltSwing 1.4s ease-in-out infinite; display: inline-block; transform-origin: center; }
        .rv-urgent { animation: rvUrgentPulse 0.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rv-card, .rv-badge, .rv-bolt, .rv-urgent { animation: none !important; }
        }
      `}</style>

      {/* Header — mirrors the 'config' header so the popup keeps its
          visual identity through the flow. Close button hands off to
          /battle/rush/[id] (handled by parent's handleClose). */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0 flex items-center gap-2">
            <span className="rv-bolt" aria-hidden="true" style={{ fontSize: 22 }}>⚡</span>
            <div className="min-w-0">
              <h2 className="font-black uppercase text-white" style={{ fontSize: 18, lineHeight: 1.05, letterSpacing: '0.06em', textShadow: '0 2px 0 #000' }}>
                Pick a Game
              </h2>
              <p className="mt-0.5 font-extrabold uppercase" style={{ color: '#9ca3af', fontSize: 9, letterSpacing: '0.18em' }}>
                Both vote — host wins ties
              </p>
            </div>
          </div>
          {remainingSec != null && (
            <div
              className={`text-base font-black tabular-nums px-3 py-1.5 rounded-full ${urgent ? 'rv-urgent' : ''}`}
              style={{
                background: urgent ? 'linear-gradient(180deg,#ef4444,#b91c1c)' : 'linear-gradient(180deg,#fbbf24,#d97706)',
                color: '#0a0a0a',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a',
              }}
              aria-label={`${remainingSec} seconds to vote`}
            >
              {remainingSec}s
            </div>
          )}
        </div>

        {/* Player vote-status pills in their identity colors, so it's
            unmistakable which check belongs to whom on a card below. */}
        <div className="flex items-center gap-2 mt-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
            style={{
              background: myVote ? `linear-gradient(180deg,${SELF_COLOR},${SELF_COLOR_DEEP})` : 'rgba(255,255,255,0.05)',
              color: myVote ? '#fff' : '#9ca3af',
              border: '2.5px solid #0a0a0a',
              boxShadow: myVote ? `0 2px 0 #0a0a0a, 0 0 12px ${SELF_COLOR}66` : '0 2px 0 #0a0a0a',
            }}
          >
            <span style={{ fontSize: 11 }}>{myVote ? '✓' : '○'}</span>
            <span>You</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
            style={{
              background: oppVote ? `linear-gradient(180deg,${OPP_COLOR},${OPP_COLOR_DEEP})` : 'rgba(255,255,255,0.05)',
              color: oppVote ? '#fff' : '#9ca3af',
              border: '2.5px solid #0a0a0a',
              boxShadow: oppVote ? `0 2px 0 #0a0a0a, 0 0 12px ${OPP_COLOR}66` : '0 2px 0 #0a0a0a',
            }}
          >
            <span style={{ fontSize: 11 }}>{oppVote ? '✓' : '○'}</span>
            <span>Opp</span>
          </span>
          {bothVoted && (
            <span
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{
                background: sameGame
                  ? 'linear-gradient(180deg,#10b981,#047857)'
                  : 'linear-gradient(180deg,#fb923c,#c2410c)',
                color: '#fff',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
              }}
            >
              {sameGame ? 'Locked!' : 'Host wins'}
            </span>
          )}
        </div>
      </div>

      {/* Cards. We cap to 3 cartoon-themed live game cards — each shows
          the away/home matchup, the live score in big type, and any
          checkmark badges in the picker's identity color so the user
          sees instantly whether the two of you agree. */}
      <div className="px-5 pb-2 space-y-2.5">
        {noLive && (
          <div
            className="rounded-2xl p-4 text-center"
            style={{
              background: 'linear-gradient(180deg,rgba(239,68,68,0.16),rgba(239,68,68,0.04))',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 4px 0 #0a0a0a',
            }}
          >
            <div className="text-2xl mb-1" aria-hidden="true">⚡</div>
            <div className="text-white font-extrabold text-sm mb-1">No live games right now</div>
            <div className="text-[11px] text-gray-400 leading-snug">
              Rush props come from a live game. Hang tight for tip-off — voting auto-resolves at the timer.
            </div>
          </div>
        )}

        {liveGames.map((g) => {
          const gid = String(g.id);
          const iPicked = String(myVote?.gameId) === gid;
          const oppPicked = String(oppVote?.gameId) === gid;
          const isPending = pendingVoteId === gid;
          const disabled = !!myVote || !!pendingVoteId;
          return (
            <RushVoteCard
              key={`${g.sport_key}::${gid}`}
              game={g}
              iPicked={iPicked}
              oppPicked={oppPicked}
              disabled={disabled}
              loading={isPending}
              onPick={() => onVote(g)}
            />
          );
        })}
      </div>

      {error && (
        <div className="px-5 pb-2 text-[11px] text-red-300 text-center">{error}</div>
      )}

      {bothVoted && (
        <div className="px-5 pb-2 space-y-2">
          <div
            className="rounded-2xl px-3 py-2.5 text-center"
            style={{
              background: 'linear-gradient(180deg,rgba(16,185,129,0.18),rgba(16,185,129,0.04))',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
            }}
          >
            <div className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-300">
              {sameGame ? 'Both locked the same game!' : 'Both locked in — host\u2019s pick wins'}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Generating 6 props…</div>
          </div>
          {/* Manual-advance escape hatch. Phase has flipped server-side
              and the modal is on a 3s auto-advance timer; this button
              lets users skip the wait once they've registered the
              opponent's pick (visible above as the orange checkmark
              badge on whichever card they chose). */}
          {onAdvance && (
            <button
              type="button"
              onClick={onAdvance}
              className="w-full py-3 rounded-2xl font-black uppercase text-white transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(180deg,#10b981,#047857)',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 4px 0 #0a0a0a',
                letterSpacing: '0.14em',
                fontSize: 14,
              }}
            >
              Continue →
            </button>
          )}
        </div>
      )}

      <div className="px-5 pb-5 pt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2"
        >
          Open full match view
        </button>
        <div className="text-[10px] text-gray-600 font-mono">
          {liveGames.length} live · max {RUSH_VOTE_GAME_LIMIT}
        </div>
      </div>
    </div>
  );
}

function RushVoteCard({ game, iPicked, oppPicked, disabled, loading, onPick }) {
  // Normalize across the two shapes that flow into the vote slide:
  //   * API/Goalserve shape — `home_team`, `away_team`, `sport_title`,
  //     `formatted_time`
  //   * Simulated demo shape — `homeTeamFull`/`homeTeam`,
  //     `awayTeamFull`/`awayTeam`, `sportName`, `time`/`elapsedTime`/`period`
  // The cartoon score block uses the same `scores.home.total` /
  // `scores.away.total` shape in both, so no extra mapping needed there.
  const home = game.home_team || game.homeTeamFull || game.homeTeam || 'Home';
  const away = game.away_team || game.awayTeamFull || game.awayTeam || 'Away';
  const hs = game?.scores?.home?.total ?? game?.home_score ?? 0;
  const as = game?.scores?.away?.total ?? game?.away_score ?? 0;
  const sportLabel = game.sport_title || game.sportName || game.sport || 'LIVE';
  // Live clock string — try the API field first, fall back to the
  // demo-game fields. The simulated demo games already bake the period
  // into `elapsedTime` (e.g. "Q3 10:41"), so we only prepend `period`
  // when the elapsed-time string doesn't already start with it —
  // otherwise the card would render "Q3 Q3 10:41".
  const elapsed = game.elapsedTime || game.displayClock || '';
  const period = game.period ? String(game.period) : '';
  // Match period as a whole token (so "Q1" doesn't false-positive on
  // "Q10 0:01") — period must be followed by end-of-string or non-word.
  const elapsedHasPeriod = !!(period && elapsed
    && new RegExp(`^${period.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\W|$)`).test(elapsed.trim()));
  const composed = elapsed
    ? (elapsedHasPeriod ? elapsed : (period ? `${period} ${elapsed}` : elapsed))
    : period;
  const liveClock = game.formatted_time
    || composed
    || game.time
    || game.status
    || 'In progress';
  const isLive = !!(game.isLive || game.status === 'IN_PROGRESS' || game.status === 'live');
  const someonePicked = iPicked || oppPicked;

  // Selected card glow blends the picker colors when both picked it,
  // otherwise uses just the picker's color so the difference between
  // "we agree" and "we disagree" is impossible to miss.
  let glow = 'none';
  let borderInset = 'transparent';
  if (iPicked && oppPicked) {
    glow = `0 4px 0 #0a0a0a, 0 0 22px ${SELF_COLOR}99, 0 0 22px ${OPP_COLOR}99`;
    borderInset = `linear-gradient(135deg, ${SELF_COLOR}, ${OPP_COLOR})`;
  } else if (iPicked) {
    glow = `0 4px 0 #0a0a0a, 0 0 22px ${SELF_COLOR}99`;
    borderInset = SELF_COLOR;
  } else if (oppPicked) {
    glow = `0 4px 0 #0a0a0a, 0 0 22px ${OPP_COLOR}99`;
    borderInset = OPP_COLOR;
  } else {
    glow = '0 4px 0 #0a0a0a';
  }

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onPick}
      className="rv-card w-full text-left rounded-2xl px-3.5 py-3 transition-transform active:scale-[0.98]"
      style={{
        background: someonePicked
          ? 'linear-gradient(180deg,#1a1a1a,#0a0a0a)'
          : 'linear-gradient(180deg,#141414,#0a0a0a)',
        border: '2.5px solid #0a0a0a',
        boxShadow: glow,
        opacity: disabled && !someonePicked ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
      }}
    >
      {/* Inner accent ring — gives selected cards a colored "second
          border" without fighting the cartoon black outer border. */}
      {someonePicked && (
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: typeof borderInset === 'string' && borderInset.startsWith('linear')
              ? borderInset
              : undefined,
            backgroundColor: typeof borderInset === 'string' && !borderInset.startsWith('linear') ? borderInset : undefined,
            padding: 2,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}

      <div className="flex items-center justify-between gap-3 relative">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md"
              style={{
                background: 'linear-gradient(180deg,#fbbf24,#d97706)',
                color: '#1a0a00',
                border: '2px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
              }}
            >
              {sportLabel}
            </span>
            {isLive && (
              <span
                className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                style={{
                  background: 'linear-gradient(180deg,#ef4444,#b91c1c)',
                  color: '#fff',
                  border: '2px solid #0a0a0a',
                  boxShadow: '0 2px 0 #0a0a0a',
                }}
              >
                <span
                  style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#fff', boxShadow: '0 0 6px #fff',
                  }}
                />
                LIVE
              </span>
            )}
          </div>
          <div className="text-white font-extrabold text-[13px] truncate" style={{ letterSpacing: '0.01em' }}>
            {away}
          </div>
          <div className="text-gray-500 text-[10px] my-0.5 font-bold uppercase tracking-wider">vs</div>
          <div className="text-white font-extrabold text-[13px] truncate" style={{ letterSpacing: '0.01em' }}>
            {home}
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5 font-mono">
            {liveClock}
          </div>
        </div>

        {/* Big cartoon-style score block */}
        <div
          className="flex flex-col items-center justify-center px-3 py-2 rounded-xl shrink-0"
          style={{
            background: 'linear-gradient(180deg,#0c1a35,#050a15)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 3px 0 #0a0a0a',
            minWidth: 64,
          }}
        >
          <div className="text-white font-black text-2xl tabular-nums leading-none">{as}</div>
          <div className="text-gray-600 font-black text-[10px] my-0.5">—</div>
          <div className="text-white font-black text-2xl tabular-nums leading-none">{hs}</div>
        </div>
      </div>

      {/* Picker-colored checkmark badges — stacked when both players
          chose the same game so the agree/disagree state is visible
          at a glance. */}
      {(iPicked || oppPicked) && (
        <div className="flex items-center gap-1.5 mt-2.5">
          {iPicked && (
            <div
              className="rv-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{
                background: `linear-gradient(180deg,${SELF_COLOR},${SELF_COLOR_DEEP})`,
                color: '#fff',
                border: '2px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
              }}
            >
              <span style={{ fontSize: 11 }}>✓</span>
              <span>You</span>
            </div>
          )}
          {oppPicked && (
            <div
              className="rv-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{
                background: `linear-gradient(180deg,${OPP_COLOR},${OPP_COLOR_DEEP})`,
                color: '#fff',
                border: '2px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
              }}
            >
              <span style={{ fontSize: 11 }}>✓</span>
              <span>Opp</span>
            </div>
          )}
          {loading && (
            <div className="ml-auto text-[10px] text-gray-400 font-bold">Sending…</div>
          )}
        </div>
      )}
    </button>
  );
}

function RushReadySlide({ rushState, userId, opponent, pendingReady, onReady, onClose, error }) {
  const opponentId = opponent?.id;
  const myReady = userId ? !!rushState?.readyVotes?.[userId] : false;
  const oppReady = opponentId ? !!rushState?.readyVotes?.[opponentId] : false;

  // Vote-disagreement banner: when both players picked DIFFERENT live
  // games, the server resolved to the host's pick. Tell the viewer
  // explicitly so they're not confused why the locked game isn't theirs.
  const myVote = userId ? rushState?.gameVotes?.[userId] || null : null;
  const oppVote = opponentId ? rushState?.gameVotes?.[opponentId] || null : null;
  const selectedGame = rushState?.selectedGame || null;
  const selectedGameId = selectedGame?.id != null ? String(selectedGame.id) : null;
  const myVoteId = myVote?.gameId ? String(myVote.gameId) : null;
  const oppVoteId = oppVote?.gameId ? String(oppVote.gameId) : null;
  // Require selectedGameId so we never render "overruled" copy with a
  // blank game label when the server hasn't yet locked a game.
  const wasContested = !!(
    myVote && oppVote && myVoteId && oppVoteId && selectedGameId && myVoteId !== oppVoteId
  );
  const myVoteOverruled = wasContested && myVoteId !== selectedGameId;
  const selectedLabel = selectedGame
    ? `${selectedGame.away_team || 'Away'} @ ${selectedGame.home_team || 'Home'}`
    : '';

  const rules = [
    { icon: '🏀', label: '6 quick props', sub: 'sealed at the buzzer' },
    { icon: '⏱️', label: '15s per question', sub: 'tap fast — clock runs hot' },
    { icon: '🎯', label: 'Most correct wins', sub: 'tiebreak: fastest answers' },
  ];

  return (
    <div className="relative">
      <style>{`
        @keyframes rrSlamIn {
          0% { opacity: 0; transform: scale(0.7) translateY(20px); }
          60% { opacity: 1; transform: scale(1.05) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes rrRowIn {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes rrBoltSwing {
          0%, 100% { transform: rotate(-8deg) scale(1); }
          50% { transform: rotate(8deg) scale(1.15); }
        }
        @keyframes rrReadyPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 0 #0a0a0a, 0 0 22px rgba(16,185,129,0.45); }
          50% { transform: scale(1.04); box-shadow: 0 4px 0 #0a0a0a, 0 0 32px rgba(16,185,129,0.7); }
        }
        @keyframes rrCheckPop {
          0% { transform: scale(0); }
          60% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .rr-title { animation: rrSlamIn 360ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .rr-row { animation: rrRowIn 320ms cubic-bezier(0.22,1,0.36,1) both; }
        .rr-row:nth-child(1) { animation-delay: 160ms; }
        .rr-row:nth-child(2) { animation-delay: 240ms; }
        .rr-row:nth-child(3) { animation-delay: 320ms; }
        .rr-bolt { animation: rrBoltSwing 1.2s ease-in-out infinite; display: inline-block; }
        .rr-ready-btn { animation: rrReadyPulse 1.4s ease-in-out infinite; }
        .rr-check-pop { animation: rrCheckPop 320ms cubic-bezier(0.34,1.56,0.64,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .rr-title, .rr-row, .rr-bolt, .rr-ready-btn, .rr-check-pop { animation: none !important; }
        }
      `}</style>

      <div className="px-6 pt-6 pb-2 text-center">
        <div className="rr-title inline-flex items-center gap-2 px-4 py-2 rounded-2xl"
          style={{
            background: `linear-gradient(180deg,#fbbf24,#d97706)`,
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 4px 0 #0a0a0a, 0 0 22px rgba(251,191,36,0.45)',
          }}
        >
          <span className="rr-bolt" aria-hidden="true" style={{ fontSize: 22 }}>⚡</span>
          <h2 className="font-black uppercase" style={{ color: '#1a0a00', fontSize: 20, letterSpacing: '0.08em' }}>
            How Rush Works
          </h2>
        </div>
      </div>

      {wasContested && (
        <div className="px-5 pt-3 pb-0">
          <div
            className="w-full px-3 py-2.5 rounded-xl text-center"
            style={{
              background: myVoteOverruled
                ? 'linear-gradient(180deg, rgba(251,146,60,0.18), rgba(251,146,60,0.06))'
                : 'linear-gradient(180deg, rgba(59,130,246,0.18), rgba(59,130,246,0.06))',
              border: `2.5px solid ${myVoteOverruled ? '#fb923c' : '#3b82f6'}`,
              boxShadow: '0 4px 0 #0a0a0a',
            }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-0.5"
              style={{ color: myVoteOverruled ? '#fb923c' : '#3b82f6' }}
            >
              {myVoteOverruled ? 'Your pick was overruled' : 'You won the tiebreak'}
            </div>
            <div className="text-[12px] font-bold text-white leading-snug">
              {myVoteOverruled
                ? <>You picked different games — host's pick wins. Going with <span className="text-orange-300">{selectedLabel}</span>.</>
                : <>You picked different games — as host your pick wins. Going with <span className="text-blue-300">{selectedLabel}</span>.</>}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pt-2 pb-3 space-y-2">
        {rules.map((r, i) => (
          <div
            key={i}
            className="rr-row flex items-center gap-3 p-2.5 rounded-2xl"
            style={{
              background: 'linear-gradient(180deg,#141414,#0a0a0a)',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(180deg,#0c1a35,#050a15)',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
                fontSize: 20,
              }}
              aria-hidden="true"
            >
              {r.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-extrabold text-sm">{r.label}</div>
              <div className="text-gray-500 text-[11px] mt-0.5">{r.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ready status + button */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <ReadyBadge label="YOU" ready={myReady} color={SELF_COLOR} colorDeep={SELF_COLOR_DEEP} />
          <ReadyBadge
            label={(opponent?.username || 'OPP').toUpperCase()}
            ready={oppReady}
            color={OPP_COLOR}
            colorDeep={OPP_COLOR_DEEP}
          />
        </div>

        <button
          type="button"
          disabled={myReady || pendingReady}
          onClick={onReady}
          className={`w-full py-3.5 rounded-2xl font-black uppercase text-white transition-transform active:scale-95 ${
            myReady || pendingReady ? '' : 'rr-ready-btn'
          }`}
          style={{
            background: myReady
              ? 'linear-gradient(180deg,#10b981,#047857)'
              : 'linear-gradient(180deg,#10b981,#059669)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 4px 0 #0a0a0a',
            letterSpacing: '0.14em',
            fontSize: 15,
            opacity: pendingReady && !myReady ? 0.7 : 1,
            cursor: myReady ? 'default' : pendingReady ? 'wait' : 'pointer',
          }}
        >
          {myReady
            ? oppReady
              ? "Both ready — let's go!"
              : 'Waiting for opponent…'
            : pendingReady
              ? 'Locking in…'
              : "I'm Ready"}
        </button>

        {error && (
          <div className="mt-2 text-[11px] text-red-300 text-center">{error}</div>
        )}
      </div>

      <div className="px-5 pb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2"
        >
          Open full match view
        </button>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }} />
          Ready up to start
        </div>
      </div>
    </div>
  );
}

function ReadyBadge({ label, ready, color, colorDeep }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{
        background: ready
          ? `linear-gradient(180deg, ${color}33, ${colorDeep}33)`
          : 'linear-gradient(180deg,#141414,#0a0a0a)',
        border: ready ? `2.5px solid ${color}` : '2.5px solid #0a0a0a',
        boxShadow: ready ? `0 3px 0 #0a0a0a, 0 0 14px ${color}55` : '0 3px 0 #0a0a0a',
        transition: 'all 200ms ease',
      }}
    >
      <div
        className={ready ? 'rr-check-pop' : ''}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: ready ? color : 'rgba(255,255,255,0.06)',
          border: ready ? '2px solid #0a0a0a' : '2px solid rgba(255,255,255,0.12)',
          color: '#0a0a0a',
          fontSize: 13,
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        {ready ? '✓' : ''}
      </div>
      <div className="min-w-0">
        <div
          className="font-black uppercase truncate"
          style={{ color: ready ? color : 'rgba(229,231,235,0.7)', fontSize: 11, letterSpacing: '0.1em' }}
        >
          {label}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ready ? '#86efac' : 'rgba(156,163,175,0.7)' }}>
          {ready ? 'Ready' : 'Waiting…'}
        </div>
      </div>
    </div>
  );
}

function RushPlayingSlide({ rushState, userId, opponent, pickedAnswer, submittingAnswer, onAnswer, onOpenFullView }) {
  const opponentId = opponent?.id;
  const idx = rushState?.currentQuestionIndex ?? 0;
  const total = rushState?.numQuestions || rushState?.questions?.length || 6;
  const question = rushState?.questions?.[idx];
  const questionDurationMs = rushState?.questionDurationMs || 15000;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const deadline = rushState?.questionDeadline ? new Date(rushState.questionDeadline).getTime() : null;
  const remaining = deadline ? Math.max(0, deadline - now) : questionDurationMs;
  const remainingPct = Math.max(0, Math.min(100, (remaining / questionDurationMs) * 100));
  const remainingSec = Math.ceil(remaining / 1000);
  const urgent = remaining < 5000;
  const timeOut = remaining <= 0;

  const myAnswers = rushState?.answers?.[userId] || {};
  const oppAnswers = opponentId ? (rushState?.answers?.[opponentId] || {}) : {};
  const myAnswerForCurrent = question ? myAnswers[question.id] : null;
  const oppAnswerForCurrent = question ? oppAnswers[question.id] : null;

  const myCorrectSoFar = useMemo(
    () => Object.values(myAnswers).filter(a => a?.correct).length,
    [myAnswers]
  );
  const oppCorrectSoFar = useMemo(
    () => Object.values(oppAnswers).filter(a => a?.correct).length,
    [oppAnswers]
  );

  const lockedKey = pickedAnswer?.questionId === question?.id
    ? pickedAnswer.answerKey
    : myAnswerForCurrent?.key;
  const locked = !!myAnswerForCurrent || timeOut || submittingAnswer;

  if (!question) {
    return (
      <div className="px-6 py-12 text-center text-gray-400 text-sm">Loading question…</div>
    );
  }

  return (
    <div className="relative">
      <style>{`
        @keyframes rpQuestionIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes rpOptionIn {
          0% { opacity: 0; transform: translateX(-8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes rpUrgentPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        .rp-question { animation: rpQuestionIn 280ms cubic-bezier(0.22,1,0.36,1) both; }
        .rp-option { animation: rpOptionIn 240ms cubic-bezier(0.22,1,0.36,1) both; }
        .rp-option:nth-child(1) { animation-delay: 60ms; }
        .rp-option:nth-child(2) { animation-delay: 110ms; }
        .rp-option:nth-child(3) { animation-delay: 160ms; }
        .rp-option:nth-child(4) { animation-delay: 210ms; }
        .rp-urgent { animation: rpUrgentPulse 0.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rp-question, .rp-option, .rp-urgent { animation: none !important; }
        }
      `}</style>

      {/* Header — progress dots + Q-of-N */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 22,
                  height: 6,
                  borderRadius: 999,
                  background: i < idx ? '#fb923c' : i === idx ? 'rgba(251,146,60,0.5)' : 'rgba(255,255,255,0.1)',
                  border: i === idx ? '1px solid rgba(251,146,60,0.6)' : 'none',
                  transition: 'background 150ms ease',
                }}
              />
            ))}
          </div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
            Q{idx + 1}/{total}
          </div>
        </div>

        {/* Live score row */}
        <div className="grid grid-cols-2 gap-2">
          <ScoreChip label="YOU" correct={myCorrectSoFar} answered={!!myAnswerForCurrent} color={SELF_COLOR} />
          <ScoreChip
            label={(opponent?.username || 'OPP').toUpperCase()}
            correct={oppCorrectSoFar}
            answered={!!oppAnswerForCurrent}
            color={OPP_COLOR}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="px-5 pb-3">
        <div
          key={question.id}
          className="rp-question rounded-2xl p-4"
          style={{
            background: 'linear-gradient(180deg,#0c1a35,#050a15)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 3px 0 #0a0a0a',
          }}
        >
          {/* Timer row */}
          <div className="flex items-center justify-between mb-3">
            <div
              className={`text-3xl font-black tabular-nums ${urgent ? 'rp-urgent' : ''}`}
              style={{
                color: urgent ? '#ef4444' : '#fb923c',
                textShadow: urgent ? '0 0 12px rgba(239,68,68,0.6)' : '0 0 10px rgba(251,146,60,0.5)',
              }}
            >
              {remainingSec}s
            </div>
            <div
              className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{
                background: 'rgba(251,191,36,0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.35)',
              }}
            >
              ⚡ Rush
            </div>
          </div>

          {/* Timer bar */}
          <div className="h-1 rounded-full mb-4 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              style={{
                width: `${remainingPct}%`,
                height: '100%',
                background: urgent
                  ? 'linear-gradient(90deg,#ef4444,#f59e0b)'
                  : 'linear-gradient(90deg,#fb923c,#facc15)',
                transition: 'width 100ms linear',
              }}
            />
          </div>

          {/* Prompt */}
          <div className="text-base md:text-lg font-extrabold text-white text-center mb-4 leading-snug">
            {question.prompt}
          </div>

          {/* Options */}
          <div className="space-y-2">
            {question.options?.map((opt) => {
              const isPicked = lockedKey === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={locked}
                  onClick={() => onAnswer(question.id, opt.key)}
                  className="rp-option w-full text-left px-4 py-3 rounded-xl font-extrabold transition-all"
                  style={{
                    background: isPicked
                      ? `linear-gradient(180deg, ${SELF_COLOR}33, ${SELF_COLOR_DEEP}33)`
                      : 'linear-gradient(180deg,#10203d,#0a1428)',
                    border: isPicked ? `2.5px solid ${SELF_COLOR}` : '2.5px solid #0a0a0a',
                    boxShadow: isPicked
                      ? `0 3px 0 #0a0a0a, 0 0 14px ${SELF_COLOR}55`
                      : '0 3px 0 #0a0a0a',
                    color: isPicked ? '#dbeafe' : 'white',
                    fontSize: 14,
                    cursor: locked && !isPicked ? 'not-allowed' : locked ? 'default' : 'pointer',
                    opacity: locked && !isPicked ? 0.55 : 1,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {!myAnswerForCurrent && timeOut && (
            <div className="mt-3 text-center text-[11px] text-red-300 font-bold">
              Time's up — moving on…
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 text-center">
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2"
        >
          Open full match view
        </button>
      </div>
    </div>
  );
}

function ScoreChip({ label, correct, answered, color }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-xl"
      style={{
        background: 'linear-gradient(180deg,#141414,#0a0a0a)',
        border: '2.5px solid #0a0a0a',
        boxShadow: '0 2px 0 #0a0a0a',
      }}
    >
      <div className="min-w-0">
        <div
          className="font-black uppercase truncate"
          style={{ color, fontSize: 10, letterSpacing: '0.1em' }}
        >
          {label}
        </div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
          {answered ? 'Locked in' : 'Picking…'}
        </div>
      </div>
      <div className="text-xl font-black tabular-nums text-white">
        {correct}
      </div>
    </div>
  );
}

function RushCompletedSlide({ rushState, matchup, userId, opponent, onExit }) {
  const opponentId = opponent?.id;
  const myScore = rushState?.scores?.[userId] || { correct: 0, totalTimeMs: 0 };
  const oppScore = (opponentId && rushState?.scores?.[opponentId]) || { correct: 0, totalTimeMs: 0 };
  const winnerType = rushState?.winnerType;
  const isWinner = rushState?.winnerUserId === userId;
  const isTie = winnerType === 'tie';
  const total = rushState?.numQuestions || rushState?.questions?.length || 6;
  const winnerPayout = matchup?.winnerPayout ? parseFloat(matchup.winnerPayout) : 0;

  const headline = isTie ? "It's a Tie" : isWinner ? 'You Won!' : 'You Lost';
  const headlineColor = isTie ? '#06b6d4' : isWinner ? '#facc15' : '#ef4444';
  const subline = isTie
    ? 'Stake refunded to both players'
    : isWinner
      ? `+$${winnerPayout.toFixed(2)} to your bankroll`
      : 'Better luck next round';

  return (
    <div className="relative">
      <style>{`
        @keyframes rcoSlam {
          0% { opacity: 0; transform: scale(0.6) rotate(-6deg); }
          60% { opacity: 1; transform: scale(1.1) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes rcoCardIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .rco-headline { animation: rcoSlam 460ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .rco-card { animation: rcoCardIn 360ms cubic-bezier(0.22,1,0.36,1) both; }
        .rco-card:nth-child(1) { animation-delay: 200ms; }
        .rco-card:nth-child(2) { animation-delay: 280ms; }
        @media (prefers-reduced-motion: reduce) {
          .rco-headline, .rco-card { animation: none !important; }
        }
      `}</style>

      <div className="px-6 pt-7 pb-3 text-center">
        <div
          className="rco-headline inline-block font-black"
          style={{
            color: headlineColor,
            fontSize: 38,
            letterSpacing: '0.02em',
            textShadow: `0 4px 0 #0a0a0a, 0 0 28px ${headlineColor}88`,
          }}
        >
          {headline}
        </div>
        <div className="mt-2 text-xs font-bold text-gray-300">{subline}</div>
      </div>

      <div className="px-5 pb-4 grid grid-cols-2 gap-2">
        <div
          className="rco-card rounded-2xl p-4 text-center"
          style={{
            background: `linear-gradient(180deg, ${SELF_COLOR}22, ${SELF_COLOR_DEEP}22)`,
            border: `2.5px solid ${SELF_COLOR}`,
            boxShadow: '0 3px 0 #0a0a0a',
          }}
        >
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-1"
            style={{ color: SELF_COLOR }}
          >
            You
          </div>
          <div className="text-3xl font-black text-white tabular-nums">
            {myScore.correct}
            <span className="text-sm text-gray-500">/{total}</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {Math.round(myScore.totalTimeMs / 100) / 10}s total
          </div>
        </div>
        <div
          className="rco-card rounded-2xl p-4 text-center"
          style={{
            background: `linear-gradient(180deg, ${OPP_COLOR}22, ${OPP_COLOR_DEEP}22)`,
            border: `2.5px solid ${OPP_COLOR}`,
            boxShadow: '0 3px 0 #0a0a0a',
          }}
        >
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-1 truncate"
            style={{ color: OPP_COLOR }}
          >
            {opponent?.username || 'Opponent'}
          </div>
          <div className="text-3xl font-black text-white tabular-nums">
            {oppScore.correct}
            <span className="text-sm text-gray-500">/{total}</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {Math.round(oppScore.totalTimeMs / 100) / 10}s total
          </div>
        </div>
      </div>

      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={onExit}
          className="w-full py-3.5 rounded-2xl font-black uppercase text-white transition-transform active:scale-95"
          style={{
            background: 'linear-gradient(180deg,#fb923c,#c2410c)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 4px 0 #0a0a0a, 0 0 22px rgba(251,146,60,0.4)',
            letterSpacing: '0.14em',
            fontSize: 14,
          }}
        >
          Back to Battle
        </button>
      </div>
    </div>
  );
}

function RushCountdownSlide({ num }) {
  // num: 3, 2, 1, then 0 (rendered as "GO!"). Each tick is its own
  // mount/unmount so the slam-in animation re-fires every second.
  const isGo = num === 0;
  const display = isGo ? 'GO!' : String(num);
  const accent = isGo ? '#10b981' : num === 1 ? '#ef4444' : num === 2 ? '#fbbf24' : SELF_COLOR;

  return (
    <div className="relative">
      <style>{`
        @keyframes rcSlam {
          0% { opacity: 0; transform: scale(0.2) rotate(-12deg); filter: blur(8px); }
          50% { opacity: 1; transform: scale(1.25) rotate(6deg); filter: blur(0); }
          80% { transform: scale(0.92) rotate(-3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0); }
        }
        @keyframes rcRing {
          0% { opacity: 0.7; transform: scale(0.6); }
          100% { opacity: 0; transform: scale(2.2); }
        }
        @keyframes rcGoFlash {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .rc-num { animation: rcSlam 360ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .rc-ring { animation: rcRing 700ms ease-out both; }
        .rc-go-glow { animation: rcGoFlash 0.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rc-num, .rc-ring, .rc-go-glow { animation: none !important; }
        }
      `}</style>

      <div className="py-12 px-6 flex flex-col items-center justify-center" style={{ minHeight: 320 }}>
        <p className="text-[11px] text-gray-400 font-extrabold uppercase tracking-widest mb-6">
          {isGo ? 'Lock in!' : 'Get ready'}
        </p>
        <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
          {/* Expanding ring on each tick */}
          <div
            key={`ring-${num}`}
            className="rc-ring absolute inset-0 rounded-full"
            style={{
              border: `4px solid ${accent}`,
              boxShadow: `0 0 32px ${accent}`,
            }}
            aria-hidden="true"
          />
          {/* Glow disc behind the digit */}
          <div
            className={isGo ? 'rc-go-glow absolute inset-6 rounded-full' : 'absolute inset-6 rounded-full'}
            style={{
              background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
            }}
            aria-hidden="true"
          />
          {/* Big slam digit */}
          <div
            key={`num-${num}`}
            className="rc-num font-black tabular-nums select-none"
            style={{
              fontSize: isGo ? 84 : 132,
              lineHeight: 1,
              color: '#fff',
              textShadow: `0 4px 0 #0a0a0a, 0 0 28px ${accent}, 0 0 60px ${accent}88`,
              letterSpacing: isGo ? '0.04em' : 0,
            }}
          >
            {display}
          </div>
        </div>
        <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest mt-8">
          {isGo ? 'Loading match…' : 'Rush · 6 props · 15s each'}
        </p>
      </div>
    </div>
  );
}