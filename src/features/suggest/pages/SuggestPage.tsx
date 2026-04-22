// src/features/suggest/pages/SuggestPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "../../../components/Loading";
import { BottomNav } from "../../../components/BottomNav";
import { useGenerateItems } from "../../setup/hooks/useGenerateItems";
import { addSuggestedItems } from "../../items/services/itemService";
import { usePair } from "../../../contexts/PairContext";
import { db } from "../../../firebase/firestore";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  GENRES, PREFECTURES, CATEGORY_STYLE,
  RANGE_OPTIONS, CHILDREN_OPTIONS, TRANSPORT_OPTIONS, BUDGET_OPTIONS, INDOOR_OPTIONS,
} from "../../../lib/constants";
import type { Hearing, ItemDraft } from "../../../types";

type Step = "home" | "update-hearing" | "generating" | "results" | "done";

// 定数から id→label の逆引きマップを生成
const toMap = (opts: readonly { id: string; label: string }[]) =>
  Object.fromEntries(opts.map((o) => [o.id, o.label]));
const RANGE_LABELS     = toMap(RANGE_OPTIONS);
const CHILDREN_LABELS  = toMap(CHILDREN_OPTIONS);
const TRANSPORT_LABELS = toMap(TRANSPORT_OPTIONS);
const BUDGET_LABELS    = toMap(BUDGET_OPTIONS);
const INDOOR_LABELS    = toMap(INDOOR_OPTIONS);

const OVERSEAS_REGIONS = [
  "東南アジア",
  "東アジア",
  "ヨーロッパ",
  "ハワイ・グアム",
  "アメリカ・カナダ",
  "オセアニア",
  "中東・アフリカ",
] as const;

const OVERSEAS_COUNTRIES: Record<string, string[]> = {
  "東南アジア":    ["タイ", "ベトナム", "バリ島", "シンガポール", "マレーシア", "フィリピン"],
  "東アジア":      ["韓国", "台湾", "中国", "香港"],
  "ヨーロッパ":    ["フランス", "イタリア", "スペイン", "イギリス", "ドイツ", "ポルトガル"],
  "ハワイ・グアム": ["ハワイ", "グアム", "サイパン"],
  "アメリカ・カナダ": ["アメリカ", "カナダ"],
  "オセアニア":    ["オーストラリア", "ニュージーランド"],
  "中東・アフリカ": ["UAE（ドバイ）", "エジプト", "南アフリカ"],
};

const SESSION_KEY = (pairId: string) => `suggest_cache_${pairId}`;

