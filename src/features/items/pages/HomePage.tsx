// src/features/items/pages/HomePage.tsx
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useItems } from "../hooks/useItems";
import { Loading } from "../../../components/Loading";
import { getDisplayName } from "../../pair/services/pairService";
import { usePair } from "../../../contexts/PairContext";
import { db } from "../../../firebase/firestore";
import { functions } from "../../../firebase/functions";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { CATEGORY_STYLE, CATEGORY_LABEL, CATEGORIES, PREFECTURES, OVERSEAS_REGIONS, OVERSEAS_COUNTRIES } from "../../../lib/constants";
import { BottomNav } from "../../../components/BottomNav";
import { HomeGuide } from "../../setup/components/HomeGuide";
import { addManualItem } from "../services/itemService";
import { useWeather } from "../../../hooks/useWeather";
import { scoreItem } from "../../../lib/scoring";
import type { ScoreBreakdown } from "../../../lib/scoring";
import { heroUrl } from "../../../lib/item";
import type { Item, Category, ItemType, ItemStatus, Hearing, RegionalEvent } from "../../../types";

// sessionStorage から home_state を同期読み込み（pairId 不要の先頭一致サーチ）
function readCachedHomeState(): {
  sortOrder?: "score" | "createdAt";
  selectedCategories?: Category[];
  doneOpen?: boolean;
  hearing?: Hearing | null;
} {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("home_state_")) {
        return JSON.parse(sessionStorage.getItem(key) ?? "{}");
      }
    }
  } catch { /* ignore */ }
  return {};
}

