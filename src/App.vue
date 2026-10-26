<template>
<div :class="[$style.app, { [$style.screenshotMode]: screenshotMode }]">
	<header :class="$style.header">
		<div :class="$style.logo">
			<span :class="$style.logoMark">▶</span>
			<span :class="$style.logoText">AiScript Playground</span>
		</div>
		<select :class="$style.sampleSelect" :value="''" aria-label="サンプルを開く" @change="loadSample(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
			<option value="" disabled>サンプルを開く…</option>
			<optgroup v-for="g in sampleGroups" :key="g.label" :label="g.label">
				<option v-for="s in g.items" :key="s.id" :value="s.id">{{ s.title }}</option>
			</optgroup>
		</select>
		<div :class="$style.spacer"/>
		<XButton small inline :class="[$style.headerButton, { [$style.liveOn]: live.status !== 'idle' }]" title="合言葉で、外からコードを読み書きできるようにする" @click="showLive = true">{{ live.status === 'idle' ? '🔗 ライブ共有' : '● ライブ共有中' }}</XButton>
		<XButton small inline :class="$style.headerButton" title="ミニゲームの作り方" @click="showGuide = true">📖 ガイド</XButton>
		<XButton small inline :class="$style.headerButton" title="共有用のリンクをコピー" @click="share">共有</XButton>
		<XButton small inline :class="$style.headerButton" title="実行環境の設定" @click="showSettings = true">⚙ 設定</XButton>
		<XButton v-if="running" small inline :class="$style.headerButton" @click="stop">■ 停止</XButton>
		<XButton primary small inline :class="$style.headerButton" title="実行 (Cmd/Ctrl + Enter)" @click="execute">▶ 実行</XButton>
	</header>

	<nav :class="$style.mobileTabs">
		<button v-for="t in mobileTabs" :key="t.id" type="button" :class="{ [$style.mobileTabActive]: mobileTab === t.id }" @click="mobileTab = t.id">{{ t.label }}</button>
	</nav>

	<main :class="$style.main">
		<section :class="[$style.editorPane, { [$style.mobileHidden]: mobileTab !== 'editor' }]">
			<CodeEditor v-model="code" @run="execute"/>
		</section>

		<section :class="[$style.rightPane, { [$style.mobileHidden]: mobileTab === 'editor' }]">
			<div :class="[$style.previewPane, { [$style.mobileHidden]: mobileTab !== 'preview' }]">
				<div :class="$style.paneTitle">
					<span>プレビュー</span>
					<span v-if="usedVersion" :class="$style.badge">AiScript {{ usedVersion }}</span>
				</div>
				<div :class="$style.previewBody" data-testid="preview">
					<AsUi v-if="root && root.children?.length" :key="runKey" :component="root" :components="components" size="medium"/>
					<div v-else :class="$style.empty">
						<p>コードを書いて <b>▶ 実行</b>（Cmd/Ctrl + Enter）すると、Ui:render の結果がここに出ます。</p>
					</div>
				</div>
			</div>

			<div :class="[$style.consolePane, { [$style.mobileHidden]: mobileTab !== 'console' }]">
				<div :class="$style.paneTitle">
					<button type="button" :class="[$style.tab, { [$style.tabActive]: bottomTab === 'console' }]" @click="bottomTab = 'console'">
						コンソール<span v-if="errorCount > 0" :class="$style.errorCount">{{ errorCount }}</span>
					</button>
					<button type="button" :class="[$style.tab, { [$style.tabActive]: bottomTab === 'tree' }]" @click="bottomTab = 'tree'">UI ツリー</button>
					<div :class="$style.spacer"/>
					<button v-if="bottomTab === 'console'" type="button" :class="$style.tab" @click="clearLogs">クリア</button>
				</div>
				<div v-if="bottomTab === 'console'" ref="consoleEl" :class="$style.console" data-testid="console">
					<div v-for="log in logs" :key="log.id" :class="[$style.log, $style[`log_${log.type}`]]">
						<span :class="$style.logMark">{{ logMarks[log.type] }}</span>
						<span :class="$style.logText">{{ log.text }}</span>
					</div>
					<div v-if="logs.length === 0" :class="$style.empty">&lt;: で出力した値やエラーがここに出ます。</div>
				</div>
				<div v-else :class="$style.console">
					<UiTree v-if="root" :root="root" :components="components"/>
					<div v-else :class="$style.empty">Ui:render が呼ばれていません。</div>
				</div>
			</div>
		</section>
	</main>

	<SettingsPanel v-if="showSettings" @close="showSettings = false"/>
	<LivePanel v-if="showLive" @close="showLive = false"/>
	<GuidePanel v-if="showGuide" @close="closeGuide" @run="openFromGuide" @sample="id => { closeGuide(); loadSample(id); }"/>
	<Dialogs/>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch, watchEffect } from 'vue';
