import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export const ALLOWED_ADMIN_EMAIL = 'kennguyen931908@gmail.com';

export function isAllowedAdminEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === ALLOWED_ADMIN_EMAIL;
}

export async function getOrCreateUser(uid: string, email: string, displayName = '') {
  try {
    const role = isAllowedAdminEmail(email) ? 'admin' : 'user';
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({ email, displayName: displayName || existing[0].displayName, role })
        .where(eq(users.uid, uid))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
        role,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, displayName, role },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database error in getUserByUid:', error);
    throw new Error('Failed to load user profile.', { cause: error });
  }
}
