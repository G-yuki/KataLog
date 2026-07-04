// src/features/setup/components/SwipeScreen.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { Loading } from "../../../components/Loading";
import { getUserPairId } from "../../pair/services/pairService";
import {
  subscribePendingItems,
  saveCreatorSwipes,
  savePartnerSwipes,
  markSwipesDoneAndCheck,
} from "../../items/services/itemService";
import { SwipeTutorial } from "./SwipeTutorial";
import { db } from "../../../firebase/firestore";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import type { PendingItem, SwipeAction } from "../../../types";
import { CATEGORY_LABEL } from "../../../lib/constants";

interface Props {
  isPartner: boolean;
}

export const SwipeScreen = ({ isPartner }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pairId, setPairId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ pendingItemId: string; action: SwipeAction }[]>([]);
  const [initLoading, setInitLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [waitingPartner, setWaitingPartner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);

  // スワイプアニメーション
  const [animating, setAnimating] = useState<SwipeAction | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserPairId(user.uid).then((id) => {
      if (!id) navigate("/", { replace: true });
      else setPairId(id);
    });
  }, [user, navigate]);

  useEffect(() => {
    if (!pairId) return;
    getDoc(doc(db, "pairs", pairId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.matchingFinalized) {
        navigate("/home", { replace: true });
      } else if (isPartner ? data.partnerSwipesDone : data.creatorSwipesDone) {
        setInitLoading(false);
        setWaitingPartner(true);
      }
    }).catch(() => {});
  }, [pairId, navigate, isPartner]);

  useEffect(() => {
    if (!pairId || waitingPartner) return;
    const unsub = subscribePendingItems(pairId, (items) => {
      if (items.length > 0) {
        setPendingItems(items.slice(0, 20));
        setInitLoading(false);
        unsub();
      }
    });
    return () => unsub();
  }, [pairId, waitingPartner]);

  // 待機中: items が追加されたら「リスト生成中...」→ リロード
  useEffect(() => {
    if (!waitingPartner || !pairId) return;
    const itemsRef = collection(db, "pairs", pairId, "items");
    let triggered = false;
    const unsub = onSnapshot(itemsRef, (snap) => {
      if (!snap.empty && !triggered) {
        triggered = true;
        unsub();
        setGenerating(true);
        setTimeout(() => window.location.reload(), 1500);
      }
    });
    return () => unsub();
  }, [waitingPartner, pairId]);

  const current = pendingItems[index];

  const triggerAction = (action: SwipeAction) => {
    if (animating || !current) return;
    const item = current;
    setAnimating(action);
    setDragX(0);
    setDragY(0);
    setTimeout(() => {
      setResults((prev) => [...prev, { pendingItemId: item.pendingItemId, action }]);
      setIndex((i) => i + 1);
      setAnimating(null);
    }, 400);
  };

  // タッチスワイプ
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || animating) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    // 縦が支配的なら上スワイプのみ追従
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) setDragY(dy);
    } else {
      setDragX(dx);
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || animating) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    setDragX(0);
    setDragY(0);
    const threshold = 60;
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < -threshold) triggerAction("go");   // 上スワイプ = 興味アリ
    } else {
      if (dx > threshold)  triggerAction("good");  // 右スワイプ = あとで
      if (dx < -threshold) triggerAction("pass");  // 左スワイプ = 興味なし
    }
  };

  // 全件完了後の保存処理
  useEffect(() => {
    if (pendingItems.length === 0 || index < pendingItems.length) return;
    (async () => {
      if (!pairId) return;
      setSaving(true);
      try {
        if (isPartner) {
          await savePartnerSwipes(pairId, results);
        } else {
          await saveCreatorSwipes(pairId, results);
        }
        await markSwipesDoneAndCheck(pairId, isPartner ? "partner" : "creator");
        // CF (onPairSwipesComplete) がマッチングを実行する。items onSnapshot がリロードを検知する
        setSaving(false);
        setWaitingPartner(true);
      } catch {
        setError("保存に失敗しました。もう一度お試しください。");
        setSaving(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, pendingItems.length]);

  if (initLoading) return <Loading message="リストを読み込み中..." />;
  if (saving || generating) return <Loading message="リストを生成中..." />;

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>{error}</p>
      <button className="btn-primary max-w-xs"
              onClick={() => navigate(isPartner ? "/" : "/setup")}>
        戻る
      </button>
    </div>
  );

  if (waitingPartner) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6 text-center"
         style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>
      <p className="text-7xl">✅</p>
      <h2 className="text-2xl font-bold" style={{ color: "var(--color-text-main)" }}>
        あなたの選択が完了！
      </h2>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
        パートナーの選択を待っています。<br />
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

  const cardStyle = animating
    ? {
        transform: animating === "go"   ? "translateY(-220px) rotate(-5deg)" :
                   animating === "pass" ? "translateX(-220px) rotate(-15deg)" :
                                         "translateX(220px) rotate(15deg)",
        opacity: 0,
        transition: "transform 0.35s ease, opacity 0.3s ease",
      }
    : {
        transform: dragX !== 0
          ? `translateX(${dragX}px) rotate(${dragX * 0.06}deg)`
          : dragY < 0
          ? `translateY(${dragY}px) rotate(${dragY * 0.02}deg)`
          : "none",
        opacity: 1,
        transition: "none",
      };

  const categoryLabel = CATEGORY_LABEL[current.category] ?? current.category;

  return (
    <div className="flex flex-col items-center justify-between min-h-screen px-4 py-8"
         style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>
      {showTutorial && <SwipeTutorial onClose={() => setShowTutorial(false)} isPartner={isPartner} />}

      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-bold mb-2" style={{ color: "var(--color-text-mid)" }}>
          残り {pendingItems.length - index}件
        </p>
        <div className="w-full h-1.5 rounded-full" style={{ background: "var(--color-border)" }}>
          <div className="h-1.5 rounded-full transition-all"
               style={{ width: `${(index / pendingItems.length) * 100}%`,
                        background: "var(--color-primary)" }} />
        </div>
      </div>

      <div className="relative w-full max-w-sm select-none"
           onTouchStart={handleTouchStart}
           onTouchMove={handleTouchMove}
           onTouchEnd={handleTouchEnd}>
        <div key={index}
             className="card w-full p-6 flex flex-col items-center gap-4"
             style={{ ...cardStyle, minHeight: 280, justifyContent: "center" }}>
          <span className="text-5xl">
            {current.category === "nature" || current.category === "sports" || current.category === "theme"
              ? "🗺️" : "🏠"}
          </span>
          <p className="text-xl font-bold text-center" style={{ color: "var(--color-text-main)" }}>
            {current.title}
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <Tag label={categoryLabel} />
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <button className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "#f43f5e", color: "white",
                         opacity: animating ? 0.4 : 1, transition: "opacity 0.2s" }}
                disabled={!!animating}
                onClick={() => triggerAction("go")}>
          興味アリ ↑
        </button>
        <div className="flex gap-3">
          <button className="flex-1 py-4 rounded-2xl border-2 font-bold text-sm"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-mid)",
                           background: "var(--color-surface)",
                           opacity: animating ? 0.4 : 1, transition: "opacity 0.2s" }}
                  disabled={!!animating}
                  onClick={() => triggerAction("pass")}>
            ← 興味なし
          </button>
          <button className="flex-1 py-4 rounded-2xl font-bold text-sm"
                  style={{ background: "var(--color-primary)", color: "white",
                           opacity: animating ? 0.4 : 1, transition: "opacity 0.2s" }}
                  disabled={!!animating}
                  onClick={() => triggerAction("good")}>
            あとで →
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
