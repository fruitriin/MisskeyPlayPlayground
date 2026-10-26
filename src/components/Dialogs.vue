<template>
<div>
	<TransitionGroup name="fade">
		<div v-for="d in state.dialogs" :key="d.id" :class="$style.backdrop" @click.self="cancel(d)">
			<div v-if="d.kind === 'post'" :class="$style.postWindow">
				<PostForm
					:initialText="d.form.initialText"
					:initialCw="d.form.initialCw"
					:initialVisibility="d.form.initialVisibility"
					:initialLocalOnly="d.form.initialLocalOnly"
					@posted="d.resolve()"
				/>
			</div>
			<div v-else :class="$style.dialog" role="dialog">
				<div v-if="d.kind !== 'input'" :class="[$style.icon, $style[d.type]]">{{ icons[d.type] }}</div>
				<div v-if="d.title" :class="$style.title">{{ d.title }}</div>
				<div v-if="d.kind !== 'input' && d.text" :class="$style.text">{{ d.text }}</div>
				<form v-if="d.kind === 'input'" @submit.prevent="d.resolve(inputValue)">
					<input ref="inputEl" v-model="inputValue" :class="$style.input" autofocus>
				</form>
				<div :class="$style.buttons">
					<template v-if="d.kind === 'alert'">
						<XButton primary inline @click="d.resolve()">OK</XButton>
					</template>
					<template v-else-if="d.kind === 'confirm'">
						<XButton primary inline @click="d.resolve(true)">OK</XButton>
						<XButton inline @click="d.resolve(false)">キャンセル</XButton>
					</template>
					<template v-else>
						<XButton primary inline @click="d.resolve(inputValue)">OK</XButton>
						<XButton inline @click="d.resolve(null)">キャンセル</XButton>
					</template>
				</div>
			</div>
		</div>
	</TransitionGroup>
	<div :class="$style.toasts">
		<TransitionGroup name="toast">
			<div v-for="t in state.toasts" :key="t.id" :class="$style.toast">{{ t.text }}</div>
		</TransitionGroup>
	</div>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import XButton from './ui/XButton.vue';
import PostForm from './PostForm.vue';
import { state } from '@/os.js';
import type { Dialog } from '@/os.js';

const icons = { error: '✕', info: 'i', success: '✓', warning: '!', waiting: '…', question: '?' } as const;

const inputValue = ref('');
const inputEl = ref<HTMLInputElement[]>();

watch(() => state.dialogs.length, async () => {
	inputValue.value = '';
	await nextTick();
	inputEl.value?.at(-1)?.focus();
});

function onKeydown(ev: KeyboardEvent) {
	const top = state.dialogs.at(-1);
	if (ev.key === 'Escape' && top) cancel(top);
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

function cancel(d: Dialog) {
	if (d.kind === 'confirm') d.resolve(false);
	else if (d.kind === 'input') d.resolve(null);
	else d.resolve();
}
</script>

<style module>
.backdrop {
	position: fixed;
	inset: 0;
	z-index: 100;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 16px;
	background: rgba(0, 0, 0, 0.45);
}
.dialog {
	box-sizing: border-box;
	width: 100%;
	max-width: 400px;
	max-height: 100%;
	overflow: auto;
	padding: 28px 24px 24px;
	text-align: center;
	color: var(--fg);
	background: var(--panel);
	border-radius: 16px;
}
.postWindow { width: 100%; max-width: 520px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); border-radius: 8px; }
.icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 44px;
	margin: 0 auto 12px;
	font-size: 22px;
	font-weight: bold;
	border-radius: 50%;
	color: #fff;
	background: var(--accent);
}
.error { background: #ec4137; }
.warning { background: #ecb637; }
.success { background: #86b300; }
.question, .info, .waiting { background: #3aa2dc; }
.title { font-weight: bold; font-size: 1.1em; margin-bottom: 8px; }
.text { white-space: pre-wrap; overflow-wrap: anywhere; text-align: left; font-size: 0.95em; }
.input {
	box-sizing: border-box;
	width: 100%;
	height: 38px;
	margin-top: 8px;
	padding: 0 12px;
	font: inherit;
	color: var(--fg);
	background: var(--bg);
	border: solid 1px var(--inputBorder);
	border-radius: 6px;
	outline: none;
}
.input:focus { border-color: var(--accent); }
.buttons { display: flex; justify-content: center; gap: 8px; margin-top: 20px; }
.toasts {
	position: fixed;
	top: 16px;
	left: 0;
	right: 0;
	z-index: 200;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	pointer-events: none;
}
.toast {
	max-width: calc(100% - 32px);
	padding: 12px 20px;
	color: var(--fg);
	background: var(--panel);
	border-radius: 8px;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}
</style>
