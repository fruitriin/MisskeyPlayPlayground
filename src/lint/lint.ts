// AiScript（Misskey Play 向け）の静的チェック。実行する前に、よくある間違いを見つける。
// ブラウザ（エディタの波線、window.__playground.lint）と Node.js（scripts/lint-ais.mjs）の両方から使うので、
// ほかのソースファイルには依存しない（相対パスの import は使わない）
import { Parser, utils } from '@syuilo/aiscript';
import stdRef from '../reference/std.json' with { type: 'json' };
import playRef from '../reference/play.json' with { type: 'json' };

export type Diagnostic = {
	line: number;
	column: number;
	// 終わりの位置が分からないときは、始まりと同じ
	endLine: number;
	endColumn: number;
	severity: 'error' | 'warning' | 'info';
	rule: string;
	message: string;
};

type Loc = { start: { line: number; column: number }; end: { line: number; column: number } };
type Node = { type: string; loc?: Loc; [key: string]: unknown };

// playground にだけある定数と関数（Misskey 本体にはない）
// Test:case にしないのは、case が予約語で名前に使えないため
const PLAYGROUND_NAMES = ['PLAYGROUND', 'Test:check', 'Test:eq', 'Test:ne', 'Test:ok'];

const KNOWN_GLOBALS = new Set<string>([
	...stdRef.functions.map(f => f.name),
	...playRef.constants.map(c => c.name),
	...playRef.functions.map(f => f.name),
	...playRef.components.map(c => `Ui:C:${c.name}`),
	...PLAYGROUND_NAMES,
]);

const COMPONENT_PROPS = new Map(playRef.components.map(c => [c.name, new Set(c.props.map(p => p.name))]));

// JavaScript の癖で書きがちだが、AiScript では別の名前のもの
const JS_PROPS: Record<string, string> = {
	length: 'len',
	includes: 'incl',
	indexOf: 'index_of',
	forEach: 'each 文か map',
	toString: 'Core:to_str(v) か to_str()',
	toUpperCase: 'upper',
	toLowerCase: 'lower',
	startsWith: 'starts_with',
	endsWith: 'ends_with',
	padStart: 'pad_start',
	padEnd: 'pad_end',
	charAt: 'pick',
	substring: 'slice',
	substr: 'slice',
	toFixed: 'Math:round など',
	findIndex: 'index_of か find',
	flatMap: 'flat_map',
};

function diag(loc: Loc | undefined, severity: Diagnostic['severity'], rule: string, message: string): Diagnostic {
	const start = loc?.start ?? { line: 1, column: 1 };
	const end = loc?.end ?? start;
	return { line: start.line, column: start.column, endLine: end.line, endColumn: end.column, severity, rule, message };
}

// 構文エラーの文に、よくある原因の説明を足す
function syntaxHint(code: string, message: string, line: number): string {
	const text = code.split('\n')[line - 1] ?? '';
	if (/\?\?/.test(text)) return 'AiScript に `??` はありません。`if x == null 既定値 else x` と書きます';
	if (/\?\./.test(text)) return 'AiScript に `?.` はありません。先に `if x != null` で調べます';
	const reserved = message.match(/Reserved word "(\w+)"/);
	if (reserved) return `「${reserved[1]}」は予約語なので、変数や関数の名前に使えません（一覧は /ai/aiscript/keywords.md）`;
	if (/ElseKeyword/.test(message) && /\s-\d/.test(text)) return '`if 条件 -1 else ...` の -1 が引き算と解釈されています。`(-1)` か `{ -1 }` と書きます';
	if (/Multiple statements/.test(message) && /\b(const|function)\b/.test(text)) return 'AiScript の宣言は `let` / `var`、関数は `@名前() { }` です';
	return '';
}

