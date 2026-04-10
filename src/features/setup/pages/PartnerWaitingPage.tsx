// src/features/setup/pages/PartnerWaitingPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { getUserPairId } from "../../pair/services/pairService";
import { db } from "../../../firebase/firestore";
import { collection, onSnapshot } from "firebase/firestore";

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

  // pendingItems が揃ったらパートナースワイプ画面へ
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
        相手がヒアリングを終えると<br />
        スワイプ画面が表示されます。<br />
        このままお待ちください。
      </p>
      <div className="flex gap-2 mt-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full animate-bounce"
            style={{
              background: "var(--color-primary)",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: "var(--color-text-soft)" }}>
        相手のヒアリング完了を待っています...
      </p>
    </div>
  );
};
