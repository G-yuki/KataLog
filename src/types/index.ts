// src/types/index.ts
import { Timestamp } from "firebase/firestore";

// ── ユーザー ──────────────────────────────────
export interface User {
  uid: string;
  displayName: string;
  pairId: string | null;
  createdAt: Timestamp;
}

// ── ペア ──────────────────────────────────────
export interface Hearing {
  genres: string[];        // 好きな体験タイプ
  prefecture: string;      // 都道府県
  range: string;           // "county" | "neighbor" | "anywhere"
  children: string;        // "none" | "infant" | "child" | "planned"
  transport: string;       // "transit" | "car" | "both"
  budget: string;          // "3000" | "5000" | "10000" | "30000" | "any"
  indoor: string;          // "outdoor" | "indoor" | "both"
  freetext: string;
  overseas?: string;       // 海外旅行エリア（Asia/Europe 等）- SUGGEST海外オプション用
}

export interface Pair {
  pairId: string;
  members: [string, string];
  inviteToken: string;
  isActive: boolean;
  createdAt: Timestamp;
  hearing?: Hearing;
}

// ── アイテム ──────────────────────────────────
export type Category =
  | "おでかけ"
  | "映画"
  | "本"
  | "ゲーム"
  | "食事"
  | "音楽"
  | "スポーツ"
  | "その他";

export type ItemType = "outdoor" | "indoor";
export type Difficulty = "easy" | "special";
export type ItemStatus = "unread" | "todo" | "done";
export type MatchTier = "go" | "good" | "try";
export type SwipeAction = "good" | "pass" | "go";

export interface Item {
  itemId: string;
  title: string;             // 15文字以内
  category: Category;
  type: ItemType;
  difficulty: Difficulty;
  status: ItemStatus;
  isWant: boolean;           // Go!!フラグ（ユーザーが変更可能）
  matchTier: MatchTier;      // スワイプマッチング結果（固定）
  rating: number | null;     // 1〜5
  memo: string | null;       // 100文字以内
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  expireAt?: Timestamp;        // matchTier="try" のみ: +30日後（Firestore TTL自動削除）
  placeId: string | null;
  placeName: string | null;
  placeRating: number | null;
  placePhotoRef: string | null;
  lat: number | null;
  lng: number | null;
  userPlaceUrl?: string | null;
}

// AI生成時のアイテム（Firestore保存前）
export interface ItemDraft {
  title: string;
  category: Category;
  type: ItemType;
  difficulty: Difficulty;
}

// ふたりのスワイプ結果保存用（マッチング前）
export interface PendingItem {
  pendingItemId: string;
  title: string;
  category: Category;
  type: ItemType;
  difficulty: Difficulty;
  creatorSwipe: SwipeAction;
  createdAt: Timestamp;
}
