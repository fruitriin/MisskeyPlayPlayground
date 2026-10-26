<!-- このファイルは scripts/build-reference.mjs が src/reference/play.json から生成する。直接編集しないこと -->

# Misskey Play API リファレンス

Misskey の Play（とスクラッチパッド・AiScript App ウィジェット）で、AiScript の標準関数に加えて使える定数と関数の一覧です。
定義は Misskey 本体の `packages/frontend/src/aiscript/ui.ts` と `api.ts` に合わせています。

## 定数

| 名前 | 型 | 説明 |
| --- | --- | --- |
| `USER_ID` | `str \| null` | 閲覧しているユーザーの ID。未ログインなら null。 |
| `USER_NAME` | `str \| null` | 閲覧しているユーザーの表示名。未ログインまたは表示名なしなら null。 |
| `USER_USERNAME` | `str \| null` | 閲覧しているユーザーのユーザー名（@ なし）。未ログインなら null。 |
| `CUSTOM_EMOJIS` | `arr<obj>` | サーバーのカスタム絵文字の一覧。各要素は name, aliases, category, url などを持つ。 |
| `LOCALE` | `str` | UI の言語。例: "ja-JP" |
| `SERVER_URL` | `str` | サーバーの URL。例: "https://misskey.example" |
| `THIS_ID` | `str` | この Play の ID（Play でのみ定義される）。 |
| `THIS_URL` | `str` | この Play のページの URL（Play でのみ定義される）。 |

## 関数

### `Mk:dialog(title: str | null, text: str | null, type?: str): null`

ダイアログを表示し、閉じられるまで待つ。type は "info"（既定）, "success", "warning", "error", "question", "waiting" のいずれか。

### `Mk:confirm(title: str | null, text: str | null, type?: str): bool`

OK / キャンセルの確認ダイアログを表示し、OK なら true を返す。type の既定値は "question"。

### `Mk:toast(text: str): null`

画面上部に短いメッセージ（トースト）を表示する。待たずに次へ進む。

### `Mk:api(endpoint: str, params: obj, token?: str | null): value`

Misskey API を呼ぶ。endpoint は "notes/create" のように /api/ 以降を書く。成功時はレスポンスを、失敗時は error 型の値（name は "request_failed"、info にエラー内容）を返す。例外は投げないので Core:type(res) == "error" で判定する。token を省略すると Play では未認証で呼ぶ（スクラッチパッドやウィジェットでは閲覧者の権限）。

### `Mk:save(key: str, value: value): null`

値をブラウザに保存する。Play ごとに保存先が分かれる。関数など JSON にできない値は保存できない。

### `Mk:load(key: str): value`

Mk:save で保存した値を読む。保存されていなければ null を返す。

### `Mk:remove(key: str): null`

Mk:save で保存した値を消す。

### `Mk:url(): str`

いま開いているページの URL を返す。

### `Mk:nyaize(text: str): str`

文字列を猫語にする（な→にゃ など）。

### `Ui:render(children: arr<component>): null`

画面に表示する部品を差し替える。Ui:root.update({ children: [...] }) と同じ。何度呼んでもよい。

### `Ui:get(id: str): component | null`

Ui:C:* の第2引数で付けた id から部品を取り出す。なければ null を返す。

### `Ui:root: component`

画面のいちばん外側の部品。Ui:root.update({ children: [...] }) で中身を差し替えられる。

## UI 部品（`Ui:C:*`）

Ui:C:<種類>(props: obj, id?: str) で部品を作る。返り値は { id: str, update: @(props: obj) } を持つオブジェクト。update には変えたいプロパティだけを渡せばよく、渡さなかったものは元の値のまま残る。部品は Ui:render や container の children に入れたときにだけ表示される。 hidden で隠せるのは container だけで、ほかの部品に hidden を渡しても無視される。

### `Ui:C:container(props, id?)`

子部品を縦に並べる箱。背景色や枠線で装飾できる。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `children` | `arr<component>` | 中に並べる部品。 |
| `align` | `"left" \| "center" \| "right"` | 文字や部品の寄せ方。 |
| `bgColor` | `str` | 背景色（CSS の色）。 |
| `fgColor` | `str` | 文字色（CSS の色）。 |
| `font` | `"serif" \| "sans-serif" \| "monospace"` | フォント。 |
| `borderWidth` | `num` | 枠線の太さ（px）。枠線系をどれか指定すると、太さ 1px・実線が既定になる。 |
| `borderColor` | `str` | 枠線の色。 |
| `borderStyle` | `"hidden" \| "dotted" \| "dashed" \| "solid" \| "double" \| "groove" \| "ridge" \| "inset" \| "outset"` | 枠線の種類。 |
| `borderRadius` | `num` | 角の丸み（px）。rounded より優先される。 |
| `padding` | `num` | 内側の余白（px）。 |
| `rounded` | `bool` | true で角を 8px 丸める。 |
| `hidden` | `bool` | true にすると表示しない。 |

