import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import Head from 'next/head';

const withdrawalMethods = [
  {
    id: 'bank_transfer',
    name: 'Bank Transfer (ACH)',
    description: 'Direct deposit to your bank account',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    fee: 'Free',
    time: '3-5 business days',
    minAmount: 100,
  },
  {
    id: 'instant_transfer',
    name: 'Instant Transfer',
    description: 'Receive funds within minutes',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    fee: '1.5%',
    time: 'Within 30 minutes',
    minAmount: 50,
  },
  {
    id: 'venmo',
    name: 'Venmo',
    description: 'Send to your Venmo account',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 3.5C20.5 5 21 6.5 21 8.5c0 5-4 11-7.5 15H6l-2.5-15 6-0.5 1 10c1.5-2.5 3-6 3-8.5 0-1.5-0.5-2.5-1-3.5l4.5-2.5z"/>
      </svg>
    ),
    fee: 'Free',
    time: '1-2 business days',
    minAmount: 25,
  },
  {
    id: 'wire',
    name: 'Wire Transfer',
    description: 'International wire transfer',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    fee: '$25',
    time: '1-3 business days',
    minAmount: 500,
  },
  {
    id: 'check',
    name: 'Check',
    description: 'Mailed check to your address',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    fee: 'Free',
    time: '7-10 business days',
    minAmount: 100,
  },
];

export default function WithdrawalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/');
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/profiles/${session.user.id}`);
        if (response.ok) {
          const profile = await response.json();
          setUserProfile(profile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session, status, router]);

  const challengeData = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('purchased_challenge') || '{}') : {};
  const startingBalance = challengeData?.startingBalance || 10000;
  const currentBalance = userProfile?.bankroll ? parseFloat(userProfile.bankroll) : startingBalance;
  const profit = Math.max(0, currentBalance - startingBalance);
  const userSplit = challengeData?.userSplit || 80;
  const availableToWithdraw = Math.floor(profit * (userSplit / 100));

  const handleWithdraw = () => {
    alert('Withdrawal request submitted! This feature is coming soon.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Withdrawal - Piks</title>
      </Head>
      <TopNavbar />
      
      <div className="min-h-screen bg-black pt-4 pb-20 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Withdraw Funds</h1>
          <p className="text-gray-400 mb-8">Transfer your earnings to your preferred account</p>

          <div className="bg-[#111111] rounded-2xl p-6 border border-gray-800/50 mb-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-gray-500 text-sm mb-1">Total Profit</div>
                <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${profit.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">Available to Withdraw</div>
                <div className="text-2xl font-bold text-white">
                  ${availableToWithdraw.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">({userSplit}% of profits)</div>
              </div>
            </div>
          </div>

          {availableToWithdraw <= 0 ? (
            <div className="bg-[#111111] rounded-2xl p-8 border border-gray-800/50 text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Funds Available</h3>
              <p className="text-gray-400 mb-6">
                You need to earn profits in your challenge before you can withdraw. Keep betting and hit your targets!
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 px-8 rounded-xl transition-all"
              >
                Go to The Lab
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-4">Select Withdrawal Method</h2>
              
              <div className="space-y-3 mb-8">
                {withdrawalMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={`w-full p-4 rounded-xl border transition-all text-left ${
                      selectedMethod === method.id
                        ? 'bg-green-500/10 border-green-500/50'
                        : 'bg-[#111111] border-gray-800/50 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`${selectedMethod === method.id ? 'text-green-400' : 'text-gray-400'}`}>
                        {method.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-white font-semibold">{method.name}</h3>
                          <div className="flex items-center gap-2">
                            {selectedMethod === method.id && (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-500 text-sm mt-1">{method.description}</p>
                        <div className="flex gap-4 mt-2 text-xs">
                          <span className="text-gray-400">Fee: <span className="text-white">{method.fee}</span></span>
                          <span className="text-gray-400">Time: <span className="text-white">{method.time}</span></span>
                          <span className="text-gray-400">Min: <span className="text-white">${method.minAmount}</span></span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedMethod && (
                <div className="bg-[#111111] rounded-2xl p-6 border border-gray-800/50 mb-6">
                  <label className="block text-gray-400 text-sm mb-2">Withdrawal Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">$</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      max={availableToWithdraw}
                      className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl py-4 pl-10 pr-4 text-white text-xl font-bold focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-gray-500">Min: ${withdrawalMethods.find(m => m.id === selectedMethod)?.minAmount}</span>
                    <button 
                      onClick={() => setAmount(availableToWithdraw.toString())}
                      className="text-green-400 hover:text-green-300"
                    >
                      Max: ${availableToWithdraw.toLocaleString()}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleWithdraw}
                disabled={!selectedMethod || !amount || parseFloat(amount) <= 0}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  selectedMethod && amount && parseFloat(amount) > 0
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                Request Withdrawal
              </button>
              
              <p className="text-center text-gray-500 text-sm mt-4">
                Withdrawals are processed within 24-48 hours. You'll receive an email confirmation.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
