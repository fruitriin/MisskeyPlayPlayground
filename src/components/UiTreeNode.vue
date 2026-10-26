<template>
<div>
	<div :class="$style.row" :style="{ paddingLeft: `${12 + depth * 16}px` }" @click="opened = !opened">
		<span :class="$style.chevron">{{ opened ? '▾' : '▸' }}</span>
		<span :class="$style.type">{{ component.type }}</span>
		<span :class="$style.id">#{{ component.id }}</span>
		<span v-if="component.hidden" :class="$style.hidden">hidden</span>
	</div>
	<pre v-if="opened" :class="$style.props" :style="{ marginLeft: `${28 + depth * 16}px` }">{{ stringify(component) }}</pre>
	<UiTreeNode
		v-for="child in childComponents"
		:key="child.id"
		:component="child"
		:components="components"
		:depth="depth + 1"
	/>
</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import type { Ref } from 'vue';
import type { AsUiComponent } from '@/aiscript/ui.js';

defineOptions({ name: 'UiTreeNode' });

const props = defineProps<{
	component: AsUiComponent;
	components: Ref<AsUiComponent>[];
	depth: number;
}>();

const opened = ref(false);

const childComponents = computed(() => (props.component.children ?? [])
	.map(id => props.components.find(c => c.value.id === id)?.value)
	.filter((c): c is AsUiComponent => c != null));

function stringify(c: AsUiComponent) {
	return JSON.stringify(
		{ ...c, type: undefined, id: undefined, children: undefined },
		(_k, v) => typeof v === 'function' ? '<function>' : v,
		2,
	);
}
</script>

<style module>
.row { display: flex; align-items: center; gap: 8px; padding: 3px 12px; cursor: pointer; }
.row:hover { background: var(--editorActiveLine); }
.chevron { width: 1em; color: var(--fgTransparentWeak); }
.type { color: var(--syntaxNamespace); font-weight: bold; }
.id { color: var(--fgTransparentWeak); font-size: 0.9em; }
.hidden { font-size: 0.8em; padding: 0 6px; border-radius: 999px; background: var(--buttonBg); }
.props { margin: 0 12px 6px; padding: 8px; font-size: 12px; border-radius: 6px; background: var(--panel); overflow: auto; }
</style>
