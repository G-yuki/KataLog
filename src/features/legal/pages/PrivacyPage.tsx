// src/features/legal/pages/PrivacyPage.tsx
import { useNavigate } from "react-router-dom";

export const PrivacyPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh",
                  background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>

      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
                       padding: "14px 20px 10px", borderBottom: "1px solid rgba(0,0,0,0.07)",
                       position: "sticky", top: 0, background: "var(--color-bg)", zIndex: 10 }}>
        <button onClick={() => navigate(-1)}
                style={{ background: "none", border: "none", cursor: "pointer",
                         padding: "4px 8px 4px 0", color: "var(--color-text-mid)" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600,
                     color: "var(--color-text-main)", letterSpacing: "0.01em" }}>
          PRIVACY: プライバシーポリシー
        </h1>
        <img src="/logo.png" alt="KataLog" style={{ marginLeft: "auto", height: 18, objectFit: "contain" }} />
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 48px", maxWidth: 680,
                    margin: "0 auto", width: "100%" }}>
        <LegalSection title="収集する情報">
          本サービスでは以下の情報を収集します。
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Googleアカウントの基本情報（メールアドレス、UID）</li>
            <li>ユーザーが入力したニックネーム</li>
            <li>ペアで作成したアイテムリスト・体験記録</li>
            <li>ヒアリング回答（趣味嗜好など）</li>
          </ul>
        </LegalSection>

        <LegalSection title="情報の利用目的">
          収集した情報は以下の目的で利用します。
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>本サービスの提供・維持・改善</li>
            <li>AIによる体験提案・思い出文章の生成</li>
            <li>ペアマッチング機能の提供</li>
          </ul>
        </LegalSection>

        <LegalSection title="第三者への提供">
          以下の場合を除き、収集した情報を第三者に提供しません。
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
          </ul>
        </LegalSection>

        <LegalSection title="外部サービスの利用">
          本サービスは以下の外部サービスを利用しています。
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Firebase（Google LLC）— 認証・データベース・ホスティング</li>
            <li>Gemini API（Google LLC）— AI体験提案・思い出生成</li>
          </ul>
          各サービスのプライバシーポリシーについては各社のウェブサイトをご確認ください。
        </LegalSection>

        <LegalSection title="データの保管と削除">
          収集したデータはFirestoreに保存されます。
          アカウント削除をご希望の場合は、お問い合わせフォームよりご連絡ください。
        </LegalSection>

        <LegalSection title="ポリシーの変更">
          本ポリシーは予告なく変更することがあります。
          変更後もサービスを継続利用された場合、変更に同意したものとみなします。
        </LegalSection>

        <p style={{ fontSize: 11, color: "var(--color-text-soft)", marginTop: 32,
                    textAlign: "right" }}>
          制定日：2026年4月<br />© 2026 KataLog
        </p>
      </div>
    </div>
  );
};

const LegalSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 28 }}>
    <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-main)",
                 marginBottom: 8, fontFamily: "var(--font-sans)" }}>
      {title}
    </h2>
    <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.9 }}>
      {children}
    </p>
  </div>
);
