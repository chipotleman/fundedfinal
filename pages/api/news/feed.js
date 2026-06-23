// Piks News feed: merged, de-duped ESPN headlines across many leagues.
import { getFeed } from '../../../lib/news';

export default async function handler(req, res) {
  try {
    const items = await getFeed();
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(200).json({ items: [] });
  }
}
