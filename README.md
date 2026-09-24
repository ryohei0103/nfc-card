# NFC電子名刺

NFCカード（またはQR/URL共有）でプロフィールページに案内できる、電子名刺アプリ。フレームワーク不使用の素のHTML/CSS/JSで、Supabaseでログイン・保存・アクセス解析を行います。

## ファイル構成

```
files/
├── index.html       ログイン・新規登録
├── dashboard.html    マイページ（「プロフィール」「QRコード」「名刺帳」「アクセス解析」タブ切り替え）
├── p.html              公開プロフィールページ（誰でも閲覧可、?u=スラッグ）
├── style.css             見た目（CSS）
├── config.js               SupabaseのURL・anon keyの設定
├── common.js                共通ヘルパー（Supabaseクライアント、vCard生成、テーマ適用）
├── auth.js                   index.html のロジック
├── dashboard.js                dashboard.html のロジック
├── public.js                    p.html のロジック
└── schema.sql                    Supabaseに適用済みのテーブル・RLS・Storage定義
```

依存はCDN経由のみです（各HTML内で読み込み済み）。
- `@supabase/supabase-js@2`（Supabaseクライアント）
- `qrcodejs`（自分の名刺ページのQRコード生成、dashboard.htmlのみ）
- `jsQR`（カメラ映像からのQRコード読み取り、dashboard.htmlのみ）
- Google Fonts（Zen Kaku Gothic New / Noto Sans JP）

ビルドツールは使っていません。ただし **NFC書き込み機能はHTTPS配信が必須**（Web NFC APIの制約）なので、Vercel / Netlify / GitHub Pages などにデプロイして使ってください（`index.html`をfile://で開くだけでも他の機能は一通り動作します）。

## 使い方

1. `index.html` で新規登録 → ログイン
2. `dashboard.html` は「プロフィール」「QRコード」「名刺帳」「アクセス解析」の4タブ構成（麻雀アプリの「記録入力／マイページ」と同じタブ切り替えUI）
3. 「プロフィール」タブ: 名前・ふりがな・会社名・役職・自己紹介・電話番号・メールアドレス・SNSリンク・アバターを入力し「保存する」／「ページのデコレーション」で壁紙・アクセントカラーを選んで保存／「NFCタグに書き込む」（Android Chromeのみ対応。iPhoneなど非対応環境では表示されるURLを「NFC Tools」等のアプリで手動書き込み）
4. 「QRコード」タブ: 「QRコードで共有」に自分の公開URLのQRコードが自動表示（NFC非対応端末向けの代替共有手段）／「QRコードを読み取る」の「スキャン開始」でカメラを起動し、相手の名刺QRコードを読み取ると相手の公開ページへのリンクが表示される（カメラ利用はHTTPS環境が必須）
5. 「名刺帳」タブ: QRコード読み取り結果の「保存」、または相手の名刺ページ(p.html)を**ログイン中に開いて**「名刺帳に保存」で保存した名刺の一覧。開く／削除ができる
6. 「アクセス解析」タブ: 総閲覧数・直近7日・**NFCタップ数**・**リンククリック数**・連絡先保存数を表示。NFCタグ書き込み時のURLには`?src=nfc`、QRコードには`?src=qr`が自動付与され、公開ページ訪問時にどちらの経由か記録される

## Supabase

- プロジェクト: `NFC電子名刺`（project_id: `pzthxojdpzrqqevzyhjj`, リージョン: `ap-northeast-1`）
- テーブル
  - `profiles` … ユーザー1人につき1行。`slug`（公開URL用の一意な文字列）、`links`（SNSリンクの配列, jsonb）、`theme`（デコレーション設定, jsonb）などを保持
  - `profile_views` … 公開ページの閲覧ログ（アクセス解析用）。`source`列に`nfc`/`qr`/`direct`のいずれかを記録
  - `link_clicks` … 公開ページのSNS・リンクがクリックされた回数のログ（`link_type`列にリンク種類）
  - `saved_cards` … 名刺帳（保存した他人の名刺。本人だけが参照・追加・削除可）
  - `contact_saves` … 「連絡先に保存」（vCardダウンロード）が押された回数のログ
- Storageバケット `profile-assets` … アバター・壁紙画像。`{user_id}/avatar.*` `{user_id}/wallpaper.*` の形で本人のみ書き込み可、閲覧は誰でも可
- Row Level Security が有効。`profiles`は本人のみ編集可・公開設定(`is_published`)がtrueの行のみ第三者が閲覧可。`profile_views`/`link_clicks`/`contact_saves`は誰でも追加できますが、閲覧は名刺の持ち主のみ
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
- `dashboard.js` の `switchTab()` … タブ切り替え、`renderQRCode()` / `scanLoop()` … QR表示・スキャン、`loadStats()` … アクセス解析の集計
- `public.js` の `logView()` / `logLinkClick()` … 閲覧・リンククリックのログ記録（`?src=`パラメータで流入経路を判定）
- リンクの並び替えなどは未実装（必要になったら追加してください）
