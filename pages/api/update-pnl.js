export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.status(200).json({ success: true, message: 'POST method accepted' });
}