import CodeEditor from './components/CodeEditor.vue';
import AsUi from './components/AsUi.vue';
import UiTree from './components/UiTree.vue';
import Dialogs from './components/Dialogs.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import GuidePanel from './components/GuidePanel.vue';
import LivePanel from './components/LivePanel.vue';
import { live, joinFromHash } from './live.js';
import XButton from './components/ui/XButton.vue';
import { allSamples, sampleGroups } from './allSamples.js';
import { encodeCode, decodeCode } from './share.js';
import { settings } from './settings.js';
import { run, stop, clearLogs, logs, root, components, runKey, running, usedVersion } from './runner.js';
import * as os from './os.js';
import { code, mobileTab, screenshotMode } from './store.js';

const showSettings = ref(false);
const showGuide = ref(window.location.hash === '#guide');
const showLive = ref(false);
const bottomTab = ref<'console' | 'tree'>('console');
const mobileTabs = [
	{ id: 'editor', label: 'コード' },
	{ id: 'preview', label: 'プレビュー' },
	{ id: 'console', label: 'コンソール' },
] as const;
const consoleEl = ref<HTMLElement>();

const logMarks = { print: '›', end: '←', error: '✕', info: 'i' } as const;
const errorCount = computed(() => logs.value.filter(l => l.type === 'error').length);

watch(() => logs.value.length, async () => {
	await nextTick();
	consoleEl.value?.scrollTo({ top: consoleEl.value.scrollHeight });
});

watchEffect(() => {
	const el = document.documentElement;
	if (settings.dark === 'auto') el.removeAttribute('data-theme');
	else el.setAttribute('data-theme', settings.dark);
});

function execute() {
	if (mobileTab.value === 'editor') mobileTab.value = 'preview';
	run(code.value);
}

// いまのコードを捨ててよいか確かめてから、別のコードを開いて実行する
async function openCode(newCode: string, title: string) {
	const isUnchanged = code.value.trim() === '' || code.value === newCode || allSamples.some(s => s.code === code.value);
	if (!isUnchanged) {
		const { canceled } = await os.confirm({ type: 'warning', title, text: 'いまのコードは上書きされます。よろしいですか？' });
		if (canceled) return;
	}
	code.value = newCode;
	execute();
}

function loadSample(id: string) {
	const sample = allSamples.find(s => s.id === id);
	if (sample) openCode(sample.code, 'サンプルを開く');
}

function closeGuide() {
	showGuide.value = false;
	if (window.location.hash === '#guide') history.replaceState(null, '', window.location.pathname);
}

function openFromGuide(newCode: string) {
	closeGuide();
	openCode(newCode, 'ガイドの例を開く');
}

async function share() {
	const url = `${window.location.origin}${window.location.pathname}#code=${await encodeCode(code.value)}`;
	history.replaceState(null, '', url);
	try {
		await navigator.clipboard.writeText(url);
		os.toast('共有用のリンクをコピーしました');
	} catch {
		os.alert({ type: 'info', title: '共有用のリンク', text: url });
	}
}

