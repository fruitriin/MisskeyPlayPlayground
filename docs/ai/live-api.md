# ライブ共有 API（合言葉で画面のコードを読み書きする）

ユーザーが playground の画面で「🔗 ライブ共有」から合言葉を決めてつなぐと、その合言葉を付けた URL で、画面のコードを HTTP で読み書きできます。
送ったコードはユーザーの画面にすぐ反映されて実行され、ユーザーは作っている途中を見られます。ブラウザを操作する仕組みがなくても、`curl` だけで「書く → 実行結果を見る → 操作して確かめる」を回せます。

合言葉はユーザーから教えてもらってください。ここでは `<合言葉>` と書きます。URL の `<サイト>` は、この資料を読んだサイト（例: `https://misskey-play-playground.riinsworkspace.workers.dev`）です。

## 基本の流れ

```sh
ROOM=<サイト>/api/rooms/<合言葉>

# 1. いまのコードを読む
curl $ROOM

# 2. コードを送る。ユーザーの画面で実行され、実行が落ち着いたら結果が返る
curl -X PUT --data-binary @game.ais $ROOM

# 3. ボタンを押すなどの操作をして、結果を受け取る
curl -X POST -H 'Content-Type: application/json' \
  -d '{"actions":[{"type":"click","id":"inc"}]}' $ROOM/act

# 4. いまの実行結果を読む（ユーザーが画面で操作したあとなど）
curl $ROOM/state
```

## エンドポイント

| メソッドとパス | 説明 |
| --- | --- |
| `GET /api/rooms/<合言葉>` | いまのコードを返す。`{ code, rev, updatedAt, updatedBy, viewers }`。`updatedBy` は `"api"`（外から）か `"browser"`（画面で編集） |
| `PUT /api/rooms/<合言葉>` | コードを書き換える。本文はコードそのもの（`text/plain`）か、JSON の `{ "code": "...", "run": true }`。画面に反映して実行し、実行が落ち着くまで待って `{ rev, viewers, run, state }` を返す |
| `GET /api/rooms/<合言葉>/state` | 画面が最後に報告した実行結果。`{ rev, stateRev, stateAt, viewers, state }`。`stateRev` は、その結果がどの版のコードのものか |
| `POST /api/rooms/<合言葉>/act` | 画面の UI を操作する。本文は `{ "actions": [...], "timeout": ミリ秒 }`。操作が終わったときの状態を `{ state }` で返す |

- `state` の形は [browser-api.md](browser-api.md) の `PlaygroundState` と同じです（ログ・UI ツリー・ダイアログ・トースト）。`act` の結果には、その操作のあいだに出た `newLogs` と `newToasts` も入ります
- `actions` の形も browser-api.md の `act` と同じです（`click`・`input`・`toggle`・`select`・`clickEv`・`dialog`・`wait`）
- `PUT` は既定で最大 10 秒待ちます。`?wait=秒`（最大 60）で変えられ、`?wait=0` なら待たずにすぐ返ります（`state` は `null`）。時間内に終わらなければ `timedOut: true` が付きます
- `run: false` を付けた JSON で `PUT` すると、画面のエディタを書き換えるだけで実行しません
- 画面を開いている人がいないと（`viewers` が 0）、`PUT` はコードを保存するだけで、実行結果は返りません。`act` は `409 NO_VIEWER` になります
- エラーは `{ "error": { "code", "message" } }` の形で返ります。`act` で部品が見つからないときなどは `422 ACT_FAILED` です

## WebSocket で変化を受け取る（見るだけ）

ユーザーが画面でコードを書き換えたり、遊んだりしたことを、`GET` を繰り返さずにすぐ知りたいときは、WebSocket で「見るだけ」の接続をします。

```
wss://<サイトのホスト>/api/rooms/<合言葉>/ws?role=observer
```

- `?role=observer` を必ず付けてください。付けないと画面（viewer）として扱われ、`act` の操作があなたに届いてしまいます
- 見るだけの接続は `viewers` に数えられず、`act` も届きません。送ったメッセージは無視されます。書き込みは HTTP の `PUT` を使ってください
- 届くメッセージはどれも JSON です

| `type` | 届くとき | 中身 |
| --- | --- | --- |
| `snapshot` | つないだ直後 | `{ role: "observer", code, rev, updatedAt, updatedBy, viewers }`。部屋に実行結果があれば、続けて `state` も届く |
| `code` | コードが書き換わったとき | `{ code, rev, by, run }`。`by` は `"api"`（HTTP の PUT）か `"browser"`（ユーザーが画面で編集） |
| `state` | 画面が実行結果を報告したとき | `{ rev, state }`。`state` は `GET .../state` の `state` と同じ形。実行のたび、ユーザーが操作するたびに届く |
| `viewers` | 画面の数が変わったとき | `{ viewers }` |

Node.js（22 以降は `WebSocket` が組み込み）の例です。

```js
const ws = new WebSocket('wss://<サイトのホスト>/api/rooms/<合言葉>/ws?role=observer');
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'code' && msg.by === 'browser') console.log('ユーザーが編集した', msg.rev);
  if (msg.type === 'state') console.log('実行結果', msg.state.logs);
};
```

サイトをデプロイし直すと、WebSocket は切れます。切れたら、数秒おいてつなぎ直してください。

## 決まりごと

- 合言葉は英数字と `-` `_` の 8〜64 文字です。合言葉を知っている人は誰でも読み書きできます
- 画面と外の両方から書き換えたときは、後から書いたほうが残ります。ユーザーが画面で編集中かもしれないので、`PUT` の前に `GET` で最新のコードと `updatedBy` を確かめてください
- コードは 256KB までです
- 7 日間使われなかった部屋は、コードごと消えます
- コードの 1 行目には `/// @ 1.2.1` を書いてください（[tips.md](tips.md) を参照）

## 進め方のおすすめ

1. ユーザーに合言葉を教えてもらい、`GET` で画面のいまのコードを確かめる
2. 小さく書いて `PUT` し、返ってきた `state.logs` に `error` がないかを見る
3. 部品に id を付けておき（`Ui:C:button({ ... }, "start")`）、`act` で操作して `state.ui` を確かめる
4. ユーザーに画面で遊んでもらい、気になったところを聞く。ユーザーが画面で直したら `GET` で取り込む
