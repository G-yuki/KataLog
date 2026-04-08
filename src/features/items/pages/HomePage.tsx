// src/features/items/pages/HomePage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { useItems } from "../hooks/useItems";
import { Loading } from "../../../components/Loading";
import { getUserPairId, getDisplayName } from "../../pair/services/pairService";
import { db } from "../../../firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import type { Item, Category } from "../../../types";

type Filter = "all" | Category;

const CATEGORY_STYLE: Record<string, { bg: string; emoji: string }> = {
  映画:     { bg: "linear-gradient(135deg, #2A3A5C, #0D1428)", emoji: "🎬" },
  本:       { bg: "linear-gradient(135deg, #3D2B14, #1E1408)", emoji: "📚" },
  ゲーム:   { bg: "linear-gradient(135deg, #2A1840, #110A1E)", emoji: "🎮" },
  音楽:     { bg: "linear-gradient(135deg, #0E2828, #061414)", emoji: "🎧" },
  おでかけ: { bg: "linear-gradient(135deg, #2A4A3A, #152A20)", emoji: "🗺️" },
  食事:     { bg: "linear-gradient(135deg, #5C2A1A, #3A1410)", emoji: "🍽️" },
  スポーツ: { bg: "linear-gradient(135deg, #1A3A5C, #0D1E3A)", emoji: "🏃" },
  その他:   { bg: "linear-gradient(135deg, #3A3A2A, #1E1E14)", emoji: "✨" },
};

const CATEGORIES: Category[] = ["おでかけ", "映画", "食事", "本", "ゲーム", "音楽", "スポーツ", "その他"];

