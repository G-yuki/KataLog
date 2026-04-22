// src/features/setup/components/QuickGuide.tsx
import { useState } from "react";

const TOTAL = 4;

export const QuickGuide = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const next = () => (step < TOTAL - 1 ? setStep((s) => s + 1) : onComplete());

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", height: "100dvh",
        background: "var(--color-bg)", fontFamily: "var(--font-sans)",
        position: "relative",
      }}
    >
      {/* プログレスバー */}
      <div style={{ padding: "16px 24px 0", display: "flex", gap: 6 }}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? "var(--color-primary)" : "var(--color-border)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* STEP ラベル */}
      <div style={{ padding: "10px 24px 4px" }}>
        <p style={{
          fontSize: 11, color: "var(--color-primary)",
          letterSpacing: "0.12em", fontWeight: 700,
        }}>
          STEP {step + 1}
        </p>
      </div>

      {step === 0 && <StepHearing onNext={next} />}
      {step === 1 && <StepSwipe onNext={next} />}
      {step === 2 && <StepList onNext={next} />}
      {step === 3 && <StepMemory onNext={onComplete} />}

      {/* 初回ガイド説明ポップアップ */}
      {step === 0 && showIntro && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end", zIndex: 50,
          }}
          onClick={() => setShowIntro(false)}
        >
          <div
            style={{
              width: "100%", background: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "28px 24px 48px",
              display: "flex", flexDirection: "column", gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 22 }}>📖</p>
            <h3 style={{
              fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600,
              color: "var(--color-text-main)",
            }}>
              クイックガイド
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.8 }}>
              アプリの使い方を4ステップで体験できます。<br />
              実際に操作しながら確認してみましょう！
            </p>
            <button
              onClick={() => setShowIntro(false)}
              style={{
                marginTop: 4, width: "100%", padding: "15px",
                background: "var(--color-text-main)", color: "#fff",
                border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600,
                cursor: "pointer", fontFamily: "var(--font-sans)",
              }}
            >
              はじめる →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Step 0: ヒアリング ──────────────────────────────────────────────
