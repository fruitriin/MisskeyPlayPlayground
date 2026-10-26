# Misskey Play Playground

Misskey Play のコード（AiScript と、Play 固有の `Ui:` / `Mk:` / 定数）をブラウザで試せる playground（Vite + Vue 3 + TypeScript）。

## git の運用

- コミットと push は、確認を取らずに作業の区切りごとに行ってよい（オーナーの許可済み）

## AiScript / Play のコードを書くとき

- 先に [docs/ai/tips.md](docs/ai/tips.md) を読む。`+` で文字列を連結できない、`??` がない、省略可能なプロパティに `null` を渡すとエラー、など間違えやすい点をまとめてある
- 関数と部品の仕様は [docs/ai/play-api.md](docs/ai/play-api.md) と [docs/ai/aiscript/](docs/ai/aiscript/) を見る
- 動く実例は [docs/ai/examples/](docs/ai/examples/) にある。ゲームを作るときは [docs/ai/minigame.md](docs/ai/minigame.md) を読む
- ブラウザで動作を確かめるときは `window.__playground`（[docs/ai/browser-api.md](docs/ai/browser-api.md)）でコードの実行と UI の操作ができる

## 開発

- `npm run dev` で起動、`npm run build` で型チェックとビルド、`npm run deploy` で Cloudflare Workers の公開版を更新する
- `npm run reference` で補完データと AI 向け資料を再生成する。`src/reference/play.json` か `docs/ai/aiscript/` を変えたら実行する。AiScript の新しい版に追従するときは、`docs/ai/aiscript/` を公式リポジトリ（aiscript-dev/aiscript-dev.github.io）の最新版で置き換えてから実行する。実行すると、ドキュメントと処理系の関数の食い違いも表示される
- `src/aiscript/ui.ts`・`common.ts`・`src/components/AsUi.vue` は Misskey 本体からの移植。挙動は本体に合わせ、独自の拡張を入れない
- 人向けのミニゲームのガイドは `docs/guide/minigame.md`（例は `docs/guide/examples/*.ais`）で、画面の「📖 ガイド」から開く
- `public/llms.txt` のリンクは、AI がたどりやすいよう公開版の絶対 URL で書いている。公開先のドメインを変えたら書き換える。`public/_headers` で .md・.txt・.ais を UTF-8 として返している
- 静的チェックは `src/lint/lint.ts`（ブラウザと Node.js の両方から使うので、ほかのソースを相対パスで import しない）。`npm run lint:ais -- ファイル.ais` で調べられる。テスト関数 `Test:*` と定数 `PLAYGROUND` は `src/aiscript/test.ts`、シナリオテストは `src/aiBridge.ts` の `runScenario`
- ライブ共有の API は `worker/index.ts`（Worker と Room という Durable Object）、画面側は `src/live.ts` と `src/components/LivePanel.vue`。API ごと手元で試すときは `npm run preview:worker`（`wrangler dev`、http://localhost:8787）。Worker の型チェックは `npm run typecheck:worker`
- `src/aiBridge.ts` が `window.__playground` の実装。`AsUi.vue` の `data-as-id` 属性と `trackCallback` に依存している
- Mk:api のモックは `src/mock/api.ts`。エンドポイントを足すときは Misskey と同じ形のレスポンスにする
