// src/features/memory/pages/MemoryPage.tsx
import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "../../../components/Loading";
import { BottomNav } from "../../../components/BottomNav";
import { useItems } from "../../items/hooks/useItems";
import { usePair } from "../../../contexts/PairContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../firebase/functions";
import { CATEGORY_STYLE, CATEGORY_LABEL } from "../../../lib/constants";
import { type Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase/firestore";
import { heroUrl } from "../../../lib/item";
import { useWeather } from "../../../hooks/useWeather";
import { scoreItem } from "../../../lib/scoring";
import type { Hearing, SavedMemory } from "../../../types";
import { saveMemory, deleteMemory, subscribeMemories } from "../services/memoryService";

const todayYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthStart = (ym: string): Date => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1, 0, 0, 0, 0);
};

const monthEnd = (ym: string): Date => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999);
};

const getAiLabel = (start: string, end: string): string => {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  if (start === end) return `${sy}年${sm}月`;
  const months = (ey - sy) * 12 + (em - sm) + 1;
  if (months <= 3) return `${sy}年${sm}月〜${ey}年${em}月`;
  if (months <= 6) return `${sy}年${sm}月〜${ey}年${em}月（半年程度）`;
  if (months <= 9) return `${sy}年${sm}月〜${ey}年${em}月（約3/4年）`;
  return `${sy}年${sm}月〜${ey}年${em}月（約1年間）`;
};

const fmtMonthYear = (d: Date, multiYear: boolean) =>
  multiYear ? `${d.getFullYear()}/${d.getMonth() + 1}月` : `${d.getMonth() + 1}月`;

const fmtDate = (ts: Timestamp): string => {
  const d = ts.toDate();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};

const fmtPeriod = (period: { from: Timestamp; to: Timestamp }): string => {
  const from = period.from.toDate();
  const to = period.to.toDate();
  const fy = from.getFullYear(), fm = from.getMonth() + 1;
  const ty = to.getFullYear(), tm = to.getMonth() + 1;
  if (fy === ty && fm === tm) return `${fy}年${fm}月`;
  if (fy === ty) return `${fy}年${fm}〜${tm}月`;
  return `${fy}/${fm}月〜${ty}/${tm}月`;
};

