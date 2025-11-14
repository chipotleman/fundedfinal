export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // TODO: Implement cappers marketplace with PostgreSQL when needed
    res.status(200).json({
      cappers: [],
      count: 0
    });
  } catch (error) {
    console.error('Error fetching cappers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}