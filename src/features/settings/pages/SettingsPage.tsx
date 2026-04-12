// src/features/settings/pages/SettingsPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "../../../components/BottomNav";
import { useAuth } from "../../auth/hooks/useAuth";
import { Loading } from "../../../components/Loading";
import {
  getDisplayName,
  saveDisplayName,
  removePairPartner,
} from "../../pair/services/pairService";
import { usePair } from "../../../contexts/PairContext";
import { resetPairList } from "../../items/services/itemService";
import { db } from "../../../firebase/firestore";
import { doc, getDoc } from "firebase/firestore";

export const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pairId, loading: pairLoading } = usePair();

  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  const [partnerName, setPartnerName] = useState<string | null>(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [showReinviteConfirm, setShowReinviteConfirm] = useState(false);
  const [reinviting, setReinviting] = useState(false);

  useEffect(() => {
    if (!user || pairLoading) return;
    (async () => {
      const [name, pairSnap] = await Promise.all([
        getDisplayName(user.uid),
        pairId ? getDoc(doc(db, "pairs", pairId)) : Promise.resolve(null),
      ]);
      setNickname(name ?? "");
      setLoading(false); // ← パートナー名を待たず即座に画面表示

      // パートナー名はバックグラウンドで取得（表示は後から差し込まれる）
      if (pairSnap?.exists()) {
        const members = pairSnap.data().members as string[];
        const partnerUid = members.find((m) => m !== user.uid);
        if (partnerUid) {
          getDisplayName(partnerUid).then((pname) => setPartnerName(pname));
        }
      }
    })();
  }, [user, pairId, pairLoading]);

  const handleNicknameEdit = () => {
    setNicknameDraft(nickname);
    setNicknameError(null);
    setEditingNickname(true);
  };

  const handleNicknameSave = async () => {
    if (!user) return;
    const trimmed = nicknameDraft.trim();
    if (!trimmed) { setNicknameError("ニックネームを入力してください。"); return; }
    if (trimmed.length > 10) { setNicknameError("10文字以内で入力してください。"); return; }
    setNicknameSaving(true);
    await saveDisplayName(user.uid, trimmed);
    setNickname(trimmed);
    setEditingNickname(false);
    setNicknameSaving(false);
  };

  const handleReinvite = async () => {
    if (!pairId || !user) return;
    setReinviting(true);
    try {
      await removePairPartner(pairId, user.uid);
      setShowReinviteConfirm(false);
      navigate("/", { replace: true });
    } catch {
      alert("処理に失敗しました。もう一度お試しください。");
    } finally {
      setReinviting(false);
    }
  };

  const handleReset = async () => {
    if (!pairId) return;
    setResetting(true);
    await resetPairList(pairId);
    setResetting(false);
    setShowResetConfirm(false);
    navigate("/setup", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  if (loading) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh",
                  background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>

      {/* ヘッダー */}
      <header style={{ flexShrink: 0, padding: "14px 20px 10px",
                       borderBottom: "1px solid rgba(0,0,0,0.07)",
                       position: "sticky", top: 0, zIndex: 20,
                       background: "var(--color-bg)",
                       display: "flex", alignItems: "center" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "var(--color-text-main)",
                     letterSpacing: "0.01em" }}>
          SETTING: 設定
        </h1>
        <img src="/logo.png" alt="KataLog" style={{ marginLeft: "auto", height: 18, objectFit: "contain" }} />
      </header>

      {/* スクロールエリア */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "20px 20px 80px" }}>

        {/* プロフィール */}
        <Section label="プロフィール">
          <Row label="ニックネーム">
            {editingNickname ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <input
                  autoFocus
                  value={nicknameDraft}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  maxLength={10}
                  onKeyDown={(e) => { if (e.key === "Enter") handleNicknameSave(); if (e.key === "Escape") setEditingNickname(false); }}
                  style={{ fontSize: 14, color: "var(--color-text-main)", width: 120,
                           border: "none", borderBottom: "1.5px solid var(--color-primary)",
                           background: "transparent", outline: "none", textAlign: "right",
                           fontFamily: "var(--font-sans)" }}
                />
                {nicknameError && (
                  <p style={{ fontSize: 11, color: "#e05" }}>{nicknameError}</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditingNickname(false)}
                          style={{ fontSize: 12, color: "var(--color-text-soft)", background: "none",
                                   border: "none", cursor: "pointer" }}>
                    キャンセル
                  </button>
                  <button onClick={handleNicknameSave} disabled={nicknameSaving}
                          style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)",
                                   background: "none", border: "none", cursor: "pointer" }}>
                    {nicknameSaving ? "保存中..." : "保存"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={handleNicknameEdit}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
                               border: "none", cursor: "pointer", padding: 0 }}>
                <span style={{ fontSize: 14, color: "var(--color-text-main)" }}>
                  {nickname || "未設定"}
                </span>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M8.5 1.5l3 3L4 12H1v-3L8.5 1.5z" stroke="var(--color-text-soft)"
                        strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </Row>
        </Section>

        {/* ペア */}
        {pairId && (
          <Section label="ペア">
            <Row label="パートナー">
              <span style={{ fontSize: 14, color: "var(--color-text-main)" }}>
                {partnerName ?? "（未参加）"}
              </span>
            </Row>
            <Row label="再招待">
              <button onClick={() => setShowReinviteConfirm(true)}
                      style={{ background: "none", border: "none", cursor: "pointer",
                               color: "var(--color-primary)", fontSize: 13, fontWeight: 500,
                               display: "flex", alignItems: "center", gap: 4 }}>
                パートナーを外して再招待
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </Row>
          </Section>
        )}

        {/* アカウント */}
        <Section label="アカウント">
          <Row label="メールアドレス">
            <span style={{ fontSize: 13, color: "var(--color-text-soft)" }}>
              {user?.email ?? "—"}
            </span>
          </Row>
        </Section>

        {/* サポート */}
        <Section label="サポート">
          <Row label="お問い合わせ">
            <button onClick={() => navigate("/setting/inquiry")}
                    style={{ background: "none", border: "none", cursor: "pointer",
                             color: "var(--color-primary)", fontSize: 13, fontWeight: 500,
                             display: "flex", alignItems: "center", gap: 4 }}>
              送る
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </Row>
        </Section>

        {/* アクション */}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
          <ActionButton onClick={handleSignOut} color="var(--color-text-mid)">
            ログアウト
          </ActionButton>
          {pairId && (
            <ActionButton onClick={() => setShowResetConfirm(true)} color="#e03030">
              リストをリセットする
            </ActionButton>
          )}
        </div>

        {/* 法的リンク */}
        <div style={{ marginTop: 40, display: "flex", justifyContent: "center", gap: 20 }}>
          <button onClick={() => navigate("/terms")}
                  style={{ fontSize: 11, color: "var(--color-text-soft)", textDecoration: "underline",
                           background: "none", border: "none", cursor: "pointer",
                           fontFamily: "var(--font-sans)", padding: 0 }}>
            利用規約
          </button>
          <button onClick={() => navigate("/privacy")}
                  style={{ fontSize: 11, color: "var(--color-text-soft)", textDecoration: "underline",
                           background: "none", border: "none", cursor: "pointer",
                           fontFamily: "var(--font-sans)", padding: 0 }}>
            プライバシーポリシー
          </button>
        </div>

      </div>

      {/* 再招待確認ダイアログ */}
      {showReinviteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                      display: "flex", alignItems: "flex-end", zIndex: 100 }}
             onClick={() => setShowReinviteConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ width: "100%", background: "var(--color-bg)", borderRadius: "20px 20px 0 0",
                        padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 500,
                         color: "var(--color-text-main)", textAlign: "center" }}>
              パートナーを外しますか？
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-text-mid)", textAlign: "center", lineHeight: 1.7 }}>
              現在のパートナーとのペアが解除され、<br />
              リストもすべて削除されます。<br />
              新しい招待リンクでやり直せます。
            </p>
            <button onClick={handleReinvite} disabled={reinviting}
                    style={{ padding: "14px", background: "var(--color-primary)", color: "#fff",
                             border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600,
                             cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              {reinviting ? "処理中..." : "外して再招待する"}
            </button>
            <button onClick={() => setShowReinviteConfirm(false)}
                    style={{ padding: "14px", background: "transparent",
                             color: "var(--color-text-mid)", border: "1px solid var(--color-border)",
                             borderRadius: 12, fontSize: 15, cursor: "pointer",
                             fontFamily: "var(--font-sans)" }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* リストリセット確認ダイアログ */}
      {showResetConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                      display: "flex", alignItems: "flex-end", zIndex: 100 }}
             onClick={() => setShowResetConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ width: "100%", background: "var(--color-bg)", borderRadius: "20px 20px 0 0",
                        padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 500, color: "var(--color-text-main)",
                         textAlign: "center" }}>
              リストをリセットしますか？
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-text-mid)", textAlign: "center",
                        lineHeight: 1.7 }}>
              ふたりのリストがすべて削除され、<br />
              ヒアリングからやり直しになります。<br />
              この操作は元に戻せません。
            </p>
            <button onClick={handleReset} disabled={resetting}
                    style={{ padding: "14px", background: "#e03030", color: "#fff",
                             border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600,
                             cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              {resetting ? "リセット中..." : "リセットする"}
            </button>
            <button onClick={() => setShowResetConfirm(false)}
                    style={{ padding: "14px", background: "transparent",
                             color: "var(--color-text-mid)", border: "1px solid var(--color-border)",
                             borderRadius: 12, fontSize: 15, cursor: "pointer",
                             fontFamily: "var(--font-sans)" }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ── ボトムナビ ── */}
      <BottomNav />
    </div>
  );
};

// ── サブコンポーネント ──────────────────────────────

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 24 }}>
    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-soft)",
                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
      {label}
    </p>
    <div style={{ background: "#fff", borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
      {children}
    </div>
  </div>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
    <span style={{ fontSize: 14, color: "var(--color-text-mid)" }}>{label}</span>
    {children}
  </div>
);

const ActionButton = ({ onClick, color, children, disabled }:
  { onClick: () => void; color: string; children: React.ReactNode; disabled?: boolean }) => (
  <button onClick={onClick} disabled={disabled}
          style={{ width: "100%", padding: "14px", borderRadius: 12,
                   background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
                   fontSize: 15, fontWeight: 500, color,
                   cursor: "pointer", fontFamily: "var(--font-sans)",
                   opacity: disabled ? 0.5 : 1 }}>
    {children}
  </button>
);
