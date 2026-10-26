<template>
<div :class="$style.backdrop" @click.self="emit('close')">
	<article :class="$style.panel">
		<div :class="$style.header">
			<span>ガイド</span>
			<button type="button" :class="$style.close" aria-label="閉じる" @click="emit('close')">✕</button>
		</div>
		<!-- docs/guide/minigame.md は自前の文書なので、そのまま HTML にして表示する -->
		<div :class="$style.body" @click="onClick" v-html="html"/>
	</article>
</div>
</template>

<script lang="ts" setup>
import { marked } from 'marked';
import guideSource from '../../docs/guide/minigame.md?raw';

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'run', code: string): void;
	(e: 'sample', id: string): void;
}>();

const examples = import.meta.glob<string>('../../docs/guide/examples/*.ais', { query: '?raw', import: 'default', eager: true });

function exampleCode(id: string): string {
	return examples[`../../docs/guide/examples/${id}.ais`] ?? `// 例 "${id}" が見つかりません`;
}

// {{example:名前}} は docs/guide/examples/名前.ais のコードと実行ボタンに、{{open:サンプルの id}} はサンプルを開くボタンにする。
// コードは Markdown のコードブロックとして渡す（HTML のまま埋め込むと、空行で HTML のブロックが終わってしまう）
const markdown = guideSource
	.replace(/\{\{example:(\w+)\}\}/g, (_, id: string) => {
		const code = exampleCode(id);
		const fence = '`'.repeat(Math.max(3, ...[...code.matchAll(/`+/g)].map(m => m[0].length + 1)));
		return `${fence}aiscript\n${code.trimEnd()}\n${fence}\n\n<div class="guide-example"><button type="button" data-run-example="${id}">▶ エディタで開いて実行</button></div>`;
	})
	.replace(/\{\{open:(\w+)\}\}/g, (_, id: string) => `<div class="guide-example guide-open"><button type="button" data-open-sample="${id}">▶ エディタで開いて遊ぶ</button></div>`);

const html = marked.parse(markdown, { async: false });

function onClick(ev: MouseEvent) {
	const target = ev.target as HTMLElement;
	const run = target.closest<HTMLElement>('[data-run-example]');
	if (run) {
		emit('run', exampleCode(run.dataset.runExample!));
		return;
	}
	const open = target.closest<HTMLElement>('[data-open-sample]');
	if (open) emit('sample', open.dataset.openSample!);
}
</script>

<style module>
.backdrop { position: fixed; inset: 0; z-index: 90; display: flex; justify-content: flex-end; background: rgba(0, 0, 0, 0.35); }
.panel { display: flex; flex-direction: column; width: 100%; max-width: 720px; height: 100%; color: var(--fg); background: var(--panel); box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2); }
.header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; font-weight: bold; border-bottom: solid 1px var(--divider); }
.close { font: inherit; color: var(--fg); background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.close:hover { background: var(--buttonBg); }
.body { flex: 1; overflow: auto; padding: 8px 24px 40px; line-height: 1.8; }
.body :global(h1) { font-size: 1.5em; margin: 16px 0 8px; }
.body :global(h2) { font-size: 1.2em; margin: 32px 0 8px; padding-bottom: 4px; border-bottom: solid 1px var(--divider); }
.body :global(h3) { font-size: 1.05em; margin: 24px 0 4px; }
.body :global(code) { padding: 0.1em 0.3em; font-family: Fira Code, Menlo, monospace; font-size: 0.9em; background: var(--buttonBg); border-radius: 4px; }
.body :global(pre) { margin: 12px 0 0; padding: 12px; tab-size: 2; overflow: auto; background: var(--editorBg); border: solid 1px var(--divider); border-radius: 8px 8px 0 0; line-height: 1.5; }
.body :global(pre code) { padding: 0; background: none; font-size: 13px; }
.body :global(a) { color: var(--accent); }
.body :global(.guide-example) { margin: 0 0 20px; }
.body :global(.guide-open) { margin-top: 12px; }
.body :global(.guide-example button) {
	display: block;
	width: 100%;
	padding: 8px;
	font: inherit;
	font-weight: bold;
	color: var(--fgOnAccent);
	background: var(--accent);
	border: none;
	border-radius: 0 0 8px 8px;
	cursor: pointer;
}
.body :global(.guide-open button) { border-radius: 8px; }
.body :global(.guide-example button:hover) { background: var(--accentLighten); }
@media (max-width: 760px) {
	.body { padding: 8px 16px 32px; }
}
</style>
