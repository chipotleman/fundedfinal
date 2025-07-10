// pages/dashboard.js

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import MatchupCard from '../components/MatchupCard';
import BetSlip from '../components/BetSlip';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
    const [bets, setBets] = useState([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedMatchup, setSelectedMatchup] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [stake, setStake] = useState('');
    const [placing, setPlacing] = useState(false);
    const [message, setMessage] = useState('');

    const userId = '00000000-0000-0000-0000-000000000001'; // Replace with your real user ID if needed

    const matchups = [
        {
            name: "Knicks vs Lakers",
            market_type: "NBA Moneyline",
            teams: ["Knicks", "Lakers"],
            odds: { Knicks: 1.9, Lakers: 2.1 },
        },
        {
            name: "Celtics vs Heat",
            market_type: "NBA Moneyline",
            teams: ["Celtics", "Heat"],
            odds: { Celtics: 1.8, Heat: 2.2 },
        },
    ];

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            const { data: betsData } = await supabase
                .from('user_bets')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            const { data: balanceData } = await supabase
                .from('user_balances')
                .select('balance')
                .eq('id', userId)
                .single();

            setBets(betsData || []);
            setBalance(balanceData ? parseFloat(balanceData.balance) : 0);
            setLoading(false);
        };

        fetchData();
    }, [userId]);

    const handleSelectTeam = (matchup, team) => {
        setSelectedMatchup(matchup);
        setSelectedTeam(team);
    };

    const handlePlaceBet = async () => {
        setMessage('');
        if (!selectedMatchup || !selectedTeam) {
            setMessage('⚠️ Please select a matchup and team.');
            return;
        }

        const parsedStake = parseFloat(stake);
        if (isNaN(parsedStake) || parsedStake < 10 || parsedStake > 100) {
            setMessage('⚠️ Stake must be between $10 and $100.');
            return;
        }

        if (parsedStake > balance) {
            setMessage('⚠️ Insufficient balance.');
            return;
        }

        setPlacing(true);

        const { name, market_type, odds, teams } = selectedMatchup;
        const selectedOdds = odds[selectedTeam];

        const { error: betError } = await supabase.from('user_bets').insert({
            user_id: userId,
            selection: selectedTeam,
            stake: parsedStake,
            odds: selectedOdds,
            market_type,
            matchup_name: name,
            status: 'open',
            teams,
        });

        if (betError) {
            setMessage(`❌ Error placing bet: ${betError.message}`);
        } else {
            const newBalance = balance - parsedStake;
            const { error: updateError } = await supabase
                .from('user_balances')
                .upsert({ id: userId, balance: newBalance }, { onConflict: 'id' });

            if (updateError) {
                setMessage(`❌ Error updating balance: ${updateError.message}`);
            } else {
                setBalance(newBalance);
                setMessage(`✅ Bet placed on ${selectedTeam} for $${parsedStake}.`);
                setStake('');
                setSelectedMatchup(null);
                setSelectedTeam('');
            }
        }

        setPlacing(false);
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans">
            {/* Header with Rollr Logo */}
            <header className="sticky top-0 bg-black bg-opacity-90 p-4 flex justify-between items-center shadow z-50">
                <div className="flex items-center gap-3">
                    <img src="/rollr-logo.png" alt="Rollr Logo" className="h-10 w-auto" />
                    <h1 className="text-xl md:text-2xl font-bold text-green-400">RollrFunded Sportsbook</h1>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400">Available Balance</p>
                    <p className="text-lg font-bold text-green-400">${balance.toFixed(2)}</p>
                </div>
            </header>

            {/* Matchups grid */}
            <main className="max-w-6xl mx-auto p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {matchups.map((matchup) => (
                    <MatchupCard
                        key={matchup.name}
                        matchup={matchup}
                        onSelectTeam={handleSelectTeam}
                        selectedTeam={selectedMatchup?.name === matchup.name ? selectedTeam : ''}
                    />
                ))}
            </main>

            {/* Bet slip */}
            <BetSlip
                selectedMatchup={selectedMatchup}
                selectedTeam={selectedTeam}
                stake={stake}
                setStake={setStake}
                onPlaceBet={handlePlaceBet}
                placing={placing}
                message={message}
            />

            {/* My Bets Table */}
            <section className="max-w-6xl mx-auto p-4 mt-8">
                <h2 className="text-lg font-bold text-green-400 mb-2">📄 My Bets</h2>
                {loading ? (
                    <p>Loading bets...</p>
                ) : (
                    <div className="overflow-x-auto rounded shadow">
                        <table className="min-w-full text-sm bg-gray-800 rounded">
                            <thead className="bg-gray-700 text-green-400">
                                <tr>
                                    <th className="px-2 py-2">Created</th>
                                    <th className="px-2 py-2">Status</th>
                                    <th className="px-2 py-2">PNL</th>
                                    <th className="px-2 py-2">Selection</th>
                                    <th className="px-2 py-2">Stake</th>
                                    <th className="px-2 py-2">Odds</th>
                                    <th className="px-2 py-2">Matchup</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bets.map((bet) => (
                                    <tr key={bet.id} className="text-center border-t border-gray-700">
                                        <td className="px-2 py-2">{new Date(bet.created_at).toLocaleString()}</td>
                                        <td className="px-2 py-2">{bet.status}</td>
                                        <td className="px-2 py-2">{bet.pnl !== null ? `$${bet.pnl.toFixed(2)}` : '-'}</td>
                                        <td className="px-2 py-2">{bet.selection || '-'}</td>
                                        <td className="px-2 py-2">{bet.stake !== null ? `$${bet.stake}` : '-'}</td>
                                        <td className="px-2 py-2">{bet.odds ? bet.odds : '-'}</td>
                                        <td className="px-2 py-2">{bet.matchup_name || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
