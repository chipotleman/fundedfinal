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

    const userId = '00000000-0000-0000-0000-000000000001';

    const matchups = [
        {
            name: "Knicks vs Lakers",
            market_type: "NBA Moneyline",
            teams: ["Knicks", "Lakers"],
            odds
