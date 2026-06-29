// src/features/memory/services/memoryService.ts
import {
  collection, doc, setDoc, deleteDoc, serverTimestamp,
  onSnapshot, orderBy, query, Timestamp, type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../../firebase/firestore";
import type { SavedMemory } from "../../../types";

export const saveMemory = async (
  pairId: string,
  data: {
    title: string;
    content: string;
    period: { from: Date; to: Date };
    itemCount: number;
  }
): Promise<void> => {
  const ref = doc(collection(db, "pairs", pairId, "memories"));
  await setDoc(ref, {
    type: "text",
    title: data.title,
    period: {
      from: Timestamp.fromDate(data.period.from),
      to: Timestamp.fromDate(data.period.to),
    },
    itemCount: data.itemCount,
    content: data.content,
    thumbnailUrl: null,
    isFavorite: false,
    createdAt: serverTimestamp(),
  });
};

export const deleteMemory = async (
  pairId: string,
  memoryId: string
): Promise<void> => {
  await deleteDoc(doc(db, "pairs", pairId, "memories", memoryId));
};

export const subscribeMemories = (
  pairId: string,
  onUpdate: (memories: SavedMemory[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, "pairs", pairId, "memories"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const memories: SavedMemory[] = snap.docs.map((d) => ({
      memoryId: d.id,
      ...d.data(),
    } as SavedMemory));
    onUpdate(memories);
  });
};
