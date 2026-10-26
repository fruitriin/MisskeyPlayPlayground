<template>
<div :class="$style.root">
	<div v-if="$slots.label" :class="$style.label"><slot name="label"/></div>
	<input
		:class="[$style.input, { [$style.small]: small }]"
		:type="type ?? 'text'"
		:value="modelValue ?? ''"
		@input="onInput"
	>
	<div v-if="$slots.caption" :class="$style.caption"><slot name="caption"/></div>
</div>
</template>

<script lang="ts" setup>
const props = defineProps<{
	modelValue: string | number | null;
	type?: 'text' | 'number';
	small?: boolean;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string | number): void }>();

function onInput(ev: Event) {
	const raw = (ev.target as HTMLInputElement).value;
	if (props.type === 'number') {
		// Misskey の MkInput と同じく、数値欄は number で返す
		emit('update:modelValue', raw === '' ? 0 : Number(raw));
	} else {
		emit('update:modelValue', raw);
	}
}
</script>

<style module>
.root { min-width: 0; }
.label { font-size: 0.85em; padding: 0 0 8px 0; user-select: none; }
.caption { font-size: 0.85em; padding: 8px 0 0 0; color: var(--fgTransparentWeak); }
.input {
	box-sizing: border-box;
	width: 100%;
	height: 38px;
	padding: 0 12px;
	font: inherit;
	color: var(--fg);
	background: var(--panel);
	border: solid 1px var(--inputBorder);
	border-radius: 6px;
	outline: none;
}
.input:hover { border-color: var(--inputBorderHover); }
.input:focus { border-color: var(--accent); }
.small { height: 33px; font-size: 0.9em; }
</style>
