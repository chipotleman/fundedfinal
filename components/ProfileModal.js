
import { Fragment, useEffect, useState } from 'react';
import useModalScrollLock from '../hooks/useModalScrollLock';
import { formatMoney } from '../utils/formatMoney';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import AchievementBadge from './AchievementBadge';
import AchievementDetailModal from './AchievementDetailModal';
import MutualFriendsLine from './social/MutualFriendsLine';

export default function ProfileModal({ profile, isOpen, onClose }) {
  useModalScrollLock(isOpen);
  const { formatOdds } = useUserPreferences();
  const [selectedAchievement, setSelectedAchievement] = useState(null);

  useEffect(() => {
    if (!isOpen) setSelectedAchievement(null);
  }, [isOpen]);

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4">
      <div className="fixed inset-0" onClick={onClose}></div>

        <div className="relative w-full max-w-2xl p-6 my-auto overflow-hidden text-left shadow-2xl rounded-2xl" style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white">{profile.username}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  profile.tier === 'Elite' ? 'bg-blue-500/20 text-blue-400' :
                  profile.tier === 'Pro' ? 'bg-cyan-500/20 text-cyan-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {profile.tier} User
                </span>
                <MutualFriendsLine
                  userId={profile.id}
                  username={profile.username}
                  onProfileNavigate={onClose}
                />
              </div>
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
              <div className="text-2xl font-bold text-green-400">${formatMoney(profile.stats.totalProfit, 0)}</div>
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
              const abs = Math.abs(num);
              return formatMoney(abs, Number.isInteger(abs) ? 0 : 2);
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
                        const handleOpen = () => {
                          setSelectedAchievement({
                            achievementId: achievement.id,
                            name: achievement.name || achievement.title,
                            description: achievement.description,
                            rarity: achievement.rarity,
                            earned: isEarned,
                            earnedAt: achievement.earnedAt || earnedById.get(achievement.id)?.earnedAt || null,
                            progressText: achievement.progressText || '',
                            progressLabel: achievement.progressLabel || '',
                            progressPercent: pct,
                          });
                        };
                        return (
                          <button
                            key={achievement.id || index}
                            type="button"
                            onClick={handleOpen}
                            aria-label={`View details for ${achievement.name || achievement.title} ${isEarned ? '(unlocked)' : '(locked)'}`}
                            className="w-full text-left rounded-lg p-3 transition-colors hover:bg-[#161616] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            style={{
                              backgroundColor: isEarned ? '#111' : '#0a0a0a',
                              border: `1px solid ${isEarned ? '#1a1a1a' : '#161616'}`,
                              opacity: isEarned ? 1 : 0.65,
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                className="flex-shrink-0"
                                title={isEarned ? 'Unlocked' : 'Locked'}
                              >
                                <AchievementBadge
                                  achievementId={achievement.id}
                                  earned={isEarned}
                                  size={48}
                                />
                              </div>
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
                          </button>
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
                                  {bet.bet}{bet.odds ? ` (${formatOdds(bet.odds)})` : ''}
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

          {(profile.instagramHandle || profile.facebookUrl) && (
            <div className="mt-6 flex items-center justify-center gap-3">
              {profile.instagramHandle && (
                <a
                  href={`https://instagram.com/${String(profile.instagramHandle).replace(/^@+/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-pink-500/10 border border-pink-500/30 text-pink-300 hover:bg-pink-500/20 transition-colors"
                  title="Instagram"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.5 1s.8.9 1 1.5c.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-1 1.5s-.9.8-1.5 1c-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.5-1s-.8-.9-1-1.5c-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 1-1.5s.9-.8 1.5-1c.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 5.5a4.3 4.3 0 100 8.6 4.3 4.3 0 000-8.6zm0 7.1a2.8 2.8 0 110-5.6 2.8 2.8 0 010 5.6zm5.5-7.3a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                  @{String(profile.instagramHandle).replace(/^@+/, '')}
                </a>
              )}
              {profile.facebookUrl && (
                <a
                  href={profile.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-colors"
                  title="Facebook"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22 12a10 10 0 10-11.6 9.9v-7H8v-2.9h2.4V9.8c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5V12h2.6l-.4 2.9h-2.2v7A10 10 0 0022 12z" />
                  </svg>
                  Facebook
                </a>
              )}
            </div>
          )}

          <div className="mt-8 text-center">
            <div className="text-gray-600 text-sm">
              Member since {new Date(profile.joinDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      <AchievementDetailModal
        isOpen={!!selectedAchievement}
        achievement={selectedAchievement}
        onClose={() => setSelectedAchievement(null)}
      />
    </div>
  );
}
