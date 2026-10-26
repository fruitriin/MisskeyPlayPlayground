// ライブ共有: 合言葉の部屋（worker/index.ts の Room）に WebSocket でつなぎ、
// エディタのコードを外部（HTTP の API）と相互に反映する。実行結果も部屋に送る
import { nextTick, reactive, watch } from 'vue';
import { code } from './store.js';
import { getState, playgroundApi } from './aiBridge.js';
import type { Action } from './aiBridge.js';
import { logs, components, running, pendingCallbacks } from './runner.js';
import * as os from './os.js';

const KEY_STORAGE = 'aiscript-playground:live-key';
export const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const live = reactive({
	key: null as string | null,
	status: 'idle' as 'idle' | 'connecting' | 'connected',
	viewers: 0,
	rev: 0,
	lastRemoteAt: null as string | null,
	error: '',
});

let ws: WebSocket | null = null;
let manualClose = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sendTimer: ReturnType<typeof setTimeout> | null = null;
let stateTimer: ReturnType<typeof setTimeout> | null = null;
// 外から来たコードをエディタに入れているあいだは、送り返さない
let applyingRemote = false;
// 外から来たコードを実行中なら true。実行が落ち着くまで、その rev の結果として報告しない
let remoteRunInFlight = false;
// 実行が落ち着いたコードの rev。結果を報告するときに付ける
let settledRev = 0;

export function generateKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

export function savedKey(): string | null {
	try {
		return localStorage.getItem(KEY_STORAGE);
	} catch {
		return null;
	}
}

function send(message: unknown) {
	if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function sendState(rev: number) {
	send({ type: 'state', rev, state: getState({ includeCode: false }) });
}

function scheduleStateReport() {
	if (stateTimer) clearTimeout(stateTimer);
	stateTimer = setTimeout(() => {
		if (live.status !== 'connected' || remoteRunInFlight) return;
		if (!running.value && pendingCallbacks.value === 0) settledRev = live.rev;
		sendState(settledRev);
	}, 300);
}

async function applyRemote(newCode: string, rev: number, run: boolean) {
	live.rev = rev;
	live.lastRemoteAt = new Date().toISOString();
	applyingRemote = true;
	code.value = newCode;
	await nextTick();
	applyingRemote = false;
	if (!run) return;
	remoteRunInFlight = true;
	try {
		await playgroundApi.run(newCode);
	} finally {
		remoteRunInFlight = false;
		settledRev = rev;
		sendState(rev);
	}
}

async function handleMessage(msg: Record<string, unknown>) {
	switch (msg.type) {
		case 'snapshot': {
			live.viewers = msg.viewers as number;
			live.rev = msg.rev as number;
			settledRev = live.rev;
			if (typeof msg.code === 'string' && (msg.rev as number) > 0) {
				// 部屋にコードがあれば、それを開いて実行する
				await applyRemote(msg.code, msg.rev as number, true);
			} else {
				// 空の部屋なら、いまのコードを部屋に入れる
				send({ type: 'code', code: code.value });
			}
			break;
		}
		case 'code':
			await applyRemote(msg.code as string, msg.rev as number, msg.run as boolean);
			break;
		case 'ack':
			live.rev = msg.rev as number;
			scheduleStateReport();
			break;
		case 'viewers':
			live.viewers = msg.viewers as number;
			break;
		case 'act': {
			try {
				const state = await playgroundApi.act(msg.actions as Action | Action[], { timeout: msg.timeout as number });
				send({ type: 'actResult', id: msg.id, ok: true, result: state });
			} catch (err) {
				send({ type: 'actResult', id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) });
			}
			scheduleStateReport();
			break;
		}
	}
}

export function connect(key: string) {
	disconnect();
	manualClose = false;
	live.key = key;
	live.status = 'connecting';
	live.error = '';
	try {
		localStorage.setItem(KEY_STORAGE, key);
	} catch {
		// 保存できなくても接続はできる
	}
	history.replaceState(null, '', `${window.location.pathname}#live=${encodeURIComponent(key)}`);

	const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
	const socket = new WebSocket(`${proto}://${window.location.host}/api/rooms/${encodeURIComponent(key)}/ws`);
	ws = socket;
	socket.onopen = () => {
		live.status = 'connected';
	};
	socket.onmessage = ev => {
		try {
			handleMessage(JSON.parse(ev.data));
		} catch {
			// 壊れたメッセージは無視する
		}
	};
	socket.onerror = () => {
		live.error = '接続できませんでした。少し待ってからつなぎ直します';
	};
	socket.onclose = ev => {
		if (ws !== socket) return;
		ws = null;
		if (manualClose) {
			live.status = 'idle';
			return;
		}
		if (ev.code === 4000) live.error = 'この合言葉の部屋は、使われない期間が続いたため消えました';
		live.status = 'connecting';
		reconnectTimer = setTimeout(() => connect(key), 2000);
	};
}

export function disconnect() {
	manualClose = true;
	if (reconnectTimer) clearTimeout(reconnectTimer);
	reconnectTimer = null;
	const socket = ws;
	ws = null;
	socket?.close();
	live.status = 'idle';
	live.viewers = 0;
	if (window.location.hash.startsWith('#live=')) history.replaceState(null, '', window.location.pathname);
}

// 画面で書き換えたコードを部屋に送る
watch(code, v => {
	if (live.status !== 'connected' || applyingRemote) return;
	if (sendTimer) clearTimeout(sendTimer);
	sendTimer = setTimeout(() => send({ type: 'code', code: v }), 400);
});

// 実行結果や表示が変わったら、部屋に報告する
watch([() => logs.value.length, components, running, pendingCallbacks, () => os.state.dialogs.length, () => os.state.toastHistory.length], scheduleStateReport, { deep: true });

export function joinFromHash() {
	const m = window.location.hash.match(/^#live=([A-Za-z0-9_-]{8,64})$/);
	if (m) connect(decodeURIComponent(m[1]));
}
