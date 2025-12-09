export function simulateOddsMovement(games) {
  return games.map(game => {
    const newGame = JSON.parse(JSON.stringify(game));
    
    if (Math.random() < 0.3) {
      newGame.lines.spread = simulateSpreadMovement(game.lines.spread);
    }
    
    if (Math.random() < 0.3) {
      newGame.lines.total = simulateTotalMovement(game.lines.total);
    }
    
    if (Math.random() < 0.4) {
      newGame.lines.moneyline = simulateMoneylineMovement(game.lines.moneyline);
    }
    
    return newGame;
  });
}

function simulateSpreadMovement(spread) {
  const newSpread = { ...spread };
  
  if (spread.away.point === 'N/A') return spread;
  
  const awayNum = parseFloat(spread.away.point);
  const homeNum = parseFloat(spread.home.point);
  
  const lineMove = (Math.random() < 0.15) ? (Math.random() < 0.5 ? 0.5 : -0.5) : 0;
  
  if (lineMove !== 0) {
    const newAway = awayNum + lineMove;
    const newHome = homeNum - lineMove;
    newSpread.away = {
      point: newAway > 0 ? `+${newAway}` : `${newAway}`,
      odds: spread.away.odds,
      moved: lineMove > 0 ? 'up' : 'down'
    };
    newSpread.home = {
      point: newHome > 0 ? `+${newHome}` : `${newHome}`,
      odds: spread.home.odds,
      moved: lineMove > 0 ? 'down' : 'up'
    };
  } else {
    newSpread.away = {
      ...spread.away,
      odds: adjustOdds(spread.away.odds),
      moved: null
    };
    newSpread.home = {
      ...spread.home,
      odds: adjustOdds(spread.home.odds),
      moved: null
    };
  }
  
  const awayOddsDiff = newSpread.away.odds - spread.away.odds;
  const homeOddsDiff = newSpread.home.odds - spread.home.odds;
  if (awayOddsDiff !== 0) newSpread.away.oddsMoved = awayOddsDiff > 0 ? 'up' : 'down';
  if (homeOddsDiff !== 0) newSpread.home.oddsMoved = homeOddsDiff > 0 ? 'up' : 'down';
  
  return newSpread;
}

function simulateTotalMovement(total) {
  const newTotal = { ...total };
  
  if (total.over.point === 'N/A') return total;
  
  const overNum = parseFloat(total.over.point.replace('O ', ''));
  const underNum = parseFloat(total.under.point.replace('U ', ''));
  
  const lineMove = (Math.random() < 0.15) ? (Math.random() < 0.5 ? 0.5 : -0.5) : 0;
  
  if (lineMove !== 0) {
    const newOver = overNum + lineMove;
    const newUnder = underNum + lineMove;
    newTotal.over = {
      point: `O ${newOver}`,
      odds: total.over.odds,
      moved: lineMove > 0 ? 'up' : 'down'
    };
    newTotal.under = {
      point: `U ${newUnder}`,
      odds: total.under.odds,
      moved: lineMove > 0 ? 'up' : 'down'
    };
  } else {
    newTotal.over = {
      ...total.over,
      odds: adjustOdds(total.over.odds),
      moved: null
    };
    newTotal.under = {
      ...total.under,
      odds: adjustOdds(total.under.odds),
      moved: null
    };
  }
  
  const overOddsDiff = newTotal.over.odds - total.over.odds;
  const underOddsDiff = newTotal.under.odds - total.under.odds;
  if (overOddsDiff !== 0) newTotal.over.oddsMoved = overOddsDiff > 0 ? 'up' : 'down';
  if (underOddsDiff !== 0) newTotal.under.oddsMoved = underOddsDiff > 0 ? 'up' : 'down';
  
  return newTotal;
}

function simulateMoneylineMovement(moneyline) {
  const newMoneyline = { ...moneyline };
  
  if (typeof moneyline.away !== 'number') return moneyline;
  
  const awayChange = adjustMoneylineOdds(moneyline.away);
  const homeChange = adjustMoneylineOdds(moneyline.home);
  
  newMoneyline.away = awayChange.odds;
  newMoneyline.home = homeChange.odds;
  newMoneyline.awayMoved = awayChange.moved;
  newMoneyline.homeMoved = homeChange.moved;
  
  return newMoneyline;
}

function adjustOdds(odds) {
  if (typeof odds !== 'number') return odds;
  
  if (Math.random() < 0.7) return odds;
  
  const change = Math.random() < 0.5 ? 5 : -5;
  let newOdds = odds + change;
  
  if (newOdds > -100 && newOdds < 100) {
    newOdds = change > 0 ? 100 : -100;
  }
  
  return Math.max(-200, Math.min(200, newOdds));
}

function adjustMoneylineOdds(odds) {
  if (typeof odds !== 'number') return { odds, moved: null };
  
  if (Math.random() < 0.6) return { odds, moved: null };
  
  const magnitude = Math.abs(odds);
  let change;
  
  if (magnitude < 150) {
    change = Math.random() < 0.5 ? 5 : -5;
  } else if (magnitude < 300) {
    change = Math.random() < 0.5 ? 10 : -10;
  } else {
    change = Math.random() < 0.5 ? 15 : -15;
  }
  
  let newOdds = odds + change;
  
  if (newOdds > -100 && newOdds < 100) {
    newOdds = change > 0 ? 100 : -100;
  }
  
  const moved = change > 0 ? 'up' : 'down';
  
  return { odds: newOdds, moved };
}

export function updateBetSlipWithNewOdds(selectedBets, games) {
  return selectedBets.map(bet => {
    const game = games.find(g => g.id === bet.gameId);
    if (!game) return bet;
    
    let newOdds = bet.odds;
    let newPoint = bet.point;
    let oddsMoved = null;
    let lineMoved = null;
    
    if (bet.betType === 'spread') {
      const isAway = bet.selection.includes(game.awayTeam);
      const lineData = isAway ? game.lines.spread.away : game.lines.spread.home;
      newOdds = lineData.odds;
      newPoint = lineData.point;
      oddsMoved = lineData.oddsMoved;
      lineMoved = lineData.moved;
    } else if (bet.betType === 'total') {
      const isOver = bet.selection.toLowerCase().includes('over');
      const lineData = isOver ? game.lines.total.over : game.lines.total.under;
      newOdds = lineData.odds;
      newPoint = lineData.point;
      oddsMoved = lineData.oddsMoved;
      lineMoved = lineData.moved;
    } else if (bet.betType === 'moneyline') {
      const isAway = bet.selection === game.awayTeam;
      newOdds = isAway ? game.lines.moneyline.away : game.lines.moneyline.home;
      oddsMoved = isAway ? game.lines.moneyline.awayMoved : game.lines.moneyline.homeMoved;
    }
    
    const oddsChanged = newOdds !== bet.odds;
    const lineChanged = newPoint !== bet.point;
    
    return {
      ...bet,
      odds: newOdds,
      point: newPoint,
      oddsChanged,
      lineChanged,
      oddsMoved,
      lineMoved,
      previousOdds: oddsChanged ? bet.odds : null,
      previousPoint: lineChanged ? bet.point : null
    };
  });
}
