<template>
<div :class="$style.root">
	<button type="button" :class="$style.header" @click="opened = !opened">
		<span :class="$style.label"><slot name="label"/></span>
		<span :class="[$style.chevron, { [$style.open]: opened }]">›</span>
	</button>
	<div v-show="opened" :class="$style.body">
		<slot/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const props = defineProps<{ defaultOpen?: boolean }>();
const opened = ref(props.defaultOpen ?? false);
</script>

<style module>
.root { border-radius: 6px; overflow: clip; }
.header {
	display: flex;
	align-items: center;
	width: 100%;
	padding: 9px 12px;
	font: inherit;
	text-align: left;
	color: var(--fg);
	background: var(--folderHeaderBg);
	border: none;
	border-radius: 6px;
	cursor: pointer;
}
.header:hover { background: var(--folderHeaderHoverBg); }
.label { flex: 1; }
.chevron { display: inline-block; font-size: 1.3em; line-height: 1; transition: transform 0.15s; }
.open { transform: rotate(90deg); }
.body { display: flex; flex-direction: column; gap: 12px; padding: 12px; background: var(--folderBodyBg); border-radius: 0 0 6px 6px; }
</style>
