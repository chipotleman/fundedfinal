import { db } from '../../../lib/db';
import { oddsHistoryPulls } from '../../../shared/schema';
import { desc, eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { action, pullId } = req.query;

    if (action === 'list') {
      try {
        const pulls = await db
          .select({
            id: oddsHistoryPulls.id,
            pulledAt: oddsHistoryPulls.pulledAt,
            gamesCount: oddsHistoryPulls.gamesCount,
            creditUsed: oddsHistoryPulls.creditUsed,
          })
          .from(oddsHistoryPulls)
          .orderBy(desc(oddsHistoryPulls.pulledAt))
          .limit(50);

        return res.status(200).json({ pulls });
      } catch (error) {
        console.error('Failed to fetch pulls:', error);
        return res.status(500).json({ error: 'Failed to fetch pulls' });
      }
    }

    if (action === 'download' && pullId) {
      try {
        const [pull] = await db
          .select()
          .from(oddsHistoryPulls)
          .where(eq(oddsHistoryPulls.id, pullId))
          .limit(1);

        if (!pull) {
          return res.status(404).json({ error: 'Pull not found' });
        }

        const games = pull.sportsData;
        const rows = [];

        for (const game of games) {
          const bookmakers = Object.keys(game.allBookmakerOdds || {});
          
          for (const bookmaker of bookmakers) {
            const odds = game.allBookmakerOdds[bookmaker];
            rows.push({
              'Pull Date': new Date(pull.pulledAt).toLocaleString(),
              'Sport': game.sportName,
              'Away Team': game.awayTeamFull,
              'Home Team': game.homeTeamFull,
              'Game Time': game.time,
              'Bookmaker': bookmaker,
              'Spread Away Point': odds?.spreads?.away?.point || '',
              'Spread Away Odds': odds?.spreads?.away?.odds || '',
              'Spread Home Point': odds?.spreads?.home?.point || '',
              'Spread Home Odds': odds?.spreads?.home?.odds || '',
              'ML Away': odds?.moneyline?.away || '',
              'ML Home': odds?.moneyline?.home || '',
              'Total Over Point': odds?.totals?.over?.point || '',
              'Total Over Odds': odds?.totals?.over?.odds || '',
              'Total Under Point': odds?.totals?.under?.point || '',
              'Total Under Odds': odds?.totals?.under?.odds || '',
            });
          }
        }

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Odds Data');

        const colWidths = [
          { wch: 20 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 12 },
          { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
          { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
        ];
        worksheet['!cols'] = colWidths;

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const filename = `odds_pull_${new Date(pull.pulledAt).toISOString().replace(/[:.]/g, '-')}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        return res.status(200).send(buffer);
      } catch (error) {
        console.error('Failed to generate Excel:', error);
        return res.status(500).json({ error: 'Failed to generate Excel' });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  if (req.method === 'POST') {
    const { action, games, creditUsed } = req.body;

    if (action === 'save') {
      try {
        const [newPull] = await db
          .insert(oddsHistoryPulls)
          .values({
            gamesCount: games?.length || 0,
            sportsData: games || [],
            creditUsed: creditUsed || 0,
          })
          .returning();

        return res.status(200).json({ success: true, pullId: newPull.id });
      } catch (error) {
        console.error('Failed to save pull:', error);
        return res.status(500).json({ error: 'Failed to save pull' });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
