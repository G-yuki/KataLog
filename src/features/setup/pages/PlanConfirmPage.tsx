// src/features/setup/pages/PlanConfirmPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { usePair } from "../../../contexts/PairContext";
import { getUserPairId } from "../../pair/services/pairService";
import { markPlanApproved, savePendingItemsDraft } from "../../items/services/itemService";
import { useGenerateItems } from "../hooks/useGenerateItems";
import { db } from "../../../firebase/firestore";
import { doc, collection, getDoc, onSnapshot } from "firebase/firestore";
import { Loading } from "../../../components/Loading";
import {
  GENRES, RANGE_OPTIONS, CHILDREN_OPTIONS, TRANSPORT_OPTIONS, BUDGET_OPTIONS, INDOOR_OPTIONS,
} from "../../../lib/constants";
import type { Hearing } from "../../../types";

export const PlanConfirmPage = () => {
  const { user } = useAuth();
  const { isSolo } = usePair();
  const navigate = useNavigate();
  const { generate } = useGenerateItems();

  // ソロユーザーはこのページに来ない（HearingPage で swipe へ直行する）
  useEffect(() => {
    if (isSolo) navigate("/setup/swipe", { replace: true });
  }, [isSolo, navigate]);

  const [pairId, setPairId] = useState<string | null>(null);
  const [finalHearing, setFinalHearing] = useState<Hearing | null>(null);
  const [role, setRole] = useState<"creator" | "partner" | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [waitingOther, setWaitingOther] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const id = await getUserPairId(user.uid);
      if (!id) { navigate("/", { replace: true }); return; }
      setPairId(id);

      const snap = await getDoc(doc(db, "pairs", id));
      if (!snap.exists()) { navigate("/", { replace: true }); return; }
      const data = snap.data();

      if (data.matchingFinalized) { navigate("/home", { replace: true }); return; }

      const members = data.members as string[];
      setRole(members[0] === user.uid ? "creator" : "partner");

      const fh = data.finalHearing as Hearing | null;
      if (!fh) { navigate("/setup/partner-waiting", { replace: true }); return; }

      setFinalHearing(fh);
      setInitLoading(false);
    })();
  }, [user, navigate]);

  // pendingItems が現れたら swipe へ（相手が先にトリガーした場合）
  useEffect(() => {
    if (!pairId) return;
    let triggered = false;
    return onSnapshot(collection(db, "pairs", pairId, "pendingItems"), (snap) => {
      if (!snap.empty && !triggered) {
        triggered = true;
        navigate(role === "partner" ? "/setup/partner-swipe" : "/setup/swipe", { replace: true });
      }
    });
  }, [pairId, role, navigate]);

  const handleApprove = async () => {
    if (!pairId || !finalHearing || !role) return;
    setApproving(true);
    setError(null);
    try {
      const bothApproved = await markPlanApproved(pairId, role);
      if (bothApproved) {
        setGenerating(true);
        const drafts = await generate(finalHearing);
        if (!drafts) throw new Error("generation failed");
        const isZenkoku = finalHearing.range === "anywhere" || finalHearing.prefecture === "全国";
        const area = finalHearing.overseas
          ? { overseas: finalHearing.overseas }
          : { prefecture: isZenkoku ? "全国" : finalHearing.prefecture };
        await savePendingItemsDraft(pairId, drafts, area);
        // onSnapshot が両者のリロードを検知
      } else {
        setApproving(false);
        setWaitingOther(true);
      }
    } catch {
      setError("リストの生成に失敗しました。もう一度お試しください。");
      setApproving(false);
      setGenerating(false);
    }
  };

  if (initLoading) return <Loading message="プランを読み込み中..." />;
  if (generating)  return <Loading message="リストを生成中..." />;
  if (!finalHearing) return null;

  return (
    <div className="flex flex-col min-h-screen px-6 pt-12 pb-8"
         style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>
      <div className="w-full max-w-sm mx-auto mb-6 text-center">
        <p className="text-4xl mb-3">✅</p>
        <h2 className="text-xl font-bold" style={{ color: "var(--color-text-main)" }}>
          ふたりの最終プラン
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-mid)" }}>
          このプランでリストを作成します
        </p>
      </div>

      <div className="w-full max-w-sm mx-auto flex flex-col gap-3 flex-1">
        <PlanRow icon="🎯" label="ジャンル"
          value={finalHearing.genres.map((id) => GENRES.find((g) => g.id === id)?.label ?? id).join("・")} />
        <PlanRow icon="📍" label="エリア"
          value={finalHearing.overseas ?? (
            finalHearing.prefecture === "全国"
              ? "全国"
              : `${finalHearing.prefecture}（${RANGE_OPTIONS.find((r) => r.id === finalHearing.range)?.label ?? ""}）`
          )} />
        <PlanRow icon="👶" label="お子さま"
          value={CHILDREN_OPTIONS.find((c) => c.id === finalHearing.children)?.label ?? ""} />
        <PlanRow icon="🚗" label="移動手段"
          value={TRANSPORT_OPTIONS.find((t) => t.id === finalHearing.transport)?.label ?? ""} />
        <PlanRow icon="💴" label="予算"
          value={BUDGET_OPTIONS.find((b) => b.id === finalHearing.budget)?.label ?? ""} />
        <PlanRow icon="🏠" label="屋内/屋外"
          value={INDOOR_OPTIONS.find((i) => i.id === finalHearing.indoor)?.label ?? ""} />
        {finalHearing.freetext && (
          <PlanRow icon="📝" label="リクエスト" value={finalHearing.freetext} />
        )}
      </div>

      {error && <p className="text-sm text-red-500 text-center mt-2">{error}</p>}

      <div className="w-full max-w-sm mx-auto mt-6">
        {waitingOther ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
              パートナーの承認を待っています...
            </p>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
                     style={{ background: "var(--color-primary)", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        ) : (
          <button className="btn-primary w-full" onClick={handleApprove} disabled={approving}>
            {approving ? "処理中..." : "このプランでリスト作成する"}
          </button>
        )}
      </div>
    </div>
  );
};

const PlanRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div className="card p-4 flex items-start gap-3">
    <span className="text-xl">{icon}</span>
    <div>
      <p className="text-xs font-bold mb-0.5" style={{ color: "var(--color-text-soft)" }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: "var(--color-text-main)" }}>{value}</p>
    </div>
  </div>
);
