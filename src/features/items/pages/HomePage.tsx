// src/features/items/pages/HomePage.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useItems } from "../hooks/useItems";
import { Loading } from "../../../components/Loading";
import { getDisplayName } from "../../pair/services/pairService";
import { usePair } from "../../../contexts/PairContext";
import { db } from "../../../firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { CATEGORY_STYLE } from "../../../lib/constants";
import { BottomNav } from "../../../components/BottomNav";
import { HomeGuide } from "../../setup/components/HomeGuide";
import { addManualItem } from "../services/itemService";
import type { Item, Category, ItemType, ItemStatus } from "../../../types";

type Filter = "all" | Category;

const CATEGORIES: Category[] = ["おでかけ", "映画", "食事", "本", "ゲーム", "音楽", "スポーツ", "その他"];
const MAPS_KEY = import.meta.env.VITE_MAPS_BROWSER_KEY as string;

// Storage URL はそのまま、旧形式（Places photo参照名）は API 経由で取得
const photoUrl = (photoRef: string) =>
  photoRef.startsWith("https://")
    ? photoRef
    : `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=400&key=${MAPS_KEY}`;

export const HomePage = () => {
  const navigate = useNavigate();
  const { pairId, loading: pairLoading } = usePair();
  const [pairNames, setPairNames] = useState("");
  const { items, loading, setStatus, toggleIsWant, removeItem } = useItems(pairId);

  const [filter, setFilter] = useState<Filter>("all");
  const [doneOpen, setDoneOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(() => !localStorage.getItem("homeGuideSeen"));

  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  // 詳細から戻った際に状態を復元
  useEffect(() => {
    if (!pairId || loading || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const saved = sessionStorage.getItem(`home_state_${pairId}`);
      if (!saved) return;
      const { filter: f, doneOpen: d, scrollTop: s } = JSON.parse(saved) as {
        filter: Filter; doneOpen: boolean; scrollTop: number;
      };
      setFilter(f);
      setDoneOpen(d);
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = s ?? 0;
      });
    } catch { /* ignore */ }
  }, [pairId, loading]);

  const navigateToDetail = (itemId: string) => {
    if (pairId) {
      try {
        sessionStorage.setItem(`home_state_${pairId}`, JSON.stringify({
          filter, doneOpen,
          scrollTop: scrollRef.current?.scrollTop ?? 0,
        }));
      } catch { /* ignore */ }
    }
    navigate(`/home/${itemId}`);
  };

  // 手動追加モーダル
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("その他");
  const [newType, setNewType] = useState<ItemType>("indoor");
  const [newStatus, setNewStatus] = useState<ItemStatus>("todo");
  const [newRating, setNewRating] = useState<number | null>(null);
  const [newMapsUrl, setNewMapsUrl] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const handleAddItem = async () => {
    if (!pairId || !newTitle.trim()) return;
    setAddSaving(true);
    await addManualItem(pairId, {
      title: newTitle.trim(),
      category: newCategory,
      type: newType,
      status: newStatus,
      rating: newStatus === "done" ? newRating : null,
      memo: newMemo.trim() || null,
      userPlaceUrl: newMapsUrl.trim() || null,
    });
    setAddSaving(false);
    setShowAddModal(false);
    setNewTitle(""); setNewCategory("その他"); setNewType("indoor");
    setNewStatus("todo"); setNewRating(null); setNewMapsUrl(""); setNewMemo("");
  };

  useEffect(() => {
    if (pairLoading) return;
    if (!pairId) { navigate("/", { replace: true }); return; }
    (async () => {
      const pairSnap = await getDoc(doc(db, "pairs", pairId));
      if (!pairSnap.exists()) return;
      const members = pairSnap.data().members as string[];
      const names = await Promise.all(members.map((uid) => getDisplayName(uid)));
      const validNames = names.filter(Boolean) as string[];
      if (validNames.length > 0) {
        setPairNames(validNames.join(" & "));
      }
    })();
  }, [pairId, pairLoading, navigate]);

  const activeItems = items.filter((i) => i.status !== "done");
  const doneItems   = items.filter((i) => i.status === "done");
  const goItems     = activeItems.filter((i) => i.isWant);
  const goodItems   = activeItems.filter((i) => !i.isWant && (i.matchTier ?? "good") !== "try");
  const tryItems    = activeItems.filter((i) => !i.isWant && i.matchTier === "try");

  const filteredGood = filter === "all"
    ? goodItems
    : goodItems.filter((i: Item) => i.category === filter);

  const progress = items.length > 0 ? doneItems.length / items.length : 0;

  if (pairLoading || loading) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh",
                  background: "var(--color-bg)" }}>

      {/* ── ヘッダー ── */}
      <header style={{ flexShrink: 0, padding: "14px 20px 10px",
                       background: "var(--color-bg)", borderBottom: "1px solid rgba(0,0,0,0.07)",
                       position: "sticky", top: 0, zIndex: 20 }}>
        {/* 左: タイトル + ペア名 ／ 右: ロゴ + 完了数 */}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600,
                         color: "var(--color-text-main)", letterSpacing: "0.01em" }}>
              おでかけ
            </h1>
            {pairNames && (
              <p style={{ fontSize: 11, color: "var(--color-text-mid)", marginTop: 3,
                          fontFamily: "var(--font-sans)", letterSpacing: "0.04em" }}>
                {pairNames}
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <img src="/logo.png" alt="KataLog" style={{ height: 18, objectFit: "contain" }} />
            {items.length > 0 && (
              <p style={{ fontSize: 11, color: "var(--color-text-soft)",
                          fontFamily: "var(--font-sans)", margin: 0 }}>
                <span style={{ fontWeight: 600, color: "var(--color-primary)", fontSize: 12 }}>
                  {doneItems.length}
                </span>
                /{items.length} 完了
              </p>
            )}
          </div>
        </div>
        {/* 進捗バー */}
        {items.length > 0 && (
          <div style={{ height: 3, background: "rgba(0,0,0,0.08)",
                        borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
            <div style={{ width: `${progress * 100}%`, height: "100%",
                          background: "var(--color-primary)", borderRadius: 2,
                          transition: "width 0.4s ease" }} />
          </div>
        )}
      </header>

      {/* ── フィルター + 追加ボタン ── */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center",
                    background: "var(--color-bg)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <div data-guide="filter-area"
             style={{ flex: 1, padding: "4px 0 4px 12px", display: "flex", gap: 6,
                      overflowX: "auto", scrollbarWidth: "none" }}>
          {(["all", ...CATEGORIES] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
                    style={{ flexShrink: 0, fontSize: 11, padding: "5px 13px",
                             borderRadius: 20, whiteSpace: "nowrap",
                             fontFamily: "var(--font-sans)", cursor: "pointer",
                             border: filter === f ? "none" : "1px solid rgba(0,0,0,0.12)",
                             background: filter === f ? "var(--color-text-main)" : "transparent",
                             color: filter === f ? "var(--color-bg)" : "#5C4A35" }}>
              {f === "all" ? "すべて" : f === "おでかけ" ? "外出" : f}
            </button>
          ))}
        </div>
        <button data-guide="add-btn"
                onClick={() => setShowAddModal(true)}
                style={{ flexShrink: 0, padding: "0 16px 0 12px", height: "100%",
                         background: "none", border: "none", borderLeft: "1px solid rgba(0,0,0,0.1)",
                         cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-mid)",
                         fontFamily: "var(--font-sans)", lineHeight: 1 }}>
            追加
          </span>
          <span style={{ fontSize: 18, color: "var(--color-primary)", lineHeight: 1, fontWeight: 400 }}>+</span>
        </button>
      </div>

      {/* ── スクロールエリア ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 80 }}>

        {/* お気に入りセクション */}
        {goItems.length > 0 && (
          <div style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <SectionLabel>お気に入り</SectionLabel>
            <div style={{ padding: "0 20px 12px", display: "flex", gap: 10,
                          overflowX: "auto", scrollbarWidth: "none" }}>
              {goItems.map((item, i) => (
                <GoCard key={item.itemId} item={item} isFirst={i === 0}
                        onClick={() => navigateToDetail(item.itemId)}
                        onDone={() => setStatus(item.itemId, "done")}
                        onWant={() => toggleIsWant(item.itemId, item.isWant)}
                        onDelete={() => removeItem(item.itemId)} />
              ))}
            </div>
          </div>
        )}

        {/* おすすめセクション */}
        <div>
          {filteredGood.length > 0 ? (
            <>
              <SectionLabel>おすすめ</SectionLabel>
              <div style={{ padding: "0 20px 4px",
                            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {filteredGood.map((item) => (
                  <GoodCard key={item.itemId} item={item}
                            onTap={() => navigateToDetail(item.itemId)}
                            onWant={() => toggleIsWant(item.itemId, item.isWant)}
                            onDone={() => setStatus(item.itemId, "done")}
                            onDelete={() => removeItem(item.itemId)} />
                ))}
              </div>
            </>
          ) : (
            activeItems.length === 0 && (
              <EmptyState onAskAI={() => navigate("/suggest")} />
            )
          )}
          {filteredGood.length === 0 && goodItems.length > 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--color-text-soft)" }}>
                このカテゴリにはアイテムがありません
              </p>
            </div>
          )}
        </div>

        {/* 試してみる？セクション */}
        {tryItems.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <SectionLabel>試してみる？</SectionLabel>
            <div style={{ padding: "0 20px 4px",
                          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {tryItems.map((item) => (
                <GoodCard key={item.itemId} item={item}
                          onTap={() => navigateToDetail(item.itemId)}
                          onWant={() => toggleIsWant(item.itemId, item.isWant)}
                          onDone={() => setStatus(item.itemId, "done")}
                          onDelete={() => removeItem(item.itemId)} />
              ))}
            </div>
          </div>
        )}

        {/* 完了トグル */}
        {doneItems.length > 0 && (
          <>
            <button onClick={() => setDoneOpen((o) => !o)}
                    style={{ width: "100%", display: "flex", alignItems: "center",
                             padding: "12px 20px 8px", background: "var(--color-bg)", border: "none",
                             borderTop: "1px solid rgba(0,0,0,0.05)", cursor: "pointer",
                             position: "sticky", top: 0, zIndex: 10 }}>
              <span style={{ fontSize: 12, color: "var(--color-text-mid)",
                             fontFamily: "var(--font-sans)", fontWeight: 600, flex: 1, textAlign: "left" }}>
                {doneOpen ? `完了済み ${doneItems.length}件を閉じる ▲`
                          : `完了済み ${doneItems.length}件を開く ▼`}
              </span>
            </button>
            {doneOpen && (
              <div style={{ padding: "0 20px" }}>
                {doneItems.map((item) => (
                  <DoneRow key={item.itemId} item={item}
                           onTap={() => navigateToDetail(item.itemId)} />
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ height: 16 }} />
      </div>

      {/* ── ボトムナビ ── */}
      <BottomNav />

      {/* ── ホームガイド（初回のみ） ── */}
      {showGuide && !loading && items.length > 0 && (
        <HomeGuide onClose={() => {
          localStorage.setItem("homeGuideSeen", "1");
          setShowGuide(false);
        }} />
      )}

      {/* ── 手動追加モーダル ── */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                      display: "flex", alignItems: "flex-end", zIndex: 100 }}
             onClick={() => setShowAddModal(false)}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ width: "100%", background: "var(--color-bg)", borderRadius: "20px 20px 0 0",
                        padding: "24px 20px 48px", display: "flex", flexDirection: "column", gap: 16,
                        maxHeight: "90dvh", overflowY: "auto", scrollbarWidth: "none" }}>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 500,
                         color: "var(--color-text-main)", textAlign: "center" }}>
              リストに追加
            </h2>

            {/* タイトル */}
            <div>
              <ModalLabel>タイトル *</ModalLabel>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                     maxLength={60} placeholder="体験のタイトル"
                     style={{ width: "100%", padding: "10px 12px", borderRadius: 8, boxSizing: "border-box",
                              border: "1px solid var(--color-border)", fontSize: 14, outline: "none",
                              background: "var(--color-bg)", color: "var(--color-text-main)",
                              fontFamily: "var(--font-sans)" }} />
            </div>

            {/* カテゴリ */}
            <div>
              <ModalLabel>カテゴリ</ModalLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setNewCategory(cat)}
                          style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20,
                                   border: newCategory === cat ? "none" : "1px solid rgba(0,0,0,0.12)",
                                   background: newCategory === cat ? "var(--color-text-main)" : "transparent",
                                   color: newCategory === cat ? "var(--color-bg)" : "#5C4A35",
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    {CATEGORY_STYLE[cat]?.emoji} {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 場所 */}
            <div>
              <ModalLabel>場所</ModalLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {([["indoor", "🏠 室内"], ["outdoor", "🗺️ 屋外"]] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setNewType(val)}
                          style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 13,
                                   border: newType === val ? "none" : "1px solid rgba(0,0,0,0.12)",
                                   background: newType === val ? "var(--color-text-main)" : "transparent",
                                   color: newType === val ? "var(--color-bg)" : "#5C4A35",
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* 状態 */}
            <div>
              <ModalLabel>状態</ModalLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {([["todo", "⏳ 未完了"], ["done", "✅ 完了"]] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setNewStatus(val)}
                          style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 13,
                                   border: newStatus === val ? "none" : "1px solid rgba(0,0,0,0.12)",
                                   background: newStatus === val ? "var(--color-text-main)" : "transparent",
                                   color: newStatus === val ? "var(--color-bg)" : "#5C4A35",
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* 評価（完了時のみ有効） */}
            <div style={{ opacity: newStatus === "done" ? 1 : 0.35,
                          pointerEvents: newStatus === "done" ? "auto" : "none" }}>
              <ModalLabel>評価</ModalLabel>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setNewRating(newRating === star ? null : star)}
                          style={{ fontSize: 24, background: "none", border: "none", cursor: "pointer" }}>
                    {newRating != null && star <= newRating ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Maps URL */}
            <div>
              <ModalLabel>Google マップのURL（任意）</ModalLabel>
              <input value={newMapsUrl} onChange={(e) => setNewMapsUrl(e.target.value)}
                     placeholder="https://www.google.com/maps/place/..."
                     style={{ width: "100%", padding: "10px 12px", borderRadius: 8, boxSizing: "border-box",
                              border: "1px solid var(--color-border)", fontSize: 13, outline: "none",
                              background: "var(--color-bg)", color: "var(--color-text-main)",
                              fontFamily: "var(--font-sans)" }} />
            </div>

            {/* メモ */}
            <div>
              <ModalLabel>メモ（任意）</ModalLabel>
              <textarea value={newMemo} onChange={(e) => setNewMemo(e.target.value)}
                        maxLength={100} placeholder="メモを入力..."
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, boxSizing: "border-box",
                                 border: "1px solid var(--color-border)", fontSize: 13, outline: "none",
                                 background: "var(--color-bg)", color: "var(--color-text-main)",
                                 fontFamily: "var(--font-sans)", minHeight: 80, resize: "none" }} />
            </div>

            <button onClick={handleAddItem} disabled={!newTitle.trim() || addSaving}
                    style={{ padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 600,
                             border: "none", cursor: newTitle.trim() ? "pointer" : "default",
                             background: newTitle.trim() ? "var(--color-primary)" : "rgba(0,0,0,0.1)",
                             color: newTitle.trim() ? "#fff" : "var(--color-text-soft)",
                             fontFamily: "var(--font-sans)" }}>
              {addSaving ? "追加中..." : "リストに追加する"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── サブコンポーネント ───────────────────────────────────

const ModalLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-soft)",
              letterSpacing: "0.06em", marginBottom: 6, fontFamily: "var(--font-sans)" }}>
    {children}
  </p>
);

