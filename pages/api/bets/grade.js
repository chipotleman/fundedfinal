import { db } from '../../../lib/db';
import { userBets, profiles, completedGames } from '../../../shared/schema';
import { eq, or, gte } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const allCompletedGames = [];
    
    const gamesResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:5000'}/api/games`);
    if (gamesResponse.ok) {
      const gamesData = await gamesResponse.json();
      const apiCompletedGames = gamesData.games?.filter(g => g.isCompleted || g.status === 'FINAL') || [];
      
      for (const game of apiCompletedGames) {
        allCompletedGames.push(game);
        
        try {
          const existingGame = await db
            .select()
            .from(completedGames)
            .where(eq(completedGames.id, game.id))
            .limit(1);
          
          if (existingGame.length === 0) {
            await db.insert(completedGames).values({
              id: game.id,
              sport: game.sport || game.sportKey,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              homeTeamFull: game.homeTeamFull,
              awayTeamFull: game.awayTeamFull,
              homeScore: parseInt(game.homeScore) || 0,
              awayScore: parseInt(game.awayScore) || 0,
              commenceTime: game.commenceTime ? new Date(game.commenceTime) : null,
              completedAt: new Date(),
            });
            console.log(`[GRADING] Saved completed game: ${game.awayTeamFull} @ ${game.homeTeamFull} (${game.awayScore}-${game.homeScore})`);
          }
        } catch (saveError) {
          console.error(`[GRADING] Error saving game ${game.id}:`, saveError.message);
        }
      }
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const storedGames = await db
      .select()
      .from(completedGames)
      .where(gte(completedGames.completedAt, sevenDaysAgo));

    for (const storedGame of storedGames) {
      if (!allCompletedGames.find(g => g.id === storedGame.id)) {
        allCompletedGames.push({
          id: storedGame.id,
          sport: storedGame.sport,
          homeTeam: storedGame.homeTeam,
          awayTeam: storedGame.awayTeam,
          homeTeamFull: storedGame.homeTeamFull,
          awayTeamFull: storedGame.awayTeamFull,
          homeScore: storedGame.homeScore,
          awayScore: storedGame.awayScore,
          isCompleted: true,
          status: 'FINAL'
        });
      }
    }

    console.log(`[GRADING] Total completed games available: ${allCompletedGames.length}`);

    if (allCompletedGames.length === 0) {
      return res.status(200).json({ message: 'No completed games to grade', graded: 0 });
    }

    const gamesMap = {};
    allCompletedGames.forEach(game => {
      gamesMap[game.id] = game;
      if (game.awayTeamFull && game.homeTeamFull) {
        gamesMap[`${game.awayTeamFull} @ ${game.homeTeamFull}`] = game;
      }
      if (game.awayTeam && game.homeTeam) {
        gamesMap[`${game.awayTeam} @ ${game.homeTeam}`] = game;
      }
    });
    
    const openBets = await db
      .select()
      .from(userBets)
      .where(eq(userBets.status, 'pending'));

    console.log(`[GRADING] Found ${openBets.length} pending bets`);
    console.log(`[GRADING] Completed games:`, allCompletedGames.map(g => `${g.awayTeamFull || g.awayTeam} @ ${g.homeTeamFull || g.homeTeam} (${g.awayScore}-${g.homeScore})`));

    const betsToGrade = openBets.filter(bet => {
      if (gamesMap[bet.matchupName]) return true;
      
      if (bet.legs && Array.isArray(bet.legs)) {
        return bet.legs.some(leg => gamesMap[leg.matchup]);
      }
      return false;
    });
    
    console.log(`[GRADING] Bets to grade: ${betsToGrade.length}`, betsToGrade.map(b => b.matchupName));

    if (betsToGrade.length === 0) {
      return res.status(200).json({ message: 'No bets to grade for completed games', graded: 0, completedGamesCount: allCompletedGames.length });
    }

    let gradedCount = 0;
    const updates = [];

    for (const bet of betsToGrade) {
      const isParlay = bet.marketType?.toLowerCase().includes('parlay') || (bet.legs && bet.legs.length > 1);
      
      if (isParlay && bet.legs && bet.legs.length > 0) {
        const legResults = bet.legs.map(leg => {
          if (leg.isCompleted) {
            return { graded: true, won: leg.won === true, push: leg.push === true };
          }
          
          const game = gamesMap[leg.matchup];
          if (!game) return { graded: false };
          return gradeLeg(leg, game);
        });

        const allGraded = legResults.every(r => r.graded);
        if (!allGraded) continue;

        const anyLost = legResults.some(r => !r.won && !r.push);
        const allPush = legResults.every(r => r.push);
        const nonPushLegs = legResults.filter(r => !r.push);
        const wonNonPushLegs = nonPushLegs.length === 0 || nonPushLegs.every(r => r.won);

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
          stake: bet.stake,
          homeScore: null,
          awayScore: null
        });
        gradedCount++;
      } else {
        const game = gamesMap[bet.matchupName];
        if (!game) continue;

        const result = gradeLeg({
          selection: bet.selection,
          betType: bet.marketType,
          homeTeam: bet.homeTeamFull || game.homeTeam,
          awayTeam: bet.awayTeamFull || game.awayTeam,
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
          stake: bet.stake,
          homeScore: parseInt(game.homeScore) || 0,
          awayScore: parseInt(game.awayScore) || 0
        });
        gradedCount++;
      }
    }

    for (const update of updates) {
      const updateData = {
        status: update.status,
        pnl: update.pnl,
        settledAt: new Date()
      };
      if (update.homeScore !== null) updateData.homeScore = update.homeScore;
      if (update.awayScore !== null) updateData.awayScore = update.awayScore;
      
      await db
        .update(userBets)
        .set(updateData)
        .where(eq(userBets.id, update.betId));

      if (update.status === 'won' || update.status === 'push') {
        const [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, update.userId))
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
            .where(eq(profiles.id, update.userId));
        }
      }
    }

    return res.status(200).json({
      message: `Graded ${gradedCount} bets`,
      graded: gradedCount,
      completedGamesCount: allCompletedGames.length,
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
