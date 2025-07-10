'use client'

import ProfileDrawer from '../components/ProfileDrawer'

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-black text-green-400">
      <header className="flex justify-between items-center p-4 border-b border-green-800">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <ProfileDrawer />
      </header>

      <section className="p-6">
        {/* Replace this with your actual dashboard content */}
        <div className="bg-zinc-900 p-6 rounded-xl shadow-lg text-green-400">
          <h2 className="text-xl font-semibold mb-2">Welcome to your funded dashboard</h2>
          <p className="text-green-500">
            Track your challenge, view your bankroll, and place your performance bets here.
          </p>
        </div>
      </section>
    </main>
  )
}
