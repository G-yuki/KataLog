import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import * as admin from "firebase-admin";

admin.initializeApp();

setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

const geminiApiKey  = defineSecret("GEMINI_API_KEY");
const mapsServerKey = defineSecret("MAPS_SERVER_KEY");

// ── アイテム生成（ヒアリング結果 → 50件JSON） ──────────────
export const generateItems = onCall(
  { invoker: "public", secrets: [geminiApiKey], enforceAppCheck: false },
  async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ログインが必要です。");
  }

  const hearing = request.data?.hearing;
  const existingTitles: string[] = request.data?.existingTitles ?? [];
  if (!hearing) {
    throw new HttpsError("invalid-argument", "ヒアリングデータが不足しています。");
  }

  const genreLabels: Record<string, string> = {
    nature: "自然・アウトドア",
    gourmet: "グルメ・食べ歩き",
    art: "アート・文化",
    music: "音楽・ライブ",
    sports: "スポーツ",
    movie: "映画・ドラマ",
    book: "本・読書",
    game: "ゲーム・カフェ",
    theme: "テーマパーク",
    onsen: "温泉・スパ",
  };

  const childrenLabel: Record<string, string> = {
    none: "子どもなし・予定なし",
    infant: "乳幼児あり",
    child: "小学生以上あり",
    planned: "今後予定あり",
  };

  const transportLabel: Record<string, string> = {
    transit: "電車・バスのみ",
    car: "車あり",
    both: "電車・車どちらも使う",
  };

  const budgetLabel: Record<string, string> = {
    "3000": "〜3,000円",
    "5000": "〜5,000円",
    "10000": "〜10,000円",
    "30000": "〜30,000円",
    any: "気にしない",
  };

  const indoorLabel: Record<string, string> = {
    outdoor: "屋外が好き",
    indoor: "屋内が好き",
    both: "どちらでもOK",
  };

  const rangeLabel: Record<string, string> = {
    county: "県内中心",
    neighbor: "隣県まで",
    anywhere: "全国OK",
  };

  const genres = (hearing.genres as string[])
    .map((g) => genreLabels[g] ?? g)
    .join("、");

  // 海外オプションがある場合はエリア指定を上書き
  const overseasNote = hearing.overseas
    ? `\n- 旅行先：${hearing.overseas}（海外旅行プラン）`
    : "";
  const isZenkoku = hearing.range === "anywhere" || hearing.prefecture === "全国";
  const areaDisplay = isZenkoku ? "全国" : (hearing.prefecture || "未指定");
  const areaRangeLabel = isZenkoku ? "全国" : (rangeLabel[hearing.range] ?? hearing.range ?? "");
  const areaNote = hearing.overseas
    ? ""
    : `- 活動エリア：${areaDisplay}（${areaRangeLabel}）\n`;

  const prompt = `あなたはカップル・夫婦向けの体験提案AIです。
以下のヒアリング結果をもとに、このカップルにぴったりな「やりたいこと」リストを50件生成してください。

【ヒアリング結果】
- 好きな体験タイプ：${genres}
${areaNote}- 子ども：${childrenLabel[hearing.children] ?? hearing.children}
- 移動手段：${transportLabel[hearing.transport] ?? hearing.transport}
- 予算（1回あたり・ふたり合計）：${budgetLabel[hearing.budget] ?? hearing.budget}
- 屋内/屋外：${indoorLabel[hearing.indoor] ?? hearing.indoor}${overseasNote}
${hearing.freetext ? `- 自由入力（最優先で反映すること）：${hearing.freetext}` : ""}

【カテゴリ定義】（必ずいずれか1つを選ぶこと）
- おでかけ：観光・旅行・テーマパーク・温泉・自然・アウトドア・ドライブ・散歩・アート・美術館など外出を伴う体験全般
- 食事：レストラン・カフェ・食べ歩き・料理体験・グルメイベントなど食に関する体験
- 映画：映画館・映画鑑賞・ドラマ視聴など
- 本：読書・書店めぐり・図書館・文学・マンガなど
- ゲーム：ゲームセンター・ボードゲームカフェ・テレビゲーム・eスポーツなど
- 音楽：ライブ・コンサート・カラオケ・楽器演奏・音楽フェスなど
- スポーツ：スポーツ観戦・スポーツ体験・フィットネス・アウトドアスポーツなど
- その他：上記のどれにも明確に当てはまらない体験のみ（極力使わないこと）

【ルール】
- title はGoogleマップで検索しやすい具体的な店名・スポット名・施設名・体験名で15文字以内（例：「箱根登山鉄道で紅葉狩り」「新宿御苑でお花見」「浅草の老舗天ぷらでランチ」）
- 固有名詞を含む具体的なタイトルを優先すること（「カフェに行く」より「猿田彦珈琲でモーニング」）
- category は上記8種類のいずれか。「その他」は上記7カテゴリのどれにも当てはまらない場合のみ使うこと
- 50件のうち「その他」は最大3件まで。違反した場合は超過分を適切なカテゴリに変更してから出力すること
- 件数が50件に満たない場合は追加して必ず50件にすること
- type: outdoor=外出・移動が必要、indoor=自宅・室内で完結
- difficulty: easy=気軽にできる、special=少し特別・準備が必要
- 50件すべて異なる体験にすること
- ヒアリングの好みを反映した具体的なタイトルにすること${
  existingTitles.length > 0
    ? `\n\n【除外リスト（既にリストに存在するため提案しないこと）】\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
    : ""
}`;

  const responseSchema: Schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        title:      { type: SchemaType.STRING },
        category:   { type: SchemaType.STRING, format: "enum", enum: ["おでかけ","食事","映画","本","ゲーム","音楽","スポーツ","その他"] },
        type:       { type: SchemaType.STRING, format: "enum", enum: ["outdoor","indoor"] },
        difficulty: { type: SchemaType.STRING, format: "enum", enum: ["easy","special"] },
      },
      required: ["title","category","type","difficulty"],
    },
  };

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const items = JSON.parse(text);
    return { items };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    console.error("generateItems error:", msg);
    throw new HttpsError("internal", `生成エラー: ${msg}`);
  }
});

// ── 思い出生成（完了済みアイテム → ナラティブ文章） ────────────
export const generateMemory = onCall(
  { invoker: "public", secrets: [geminiApiKey], enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    }

    const { items, todoItems, period } = request.data as {
      items: Array<{
        title: string;
        category: string;
        rating: number | null;
        memo: string | null;
        completedMonth?: string;
      }> | undefined;
      todoItems?: Array<{ title: string; category: string }>;
      period?: string;
    };

    if (!items || items.length === 0) {
      throw new HttpsError("invalid-argument", "完了済みアイテムが必要です。");
    }

    // 完了済み：古い順（時系列）で渡ってくる前提（呼び出し側でソート済み）
    const itemList = items
      .map((item, i) => {
        const rating = item.rating != null ? `★${item.rating}` : "評価なし";
        const month = item.completedMonth ? `${item.completedMonth}` : "";
        const memo = item.memo ? ` メモ：${item.memo}` : "";
        return `${i + 1}. 【${item.category}】${item.title} ${rating}${month ? `・${month}` : ""}${memo}`.trim();
      })
      .join("\n");

    const todoList = todoItems && todoItems.length > 0
      ? todoItems.map((t) => `- 【${t.category}】${t.title}`).join("\n")
      : "（なし）";

    const periodLabel = period && period !== "はじまり" ? period : "はじまり";

    const prompt = `以下のログデータをもとに、指定フォーマット通りに出力してください。

