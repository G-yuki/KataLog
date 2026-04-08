// src/features/items/services/itemService.ts
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../firebase/firestore";
import type { Item, ItemStatus, PendingItem, SwipeAction } from "../../../types";

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

/** ステータス変更（todo ↔ done / unread → todo） */
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

/** メモ・評価を保存 */
export const updateItemDetail = async (
  pairId: string,
  itemId: string,
  data: { memo?: string | null; rating?: number | null; title?: string }
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

// ── Pending Items（ふたりのスワイプ前の一時保存） ──────────────

/** 作成者のスワイプ結果を pendingItems に保存 */
export const savePendingItems = async (
  pairId: string,
  results: { draft: { title: string; category: string; type: string; difficulty: string }; action: SwipeAction }[]
): Promise<void> => {
  const batch = writeBatch(db);
  results.forEach(({ draft, action }) => {
    const ref = doc(collection(db, "pairs", pairId, "pendingItems"));
    batch.set(ref, { ...draft, creatorSwipe: action, createdAt: serverTimestamp() });
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

/**
 * パートナースワイプ完了後のマッチング処理
 * マッチング結果を items に書き込み、pendingItems を削除する
 *
 * ルール:
 *   両方 pass          → 除外
 *   片方 pass          → matchTier: "try",  isWant: false
 *   両方 go            → matchTier: "go",   isWant: true
 *   それ以外(good混じり) → matchTier: "good", isWant: false
 */
export const finalizeMatchedItems = async (
  pairId: string,
  pendingItems: PendingItem[],
  partnerResults: { pendingItemId: string; action: SwipeAction }[]
): Promise<void> => {
  const partnerMap = new Map(partnerResults.map((r) => [r.pendingItemId, r.action]));
  const batch = writeBatch(db);

  pendingItems.forEach((pending) => {
    const cs = pending.creatorSwipe;
    const ps = partnerMap.get(pending.pendingItemId);
    if (!ps) return;

    // 両方 pass → 除外
    if (cs === "pass" && ps === "pass") return;

    let matchTier: "go" | "good" | "try";
    if (cs === "pass" || ps === "pass") {
      matchTier = "try";
    } else if (cs === "go" && ps === "go") {
      matchTier = "go";
    } else {
      matchTier = "good";
    }

    const ref = doc(collection(db, "pairs", pairId, "items"));
    batch.set(ref, {
      title: pending.title,
      category: pending.category,
      type: pending.type,
      difficulty: pending.difficulty,
      status: "todo",
      isWant: matchTier === "go",
      matchTier,
      rating: null,
      memo: null,
      completedAt: null,
      placeId: null,
      placeName: null,
      placeRating: null,
      placePhotoRef: null,
      createdAt: serverTimestamp(),
    });

    // pendingItem を削除
    batch.delete(doc(db, "pairs", pairId, "pendingItems", pending.pendingItemId));
  });

  await batch.commit();
};

