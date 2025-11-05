import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function MobileNavMenu({ isOpen, onClose, currentUser, isLoggedIn }) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('current_user');
    onClose();
    router.push('/');
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isRightSwipe && isOpen) {
      onClose();
    }
  };

  if (!mounted) return null;

  return ReactDOM.createPortal(
    <>
      {/* Transparent backdrop - click outside menu to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 lg:hidden z-[59]"
          onClick={onClose}
        />
      )}
      
      <div 
        className="fixed top-0 bottom-0 w-64 bg-black shadow-xl border-l border-gray-800 lg:hidden z-[60]"
        style={{
          right: isOpen ? '0' : '-256px',
          transition: 'right 0.3s ease-in-out',
          height: '100vh',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
      <div className="flex flex-col h-full">
        {/* X button positioned at exact height of plus sign */}
        <div className="absolute top-0 right-0 pt-[22.5px] pr-4">
          <button
            onClick={onClose}
            className="p-2 flex items-center justify-center"
          >
            <svg className="w-[31px] h-[31px] text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 mt-16">
          {isLoggedIn ? (
            <div className="space-y-4">
              <Link
                href="/dashboard"
                onClick={onClose}
                className="block text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                Dashboard
              </Link>
              <Link
                href="/bet-history"
                onClick={onClose}
                className="block text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                Bet History
              </Link>
              <Link
                href="/demo"
                onClick={onClose}
                className="block text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                Free Trial
              </Link>
              <button 
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('openHowItWorks'));
                }}
                className="block w-full text-left text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                How It Works
              </button>
              <Link
                href="/waitlist"
                onClick={onClose}
                className="block text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                Piks Card
              </Link>
              <Link
                href="/promos"
                onClick={onClose}
                className="block text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                Promos
              </Link>
              <Link
                href="/leaderboard"
                onClick={onClose}
                className="block text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                Leaderboard
              </Link>

              <div className="border-t border-gray-700 pt-4 mt-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-1">Signed in as</p>
                  <p className="text-white font-semibold">
                    {currentUser?.email || currentUser?.phone || 'User'}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left text-red-400 hover:text-red-300 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Link
                href="/demo"
                onClick={onClose}
                className="block text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                Free Trial
              </Link>
              <button 
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('openHowItWorks'));
                }}
                className="block w-full text-left text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                How It Works
              </button>
              <Link
                href="/waitlist"
                onClick={onClose}
                className="block text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                Piks Card
              </Link>
              <Link
                href="/leaderboard"
                onClick={onClose}
                className="block text-gray-300 hover:text-blue-400 font-light text-base uppercase tracking-wider py-3 transition-all duration-300"
              >
                Leaderboard
              </Link>

              <div className="mt-6 space-y-3">
                <Link
                  href="/auth"
                  onClick={onClose}
                  className="w-full text-center text-gray-300 hover:text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 text-sm border border-gray-600 hover:border-gray-500 flex items-center justify-center"
                >
                  <span>SIGN IN</span>
                </Link>

                {/* Social Login Options */}
                <div className="pt-2">
                  <p className="text-xs text-gray-500 text-center mb-3">Or continue with</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        // Google OAuth flow would go here
                      }}
                      className="flex items-center justify-center px-3 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 border border-gray-700 hover:border-gray-600 rounded-lg transition-all duration-300"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="ml-2 text-xs text-gray-300">Google</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        onClose();
                        // Apple OAuth flow would go here
                      }}
                      className="flex items-center justify-center px-3 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 border border-gray-700 hover:border-gray-600 rounded-lg transition-all duration-300"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <span className="ml-2 text-xs text-gray-300">Apple</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('openChallengePopup'));
                  }}
                  className="w-full text-center bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  <span className="text-base">GET FUNDED</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>,
    document.body
  );
}
