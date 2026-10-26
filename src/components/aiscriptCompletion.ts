// AiScript の補完とホバー時のヒント
import { autocompletion, snippetCompletion } from '@codemirror/autocomplete';
import { hoverTooltip } from '@codemirror/view';
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { EditorState } from '@codemirror/state';
import stdRef from '@/reference/std.json';
import playRef from '@/reference/play.json';

type Entry = { name: string; signature: string; doc: string; type: string };

const KEYWORDS = ['let', 'var', 'if', 'elif', 'else', 'return', 'each', 'for', 'loop', 'do', 'while', 'break', 'continue', 'match', 'case', 'default', 'eval', 'exists', 'true', 'false', 'null'];

const globals = new Map<string, Entry>();
for (const f of stdRef.functions) {
	globals.set(f.name, { name: f.name, signature: f.signature, doc: f.doc, type: f.kind === 'function' ? 'function' : 'constant' });
}
for (const c of playRef.constants) {
	globals.set(c.name, { name: c.name, signature: `${c.name}: ${c.type}`, doc: c.doc, type: 'constant' });
}
for (const f of playRef.functions) {
	globals.set(f.name, { name: f.name, signature: f.signature, doc: f.doc, type: f.kind === 'const' ? 'constant' : 'function' });
}
for (const c of playRef.components) {
	globals.set(`Ui:C:${c.name}`, {
		name: `Ui:C:${c.name}`,
		signature: `Ui:C:${c.name}(props: obj, id?: str): component`,
		doc: `${c.doc}\nprops: ${c.props.map(p => p.name).join(', ')}`,
		type: 'class',
	});
}

// playground にだけあるもの（Misskey 本体にはない）。if exists PLAYGROUND { ... } の中で使う
for (const [name, signature, doc] of [
	['PLAYGROUND', 'PLAYGROUND: bool', 'playground で実行しているときだけある定数。Misskey 本体にはないので、if exists PLAYGROUND { ... } で playground のときだけテストを動かせる'],
	['Test:check', 'Test:check(name: str, fn: @()): bool', 'テストを 1 つ実行する。fn の中の Test:eq などがすべて成功すれば成功。実行時エラーも失敗として記録する（playground 専用）'],
	['Test:eq', 'Test:eq(actual, expected, label?: str): bool', '2 つの値が同じか確かめる。配列やオブジェクトは中身で比べる（playground 専用）'],
	['Test:ne', 'Test:ne(actual, unexpected, label?: str): bool', '2 つの値が違うか確かめる（playground 専用）'],
	['Test:ok', 'Test:ok(cond: bool, label?: str): bool', '条件が true か確かめる（playground 専用）'],
] as const) {
	globals.set(name, { name, signature, doc, type: name === 'PLAYGROUND' ? 'constant' : 'function' });
}

const componentProps = new Map(playRef.components.map(c => [c.name, c.props]));

// 同じ名前の組み込みプロパティは受け手の型ごとにまとめる
const builtinProps = new Map<string, Entry>();
for (const p of stdRef.properties) {
	const prev = builtinProps.get(p.name);
	if (prev) {
		prev.signature += `\n${p.signature}`;
	} else {
		builtinProps.set(p.name, { name: p.name, signature: p.signature, doc: p.doc, type: p.kind === 'method' ? 'method' : 'property' });
	}
}
builtinProps.set('update', { name: 'update', signature: 'component.update(props: obj): null', doc: 'Ui:C:* で作った部品の表示を変える。渡したプロパティだけが変わる。', type: 'method' });
builtinProps.set('id', { name: 'id', signature: 'component.id: str', doc: 'Ui:C:* で作った部品の id。', type: 'property' });

function renderInfo(e: Entry): () => Node {
	return () => {
		const el = document.createElement('div');
		el.className = 'as-hint';
		const sig = document.createElement('code');
		sig.className = 'as-hint-signature';
		sig.textContent = e.signature;
		const doc = document.createElement('div');
		doc.className = 'as-hint-doc';
		doc.textContent = e.doc;
		el.append(sig, doc);
		return el;
	};
}

function toCompletion(e: Entry, boost = 0): Completion {
	const first = e.signature.split('\n')[0];
	const rest = first.slice(first.indexOf(e.name) + e.name.length);
	return { label: e.name, type: e.type, detail: rest.length > 40 ? `${rest.slice(0, 40)}…` : rest, info: renderInfo(e), boost };
}

// カーソルの手前で閉じていない { の位置を探す（文字列とコメントは読み飛ばす）
function findOpenBrace(text: string): number | null {
	const stack: number[] = [];
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === '/' && text[i + 1] === '/') {
			const nl = text.indexOf('\n', i);
			if (nl < 0) break;
			i = nl;
		} else if (ch === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2);
			if (end < 0) break;
			i = end + 1;
		} else if (ch === '"' || ch === '\'') {
			i++;
			while (i < text.length && text[i] !== ch) {
				if (text[i] === '\\') i++;
				i++;
			}
		} else if (ch === '{') {
			stack.push(i);
		} else if (ch === '}') {
			stack.pop();
		}
		i++;
	}
	return stack.at(-1) ?? null;
}