const SectionLabel = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ padding: "12px 20px 8px", fontSize: 12, letterSpacing: "0.08em",
              color: "var(--color-text-mid)", fontFamily: "var(--font-sans)", fontWeight: 600,
              position: "sticky", top: 0, zIndex: 10,
              background: "var(--color-bg)", ...style }}>
    {children}
  </p>
);

const GoCard = ({ item, onClick, onDone, onWant, onDelete, isFirst }:
  { item: Item; onClick: () => void; onDone: () => void; onWant: () => void; onDelete: () => void; isFirst?: boolean }) => {
  const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["その他"];
  const hasPhoto = !!item.placePhotoRef;
  return (
    // カード全体をボタンにしてタップ判定を全面に
    <button onClick={onClick}
            style={{ flexShrink: 0, width: 120, height: 150, borderRadius: 12, overflow: "hidden",
                     position: "relative", border: "none", padding: 0, cursor: "pointer" }}>
      {/* 背景：写真 or グラデーション */}
      {hasPhoto ? (
        <img src={photoUrl(item.placePhotoRef!)} alt={item.title} loading="lazy"
             style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                      objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: s.bg }} />
      )}
      {/* 絵文字（写真なしのみ） */}
      {!hasPhoto && (
        <div style={{ position: "absolute", inset: 0, display: "flex",
                      alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 40, opacity: 0.88,
                         filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))" }}>
            {s.emoji}
          </span>
        </div>
      )}
      {/* 暗幕オーバーレイ */}
      <div style={{ position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 40%, rgba(0,0,0,0.7) 100%)",
                    pointerEvents: "none" }} />
      {/* Google評価バッジ（左上） */}
      {item.placeRating != null && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.5)",
                      color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 20,
                      display: "flex", alignItems: "center", gap: 2, zIndex: 2 }}>
          <span style={{ color: "#F5C842" }}>★</span>{item.placeRating.toFixed(1)}
        </div>
      )}
      {/* ✓ 完了ボタン（右上） */}
      <button {...(isFirst ? { "data-guide": "done-btn" } : {})}
              onClick={(e) => { e.stopPropagation(); onDone(); }}
              style={{ position: "absolute", top: 7, right: 7.5, zIndex: 3,
                       width: 17, height: 17, borderRadius: "50%",
                       background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.5)",
                       display: "flex", alignItems: "center", justifyContent: "center",
                       cursor: "pointer" }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {/* × 削除ボタン（左下） */}
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{ position: "absolute", bottom: 9, left: 8, zIndex: 3,
                       background: "transparent", border: "none",
                       fontSize: 13, color: "rgba(255,255,255,0.55)", cursor: "pointer",
                       lineHeight: 1, padding: 0 }}>
        ×
      </button>
      {/* タイトル・カテゴリ（下部） */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
                    padding: "8px 28px 9px 10px", textAlign: "left" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.08em",
                      color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-sans)",
                      marginBottom: 3 }}>
          {item.category}
        </div>
        <p style={{ fontSize: 10, fontWeight: 500, color: "#fff", lineHeight: 1.35,
                    fontFamily: "var(--font-sans)", margin: 0,
                    display: "-webkit-box", WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.title}
        </p>
      </div>
      {/* ❤️ お気に入り（右下） */}
      <button {...(isFirst ? { "data-guide": "heart-btn" } : {})}
              onClick={(e) => { e.stopPropagation(); onWant(); }}
              style={{ position: "absolute", bottom: 11, right: 8, zIndex: 3,
                       background: "transparent", border: "none",
                       fontSize: 13, cursor: "pointer", lineHeight: 1 }}>
        {item.isWant ? "❤️" : "🤍"}
      </button>
    </button>
  );
};

