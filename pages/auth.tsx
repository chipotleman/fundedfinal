// pages/auth.tsx

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (!error) {
        router.push('/dashboard')
      } else {
        alert(error.message)
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (!error) {
        router.push('/dashboard')
      } else {
        alert(error.message)
      }
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-black text-green-400">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 bg-zinc-900 p-8 rounded-xl w-full max-w-md shadow-xl"
      >
        <h1 className="text-2xl font-bold text-center">
          {isLogin ? 'Log In to Rollr' : 'Sign Up for Rollr'}
        </h1>
        <input
          className="p-3 rounded bg-black border border-green-400 text-green-400 placeholder:text-green-600"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="p-3 rounded bg-black border border-green-400 text-green-400 placeholder:text-green-600"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-green-400 text-black font-bold py-3 rounded hover:bg-green-500"
        >
          {isLogin ? 'Log In' : 'Sign Up'}
        </button>
        <p
          className="text-center text-green-500 cursor-pointer underline"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
        </p>
      </form>
    </main>
  )
}
