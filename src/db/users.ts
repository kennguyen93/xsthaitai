import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, displayName = '') {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({ email, displayName: displayName || existing[0].displayName })
        .where(eq(users.uid, uid))
        .returning();
      return updated[0];
    }

    // Check if any admin exists yet or if email is in ADMIN_EMAILS
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const [{ value: userCount }] = await db.select({ value: count() }).from(users);
    const shouldBeAdmin =
      Number(userCount) === 0 || adminEmails.includes(email.toLowerCase());

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
        role: shouldBeAdmin ? 'admin' : 'user',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, displayName },
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
