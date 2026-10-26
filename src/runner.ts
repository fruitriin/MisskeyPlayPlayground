// AiScript を実行し、UI 部品とログを集める
import { ref, shallowRef } from 'vue';
import { utils as utils1 } from '@syuilo/aiscript';
import type { Interpreter } from '@syuilo/aiscript';
import type { Ref } from 'vue';
import { registerAsUiLib } from './aiscript/ui.js';
import type { AsUiComponent, AsUiRoot } from './aiscript/ui.js';
import { aiScriptReadline, createAiScriptEnv } from './aiscript/api.js';
import { effectiveServerUrl, callApi, apiCallListeners } from './settings.js';
import * as os from './os.js';

export type LogEntry = {
	id: number;
	type: 'print' | 'end' | 'error' | 'info';
	text: string;
	time: Date;
};

let logId = 0;

export const logs = ref<LogEntry[]>([]);
export const root = ref<AsUiRoot>();
export const components = ref<Ref<AsUiComponent>[]>([]);
// 実行のたびに増やし、プレビューを作り直すための key に使う
export const runKey = ref(0);
export const running = ref(false);
export const usedVersion = ref<string>('');

const interpreter = shallowRef<Interpreter | null>(null);

// 実行中の UI コールバック（onClick など）の数。AI 向けの操作 API が完了を待つのに使う
export const pendingCallbacks = ref(0);

export function trackCallback(p: Promise<unknown> | undefined): void {
	if (!p) return;
	pendingCallbacks.value++;
	p.finally(() => {
		pendingCallbacks.value--;
	});
}

function pushLog(type: LogEntry['type'], text: string) {
	logs.value.push({ id: logId++, type, text, time: new Date() });
}

function compareVersions(a: string, b: string): number {
	const pa = a.split(/[.-]/).map(x => parseInt(x, 10) || 0);
	const pb = b.split(/[.-]/).map(x => parseInt(x, 10) || 0);
	for (let i = 0; i < 3; i++) {
		if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
	}
	return 0;
}

let emojiCache: { server: string; emojis: unknown[] } | null = null;

// MFM の表示に使う、絵文字名から絵文字情報への対応表
export const customEmojiMap = ref<Record<string, { url: string }>>({});

function updateEmojiMap(emojis: unknown[]) {
	customEmojiMap.value = Object.fromEntries(
		(emojis as { name: string; url: string }[]).map(e => [e.name, e]),
	);
}

async function loadCustomEmojis(): Promise<unknown[]> {
	const server = effectiveServerUrl();
	if (server == null) {
		updateEmojiMap([]);
		return [];
	}
	if (emojiCache?.server === server) return emojiCache.emojis;
	try {
		const res = await callApi('emojis', {}, null) as { emojis: unknown[] };
		emojiCache = { server, emojis: res.emojis };
		updateEmojiMap(res.emojis);
		return res.emojis;
	} catch {
		updateEmojiMap([]);
		return [];
	}
}

// Mk:api の呼び出しをコンソールに出す
apiCallListeners.add((endpoint, _params, result) => {
	if (!running.value && !interpreter.value) return;
	pushLog('info', `Mk:api ${endpoint} → ${result.ok ? 'OK' : `エラー: ${typeof result.body === 'string' ? result.body : JSON.stringify(result.body)}`}`);
});

export function stop() {
	if (interpreter.value) {
		interpreter.value.abort();
		interpreter.value = null;
		pushLog('info', '停止しました');
	}
	running.value = false;
	os.closeAllDialogs();
}

export function clearLogs() {
	logs.value = [];
}

export async function run(code: string) {
	if (interpreter.value) interpreter.value.abort();
	os.closeAllDialogs();
	root.value = undefined;
	components.value = [];
	runKey.value++;
	logs.value = [];
	pendingCallbacks.value = 0;
	os.state.toastHistory = [];

	// 本家の Play と同じく、0.x 系の書き方なら 0.19.0 の処理系で動かす
	// Misskey Play と同じく、1 行目に `/// @ バージョン` がなければ 0.19.0 で実行する
	const version = utils1.getLangVersion(code);
	const isLegacy = version == null || compareVersions(version, '1.0.0') < 0;
	const { Interpreter, Parser, values, utils } = (isLegacy
		? await import('@syuilo/aiscript-0-19-0')
		: await import('@syuilo/aiscript')) as typeof import('@syuilo/aiscript');
	usedVersion.value = isLegacy ? '0.19.0' : '1.2.1';
	if (version == null) {
		pushLog('info', '1 行目に `/// @ 1.2.1` がないため、Misskey Play と同じく AiScript 0.19.0 で実行しました');
	}

	const customEmojis = await loadCustomEmojis();
	const pageUrl = window.location.origin + window.location.pathname;

	const aiscript = new Interpreter({
		...createAiScriptEnv({ storageKey: 'playground', customEmojis }),
		...registerAsUiLib(components.value, (_root) => {
			root.value = _root.value;
		}),
		THIS_ID: values.STR('playground'),
		THIS_URL: values.STR(pageUrl),
	}, {
		in: aiScriptReadline,
		out: (value) => {
			pushLog('print', value.type === 'str' ? value.value : utils.valToString(value));
		},
		err: (err) => {
			pushLog('error', String(err));
			running.value = false;
		},
		log: (type, params) => {
			if (type === 'end' && params.val) {
				pushLog('end', utils.valToString(params.val as never, true));
			}
		},
	});
	interpreter.value = aiscript;

	let ast;
	try {
		ast = new Parser().parse(code);
	} catch (err) {
		pushLog('error', `Syntax Error: ${String(err)}`);
		return;
	}

	running.value = true;
	try {
		await aiscript.exec(ast);
	} catch (err) {
		// 処理系自体の不具合に備える
		pushLog('error', `AiScript Internal Error: ${String(err)}`);
	} finally {
		// コールバックを登録したまま終わっても、トップレベルの実行は完了している
		if (interpreter.value === aiscript) running.value = false;
	}
}
