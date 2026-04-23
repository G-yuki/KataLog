// src/features/pair/pages/PairSetupPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { Loading } from "../../../components/Loading";
import {
  getDisplayName,
  saveDisplayName,
  getUserPairId,
  createPair,
  joinPair,
  getPair,
  reissueInviteToken,
} from "../services/pairService";
import { generateInviteUrl, getInviteParams, clearInviteParams } from "../../../lib/token";
import { db } from "../../../firebase/firestore";
import { doc, getDocFromServer, setDoc, onSnapshot } from "firebase/firestore";
import { QuickGuide } from "../../setup/components/QuickGuide";

type Step = "loading" | "nickname" | "guide" | "pair";

export const PairSetupPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("loading");

  // ニックネーム入力
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [nicknameSaving, setNicknameSaving] = useState(false);

  // ペア状態
  const [pairId, setPairId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waitingForPartner, setWaitingForPartner] = useState(false);

  // 初期化：displayName・pairId の確認 + 招待URL自動参加
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [name, existingPairId] = await Promise.all([
        getDisplayName(user.uid),
        getUserPairId(user.uid),
      ]);

      // すでにペア所属 → ペアの状態を確認して適切な画面へ
      if (existingPairId) {
        const pairSnap = await getDocFromServer(doc(db, "pairs", existingPairId));
        if (pairSnap.exists()) {
          const data = pairSnap.data();
          const members = data.members as string[];

          // 自分がメンバーに含まれていない（相手に除外された）→ pairId をクリアして通常フローへ
          if (!members.includes(user.uid)) {
            await setDoc(doc(db, "users", user.uid), { pairId: null }, { merge: true });
            // fall through to normal flow
          } else {
            // マッチング完了済み → ホーム
            if (data.matchingFinalized) {
              navigate("/home", { replace: true });
              return;
            }

            // パートナー未参加 → 招待リンク画面に戻す
            if (members.length === 1) {
              setPairId(existingPairId);
              setInviteUrl(generateInviteUrl(existingPairId, data.inviteToken as string));
              setStep("pair");
              return;
            }

            // パートナー参加済み・セットアップ未完了 → ロール別に遷移
            const isCreator = members[0] === user.uid;
            if (isCreator) {
              navigate(data.hearing ? "/setup/swipe" : "/setup", { replace: true });
            } else {
              navigate("/setup/partner-waiting", { replace: true });
            }
            return;
          }
        }
        // ペアドキュメントが存在しない場合は通常フローへ
      }

      const inviteParams = getInviteParams();

      // 招待URLあり + displayName設定済み → 直接参加
      if (inviteParams && name) {
        const result = await joinPair(user.uid, inviteParams.pairId, inviteParams.token);
        if (result.success) {
          clearInviteParams();
          window.history.replaceState({}, "", "/");
          navigate("/setup/partner-waiting", { replace: true });
          return;
        }
        // 参加失敗（無効なリンク等）はそのままペア画面へ
        setPairError(result.error ?? "招待リンクが無効です。");
      }

      // 招待URLあり + displayName未設定 → ニックネーム設定後に参加（handleNicknameSave内で処理）
      setStep(name ? "pair" : "nickname");
    })().catch(() => {
      setStep("nickname");
    });
  }, [user, navigate]);

  // pairId が確定したらペアドキュメントを監視し、メンバーが2名になったら自動遷移
  useEffect(() => {
    if (!pairId) return;
    const pairRef = doc(db, "pairs", pairId);
    const checkAndNavigate = async () => {
      const snap = await getDocFromServer(pairRef);
      if (!snap.exists()) return;
      const members = snap.data().members as string[];
      if (members.length >= 2) navigate("/setup", { replace: true });
    };
    const unsubscribe = onSnapshot(pairRef, (snap) => {
      if (!snap.exists()) return;
      const members = snap.data().members as string[];
      if (members.length >= 2) navigate("/setup", { replace: true });
    });
    // iOSバックグラウンド復帰対策
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkAndNavigate();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(checkAndNavigate, 5000);
    return () => {
      unsubscribe();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pairId, navigate]);

  // 招待URLでアクセスした場合は nickname 設定後に自動参加
  const handleNicknameSave = async () => {
    if (!user) return;
    if (!nickname.trim()) {
      setNicknameError("ニックネームを入力してください。");
      return;
    }
    if (nickname.trim().length > 10) {
      setNicknameError("10文字以内で入力してください。");
      return;
    }
    setNicknameSaving(true);
    setNicknameError(null);
    await saveDisplayName(user.uid, nickname.trim());

    // 招待パラメータがあれば自動参加を試みる
    const inviteParams = getInviteParams();
    if (inviteParams) {
      const result = await joinPair(user.uid, inviteParams.pairId, inviteParams.token);
      if (result.success) {
        clearInviteParams();
        window.history.replaceState({}, "", "/");
        navigate("/setup/partner-waiting", { replace: true });
        return;
      }
      // 参加失敗 → エラーを表示してニックネーム画面に留まる
      setNicknameError(result.error ?? "招待リンクが無効です。パートナーに新しいリンクを送ってもらってください。");
      setNicknameSaving(false);
      return;
    }

    setNicknameSaving(false);
    setStep("guide");
  };

  // ペア作成
  const handleCreatePair = async () => {
    if (!user) return;
    setPairLoading(true);
    setPairError(null);
    try {
      const newPairId = await createPair(user.uid);
      const pair = await getPair(newPairId);
      if (pair) {
        setPairId(newPairId);
        setInviteUrl(generateInviteUrl(newPairId, pair.inviteToken));
      }
    } catch {
      setPairError("ペアの作成に失敗しました。もう一度お試しください。");
    } finally {
      setPairLoading(false);
    }
  };

  // 招待URL再発行
  const handleReissue = async () => {
    if (!pairId) return;
    const newToken = await reissueInviteToken(pairId);
    setInviteUrl(generateInviteUrl(pairId, newToken));
    setCopied(false);
  };

  // 招待リンク共有（Web Share API → クリップボードフォールバック）
  const handleCopy = async () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "KataLog - ふたりの体験リスト",
          text: "KataLogに招待します。リンクから参加してください。",
          url: inviteUrl,
        });
        setWaitingForPartner(true);
      } catch {
        // ユーザーがキャンセルした場合は何もしない
      }
    } else {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setWaitingForPartner(true);
    }
  };

  if (step === "loading") return <Loading />;

  if (step === "guide") return <QuickGuide onComplete={() => setStep("pair")} />;

  // ── ニックネーム設定 ──────────────────────────────
  if (step === "nickname") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: "100dvh", padding: "0 40px",
                    background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>

        <img src="/logo.png" alt="KataLog"
             style={{ height: 28, marginBottom: 40, opacity: 0.75 }} />

        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
                     color: "var(--color-text-main)", marginBottom: 8, textAlign: "center" }}>
          ニックネームを設定
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-mid)", textAlign: "center",
                    lineHeight: 1.8, marginBottom: 32 }}>
          アプリ内での表示名を入力してください。
        </p>

        <input
          type="text"
          style={{ width: "100%", maxWidth: 260, fontSize: 18, fontWeight: 500,
                   textAlign: "center", border: "none",
                   borderBottom: "2px solid var(--color-primary)",
                   background: "transparent", color: "var(--color-text-main)",
                   padding: "8px 0", outline: "none", fontFamily: "var(--font-sans)" }}
          maxLength={10}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && nickname.trim()) handleNicknameSave(); }}
          autoFocus
        />
        {nicknameError && (
          <p style={{ fontSize: 12, color: "#e03030", marginTop: 10, textAlign: "center" }}>
            {nicknameError}
          </p>
        )}

        <button
          onClick={handleNicknameSave}
          disabled={!nickname.trim() || nicknameSaving}
          style={{ marginTop: 32, width: "100%", maxWidth: 260, padding: "15px",
                   background: !nickname.trim() || nicknameSaving
                     ? "var(--color-border)" : "var(--color-primary)",
                   color: "#fff", border: "none", borderRadius: 14, fontSize: 15,
                   fontWeight: 600, cursor: !nickname.trim() || nicknameSaving ? "default" : "pointer",
                   fontFamily: "var(--font-sans)", transition: "background 0.2s" }}>
          {nicknameSaving ? "保存中..." : "決定する"}
        </button>
      </div>
    );
  }

  // ── パートナー待機画面 ────────────────────────────
  if (waitingForPartner && pairId) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6 text-center"
         style={{ background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>
      <p style={{ fontSize: 72, lineHeight: 1 }}>✉️</p>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
                   color: "var(--color-text-main)", lineHeight: 1.4 }}>
        パートナーの参加を<br />お待ちください
      </h2>
      <p style={{ fontSize: 14, color: "var(--color-text-mid)", lineHeight: 1.8, maxWidth: 280 }}>
        招待リンクを送ったら、パートナーが参加するまでしばらくお待ちください。<br />
        参加すると自動で次のステップへ進みます。
      </p>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
               style={{ background: "var(--color-primary)", animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
      <button
        onClick={() => setWaitingForPartner(false)}
        style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-soft)",
                 background: "none", border: "none", cursor: "pointer",
                 textDecoration: "underline", fontFamily: "var(--font-sans)" }}
      >
        招待リンクを確認する
      </button>
    </div>
  );

  // ── ペア作成・参加 ────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
      <p className="text-4xl mb-2">🔗</p>
      <h2 className="text-xl font-bold text-center"
          style={{ color: "var(--color-text-main)" }}>
        パートナーと繋がろう
      </h2>

      {!pairId ? (
        <>
          <p className="text-sm text-center leading-relaxed"
             style={{ color: "var(--color-text-mid)" }}>
            ペアを作成して招待リンクをパートナーに送るか、<br />
            受け取ったリンクからここに来た場合は<br />
            パートナーにペアを作成してもらってください。
          </p>
          {pairError && <p className="auth-error">{pairError}</p>}
          <button
            className="btn-primary max-w-xs"
            onClick={handleCreatePair}
            disabled={pairLoading}
          >
            {pairLoading ? "作成中..." : "ペアを作成する"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-center leading-relaxed"
             style={{ color: "var(--color-text-mid)" }}>
            下のリンクをパートナーに送って<br />ペアに招待しましょう。
          </p>

          <div className="card w-full max-w-xs p-4 flex flex-col gap-3">
            <p className="text-xs break-all"
               style={{ color: "var(--color-text-mid)" }}>
              {inviteUrl}
            </p>
            <button className="btn-primary" onClick={handleCopy}>
              {copied ? "✅ コピーしました" : "招待リンクを共有する"}
            </button>
            <button className="btn-ghost text-xs" onClick={handleReissue}>
              リンクを再発行する
            </button>
          </div>

          <p className="text-xs text-center mt-2"
             style={{ color: "var(--color-text-soft)" }}>
            パートナーが参加すると自動で次のステップへ進みます
          </p>
        </>
      )}
    </div>
  );
};