export function lint(code: string): Diagnostic[] {
	const result: Diagnostic[] = [];

	// 1 行目のバージョン表記
	const version = utils.getLangVersion(code);
	if (version == null) {
		result.push(diag(undefined, 'warning', 'version-header', '1 行目に `/// @ 1.2.1` がありません。Misskey Play は表記のないコードを古い 0.19.0 で実行します'));
	} else if (!/^1\./.test(version)) {
		// 0.x 向けのコードは文法が違うので、ここから先は調べない
		result.push(diag(undefined, 'info', 'legacy-version', `AiScript ${version} 向けのコードとして扱います（このチェックは 1.x 向けです）`));
		return result;
	}

	let ast: Node[];
	try {
		ast = new Parser().parse(code) as unknown as Node[];
	} catch (err) {
		const e = err as { message?: string; pos?: { line: number; column: number } };
		const pos = e.pos ?? { line: 1, column: 1 };
		const message = String(e.message ?? err).replace(/^Syntax: /, '').replace(/ \(Line \d+, Column \d+\)$/, '').replace(/\.$/, '');
		const hint = syntaxHint(code, message, pos.line);
		result.push(diag({ start: pos, end: pos }, 'error', 'syntax', `構文エラー: ${message}${hint ? `。${hint}` : ''}`));
		return result;
	}

	// ユーザーが名前空間で定義した名前を集める
	const userNames = new Set<string>();
	const collectNs = (nodes: Node[], prefix: string) => {
		for (const n of nodes) {
			if (n.type === 'ns') {
				const name = `${prefix}${n.name as string}`;
				collectNs(n.members as Node[], `${name}:`);
			} else if (n.type === 'def' && prefix !== '') {
				const dest = n.dest as Node;
				if (dest.type === 'identifier') userNames.add(`${prefix}${dest.name as string}`);
			}
		}
	};
	collectNs(ast, '');
	const userNamespaces = new Set([...userNames].map(n => n.split(':')[0]));

	const visit = (node: unknown, parent: Node | null) => {
		if (node == null || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			for (const c of node) visit(c, parent);
			return;
		}
		if (node instanceof Map) {
			for (const v of node.values()) visit(v, parent);
			return;
		}
		const n = node as Node;
		if (typeof n.type !== 'string') return;

		switch (n.type) {
			case 'identifier': {
				const name = n.name as string;
				// exists の対象は、なくてもよい
				if (parent?.type === 'exists') break;
				if (name.includes(':') && !KNOWN_GLOBALS.has(name) && !userNames.has(name)) {
					const ns = name.split(':')[0];
					const hint = userNamespaces.has(ns) ? `名前空間 ${ns} に、その名前の関数や定数がありません` : 'AiScript にも Misskey Play にもない名前です';
					result.push(diag(n.loc, 'error', 'unknown-name', `「${name}」は見つかりません。${hint}`));
				}
				break;
			}
			case 'add': {
				const left = n.left as Node;
				const right = n.right as Node;
				if (left.type === 'str' || right.type === 'str' || left.type === 'tmpl' || right.type === 'tmpl') {
					result.push(diag(n.loc, 'error', 'string-plus', '文字列は `+` でつなげません（数値専用です）。テンプレート文字列 `{a}{b}` か `[a, b].join()` を使います'));
				}
				break;
			}
			case 'prop': {
				const name = n.name as string;
				if (name in JS_PROPS) {
					result.push(diag(n.loc, 'warning', 'js-property', `「.${name}」は JavaScript の書き方です。AiScript では ${JS_PROPS[name]} です（オブジェクトに自分で ${name} を入れたのなら問題ありません）`));
				}
				break;
			}
			case 'call': {
				const target = n.target as Node;
				const args = n.args as Node[];
				if (target.type === 'identifier' && (target.name as string).startsWith('Ui:C:')) {
					checkComponent((target.name as string).slice(5), args[0], result);
				}
				break;
			}
		}

		for (const [key, value] of Object.entries(n)) {
			if (key === 'loc' || key === 'type') continue;
			visit(value, n);
		}
	};
	visit(ast, null);

	return result.sort((a, b) => a.line - b.line || a.column - b.column);
}

// 文字列（テンプレート文字列なら文字の部分）に、MFM の書き方が入っているか
const MFM_LIKE = /:[A-Za-z0-9_+-]+:|\$\[|\*\*|<center>|<small>/;
function mfmLike(n: Node | undefined): boolean {
	if (!n) return false;
	if (n.type === 'str') return MFM_LIKE.test(n.value as string);
	if (n.type === 'tmpl') return (n.tmpl as Node[]).some(p => p.type === 'str' && MFM_LIKE.test(p.value as string));
	return false;
}

// Ui:C:text とボタンの文字は MFM として解析されない（Misskey の MkAsUi は {{ text }} で出すだけ）
function checkPlainText(kind: string, value: Map<string, Node>, result: Diagnostic[]) {
	const where = kind === 'text' ? 'Ui:C:text の文字' : 'ボタンの文字';
	const message = `${where}は MFM として解析されないので、:カスタム絵文字: や $[...]・**太字** は、そのまま文字で表示されます。${kind === 'text' ? 'MFM を使うなら Ui:C:mfm にします' : 'ボタンの文字は平文です（絵文字は OS の絵文字で表示され、MFM の中の絵文字とは見た目が変わります）'}`;
	if (kind === 'text' || kind === 'button' || kind === 'postFormButton') {
		const text = value.get('text');
		if (mfmLike(text)) result.push(diag(text!.loc, 'warning', 'plain-text-mfm', message));
	}
	if (kind === 'buttons') {
		const buttons = value.get('buttons');
		if (buttons?.type !== 'arr') return;
		for (const b of buttons.value as Node[]) {
			if (b.type !== 'obj') continue;
			const text = (b.value as Map<string, Node>).get('text');
			if (mfmLike(text)) result.push(diag(text!.loc, 'warning', 'plain-text-mfm', message));
		}
	}
}

function checkComponent(kind: string, def: Node | undefined, result: Diagnostic[]) {
	const props = COMPONENT_PROPS.get(kind);
	if (!props || def?.type !== 'obj') return;
	const value = def.value as Map<string, Node>;
	checkPlainText(kind, value, result);
	for (const [key, v] of value) {
		if (!props.has(key)) {
			const message = key === 'hidden'
				? '`hidden` が効くのは Ui:C:container だけです。隠したい部品は container で包みます'
				: `Ui:C:${kind} に「${key}」というプロパティはありません（使えるのは ${[...props].join(', ')}）`;
			result.push(diag(v.loc, 'warning', 'unknown-prop', message));
		}
		if (v.type === 'null') {
			result.push(diag(v.loc, 'error', 'null-prop', `「${key}」に null を渡すと実行時にエラーになります。使わないときはキーごと書かないでください`));
		}
	}
	// fgColor を付けた container の中に、ボタンを直接入れている
	if (kind === 'container' && value.has('fgColor')) {
		const children = value.get('children');
		if (children?.type === 'arr') {
			for (const c of children.value as Node[]) {
				const t = c.type === 'call' ? (c.target as Node) : null;
				if (t?.type === 'identifier' && /^Ui:C:(button|buttons|postFormButton)$/.test(t.name as string)) {
					result.push(diag(c.loc, 'warning', 'button-in-fgcolor', 'fgColor を付けた container の中のボタンは、文字色だけが変わり、テーマによっては読めなくなります。ボタンは container の外に置きます'));
				}
			}
		}
	}
}
