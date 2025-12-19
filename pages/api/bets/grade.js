import { db } from '../../../lib/db';
import { userBets, profiles } from '../../../lib/schema';
import { eq, and, inArray } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const gamesResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:5000'}/api/games`);
    if (!gamesResponse.ok) {
      return res.status(500).json({ error: 'Failed to fetch games data' });
    }
    
    const gamesData = await gamesResponse.json();
    const completedGames = gamesData.games?.filter(g => g.isCompleted || g.status === 'FINAL') || [];
    
    if (completedGames.length === 0) {
      return res.status(200).json({ message: 'No completed games to grade', graded: 0 });
    }

    const gameIds = completedGames.map(g => g.id);
    const gameMatchups = completedGames.map(g => `${g.awayTeamFull} @ ${g.homeTeamFull}`);
    
    const openBets = await db
      .select()
      .from(userBets)
      .where(eq(userBets.status, 'open'));

    const betsToGrade = openBets.filter(bet => {
      if (gameIds.includes(bet.gameId)) return true;
      if (gameMatchups.includes(bet.matchup)) return true;
      
      if (bet.legs && Array.isArray(bet.legs)) {
        return bet.legs.some(leg => 
          gameIds.includes(leg.gameId) || gameMatchups.includes(leg.matchup)
        );
      }
      return false;
    });

    if (betsToGrade.length === 0) {
      return res.status(200).json({ message: 'No bets to grade for completed games', graded: 0 });
    }

    const gamesMap = {};
    completedGames.forEach(game => {
      gamesMap[game.id] = game;
      gamesMap[`${game.awayTeamFull} @ ${game.homeTeamFull}`] = game;
      gamesMap[`${game.awayTeam} @ ${game.homeTeam}`] = game;
    });

    let gradedCount = 0;
    const updates = [];

    for (const bet of betsToGrade) {
      const isParlay = bet.betType?.toLowerCase().includes('parlay') || (bet.legs && bet.legs.length > 1);
      
      if (isParlay && bet.legs && bet.legs.length > 0) {
        const legResults = bet.legs.map(leg => {
          const game = gamesMap[leg.gameId] || gamesMap[leg.matchup];
          if (!game || !game.isCompleted) return { graded: false };
          return gradeLeg(leg, game);
        });

        const allGraded = legResults.every(r => r.graded);
        if (!allGraded) continue;

        const anyLost = legResults.some(r => !r.won && !r.push);
        const allPush = legResults.every(r => r.push);
        const nonPushLegs = legResults.filter(r => !r.push);
        const wonNonPushLegs = nonPushLegs.every(r => r.won);

        let status, pnl;
        if (allPush) {
          status = 'push';
          pnl = 0;
        } else if (anyLost) {
          status = 'lost';
          pnl = -bet.stake;
        } else if (wonNonPushLegs) {
          status = 'won';
          pnl = calculatePayout(bet.stake, bet.odds) - bet.stake;
        } else {
          continue;
        }

        updates.push({
          betId: bet.id,
          status,
          pnl,
          userId: bet.userId,
          stake: bet.stake
        });
        gradedCount++;
      } else {
        const game = gamesMap[bet.gameId] || gamesMap[bet.matchup];
        if (!game || !game.isCompleted) continue;

        const result = gradeLeg({
          selection: bet.selection,
          betType: bet.betType,
          homeTeam: bet.homeTeam || game.homeTeam,
          awayTeam: bet.awayTeam || game.awayTeam,
          homeTeamFull: bet.homeTeamFull || game.homeTeamFull,
          awayTeamFull: bet.awayTeamFull || game.awayTeamFull
        }, game);

        if (!result.graded) continue;

        let status, pnl;
        if (result.push) {
          status = 'push';
          pnl = 0;
        } else if (result.won) {
          status = 'won';
          pnl = calculatePayout(bet.stake, bet.odds) - bet.stake;
        } else {
          status = 'lost';
          pnl = -bet.stake;
        }

        updates.push({
          betId: bet.id,
          status,
          pnl,
          userId: bet.userId,
          stake: bet.stake
        });
        gradedCount++;
      }
    }

    for (const update of updates) {
      await db
        .update(userBets)
        .set({
          status: update.status,
          pnl: update.pnl,
          settledAt: new Date()
        })
        .where(eq(userBets.id, update.betId));

      if (update.status === 'won' || update.status === 'push') {
        const [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, update.userId))
          .limit(1);

        if (profile) {
          let bankrollChange;
          if (update.status === 'won') {
            bankrollChange = parseFloat(update.pnl) + parseFloat(update.stake);
          } else {
            bankrollChange = parseFloat(update.stake);
          }
          const newBankroll = parseFloat(profile.bankroll) + bankrollChange;
          await db
            .update(profiles)
            .set({ bankroll: newBankroll })
            .where(eq(profiles.userId, update.userId));
        }
      }
    }

    return res.status(200).json({
      message: `Graded ${gradedCount} bets`,
      graded: gradedCount,
      updates: updates.map(u => ({ betId: u.betId, status: u.status, pnl: u.pnl }))
    });

  } catch (error) {
    console.error('Bet grading error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function gradeLeg(leg, game) {
  const selection = (leg.selection || '').toLowerCase();
  const betType = (leg.betType || '').toLowerCase();
  const homeScore = parseInt(game.homeScore) || 0;
  const awayScore = parseInt(game.awayScore) || 0;

  const homeTeamLower = (game.homeTeamFull || game.homeTeam || '').toLowerCase();
  const awayTeamLower = (game.awayTeamFull || game.awayTeam || '').toLowerCase();
  const homeNickname = homeTeamLower.split(' ').pop();
  const awayNickname = awayTeamLower.split(' ').pop();

  if (betType.includes('spread') || selection.match(/[+-]\d+\.?\d*/)) {
    const spreadMatch = selection.match(/([+-]?\d+\.?\d*)/);
    if (!spreadMatch) return { graded: false };
    
    const spread = parseFloat(spreadMatch[1]);
    const isHomePick = selection.includes(homeNickname) || selection.includes(homeTeamLower.split(' ')[0]);
    
    let adjustedScore;
    if (isHomePick) {
      adjustedScore = homeScore + spread;
      if (adjustedScore === awayScore) return { graded: true, won: false, push: true };
      return { graded: true, won: adjustedScore > awayScore, push: false };
    } else {
      adjustedScore = awayScore + spread;
      if (adjustedScore === homeScore) return { graded: true, won: false, push: true };
      return { graded: true, won: adjustedScore > homeScore, push: false };
    }
  }

  if (betType.includes('total') || selection.includes('over') || selection.includes('under')) {
    const pointMatch = selection.match(/(\d+\.?\d*)/);
    if (!pointMatch) return { graded: false };
    
    const line = parseFloat(pointMatch[1]);
    const totalScore = homeScore + awayScore;
    
    if (totalScore === line) return { graded: true, won: false, push: true };
    
    if (selection.includes('over')) {
      return { graded: true, won: totalScore > line, push: false };
    } else if (selection.includes('under')) {
      return { graded: true, won: totalScore < line, push: false };
    }
    return { graded: false };
  }

  if (betType.includes('moneyline') || betType.includes('ml') || 
      (!betType.includes('spread') && !betType.includes('total'))) {
    const isHomePick = selection.includes(homeNickname) || selection.includes(homeTeamLower.split(' ')[0]);
    const isAwayPick = selection.includes(awayNickname) || selection.includes(awayTeamLower.split(' ')[0]);
    
    if (isHomePick) {
      if (homeScore === awayScore) return { graded: true, won: false, push: true };
      return { graded: true, won: homeScore > awayScore, push: false };
    } else if (isAwayPick) {
      if (homeScore === awayScore) return { graded: true, won: false, push: true };
      return { graded: true, won: awayScore > homeScore, push: false };
    }
    return { graded: false };
  }

  return { graded: false };
}

function calculatePayout(stake, odds) {
  const stakeNum = parseFloat(stake);
  const oddsNum = parseInt(odds);
  
  if (oddsNum > 0) {
    return stakeNum + (stakeNum * oddsNum / 100);
  } else {
    return stakeNum + (stakeNum * 100 / Math.abs(oddsNum));
  }
}
