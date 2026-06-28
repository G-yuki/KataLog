import type { Item, Hearing } from "../types";
import type { WeatherCondition } from "./weather";
import { OVERSEAS_COUNTRIES } from "./constants";

export interface ScoreBreakdown {
  genres: number;    // 0 or +30
  indoor: number;    // 0 or +20
  children: number;  // 0 or +15
  transport: number; // 0 or +10
  weather: number;   // -20, 0, or +10
  budget: number;    // 0, +8, or +15
  season: number;    // 0 or +10
  area: number;      // 0, +5, or +10
  total: number;     // 0〜100 に正規化
}

const MAX_RAW = 30 + 20 + 15 + 10 + 10 + 15 + 10 + 10; // 120

const BUDGET_CEILING: Record<string, number> = {
  "3000": 1, "5000": 2, "10000": 3, "30000": 4, "any": 4,
};

const JAPAN_REGION: Record<string, string> = {
  "北海道": "北海道",
  "青森県": "東北", "岩手県": "東北", "宮城県": "東北", "秋田県": "東北", "山形県": "東北", "福島県": "東北",
  "茨城県": "関東", "栃木県": "関東", "群馬県": "関東", "埼玉県": "関東", "千葉県": "関東", "東京都": "関東", "神奈川県": "関東",
  "新潟県": "中部", "富山県": "中部", "石川県": "中部", "福井県": "中部", "山梨県": "中部", "長野県": "中部", "岐阜県": "中部", "静岡県": "中部", "愛知県": "中部",
  "三重県": "近畿", "滋賀県": "近畿", "京都府": "近畿", "大阪府": "近畿", "兵庫県": "近畿", "奈良県": "近畿", "和歌山県": "近畿",
  "鳥取県": "中国", "島根県": "中国", "岡山県": "中国", "広島県": "中国", "山口県": "中国",
  "徳島県": "四国", "香川県": "四国", "愛媛県": "四国", "高知県": "四国",
  "福岡県": "九州・沖縄", "佐賀県": "九州・沖縄", "長崎県": "九州・沖縄", "熊本県": "九州・沖縄",
  "大分県": "九州・沖縄", "宮崎県": "九州・沖縄", "鹿児島県": "九州・沖縄", "沖縄県": "九州・沖縄",
};

// hearing.overseas の値（地域or国）が item.overseas と同一地方に属するか判定
function sameOverseasRegion(a: string, b: string): boolean {
  if (a === b) return true;
  for (const [region, countries] of Object.entries(OVERSEAS_COUNTRIES)) {
    const inA = a === region || countries.includes(a);
    const inB = b === region || countries.includes(b);
    if (inA && inB) return true;
  }
  return false;
}

function calcAreaScore(item: Item, hearing: Hearing): number {
  const hasOverseas = !!hearing.overseas;

  if (item.overseas) {
    if (!hasOverseas) return 0;
    return sameOverseasRegion(item.overseas, hearing.overseas!) ? 10 : 0;
  }

  if (item.prefecture) {
    if (hasOverseas) return 0;
    const hp = hearing.prefecture;
    if (!hp) return 0;
    if (hp === "全国" || item.prefecture === "全国") return 5;
    if (item.prefecture === hp) return 10;
    const ir = JAPAN_REGION[item.prefecture];
    const hr = JAPAN_REGION[hp];
    if (ir && hr && ir === hr) return 5;
    return 0;
  }

  return 0;
}

function currentSeason(): "spring" | "summer" | "autumn" | "winter" {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

export function scoreItem(
  item: Item,
  hearing: Hearing,
  weather: WeatherCondition | null
): ScoreBreakdown {
  const genres = hearing.genres.includes(item.category) ? 30 : 0;

  const indoor =
    hearing.indoor === "both" ||
    (hearing.indoor === "indoor" && item.type === "indoor") ||
    (hearing.indoor === "outdoor" && item.type === "outdoor")
      ? 20 : 0;

  const children =
    item.kidsFriendly === undefined
      ? 0
      : hearing.children === "none"
        ? (item.kidsFriendly ? 0 : 15)
        : (item.kidsFriendly ? 15 : 0);

  const transport =
    item.access === undefined
      ? 0
      : hearing.transport === "both" || item.access === "both" || hearing.transport === item.access
        ? 10 : 0;

  let weatherScore = 0;
  if (item.weatherSensitive !== undefined && weather !== null) {
    if (item.weatherSensitive) {
      weatherScore = (weather === "clear") ? 10 : (weather === "rain" || weather === "snow") ? -20 : 0;
    }
  }

  let budget = 0;
  if (item.budgetLevel !== undefined) {
    const ceiling = BUDGET_CEILING[hearing.budget] ?? 4;
    if (item.budgetLevel <= ceiling) {
      budget = 15;
    } else if (item.budgetLevel === ceiling + 1) {
      budget = 8;
    }
  }

  const season =
    item.seasonBest === undefined
      ? 0
      : item.seasonBest.includes(currentSeason()) ? 10 : 0;

  const area = calcAreaScore(item, hearing);

  const raw = Math.max(0, genres + indoor + children + transport + weatherScore + budget + season + area);
  const total = Math.round((raw / MAX_RAW) * 100);

  return { genres, indoor, children, transport, weather: weatherScore, budget, season, area, total };
}
