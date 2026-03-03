import { useState, useEffect, useRef, useMemo } from 'react';

const ALL_MESSAGES = [
  { user: 'SharpBets', msg: 'Lakers ML looking solid tonight', color: 'text-blue-400' },
  { user: 'OddsKing99', msg: 'BetMaster is crushing it rn', color: 'text-emerald-400' },
  { user: 'PicksDaily', msg: 'That spread hit easy', color: 'text-cyan-400' },
  { user: 'ProCapper', msg: 'GG on the over', color: 'text-yellow-400' },
  { user: 'ValuePlay', msg: 'Going all in on moneylines', color: 'text-orange-400' },
  { user: 'LockItIn', msg: 'Risky play taking the underdog there', color: 'text-cyan-400' },
  { user: 'BetBoss', msg: 'That parlay is insane lol', color: 'text-blue-400' },
  { user: 'StatMan', msg: 'The analytics say over hits 62% of the time', color: 'text-emerald-400' },
  { user: 'CashOut', msg: 'Needs a comeback here', color: 'text-cyan-400' },
  { user: 'DailyPicks', msg: 'This match is too close', color: 'text-yellow-400' },
  { user: 'EdgeFinder', msg: 'The line moved from -3 to -5', color: 'text-orange-400' },
  { user: 'ActionJunkie', msg: 'These two are going at it', color: 'text-cyan-400' },
  { user: 'StreakKing', msg: "Let's gooo", color: 'text-blue-400' },
  { user: 'BetSlayer', msg: 'Who else tailing?', color: 'text-emerald-400' },
  { user: 'OddsShark', msg: 'Smart bet on the total there', color: 'text-cyan-400' },
  { user: 'ParlayKid', msg: 'Need one more leg to hit', color: 'text-yellow-400' },
  { user: 'RecordBets', msg: '3-0 run right now sheesh', color: 'text-orange-400' },
  { user: 'ClutchBet', msg: 'Overtime would be crazy here', color: 'text-cyan-400' },
  { user: 'FadeKing', msg: 'Fading the public on this one', color: 'text-blue-400' },
  { user: 'UnitGrinder', msg: 'Slow and steady wins the race', color: 'text-emerald-400' },
  { user: 'LiveBettor', msg: 'In-play is where the value is', color: 'text-cyan-400' },
  { user: 'ChalkEater', msg: 'Favorites been hitting all week', color: 'text-yellow-400' },
  { user: 'DogCatcher', msg: 'Underdog ML is the play', color: 'text-orange-400' },
  { user: 'TotalsMaster', msg: 'Over looking good with the pace', color: 'text-cyan-400' },
  { user: 'SpreadKing', msg: 'Cover city right now', color: 'text-blue-400' },
  { user: 'PropBet', msg: 'Player props are the move', color: 'text-emerald-400' },
  { user: 'SteamChaser', msg: 'Sharp money just came in', color: 'text-cyan-400' },
  { user: 'CapperJoe', msg: 'Model has this at 58% win rate', color: 'text-yellow-400' },
  { user: 'BankrollMgr', msg: 'Solid risk management here', color: 'text-orange-400' },
  { user: 'CloserBets', msg: 'This one is coming down to the wire', color: 'text-cyan-400' },
];

function hashBattleId(id) {
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getMessagesForBattle(battleId) {
  const offset = hashBattleId(battleId);
  const pool = [];
  for (let i = 0; i < ALL_MESSAGES.length; i++) {
    pool.push(ALL_MESSAGES[(i + offset) % ALL_MESSAGES.length]);
  }
  return pool;
}

export default function BattleChat({ battleId, compact = false }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const chatContainerRef = useRef(null);
  const messageIndexRef = useRef(0);
  const viewerCountRef = useRef(Math.floor(Math.random() * 40 + 15));
  const [compactMsgKey, setCompactMsgKey] = useState(0);

  const battleMessages = useMemo(() => getMessagesForBattle(battleId), [battleId]);

  useEffect(() => {
    const initial = battleMessages.slice(0, 3).map((m, i) => ({
      ...m,
      id: `init-${battleId}-${i}`,
      timestamp: Date.now() - (3 - i) * 5000,
    }));
    setMessages(initial);
    messageIndexRef.current = 3;

    const interval = setInterval(() => {
      const idx = messageIndexRef.current % battleMessages.length;
      messageIndexRef.current++;
      setMessages(prev => {
        const next = [
          ...prev.slice(-20),
          {
            ...battleMessages[idx],
            id: `sim-${battleId}-${Date.now()}-${idx}`,
            timestamp: Date.now(),
          },
        ];
        return next;
      });
      setCompactMsgKey(k => k + 1);
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [battleId, battleMessages]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!inputValue.trim()) return;
    setMessages(prev => [
      ...prev.slice(-20),
      {
        user: 'You',
        msg: inputValue.trim(),
        color: 'text-white',
        isOwn: true,
        id: `own-${Date.now()}`,
        timestamp: Date.now(),
      },
    ]);
    setInputValue('');
  };

  if (compact) {
    const lastMsg = messages.slice(-1)[0];
    return (
      <div className="mt-2 border-t border-gray-700/30 pt-2">
        <style>{`
          @keyframes chatSlideIn {
            0% { opacity: 0; transform: translateX(-12px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          .chat-compact-slide {
            animation: chatSlideIn 0.35s ease-out;
          }
        `}</style>
        <div className="flex items-center gap-1 overflow-hidden h-5">
          <span className="text-gray-600 text-[9px] flex-shrink-0">💬</span>
          {lastMsg && (
            <span key={compactMsgKey} className="text-[10px] truncate chat-compact-slide">
              <span className={`font-semibold ${lastMsg.color}`}>{lastMsg.user}</span>
              <span className="text-gray-500 ml-1">{lastMsg.msg}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-700/40 bg-black/30" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">💬</span>
          <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Live Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
          <span className="text-gray-500 text-[9px]">{viewerCountRef.current} watching</span>
        </div>
      </div>
      <div
        ref={chatContainerRef}
        className="chat-scroll h-[120px] overflow-y-auto px-3 py-1.5 space-y-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <style>{`.chat-scroll::-webkit-scrollbar { display: none; }`}</style>
        {messages.map(m => (
          <div key={m.id} className={`text-[11px] leading-relaxed ${m.isOwn ? 'bg-blue-500/10 rounded px-1 -mx-1' : ''}`}>
            <span className={`font-semibold ${m.color}`}>{m.user}</span>
            <span className="text-gray-300 ml-1">{m.msg}</span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-2 pt-1">
        <form
          className="flex items-center gap-2"
          onSubmit={handleSend}
          onClick={e => e.stopPropagation()}
        >
          <input
            type="text"
            value={inputValue}
            onChange={e => { e.stopPropagation(); setInputValue(e.target.value); }}
            onClick={e => e.stopPropagation()}
            onFocus={e => e.stopPropagation()}
            placeholder="Send a message..."
            className="flex-1 bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={e => e.stopPropagation()}
          >
            Chat
          </button>
        </form>
      </div>
    </div>
  );
}