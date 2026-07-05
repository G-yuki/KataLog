// src/features/setup/pages/CreatorWaitingPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { usePair } from "../../../contexts/PairContext";
import { getUserPairId } from "../../pair/services/pairService";
import { db } from "../../../firebase/firestore";
import { doc, collection, onSnapshot } from "firebase/firestore";

export const CreatorWaitingPage = () => {
  const { user } = useAuth();
  const { isSolo } = usePair();
  const navigate = useNavigate();
  const [pairId, setPairId] = useState<string | null>(null);

  // ソロユーザーはこのページに来ない（HearingPage で swipe へ直行する）
  useEffect(() => {
    if (isSolo) navigate("/setup/swipe", { replace: true });
  }, [isSolo, navigate]);

  useEffect(() => {
    if (!user) return;
    getUserPairId(user.uid).then((id) => {
      if (!id) navigate("/", { replace: true });
      else setPairId(id);
    });
  }, [user, navigate]);

  // パートナーが確認完了 → plan-confirm へ
  useEffect(() => {
    if (!pairId) return;
    return onSnapshot(doc(db, "pairs", pairId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.matchingFinalized) { navigate("/home", { replace: true }); return; }
      if (data.partnerHearingConfirmed) { navigate("/setup/plan-confirm", { replace: true }); }
    });
  }, [pairId, navigate]);

  // pendingItems が存在する（生成完了済み）→ swipe へ
  useEffect(() => {
    if (!pairId) return;
    let triggered = false;
    return onSnapshot(collection(db, "pairs", pairId, "pendingItems"), (snap) => {
      if (!snap.empty && !triggered) {
        triggered = true;
        navigate("/setup/swipe", { replace: true });
      }
    });
  }, [pairId, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6 text-center"
         style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>
      <p className="text-7xl">📋</p>
      <h2 className="text-xl font-bold" style={{ color: "var(--color-text-main)" }}>
        パートナーがプランを<br />確認中です
      </h2>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
        確認が完了すると<br />次のステップへ自動で進みます。
      </p>
      <div className="flex gap-2 mt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
               style={{ background: "var(--color-primary)", animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
};
