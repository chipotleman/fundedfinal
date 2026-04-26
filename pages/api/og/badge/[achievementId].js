import { ImageResponse } from '@vercel/og';
import { ACHIEVEMENT_BADGES } from '../../../../lib/achievementBadges';

export const config = {
  runtime: 'edge',
};

const RARITY_COLORS = {
  Common: {
    fg: '#cbd5e1',
    bg: 'rgba(148, 163, 184, 0.18)',
    border: 'rgba(148, 163, 184, 0.5)',
  },
  Uncommon: {
    fg: '#6ee7b7',
    bg: 'rgba(16, 185, 129, 0.18)',
    border: 'rgba(16, 185, 129, 0.55)',
  },
  Rare: {
    fg: '#67e8f9',
    bg: 'rgba(6, 182, 212, 0.18)',
    border: 'rgba(6, 182, 212, 0.55)',
  },
  Epic: {
    fg: '#fdba74',
    bg: 'rgba(249, 115, 22, 0.18)',
    border: 'rgba(249, 115, 22, 0.6)',
  },
};

const EMBLEM_TEXT = {
  one: '1',
  target: '◎',
  bars: '||',
  hundred: '100',
  flame: '★',
  flameBig: '★',
  dollar: '$',
  diamond: '◆',
  swords: '⚔',
  crown: '♛',
  star: '★',
};

const FALLBACK_BADGE = {
  name: 'Achievement',
  rarity: 'Common',
  palette: { base: '#64748b', accent: '#334155', highlight: '#cbd5e1' },
  emblem: 'star',
};

function clean(value, max = 64) {
  if (value == null) return '';
  return String(value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

export default async function handler(req) {
  const url = new URL(req.url);
  const achievementId = decodeURIComponent(url.pathname.split('/').pop() || '');
  const usernameRaw = url.searchParams.get('u') || url.searchParams.get('username') || '';
  const username = clean(usernameRaw.replace(/^@/, ''), 32) || 'Player';

  const badge = ACHIEVEMENT_BADGES[achievementId] || FALLBACK_BADGE;
  const rarity = badge.rarity || 'Common';
  const rarityStyle = RARITY_COLORS[rarity] || RARITY_COLORS.Common;
  const emblem = EMBLEM_TEXT[badge.emblem] || '★';
  const palette = badge.palette || FALLBACK_BADGE.palette;
  const badgeName = clean(badge.name, 48) || 'Achievement';

  const tree = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background:
          'linear-gradient(135deg, #050b1a 0%, #0a1628 45%, #1a0a2e 100%)',
        color: '#ffffff',
        padding: 60,
        position: 'relative',
        fontFamily: 'sans-serif',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 44,
                    fontWeight: 900,
                    letterSpacing: -1,
                    color: '#ffffff',
                    display: 'flex',
                  },
                  children: 'PIKS',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 22px',
                    borderRadius: 9999,
                    background: rarityStyle.bg,
                    border: `1px solid ${rarityStyle.border}`,
                    color: rarityStyle.fg,
                    fontSize: 24,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                  },
                  children: `${rarity} badge`,
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 60,
              marginTop: 10,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: 360,
                    height: 360,
                    borderRadius: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `radial-gradient(circle at 30% 25%, ${palette.highlight}, ${palette.base} 55%, ${palette.accent})`,
                    border: `8px solid ${palette.highlight}`,
                    boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
                    color: '#ffffff',
                    fontSize: 168,
                    fontWeight: 900,
                    letterSpacing: -4,
                  },
                  children: emblem,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: 600,
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: 26,
                          color: '#94a3b8',
                          letterSpacing: 4,
                          textTransform: 'uppercase',
                          display: 'flex',
                          marginBottom: 12,
                        },
                        children: 'Achievement unlocked',
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: 76,
                          fontWeight: 900,
                          color: '#ffffff',
                          letterSpacing: -2,
                          lineHeight: 1.05,
                          display: 'flex',
                        },
                        children: badgeName,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          marginTop: 28,
                          fontSize: 36,
                          fontWeight: 700,
                          color: '#e2e8f0',
                          display: 'flex',
                        },
                        children: `@${username}`,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    headers: {
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
