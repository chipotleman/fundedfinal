// pages/dashboard.js

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import ProfileDrawer from '../components/ProfileDrawer';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedBets, setSelectedBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUserAndEvaluation = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error getting session:', sessionError.message);
      }

      if (!session) {
        router.push('/login');
        return;
      }

      console.log('Logged in user:', session.user);
      setUser(session.user);

      const { data, error: evalError } = await supabase
        .from('evaluations')
        .select('*')
        .eq('email', session.user.email)
        .order('evaluation_end_date', { ascending: false })
        .limit(1);

      console.log('Supabase returned evaluation data:', data);
      console.log('Supabase returned evaluation error:', evalError);

      if (evalError) {
        console.error('Error fetching evaluation:', evalError.message);
      } else if (data && data.length > 0) {
        setEvaluation(data[0]);
      }

      // Fetch games for betting
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'active');

      if (gamesError) {
        console.error('Error fetching games:', gamesError.message);
      } else {
        setGames(gamesData || []);
      }

      setLoading(false);
    };

    getUserAndEvaluation();
  }, [router]);

  const handleBetSelect = (game) => {
    if (selectedBets.find(bet => bet.id === game.id)) {
      setSelectedBets(selectedBets.filter(bet => bet.id !== game.id));
    } else {
      setSelectedBets([...selectedBets, game]);
    }
  };

  const placeBets = async () => {
    if (!selectedBets.length) {
      alert('No bets selected.');
      return;
    }

    const betsToPlace = selectedBets.map(bet => ({
      user_id: user.id,
      game_id: bet.id,
      amount: 100, // default bet amount
      odds: bet.odds,
      status: 'open',
    }));

    const { error } = await supabase.from('bets').insert(betsToPlace);

    if (error) {
      console.error('Error placing bets:', error.message);
      alert('Error placing bets.');
    } else {
      alert('Bets placed successfully!');
      setSelectedBets([]);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>
        Loading your dashboard...
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>
        No funded evaluation found for your account.
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: "#000",
      color: "#fff",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "sans-serif",
      padding: "20px"
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        maxWidth: "800px",
        margin: "0 auto",
        paddingBottom: "20px"
      }}>
        <h1 style={{ fontSize: "2rem", color: "#a020f0", textShadow: "0 0 10px #a020f0" }}>
          Dashboard
        </h1>
        <ProfileDrawer />
      </div>

      {/* Evaluation Info */}
      <div style={{
        textAlign: "center",
        marginBottom: "30px"
      }}>
        <h2>Welcome, {user.email}</h2>
        <p>Evaluation ends: {new Date(evaluation.evaluation_end_date).toLocaleDateString()}</p>
        <p>Status: {evaluation.status}</p>
      </div>

      {/* Game Listing */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "20px",
        maxWidth: "1000px",
        margin: "0 auto"
      }}>
        {games.length > 0 ? games.map(game => (
          <div key={game.id} style={{
            border: selectedBets.find(bet => bet.id === game.id) ? "2px solid #00ff00" : "1px solid #444",
            borderRadius: "8px",
            padding: "10px",
            cursor: "pointer",
            backgroundColor: "#111",
            boxShadow: "0 0 10px #a020f0"
          }}
            onClick={() => handleBetSelect(game)}
          >
            <h3 style={{ color: "#a020f0" }}>{game.home_team} vs {game.away_team}</h3>
            <p>Date: {new Date(game.start_time).toLocaleString()}</p>
            <p>Odds: {game.odds}</p>
          </div>
        )) : (
          <p style={{ textAlign: "center", width: "100%" }}>No active games available for betting.</p>
        )}
      </div>

      {/* Bet Slip */}
      {selectedBets.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          backgroundColor: "#111",
          border: "2px solid #a020f0",
          borderRadius: "8px",
          padding: "15px",
          boxShadow: "0 0 10px #a020f0",
          maxWidth: "300px",
          color: "#fff"
        }}>
          <h3 style={{ color: "#a020f0" }}>Your Bet Slip</h3>
          {selectedBets.map(bet => (
            <div key={bet.id} style={{ borderBottom: "1px solid #333", padding: "5px 0" }}>
              {bet.home_team} vs {bet.away_team} @ {bet.odds}
            </div>
          ))}
          <button
            onClick={placeBets}
            style={{
              backgroundColor: "#a020f0",
              color: "#fff",
              padding: "10px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginTop: "10px",
              width: "100%"
            }}
          >
            Place Bets
          </button>
        </div>
      )}
    </div>
  );
}
