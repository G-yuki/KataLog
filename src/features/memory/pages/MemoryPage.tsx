// src/features/memory/pages/MemoryPage.tsx
import { useState, useEffect, useRef, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "../../../components/Loading";
import { BottomNav } from "../../../components/BottomNav";
import { useItems } from "../../items/hooks/useItems";
import { usePair } from "../../../contexts/PairContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../firebase/functions";
import { CATEGORY_STYLE } from "../../../lib/constants";
import { type Timestamp } from "firebase/firestore";

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

  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem("memoryIntroSeen"));
  const [startMonth, setStartMonth] = useState(todayYM());
  const [endMonth, setEndMonth] = useState(todayYM());
  const periodRestoredRef = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [memory, setMemory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (!pairLoading && !pairId) navigate("/");
  }, [pairId, pairLoading, navigate]);

  // 期間を sessionStorage で保持（戻り時リセット防止）
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
    setMemory(null); setGenError(null);
  };

  const handleSetEnd = (v: string) => {
    const today = todayYM();
    const newEnd = v > today ? today : v < startMonth ? startMonth : v;
    setEndMonth(newEnd);
    savePeriod(startMonth, newEnd);
    setMemory(null); setGenError(null);
  };

  const filteredDoneItems = allDoneItems.filter((i) => {
    const ts = i.completedAt as Timestamp | undefined;
    if (!ts) return false;
    const d = ts.toDate();
    return d >= monthStart(startMonth) && d <= monthEnd(endMonth);
  });

  // 月セクション用: 複数年にまたがるか
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
        category: i.category,
        rating: i.rating,
        memo: i.memo,
        completedMonth: i.completedAt
          ? `${(i.completedAt as Timestamp).toDate().getMonth() + 1}月`
          : "",
      }));
      const result = await fn({
        items: payload,
        todoItems: todoItems.map((i) => ({ title: i.title, category: i.category })),
        period: getAiLabel(startMonth, endMonth),
      });
      // AI が絵文字プレースホルダーをそのまま出力した場合のフォールバック
      const raw = result.data.memory.replace(/\[体験に合う絵文字\]/g, "📍");
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

  if (pairLoading || loading) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh",
                  background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>

      {/* ヘッダー */}
      <header style={{ flexShrink: 0, padding: "14px 20px 10px",
                       borderBottom: "1px solid rgba(0,0,0,0.07)",
                       position: "sticky", top: 0, zIndex: 20,
                       background: "var(--color-bg)",
                       display: "flex", alignItems: "center" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600,
                     color: "var(--color-text-main)", letterSpacing: "0.01em" }}>
          かたログ
        </h1>
        <img src="/logo.png" alt="KataLog" style={{ marginLeft: "auto", height: 20, objectFit: "contain" }} />
      </header>

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 80 }}>

        {/* 期間選択（年・月セレクト） */}
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
              AIがふたりの思い出を文章にしてくれます。
            </p>
            <button onClick={() => navigate("/home")}
                    style={{ marginTop: 24, padding: "12px 28px",
                             background: "var(--color-primary)", color: "#fff",
                             border: "none", borderRadius: 24, fontSize: 13, fontWeight: 500,
                             cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              リストを見る
            </button>
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
                <p style={{ fontSize: 13, color: "var(--color-text-soft)" }}>
                  {periodLabel}に完了した体験はありません
                </p>
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
                      const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["その他"];

                      return (
                        <Fragment key={item.itemId}>
                          {showMonth && (
                            <p style={{ fontSize: 12, fontWeight: 600,
                                        color: "var(--color-text-mid)",
                                        letterSpacing: "0.08em",
                                        fontFamily: "var(--font-sans)",
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
                            <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                          background: s.bg, display: "flex", alignItems: "center",
                                          justifyContent: "center", fontSize: 16 }}>
                              {s.emoji}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-main)",
                                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {item.title}
                              </p>
                              <p style={{ fontSize: 10, color: "var(--color-text-soft)", marginTop: 2 }}>
                                {item.category}
                                {item.rating != null && ` · ${"★".repeat(item.rating)}`}
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

                {/* 生成ボタン */}
                {!memory && (
                  <button onClick={handleGenerate} disabled={generating}
                          style={{ width: "100%", padding: "16px",
                                   background: generating ? "rgba(0,0,0,0.08)" : "var(--color-primary)",
                                   color: generating ? "var(--color-text-soft)" : "#fff",
                                   border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600,
                                   cursor: generating ? "default" : "pointer",
                                   fontFamily: "var(--font-sans)", transition: "background 0.2s" }}>
                    {generating ? "思い出を生成中..." : "📖 AIで思い出を振り返る"}
                  </button>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <div style={{ height: 1, flex: 1, background: "var(--color-border)" }} />
                        <p style={{ fontSize: 10, color: "var(--color-accent)", letterSpacing: "0.12em",
                                    fontFamily: "var(--font-sans)", fontWeight: 500 }}>
                          ふたりの記録
                        </p>
                        <div style={{ height: 1, flex: 1, background: "var(--color-border)" }} />
                      </div>
                      <p style={{ fontSize: 14, color: "var(--color-text-main)", lineHeight: 2,
                                  fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>
                        {memory}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={handleCopy}
                              style={{ flex: 1, padding: "12px", background: "#fff",
                                       color: copied ? "var(--color-primary)" : "var(--color-text-mid)",
                                       border: "1px solid var(--color-border)", borderRadius: 12,
                                       fontSize: 13, fontWeight: 500, cursor: "pointer",
                                       fontFamily: "var(--font-sans)", transition: "color 0.2s" }}>
                        {copied ? "✅ コピーしました" : "📋 コピー"}
                      </button>
                      <button onClick={handleGenerate} disabled={generating}
                              style={{ flex: 1, padding: "12px", background: "#fff",
                                       color: "var(--color-text-mid)",
                                       border: "1px solid var(--color-border)", borderRadius: 12,
                                       fontSize: 13, fontWeight: 500, cursor: "pointer",
                                       fontFamily: "var(--font-sans)" }}>
                        {generating ? "生成中..." : "🔄 再生成"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
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
              <p style={{ fontSize: 32, marginBottom: 8 }}>📖</p>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text-main)" }}>
                思い出 — ふたりのかたログ — とは？
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "🧠", text: "AIが過去の体験を文章でまとめます" },
                { icon: "🎞️", text: "評価やメモをもとにふたりの思い出を振り返れます" },
                { icon: "✨", text: "ふたりの記録はコピーしてシェアしましょう！" },
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

      <BottomNav />
    </div>
  );
};
