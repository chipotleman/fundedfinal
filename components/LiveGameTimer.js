import { useState, useEffect } from 'react';

export default function LiveGameTimer({ elapsedTime, period, sport, stateCode }) {
  const [displayTime, setDisplayTime] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');

  useEffect(() => {
    const formatTime = () => {
      if (!elapsedTime && !period) {
        return { time: 'LIVE', period: '' };
      }

      let timeStr = '';
      let periodStr = '';

      if (typeof elapsedTime === 'string' && elapsedTime.includes(':')) {
        timeStr = elapsedTime;
      } else if (typeof elapsedTime === 'number') {
        const minutes = Math.floor(elapsedTime / 60);
        const seconds = elapsedTime % 60;
        timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }

      if (period) {
        const sportLower = (sport || '').toLowerCase();
        if (sportLower.includes('basket') || sportLower === 'nba' || sportLower === 'ncaab') {
          const quarterMap = { '1': '1ST QTR', '2': '2ND QTR', '3': '3RD QTR', '4': '4TH QTR', 'OT': 'OVERTIME' };
          periodStr = quarterMap[period] || `Q${period}`;
        } else if (sportLower.includes('hockey') || sportLower === 'nhl') {
          const periodMap = { '1': '1ST', '2': '2ND', '3': '3RD', 'OT': 'OT', 'SO': 'SHOOTOUT' };
          periodStr = periodMap[period] || `P${period}`;
        } else if (sportLower.includes('football') || sportLower === 'nfl' || sportLower === 'ncaaf') {
          const quarterMap = { '1': '1ST QTR', '2': '2ND QTR', '3': '3RD QTR', '4': '4TH QTR', 'OT': 'OVERTIME' };
          periodStr = quarterMap[period] || `Q${period}`;
        } else if (sportLower.includes('soccer')) {
          if (period === '1') periodStr = '1ST HALF';
          else if (period === '2') periodStr = '2ND HALF';
          else if (period === 'HT') periodStr = 'HALFTIME';
          else periodStr = period;
        } else if (sportLower.includes('baseball') || sportLower === 'mlb') {
          const inningNum = parseInt(period);
          if (!isNaN(inningNum)) {
            const suffix = inningNum === 1 ? 'ST' : inningNum === 2 ? 'ND' : inningNum === 3 ? 'RD' : 'TH';
            periodStr = `${inningNum}${suffix} INN`;
          } else {
            periodStr = period;
          }
        } else {
          periodStr = period;
        }
      }

      if (stateCode) {
        const stateMap = {
          'HT': 'HALFTIME',
          'FT': 'FINAL',
          'ET': 'EXTRA TIME',
          'PEN': 'PENALTIES',
          'BREAK': 'BREAK',
          'END': 'END OF PERIOD'
        };
        if (stateMap[stateCode]) {
          periodStr = stateMap[stateCode];
        }
      }

      return { time: timeStr || 'LIVE', period: periodStr };
    };

    const { time, period: periodText } = formatTime();
    setDisplayTime(time);
    setPeriodLabel(periodText);
  }, [elapsedTime, period, sport, stateCode]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        <span className="text-red-500 text-xs font-bold tracking-wide">LIVE</span>
      </div>
      {periodLabel && (
        <span className="text-gray-400 text-xs font-medium">
          {periodLabel}
        </span>
      )}
      {displayTime && displayTime !== 'LIVE' && (
        <span 
          className="text-white text-xs font-mono font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
        >
          {displayTime}
        </span>
      )}
    </div>
  );
}
