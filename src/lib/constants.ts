// src/lib/constants.ts

export const GENRES = [
  { id: "nature",  label: "自然・アウトドア", emoji: "🏕️" },
  { id: "gourmet", label: "グルメ・食べ歩き",  emoji: "🍜" },
  { id: "art",     label: "アート・文化",      emoji: "🎨" },
  { id: "music",   label: "音楽・ライブ",      emoji: "🎵" },
  { id: "sports",  label: "スポーツ",          emoji: "⚽" },
  { id: "movie",   label: "映画・ドラマ",      emoji: "🎬" },
  { id: "book",    label: "本・読書",          emoji: "📚" },
  { id: "game",    label: "ゲーム・カフェ",    emoji: "🎮" },
  { id: "theme",   label: "テーマパーク",      emoji: "🎡" },
  { id: "onsen",   label: "温泉・スパ",        emoji: "♨️" },
] as const;

// アイテム category の値（GENRESのid + "other"）
export const CATEGORIES = [
  "nature","gourmet","art","music","sports",
  "movie","book","game","theme","onsen","other",
] as const;

// カテゴリの日本語表示ラベル（画面表示に使う）
export const CATEGORY_LABEL: Record<string, string> = {
  nature:  "自然・アウトドア",
  gourmet: "グルメ・食べ歩き",
  art:     "アート・文化",
  music:   "音楽・ライブ",
  sports:  "スポーツ",
  movie:   "映画・ドラマ",
  book:    "本・読書",
  game:    "ゲーム・カフェ",
  theme:   "テーマパーク",
  onsen:   "温泉・スパ",
  other:   "その他",
};

// Places API enrichを行うカテゴリ（"other"は除外）
export const PLACE_CATEGORIES = [
  "nature","gourmet","art","music","sports",
  "movie","book","game","theme","onsen",
] as const;

// 屋外寄りカテゴリ（SwipePage背景判定用）
export const OUTDOOR_CATEGORIES = ["nature","sports","theme"] as const;

// Google Places API types → category マッピング（enrichItem / 移行CF用）
export const PLACES_TYPE_TO_CATEGORY: Record<string, string> = {
  park:               "nature",
  campground:         "nature",
  natural_feature:    "nature",
  museum:             "art",
  art_gallery:        "art",
  tourist_attraction: "art",
  restaurant:         "gourmet",
  cafe:               "gourmet",
  bar:                "gourmet",
  food:               "gourmet",
  bakery:             "gourmet",
  night_club:         "music",
  gym:                "sports",
  stadium:            "sports",
  bowling_alley:      "sports",
  movie_theater:      "movie",
  library:            "book",
  book_store:         "book",
  amusement_park:     "theme",
  zoo:                "theme",
  aquarium:           "theme",
  spa:                "onsen",
  beauty_salon:       "onsen",
};

// ── カテゴリ表示スタイル（HomePage / SuggestPage / MemoryPage で共用） ──
export const CATEGORY_STYLE: Record<string, { bg: string; emoji: string }> = {
  nature:  { bg: "linear-gradient(135deg, #2A4A3A, #152A20)", emoji: "🏕️" },
  gourmet: { bg: "linear-gradient(135deg, #5C2A1A, #3A1410)", emoji: "🍜" },
  art:     { bg: "linear-gradient(135deg, #3A1E5C, #1E0E3A)", emoji: "🎨" },
  music:   { bg: "linear-gradient(135deg, #0E2828, #061414)", emoji: "🎵" },
  sports:  { bg: "linear-gradient(135deg, #1A3A5C, #0D1E3A)", emoji: "⚽" },
  movie:   { bg: "linear-gradient(135deg, #2A3A5C, #0D1428)", emoji: "🎬" },
  book:    { bg: "linear-gradient(135deg, #3D2B14, #1E1408)", emoji: "📚" },
  game:    { bg: "linear-gradient(135deg, #2A1840, #110A1E)", emoji: "🎮" },
  theme:   { bg: "linear-gradient(135deg, #5C3A1A, #3A2008)", emoji: "🎡" },
  onsen:   { bg: "linear-gradient(135deg, #4A1A1A, #2A0A0A)", emoji: "♨️" },
  other:   { bg: "linear-gradient(135deg, #3A3A2A, #1E1E14)", emoji: "🧭" },
};

// ── ヒアリング選択肢（HearingPage / SuggestPage で共用） ──────────
export const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
] as const;

export const RANGE_OPTIONS = [
  { id: "county",   label: "県内中心" },
  { id: "neighbor", label: "隣県まで" },
  { id: "anywhere", label: "全国OK" },
] as const;

export const CHILDREN_OPTIONS = [
  { id: "none",    label: "いない・予定なし" },
  { id: "infant",  label: "乳幼児あり" },
  { id: "child",   label: "小学生以上あり" },
  { id: "planned", label: "今後予定あり" },
] as const;

export const TRANSPORT_OPTIONS = [
  { id: "transit", label: "電車・バスのみ" },
  { id: "car",     label: "車あり" },
  { id: "both",    label: "両方使う" },
] as const;

export const BUDGET_OPTIONS = [
  { id: "3000",  label: "〜3,000円" },
  { id: "5000",  label: "〜5,000円" },
  { id: "10000", label: "〜10,000円" },
  { id: "30000", label: "〜30,000円" },
  { id: "any",   label: "気にしない" },
] as const;

export const INDOOR_OPTIONS = [
  { id: "outdoor", label: "屋外が好き" },
  { id: "indoor",  label: "屋内が好き" },
  { id: "both",    label: "どちらでもOK" },
] as const;

// ── 海外エリア（UpdateHearingForm / アイテム追加モーダル で共用） ──
export const OVERSEAS_REGIONS = [
  "東南アジア",
  "東アジア",
  "ヨーロッパ",
  "ハワイ・グアム",
  "アメリカ・カナダ",
  "オセアニア",
  "中東・アフリカ",
] as const;

export const OVERSEAS_COUNTRIES: Record<string, string[]> = {
  "東南アジア":      ["タイ", "ベトナム", "バリ島", "シンガポール", "マレーシア", "フィリピン"],
  "東アジア":        ["韓国", "台湾", "中国", "香港"],
  "ヨーロッパ":      ["フランス", "イタリア", "スペイン", "イギリス", "ドイツ", "ポルトガル"],
  "ハワイ・グアム":  ["ハワイ", "グアム", "サイパン"],
  "アメリカ・カナダ": ["アメリカ", "カナダ"],
  "オセアニア":      ["オーストラリア", "ニュージーランド"],
  "中東・アフリカ":  ["UAE（ドバイ）", "エジプト", "南アフリカ"],
};
