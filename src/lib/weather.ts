export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow";

const PREFECTURE_LATLNG: Record<string, { lat: number; lng: number }> = {
  "北海道": { lat: 43.06, lng: 141.35 },
  "青森県": { lat: 40.82, lng: 140.74 },
  "岩手県": { lat: 39.70, lng: 141.15 },
  "宮城県": { lat: 38.27, lng: 140.87 },
  "秋田県": { lat: 39.72, lng: 140.10 },
  "山形県": { lat: 38.24, lng: 140.36 },
  "福島県": { lat: 37.75, lng: 140.47 },
  "茨城県": { lat: 36.34, lng: 140.45 },
  "栃木県": { lat: 36.57, lng: 139.88 },
  "群馬県": { lat: 36.39, lng: 139.06 },
  "埼玉県": { lat: 35.86, lng: 139.65 },
  "千葉県": { lat: 35.61, lng: 140.12 },
  "東京都": { lat: 35.69, lng: 139.69 },
  "神奈川県": { lat: 35.45, lng: 139.64 },
  "新潟県": { lat: 37.91, lng: 139.02 },
  "富山県": { lat: 36.70, lng: 137.21 },
  "石川県": { lat: 36.59, lng: 136.63 },
  "福井県": { lat: 36.07, lng: 136.22 },
  "山梨県": { lat: 35.66, lng: 138.57 },
  "長野県": { lat: 36.65, lng: 138.18 },
  "岐阜県": { lat: 35.39, lng: 136.72 },
  "静岡県": { lat: 34.98, lng: 138.38 },
  "愛知県": { lat: 35.18, lng: 136.91 },
  "三重県": { lat: 34.73, lng: 136.51 },
  "滋賀県": { lat: 35.00, lng: 135.87 },
  "京都府": { lat: 35.02, lng: 135.76 },
  "大阪府": { lat: 34.69, lng: 135.50 },
  "兵庫県": { lat: 34.69, lng: 135.18 },
  "奈良県": { lat: 34.69, lng: 135.83 },
  "和歌山県": { lat: 34.23, lng: 135.17 },
  "鳥取県": { lat: 35.50, lng: 134.24 },
  "島根県": { lat: 35.47, lng: 133.06 },
  "岡山県": { lat: 34.66, lng: 133.93 },
  "広島県": { lat: 34.40, lng: 132.46 },
  "山口県": { lat: 34.19, lng: 131.47 },
  "徳島県": { lat: 34.07, lng: 134.56 },
  "香川県": { lat: 34.34, lng: 134.05 },
  "愛媛県": { lat: 33.84, lng: 132.77 },
  "高知県": { lat: 33.56, lng: 133.53 },
  "福岡県": { lat: 33.61, lng: 130.42 },
  "佐賀県": { lat: 33.25, lng: 130.30 },
  "長崎県": { lat: 32.74, lng: 129.87 },
  "熊本県": { lat: 32.79, lng: 130.74 },
  "大分県": { lat: 33.24, lng: 131.61 },
  "宮崎県": { lat: 31.91, lng: 131.42 },
  "鹿児島県": { lat: 31.56, lng: 130.56 },
  "沖縄県": { lat: 26.21, lng: 127.68 },
};

function wmoToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return "clear";
  if (code <= 3 || code === 45 || code === 48) return "cloudy";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "rain";
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

// 日本の緯度経度範囲（海外 lat/lng の誤マッチ防止）
const JAPAN_LAT_MIN = 24, JAPAN_LAT_MAX = 46;
const JAPAN_LNG_MIN = 122, JAPAN_LNG_MAX = 154;

export function latLngToPrefecture(lat: number, lng: number): string | null {
  if (lat < JAPAN_LAT_MIN || lat > JAPAN_LAT_MAX || lng < JAPAN_LNG_MIN || lng > JAPAN_LNG_MAX) {
    return null; // 国外
  }
  let nearest: string | null = null;
  let minDist = Infinity;
  for (const [pref, coords] of Object.entries(PREFECTURE_LATLNG)) {
    const d = (lat - coords.lat) ** 2 + (lng - coords.lng) ** 2;
    if (d < minDist) { minDist = d; nearest = pref; }
  }
  return nearest;
}

export async function fetchWeatherForPrefecture(
  prefecture: string
): Promise<WeatherCondition | null> {
  const coords = PREFECTURE_LATLNG[prefecture];
  if (!coords) return null; // 海外・未対応県はスキップ

  const cacheKey = `weather_${prefecture}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    const { condition, fetchedAt } = JSON.parse(cached) as { condition: WeatherCondition; fetchedAt: number };
    if (Date.now() - fetchedAt < CACHE_TTL_MS) return condition;
  }

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=weather_code`
    );
    const json = await res.json() as { current: { weather_code: number } };
    const condition = wmoToCondition(json.current.weather_code);
    sessionStorage.setItem(cacheKey, JSON.stringify({ condition, fetchedAt: Date.now() }));
    return condition;
  } catch {
    return null;
  }
}
