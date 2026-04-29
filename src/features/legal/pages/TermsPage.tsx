// src/features/legal/pages/TermsPage.tsx
import { useNavigate } from "react-router-dom";

export const TermsPage = () => {
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
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600,
                     color: "var(--color-text-main)", letterSpacing: "0.01em" }}>
          TERMS: 利用規約
        </h1>
        <img src="/logo.png" alt="KataLog" style={{ marginLeft: "auto", height: 20, objectFit: "contain" }} />
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 48px", maxWidth: 680,
                    margin: "0 auto", width: "100%" }}>
        <LegalSection title="第1条（適用）">
          本規約は、KataLog（以下「本サービス」）の利用に関する条件を定めるものです。
          ご利用にあたっては本規約に同意いただく必要があります。
        </LegalSection>

        <LegalSection title="第2条（利用登録）">
          本サービスはGoogleアカウントによる認証を使用します。
          Googleの利用規約に加え、本規約に同意した上でご利用ください。
        </LegalSection>

        <LegalSection title="第3条（禁止事項）">
          以下の行為を禁止します。
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>法令または公序良俗に違反する行為</li>
            <li>他のユーザーへの迷惑行為</li>
            <li>本サービスの運営を妨げる行為</li>
            <li>不正アクセスその他の不正行為</li>
            <li>第三者の著作権・肖像権その他の権利を侵害する写真・画像のアップロード</li>
            <li>わいせつ・暴力的・差別的その他不適切な内容の写真・画像のアップロード</li>
          </ul>
        </LegalSection>

        <LegalSection title="第3条の2（ユーザーコンテンツ）">
          ユーザーが本サービスにアップロードした写真・画像（以下「ユーザーコンテンツ」）について、以下の事項に同意するものとします。
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>ユーザーコンテンツはペア内のパートナーと共有されます。</li>
            <li>ユーザーコンテンツの内容・適法性についてはユーザー自身が責任を負います。</li>
            <li>ユーザーは、本サービスがユーザーコンテンツをサービス提供の目的で保存・表示する権利をユーザーに許諾します。</li>
            <li>アイテム削除時は、そのアイテムに紐づく写真ファイルも合わせて削除されます。</li>
          </ul>
        </LegalSection>

        <LegalSection title="第4条（サービスの変更・停止）">
          当方は、都合により本サービスの内容を変更または提供を停止することがあります。
          これによって生じた損害について、当方は責任を負いません。
        </LegalSection>

        <LegalSection title="第5条（免責事項）">
          本サービスは現状有姿で提供されます。当方はサービスの完全性・正確性・有用性について
          いかなる保証も行いません。本サービスの利用によって生じた損害について、
          当方は一切の責任を負いません。
        </LegalSection>

        <LegalSection title="第6条（準拠法）">
          本規約は日本法に準拠し、解釈されるものとします。
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
