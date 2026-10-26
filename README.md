# AiScript Playground

AiScript と Misskey Play の UI 関数（`Ui:` / `Mk:`）をブラウザで試せる playground です。

## 起動

```sh
npm install
npm run dev
```

`npm run build` で `dist/` に静的ファイルを出力します。`base: './'` なので、GitHub Pages などのサブパスにもそのまま置けます。

## できること

- AiScript 1.2.1 の実行。先頭に `/// @ 0.x.x` と書いたコードは、本家 Play と同じく 0.19.0 の処理系で実行する
- `Ui:render` / `Ui:get` / `Ui:C:*`（container, text, mfm, button, buttons, switch, textInput, textarea, numberInput, select, folder, postFormButton, postForm）と、部品の `update()`
- MFM の表示（アニメーション系の関数、`$[clickable.ev=...]` による `onClickEv` を含む）
- `Mk:dialog` / `Mk:confirm` / `Mk:toast` / `Mk:api` / `Mk:save` / `Mk:load` / `Mk:remove` / `Mk:url` / `Mk:nyaize` と `readline`
- 定数 `USER_ID` / `USER_NAME` / `USER_USERNAME` / `CUSTOM_EMOJIS` / `LOCALE` / `SERVER_URL` / `THIS_ID` / `THIS_URL`
- コンソール（`<:` の出力、最後の式の値、エラー）と UI ツリーの確認
- URL の hash にコードを圧縮して入れる共有リンク、localStorage への自動保存
- エディタの補完とホバー時のヒント（標準関数・`Ui:`/`Mk:` 関数・`Ui:C:*` のプロパティ・組み込みプロパティ）
- `Mk:api` 用のモックサーバー（ブラウザ内で動作、既定）
- AI 向けの資料一式（`docs/ai/`、公開サイトでは `/llms.txt` から辿れる）

## API の接続先

既定では、同梱のモックサーバー（`src/mock/api.ts`）に `Mk:api` と投稿フォームを送ります。モックはブラウザの中だけで動き、外部とは通信しません。
タイムライン・ノートの作成と削除・リアクション・ユーザー情報・カスタム絵文字など、よく使うエンドポイントに Misskey と同じ形で応答します。

⚙ 設定で「実際の Misskey サーバー」に切り替え、サーバー URL を指定すると、`Mk:api`、カスタム絵文字の表示、`CUSTOM_EMOJIS` がそのサーバーを使います。
アクセストークンも指定すると、トークン付きの `Mk:api` と投稿フォームからの投稿が実際に動きます（投稿前には確認ダイアログを出します）。
未設定の場合、投稿フォームは送信内容のプレビューだけを表示します。

サーバー側が CORS のプリフライトを拒否する場合は `Mk:api` が `request_failed` のエラーを返します。

## MFM の表示

MFM の表示には [mfm-renderer](https://github.com/fruitriin/mfm-renderer) を使っています。いまは `file:../mfm-renderer` を参照しているので、隣のディレクトリに clickable 対応版（`feat/clickable` ブランチ）が必要です。

## ライセンス

`src/aiscript/ui.ts`・`src/aiscript/common.ts`・`src/components/AsUi.vue` などは
[Misskey](https://github.com/misskey-dev/misskey) のフロントエンド実装を移植したものです。
そのため、このリポジトリ全体を Misskey と同じ AGPL-3.0 で公開します。
