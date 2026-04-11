// src/features/pair/services/pairService.ts
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  collection,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../firebase/firestore";
import { generateInviteToken } from "../../../lib/token";
import type { Pair } from "../../../types";

/** ログイン時にユーザーレコードを初期化（displayName は NicknameSetup で設定するため上書きしない） */
export const saveUserProfile = async (uid: string): Promise<void> => {
  await setDoc(doc(db, "users", uid), { uid }, { merge: true });
};

/** displayName を更新する */
export const saveDisplayName = async (
  uid: string,
  displayName: string
): Promise<void> => {
  await setDoc(doc(db, "users", uid), { displayName }, { merge: true });
};

/** ユーザーの displayName を取得する */
export const getDisplayName = async (uid: string): Promise<string | null> => {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const name = snap.data().displayName;
  return name && name.trim() !== "" ? name : null;
};

/** ユーザーの pairId を取得する */
export const getUserPairId = async (uid: string): Promise<string | null> => {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data().pairId ?? null;
};

/** ペアを新規作成して pairId を返す */
export const createPair = async (uid: string): Promise<string> => {
  const inviteToken = generateInviteToken();
  const pairRef = await addDoc(collection(db, "pairs"), {
    members: [uid],
    inviteToken,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "users", uid), { pairId: pairRef.id }, { merge: true });
  return pairRef.id;
};

/** 招待トークンを照合してペアに参加する */
export const joinPair = async (
  uid: string,
  pairId: string,
  token: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const pairRef = doc(db, "pairs", pairId);
    const pairSnap = await getDoc(pairRef);

    if (!pairSnap.exists()) {
      return { success: false, error: "この招待リンクは無効です。" };
    }

    const pair = pairSnap.data() as Pair;

    if (!pair.isActive) {
      return { success: false, error: "この招待リンクは無効です。" };
    }
    if (pair.inviteToken !== token) {
      return { success: false, error: "この招待リンクは無効です。" };
    }
    if (pair.members.includes(uid)) {
      // すでにメンバーなら pairId だけ同期して成功
      await setDoc(doc(db, "users", uid), { pairId }, { merge: true });
      return { success: true };
    }
    if (pair.members.length >= 2) {
      return { success: false, error: "このペアはすでに2名が参加しています。" };
    }

    await updateDoc(pairRef, { members: arrayUnion(uid) });
    await setDoc(doc(db, "users", uid), { pairId }, { merge: true });
    return { success: true };
  } catch {
    return { success: false, error: "参加処理中にエラーが発生しました。" };
  }
};

/** pairId からペア情報を取得する */
export const getPair = async (pairId: string): Promise<Pair | null> => {
  const snap = await getDoc(doc(db, "pairs", pairId));
  if (!snap.exists()) return null;
  return { pairId, ...snap.data() } as Pair;
};

/** 招待トークンを再発行する */
export const reissueInviteToken = async (pairId: string): Promise<string> => {
  const newToken = generateInviteToken();
  await updateDoc(doc(db, "pairs", pairId), { inviteToken: newToken });
  return newToken;
};

/**
 * パートナーをペアから外し、再招待できる状態に戻す
 * - パートナーの UID をメンバーから除去
 * - パートナーの pairId をクリア
 * - ペア状態フラグをリセット、新しい招待トークンを発行
 * - items / pendingItems を全削除
 */
export const removePairPartner = async (
  pairId: string,
  myUid: string
): Promise<string> => {
  const pairRef = doc(db, "pairs", pairId);
  const pairSnap = await getDoc(pairRef);
  if (!pairSnap.exists()) throw new Error("pair not found");

  const members = pairSnap.data().members as string[];
  const partnerUid = members.find((m) => m !== myUid);

  const newToken = generateInviteToken();
  const batch = writeBatch(db);

  // ペア状態をリセット
  batch.update(pairRef, {
    members: [myUid],
    inviteToken: newToken,
    matchingFinalized: false,
    creatorSwipesDone: false,
    partnerSwipesDone: false,
    hearing: null,
  });

  // ※ パートナーの users/{uid} は自分のドキュメントでないためクライアントから更新不可。
  //   パートナーが次回ログイン時に PairSetupPage でメンバー外を検出し自動クリアする。
  void partnerUid; // lint 警告抑制

  // items / pendingItems を全削除
  const [itemsSnap, pendingSnap] = await Promise.all([
    getDocs(collection(db, "pairs", pairId, "items")),
    getDocs(collection(db, "pairs", pairId, "pendingItems")),
  ]);
  itemsSnap.forEach((d) => batch.delete(d.ref));
  pendingSnap.forEach((d) => batch.delete(d.ref));

  await batch.commit();
  return newToken;
};

/**
 * ペアを解除する
 * - pair を isActive: false にする
 * - ペアの全メンバーから pairId を削除する
 * - items / pendingItems を削除する
 */
export const unpairUser = async (pairId: string): Promise<void> => {
  const batch = writeBatch(db);

  // pair を無効化
  batch.update(doc(db, "pairs", pairId), { isActive: false });

  // ペアメンバー全員の pairId を削除
  const pairSnap = await getDoc(doc(db, "pairs", pairId));
  if (pairSnap.exists()) {
    const members = pairSnap.data().members as string[];
    for (const memberId of members) {
      batch.update(doc(db, "users", memberId), { pairId: null });
    }
  }

  // items を削除
  const itemsSnap = await getDocs(collection(db, "pairs", pairId, "items"));
  itemsSnap.forEach((d) => batch.delete(d.ref));

  // pendingItems を削除
  const pendingSnap = await getDocs(collection(db, "pairs", pairId, "pendingItems"));
  pendingSnap.forEach((d) => batch.delete(d.ref));

  await batch.commit();
};
