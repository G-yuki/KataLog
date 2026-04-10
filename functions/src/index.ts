import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// ── アイテム生成（ヒアリング結果 → 50件JSON） ──────────────
export const generateItems = onCall(
  { invoker: "public", secrets: [geminiApiKey], enforceAppCheck: false },
  async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ログインが必要です。");
  }

  const hearing = request.data?.hearing;
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

  const prompt = `あなたはカップル・夫婦向けの体験提案AIです。
以下のヒアリング結果をもとに、このカップルにぴったりな「やりたいこと」リストを50件生成してください。

【ヒアリング結果】
- 好きな体験タイプ：${genres}
- 活動エリア：${hearing.prefecture}（${rangeLabel[hearing.range] ?? hearing.range}）
- 子ども：${childrenLabel[hearing.children] ?? hearing.children}
- 移動手段：${transportLabel[hearing.transport] ?? hearing.transport}
- 予算（1回あたり・ふたり合計）：${budgetLabel[hearing.budget] ?? hearing.budget}
- 屋内/屋外：${indoorLabel[hearing.indoor] ?? hearing.indoor}
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
- title は15文字以内
- category は上記8種類のいずれか。「その他」は上記7カテゴリのどれにも当てはまらない場合のみ使うこと
- 50件のうち「その他」は最大3件まで。違反した場合は超過分を適切なカテゴリに変更してから出力すること
- 件数が50件に満たない場合は追加して必ず50件にすること
- type: outdoor=外出・移動が必要、indoor=自宅・室内で完結
- difficulty: easy=気軽にできる、special=少し特別・準備が必要
- 50件すべて異なる体験にすること
- ヒアリングの好みを反映した具体的なタイトルにすること`;

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

    const items = request.data?.items as Array<{
      title: string;
      category: string;
      rating: number | null;
      memo: string | null;
    }> | undefined;

    if (!items || items.length === 0) {
      throw new HttpsError("invalid-argument", "完了済みアイテムが必要です。");
    }

    const itemList = items
      .map((item, i) => {
        const rating = item.rating != null
          ? `★${item.rating}${item.rating >= 4 ? "（特に印象的な体験）" : ""}`
          : "（評価なし）";
        const memo = item.memo ? `メモ：${item.memo}` : "";
        return `${i + 1}. 【${item.category}】${item.title} ${rating} ${memo}`.trim();
      })
      .join("\n");

    const minChars = 250;
    const maxChars = items.length > 10 ? 500 : 350;

    const prompt = `あなたはカップル・夫婦向けの思い出記録AIです。
以下は、ふたりが一緒に体験した「やりたいことリスト」の完了記録です。
これをもとに、ふたりへの温かいメッセージを含む思い出の文章を日本語で書いてください。

【完了した体験】
${itemList}

【条件】
- ${minChars}〜${maxChars}文字程度
- ふたりへの語りかける口調（「ふたりは〜」「あなたたちは〜」など）
- 具体的な体験名を織り交ぜて自然な文章にすること
- 評価★4以上の体験は特に印象的なエピソードがあるように具体的に描写すること
- 全体のトーンは「懐かしさと期待感が共存する」文体にすること
- 締めの一文は必ずポジティブかつ具体的な次の行動への言及で終えること
- JSONや箇条書き不要。本文のみを返すこと`;

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
