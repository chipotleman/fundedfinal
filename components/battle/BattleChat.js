import { useState, useEffect, useRef } from 'react';

const SIMULATED_MESSAGES = [
  { user: 'SharpBets', msg: 'Lakers ML looking solid tonight 🔥', color: 'text-blue-400' },
  { user: 'OddsKing99', msg: 'BetMaster is crushing it rn', color: 'text-emerald-400' },
  { user: 'PicksDaily', msg: 'That spread hit easy', color: 'text-cyan-400' },
  { user: 'ProCapper', msg: 'GG on the over 💰', color: 'text-yellow-400' },
  { user: 'ValuePlay', msg: 'Player 1 is going all in on moneylines', color: 'text-orange-400' },
  { user: 'LockItIn', msg: 'Risky play taking the underdog there', color: 'text-pink-400' },
  { user: 'BetBoss', msg: 'That parlay is insane lol', color: 'text-blue-400' },
  { user: 'StatMan', msg: 'The analytics say over hits 62% of the time', color: 'text-emerald-400' },
  { user: 'CashOut', msg: 'Player 2 needs a comeback 📈', color: 'text-cyan-400' },
  { user: 'DailyPicks', msg: 'This match is too close', color: 'text-yellow-400' },
  { user: 'EdgeFinder', msg: 'The line moved from -3 to -5 👀', color: 'text-orange-400' },
  { user: 'ActionJunkie', msg: 'These two are going at it', color: 'text-pink-400' },
  { user: 'StreakKing', msg: "Let's gooo 🏆", color: 'text-blue-400' },
  { user: 'BetSlayer', msg: 'Who else tailing Player 1?', color: 'text-emerald-400' },
  { user: 'OddsShark', msg: 'Smart bet on the total there', color: 'text-cyan-400' },
  { user: 'ParlayKid', msg: 'Need one more leg to hit 🙏', color: 'text-yellow-400' },
  { user: 'RecordBets', msg: '3-0 run right now sheesh', color: 'text-orange-400' },
  { user: 'ClutchBet', msg: 'Overtime would be crazy here', color: 'text-pink-400' },
];

export default function BattleChat({ battleId, compact = false }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef(null);
  const messageIndexRef = useRef(0);

  useEffect(() => {
    const initial = SIMULATED_MESSAGES.slice(0, 3).map((m, i) => ({
      ...m,
      id: `init-${i}`,
      timestamp: Date.now() - (3 - i) * 5000,
    }));
    setMessages(initial);
    messageIndexRef.current = 3;

    const interval = setInterval(() => {
      const idx = messageIndexRef.current % SIMULATED_MESSAGES.length;
      messageIndexRef.current++;
      setMessages(prev => {
        const next = [
          ...prev.slice(-20),
          {
            ...SIMULATED_MESSAGES[idx],
            id: `sim-${Date.now()}-${idx}`,
            timestamp: Date.now(),
          },
        ];
        return next;
      });
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [battleId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
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
    return (
      <div className="mt-2 border-t border-gray-700/30 pt-2">
        <div className="flex items-center gap-1 overflow-hidden h-5">
          <span className="text-gray-600 text-[9px] flex-shrink-0">💬</span>
          {messages.slice(-1).map(m => (
            <span key={m.id} className="text-[10px] truncate">
              <span className={`font-semibold ${m.color}`}>{m.user}</span>
              <span className="text-gray-500 ml-1">{m.msg}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-700/40 bg-black/30">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">💬</span>
          <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Live Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
          <span className="text-gray-500 text-[9px]">{Math.floor(Math.random() * 40 + 15)} watching</span>
        </div>
      </div>
      <div className="h-[120px] overflow-y-auto px-3 py-1.5 space-y-0.5 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {messages.map(m => (
          <div key={m.id} className={`text-[11px] leading-relaxed ${m.isOwn ? 'bg-blue-500/10 rounded px-1 -mx-1' : ''}`}>
            <span className={`font-semibold ${m.color}`}>{m.user}</span>
            <span className="text-gray-300 ml-1">{m.msg}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="px-3 pb-2 pt-1">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Send a message..."
            className="flex-1 bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}
