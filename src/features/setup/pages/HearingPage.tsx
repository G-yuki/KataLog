// src/features/setup/pages/HearingPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { getUserPairId } from "../../pair/services/pairService";
import { useGenerateItems } from "../hooks/useGenerateItems";
import { savePendingItemsDraft } from "../../items/services/itemService";
import { db } from "../../../firebase/firestore";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Loading } from "../../../components/Loading";
import {
  GENRES, PREFECTURES,
  RANGE_OPTIONS, CHILDREN_OPTIONS, TRANSPORT_OPTIONS, BUDGET_OPTIONS, INDOOR_OPTIONS,
} from "../../../lib/constants";
import type { Hearing } from "../../../types";

const TOTAL_STEPS = 6;

export const HearingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { generate, loading: generating } = useGenerateItems();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hearing, setHearing] = useState<Partial<Hearing>>({
    genres: [],
    prefecture: "",
    range: "",
    children: "",
    transport: "",
    budget: "",
    indoor: "",
    freetext: "",
  });

  const update = (key: keyof Hearing, value: string | string[]) =>
    setHearing((prev) => ({ ...prev, [key]: value }));

  const toggleGenre = (id: string) => {
    const genres = hearing.genres ?? [];
    update("genres", genres.includes(id) ? genres.filter((g) => g !== id) : [...genres, id]);
  };

  const canNext = () => {
    if (step === 1) return (hearing.genres?.length ?? 0) > 0;
    if (step === 2) return !!hearing.prefecture && !!hearing.range;
    if (step === 3) return !!hearing.children;
    if (step === 4) return !!hearing.transport;
    if (step === 5) return !!hearing.budget;
    if (step === 6) return !!hearing.indoor;
    return false;
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) { setStep((s) => s + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const pairId = await getUserPairId(user.uid);
      if (!pairId) throw new Error("pairId not found");

      // ヒアリング保存
      await updateDoc(doc(db, "pairs", pairId), {
        hearing: { ...hearing, updatedAt: serverTimestamp() },
      });

      // AI生成 → pendingItems として保存（両者がスワイプ前に参照）
      const drafts = await generate(hearing as Parameters<typeof generate>[0]);
      if (!drafts) throw new Error("generation failed");
      await savePendingItemsDraft(pairId, drafts);

      navigate("/setup/swipe");
    } catch {
      setError("リストの生成に失敗しました。もう一度お試しください。");
      setSaving(false);
    }
  };

  if (generating) return <Loading message="AIがリストを生成中..." />;

  return (
    <div className="flex flex-col min-h-screen px-6 pt-12 pb-8">
      {/* プログレスバー */}
      <div className="w-full max-w-sm mx-auto mb-8">
        <div className="flex justify-between text-xs mb-2"
             style={{ color: "var(--color-text-soft)" }}>
          <span>STEP {step} / {TOTAL_STEPS}</span>
        </div>
        <div className="w-full h-1.5 rounded-full" style={{ background: "var(--color-border)" }}>
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%`, background: "var(--color-primary)" }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto gap-5">

        {/* STEP 1: ジャンル */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>
              どんな体験が好きですか？
            </h2>
            <p className="text-sm text-center" style={{ color: "var(--color-text-mid)" }}>
              複数選択できます
            </p>
            <div className="grid grid-cols-2 gap-3 w-full">
              {GENRES.map((g) => {
                const selected = hearing.genres?.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGenre(g.id)}
                    className="flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all"
                    style={{
                      borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
                      background: selected ? "var(--color-primary-light)" : "var(--color-surface)",
                      color: "var(--color-text-main)",
                    }}
                  >
                    <span className="text-2xl">{g.emoji}</span>
                    <span className="text-sm font-medium">{g.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 2: エリア */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>
              主に活動するエリアは？
            </h2>
            <select
              className="w-full border-2 rounded-2xl px-4 py-3 text-base outline-none"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-main)", background: "var(--color-surface)" }}
              value={hearing.prefecture}
              onChange={(e) => update("prefecture", e.target.value)}
            >
              <option value="">都道府県を選択</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {RANGE_OPTIONS.map((r) => (
              <ChoiceButton key={r.id} label={r.label}
                selected={hearing.range === r.id}
                onClick={() => update("range", r.id)} />
            ))}
          </>
        )}

        {/* STEP 3: お子さま */}
        {step === 3 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>
              お子さまはいますか？
            </h2>
            {CHILDREN_OPTIONS.map((c) => (
              <ChoiceButton key={c.id} label={c.label}
                selected={hearing.children === c.id}
                onClick={() => update("children", c.id)} />
            ))}
          </>
        )}

        {/* STEP 4: 移動手段 */}
        {step === 4 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>
              移動手段は？
            </h2>
            {TRANSPORT_OPTIONS.map((t) => (
              <ChoiceButton key={t.id} label={t.label}
                selected={hearing.transport === t.id}
                onClick={() => update("transport", t.id)} />
            ))}
          </>
        )}

        {/* STEP 5: 予算 */}
        {step === 5 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>
              予算感は？
            </h2>
            <p className="text-sm text-center" style={{ color: "var(--color-text-mid)" }}>
              1回あたり・ふたり（家族）合計
            </p>
            {BUDGET_OPTIONS.map((b) => (
              <ChoiceButton key={b.id} label={b.label}
                selected={hearing.budget === b.id}
                onClick={() => update("budget", b.id)} />
            ))}
          </>
        )}

        {/* STEP 6: 屋内/屋外 + 自由入力 */}
        {step === 6 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>
              屋内・屋外の好みは？
            </h2>
            {INDOOR_OPTIONS.map((i) => (
              <ChoiceButton key={i.id} label={i.label}
                selected={hearing.indoor === i.id}
                onClick={() => update("indoor", i.id)} />
            ))}
            <textarea
              className="w-full border-2 rounded-2xl px-4 py-3 text-sm outline-none resize-none mt-2"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-main)", background: "var(--color-surface)" }}
              placeholder="その他リクエストがあれば（任意・100文字）"
              maxLength={100}
              rows={3}
              value={hearing.freetext}
              onChange={(e) => update("freetext", e.target.value)}
            />
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-500 text-center mt-2">{error}</p>}

      {/* ナビゲーション */}
      <div className="w-full max-w-sm mx-auto mt-6 flex gap-3">
        {step > 1 && (
          <button className="btn-secondary" style={{ flex: 1 }}
            onClick={() => setStep((s) => s - 1)}>
            戻る
          </button>
        )}
        <button
          className="btn-primary"
          style={{ flex: 2 }}
          onClick={handleNext}
          disabled={!canNext() || saving}
        >
          {saving ? "生成中..." : step === TOTAL_STEPS ? "リストを生成する" : "次へ"}
        </button>
      </div>
    </div>
  );
};

// 選択肢ボタン（共通）
const ChoiceButton = ({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full p-4 rounded-2xl border-2 text-left font-medium transition-all"
    style={{
      borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
      background: selected ? "var(--color-primary-light)" : "var(--color-surface)",
      color: "var(--color-text-main)",
    }}
  >
    {label}
  </button>
);
