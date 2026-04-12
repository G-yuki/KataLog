// src/features/settings/pages/InquiryPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { db } from "../../../firebase/firestore";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

type Step = "form" | "confirm" | "done";

interface FormData {
  email: string;
  emailConfirm: string;
  title: string;
  body: string;
}

const EMPTY: FormData = { email: "", emailConfirm: "", title: "", body: "" };

export const InquiryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [sending, setSending] = useState(false);

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errs: Partial<FormData> = {};
    if (!form.email.trim()) errs.email = "メールアドレスを入力してください。";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "メールアドレスの形式が正しくありません。";
    if (!form.emailConfirm.trim()) errs.emailConfirm = "確認用メールアドレスを入力してください。";
    else if (form.email !== form.emailConfirm) errs.emailConfirm = "メールアドレスが一致しません。";
    if (!form.title.trim()) errs.title = "タイトルを入力してください。";
    if (!form.body.trim()) errs.body = "お問い合わせ内容を入力してください。";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleToConfirm = () => {
    if (validate()) setStep("confirm");
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await addDoc(collection(db, "inquiries"), {
        uid: user?.uid ?? null,
        email: form.email,
        title: form.title,
        body: form.body,
        createdAt: serverTimestamp(),
      });
      setStep("done");
    } catch {
      alert("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh",
                  background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>

      {/* ヘッダー */}
      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
                       padding: "30px 20px 14px",
                       borderBottom: "1px solid rgba(0,0,0,0.07)",
                       position: "sticky", top: 0, zIndex: 20,
                       background: "var(--color-bg)" }}>
        {step !== "done" && (
          <button
            onClick={() => step === "confirm" ? setStep("form") : navigate("/setting")}
            style={{ background: "none", border: "none", cursor: "pointer",
                     padding: "4px 8px 4px 0", color: "var(--color-text-mid)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "var(--color-text-main)",
                     letterSpacing: "0.01em" }}>
          {step === "form" && "お問い合わせ"}
          {step === "confirm" && "送信確認"}
          {step === "done" && "送信完了"}
        </h1>
      </header>

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "24px 20px 40px" }}>

        {/* ── 入力画面 ── */}
        {step === "form" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>
              ご意見・ご要望・バグ報告など、お気軽にお送りください。
            </p>

            <Field label="メールアドレス" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="example@email.com"
                style={inputStyle(!!errors.email)}
              />
            </Field>

            <Field label="メールアドレス（確認）" error={errors.emailConfirm}>
              <input
                type="email"
                value={form.emailConfirm}
                onChange={set("emailConfirm")}
                placeholder="example@email.com"
                style={inputStyle(!!errors.emailConfirm)}
              />
            </Field>

            <Field label="タイトル" error={errors.title}>
              <input
                type="text"
                value={form.title}
                onChange={set("title")}
                placeholder="例：機能の要望について"
                maxLength={50}
                style={inputStyle(!!errors.title)}
              />
            </Field>

            <Field label="お問い合わせ内容" error={errors.body}>
              <textarea
                value={form.body}
                onChange={set("body")}
                placeholder="詳細をご記入ください"
                rows={6}
                maxLength={1000}
                style={{ ...inputStyle(!!errors.body), resize: "none", lineHeight: 1.6 }}
              />
              <p style={{ fontSize: 11, color: "var(--color-text-soft)", textAlign: "right",
                          marginTop: 4 }}>
                {form.body.length} / 1000
              </p>
            </Field>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              <button onClick={handleToConfirm}
                      style={{ width: "100%", padding: "14px", background: "var(--color-primary)",
                               color: "#fff", border: "none", borderRadius: 12,
                               fontSize: 15, fontWeight: 600, cursor: "pointer",
                               fontFamily: "var(--font-sans)" }}>
                送信内容を確認する
              </button>
              <button onClick={() => navigate("/home")}
                      style={{ width: "100%", padding: "14px", background: "transparent",
                               color: "var(--color-text-mid)", border: "1px solid var(--color-border)",
                               borderRadius: 12, fontSize: 15, cursor: "pointer",
                               fontFamily: "var(--font-sans)" }}>
                メイン画面に戻る
              </button>
            </div>
          </div>
        )}

        {/* ── 送信確認画面 ── */}
        {step === "confirm" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.7 }}>
              以下の内容で送信します。ご確認ください。
            </p>

            <ConfirmItem label="メールアドレス" value={form.email} />
            <ConfirmItem label="タイトル" value={form.title} />
            <ConfirmItem label="お問い合わせ内容" value={form.body} multiline />

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              <button onClick={handleSend} disabled={sending}
                      style={{ width: "100%", padding: "14px", background: "var(--color-primary)",
                               color: "#fff", border: "none", borderRadius: 12,
                               fontSize: 15, fontWeight: 600, cursor: "pointer",
                               fontFamily: "var(--font-sans)", opacity: sending ? 0.6 : 1 }}>
                {sending ? "送信中..." : "送信する"}
              </button>
              <button onClick={() => setStep("form")}
                      style={{ width: "100%", padding: "14px", background: "transparent",
                               color: "var(--color-text-mid)", border: "1px solid var(--color-border)",
                               borderRadius: 12, fontSize: 15, cursor: "pointer",
                               fontFamily: "var(--font-sans)" }}>
                入力内容を修正する
              </button>
            </div>
          </div>
        )}

        {/* ── 送信完了画面 ── */}
        {step === "done" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                        gap: 16, paddingTop: 40, textAlign: "center" }}>
            <p style={{ fontSize: 44 }}>✅</p>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-main)" }}>
              送信が完了しました
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-text-mid)", lineHeight: 1.8 }}>
              お問い合わせありがとうございます。<br />
              内容を確認の上、ご連絡いたします。
            </p>
            <button onClick={() => navigate("/home")}
                    style={{ marginTop: 24, padding: "14px 32px",
                             background: "var(--color-primary)", color: "#fff",
                             border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600,
                             cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              メイン画面に戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── サブコンポーネント ──────────────────────────────

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "12px 14px",
  fontSize: 14,
  color: "var(--color-text-main)",
  background: "#fff",
  border: `1.5px solid ${hasError ? "#e03030" : "rgba(0,0,0,0.12)"}`,
  borderRadius: 10,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "var(--font-sans)",
});

const Field = ({ label, error, children }: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-mid)" }}>
      {label}
    </label>
    {children}
    {error && <p style={{ fontSize: 12, color: "#e03030" }}>{error}</p>}
  </div>
);

const ConfirmItem = ({ label, value, multiline }: {
  label: string;
  value: string;
  multiline?: boolean;
}) => (
  <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px",
                border: "1px solid rgba(0,0,0,0.07)" }}>
    <p style={{ fontSize: 11, color: "var(--color-text-soft)", marginBottom: 6,
                fontWeight: 500, letterSpacing: "0.06em" }}>
      {label}
    </p>
    <p style={{ fontSize: 14, color: "var(--color-text-main)", lineHeight: multiline ? 1.7 : 1.4,
                whiteSpace: multiline ? "pre-wrap" : "normal", wordBreak: "break-all" }}>
      {value}
    </p>
  </div>
);
