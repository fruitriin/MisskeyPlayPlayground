<template>
<div :class="$style.backdrop" @click.self="emit('close')">
	<div :class="$style.panel">
		<div :class="$style.header">
			<span>ライブ共有</span>
			<button type="button" :class="$style.close" aria-label="閉じる" @click="emit('close')">✕</button>
		</div>
		<div :class="$style.body">
			<p :class="$style.lead">
				合言葉を決めてつなぐと、AI などが HTTP でこの画面のコードを読み書きできるようになります。外から書き換えると、ここにすぐ反映されて実行されます。
				ここで書き換えたコードも、外から読むと最新になっています。
			</p>

			<template v-if="live.status === 'idle'">
				<XInput v-model="keyInput" small>
					<template #label>合言葉</template>
					<template #caption>英数字と - _ の 8〜64 文字。知っている人は誰でも読み書きできるので、推測されにくいものにしてください</template>
				</XInput>
				<div :class="$style.row">
					<XButton small inline @click="keyInput = generateKey()">作り直す</XButton>
					<XButton primary small inline :disabled="!KEY_PATTERN.test(keyInput)" @click="connect(keyInput)">つなぐ</XButton>
				</div>
				<p :class="$style.note">合言葉の部屋にすでにコードがあれば、エディタはそのコードに置き換わります。空の部屋なら、いまのコードが入ります。</p>
			</template>

			<template v-else>
				<div :class="$style.status">
					<span :class="[$style.dot, { [$style.on]: live.status === 'connected' }]"/>
					{{ live.status === 'connected' ? `接続中（この合言葉の画面: ${live.viewers}）` : '接続しています…' }}
				</div>
				<p v-if="live.error" :class="$style.error">{{ live.error }}</p>
				<div :class="$style.copyRow">
					<code>{{ live.key }}</code>
					<XButton small inline @click="copy(live.key!)">合言葉をコピー</XButton>
				</div>

				<h3>AI に渡す文章</h3>
				<pre :class="$style.pre">{{ prompt }}</pre>
				<div :class="$style.row"><XButton small inline @click="copy(prompt)">コピー</XButton></div>

				<h3>API</h3>
				<pre :class="$style.pre">{{ apiExample }}</pre>
				<p :class="$style.note">詳しい使い方は <a :href="`${origin}/ai/live-api.md`" target="_blank" rel="noopener">/ai/live-api.md</a> にあります。</p>

				<div :class="$style.row">
					<XButton small inline @click="copy(shareUrl)">この画面の URL をコピー</XButton>
					<XButton small inline @click="disconnect()">切断する</XButton>
				</div>
			</template>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import XInput from './ui/XInput.vue';
import XButton from './ui/XButton.vue';
import { live, connect, disconnect, generateKey, savedKey, KEY_PATTERN } from '@/live.js';
import * as os from '@/os.js';

const emit = defineEmits<{ (e: 'close'): void }>();

const keyInput = ref(savedKey() ?? generateKey());
const origin = window.location.origin;
const roomUrl = computed(() => `${origin}/api/rooms/${live.key}`);
const shareUrl = computed(() => `${origin}${window.location.pathname}#live=${live.key}`);

const prompt = computed(() => `Misskey Play Playground で Misskey Play 向けのコードを書いてください。
まず ${origin}/llms.txt を読み、資料（特に /ai/tips.md と /ai/live-api.md）を確認してください。
コードは次の API で私の画面に送り、実行結果を確かめながら進めてください。
- コードを送って実行: PUT ${roomUrl.value}
- 実行結果を読む: GET ${roomUrl.value}/state
- ボタンなどを操作: POST ${roomUrl.value}/act`);

const apiExample = computed(() => `# いまのコードを読む
curl ${roomUrl.value}

# コードを送って実行し、結果を受け取る
curl -X PUT --data-binary @game.ais ${roomUrl.value}

# 実行結果（ログ・UI ツリー）を読む
curl ${roomUrl.value}/state

# ボタンを押す
curl -X POST -H 'Content-Type: application/json' \\
  -d '{"actions":[{"type":"click","id":"部品の id"}]}' \\
  ${roomUrl.value}/act`);

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
.panel { display: flex; flex-direction: column; width: 100%; max-width: 560px; height: 100%; color: var(--fg); background: var(--panel); box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2); }
.header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; font-weight: bold; border-bottom: solid 1px var(--divider); }
.close { font: inherit; color: var(--fg); background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.close:hover { background: var(--buttonBg); }
.body { flex: 1; overflow: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.body h3 { margin: 12px 0 0; font-size: 0.95em; color: var(--accent); }
.lead { margin: 0; line-height: 1.7; }
.note { margin: 0; font-size: 0.85em; color: var(--fgTransparentWeak); }
.note a { color: var(--accent); }
.error { margin: 0; font-size: 0.9em; color: #ec4137; }
.row { display: flex; flex-wrap: wrap; gap: 8px; }
.status { display: flex; align-items: center; gap: 8px; font-weight: bold; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #ecb637; }
.on { background: #ec4137; animation: blink 1.6s ease-in-out infinite; }
@keyframes blink { 50% { opacity: 0.35; } }
.copyRow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.copyRow code { padding: 4px 8px; font-family: Fira Code, Menlo, monospace; background: var(--buttonBg); border-radius: 4px; overflow-wrap: anywhere; }
.pre { margin: 0; padding: 12px; font-family: Fira Code, Menlo, monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--editorBg); border: solid 1px var(--divider); border-radius: 8px; }
</style>
