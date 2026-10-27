<template>
<div :class="$style.backdrop" @click.self="emit('close')">
	<div :class="$style.panel">
		<div :class="$style.header">
			<span>🤖 AI と一緒に作る</span>
			<button type="button" :class="$style.close" aria-label="閉じる" @click="emit('close')">✕</button>
		</div>
		<div :class="$style.body">
			<p :class="$style.lead">
				このサイトでは、AiScript に加えて Misskey Play 固有の API（<code>Ui:</code>・<code>Mk:</code>・定数）がそのまま使えます。そして、人だけでなく <b>AI からも使えるように作っています</b>。AI に Misskey Play のコードを書いてもらい、この画面で動きを確かめられます。
				AI 向けの資料（文法・Play の関数・間違えやすい点・サンプル）をサイトに置いてあるので、AI は資料を読んでから書き始められます。
			</p>

			<section :class="$style.way">
				<h3>1. チャットの AI に頼む</h3>
				<p>いちばん手軽な方法です。次の文章の「〇〇」を書き換えて AI に渡し、返ってきたコードをエディタに貼り付けて実行します。</p>
				<pre :class="$style.pre">{{ chatPrompt }}</pre>
				<div :class="$style.row"><XButton small inline @click="copy(chatPrompt)">コピー</XButton></div>
			</section>

			<section :class="$style.way">
				<h3>2. ライブ共有で、AI にこの画面を動かしてもらう</h3>
				<p>
					コマンドを実行できる AI（Claude Code など）向けの方法です。合言葉を決めてつなぐと、AI が HTTP でこの画面にコードを送り、実行結果を見て、ボタンを押して確かめながら作ってくれます。
					あなたは画面で作っている途中を眺められ、自分で直したところも AI に伝わります。
				</p>
				<div :class="$style.row"><XButton primary small inline @click="emit('openLive')">🔗 ライブ共有を始める</XButton></div>
			</section>

			<section :class="$style.way">
				<h3>3. ブラウザを操作できる AI に任せる</h3>
				<p>
					ブラウザを操作できる AI（Playwright や、ブラウザの拡張機能で動く AI など）は、このページの <code>window.__playground</code> で、コードの実行や UI の操作を JSON でできます。
				</p>
			</section>

			<section :class="$style.way">
				<h3>AI 向けの資料</h3>
				<ul :class="$style.links">
					<li><a :href="`${base}llms.txt`" target="_blank" rel="noopener">llms.txt</a>（資料の入口。AI にはまずこれを読ませてください）</li>
					<li><a :href="`${base}ai/tips.md`" target="_blank" rel="noopener">間違えやすい点（tips.md）</a></li>
					<li><a :href="`${base}ai/minigame.md`" target="_blank" rel="noopener">ミニゲームの作り方（minigame.md）</a></li>
					<li><a :href="`${base}ai/mfm-layout.md`" target="_blank" rel="noopener">画面づくり・重ねるウィンドウ・演出（mfm-layout.md）</a></li>
					<li><a :href="`${base}ai/live-api.md`" target="_blank" rel="noopener">ライブ共有の API（live-api.md）</a></li>
					<li><a :href="`${base}ai/browser-api.md`" target="_blank" rel="noopener">ブラウザ操作の API（browser-api.md）</a></li>
				</ul>
			</section>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import XButton from './ui/XButton.vue';
import * as os from '@/os.js';

const emit = defineEmits<{ (e: 'close'): void; (e: 'openLive'): void }>();

const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
const chatPrompt = `${base}llms.txt を読み、そこからたどれる資料（特に tips.md と minigame.md）を確認してから、Misskey Play で動く「〇〇」を AiScript で作ってください。
コードの 1 行目は /// @ 1.2.1 にしてください。`;

async function copy(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		os.toast('コピーしました');
	} catch {
		os.alert({ type: 'info', text });
	}
}
</script>

<style module>
.backdrop { position: fixed; inset: 0; z-index: 90; display: flex; justify-content: flex-end; background: rgba(0, 0, 0, 0.35); }
.panel { display: flex; flex-direction: column; width: 100%; max-width: 600px; height: 100%; color: var(--fg); background: var(--panel); box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2); }
.header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; font-weight: bold; border-bottom: solid 1px var(--divider); }
.close { font: inherit; color: var(--fg); background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.close:hover { background: var(--buttonBg); }
.body { flex: 1; overflow: auto; padding: 16px; display: flex; flex-direction: column; gap: 20px; line-height: 1.7; }
.lead { margin: 0; }
.way { display: flex; flex-direction: column; gap: 8px; }
.way h3 { margin: 0; font-size: 1em; color: var(--accent); }
.way p { margin: 0; }
.way code { padding: 0.1em 0.3em; font-family: Fira Code, Menlo, monospace; font-size: 0.9em; background: var(--buttonBg); border-radius: 4px; }
.row { display: flex; flex-wrap: wrap; gap: 8px; }
.pre { margin: 0; padding: 12px; font-family: Fira Code, Menlo, monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--editorBg); border: solid 1px var(--divider); border-radius: 8px; }
.links { margin: 0; padding-left: 1.2em; }
.links a { color: var(--accent); }
</style>
