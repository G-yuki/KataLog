// src/features/memory/pages/MemoryPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "../../../components/Loading";
import { BottomNav } from "../../../components/BottomNav";
import { useItems } from "../../items/hooks/useItems";
import { usePair } from "../../../contexts/PairContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../firebase/functions";
import { CATEGORY_STYLE } from "../../../lib/constants";
import { type Timestamp } from "firebase/firestore";

// TODO: 今年・全期間は有料プランで対応予定
type PeriodFilter = "month" | "3months" | "6months";

const PERIOD_FILTERS: { id: PeriodFilter; label: string; aiLabel: string }[] = [
  { id: "month",   label: "今月",     aiLabel: "今月" },
  { id: "3months", label: "過去3ヶ月", aiLabel: "過去3ヶ月" },
  { id: "6months", label: "半年",     aiLabel: "過去半年" },
];

const getCutoff = (filter: PeriodFilter): Date => {
  const d = new Date();
  if (filter === "month")   { d.setDate(1); d.setHours(0, 0, 0, 0); }
  if (filter === "3months") { d.setMonth(d.getMonth() - 3); d.setHours(0, 0, 0, 0); }
  if (filter === "6months") { d.setMonth(d.getMonth() - 6); d.setHours(0, 0, 0, 0); }
  return d;
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

  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem("memoryIntroSeen"));
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month");
  const [generating, setGenerating] = useState(false);
  const [memory, setMemory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (!pairLoading && !pairId) navigate("/");
  }, [pairId, pairLoading, navigate]);

  // フィルター変更時は生成結果をリセット
  useEffect(() => {
    setMemory(null);
    setGenError(null);
  }, [periodFilter]);

  // 期間フィルターに応じた完了アイテムを計算（UIは新しい順、AI送信は古い順）
  const filteredDoneItems = (() => {
    const cutoff = getCutoff(periodFilter);
    return allDoneItems.filter((i) => {
      const ts = i.completedAt as Timestamp | undefined;
      return ts && ts.toDate() >= cutoff;
    });
  })();

  const currentFilter = PERIOD_FILTERS.find((f) => f.id === periodFilter)!;

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
      // 古い順（昇順）でソート済みなのでそのまま渡す
      const payload = filteredDoneItems.map((i) => ({
        title: i.title,
        category: i.category,
        rating: i.rating,
        memo: i.memo,
        completedMonth: i.completedAt
          ? `${(i.completedAt as Timestamp).toDate().getMonth() + 1}月`
          : "",
      }));
      const todoPayload = todoItems.map((i) => ({ title: i.title, category: i.category }));
      const result = await fn({
        items: payload,
        todoItems: todoPayload,
        period: currentFilter.aiLabel,
      });
      setMemory(result.data.memory);
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
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600,
                     color: "var(--color-text-main)", letterSpacing: "0.01em" }}>
          思い出
        </h1>
        <img src="/logo.png" alt="KataLog" style={{ marginLeft: "auto", height: 18, objectFit: "contain" }} />
      </header>

      {/* 期間フィルターはスクロールエリア内でstickyにする */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 80 }}>

        <div style={{ position: "sticky", top: 0, zIndex: 15, padding: "10px 20px 8px",
                      display: "flex", gap: 6, background: "var(--color-bg)",
                      borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          {PERIOD_FILTERS.map(({ id, label }) => (
            <button key={id} onClick={() => setPeriodFilter(id)}
                    style={{ flexShrink: 0, fontSize: 11, padding: "5px 13px",
                             borderRadius: 20, whiteSpace: "nowrap",
                             fontFamily: "var(--font-sans)", cursor: "pointer",
                             border: periodFilter === id ? "none" : "1px solid rgba(0,0,0,0.12)",
                             background: periodFilter === id ? "var(--color-text-main)" : "transparent",
                             color: periodFilter === id ? "var(--color-bg)" : "#5C4A35" }}>
              {label}
            </button>
          ))}
        </div>

        {allDoneItems.length === 0 ? (
          /* ── 空の状態 ── */
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
                  <strong>{currentFilter.label}</strong>に完了した体験は
                  <strong>{filteredDoneItems.length}件</strong>です。<br />
                  この期間の思い出を振り返りましょう。
                </p>
              </div>
            </div>

            {/* フィルター後にアイテムがない場合 */}
            {filteredDoneItems.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center",
                            background: "#fff", borderRadius: 14,
                            border: "1px solid rgba(0,0,0,0.07)" }}>
                <p style={{ fontSize: 13, color: "var(--color-text-soft)" }}>
                  {currentFilter.label}に完了した体験はありません
                </p>
              </div>
            ) : (
              <>
                {/* 完了アイテム一覧（古い順で表示） */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-soft)",
                              letterSpacing: "0.08em", marginBottom: 10 }}>
                    体験記録
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredDoneItems.map((item) => {
                      const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["その他"];
                      return (
                        <button key={item.itemId}
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
                Memory とは？
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

      {/* ── ボトムナビ ── */}
      <BottomNav />
    </div>
  );
};
