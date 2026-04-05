# Lifrave 実装計画

仕様の詳細は `プロジェクト引き継ぎ情報.txt` を参照。
べびプリの流用コードは `reference/bbp-app/bbp-app_zip/src/` を参照。

## Git 運用ルール

各フェーズの動作確認・承認後に必ず commit & push する。

```powershell
git add .
git commit -m "phaseN: {変更内容の説明}"
git push origin main
```

コミットメッセージの例：
- `phase1: project setup, Tailwind v4, directory structure`
- `phase2: Firebase config, Firestore rules`
- `phase3: auth, pair flow, AuthGuard`
- `phase4: hearing, Claude API, swipe`
- `phase5: home list, item detail, dnd sort`
- `phase6: suggest, memory generation, settings`
- `phase7: UI polish, deploy`

---

## Phase 1：環境構築・基盤
**完了条件：** `http://localhost:5173` でエラーなく表示される

### ✅ やること
- [x] `npm create vite@latest` でプロジェクト作成
- [x] `npm install`（base）
- [x] `npm install firebase react-router-dom @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [x] `npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer`
- [x] `postcss.config.js` 作成
- [x] `src/index.css` を Tailwind v4 + テーマカラーに置き換え
- [x] `src/` ディレクトリ構造作成
- [x] `App.tsx` をスケルトンに置き換え
- [x] `.env.local` 作成（値は空）
- [x] `npm run dev` でローカル起動確認

### ❌ このフェーズでは触らない
- Firebase 設定ファイル（→ Phase 2）
- 型定義（→ Phase 2）
- ルーティング（→ Phase 3）
- 認証（→ Phase 3）

### Git
```powershell
git add .
git commit -m "phase1: project setup, Tailwind v4, directory structure"
git push origin main
```

---

## Phase 2：Firebase 設定・DB 構築
**完了条件：** Firebase コンソールでプロジェクト作成済み・`.env.local` に値が入っている・Firestore ルールがデプロイされている

### ✅ やること
- [x] Firebase プロジェクト作成（コンソール操作）
- [x] `.env.local` に Firebase 設定値を記入
- [x] `src/firebase/` 各ファイルの内容確認・修正
- [x] `src/types/index.ts` の内容確認・修正
- [x] Firestore セキュリティルール作成（`firestore.rules`）
- [x] `firebase.json` / `firestore.indexes.json` 作成
- [x] `firebase deploy --only firestore:rules`

### ❌ このフェーズでは触らない
- ルーティング（→ Phase 3）
- 認証 UI（→ Phase 3）
- ペアリング（→ Phase 3）

### Git
```powershell
git add .
git commit -m "phase2: Firebase config, Firestore rules"
git push origin main
```

---

## Phase 3：認証・ペアリング
**完了条件：** Google ログイン → ニックネーム設定 → ペア作成/参加 が動作する

### ✅ やること
- [x] `features/auth/` — useAuth hook・AuthGuard
- [x] `features/pair/` — ペア作成・招待URL・参加フロー
- [x] `components/Loading.tsx`
- [x] `routes/` ルーティング設定
- [x] パートナー参加時の自動遷移（onSnapshot 監視）

### ❌ このフェーズでは触らない
- ヒアリング（→ Phase 4）
- スワイプ（→ Phase 4）
- AI 生成（→ Phase 4）

### Git
```powershell
git add .
git commit -m "phase3: auth, pair flow, AuthGuard, auto-navigate on partner join"
git push origin main
```

---

## Phase 4：ヒアリング・AI 生成・スワイプ
**完了条件：** ヒアリング 6 ステップ → AI でリスト生成 → スワイプ選択 → `/home` 遷移 が動作する

### ✅ やること
- [x] `features/setup/` — ヒアリング 6 ステップ画面（`/setup`）
- [x] Cloud Functions 初期化・`generateItems` 実装
- [x] Claude API 呼び出し（50 件 JSON 生成）
- [x] Firestore への items 保存
- [x] スワイプ UI（`/setup/swipe`）
- [x] `firebase deploy --only functions`

### ❌ このフェーズでは触らない
- ホーム・リスト管理（→ Phase 5）

### Git
```powershell
git add .
git commit -m "phase4: hearing, Claude API, swipe"
git push origin main
```

---

## Phase 5：ホーム・リスト管理
**完了条件：** `/home` でリスト表示・フィルタ・ステータス変更・メモ・★ が動作する

### やること
- [x] `features/items/` — useItems hook・itemService
- [x] `/home` — リスト一覧・フィルタ・検索・完了済み折りたたみ
- [x] `/home/:itemId` — アイテム詳細（完了チェック・メモ・★・評価）
- [x] `@dnd-kit` 長押しドラッグ並び替え

### Git
```powershell
git add .
git commit -m "phase5: home list, item detail, dnd sort"
git push origin main
```

---

## Phase 6：提案・思い出生成
**完了条件：** `/suggest` で提案表示・`/memory` で思い出テキスト生成 が動作する

### やること
- `features/suggest/` — ルールベース提案ロジック・「もう一度」3 回制限
- `features/memory/` — 期間選択・Claude API 1 コールで 3 種同時生成
- `/settings` — 設定画面（サインアウト）

### Git
```powershell
git add .
git commit -m "phase6: suggest, memory generation, settings"
git push origin main
```

---

## Phase 7：UI 仕上げ・デプロイ
**完了条件：** Firebase Hosting にデプロイ完了・スマホ表示確認済み

### やること
- モバイル表示確認・微調整
- `/privacy` / `/terms` 静的ページ
- App Check（reCAPTCHA Enterprise）設定
- Firebase Analytics 追加
- `npm run build` → `firebase deploy`
- 本番動作確認

### Git
```powershell
git add .
git commit -m "phase7: UI polish, App Check, deploy"
git push origin main
```
