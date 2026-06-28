import { useState, useRef, useEffect } from "react";

interface Props {
  photoUrl: string;
  initialPosY: number;
  onSave: (posY: number) => void;
  onClose: () => void;
}

export const HeaderAdjustOverlay = ({ photoUrl, initialPosY, onSave, onClose }: Props) => {
  const [adjPosY, setAdjPosY] = useState(initialPosY);
  const [photoNaturalSize, setPhotoNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const adjPosYRef = useRef(initialPosY);
  const photoExcessRef = useRef(0);

  useEffect(() => { adjPosYRef.current = adjPosY; }, [adjPosY]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const drag = { startY: 0, startPos: 0, active: false };
    const onStart = (e: TouchEvent) => {
      drag.startY = e.touches[0].clientY;
      drag.startPos = adjPosYRef.current;
      drag.active = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!drag.active) return;
      e.preventDefault();
      const excess = photoExcessRef.current;
      if (excess <= 0) return;
      const delta = e.touches[0].clientY - drag.startY;
      setAdjPosY(Math.max(0, Math.min(100, drag.startPos - delta * 100 / excess)));
    };
    const onEnd = () => { drag.active = false; };
    el.addEventListener("touchstart", onStart);
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const frameTop = Math.floor((screenH - 220) / 2);
  const displayedH = photoNaturalSize ? screenW * photoNaturalSize.h / photoNaturalSize.w : 0;
  const photoExcess = Math.max(0, displayedH - 220);
  photoExcessRef.current = photoExcess;
  const photoTop = frameTop - (adjPosY / 100) * photoExcess;

  return (
    <div ref={overlayRef}
         style={{ position: "fixed", inset: 0, zIndex: 300, overflow: "hidden" }}>
      <img
        src={photoUrl}
        alt=""
        onLoad={(e) => {
          const img = e.currentTarget;
          setPhotoNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        style={{ position: "absolute", top: photoTop, left: 0,
                 width: "100%", height: "auto", display: "block",
                 pointerEvents: "none", userSelect: "none" }}
      />
      {/* 上部暗いオーバーレイ */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: frameTop,
                    background: "rgba(0,0,0,0.58)", pointerEvents: "none" }} />
      {/* 選択枠 */}
      <div style={{ position: "absolute", top: frameTop, left: 0, right: 0, height: 220,
                    border: "2px solid rgba(255,255,255,0.8)", boxSizing: "border-box",
                    pointerEvents: "none" }} />
      {/* 下部暗いオーバーレイ */}
      <div style={{ position: "absolute", top: frameTop + 220, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.58)", pointerEvents: "none" }} />
      {/* 操作説明 */}
      <div style={{ position: "absolute", top: frameTop + 228, left: 0, right: 0,
                    textAlign: "center", pointerEvents: "none" }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)",
                       textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
          ↕ 上下にドラッグして位置を調整
        </span>
      </div>
      {/* ボタン行 */}
      <div style={{ position: "absolute", bottom: 48, left: 0, right: 0,
                    display: "flex", gap: 12, padding: "0 24px" }}>
        <button
          onClick={onClose}
          style={{ flex: 1, padding: "14px 0", borderRadius: 12,
                   background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)",
                   color: "#fff", fontSize: 15, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
          キャンセル
        </button>
        <button
          onClick={() => onSave(adjPosY)}
          style={{ flex: 1, padding: "14px 0", borderRadius: 12,
                   background: "rgba(255,255,255,0.92)", border: "none",
                   color: "#222", fontSize: 15, fontWeight: 700,
                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
          完了
        </button>
      </div>
    </div>
  );
};