### `Ui:C:text(props, id?)`

プレーンテキストを表示する。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `text` | `str` | 表示する文字列。 |
| `size` | `num` | 文字の大きさの倍率（1 = 100%）。 |
| `bold` | `bool` | 太字にする。 |
| `color` | `str` | 文字色（CSS の色）。 |
| `font` | `"serif" \| "sans-serif" \| "monospace"` | フォント。 |

### `Ui:C:mfm(props, id?)`

MFM（Misskey Flavored Markdown）を表示する。$[clickable.ev=名前 文字] で押せる箇所を作れる。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `text` | `str` | MFM の文字列。 |
| `size` | `num` | 文字の大きさの倍率。 |
| `bold` | `bool` | 太字にする。 |
| `color` | `str` | 文字色（CSS の色）。 |
| `font` | `"serif" \| "sans-serif" \| "monospace"` | フォント。 |
| `onClickEv` | `@(ev: str)` | $[clickable.ev=名前 ...] が押されたときに、ev の名前を受け取って呼ばれる。 |

### `Ui:C:button(props, id?)`

ボタン。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `text` | `str` | ボタンの文字。 |
| `onClick` | `@()` | 押されたときに呼ばれる。 |
| `primary` | `bool` | 強調色で表示する。 |
| `rounded` | `bool` | 角を丸くする。 |
| `disabled` | `bool` | 押せなくする。 |

### `Ui:C:buttons(props, id?)`

ボタンを横に並べる。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `buttons` | `arr<{ text: str, onClick: @(), primary?: bool, rounded?: bool, disabled?: bool }>` | 並べるボタンの定義。各要素の text と onClick は必須。 |

### `Ui:C:switch(props, id?)`

オン・オフのスイッチ。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `onChange` | `@(v: bool)` | 切り替えられたときに新しい値で呼ばれる。 |
| `default` | `bool` | 最初の状態。 |
| `label` | `str` | ラベル。 |
| `caption` | `str` | 補足説明。 |

### `Ui:C:textInput(props, id?)`

1行の文字入力欄。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `onInput` | `@(v: str)` | 入力のたびに、入力欄の文字列で呼ばれる。 |
| `default` | `str` | 最初の値。 |
| `label` | `str` | ラベル。 |
| `caption` | `str` | 補足説明。 |

### `Ui:C:textarea(props, id?)`

複数行の文字入力欄。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `onInput` | `@(v: str)` | 入力のたびに、入力欄の文字列で呼ばれる。 |
| `default` | `str` | 最初の値。 |
| `label` | `str` | ラベル。 |
| `caption` | `str` | 補足説明。 |

### `Ui:C:numberInput(props, id?)`

数値の入力欄。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `onInput` | `@(v: num)` | 入力のたびに、数値で呼ばれる。 |
| `default` | `num` | 最初の値。 |
| `label` | `str` | ラベル。 |
| `caption` | `str` | 補足説明。 |

### `Ui:C:select(props, id?)`

選択肢から1つを選ぶ欄。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `items` | `arr<{ text: str, value?: str }>` | 選択肢。value を省くと text が値になる。 |
| `onChange` | `@(v: str)` | 選ばれたときに value で呼ばれる。 |
| `default` | `str` | 最初に選ばれている value。 |
| `label` | `str` | ラベル。 |
| `caption` | `str` | 補足説明。 |

### `Ui:C:folder(props, id?)`

開閉できる見出し付きの枠。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `children` | `arr<component>` | 中に並べる部品。 |
| `title` | `str` | 見出し。 |
| `opened` | `bool` | 最初に開いておくか。既定は true。 |

### `Ui:C:postFormButton(props, id?)`

押すと投稿フォームを開くボタン。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `text` | `str` | ボタンの文字。 |
| `primary` | `bool` | 強調色で表示する。 |
| `rounded` | `bool` | 角を丸くする。 |
| `form` | `{ text: str, cw?: str, visibility?: str, localOnly?: bool }` | フォームの初期値。text は必須。visibility は "public", "home", "followers", "specified" のいずれか。 |

### `Ui:C:postForm(props, id?)`

画面に埋め込む投稿フォーム。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `form` | `{ text: str, cw?: str, visibility?: str, localOnly?: bool }` | フォームの初期値。text は必須。 |
