export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: Implement PnL update with PostgreSQL when bet tracking is needed
  res.status(501).json({ error: 'Not implemented - requires database migration' });
}
