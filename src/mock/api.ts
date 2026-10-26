// ブラウザの中だけで動く Misskey API のモック。
// よく使うエンドポイントについて、Misskey と同じ形のレスポンスを返す
import { settings } from '@/settings.js';

export const MOCK_SERVER_URL = 'https://mock.misskey.invalid';

type User = {
	id: string;
	name: string | null;
	username: string;
	host: string | null;
	avatarUrl: string;
	isBot: boolean;
	isCat: boolean;
	emojis: Record<string, string>;
	onlineStatus: 'online' | 'active' | 'offline' | 'unknown';
};

type Note = {
	id: string;
	createdAt: string;
	userId: string;
	user: User;
	text: string | null;
	cw: string | null;
	visibility: 'public' | 'home' | 'followers' | 'specified';
	localOnly: boolean;
	renoteCount: number;
	repliesCount: number;
	reactions: Record<string, number>;
	reactionEmojis: Record<string, string>;
	myReaction?: string | null;
	fileIds: string[];
	files: unknown[];
	replyId: string | null;
	renoteId: string | null;
	tags?: string[];
};

export class MockApiError extends Error {
	constructor(public body: { message: string; code: string; id: string; kind: 'client' | 'server'; info?: unknown }) {
		super(body.message);
	}
}

function svgDataUrl(text: string, bg: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/><text x="32" y="42" font-size="30" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">${text}</text></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const emojis = [
	{ name: 'misskey', category: 'misskey', aliases: ['mi'], text: 'Mi', bg: '#86b300' },
	{ name: 'aiscript', category: 'misskey', aliases: ['as'], text: 'AS', bg: '#3aa2dc' },
	{ name: 'ai_kawaii', category: 'ai', aliases: ['kawaii'], text: '藍', bg: '#e96e9a' },
	{ name: 'blobcat', category: 'cat', aliases: ['cat'], text: '🐱', bg: '#ffb300' },
	{ name: 'thinking_ai', category: 'ai', aliases: ['think'], text: '?', bg: '#8e6bd8' },
	{ name: 'good', category: 'reaction', aliases: ['iine'], text: '👍', bg: '#ff9156' },
].map(e => ({
	name: e.name,
	category: e.category,
	aliases: e.aliases,
	url: svgDataUrl(e.text, e.bg),
	isSensitive: false,
	roleIdsThatCanBeUsedThisEmojiAsReaction: [],
}));

let seq = 0;
function genId(): string {
	return (Date.now().toString(36) + (seq++).toString(36).padStart(4, '0')).slice(-12);
}

function makeUser(id: string, username: string, name: string, color: string): User {
	return {
		id,
		name,
		username,
		host: null,
		avatarUrl: svgDataUrl(name.slice(0, 1), color),
		isBot: false,
		isCat: false,
		emojis: {},
		onlineStatus: 'online',
	};
}

function me(): User {
	const u = settings.dummyUser;
	return makeUser(u.id || 'mockme000000', u.username || 'playground', u.name || u.username || 'Playground User', '#86b300');
}

const otherUsers: User[] = [
	makeUser('mockai000001', 'ai', '藍', '#e96e9a'),
	makeUser('mocksyu00002', 'syuilo', 'しゅいろ', '#3aa2dc'),
	makeUser('mockneko0003', 'neko', 'ねこ', '#ffb300'),
];
otherUsers[2].isCat = true;

function allUsers(): User[] {
	return [me(), ...otherUsers];
}

function findUser(params: Record<string, unknown>): User {
	const user = allUsers().find(u => u.id === params.userId || (params.username != null && u.username === params.username));
	if (!user) throw new MockApiError({ message: 'No such user.', code: 'NO_SUCH_USER', id: '4362f8dc-731f-4ad8-a694-be5a88922a24', kind: 'client' });
	return user;
}

const notes: Note[] = [];

