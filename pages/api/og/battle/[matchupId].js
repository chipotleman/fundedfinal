import { ImageResponse } from '@vercel/og';
import { getBattlePreview } from '../../../../lib/battle-preview';

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
  // Satori only renders raster images reliably (no SVG, no avatar generators)
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(value);
}

function AvatarTile({ name, avatar, color }) {
  const showImage = isRasterImageUrl(avatar);
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 320,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: 220,
              height: 220,
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: color,
              border: '6px solid rgba(255,255,255,0.12)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
              overflow: 'hidden',
              color: '#ffffff',
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -2,
            },
            children: showImage
              ? {
                  type: 'img',
                  props: {
                    src: avatar,
                    width: 220,
                    height: 220,
                    style: { width: 220, height: 220, objectFit: 'cover' },
                  },
                }
              : initials(name),
          },
        },
        {
          type: 'div',
          props: {
            style: {
              marginTop: 28,
              fontSize: 42,
              fontWeight: 700,
              color: '#ffffff',
              maxWidth: 320,
              textAlign: 'center',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              display: 'flex',
              justifyContent: 'center',
            },
            children: name,
          },
        },
      ],
    },
  };
}

export default async function handler(req) {
  const { searchParams, pathname } = new URL(req.url);
  // Path is /api/og/battle/<matchupId>
  const matchupId = decodeURIComponent(pathname.split('/').pop() || '');
  const momentParam = searchParams.get('m') || searchParams.get('moment') || null;

  let preview = null;
  try {
    preview = await getBattlePreview(matchupId, { momentId: momentParam });
  } catch (_) {
    preview = null;
  }

  const user1 = preview?.user1 || { username: 'Player 1', avatar: null };
  const user2 = preview?.user2 || { username: 'Opponent', avatar: null };
  const prize = preview?.prize || '—';
  const mode = preview?.mode || 'Battle';
  const statusLabel = preview?.statusLabel || 'Live battle';
  const moment = preview?.moment || null;
  const momentSelection = moment?.selection ? String(moment.selection).slice(0, 60) : null;
  const momentOwner = moment?.ownerUsername || null;

  const tree = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background:
          'linear-gradient(135deg, #050b1a 0%, #0a1628 45%, #052e2b 100%)',
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
                    background: 'rgba(37, 99, 235, 0.18)',
                    border: '1px solid rgba(96, 165, 250, 0.55)',
                    color: '#bfdbfe',
                    fontSize: 24,
                    fontWeight: 600,
                  },
                  children: `${mode} · ${statusLabel}`,
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
              marginTop: 20,
            },
            children: [
              AvatarTile({ name: user1.username, avatar: user1.avatar, color: '#1d4ed8' }),
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 120,
                    fontWeight: 900,
                    letterSpacing: -4,
                    color: '#f97316',
                    textShadow: '0 8px 40px rgba(249, 115, 22, 0.55)',
                    display: 'flex',
                  },
                  children: 'VS',
                },
              },
              AvatarTile({ name: user2.username, avatar: user2.avatar, color: '#059669' }),
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              marginTop: 10,
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
                  },
                  children: 'Prize Pool',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    marginTop: 8,
                    fontSize: 72,
                    fontWeight: 900,
                    color: '#fbbf24',
                    letterSpacing: -2,
                    display: 'flex',
                  },
                  children: prize,
                },
              },
              ...(momentSelection
                ? [
                    {
                      type: 'div',
                      props: {
                        style: {
                          marginTop: 18,
                          padding: '10px 22px',
                          borderRadius: 12,
                          background: 'rgba(249, 115, 22, 0.15)',
                          border: '1px solid rgba(249, 115, 22, 0.55)',
                          color: '#fed7aa',
                          fontSize: 24,
                          fontWeight: 600,
                          maxWidth: 900,
                          display: 'flex',
                          textAlign: 'center',
                          justifyContent: 'center',
                        },
                        children: momentOwner
                          ? `Highlight · ${momentOwner}: ${momentSelection}`
                          : `Highlight · ${momentSelection}`,
                      },
                    },
                  ]
                : []),
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
