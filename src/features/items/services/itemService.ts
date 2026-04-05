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
import type { Item, ItemStatus } from "../../../types";

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
  data: { memo?: string | null; rating?: number | null }
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

/** ドラッグ並び替え後の順序を一括保存（displayOrder フィールドを更新） */
export const reorderItems = async (
  pairId: string,
  orderedIds: string[]
): Promise<void> => {
  const batch = writeBatch(db);
  orderedIds.forEach((itemId, index) => {
    batch.update(doc(db, "pairs", pairId, "items", itemId), {
      displayOrder: index,
    });
  });
  await batch.commit();
};
