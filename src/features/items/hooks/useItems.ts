// src/features/items/hooks/useItems.ts
import { useState, useEffect } from "react";
import {
  subscribeItems,
  updateStatus,
  toggleWant,
  updateItemDetail,
  deleteItem,
} from "../services/itemService";
import { Timestamp } from "firebase/firestore";
import { latLngToPrefecture } from "../../../lib/weather";
import type { Item, ItemStatus } from "../../../types";

export const useItems = (pairId: string | null) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pairId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeItems(pairId, (data) => {
      // displayOrder があれば優先、なければ createdAt 順（subscribeItems で既にソート済み）
      const sorted = [...data]
        .map((item) => ({
          ...item,
          // "食事" はレガシー値。"gourmet" に正規化してアプリ全体で統一
          category: (item.category as string) === "食事" ? "gourmet" : item.category,
          // lat/lng 有 & prefecture/overseas 未設定の場合は最近傍都道府県を自動付与
          prefecture: item.prefecture ?? (
            item.lat != null && item.lng != null && !item.overseas
              ? (latLngToPrefecture(item.lat, item.lng) ?? undefined)
              : undefined
          ),
        }))
        .sort((a, b) => {
          const oa = (a as Item & { displayOrder?: number }).displayOrder ?? 9999;
          const ob = (b as Item & { displayOrder?: number }).displayOrder ?? 9999;
          return oa - ob;
        });
      setItems(sorted);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [pairId]);

  const setStatus = (itemId: string, status: ItemStatus) => {
    if (!pairId) return Promise.resolve();
    return updateStatus(pairId, itemId, status);
  };

  const toggleIsWant = (itemId: string, current: boolean) => {
    if (!pairId) return Promise.resolve();
    return toggleWant(pairId, itemId, current);
  };

  const saveDetail = (
    itemId: string,
    data: {
      memo?: string | null;
      rating?: number | null;
      title?: string;
      userPlaceUrl?: string | null;
      placeId?: string | null;
      placePhotoRef?: string | null;
      completedAt?: Timestamp | null;
      userPhotos?: string[];
      pinnedPhotoUrl?: string | null;
      headerPosY?: number | null;
    }
  ) => {
    if (!pairId) return Promise.resolve();
    return updateItemDetail(pairId, itemId, data);
  };

  const removeItem = (itemId: string) => {
    if (!pairId) return Promise.resolve();
    return deleteItem(pairId, itemId);
  };

  return { items, loading, setStatus, toggleIsWant, saveDetail, removeItem };
};
