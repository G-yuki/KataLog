// src/features/auth/components/AuthGuard.tsx
import { useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { Loading } from "../../../components/Loading";
import { getInviteParams } from "../../../lib/token";
import { IntroSlides } from "./IntroSlides";

type Props = { children: ReactNode };

const isLineBrowser = () => /Line/i.test(navigator.userAgent);

export const AuthGuard = ({ children }: Props) => {
  const { user, loading, error, signIn } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [showIntro, setShowIntro] = useState(
    () => !localStorage.getItem("katalog_intro_seen")
  );
  const hasInvite = getInviteParams() !== null;

  if (loading) return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 20,
                  background: "var(--color-bg)" }}>
      <img src="/logo.png" alt="KataLog" style={{ height: 32, opacity: 0.9 }} />
      <Loading message="認証情報を確認中..." />
    </div>
  );

  if (isLineBrowser()) {
    return (
      <div className="auth-screen">
        <img src="/logo.png" alt="KataLog" style={{ height: 40 }} />
        <div className="card w-full max-w-xs p-6 text-center mt-4">
          <p className="text-2xl mb-3">⚠️</p>
          <p className="text-sm font-bold mb-3"
             style={{ color: "var(--color-text-main)" }}>
            外部ブラウザで開いてください
          </p>
          <p className="text-xs leading-relaxed mb-4"
             style={{ color: "var(--color-text-mid)" }}>
            LINEのブラウザではGoogleログインができません。
          </p>
          <div className="text-xs leading-relaxed p-3 rounded-xl text-left"
               style={{ background: "var(--color-primary-light)", color: "var(--color-text-mid)" }}>
            <p className="font-bold mb-1">開き方</p>
            <p>iPhone：右下の「…」→「ブラウザで開く」</p>
            <p>Android：右上の「…」→「外部ブラウザで開く」</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showIntro) return (
      <IntroSlides onDone={() => {
        localStorage.setItem("katalog_intro_seen", "1");
        setShowIntro(false);
      }} />
    );

    return (
      <div className="auth-screen">
        <img src="/logo.png" alt="KataLog" style={{ height: 40 }} />
        <p className="text-sm font-bold mb-1"
           style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
          思い出を、かたちに。
        </p>
        <p className="auth-sub">
          {hasInvite
            ? "ログインしてパートナーと一緒に始めましょう"
            : "AIでふたりにぴったりの体験を提案します"}
        </p>

        {error && <p className="auth-error">{error}</p>}

        <div className="w-full max-w-xs mt-4 mb-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 flex-shrink-0"
              style={{ accentColor: "var(--color-primary)" }}
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="text-xs leading-relaxed"
                  style={{ color: "var(--color-text-mid)" }}>
              <a href="/terms"
                 className="underline font-bold"
                 style={{ color: "var(--color-primary)" }}
                 target="_blank">
                利用規約
              </a>
              および
              <a href="/privacy"
                 className="underline font-bold"
                 style={{ color: "var(--color-primary)" }}
                 target="_blank">
                プライバシーポリシー
              </a>
              に同意する
            </span>
          </label>
        </div>

        <button
          className="btn-google"
          onClick={signIn}
          disabled={!agreed}
          style={{ opacity: agreed ? 1 : 0.4 }}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            width={22}
            height={22}
          />
          Googleでログイン
        </button>

        <div className="fixed bottom-0 left-0 right-0 text-center py-4"
             style={{ color: "var(--color-text-soft)" }}>
          <p className="text-xs mb-2">© 2026 KataLog</p>
          <div className="flex justify-center gap-3 text-xs">
            <a href="/terms" target="_blank" className="underline"
               style={{ color: "var(--color-text-soft)" }}>利用規約</a>
            <span>|</span>
            <a href="/privacy" target="_blank" className="underline"
               style={{ color: "var(--color-text-soft)" }}>プライバシーポリシー</a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
