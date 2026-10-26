<template>
<div>
	<div v-if="$slots.label" :class="$style.label"><slot name="label"/></div>
	<textarea
		:class="$style.textarea"
		:value="modelValue ?? ''"
		@input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
	/>
	<div v-if="$slots.caption" :class="$style.caption"><slot name="caption"/></div>
</div>
</template>

<script lang="ts" setup>
defineProps<{ modelValue: string | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>

<style module>
.label { font-size: 0.85em; padding: 0 0 8px 0; user-select: none; }
.caption { font-size: 0.85em; padding: 8px 0 0 0; color: var(--fgTransparentWeak); }
.textarea {
	box-sizing: border-box;
	display: block;
	width: 100%;
	min-height: 130px;
	padding: 12px;
	font: inherit;
	color: var(--fg);
	background: var(--panel);
	border: solid 1px var(--inputBorder);
	border-radius: 6px;
	outline: none;
	resize: vertical;
}
.textarea:hover { border-color: var(--inputBorderHover); }
.textarea:focus { border-color: var(--accent); }
</style>