export const MemoryPage = () => {
  const navigate = useNavigate();
  const { pairId, loading: pairLoading } = usePair();
  const { items, loading } = useItems(pairId);

  const allDoneItems = items
    .filter((i) => i.status === "done")
    .sort((a, b) => {
      const diff = (a.completedAt?.toMillis() ?? 0) - (b.completedAt?.toMillis() ?? 0);
      if (diff !== 0) return diff;
      return (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0);
    });

  const todoItems = items.filter((i) => i.status !== "done");

  const [hearing, setHearing] = useState<Hearing | null>(null);
  useEffect(() => {
    if (!pairId) return;
    getDoc(doc(db, "pairs", pairId)).then((snap) => {
      if (snap.exists()) setHearing((snap.data() as { hearing?: Hearing }).hearing ?? null);
    });
  }, [pairId]);

  const weather = useWeather(hearing?.prefecture ?? undefined);

  const scoredTodos = useMemo(() => {
    if (!hearing) return todoItems.map((item) => ({ item, score: null as null }));
    const h = hearing;
    return todoItems
      .map((item) => ({ item, score: scoreItem(item, h, weather) }))
      .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
  }, [todoItems, hearing, weather]);

  // ── サブタブ ──────────────────────────────────
  const [subTab, setSubTab] = useState<"generate" | "archive">("generate");

  // ── 保存済み思い出 ──────────────────────────────
  const [memories, setMemories] = useState<SavedMemory[]>([]);
  useEffect(() => {
    if (!pairId) return;
    return subscribeMemories(pairId, setMemories);
  }, [pairId]);

  // ── 生成タブ状態 ──────────────────────────────
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem("memoryIntroSeen"));
  const [startMonth, setStartMonth] = useState(todayYM());
  const [endMonth, setEndMonth] = useState(todayYM());
  const periodRestoredRef = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [memory, setMemory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [outputFormat] = useState<"text">("text");

  // ── アーカイブタブ状態 ──────────────────────────
  const [typeFilter, setTypeFilter] = useState<"all" | "text" | "image" | "video" | "music">("all");
  const [selectedMemory, setSelectedMemory] = useState<SavedMemory | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── ボトムシートスワイプ ──────────────────────────
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetTouchStartY = useRef(-1);
  const handleSheetTouchStart = (e: React.TouchEvent) => {
    // スクロールエリア内のタッチは無視（スワイプで閉じる動作を抑制）
    if (sheetRef.current?.contains(e.target as Node)) return;
    sheetTouchStartY.current = e.touches[0].clientY;
  };
  const handleSheetTouchEnd = (e: React.TouchEvent) => {
    if (sheetTouchStartY.current < 0) return;
    const delta = e.changedTouches[0].clientY - sheetTouchStartY.current;
    sheetTouchStartY.current = -1;
    if (delta > 60 && (sheetRef.current?.scrollTop ?? 0) === 0) {
      setSelectedMemory(null);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    if (!pairLoading && !pairId) navigate("/");
  }, [pairId, pairLoading, navigate]);

  useEffect(() => {
    if (!pairId || periodRestoredRef.current) return;
    periodRestoredRef.current = true;
    try {
      const saved = sessionStorage.getItem(`memory_period_${pairId}`);
      if (saved) {
        const { s, e } = JSON.parse(saved) as { s: string; e: string };
        setStartMonth(s);
        setEndMonth(e);
      }
    } catch { /* ignore */ }
  }, [pairId]);

  const savePeriod = (s: string, e: string) => {
    if (pairId) sessionStorage.setItem(`memory_period_${pairId}`, JSON.stringify({ s, e }));
  };

  const handleSetStart = (v: string) => {
    const newStart = v > endMonth ? endMonth : v;
    setStartMonth(newStart);
    savePeriod(newStart, endMonth);
    setMemory(null); setGenError(null); setSavedFlag(false);
  };

  const handleSetEnd = (v: string) => {
    const today = todayYM();
    const newEnd = v > today ? today : v < startMonth ? startMonth : v;
    setEndMonth(newEnd);
    savePeriod(startMonth, newEnd);
    setMemory(null); setGenError(null); setSavedFlag(false);
  };

  const filteredDoneItems = allDoneItems.filter((i) => {
    const ts = i.completedAt as Timestamp | undefined;
    if (!ts) return false;
    const d = ts.toDate();
    return d >= monthStart(startMonth) && d <= monthEnd(endMonth);
  });

  const years = new Set(
    filteredDoneItems.map((i) => (i.completedAt as Timestamp).toDate().getFullYear())
  );
  const multiYear = years.size > 1;

  const periodLabel = startMonth === endMonth
    ? (startMonth === todayYM() ? "今月" : (() => { const [y, m] = startMonth.split("-").map(Number); return `${y}年${m}月`; })())
    : (() => {
        const [sy, sm] = startMonth.split("-").map(Number);
        const [ey, em] = endMonth.split("-").map(Number);
        return sy === ey ? `${sy}年${sm}〜${em}月` : `${sy}/${sm}月〜${ey}/${em}月`;
      })();

  const handleGenerate = async () => {
    if (filteredDoneItems.length === 0) return;
    setGenerating(true);
    setGenError(null);
    setMemory(null);
    setSavedFlag(false);
    try {
      const fn = httpsCallable<
        {
          items: { title: string; category: string; rating: number | null; memo: string | null; completedMonth: string }[];
          todoItems: { title: string; category: string }[];
          period: string;
        },
        { memory: string }
      >(functions, "generateMemory");
      const payload = filteredDoneItems.map((i) => ({
        title: i.title,
        category: CATEGORY_LABEL[i.category] ?? i.category,
        rating: i.rating,
        memo: i.memo,
        completedMonth: i.completedAt
          ? `${(i.completedAt as Timestamp).toDate().getMonth() + 1}月`
          : "",
      }));
      const topTodos = scoredTodos
        .slice(0, 5)
        .map(({ item }) => ({ title: item.title, category: CATEGORY_LABEL[item.category] ?? item.category }));
      const result = await fn({
        items: payload,
        todoItems: topTodos,
        period: getAiLabel(startMonth, endMonth),
      });
      const raw = result.data.memory
        .replace(/\[体験に合う絵文字\]/g, "✨")
        .replace(/^[぀-鿿]{1,8}(?=【)/gm, "✨");
      setMemory(raw);
    } catch {
      setGenError("生成に失敗しました。もう一度お試しください。");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!memory) return;
    await navigator.clipboard.writeText(memory);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!memory || !pairId || savedFlag) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveMemory(pairId, {
        title: `${periodLabel}の思い出`,
        content: memory,
        period: { from: monthStart(startMonth), to: monthEnd(endMonth) },
        itemCount: filteredDoneItems.length,
      });
      setSavedFlag(true);
    } catch {
      setSaveError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMemory || !pairId) return;
    setDeleting(true);
    try {
      await deleteMemory(pairId, selectedMemory.memoryId);
      setSelectedMemory(null);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const filteredMemories = typeFilter === "all"
    ? memories
    : memories.filter((m) => m.type === typeFilter);

  if (pairLoading || loading) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh",
                  background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>

      {/* ヘッダー */}
      <header style={{ flexShrink: 0, padding: "12px 20px 0",
                       background: "var(--color-bg)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", paddingBottom: 10,
                      borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo.png" alt="KataLog" style={{ height: 20, objectFit: "contain" }} />
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 11,
                           color: "var(--color-text-soft)", letterSpacing: "0.04em" }}>
              思い出を、かたちに。
            </span>
          </div>
          <h1 style={{ marginLeft: "auto", fontFamily: "var(--font-serif)", fontSize: 17,
                       fontWeight: 600, color: "var(--color-text-main)", letterSpacing: "0.01em" }}>
            かたログ
          </h1>
        </div>

        {/* サブタブ */}
        <div style={{ display: "flex", gap: 0 }}>
          {([["generate", "思い出"], ["archive", "アルバム"]] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setSubTab(tab)}
                    style={{ padding: "10px 20px", fontSize: 13, fontWeight: subTab === tab ? 600 : 400,
                             color: subTab === tab ? "var(--color-primary)" : "var(--color-text-mid)",
                             background: "transparent", border: "none",
                             borderBottom: `2px solid ${subTab === tab ? "var(--color-primary)" : "transparent"}`,
                             cursor: "pointer", fontFamily: "var(--font-sans)", marginBottom: -1 }}>
              {label}
              {tab === "archive" && memories.length > 0 && (
                <span style={{ marginLeft: 5, fontSize: 10, background: "var(--color-primary)",
                               color: "#fff", borderRadius: 10, padding: "1px 6px" }}>
                  {memories.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── 生成タブ ── */}
      {subTab === "generate" && (
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 80 }}>

          {/* 期間選択 */}
          {(() => {
            const currentYear = new Date().getFullYear();
            const minYear = allDoneItems.length > 0
              ? Math.min(currentYear - 2, ...allDoneItems.map((i) => (i.completedAt as Timestamp).toDate().getFullYear()))
              : currentYear - 2;
            const yearOptions = Array.from({ length: currentYear - minYear + 1 }, (_, k) => currentYear - k).reverse();
            const [sY, sM] = startMonth.split("-").map(Number);
            const [eY, eM] = endMonth.split("-").map(Number);
            const selStyle = {
              fontSize: 12, border: "1px solid var(--color-border)",
              borderRadius: 8, padding: "4px 6px", background: "var(--color-bg)",
              color: "var(--color-text-main)", fontFamily: "var(--font-sans)", outline: "none",
            } as const;
            const mkYM = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
            return (
              <div style={{ position: "sticky", top: 0, zIndex: 15, padding: "8px 16px",
                            background: "var(--color-bg)", borderBottom: "1px solid rgba(0,0,0,0.05)",
                            display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--color-text-soft)", flexShrink: 0 }}>期間</span>
                <select value={sY} onChange={(e) => handleSetStart(mkYM(Number(e.target.value), sM))} style={selStyle}>
                  {yearOptions.map((y) => <option key={y} value={y}>{y}年</option>)}
                </select>
                <select value={sM} onChange={(e) => handleSetStart(mkYM(sY, Number(e.target.value)))} style={selStyle}>
                  {Array.from({ length: 12 }, (_, k) => k + 1).map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
                <span style={{ fontSize: 12, color: "var(--color-text-soft)", flexShrink: 0 }}>〜</span>
                <select value={eY} onChange={(e) => handleSetEnd(mkYM(Number(e.target.value), eM))} style={selStyle}>
                  {yearOptions.map((y) => <option key={y} value={y}>{y}年</option>)}
                </select>
                <select value={eM} onChange={(e) => handleSetEnd(mkYM(eY, Number(e.target.value)))} style={selStyle}>
                  {Array.from({ length: 12 }, (_, k) => k + 1).map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
              </div>
            );
          })()}

          {allDoneItems.length === 0 ? (
            <div style={{ padding: "60px 32px", textAlign: "center" }}>
              <p style={{ fontSize: 40, marginBottom: 16 }}>📖</p>
              <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-main)",
                          marginBottom: 8, lineHeight: 1.6 }}>
                まだ完了した体験がありません
              </p>
              <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>
                リストのアイテムを体験したら<br />「完了」にチェックしましょう。<br />
                AIが思い出を文章にしてくれます。
              </p>
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                <button onClick={() => navigate("/home")}
                        style={{ padding: "12px 28px", background: "var(--color-primary)", color: "#fff",
                                 border: "none", borderRadius: 24, fontSize: 13, fontWeight: 500,
                                 cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                  リストを見る
                </button>
                <button onClick={() => navigate("/suggest")}
                        style={{ padding: "10px 24px", background: "transparent",
                                 color: "var(--color-primary)", border: "1px solid var(--color-primary)",
                                 borderRadius: 24, fontSize: 13, fontWeight: 500,
                                 cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                  おすすめ体験へ →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 24 }}>

              {/* 進捗サマリー */}
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 20px",
                            border: "1px solid rgba(0,0,0,0.07)",
                            display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "center", minWidth: 40 }}>
                  <p style={{ fontSize: 28, fontWeight: 700, color: "var(--color-primary)",
                              fontFamily: "var(--font-sans)", lineHeight: 1 }}>
                    {filteredDoneItems.length}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--color-text-soft)", marginTop: 2 }}>
                    件の体験
                  </p>
                </div>
                <div style={{ flex: 1, borderLeft: "1px solid var(--color-border)", paddingLeft: 16 }}>
                  <p style={{ fontSize: 11, color: "var(--color-text-mid)", lineHeight: 2.2 }}>
                    <strong>{periodLabel}</strong>に完了した体験は
                    <strong>{filteredDoneItems.length}件</strong>です。<br />
                    この期間の思い出を振り返りましょう。
                  </p>
                </div>
              </div>

              {filteredDoneItems.length === 0 ? (
                <div style={{ padding: "32px 24px", textAlign: "center",
                              background: "#fff", borderRadius: 14,
                              border: "1px solid rgba(0,0,0,0.07)" }}>
                  <p style={{ fontSize: 13, color: "var(--color-text-soft)", marginBottom: 16 }}>
                    {periodLabel}に完了した体験はありません
                  </p>
                  <button onClick={() => navigate("/suggest")}
                          style={{ padding: "10px 24px", background: "transparent",
                                   color: "var(--color-primary)", border: "1px solid var(--color-primary)",
                                   borderRadius: 24, fontSize: 13, fontWeight: 500,
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    ✦ おすすめ体験へ →
                  </button>
                </div>
              ) : (
                <>
                  {/* 体験記録（月セクション） */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-soft)",
                                letterSpacing: "0.08em", marginBottom: 10 }}>
                      体験記録
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {filteredDoneItems.map((item, idx) => {
                        const d = (item.completedAt as Timestamp).toDate();
                        const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
                        const prevD = idx > 0 && filteredDoneItems[idx - 1].completedAt
                          ? (filteredDoneItems[idx - 1].completedAt as Timestamp).toDate() : null;
                        const prevKey = prevD ? `${prevD.getFullYear()}-${prevD.getMonth()}` : null;
                        const showMonth = monthKey !== prevKey;
                        const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["other"];

                        return (
                          <Fragment key={item.itemId}>
                            {showMonth && (
                              <p style={{ fontSize: 12, fontWeight: 600,
                                          color: "var(--color-text-mid)",
                                          letterSpacing: "0.08em", fontFamily: "var(--font-sans)",
                                          paddingTop: idx === 0 ? 0 : 8 }}>
                                {fmtMonthYear(d, multiYear)}
                              </p>
                            )}
                            <button
                              onClick={() => navigate(`/home/${item.itemId}`, { state: { from: "/memory" } })}
                              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%",
                                       background: "#fff", borderRadius: 10, textAlign: "left",
                                       border: "1px solid rgba(0,0,0,0.06)", padding: "10px 14px",
                                       cursor: "pointer" }}>
                              <div style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                                            overflow: "hidden", background: s.bg,
                                            display: "flex", alignItems: "center",
                                            justifyContent: "center", fontSize: 20 }}>
                                {heroUrl(item) ? (
                                  <img src={heroUrl(item)!} alt={item.title} loading="lazy"
                                       style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : s.emoji}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-main)",
                                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {item.title}
                                </p>
                                <p style={{ fontSize: 10, color: "var(--color-text-soft)", marginTop: 2 }}>
                                  {CATEGORY_LABEL[item.category] ?? item.category}
                                  {item.rating != null && ` · ${"★".repeat(item.rating) + "☆".repeat(5 - item.rating)}`}
                                </p>
                              </div>
                              {item.memo && (
                                <p style={{ fontSize: 10, color: "var(--color-text-mid)", maxWidth: 80,
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            flexShrink: 0 }}>
                                  {item.memo}
                                </p>
                              )}
                            </button>
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* 出力形式 + 生成ボタン */}
                  {!memory && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-soft)",
                                    letterSpacing: "0.08em", marginBottom: 8 }}>
                          出力形式
                        </p>
                        <div style={{ display: "flex", gap: 6 }}>
                          {([
                            ["text",   "📝 テキスト",   true],
                            ["visual", "🎨 画像", false],
                            ["movie",  "🎬 動画",   false],
                          ] as const).map(([val, lbl, active]) => (
                            <button key={val}
                                    style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20,
                                             border: outputFormat === val ? "none" : "1px solid rgba(0,0,0,0.12)",
                                             background: outputFormat === val ? "var(--color-text-main)" : "transparent",
                                             color: outputFormat === val ? "var(--color-bg)" : active ? "var(--color-text-main)" : "var(--color-text-soft)",
                                             cursor: active ? "pointer" : "default",
                                             fontFamily: "var(--font-sans)", opacity: active ? 1 : 0.4,
                                             whiteSpace: "nowrap" }}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={handleGenerate} disabled={generating}
                              style={{ width: "100%", padding: "16px",
                                       background: generating ? "rgba(0,0,0,0.08)" : "var(--color-primary)",
                                       color: generating ? "var(--color-text-soft)" : "#fff",
                                       border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600,
                                       cursor: generating ? "default" : "pointer",
                                       fontFamily: "var(--font-sans)", transition: "background 0.2s" }}>
                        {generating ? "生成中…" : "思い出を振り返る"}
                      </button>
                    </div>
                  )}
                  {genError && (
                    <p style={{ fontSize: 13, color: "#e03030", textAlign: "center" }}>{genError}</p>
                  )}

                  {/* 生成結果 */}
                  {memory && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ background: "#fff", borderRadius: 14, padding: "20px",
                                    border: "1px solid rgba(0,0,0,0.07)",
                                    boxShadow: "0 2px 12px rgba(30,45,90,0.06)" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-main)",
                                    textAlign: "center", fontFamily: "var(--font-sans)", marginBottom: 10 }}>
                          {periodLabel}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                          <div style={{ height: 1, flex: 1, background: "var(--color-border)" }} />
                          <p style={{ fontSize: 10, color: "var(--color-accent)", letterSpacing: "0.12em",
                                      fontFamily: "var(--font-sans)", fontWeight: 500 }}>
                            あなたの思い出
                          </p>
                          <div style={{ height: 1, flex: 1, background: "var(--color-border)" }} />
                        </div>
                        <p style={{ fontSize: 14, color: "var(--color-text-main)", lineHeight: 2,
                                    fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>
                          {memory}
                        </p>
                      </div>

                      {/* アクション */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={handleSave} disabled={saving || savedFlag}
                                  style={{ flex: 1, padding: "12px",
                                           background: savedFlag ? "rgba(0,0,0,0.05)" : "var(--color-primary)",
                                           color: savedFlag ? "var(--color-text-soft)" : "#fff",
                                           border: savedFlag ? "1px solid var(--color-border)" : "none",
                                           borderRadius: 12, fontSize: 13, fontWeight: 600,
                                           cursor: saving || savedFlag ? "default" : "pointer",
                                           fontFamily: "var(--font-sans)", transition: "all 0.2s" }}>
                            {saving ? "保存中..." : savedFlag ? "✅ 保存しました" : "💾 保存する"}
                          </button>
                          <button onClick={handleCopy}
                                  style={{ flex: 1, padding: "12px", background: "#fff",
                                           color: copied ? "var(--color-primary)" : "var(--color-text-mid)",
                                           border: "1px solid var(--color-border)", borderRadius: 12,
                                           fontSize: 13, fontWeight: 500, cursor: "pointer",
                                           fontFamily: "var(--font-sans)", transition: "color 0.2s" }}>
                            {copied ? "✅ コピー済み" : "📋 コピー"}
                          </button>
                        </div>
                        {saveError && (
                          <p style={{ fontSize: 12, color: "#e03030", textAlign: "center" }}>{saveError}</p>
                        )}
                        <button onClick={handleGenerate} disabled={generating}
                                style={{ width: "100%", padding: "11px", background: "#fff",
                                         color: "var(--color-text-mid)",
                                         border: "1px solid var(--color-border)", borderRadius: 12,
                                         fontSize: 13, fontWeight: 500, cursor: generating ? "default" : "pointer",
                                         fontFamily: "var(--font-sans)" }}>
                          {generating ? "振り返り中..." : "🔄 もう1回実行"}
                        </button>
                      </div>

                      {/* 次のおすすめプラン */}
                      {scoredTodos.length > 0 && (
                        <div style={{ background: "#fff", borderRadius: 14, padding: "16px 20px",
                                      border: "1px solid rgba(0,0,0,0.07)" }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-soft)",
                                      letterSpacing: "0.08em", marginBottom: 12 }}>
                            次のおすすめプラン
                          </p>
                          {scoredTodos.slice(0, 5).map(({ item, score }, idx) => {
                            const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["other"];
                            return (
                              <button key={item.itemId}
                                      onClick={() => navigate(`/home/${item.itemId}`, { state: { from: "/memory" } })}
                                      style={{ display: "flex", alignItems: "center", gap: 12,
                                               width: "100%", background: "transparent",
                                               border: "none", textAlign: "left", cursor: "pointer",
                                               padding: "10px 0",
                                               borderBottom: idx < Math.min(scoredTodos.length, 5) - 1
                                                 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                                              overflow: "hidden", background: s.bg,
                                              display: "flex", alignItems: "center",
                                              justifyContent: "center", fontSize: 18 }}>
                                  {heroUrl(item) ? (
                                    <img src={heroUrl(item)!} alt={item.title} loading="lazy"
                                         style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : s.emoji}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-main)",
                                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {item.title}
                                  </p>
                                  <p style={{ fontSize: 10, color: "var(--color-text-soft)", marginTop: 2 }}>
                                    {CATEGORY_LABEL[item.category] ?? item.category}
                                  </p>
                                </div>
                                {score !== null && (
                                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                                    <p style={{ fontSize: 12, fontWeight: 700,
                                                color: score.total >= 60 ? "var(--color-primary)" : "var(--color-text-soft)" }}>
                                      {score.total}
                                    </p>
                                    <p style={{ fontSize: 9, color: "var(--color-text-soft)", marginTop: 1 }}>
                                      おすすめ度
                                    </p>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 保存済みタブ ── */}
      {subTab === "archive" && (
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 80 }}>

          {/* 形式フィルタ */}
          <div style={{ position: "sticky", top: 0, zIndex: 15, padding: "10px 16px",
                        background: "var(--color-bg)", borderBottom: "1px solid rgba(0,0,0,0.05)",
                        display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
            {([
              ["all",   "すべて"],
              ["text",  "📝 テキスト"],
              ["image", "🎨 画像"],
              ["video", "🎬 動画"],
              ["music", "🎵 音楽"],
            ] as const).map(([val, lbl]) => {
              const isActive = val === "all" || val === "text";
              const selected = typeFilter === val;
              return (
                <button key={val}
                        onClick={() => isActive && setTypeFilter(val)}
                        style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, whiteSpace: "nowrap",
                                 border: selected ? "none" : "1px solid rgba(0,0,0,0.12)",
                                 background: selected ? "var(--color-text-main)" : "transparent",
                                 color: selected ? "var(--color-bg)" : isActive ? "var(--color-text-main)" : "var(--color-text-soft)",
                                 cursor: isActive ? "pointer" : "default",
                                 fontFamily: "var(--font-sans)", opacity: isActive ? 1 : 0.45 }}>
                  {lbl}
                </button>
              );
            })}
          </div>

          {filteredMemories.length === 0 ? (
            <div style={{ padding: "60px 32px", textAlign: "center" }}>
              <p style={{ fontSize: 40, marginBottom: 16 }}>💾</p>
              <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-main)",
                          marginBottom: 8, lineHeight: 1.6 }}>
                記録された思い出はありません
              </p>
              <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>
                「思い出」タブで思い出を振り返り、<br />「保存する」でアルバムに残しましょう。
              </p>
              <button onClick={() => setSubTab("generate")}
                      style={{ marginTop: 20, padding: "12px 28px",
                               background: "var(--color-primary)", color: "#fff",
                               border: "none", borderRadius: 24, fontSize: 13, fontWeight: 500,
                               cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                思い出を振り返る →
              </button>
            </div>
          ) : (
            <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredMemories.map((mem) => (
                <button key={mem.memoryId} onClick={() => { setSelectedMemory(mem); setConfirmDelete(false); }}
                        style={{ width: "100%", textAlign: "left", border: "none",
                                 borderRadius: 14, overflow: "hidden", cursor: "pointer",
                                 background: "linear-gradient(135deg, #1A2248, #2A3460)",
                                 padding: "20px 20px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)",
                                   color: "rgba(255,255,255,0.9)", borderRadius: 10,
                                   padding: "2px 8px", fontFamily: "var(--font-sans)" }}>
                      📝 テキスト
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginLeft: "auto",
                                   fontFamily: "var(--font-sans)" }}>
                      {fmtDate(mem.createdAt)}
                    </span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#fff",
                              fontFamily: "var(--font-sans)", marginBottom: 8 }}>
                    {mem.title}
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)",
                              fontFamily: "var(--font-sans)", lineHeight: 1.7,
                              display: "-webkit-box", WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {mem.content}
                  </p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)",
                              fontFamily: "var(--font-sans)", marginTop: 10 }}>
                    {fmtPeriod(mem.period)} · {mem.itemCount}件の体験
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 機能説明ポップアップ ── */}
      {showIntro && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                      display: "flex", alignItems: "flex-end", zIndex: 100 }}>
          <div style={{ width: "100%", background: "var(--color-bg)", borderRadius: "20px 20px 0 0",
                        padding: "28px 24px 44px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>📖</p>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text-main)" }}>
                かたログとは？
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "🧠", text: "AIが過去の体験を文章でまとめます" },
                { icon: "📌", text: "記録された思い出は、いつでも振り返れます" },
                { icon: "💾", text: "素敵な思い出は、かたちとして残しましょう！" },
              ].map(({ icon, text }) => (
                <div key={icon} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>{text}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => { localStorage.setItem("memoryIntroSeen", "1"); setShowIntro(false); }}
              style={{ marginTop: 8, padding: "14px", background: "var(--color-primary)",
                       color: "#fff", border: "none", borderRadius: 12, fontSize: 15,
                       fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              OK！使ってみる →
            </button>
          </div>
        </div>
      )}

      {/* ── 思い出詳細ボトムシート ── */}
      {selectedMemory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                      display: "flex", alignItems: "flex-end", zIndex: 100 }}
             onClick={() => { setSelectedMemory(null); setConfirmDelete(false); }}>
          <div onClick={(e) => e.stopPropagation()}
               onTouchStart={handleSheetTouchStart}
               onTouchEnd={handleSheetTouchEnd}
               style={{ width: "100%", background: "var(--color-bg)", borderRadius: "20px 20px 0 0",
                        maxHeight: "88dvh", display: "flex", flexDirection: "column",
                        overflow: "hidden" }}>
            {/* ドラッグインジケーター */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)" }} />
            </div>

            {/* ヘッダー */}
            <div style={{ padding: "0 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-main)",
                          fontFamily: "var(--font-sans)" }}>
                {selectedMemory.title}
              </p>
              <p style={{ fontSize: 11, color: "var(--color-text-soft)", marginTop: 4,
                          fontFamily: "var(--font-sans)" }}>
                {fmtPeriod(selectedMemory.period)} · {selectedMemory.itemCount}件の体験 · {fmtDate(selectedMemory.createdAt)}保存
              </p>
            </div>

            {/* 本文 */}
            <div ref={sheetRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px",
                                         overscrollBehavior: "contain", scrollbarWidth: "none" }}>
              <p style={{ fontSize: 14, color: "var(--color-text-main)", lineHeight: 2,
                          fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>
                {selectedMemory.content}
              </p>
            </div>

            {/* アクション */}
            <div style={{ padding: "12px 20px 40px", borderTop: "1px solid rgba(0,0,0,0.06)",
                          flexShrink: 0 }}>
              {confirmDelete ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 13, color: "var(--color-text-main)", textAlign: "center",
                               fontFamily: "var(--font-sans)", marginBottom: 4 }}>
                    この思い出を削除しますか？
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setConfirmDelete(false)}
                            style={{ flex: 1, padding: "12px", background: "#fff",
                                     color: "var(--color-text-mid)", border: "1px solid var(--color-border)",
                                     borderRadius: 12, fontSize: 13, fontWeight: 500,
                                     cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                      キャンセル
                    </button>
                    <button onClick={handleDelete} disabled={deleting}
                            style={{ flex: 1, padding: "12px", background: "#e03030",
                                     color: "#fff", border: "none",
                                     borderRadius: 12, fontSize: 13, fontWeight: 600,
                                     cursor: deleting ? "default" : "pointer",
                                     fontFamily: "var(--font-sans)" }}>
                      {deleting ? "削除中..." : "削除する"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmDelete(true)}
                          style={{ padding: "12px 20px", background: "#fff",
                                   color: "#e03030", border: "1px solid rgba(224,48,48,0.3)",
                                   borderRadius: 12, fontSize: 13, fontWeight: 500,
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    🗑 削除
                  </button>
                  <button onClick={() => { setSelectedMemory(null); setConfirmDelete(false); }}
                          style={{ flex: 1, padding: "12px", background: "var(--color-primary)",
                                   color: "#fff", border: "none",
                                   borderRadius: 12, fontSize: 13, fontWeight: 600,
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    閉じる
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};
