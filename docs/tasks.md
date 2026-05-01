# lifrave 残タスク進捗管理

最終更新: 2026-05-01

## ステータス凡例
- ⬜ 未着手
- 🔄 対応中
- ✅ 完了
- ❌ 保留・要検討

---

## 完了済みタスク

| # | 内容 | 完了日 |
|---|------|--------|
| メイン5 | Androidフォントスケール崩れ（`text-size-adjust`） | 2026-04-23 |
| memory1 | 同日完了アイテムの `createdAt` 二次ソート | 2026-04-23 |
| suggest2 | `pendingSuggestions` Firestore永続化（sessionStorage廃止） | 2026-04-23 |
| メイン3 | HomeGuideスポットライトチュートリアル（初回ホーム表示時） | 2026-04-23 |
| ① | HomeGuide: heart/done-btn → 詳細画面でスポットライト後に閉じる | 2026-04-23 |
| ② | おでかけ: 追加FAB右下・並び替え・検索窓 | 2026-04-23 |
| ③ | 思い出: 年月セレクト期間選択・月セクションヘッダー | 2026-04-23 |
| ④ | 追加画面: 完了日時picker・外出表示 | 2026-04-23 |
| ⑤ | 共通: 画面名17px・ロゴ20pxに拡大 | 2026-04-23 |
| ⑥ | 追加時「追加しました」トースト | 2026-04-23 |
| ⑦ | AI要約: 絵文字フォールバック・既存アイテム除外 | 2026-04-23 |
| ⑧ | ニックネーム画面リデザイン（絵文字除去・ロゴ＋シンプル） | 2026-04-23 |
| ⑨ | スワイプ: key={index} でスライドバック廃止 | 2026-04-23 |
| suggest1 | 全国選択時CF修正・Places検索/AIプロンプトを全国対象に | 2026-04-24 |
| home修正 | フィルタをtryItemsに適用・カテゴリ外出表示・GoodCardにカテゴリ追加・★バッジ削除 | 2026-04-25 |
| 削除UI | home/詳細画面の削除確認をカスタムボトムシートに変更（window.confirm廃止） | 2026-04-25 |
| suggest2 | 全国トグルで range:"anywhere" も同時セット・CF areaNote undefined修正 | 2026-04-25 |
| memory絵文字 | フォールバック📍→✨・CF プロンプトに絵文字例追加・日本語テキスト誤出力を✨に補正 | 2026-04-25 |
| enrich最適化 | placeId===nullのときだけenrichItem呼び出し・失敗時は自動リトライ | 2026-04-25 |
| cost最適化 | enrichPairItems削除（未使用CF）・URL重複保存時のenrich呼び出し抑制 | 2026-04-29 |
| Essentials化 | enrichItem FieldMaskからplaces.photos除去→Text Search Essentials化（無料枠1K→10K・単価1/12） | 2026-04-29 |
| spec統合 | spec.md完全リライト・specs.md削除（API仕様・コスト・既知課題を1ファイルに統合） | 2026-04-29 |

---

## 大型機能（別途設計が必要）

| # | 内容 | ステータス | 備考 |
|---|------|-----------|------|
| suggest1 | 全国選択時に都道府県のみ検索される問題（CF側修正） | ✅ | 2026-04-24 デプロイ済み |
| 地図共有 | 行った場所をマップ表示・URL共有（軽量公開ページ＋publicToken方式） | ⬜ | 設計は確定。Maps JS API $7/1,000loads。Supporter限定 |
| memory要約UI | 「ふたりのN期」要約UI（ベスト体験+ジャンル別バーグラフ） | ⬜ | 設計検討中 |
| 写真アップロード | 詳細画面からユーザー写真をアップロード・表示 | ✅ | 2026-04-30 デプロイ済み |
| Googleマップ写真Storage保存 | enrichItem CF でPlace写真をStorageに永続保存しplacePhotoRefをStorage URLに変更 | ✅ | 2026-05-01 実装済み。キャッシュ切れ時のAPI再課金を排除 |
| MEMORY動画・音楽 | 完了アイテム+写真からスタイル別スライドショー動画+AI BGMを生成 | ⬜ | 無料月1回・Standard月10回・Supporter無制限。Canvas/ffmpeg+Suno API ~$0.015/回 |
| フリーミアム課金 | Stripe連携・planフィールド・SUGGEST/MEMORYカウンター実装 | ⬜ | Phase 2（200〜300ペア到達時）に対応。Stripe手数料3.6%+¥40/件 |

---

## 設計メモ

### 写真アップロード機能
- データモデル: `userPhotos: string[]`（Storage URL 配列をアイテムドキュメントに保存）
- Storage パス: `pairs/{pairId}/items/{itemId}/{uuid}.jpg`
- 表示: メモ・日記の下に配置。最初の3枚を自動ロード、「>」ボタンで追加ロード（lazy）
- クライアント側 1,200px リサイズ（JPEG 80%）必須
- アップロードと削除のみ（カメラロール保存ボタンなし）
- アイテム削除時に `onItemDeleted` CF で Storage ファイルも連動削除
- コスト: 740ペアまで無料枠内。3,000ペアで写真DL+Storage ~$11.6/月追加（詳細は cost-strategy.md §8）

#### 写真セキュリティ・UX強化
- [x] アップロードバリデーション: MIME type + 拡張子 + img.onload（.exe偽装対策）
- [x] HEIC除外: MIMEリストから除外。iOS Safari以外でのHEIC失敗時にSafari案内を表示
- [x] CDNキャッシュ: `uploadBytes` に `cacheControl: "public, max-age=31536000"` 追加
- [x] Lazy Load: 写真グリッド・ビューアーの `<img>` に `loading="lazy"` 追加
- [x] 写真枚数上限: 1アイテム最大20枚（クライアント側チェック）
- [x] プライバシーポリシー・利用規約を写真アップロード対応に更新
- [x] 写真個別削除: ビューアー内に削除前確認を追加
- [x] UI区別: 「全ての写真を削除」と「このアイテムを削除」の混同を防ぐセパレーター追加
- [x] spec.md・manual-line.txt を写真アップロード機能に合わせて更新

### 地図共有機能
- 方式: publicToken（UUIDv4）を pairs コレクションに保存
- 公開ページ: `katalog-jp.web.app/share/{token}`
- Firestore rules: `/shares/{token}` に publicRead 許可
- Maps JS API embed で行った場所をピン表示
- コスト: $7/1,000 ページロード（Maps JavaScript API）