export const HomePage = () => {
  const navigate = useNavigate();
  const { pairId, loading: pairLoading } = usePair();
  const { items, loading } = useItems(pairId);

  const [selectedCategories, setSelectedCategories] = useState<Category[]>(
    () => readCachedHomeState().selectedCategories ?? []
  );
  const [sortOrder, setSortOrder] = useState<"score" | "createdAt">(
    () => readCachedHomeState().sortOrder ?? "createdAt"
  );
  const [catOpen, setCatOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [hearing, setHearing] = useState<Hearing | null>(
    () => readCachedHomeState().hearing ?? null
  );
  const [breakdownItem, setBreakdownItem] = useState<{ item: Item; bd: ScoreBreakdown } | null>(null);

  const openScoreModal = (item: Item, bd: ScoreBreakdown) => {
    setBreakdownItem({ item, bd });
  };
  const closeScoreModal = () => {
    setBreakdownItem(null);
    if (window.history.state?.modal === "score") window.history.back();
  };

  useEffect(() => {
    if (!breakdownItem) return;
    window.history.pushState({ ...window.history.state, modal: "score" }, "");
    const handlePop = () => setBreakdownItem(null);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [breakdownItem]); // eslint-disable-line react-hooks/exhaustive-deps
  const [search, setSearch] = useState("");
  const [doneOpen, setDoneOpen] = useState<boolean>(
    () => readCachedHomeState().doneOpen ?? false
  );
  const [showGuide, setShowGuide] = useState(() => !localStorage.getItem("homeGuideSeen"));
  const [guideDetailOpen, setGuideDetailOpen] = useState(false);
  const [regionalEvents, setRegionalEvents] = useState<RegionalEvent[]>(() => {
    const h = readCachedHomeState().hearing;
    if (!h?.prefecture || h.overseas) return [];
    const dateFrom = new Date().toISOString().split("T")[0];
    try {
      const c = sessionStorage.getItem(`events_${h.prefecture}_${dateFrom}`);
      return c ? (JSON.parse(c) as RegionalEvent[]) : [];
    } catch { return []; }
  });
  const [eventsLoading, setEventsLoading] = useState(false);
  const eventsFetchedForRef = useRef<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  // 詳細から戻った際のスクロール位置復元（sortOrder 等は eager init 済みのためここでは不要）
  useLayoutEffect(() => {
    if (!pairId || loading || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const saved = sessionStorage.getItem(`home_state_${pairId}`);
      if (!saved) return;
      const { scrollTop: s } = JSON.parse(saved) as { scrollTop: number };
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = s ?? 0;
      });
    } catch { /* ignore */ }
  }, [pairId, loading]);

  // フィルター・ソート・hearing 変更時に自動保存
  useEffect(() => {
    if (!pairId || !restoredRef.current) return;
    try {
      sessionStorage.setItem(`home_state_${pairId}`, JSON.stringify({
        selectedCategories, sortOrder, doneOpen, hearing,
        scrollTop: scrollRef.current?.scrollTop ?? 0,
      }));
    } catch { /* ignore */ }
  }, [sortOrder, selectedCategories, doneOpen, hearing, pairId]);

  const navigateToDetail = (itemId: string) => {
    if (pairId) {
      try {
        sessionStorage.setItem(`home_state_${pairId}`, JSON.stringify({
          selectedCategories, sortOrder, doneOpen, hearing,
          scrollTop: scrollRef.current?.scrollTop ?? 0,
        }));
      } catch { /* ignore */ }
    }
    navigate(`/home/${itemId}`);
  };

  // 地域イベント取得（hearing に prefecture が設定されていて国内の場合のみ）
  useEffect(() => {
    if (!hearing || hearing.overseas || !hearing.prefecture) return;
    const today = new Date();
    const dateToDate = new Date();
    dateToDate.setDate(today.getDate() + 7);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const dateFrom = fmt(today);
    const dateTo = fmt(dateToDate);
    const fetchKey = `${hearing.prefecture}_${dateFrom}`;

    // 同じキーで既に取得済み（stale な再実行を無視）
    if (eventsFetchedForRef.current === fetchKey) return;

    const sessionKey = `events_${fetchKey}`;
    const cached = sessionStorage.getItem(sessionKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as RegionalEvent[];
        if (parsed.length > 0) {
          setRegionalEvents(parsed);
          eventsFetchedForRef.current = fetchKey;
          return;
        }
        // 空配列キャッシュは無効として削除し CF を再実行
        sessionStorage.removeItem(sessionKey);
      } catch { /* ignore */ }
    }

    eventsFetchedForRef.current = fetchKey;
    setEventsLoading(true);
    const call = httpsCallable<
      { prefecture: string; dateFrom: string; dateTo: string },
      { events: RegionalEvent[] }
    >(functions, "fetchRegionalEvents");
    call({ prefecture: hearing.prefecture, dateFrom, dateTo })
      .then((res) => {
        const events = res.data.events ?? [];
        // 空を返された場合は既存のイベントを上書きしない
        if (events.length > 0) {
          setRegionalEvents(events);
          try { sessionStorage.setItem(sessionKey, JSON.stringify(events)); } catch { /* ignore */ }
        }
      })
      .catch((e) => console.warn("fetchRegionalEvents:", e))
      .finally(() => setEventsLoading(false));
  }, [hearing?.prefecture, !!hearing?.overseas]); // eslint-disable-line react-hooks/exhaustive-deps

  // 手動追加モーダル
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("other");
  const [newType, setNewType] = useState<ItemType>("indoor");
  const [newStatus, setNewStatus] = useState<ItemStatus>("todo");
  const [newRating, setNewRating] = useState<number | null>(null);
  const [newMapsUrl, setNewMapsUrl] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [newCompletedDate, setNewCompletedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [newCompletedHour, setNewCompletedHour] = useState(new Date().getHours());
  const [newAreaMode, setNewAreaMode] = useState<"none" | "domestic" | "overseas">("none");
  const [newPrefecture, setNewPrefecture] = useState("");
  const [newOverseasRegion, setNewOverseasRegion] = useState<string>(OVERSEAS_REGIONS[0]);
  const [newOverseasCountry, setNewOverseasCountry] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addedToast, setAddedToast] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const closeAddModal = () => {
    setShowAddModal(false);
    if (window.history.state?.modal === "add") window.history.back();
  };

  useEffect(() => {
    if (!showAddModal) return;
    window.history.pushState({ ...window.history.state, modal: "add" }, "");
    const handlePop = () => setShowAddModal(false);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [showAddModal]);

  const handleModalTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleModalTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 60 && (modalContentRef.current?.scrollTop ?? 0) === 0) closeAddModal();
  };

  const resetAddModal = () => {
    setNewTitle(""); setNewCategory("other"); setNewType("indoor");
    setNewStatus("todo"); setNewRating(null); setNewMapsUrl(""); setNewMemo("");
    setNewAreaMode("none"); setNewPrefecture(""); setNewOverseasRegion(OVERSEAS_REGIONS[0]); setNewOverseasCountry("");
    const d = new Date();
    setNewCompletedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setNewCompletedHour(d.getHours());
  };

  const handleAddItem = async () => {
    if (!pairId || !newTitle.trim()) return;
    setAddSaving(true);
    let completedAtDate: Date | undefined;
    if (newStatus === "done" && newCompletedDate) {
      const [y, m, d] = newCompletedDate.split("-").map(Number);
      completedAtDate = new Date(y, m - 1, d, newCompletedHour, 0, 0);
    }
    const prefecture = newAreaMode === "domestic" && newPrefecture ? newPrefecture : undefined;
    const overseas   = newAreaMode === "overseas"
      ? (newOverseasCountry || newOverseasRegion)
      : undefined;
    await addManualItem(pairId, {
      title: newTitle.trim(),
      category: newCategory,
      type: newType,
      status: newStatus,
      rating: newStatus === "done" ? newRating : null,
      memo: newMemo.trim() || null,
      userPlaceUrl: newMapsUrl.trim() || null,
      completedAtDate,
      prefecture,
      overseas,
    });
    setAddSaving(false);
    setShowAddModal(false);
    resetAddModal();
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2500);
  };

  useEffect(() => {
    if (pairLoading) return;
    if (!pairId) { navigate("/", { replace: true }); return; }
    (async () => {
      const pairSnap = await getDoc(doc(db, "pairs", pairId));
      if (!pairSnap.exists()) return;
      const data = pairSnap.data();
      const members = data.members as string[];
      if (data.hearing) setHearing(data.hearing as Hearing);
      const names = await Promise.all(members.map((uid) => getDisplayName(uid)));
      const validNames = names.filter(Boolean) as string[];
      if (validNames.length > 0) {
        sessionStorage.setItem(`pairNames_${pairId}`, validNames.join(" & "));
      }
    })();
  }, [pairId, pairLoading, navigate]);

  const weather = useWeather(hearing?.prefecture ?? undefined);

  const scoreMap = useMemo<Map<string, ScoreBreakdown>>(() => {
    if (!hearing) return new Map();
    return new Map(items.map((item) => [item.itemId, scoreItem(item, hearing, weather)]));
  }, [items, hearing, weather]);

  const { activeItems, doneItems, goItems, goodItems, tryItems } = useMemo(() => {
    const active = items.filter((i) => i.status !== "done");
    const done   = items.filter((i) => i.status === "done");
    return {
      activeItems: active,
      doneItems:   done,
      goItems:     active.filter((i) => i.isWant),
      goodItems:   active.filter((i) => !i.isWant && (i.matchTier ?? "good") !== "try"),
      tryItems:    active.filter((i) => !i.isWant && i.matchTier === "try"),
    };
  }, [items]);

  const { sortedGoItems, filteredGood, filteredTry } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchSearch = (i: Item) => !q || i.title.toLowerCase().includes(q);
    const matchCat    = (i: Item) => selectedCategories.length === 0 || selectedCategories.includes(i.category);
    const byScore     = (a: Item, b: Item) =>
      (scoreMap.get(b.itemId)?.total ?? 0) - (scoreMap.get(a.itemId)?.total ?? 0);

    const filter = (arr: Item[]) => arr.filter((i) => matchSearch(i) && matchCat(i));
    const sort   = (arr: Item[]) => sortOrder === "score" ? [...arr].sort(byScore) : arr;

    return {
      sortedGoItems: filter(goItems),
      filteredGood:  sort(filter(goodItems)),
      filteredTry:   sort(filter(tryItems)),
    };
  }, [goItems, goodItems, tryItems, search, selectedCategories, sortOrder, scoreMap]);

  if (pairLoading || loading) return <Loading message={pairLoading ? "データ確認中..." : "読み込み中..."} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh",
                  background: "var(--color-bg)" }}>

      {/* ── ヘッダー ── */}
      <header style={{ flexShrink: 0, padding: "14px 20px 10px",
                       background: "var(--color-bg)", borderBottom: "1px solid rgba(0,0,0,0.07)",
                       position: "sticky", top: 0, zIndex: 20 }}>
        {/* 左: タイトル + ペア名 ／ 右: ロゴ */}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600,
                         color: "var(--color-text-main)", letterSpacing: "0.01em" }}>
              ホーム
            </h1>
          </div>
          <img src="/logo.png" alt="KataLog" style={{ height: 20, objectFit: "contain" }} />
        </div>
      </header>

      {/* ── フィルター + 並び替え ── */}
      <div data-guide="filter-area"
           style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 12px", background: "var(--color-bg)",
                    borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        {/* カテゴリ ドロップダウン */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setCatOpen((o) => !o)}
            style={{ display: "flex", alignItems: "center", gap: 4,
                     fontSize: 12, padding: "5px 10px", borderRadius: 20,
                     border: selectedCategories.length > 0 ? "none" : "1px solid rgba(0,0,0,0.15)",
                     background: selectedCategories.length > 0 ? "var(--color-text-main)" : "transparent",
                     color: selectedCategories.length > 0 ? "var(--color-bg)" : "var(--color-text-main)",
                     fontFamily: "var(--font-sans)", cursor: "pointer", whiteSpace: "nowrap" }}>
            カテゴリ: {selectedCategories.length === 0 ? "すべて" : `${selectedCategories.length}件`}
            <span style={{ fontSize: 13, opacity: 0.85 }}>▾</span>
          </button>
          {catOpen && (
            <>
              <div onClick={() => setCatOpen(false)}
                   style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                            background: "var(--color-bg)", borderRadius: 12,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                            minWidth: 160, padding: "6px 0", overflow: "hidden" }}>
                <button
                  onClick={() => { setSelectedCategories([]); setCatOpen(false); }}
                  style={{ width: "100%", padding: "8px 14px", textAlign: "left",
                           fontSize: 13, fontFamily: "var(--font-sans)",
                           background: selectedCategories.length === 0 ? "rgba(0,0,0,0.06)" : "transparent",
                           border: "none", cursor: "pointer", color: "var(--color-text-main)" }}>
                  すべて
                </button>
                {CATEGORIES.map((cat) => (
                  <button key={cat}
                    onClick={() => setSelectedCategories((prev) =>
                      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                    )}
                    style={{ width: "100%", padding: "8px 14px", textAlign: "left",
                             display: "flex", alignItems: "center", gap: 8,
                             fontSize: 13, fontFamily: "var(--font-sans)",
                             background: selectedCategories.includes(cat) ? "rgba(0,0,0,0.06)" : "transparent",
                             border: "none", cursor: "pointer", color: "var(--color-text-main)" }}>
                    <span style={{ fontSize: 11, width: 14, color: "var(--color-primary)",
                                   fontWeight: 700, flexShrink: 0 }}>
                      {selectedCategories.includes(cat) ? "✓" : ""}
                    </span>
                    {CATEGORY_LABEL[cat] ?? cat}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 並び替え */}
        <div style={{ position: "relative" }}>
          <button
            data-guide="sort-select"
            onClick={() => setSortOpen((o) => !o)}
            style={{ display: "flex", alignItems: "center", gap: 4,
                     fontSize: 12, padding: "5px 10px", borderRadius: 20,
                     border: sortOrder !== "createdAt" ? "none" : "1px solid rgba(0,0,0,0.15)",
                     background: sortOrder !== "createdAt" ? "var(--color-text-main)" : "transparent",
                     color: sortOrder !== "createdAt" ? "var(--color-bg)" : "var(--color-text-main)",
                     fontFamily: "var(--font-sans)", cursor: "pointer", whiteSpace: "nowrap" }}>
            {sortOrder === "score" ? "おすすめ順" : "新しい順"}
            <span style={{ fontSize: 13, opacity: 0.85 }}>▾</span>
          </button>
          {sortOpen && (
            <>
              <div onClick={() => setSortOpen(false)}
                   style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                            background: "var(--color-bg)", borderRadius: 12,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                            minWidth: 120, padding: "6px 0", overflow: "hidden" }}>
                {([["createdAt", "新しい順"], ["score", "おすすめ順"]] as const).map(([val, lbl]) => (
                  <button key={val}
                    onClick={() => { setSortOrder(val); setSortOpen(false); }}
                    style={{ width: "100%", padding: "8px 14px", textAlign: "left",
                             display: "flex", alignItems: "center", gap: 8,
                             fontSize: 13, fontFamily: "var(--font-sans)",
                             background: sortOrder === val ? "rgba(0,0,0,0.06)" : "transparent",
                             border: "none", cursor: "pointer", color: "var(--color-text-main)" }}>
                    <span style={{ fontSize: 11, width: 14, color: "var(--color-primary)",
                                   fontWeight: 700, flexShrink: 0 }}>
                      {sortOrder === val ? "✓" : ""}
                    </span>
                    {lbl}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 検索窓 ── */}
      <div style={{ flexShrink: 0, padding: "6px 12px",
                    background: "var(--color-bg)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <div data-guide="search-area"
             style={{ display: "flex", alignItems: "center", gap: 6,
                      background: "rgba(0,0,0,0.05)", borderRadius: 20, padding: "5px 12px" }}>
          <span style={{ fontSize: 12, opacity: 0.5 }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="アイテムを検索..."
            style={{ flex: 1, fontSize: 12, border: "none", outline: "none",
                     background: "transparent", color: "var(--color-text-main)",
                     fontFamily: "var(--font-sans)" }}
          />
          {search && (
            <button onClick={() => setSearch("")}
                    style={{ background: "none", border: "none", cursor: "pointer",
                             fontSize: 14, color: "var(--color-text-soft)", lineHeight: 1, padding: 0 }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── スクロールエリア ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 80 }}>

        {/* お気に入りセクション */}
        {sortedGoItems.length > 0 && (
          <div style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <SectionLabel>お気に入り</SectionLabel>
            <div style={{ padding: "0 20px 12px", display: "flex", gap: 10,
                          overflowX: "auto", scrollbarWidth: "none" }}>
              {sortedGoItems.map((item) => (
                <GoCard key={item.itemId} item={item}
                        onClick={() => navigateToDetail(item.itemId)} />
              ))}
            </div>
          </div>
        )}

        {/* おすすめセクション */}
        <div>
          {filteredGood.length > 0 ? (
            <>
              <SectionLabel>おすすめ</SectionLabel>
              <div style={{ padding: "0 20px 4px",
                            display: "grid",
                            gridTemplateRows: "repeat(1, calc((50vw - 25px) * 0.618))",
                            gridAutoFlow: "column",
                            gridAutoColumns: "calc(50vw - 25px)",
                            gap: 10,
                            overflowX: "auto",
                            scrollbarWidth: "none" }}>
                {filteredGood.map((item) => {
                  const bd = scoreMap.get(item.itemId);
                  return (
                    <GoodCard key={item.itemId} item={item}
                              breakdown={bd}
                              onTap={() => navigateToDetail(item.itemId)}
                              onScoreTap={() => bd && openScoreModal(item, bd)} />
                  );
                })}
              </div>
            </>
          ) : (
            activeItems.length === 0 && (
              <EmptyState onAskAI={() => navigate("/suggest")} />
            )
          )}
          {filteredGood.length === 0 && goodItems.length > 0 && selectedCategories.length > 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--color-text-soft)" }}>
                このカテゴリにはアイテムがありません
              </p>
            </div>
          )}
        </div>

        {/* 今週の地域イベントセクション */}
        {(eventsLoading || regionalEvents.length > 0) && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "16px 20px 4px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-mid)",
                             fontFamily: "var(--font-sans)", letterSpacing: "0.06em" }}>
                今週の地域イベント
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-soft)", marginLeft: 8,
                             fontFamily: "var(--font-sans)" }}>
                {hearing?.prefecture}
              </span>
            </div>
            {eventsLoading && regionalEvents.length === 0 ? (
              <div style={{ padding: "12px 20px", fontSize: 12, color: "var(--color-text-soft)",
                            fontFamily: "var(--font-sans)" }}>
                取得中...
              </div>
            ) : (
              <div style={{ padding: "0 20px 12px", display: "flex", gap: 10,
                            overflowX: "auto", scrollbarWidth: "none" }}>
                {regionalEvents.map((ev, i) => {
                  const catStyle = CATEGORY_STYLE[ev.category as keyof typeof CATEGORY_STYLE]
                                ?? CATEGORY_STYLE["other"];
                  const catLabel = CATEGORY_LABEL[ev.category as keyof typeof CATEGORY_LABEL]
                                ?? ev.category;
                  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${ev.title} ${ev.location} ${ev.date}`)}`;
                  return (
                    <div key={i}
                         onClick={() => window.open(searchUrl, "_blank", "noopener,noreferrer")}
                         style={{
                           flexShrink: 0,
                           width: 160,
                           borderRadius: 12,
                           background: catStyle.bg,
                           padding: "12px 12px 10px",
                           cursor: "pointer",
                           display: "flex",
                           flexDirection: "column",
                           gap: 4,
                         }}>
                      <div style={{ fontSize: 18, lineHeight: 1 }}>{catStyle.emoji}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff",
                                   fontFamily: "var(--font-sans)", lineHeight: 1.3,
                                   display: "-webkit-box", WebkitLineClamp: 2,
                                   WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)",
                                   fontFamily: "var(--font-sans)", marginTop: 2 }}>
                        {ev.date} · {ev.location}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)",
                                   fontFamily: "var(--font-sans)" }}>
                        {catLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 試してみる？セクション */}
        {filteredTry.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <SectionLabel>試してみる？</SectionLabel>
            <div style={{ padding: "0 20px 4px",
                          display: "grid",
                          gridTemplateRows: "repeat(1, calc((50vw - 25px) * 0.618))",
                          gridAutoFlow: "column",
                          gridAutoColumns: "calc(50vw - 25px)",
                          gap: 10,
                          overflowX: "auto",
                          scrollbarWidth: "none" }}>
              {filteredTry.map((item) => {
                const bd = scoreMap.get(item.itemId);
                return (
                  <GoodCard key={item.itemId} item={item}
                            breakdown={bd}
                            onTap={() => navigateToDetail(item.itemId)}
                            onScoreTap={() => bd && openScoreModal(item, bd)} />
                );
              })}
            </div>
          </div>
        )}

        {/* 完了トグル */}
        {doneItems.length > 0 && (
          <>
            <button onClick={() => setDoneOpen((o) => !o)}
                    style={{ width: "100%", display: "flex", alignItems: "center",
                             padding: "12px 20px 8px", background: "transparent", border: "none",
                             borderTop: "1px solid rgba(0,0,0,0.05)", cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: "var(--color-text-mid)",
                             fontFamily: "var(--font-sans)", fontWeight: 600, flex: 1, textAlign: "left" }}>
                {doneOpen ? "最新の思い出　閉じる ▲" : "最新の思い出　開く ▼"}
              </span>
            </button>
            {doneOpen && (
              <div style={{ padding: "0 20px" }}>
                {doneItems.slice(0, 10).map((item) => (
                  <DoneRow key={item.itemId} item={item}
                           onTap={() => navigateToDetail(item.itemId)} />
                ))}
                <button onClick={() => navigate("/memory")}
                        style={{ width: "100%", padding: "12px 0", background: "transparent",
                                 border: "none", cursor: "pointer", textAlign: "center",
                                 fontSize: 12, color: "var(--color-primary)",
                                 fontFamily: "var(--font-sans)" }}>
                  これまでの思い出は<span style={{ fontWeight: 700 }}>こちら</span>
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ height: 16 }} />
      </div>

      {/* ── ボトムナビ ── */}
      <BottomNav />

      {/* ── 追加しましたトースト ── */}
      {addedToast && (
        <div style={{
          position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)",
          background: "rgba(30,30,30,0.88)", color: "#fff",
          borderRadius: 24, padding: "10px 22px",
          fontSize: 13, fontWeight: 500, fontFamily: "var(--font-sans)",
          pointerEvents: "none", zIndex: 200,
          animation: "toastIn 0.2s ease",
        }}>
          追加しました✅
        </div>
      )}

      {/* ── 追加FAB ── */}
      <button data-guide="add-btn"
              onClick={() => setShowAddModal(true)}
              style={{ position: "fixed", bottom: 88, right: 16, zIndex: 30,
                       height: 44, borderRadius: 22, padding: "0 20px",
                       background: "#fff", color: "#222",
                       border: "1.5px solid var(--color-accent)",
                       fontSize: 13, fontWeight: 600, cursor: "pointer",
                       boxShadow: "0 4px 14px rgba(201,169,110,0.25)",
                       display: "flex", alignItems: "center", justifyContent: "center",
                       gap: 6, fontFamily: "var(--font-sans)" }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
        アイテム追加
      </button>

      {/* ── おすすめ度 内訳モーダル ── */}
      {breakdownItem && (
        <ScoreBreakdownModal
          item={breakdownItem.item}
          bd={breakdownItem.bd}
          onClose={closeScoreModal}
        />
      )}

      {/* ── ホームガイド（初回のみ） ── */}
      {showGuide && !loading && items.length > 0 && (
        <>
          {guideDetailOpen && (
            <GuideDetailOverlay item={items.find((i) => i.status !== "done") ?? items[0]} />
          )}
          <HomeGuide
            onClose={() => { localStorage.setItem("homeGuideSeen", "1"); setShowGuide(false); }}
            onOpenDetail={() => setGuideDetailOpen(true)}
            onCloseDetail={() => setGuideDetailOpen(false)}
            detailReady={guideDetailOpen}
          />
        </>
      )}


      {/* ── 手動追加モーダル ── */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                      display: "flex", alignItems: "flex-end", zIndex: 100 }}
             onClick={closeAddModal}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ width: "100%", background: "var(--color-bg)", borderRadius: "20px 20px 0 0",
                        display: "flex", flexDirection: "column", maxHeight: "90dvh",
                        overflow: "hidden" }}>
            {/* ドラッグハンドル（スワイプ判定はここだけ） */}
            <div onTouchStart={handleModalTouchStart}
                 onTouchEnd={handleModalTouchEnd}
                 style={{ display: "flex", justifyContent: "center", padding: "12px 20px 8px",
                          flexShrink: 0, touchAction: "none" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2,
                            background: "rgba(0,0,0,0.15)" }} />
            </div>
            {/* スクロール可能なコンテンツ */}
            <div ref={modalContentRef}
                 style={{ flex: 1, overflowY: "auto",
                          display: "flex", flexDirection: "column", gap: 16,
                          padding: "0 20px 48px", overscrollBehavior: "contain",
                          scrollbarWidth: "none" }}>

            {/* タイトル */}
            <div>
              <ModalLabel>タイトル *</ModalLabel>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                     maxLength={60} placeholder="体験のタイトル"
                     style={{ width: "100%", padding: "10px 12px", borderRadius: 8, boxSizing: "border-box",
                              border: "1px solid var(--color-border)", fontSize: 14, outline: "none",
                              background: "var(--color-bg)", color: "var(--color-text-main)",
                              fontFamily: "var(--font-sans)" }} />
            </div>

            {/* カテゴリ */}
            <div>
              <ModalLabel>カテゴリ</ModalLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setNewCategory(cat)}
                          style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20,
                                   border: newCategory === cat ? "none" : "1px solid rgba(0,0,0,0.12)",
                                   background: newCategory === cat ? "var(--color-text-main)" : "transparent",
                                   color: newCategory === cat ? "var(--color-bg)" : "#5C4A35",
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    {CATEGORY_STYLE[cat]?.emoji} {CATEGORY_LABEL[cat] ?? cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 場所 */}
            <div>
              <ModalLabel>場所</ModalLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {([["indoor", "🏠 室内"], ["outdoor", "🗺️ 屋外"]] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setNewType(val)}
                          style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 13,
                                   border: newType === val ? "none" : "1px solid rgba(0,0,0,0.12)",
                                   background: newType === val ? "var(--color-text-main)" : "transparent",
                                   color: newType === val ? "var(--color-bg)" : "#5C4A35",
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* エリア */}
            <div>
              <ModalLabel>エリア（任意）</ModalLabel>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {([["none", "指定なし"], ["domestic", "🏠 国内"], ["overseas", "✈️ 海外"]] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setNewAreaMode(val)}
                          style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                                   border: newAreaMode === val ? "none" : "1px solid rgba(0,0,0,0.12)",
                                   background: newAreaMode === val ? "var(--color-text-main)" : "transparent",
                                   color: newAreaMode === val ? "var(--color-bg)" : "#5C4A35",
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    {lbl}
                  </button>
                ))}
              </div>
              {newAreaMode === "domestic" && (
                <select value={newPrefecture} onChange={(e) => setNewPrefecture(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13,
                                 border: "1px solid var(--color-border)", background: "var(--color-bg)",
                                 color: newPrefecture ? "var(--color-text-main)" : "var(--color-text-soft)",
                                 fontFamily: "var(--font-sans)" }}>
                  <option value="">都道府県（任意）</option>
                  <option value="全国">🗾 全国</option>
                  {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              {newAreaMode === "overseas" && (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {OVERSEAS_REGIONS.map((r) => (
                      <button key={r}
                              onClick={() => { setNewOverseasRegion(r); setNewOverseasCountry(""); }}
                              style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                                       border: newOverseasRegion === r ? "none" : "1px solid rgba(0,0,0,0.12)",
                                       background: newOverseasRegion === r ? "var(--color-text-main)" : "transparent",
                                       color: newOverseasRegion === r ? "var(--color-bg)" : "#5C4A35",
                                       fontFamily: "var(--font-sans)" }}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <select value={newOverseasCountry} onChange={(e) => setNewOverseasCountry(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13,
                                   border: "1px solid var(--color-border)", background: "var(--color-bg)",
                                   color: newOverseasCountry ? "var(--color-text-main)" : "var(--color-text-soft)",
                                   fontFamily: "var(--font-sans)" }}>
                    <option value="">国を選択（任意）</option>
                    {(OVERSEAS_COUNTRIES[newOverseasRegion] ?? []).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* 状態 */}
            <div>
              <ModalLabel>状態</ModalLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {([["todo", "⏳ 未完了"], ["done", "✅ 完了"]] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setNewStatus(val)}
                          style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 13,
                                   border: newStatus === val ? "none" : "1px solid rgba(0,0,0,0.12)",
                                   background: newStatus === val ? "var(--color-text-main)" : "transparent",
                                   color: newStatus === val ? "var(--color-bg)" : "#5C4A35",
                                   cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* 完了日時（完了時のみ） */}
            {newStatus === "done" && (
              <div>
                <ModalLabel>完了日時</ModalLabel>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="date" value={newCompletedDate}
                         onChange={(e) => setNewCompletedDate(e.target.value)}
                         style={{ flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 13,
                                  border: "1px solid var(--color-border)", outline: "none",
                                  background: "var(--color-bg)", color: "var(--color-text-main)",
                                  fontFamily: "var(--font-sans)" }} />
                  <select value={newCompletedHour}
                          onChange={(e) => setNewCompletedHour(Number(e.target.value))}
                          style={{ padding: "8px 10px", borderRadius: 8, fontSize: 13,
                                   border: "1px solid var(--color-border)", outline: "none",
                                   background: "var(--color-bg)", color: "var(--color-text-main)",
                                   fontFamily: "var(--font-sans)" }}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{h}時</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* 評価（完了時のみ有効） */}
            <div style={{ opacity: newStatus === "done" ? 1 : 0.35,
                          pointerEvents: newStatus === "done" ? "auto" : "none" }}>
              <ModalLabel>評価</ModalLabel>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setNewRating(newRating === star ? null : star)}
                          style={{ fontSize: 24, background: "none", border: "none", cursor: "pointer" }}>
                    {newRating != null && star <= newRating ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Maps URL */}
            <div>
              <ModalLabel>Google マップのURL（任意）</ModalLabel>
              <input value={newMapsUrl} onChange={(e) => setNewMapsUrl(e.target.value)}
                     placeholder="https://www.google.com/maps/place/..."
                     style={{ width: "100%", padding: "10px 12px", borderRadius: 8, boxSizing: "border-box",
                              border: "1px solid var(--color-border)", fontSize: 13, outline: "none",
                              background: "var(--color-bg)", color: "var(--color-text-main)",
                              fontFamily: "var(--font-sans)" }} />
            </div>

            {/* メモ */}
            <div>
              <ModalLabel>メモ（任意）</ModalLabel>
              <textarea value={newMemo} onChange={(e) => setNewMemo(e.target.value)}
                        maxLength={100} placeholder="メモを入力..."
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, boxSizing: "border-box",
                                 border: "1px solid var(--color-border)", fontSize: 13, outline: "none",
                                 background: "var(--color-bg)", color: "var(--color-text-main)",
                                 fontFamily: "var(--font-sans)", minHeight: 80, resize: "none" }} />
            </div>

            <button onClick={handleAddItem} disabled={!newTitle.trim() || addSaving}
                    style={{ padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 600,
                             border: "none", cursor: newTitle.trim() ? "pointer" : "default",
                             background: newTitle.trim() ? "var(--color-primary)" : "rgba(0,0,0,0.1)",
                             color: newTitle.trim() ? "#fff" : "var(--color-text-soft)",
                             fontFamily: "var(--font-sans)" }}>
              {addSaving ? "追加中..." : "追加する"}
            </button>
            </div>{/* /スクロールエリア */}
          </div>{/* /モーダル */}
        </div>
      )}

    </div>
  );
};

