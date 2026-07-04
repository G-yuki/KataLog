// src/features/setup/pages/PartnerWaitingPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { getUserPairId } from "../../pair/services/pairService";
import { db } from "../../../firebase/firestore";
import { collection, doc, onSnapshot } from "firebase/firestore";

export const PartnerWaitingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pairId, setPairId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserPairId(user.uid).then((id) => {
      if (!id) navigate("/", { replace: true });
      else setPairId(id);
    });
  }, [user, navigate]);

  // pair ドキュメントを監視
  useEffect(() => {
    if (!pairId) return;
    return onSnapshot(doc(db, "pairs", pairId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.matchingFinalized) { navigate("/home", { replace: true }); return; }

      // パートナーが確認完了済み → plan-confirm
      if (data.partnerHearingConfirmed) { navigate("/setup/plan-confirm", { replace: true }); return; }

      // hearing が保存された → partner-confirm へ（確認フロー）
      if (data.hearing) { navigate("/setup/partner-confirm", { replace: true }); }
    });
  }, [pairId, navigate]);

  // pendingItems が揃ったらスワイプ画面へ（フォールバック）
  useEffect(() => {
    if (!pairId) return;
    const unsubscribe = onSnapshot(
      collection(db, "pairs", pairId, "pendingItems"),
      (snap) => {
        if (!snap.empty) navigate("/setup/partner-swipe", { replace: true });
      }
    );
    return () => unsubscribe();
  }, [pairId, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6 text-center">
      <p className="text-6xl">⌛</p>
      <h2 className="text-xl font-bold" style={{ color: "var(--color-text-main)" }}>
        リストを準備中です
      </h2>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
        それぞれのスマホで回答します。<br /><br />
        回答が完了したら、<br />
        スワイプ画面がこちらに表示されます。<br />
        このままお待ちください。
      </p>
      <div className="flex gap-2 mt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
               style={{ background: "var(--color-primary)", animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
      <p className="text-xs" style={{ color: "var(--color-text-soft)" }}>
        ヒアリング完了を待っています...
      </p>
    </div>
  );
};
