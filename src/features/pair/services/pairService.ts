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