// ── サブコンポーネント ───────────────────────────────────

const ModalLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-soft)",
              letterSpacing: "0.06em", marginBottom: 6, fontFamily: "var(--font-sans)" }}>
    {children}
  </p>
);

const SectionLabel = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ padding: "6px 20px 8px", fontSize: 12, letterSpacing: "0.08em",
              color: "var(--color-text-mid)", fontFamily: "var(--font-sans)", fontWeight: 600,
              position: "sticky", top: 0, zIndex: 10,
              background: "var(--color-bg)", ...style }}>
    {children}
  </p>
);

const ScoreBreakdownModal = ({ item, bd, onClose }: {
  item: Item; bd: ScoreBreakdown; onClose: () => void;
}) => {
  const hasArea = !!(item.prefecture || item.overseas);
  const rows: { label: string; pts: number; na: boolean; icon: string }[] = [
    { label: "カテゴリ一致",           pts: bd.genres,    na: false,                          icon: bd.genres > 0    ? "✓" : "✗" },
    { label: "環境（屋内外×天気×好み）", pts: bd.env,       na: false,                          icon: bd.env > 0 ? "✓" : bd.env < 0 ? "✗" : "−" },
    { label: "子連れ条件",             pts: bd.children,  na: item.kidsFriendly === undefined, icon: bd.children > 0  ? "✓" : item.kidsFriendly === undefined ? "−" : "✗" },
    { label: "交通手段",               pts: bd.transport, na: item.access === undefined,       icon: bd.transport > 0 ? "✓" : item.access === undefined ? "−" : "✗" },
    { label: "予算",                   pts: bd.budget,    na: item.budgetLevel === undefined,  icon: bd.budget >= 10  ? "✓" : bd.budget > 0 ? "△" : item.budgetLevel === undefined ? "−" : "✗" },
    { label: "今の季節",               pts: bd.season,    na: item.seasonBest === undefined,   icon: bd.season > 0    ? "✓" : item.seasonBest === undefined ? "−" : "✗" },
    { label: "エリア一致",             pts: bd.area,      na: !hasArea,                       icon: bd.area >= 18 ? "✓" : bd.area > 0 ? "△" : !hasArea ? "−" : "✗" },
  ];
  return (
    <div onClick={onClose}
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300,
                  display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()}
           style={{ width: "100%", background: "var(--color-bg)",
                    borderRadius: "20px 20px 0 0",
                    maxHeight: "88dvh", display: "flex", flexDirection: "column",
                    overflow: "hidden" }}>
        <div style={{ padding: "24px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)",
                           fontFamily: "var(--font-sans)" }}>
              おすすめ度 {bd.total}%
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-soft)", marginBottom: 16,
                      fontFamily: "var(--font-sans)" }}>
            {item.title}
          </p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 48px",
                      overscrollBehavior: "contain", scrollbarWidth: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {rows.map(({ label, pts, na, icon }) => (
              <div key={label}
                   style={{ display: "flex", alignItems: "center", gap: 10,
                            padding: "9px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <span style={{ fontSize: 14, width: 18, flexShrink: 0,
                               color: icon === "✓" ? "#2d6a3f" : icon === "△" ? "#d97706" : icon === "✗" ? "#b85450" : "#bbb" }}>
                  {icon}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--color-text-main)",
                               fontFamily: "var(--font-sans)" }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 44, textAlign: "right",
                               fontFamily: "var(--font-sans)",
                               color: na ? "#bbb" : pts > 0 ? "#2d6a3f" : pts < 0 ? "#b85450" : "var(--color-text-soft)" }}>
                  {na ? "情報なし" : pts > 0 ? `+${pts}` : pts < 0 ? `${pts}` : "±0"}
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--color-text-soft)", marginTop: 14, textAlign: "center",
                      fontFamily: "var(--font-sans)", lineHeight: 1.8 }}>
            プラン設定との照合スコアです。<br />
            プランを更新すると変わります。
          </p>
        </div>
      </div>
    </div>
  );
};

