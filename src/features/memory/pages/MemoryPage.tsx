// src/features/memory/pages/MemoryPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "../../../components/Loading";
import { useItems } from "../../items/hooks/useItems";
import { usePair } from "../../../contexts/PairContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../firebase/functions";
import { CATEGORY_STYLE } from "../../../lib/constants";
import { db } from "../../../firebase/firestore";
import { doc, getDoc, type Timestamp } from "firebase/firestore";

/** Timestamp から期間文字列を計算（"X年Xヶ月" または "はじまり"） */
const calcPeriod = (start: Date): string => {
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0 && months === 0) return "はじまり";
  return `${years > 0 ? `${years}年` : ""}${months > 0 ? `${months}ヶ月` : ""}`;
};

export const MemoryPage = () => {
  const navigate = useNavigate();
  const { pairId, loading: pairLoading } = usePair();
  const { items, loading } = useItems(pairId);

  const doneItems = items
    .filter((i) => i.status === "done")
    .sort((a, b) => (b.completedAt?.toMillis() ?? 0) - (a.completedAt?.toMillis() ?? 0));

  const todoItems = items.filter((i) => i.status !== "done");

  const [generating, setGenerating] = useState(false);
  const [memory, setMemory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("");

  useEffect(() => {
    if (!pairLoading && !pairId) navigate("/");
  }, [pairId, pairLoading, navigate]);

  // ペア開始日を取得して期間を計算
  useEffect(() => {
    if (!pairId) return;
    (async () => {
      const snap = await getDoc(doc(db, "pairs", pairId));
      if (!snap.exists()) return;
      const data = snap.data();
      const ts: Timestamp | undefined = data.matchingFinalizedAt ?? data.createdAt;
      if (ts) setPeriod(calcPeriod(ts.toDate()));
    })();
  }, [pairId]);

  const handleGenerate = async () => {
    if (doneItems.length === 0) return;
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
      const payload = doneItems.map((i) => ({
        title: i.title,
        category: i.category,
        rating: i.rating,
        memo: i.memo,
        completedMonth: i.completedAt
          ? `${(i.completedAt as Timestamp).toDate().getMonth() + 1}月`
          : "",
      }));
      const todoPayload = todoItems.map((i) => ({ title: i.title, category: i.category }));
      const result = await fn({ items: payload, todoItems: todoPayload, period });
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
      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
                       padding: "14px 20px 12px",
                       borderBottom: "1px solid rgba(0,0,0,0.07)",
                       position: "sticky", top: 0, zIndex: 20,
                       background: "var(--color-bg)" }}>
        <button onClick={() => navigate("/home")}
                style={{ background: "none", border: "none", cursor: "pointer",
                         padding: "4px 8px 4px 0", color: "var(--color-text-mid)" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 500,
                       color: "var(--color-text-main)", letterSpacing: "0.04em" }}>
            Memory: 思い出
          </h1>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>

        {doneItems.length === 0 ? (
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
                  {doneItems.length}
                </p>
                <p style={{ fontSize: 10, color: "var(--color-text-soft)", marginTop: 2 }}>
                  件の体験
                </p>
              </div>
              <div style={{ flex: 1, borderLeft: "1px solid var(--color-border)", paddingLeft: 16 }}>
                <p style={{ fontSize: 11, color: "var(--color-text-mid)", lineHeight: 2.2 }}>
                  ふたりの記録開始から、<strong>{period || "—"}</strong>が経過。<br/>
                  これまでに<strong>{doneItems.length}件</strong>の体験を積み重ねました。<br/>
                  思い出を文章（かたち）にしてみましょう。
                </p>
              </div>
            </div>

            {/* 完了アイテム一覧 */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-soft)",
                          letterSpacing: "0.08em", marginBottom: 10 }}>
                体験記録
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {doneItems.map((item) => {
                  const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["その他"];
                  return (
                    <button key={item.itemId}
                            onClick={() => navigate(`/home/${item.itemId}`, { state: { from: "/memory" } })}
                            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%",
                                     background: "#fff", borderRadius: 10, textAlign: "left",
                                     border: "1px solid rgba(0,0,0,0.06)", padding: "10px 14px",
                                     cursor: "pointer" }}>
                      {/* カテゴリアイコン */}
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
                  {/* デコレーション */}
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

          </div>
        )}
      </div>
    </div>
  );
};
