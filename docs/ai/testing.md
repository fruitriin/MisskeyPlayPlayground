# テストと静的チェック

この playground には、AiScript のコードを確かめる仕組みが 3 つあります。

| 仕組み | 何を確かめるか | どこから使うか |
| --- | --- | --- |
| 静的チェック（lint） | 実行する前に分かる間違い（構文、存在しない関数、文字列の `+`、null のプロパティなど） | エディタの波線、`window.__playground.lint()`、`npm run lint:ais`、実行結果の `state.lint` |
| テスト関数（`Test:*`） | ゲームの中の計算が正しいか（AiScript の中に書く） | コードの中で `if exists PLAYGROUND { ... }` |
| シナリオテスト | 画面を操作したときに、期待どおりに表示されるか | `window.__playground.test()`、ライブ共有の `POST .../test` |

## 静的チェック

次のようなものを、実行する前に見つけます。

| 規則 | 重さ | 内容 |
| --- | --- | --- |
| `syntax` | error | 構文エラー。`??`・`?.`・予約語・`if c -1 else` などは、原因の説明を付ける |
| `version-header` | warning | 1 行目に `/// @ 1.2.1` がない（Misskey Play は 0.19.0 で実行してしまう） |
| `unknown-name` | error | `Mk:dialogg` や `Math:sqrtt` のように、AiScript にも Play にもない名前空間付きの名前。自分で書いた `:: Lib { }` の中の名前は分かる |
| `string-plus` | error | 文字列を `+` でつないでいる |
| `null-prop` | error | `Ui:C:*` のプロパティに `null` を渡している |
| `unknown-prop` | warning | `Ui:C:*` にないプロパティ。container 以外の `hidden` も |
| `button-in-fgcolor` | warning | `fgColor` を付けた container の中にボタンを直接入れている |
| `js-property` | warning | `.length`・`.includes` など JavaScript の書き方（AiScript では `.len`・`.incl`） |

使い方:

```sh
# HTTP で調べる（合言葉も画面も要らない）
curl -X POST --data-binary @game.ais <サイト>/api/lint
# → { "ok": false, "diagnostics": [{ "line": 2, "column": 13, "severity": "error", "rule": "string-plus", "message": "..." }] }

# リポジトリを手元に持っているとき（エラーがあれば終了コード 1）
npm run lint:ais -- game.ais
```

```js
// ブラウザで
window.__playground.lint(code) // [{ line, column, endLine, endColumn, severity, rule, message }]
```

`run()` と `act()`、ライブ共有の `PUT` が返す状態の `lint` にも、実行したコードの結果が入っています。
型を推論しているわけではないので、変数に入れた値の誤りや、名前空間の付かない変数の書き間違いは見つけられません。

## テスト関数（Test:*）と PLAYGROUND

playground には、Misskey 本体にはない定数 `PLAYGROUND` と、テスト用の関数があります。

| 名前 | 説明 |
| --- | --- |
| `PLAYGROUND` | playground で実行しているときだけある定数（`true`） |
| `Test:check(名前, @() { ... })` | テストを 1 つ実行する。中の `Test:eq` などがすべて成功すれば成功。実行時エラーも失敗として記録し、ほかのテストは続ける |
| `Test:eq(実際, 期待, ラベル?)` | 同じか確かめる。配列やオブジェクトは中身で比べる |
| `Test:ne(実際, 違ってほしい値, ラベル?)` | 違うか確かめる |
| `Test:ok(条件, ラベル?)` | 条件が `true` か確かめる |

`case` は予約語なので、`Test:case` という名前は作れません。そのため `Test:check` にしています。

テストは `if exists PLAYGROUND { ... }` の中でだけ呼んでください。Misskey 本体には `PLAYGROUND` がないので、同じコードをそのまま Play に貼っても、テストは動かず害もありません。

```aiscript
@tests() {
	Test:check("盤面の外に出ない", @() {
		Test:eq(Lib:moved({ x: 0, y: 0 }, -1, 0, 5), { x: 0, y: 0 })
	})
}
if exists PLAYGROUND tests()
```

- 結果はコンソールに出ます。成功は 🧪 ✓、失敗はエラーとして出ます
- `state.tests` に `{ passed, failed, results: [{ name, ok, messages }] }` が入ります
- テストできるのは、状態を引数で受け取って結果を返す関数です。ゲームの状態を書き換える処理は、テストのあいだに画面の状態も変えてしまうので、シナリオテストで確かめてください
- `THIS_ID == "playground"` で見分ける方法もありますが、スクラッチパッドには `THIS_ID` がなくエラーになるので、`exists PLAYGROUND` を使ってください

## シナリオテスト

操作と、期待する表示を順に並べて流し、合否と短い要約を返します。

```js
await window.__playground.test({
  code: "...",          // 省くと、いま画面にあるコードの続きから
  steps: [
    { expect: { tests: "pass", lint: "clean" } },
    { expect: { id: "status", text: "残り 4 枚" } },
    { type: "click", id: "padRow", index: 2 },
    { expect: { id: "status", textMatch: "1 手$" }, label: "1 手進んだ" },
  ],
  stopOnFail: true,      // 既定 true。最初の失敗で止める
})
// → { ok, passed, failed, results: [{ step, label, ok, message }], summary: "OK: 4 手順すべて成功" }
```

手順には、`act` と同じ操作（`click`・`input`・`toggle`・`select`・`clickEv`・`dialog`・`wait`）か、`{ expect: {...}, label? }` を書きます。

| `expect` の項目 | 確かめること |
| --- | --- |
| `id` + `text` | 部品の文字に含まれる（mfm の押せる箇所の書式は外す。buttons は各ボタンの文字を ` / ` でつないだもの） |
| `id` + `textMatch` | 部品の文字が正規表現に合う |
| `id` + `hidden` / `value` / `disabled` | container の hidden、入力欄などの値、button の disabled |
| `noErrors: true` | ログにエラーがない |
| `log` / `toast` / `dialog` | `<:` の出力・トースト・開いているダイアログに含まれる |
| `noDialog: true` | ダイアログが開いていない |
| `tests: "pass"` | `Test:*` がすべて成功している（1 つも実行されていなければ失敗） |
| `lint: "clean"` | 静的チェックに error がない |

ライブ共有でも同じものを使えます。

```sh
curl -X POST -H 'Content-Type: application/json' -d @scenario.json <サイト>/api/rooms/<合言葉>/test
```

## おすすめの進め方

1. 書いたら `lint` で確かめる（`npm run lint:ais` か `__playground.lint`）
2. ゲームの計算（勝ち負けの判定、解き方、乱数で作った問題が解けるか）を `Test:check` で書く
3. 遊び方の流れ（始める → 操作する → クリアの表示）をシナリオテストにする。直すたびに流せば、壊していないか分かる
