import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import * as admin from "firebase-admin";
import { randomUUID } from "crypto";

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
- nature：公園・山・海・自然・アウトドア・ドライブ・散歩など自然・屋外体験
- gourmet：レストラン・カフェ・食べ歩き・料理体験・グルメイベントなど食に関する体験
- art：美術館・博物館・ギャラリー・文化施設・観光地・アート体験など文化体験
- music：ライブ・コンサート・カラオケ・楽器演奏・音楽フェスなど
- sports：スポーツ観戦・スポーツ体験・フィットネス・アウトドアスポーツなど
- movie：映画館・映画鑑賞・ドラマ視聴など
- book：読書・書店めぐり・図書館・文学・マンガなど
- game：ゲームセンター・ボードゲームカフェ・テレビゲーム・eスポーツなど
- theme：テーマパーク・遊園地・水族館・動物園など
- onsen：温泉・スパ・サウナ・銭湯・リラクゼーションなど
- other：上記のどれにも明確に当てはまらない体験のみ（極力使わないこと）

【ルール】
- title はGoogleマップで検索しやすい具体的な店名・スポット名・施設名・体験名で15文字以内（例：「箱根登山鉄道で紅葉狩り」「新宿御苑でお花見」「浅草の老舗天ぷらでランチ」）
- 固有名詞を含む具体的なタイトルを優先すること（「カフェに行く」より「猿田彦珈琲でモーニング」）
- category は上記11種類のいずれか。「other」は上記10カテゴリのどれにも当てはまらない場合のみ使うこと
- 50件のうち「other」は最大3件まで。違反した場合は超過分を適切なカテゴリに変更してから出力すること
- 件数が50件に満たない場合は追加して必ず50件にすること
- type: outdoor=外出・移動が必要、indoor=自宅・室内で完結
- difficulty: easy=気軽にできる、special=少し特別・準備が必要
- budgetLevel: 1人あたりの目安費用（1=〜¥3,000 / 2=〜¥5,000 / 3=〜¥10,000 / 4=〜¥30,000）
- kidsFriendly: true=子連れ・ファミリー向け / false=大人向け・子ども不向き
- access: transit=電車・バス等の公共交通でアクセス可 / car=車が必要 / both=どちらでもOK
- weatherSensitive: true=天気（雨・暑さ等）に大きく左右される / false=天候を問わず楽しめる
- seasonBest: 最も楽しめる季節（複数可、通年楽しめる場合は空配列）
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
        title:            { type: SchemaType.STRING },
        category:         { type: SchemaType.STRING, format: "enum", enum: ["nature","gourmet","art","music","sports","movie","book","game","theme","onsen","other"] },
        type:             { type: SchemaType.STRING, format: "enum", enum: ["outdoor","indoor"] },
        difficulty:       { type: SchemaType.STRING, format: "enum", enum: ["easy","special"] },
        budgetLevel:      { type: SchemaType.INTEGER },
        kidsFriendly:     { type: SchemaType.BOOLEAN },
        access:           { type: SchemaType.STRING, format: "enum", enum: ["transit","car","both"] },
        weatherSensitive: { type: SchemaType.BOOLEAN },
        seasonBest:       { type: SchemaType.ARRAY, items: { type: SchemaType.STRING, format: "enum", enum: ["spring","summer","autumn","winter"] } },
      },
      required: ["title","category","type","difficulty","budgetLevel","kidsFriendly","access","weatherSensitive","seasonBest"],
    },
  };

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
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
      : null;

    const periodLabel = period && period !== "はじまり" ? period : "はじまり";

    const prompt = `以下のログデータをもとに、指定フォーマット通りに出力してください。

【対象期間】${periodLabel}（この期間の体験のみを使って出力すること。期間は変えないこと）

【完了した体験（時系列順）】
${itemList}
${todoList ? `\n【今後の予定（参考・おすすめプラン選定に使うこと）】\n${todoList}\n` : ""}
【出力フォーマット】

▶ テーマ
体験全体を表す短いコピーを1文で（例：「動き続けた春。」）

▶ ハイライト
最も印象的な体験のエピソードを2〜3つ、以下の形式で：
・"[メモや評価をもとにした一言エピソード]"

▶ 軌跡
時系列で体験を以下の形式で：
・[絵文字]【体験名】（月）
（全体験を列挙すること）

▶ 次のおすすめ体験
今後の予定から2〜3つ選び、以下の形式で：
・【体験名】
理由：[ふたりの好みや過去の体験をふまえた理由を1〜2文で]

【ルール】
- 全体で300〜400文字程度
- 体験がない月はスキップする
- 感情的・詩的な表現を意識する
- 「ふたり」という言葉を軸に書く
- フォーマット通りに出力する。それ以外は何も書かない
- [絵文字]には必ずUnicode絵文字を1文字入れること（例：食事→🍽️、おでかけ→🗺️、映画→🎬、本→📚、ゲーム→🎮、音楽→🎧、スポーツ→🏃）。日本語テキストや記号は不可`;

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
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

    let resolvedTitle = title;
    if (userPlaceUrl) {
      const placeName = await resolvePlaceNameFromUrl(userPlaceUrl);
      if (placeName) resolvedTitle = placeName;
    }

    const textQuery = (userPlaceUrl && resolvedTitle !== title)
      ? resolvedTitle
      : (prefecture ? `${resolvedTitle} ${prefecture}` : resolvedTitle);

    // Step 1: Text Search（Essentials tier）
    // 失敗時は place=null のまま続行 → Firestore に placeId="" を確定書き込みして再呼び出しを防ぐ
    type PlaceResult = { id: string; location?: { latitude: number; longitude: number }; types?: string[] };
    let place: PlaceResult | null = null;
    try {
      const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": mapsServerKey.value(),
          "X-Goog-FieldMask": "places.id,places.location,places.types",
        },
        body: JSON.stringify({
          textQuery,
          languageCode: "ja",
          minRating: 3.5,
          pageSize: 5,
        }),
      });
      const searchData = await searchRes.json() as { places?: PlaceResult[] };
      place = searchData.places?.[0] ?? null;
    } catch (e) {
      // ネットワークエラー・JSONパースエラー（非JSON応答）等
      // place=null のまま Firestore 書き込みに進み placeId="" で確定させる
      console.warn("enrichItem Step1 failed, marking as no-place to stop retry:", e);
    }

    // Step 2: Place Details Photos + Rating（Enterprise tier — place 発見時のみ）
    let placePhotoRef: string | null = null;
    let placeRating: number | null = null;
    if (place?.id) {
      try {
        const detailRes = await fetch(
          `https://places.googleapis.com/v1/places/${place.id}`,
          {
            headers: {
              "X-Goog-Api-Key": mapsServerKey.value(),
              "X-Goog-FieldMask": "photos,rating",
            },
          }
        );
        if (!detailRes.ok) throw new Error(`Place Details HTTP ${detailRes.status}`);
        const detailData = await detailRes.json() as { photos?: Array<{ name: string }>; rating?: number };
        placeRating = detailData.rating ?? null;
        const photoName = detailData.photos?.[0]?.name ?? null;

        if (photoName) {
          try {
            const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${mapsServerKey.value()}`;
            const photoRes = await fetch(mediaUrl);
            if (photoRes.ok) {
              const buffer = Buffer.from(await photoRes.arrayBuffer());
              const bucket = admin.storage().bucket();
              const file = bucket.file(`pairs/${pairId}/items/${itemId}.jpg`);
              const token = randomUUID();
              await file.save(buffer, {
                contentType: "image/jpeg",
                metadata: {
                  cacheControl: "public, max-age=31536000",
                  metadata: { firebaseStorageDownloadTokens: token },
                },
              });
              const enc = encodeURIComponent(file.name);
              placePhotoRef = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${enc}?alt=media&token=${token}`;
            }
          } catch (e) {
            console.warn("place photo Storage upload failed:", e);
          }
        }
      } catch (e) {
        console.warn("Place Details fetch failed, saving without photo:", e);
      }
    }

    // Firestore 確定書き込み（Step1/2 の成否にかかわらず必ず実行）
    // placeId="" = 「検索済み・場所なし or Step1失敗」→ 以降の詳細画面オープンで再呼び出しされない
    await admin.firestore()
      .doc(`pairs/${pairId}/items/${itemId}`)
      .update({
        placeId:      place?.id ?? "",
        placePhotoRef,
        placeRating,
        lat:          place?.location?.latitude ?? null,
        lng:          place?.location?.longitude ?? null,
        placeTypes:   place?.types ?? null,
      });

    return { ok: true };
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

    const { pairId, itemId } = event.params;
    const bucket = admin.storage().bucket();

    // placePhotoRef（Storage URL の場合のみ削除）
    const placePhotoRef: string | null = data.placePhotoRef ?? null;
    if (placePhotoRef &&
        (placePhotoRef.startsWith("https://storage.googleapis.com/") ||
         placePhotoRef.startsWith("https://firebasestorage.googleapis.com/"))) {
      try {
        await bucket.file(`pairs/${pairId}/items/${itemId}.jpg`).delete();
      } catch (e) {
        console.warn(`onItemDeleted: place photo delete failed`, e);
      }
    }

    // userPhotos（ユーザーアップロード写真）を全件削除
    const userPhotos: string[] = data.userPhotos ?? [];
    await Promise.all(userPhotos.map(async (url: string) => {
      const match = url.match(/\/o\/([^?]+)/);
      if (!match) return;
      try {
        await bucket.file(decodeURIComponent(match[1])).delete();
      } catch (e) {
        console.warn(`onItemDeleted: user photo delete failed`, e);
      }
    }));
  }
);

