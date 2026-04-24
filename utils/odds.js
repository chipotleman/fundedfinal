export function americanToDecimal(odds) {
  const num = typeof odds === 'string' ? parseFloat(odds) : odds;
  if (!Number.isFinite(num) || num === 0) return null;
  if (num > 0) return 1 + num / 100;
  return 1 + 100 / Math.abs(num);
}

export function calculatePayout(odds, stake) {
  const stakeNum = typeof stake === 'string' ? parseFloat(stake) : stake;
  const oddsNum = typeof odds === 'string' ? parseFloat(odds) : odds;
  if (!Number.isFinite(stakeNum) || !Number.isFinite(oddsNum) || oddsNum === 0) {
    return 0;
  }
  if (oddsNum > 0) {
    return stakeNum + (stakeNum * oddsNum / 100);
  }
  return stakeNum + (stakeNum * 100 / Math.abs(oddsNum));
}

export function formatOdds(odds, format = 'american') {
  if (odds === null || odds === undefined || odds === '') return '-';
  const num = typeof odds === 'string' ? parseFloat(odds) : odds;
  if (!Number.isFinite(num) || num === 0) return '-';

  if (format === 'decimal') {
    const dec = americanToDecimal(num);
    if (dec === null) return '-';
    return dec.toFixed(2);
  }
  return num > 0 ? `+${num}` : `${num}`;
}
