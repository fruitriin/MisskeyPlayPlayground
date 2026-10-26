<template>
<button
	:class="[$style.button, { [$style.primary]: primary, [$style.rounded]: rounded, [$style.small]: small, [$style.inline]: inline }]"
	:disabled="disabled"
	type="button"
	@click="emit('click', $event)"
>
	<slot/>
</button>
</template>

<script lang="ts" setup>
defineProps<{
	primary?: boolean;
	rounded?: boolean;
	disabled?: boolean;
	small?: boolean;
	inline?: boolean;
}>();
const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>();
</script>

<style module>
.button {
	display: block;
	min-width: 100px;
	padding: 7px 14px;
	font: inherit;
	font-size: 95%;
	text-align: center;
	color: var(--fg);
	background: var(--buttonBg);
	border: none;
	border-radius: 5px;
	cursor: pointer;
	transition: background 0.1s;
}
.button:hover:not(:disabled) { background: var(--buttonHoverBg); }
.button:disabled { opacity: 0.5; cursor: default; }
.inline { display: inline-block; width: auto; }
.small { font-size: 90%; padding: 6px 12px; }
.rounded { border-radius: 999px; }
.primary { font-weight: bold; color: var(--fgOnAccent); background: var(--accent); }
.primary:hover:not(:disabled) { background: var(--accentLighten); }
</style>
