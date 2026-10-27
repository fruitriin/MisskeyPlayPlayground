// 接続先サーバーやダミーユーザーなど、AiScript の実行環境に渡す設定
import { reactive, watch } from 'vue';
import { mockApi, MockApiError, MOCK_SERVER_URL } from './mock/api.js';

const KEY = 'aiscript-playground:settings';

export type Settings = {
	// mock: 同梱のモック API を使う / server: serverUrl の実サーバーを使う
	apiMode: 'mock' | 'server';
	serverUrl: string;
	token: string;
	locale: string;
	dummyUser: { id: string; name: string; username: string };
	dark: 'auto' | 'light' | 'dark';
	// MFM の中の絵文字の描き方。Misskey の既定は twemoji
	emojiStyle: 'twemoji' | 'native';
};

const defaults: Settings = {
	apiMode: 'mock',
	serverUrl: '',
	token: '',
	locale: 'ja-JP',
	dummyUser: { id: '9xxxxxxxxx', name: 'Playground User', username: 'playground' },
	dark: 'auto',
	emojiStyle: 'twemoji',
};

function load(): Settings {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return { ...defaults, ...JSON.parse(raw) };
	} catch {
		// 壊れた設定は無視して既定値を使う
	}
	return structuredClone(defaults);
}

export const settings = reactive<Settings>(load());

watch(settings, () => {
	try {
		localStorage.setItem(KEY, JSON.stringify(settings));
	} catch {
		// 保存できない環境では何もしない
	}
}, { deep: true });

// API 呼び出しを記録したい側（コンソール表示など）が登録する
export const apiCallListeners = new Set<(endpoint: string, params: Record<string, unknown>, result: { ok: boolean; body: unknown }) => void>();

export function isMock(): boolean {
	return settings.apiMode === 'mock';
}

/** 実サーバーの URL。モック利用中や未設定なら null */
export function normalizedServerUrl(): string | null {
	if (isMock()) return null;
	const url = settings.serverUrl.trim().replace(/\/+$/, '');
	if (url === '') return null;
	return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

/** AiScript から見えるサーバーの URL（モックならモックの URL） */
export function effectiveServerUrl(): string | null {
	return isMock() ? MOCK_SERVER_URL : normalizedServerUrl();
}

export async function callApi(endpoint: string, params: Record<string, unknown>, token?: string | null): Promise<unknown> {
	try {
		const body = await (isMock() ? callMockApi(endpoint, params) : callServerApi(endpoint, params, token));
		for (const l of apiCallListeners) l(endpoint, params, { ok: true, body });
		return body;
	} catch (err) {
		for (const l of apiCallListeners) l(endpoint, params, { ok: false, body: err instanceof Error ? err.message : err });
		throw err;
	}
}

async function callMockApi(endpoint: string, params: Record<string, unknown>): Promise<unknown> {
	try {
		return await mockApi(endpoint, params);
	} catch (err) {
		// 実サーバーと同じく、エラー内容のオブジェクトを投げる
		if (err instanceof MockApiError) throw err.body;
		throw err;
	}
}

async function callServerApi(endpoint: string, params: Record<string, unknown>, token?: string | null): Promise<unknown> {
	const server = normalizedServerUrl();
	if (server == null) throw new Error('接続先サーバーが設定されていません（⚙ 設定から指定できます）');
	const i = token ?? (settings.token || null);
	const res = await fetch(`${server}/api/${endpoint}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(i ? { ...params, i } : params),
	});
	if (res.status === 204) return null;
	const body = await res.json();
	if (!res.ok) throw body.error ?? body;
	return body;
}
