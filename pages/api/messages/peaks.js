import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages } from '../../../shared/schema';
import { and, eq, isNull, or } from 'drizzle-orm';

// Backfill endpoint for legacy voice notes that pre-date the
// `attachment_peaks` column. The chat bubble decodes the audio once during a
// low-priority warm-up, then POSTs the resulting peak array here so future
// thread opens can render the bubble instantly from the stored data instead
// of repeating the decode.
//
// We deliberately accept writes only for rows where peaks are still NULL —
// any client that already has stored peaks would have skipped this code path
// entirely, and refusing to overwrite means a malicious caller can't flip a
// neighbour's bubble to a junk waveform.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { messageId, peaks } = req.body || {};

  if (!messageId || typeof messageId !== 'string') {
    return res.status(400).json({ error: 'messageId required' });
  }
  if (!Array.isArray(peaks) || peaks.length === 0) {
    return res.status(400).json({ error: 'peaks required' });
  }

  // Same sanitization as the send path: cap the length so a malicious payload
  // can't bloat the row, drop non-finite entries, clamp every value into the
  // [0, 1] range the visualizer expects.
  const MAX_PEAK_BARS = 64;
  const cleanPeaks = peaks.slice(0, MAX_PEAK_BARS).map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  });

  try {
    // Restrict the write to rows the caller actually participates in (sender
    // or receiver) AND that are still missing peaks. Both filters live in the
    // SQL WHERE so we never load the full row into memory or expose write
    // access to unrelated conversations.
    const result = await db
      .update(messages)
      .set({ attachmentPeaks: cleanPeaks })
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.messageType, 'voice'),
          isNull(messages.attachmentPeaks),
          or(eq(messages.senderId, userId), eq(messages.receiverId, userId)),
        ),
      )
      .returning({ id: messages.id });

    // Either the row already had peaks (someone else backfilled it first) or
    // the caller isn't a participant. Both are silent no-ops from the client's
    // perspective — the bubble still has its locally-decoded peaks.
    return res.status(200).json({ updated: result.length > 0 });
  } catch (error) {
    console.error('Error backfilling attachment peaks:', error);
    return res.status(500).json({ error: 'Failed to backfill peaks' });
  }
}
