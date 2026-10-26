// AI や自動テストが、ブラウザ上の playground を JSON で読み書き・操作するための API。
// window.__playground に置く。使い方は docs/ai/browser-api.md と help() を参照
import { nextTick } from 'vue';
import { code, mobileTab, screenshotMode } from './store.js';
import { run, stop, logs, root, components, running, usedVersion, pendingCallbacks, trackCallback, testResults, lintResults } from './runner.js';
import { lint } from './lint/lint.js';
import type { Diagnostic } from './lint/lint.js';
import type { TestResult } from './aiscript/test.js';
import { allSamples as samples } from './allSamples.js';
import { settings } from './settings.js';
import * as os from './os.js';
import type { AsUiComponent } from './aiscript/ui.js';

export type UiNode = {
	id: string;
	type: string;
	// container の hidden。ほかの部品は常に false
	hidden: boolean;
	props: Record<string, unknown>;
	// 設定されているコールバックの名前（onClick など）
	handlers: string[];
	// 入力欄・スイッチ・セレクトの、画面上のいまの値
	value?: string | number | boolean | null;
	children?: UiNode[];
};

export type PlaygroundState = {
	aiscriptVersion: string;
	running: boolean;
	pendingCallbacks: number;
	timedOut?: boolean;
	apiMode: 'mock' | 'server';
	code?: string;
	logs: { type: string; text: string }[];
	ui: UiNode | null;
	dialogs: { kind: string; type?: string; title?: string; text?: string }[];
	toasts: { text: string; time: string }[];
	// Test:check などの結果
	tests: { passed: number; failed: number; results: TestResult[] };
	// 実行したコードの静的チェックの結果
	lint: Diagnostic[];
	// act() が返す状態だけに付く。その act() の間に出たログとトースト
	newLogs?: { type: string; text: string }[];
	newToasts?: { text: string; time: string }[];
};

export type Action =
	| { type: 'click'; id: string; index?: number; text?: string }
	| { type: 'input'; id: string; value: string | number }
	| { type: 'toggle'; id: string; value?: boolean }
	| { type: 'select'; id: string; value: string }
	| { type: 'clickEv'; id: string; ev: string }
	| { type: 'dialog'; answer?: boolean | string | null }
	| { type: 'wait'; ms: number };

type Options = { timeout?: number; includeCode?: boolean };

// Mk:save が使う localStorage のキーの頭（src/aiscript/api.ts の storageKey と同じ）
const STORAGE_PREFIX = 'aiscript:playground:';

const HELP = `window.__playground: Misskey Play Playground を JSON で操作する API

getState({ includeCode? })   いまの状態（ログ・UI ツリー・ダイアログ・トースト）を返す
summary()                    状態を短い文章で返す（出力の長さに制限がある道具向け）
lint(code?)                  実行せずに静的チェックする（構文、存在しない関数、文字列の +、null のプロパティなど）
test(scenario)               シナリオテスト。{ code?, steps: [action または { expect: {...} }] } を流して合否を返す
getCode() / setCode(code)    エディタのコードを読む・書く（setCode は実行しない）
run(code?, { timeout? })     コードを実行し、落ち着いたら状態を返す（code を省くとエディタのコード）
stop()                       実行を止める
showPreview()                スクリーンショットの前に、プレビューを表示して先頭までスクロールする
setScreenshotMode(on)        true でプレビューだけを中身の高さで表示する（ページ全体を撮ると全部写る）
act(action | action[])       UI を操作し、コールバックが終わったら状態を返す（newLogs / newToasts にその間の分）
samples() / loadSample(id)   サンプルの一覧・読み込みと実行
storage.keys/get/set/remove/clear   Mk:save で保存した値を読み書きする（テストで好きな場面から始めるのに使う）

action の形:
  { type: "click", id, index?, text? }  button / buttons（index か text で選ぶ）/ postFormButton / folder
  { type: "input", id, value }          textInput / textarea / numberInput
  { type: "toggle", id, value? }        switch（value を省くと反転）
  { type: "select", id, value }         select（items の value を渡す）
  { type: "clickEv", id, ev }           mfm の $[clickable.ev=...]
  { type: "dialog", answer? }           開いているダイアログに答える（confirm は true/false、readline は文字列、null でキャンセル）
  { type: "wait", ms }

id は state.ui の各ノードの id。Ui:C:* の第2引数で付けた id もそのまま使える。
ダイアログが開くと、コールバックの途中でも状態を返す。dialogs を見て { type: "dialog" } で答える。
詳しくは ./ai/browser-api.md`;

