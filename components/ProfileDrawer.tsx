'use client'

import { supabase } from '../lib/supabaseClient';
import { useEffect, useState } from 'react'

export default function ProfileDrawer() {
  const [user, setUser] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [bankroll, setBankroll] = useState(0)
  const [challengeTarget, setChallengeTarget] = useState(1000)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('ProfileDrawer user:', user);
      setUser(user)

      if (user) {
        const { data, error } = await supabase
          .from('user_balances')
          .select('balance')
          .eq('id', user.id) // ✅ corrected from 'user_id' to 'id'
          .single()

        if (error) {
          console.error('Error fetching bankroll:', error.message)
        } else {
          console.log('Bankroll fetched:', data);
          setBankroll(data?.balance || 0)
        }
      }
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  const progress = bankroll
  const remaining = challengeTarget - progress

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full bg-green-400 text-black px-4 py-2 font-bold"
      >
        {user?.email?.charAt(0).toUpperCase() || 'U'}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-black border border-green-400 text-green-400 p-4 rounded shadow-xl z-50">
          <h2 className="text-lg font-bold mb-2">Profile</h2>
          <p>Email: {user?.email}</p>
          <p>Bankroll: ${bankroll}</p>
          <p className="mt-2">Challenge Progress:</p>
          <div className="w-full bg-green-900 rounded h-3 mb-2">
            <div
              className="bg-green-400 h-3 rounded"
              style={{ width: `${Math.min((progress / challengeTarget) * 100, 100)}%` }}
            ></div>
          </div>
          <p>${remaining} left to complete</p>
          <button
            onClick={handleLogout}
            className="mt-4 bg-green-400 text-black font-bold px-4 py-2 rounded w-full"
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  )
}
