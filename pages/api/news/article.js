// Piks News article: source metadata + original Piks AI analysis.
import { getArticleById } from '../../../lib/news';
import { getArticleAnalysis } from '../../../lib/newsAI';

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'missing id' });

  try {
    const article = await getArticleById(id);
    if (!article) return res.status(404).json({ error: 'not found' });

    const ai = await getArticleAnalysis(article);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
    return res.status(200).json({ article, ai });
  } catch (e) {
    return res.status(500).json({ error: 'failed' });
  }
}
