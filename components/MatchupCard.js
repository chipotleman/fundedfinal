export default function MatchupCard({ matchup, onSelectTeam, selectedTeam }) {
    const decimalToAmerican = (decimal) => {
        if (decimal >= 2) {
            return `+${Math.round((decimal - 1) * 100)}`;
        } else {
            return `${Math.round(-100 / (decimal - 1))}`;
        }
    };

    return (
        <div className="bg-gray-900 rounded-xl shadow-lg hover:shadow-green-400 transition transform hover:-translate-y-1 p-4 border border-gray-700 hover:border-green-400">
            <h2 className="text-lg font-bold text-center mb-3">{matchup.name}</h2>
            <div className="flex gap-2">
                {matchup.teams.map((team) => (
                    <button
                        key={team}
                        onClick={() => onSelectTeam(matchup, team)}
                        className={`flex-1 py-3 rounded font-semibold border text-lg transition ${
                            selectedTeam === team
                                ? 'bg-green-400 text-black border-green-400'
                                : 'bg-black text-white border-gray-600 hover:bg-gray-800'
                        }`}
                    >
                        {team} ({decimalToAmerican(matchup.odds[team])})
                    </button>
                ))}
            </div>
        </div>
    );
}