export const SuggestPage = () => {
  const navigate = useNavigate();
  const { generate, loading: generating } = useGenerateItems();
  const [genError, setGenError] = useState<string | null>(null);

  const { pairId, loading: pairLoading } = usePair();
  const [step, setStep] = useState<Step>("home");
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem("askAiIntroSeen"));
  const [hearing, setHearing] = useState<Hearing | null>(null);
  const [editHearing, setEditHearing] = useState<Partial<Hearing>>({});
  const [suggestions, setSuggestions] = useState<ItemDraft[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    if (pairLoading) return;
    if (!pairId) { navigate("/"); return; }
    (async () => {
      const snap = await getDoc(doc(db, "pairs", pairId));
      if (snap.exists()) {
        const h = snap.data().hearing as Hearing | undefined;
        if (h) setHearing(h);
      }
      // sessionStorage からキャッシュを復元
      try {
        const cached = sessionStorage.getItem(SESSION_KEY(pairId));
        if (cached) {
          const { suggestions: cachedSuggestions } = JSON.parse(cached) as { suggestions: ItemDraft[] };
          if (cachedSuggestions?.length > 0) {
            setSuggestions(cachedSuggestions);
          }
        }
      } catch {
        // キャッシュ読み込み失敗は無視
      }
      setInitLoading(false);
    })();
  }, [pairId, pairLoading, navigate]);

  const handleGenerate = async (overrideHearing?: Partial<Hearing>) => {
    const base = overrideHearing ?? hearing;
    if (!base) return;
    setGenError(null);
    setStep("generating");
    const items = await generate(base as Hearing);
    if (items) {
      setSuggestions(items);
      setSelected(new Set());
      // sessionStorage にキャッシュ保存
      if (pairId) {
        try {
          sessionStorage.setItem(SESSION_KEY(pairId), JSON.stringify({ suggestions: items }));
        } catch {
          // sessionStorage が使えない環境では無視
        }
      }
      setStep("results");
    } else {
      setGenError("提案の生成に失敗しました。もう一度お試しください。");
      setStep("home");
    }
  };

  const handleUpdateAndGenerate = async () => {
    if (!pairId) return;
    const merged = { ...hearing, ...editHearing } as Hearing;
    await updateDoc(doc(db, "pairs", pairId), {
      hearing: { ...merged, updatedAt: serverTimestamp() },
    });
    setHearing(merged);
    await handleGenerate(merged);
  };

  const toggleSelect = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!pairId || selected.size === 0) return;
    setSaving(true);
    const drafts = [...selected].map((i) => suggestions[i]);
    await addSuggestedItems(pairId, drafts);
    // キャッシュをクリア（追加済みのため）
    if (pairId) {
      try { sessionStorage.removeItem(SESSION_KEY(pairId)); } catch { /* ignore */ }
    }
    setSaving(false);
    setStep("done");
  };

  if (initLoading) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh",
                  background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>

      {/* ヘッダー */}
      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
                       padding: "14px 20px 10px",
                       borderBottom: "1px solid rgba(0,0,0,0.07)",
                       position: "sticky", top: 0, zIndex: 20,
                       background: "var(--color-bg)" }}>
        {(step === "update-hearing" || step === "results") && (
          <button
            onClick={() => setStep("home")}
            style={{ background: "none", border: "none", cursor: "pointer",
                     padding: "4px 8px 4px 0", color: "var(--color-text-mid)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, color: "var(--color-text-main)",
                     letterSpacing: "0.01em" }}>
          {step === "update-hearing" ? "プランを更新" : "おすすめ体験"}
        </h1>
        <img src="/logo.png" alt="KataLog" style={{ marginLeft: "auto", height: 18, objectFit: "contain" }} />
      </header>

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 80 }}>

        {/* ── ホーム ── */}
        {step === "home" && (
          <div style={{ padding: "24px 20px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ textAlign: "center", paddingTop: 8 }}>
              <div style={{ display: "inline-flex", marginBottom: 12 }}>
                <SparkleIcon size={40} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-main)",
                          lineHeight: 1.6 }}>
                AIがふたりにぴったりの<br />体験を新たに提案します
              </p>
            </div>

            {/* 現在のヒアリング内容 */}
            {hearing && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "16px",
                            border: "1px solid rgba(0,0,0,0.07)" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-soft)",
                            letterSpacing: "0.08em", marginBottom: 12 }}>
                  現在のプラン設定
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(hearing.genres ?? []).map((g) => {
                    const genre = GENRES.find((x) => x.id === g);
                    return genre ? (
                      <Chip key={g}>{genre.emoji} {genre.label}</Chip>
                    ) : null;
                  })}
                  {hearing.overseas
                    ? <Chip>✈️ {hearing.overseas}</Chip>
                    : hearing.prefecture === "全国"
                      ? <Chip>🗾 全国</Chip>
                      : <>
                          {hearing.prefecture && <Chip>{hearing.prefecture}</Chip>}
                          {hearing.range && <Chip>{RANGE_LABELS[hearing.range]}</Chip>}
                        </>
                  }
                  {hearing.indoor && <Chip>{INDOOR_LABELS[hearing.indoor]}</Chip>}
                  {hearing.budget && <Chip>{BUDGET_LABELS[hearing.budget]}</Chip>}
                  {hearing.children && <Chip>{CHILDREN_LABELS[hearing.children]}</Chip>}
                  {hearing.transport && <Chip>{TRANSPORT_LABELS[hearing.transport]}</Chip>}
                </div>
              </div>
            )}

            {genError && (
              <div style={{ padding: "12px 14px", background: "#FEF2F2",
                            border: "1px solid #FECACA", borderRadius: 10,
                            fontSize: 13, color: "#DC2626", lineHeight: 1.6 }}>
                {genError}
              </div>
            )}

            {!hearing && (
              <div style={{ padding: "12px 14px", background: "#FFFBEB",
                            border: "1px solid #FDE68A", borderRadius: 10,
                            fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>
                プランがまだ設定されていません。「プランを更新してから提案」から設定してください。
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={() => handleGenerate()}
                disabled={!hearing}
                style={{ width: "100%", padding: "16px", background: "var(--color-primary)",
                         color: "#fff", border: "none", borderRadius: 14, fontSize: 15,
                         fontWeight: 600, cursor: hearing ? "pointer" : "default",
                         opacity: hearing ? 1 : 0.4, fontFamily: "var(--font-sans)" }}>
                ✦ AIに提案してもらう
              </button>
              {suggestions.length > 0 && (
                <button
                  onClick={() => setStep("results")}
                  style={{ width: "100%", padding: "16px", background: "#fff",
                           color: "var(--color-primary)", border: "1px solid var(--color-primary)",
                           borderRadius: 14, fontSize: 14, cursor: "pointer",
                           fontFamily: "var(--font-sans)" }}>
                  前回の提案を見る（{suggestions.length}件）
                </button>
              )}
              <button
                onClick={() => { setEditHearing({ ...hearing }); setStep("update-hearing"); }}
                style={{ width: "100%", padding: "16px", background: "#fff",
                         color: "var(--color-text-mid)", border: "1px solid var(--color-border)",
                         borderRadius: 14, fontSize: 14, cursor: "pointer",
                         fontFamily: "var(--font-sans)" }}>
                プランを更新してから提案
              </button>
            </div>
          </div>
        )}

        {/* ── プランを更新 ── */}
        {step === "update-hearing" && (
          <UpdateHearingForm
            hearing={editHearing}
            onChange={setEditHearing}
            onSubmit={handleUpdateAndGenerate}
            submitting={generating}
          />
        )}

        {/* ── 生成中 ── */}
        {step === "generating" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", height: "100%", gap: 16, paddingTop: 80 }}>
            <p style={{ fontSize: 36 }}>✦</p>
            <p style={{ fontSize: 15, color: "var(--color-text-mid)", fontWeight: 500 }}>
              AIが提案を考えています...
            </p>
          </div>
        )}

        {/* ── 提案結果 ── */}
        {step === "results" && (
          <div style={{ padding: "16px 20px 120px" }}>
            <p style={{ fontSize: 13, color: "var(--color-text-mid)", marginBottom: 16,
                        lineHeight: 1.6 }}>
              追加したいアイテムをタップして選択してください。
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {suggestions.map((item, i) => {
                const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["その他"];
                const isSelected = selected.has(i);
                return (
                  <button key={i} onClick={() => toggleSelect(i)}
                          style={{ position: "relative", height: 130, borderRadius: 12,
                                   overflow: "hidden", border: isSelected
                                     ? "2.5px solid var(--color-primary)"
                                     : "2.5px solid transparent",
                                   cursor: "pointer", padding: 0 }}>
                    <div style={{ position: "absolute", inset: 0, background: s.bg }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex",
                                  alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 36, opacity: 0.75,
                                     filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>
                        {s.emoji}
                      </span>
                    </div>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 64,
                                  background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                                  pointerEvents: "none" }} />
                    {isSelected && (
                      <div style={{ position: "absolute", top: 8, right: 8,
                                    width: 20, height: 20, borderRadius: "50%",
                                    background: "var(--color-primary)",
                                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5"
                                strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                    <p style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                                padding: "8px 10px 9px", fontSize: 10, fontWeight: 500,
                                color: "#fff", lineHeight: 1.35, fontFamily: "var(--font-sans)",
                                display: "-webkit-box", WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {item.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 完了 ── */}
        {step === "done" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        gap: 16, padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: 44 }}>🎉</p>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-main)" }}>
              追加しました！
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.8 }}>
              {selected.size}件のアイテムをリストに追加しました。
            </p>
            <button onClick={() => navigate("/home")}
                    style={{ marginTop: 24, padding: "14px 32px",
                             background: "var(--color-primary)", color: "#fff",
                             border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600,
                             cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              リストを見る
            </button>
          </div>
        )}

      </div>

      {/* 機能説明ポップアップ */}
      {showIntro && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                      display: "flex", alignItems: "flex-end", zIndex: 100 }}>
          <div style={{ width: "100%", background: "var(--color-bg)", borderRadius: "20px 20px 0 0",
                        padding: "28px 24px 44px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "inline-flex", marginBottom: 8 }}>
                <SparkleIcon size={32} />
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text-main)" }}>
                SUGGEST とは？
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "🧭", text: "AIが新しい体験を提案します" },
                { icon: "💡", text: "いまのプランに合った体験に出会えます" },
                { icon: "👆", text: "気に入った体験をリストに追加しましょう！" },
              ].map(({ icon, text }) => (
                <div key={icon} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>{text}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { localStorage.setItem("askAiIntroSeen", "1"); setShowIntro(false); }}
                    style={{ marginTop: 8, padding: "14px", background: "var(--color-primary)",
                             color: "#fff", border: "none", borderRadius: 12, fontSize: 15,
                             fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              OK！使ってみる →
            </button>
          </div>
        </div>
      )}

      {/* 追加ボタン（results ステップのみ） BottomNavの上に配置 */}
      {step === "results" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
                      padding: "16px 20px 80px",
                      background: "linear-gradient(to top, var(--color-bg) 80%, transparent)" }}>
          <button onClick={handleAdd} disabled={selected.size === 0 || saving}
                  style={{ width: "100%", padding: "16px",
                           background: selected.size > 0 ? "var(--color-primary)" : "rgba(0,0,0,0.1)",
                           color: selected.size > 0 ? "#fff" : "var(--color-text-soft)",
                           border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600,
                           cursor: selected.size > 0 ? "pointer" : "default",
                           fontFamily: "var(--font-sans)",
                           transition: "background 0.2s" }}>
            {saving ? "追加中..." : selected.size > 0
              ? `${selected.size}件をリストに追加する`
              : "アイテムを選択してください"}
          </button>
        </div>
      )}

      {/* ── ボトムナビ ── */}
      <BottomNav />
    </div>
  );
};

