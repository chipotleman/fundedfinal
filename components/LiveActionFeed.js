import { useState, useEffect, useRef } from 'react';

const ACTION_ICONS = {
  goal: '⚽',
  basket: '🏀',
  touchdown: '🏈',
  homerun: '⚾',
  score: '🎯',
  foul: '🟡',
  yellowcard: '🟨',
  redcard: '🟥',
  substitution: '🔄',
  timeout: '⏸️',
  penalty: '⚠️',
  injury: '🏥',
  start: '▶️',
  end: '⏹️',
  halftime: '⏯️',
  corner: '📐',
  offside: '🚩',
  var: '📺',
  assist: '🤝',
  block: '🖐️',
  steal: '💨',
  rebound: '📈',
  turnover: '↩️',
  freethrow: '🎯',
  threepointer: '3️⃣',
  default: '📢'
};

const getActionIcon = (type, text) => {
  const typeLower = (type || '').toLowerCase();
  const textLower = (text || '').toLowerCase();

  if (textLower.includes('goal') || typeLower === 'goal') return ACTION_ICONS.goal;
  if (textLower.includes('touchdown')) return ACTION_ICONS.touchdown;
  if (textLower.includes('3-point') || textLower.includes('three point') || textLower.includes('3pt')) return ACTION_ICONS.threepointer;
  if (textLower.includes('basket') || textLower.includes('score') || textLower.includes('pts')) return ACTION_ICONS.basket;
  if (textLower.includes('foul')) return ACTION_ICONS.foul;
  if (textLower.includes('yellow')) return ACTION_ICONS.yellowcard;
  if (textLower.includes('red card')) return ACTION_ICONS.redcard;
  if (textLower.includes('substitution') || textLower.includes('sub ')) return ACTION_ICONS.substitution;
  if (textLower.includes('timeout') || textLower.includes('time out')) return ACTION_ICONS.timeout;
  if (textLower.includes('penalty')) return ACTION_ICONS.penalty;
  if (textLower.includes('injury') || textLower.includes('injured')) return ACTION_ICONS.injury;
  if (textLower.includes('start') || textLower.includes('kick off') || textLower.includes('tip off')) return ACTION_ICONS.start;
  if (textLower.includes('end') || textLower.includes('final')) return ACTION_ICONS.end;
  if (textLower.includes('half')) return ACTION_ICONS.halftime;
  if (textLower.includes('corner')) return ACTION_ICONS.corner;
  if (textLower.includes('offside')) return ACTION_ICONS.offside;
  if (textLower.includes('var') || textLower.includes('review')) return ACTION_ICONS.var;
  if (textLower.includes('assist')) return ACTION_ICONS.assist;
  if (textLower.includes('block')) return ACTION_ICONS.block;
  if (textLower.includes('steal')) return ACTION_ICONS.steal;
  if (textLower.includes('rebound')) return ACTION_ICONS.rebound;
  if (textLower.includes('turnover')) return ACTION_ICONS.turnover;
  if (textLower.includes('free throw') || textLower.includes('free-throw')) return ACTION_ICONS.freethrow;

  return ACTION_ICONS.default;
};

const getActionColor = (type, text) => {
  const textLower = (text || '').toLowerCase();
  
  if (textLower.includes('goal') || textLower.includes('touchdown') || textLower.includes('score')) {
    return 'border-green-500 bg-green-500/10';
  }
  if (textLower.includes('foul') || textLower.includes('penalty')) {
    return 'border-yellow-500 bg-yellow-500/10';
  }
  if (textLower.includes('red card') || textLower.includes('ejection')) {
    return 'border-red-500 bg-red-500/10';
  }
  if (textLower.includes('timeout') || textLower.includes('injury')) {
    return 'border-orange-500 bg-orange-500/10';
  }
  return 'border-gray-600 bg-gray-800/50';
};

export default function LiveActionFeed({ comments = [], maxItems = 5, homeTeam = '', awayTeam = '' }) {
  const feedRef = useRef(null);
  const [displayedComments, setDisplayedComments] = useState([]);
  const prevCommentsRef = useRef([]);

  useEffect(() => {
    const validComments = (comments || []).filter(c => c && (c.text || c.n));
    
    const dedupeMap = new Map();
    validComments.forEach((c) => {
      const textContent = c.text || c.n || '';
      const minute = c.minute || c.tm || 0;
      const player = c.player || c.p || '';
      const textHash = textContent.substring(0, 30).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const playerHash = player.substring(0, 10).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const deterministicKey = c.id || `feed_${minute}_${textHash}_${playerHash}`;
      
      if (!dedupeMap.has(deterministicKey)) {
        dedupeMap.set(deterministicKey, {
          ...c,
          _key: deterministicKey,
          text: textContent,
          minute: minute || null,
          player: player || null,
          type: c.type || c.mt || 'default'
        });
      }
    });
    
    const sortedComments = Array.from(dedupeMap.values())
      .sort((a, b) => {
        const timeA = parseInt(a.minute) || 0;
        const timeB = parseInt(b.minute) || 0;
        return timeB - timeA;
      })
      .slice(0, maxItems);

    const newKeys = new Set(sortedComments.map(c => c._key));
    const prevKeys = new Set(prevCommentsRef.current.map(c => c._key));
    
    const hasNewComments = sortedComments.some(c => !prevKeys.has(c._key));
    
    setDisplayedComments(sortedComments.map(c => ({
      ...c,
      isNew: hasNewComments && !prevKeys.has(c._key)
    })));

    prevCommentsRef.current = sortedComments;

    if (hasNewComments && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [comments, maxItems]);

  if (!displayedComments || displayedComments.length === 0) {
    return (
      <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">📡</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Live Feed</span>
        </div>
        <p className="text-gray-500 text-xs italic">Waiting for live updates...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/50 bg-gray-800/50">
        <span className="text-sm">📡</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Live Feed</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] text-green-500">LIVE</span>
        </div>
      </div>
      
      <div 
        ref={feedRef}
        className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
      >
        {displayedComments.map((comment, index) => (
          <div
            key={comment._key}
            className={`px-3 py-2 border-l-2 ${getActionColor(comment.type, comment.text)} ${
              comment.isNew ? 'animate-pulse-once' : ''
            } ${index !== displayedComments.length - 1 ? 'border-b border-gray-700/30' : ''}`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">
                {getActionIcon(comment.type, comment.text)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {comment.minute && !isNaN(parseInt(comment.minute)) && (
                    <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-700/50 px-1 rounded">
                      {comment.minute}'
                    </span>
                  )}
                  {comment.player && (
                    <span className="text-xs font-semibold text-white truncate">
                      {comment.player}
                    </span>
                  )}
                </div>
                {comment.text && (
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {comment.text}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
