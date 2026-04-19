
import { Fragment, useEffect } from 'react';
import useModalScrollLock from '../hooks/useModalScrollLock';

export default function ProfileModal({ profile, isOpen, onClose }) {
  useModalScrollLock(isOpen);

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4">
      <div className="fixed inset-0" onClick={onClose}></div>

        <div className="relative w-full max-w-2xl p-6 my-auto overflow-hidden text-left shadow-2xl rounded-2xl" style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white">{profile.username}</h2>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                profile.tier === 'Elite' ? 'bg-blue-500/20 text-blue-400' :
                profile.tier === 'Pro' ? 'bg-cyan-500/20 text-cyan-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {profile.tier} User
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white p-2 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
              <div className="text-2xl font-bold text-green-400">${profile.stats.totalProfit.toLocaleString()}</div>
              <div className="text-gray-500 text-sm">Total Profit</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
              <div className="text-2xl font-bold text-blue-400">{profile.stats.winRate}%</div>
              <div className="text-gray-500 text-sm">Win Rate</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
              <div className="text-2xl font-bold text-cyan-400">{profile.stats.roi}%</div>
              <div className="text-gray-500 text-sm">ROI</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
              <div className="text-2xl font-bold text-orange-400">{profile.stats.currentStreak}</div>
              <div className="text-gray-500 text-sm">Current Streak</div>
            </div>
          </div>

          {(() => {
            const earnedAchievements = Array.isArray(profile.achievements) ? profile.achievements : [];
            const allAchievements = Array.isArray(profile.allAchievements) ? profile.allAchievements : [];
            const recentBets = Array.isArray(profile.recentBets) ? profile.recentBets : [];

            const earnedById = new Map(
              earnedAchievements
                .filter((a) => a && typeof a === 'object' && a.id)
                .map((a) => [a.id, a])
            );

            let gallery = allAchievements;
            if (gallery.length === 0 && earnedAchievements.length > 0) {
              gallery = earnedAchievements.map((a) => ({
                id: a.id,
                icon: a.icon,
                name: a.name || a.title,
                description: a.description,
                earned: true,
                earnedAt: a.earnedAt || null,
                progressPercent: 100,
                progressText: '',
                progressLabel: '',
              }));
            }

            const sortedGallery = [...gallery].sort((a, b) => {
              if (a.earned !== b.earned) return a.earned ? -1 : 1;
              return (b.progressPercent || 0) - (a.progressPercent || 0);
            });

            const earnedCount = sortedGallery.filter((a) => a.earned).length;
            const hasGallery = sortedGallery.length > 0;
            const formatAmount = (n) => {
              const num = Number(n);
              if (!Number.isFinite(num)) return '0';
              return Math.abs(num).toLocaleString(undefined, { maximumFractionDigits: 2 });
            };
            const formatEarnedAt = (iso) => {
              if (!iso) return '';
              try {
                return new Date(iso).toLocaleDateString();
              } catch {
                return '';
              }
            };
            const gridCols = hasGallery ? 'md:grid-cols-2' : 'md:grid-cols-1';
            return (
              <div className={`grid ${gridCols} gap-6`}>
                {hasGallery && (
                  <div>
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Achievements</h3>
                      <span className="text-xs text-gray-500">{earnedCount} / {sortedGallery.length}</span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {sortedGallery.map((achievement, index) => {
                        const isEarned = !!achievement.earned;
                        const pct = Math.max(0, Math.min(100, Number(achievement.progressPercent) || 0));
                        const earnedDate = formatEarnedAt(achievement.earnedAt) || formatEarnedAt(earnedById.get(achievement.id)?.earnedAt);
                        return (
                          <div
                            key={achievement.id || index}
                            className="rounded-lg p-3"
                            style={{
                              backgroundColor: isEarned ? '#111' : '#0a0a0a',
                              border: `1px solid ${isEarned ? '#1a1a1a' : '#161616'}`,
                              opacity: isEarned ? 1 : 0.65,
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <span
                                className="text-2xl relative inline-flex items-center justify-center"
                                style={{ filter: isEarned ? 'none' : 'grayscale(1)', opacity: isEarned ? 1 : 0.6 }}
                                aria-label={isEarned ? 'Unlocked' : 'Locked'}
                                title={isEarned ? 'Unlocked' : 'Locked'}
                              >
                                {achievement.icon || '🏅'}
                                {!isEarned && (
                                  <span className="absolute -bottom-1 -right-1 text-[10px]" aria-hidden="true">🔒</span>
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className={`font-medium text-sm truncate ${isEarned ? 'text-white' : 'text-gray-400'}`}>
                                    {achievement.name || achievement.title}
                                  </div>
                                  {isEarned && earnedDate && (
                                    <div className="text-[10px] text-green-400 whitespace-nowrap">Earned {earnedDate}</div>
                                  )}
                                </div>
                                {achievement.description && (
                                  <div className="text-gray-500 text-xs">{achievement.description}</div>
                                )}
                              </div>
                            </div>
                            {!isEarned && achievement.progressText && (
                              <div className="mt-2">
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
                                  <div
                                    className="h-full bg-blue-500 transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                                  <span>{achievement.progressText}{achievement.progressLabel ? ` ${achievement.progressLabel}` : ''}</span>
                                  <span>{pct}%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Bets</h3>
                  {recentBets.length === 0 ? (
                    <div className="rounded-lg p-4 text-center text-gray-500 text-sm" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
                      No settled bets yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentBets.map((bet, index) => {
                        const isWin = bet.result === 'won';
                        const amountNum = Number(bet.amount);
                        const sign = Number.isFinite(amountNum) && amountNum < 0 ? '-' : (isWin ? '+' : '');
                        return (
                          <div key={bet.id || index} className="rounded-lg p-3" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
                            <div className="flex justify-between items-start">
                              <div className="min-w-0 pr-3">
                                <div className="text-white font-medium text-sm truncate">{bet.game}</div>
                                <div className="text-gray-500 text-sm truncate">
                                  {bet.bet}{bet.odds ? ` (${bet.odds})` : ''}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`font-bold text-sm ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                                  {sign}${formatAmount(bet.amount)}
                                </div>
                                <div className={`text-xs ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                                  {String(bet.result || '').toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="mt-8 text-center">
            <div className="text-gray-600 text-sm">
              Member since {new Date(profile.joinDate).toLocaleDateString()}
            </div>
          </div>
        </div>
    </div>
  );
}