function serializeProps(c: AsUiComponent): { props: Record<string, unknown>; handlers: string[] } {
	const props: Record<string, unknown> = {};
	const handlers: string[] = [];
	for (const [k, v] of Object.entries(c)) {
		if (k === 'id' || k === 'type' || k === 'children' || k === 'hidden') continue;
		if (typeof v === 'function') {
			handlers.push(k);
		} else if (k === 'buttons' && Array.isArray(v)) {
			props.buttons = v.map((b: Record<string, unknown>) => ({
				...Object.fromEntries(Object.entries(b).filter(([, x]) => typeof x !== 'function')),
				handlers: Object.entries(b).filter(([, x]) => typeof x === 'function').map(([k]) => k),
			}));
		} else if (v !== undefined) {
			props[k] = v;
		}
	}
	return { props, handlers };
}

function elementOf(id: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-as-id="${CSS.escape(id)}"]`);
}

function domValue(c: AsUiComponent): UiNode['value'] {
	const el = elementOf(c.id);
	if (!el) return undefined;
	switch (c.type) {
		case 'textInput':
		case 'textarea':
			return el.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')?.value ?? null;
		case 'numberInput': {
			const v = el.querySelector('input')?.value;
			return v == null || v === '' ? null : Number(v);
		}
		case 'switch':
			return el.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked ?? null;
		case 'select':
			return el.querySelector('select')?.value || null;
		default:
			return undefined;
	}
}

function findComponent(id: string): AsUiComponent | null {
	return components.value.find(c => c.value.id === id)?.value ?? null;
}

function toNode(c: AsUiComponent): UiNode {
	const { props, handlers } = serializeProps(c);
	const node: UiNode = { id: c.id, type: c.type, hidden: c.hidden === true, props, handlers };
	const value = domValue(c);
	if (value !== undefined) node.value = value;
	if (c.children) {
		node.children = c.children.map(id => findComponent(id)).filter((x): x is AsUiComponent => x != null).map(toNode);
	}
	return node;
}

export function getState(opts: Options = {}): PlaygroundState {
	const r = root.value;
	return {
		aiscriptVersion: usedVersion.value,
		running: running.value,
		pendingCallbacks: pendingCallbacks.value,
		apiMode: settings.apiMode,
		...(opts.includeCode === false ? {} : { code: code.value }),
		logs: logs.value.map(l => ({ type: l.type, text: l.text })),
		ui: r ? toNode(r) : null,
		dialogs: os.state.dialogs.map(d => d.kind === 'post'
			? { kind: d.kind, text: d.form.initialText }
			: d.kind === 'input' ? { kind: d.kind, title: d.title } : { kind: d.kind, type: d.type, title: d.title, text: d.text }),
		toasts: os.state.toastHistory.slice(-10).map(t => ({ text: t.text, time: t.time })),
		tests: {
			passed: testResults.value.filter(t => t.ok).length,
			failed: testResults.value.filter(t => !t.ok).length,
			results: testResults.value.map(t => ({ ...t, messages: [...t.messages] })),
		},
		lint: lintResults.value.map(d => ({ ...d })),
	};
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// 処理が終わるか、ダイアログが開くか、時間切れになるまで待つ
async function settle(promise: Promise<unknown> | null, opts: Options): Promise<PlaygroundState> {
	const timeout = opts.timeout ?? 5000;
	let done = promise == null;
	promise?.then(() => { done = true; }, () => { done = true; });
	const start = Date.now();
	await nextTick();
	let timedOut = true;
	while (Date.now() - start < timeout) {
		await sleep(16);
		if (os.state.dialogs.length > 0 || (done && pendingCallbacks.value === 0)) {
			timedOut = false;
			break;
		}
	}
	await nextTick();
	const state = getState({ includeCode: opts.includeCode ?? false });
	return timedOut ? { ...state, timedOut } : state;
}

function requireElement(id: string): HTMLElement {
	const el = elementOf(id);
	if (el) return el;
	if (findComponent(id)) throw new Error(`部品 "${id}" は作られていますが、画面に表示されていません`);
	throw new Error(`部品 "${id}" がありません。getState().ui で id を確認してください`);
}

function clickButton(button: HTMLButtonElement | null | undefined, label: string) {
	if (!button) throw new Error(`${label} にボタンがありません`);
	if (button.disabled) throw new Error(`${label} のボタンは disabled です`);
	button.click();
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
	const proto = Object.getPrototypeOf(el);
	Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
}

function perform(action: Action): void {
	switch (action.type) {
		case 'click': {
			const el = requireElement(action.id);
			const type = el.dataset.asType;
			if (type === 'buttons') {
				const buttons = [...el.querySelectorAll('button')];
				const target = action.text != null ? buttons.find(b => b.textContent?.trim() === action.text) : buttons[action.index ?? 0];
				clickButton(target, `buttons "${action.id}" の ${action.text ?? `${action.index ?? 0} 番目`}`);
			} else if (type === 'button' || type === 'postFormButton' || type === 'folder') {
				clickButton(el.querySelector('button'), `${type} "${action.id}"`);
			} else {
				throw new Error(`${type} "${action.id}" は click できません`);
			}
			return;
		}
		case 'input': {
			const field = requireElement(action.id).querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
			if (!field) throw new Error(`"${action.id}" は入力欄ではありません`);
			setNativeValue(field, String(action.value));
			field.dispatchEvent(new Event('input', { bubbles: true }));
			return;
		}
		case 'toggle': {
			const checkbox = requireElement(action.id).querySelector<HTMLInputElement>('input[type=checkbox]');
			if (!checkbox) throw new Error(`"${action.id}" は switch ではありません`);
			if (action.value === undefined || action.value !== checkbox.checked) checkbox.click();
			return;
		}
		case 'select': {
			const select = requireElement(action.id).querySelector('select');
			if (!select) throw new Error(`"${action.id}" は select ではありません`);
			const values = [...select.options].map(o => o.value).filter(v => v !== '');
			if (!values.includes(action.value)) throw new Error(`"${action.value}" は選択肢にありません（${values.join(', ')}）`);
			setNativeValue(select, action.value);
			select.dispatchEvent(new Event('change', { bubbles: true }));
			return;
		}
		case 'clickEv': {
			requireElement(action.id);
			const c = findComponent(action.id);
			if (c?.type !== 'mfm') throw new Error(`"${action.id}" は mfm ではありません`);
			trackCallback(c.onClickEv?.(action.ev));
			return;
		}
		case 'dialog': {
			const d = os.state.dialogs.at(-1);
			if (!d) throw new Error('開いているダイアログがありません');
			if (d.kind === 'confirm') d.resolve(action.answer !== false);
			else if (d.kind === 'input') d.resolve(action.answer == null || action.answer === false ? null : String(action.answer));
			else d.resolve();
			return;
		}
		case 'wait':
			return;
		default:
			throw new Error(`未知の action です: ${JSON.stringify(action)}`);
	}
}

// ===== シナリオテスト =====

export type Expect = {
	// 部品の確かめ（id で指定）
	id?: string;
	text?: string;          // 部品の文字（mfm の押せる箇所の書式は外す。buttons は各ボタンの文字をつないだもの）に含まれる
	textMatch?: string;     // 正規表現
	hidden?: boolean;
	value?: unknown;        // 入力欄・switch・select の画面上の値
	disabled?: boolean;     // button の disabled
	// 全体の確かめ
	noErrors?: boolean;     // ログにエラーがない
	log?: string;           // <: の出力に含まれる
	toast?: string;         // トーストに含まれる
	dialog?: string;        // 開いているダイアログの種類・題名・本文に含まれる
	noDialog?: boolean;
	tests?: 'pass';         // Test:check などがすべて成功している
	lint?: 'clean';         // 静的チェックで error がない
};

export type Step = Action | { expect: Expect; label?: string };

export type Scenario = { code?: string; steps: Step[]; stopOnFail?: boolean; timeout?: number };

export type ScenarioResult = {
	ok: boolean;
	passed: number;
	failed: number;
	results: { step: number; label: string; ok: boolean; message: string }[];
	summary: string;
};

function plainText(n: UiNode): string {
	if (Array.isArray(n.props.buttons)) return (n.props.buttons as { text: string }[]).map(b => b.text).join(' / ');
	const t = n.props.text;
	return typeof t === 'string' ? t.replace(/\$\[clickable\.ev=\S+ ([^\]]*)\]/g, '$1') : '';
}

function findNode(n: UiNode | null, id: string): UiNode | null {
	if (!n) return null;
	if (n.id === id) return n;
	for (const c of n.children ?? []) {
		const r = findNode(c, id);
		if (r) return r;
	}
	return null;
}

function checkExpect(e: Expect, state: PlaygroundState): string | null {
	const problems: string[] = [];
	if (e.id != null) {
		const node = findNode(state.ui, e.id);
		if (!node) return `部品 "${e.id}" が画面にない`;
		const text = plainText(node);
		if (e.text != null && !text.includes(e.text)) problems.push(`"${e.id}" の文字に "${e.text}" がない（実際: "${text.slice(0, 80)}"）`);
		if (e.textMatch != null && !new RegExp(e.textMatch).test(text)) problems.push(`"${e.id}" の文字が /${e.textMatch}/ に合わない（実際: "${text.slice(0, 80)}"）`);
		if (e.hidden != null && node.hidden !== e.hidden) problems.push(`"${e.id}" の hidden が ${node.hidden}`);
		if (e.value !== undefined && JSON.stringify(node.value) !== JSON.stringify(e.value)) problems.push(`"${e.id}" の値が ${JSON.stringify(node.value)}`);
		if (e.disabled != null && (node.props.disabled === true) !== e.disabled) problems.push(`"${e.id}" の disabled が ${node.props.disabled === true}`);
	}
	if (e.noErrors) {
		const errs = state.logs.filter(l => l.type === 'error');
		if (errs.length) problems.push(`エラーが出ている: ${errs[0].text.split('\n')[0]}`);
	}
	if (e.log != null && !state.logs.some(l => l.type === 'print' && l.text.includes(e.log!))) problems.push(`出力に "${e.log}" がない`);
	if (e.toast != null && !state.toasts.some(t => t.text.includes(e.toast!))) problems.push(`トーストに "${e.toast}" がない`);
	if (e.dialog != null && !state.dialogs.some(d => [d.kind, d.title, d.text].some(x => x?.includes(e.dialog!)))) problems.push(`ダイアログ "${e.dialog}" が開いていない`);
	if (e.noDialog && state.dialogs.length) problems.push(`ダイアログが開いている: ${state.dialogs[0].title ?? state.dialogs[0].kind}`);
	if (e.tests === 'pass') {
		if (state.tests.results.length === 0) problems.push('Test:check などが 1 つも実行されていない');
		else if (state.tests.failed) problems.push(`テストが失敗している: ${state.tests.results.filter(t => !t.ok).map(t => `${t.name}（${t.messages.join(' / ')}）`).join(', ')}`);
	}
	if (e.lint === 'clean') {
		const errs = state.lint.filter(d => d.severity === 'error');
		if (errs.length) problems.push(`静的チェックのエラー: ${errs.map(d => `${d.line}:${d.column} ${d.message}`).join(' / ')}`);
	}
	return problems.length ? problems.join('。') : null;
}

function describeStep(step: Step): string {
	if ('expect' in step) return step.label ?? `確かめる ${JSON.stringify(step.expect)}`;
	return JSON.stringify(step);
}

async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
	const opts = { timeout: scenario.timeout };
	const results: ScenarioResult['results'] = [];
	let state = scenario.code != null ? await playgroundApi.run(scenario.code, opts) : getState({ includeCode: false });
	for (let i = 0; i < scenario.steps.length; i++) {
		const step = scenario.steps[i];
		const label = describeStep(step);
		let problem: string | null;
		if ('expect' in step) {
			problem = checkExpect(step.expect, state);
		} else {
			try {
				state = await playgroundApi.act(step, opts);
				problem = null;
			} catch (err) {
				problem = err instanceof Error ? err.message : String(err);
			}
		}
		results.push({ step: i, label, ok: problem == null, message: problem ?? 'OK' });
		if (problem != null && scenario.stopOnFail !== false) break;
	}
	const failed = results.filter(r => !r.ok);
	const total = scenario.steps.length;
	const summary = failed.length === 0 && results.length === total
		? `OK: ${total} 手順すべて成功`
		: `NG: ${results.length - failed.length} / ${total} 手順が成功。最初の失敗は手順 ${failed[0]?.step}（${failed[0]?.label.slice(0, 80)}）: ${failed[0]?.message}`;
	return { ok: failed.length === 0 && results.length === total, passed: results.length - failed.length, failed: failed.length, results, summary };
}

// 出力の長さに制限のある道具向けに、状態を短い文章にまとめる
function summarize(): string {
	const state = getState({ includeCode: false });
	const lines = [
		`AiScript ${state.aiscriptVersion} / running=${state.running} / pendingCallbacks=${state.pendingCallbacks}`,
	];
	const lintErrors = state.lint.filter(d => d.severity !== 'info');
	for (const d of lintErrors) lines.push(`LINT ${d.severity} ${d.line}:${d.column} [${d.rule}] ${d.message}`);
	if (state.tests.results.length) lines.push(`tests: ${state.tests.passed} passed / ${state.tests.failed} failed${state.tests.failed ? ` (${state.tests.results.filter(t => !t.ok).map(t => t.name).join(', ')})` : ''}`);
	const errors = state.logs.filter(l => l.type === 'error');
	if (errors.length) lines.push(...errors.map(e => `ERROR: ${e.text.split('\n')[0]}`));
	const prints = state.logs.filter(l => l.type === 'print');
	if (prints.length) lines.push(`print: ${prints.slice(-5).map(l => l.text).join(' | ')}`);
	for (const d of state.dialogs) lines.push(`DIALOG(${d.kind}): ${d.title ?? ''} ${d.text ?? ''}`.trim());
	if (state.toasts.length) lines.push(`toasts: ${state.toasts.slice(-3).map(t => t.text).join(' | ')}`);
	const walk = (n: UiNode, depth: number) => {
		if (n.hidden) {
			lines.push(`${'  '.repeat(depth)}${n.type}#${n.id} (hidden)`);
			return;
		}
		// 盤面などが読めるよう、$[clickable.ev=名前 中身] は中身だけにする
		const plain = typeof n.props.text === 'string' ? n.props.text.replace(/\$\[clickable\.ev=\S+ ([^\]]*)\]/g, '$1') : null;
		const text = plain != null ? ` "${plain.replace(/\n/g, '⏎').slice(0, 120)}"` : '';
		const buttons = Array.isArray(n.props.buttons) ? ` [${(n.props.buttons as { text: string; disabled?: boolean }[]).map(b => b.disabled ? `(${b.text})` : b.text).join(' / ')}]` : '';
		const value = n.value !== undefined ? ` = ${JSON.stringify(n.value)}` : '';
		if (n.type !== 'root') lines.push(`${'  '.repeat(depth)}${n.type}#${n.id}${text}${buttons}${value}`);
		for (const c of n.children ?? []) walk(c, n.type === 'root' ? depth : depth + 1);
	};
	if (state.ui) walk(state.ui, 0);
	return lines.join('\n');
}