export const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pairId, setPairId] = useState<string | null>(null);
  const [pairLoading, setPairLoading] = useState(true);
  const [pairNames, setPairNames] = useState("");
  const { items, loading, setStatus, toggleIsWant } = useItems(pairId);

  const [filter, setFilter] = useState<Filter>("all");
  const [doneOpen, setDoneOpen] = useState(false);
  const [tryOpen, setTryOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const id = await getUserPairId(user.uid);
      if (!id) { navigate("/", { replace: true }); return; }
      setPairId(id);
      setPairLoading(false);

      const pairSnap = await getDoc(doc(db, "pairs", id));
      if (!pairSnap.exists()) return;
      const members = pairSnap.data().members as string[];
      const names = await Promise.all(members.map((uid) => getDisplayName(uid)));
      const validNames = names.filter(Boolean) as string[];
      if (validNames.length >= 2) {
        setPairNames(`${validNames[0]} & ${validNames[1]}`);
      }
    })();
  }, [user, navigate]);

  const activeItems = items.filter((i) => i.status !== "done");
  const doneItems   = items.filter((i) => i.status === "done");
  const goItems     = activeItems.filter((i) => i.isWant);
  // matchTier未設定（旧データ）は "good" 扱い
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
      <header style={{ flexShrink: 0, padding: "30px 20px 12px",
                       background: "var(--color-bg)", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500,
                       color: "var(--color-text-main)", letterSpacing: "0.02em", lineHeight: 1 }}>
            Kata<span style={{ color: "var(--color-primary)" }}>Log</span>
          </h1>
          {pairNames && (
            <p style={{ fontSize: 10, color: "var(--color-text-soft)",
                        letterSpacing: "0.06em", marginTop: 4 }}>
              {pairNames}
            </p>
          )}
        </div>
        {items.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, height: 3, background: "rgba(0,0,0,0.1)",
                          borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${progress * 100}%`, height: "100%",
                            background: "var(--color-primary)", borderRadius: 2,
                            transition: "width 0.4s ease" }} />
            </div>
            <p style={{ fontSize: 11, color: "var(--color-text-mid)", whiteSpace: "nowrap" }}>
              {doneItems.length} / {items.length} 完了
            </p>
          </div>
        )}
      </header>

      {/* ── フィルター（常時表示） ── */}
      <div style={{ flexShrink: 0, padding: "10px 20px 8px", display: "flex", gap: 6,
                    overflowX: "auto", scrollbarWidth: "none",
                    background: "var(--color-bg)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        {(["all", ...CATEGORIES] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
                  style={{ flexShrink: 0, fontSize: 11, padding: "5px 13px",
                           borderRadius: 20, whiteSpace: "nowrap",
                           fontFamily: "var(--font-sans)", cursor: "pointer",
                           border: filter === f ? "none" : "1px solid rgba(0,0,0,0.12)",
                           background: filter === f ? "var(--color-text-main)" : "transparent",
                           color: filter === f ? "var(--color-bg)" : "#5C4A35" }}>
            {f === "all" ? "すべて" : f}
          </button>
        ))}
      </div>

      {/* ── スクロールエリア ── */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>

        {/* Go!! セクション */}
        {goItems.length > 0 && (
          <div style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <SectionLabel>Go!! — 最優先リスト</SectionLabel>
            <div style={{ padding: "0 20px 12px", display: "flex", gap: 10,
                          overflowX: "auto", scrollbarWidth: "none" }}>
              {goItems.map((item) => (
                <GoCard key={item.itemId} item={item}
                        onClick={() => navigate(`/home/${item.itemId}`)}
                        onDone={() => setStatus(item.itemId, "done")}
                        onWant={() => toggleIsWant(item.itemId, item.isWant)} />
              ))}
            </div>
          </div>
        )}

        {/* Good カードグリッド */}
        {filteredGood.length > 0 ? (
          <>
            <SectionLabel style={{ paddingTop: 10 }}>Good — やりたいリスト</SectionLabel>
            <div style={{ padding: "0 20px 4px",
                          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {filteredGood.map((item) => (
                <GoodCard key={item.itemId} item={item}
                          onTap={() => navigate(`/home/${item.itemId}`)}
                          onWant={() => toggleIsWant(item.itemId, item.isWant)}
                          onDone={() => setStatus(item.itemId, "done")} />
              ))}
            </div>
          </>
        ) : (
          activeItems.length === 0 && (
            <EmptyState onAskAI={() => navigate("/suggest")} />
          )
        )}

        {/* カテゴリフィルターで絞った結果が0件かつ全体には残りがある場合 */}
        {filteredGood.length === 0 && goodItems.length > 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--color-text-soft)" }}>
              このカテゴリにはアイテムがありません
            </p>
          </div>
        )}

        {/* Try? トグル（片方がPassしたアイテム） */}
        {tryItems.length > 0 && (
          <>
            <button onClick={() => setTryOpen((o) => !o)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                             padding: "14px 20px", background: "transparent", border: "none",
                             borderTop: "1px solid rgba(0,0,0,0.06)", cursor: "pointer" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
              <span style={{ fontSize: 11, color: "var(--color-text-mid)",
                             letterSpacing: "0.06em", whiteSpace: "nowrap",
                             fontFamily: "var(--font-sans)" }}>
                {tryOpen ? `Try? ${tryItems.length}件を隠す`
                         : `Try? — 試してみる？ ${tryItems.length}件`}
              </span>
              <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
            </button>
            {tryOpen && (
              <div style={{ padding: "0 20px 4px",
                            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {tryItems.map((item) => (
                  <GoodCard key={item.itemId} item={item}
                            onTap={() => navigate(`/home/${item.itemId}`)}
                            onWant={() => toggleIsWant(item.itemId, item.isWant)}
                            onDone={() => setStatus(item.itemId, "done")} />
                ))}
              </div>
            )}
          </>
        )}

        {/* 完了トグル */}
        {doneItems.length > 0 && (
          <>
            <button onClick={() => setDoneOpen((o) => !o)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                             padding: "14px 20px", background: "transparent", border: "none",
                             borderTop: "1px solid rgba(0,0,0,0.06)", cursor: "pointer" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
              <span style={{ fontSize: 11, color: "var(--color-text-mid)",
                             letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                {doneOpen ? `完了済み ${doneItems.length}件を隠す`
                          : `完了済み ${doneItems.length}件を見る ✨`}
              </span>
              <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
            </button>
            {doneOpen && (
              <div style={{ padding: "0 20px" }}>
                {doneItems.map((item) => (
                  <DoneRow key={item.itemId} item={item}
                           onTap={() => navigate(`/home/${item.itemId}`)} />
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ height: 16 }} />
      </div>

      {/* ── ボトムナビ ── */}
      <nav style={{ flexShrink: 0, background: "var(--color-bg)",
                    borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", padding: "10px 0 6px" }}>
          {NAV_ITEMS.map(({ path, label, icon }) => {
            const active = location.pathname === path;
            return (
              <button key={path} onClick={() => navigate(path)}
                      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                               gap: 3, background: "transparent", border: "none", cursor: "pointer",
                               color: active ? "var(--color-text-main)" : "var(--color-text-mid)" }}>
                {icon}
                {active && <div style={{ width: 4, height: 4, borderRadius: "50%",
                                         background: "var(--color-primary)" }} />}
                <span style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
                               fontWeight: active ? 500 : 400, fontFamily: "var(--font-sans)" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <p style={{ textAlign: "center", fontSize: 9, letterSpacing: "0.12em",
                    color: "var(--color-text-soft)", paddingBottom: 16,
                    fontFamily: "var(--font-serif)" }}>
          思い出を、かたちに。/ Your Life, Engraved.
        </p>
      </nav>
    </div>
  );
};

// ── サブコンポーネント ───────────────────────────────────

const SectionLabel = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ padding: "16px 20px 10px", fontSize: 10, letterSpacing: "0.14em",
              color: "var(--color-text-mid)", textTransform: "uppercase",
              fontFamily: "var(--font-sans)", ...style }}>
    {children}
  </p>
);

const GoCard = ({ item, onClick, onDone, onWant }:
  { item: Item; onClick: () => void; onDone: () => void; onWant: () => void }) => {
  const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["その他"];
  return (
    <div style={{ flexShrink: 0, width: 120, height: 150, borderRadius: 12, overflow: "hidden",
                  position: "relative" }}>
      {/* 背景 */}
      <div style={{ position: "absolute", inset: 0, background: s.bg }} />
      {/* 絵文字 */}
      <div style={{ position: "absolute", inset: 0, display: "flex",
                    alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 40, opacity: 0.88,
                       filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))" }}>
          {s.emoji}
        </span>
      </div>
      {/* 評価バッジ（左上） */}
      {item.rating != null && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.5)",
                      color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 20,
                      display: "flex", alignItems: "center", gap: 2, zIndex: 2 }}>
          <span style={{ color: "#F5C842" }}>★</span>{item.rating}
        </div>
      )}
      {/* ✓ 完了ボタン（右上） */}
      <button onClick={(e) => { e.stopPropagation(); onDone(); }}
              style={{ position: "absolute", top: 7, right: 7.5, zIndex: 2,
                       width: 17, height: 17, borderRadius: "50%",
                       background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.5)",
                       display: "flex", alignItems: "center", justifyContent: "center",
                       cursor: "pointer" }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {/* 下部グラデーション */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 55,
                    background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
                    pointerEvents: "none" }} />
      {/* カード本体タップ */}
      <button onClick={onClick}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
                       padding: "8px 28px 9px 10px", background: "none", border: "none",
                       cursor: "pointer", textAlign: "left" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.08em",
                      color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-sans)",
                      marginBottom: 3 }}>
          {item.category}
        </div>
        <p style={{ fontSize: 10, width: "95%", fontWeight: 500, color: "#fff", lineHeight: 1.35,
                    fontFamily: "var(--font-sans)",
                    display: "-webkit-box", WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.title}
        </p>
      </button>
      {/* ❤️ お気に入り解除（右 ✓ の下） */}
      <button onClick={(e) => { e.stopPropagation(); onWant(); }}
              style={{ position: "absolute", bottom: 11, right: 8, zIndex: 2,
                       background: "transparent", border: "none",
                       fontSize: 13, cursor: "pointer", lineHeight: 1 }}>
        {item.isWant ? "❤️" : "🤍"}
      </button>
    </div>
  );
};

const GoodCard = ({ item, onTap, onWant, onDone }:
  { item: Item; onTap: () => void; onWant: () => void; onDone: () => void }) => {
  const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["その他"];
  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", height: 130 }}>
      {/* 背景グラデーション */}
      <div style={{ position: "absolute", inset: 0, background: s.bg }} />
      {/* 絵文字 */}
      <div style={{ position: "absolute", inset: 0, display: "flex",
                    alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 36, opacity: 0.75,
                       filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>
          {s.emoji}
        </span>
      </div>
      {/* 下部グラデーションオーバーレイ（全幅・角丸対応） */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 64,
                    background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
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
      {/* タイトルタップ領域 */}
      <button onClick={onTap}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
                       padding: "8px 10px 9px 10px", background: "none", border: "none",
                       cursor: "pointer", textAlign: "left" }}>
        <p style={{ fontSize: 10, width: "85%", fontWeight: 500, color: "#fff", lineHeight: 1.35,
                    fontFamily: "var(--font-sans)",
                    display: "-webkit-box", WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.title}
        </p>
      </button>
      {/* ❤️ お気に入り（DOM最後 + zIndex:3 でタイトルの上に出る） */}
      <button onClick={(e) => { e.stopPropagation(); onWant(); }}
              style={{ position: "absolute", bottom: 10, right: 8, zIndex: 3,
                       background: "transparent", border: "none",
                       fontSize: 13, cursor: "pointer", lineHeight: 1 }}>
        {item.isWant ? "❤️" : "🤍"}
      </button>
    </div>
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
                    background: s.bg, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 20 }}>
        {s.emoji}
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

const NAV_ITEMS = [
  {
    path: "/home", label: "List",
    icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="10" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="12" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>,
  },
  {
    path: "/suggest", label: "Ask AI",
    icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      {/* 大きい4点スター（中央） */}
      <path d="M10 2L11.4 8.6L18 10L11.4 11.4L10 18L8.6 11.4L2 10L8.6 8.6Z"
            fill="currentColor"/>
      {/* 中4点スター（右上） */}
      <path d="M17.5 1L18.3 3.7L21 4.5L18.3 5.3L17.5 8L16.7 5.3L14 4.5L16.7 3.7Z"
            fill="currentColor"/>
      {/* 小4点スター（左下） */}
      <path d="M4.5 15L5 16.5L6.5 17L5 17.5L4.5 19L4 17.5L2.5 17L4 16.5Z"
            fill="currentColor"/>
    </svg>,
  },
  {
    path: "/memory", label: "Memory",
    icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 15V8a7 7 0 0114 0v7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="2" y="14" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="16" y="14" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>,
  },
  {
    path: "/settings", label: "Settings",
    icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 19c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>,
  },
];
