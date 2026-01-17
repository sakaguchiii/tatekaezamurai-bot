import * as admin from 'firebase-admin';

export interface Session {
  groupId: string;
  groupName: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  createdBy: {
    userId: string;
    displayName: string;
  };
  status: 'active' | 'settled' | 'completed';
  members: Member[];
  payments: Payment[];
  settlements: Settlement[];
  reminder: Reminder;
}

export interface Member {
  userId: string;
  displayName: string;
  pictureUrl: string;
  joinedAt: admin.firestore.Timestamp;
  participationRange: {
    startFrom: number;
    endAt: number | null;
  };
}

export interface Payment {
  id: string;
  sequence: number;
  label: string;
  description?: string;
  amount: number;
  paidBy: {
    userId: string;
    displayName: string;
  };
  participants: string[];
  timestamp: admin.firestore.Timestamp;
  isDeleted: boolean;
}

export interface Settlement {
  from: {
    userId: string;
    displayName: string;
  };
  to: {
    userId: string;
    displayName: string;
  };
  amount: number;
  status: 'pending' | 'completed';
  paypayLink: string;
  linePayLink: string;
  completedAt?: admin.firestore.Timestamp;
  completedBy?: string;
}

export interface Reminder {
  enabled: boolean;
  scheduledAt?: admin.firestore.Timestamp;
  sentAt?: admin.firestore.Timestamp;
  count: number;
}

export interface Balance {
  userId: string;
  displayName: string;
  paid: number;
  owes: number;
  balance: number;
  amount?: number; // 計算用
}
