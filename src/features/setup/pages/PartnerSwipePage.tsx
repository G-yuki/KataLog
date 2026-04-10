// src/features/setup/pages/PartnerSwipePage.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { Loading } from "../../../components/Loading";
import { getUserPairId } from "../../pair/services/pairService";
import {
  subscribePendingItems,
  savePartnerSwipes,
  markSwipesDoneAndCheck,
  finalizePairMatching,
} from "../../items/services/itemService";
import { SwipeTutorial } from "../components/SwipeTutorial";
import { db } from "../../../firebase/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import type { PendingItem, SwipeAction } from "../../../types";
import { OUTDOOR_CATEGORIES } from "../../../lib/constants";

export const PartnerSwipePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pairId, setPairId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ pendingItemId: string; action: SwipeAction }[]>([]);
  const [initLoading, setInitLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [waitingPartner, setWaitingPartner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserPairId(user.uid).then((id) => {
      if (!id) navigate("/", { replace: true });
      else setPairId(id);
    });
  }, [user, navigate]);

  useEffect(() => {
    if (!pairId) return;
    const unsub = subscribePendingItems(pairId, (items) => {
      if (items.length > 0) {
        setPendingItems(items);
        setInitLoading(false);
        unsub();
      }
    });
    return () => unsub();
  }, [pairId]);

  // 待機中: matchingFinalized を監視 → 完了したら /home へ
  useEffect(() => {
    if (!waitingPartner || !pairId) return;
    const unsub = onSnapshot(doc(db, "pairs", pairId), (snap) => {
      if (snap.data()?.matchingFinalized) {
        navigate("/home", { replace: true });
      }
    });
    return () => unsub();
  }, [waitingPartner, pairId, navigate]);

  const current = pendingItems[index];
  const isOutdoor = current ? OUTDOOR_CATEGORIES.includes(current.category as never) : false;

  const handleAction = (action: SwipeAction) => {
    if (!current) return;
    setResults((prev) => [...prev, { pendingItemId: current.pendingItemId, action }]);
    setDragX(0);
    setDragY(0);
    setIndex((i) => i + 1);
  };

  useEffect(() => {
    if (pendingItems.length === 0 || index < pendingItems.length) return;
    (async () => {
      if (!pairId) return;
      setSaving(true);
      try {
        // 1. スワイプ結果を一括書き込み（atomic batch）
        await savePartnerSwipes(pairId, results);

        // 2. doneフラグをtransactionでセット → 両者揃ったか確認
        const bothDone = await markSwipesDoneAndCheck(pairId, "partner");

        if (bothDone) {
          // 自分が最後 → マッチング実行
          await finalizePairMatching(pairId);
          navigate("/home", { replace: true });
        } else {
          // 相手待ち → onSnapshotで matchingFinalized を監視
          setSaving(false);
          setWaitingPartner(true);
        }
      } catch {
        setError("保存に失敗しました。もう一度お試しください。");
        setSaving(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, pendingItems.length]);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || startX.current === null || startY.current === null) return;
    setDragX(e.clientX - startX.current);
    setDragY(e.clientY - startY.current);
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const absX = Math.abs(dragX);
    const absY = Math.abs(dragY);
    if (absY > absX && dragY < -80)  handleAction("go");
    else if (dragX > 80)             handleAction("good");
    else if (dragX < -80)            handleAction("pass");
    else { setDragX(0); setDragY(0); }
    startX.current = null;
    startY.current = null;
  };

  if (initLoading) return <Loading message="リストを読み込み中..." />;
  if (saving)      return <Loading message="マッチング中..." />;

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>{error}</p>
      <button className="btn-primary max-w-xs" onClick={() => navigate("/")}>
        ホームへ
      </button>
    </div>
  );

  // 相手のスワイプ待ち画面
  if (waitingPartner) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6 text-center"
         style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>
      <p className="text-7xl">✅</p>
      <h2 className="text-2xl font-bold" style={{ color: "var(--color-text-main)" }}>
        あなたのスワイプが完了！
      </h2>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
        相手のスワイプを待っています。<br />
        完了するとリストが自動で作成されます。
      </p>
      <div className="flex gap-2 mt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
               style={{ background: "var(--color-primary)", animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );

  if (!current) return null;

  const rotation = dragX * 0.08;
  const opacity  = Math.max(0, 1 - Math.abs(dragX) / 300);
  const absX = Math.abs(dragX);
  const absY = Math.abs(dragY);
  const isGoHint   = absY > absX && dragY < -30;
  const isGoodHint = !isGoHint && dragX > 30;
  const isPassHint = !isGoHint && dragX < -30;

  return (
    <div className="flex flex-col items-center justify-between min-h-screen px-4 py-8"
         style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>
      {showTutorial && <SwipeTutorial onClose={() => setShowTutorial(false)} isPartner />}

      <div className="w-full max-w-sm text-center">
        <p className="text-xs mb-1" style={{ color: "var(--color-text-soft)", letterSpacing: "0.1em" }}>
          PARTNER SWIPE
        </p>
        <p className="text-sm font-bold mb-2" style={{ color: "var(--color-text-mid)" }}>
          {index + 1} / {pendingItems.length}
        </p>
        <div className="w-full h-1.5 rounded-full" style={{ background: "var(--color-border)" }}>
          <div className="h-1.5 rounded-full transition-all"
               style={{ width: `${(index / pendingItems.length) * 100}%`,
                        background: "var(--color-primary)" }} />
        </div>
      </div>

      <div className="relative w-full max-w-sm">
        <div className="card w-full p-6 flex flex-col items-center gap-4 cursor-grab active:cursor-grabbing select-none"
             style={{
               transform: `translateX(${dragX}px) translateY(${Math.min(0, dragY)}px) rotate(${rotation}deg)`,
               opacity,
               transition: dragging ? "none" : "transform 0.3s ease, opacity 0.3s ease",
               touchAction: "none",
               minHeight: 280,
               justifyContent: "center",
             }}
             onPointerDown={onPointerDown}
             onPointerMove={onPointerMove}
             onPointerUp={onPointerUp}
             onPointerLeave={onPointerUp}>
          <span className="text-5xl">{isOutdoor ? "🗺️" : "🏠"}</span>
          <p className="text-xl font-bold text-center" style={{ color: "var(--color-text-main)" }}>
            {current.title}
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <Tag label={current.category} />
            <Tag label={current.difficulty === "easy" ? "気軽" : "特別"} />
          </div>
          {isGoodHint && (
            <div className="absolute top-4 right-4 text-2xl font-black"
                 style={{ color: "var(--color-primary)", opacity: Math.min(1, dragX / 80) }}>
              Good ⇨
            </div>
          )}
          {isPassHint && (
            <div className="absolute top-4 left-4 text-2xl font-black"
                 style={{ color: "var(--color-text-soft)", opacity: Math.min(1, -dragX / 80) }}>
              ⇦ Pass
            </div>
          )}
          {isGoHint && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-2xl font-black"
                 style={{ color: "#f43f5e", opacity: Math.min(1, -dragY / 80) }}>
              ⇧ Go!!
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <button className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "#f43f5e", color: "white" }}
                onClick={() => handleAction("go")}>
          ⇧ Go!! （最優先）
        </button>
        <div className="flex gap-3">
          <button className="flex-1 py-4 rounded-2xl border-2 font-bold text-sm"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-mid)",
                           background: "var(--color-surface)" }}
                  onClick={() => handleAction("pass")}>
            ⇦ Pass
          </button>
          <button className="flex-1 py-4 rounded-2xl font-bold text-sm"
                  style={{ background: "var(--color-primary)", color: "white" }}
                  onClick={() => handleAction("good")}>
            Good ⇨
          </button>
        </div>
      </div>
    </div>
  );
};

const Tag = ({ label }: { label: string }) => (
  <span className="text-xs font-bold px-3 py-1 rounded-full"
        style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
    {label}
  </span>
);
