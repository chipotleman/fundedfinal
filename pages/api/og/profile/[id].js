import { ImageResponse } from '@vercel/og';
import { getProfilePreview } from '../../../../lib/profile-preview';

export const config = {
  runtime: 'edge',
};

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function isAbsoluteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isRasterImageUrl(value) {
  if (!isAbsoluteUrl(value)) return false;
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(value);
}

function StatTile({ label, value, color }) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 36px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        minWidth: 220,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: 22,
              color: '#94a3b8',
              letterSpacing: 4,
              textTransform: 'uppercase',
              display: 'flex',
            },
            children: label,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              marginTop: 10,
              fontSize: 64,
              fontWeight: 900,
              color: color || '#ffffff',
              letterSpacing: -2,
              display: 'flex',
            },
            children: value,
          },
        },
      ],
    },
  };
}

export default async function handler(req) {
  const { pathname } = new URL(req.url);
  const profileId = decodeURIComponent(pathname.split('/').pop() || '');

  let preview = null;
  try {
    preview = await getProfilePreview(profileId);
  } catch (_) {
    preview = null;
  }

  const username = preview?.username || 'Player';
  const avatar = preview?.avatar || null;
  const wins = preview?.wins ?? 0;
  const losses = preview?.losses ?? 0;
  const winRate = preview?.winRate ?? 0;
  const earnings = preview?.totalWinningsFormatted || '0';
  const showImage = isRasterImageUrl(avatar);

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
                    background: 'rgba(168, 85, 247, 0.18)',
                    border: '1px solid rgba(192, 132, 252, 0.55)',
                    color: '#e9d5ff',
                    fontSize: 24,
                    fontWeight: 600,
                  },
                  children: 'Player profile',
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
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: 240,
                          height: 240,
                          borderRadius: 9999,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#7c3aed',
                          border: '6px solid rgba(255,255,255,0.12)',
                          boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
                          overflow: 'hidden',
                          color: '#ffffff',
                          fontSize: 104,
                          fontWeight: 800,
                          letterSpacing: -2,
                        },
                        children: showImage
                          ? {
                              type: 'img',
                              props: {
                                src: avatar,
                                width: 240,
                                height: 240,
                                style: { width: 240, height: 240, objectFit: 'cover' },
                              },
                            }
                          : initials(username),
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          marginTop: 28,
                          fontSize: 52,
                          fontWeight: 800,
                          color: '#ffffff',
                          maxWidth: 480,
                          textAlign: 'center',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          display: 'flex',
                          justifyContent: 'center',
                        },
                        children: `@${username}`,
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                  },
                  children: [
                    StatTile({ label: 'Record', value: `${wins}-${losses}`, color: '#ffffff' }),
                    StatTile({ label: 'Win rate', value: `${winRate}%`, color: '#34d399' }),
                    StatTile({ label: 'Earnings', value: earnings, color: '#fbbf24' }),
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
