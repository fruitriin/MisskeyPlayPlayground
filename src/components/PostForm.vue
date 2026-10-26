<template>
<div :class="$style.root">
	<div :class="$style.header">
		<span :class="$style.account">@{{ settings.dummyUser.username }}</span>
		<select v-model="visibility" :class="$style.visibility" title="公開範囲">
			<option v-for="v in noteVisibilities" :key="v" :value="v">{{ visibilityLabel[v] }}</option>
		</select>
		<label :class="$style.localOnly"><input v-model="localOnly" type="checkbox"> 連合なし</label>
	</div>
	<input v-if="useCw" v-model="cw" :class="$style.cw" placeholder="注釈">
	<textarea v-model="text" :class="$style.text" placeholder="いまどうしてる？"/>
	<div :class="$style.footer">
		<button type="button" :class="[$style.tool, { [$style.active]: useCw }]" title="内容を隠す" @click="useCw = !useCw">CW</button>
		<span :class="$style.target">{{ targetLabel }}</span>
		<XButton primary rounded inline small :disabled="posting || text.trim() === ''" @click="submit">ノート</XButton>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import XButton from './ui/XButton.vue';
import { noteVisibilities } from '@/aiscript/ui.js';
import { settings, normalizedServerUrl, callApi, isMock } from '@/settings.js';
import * as os from '@/os.js';

const props = defineProps<{
	initialText?: string;
	initialCw?: string;
	initialVisibility?: (typeof noteVisibilities)[number];
	initialLocalOnly?: boolean;
}>();
const emit = defineEmits<{ (e: 'posted'): void }>();

const visibilityLabel = { public: '公開', home: 'ホーム', followers: 'フォロワー', specified: 'ダイレクト' } as const;

const text = ref(props.initialText ?? '');
const useCw = ref(props.initialCw != null);
const cw = ref(props.initialCw ?? '');
const visibility = ref<(typeof noteVisibilities)[number]>(props.initialVisibility ?? 'public');
const localOnly = ref(props.initialLocalOnly ?? false);
const posting = ref(false);

const canPost = computed(() => isMock() || (normalizedServerUrl() != null && settings.token !== ''));
const targetLabel = computed(() => isMock() ? 'モックサーバーに投稿' : canPost.value ? `${normalizedServerUrl()} に投稿` : 'プレビューのみ（送信しません）');

async function submit() {
	const body = {
		text: text.value,
		cw: useCw.value ? cw.value : null,
		visibility: visibility.value,
		localOnly: localOnly.value,
	};
	if (!canPost.value) {
		await os.alert({
			type: 'info',
			title: '投稿のプレビュー',
			text: `実サーバーのトークンが未設定のため送信しませんでした。\n\n${JSON.stringify(body, null, 2)}`,
		});
		emit('posted');
		return;
	}
	if (!isMock()) {
		const { canceled } = await os.confirm({ type: 'warning', title: '本当に投稿しますか？', text: `${normalizedServerUrl()} に実際にノートを投稿します。` });
		if (canceled) return;
	}
	posting.value = true;
	try {
		await callApi('notes/create', body);
		os.toast(isMock() ? 'モックサーバーに投稿しました' : '投稿しました');
		text.value = '';
		emit('posted');
	} catch (err) {
		os.alert({ type: 'error', title: '投稿に失敗しました', text: JSON.stringify(err, null, 2) });
	} finally {
		posting.value = false;
	}
}
</script>

<style module>
.root { display: flex; flex-direction: column; background: var(--panel); border-radius: 8px; overflow: clip; }
.header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: solid 1px var(--divider); font-size: 0.9em; }
.account { flex: 1; color: var(--fgTransparentWeak); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visibility { font: inherit; color: var(--fg); background: transparent; border: none; cursor: pointer; }
.localOnly { display: flex; align-items: center; gap: 4px; white-space: nowrap; cursor: pointer; }
.cw, .text { box-sizing: border-box; width: 100%; padding: 12px; font: inherit; color: var(--fg); background: transparent; border: none; outline: none; }
.cw { border-bottom: solid 1px var(--divider); }
.text { min-height: 90px; resize: vertical; }
.footer { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: solid 1px var(--divider); }
.tool { padding: 4px 8px; font: inherit; font-size: 0.85em; color: var(--fg); background: none; border: none; border-radius: 4px; cursor: pointer; }
.tool:hover { background: var(--buttonBg); }
.active { color: var(--accent); }
.target { flex: 1; font-size: 0.8em; color: var(--fgTransparentWeak); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
