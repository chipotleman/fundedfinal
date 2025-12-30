import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function CapperProfile() {
  const router = useRouter();
  const { slug } = router.query;
  const { data: session } = useSession();
  const [capper, setCapper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchCapper();
    }
  }, [slug]);

  const fetchCapper = async () => {
    try {
      const res = await fetch(`/api/marketplace/capper/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setCapper(data.capper);
        if (data.capper.products?.length > 0) {
          setSelectedProduct(data.capper.products[0]);
        }
      } else {
        router.push('/marketplace');
      }
    } catch (error) {
      console.error('Failed to fetch capper:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (product) => {
    if (!session) {
      router.push('/auth/signin?callbackUrl=' + encodeURIComponent(router.asPath));
      return;
    }
    
    setPurchasing(true);
    try {
      const res = await fetch('/api/marketplace/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      }
    } catch (error) {
      console.error('Failed to initiate purchase:', error);
    } finally {
      setPurchasing(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<span key={i} className="text-yellow-400 text-xl">★</span>);
      } else if (i === fullStars && hasHalf) {
        stars.push(<span key={i} className="text-yellow-400 text-xl">★</span>);
      } else {
        stars.push(<span key={i} className="text-gray-600 text-xl">★</span>);
      }
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!capper) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Capper not found</h1>
          <Link href="/marketplace" className="text-purple-400 hover:underline">Back to marketplace</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{capper.displayName} | Piks Marketplace</title>
      </Head>

      <div className="min-h-screen bg-black text-white">
        <div className="h-48 md:h-64 bg-gradient-to-r from-purple-600/30 to-blue-600/30 relative">
          {capper.bannerUrl && (
            <img src={capper.bannerUrl} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 -mt-20 relative z-10">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <div className="flex items-end gap-4 mb-6">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-4xl font-bold border-4 border-black shadow-xl">
                  {capper.avatarUrl ? (
                    <img src={capper.avatarUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    capper.displayName[0].toUpperCase()
                  )}
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold">{capper.displayName}</h1>
                    {capper.isVerified && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded-full">
                        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        <span className="text-xs text-blue-400 font-medium">Piks Verified</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-gray-400">
                    <div className="flex items-center gap-1">
                      {renderStars(parseFloat(capper.averageRating) || 0)}
                      <span className="ml-1">({capper.totalReviews || 0} reviews)</span>
                    </div>
                    <span>{capper.totalSubscribers || 0} subscribers</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {(capper.specialties || []).map(s => (
                  <span key={s} className="px-3 py-1.5 bg-white/10 rounded-xl text-sm font-medium">{s}</span>
                ))}
              </div>

              <p className="text-gray-300 text-lg mb-8">{capper.bio || 'No bio yet'}</p>

              {capper.performance?.allTime && (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
                  <h2 className="text-xl font-bold mb-4">Performance Stats</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-white/5 rounded-xl">
                      <div className="text-3xl font-bold text-green-400">{parseFloat(capper.performance.allTime.winRate || 0).toFixed(1)}%</div>
                      <div className="text-gray-400 text-sm">Win Rate</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-xl">
                      <div className={`text-3xl font-bold ${parseFloat(capper.performance.allTime.roi) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(capper.performance.allTime.roi) >= 0 ? '+' : ''}{parseFloat(capper.performance.allTime.roi || 0).toFixed(1)}%
                      </div>
                      <div className="text-gray-400 text-sm">ROI</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-xl">
                      <div className="text-3xl font-bold text-white">{capper.performance.allTime.totalBets || 0}</div>
                      <div className="text-gray-400 text-sm">Total Picks</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-xl">
                      <div className="text-3xl font-bold text-purple-400">{capper.performance.allTime.wins || 0}-{capper.performance.allTime.losses || 0}</div>
                      <div className="text-gray-400 text-sm">Record</div>
                    </div>
                  </div>
                </div>
              )}

              {capper.discordInviteLink && (
                <div className="bg-[#5865F2]/20 border border-[#5865F2]/50 rounded-2xl p-6 mb-8 flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#5865F2] rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white">Discord Community</h3>
                    <p className="text-gray-400 text-sm">Get instant access to picks and community chat</p>
                  </div>
                  <span className="text-[#5865F2] font-medium">Included with subscription</span>
                </div>
              )}

              {capper.reviews && capper.reviews.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold mb-4">Reviews</h2>
                  <div className="space-y-4">
                    {capper.reviews.map(review => (
                      <div key={review.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center font-medium">
                              {review.buyerName[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{review.buyerName}</div>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-600'}>★</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="text-gray-500 text-sm">{new Date(review.createdAt).toLocaleDateString()}</div>
                        </div>
                        {review.title && <h4 className="font-medium mb-2">{review.title}</h4>}
                        <p className="text-gray-300">{review.comment}</p>
                        {review.capperResponse && (
                          <div className="mt-4 p-4 bg-white/5 rounded-lg border-l-2 border-purple-500">
                            <div className="text-sm text-purple-400 font-medium mb-1">Response from {capper.displayName}</div>
                            <p className="text-gray-300 text-sm">{review.capperResponse}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full md:w-96">
              <div className="sticky top-4">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                  <h2 className="text-xl font-bold mb-4">Choose a Plan</h2>
                  
                  <div className="space-y-3 mb-6">
                    {capper.products?.map(product => (
                      <button
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className={`w-full p-4 rounded-xl text-left transition-all ${
                          selectedProduct?.id === product.id
                            ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-2 border-purple-500'
                            : 'bg-white/5 border border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold">{product.name}</span>
                          <span className="text-xl font-bold">${parseFloat(product.price).toFixed(0)}</span>
                        </div>
                        <div className="text-gray-400 text-sm">{product.duration} access</div>
                        {product.features && product.features.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {product.features.slice(0, 3).map((feature, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {feature}
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {selectedProduct && (
                    <button
                      onClick={() => handlePurchase(selectedProduct)}
                      disabled={purchasing}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 rounded-xl font-bold text-lg transition-all"
                    >
                      {purchasing ? 'Processing...' : `Subscribe for $${parseFloat(selectedProduct.price).toFixed(0)}`}
                    </button>
                  )}

                  <div className="mt-4 text-center text-gray-500 text-sm">
                    Cancel anytime. Secure payment.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
