import { useEffect, useRef, useState } from 'react';
import useModalScrollLock from '../hooks/useModalScrollLock';
import AchievementBadge from './AchievementBadge';
import { getBadgeForAchievement } from '../lib/achievementBadges';
import { trackBadgeShare, BADGE_SHARE_REF } from '../lib/badgeShareTracking';

const RARITY_STYLE = {
  Common: { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.4)', text: '#cbd5e1' },
  Uncommon: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.45)', text: '#6ee7b7' },
  Rare: { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.45)', text: '#67e8f9' },
  Epic: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.5)', text: '#fdba74' },
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function AchievementDetailModal({
  achievement,
  isOpen,
  onClose,
  canShare = false,
  viewerProfileId = null,
  viewerUsername = null,
}) {
  useModalScrollLock(isOpen);
  const closeBtnRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [shareState, setShareState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    if (!isOpen) setShareState({ status: 'idle', message: '' });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null;

    const getFocusable = () => {
      const root = dialogRef.current;
      if (!root) return [];
      const nodes = root.querySelectorAll(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]'
      );
      return Array.from(nodes).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = getFocusable();
        if (focusables.length === 0) {
          e.preventDefault();
          closeBtnRef.current?.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const dialog = dialogRef.current;
        const insideDialog = dialog && dialog.contains(active);
        if (!insideDialog) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);

    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKey);
      clearTimeout(focusTimer);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function') {
        try {
          prev.focus();
        } catch (_e) {}
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen || !achievement) return null;

  const {
    achievementId,
    name,
    description,
    earned,
    earnedAt,
    progressText,
    progressLabel,
    progressPercent,
  } = achievement;

  const badgeMeta = getBadgeForAchievement(achievementId);
  const rarity = achievement.rarity || badgeMeta?.rarity || 'Common';
  const displayName = name || badgeMeta?.name || 'Achievement';
  const rarityStyle = RARITY_STYLE[rarity] || RARITY_STYLE.Common;
  const pct = Math.max(0, Math.min(100, Number(progressPercent) || 0));
  const earnedDate = formatDate(earnedAt);

  const shareEligible =
    !!earned && !!canShare && !!viewerProfileId && !!achievementId;
  const shareUsername = (viewerUsername || '').replace(/^@/, '');

  const handleShare = async () => {
    if (!shareEligible || shareState.status === 'loading') return;
    if (typeof window === 'undefined') return;

    setShareState({ status: 'loading', message: '' });

    const origin = window.location.origin;
    const profilePath = `/profile/${encodeURIComponent(viewerProfileId)}`;
    const shareUrl = `${origin}${profilePath}?ref=${BADGE_SHARE_REF}&b=${encodeURIComponent(achievementId)}`;
    const shareText = `I just unlocked the ${displayName} ${rarity} badge on Piks!`;
    const shareTitle = `${displayName} unlocked on Piks`;
    const imagePath = `/api/og/badge/${encodeURIComponent(achievementId)}?u=${encodeURIComponent(shareUsername || 'Player')}`;
    const imageUrl = `${origin}${imagePath}`;

    const recordShare = (sharePath) => {
      trackBadgeShare({
        achievementId,
        rarity,
        sharePath,
        sharerProfileId: viewerProfileId,
      });
    };

    const nav = typeof navigator !== 'undefined' ? navigator : null;

    if (nav && typeof nav.share === 'function') {
      try {
        if (typeof nav.canShare === 'function') {
          try {
            const res = await fetch(imageUrl);
            if (res.ok) {
              const blob = await res.blob();
              const file = new File(
                [blob],
                `${achievementId}-piks.png`,
                { type: blob.type || 'image/png' }
              );
              if (nav.canShare({ files: [file] })) {
                await nav.share({
                  files: [file],
                  title: shareTitle,
                  text: shareText,
                  url: shareUrl,
                });
                recordShare('files');
                setShareState({ status: 'success', message: 'Shared!' });
                return;
              }
            }
          } catch (err) {
            if (err && err.name === 'AbortError') {
              setShareState({ status: 'idle', message: '' });
              return;
            }
          }
        }

        await nav.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        recordShare('native');
        setShareState({ status: 'success', message: 'Shared!' });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          setShareState({ status: 'idle', message: '' });
          return;
        }
      }
    }

    try {
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
        await nav.clipboard.writeText(shareUrl);
        recordShare('clipboard');
        setShareState({ status: 'success', message: 'Link copied!' });
        return;
      }
    } catch (_) {}

    setShareState({
      status: 'error',
      message: 'Sharing is not available — try again from your phone.',
    });
  };

  return (
    <div
      className="achv-modal-root fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="achv-modal-backdrop fixed inset-0 bg-black/85"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="achv-detail-title"
        aria-describedby={description ? 'achv-detail-desc' : undefined}
        className="achv-modal-card relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Close achievement details"
          className="absolute top-3 right-3 text-gray-500 hover:text-white p-2 rounded-lg transition-colors"
          type="button"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4">
            <AchievementBadge
              achievementId={achievementId}
              earned={!!earned}
              size={140}
            />
          </div>

          <h2
            id="achv-detail-title"
            className={`text-xl font-bold ${earned ? 'text-white' : 'text-gray-300'}`}
          >
            {displayName}
          </h2>

          {rarity && (
            <span
              className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: rarityStyle.bg,
                border: `1px solid ${rarityStyle.border}`,
                color: rarityStyle.text,
              }}
            >
              {rarity}
            </span>
          )}

          {description && (
            <p
              id="achv-detail-desc"
              className="mt-3 text-sm text-gray-400 leading-relaxed"
            >
              {description}
            </p>
          )}

          <div className="w-full mt-5">
            {earned ? (
              <>
                <div
                  className="rounded-lg px-3 py-2 text-sm flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#6ee7b7',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    Unlocked{earnedDate ? ` · ${earnedDate}` : ''}
                  </span>
                </div>
                {shareEligible && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleShare}
                      disabled={shareState.status === 'loading'}
                      aria-label={`Share the ${displayName} badge`}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60"
                      style={{
                        background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {shareState.status === 'loading' ? (
                        <>
                          <svg
                            className="w-4 h-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeOpacity="0.3"
                              strokeWidth="3"
                            />
                            <path
                              d="M22 12a10 10 0 00-10-10"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span>Preparing…</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14"
                            />
                          </svg>
                          <span>Share badge</span>
                        </>
                      )}
                    </button>
                    {shareState.message && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="mt-2 text-xs text-center"
                        style={{
                          color:
                            shareState.status === 'error'
                              ? '#fca5a5'
                              : '#6ee7b7',
                        }}
                      >
                        {shareState.message}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-left">
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="text-gray-400 font-semibold uppercase tracking-wider">
                    Progress
                  </span>
                  <span className="text-gray-300 font-semibold">{pct}%</span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: '#1a1a1a' }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={`${displayName} progress`}
                >
                  <div
                    className="achv-modal-progress-fill h-full"
                    style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                    }}
                  />
                </div>
                {progressText && (
                  <div className="mt-2 text-xs text-gray-400">
                    {progressText}
                    {progressLabel ? ` ${progressLabel}` : ''}
                  </div>
                )}
                <div className="mt-3 text-[11px] text-gray-500 italic">
                  Keep going — this badge unlocks once you hit the target.
                </div>
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          .achv-modal-card {
            animation: achvModalIn 180ms ease-out both;
          }
          .achv-modal-backdrop {
            animation: achvBackdropIn 180ms ease-out both;
          }
          .achv-modal-progress-fill {
            transition: width 320ms ease-out;
          }
          @keyframes achvModalIn {
            from {
              opacity: 0;
              transform: translateY(8px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes achvBackdropIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .achv-modal-card,
            .achv-modal-backdrop {
              animation: none !important;
            }
            .achv-modal-progress-fill {
              transition: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
