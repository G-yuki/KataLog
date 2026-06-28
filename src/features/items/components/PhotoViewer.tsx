import { useState } from "react";

interface Props {
  photos: string[];
  initialIndex: number;
  pinnedPhotoUrl: string | null | undefined;
  onClose: () => void;
  onDelete: (url: string) => Promise<void>;
  onPin: (url: string | null) => Promise<void>;
}

export const PhotoViewer = ({ photos, initialIndex, pinnedPhotoUrl, onClose, onDelete, onPin }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const url = photos[currentIndex];
  if (!url) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
                  display: "flex", flexDirection: "column", zIndex: 200 }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 20px", flexShrink: 0 }}>
        <button onClick={() => { onClose(); setShowDeleteConfirm(false); }}
                style={{ background: "none", border: "none", color: "#fff",
                         fontSize: 14, cursor: "pointer", padding: "4px 8px 4px 0" }}>
          ✕ 閉じる
        </button>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
          {currentIndex + 1} / {photos.length}
        </span>
      </div>

      {/* 写真 */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 16px" }}>
        <img src={url} alt="" loading="lazy"
             style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
      </div>

      {/* ヘッダー固定ボタン */}
      <div style={{ flexShrink: 0, textAlign: "center", paddingBottom: 4 }}>
        <button
          onClick={() => onPin(pinnedPhotoUrl === url ? null : url)}
          style={{ background: "none",
                   border: `1px solid ${pinnedPhotoUrl === url ? "rgba(255,215,0,0.7)" : "rgba(255,255,255,0.3)"}`,
                   borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer",
                   color: pinnedPhotoUrl === url ? "#FFD700" : "rgba(255,255,255,0.7)" }}>
          {pinnedPhotoUrl === url ? "📌 ヘッダーから解除" : "📌 ヘッダーに固定"}
        </button>
      </div>

      {/* ナビゲーション＋削除 */}
      {showDeleteConfirm ? (
        <div style={{ flexShrink: 0, padding: "16px 20px 48px",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 14, color: "#fff", marginBottom: 4 }}>この写真を削除しますか？</p>
          <div style={{ display: "flex", gap: 12, width: "100%" }}>
            <button onClick={() => setShowDeleteConfirm(false)}
                    style={{ flex: 1, padding: "12px 0", borderRadius: 10,
                             background: "rgba(255,255,255,0.15)", border: "none",
                             color: "#fff", fontSize: 14, cursor: "pointer" }}>
              キャンセル
            </button>
            <button onClick={() => { setShowDeleteConfirm(false); onDelete(url); }}
                    style={{ flex: 1, padding: "12px 0", borderRadius: 10,
                             background: "#E53E3E", border: "none",
                             color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              削除する
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flexShrink: 0, padding: "16px 20px 48px",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setShowDeleteConfirm(false); }}
                  disabled={currentIndex === 0}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
                           color: "#fff", padding: "10px 20px", fontSize: 14, cursor: "pointer",
                           opacity: currentIndex === 0 ? 0.3 : 1 }}>
            ‹ 前
          </button>
          <button onClick={() => setShowDeleteConfirm(true)}
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,100,100,0.6)",
                           borderRadius: 8, color: "#ff8080", padding: "10px 20px",
                           fontSize: 13, cursor: "pointer" }}>
            この写真を削除
          </button>
          <button onClick={() => { setCurrentIndex(Math.min(photos.length - 1, currentIndex + 1)); setShowDeleteConfirm(false); }}
                  disabled={currentIndex === photos.length - 1}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
                           color: "#fff", padding: "10px 20px", fontSize: 14, cursor: "pointer",
                           opacity: currentIndex === photos.length - 1 ? 0.3 : 1 }}>
            次 ›
          </button>
        </div>
      )}
    </div>
  );
};
