import { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const CHATTER_FIRST = [
  'Sharp', 'Bet', 'Odds', 'Lock', 'Cash', 'Pick', 'Edge', 'Streak',
  'Clutch', 'Fade', 'Live', 'Chalk', 'Dog', 'Prop', 'Steam', 'Unit',
  'Parlay', 'Capper', 'Action', 'Value', 'Bankroll', 'Record', 'Daily',
  'Closer', 'Total', 'Spread', 'Grind', 'Ace', 'Ice', 'Gold', 'Nitro',
  'Fire', 'Money', 'Stack', 'Pro', 'Crypto', 'Lucky', 'Shadow', 'Iron',
  'Nova', 'Titan', 'Blitz', 'Viper', 'Hawk', 'Cobra', 'Storm', 'Snipe',
];

const CHATTER_SECOND = [
  'King', 'Boss', 'Master', 'Play', 'Man', 'Slayer', 'Shark', 'Kid',
  'Joe', 'Mgr', 'Finder', 'Chaser', 'Eater', 'Catcher', 'Grinder', 'X',
  'Bets', 'Picks', 'Line', 'Rush', 'Veins', 'High', 'Daily', 'Cash',
  'Zone', 'Mode', 'Wave', 'Shot', 'Guru', 'Wiz', 'Pro', 'Dev',
];

const COLORS = [
  'text-blue-400', 'text-emerald-400', 'text-cyan-400',
  'text-yellow-400', 'text-orange-400',
];

const MESSAGE_TEMPLATES = [
  'Lakers ML looking solid tonight',
  'That spread hit easy',
  'GG on the over',
  'Going all in on moneylines',
  'Risky play taking the underdog there',
  'That parlay is insane lol',
  'The analytics say over hits 62%',
  'Needs a comeback here',
  'This match is too close',
  'The line moved from -3 to -5',
  'These two are going at it',
  "Let's gooo 🔥",
  'Who else tailing?',
  'Smart bet on the total there',
  'Need one more leg to hit',
  '3-0 run right now sheesh',
  'Overtime would be crazy here',
  'Fading the public on this one',
  'In-play is where the value is',
  'Favorites been hitting all week',
  'Underdog ML is the play',
  'Over looking good with the pace',
  'Cover city right now',
  'Player props are the move',
  'Sharp money just came in',
  'Model has this at 58% win rate',
  'Solid risk management here',
  'Coming down to the wire',
  'What a pick that was',
  'Been watching this one all day',
  'The juice is worth it here',
  'I hit a 5-legger earlier 💰',
  'This pace is insane',
  'Anyone on the under?',
  'That was a sweat and a half',
  'Already locked my bets in',
  'Riding the hot hand tonight',
  'This is about to get ugly',
  'Defense wins bets 🧱',
  'Took the points and running',
  'He is on a heater rn',
  'Unreal comeback brewing',
  'The public is getting crushed',
  'Line value is juicy here',
  'Full send on the ML',
  'W after W after W',
  'Can feel the momentum shift',
  'Big brain bet right there',
];

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function hashBattleId(id) {
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateChattersForBattle(battleId) {
  const seed = hashBattleId(battleId);
  const rng = seededRng(seed);

  const firstCopy = [...CHATTER_FIRST];
  const secondCopy = [...CHATTER_SECOND];
  for (let i = firstCopy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [firstCopy[i], firstCopy[j]] = [firstCopy[j], firstCopy[i]];
  }
  for (let i = secondCopy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [secondCopy[i], secondCopy[j]] = [secondCopy[j], secondCopy[i]];
  }

  const count = 8;
  const chatters = [];
  for (let i = 0; i < count; i++) {
    const first = firstCopy[i % firstCopy.length];
    const second = secondCopy[i % secondCopy.length];
    const useNumber = rng() > 0.6;
    const num = useNumber ? String(Math.floor(rng() * 99) + 1) : '';
    chatters.push({
      name: `${first}${second}${num}`,
      color: COLORS[Math.floor(rng() * COLORS.length)],
    });
  }
  return chatters;
}

function generateMessagesForBattle(battleId, chatters) {
  const seed = hashBattleId(battleId) + 9999;
  const rng = seededRng(seed);

  const shuffled = [...MESSAGE_TEMPLATES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.map((msg, i) => {
    const chatter = chatters[i % chatters.length];
    return { user: chatter.name, msg, color: chatter.color };
  });
}

export default function BattleChat({ battleId, compact = false }) {
  const { isDarkMode } = useTheme();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const chatContainerRef = useRef(null);
  const messageIndexRef = useRef(0);
  const viewerCountRef = useRef(Math.floor(Math.random() * 40 + 15));
  const [compactMsgKey, setCompactMsgKey] = useState(0);

  const { chatters, battleMessages } = useMemo(() => {
    const c = generateChattersForBattle(battleId);
    const m = generateMessagesForBattle(battleId, c);
    return { chatters: c, battleMessages: m };
  }, [battleId]);

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
      <div className="mt-1.5" style={{ borderTop: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, paddingTop: '5px' }}>
        <style>{`
          @keyframes chatSlideIn {
            0% { opacity: 0; transform: translateX(-12px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          .chat-compact-slide {
            animation: chatSlideIn 0.35s ease-out;
          }
        `}</style>
        <div className="flex items-center gap-1 overflow-hidden" style={{ height: '16px' }}>
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
    <div style={{ borderTop: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, backgroundColor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.03)' }} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-2.5 py-1" style={{ borderBottom: `1px solid ${isDarkMode ? '#141414' : '#e5e7eb'}` }}>
        <div className="flex items-center gap-1">
          <span className="text-[9px]">💬</span>
          <span className="text-gray-500 text-[9px] font-semibold uppercase tracking-wider">Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 bg-green-500 rounded-full"></div>
          <span className="text-gray-600 text-[8px]">{viewerCountRef.current}</span>
        </div>
      </div>
      <div
        ref={chatContainerRef}
        className="chat-scroll overflow-y-auto px-2.5"
        style={{ height: '88px', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', paddingTop: '3px', paddingBottom: '3px' }}
      >
        <style>{`.chat-scroll::-webkit-scrollbar { display: none; }`}</style>
        {messages.map(m => (
          <div
            key={m.id}
            className={`leading-tight ${m.isOwn ? 'bg-blue-500/10 rounded px-1 -mx-1' : ''}`}
            style={{ fontSize: '10px', paddingTop: '1px', paddingBottom: '1px' }}
          >
            <span className={`font-bold ${m.color}`}>{m.user}</span>
            <span className={`ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{m.msg}</span>
          </div>
        ))}
      </div>
      <div className="px-2.5 pb-1.5 pt-0.5">
        <form
          className="flex items-center gap-1.5"
          onSubmit={handleSend}
          onClick={e => e.stopPropagation()}
        >
          <input
            type="text"
            value={inputValue}
            onChange={e => { e.stopPropagation(); setInputValue(e.target.value); }}
            onClick={e => e.stopPropagation()}
            onFocus={e => e.stopPropagation()}
            placeholder="Say something..."
            className="flex-1 rounded-md placeholder-gray-600 focus:outline-none"
            style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, padding: '4px 8px', fontSize: '10px', color: isDarkMode ? '#fff' : '#111' }}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-blue-600 text-white font-bold rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ fontSize: '9px', padding: '4px 8px' }}
            onClick={e => e.stopPropagation()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
