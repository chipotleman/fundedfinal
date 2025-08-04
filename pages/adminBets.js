
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminBets() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const adminEmail = 'mathewbaldwin13@yahoo.com'; // your admin email

  useEffect(() => {
    const fetchBets = async () => {
      // Check localStorage authentication first
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      
      // Check if user is logged in and is admin
      if (!currentUser.username || currentUser.username !== 'admin') {
        // Fallback to Supabase check
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || session.user.email !== adminEmail) {
          alert('Access denied. Admin privileges required.');
          window.location.href = '/auth';
          return;
        }
      }

      const { data, error } = await supabase
        .from('bets')
        .select('id, user_id, game_id, amount, odds, status')
        .eq('status', 'open');

      if (error) {
        console.error(error.message);
      } else {
        setBets(data);
      }
      setLoading(false);
    };

    fetchBets();
  }, []);

  const gradeBet = async (betId, didWin) => {
    const res = await fetch('/api/admin/settleSingleBet', {
      method: 'POST',
      body: JSON.stringify({ betId, didWin }),
    });
    const data = await res.json();
    alert(data.message);
    location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 py-3 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-center text-white">
            Admin Bet Grading Panel
          </h1>
          <p className="text-center text-purple-100 mt-2 text-sm sm:text-base">
            Grade open bets and update user balances
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        {bets.length > 0 ? (
          <div className="space-y-4 sm:space-y-6">
            {bets.map(bet => (
              <div key={bet.id} className="bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-700 overflow-hidden">
                {/* Bet Info */}
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="bg-slate-700/50 rounded-lg p-3 sm:p-4">
                      <p className="text-gray-400 text-xs sm:text-sm font-medium">Bet ID</p>
                      <p className="text-white font-bold text-sm sm:text-base">{bet.id}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3 sm:p-4">
                      <p className="text-gray-400 text-xs sm:text-sm font-medium">User ID</p>
                      <p className="text-white font-bold text-sm sm:text-base">{bet.user_id}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3 sm:p-4 sm:col-span-2 lg:col-span-1">
                      <p className="text-gray-400 text-xs sm:text-sm font-medium">Game ID</p>
                      <p className="text-white font-bold text-sm sm:text-base">{bet.game_id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4 text-center">
                      <p className="text-gray-400 text-xs sm:text-sm font-medium">Amount</p>
                      <p className="text-green-400 font-bold text-lg sm:text-xl">${bet.amount}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4 text-center">
                      <p className="text-gray-400 text-xs sm:text-sm font-medium">Odds</p>
                      <p className="text-blue-400 font-bold text-lg sm:text-xl">{bet.odds}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <button
                      onClick={() => gradeBet(bet.id, true)}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm sm:text-base">Mark as Won</span>
                    </button>
                    <button
                      onClick={() => gradeBet(bet.id, false)}
                      className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm sm:text-base">Mark as Lost</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 sm:py-16">
            <div className="bg-slate-800 rounded-2xl p-8 sm:p-12 max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">No Open Bets</h3>
              <p className="text-gray-400 text-sm sm:text-base">All bets have been graded or there are no pending bets to process.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
