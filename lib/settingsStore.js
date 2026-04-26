import { eq } from 'drizzle-orm';
import { db } from './db';
import { appSettings } from '../shared/schema';

export async function getSetting(key) {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    return row?.value ?? null;
  } catch (err) {
    console.error('Failed to read setting', key, err);
    return null;
  }
}

export async function setSetting(key, value) {
  try {
    await db
      .insert(appSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
    return true;
  } catch (err) {
    console.error('Failed to write setting', key, err);
    return false;
  }
}