【完了した体験（時系列順）】
${itemList}

【まだ未完了の体験】
${todoList}

【出力フォーマット】

■ ふたりの${periodLabel}を一言で
体験全体を表す短いコピーを1文で（例：「動き続けた春。」）

■ この期間のハイライト
最も評価が高かった体験を2〜3つ、以下の形式で：
1.【体験名】（[カテゴリ]/[月]）★[評価]
　"[メモをもとにした一言エピソード]"

■ ふたりの${periodLabel}の流れ
時系列で体験を以下の形式で並べる：
[体験に合う絵文字]【体験名】（カテゴリ/月）
↓
[体験に合う絵文字]【体験名】（カテゴリ/月）
（全体験を列挙すること。最後の体験には ↓ をつけない）

■ 次のおすすめプラン
まだ未完了のアイテムの中から、次に挑戦してほしい体験をAIが2,3つ選んで以下の形式で提案する。
1.【体験名】（カテゴリ）
理由：ヒアリングの好みや過去の体験からの推測をもとに、ふたりに刺さるように論理的な説明を入れながら書くこと。

【ルール】
- 全体で150〜200文字程度
- 体験がない月はスキップする
- メモがない体験は評価とカテゴリだけで描写する
- 感情的・詩的な表現を意識する
- 「ふたり」という言葉を軸に書く
- フォーマット通りに出力する。それ以外は何も書かない
- [体験に合う絵文字]には必ずUnicode絵文字を1文字入れること（例：食事→🍽️、おでかけ→🗺️、映画→🎬、本→📚、ゲーム→🎮、音楽→🎧、スポーツ→🏃）。日本語テキストや記号は不可`;

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
      const result = await model.generateContent(prompt);
      return { memory: result.response.text().trim() };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      console.error("generateMemory error:", msg);
      throw new HttpsError("internal", `生成エラー: ${msg}`);
    }
  }
);

// ── URL リダイレクト解決 + 場所名抽出 ────────────────────────
const resolvePlaceNameFromUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const finalUrl = res.url;
    const m = finalUrl.match(/\/maps\/place\/([^/@?]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return null;
  }
};

// ── Places エンリッチ（アイテムにGoogle Places情報を付与） ────────────
export const enrichItem = onCall(
  { invoker: "public", secrets: [mapsServerKey], enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    }

    const { pairId, itemId, title, prefecture, userPlaceUrl } = request.data as {
      pairId: string;
      itemId: string;
      title: string;
      prefecture?: string;
      userPlaceUrl?: string;
    };

    if (!pairId || !itemId || !title) {
      throw new HttpsError("invalid-argument", "パラメータが不足しています。");
    }

    // userPlaceUrl が渡された場合はリダイレクト解決して場所名を取得
    let resolvedTitle = title;
    if (userPlaceUrl) {
      const placeName = await resolvePlaceNameFromUrl(userPlaceUrl);
      if (placeName) resolvedTitle = placeName;
    }

    const textQuery = (userPlaceUrl && resolvedTitle !== title)
      ? resolvedTitle
      : (prefecture ? `${resolvedTitle} ${prefecture}` : resolvedTitle);

    try {
      // Step 1: Text Search（Essentials tier — places.photos を除外）
      const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": mapsServerKey.value(),
          "X-Goog-FieldMask": "places.id,places.location",
        },
        body: JSON.stringify({
          textQuery,
          languageCode: "ja",
          minRating: 3.5,
          pageSize: 5,
        }),
      });

      const searchData = await searchRes.json() as {
        places?: Array<{
          id: string;
          location?: { latitude: number; longitude: number };
        }>;
      };

      const place = searchData.places?.[0] ?? null;

      // Step 2: Place Details Photos（Enterprise tier — placeId が取れた場合のみ）
      let photoRef: string | null = null;
      if (place?.id) {
        const detailRes = await fetch(
          `https://places.googleapis.com/v1/places/${place.id}`,
          {
            headers: {
              "X-Goog-Api-Key": mapsServerKey.value(),
              "X-Goog-FieldMask": "photos",
            },
          }
        );
        const detailData = await detailRes.json() as { photos?: Array<{ name: string }> };
        photoRef = detailData.photos?.[0]?.name ?? null;
      }

      // placeId を "" にすることで「検索済みだが未発見」を表し、再呼び出しを防ぐ
      await admin.firestore()
        .doc(`pairs/${pairId}/items/${itemId}`)
        .update({
          placeId:       place?.id ?? "",
          placePhotoRef: photoRef,
          lat:           place?.location?.latitude ?? null,
          lng:           place?.location?.longitude ?? null,
        });

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      console.error("enrichItem error:", msg);
      throw new HttpsError("internal", `エンリッチエラー: ${msg}`);
    }
  }
);

// ── アイテム削除トリガー（TTL 削除時に Storage 写真を削除） ────────────
export const onItemDeleted = onDocumentDeleted(
  {
    document: "pairs/{pairId}/items/{itemId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const placePhotoRef: string | null = data.placePhotoRef ?? null;
    // Storage URL でなければ何もしない
    if (!placePhotoRef ||
        (!placePhotoRef.startsWith("https://storage.googleapis.com/") &&
         !placePhotoRef.startsWith("https://firebasestorage.googleapis.com/"))) return;

    const { pairId, itemId } = event.params;
    const storagePath = `pairs/${pairId}/items/${itemId}.jpg`;

    try {
      const bucket = admin.storage().bucket();
      await bucket.file(storagePath).delete();
      console.log(`onItemDeleted: deleted storage photo ${storagePath}`);
    } catch (e) {
      // ファイルが存在しない場合は無視
      console.warn(`onItemDeleted: could not delete ${storagePath}`, e);
    }
  }
);

