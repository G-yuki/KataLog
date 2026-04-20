// src/features/items/services/itemService.ts
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
  writeBatch,
  getDocs,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firestore";
import type { Item, ItemDraft, ItemStatus, PendingItem, SwipeAction } from "../../../types";

// ── Items ─────────────────────────────────────────────────────────

/** リアルタイム監視 */
export const subscribeItems = (
  pairId: string,
  onUpdate: (items: Item[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, "pairs", pairId, "items"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    const items: Item[] = snapshot.docs.map((d) => ({
      itemId: d.id,
      ...d.data(),
    } as Item));
    onUpdate(items);
  });
};

/** ステータス変更（todo ↔ done） */
export const updateStatus = async (
  pairId: string,
  itemId: string,
  status: ItemStatus
): Promise<void> => {
  await updateDoc(doc(db, "pairs", pairId, "items", itemId), {
    status,
    completedAt: status === "done" ? serverTimestamp() : null,
  });
};

/** やりたい★ トグル */
export const toggleWant = async (
  pairId: string,
  itemId: string,
  current: boolean
): Promise<void> => {
  await updateDoc(doc(db, "pairs", pairId, "items", itemId), {
    isWant: !current,
  });
};

/** メモ・評価・URLなどを保存 */
export const updateItemDetail = async (
  pairId: string,
  itemId: string,
  data: {
    memo?: string | null;
    rating?: number | null;
    title?: string;
    userPlaceUrl?: string | null;
    placeId?: string | null;
    placePhotoRef?: string | null;
    completedAt?: Timestamp | null;
  }
): Promise<void> => {
  await updateDoc(doc(db, "pairs", pairId, "items", itemId), data);
};

/** 削除 */
export const deleteItem = async (
  pairId: string,
  itemId: string
): Promise<void> => {
  await deleteDoc(doc(db, "pairs", pairId, "items", itemId));
};

