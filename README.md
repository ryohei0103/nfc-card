# NFC電子名刺

NFCカード（またはQR/URL共有）でプロフィールページに案内できる、電子名刺アプリ。フレームワーク不使用の素のHTML/CSS/JSで、Supabaseでログイン・保存・アクセス解析を行います。

## ファイル構成

```
files/
├── index.html       ログイン・新規登録
├── dashboard.html    マイページ（プロフィール編集・デコレーション・NFC書き込み・解析）
├── qr.html            QRコード表示・読み取り専用ページ
├── p.html              公開プロフィールページ（誰でも閲覧可、?u=スラッグ）
├── style.css             見た目（CSS）
├── config.js               SupabaseのURL・anon keyの設定
├── common.js                共通ヘルパー（Supabaseクライアント、vCard生成、テーマ適用）
├── auth.js                   index.html のロジック
├── dashboard.js                dashboard.html のロジック
├── qr.js                        qr.html のロジック
├── public.js                     p.html のロジック
└── schema.sql                     Supabaseに適用済みのテーブル・RLS・Storage定義
```

依存はCDN経由のみです（各HTML内で読み込み済み）。
- `@supabase/supabase-js@2`（Supabaseクライアント）
- `qrcodejs`（自分の名刺ページのQRコード生成、qr.htmlのみ）
- `jsQR`（カメラ映像からのQRコード読み取り、qr.htmlのみ）
- Google Fonts（Zen Kaku Gothic New / Noto Sans JP）

ビルドツールは使っていません。ただし **NFC書き込み機能はHTTPS配信が必須**（Web NFC APIの制約）なので、Vercel / Netlify / GitHub Pages などにデプロイして使ってください（`index.html`をfile://で開くだけでも他の機能は一通り動作します）。

## 使い方

1. `index.html` で新規登録 → ログイン
2. `dashboard.html` でプロフィール（名前・ふりがな・会社名・役職・自己紹介・電話番号・メールアドレス・SNSリンク・アバター）を入力し「保存する」
3. 「ページのデコレーション」で壁紙（プリセット or 画像アップロード）・アクセントカラーを選んで保存
4. 表示された公開URL（`p.html?u=スラッグ`）をコピー、または「プレビューを開く」で確認
5. 「NFCタグに書き込む」（Android Chromeのみ対応。iPhoneなど非対応環境では表示されるURLを「NFC Tools」等のアプリで手動書き込み）
6. 「QRコード」→`qr.html`で、自分の公開URLのQRコード表示（NFC非対応端末向けの代替共有手段）と、カメラで相手のQRコードを読み取って相手の公開ページへ移動する機能が使える（カメラ利用はHTTPS環境が必須）

## Supabase

- プロジェクト: `NFC電子名刺`（project_id: `pzthxojdpzrqqevzyhjj`, リージョン: `ap-northeast-1`）
- テーブル
  - `profiles` … ユーザー1人につき1行。`slug`（公開URL用の一意な文字列）、`links`（SNSリンクの配列, jsonb）、`theme`（デコレーション設定, jsonb）などを保持
  - `profile_views` … 公開ページの閲覧ログ（アクセス解析用）
  - `contact_saves` … 「連絡先に保存」（vCardダウンロード）が押された回数のログ
- Storageバケット `profile-assets` … アバター・壁紙画像。`{user_id}/avatar.*` `{user_id}/wallpaper.*` の形で本人のみ書き込み可、閲覧は誰でも可
- Row Level Security が有効。`profiles`は本人のみ編集可・公開設定(`is_published`)がtrueの行のみ第三者が閲覧可。`profile_views`/`contact_saves`は誰でも追加できますが、閲覧は名刺の持ち主のみ
- スキーマの詳細・再現用SQLは `schema.sql` を参照してください

### 新規登録時のメール確認について

デフォルトでSupabaseは新規登録時に確認メールを送る設定です。すぐ使いたい場合は、Supabaseダッシュボードの
`Authentication → Providers → Email` で「Confirm email」をオフにすると、登録後すぐログインできるようになります。

## 今後の開発について

`config.js` の anon key はクライアントに公開される前提の値です（RLSで保護されるので安全です）。

主な改修ポイントの見取り図:
- `common.js` の `WALLPAPER_PRESETS` / `LINK_TYPES` … デコレーションやリンク種類の選択肢
- `dashboard.js` の `persistProfile()` … プロフィール・デコレーションの保存ロジック（`profiles`テーブルへのupsert）
- `public.js` の `renderCard()` … 公開ページの描画ロジック
- `qr.js` の `renderQRCode()` / `scanLoop()` など … QR表示・スキャンのロジック
- 複数ページ切り替え、リンクの並び替えなどは未実装（必要になったら追加してください）
