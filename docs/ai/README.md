# AI 向け資料の入口

AiScript と Misskey Play のコードを書く・直す AI のための資料です。上から順に読むと迷いません。

| ファイル | 内容 |
| --- | --- |
| [tips.md](tips.md) | 間違えやすい点の一覧。**最初に必ず読む** |
| [play-api.md](play-api.md) | Play の `Ui:` / `Mk:` 関数、`Ui:C:*` 部品のプロパティ、定数（`src/reference/play.json` から生成） |
| [aiscript/syntax.md](aiscript/syntax.md) | AiScript の文法 |
| [aiscript/literals.md](aiscript/literals.md) | リテラル（文字列・テンプレート・配列・オブジェクト・関数） |
| [aiscript/keywords.md](aiscript/keywords.md) | 予約語 |
| [aiscript/std.md](aiscript/std.md) | 標準関数（`Core:` `Str:` `Arr:` `Obj:` `Json:` `Date:` など） |
| [aiscript/std-math.md](aiscript/std-math.md) | `Math:` の関数と定数 |
| [aiscript/builtin-props.md](aiscript/builtin-props.md) | 値のプロパティとメソッド（`arr.map`、`str.len` など） |
| [browser-api.md](browser-api.md) | ブラウザ上の playground を JSON で読み書き・操作する `window.__playground` の使い方 |
| [examples/](examples/README.md) | 動作確認済みのサンプル（playground のサンプル一覧と同じもの） |

`aiscript/` 以下は [aiscript-dev/aiscript-dev.github.io](https://github.com/aiscript-dev/aiscript-dev.github.io) の日本語リファレンスを MIT ライセンスのまま取り込んだものです（取り込んだ版は `aiscript/SOURCE` に記録しています）。

## 再生成

`npm run reference` で、`src/reference/std.json`（補完用）、`play-api.md`、`examples/`、公開用の `public/ai/` を作り直します。
AiScript の新しい版に追従するときは、`aiscript/` を公式リポジトリの最新版で置き換えてから実行してください。
スクリプトは、ドキュメントにあるのに処理系にない関数・処理系にあるのにドキュメントにない関数の一覧も表示します。
