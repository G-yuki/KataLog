// src/features/items/pages/HomePage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "../../auth/hooks/useAuth";
import { useItems } from "../hooks/useItems";
import { Loading } from "../../../components/Loading";
import { getUserPairId } from "../../pair/services/pairService";
import type { Item, Category } from "../../../types";
import { CATEGORIES } from "../../../lib/constants";

type Filter = "all" | "want" | Category;

export const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pairId, setPairId] = useState<string | null>(null);
  const [pairLoading, setPairLoading] = useState(true);
  const { items, loading, setStatus, toggleIsWant, reorder } = useItems(pairId);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);
  const [localIds, setLocalIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    getUserPairId(user.uid).then((id) => {
      if (!id) navigate("/", { replace: true });
      else setPairId(id);
      setPairLoading(false);
    });
  }, [user, navigate]);

  // ローカルの並び順を items の変化に追随させる
  useEffect(() => {
    setLocalIds(
      items
        .filter((i) => i.status !== "done")
        .map((i) => i.itemId)
    );
  }, [items]);

  // 長押し 250ms で DnD 開始
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localIds.indexOf(active.id as string);
    const newIndex = localIds.indexOf(over.id as string);
    const newIds = arrayMove(localIds, oldIndex, newIndex);
    setLocalIds(newIds);
    reorder(newIds);
  };

  // フィルタ・検索
  const activeItems = items.filter((i) => i.status !== "done");
  const doneItems = items.filter((i) => i.status === "done");

  const applyFilter = (list: Item[]) => {
    let result = list;
    if (filter === "want") result = result.filter((i) => i.isWant);
    else if (filter !== "all") result = result.filter((i) => i.category === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }
    return result;
  };

  // localIds の順序で activeItems を並べる
  const sortedActive = localIds
    .map((id) => activeItems.find((i) => i.itemId === id))
    .filter(Boolean) as Item[];

  const filteredActive = applyFilter(sortedActive);
  const filteredDone = applyFilter(doneItems);

  if (pairLoading || loading) return <Loading />;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 px-4 pt-10 pb-3"
              style={{ background: "var(--color-bg)" }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-main)" }}>
            ✈️ Lifrave
          </h1>
          <button
            className="text-sm font-bold px-3 py-1 rounded-full"
            style={{ background: "var(--color-primary)", color: "white" }}
            onClick={() => navigate("/suggest")}
          >
            今日どうする？
          </button>
        </div>

        {/* 検索 */}
        <input
          type="text"
          placeholder="リストを検索..."
          className="w-full rounded-2xl px-4 py-2.5 text-sm outline-none border-2"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-main)" }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* フィルタ */}
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
          {(["all", "want", ...CATEGORIES] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
              style={{
                background: filter === f ? "var(--color-primary)" : "var(--color-surface)",
                color: filter === f ? "white" : "var(--color-text-mid)",
                border: `1.5px solid ${filter === f ? "var(--color-primary)" : "var(--color-border)"}`,
              }}
            >
              {f === "all" ? "すべて" : f === "want" ? "★ やりたい" : f}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 pb-24">
        {/* アクティブなアイテム */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2 mt-2">
              {filteredActive.length === 0 ? (
                <p className="text-center py-12 text-sm" style={{ color: "var(--color-text-soft)" }}>
                  {search || filter !== "all" ? "条件に合うアイテムがありません" : "リストが空です"}
                </p>
              ) : (
                filteredActive.map((item) => (
                  <SortableItem
                    key={item.itemId}
                    item={item}
                    onCheck={() => setStatus(item.itemId, "done")}
                    onWant={() => toggleIsWant(item.itemId, item.isWant)}
                    onTap={() => navigate(`/home/${item.itemId}`)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>

        {/* 完了済み */}
        {filteredDone.length > 0 && (
          <div className="mt-4">
            <button
              className="flex items-center gap-2 text-sm font-bold py-2"
              style={{ color: "var(--color-text-mid)" }}
              onClick={() => setDoneOpen((o) => !o)}
            >
              <span>{doneOpen ? "▼" : "▶"}</span>
              完了済み（{filteredDone.length}件）
            </button>
            {doneOpen && (
              <div className="flex flex-col gap-2 mt-1">
                {filteredDone.map((item) => (
                  <SortableItem
                    key={item.itemId}
                    item={item}
                    onCheck={() => setStatus(item.itemId, "todo")}
                    onWant={() => toggleIsWant(item.itemId, item.isWant)}
                    onTap={() => navigate(`/home/${item.itemId}`)}
                    done
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ボトムナビ */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around items-center py-3 px-4"
           style={{ background: "var(--color-surface)", borderTop: `1px solid var(--color-border)` }}>
        <NavBtn icon="🏠" label="リスト" active onClick={() => {}} />
        <NavBtn icon="🎯" label="提案" onClick={() => navigate("/suggest")} />
        <NavBtn icon="📸" label="思い出" onClick={() => navigate("/memory")} />
        <NavBtn icon="⚙️" label="設定" onClick={() => navigate("/settings")} />
      </nav>
    </div>
  );
};

// ── ソータブルアイテム ────────────────────────────────────
const SortableItem = ({
  item, onCheck, onWant, onTap, done = false,
}: {
  item: Item;
  onCheck: () => void;
  onWant: () => void;
  onTap: () => void;
  done?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.itemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}
         className="card flex items-center gap-3 px-4 py-3">
      {/* 完了チェック */}
      <button
        onClick={onCheck}
        className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
        style={{
          borderColor: done ? "var(--color-done)" : "var(--color-border)",
          background: done ? "var(--color-done)" : "transparent",
        }}
      >
        {done && <span className="text-white text-xs">✓</span>}
      </button>

      {/* タイトル・カテゴリ */}
      <button className="flex-1 text-left min-w-0" onClick={onTap}>
        <p className={`text-sm font-bold truncate ${done ? "line-through" : ""}`}
           style={{ color: done ? "var(--color-text-soft)" : "var(--color-text-main)" }}>
          {item.title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-soft)" }}>
          {item.category}
          {item.rating != null && ` · ${"⭐".repeat(item.rating)}`}
        </p>
      </button>

      {/* ★ やりたい */}
      <button onClick={onWant} className="flex-shrink-0 text-lg">
        {item.isWant ? "⭐" : "☆"}
      </button>

      {/* ドラッグハンドル（長押し） */}
      {!done && (
        <span {...listeners} className="flex-shrink-0 cursor-grab px-1 text-lg"
              style={{ color: "var(--color-text-soft)", touchAction: "none" }}>
          ⠿
        </span>
      )}
    </div>
  );
};

// ── ボトムナビボタン ─────────────────────────────────────
const NavBtn = ({ icon, label, active, onClick }: {
  icon: string; label: string; active?: boolean; onClick: () => void;
}) => (
  <button onClick={onClick} className="flex flex-col items-center gap-0.5">
    <span className="text-xl">{icon}</span>
    <span className="text-xs font-bold"
          style={{ color: active ? "var(--color-primary)" : "var(--color-text-soft)" }}>
      {label}
    </span>
  </button>
);