onMounted(async () => {
	const m = window.location.hash.match(/^#code=(.+)$/);
	if (m) {
		try {
			code.value = await decodeCode(m[1]);
		} catch {
			os.toast('リンクからコードを読み込めませんでした');
		}
	}
	run(code.value);
	// #live=合言葉 で開いたら、その部屋につなぐ
	joinFromHash();
});
</script>

<style module>
.app { display: flex; flex-direction: column; height: 100dvh; }
.header {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	padding: 8px 16px;
	background: var(--panel);
	border-bottom: solid 1px var(--divider);
}
.logo { display: flex; align-items: center; gap: 8px; font-weight: bold; white-space: nowrap; }
.logoMark {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	font-size: 12px;
	color: var(--fgOnAccent);
	background: var(--accent);
	border-radius: 6px;
}
.sampleSelect {
	height: 32px;
	max-width: 220px;
	padding: 0 8px;
	font: inherit;
	font-size: 0.9em;
	color: var(--fg);
	background: var(--bg);
	border: solid 1px var(--inputBorder);
	border-radius: 6px;
	cursor: pointer;
}
.spacer { flex: 1; }
.headerButton { min-width: 0 !important; }
.liveOn { color: #ec4137 !important; font-weight: bold; }
.main { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 0; }
.editorPane { min-height: 0; border-right: solid 1px var(--divider); }
.rightPane { display: grid; grid-template-rows: minmax(0, 3fr) minmax(0, 2fr); min-height: 0; }
.previewPane, .consolePane { display: flex; flex-direction: column; min-height: 0; }
.consolePane { border-top: solid 1px var(--divider); }
.paneTitle {
	display: flex;
	align-items: center;
	gap: 8px;
	min-height: 36px;
	padding: 0 12px;
	font-size: 0.85em;
	font-weight: bold;
	color: var(--fgTransparentWeak);
	background: var(--panel);
	border-bottom: solid 1px var(--divider);
}
.badge { padding: 2px 8px; font-weight: normal; border-radius: 999px; background: var(--buttonBg); }
.previewBody { flex: 1; overflow: auto; padding: 16px; background: var(--bg); }
.empty { color: var(--fgTransparentWeak); font-size: 0.9em; padding: 8px; }
.tab { padding: 6px 8px; font: inherit; color: var(--fgTransparentWeak); background: none; border: none; border-bottom: solid 2px transparent; cursor: pointer; }
.tabActive { color: var(--accent); border-bottom-color: var(--accent); }
.errorCount { margin-left: 6px; padding: 0 6px; font-size: 0.85em; color: #fff; background: #ec4137; border-radius: 999px; }
.console { flex: 1; overflow: auto; font-family: Fira Code, Menlo, Consolas, monospace; font-size: 13px; background: var(--editorBg); }
.log { display: flex; gap: 8px; padding: 4px 12px; border-bottom: solid 1px var(--divider); }
.logMark { flex-shrink: 0; width: 1em; text-align: center; color: var(--fgTransparentWeak); }
.logText { white-space: pre-wrap; overflow-wrap: anywhere; }
.log_end .logText { color: var(--fgTransparentWeak); }
.log_error { color: #ec4137; background: rgba(236, 65, 55, 0.08); }
.log_error .logMark { color: #ec4137; }
.log_info .logText { color: var(--syntaxNamespace); }
.mobileTabs { display: none; }
/* スクリーンショット用: プレビューだけを、中身の高さのまま表示する */
.screenshotMode { height: auto; }
.screenshotMode .header, .screenshotMode .mobileTabs, .screenshotMode .editorPane, .screenshotMode .consolePane, .screenshotMode .paneTitle { display: none !important; }
.screenshotMode .main, .screenshotMode .rightPane { display: block; }
.screenshotMode .previewPane { display: block !important; }
.screenshotMode .previewBody { overflow: visible; }

@media (max-width: 760px) {
	.header { padding: 8px 16px; }
	.logoText { display: none; }
	.sampleSelect { flex: 1; max-width: none; order: 10; flex-basis: 100%; }
	.mobileTabs {
		display: flex;
		background: var(--panel);
		border-bottom: solid 1px var(--divider);
	}
	.mobileTabs button {
		flex: 1;
		padding: 10px 0;
		font: inherit;
		font-size: 0.9em;
		color: var(--fgTransparentWeak);
		background: none;
		border: none;
		border-bottom: solid 2px transparent;
		cursor: pointer;
	}
	.mobileTabs .mobileTabActive { color: var(--accent); border-bottom-color: var(--accent); }
	.main { grid-template-columns: minmax(0, 1fr); }
	.editorPane { border-right: none; }
	.rightPane { grid-template-rows: minmax(0, 1fr); }
	.consolePane { border-top: none; }
	.mobileHidden { display: none !important; }
}
</style>
