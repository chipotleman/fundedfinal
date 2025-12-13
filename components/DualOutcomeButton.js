export default function DualOutcomeButton({ 
  betType, 
  leftLabel, 
  rightLabel,
  leftSubLabel,
  rightSubLabel,
  leftOdds, 
  rightOdds,
  leftSelected,
  rightSelected,
  onLeftClick,
  onRightClick,
  formatOdds
}) {
  const getTypeLabel = () => {
    switch(betType) {
      case 'spread': return 'SPREAD';
      case 'total': return 'TOTAL';
      case 'moneyline': return 'ML';
      default: return betType?.toUpperCase();
    }
  };

  return (
    <div className="flex flex-col">
      <div className="text-gray-500 text-[10px] uppercase mb-1 text-center font-medium">
        {getTypeLabel()}
      </div>
      <div className="flex rounded-lg overflow-hidden border border-gray-700 bg-[#1a1a1a]">
        <button
          onClick={onLeftClick}
          aria-pressed={leftSelected}
          aria-label={`${getTypeLabel()}: ${leftLabel} ${leftSubLabel || ''} at ${formatOdds(leftOdds)}`}
          className={`flex-1 py-2 px-2 min-w-[60px] min-h-[44px] flex flex-col items-center justify-center transition-colors ${
            leftSelected 
              ? 'bg-green-600 border-r border-green-500' 
              : 'hover:bg-[#252525] border-r border-gray-700'
          }`}
        >
          <div className={`text-[10px] font-medium truncate max-w-full ${leftSelected ? 'text-white' : 'text-gray-400'}`}>
            {leftLabel}
          </div>
          {leftSubLabel && (
            <div className={`text-xs font-medium ${leftSelected ? 'text-white' : 'text-gray-300'}`}>
              {leftSubLabel}
            </div>
          )}
          <div className={`text-xs font-bold ${leftSelected ? 'text-white' : 'text-green-400'}`}>
            {formatOdds(leftOdds)}
          </div>
        </button>
        
        <button
          onClick={onRightClick}
          aria-pressed={rightSelected}
          aria-label={`${getTypeLabel()}: ${rightLabel} ${rightSubLabel || ''} at ${formatOdds(rightOdds)}`}
          className={`flex-1 py-2 px-2 min-w-[60px] min-h-[44px] flex flex-col items-center justify-center transition-colors ${
            rightSelected 
              ? 'bg-green-600' 
              : 'hover:bg-[#252525]'
          }`}
        >
          <div className={`text-[10px] font-medium truncate max-w-full ${rightSelected ? 'text-white' : 'text-gray-400'}`}>
            {rightLabel}
          </div>
          {rightSubLabel && (
            <div className={`text-xs font-medium ${rightSelected ? 'text-white' : 'text-gray-300'}`}>
              {rightSubLabel}
            </div>
          )}
          <div className={`text-xs font-bold ${rightSelected ? 'text-white' : 'text-green-400'}`}>
            {formatOdds(rightOdds)}
          </div>
        </button>
      </div>
    </div>
  );
}
