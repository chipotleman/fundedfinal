import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function decodeToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

async function verifyAdminAuth(token) {
  if (!token) return { authorized: false };

  const decoded = decodeToken(token);
  if (!decoded || !decoded.id) {
    return { authorized: false };
  }

  const adminCheck = await sql`SELECT id, 'admin' as type FROM admin_users WHERE id = ${decoded.id}`;
  if (adminCheck.length > 0) {
    return { authorized: true, type: 'admin', id: adminCheck[0].id };
  }

  const staffCheck = await sql`
    SELECT id, role, permissions, is_active 
    FROM admin_staff 
    WHERE id = ${decoded.id} AND is_active = true
  `;
  if (staffCheck.length > 0) {
    return { 
      authorized: true, 
      type: 'staff', 
      id: staffCheck[0].id,
      role: staffCheck[0].role,
      permissions: staffCheck[0].permissions || []
    };
  }

  return { authorized: false };
}

function hasPermission(auth, requiredPermission) {
  if (auth.type === 'admin') return true;
  if (auth.role === 'admin') return true;
  return auth.permissions?.includes(requiredPermission) || false;
}

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let auth;
  try {
    auth = await verifyAdminAuth(token);
    if (!auth.authorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      let slots = await sql`
        SELECT id, slot_number, image_url, mobile_image_url, link_url, alt_text, is_active, updated_at, updated_by
        FROM ad_slots
        ORDER BY slot_number ASC
      `;

      if (slots.length === 0) {
        for (let i = 1; i <= 3; i++) {
          await sql`
            INSERT INTO ad_slots (slot_number, is_active)
            VALUES (${i}, true)
          `;
        }
        slots = await sql`
          SELECT id, slot_number, image_url, mobile_image_url, link_url, alt_text, is_active, updated_at, updated_by
          FROM ad_slots
          ORDER BY slot_number ASC
        `;
      }

      return res.status(200).json({ slots });
    } catch (error) {
      console.error('Error fetching ad slots:', error);
      return res.status(500).json({ error: 'Failed to fetch ad slots' });
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!hasPermission(auth, 'settings:write')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const { slotNumber, imageUrl, mobileImageUrl, linkUrl, altText, isActive } = req.body;

      if (!slotNumber || slotNumber < 1 || slotNumber > 3) {
        return res.status(400).json({ error: 'Invalid slot number (must be 1, 2, or 3)' });
      }

      const existing = await sql`
        SELECT id FROM ad_slots WHERE slot_number = ${slotNumber}
      `;

      if (existing.length === 0) {
        await sql`
          INSERT INTO ad_slots (slot_number, image_url, mobile_image_url, link_url, alt_text, is_active, updated_by, updated_at)
          VALUES (${slotNumber}, ${imageUrl || null}, ${mobileImageUrl || null}, ${linkUrl || null}, ${altText || null}, ${isActive !== false}, ${auth.id}, NOW())
        `;
      } else {
        await sql`
          UPDATE ad_slots
          SET 
            image_url = ${imageUrl || null},
            mobile_image_url = ${mobileImageUrl || null},
            link_url = ${linkUrl || null},
            alt_text = ${altText || null},
            is_active = ${isActive !== false},
            updated_by = ${auth.id},
            updated_at = NOW()
          WHERE slot_number = ${slotNumber}
        `;
      }

      const updated = await sql`
        SELECT id, slot_number, image_url, mobile_image_url, link_url, alt_text, is_active, updated_at, updated_by
        FROM ad_slots
        WHERE slot_number = ${slotNumber}
      `;

      return res.status(200).json({ 
        message: 'Ad slot updated successfully',
        slot: updated[0]
      });
    } catch (error) {
      console.error('Error updating ad slot:', error);
      return res.status(500).json({ error: 'Failed to update ad slot' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
