// ライブ共有の API。合言葉ごとに Room（Durable Object）を 1 つ持ち、
// ブラウザとは WebSocket で、AI などの外部とは HTTP でやり取りする。
// /api/* 以外のリクエストは静的ファイル（dist/）がそのまま返す（wrangler.jsonc の run_worker_first）
import { DurableObject } from 'cloudflare:workers';

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_CODE_BYTES = 256 * 1024;
const MAX_STATE_BYTES = 1024 * 1024;
// これだけ使われなかった部屋は消す
const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_WAIT_MS = 10_000;
const MAX_WAIT_MS = 60_000;

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
	});
}

function error(status: number, code: string, message: string): Response {
	return json({ error: { code, message } }, status);
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
		if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

		const m = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/(?:ws|state|act))?\/?$/);
		if (!m) return error(404, 'NOT_FOUND', 'API は /api/rooms/<合言葉> の下にあります。使い方は /ai/live-api.md を見てください');
		const key = decodeURIComponent(m[1]);
		if (!KEY_PATTERN.test(key)) return error(400, 'INVALID_KEY', '合言葉は英数字と - _ の 8〜64 文字にしてください');
		if (m[2] === '/ws' && request.headers.get('Upgrade') !== 'websocket') {
			return error(426, 'UPGRADE_REQUIRED', 'WebSocket で接続してください');
		}
		return env.ROOMS.getByName(key).fetch(request);
	},
} satisfies ExportedHandler<Env>;

type ClientMessage =
	| { type: 'code'; code: string }
	| { type: 'state'; rev: number; state: unknown }
	| { type: 'actResult'; id: string; ok: boolean; result?: unknown; error?: string };

type Pending = { resolve: (value: unknown) => void; timer: ReturnType<typeof setTimeout> };

export class Room extends DurableObject<Env> {
	// HTTP のリクエストが、ブラウザからの結果を待っているもの。DO が動いているあいだだけメモリに持つ
	private waitingState = new Map<number, Pending[]>();
	private waitingAct = new Map<string, Pending>();

	private async touch() {
		await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
	}

	async alarm() {
		for (const ws of this.ctx.getWebSockets()) ws.close(4000, 'room expired');
		await this.ctx.storage.deleteAll();
	}

	private async room() {
		const [code, rev, updatedAt, updatedBy] = await Promise.all([
			this.ctx.storage.get<string>('code'),
			this.ctx.storage.get<number>('rev'),
			this.ctx.storage.get<string>('updatedAt'),
			this.ctx.storage.get<string>('updatedBy'),
		]);
		return { code: code ?? null, rev: rev ?? 0, updatedAt: updatedAt ?? null, updatedBy: updatedBy ?? null };
	}

	private async writeCode(code: string, by: 'browser' | 'api'): Promise<number> {
		const rev = ((await this.ctx.storage.get<number>('rev')) ?? 0) + 1;
		await this.ctx.storage.put({ code, rev, updatedAt: new Date().toISOString(), updatedBy: by });
		await this.touch();
		return rev;
	}

	private broadcast(message: unknown, except?: WebSocket) {
		const text = JSON.stringify(message);
		for (const ws of this.ctx.getWebSockets()) {
			if (ws !== except) ws.send(text);
		}
	}

	// 指定した rev（以降）の実行結果がブラウザから届くまで待つ
	private waitForState(rev: number, timeoutMs: number): Promise<unknown> {
		return new Promise(resolve => {
			const entry: Pending = {
				resolve,
				timer: setTimeout(() => {
					const list = this.waitingState.get(rev)?.filter(e => e !== entry) ?? [];
					if (list.length) this.waitingState.set(rev, list);
					else this.waitingState.delete(rev);
					resolve(null);
				}, timeoutMs),
			};
			this.waitingState.set(rev, [...(this.waitingState.get(rev) ?? []), entry]);
		});
	}

	private waitMs(url: URL): number {
		const v = Number(url.searchParams.get('wait') ?? DEFAULT_WAIT_MS / 1000);
		if (!Number.isFinite(v) || v <= 0) return 0;
		return Math.min(v * 1000, MAX_WAIT_MS);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const action = url.pathname.match(/\/(ws|state|act)\/?$/)?.[1] ?? null;
		const viewers = this.ctx.getWebSockets().length;

		if (action === 'ws') {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);
			this.ctx.acceptWebSocket(server);
			await this.touch();
			const room = await this.room();
			server.send(JSON.stringify({ type: 'snapshot', ...room, viewers: viewers + 1 }));
			this.broadcast({ type: 'viewers', viewers: viewers + 1 }, server);
			return new Response(null, { status: 101, webSocket: client });
		}

