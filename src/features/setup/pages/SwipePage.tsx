// src/features/setup/pages/SwipePage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { Loading } from "../../../components/Loading";
import { getUserPairId } from "../../pair/services/pairService";
import {
  subscribePendingItems,
  saveCreatorSwipes,
  markSwipesDoneAndCheck,
  finalizePairMatching,
} from "../../items/services/itemService";
import { SwipeTutorial } from "../components/SwipeTutorial";
import { db } from "../../../firebase/firestore";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import type { PendingItem, SwipeAction } from "../../../types";
import { OUTDOOR_CATEGORIES } from "../../../lib/constants";

export const SwipePage = () => {
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
  const [animating, setAnimating] = useState<SwipeAction | null>(null);

  // pairId 取得
  useEffect(() => {
    if (!user) return;
    getUserPairId(user.uid).then((id) => {
      if (!id) navigate("/", { replace: true });
      else setPairId(id);
    });
  }, [user, navigate]);

  // pairId確定後: スワイプ済みかチェック（ページリロード復帰対策）
  useEffect(() => {
    if (!pairId) return;
    getDoc(doc(db, "pairs", pairId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.matchingFinalized) {
        navigate("/home", { replace: true });
      } else if (data.creatorSwipesDone) {
        setInitLoading(false);
        setWaitingPartner(true);
      }
    }).catch(() => {});
  }, [pairId, navigate]);

  // pendingItems を一度だけ読み込む（未スワイプ時のみ）
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

  // 待機中: items コレクションに追加されたら Hard Reload → startup check が /home へ誘導
  useEffect(() => {
    if (!waitingPartner || !pairId) return;
    const itemsRef = collection(db, "pairs", pairId, "items");
    let triggered = false;
    const unsub = onSnapshot(itemsRef, (snap) => {
      if (!snap.empty && !triggered) {
        triggered = true;
        unsub();
        setTimeout(() => window.location.reload(), 1500);
      }
    });
    return () => unsub();
  }, [waitingPartner, pairId]);

  const current = pendingItems[index];
  const isOutdoor = current ? OUTDOOR_CATEGORIES.includes(current.category as never) : false;

  // ボタン押下: アニメーション → 結果記録 → 次へ
  const handleButtonClick = (action: SwipeAction) => {
    if (animating || !current) return;
    const item = current;
    setAnimating(action);
    setTimeout(() => {
      setResults((prev) => [...prev, { pendingItemId: item.pendingItemId, action }]);
      setIndex((i) => i + 1);
      setAnimating(null);
    }, 450);
  };

  // 全件完了後の処理
  useEffect(() => {
    if (pendingItems.length === 0 || index < pendingItems.length) return;
    (async () => {
      if (!pairId) return;
      setSaving(true);
      try {
        await saveCreatorSwipes(pairId, results);
        const bothDone = await markSwipesDoneAndCheck(pairId, "creator");
        if (bothDone) {
          await finalizePairMatching(pairId);
          // Hard Reload: startup check が matchingFinalized を見て /home へ
          setTimeout(() => window.location.reload(), 1500);
        } else {
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

  if (initLoading) return <Loading message="リストを読み込み中..." />;
  if (saving)      return <Loading message="最適なリストを作成中..." />;

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>{error}</p>
      <button className="btn-primary max-w-xs" onClick={() => navigate("/setup")}>
        ヒアリングに戻る
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
        相手の選択を待っています。<br />
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

  const cardTransform =
    animating === "go"   ? "translateY(-220px) rotate(-5deg)" :
    animating === "pass" ? "translateX(-220px) rotate(-15deg)" :
    animating === "good" ? "translateX(220px) rotate(15deg)" :
    "none";

  return (
    <div className="flex flex-col items-center justify-between min-h-screen px-4 py-8">
      {showTutorial && <SwipeTutorial onClose={() => setShowTutorial(false)} />}

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

      <div className="relative w-full max-w-sm">
        <div key={index}
             className="card w-full p-6 flex flex-col items-center gap-4 select-none"
             style={{
               transform: cardTransform,
               opacity: animating ? 0 : 1,
               transition: "transform 0.4s ease, opacity 0.35s ease",
               minHeight: 280,
               justifyContent: "center",
             }}>
          <span className="text-5xl">{isOutdoor ? "🗺️" : "🏠"}</span>
          <p className="text-xl font-bold text-center" style={{ color: "var(--color-text-main)" }}>
            {current.title}
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <Tag label={current.category} />
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <button className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "#f43f5e", color: "white",
                         opacity: animating ? 0.4 : 1, transition: "opacity 0.2s" }}
                disabled={!!animating}
                onClick={() => handleButtonClick("go")}>
          興味アリ ↑
        </button>
        <div className="flex gap-3">
          <button className="flex-1 py-4 rounded-2xl border-2 font-bold text-sm"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-mid)",
                           background: "var(--color-surface)",
                           opacity: animating ? 0.4 : 1, transition: "opacity 0.2s" }}
                  disabled={!!animating}
                  onClick={() => handleButtonClick("pass")}>
            ← 興味なし
          </button>
          <button className="flex-1 py-4 rounded-2xl font-bold text-sm"
                  style={{ background: "var(--color-primary)", color: "white",
                           opacity: animating ? 0.4 : 1, transition: "opacity 0.2s" }}
                  disabled={!!animating}
                  onClick={() => handleButtonClick("good")}>
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
