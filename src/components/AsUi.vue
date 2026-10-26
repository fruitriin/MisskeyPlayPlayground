<!--
Misskey の packages/frontend/src/components/MkAsUi.vue を元に移植したもの
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<div v-if="c.type === 'root'" :class="$style.root">
		<template v-for="child in c.children" :key="child">
			<AsUi v-if="!g(child).hidden" :component="g(child)" :components="props.components" :size="size"/>
		</template>
	</div>
	<span v-else-if="c.type === 'text'" :class="{ [$style.fontSerif]: c.font === 'serif', [$style.fontMonospace]: c.font === 'monospace' }" :style="{ fontSize: c.size ? `${c.size * 100}%` : undefined, fontWeight: c.bold ? 'bold' : undefined, color: c.color }">{{ c.text }}</span>
	<span v-else-if="c.type === 'mfm'" :class="[$style.mfm, { [$style.fontSerif]: c.font === 'serif', [$style.fontMonospace]: c.font === 'monospace' }]" :style="{ fontSize: c.size ? `${c.size * 100}%` : undefined, fontWeight: c.bold ? 'bold' : undefined, color: c.color ?? undefined }">
		<MfmRenderer :text="c.text ?? ''" @clickEv="(ev: string) => c.type === 'mfm' && c.onClickEv?.(ev)"/>
	</span>
	<XButton v-else-if="c.type === 'button'" :primary="c.primary" :rounded="c.rounded" :disabled="c.disabled" :small="size === 'small'" inline @click="c.onClick">{{ c.text }}</XButton>
	<div v-else-if="c.type === 'buttons'" :class="$style.buttons" :style="{ justifyContent: align }">
		<XButton v-for="button in c.buttons" :primary="button.primary" :rounded="button.rounded" :disabled="button.disabled" inline :small="size === 'small'" @click="button.onClick">{{ button.text }}</XButton>
	</div>
	<XSwitch v-else-if="c.type === 'switch'" :modelValue="valueForSwitch" @update:modelValue="onSwitchUpdate">
		<template v-if="c.label" #label>{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
	</XSwitch>
	<XTextarea v-else-if="c.type === 'textarea'" :modelValue="c.default ?? null" @update:modelValue="onInput">
		<template v-if="c.label" #label>{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
	</XTextarea>
	<XInput v-else-if="c.type === 'textInput'" :small="size === 'small'" :modelValue="c.default ?? null" @update:modelValue="onInput">
		<template v-if="c.label" #label>{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
	</XInput>
	<XInput v-else-if="c.type === 'numberInput'" :small="size === 'small'" :modelValue="c.default ?? null" type="number" @update:modelValue="onInput">
		<template v-if="c.label" #label>{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
	</XInput>
	<XSelect v-else-if="c.type === 'select'" :small="size === 'small'" :modelValue="valueForSelect" :items="selectItems" @update:modelValue="onSelectUpdate">
		<template v-if="c.label" #label>{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
	</XSelect>
	<XButton v-else-if="c.type === 'postFormButton'" :primary="c.primary" :rounded="c.rounded" :small="size === 'small'" inline @click="openPostForm">{{ c.text }}</XButton>
	<div v-else-if="c.type === 'postForm'" :class="$style.postForm">
		<PostForm
			:initialText="c.form?.text"
			:initialCw="c.form?.cw"
			:initialVisibility="c.form?.visibility"
			:initialLocalOnly="c.form?.localOnly"
		/>
	</div>
	<XFolder v-else-if="c.type === 'folder'" :defaultOpen="c.opened">
		<template #label>{{ c.title }}</template>
		<template v-for="child in c.children" :key="child">
			<AsUi v-if="!g(child).hidden" :component="g(child)" :components="props.components" :size="size"/>
		</template>
	</XFolder>
	<div v-else-if="c.type === 'container'" :class="[$style.container, { [$style.fontSerif]: c.font === 'serif', [$style.fontMonospace]: c.font === 'monospace' }]" :style="containerStyle">
		<template v-for="child in c.children" :key="child">
			<AsUi v-if="!g(child).hidden" :component="g(child)" :components="props.components" :size="size" :align="c.align"/>
		</template>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import type { AsUiComponent, AsUiRoot, AsUiPostFormButton } from '@/aiscript/ui.js';
import * as os from '@/os.js';
import XButton from '@/components/ui/XButton.vue';
import XInput from '@/components/ui/XInput.vue';
import XSwitch from '@/components/ui/XSwitch.vue';
import XTextarea from '@/components/ui/XTextarea.vue';
import XSelect from '@/components/ui/XSelect.vue';
import XFolder from '@/components/ui/XFolder.vue';
import PostForm from '@/components/PostForm.vue';

defineOptions({ name: 'AsUi' });

const props = withDefaults(defineProps<{
	component: AsUiComponent;
	components: Ref<AsUiComponent>[];
	size?: 'small' | 'medium' | 'large';
	align?: 'left' | 'center' | 'right';
}>(), {
	size: 'medium',
	align: 'left',
});

const c = props.component;

function g(id: string) {
	const v = props.components.find(x => x.value.id === id)?.value;
	if (v) return v;

	return {
		id: 'dummy',
		type: 'root',
		children: [],
	} as AsUiRoot;
}

const containerStyle = computed(() => {
	if (c.type !== 'container') return undefined;

	// width, color, styleのうち一つでも指定があれば、枠線がちゃんと表示されるようにwidthとstyleのデフォルト値を設定
	// radiusは単に角を丸める用途もあるため除外
	const isBordered = c.borderWidth ?? c.borderColor ?? c.borderStyle;

	const border = isBordered ? {
		borderWidth: `${c.borderWidth ?? 1}px`,
		borderColor: c.borderColor ?? 'var(--divider)',
		borderStyle: c.borderStyle ?? 'solid',
	} : undefined;

	return {
		textAlign: c.align,
		backgroundColor: c.bgColor,
		color: c.fgColor,
		padding: c.padding ? `${c.padding}px` : 0,
		borderRadius: (c.borderRadius ?? (c.rounded ? 8 : 0)) + 'px',
		...border,
	};
});

function onInput(v: string | number) {
	if ('onInput' in c && c.onInput) {
		c.onInput(v as never);
	}
}

const valueForSwitch = ref('default' in c && typeof c.default === 'boolean' ? c.default : false);

function onSwitchUpdate(v: boolean) {
	valueForSwitch.value = v;
	if ('onChange' in c && c.onChange) {
		c.onChange(v as never);
	}
}

const selectItems = computed(() => {
	if (c.type !== 'select') return [];
	return (c.items ?? []).map(item => ({
		value: item.value,
		label: item.text,
	}));
});

const valueForSelect = ref<string | null>((c.type === 'select' && 'default' in c && typeof c.default === 'string') ? c.default : null);

function onSelectUpdate(v: string | null) {
	valueForSelect.value = v;
	if ('onChange' in c && c.onChange) {
		c.onChange(v as never);
	}
}

function openPostForm() {
	const form = (c as AsUiPostFormButton).form;
	if (!form) return;

	os.post({
		initialText: form.text,
		initialCw: form.cw,
		initialVisibility: form.visibility,
		initialLocalOnly: form.localOnly,
	});
}
</script>

<style module>
.root {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.container {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.buttons {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.fontSerif {
	font-family: serif;
}

.fontMonospace {
	font-family: Fira code, Fira Mono, Consolas, Menlo, Courier, monospace;
}

.mfm {
	white-space: normal;
}

.postForm {
	background: var(--bg);
	border-radius: 8px;
}
</style>
