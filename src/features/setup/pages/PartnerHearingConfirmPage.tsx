// src/features/setup/pages/PartnerHearingConfirmPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { getUserPairId } from "../../pair/services/pairService";
import { saveFinalHearing } from "../../items/services/itemService";
import { db } from "../../../firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { Loading } from "../../../components/Loading";
import {
  GENRES, PREFECTURES,
  RANGE_OPTIONS, CHILDREN_OPTIONS, TRANSPORT_OPTIONS, BUDGET_OPTIONS, INDOOR_OPTIONS,
  OVERSEAS_REGIONS, OVERSEAS_COUNTRIES,
} from "../../../lib/constants";
import type { Hearing } from "../../../types";

export const PartnerHearingConfirmPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pairId, setPairId] = useState<string | null>(null);
  const [creatorHearing, setCreatorHearing] = useState<Hearing | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // パートナーの編集用ローカル状態（creatorHearingで初期化）
  const [partnerGenres, setPartnerGenres] = useState<string[]>([]);  // 追加分のみ
  const [hearing, setHearing] = useState<Partial<Hearing>>({});      // 全項目（creatorの値で初期化）

  const [isOverseas, setIsOverseas] = useState(false);
  const [overseasRegion, setOverseasRegion] = useState<string>(OVERSEAS_REGIONS[0]);
  const [overseasCountry, setOverseasCountry] = useState("");
  const [otherText, setOtherText] = useState("");

  const TOTAL_STEPS = 6;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const id = await getUserPairId(user.uid);
      if (!id) { navigate("/", { replace: true }); return; }
      setPairId(id);

      const pairSnap = await getDoc(doc(db, "pairs", id));
      if (!pairSnap.exists()) { navigate("/", { replace: true }); return; }
      const data = pairSnap.data();

      if (data.matchingFinalized) { navigate("/home", { replace: true }); return; }
      if (data.partnerHearingConfirmed) { navigate("/setup/plan-confirm", { replace: true }); return; }

      const h = data.hearing as Hearing;
      if (!h) { navigate("/setup/partner-waiting", { replace: true }); return; }

      setCreatorHearing(h);
      setHearing({ ...h });
      if (h.overseas) {
        setIsOverseas(true);
        setOverseasRegion(h.overseas);
      }
      setInitLoading(false);
    })();
  }, [user, navigate]);

  const update = (key: keyof Hearing, value: string | string[] | undefined) =>
    setHearing((prev) => ({ ...prev, [key]: value }));

  const togglePartnerGenre = (id: string) => {
    const locked = creatorHearing?.genres ?? [];
    if (locked.includes(id)) return; // creator のジャンルは削除不可
    setPartnerGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleRegionSelect = (r: string) => {
    setOverseasRegion(r); setOverseasCountry(""); setOtherText("");
    update("overseas", r);
  };
  const handleCountrySelect = (c: string) => {
    setOverseasCountry(c);
    update("overseas", c === "その他" || !c ? overseasRegion : c);
  };
  const handleOtherText = (t: string) => {
    setOtherText(t);
    update("overseas", t || overseasRegion);
  };

  const canNext = () => {
    if (step === 2) return isOverseas
      ? !!hearing.overseas
      : hearing.prefecture === "全国" || (!!hearing.prefecture && !!hearing.range);
    if (step === 3) return !!hearing.children;
    if (step === 4) return !!hearing.transport;
    if (step === 5) return !!hearing.budget;
    if (step === 6) return !!hearing.indoor;
    return true; // step 1 は常に通過可（creatorのジャンルが既に存在）
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) { setStep((s) => s + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!pairId || !creatorHearing) return;
    setSaving(true);
    setError(null);
    try {
      const finalGenres = [...new Set([...creatorHearing.genres, ...partnerGenres])];
      const partnerFreetext = hearing.freetext ?? "";
      const creatorFreetext = creatorHearing.freetext ?? "";
      const combinedFreetext = [creatorFreetext, partnerFreetext].filter(Boolean).join("。");

      const finalHearing: Hearing = {
        ...creatorHearing,
        ...hearing,
        genres: finalGenres,
        freetext: combinedFreetext,
      };

      await saveFinalHearing(pairId, finalHearing);
      navigate("/setup/plan-confirm", { replace: true });
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
      setSaving(false);
    }
  };

  if (initLoading) return <Loading message="プランを読み込み中..." />;

  const lockedGenres = creatorHearing?.genres ?? [];

  return (
    <div className="flex flex-col min-h-screen px-6 pt-12 pb-8"
         style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>
      <div className="w-full max-w-sm mx-auto mb-6">
        <p className="text-xs text-center mb-3" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
          パートナーが作成したプランを確認・修正できます
        </p>
        <div className="flex justify-between text-xs mb-2" style={{ color: "var(--color-text-soft)" }}>
          <span>STEP {step} / {TOTAL_STEPS}</span>
        </div>
        <div className="w-full h-1.5 rounded-full" style={{ background: "var(--color-border)" }}>
          <div className="h-1.5 rounded-full transition-all duration-300"
               style={{ width: `${(step / TOTAL_STEPS) * 100}%`, background: "var(--color-primary)" }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto gap-5">

        {/* STEP 1: ジャンル（creatorのは固定、追加のみ可） */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>
              どんな体験が好きですか？
            </h2>
            <p className="text-xs text-center" style={{ color: "var(--color-text-soft)" }}>
              🔒 グレーはパートナーが選択済み（変更不可）。追加でタップして選べます。
            </p>
            <div className="grid grid-cols-2 gap-3 w-full">
              {GENRES.map((g) => {
                const locked = lockedGenres.includes(g.id);
                const added  = partnerGenres.includes(g.id);
                const active = locked || added;
                return (
                  <button key={g.id} onClick={() => togglePartnerGenre(g.id)}
                    className="flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all"
                    style={{
                      borderColor: locked ? "var(--color-border)" : active ? "var(--color-primary)" : "var(--color-border)",
                      background: locked ? "var(--color-surface)" : active ? "var(--color-primary-light)" : "var(--color-surface)",
                      color: locked ? "var(--color-text-soft)" : "var(--color-text-main)",
                      opacity: locked ? 0.7 : 1,
                    }}>
                    <span className="text-2xl">{g.emoji}</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{g.label}</span>
                      {locked && <span className="text-xs" style={{ color: "var(--color-text-soft)" }}>🔒</span>}
                    </div>
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
            <div className="flex gap-3 w-full">
              {([["🏠 国内", false], ["✈️ 海外", true]] as const).map(([label, overseas]) => (
                <button key={label}
                  onClick={() => {
                    setIsOverseas(overseas);
                    if (overseas) { update("overseas", overseasRegion); update("prefecture", undefined); update("range", undefined); }
                    else { update("overseas", undefined); }
                  }}
                  className="flex-1 p-3 rounded-2xl border-2 text-sm font-medium transition-all"
                  style={{
                    borderColor: isOverseas === overseas ? "var(--color-primary)" : "var(--color-border)",
                    background: isOverseas === overseas ? "var(--color-primary-light)" : "var(--color-surface)",
                    color: "var(--color-text-main)",
                  }}>
                  {label}
                </button>
              ))}
            </div>
            {!isOverseas ? (
              <>
                <button
                  onClick={() => {
                    if (hearing.prefecture === "全国") { update("prefecture", ""); update("range", undefined); }
                    else { update("prefecture", "全国"); update("range", "anywhere"); }
                  }}
                  className="w-full p-3 rounded-2xl border-2 text-sm font-medium transition-all text-left"
                  style={{
                    borderColor: hearing.prefecture === "全国" ? "var(--color-primary)" : "var(--color-border)",
                    background: hearing.prefecture === "全国" ? "var(--color-primary-light)" : "var(--color-surface)",
                    color: "var(--color-text-main)",
                  }}>
                  🗾 全国
                </button>
                {hearing.prefecture !== "全国" && (
                  <>
                    <select className="w-full border-2 rounded-2xl px-4 py-3 text-base outline-none"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text-main)", background: "var(--color-surface)" }}
                      value={hearing.prefecture ?? ""} onChange={(e) => update("prefecture", e.target.value)}>
                      <option value="">都道府県を選択</option>
                      {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {RANGE_OPTIONS.map((r) => (
                      <ChoiceButton key={r.id} label={r.label} selected={hearing.range === r.id} onClick={() => update("range", r.id)} />
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 w-full">
                  {OVERSEAS_REGIONS.map((r) => (
                    <button key={r} onClick={() => handleRegionSelect(r)}
                      className="px-3 py-2 rounded-full border text-xs font-medium transition-all"
                      style={{
                        borderColor: overseasRegion === r ? "var(--color-primary)" : "var(--color-border)",
                        background: overseasRegion === r ? "var(--color-primary-light)" : "var(--color-surface)",
                        color: "var(--color-text-main)",
                      }}>
                      {r}
                    </button>
                  ))}
                </div>
                <select className="w-full border-2 rounded-2xl px-4 py-3 text-base outline-none"
                  style={{ borderColor: "var(--color-border)", color: overseasCountry ? "var(--color-text-main)" : "var(--color-text-soft)", background: "var(--color-surface)" }}
                  value={overseasCountry} onChange={(e) => handleCountrySelect(e.target.value)}>
                  <option value="">国を選択（任意）</option>
                  {(OVERSEAS_COUNTRIES[overseasRegion] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="その他">その他</option>
                </select>
                {overseasCountry === "その他" && (
                  <input className="w-full border-2 rounded-2xl px-4 py-3 text-base outline-none"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-main)", background: "var(--color-surface)" }}
                    placeholder="国名を入力" maxLength={40} value={otherText}
                    onChange={(e) => handleOtherText(e.target.value)} />
                )}
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>お子さまはいますか？</h2>
            {CHILDREN_OPTIONS.map((c) => (
              <ChoiceButton key={c.id} label={c.label} selected={hearing.children === c.id} onClick={() => update("children", c.id)} />
            ))}
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>移動手段は？</h2>
            {TRANSPORT_OPTIONS.map((t) => (
              <ChoiceButton key={t.id} label={t.label} selected={hearing.transport === t.id} onClick={() => update("transport", t.id)} />
            ))}
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>予算感は？</h2>
            <p className="text-sm text-center" style={{ color: "var(--color-text-mid)" }}>1回あたり・ふたり（家族）合計</p>
            {BUDGET_OPTIONS.map((b) => (
              <ChoiceButton key={b.id} label={b.label} selected={hearing.budget === b.id} onClick={() => update("budget", b.id)} />
            ))}
          </>
        )}

        {step === 6 && (
          <>
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--color-text-main)" }}>屋内・屋外の好みは？</h2>
            {INDOOR_OPTIONS.map((i) => (
              <ChoiceButton key={i.id} label={i.label} selected={hearing.indoor === i.id} onClick={() => update("indoor", i.id)} />
            ))}
            <textarea
              className="w-full border-2 rounded-2xl px-4 py-3 text-sm outline-none resize-none mt-2"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-main)", background: "var(--color-surface)" }}
              placeholder="追加のリクエストがあれば（任意・100文字）"
              maxLength={100} rows={3}
              value={hearing.freetext === creatorHearing?.freetext ? "" : (hearing.freetext ?? "")}
              onChange={(e) => update("freetext", e.target.value)} />
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-500 text-center mt-2">{error}</p>}

      <div className="w-full max-w-sm mx-auto mt-6 flex gap-3">
        {step > 1 && (
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep((s) => s - 1)}>戻る</button>
        )}
        <button className="btn-primary" style={{ flex: 2 }} onClick={handleNext} disabled={!canNext() || saving}>
          {saving ? "保存中..." : step === TOTAL_STEPS ? "このプランで確認へ" : "次へ"}
        </button>
      </div>
    </div>
  );
};

const ChoiceButton = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => (
  <button onClick={onClick}
    className="w-full p-4 rounded-2xl border-2 text-left font-medium transition-all"
    style={{
      borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
      background: selected ? "var(--color-primary-light)" : "var(--color-surface)",
      color: "var(--color-text-main)",
    }}>
    {label}
  </button>
);
