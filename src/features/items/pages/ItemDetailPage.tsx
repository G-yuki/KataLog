// src/features/items/pages/ItemDetailPage.tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { useItems } from "../hooks/useItems";
import { Loading } from "../../../components/Loading";
import { getUserPairId } from "../../pair/services/pairService";
import type { Item } from "../../../types";

export const ItemDetailPage = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pairId, setPairId] = useState<string | null>(null);
  const { items, loading, setStatus, toggleIsWant, saveDetail, removeItem } = useItems(pairId);

  const [memo, setMemo] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [memoChanged, setMemoChanged] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserPairId(user.uid).then((id) => {
      if (!id) navigate("/", { replace: true });
      else setPairId(id);
    });
  }, [user, navigate]);

  const item: Item | undefined = items.find((i) => i.itemId === itemId);

  useEffect(() => {
    if (!item) return;
    setMemo(item.memo ?? "");
    setRating(item.rating ?? null);
  }, [item]);

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
    navigate("/home", { replace: true });
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
         style={{ background: "var(--color-bg)" }}>
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/home")}
                className="text-xl" style={{ color: "var(--color-text-mid)" }}>
          ←
        </button>
        <h2 className="text-lg font-bold flex-1 truncate"
            style={{ color: "var(--color-text-main)" }}>
          {item.title}
        </h2>
        <button onClick={() => toggleIsWant(item.itemId, item.isWant)}
                className="text-2xl">
          {item.isWant ? "⭐" : "☆"}
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
              {isDone ? "✅ 完了！" : "やった？"}
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
          style={{ background: "var(--color-bg)", color: "var(--color-text-main)", minHeight: 80 }}
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