export const playgroundApi = {
	// 状態を短い文章で返す（エラー、出力、ダイアログ、UI ツリーを 1 行ずつ）
	summary: summarize,
	// コードを実行せずに静的チェックする。code を省くとエディタのコード
	lint(source?: string): Diagnostic[] {
		return lint(source ?? code.value);
	},
	// シナリオテスト: 操作と期待する表示を順に流し、合否を返す
	test: runScenario,
	version: 1,
	help: () => HELP,
	getState,
	getCode: () => code.value,
	setCode(newCode: string): PlaygroundState {
		if (typeof newCode !== 'string') throw new Error('setCode には文字列を渡してください');
		code.value = newCode;
		return getState({ includeCode: false });
	},
	async run(newCode?: string, opts: Options = {}): Promise<PlaygroundState> {
		if (newCode != null) code.value = newCode;
		return settle(run(code.value), opts);
	},
	stop(): PlaygroundState {
		stop();
		return getState({ includeCode: false });
	},
	async act(actions: Action | Action[], opts: Options = {}): Promise<PlaygroundState> {
		const list = Array.isArray(actions) ? actions : [actions];
		const lastLogId = logs.value.at(-1)?.id ?? -1;
		const lastToastId = os.state.toastHistory.at(-1)?.id ?? -1;
		let state = getState({ includeCode: false });
		for (const action of list) {
			perform(action);
			state = await settle(action.type === 'wait' ? sleep(action.ms) : null, opts);
		}
		return {
			...state,
			newLogs: logs.value.filter(l => l.id > lastLogId).map(l => ({ type: l.type, text: l.text })),
			newToasts: os.state.toastHistory.filter(t => t.id > lastToastId).map(t => ({ text: t.text, time: t.time })),
		};
	},
	// スマホ幅ではプレビューのタブに切り替え、プレビューを先頭までスクロールする（スクリーンショットの前に呼ぶ）
	async showPreview(): Promise<void> {
		mobileTab.value = 'preview';
		await nextTick();
		document.querySelector('[data-testid="preview"]')?.scrollTo({ top: 0 });
	},
	// true にすると、ヘッダー・エディタ・コンソールを隠し、プレビューを中身の高さのまま表示する。ページ全体のスクリーンショットでプレビューが全部写る
	async setScreenshotMode(on: boolean): Promise<void> {
		screenshotMode.value = on;
		if (on) mobileTab.value = 'preview';
		await nextTick();
	},
	// Mk:save の保存先（localStorage の aiscript:playground:<キー>）を読み書きする。テストで好きな場面から始めるのに使う
	storage: {
		keys(): string[] {
			return Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX)).map(k => k.slice(STORAGE_PREFIX.length));
		},
		get(key: string): unknown {
			const raw = localStorage.getItem(STORAGE_PREFIX + key);
			return raw == null ? null : JSON.parse(raw);
		},
		set(key: string, value: unknown): void {
			localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
		},
		remove(key: string): void {
			localStorage.removeItem(STORAGE_PREFIX + key);
		},
		clear(): void {
			for (const k of Object.keys(localStorage)) if (k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
		},
	},
	samples: () => samples.map(s => ({ id: s.id, title: s.title })),
	async loadSample(id: string, opts: Options = {}): Promise<PlaygroundState> {
		const sample = samples.find(s => s.id === id);
		if (!sample) throw new Error(`サンプル "${id}" はありません: ${samples.map(s => s.id).join(', ')}`);
		return playgroundApi.run(sample.code, opts);
	},
};

export type PlaygroundApi = typeof playgroundApi;

declare global {
	interface Window {
		__playground: PlaygroundApi;
	}
}

export function installAiBridge() {
	window.__playground = playgroundApi;
	console.info('[Misskey Play Playground] AI 向けの操作 API: window.__playground.help()');
}