const GuideDetailOverlay = ({ item }: { item: Item }) => {
  const hasPhoto = !!item.placePhotoRef && item.placePhotoRef.startsWith("https://");
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1050,
      background: "var(--color-bg)", display: "flex", flexDirection: "column",
      fontFamily: "var(--font-sans)",
    }}>
      {hasPhoto ? (
        <div style={{ position: "relative", width: "100%", height: 220, flexShrink: 0 }}>
          <img src={item.placePhotoRef!} alt={item.title}
               style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0,
                        background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 50%, rgba(0,0,0,0.5) 100%)" }} />
          <div style={{ position: "absolute", bottom: 8, right: 12,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <button data-guide="heart-btn"
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
        <div style={{ flexShrink: 0, paddingTop: 52, paddingLeft: 16, paddingRight: 16, paddingBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 700, flex: 1, color: "var(--color-text-main)" }}>
              {item.title}
            </span>
            <button data-guide="heart-btn"
                    style={{ background: "none", border: "none", cursor: "pointer",
                             display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{item.isWant ? "❤️" : "🤍"}</span>
              <span style={{ fontSize: 9, color: "var(--color-text-soft)" }}>お気に入り</span>
            </button>
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>
        {hasPhoto && (
          <p style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-main)", marginBottom: 16 }}>
            {item.title}
          </p>
        )}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-main)" }}>⏳ 未完了</p>
            <button data-guide="done-btn"
                    className="px-4 py-2 rounded-full font-bold text-sm"
                    style={{ background: "var(--color-primary)", color: "white" }}>
              完了にする
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const GoCard = ({ item, onClick }:
  { item: Item; onClick: () => void }) => {
  const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["other"];
  const photo = heroUrl(item);
  return (
    // カード全体をボタンにしてタップ判定を全面に
    <button onClick={onClick}
            style={{ flexShrink: 0, width: "calc(100vw - 40px)", height: "calc((100vw - 40px) * 0.618)", borderRadius: 12, overflow: "hidden",
                     position: "relative", border: "none", padding: 0, cursor: "pointer" }}>
      {/* 背景：写真 or グラデーション */}
      {photo ? (
        <img src={photo} alt={item.title} loading="lazy"
             style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                      objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: s.bg }} />
      )}
      {/* 絵文字（写真なしのみ） */}
      {!photo && (
        <div style={{ position: "absolute", inset: 0, display: "flex",
                      alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 40, opacity: 0.88,
                         filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))" }}>
            {s.emoji}
          </span>
        </div>
      )}
      {/* 暗幕オーバーレイ */}
      <div style={{ position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, transparent 60%, rgba(0,0,0,0.8) 80%)",
                    pointerEvents: "none" }} />
      {/* タイトル・カテゴリ（下部） */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
                    padding: "8px 10px 12px 10px", textAlign: "left" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em",
                      color: "rgba(255, 255, 255, 0.7)", fontFamily: "var(--font-sans)",
                      marginBottom: 3, textDecoration: "underline", textUnderlineOffset: "2px"}}>
          {CATEGORY_LABEL[item.category] ?? item.category}
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#ffffffee", lineHeight: 1,
                    fontFamily: "var(--font-sans)", margin: 0, paddingLeft: 6,
                    display: "-webkit-box", WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.title}
        </p>
      </div>
    </button>
  );
};

