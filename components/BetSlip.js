export default function BetSlip({ selectedMatchup, selectedTeam, stake, setStake, onPlaceBet, placing, message }) {
    const decimalToAmerican = (decimal) => {
        if (decimal >= 2) {
            return `+${Math.round((decimal - 1) * 100)}`;
        } else {
            return `${Math.round(-100 / (decimal - 1))}`;
        }
    };

    const calculatePotentialPayout = () => {
        if (!selectedMatchup || !selectedTeam || !stake) return 0;
        const decimal = selectedMatchup.odds[selectedTeam];
        return (parseFloat(stake) * decimal).toFixed(2);
    };

    if (!selectedMatchup || !selectedTeam) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-green-400 p-4 shadow-xl z-50">
            <h3 className="text-center text-green-400 font-bold mb-2">🎟️ Bet Slip</h3>
            <div className="text-center mb-2">
                <p className="text-lg font-semibold">{selectedTeam} @ {decimalToAmerican(selectedMatchup.odds[selectedTeam])}</p>
            </div>
            <div className="flex justify-center">
                <input
                    type="number"
                    placeholder="Stake ($10 - $100)"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="w-40 p-2 rounded bg-black border border-gray-600 text-center text-white"
                />
            </div>
            {stake && (
                <p className="text-center text-sm text-gray-300 mt-1">
                    Potential Payout: <span className="text-green-400 font-bold">${calculatePotentialPayout()}</span>
                </p>
            )}
            <button
                onClick={onPlaceBet}
                disabled={placing}
                className="mt-3 w-full py-3 rounded bg-green-400 text-black font-bold hover:bg-green-300 transition"
            >
                {placing ? 'Placing...' : 'Place Bet'}
            </button>
            {message && <p className="text-center mt-2">{message}</p>}
        </div>
    );
}
