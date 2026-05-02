// src/features/auth/components/IntroSlides.tsx
import { useState, useRef } from "react";

const SLIDES = [
  {
    title: "思い出を、かたちに。",
    desc: "KataLog (かたログ) は、\nふたりの大切な思い出を記録し、\n育てるアプリです。\n\nおでかけプランや行った場所の記録も、\nこれひとつで完結。",
  },
  {
    title: "希望に合わせて、体験プランを提案",
    desc: "ふたりの好みや体験履歴をもとに、\nぴったりな体験を提案します。",
  },
  {
    title: "体験するほど、思い出が育つ",
    desc: "ふたりの体験は、思い出として記録されます。\n\n写真や感想を添えて、\n一緒に思い出を育てましょう。",
  },
  {
    title: "思い出の楽しみ方は、あなた次第",
    desc: "記録した思い出(ログ)は、KataLogの機能で\n様々な形(かた)で振り返ることができます。\n\n早速、KataLog を始めましょう！",
  }
];

export const IntroSlides = ({ onDone }: { onDone: () => void }) => {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);

  const next = () => (index < SLIDES.length - 1 ? setIndex((i) => i + 1) : onDone());
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "var(--color-bg)",
        fontFamily: "var(--font-sans)",
        position: "relative",
      }}
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx < -50) next();
        else if (dx > 50 && index > 0) setIndex((i) => i - 1);
        startX.current = null;
      }}
    >
      {/* スキップ */}
      <button
        onClick={onDone}
        style={{
          position: "absolute", top: 16, right: 20,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 13, color: "var(--color-text-soft)", padding: "4px 8px",
          fontFamily: "var(--font-sans)",
        }}
      >
        スキップ
      </button>

      {/* ロゴ */}
      <div style={{ position: "absolute", top: 160, left: 0, right: 0,
                    display: "flex", justifyContent: "center" }}>
        <img src="/logo.png" alt="KataLog" style={{ height: 40, opacity: 0.9 }} />
      </div>

      {/* コンテンツ（paddingTopでロゴ分のスペースを確保し、文章位置を維持） */}
      <div
        style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "160px 36px 0", gap: 24, textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600,
            color: "var(--color-text-main)", lineHeight: 1.4,
          }}
        >
          {slide.title}
        </h2>
        <p
          style={{
            fontSize: 13, color: "var(--color-text-mid)",
            lineHeight: 1.8, maxWidth: 370, whiteSpace: "pre-line",
          }}
        >
          {slide.desc}
        </p>
      </div>

      {/* ドットナビ */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
        {SLIDES.map((_, i) => (
          <div
            key={i}
            onClick={() => setIndex(i)}
            style={{
              width: i === index ? 20 : 8,
              height: 8,
              borderRadius: 4,
              background: i === index ? "var(--color-primary)" : "var(--color-border)",
              cursor: "pointer",
              transition: "all 0.3s",
            }}
          />
        ))}
      </div>

      {/* ボタン */}
      <div style={{ padding: "0 24px 48px" }}>
        <button
          onClick={next}
          style={{
            width: "100%", padding: "16px",
            background: isLast ? "var(--color-primary)" : "var(--color-text-main)",
            color: "#fff", border: "none", borderRadius: 14,
            fontSize: 15, fontWeight: 600, cursor: "pointer",
            fontFamily: "var(--font-sans)",
            transition: "background 0.3s",
          }}
        >
          {isLast ? "はじめる →" : "次へ →"}
        </button>
      </div>
    </div>
  );
};