const GoodCard = ({ item, onTap, breakdown, onScoreTap }:
  { item: Item; onTap: () => void; breakdown?: ScoreBreakdown; onScoreTap?: () => void }) => {
  const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["other"];
  const photo = heroUrl(item);
  return (
    <button onClick={onTap}
            style={{ position: "relative", borderRadius: 12, overflow: "hidden", height: "calc((50vw - 25px) * 0.618)",
                     border: "none", padding: 0, cursor: "pointer", width: "100%" }}>
      {photo ? (
        <img src={photo} alt={item.title} loading="lazy"
             style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                      objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: s.bg }} />
      )}
      {!photo && (
        <div style={{ position: "absolute", inset: 0, display: "flex",
                      alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 36, opacity: 0.75,
                         filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>
            {s.emoji}
          </span>
        </div>
      )}
      <div style={{ position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, transparent 45%, rgba(0,0,0,0.8) 80%)",
                    pointerEvents: "none" }} />
      {/* For You バッジ（70%以上のみ） */}
      {breakdown !== undefined && breakdown.total >= 70 && (
        <button
          onClick={(e) => { e.stopPropagation(); onScoreTap?.(); }}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 3,
                   background: "rgba(0,0,0,0.6)",
                   borderRadius: 20, padding: "3px 9px",
                   fontSize: 10, color: "#fff", fontWeight: 700,
                   fontFamily: "var(--font-sans)", letterSpacing: "0.03em",
                   border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
          ✨ For You
        </button>
      )}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
                    padding: "8px 10px 9px 10px", textAlign: "left" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.08em",
                      color: "rgba(255, 255, 255, 0.7)", fontFamily: "var(--font-sans)",
                      marginBottom: 3, textDecoration: "underline", textUnderlineOffset: "2px" }}>
          {CATEGORY_LABEL[item.category] ?? item.category}
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#ffffffee", lineHeight: 1,
                    fontFamily: "var(--font-sans)", margin: 0, paddingLeft: 6,
                    display: "-webkit-box", WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.title}
        </p>
      </div>
    </button>
  );
};

