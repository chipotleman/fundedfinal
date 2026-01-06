import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

let cachedSlots = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = Date.now();
    if (cachedSlots && (now - cacheTime) < CACHE_TTL) {
      return res.status(200).json({ slots: cachedSlots });
    }

    const slots = await sql`
      SELECT slot_number, image_url, link_url, alt_text, is_active
      FROM ad_slots
      WHERE is_active = true
      ORDER BY slot_number ASC
    `;

    const formattedSlots = {};
    slots.forEach(slot => {
      if (slot.image_url) {
        formattedSlots[`slot${slot.slot_number}`] = {
          image: slot.image_url,
          link: slot.link_url || null,
          alt: slot.alt_text || 'Promotion'
        };
      }
    });

    cachedSlots = formattedSlots;
    cacheTime = now;

    return res.status(200).json({ slots: formattedSlots });
  } catch (error) {
    console.error('Error fetching ad slots:', error);
    return res.status(500).json({ error: 'Failed to fetch ad slots' });
  }
}
