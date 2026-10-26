# ブラウザ操作 API（window.__playground）

playground のページには `window.__playground` という API があります。
Playwright MCP や Claude in Chrome のようにブラウザを操作できる AI は、これを使ってコードの読み書き・実行・UI の操作を JSON でやり取りできます。
公開サイトでも手元の dev サーバーでも同じように動きます。ページのコンソールで `window.__playground.help()` を実行すると、使い方の要約が出ます。

## 基本の流れ

```js
// 1. コードを書いて実行する。実行が終わるか、ダイアログが開くか、時間切れになると状態が返る
let s = await window.__playground.run(`/// @ 1.2.1
let label = Ui:C:text({ text: "0" }, "label")
var n = 0
Ui:render([label, Ui:C:button({ text: "+1", onClick: @() { n += 1; label.update({ text: \`{n}\` }) } }, "inc")])`);

// 2. UI を操作する。コールバックが終わると状態が返る
s = await window.__playground.act({ type: "click", id: "inc" });

// 3. 結果を確かめる
s.ui.children[0].props.text; // "1"
s.logs;                      // [{ type: "end", text: "(null)" }]
```

部品の id は、`Ui:C:*` の第2引数で付けたものがそのまま使えます。付けていない部品は、`state.ui` から自動で付いた id を探してください。

## 関数

| 関数 | 説明 |
| --- | --- |
| `getState({ includeCode? })` | いまの状態を返す。`includeCode: false` でコードを省く |
| `getCode()` | エディタのコードを返す |
| `setCode(code)` | エディタのコードを書き換える。実行はしない |
| `run(code?, { timeout? })` | コードを実行して状態を返す。`code` を省くとエディタのコードを実行する。`timeout` の既定は 5000 ミリ秒 |
| `stop()` | 実行を止める |
| `act(action または action の配列, { timeout? })` | UI を順に操作し、最後の状態を返す |
| `samples()` | サンプルの `{ id, title }` の一覧を返す |
| `loadSample(id)` | サンプルを読み込んで実行する |

`run` と `act` が返す状態には、既定ではコードを含めません。

## action

| action | 対象 | 説明 |
| --- | --- | --- |
| `{ type: "click", id }` | button, postFormButton, folder | ボタンを押す。folder は開閉する |
| `{ type: "click", id, text }` / `{ type: "click", id, index }` | buttons | 文字か 0 から数えた位置でボタンを選んで押す |
| `{ type: "input", id, value }` | textInput, textarea, numberInput | 入力欄の値を書き換え、`onInput` を呼ぶ |
| `{ type: "toggle", id, value? }` | switch | `value` にする。省くと反転する |
| `{ type: "select", id, value }` | select | `items` の `value` を選ぶ |
| `{ type: "clickEv", id, ev }` | mfm | `$[clickable.ev=...]` を押したときと同じく `onClickEv(ev)` を呼ぶ |
| `{ type: "dialog", answer? }` | 開いているダイアログ | いちばん手前のダイアログに答える。`Mk:confirm` は `true` / `false`、`readline` は文字列か `null`（キャンセル）、`Mk:dialog` と投稿フォームは閉じるだけ |
| `{ type: "wait", ms }` | なし | 指定した時間だけ待つ |

ボタンなどは画面の要素を実際に操作するので、表示も本物の操作と同じように変わります。
対象がない・表示されていない・disabled のときは、理由を書いたエラーを投げます。

## 状態（PlaygroundState）

```ts
{
  aiscriptVersion: "1.2.1" | "0.19.0",
  running: boolean,          // トップレベルの実行中なら true
  pendingCallbacks: number,  // 実行中の onClick などの数
  timedOut?: true,           // 時間内に落ち着かなかった
  apiMode: "mock" | "server",
  code?: string,
  logs: { type: "print" | "end" | "error" | "info", text: string }[],
  ui: UiNode | null,         // Ui:root から表示中の部品をたどった木
  dialogs: { kind: "alert" | "confirm" | "input" | "post", type?, title?, text? }[],
  toasts: { text: string, time: string }[],  // この実行で出たトーストの最新 10 件
}

UiNode = {
  id: string,
  type: string,              // "button" や "textInput" など
  hidden?: true,
  props: object,             // 関数以外のプロパティ
  handlers: string[],        // 設定されているコールバックの名前（onClick など）
  value?: string | number | boolean | null,  // 入力欄・switch・select の画面上の値
  children?: UiNode[],
}
```

## ダイアログを含む処理

`Mk:dialog`・`Mk:confirm`・`readline` はユーザーが答えるまで止まります。
ダイアログが開くと、`run` と `act` はコールバックの途中でも状態を返します。このとき `pendingCallbacks` は 1 以上です。
`dialogs` を見て `{ type: "dialog", answer }` で答えると、続きの処理が進みます。

```js
let s = await window.__playground.act({ type: "click", id: "ask" });
s.dialogs; // [{ kind: "input", title: "お名前は？" }]
s = await window.__playground.act({ type: "dialog", answer: "藍" });
```

## 無限ループ

`timeout` までに終わらないと `timedOut: true` が付いた状態が返り、実行は続きます。止めるときは `stop()` を呼んでください。
