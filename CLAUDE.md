# AiScript Playground

AiScript と Misskey Play の UI 関数をブラウザで試せる playground（Vite + Vue 3 + TypeScript）。

## git の運用

- コミットと push は、確認を取らずに作業の区切りごとに行ってよい（オーナーの許可済み）

## AiScript / Play のコードを書くとき

- 先に [docs/ai/tips.md](docs/ai/tips.md) を読む。`+` で文字列を連結できない、`??` がない、省略可能なプロパティに `null` を渡すとエラー、など間違えやすい点をまとめてある
- 関数と部品の仕様は [docs/ai/play-api.md](docs/ai/play-api.md) と [docs/ai/aiscript/](docs/ai/aiscript/) を見る
- 動く実例は [docs/ai/examples/](docs/ai/examples/) にある。ゲームを作るときは [docs/ai/minigame.md](docs/ai/minigame.md) を読む
- ブラウザで動作を確かめるときは `window.__playground`（[docs/ai/browser-api.md](docs/ai/browser-api.md)）でコードの実行と UI の操作ができる

## 開発

- `npm run dev` で起動、`npm run build` で型チェックとビルド
- `npm run reference` で補完データと AI 向け資料を再生成する。`src/reference/play.json` か `docs/ai/aiscript/` を変えたら実行する
- `src/aiscript/ui.ts`・`common.ts`・`src/components/AsUi.vue` は Misskey 本体からの移植。挙動は本体に合わせ、独自の拡張を入れない
- ミニゲームは `src/games/*.ais` に置き、`src/games/index.ts` に登録する。人向けのガイドは `docs/guide/minigame.md`（例は `docs/guide/examples/*.ais`）で、画面の「📖 ガイド」から開く
- `src/aiBridge.ts` が `window.__playground` の実装。`AsUi.vue` の `data-as-id` 属性と `trackCallback` に依存している
- Mk:api のモックは `src/mock/api.ts`。エンドポイントを足すときは Misskey と同じ形のレスポンスにする
