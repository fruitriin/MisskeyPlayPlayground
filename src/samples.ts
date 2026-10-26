// サンプルスクリプト集
export type Sample = { id: string; title: string; code: string };

export const samples: Sample[] = [
	{
		id: 'template',
		title: 'ゲームのひな形（中身が上・部品とテストが下）',
		code: `/// @ 1.2.1
// ゲームのひな形「コイン集め」
// 上にゲームの中身、下に部品（Lib）とテストを置く形の見本です。
// 1〜3 を書き換えれば、別のゲームにできます。下の部品とテストは、必要になるまで読まなくて大丈夫です。

// ===== 1. ゲームの中身（ここを書き換える）=====
let SIZE = 5
let COINS = 4
let TILE = { floor: "⬜", coin: "🪙", player: "🐱" }

// ===== 2. 状態とルール =====
var player = { x: 0, y: 0 }
var coins = []
var moves = 0

@reset() {
	player = { x: 0, y: 0 }
	coins = Lib:placeCoins(SIZE, COINS, @(min, max) { Math:rnd(min, max) })
	moves = 0
	render()
}

@move(dx, dy) {
	if coins.len == 0 return null
	player = Lib:moved(player, dx, dy, SIZE)
	moves += 1
	coins = coins.filter(@(c) { !(c.x == player.x && c.y == player.y) })
	render()
}

// ===== 3. 画面 =====
let board = Ui:C:mfm({ text: "", size: 2 }, "board")
let status = Ui:C:text({ text: "" }, "status")

@render() {
	board.update({ text: Lib:grid(SIZE, @(x, y) {
		if x == player.x && y == player.y TILE.player
		elif Lib:has(coins, x, y) TILE.coin
		else TILE.floor
	}) })
	status.update({ text: if coins.len == 0 \`🎉 全部集めた！ {moves} 手\` else \`残り {coins.len} 枚　{moves} 手\` })
}

Ui:render([
	Ui:C:container({ align: "center", children: [
		status,
		board,
		Lib:pad(move),
		Ui:C:button({ text: "やり直す", onClick: @() { reset() } }, "reset"),
	] }),
])
reset()

// ===== ここから下は部品（触らなくてよい）=====
// 名前空間 :: は実行の前に読み込まれるので、いちばん下に書いても上から Lib:名前 で使える。
// 名前空間の中に var は置けないので、状態は上の 2. に置き、部品には引数で渡す
:: Lib {
	// 盤面の文字列を作る。tile(x, y) が各マスの絵文字を返す
	@grid(size, tile) {
		Arr:create(size).map(@(_row, y) {
			Arr:create(size).map(@(_cell, x) { tile(x, y) }).join("")
		}).join(Str:lf)
	}
	// 十字キー。押されると onMove(dx, dy) を呼ぶ
	@pad(onMove) {
		Ui:C:container({ align: "center", children: [
			Ui:C:buttons({ buttons: [{ text: "⬆️", onClick: @() { onMove(0, -1) } }] }, "padUp"),
			Ui:C:buttons({ buttons: [
				{ text: "⬅️", onClick: @() { onMove(-1, 0) } },
				{ text: "⬇️", onClick: @() { onMove(0, 1) } },
				{ text: "➡️", onClick: @() { onMove(1, 0) } },
			] }, "padRow"),
		] })
	}
	@clamp(v, lo, hi) { Math:max(lo, Math:min(hi, v)) }
	// 盤面の外には出ない移動
	@moved(pos, dx, dy, size) { { x: clamp(pos.x + dx, 0, size - 1), y: clamp(pos.y + dy, 0, size - 1) } }
	@has(list, x, y) { list.some(@(c) { c.x == x && c.y == y }) }
	// 重ならない場所にコインを置く（スタート地点の 0,0 は避ける）。rng(min, max) は min 以上 max 以下の整数を返す関数
	@placeCoins(size, count, rng) {
		var list = []
		loop {
			if list.len >= count break
			let c = { x: rng(0, size - 1), y: rng(0, size - 1) }
			if !(c.x == 0 && c.y == 0) && !has(list, c.x, c.y) list.push(c)
		}
		list
	}
}

// ===== テスト（playground でだけ動く。Misskey には PLAYGROUND がないので動かない）=====
@tests() {
	Test:check("盤面の外に出ない", @() {
		Test:eq(Lib:moved({ x: 0, y: 0 }, -1, 0, 5), { x: 0, y: 0 })
		Test:eq(Lib:moved({ x: 4, y: 2 }, 1, 0, 5), { x: 4, y: 2 })
		Test:eq(Lib:moved({ x: 2, y: 2 }, 0, 1, 5), { x: 2, y: 3 })
	})
	Test:check("コインは重ならず、スタート地点にも置かない", @() {
		let list = Lib:placeCoins(5, 10, Math:gen_rng("test"))
		Test:eq(list.len, 10)
		Test:ok(!Lib:has(list, 0, 0), "スタート地点にない")
		each let c, list {
			Test:eq(list.filter(@(d) { d.x == c.x && d.y == c.y }).len, 1, \`({c.x}, {c.y}) は 1 枚だけ\`)
		}
	})
	Test:check("盤面の大きさ", @() {
		Test:eq(Lib:grid(3, @(x, y) { "⬜" }).split(Str:lf).len, 3)
	})
}
if exists PLAYGROUND tests()
`,
	},
	{
		id: 'hello',
		title: 'はじめての UI',
		code: `/// @ 1.2.1
// Ui:render に部品の配列を渡すと、右側のプレビューに表示されます
// Cmd/Ctrl + Enter で実行できます

<: "Hello, AiScript!"

Ui:render([
	Ui:C:text({ text: "Hello, AiScript!", size: 1.5, bold: true }),
	Ui:C:mfm({ text: "$[tada 🎉] **MFM** も $[fg.color=f80 書けます]" }),
	Ui:C:button({
		text: "押してね",
		primary: true,
		rounded: true,
		onClick: @() {
			Mk:toast("押されました")
		},
	}),
])
`,
	},
	{
		id: 'counter',
		title: 'カウンター（update）',
		code: `/// @ 1.2.1
// 部品の update() で表示を書き換えます
var count = 0
let label = Ui:C:text({ text: \`count: {count}\`, size: 2 })

@refresh() {
	label.update({ text: \`count: {count}\`, color: if count < 0 "#e44" else "inherit" })
}

Ui:render([
	Ui:C:container({
		align: "center",
		children: [
			label,
			Ui:C:buttons({ buttons: [
				{ text: "-1", onClick: @() { count -= 1; refresh() } },
				{ text: "リセット", onClick: @() { count = 0; refresh() } },
				{ text: "+1", primary: true, onClick: @() { count += 1; refresh() } },
			] }),
		],
	}),
])
`,
	},
	{
		id: 'forms',
		title: 'フォーム部品ひとそろい',
		code: `/// @ 1.2.1
let state = {
	name: "ななし",
	age: 20,
	bio: "",
	notify: true,
	color: "green",
}

let preview = Ui:C:mfm({ text: "" })

@refresh() {
	preview.update({ text: \`**{state.name}** さん（{state.age}歳）{Str:lf}好きな色: {state.color} / 通知: {if state.notify "ON" else "OFF"}{Str:lf}> {state.bio}\` })
}

Ui:render([
	Ui:C:textInput({ label: "名前", default: state.name, caption: "textInput", onInput: @(v) { state.name = v; refresh() } }),
	Ui:C:numberInput({ label: "年齢", default: 20, caption: "numberInput", onInput: @(v) { state.age = v; refresh() } }),
	Ui:C:textarea({ label: "自己紹介", caption: "textarea", onInput: @(v) { state.bio = v; refresh() } }),
	Ui:C:switch({ label: "通知を受け取る", caption: "switch", default: true, onChange: @(v) { state.notify = v; refresh() } }),
	Ui:C:select({
		label: "好きな色",
		caption: "select",
		default: "green",
		items: [
			{ text: "赤", value: "red" },
			{ text: "緑", value: "green" },
			{ text: "青", value: "blue" },
		],
		onChange: @(v) { state.color = v; refresh() },
	}),
	Ui:C:folder({
		title: "プレビュー（folder）",
		opened: true,
		children: [
			Ui:C:container({
				bgColor: "#8882",
				padding: 12,
				rounded: true,
				children: [preview],
			}),
		],
	}),
])
refresh()
`,
	},
	{
		id: 'container',
		title: 'container の装飾',
		code: `/// @ 1.2.1
Ui:render([
	Ui:C:container({
		align: "center",
		bgColor: "#86b300",
		fgColor: "#fff",
		padding: 16,
		rounded: true,
		children: [Ui:C:text({ text: "bgColor / fgColor / rounded", bold: true })],
	}),
	Ui:C:container({
		borderWidth: 2,
		borderColor: "#f80",
		borderStyle: "dashed",
		borderRadius: 12,
		padding: 16,
		font: "serif",
		children: [Ui:C:text({ text: "border 系の指定と serif フォント" })],
	}),
	Ui:C:container({
		font: "monospace",
		align: "right",
		padding: 8,
		children: [Ui:C:text({ text: "monospace / 右寄せ" })],
	}),
	Ui:C:container({
		hidden: true,
		children: [Ui:C:text({ text: "hidden: true なので見えない" })],
	}),
])
`,
	},
	{
		id: 'clickable',
		title: 'MFM の clickable',
		code: `/// @ 1.2.1
// $[clickable.ev=名前 ...] をクリックすると onClickEv が呼ばれます
let log = Ui:C:text({ text: "まだ何も押されていません" })

Ui:render([
	Ui:C:mfm({
		text: "好きなのは $[clickable.ev=apple 🍎りんご] / $[clickable.ev=grape 🍇ぶどう] / $[clickable.ev=peach 🍑もも]",
		size: 1.2,
		onClickEv: @(id) {
			log.update({ text: \`{id} が押されました\` })
		},
	}),
	log,
])
`,
	},
	{
		id: 'omikuji',
		title: 'おみくじ（Play の定番）',
		code: `/// @ 1.2.1
// ユーザーごとに日替わりのおみくじ
let choices = [
	"ｷﾞｶﾞ吉",
	"大吉",
	"吉",
	"中吉",
	"小吉",
	"末吉",
	"凶",
	"大凶",
]

// シードが「PlayID+ユーザーID+今日の日付」である乱数生成器を用意
let random = Math:gen_rng(\`{THIS_ID}{USER_ID}{Date:year()}{Date:month()}{Date:day()}\`)

let chosen = choices[random(0, (choices.len - 1))]
let result = \`今日のあなたの運勢は **{chosen}** です。\`

Ui:render([
	Ui:C:container({
		align: "center",
		children: [
			Ui:C:mfm({ text: result }),
			Ui:C:postFormButton({
				text: "投稿する",
				rounded: true,
				primary: true,
				form: {
					text: \`{result}{Str:lf}{THIS_URL}\`,
				},
			}),
		],
	}),
])
`,
	},
	{
		id: 'dialogs',
		title: 'ダイアログと入力',
		code: `/// @ 1.2.1
// Mk:dialog / Mk:confirm / readline は実行を待ってから次に進みます
Ui:render([
	Ui:C:buttons({ buttons: [
		{ text: "dialog", onClick: @() { Mk:dialog("おしらせ", "これは Mk:dialog です", "info") } },
		{ text: "confirm", onClick: @() {
			if Mk:confirm("確認", "続けますか？") {
				Mk:toast("はい が選ばれました")
			} else {
				Mk:toast("いいえ が選ばれました")
			}
		} },
		{ text: "readline", primary: true, onClick: @() {
			let name = readline("お名前は？")
			Mk:dialog(\`こんにちは、{name} さん\`, Mk:nyaize("なんでもないです"), "success")
		} },
	] }),
])
`,
	},
	{
		id: 'storage',
		title: 'Mk:save / Mk:load',
		code: `/// @ 1.2.1
// Mk:save の値はブラウザに保存され、再実行しても残ります
let saved = Mk:load("visits")
var visits = if saved == null 0 else saved
visits += 1
Mk:save("visits", visits)

Ui:render([
	Ui:C:text({ text: \`{visits} 回目の実行です\` }),
	Ui:C:button({ text: "リセット", onClick: @() {
		Mk:remove("visits")
		Mk:toast("消しました。もう一度実行してください")
	} }),
])
`,
	},
	{
		id: 'postform',
		title: '投稿フォーム',
		code: `/// @ 1.2.1
// 既定ではモックサーバーに投稿します。⚙ 設定で実サーバーとトークンを指定すると、そのサーバーに投稿します
Ui:render([
	Ui:C:postFormButton({ text: "投稿フォームを開く", primary: true, rounded: true, form: { text: "AiScript から投稿 #aiscript", cw: "テスト", visibility: "home" } }),
	Ui:C:postForm({ form: { text: "埋め込みの投稿フォーム", localOnly: true } }),
])
`,
	},
	{
		id: 'api',
		title: 'Mk:api でサーバー情報',
		code: `/// @ 1.2.1
// 既定では同梱のモックサーバーに問い合わせます。⚙ 設定で実際のサーバーに切り替えられます
let res = Mk:api("meta", { detail: false })

if Core:type(res) == "error" {
	Ui:render([Ui:C:mfm({ text: \`$[fg.color=e44 エラー] {Json:stringify(res.info)}\` })])
} else {
	Ui:render([
		Ui:C:text({ text: if res.name == null "(名前なし)" else res.name, size: 1.5, bold: true }),
		Ui:C:mfm({ text: if res.description == null "" else res.description }),
		Ui:C:text({ text: \`version {res.version}\` }),
	])
}
`,
	},
	{
		id: 'timeline',
		title: 'タイムラインとリアクション（Mk:api）',
		code: `/// @ 1.2.1
// モックサーバーのタイムラインを読み、リアクションと投稿をします
let list = Ui:C:container({ children: [] })
let input = Ui:C:textInput({ label: "ノートを書く", onInput: @(v) { draft = v } })
var draft = ""

@noteView(note) {
	let reactions = Obj:kvs(note.reactions).map(@(kv) { \`{kv[0]} {kv[1]}\` }).join("  ")
	Ui:C:container({
		borderWidth: 1,
		borderRadius: 8,
		padding: 12,
		children: [
			Ui:C:mfm({ text: \`**{note.user.name}** @{note.user.username}\`, size: 0.9 }),
			Ui:C:mfm({ text: note.text }),
			Ui:C:mfm({ text: reactions, size: 0.85 }),
			Ui:C:buttons({ buttons: [
				{ text: "👍", disabled: note.myReaction != null, onClick: @() {
					Mk:api("notes/reactions/create", { noteId: note.id, reaction: "👍" })
					reload()
				} },
			] }),
		],
	})
}

@reload() {
	let notes = Mk:api("notes/timeline", { limit: 5 })
	if Core:type(notes) == "error" {
		list.update({ children: [Ui:C:text({ text: Json:stringify(notes.info) })] })
		return null
	}
	list.update({ children: notes.map(noteView) })
}

Ui:render([
	input,
	Ui:C:button({ text: "ノート", primary: true, onClick: @() {
		let res = Mk:api("notes/create", { text: draft })
		if Core:type(res) == "error" Mk:toast(res.info.message) else reload()
	} }),
	list,
])
reload()
`,
	},
	{
		id: 'console',
		title: 'コンソール出力だけ',
		code: `/// @ 1.2.1
// <: で右下のコンソールに出力します
@fizzbuzz(n) {
	if n % 15 == 0 "FizzBuzz"
	elif n % 3 == 0 "Fizz"
	elif n % 5 == 0 "Buzz"
	else Core:to_str(n)
}

for let i = 1, 20 {
	<: fizzbuzz(i)
}

{ USER_NAME: USER_NAME, LOCALE: LOCALE }
`,
	},
];
