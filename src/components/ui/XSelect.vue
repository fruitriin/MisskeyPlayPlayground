<template>
<div>
	<div v-if="$slots.label" :class="$style.label"><slot name="label"/></div>
	<select :class="[$style.select, { [$style.small]: small }]" :value="modelValue ?? ''" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
		<option v-if="modelValue == null" value="" disabled hidden></option>
		<option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
	</select>
	<div v-if="$slots.caption" :class="$style.caption"><slot name="caption"/></div>
</div>
</template>

<script lang="ts" setup>
defineProps<{
	modelValue: string | null;
	items: { value: string; label: string }[];
	small?: boolean;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>

<style module>
.label { font-size: 0.85em; padding: 0 0 8px 0; user-select: none; }
.caption { font-size: 0.85em; padding: 8px 0 0 0; color: var(--fgTransparentWeak); }
.select {
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
	cursor: pointer;
}
.select:focus { border-color: var(--accent); }
.small { height: 33px; font-size: 0.9em; }
</style>