/** ふたりのリストをリセット（items + pendingItems を削除） */
export const resetPairList = async (pairId: string): Promise<void> => {
  const batch = writeBatch(db);
  const [itemsSnap, pendingSnap] = await Promise.all([
    getDocs(collection(db, "pairs", pairId, "items")),
    getDocs(collection(db, "pairs", pairId, "pendingItems")),
  ]);
  itemsSnap.forEach((d) => batch.delete(d.ref));
  pendingSnap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

/** Suggest で選択したアイテムをリストに直接追加 */
export const addSuggestedItems = async (
  pairId: string,
  drafts: { title: string; category: string; type: string; difficulty: string }[]
): Promise<void> => {
  const batch = writeBatch(db);
  drafts.forEach((draft) => {
    const ref = doc(collection(db, "pairs", pairId, "items"));
    batch.set(ref, {
      ...draft,
      status: "todo",
      isWant: false,
      matchTier: "good",
      rating: null,
      memo: null,
      completedAt: null,
      placeId: null,
      placeName: null,
      placeRating: null,
      placePhotoRef: null,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
};

/** 手動でアイテムを追加 */
export const addManualItem = async (
  pairId: string,
  data: {
    title: string;
    category: string;
    type: string;
    status: string;
    rating: number | null;
    memo: string | null;
    userPlaceUrl: string | null;
  }
): Promise<void> => {
  const ref = doc(collection(db, "pairs", pairId, "items"));
  await setDoc(ref, {
    title: data.title,
    category: data.category,
    type: data.type,
    difficulty: "easy",
    status: data.status,
    isWant: false,
    matchTier: "good",
    rating: data.status === "done" ? data.rating : null,
    memo: data.memo,
    completedAt: data.status === "done" ? serverTimestamp() : null,
    userPlaceUrl: data.userPlaceUrl,
    placeId: null,
    placeName: null,
    placeRating: null,
    placePhotoRef: null,
    createdAt: serverTimestamp(),
  });
};

// ── Pending Items（同時スワイプフロー） ────────────────────────────

/**
 * HearingPage完了時: AI生成結果をスワイプなし状態でpendingItemsに保存
 * 両者がこのデータを参照してスワイプする
 */
export const savePendingItemsDraft = async (
  pairId: string,
  drafts: ItemDraft[]
): Promise<void> => {
  const batch = writeBatch(db);
  drafts.forEach((draft) => {
    const ref = doc(collection(db, "pairs", pairId, "pendingItems"));
    batch.set(ref, {
      ...draft,
      creatorSwipe: null,
      partnerSwipe: null,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
};

/**
 * 作成者スワイプ完了: メモリ上の結果を一括でFirestoreに書き込み
 * バッチ書き込みなので部分失敗なし（atomic）
 */
export const saveCreatorSwipes = async (
  pairId: string,
  results: { pendingItemId: string; action: SwipeAction }[]
): Promise<void> => {
  const batch = writeBatch(db);
  results.forEach(({ pendingItemId, action }) => {
    batch.update(
      doc(db, "pairs", pairId, "pendingItems", pendingItemId),
      { creatorSwipe: action }
    );
  });
  await batch.commit();
};

/**
 * パートナースワイプ完了: メモリ上の結果を一括でFirestoreに書き込み
 */
export const savePartnerSwipes = async (
  pairId: string,
  results: { pendingItemId: string; action: SwipeAction }[]
): Promise<void> => {
  const batch = writeBatch(db);
  results.forEach(({ pendingItemId, action }) => {
    batch.update(
      doc(db, "pairs", pairId, "pendingItems", pendingItemId),
      { partnerSwipe: action }
    );
  });
  await batch.commit();
};

/**
 * スワイプ完了を記録し、両者が揃ったか確認する（競合対策: transaction）
 *
 * - 自分のdoneフラグをatomicにセット
 * - matchingFinalizedが既にtrueなら false を返す（二重実行防止）
 * - 両者のdoneフラグが揃った場合のみ true を返す
 *   → 呼び出し側がtrue受け取り時にfinalizePairMatchingを実行
 */
export const markSwipesDoneAndCheck = async (
  pairId: string,
  role: "creator" | "partner"
): Promise<boolean> => {
  const myFlag   = role === "creator" ? "creatorSwipesDone" : "partnerSwipesDone";
  const otherFlag = role === "creator" ? "partnerSwipesDone" : "creatorSwipesDone";

  return runTransaction(db, async (t) => {
    const pairRef  = doc(db, "pairs", pairId);
    const pairSnap = await t.get(pairRef);
    const data = pairSnap.data() ?? {};

    // 既にマッチング完了済みなら何もしない
    if (data.matchingFinalized) return false;

    t.update(pairRef, { [myFlag]: true });

    // 相手のフラグが既に立っていれば両者揃った
    return data[otherFlag] === true;
  });
};

/**
 * マッチング処理（両者スワイプ完了後に1回だけ実行）
 *
 * - matchingFinalizedフラグで二重実行防止
 * - pendingItemsをFirestoreから一括読み込み
 * - マッチングルール適用 → items書き込み → pendingItems削除
 *
 * ルール:
 *   両方 pass              → 除外
 *   片方 pass              → matchTier: "try",  isWant: false
 *   両方 go                → matchTier: "go",   isWant: true
 *   それ以外（good 混じり）→ matchTier: "good", isWant: false
 */
export const finalizePairMatching = async (pairId: string): Promise<void> => {
  const pairRef    = doc(db, "pairs", pairId);
  const pendingSnap = await getDocs(collection(db, "pairs", pairId, "pendingItems"));

  const batch = writeBatch(db);

  // matchingFinalizedをatomicにセット（二重実行ガード）
  batch.update(pairRef, { matchingFinalized: true, matchingFinalizedAt: serverTimestamp() });

  pendingSnap.docs.forEach((d) => {
    const data = d.data();
    const cs = data.creatorSwipe as SwipeAction | null;
    const ps = data.partnerSwipe as SwipeAction | null;

    // 片方未スワイプ or 両方pass → 除外
    if (!cs || !ps) { batch.delete(d.ref); return; }
    if (cs === "pass" && ps === "pass") { batch.delete(d.ref); return; }

    let matchTier: "go" | "good" | "try";
    if (cs === "pass" || ps === "pass") {
      matchTier = "try";
    } else if (cs === "go" && ps === "go") {
      matchTier = "go";
    } else {
      matchTier = "good";
    }

    const itemRef = doc(collection(db, "pairs", pairId, "items"));
    batch.set(itemRef, {
      title:          data.title,
      category:       data.category,
      type:           data.type,
      difficulty:     data.difficulty,
      status:         "todo",
      isWant:         matchTier === "go",
      matchTier,
      rating:         null,
      memo:           null,
      completedAt:    null,
      // try アイテムは30日後に Firestore TTL で自動削除
      ...(matchTier === "try" && {
        expireAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      }),
      placeId:        null,
      placeName:      null,
      placeRating:    null,
      placePhotoRef:  null,
      createdAt:      serverTimestamp(),
    });

    batch.delete(d.ref);
  });

  await batch.commit();
};

/** pendingItems をリアルタイム監視 */
export const subscribePendingItems = (
  pairId: string,
  onUpdate: (items: PendingItem[]) => void
): Unsubscribe => {
  return onSnapshot(
    collection(db, "pairs", pairId, "pendingItems"),
    (snap) => {
      const items: PendingItem[] = snap.docs.map((d) => ({
        pendingItemId: d.id,
        ...d.data(),
      } as PendingItem));
      onUpdate(items);
    }
  );
};
