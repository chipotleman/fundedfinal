import { db } from '../../../lib/db';
import { battleAvatarLibrary } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminAuth } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const avatars = await db
        .select()
        .from(battleAvatarLibrary)
        .where(eq(battleAvatarLibrary.isActive, true));
      
      return res.status(200).json({ 
        avatars: avatars.map(a => a.url),
        full: avatars 
      });
    } catch (error) {
      console.error('Error fetching battle avatars:', error);
      return res.status(200).json({ avatars: [] });
    }
  }
  
  if (req.method === 'POST') {
    const auth = await verifyAdminAuth(req);
    if (!auth.valid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const { urls, label } = req.body;
      
      if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: 'URLs must be an array' });
      }
      
      const inserted = [];
      for (const url of urls) {
        if (url && typeof url === 'string' && url.trim()) {
          const [result] = await db.insert(battleAvatarLibrary).values({
            url: url.trim(),
            label: label || 'Uploaded avatar',
          }).returning();
          inserted.push(result);
        }
      }
      
      return res.status(200).json({ success: true, inserted });
    } catch (error) {
      console.error('Error saving battle avatars:', error);
      return res.status(500).json({ error: 'Failed to save avatars' });
    }
  }
  
  if (req.method === 'DELETE') {
    const auth = await verifyAdminAuth(req);
    if (!auth.valid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Avatar ID required' });
      }
      
      await db.delete(battleAvatarLibrary).where(eq(battleAvatarLibrary.id, id));
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting avatar:', error);
      return res.status(500).json({ error: 'Failed to delete avatar' });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