// Ui:C:xxx({ ... }) や v.update({ ... }) の中なら、その部品の種類を返す
function componentAt(state: EditorState, pos: number): string | null {
	const before = state.sliceDoc(0, pos);
	const brace = findOpenBrace(before);
	if (brace == null) return null;
	const head = before.slice(0, brace);
	const direct = head.match(/Ui:C:(\w+)\(\s*$/);
	if (direct) return direct[1];
	const update = head.match(/([A-Za-z_]\w*)\.update\(\s*$/);
	if (update) {
		const decl = state.doc.toString().match(new RegExp(`(?:let|var)\\s+${update[1]}\\s*=\\s*Ui:C:(\\w+)\\(`));
		if (decl) return decl[1];
	}
	return null;
}

function localNames(state: EditorState): Entry[] {
	const names = new Map<string, Entry>();
	const text = state.doc.toString();
	for (const m of text.matchAll(/(?:let|var)\s+([A-Za-z_]\w*)/g)) {
		names.set(m[1], { name: m[1], signature: m[0], doc: 'このコードで宣言した変数', type: 'variable' });
	}
	for (const m of text.matchAll(/@([A-Za-z_]\w*)\s*\(([^)]*)\)/g)) {
		names.set(m[1], { name: m[1], signature: `${m[1]}(${m[2]})`, doc: 'このコードで宣言した関数', type: 'function' });
	}
	return [...names.values()];
}

function aiscriptCompletions(context: CompletionContext): CompletionResult | null {
	const { state, pos } = context;

	// 部品のプロパティ名
	const key = context.matchBefore(/[A-Za-z_]*$/);
	if (key) {
		const prevChar = state.sliceDoc(0, key.from).replace(/\s+$/, '').at(-1);
		if (prevChar === '{' || prevChar === ',') {
			const component = componentAt(state, pos);
			const props = component ? componentProps.get(component) : null;
			if (props) {
				return {
					from: key.from,
					options: props.map(p => ({
						label: p.name,
						type: 'property',
						detail: p.type.length > 40 ? `${p.type.slice(0, 40)}…` : p.type,
						apply: `${p.name}: `,
						info: renderInfo({ name: p.name, signature: `${p.name}: ${p.type}`, doc: p.doc, type: 'property' }),
					})),
					validFor: /^\w*$/,
				};
			}
		}
	}

	// 値の後ろの . に続く組み込みプロパティ
	const member = context.matchBefore(/[\w)\]"'`]\.\w*$/);
	if (member) {
		return {
			from: member.from + 2,
			options: [...builtinProps.values()].map(e => toCompletion(e)),
			validFor: /^\w*$/,
		};
	}

	const word = context.matchBefore(/[A-Za-z_][\w:]*$/);
	if (!word && !context.explicit) return null;
	const from = word?.from ?? pos;

	const options: Completion[] = [
		...[...globals.values()].map(e => e.name.startsWith('Ui:C:')
			? snippetCompletion(`${e.name}({ \${} })`, { ...toCompletion(e, 1) })
			: toCompletion(e)),
		...localNames(state).map(e => toCompletion(e, 2)),
		...KEYWORDS.map(k => ({ label: k, type: 'keyword', boost: -1 })),
	];
	return { from, options, validFor: /^[\w:]*$/ };
}

export const aiscriptAutocomplete = autocompletion({
	override: [aiscriptCompletions],
	activateOnTyping: true,
	icons: true,
});

// マウスを乗せた関数・定数・部品のプロパティの説明を出す
export const aiscriptHover = hoverTooltip((view, pos) => {
	const line = view.state.doc.lineAt(pos);
	const text = line.text;
	let start = pos - line.from;
	let end = start;
	while (start > 0 && /[\w:]/.test(text[start - 1])) start--;
	while (end < text.length && /[\w:]/.test(text[end])) end++;
	if (start === end) return null;
	const word = text.slice(start, end).replace(/:+$/, '');

	let entry = globals.get(word) ?? null;
	if (!entry && text[start - 1] === '.') entry = builtinProps.get(word) ?? null;
	if (!entry && text[end] === ':') {
		const component = componentAt(view.state, line.from + start);
		const prop = component ? componentProps.get(component)?.find(p => p.name === word) : null;
		if (prop) entry = { name: prop.name, signature: `${prop.name}: ${prop.type}`, doc: prop.doc, type: 'property' };
	}
	if (!entry) return null;
	const e = entry;
	return {
		pos: line.from + start,
		end: line.from + end,
		above: true,
		create: () => ({ dom: renderInfo(e)() as HTMLElement }),
	};
});
