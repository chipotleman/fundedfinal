import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';

export default function PaymentSuccess() {
  const router = useRouter();
  const { data: session } = useSession();
  const [challengeData, setChallengeData] = useState(null);
  const [licenseKey, setLicenseKey] = useState('');

  useEffect(() => {
    const pending = localStorage.getItem('pending_challenge');
    if (pending) {
      const data = JSON.parse(pending);
      setChallengeData(data);
      
      const newLicenseKey = generateLicenseKey();
      setLicenseKey(newLicenseKey);
      
      const purchasedData = {
        ...data,
        licenseKey: newLicenseKey,
        purchaseDate: new Date().toISOString()
      };
      localStorage.setItem('purchased_challenge', JSON.stringify(purchasedData));
      localStorage.removeItem('pending_challenge');
    }
  }, []);

  const generateLicenseKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;
    let result = '';
    
    for (let i = 0; i < segments; i++) {
      if (i > 0) result += '-';
      for (let j = 0; j < segmentLength; j++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
    }
    
    const timestamp = Date.now().toString().slice(-4);
    return `${result}-${timestamp}`;
  };

  const handleBeginChallenge = () => {
    router.push('/dashboard');
  };

  const getThemeColors = () => {
    if (!challengeData) return { gradient: 'from-green-500 to-blue-500', text: 'text-green-400' };
    
    if (challengeData.badge === 'BEGINNER') {
      return { gradient: 'from-blue-500 to-blue-600', text: 'text-blue-400' };
    } else if (challengeData.badge === 'POPULAR') {
      return { gradient: 'from-green-500 to-blue-500', text: 'text-green-400' };
    } else {
      return { gradient: 'from-purple-500 to-purple-600', text: 'text-purple-400' };
    }
  };

  const theme = getThemeColors();

  return (
    <>
      <Head>
        <title>Payment Successful - Piks</title>
      </Head>
      
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-3xl p-8 border border-slate-700">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
            <p className="text-gray-400">Your challenge has been activated</p>
          </div>

          {challengeData && (
            <div className="bg-slate-800/50 rounded-xl p-6 mb-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">{challengeData.name}</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Starting Balance</span>
                  <span className={`${theme.text} font-bold`}>${challengeData.startingBalance?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Profit Split</span>
                  <span className="text-white font-medium">{challengeData.userSplit}% You / {100 - challengeData.userSplit}% Piks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount Paid</span>
                  <span className="text-white font-medium">${challengeData.adjustedPrice}</span>
                </div>
              </div>
            </div>
          )}

          {licenseKey && (
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
              <div className="text-xs text-gray-400 mb-2">Your License Key</div>
              <div className="font-mono text-green-400 text-sm break-all">{licenseKey}</div>
            </div>
          )}

          <button
            onClick={handleBeginChallenge}
            className={`w-full py-4 rounded-xl bg-gradient-to-r ${theme.gradient} text-white font-bold text-lg hover:opacity-90 transition-opacity`}
          >
            Begin Your Challenge
          </button>
        </div>
      </div>
    </>
  );
}