const GoodCard = ({ item, onTap, onWant, onDone, onDelete }:
  { item: Item; onTap: () => void; onWant: () => void; onDone: () => void; onDelete: () => void }) => {
  const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["その他"];
  const hasPhoto = !!item.placePhotoRef;
  return (
    // カード全体をボタンにしてタップ判定を全面に
    <button onClick={onTap}
            style={{ position: "relative", borderRadius: 12, overflow: "hidden", height: 130,
                     border: "none", padding: 0, cursor: "pointer", width: "100%" }}>
      {/* 背景：写真 or グラデーション */}
      {hasPhoto ? (
        <img src={photoUrl(item.placePhotoRef!)} alt={item.title} loading="lazy"
             style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                      objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: s.bg }} />
      )}
      {/* 絵文字（写真なしのみ） */}
      {!hasPhoto && (
        <div style={{ position: "absolute", inset: 0, display: "flex",
                      alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 36, opacity: 0.75,
                         filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>
            {s.emoji}
          </span>
        </div>
      )}
      {/* 暗幕オーバーレイ */}
      <div style={{ position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, transparent 40%, rgba(0,0,0,0.7) 100%)",
                    pointerEvents: "none" }} />
      {/* ✓ 完了ボタン（右上） */}
      <button onClick={(e) => { e.stopPropagation(); onDone(); }}
              style={{ position: "absolute", top: 7, right: 7.5, zIndex: 2,
                       width: 17, height: 17, borderRadius: "50%",
                       background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.5)",
                       display: "flex", alignItems: "center", justifyContent: "center",
                       cursor: "pointer" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {/* × 削除ボタン（左下） */}
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{ position: "absolute", bottom: 9, left: 8, zIndex: 3,
                       background: "transparent", border: "none",
                       fontSize: 13, color: "rgba(255,255,255,0.55)", cursor: "pointer",
                       lineHeight: 1, padding: 0 }}>
        ×
      </button>
      {/* Google評価バッジ（左上、写真ありかつGoCardの評価なし場合のみ） */}
      {item.placeRating != null && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.5)",
                      color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 20,
                      display: "flex", alignItems: "center", gap: 2, zIndex: 2 }}>
          <span style={{ color: "#F5C842" }}>★</span>{item.placeRating.toFixed(1)}
        </div>
      )}
      {/* タイトル（下部） */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
                    padding: "8px 28px 9px 10px", textAlign: "left" }}>
        <p style={{ fontSize: 10, fontWeight: 500, color: "#fff", lineHeight: 1.35,
                    fontFamily: "var(--font-sans)", margin: 0,
                    display: "-webkit-box", WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.title}
        </p>
      </div>
      {/* ❤️ お気に入り（右下） */}
      <button onClick={(e) => { e.stopPropagation(); onWant(); }}
              style={{ position: "absolute", bottom: 10, right: 8, zIndex: 3,
                       background: "transparent", border: "none",
                       fontSize: 13, cursor: "pointer", lineHeight: 1 }}>
        {item.isWant ? "❤️" : "🤍"}
      </button>
    </button>
  );
};

