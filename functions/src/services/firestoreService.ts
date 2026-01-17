import * as admin from 'firebase-admin';
import { Session, Payment } from '../types';

const db = admin.firestore();

export class FirestoreService {
  // セッション取得
  async getSession(groupId: string): Promise<Session | null> {
    const snapshot = await db
      .collection('sessions')
      .where('groupId', '==', groupId)
      .where('status', 'in', ['active', 'settled'])
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as Session;
  }

  // セッション作成
  async createSession(session: Session): Promise<void> {
    await db.collection('sessions').doc(session.groupId).set(session);
  }

  // セッション更新
  async updateSession(groupId: string, data: Partial<Session>): Promise<void> {
    await db.collection('sessions').doc(groupId).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // 支払い追加
  async addPayment(groupId: string, payment: Payment): Promise<void> {
    await db.collection('sessions').doc(groupId).update({
      payments: admin.firestore.FieldValue.arrayUnion(payment),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // セッション削除(終了)
  async endSession(groupId: string): Promise<void> {
    await db.collection('sessions').doc(groupId).update({
      status: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

export const firestoreService = new FirestoreService();