const StepHearing = ({ onNext }: { onNext: () => void }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 40px" }}>
    <div style={{ marginBottom: 20 }}>
      <h2 style={{
        fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600,
        color: "var(--color-text-main)", marginBottom: 8,
      }}>
        まず、好みをAIに教えよう
      </h2>
      <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>
        いくつかの質問に答えるだけで、ふたりにぴったりな体験をAIがピックアップします。
      </p>
    </div>

    <div style={{
      flex: 1, background: "var(--color-surface)", borderRadius: 16,
      padding: 20, display: "flex", flexDirection: "column", gap: 16,
      border: "1px solid var(--color-border)",
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-main)" }}>
        好きな体験のタイプは？
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {[
          { e: "🌿", l: "自然" }, { e: "🍜", l: "グルメ" }, { e: "🎨", l: "アート" },
          { e: "🎵", l: "音楽" }, { e: "⛷️", l: "スポーツ" }, { e: "🎡", l: "テーマパーク" },
        ].map(({ e, l }, i) => (
          <div key={i} style={{
            padding: "8px 14px", borderRadius: 20,
            background: i < 3 ? "var(--color-primary)" : "var(--color-border)",
            color: i < 3 ? "#fff" : "var(--color-text-mid)",
            fontSize: 12, fontWeight: 500,
          }}>
            {e} {l}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--color-text-soft)" }}>
        エリアや予算、移動手段なども、ヒアリング予定です。<br />
        気軽に答えてみてくださいね！✨
      </p>
    </div>

    <button onClick={onNext} style={primaryBtn}>
      次のステップへ →
    </button>
  </div>
);

// ── Step 1: ボタン選択 ──────────────────────────────────────────────
const StepSwipe = ({ onNext }: { onNext: () => void }) => {
  const [tapped, setTapped] = useState<"go" | "good" | "pass" | null>(null);

  const handleAction = (action: "go" | "good" | "pass") => {
    if (tapped) return;
    setTapped(action);
    setTimeout(onNext, 600);
  };

  const cardTransform =
    tapped === "go"   ? "translateY(-160px) rotate(-5deg)" :
    tapped === "good" ? "translateX(160px) rotate(15deg)" :
    tapped === "pass" ? "translateX(-160px) rotate(-15deg)" :
    "none";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 40px" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600,
          color: "var(--color-text-main)", marginBottom: 8,
        }}>
          ボタンで直感的に選ぶ
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>
          ふたりそれぞれが同じ候補を選びます。回答を組み合わせてリストが自動で完成します。
        </p>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {/* モックカード */}
        <div style={{
          width: "100%", background: "#fff", borderRadius: 16,
          padding: "24px 20px", border: "1px solid var(--color-border)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          transform: cardTransform,
          opacity: tapped ? 0 : 1,
          transition: "transform 0.5s ease, opacity 0.4s ease",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}>
          <span style={{ fontSize: 48 }}>🏔️</span>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-main)" }}>
            箱根温泉でのんびり旅
          </p>
          <span style={{
            fontSize: 11, background: "var(--color-primary-light)",
            color: "var(--color-primary)", padding: "4px 12px",
            borderRadius: 20, fontWeight: 600,
          }}>
            おでかけ
          </span>
        </div>

        {/* ボタン */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => handleAction("go")}
            style={{
              width: "100%", padding: "14px", borderRadius: 12,
              background: "#f43f5e", color: "#fff", border: "none",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              fontFamily: "var(--font-sans)",
              boxShadow: "0 0 0 3px rgba(244,63,94,0.2)",
              opacity: tapped && tapped !== "go" ? 0.4 : 1,
              transition: "opacity 0.2s",
            }}
          >
            興味アリ ↑　←　タップしてみて！
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => handleAction("pass")}
              style={{
                ...ghostBtn, flex: 1,
                opacity: tapped && tapped !== "pass" ? 0.4 : 1,
                transition: "opacity 0.2s",
              }}
            >
              ← 興味なし
            </button>
            <button
              onClick={() => handleAction("good")}
              style={{
                ...primaryBtnSmall, flex: 1,
                opacity: tapped && tapped !== "good" ? 0.4 : 1,
                transition: "opacity 0.2s",
              }}
            >
              あとで →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Step 2: リスト確認 ──────────────────────────────────────────────
const StepList = ({ onNext }: { onNext: () => void }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 40px" }}>
    <div style={{ marginBottom: 20 }}>
      <h2 style={{
        fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600,
        color: "var(--color-text-main)", marginBottom: 8,
      }}>
        ふたりのリストが完成！
      </h2>
      <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>
        両方が「興味アリ」➡ お気に入り に。<br />
        一方が「あとで」➡ おすすめ に入ります。
      </p>
    </div>

    <div style={{
      flex: 1, background: "var(--color-surface)", borderRadius: 16,
      border: "1px solid var(--color-border)", overflow: "hidden",
    }}>
      <div style={{ padding: "10px 16px 6px", background: "var(--color-bg)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.06em" }}>
          ❤️ お気に入り
        </p>
      </div>
      {["箱根温泉でのんびり旅", "新宿御苑でお花見"].map((t, i) => (
        <div key={i} style={{
          padding: "14px 16px", borderBottom: "1px solid var(--color-border)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>{["🏔️", "🌸"][i]}</span>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-main)" }}>{t}</p>
        </div>
      ))}
      <div style={{ padding: "10px 16px 6px", background: "var(--color-bg)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-mid)", letterSpacing: "0.06em" }}>
          おすすめ
        </p>
      </div>
      {["渋谷のおしゃれカフェ巡り", "横浜中華街でランチ"].map((t, i) => (
        <div key={i} style={{
          padding: "14px 16px", borderBottom: "1px solid var(--color-border)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>{["☕", "🥟"][i]}</span>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-main)" }}>{t}</p>
        </div>
      ))}
    </div>

    <button onClick={onNext} style={primaryBtn}>
      次のステップへ →
    </button>
  </div>
);

// ── Step 3: 思い出 ──────────────────────────────────────────────────
const StepMemory = ({ onNext }: { onNext: () => void }) => {
  const [done, setDone] = useState(false);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 40px" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600,
          color: "var(--color-text-main)", marginBottom: 8,
        }}>
          体験したら思い出に残そう
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>
          完了にすると写真やメモと一緒に記録されます。ふたりだけの思い出として残ります。
        </p>
      </div>

      <div style={{
        flex: 1, background: "#fff", borderRadius: 16,
        border: "1px solid var(--color-border)", padding: 20,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 36 }}>🏔️</span>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-main)" }}>
              箱根温泉でのんびり旅
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-soft)" }}>おでかけ</p>
          </div>
        </div>

        {!done ? (
          <button
            onClick={() => setDone(true)}
            style={{
              padding: "12px", background: "var(--color-primary)", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "var(--font-sans)",
              boxShadow: "0 0 0 3px var(--color-primary-light)",
            }}
          >
            ✅ 完了にする　←　タップしてみて！
          </button>
        ) : (
          <div style={{
            background: "var(--color-primary-light)", borderRadius: 10,
            padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              ✅ 完了！思い出に記録されました
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-mid)" }}>
              📅 4/20 14時 ・ 📝 最高だった！また行きたい
            </p>
          </div>
        )}

        {!done && (
          <p style={{ fontSize: 11, color: "var(--color-text-soft)", textAlign: "center" }}>
            完了にすると思い出に記録されます ✨
          </p>
        )}
      </div>

      <button onClick={onNext} style={{ ...primaryBtn, marginTop: 16 }}>
        パートナーを招待してはじめる →
      </button>
    </div>
  );
};

// ── スタイル定数 ────────────────────────────────────────────────────
const primaryBtn: React.CSSProperties = {
  marginTop: 16, width: "100%", padding: "16px",
  background: "var(--color-text-main)", color: "#fff",
  border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600,
  cursor: "pointer", fontFamily: "var(--font-sans)",
};

const primaryBtnSmall: React.CSSProperties = {
  padding: "12px", background: "var(--color-primary)", color: "#fff",
  border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "var(--font-sans)",
};

const ghostBtn: React.CSSProperties = {
  padding: "12px", background: "var(--color-surface)", color: "var(--color-text-mid)",
  border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "var(--font-sans)",
};