// ── サブコンポーネント ──────────────────────────────

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20,
                 background: "rgba(0,0,0,0.06)", color: "var(--color-text-mid)" }}>
    {children}
  </span>
);

const UpdateHearingForm = ({
  hearing, onChange, onSubmit, submitting,
}: {
  hearing: Partial<Hearing>;
  onChange: (h: Partial<Hearing>) => void;
  onSubmit: () => void;
  submitting: boolean;
}) => {
  const set = (key: keyof Hearing, value: string | string[] | undefined) =>
    onChange({ ...hearing, [key]: value });
  const toggleGenre = (id: string) => {
    const genres = hearing.genres ?? [];
    set("genres", genres.includes(id) ? genres.filter((g) => g !== id) : [...genres, id]);
  };

  const isOverseas = !!hearing.overseas;

  // 海外エリアの3段階ローカル状態
  const initRegion = (): string => {
    const o = hearing.overseas;
    if (!o) return OVERSEAS_REGIONS[0];
    if ((OVERSEAS_REGIONS as readonly string[]).includes(o)) return o;
    for (const [r, cs] of Object.entries(OVERSEAS_COUNTRIES)) {
      if (cs.includes(o)) return r;
    }
    return OVERSEAS_REGIONS[0];
  };
  const initCountry = (): string => {
    const o = hearing.overseas;
    if (!o || (OVERSEAS_REGIONS as readonly string[]).includes(o)) return "";
    for (const cs of Object.values(OVERSEAS_COUNTRIES)) {
      if (cs.includes(o)) return o;
    }
    return "その他";
  };
  const initOther = (): string => {
    const o = hearing.overseas;
    if (!o || (OVERSEAS_REGIONS as readonly string[]).includes(o)) return "";
    for (const cs of Object.values(OVERSEAS_COUNTRIES)) {
      if (cs.includes(o)) return "";
    }
    return o;
  };

  const [overseasRegion, setOverseasRegion] = useState(initRegion);
  const [overseasCountry, setOverseasCountry] = useState(initCountry);
  const [otherText, setOtherText] = useState(initOther);

  const handleRegionSelect = (r: string) => {
    setOverseasRegion(r);
    setOverseasCountry("");
    setOtherText("");
    set("overseas", r);
  };

  const handleCountrySelect = (country: string) => {
    setOverseasCountry(country);
    if (country === "その他") {
      setOtherText("");
      set("overseas", overseasRegion);
    } else {
      // 未選択（""）のときも地域名を維持して海外モードを保つ
      set("overseas", country || overseasRegion);
    }
  };

  const handleOtherTextChange = (text: string) => {
    setOtherText(text);
    set("overseas", text || overseasRegion);
  };

  const canSubmit = (hearing.genres?.length ?? 0) > 0
    && !!hearing.children && !!hearing.transport
    && !!hearing.budget && !!hearing.indoor
    && (isOverseas || hearing.prefecture === "全国" || (!!hearing.prefecture && !!hearing.range));

  return (
    <div style={{ padding: "24px 20px 40px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ジャンル */}
      <FormSection label="好きな体験タイプ">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {GENRES.map((g) => {
            const selected = (hearing.genres ?? []).includes(g.id);
            return (
              <button key={g.id} onClick={() => toggleGenre(g.id)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                               borderRadius: 10, border: `1.5px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
                               background: selected ? "var(--color-primary-light)" : "#fff",
                               cursor: "pointer", fontSize: 13, color: "var(--color-text-main)",
                               fontFamily: "var(--font-sans)", textAlign: "left" }}>
                <span>{g.emoji}</span>
                <span style={{ fontSize: 12 }}>{g.label}</span>
              </button>
            );
          })}
        </div>
      </FormSection>

      {/* エリア */}
      <FormSection label="活動エリア">
        {/* 国内 / 海外 トグル */}
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <ToggleChip selected={!isOverseas} onClick={() => set("overseas", undefined)}>
            🏠 国内
          </ToggleChip>
          <ToggleChip selected={isOverseas} onClick={() => {
            if (!isOverseas) set("overseas", OVERSEAS_REGIONS[0]);
          }}>
            ✈️ 海外
          </ToggleChip>
        </div>

        {!isOverseas ? (
          <>
            {/* 全国 トグル */}
            <div style={{ marginBottom: 8 }}>
              <ToggleChip
                selected={hearing.prefecture === "全国"}
                onClick={() => {
                  if (hearing.prefecture === "全国") {
                    onChange({ ...hearing, prefecture: undefined });
                  } else {
                    onChange({ ...hearing, prefecture: "全国", range: undefined });
                  }
                }}
              >
                🗾 全国
              </ToggleChip>
            </div>
            {/* 全国以外のとき：都道府県＋範囲 */}
            {hearing.prefecture !== "全国" && (
              <>
                <select value={hearing.prefecture ?? ""} onChange={(e) => set("prefecture", e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", fontSize: 13,
                                 border: "1.5px solid var(--color-border)", borderRadius: 10,
                                 background: "#fff", color: "var(--color-text-main)",
                                 fontFamily: "var(--font-sans)", marginBottom: 8 }}>
                  <option value="">都道府県を選択</option>
                  {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  {RANGE_OPTIONS.map((r) => (
                    <ToggleChip key={r.id} selected={hearing.range === r.id} onClick={() => set("range", r.id)}>
                      {r.label}
                    </ToggleChip>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* エリアチップ（7地域） */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {OVERSEAS_REGIONS.map((r) => (
                <ToggleChip key={r} selected={overseasRegion === r} onClick={() => handleRegionSelect(r)}>
                  {r}
                </ToggleChip>
              ))}
            </div>
            {/* 国名プルダウン */}
            <select
              value={overseasCountry}
              onChange={(e) => handleCountrySelect(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13,
                       border: "1.5px solid var(--color-border)", borderRadius: 10,
                       background: "#fff", color: overseasCountry ? "var(--color-text-main)" : "var(--color-text-soft)",
                       fontFamily: "var(--font-sans)" }}>
              <option value="">国を選択（任意）</option>
              {(OVERSEAS_COUNTRIES[overseasRegion] ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="その他">その他</option>
            </select>
            {/* その他 → テキスト入力 */}
            {overseasCountry === "その他" && (
              <input
                value={otherText}
                onChange={(e) => handleOtherTextChange(e.target.value)}
                placeholder="国名を入力"
                maxLength={40}
                style={{ width: "100%", padding: "10px 12px", fontSize: 13,
                         border: "1.5px solid var(--color-border)", borderRadius: 10,
                         background: "#fff", color: "var(--color-text-main)",
                         fontFamily: "var(--font-sans)", boxSizing: "border-box" }} />
            )}
          </>
        )}
      </FormSection>

      {/* 屋内外・予算・子ども・移動手段 */}
      <FormSection label="屋内 / 屋外">
        <div style={{ display: "flex", gap: 8 }}>
          {INDOOR_OPTIONS.map((x) => (
            <ToggleChip key={x.id} selected={hearing.indoor === x.id} onClick={() => set("indoor", x.id)}>
              {x.label}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      <FormSection label="予算（1回・ふたり合計）">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {BUDGET_OPTIONS.map((b) => (
            <ToggleChip key={b.id} selected={hearing.budget === b.id} onClick={() => set("budget", b.id)}>
              {b.label}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      <FormSection label="お子さま">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CHILDREN_OPTIONS.map((c) => (
            <ToggleChip key={c.id} selected={hearing.children === c.id} onClick={() => set("children", c.id)}>
              {c.label}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      <FormSection label="移動手段">
        <div style={{ display: "flex", gap: 8 }}>
          {TRANSPORT_OPTIONS.map((t) => (
            <ToggleChip key={t.id} selected={hearing.transport === t.id} onClick={() => set("transport", t.id)}>
              {t.label}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      <FormSection label="その他リクエスト（任意）">
        <textarea value={hearing.freetext ?? ""} onChange={(e) => set("freetext", e.target.value)}
                  maxLength={100} rows={3} placeholder="例：ペットOKな場所が多め"
                  style={{ width: "100%", padding: "10px 12px", fontSize: 13,
                           border: "1.5px solid var(--color-border)", borderRadius: 10,
                           background: "#fff", color: "var(--color-text-main)",
                           fontFamily: "var(--font-sans)", resize: "none",
                           lineHeight: 1.6, boxSizing: "border-box" }} />
      </FormSection>

      <button onClick={onSubmit} disabled={!canSubmit || submitting}
              style={{ width: "100%", padding: "16px", background: "var(--color-primary)",
                       color: "#fff", border: "none", borderRadius: 14, fontSize: 15,
                       fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
                       opacity: !canSubmit || submitting ? 0.5 : 1 }}>
        {submitting ? "提案を生成中..." : "✦ 更新してAIに提案"}
      </button>
    </div>
  );
};

const FormSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-mid)" }}>{label}</p>
    {children}
  </div>
);

const SparkleIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <path d="M10 2L11.4 8.6L18 10L11.4 11.4L10 18L8.6 11.4L2 10L8.6 8.6Z"
          style={{ fill: "var(--color-accent)", stroke: "var(--color-accent)", strokeWidth: 0.6 }}/>
    <path d="M17.5 1L18.3 3.7L21 4.5L18.3 5.3L17.5 8L16.7 5.3L14 4.5L16.7 3.7Z"
          style={{ fill: "var(--color-accent)", stroke: "var(--color-accent)", strokeWidth: 0.5 }}/>
    <path d="M4.5 15L5 16.5L6.5 17L5 17.5L4.5 19L4 17.5L2.5 17L4 16.5Z"
          style={{ fill: "var(--color-accent)", stroke: "var(--color-accent)", strokeWidth: 0.4 }}/>
  </svg>
);

const ToggleChip = ({ selected, onClick, children }: {
  selected: boolean; onClick: () => void; children: React.ReactNode;
}) => (
  <button onClick={onClick}
          style={{ padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                   border: `1.5px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
                   background: selected ? "var(--color-primary-light)" : "#fff",
                   color: "var(--color-text-main)", fontFamily: "var(--font-sans)" }}>
    {children}
  </button>
);
