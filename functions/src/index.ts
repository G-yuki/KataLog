import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";

setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// ── アイテム生成（ヒアリング結果 → 50件JSON） ──────────────
export const generateItems = onCall({ invoker: "public" }, async (request) => {
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
${hearing.freetext ? `- 自由入力：${hearing.freetext}` : ""}

【出力形式】
JSON配列のみを返してください。他のテキストは一切含めないこと。

[
  {
    "title": "タイトル（15文字以内）",
    "category": "おでかけ|映画|本|ゲーム|食事|音楽|スポーツ|その他",
    "type": "outdoor|indoor",
    "difficulty": "easy|special"
  }
]

【ルール】
- title は15文字以内
- category は必ず上記8種類のいずれか
- type: outdoor=屋外・移動が必要、indoor=自宅・室内で完結
- difficulty: easy=気軽にできる、special=少し特別・準備が必要
- 50件すべて異なる体験にすること
- ヒアリングの好みを反映した具体的なタイトルにすること`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // JSON部分のみ抽出
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new HttpsError("internal", "AI応答のパースに失敗しました。");
    }

    const items = JSON.parse(jsonMatch[0]);
    return { items };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "リストの生成に失敗しました。しばらくしてから再試行してください。");
  }
});

// ── 思い出生成（Phase 6 で実装） ───────────────────────────
// export const generateMemory = onCall(async (request) => { ... });