function addNote(user: User, text: string, extra: Partial<Note> = {}, minutesAgo = 0): Note {
	const note: Note = {
		id: genId(),
		createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
		userId: user.id,
		user,
		text,
		cw: null,
		visibility: 'public',
		localOnly: false,
		renoteCount: 0,
		repliesCount: 0,
		reactions: {},
		reactionEmojis: {},
		myReaction: null,
		fileIds: [],
		files: [],
		replyId: null,
		renoteId: null,
		...extra,
	};
	note.tags = [...(note.text ?? '').matchAll(/#(\S+)/g)].map(m => m[1]);
	notes.unshift(note);
	return note;
}

addNote(otherUsers[1], 'Misskey Play では AiScript で小さなアプリが作れます #misskey', { reactions: { '👍': 3, ':misskey:': 2 } }, 90);
addNote(otherUsers[0], 'こんにちは、藍です。今日もがんばりましょう！ :ai_kawaii:', { reactions: { '❤': 5 } }, 45);
addNote(otherUsers[2], 'にゃーん $[tada 🐟]', { reactions: { ':blobcat:': 4 } }, 20);
addNote(otherUsers[1], '$[x2 **AiScript**] 1.2.1 で動いています', {}, 5);

function findNote(noteId: unknown): Note {
	const note = notes.find(n => n.id === noteId);
	if (!note) throw new MockApiError({ message: 'No such note.', code: 'NO_SUCH_NOTE', id: '24fcbfc6-2e37-42b6-8388-c29b3861a08d', kind: 'client' });
	return note;
}

function paginate<T extends { id: string }>(items: T[], params: Record<string, unknown>): T[] {
	let list = items;
	if (typeof params.untilId === 'string') list = list.filter(x => x.id < (params.untilId as string));
	if (typeof params.sinceId === 'string') list = list.filter(x => x.id > (params.sinceId as string));
	const limit = typeof params.limit === 'number' ? Math.min(Math.max(params.limit, 1), 100) : 10;
	return list.slice(0, limit);
}

function snapshot(note: Note): Note {
	return structuredClone(note);
}

const handlers: Record<string, (params: Record<string, unknown>) => unknown> = {
	meta: () => ({
		maintainerName: 'Playground',
		maintainerEmail: null,
		version: '2025.10.0-mock',
		name: 'Mock Misskey',
		shortName: null,
		uri: MOCK_SERVER_URL,
		description: 'AiScript Playground に同梱しているモックの Misskey サーバーです。ブラウザの中だけで動いています。',
		langs: ['ja'],
		disableRegistration: true,
		emailRequiredForSignup: false,
		maxNoteTextLength: 3000,
		iconUrl: null,
		themeColor: '#86b300',
		features: { localTimeline: true, globalTimeline: true, miauth: true },
	}),
	emojis: () => ({ emojis }),
	'emoji': (params) => {
		const e = emojis.find(x => x.name === params.name);
		if (!e) throw new MockApiError({ message: 'No such emoji.', code: 'NO_SUCH_EMOJI', id: '6a5e3be7-5ac3-44a6-a425-9937cd66f8e3', kind: 'client' });
		return e;
	},
	i: () => ({ ...me(), followersCount: 3, followingCount: 3, notesCount: notes.filter(n => n.userId === me().id).length, description: 'AiScript Playground のダミーユーザーです。' }),
	'users/show': (params) => {
		const user = findUser(params);
		return { ...user, followersCount: 10, followingCount: 5, notesCount: notes.filter(n => n.userId === user.id).length, description: null };
	},
	'users/notes': (params) => {
		const user = findUser(params);
		return paginate(notes.filter(n => n.userId === user.id), params).map(snapshot);
	},
	'users/search': (params) => {
		const q = String(params.query ?? '').toLowerCase();
		return allUsers().filter(u => u.username.includes(q) || (u.name ?? '').toLowerCase().includes(q));
	},
	'users/search-by-username-and-host': (params) => allUsers().filter(u => params.username == null || u.username.startsWith(String(params.username))),
	'notes/timeline': (params) => paginate(notes, params).map(snapshot),
	'notes/local-timeline': (params) => paginate(notes.filter(n => n.visibility === 'public'), params).map(snapshot),
	'notes/hybrid-timeline': (params) => paginate(notes, params).map(snapshot),
	'notes/global-timeline': (params) => paginate(notes.filter(n => n.visibility === 'public'), params).map(snapshot),
	'notes/search': (params) => paginate(notes.filter(n => (n.text ?? '').includes(String(params.query ?? ''))), params).map(snapshot),
	'notes/search-by-tag': (params) => paginate(notes.filter(n => n.tags?.includes(String(params.tag ?? ''))), params).map(snapshot),
	'notes/show': (params) => snapshot(findNote(params.noteId)),
	'notes/create': (params) => {
		const text = typeof params.text === 'string' ? params.text : null;
		if ((text == null || text.trim() === '') && params.renoteId == null) {
			throw new MockApiError({ message: 'Content required. You need to set text, fileIds, renoteId or poll.', code: 'CONTENT_REQUIRED', id: '6f57e42b-c348-439b-bc45-993995cc515a', kind: 'client' });
		}
		const note = addNote(me(), text ?? '', {
			cw: typeof params.cw === 'string' ? params.cw : null,
			visibility: (['public', 'home', 'followers', 'specified'] as const).find(v => v === params.visibility) ?? 'public',
			localOnly: params.localOnly === true,
			replyId: typeof params.replyId === 'string' ? params.replyId : null,
			renoteId: typeof params.renoteId === 'string' ? params.renoteId : null,
		});
		return { createdNote: snapshot(note) };
	},
	'notes/delete': (params) => {
		const note = findNote(params.noteId);
		if (note.userId !== me().id) throw new MockApiError({ message: 'Access denied.', code: 'ACCESS_DENIED', id: 'fe8d7103-0ea8-4ec3-814d-f8b401dc69e9', kind: 'client' });
		notes.splice(notes.indexOf(note), 1);
		return null;
	},
	'notes/reactions/create': (params) => {
		const note = findNote(params.noteId);
		const reaction = String(params.reaction ?? '👍');
		if (note.myReaction) throw new MockApiError({ message: 'You are already reacting to this note.', code: 'ALREADY_REACTED', id: '71efcf98-86d6-4e2b-b2ad-9d032369366b', kind: 'client' });
		note.reactions[reaction] = (note.reactions[reaction] ?? 0) + 1;
		note.myReaction = reaction;
		return null;
	},
	'notes/reactions/delete': (params) => {
		const note = findNote(params.noteId);
		if (!note.myReaction) throw new MockApiError({ message: 'You are not reacting to that note.', code: 'NOT_REACTED', id: '92f4426d-4196-4125-aa5b-02943e2ec8fc', kind: 'client' });
		const r = note.myReaction;
		note.reactions[r] -= 1;
		if (note.reactions[r] <= 0) delete note.reactions[r];
		note.myReaction = null;
		return null;
	},
	'notes/reactions': (params) => {
		const note = findNote(params.noteId);
		return Object.entries(note.reactions).flatMap(([type, count]) => Array.from({ length: count }, (_, i) => ({
			id: `${note.id}-${type}-${i}`,
			createdAt: note.createdAt,
			user: allUsers()[i % allUsers().length],
			type,
		})));
	},
	'i/notifications': () => [],
	'drive/files': () => [],
	'following/create': (params) => findUser(params),
	'following/delete': (params) => findUser(params),
};

export const mockEndpoints = Object.keys(handlers).sort();

export async function mockApi(endpoint: string, params: Record<string, unknown>): Promise<unknown> {
	// 通信しているように見せるため、少しだけ待つ
	await new Promise(r => setTimeout(r, 80));
	const handler = handlers[endpoint];
	if (!handler) {
		throw new MockApiError({
			message: 'No such endpoint.',
			code: 'NO_SUCH_ENDPOINT',
			id: '7ef1a8da-6ec5-4ff9-a5b3-8f02fcca2b74',
			kind: 'client',
			info: `モックが対応しているのは ${mockEndpoints.join(', ')} です`,
		});
	}
	return handler(params);
}
