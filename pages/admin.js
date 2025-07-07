// pages/admin.js

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [passwordInput, setPasswordInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [pnlInput, setPnlInput] = useState('');

  const adminPassword = 'Bandit@Gary99!';

  const handleAuth = () => {
    if (passwordInput === adminPassword) {
      setAuthenticated(true);
    } else {
      alert('Incorrect password');
    }
  };

  const fetchEvaluation = async () => {
    const { data, error } = await supabase
      .from('evaluations')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      alert('Error fetching user evaluation');
      console.error(error);
    } else {
      setEvaluation(data);
    }
  };

  const updatePnl = async () => {
    if (!evaluation) {
      alert('Fetch a user first.');
      return;
    }

    const newTotalPnl = (evaluation.total_pnl || 0) + parseFloat(pnlInput);
    let newStatus = evaluation.status;

    if (newTotalPnl >= 20) {
      newStatus = 'passed';
      alert(`${email} has PASSED with PnL ${newTotalPnl}%`);
    } else if (newTotalPnl <= -10) {
      newStatus = 'failed';
      alert(`${email} has FAILED with PnL ${newTotalPnl}%`);
    }

    const { error } = await supabase
      .from('evaluations')
      .update({ total_pnl: newTotalPnl, status: newStatus })
      .eq('email', email);

    if (error) {
      alert('Error updating PnL');
      console.error(error);
    } else {
      alert(`PnL updated to ${newTotalPnl}. Status: ${newStatus}`);
      fetchEvaluation();
    }
  };

  if (!authenticated) {
    return (
      <div style={{ background: '#000', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h2>Enter Admin Password</h2>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          style={{ padding: '10px', marginTop: '10px' }}
        />
        <button onClick={handleAuth} style={{ padding: '10px', marginTop: '10px', backgroundColor: '#a020f0', color: '#fff' }}>Enter</button>
      </div>
    );
  }

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#a020f0' }}>RollrFunded Admin Panel</h1>

      <div style={{ marginTop: '20px' }}>
        <input
          type="email"
          placeholder="User Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '10px', width: '250px' }}
        />
        <button onClick={fetchEvaluation} style={{ padding: '10px', marginLeft: '10px', backgroundColor: '#a020f0', color: '#fff' }}>Fetch User</button>
      </div>

      {evaluation && (
        <div style={{ marginTop: '20px' }}>
          <p>Email: {evaluation.email}</p>
          <p>Status: {evaluation.status}</p>
          <p>Total PnL: {evaluation.total_pnl || 0}</p>
          <p>Evaluation Ends: {evaluation.evaluation_end_date ? new Date(evaluation.evaluation_end_date).toLocaleDateString() : 'N/A'}</p>

          <input
            type="number"
            placeholder="Daily PnL"
            value={pnlInput}
            onChange={(e) => setPnlInput(e.target.value)}
            style={{ padding: '10px', width: '150px', marginTop: '10px' }}
          />
          <button onClick={updatePnl} style={{ padding: '10px', marginLeft: '10px', backgroundColor: '#a020f0', color: '#fff' }}>Update PnL</button>
        </div>
      )}
    </div>
  );
}
