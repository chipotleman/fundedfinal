export function simulateOddsMovement(games) {
  return games.map(game => {
    const newGame = JSON.parse(JSON.stringify(game));
    
    // ALWAYS update at least one thing per game for visible changes
    newGame.lines.spread = simulateSpreadMovement(game.lines.spread);
    newGame.lines.total = simulateTotalMovement(game.lines.total);
    newGame.lines.moneyline = simulateMoneylineMovement(game.lines.moneyline);
    
    return newGame;
  });
}

function simulateSpreadMovement(spread) {
  const newSpread = { ...spread };
  
  if (spread.away.point === 'N/A') return spread;
  
  // ALWAYS change odds - guaranteed
  const awayChange = Math.random() < 0.5 ? 5 : -5;
  const homeChange = Math.random() < 0.5 ? 5 : -5;
  
  let newAwayOdds = spread.away.odds + awayChange;
  let newHomeOdds = spread.home.odds + homeChange;
  
  // Keep odds in valid range
  if (newAwayOdds > -100 && newAwayOdds < 100) newAwayOdds = awayChange > 0 ? 100 : -100;
  if (newHomeOdds > -100 && newHomeOdds < 100) newHomeOdds = homeChange > 0 ? 100 : -100;
  newAwayOdds = Math.max(-250, Math.min(250, newAwayOdds));
  newHomeOdds = Math.max(-250, Math.min(250, newHomeOdds));
  
  newSpread.away = {
    ...spread.away,
    odds: newAwayOdds,
    oddsMoved: awayChange > 0 ? 'up' : 'down'
  };
  newSpread.home = {
    ...spread.home,
    odds: newHomeOdds,
    oddsMoved: homeChange > 0 ? 'up' : 'down'
  };
  
  // 30% chance of line movement too
  if (Math.random() < 0.3) {
    const awayNum = parseFloat(spread.away.point);
    const homeNum = parseFloat(spread.home.point);
    const lineMove = Math.random() < 0.5 ? 0.5 : -0.5;
    const newAway = awayNum + lineMove;
    const newHome = homeNum - lineMove;
    newSpread.away.point = newAway > 0 ? `+${newAway}` : `${newAway}`;
    newSpread.home.point = newHome > 0 ? `+${newHome}` : `${newHome}`;
    newSpread.away.moved = lineMove > 0 ? 'up' : 'down';
    newSpread.home.moved = lineMove > 0 ? 'down' : 'up';
  }
  
  return newSpread;
}

function simulateTotalMovement(total) {
  const newTotal = { ...total };
  
  if (total.over.point === 'N/A') return total;
  
  // ALWAYS change odds - guaranteed
  const overChange = Math.random() < 0.5 ? 5 : -5;
  const underChange = Math.random() < 0.5 ? 5 : -5;
  
  let newOverOdds = total.over.odds + overChange;
  let newUnderOdds = total.under.odds + underChange;
  
  // Keep odds in valid range
  if (newOverOdds > -100 && newOverOdds < 100) newOverOdds = overChange > 0 ? 100 : -100;
  if (newUnderOdds > -100 && newUnderOdds < 100) newUnderOdds = underChange > 0 ? 100 : -100;
  newOverOdds = Math.max(-250, Math.min(250, newOverOdds));
  newUnderOdds = Math.max(-250, Math.min(250, newUnderOdds));
  
  newTotal.over = {
    ...total.over,
    odds: newOverOdds,
    oddsMoved: overChange > 0 ? 'up' : 'down'
  };
  newTotal.under = {
    ...total.under,
    odds: newUnderOdds,
    oddsMoved: underChange > 0 ? 'up' : 'down'
  };
  
  // 30% chance of line movement
  if (Math.random() < 0.3) {
    const overNum = parseFloat(total.over.point.replace('O ', ''));
    const underNum = parseFloat(total.under.point.replace('U ', ''));
    const lineMove = Math.random() < 0.5 ? 0.5 : -0.5;
    newTotal.over.point = `O ${overNum + lineMove}`;
    newTotal.under.point = `U ${underNum + lineMove}`;
    newTotal.over.moved = lineMove > 0 ? 'up' : 'down';
    newTotal.under.moved = lineMove > 0 ? 'up' : 'down';
  }
  
  return newTotal;
}

function simulateMoneylineMovement(moneyline) {
  const newMoneyline = { ...moneyline };
  
  if (typeof moneyline.away !== 'number') return moneyline;
  
  // ALWAYS change moneyline - guaranteed
  const awayChange = (Math.random() < 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1) * 5;
  const homeChange = (Math.random() < 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1) * 5;
  
  let newAway = moneyline.away + awayChange;
  let newHome = moneyline.home + homeChange;
  
  // Handle crossing zero
  if (newAway > -100 && newAway < 100) newAway = awayChange > 0 ? 100 : -100;
  if (newHome > -100 && newHome < 100) newHome = homeChange > 0 ? 100 : -100;
  
  newMoneyline.away = newAway;
  newMoneyline.home = newHome;
  newMoneyline.awayMoved = awayChange > 0 ? 'up' : 'down';
  newMoneyline.homeMoved = homeChange > 0 ? 'up' : 'down';
  
  return newMoneyline;
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