const EmptyState = ({ onAskAI }: { onAskAI: () => void }) => (
  <div style={{ padding: "48px 32px", textAlign: "center" }}>
    <p style={{ fontSize: 36, marginBottom: 16 }}>✨</p>
    <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-main)",
                marginBottom: 8, lineHeight: 1.5, fontFamily: "var(--font-sans)" }}>
      やりたいことが全部完了しました！
    </p>
    <p style={{ fontSize: 13, color: "var(--color-text-mid)", marginBottom: 24, lineHeight: 1.6,
                fontFamily: "var(--font-sans)" }}>
      次の体験を探しに行きましょう！
    </p>
    <button onClick={onAskAI}
            style={{ padding: "12px 28px", background: "var(--color-primary)",
                     color: "#fff", border: "none", borderRadius: 24,
                     fontSize: 13, fontWeight: 500, letterSpacing: "0.04em",
                     fontFamily: "var(--font-sans)", cursor: "pointer" }}>
      ✦ おすすめ体験へ →
    </button>
  </div>
);

const DoneRow = ({ item, onTap }: { item: Item; onTap: () => void }) => {
  const s = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE["other"];
  return (
    <button onClick={onTap}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
                     padding: "11px 0", borderBottom: "1px solid rgba(0,0,0,0.06)",
                     background: "transparent", border: "none", cursor: "pointer" }}>
      <div style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                    overflow: "hidden", position: "relative",
                    background: s.bg, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 20 }}>
        {heroUrl(item) ? (
          <img src={heroUrl(item)!} alt={item.title} loading="lazy"
               style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          s.emoji
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-main)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    fontFamily: "var(--font-sans)" }}>
          {item.title}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-mid)", marginTop: 2,
                    fontFamily: "var(--font-sans)" }}>
          {CATEGORY_LABEL[item.category] ?? item.category}{item.rating != null && ` · ${"⭐".repeat(item.rating) + "☆".repeat(5 - item.rating)}`}
        </p>
      </div>
    </button>
  );
};