		if (action === null && request.method === 'GET') {
			return json({ ...(await this.room()), viewers });
		}

		if (action === null && request.method === 'PUT') {
			const type = request.headers.get('Content-Type') ?? '';
			let code: unknown;
			let run = true;
			if (type.includes('application/json')) {
				const body = await request.json<{ code?: unknown; run?: unknown }>().catch(() => null);
				code = body?.code;
				if (body?.run === false) run = false;
			} else {
				code = await request.text();
			}
			if (typeof code !== 'string') return error(400, 'INVALID_BODY', 'コードを本文（text/plain）か JSON の code に入れてください');
			if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) return error(413, 'TOO_LARGE', 'コードは 256KB までです');
			const rev = await this.writeCode(code, 'api');
			this.broadcast({ type: 'code', code, rev, run, by: 'api' });
			const wait = run && viewers > 0 ? this.waitMs(url) : 0;
			const state = wait ? await this.waitForState(rev, wait) : null;
			return json({ rev, viewers, run, state, ...(wait && state === null ? { timedOut: true } : {}) });
		}

		if (action === 'state' && request.method === 'GET') {
			const [state, stateRev, stateAt] = await Promise.all([
				this.ctx.storage.get('state'),
				this.ctx.storage.get<number>('stateRev'),
				this.ctx.storage.get<string>('stateAt'),
			]);
			const { rev } = await this.room();
			return json({ rev, stateRev: stateRev ?? null, stateAt: stateAt ?? null, viewers, state: state ?? null });
		}

		if (action === 'act' && request.method === 'POST') {
			const body = await request.json<{ actions?: unknown; timeout?: unknown }>().catch(() => null);
			if (!body || body.actions == null) return error(400, 'INVALID_BODY', '{ "actions": [...] } の形で送ってください');
			// 操作は 1 つのブラウザにだけ頼む（複数で同時に押すと結果がずれるため）
			const target = this.ctx.getWebSockets()[0];
			if (!target) return error(409, 'NO_VIEWER', 'この合言葉の画面を開いているブラウザがありません');
			const id = crypto.randomUUID();
			const timeoutMs = Math.min(typeof body.timeout === 'number' ? body.timeout : 5000, MAX_WAIT_MS - 1000);
			type ActResult = { ok: boolean; result?: unknown; error?: string };
			const result = await new Promise<ActResult>(resolve => {
				const timer = setTimeout(() => {
					this.waitingAct.delete(id);
					resolve({ ok: false, error: 'ブラウザから結果が返ってきませんでした' });
				}, timeoutMs + 5000);
				this.waitingAct.set(id, { resolve: v => resolve(v as ActResult), timer });
				target.send(JSON.stringify({ type: 'act', id, actions: body.actions, timeout: timeoutMs }));
			});
			await this.touch();
			return result.ok ? json({ state: result.result }) : error(422, 'ACT_FAILED', result.error ?? '操作に失敗しました');
		}

		return error(405, 'METHOD_NOT_ALLOWED', 'GET・PUT /api/rooms/<合言葉>、GET .../state、POST .../act が使えます');
	}

	async webSocketMessage(ws: WebSocket, raw: ArrayBuffer | string) {
		if (typeof raw !== 'string') return;
		let msg: ClientMessage;
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}
		if (msg.type === 'code' && typeof msg.code === 'string') {
			if (new TextEncoder().encode(msg.code).length > MAX_CODE_BYTES) return;
			const rev = await this.writeCode(msg.code, 'browser');
			ws.send(JSON.stringify({ type: 'ack', rev }));
			this.broadcast({ type: 'code', code: msg.code, rev, run: false, by: 'browser' }, ws);
		} else if (msg.type === 'state') {
			if (raw.length > MAX_STATE_BYTES) return;
			await this.ctx.storage.put({ state: msg.state, stateRev: msg.rev, stateAt: new Date().toISOString() });
			for (const [rev, list] of this.waitingState) {
				if (rev <= msg.rev) {
					for (const p of list) {
						clearTimeout(p.timer);
						p.resolve(msg.state);
					}
					this.waitingState.delete(rev);
				}
			}
		} else if (msg.type === 'actResult') {
			const p = this.waitingAct.get(msg.id);
			if (p) {
				clearTimeout(p.timer);
				this.waitingAct.delete(msg.id);
				p.resolve({ ok: msg.ok, result: msg.result, error: msg.error });
			}
		}
	}

	async webSocketClose(ws: WebSocket) {
		this.broadcast({ type: 'viewers', viewers: this.ctx.getWebSockets().filter(w => w !== ws).length }, ws);
	}
}
