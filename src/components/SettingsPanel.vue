<template>
<div :class="$style.backdrop" @click.self="emit('close')">
	<div :class="$style.panel">
		<div :class="$style.header">
			<span>実行環境の設定</span>
			<button type="button" :class="$style.close" aria-label="閉じる" @click="emit('close')">✕</button>
		</div>
		<div :class="$style.body">
			<section :class="$style.section">
				<h3>API の接続先</h3>
				<XSelect v-model="settings.apiMode" small :items="[{ value: 'mock', label: '同梱のモックサーバー（既定）' }, { value: 'server', label: '実際の Misskey サーバー' }]">
					<template #label>Mk:api と投稿フォームの送り先</template>
					<template #caption>モックはブラウザの中だけで動き、どこにも通信しません。対応エンドポイント: {{ mockEndpoints.join(', ') }}</template>
				</XSelect>
			</section>
			<section v-if="settings.apiMode === 'server'" :class="$style.section">
				<h3>接続先 Misskey サーバー</h3>
				<XInput v-model="settings.serverUrl" small>
					<template #label>サーバー URL</template>
					<template #caption>Mk:api、カスタム絵文字の表示、SERVER_URL に使います。例: misskey.io</template>
				</XInput>
				<XInput v-model="settings.token" small>
					<template #label>アクセストークン（任意）</template>
					<template #caption>指定すると Mk:api と投稿フォームがこのトークンで実際に動きます。トークンはこのブラウザの localStorage にだけ保存します。</template>
				</XInput>
				<div :class="$style.row">
					<XButton small inline :disabled="!settings.serverUrl || !settings.token || loading" @click="fetchMe">トークンのユーザー情報を取り込む</XButton>
					<span :class="$style.status">{{ status }}</span>
				</div>
			</section>
			<section :class="$style.section">
				<h3>定数</h3>
				<XInput v-model="settings.dummyUser.id" small><template #label>USER_ID</template></XInput>
				<XInput v-model="settings.dummyUser.name" small><template #label>USER_NAME</template></XInput>
				<XInput v-model="settings.dummyUser.username" small><template #label>USER_USERNAME</template></XInput>
				<XInput v-model="settings.locale" small><template #label>LOCALE</template></XInput>
			</section>
			<section :class="$style.section">
				<h3>表示</h3>
				<XSelect v-model="settings.dark" small :items="[{ value: 'auto', label: 'OS に合わせる' }, { value: 'light', label: 'ライト' }, { value: 'dark', label: 'ダーク' }]">
					<template #label>テーマ</template>
				</XSelect>
				<XSelect v-model="settings.emojiStyle" small :items="[{ value: 'twemoji', label: 'Twemoji（Misskey の既定）' }, { value: 'native', label: 'OS の絵文字' }]">
					<template #label>MFM の中の絵文字</template>
					<template #caption>Misskey の設定「絵文字のスタイル」に合わせて選びます。ボタンや Ui:C:text の絵文字は、どちらでも OS の絵文字で表示されます（Misskey と同じ）</template>
				</XSelect>
			</section>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import XInput from './ui/XInput.vue';
import XButton from './ui/XButton.vue';
import XSelect from './ui/XSelect.vue';
import { settings, callApi } from '@/settings.js';
import { mockEndpoints } from '@/mock/api.js';

const emit = defineEmits<{ (e: 'close'): void }>();

const loading = ref(false);
const status = ref('');

async function fetchMe() {
	loading.value = true;
	status.value = '取得中…';
	try {
		const me = await callApi('i', {}) as { id: string; name: string | null; username: string };
		settings.dummyUser = { id: me.id, name: me.name ?? me.username, username: me.username };
		status.value = `@${me.username} として設定しました`;
	} catch (err) {
		status.value = `失敗しました: ${err instanceof Error ? err.message : JSON.stringify(err)}`;
	} finally {
		loading.value = false;
	}
}
</script>

<style module>
.backdrop { position: fixed; inset: 0; z-index: 90; display: flex; justify-content: flex-end; background: rgba(0, 0, 0, 0.35); }
.panel { display: flex; flex-direction: column; width: 100%; max-width: 420px; height: 100%; color: var(--fg); background: var(--panel); box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2); }
.header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; font-weight: bold; border-bottom: solid 1px var(--divider); }
.close { font: inherit; color: var(--fg); background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.close:hover { background: var(--buttonBg); }
.body { flex: 1; overflow: auto; padding: 16px; }
.section { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }
.section h3 { margin: 0; font-size: 0.95em; color: var(--accent); }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.status { font-size: 0.85em; color: var(--fgTransparentWeak); }
</style>
