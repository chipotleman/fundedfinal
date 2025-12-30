import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Head from 'next/head';

const sports = [
  { id: 'all', name: 'All Sports' },
  { id: 'NBA', name: 'NBA' },
  { id: 'NFL', name: 'NFL' },
  { id: 'MLB', name: 'MLB' },
  { id: 'NHL', name: 'NHL' },
  { id: 'NCAAB', name: 'NCAAB' },
  { id: 'NCAAF', name: 'NCAAF' },
];

const sortOptions = [
  { id: 'popular', name: 'Most Popular' },
  { id: 'rating', name: 'Highest Rated' },
  { id: 'winrate', name: 'Best Win Rate' },
  { id: 'newest', name: 'Newest' },
  { id: 'price_low', name: 'Price: Low to High' },
];

export default function Marketplace() {
  const { data: session } = useSession();
  const [cappers, setCappers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState('all');
  const [sort, setSort] = useState('popular');

  useEffect(() => {
    fetchCappers();
  }, [sport, sort]);

  const fetchCappers = async () => {
    try {
      const params = new URLSearchParams({ sport, sort });
      if (search) params.append('search', search);
      
      const res = await fetch(`/api/marketplace/cappers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCappers(data.cappers || []);
      }
    } catch (error) {
      console.error('Failed to fetch cappers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCappers();
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<span key={i} className="text-yellow-400">★</span>);
      } else if (i === fullStars && hasHalf) {
        stars.push(<span key={i} className="text-yellow-400">★</span>);
      } else {
        stars.push(<span key={i} className="text-gray-600">★</span>);
      }
    }
    return stars;
  };

  return (
    <>
      <Head>
        <title>Marketplace | Piks</title>
      </Head>
      
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Capper Marketplace</h1>
            <p className="text-gray-400 text-lg">Subscribe to verified cappers and get their winning picks delivered to you</p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search cappers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-12 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </form>

            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
            >
              {sports.map(s => (
                <option key={s.id} value={s.id} className="bg-gray-900">{s.name}</option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
            >
              {sortOptions.map(s => (
                <option key={s.id} value={s.id} className="bg-gray-900">{s.name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin"></div>
            </div>
          ) : cappers.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No cappers found</h3>
              <p className="text-gray-500">Be the first to become a verified capper!</p>
              <Link href="/marketplace/become-capper" className="inline-block mt-6 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold hover:opacity-90 transition-all">
                Become a Capper
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cappers.map(capper => (
                <Link href={`/marketplace/${capper.slug}`} key={capper.id}>
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all cursor-pointer group">
                    <div className="h-24 bg-gradient-to-r from-purple-600/30 to-blue-600/30 relative">
                      {capper.bannerUrl && (
                        <img src={capper.bannerUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    
                    <div className="p-5 -mt-10 relative">
                      <div className="flex items-end gap-4 mb-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-2xl font-bold border-4 border-black">
                          {capper.avatarUrl ? (
                            <img src={capper.avatarUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                          ) : (
                            capper.displayName[0].toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">{capper.displayName}</h3>
                            {capper.isVerified && (
                              <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>

                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{capper.bio || 'No bio yet'}</p>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {(capper.specialties || []).slice(0, 3).map(s => (
                          <span key={s} className="px-2.5 py-1 bg-white/10 rounded-lg text-xs font-medium text-gray-300">{s}</span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-sm border-t border-white/10 pt-4">
                        <div className="flex items-center gap-1">
                          {renderStars(parseFloat(capper.averageRating) || 0)}
                          <span className="text-gray-400 ml-1">({capper.totalReviews || 0})</span>
                        </div>
                        <div className="text-gray-400">
                          {capper.totalSubscribers || 0} subscribers
                        </div>
                      </div>

                      {capper.performance && (
                        <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-white/10">
                          <div>
                            <span className="text-gray-500">Win Rate:</span>
                            <span className={`ml-1 font-semibold ${parseFloat(capper.performance.winRate) >= 55 ? 'text-green-400' : 'text-gray-300'}`}>
                              {parseFloat(capper.performance.winRate || 0).toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">ROI:</span>
                            <span className={`ml-1 font-semibold ${parseFloat(capper.performance.roi) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {parseFloat(capper.performance.roi || 0) >= 0 ? '+' : ''}{parseFloat(capper.performance.roi || 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}

                      {capper.lowestPrice && (
                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                          <span className="text-gray-400 text-sm">Starting at</span>
                          <span className="text-xl font-bold text-white">${capper.lowestPrice}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {session && (
            <div className="mt-12 p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-2xl text-center">
              <h3 className="text-xl font-bold mb-2">Want to sell your picks?</h3>
              <p className="text-gray-400 mb-4">Complete a funded challenge to become Piks Verified and start earning</p>
              <Link href="/marketplace/become-capper" className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold hover:opacity-90 transition-all">
                Become a Capper
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
