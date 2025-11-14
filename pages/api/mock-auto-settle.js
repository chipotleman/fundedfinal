export default async function handler(req, res) {
  // ✅ Secure your endpoint if CRON_SECRET is set
  if (
    process.env.CRON_SECRET &&
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // TODO: Implement auto-settlement with PostgreSQL when game tracking is needed
    res.status(501).json({ message: 'Not implemented - requires database migration' });
  } catch (error) {
    console.error('❌ Settlement error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
