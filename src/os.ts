// Misskey の os.ts の代わりに、ダイアログ・トースト・投稿フォームを提供する
import { reactive } from 'vue';
import type { noteVisibilities } from './aiscript/ui.js';

export type DialogType = 'error' | 'info' | 'success' | 'warning' | 'waiting' | 'question';

export type PostFormInit = {
	initialText?: string;
	initialCw?: string;
	initialVisibility?: (typeof noteVisibilities)[number];
	initialLocalOnly?: boolean;
};

export type Dialog =
	| { id: number; kind: 'alert'; type: DialogType; title?: string; text?: string; resolve: () => void }
	| { id: number; kind: 'confirm'; type: DialogType; title?: string; text?: string; resolve: (ok: boolean) => void }
	| { id: number; kind: 'input'; title?: string; resolve: (v: string | null) => void }
	| { id: number; kind: 'post'; form: PostFormInit; resolve: () => void };

let nextId = 0;

export const state = reactive({
	dialogs: [] as Dialog[],
	toasts: [] as { id: number; text: string }[],
	// 表示し終わったものも含めた、最近のトースト（AI 向けの操作 API が返す）
	toastHistory: [] as { text: string; time: string }[],
});

function push<T>(make: (resolve: (v: T) => void) => Dialog): Promise<T> {
	return new Promise<T>(resolve => {
		const d = make((v: T) => {
			state.dialogs = state.dialogs.filter(x => x.id !== d.id);
			resolve(v);
		});
		state.dialogs.push(d);
	});
}

export function alert(opts: { type?: DialogType; title?: string; text?: string }): Promise<void> {
	return push<void>(resolve => ({ id: nextId++, kind: 'alert', type: opts.type ?? 'info', title: opts.title, text: opts.text, resolve }));
}

export async function confirm(opts: { type?: DialogType; title?: string; text?: string }): Promise<{ canceled: boolean }> {
	const ok = await push<boolean>(resolve => ({ id: nextId++, kind: 'confirm', type: opts.type ?? 'question', title: opts.title, text: opts.text, resolve }));
	return { canceled: !ok };
}

export async function inputText(opts: { title?: string }): Promise<{ result: string | null }> {
	const result = await push<string | null>(resolve => ({ id: nextId++, kind: 'input', title: opts.title, resolve }));
	return { result };
}

export function post(form: PostFormInit): Promise<void> {
	return push<void>(resolve => ({ id: nextId++, kind: 'post', form, resolve }));
}

export function toast(text: string) {
	const id = nextId++;
	state.toasts.push({ id, text });
	state.toastHistory.push({ text, time: new Date().toISOString() });
	if (state.toastHistory.length > 20) state.toastHistory.shift();
	setTimeout(() => {
		state.toasts = state.toasts.filter(t => t.id !== id);
	}, 4000);
}

export function closeAllDialogs() {
	for (const d of [...state.dialogs]) {
		if (d.kind === 'confirm') d.resolve(false);
		else if (d.kind === 'input') d.resolve(null);
		else d.resolve();
	}
}
