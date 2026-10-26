// AI や自動テストが、ブラウザ上の playground を JSON で読み書き・操作するための API。
// window.__playground に置く。使い方は docs/ai/browser-api.md と help() を参照
import { nextTick } from 'vue';
import { code } from './store.js';
import { run, stop, logs, root, components, running, usedVersion, pendingCallbacks, trackCallback } from './runner.js';
import { allSamples as samples } from './allSamples.js';
import { settings } from './settings.js';
import * as os from './os.js';
import type { AsUiComponent } from './aiscript/ui.js';

export type UiNode = {
	id: string;
	type: string;
	hidden?: boolean;
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

const HELP = `window.__playground: AiScript Playground を JSON で操作する API

getState({ includeCode? })   いまの状態（ログ・UI ツリー・ダイアログ・トースト）を返す
getCode() / setCode(code)    エディタのコードを読む・書く（setCode は実行しない）
run(code?, { timeout? })     コードを実行し、落ち着いたら状態を返す（code を省くとエディタのコード）
stop()                       実行を止める
act(action | action[])       UI を操作し、コールバックが終わったら状態を返す
samples() / loadSample(id)   サンプルの一覧・読み込みと実行

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
			props.buttons = v.map((b: Record<string, unknown>) => Object.fromEntries(Object.entries(b).filter(([, x]) => typeof x !== 'function')));
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
	const node: UiNode = { id: c.id, type: c.type, props, handlers };
	if (c.hidden) node.hidden = true;
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
		toasts: os.state.toastHistory.slice(-10),
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

export const playgroundApi = {
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
		let state = getState({ includeCode: false });
		for (const action of list) {
			perform(action);
			state = await settle(action.type === 'wait' ? sleep(action.ms) : null, opts);
		}
		return state;
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
	console.info('[AiScript Playground] AI 向けの操作 API: window.__playground.help()');
}
