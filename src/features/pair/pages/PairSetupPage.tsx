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
import { generateInviteUrl, getInviteParams } from "../../../lib/token";
import { db } from "../../../firebase/firestore";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

type Step = "loading" | "nickname" | "pair";

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
        const pairSnap = await getDoc(doc(db, "pairs", existingPairId));
        if (pairSnap.exists()) {
          const data = pairSnap.data();

          // マッチング完了済み → ホーム
          if (data.matchingFinalized) {
            navigate("/home", { replace: true });
            return;
          }

          // パートナー未参加 → 招待リンク画面に戻す
          if ((data.members as string[]).length === 1) {
            setPairId(existingPairId);
            setInviteUrl(generateInviteUrl(existingPairId, data.inviteToken as string));
            setStep("pair");
            return;
          }

          // パートナー参加済み・セットアップ未完了 → ロール別に遷移
          const isCreator = (data.members as string[])[0] === user.uid;
          if (isCreator) {
            navigate(data.hearing ? "/setup/swipe" : "/setup", { replace: true });
          } else {
            navigate("/setup/partner-waiting", { replace: true });
          }
          return;
        }
        // ペアドキュメントが存在しない場合は通常フローへ
      }

      const inviteParams = getInviteParams();

      // 招待URLあり + displayName設定済み → 直接参加
      if (inviteParams && name) {
        const result = await joinPair(user.uid, inviteParams.pairId, inviteParams.token);
        if (result.success) {
          window.history.replaceState({}, "", "/");
          navigate("/setup/partner-waiting", { replace: true });
          return;
        }
        // 参加失敗（無効なリンク等）はそのままペア画面へ
        setPairError(result.error ?? "招待リンクが無効です。");
      }

      // 招待URLあり + displayName未設定 → ニックネーム設定後に参加（handleNicknameSave内で処理）
      setStep(name ? "pair" : "nickname");
    })();
  }, [user, navigate]);

  // pairId が確定したらペアドキュメントを監視し、メンバーが2名になったら自動遷移
  useEffect(() => {
    if (!pairId) return;
    const unsubscribe = onSnapshot(doc(db, "pairs", pairId), (snap) => {
      if (!snap.exists()) return;
      const members = snap.data().members as string[];
      if (members.length >= 2) {
        navigate("/setup", { replace: true });
      }
    });
    return () => unsubscribe();
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
        window.history.replaceState({}, "", "/");
        navigate("/setup/partner-waiting", { replace: true });
        return;
      }
    }

    setNicknameSaving(false);
    setStep("pair");
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

  // クリップボードコピー
  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === "loading") return <Loading />;

  // ── ニックネーム設定 ──────────────────────────────
  if (step === "nickname") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
        <p className="text-4xl mb-2">👤</p>
        <h2 className="text-xl font-bold text-center"
            style={{ color: "var(--color-text-main)" }}>
          ニックネームを設定
        </h2>
        <p className="text-sm text-center leading-relaxed"
           style={{ color: "var(--color-text-mid)" }}>
          アプリ内での表示名を入力してください。<br />
        </p>

        <input
          type="text"
          className="w-full max-w-xs border-2 rounded-2xl px-4 py-3 text-base font-medium outline-none transition-colors"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-main)" }}
          placeholder=""
          maxLength={10}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onFocus={(e) => { e.target.style.borderColor = "var(--color-primary)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
          autoFocus
        />
        {nicknameError && (
          <p className="text-sm text-red-500 text-center">{nicknameError}</p>
        )}
        <button
          className="btn-primary max-w-xs"
          onClick={handleNicknameSave}
          disabled={!nickname.trim() || nicknameSaving}
        >
          {nicknameSaving ? "保存中..." : "決定する"}
        </button>
      </div>
    );
  }

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
              {copied ? "✅ コピーしました" : "リンクをコピー"}
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
