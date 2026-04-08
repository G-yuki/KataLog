// src/features/setup/components/SwipeTutorial.tsx

type Props = {
  onClose: () => void;
  isPartner?: boolean;
};

export const SwipeTutorial = ({ onClose, isPartner = false }: Props) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
                zIndex: 100, display: "flex", alignItems: "flex-end",
                justifyContent: "center" }}>
    <div style={{ background: "var(--color-bg)", borderRadius: "20px 20px 0 0",
                  padding: "28px 24px 40px", width: "100%", maxWidth: 480,
                  fontFamily: "var(--font-sans)" }}>

      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-main)",
                   marginBottom: 6, textAlign: "center" }}>
        スワイプのやり方
      </h3>
      {isPartner && (
        <p style={{ fontSize: 12, color: "var(--color-primary)", textAlign: "center",
                    marginBottom: 14, fontWeight: 500 }}>
          パートナーのスワイプ結果と組み合わせてリストが決まります！
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "16px 0 20px" }}>
        <Row icon="⇧" label="Go!!" color="#f43f5e"
             desc="絶対やりたい！最優先リストに入ります" />
        <Row icon="⇨" label="Good" color="var(--color-primary)"
             desc="やりたいリストに入ります" />
        <Row icon="⇦" label="Pass" color="var(--color-text-soft)"
             desc="スキップ。片方だけPassすると「Try?」候補に" />
      </div>

      <div style={{ background: "var(--color-primary-light)", borderRadius: 12,
                    padding: "12px 16px", marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: "var(--color-text-mid)", lineHeight: 1.7 }}>
          <b style={{ color: "var(--color-text-main)" }}>マッチングルール</b><br />
          両方 Go!! →  ❤️最優先リスト (Go!!)<br />
          両方 Good / どちらかが Go!! → やりたいリスト (Good)<br />
          どちらかが Pass → お試しリスト (Try?) に保存<br />
          両方 Pass → リストには入りません
        </p>
      </div>

      <button onClick={onClose}
              style={{ width: "100%", padding: "14px", background: "var(--color-text-main)",
                       color: "var(--color-bg)", border: "none", borderRadius: 12,
                       fontSize: 14, fontWeight: 600, cursor: "pointer",
                       fontFamily: "var(--font-sans)" }}>
        OK！スワイプを始める →
      </button>
    </div>
  </div>
);

const Row = ({ icon, label, color, desc }: {
  icon: string; label: string; color: string; desc: string;
}) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
    <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10,
                  background: "var(--color-surface)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 18, color }}>
      {icon}
    </div>
    <div>
      <p style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 11, color: "var(--color-text-mid)", lineHeight: 1.5 }}>{desc}</p>
    </div>
  </div>
);
