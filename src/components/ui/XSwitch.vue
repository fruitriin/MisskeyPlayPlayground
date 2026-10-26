<template>
<label :class="$style.root">
	<input type="checkbox" :class="$style.native" :checked="modelValue" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)">
	<span :class="[$style.track, { [$style.on]: modelValue }]"><span :class="$style.knob"/></span>
	<span :class="$style.body">
		<span v-if="$slots.label" :class="$style.label"><slot name="label"/></span>
		<span v-if="$slots.caption" :class="$style.caption"><slot name="caption"/></span>
	</span>
</label>
</template>

<script lang="ts" setup>
defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
</script>

<style module>
.root { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; user-select: none; }
.native { position: absolute; opacity: 0; width: 0; height: 0; }
.track {
	flex-shrink: 0;
	position: relative;
	width: 38px;
	height: 22px;
	margin-top: 1px;
	border-radius: 999px;
	background: var(--switchOffBg);
	transition: background 0.2s;
}
.knob {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: #fff;
	transition: transform 0.2s;
}
.on { background: var(--accent); }
.on .knob { transform: translateX(16px); }
.native:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
.body { display: flex; flex-direction: column; gap: 4px; }
.caption { font-size: 0.85em; color: var(--fgTransparentWeak); }
</style>
