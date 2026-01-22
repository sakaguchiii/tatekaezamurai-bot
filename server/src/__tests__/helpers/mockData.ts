/**
 * テスト用のモックデータヘルパー
 */

import { Session, Member, Payment, Settlement, Reminder } from '../../types';

/**
 * テスト用のメンバーを作成
 */
export const createMockMember = (userId: string, displayName: string): Member => ({
  userId,
  displayName,
  pictureUrl: `https://example.com/pic/${userId}.jpg`,
  joinedAt: new Date().toISOString(),
  participationRange: {
    startFrom: 0,
    endAt: null
  }
});

/**
 * テスト用の支払いを作成
 */
export const createMockPayment = (
  id: string,
  sequence: number,
  userId: string,
  displayName: string,
  label: string,
  amount: number,
  participants: string[] = []
): Payment => ({
  id,
  sequence,
  label,
  amount,
  paidBy: {
    userId,
    displayName
  },
  participants,
  timestamp: new Date().toISOString(),
  isDeleted: false
});

/**
 * テスト用のセッションを作成
 */
export const createMockSession = (
  groupId: string,
  options: Partial<Session> = {}
): Session => ({
  groupId,
  groupName: options.groupName || `テストグループ${groupId}`,
  status: options.status || 'active',
  createdAt: options.createdAt || new Date().toISOString(),
  updatedAt: options.updatedAt || new Date().toISOString(),
  createdBy: options.createdBy || {
    userId: 'user001',
    displayName: 'テストユーザー1'
  },
  members: options.members || [
    createMockMember('user001', 'テストユーザー1')
  ],
  payments: options.payments || [],
  settlements: options.settlements || [],
  reminder: options.reminder || {
    enabled: false,
    count: 0
  }
});

/**
 * 複数のセッションを作成
 */
export const createMockSessions = (count: number): Session[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockSession(`test-group-${i}`)
  );
};