const EmptyState = ({ onAskAI }: { onAskAI: () => void }) => (
  <div style={{ padding: "48px 32px", textAlign: "center" }}>
    <p style={{ fontSize: 36, marginBottom: 16 }}>✨</p>
    <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-main)",
                marginBottom: 8, lineHeight: 1.5, fontFamily: "var(--font-sans)" }}>
      やりたいことが全部完了しました！
    </p>
    <p style={{ fontSize: 13, color: "var(--color-text-mid)", marginBottom: 24, lineHeight: 1.6,
                fontFamily: "var(--font-sans)" }}>
      AIにもう一度、ふたりにぴったりの体験を提案してもらいましょう。
    </p>
    <button onClick={onAskAI}
            style={{ padding: "12px 28px", background: "var(--color-primary)",
                     color: "#fff", border: "none", borderRadius: 24,
                     fontSize: 13, fontWeight: 500, letterSpacing: "0.04em",
                     fontFamily: "var(--font-sans)", cursor: "pointer" }}>
      ✦ AIに再提案してもらう
    </button>
  </div>
);

const DoneRow = ({ item, onTap }: { item: Item; onTap: () => void }) => {
  const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["その他"];
  return (
    <button onClick={onTap}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
                     padding: "11px 0", borderBottom: "1px solid rgba(0,0,0,0.06)",
                     background: "transparent", border: "none", cursor: "pointer", opacity: 0.55 }}>
      <div style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                    overflow: "hidden", position: "relative",
                    background: s.bg, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 20 }}>
        {item.placePhotoRef ? (
          <img src={photoUrl(item.placePhotoRef)} alt={item.title} loading="lazy"
               style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          s.emoji
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-main)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    textDecoration: "line-through", fontFamily: "var(--font-sans)" }}>
          {item.title}
        </p>
        <p style={{ fontSize: 10, color: "var(--color-text-mid)", marginTop: 2,
                    fontFamily: "var(--font-sans)" }}>
          {item.category}{item.rating != null && ` · ${"⭐".repeat(item.rating)}`}
        </p>
      </div>
    </button>
  );
};

