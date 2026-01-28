import { databaseService } from './databaseService';

export interface Friend {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  followedAt: string;
  unfollowedAt?: string;
  isActive: boolean;
}

class FriendService {
  /**
   * 友達を保存
   */
  saveFriend(friend: Friend): void {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      INSERT INTO friends (
        user_id,
        display_name,
        picture_url,
        status_message,
        followed_at,
        unfollowed_at,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = excluded.display_name,
        picture_url = excluded.picture_url,
        status_message = excluded.status_message,
        is_active = 1,
        unfollowed_at = NULL,
        updated_at = excluded.updated_at
    `);

    const now = new Date().toISOString();

    stmt.run(
      friend.userId,
      friend.displayName,
      friend.pictureUrl || null,
      friend.statusMessage || null,
      friend.followedAt,
      null,
      1, // is_active
      now,
      now
    );

    console.log(`💾 友達を保存: ${friend.displayName} (${friend.userId})`);
  }

  /**
   * 友達のブロック（アンフォロー）を記録
   */
  unfollowFriend(userId: string): void {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      UPDATE friends
      SET
        is_active = 0,
        unfollowed_at = ?,
        updated_at = ?
      WHERE user_id = ?
    `);

    const now = new Date().toISOString();
    stmt.run(now, now, userId);

    console.log(`👋 友達をアンフォロー: ${userId}`);
  }

  /**
   * 友達を取得
   */
  getFriend(userId: string): Friend | null {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      SELECT
        user_id as userId,
        display_name as displayName,
        picture_url as pictureUrl,
        status_message as statusMessage,
        followed_at as followedAt,
        unfollowed_at as unfollowedAt,
        is_active as isActive
      FROM friends
      WHERE user_id = ?
    `);

    const row = stmt.get(userId) as any;

    if (!row) {
      return null;
    }

    return {
      userId: row.userId,
      displayName: row.displayName,
      pictureUrl: row.pictureUrl || undefined,
      statusMessage: row.statusMessage || undefined,
      followedAt: row.followedAt,
      unfollowedAt: row.unfollowedAt || undefined,
      isActive: row.isActive === 1,
    };
  }

  /**
   * アクティブな友達一覧を取得
   */
  getActiveFriends(): Friend[] {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      SELECT
        user_id as userId,
        display_name as displayName,
        picture_url as pictureUrl,
        status_message as statusMessage,
        followed_at as followedAt,
        unfollowed_at as unfollowedAt,
        is_active as isActive
      FROM friends
      WHERE is_active = 1
      ORDER BY followed_at DESC
    `);

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      userId: row.userId,
      displayName: row.displayName,
      pictureUrl: row.pictureUrl || undefined,
      statusMessage: row.statusMessage || undefined,
      followedAt: row.followedAt,
      unfollowedAt: row.unfollowedAt || undefined,
      isActive: row.isActive === 1,
    }));
  }

  /**
   * 友達数を取得
   */
  getFriendsCount(): { total: number; active: number; blocked: number } {
    const db = databaseService.getDatabase();

    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM friends');
    const activeStmt = db.prepare('SELECT COUNT(*) as count FROM friends WHERE is_active = 1');
    const blockedStmt = db.prepare('SELECT COUNT(*) as count FROM friends WHERE is_active = 0');

    const total = (totalStmt.get() as any).count;
    const active = (activeStmt.get() as any).count;
    const blocked = (blockedStmt.get() as any).count;

    return { total, active, blocked };
  }

  /**
   * 今月の友達追加数を取得
   */
  getMonthlyNewFriends(): number {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM friends
      WHERE followed_at >= date('now', 'start of month')
    `);

    return (stmt.get() as any).count;
  }
}

export const friendService = new FriendService();
