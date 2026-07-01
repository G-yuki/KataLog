// src/features/items/pages/ItemDetailPage.tsx
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../firebase/functions";
import { useItems } from "../hooks/useItems";
import { Loading } from "../../../components/Loading";
import { usePair } from "../../../contexts/PairContext";
import { db } from "../../../firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import type { Item, Hearing } from "../../../types";
import { CATEGORY_LABEL, PLACE_CATEGORIES } from "../../../lib/constants";
import { scoreItem } from "../../../lib/scoring";
import { useWeather } from "../../../hooks/useWeather";
import { usePhotoUpload, MAX_PHOTOS } from "../hooks/usePhotoUpload";
import { HeaderAdjustOverlay } from "../components/HeaderAdjustOverlay";
import { PhotoViewer } from "../components/PhotoViewer";

// URL確定済みならそのURL、なければタイトル検索（周辺エリア表示）
const mapsUrl = (item: Pick<Item, "userPlaceUrl" | "title">) => {
  if (item.userPlaceUrl) return item.userPlaceUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.title)}`;
};


export const ItemDetailPage = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from ?? "/home";
  const { pairId, loading: pairLoading } = usePair();
  const { items, loading, setStatus, toggleIsWant, saveDetail, removeItem } = useItems(pairId);

  const [memo, setMemo] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [memoChanged, setMemoChanged] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [urlSaving, setUrlSaving] = useState(false);
  const [editingCompletedAt, setEditingCompletedAt] = useState(false);
  const [completedAtDate, setCompletedAtDate] = useState("");
  const [completedAtHour, setCompletedAtHour] = useState(12);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [headerPosY, setHeaderPosY] = useState(50);
  const [showHeaderAdjust, setShowHeaderAdjust] = useState(false);
  const [hearing, setHearing] = useState<Hearing | null>(null);
  const enrichCalled = useRef(false);

  const item: Item | undefined = items.find((i) => i.itemId === itemId);

  useEffect(() => {
    if (!pairId) return;
    getDoc(doc(db, "pairs", pairId)).then((snap) => {
      if (snap.exists()) setHearing((snap.data().hearing as Hearing) ?? null);
    });
  }, [pairId]);

  const weather = useWeather(hearing?.prefecture ?? undefined);
  const score = useMemo(
    () => item && hearing ? scoreItem(item, hearing, weather) : null,
    [item, hearing, weather]
  );

  const photo = usePhotoUpload(pairId, item, saveDetail);

  useEffect(() => {
    if (!pairLoading && !pairId) navigate("/", { replace: true });
  }, [pairId, pairLoading, navigate]);

  // ヘッダー写真: pinnedPhotoUrl → userPhotos からランダム1枚 → placePhotoRef の優先順
  // userPhotosList.length を dep にすることで、枚数変化時のみ再ランダム選択
  const userPhotosList = item?.userPhotos ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headerPhotoUrl = useMemo<string | null>(() => {
    if (!item) return null;
    if (item.pinnedPhotoUrl) return item.pinnedPhotoUrl;
    if (userPhotosList.length > 0)
      return userPhotosList[Math.floor(Math.random() * userPhotosList.length)];
    if (item.placePhotoRef?.startsWith("https://")) return item.placePhotoRef;
    return null;
  }, [item?.pinnedPhotoUrl, item?.placePhotoRef, userPhotosList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!item) return;
    // memoChanged=true（編集中）のときは Firestore 更新でユーザー入力を上書きしない
    if (!memoChanged) setMemo(item.memo ?? "");
    setRating(item.rating ?? null);
    setHeaderPosY(item.headerPosY ?? 50);
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  // Places 自動エンリッチ: placeId未取得のPlaceカテゴリアイテムを詳細表示時に自動取得
  useEffect(() => {
    if (!item || !pairId) return;
    if (item.placeId !== null) return;
    if (!PLACE_CATEGORIES.includes(item.category as typeof PLACE_CATEGORIES[number])) return;
    if (enrichCalled.current) return;
    enrichCalled.current = true;
    const fn = httpsCallable(functions, "enrichItem");
    fn({ pairId, itemId: item.itemId, title: item.title, prefecture: item.prefecture ?? undefined }).catch(() => {
      enrichCalled.current = false;
    });
  }, [item?.itemId, item?.placeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleEdit = () => {
    if (!item) return;
    setTitleDraft(item.title);
    setEditingTitle(true);
  };

  const handleSaveUrl = async () => {
    if (!item || !pairId) return;
    const trimmed = urlDraft.trim();
    setUrlSaving(true);
    if (!trimmed) {
      // URL削除: placeId もリセットして auto-enrich が再実行されるようにする
      await saveDetail(item.itemId, { userPlaceUrl: null, placeId: null });
      enrichCalled.current = false;
    } else {
      await saveDetail(item.itemId, { userPlaceUrl: trimmed });
      // URLが変わった場合のみ enrichItem を呼ぶ
      if (trimmed !== item.userPlaceUrl) {
        enrichCalled.current = true;
        const fn = httpsCallable(functions, "enrichItem");
        fn({ pairId, itemId: item.itemId, title: item.title, userPlaceUrl: trimmed }).catch(() => {
          enrichCalled.current = false;
        });
      }
    }
    setUrlSaving(false);
    setEditingUrl(false);
  };

  const handleTitleSave = async () => {
    if (!item) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== item.title) {
      await saveDetail(item.itemId, { title: trimmed });
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleTitleSave();
    if (e.key === "Escape") setEditingTitle(false);
  };

  const handleSaveMemo = async () => {
    if (!item) return;
    setSaving(true);
    await saveDetail(item.itemId, { memo: memo.trim() || null });
    setSaving(false);
    setMemoChanged(false);
  };

  const handleRating = async (star: number) => {
    if (!item) return;
    const newRating = rating === star ? null : star;
    setRating(newRating);
    await saveDetail(item.itemId, { rating: newRating });
  };

  const handleSaveCompletedAt = async () => {
    if (!item) return;
    const [y, m, d] = completedAtDate.split("-").map(Number);
    if (!y || !m || !d) return;
    const date = new Date(y, m - 1, d, completedAtHour, 0, 0);
    const { Timestamp } = await import("firebase/firestore");
    await saveDetail(item.itemId, { completedAt: Timestamp.fromDate(date) });
    setEditingCompletedAt(false);
  };

  const handleAdjustSave = async (newPosY: number) => {
    if (!item) return;
    setHeaderPosY(newPosY);
    setShowHeaderAdjust(false);
    await saveDetail(item.itemId, { headerPosY: newPosY });
  };

  const handleDelete = async () => {
    if (!item) return;
    await removeItem(item.itemId);
    navigate(backTo, { replace: true });
  };

  if (loading || !pairId) return <Loading />;
  if (!item) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p style={{ color: "var(--color-text-soft)" }}>アイテムが見つかりません</p>
      <button className="btn-ghost" onClick={() => navigate("/home")}>戻る</button>
    </div>
  );

  const isDone = item.status === "done";
  const hasPhoto = !!headerPhotoUrl;
  const isEnriching = item.placeId === null && (
    PLACE_CATEGORIES.includes(item.category as typeof PLACE_CATEGORIES[number]) || !!item.userPlaceUrl
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh",
                  background: "var(--color-bg)", fontFamily: "var(--font-sans)" }}>

      {/* ── 固定ヘッダー（写真あり / なし） ── */}
      {hasPhoto ? (
        <div style={{ position: "relative", width: "100%", height: 220, flexShrink: 0, overflow: "hidden" }}>
          <img
            src={headerPhotoUrl!}
            alt={item.title}
            onClick={() => setShowHeaderAdjust(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover",
                     objectPosition: `center ${headerPosY}%`,
                     display: "block", cursor: "pointer", userSelect: "none" }}
          />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                        background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 50%, rgba(0,0,0,0.5) 100%)" }} />
          {/* 戻るボタン（写真上） */}
          <button onClick={() => navigate(backTo)}
                  style={{ position: "absolute", top: 16, left: 16,
                           background: "rgba(0,0,0,0.4)", border: "none", cursor: "pointer",
                           borderRadius: "50%", width: 36, height: 36,
                           display: "flex", alignItems: "center", justifyContent: "center",
                           color: "#fff" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Google評価（左下） */}
          {item.placeRating != null && (
            <div style={{ position: "absolute", bottom: 12, left: 14,
                          background: "rgba(0,0,0,0.55)", borderRadius: 20,
                          padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#FFD700" }}>★</span>
              <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                {item.placeRating.toFixed(1)}
              </span>
            </div>
          )}
          {/* おすすめ度バッジ（右上） */}
          {score !== null && (
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3,
                          background: "rgba(0,0,0,0.6)", borderRadius: 20,
                          padding: "3px 9px", fontSize: 10, fontWeight: 700,
                          color: "#fff", fontFamily: "var(--font-sans)" }}>
              おすすめ度 {score.total}%
            </div>
          )}
          {/* お気に入りボタン（右下） */}
          <div style={{ position: "absolute", bottom: 8, right: 12,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <button onClick={() => toggleIsWant(item.itemId, item.isWant)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 26, lineHeight: 1 }}>
              {item.isWant ? "❤️" : "🤍"}
            </button>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.85)",
                           textShadow: "0 1px 3px rgba(0,0,0,0.6)", fontFamily: "var(--font-sans)" }}>
              お気に入り
            </span>
          </div>
        </div>
      ) : (
        /* 写真なし：通常ヘッダー（戻るボタンのみ） */
        <div style={{ flexShrink: 0, paddingTop: 40, paddingLeft: 16, paddingRight: 16,
                      paddingBottom: 8, background: "var(--color-bg)" }}>
          <button onClick={() => navigate(backTo)}
                  style={{ background: "none", border: "none", cursor: "pointer",
                           padding: "4px 8px 4px 0", color: "var(--color-text-mid)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* スクロールエリア */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
      <div className="px-4 pt-5 pb-8">
        {/* タイトル */}
        <div className="flex items-center gap-2 mb-4">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              maxLength={60}
              style={{ flex: 1, fontSize: 17, fontWeight: 700, fontFamily: "var(--font-sans)",
                       color: "var(--color-text-main)", background: "transparent",
                       border: "none", borderBottom: "1.5px solid var(--color-primary)",
                       outline: "none", padding: "2px 0" }}
            />
          ) : (
            <button onClick={handleTitleEdit}
                    style={{ flex: 1, textAlign: "left", background: "transparent",
                             border: "none", cursor: "pointer", display: "flex",
                             alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-sans)",
                             color: "var(--color-text-main)", overflow: "hidden",
                             textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </span>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 2l2 2L4 11H2V9L9 2Z" stroke="var(--color-text-soft)"
                      strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 11, color: "var(--color-text-soft)", flexShrink: 0 }}>編集</span>
            </button>
          )}
        </div>

        {/* カテゴリ・タグ行 */}
        <div className="flex gap-2 mb-5 flex-wrap items-center">
          <Tag label={CATEGORY_LABEL[item.category] ?? item.category} />
          <Tag label={item.type === "outdoor" ? "屋外" : "屋内"} />
          {/* エリア */}
          {(item.prefecture || item.overseas) && (
            <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px",
                           borderRadius: 20, fontFamily: "var(--font-sans)",
                           background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
              {item.prefecture ? `📍 ${item.prefecture}` : `✈️ ${item.overseas}`}
            </span>
          )}
          {isEnriching && (
            <span style={{ fontSize: 11, color: "var(--color-text-soft)" }}>
              地図情報を取得中...
            </span>
          )}
          {/* 右寄せグループ: 写真なし時はハート・スコア、常に削除ボタン */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {!hasPhoto && (
              <button onClick={() => toggleIsWant(item.itemId, item.isWant)}
                      style={{ background: "none", border: "none",
                               cursor: "pointer", display: "flex", flexDirection: "column",
                               alignItems: "center", gap: 1 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{item.isWant ? "❤️" : "🤍"}</span>
                <span style={{ fontSize: 9, color: "var(--color-text-soft)", fontFamily: "var(--font-sans)" }}>
                  お気に入り
                </span>
              </button>
            )}
            {!hasPhoto && score !== null && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff",
                             background: "rgba(0,0,0,0.6)",
                             borderRadius: 20, padding: "3px 9px",
                             fontFamily: "var(--font-sans)" }}>
                おすすめ度 {score.total}%
              </span>
            )}
            <button onClick={() => setShowDeleteConfirm(true)}
                    style={{ background: "transparent",
                             border: "1px solid rgba(200,50,50,0.35)",
                             borderRadius: 8, cursor: "pointer",
                             padding: "5px 12px", display: "flex", alignItems: "center", gap: 4,
                             color: "#c0392b", fontFamily: "var(--font-sans)" }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2 3.5h10M5.5 3.5V2.5h3v1M3.5 3.5l.5 8h6l.5-8" stroke="currentColor"
                      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 11 }}>削除</span>
            </button>
          </div>
        </div>

        {/* 場所・マップ */}
        <div className="card p-4 mb-4">
          {!editingUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <a
                href={mapsUrl(item)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", flex: 1, display: "flex", alignItems: "center", gap: 12 }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>🗺️</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary)" }}>
                    Googleマップで見る
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-soft)" }}>
                    {item.placeName ?? (item.userPlaceUrl ? "登録済みURL" : "タイトルで検索")}
                  </span>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginLeft: 4 }}>
                  <path d="M3 11L11 3M11 3H6M11 3V8" stroke="var(--color-primary)"
                        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <button
                onClick={() => { setUrlDraft(item.userPlaceUrl ?? ""); setEditingUrl(true); }}
                style={{ fontSize: 12, color: item.userPlaceUrl ? "var(--color-primary)" : "var(--color-text-soft)",
                         background: "none", border: "none", cursor: "pointer", padding: 0,
                         display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                  <path d="M8.5 1.5l3 3L4 12H1v-3L8.5 1.5z" stroke="currentColor"
                        strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                {item.userPlaceUrl ? "編集" : "URLを登録"}
              </button>
            </div>
          )}
          {editingUrl ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 11, color: "var(--color-text-soft)" }}>
                Google マップの「共有」→「リンクをコピー」で取得したURLを貼り付けてください。
              </p>
              <input
                autoFocus
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://www.google.com/maps/place/..."
                style={{ fontSize: 12, color: "var(--color-text-main)", width: "100%",
                         border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8,
                         padding: "8px 10px", background: "var(--color-bg)",
                         outline: "none", fontFamily: "var(--font-sans)" }}
              />
              <div style={{ display: "flex", gap: 20, justifyContent: "flex-end" }}>
                <button onClick={() => setEditingUrl(false)}
                        style={{ fontSize: 12, color: "var(--color-text-soft)", background: "none",
                                 border: "none", cursor: "pointer" }}>
                  キャンセル
                </button>
                <button onClick={handleSaveUrl} disabled={urlSaving}
                        style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)",
                                 background: "none", border: "none", cursor: "pointer" }}>
                  {urlSaving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* 完了チェック */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--color-text-main)" }}>
                {isDone ? "✅ 完了！" : "⏳ 未完了"}
              </p>
              {isDone && item.completedAt && !editingCompletedAt && (
                <button
                  onClick={() => {
                    const d = (item.completedAt as { toDate: () => Date }).toDate();
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    setCompletedAtDate(`${yyyy}-${mm}-${dd}`);
                    setCompletedAtHour(d.getHours());
                    setEditingCompletedAt(true);
                  }}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                           display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <span className="text-sm" style={{ color: "var(--color-text-soft)" }}>
                    {(() => {
                      const d = (item.completedAt as { toDate: () => Date }).toDate();
                      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${d.getHours()}時`;
                    })()}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 13 13" fill="none">
                    <path d="M8.5 1.5l3 3L4 12H1v-3L8.5 1.5z" stroke="var(--color-text-soft)"
                          strokeWidth="1.3" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              {isDone && editingCompletedAt && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <input
                    type="date"
                    value={completedAtDate}
                    onChange={(e) => setCompletedAtDate(e.target.value)}
                    style={{ fontSize: 12, border: "1px solid var(--color-border)", borderRadius: 6,
                             padding: "3px 6px", background: "var(--color-bg)",
                             color: "var(--color-text-main)", fontFamily: "var(--font-sans)" }}
                  />
                  <select
                    value={completedAtHour}
                    onChange={(e) => setCompletedAtHour(Number(e.target.value))}
                    style={{ fontSize: 12, border: "1px solid var(--color-border)", borderRadius: 6,
                             padding: "3px 6px", background: "var(--color-bg)",
                             color: "var(--color-text-main)", fontFamily: "var(--font-sans)" }}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{h}時</option>
                    ))}
                  </select>
                  <button onClick={handleSaveCompletedAt}
                          style={{ fontSize: 11, fontWeight: 600, color: "var(--color-primary)",
                                   background: "none", border: "none", cursor: "pointer" }}>
                    保存
                  </button>
                  <button onClick={() => setEditingCompletedAt(false)}
                          style={{ fontSize: 11, color: "var(--color-text-soft)",
                                   background: "none", border: "none", cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setStatus(item.itemId, isDone ? "todo" : "done")}
              className="px-4 py-2 rounded-full font-bold text-sm"
              style={{
                background: isDone ? "var(--color-border)" : "var(--color-primary)",
                color: isDone ? "var(--color-text-mid)" : "white",
              }}
            >
              {isDone ? "取り消す" : "完了にする"}
            </button>
          </div>
          {!isDone && (
            <p style={{ fontSize: 11, color: "var(--color-text-soft)", marginTop: 6, textAlign: "right" }}>
              完了にすると、思い出に記録されます ✨
            </p>
          )}
        </div>

        {/* 評価 */}
        {isDone && (
          <div className="card p-4 mb-4">
            <p className="text-sm font-bold mb-2" style={{ color: "var(--color-text-main)" }}>
              評価
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => handleRating(star)} className="text-2xl">
                  {rating != null && star <= rating ? "⭐" : "☆"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* メモ */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold" style={{ color: "var(--color-text-main)" }}>メモ・日記</p>
            <span className="text-xs" style={{ color: "var(--color-text-soft)" }}>
              {memo.length} / 100
            </span>
          </div>
          <textarea
            className="w-full text-sm outline-none resize-none rounded-xl p-2"
            style={{ background: "var(--color-bg)", color: "var(--color-text-main)", minHeight: 160 }}
            placeholder="感想やメモを残そう..."
            maxLength={100}
            value={memo}
            onChange={(e) => { setMemo(e.target.value); setMemoChanged(true); }}
          />
          {memoChanged && (
            <button
              className="btn-primary mt-2"
              onClick={handleSaveMemo}
              disabled={saving}
            >
              {saving ? "保存中..." : "メモを保存"}
            </button>
          )}
        </div>

        {/* 写真 */}
        {(() => {
          const photos = item.userPhotos ?? [];
          const canAdd = photos.length < MAX_PHOTOS;
          const displayed = photo.photosExpanded ? photos : photos.slice(0, 3);
          return (
            <div className="card p-4 mb-4">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p className="text-sm font-bold" style={{ color: "var(--color-text-main)" }}>
                  写真{photos.length > 0 && <span style={{ fontWeight: 400, fontSize: 11, color: "var(--color-text-soft)", marginLeft: 6 }}>{photos.length}/{MAX_PHOTOS}</span>}
                </p>
                {canAdd && (
                  <label style={{ cursor: photo.photoUploading ? "default" : "pointer",
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "5px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                                  border: `1px solid ${photo.photoUploading ? "var(--color-border)" : "var(--color-primary)"}`,
                                  color: photo.photoUploading ? "var(--color-text-soft)" : "var(--color-primary)",
                                  background: "transparent" }}>
                    <input type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                           style={{ display: "none" }}
                           onChange={photo.handlePhotoUpload} disabled={photo.photoUploading} />
                    {photo.photoUploading ? "アップロード中..." : "＋ 追加"}
                  </label>
                )}
              </div>

              {photos.length === 0 && !photo.photoUploading ? (
                <label style={{ cursor: "pointer", display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", padding: "20px 0",
                                border: "1.5px dashed var(--color-border)", borderRadius: 10, gap: 6 }}>
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                         style={{ display: "none" }}
                         onChange={photo.handlePhotoUpload} disabled={photo.photoUploading} />
                  <span style={{ fontSize: 22 }}>📷</span>
                  <span style={{ fontSize: 12, color: "var(--color-text-soft)" }}>写真を追加する</span>
                </label>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {displayed.map((url, idx) => (
                      <button key={url} onClick={() => photo.setViewerIndex(idx)}
                              style={{ position: "relative", aspectRatio: "1", borderRadius: 8,
                                       overflow: "hidden", border: "none", padding: 0, cursor: "pointer" }}>
                        <img src={url} alt="" loading="lazy"
                             style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </button>
                    ))}
                    {photo.photoUploading && (
                      <div style={{ aspectRatio: "1", borderRadius: 8, background: "rgba(0,0,0,0.06)",
                                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 20 }}>⏳</span>
                      </div>
                    )}
                  </div>
                  {!photo.photosExpanded && photos.length > 3 && (
                    <button onClick={() => photo.setPhotosExpanded(true)}
                            style={{ width: "100%", marginTop: 8, padding: "8px 0", fontSize: 12,
                                     color: "var(--color-text-mid)", background: "none",
                                     border: "1px solid var(--color-border)", borderRadius: 8, cursor: "pointer" }}>
                      残り{photos.length - 3}枚を見る &gt;
                    </button>
                  )}
                  {photo.photoError && (
                    <p style={{ fontSize: 11, color: "#E53E3E", marginTop: 6 }}>{photo.photoError}</p>
                  )}
                  {photos.length > 0 && (
                    <button onClick={() => photo.setShowBulkDeleteConfirm(true)}
                            style={{ width: "100%", marginTop: 8, fontSize: 11,
                                     color: "var(--color-text-soft)", background: "none",
                                     border: "none", cursor: "pointer", textAlign: "right" }}>
                      全ての写真を削除
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })()}

      </div>
      </div>{/* /スクロールエリア */}

      {/* フォトビューアー */}
      {photo.viewerIndex !== null && (
        <PhotoViewer
          photos={item.userPhotos ?? []}
          initialIndex={photo.viewerIndex}
          pinnedPhotoUrl={item.pinnedPhotoUrl}
          onClose={() => photo.setViewerIndex(null)}
          onDelete={photo.handlePhotoDelete}
          onPin={(url) => saveDetail(item.itemId, { pinnedPhotoUrl: url })}
        />
      )}

      {/* ヘッダー写真位置調整オーバーレイ */}
      {showHeaderAdjust && headerPhotoUrl && (
        <HeaderAdjustOverlay
          photoUrl={headerPhotoUrl}
          initialPosY={headerPosY}
          onSave={handleAdjustSave}
          onClose={() => setShowHeaderAdjust(false)}
        />
      )}

      {/* 写真一括削除確認 */}
      {photo.showBulkDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                      display: "flex", alignItems: "flex-end", zIndex: 150 }}
             onClick={() => photo.setShowBulkDeleteConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ width: "100%", background: "var(--color-bg)",
                        borderRadius: "20px 20px 0 0", padding: "28px 20px 48px",
                        display: "flex", flexDirection: "column", gap: 8,
                        fontFamily: "var(--font-sans)" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-main)", textAlign: "center" }}>
              全ての写真を削除しますか？
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text-soft)", textAlign: "center", marginBottom: 8 }}>
              {item.userPhotos?.length ?? 0}枚の写真が削除されます
            </p>
            <button onClick={photo.handleBulkPhotoDelete}
                    style={{ width: "100%", padding: "14px", borderRadius: 12,
                             background: "#E53E3E", color: "#fff", border: "none",
                             fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              削除する
            </button>
            <button onClick={() => photo.setShowBulkDeleteConfirm(false)}
                    style={{ width: "100%", padding: "14px", borderRadius: 12,
                             background: "transparent", color: "var(--color-text-mid)",
                             border: "1px solid var(--color-border)", fontSize: 15, cursor: "pointer" }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                      display: "flex", alignItems: "flex-end", zIndex: 150 }}
             onClick={() => setShowDeleteConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ width: "100%", background: "var(--color-bg)",
                        borderRadius: "20px 20px 0 0", padding: "28px 20px 48px",
                        display: "flex", flexDirection: "column", gap: 8,
                        fontFamily: "var(--font-sans)" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-main)",
                        textAlign: "center" }}>
              このアイテムを削除しますか？
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text-soft)",
                        textAlign: "center", marginBottom: 8 }}>
              削除すると元に戻せません
            </p>
            <button onClick={handleDelete}
                    style={{ width: "100%", padding: "14px", borderRadius: 12,
                             background: "#E53E3E", color: "#fff", border: "none",
                             fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              削除する
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
                    style={{ width: "100%", padding: "14px", borderRadius: 12,
                             background: "transparent", color: "var(--color-text-mid)",
                             border: "1px solid var(--color-border)",
                             fontSize: 15, cursor: "pointer" }}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Tag = ({ label }: { label: string }) => (
  <span className="text-xs font-bold px-3 py-1 rounded-full"
        style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
    {label}
  </span>
);
