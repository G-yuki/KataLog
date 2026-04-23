// src/features/setup/components/HomeGuide.tsx
import { useState, useEffect } from "react";

type Phase = "home" | "detail";

interface StepDef {
  target: string;
  desc: string;
  phase: Phase;
}

const ALL_STEPS: StepDef[] = [
  { target: "filter-area", desc: "カテゴリで\nアイテムを絞り込み", phase: "home" },
  { target: "add-btn",     desc: "新しく\nアイテムを追加 ＋",    phase: "home" },
  { target: "heart-btn",   desc: "❤️ をタップして\nお気に入りへ移動", phase: "detail" },
  { target: "done-btn",    desc: "体験したら\n完了チェック ✅",    phase: "detail" },
];

export interface HomeGuideProps {
  onClose: () => void;
  onOpenDetail: () => void;
  onCloseDetail: () => void;
  detailReady: boolean;
}

export const HomeGuide = ({ onClose, onOpenDetail, onCloseDetail, detailReady }: HomeGuideProps) => {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [waitingForDetail, setWaitingForDetail] = useState(false);
  const [done, setDone] = useState(false);

  const resolveRect = (i: number) => {
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-guide="${ALL_STEPS[i].target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    });
  };

  useEffect(() => { resolveRect(0); }, []);

  useEffect(() => {
    if (detailReady && waitingForDetail) {
      setWaitingForDetail(false);
      resolveRect(index);
    }
  }, [detailReady, waitingForDetail, index]);

  const handleTap = () => {
    const nextIndex = index + 1;
    if (nextIndex >= ALL_STEPS.length) {
      onCloseDetail();
      setDone(true);
      return;
    }
    const nextStep = ALL_STEPS[nextIndex];
    if (nextStep.phase === "detail" && !detailReady) {
      setIndex(nextIndex);
      setRect(null);
      onOpenDetail();
      setWaitingForDetail(true);
    } else {
      setIndex(nextIndex);
      resolveRect(nextIndex);
    }
  };

  if (done) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1100, padding: "0 32px",
      }}>
        <div style={{
          background: "#fff", borderRadius: 20, padding: "36px 28px",
          textAlign: "center", width: "100%", maxWidth: 300,
        }}>
          <p style={{ fontSize: 44, marginBottom: 12 }}>🎉</p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)",
                       marginBottom: 10, fontFamily: "var(--font-sans)" }}>
            さあ、始めましょう！
          </h2>
          <p style={{ fontSize: 13, color: "var(--color-text-mid)", marginBottom: 24,
                      lineHeight: 1.8, fontFamily: "var(--font-sans)" }}>
            ふたりのリストを<br />楽しんでください。
          </p>
          <button onClick={onClose}
                  style={{ width: "100%", padding: "14px", background: "var(--color-primary)",
                           color: "#fff", border: "none", borderRadius: 12,
                           fontSize: 15, fontWeight: 600, cursor: "pointer",
                           fontFamily: "var(--font-sans)" }}>
            リストを見る →
          </button>
        </div>
      </div>
    );
  }

  if (!rect) return null;

  const PAD = 10;
  const spotTop  = rect.top  - PAD;
  const spotLeft = rect.left - PAD;
  const spotW    = rect.width  + PAD * 2;
  const spotH    = rect.height + PAD * 2;
  const spotMidY = spotTop + spotH / 2;
  const showBelow = spotMidY < window.innerHeight * 0.55;
  const descTop    = showBelow ? spotTop + spotH + 28 : undefined;
  const descBottom = !showBelow ? window.innerHeight - spotTop + 28 : undefined;

  const current = ALL_STEPS[index];

  return (
    <div
      onClick={handleTap}
      style={{ position: "fixed", inset: 0, zIndex: 1100, cursor: "pointer" }}
    >
      {/* スポットライト */}
      <div style={{
        position: "fixed",
        top: spotTop, left: spotLeft, width: spotW, height: spotH,
        borderRadius: 12,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
        pointerEvents: "none",
        transition: "top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease",
      }} />

      {/* 説明テキスト */}
      <div style={{
        position: "fixed",
        top: descTop, bottom: descBottom,
        left: "50%", transform: "translateX(-50%)",
        textAlign: "center", pointerEvents: "none", width: 240,
      }}>
        <p style={{
          fontSize: 17, fontWeight: 700, color: "#fff",
          whiteSpace: "pre-line", lineHeight: 1.7,
          fontFamily: "var(--font-sans)",
          textShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}>
          {current.desc}
        </p>
      </div>

      {/* ステップインジケーター + ヒント */}
      <div style={{
        position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        pointerEvents: "none",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {ALL_STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === index ? 20 : 6, height: 6, borderRadius: 3,
              background: i === index ? "#fff" : "rgba(255,255,255,0.35)",
              transition: "width 0.25s ease, background 0.25s ease",
            }} />
          ))}
        </div>
        <p style={{
          fontSize: 11, color: "rgba(255,255,255,0.65)",
          letterSpacing: "0.08em", fontFamily: "var(--font-sans)",
        }}>
          タップして次へ
        </p>
      </div>
    </div>
  );
};
