import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

const sportOptions = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'Soccer', 'UFC'];

export default function BecomeCapper() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    specialties: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      checkEligibility();
    } else if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=' + encodeURIComponent('/marketplace/become-capper'));
    }
  }, [status]);

  const checkEligibility = async () => {
    try {
      const res = await fetch('/api/marketplace/become-capper');
      if (res.ok) {
        const data = await res.json();
        setEligibility(data);
        if (data.status === 'already_capper') {
          router.push('/marketplace/dashboard');
        }
      }
    } catch (error) {
      console.error('Failed to check eligibility:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialty = (sport) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(sport)
        ? prev.specialties.filter(s => s !== sport)
        : [...prev.specialties, sport]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/marketplace/become-capper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/marketplace/dashboard');
      } else {
        setError(data.error || 'Failed to create capper profile');
      }
    } catch (error) {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Become a Capper | Piks</title>
      </Head>

      <div className="min-h-screen bg-black text-white">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link href="/marketplace" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Marketplace
          </Link>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Become a Piks Verified Capper</h1>
            <p className="text-gray-400 text-lg">Sell your picks and grow your following on the Piks platform</p>
          </div>

          {!eligibility?.isEligible ? (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3">Complete a Challenge First</h2>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                To become a Piks Verified capper, you must first complete one of our funded challenges. This proves your betting skills and earns you the verified badge.
              </p>
              <Link href="/challenge" className="inline-block px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-lg hover:opacity-90 transition-all">
                View Challenges
              </Link>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue-400 font-medium">You've completed a funded challenge! You're eligible to become a capper.</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Display Name *</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Your capper name"
                    required
                    minLength={3}
                    maxLength={50}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                  <p className="text-gray-500 text-sm mt-1">This is how subscribers will find you</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell subscribers about your betting style, experience, and what makes you unique..."
                    rows={4}
                    maxLength={500}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
                  />
                  <p className="text-gray-500 text-sm mt-1">{formData.bio.length}/500 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sports Specialties</label>
                  <div className="flex flex-wrap gap-2">
                    {sportOptions.map(sport => (
                      <button
                        key={sport}
                        type="button"
                        onClick={() => toggleSpecialty(sport)}
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                          formData.specialties.includes(sport)
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !formData.displayName}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all"
                >
                  {submitting ? 'Creating Profile...' : 'Create Capper Profile'}
                </button>
              </form>
            </div>
          )}

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold mb-2">Earn Revenue</h3>
              <p className="text-gray-400 text-sm">Set your own prices and earn from subscriptions</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-bold mb-2">Grow Your Following</h3>
              <p className="text-gray-400 text-sm">Build a community of subscribers</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="font-bold mb-2">Verified Badge</h3>
              <p className="text-gray-400 text-sm">Stand out with Piks Verified status</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
