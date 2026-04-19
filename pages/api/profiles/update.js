import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq, and, ne } from 'drizzle-orm';
import { getFrameById, deriveUnlockedFrameIds } from '../../../lib/profileFrames';
import {
  normalizeFavoriteTeams,
  isLibraryBanner,
  FAVORITE_TEAMS_LIMIT,
} from '../../../lib/teamCatalog';

const BANNER_MAX_WIDTH = 2400;
const BANNER_MAX_HEIGHT = 1200;
const BANNER_MIN_WIDTH = 600;
const BANNER_MIN_HEIGHT = 150;

function readPngDimensions(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function readJpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    i += 2;
    if (marker === 0xd8 || marker === 0xd9) break;
    const segLen = buf.readUInt16BE(i);
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      const height = buf.readUInt16BE(i + 3);
      const width = buf.readUInt16BE(i + 5);
      return { width, height };
    }
    i += segLen;
  }
  return null;
}

function readWebpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  if (fourcc === 'VP8X') {
    const width = 1 + (buf.readUIntLE(24, 3));
    const height = 1 + (buf.readUIntLE(27, 3));
    return { width, height };
  }
  return null;
}

function getImageDimensionsFromDataUrl(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.*)$/i.exec(dataUrl);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  let buf;
  try { buf = Buffer.from(m[2], 'base64'); } catch { return null; }
  if (kind === 'png') return readPngDimensions(buf);
  if (kind === 'jpeg' || kind === 'jpg') return readJpegDimensions(buf);
  if (kind === 'webp') return readWebpDimensions(buf);
  return null;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const {
    username,
    avatar,
    bio,
    bannerUrl,
    favoriteTeams,
    equippedFrame,
  } = req.body;

  try {
    if (avatar && typeof avatar === 'string') {
      const isUploadedPath = avatar.startsWith('/objects/');
      if (!isUploadedPath) {
        if (!avatar.startsWith('data:image/')) {
          return res.status(400).json({ error: 'Invalid avatar format. Must be a valid image.' });
        }
        const validMimeTypes = ['data:image/jpeg;', 'data:image/jpg;', 'data:image/png;', 'data:image/gif;', 'data:image/webp;'];
        const isValidMime = validMimeTypes.some(mime => avatar.startsWith(mime));
        if (!isValidMime) {
          return res.status(400).json({ error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' });
        }
        if (avatar.length > 2 * 1024 * 1024) {
          return res.status(400).json({ error: 'Avatar image too large. Max 2MB.' });
        }
      } else if (avatar.length > 500) {
        return res.status(400).json({ error: 'Invalid avatar path.' });
      }
    }

    if (bio && typeof bio === 'string' && bio.length > 200) {
      return res.status(400).json({ error: 'Bio too long. Max 200 characters.' });
    }

    if (bannerUrl !== undefined && bannerUrl !== null && bannerUrl !== '') {
      if (typeof bannerUrl !== 'string') {
        return res.status(400).json({ error: 'Invalid banner URL' });
      }
      const ok =
        isLibraryBanner(bannerUrl) ||
        bannerUrl.startsWith('/objects/') ||
        bannerUrl.startsWith('/banners/') ||
        bannerUrl.startsWith('data:image/');
      if (!ok) {
        return res.status(400).json({ error: 'Banner must be from the library or an upload.' });
      }
      if (bannerUrl.startsWith('data:image/')) {
        if (bannerUrl.length > 4 * 1024 * 1024) {
          return res.status(400).json({ error: 'Banner image too large. Max 4MB.' });
        }
        const dims = getImageDimensionsFromDataUrl(bannerUrl);
        if (!dims) {
          return res.status(400).json({ error: 'Could not read banner image dimensions.' });
        }
        if (dims.width > BANNER_MAX_WIDTH || dims.height > BANNER_MAX_HEIGHT) {
          return res.status(400).json({
            error: `Banner image too large. Max ${BANNER_MAX_WIDTH}x${BANNER_MAX_HEIGHT}px.`,
          });
        }
        if (dims.width < BANNER_MIN_WIDTH || dims.height < BANNER_MIN_HEIGHT) {
          return res.status(400).json({
            error: `Banner image too small. Min ${BANNER_MIN_WIDTH}x${BANNER_MIN_HEIGHT}px.`,
          });
        }
      }
    }

    let normalizedFavorites = null;
    if (favoriteTeams !== undefined) {
      if (!Array.isArray(favoriteTeams)) {
        return res.status(400).json({ error: 'favoriteTeams must be an array' });
      }
      if (favoriteTeams.length > FAVORITE_TEAMS_LIMIT) {
        return res.status(400).json({
          error: `You can pick up to ${FAVORITE_TEAMS_LIMIT} favorite teams.`,
        });
      }
      normalizedFavorites = normalizeFavoriteTeams(favoriteTeams);
    }

    let resolvedFrame = undefined;
    let backfilledUnlocked = null;
    if (equippedFrame !== undefined) {
      if (equippedFrame === null || equippedFrame === '') {
        resolvedFrame = null;
      } else {
        if (typeof equippedFrame !== 'string' || !getFrameById(equippedFrame)) {
          return res.status(400).json({ error: 'Unknown frame' });
        }
        const [current] = await db
          .select({
            unlockedFrames: profiles.unlockedFrames,
            achievements: profiles.achievements,
          })
          .from(profiles)
          .where(eq(profiles.id, userId))
          .limit(1);
        const storedUnlocked = Array.isArray(current?.unlockedFrames)
          ? current.unlockedFrames.filter((x) => typeof x === 'string')
          : [];
        const derived = deriveUnlockedFrameIds({
          unlockedFrames: storedUnlocked,
          achievements: Array.isArray(current?.achievements) ? current.achievements : [],
        });
        if (!derived.includes(equippedFrame)) {
          return res
            .status(403)
            .json({ error: 'You have not unlocked this frame yet.' });
        }
        if (derived.length > storedUnlocked.length) {
          backfilledUnlocked = derived;
        }
        resolvedFrame = equippedFrame;
      }
    }
    if (username) {
      const existingUser = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(
          eq(profiles.username, username.toLowerCase().trim()),
          ne(profiles.id, userId)
        ))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
    }

    const updateData = {
      updatedAt: new Date(),
    };

    if (username !== undefined) {
      updateData.username = username.toLowerCase().trim();
    }
    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }
    if (bio !== undefined) {
      updateData.bio = bio;
    }
    if (bannerUrl !== undefined) {
      updateData.bannerUrl = bannerUrl || null;
    }
    if (normalizedFavorites !== null) {
      updateData.favoriteTeams = normalizedFavorites;
    }
    if (resolvedFrame !== undefined) {
      updateData.equippedFrame = resolvedFrame;
    }
    if (backfilledUnlocked) {
      updateData.unlockedFrames = backfilledUnlocked;
    }

    const [updated] = await db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.id, userId))
      .returning();

    if (!updated) {
      await db.insert(profiles).values({
        id: userId,
        username: username?.toLowerCase().trim() || null,
        avatar: avatar || null,
        bio: bio || null,
      });
      
      const [newProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId));
      
      return res.status(200).json(newProfile);
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}
