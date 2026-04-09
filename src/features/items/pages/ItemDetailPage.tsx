// src/features/items/pages/ItemDetailPage.tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useItems } from "../hooks/useItems";
import { Loading } from "../../../components/Loading";
import { usePair } from "../../../contexts/PairContext";
import type { Item } from "../../../types";

export const ItemDetailPage = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from ?? "/home";
  const { pairId, loading: pairLoading } = usePair();
  const { items, loading, setStatus, toggleIsWant, saveDetail, removeItem } = useItems(pairId);

  const [memo, setMemo] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [memoChanged, setMemoChanged] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    if (!pairLoading && !pairId) navigate("/", { replace: true });
  }, [pairId, pairLoading, navigate]);

  const item: Item | undefined = items.find((i) => i.itemId === itemId);

  useEffect(() => {
    if (!item) return;
    setMemo(item.memo ?? "");
    setRating(item.rating ?? null);
  }, [item]);

  const handleTitleEdit = () => {
    if (!item) return;
    setTitleDraft(item.title);
    setEditingTitle(true);
  };

  const handleTitleSave = async () => {
    if (!item) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== item.title) {
      await saveDetail(item.itemId, { title: trimmed });
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleTitleSave();
    if (e.key === "Escape") setEditingTitle(false);
  };

  const handleSaveMemo = async () => {
    if (!item) return;
    setSaving(true);
    await saveDetail(item.itemId, { memo: memo.trim() || null });
    setSaving(false);
    setMemoChanged(false);
  };

  const handleRating = async (star: number) => {
    if (!item) return;
    const newRating = rating === star ? null : star;
    setRating(newRating);
    await saveDetail(item.itemId, { rating: newRating });
  };

  const handleDelete = async () => {
    if (!item || !window.confirm("このアイテムを削除しますか？")) return;
    await removeItem(item.itemId);
    navigate(backTo, { replace: true });
  };

  if (loading || !pairId) return <Loading />;
  if (!item) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p style={{ color: "var(--color-text-soft)" }}>アイテムが見つかりません</p>
      <button className="btn-ghost" onClick={() => navigate("/home")}>戻る</button>
    </div>
  );

  const isDone = item.status === "done";

  return (
    <div className="flex flex-col min-h-screen px-4 pt-10 pb-8"
         style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(backTo)}
                style={{ background: "none", border: "none", cursor: "pointer",
                         padding: "4px 8px 4px 0", color: "var(--color-text-mid)" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            maxLength={60}
            style={{ flex: 1, fontSize: 17, fontWeight: 700, fontFamily: "var(--font-sans)",
                     color: "var(--color-text-main)", background: "transparent",
                     border: "none", borderBottom: "1.5px solid var(--color-primary)",
                     outline: "none", padding: "2px 0" }}
          />
        ) : (
          <button onClick={handleTitleEdit}
                  style={{ flex: 1, textAlign: "left", background: "transparent",
                           border: "none", cursor: "pointer", display: "flex",
                           alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-sans)",
                           color: "var(--color-text-main)", overflow: "hidden",
                           textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.title}
            </span>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
              <path d="M9 2l2 2L4 11H2V9L9 2Z" stroke="var(--color-text-soft)"
                    strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <button onClick={() => toggleIsWant(item.itemId, item.isWant)}
                title={item.isWant ? "お気に入り解除" : "お気に入り登録"}
                className="text-2xl">
          {item.isWant ? "❤️" : "🤍"}
        </button>
      </div>

      {/* カテゴリ・タグ */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Tag label={item.category} />
        <Tag label={item.difficulty === "easy" ? "気軽" : "特別"} />
        <Tag label={item.type === "outdoor" ? "屋外" : "屋内"} />
      </div>

      {/* 完了チェック */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--color-text-main)" }}>
              {isDone ? "✅ 完了！" : "⏳ 未完了"}
            </p>
            {isDone && item.completedAt && (
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-soft)" }}>
                {(item.completedAt as { toDate: () => Date }).toDate().toLocaleDateString("ja-JP")}
              </p>
            )}
          </div>
          <button
            onClick={() => setStatus(item.itemId, isDone ? "todo" : "done")}
            className="px-4 py-2 rounded-full font-bold text-sm"
            style={{
              background: isDone ? "var(--color-border)" : "var(--color-primary)",
              color: isDone ? "var(--color-text-mid)" : "white",
            }}
          >
            {isDone ? "取り消す" : "完了にする"}
          </button>
        </div>
      </div>

      {/* 評価 */}
      {isDone && (
        <div className="card p-4 mb-4">
          <p className="text-sm font-bold mb-2" style={{ color: "var(--color-text-main)" }}>
            評価
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => handleRating(star)} className="text-2xl">
                {rating != null && star <= rating ? "⭐" : "☆"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* メモ */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold" style={{ color: "var(--color-text-main)" }}>メモ</p>
          <span className="text-xs" style={{ color: "var(--color-text-soft)" }}>
            {memo.length} / 100
          </span>
        </div>
        <textarea
          className="w-full text-sm outline-none resize-none rounded-xl p-2"
          style={{ background: "var(--color-bg)", color: "var(--color-text-main)", minHeight: 160 }}
          placeholder="感想やメモを残そう..."
          maxLength={100}
          value={memo}
          onChange={(e) => { setMemo(e.target.value); setMemoChanged(true); }}
        />
        {memoChanged && (
          <button
            className="btn-primary mt-2"
            onClick={handleSaveMemo}
            disabled={saving}
          >
            {saving ? "保存中..." : "メモを保存"}
          </button>
        )}
      </div>

      {/* 削除 */}
      <button
        onClick={handleDelete}
        className="text-sm text-center mt-4"
        style={{ color: "var(--color-text-soft)" }}
      >
        このアイテムを削除する
      </button>
    </div>
  );
};

const Tag = ({ label }: { label: string }) => (
  <span className="text-xs font-bold px-3 py-1 rounded-full"
        style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
    {label}
  </span>
);
