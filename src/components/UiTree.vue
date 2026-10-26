<template>
<div :class="$style.root">
	<UiTreeNode :component="root" :components="components" :depth="0"/>
</div>
</template>

<script lang="ts" setup>
import type { Ref } from 'vue';
import type { AsUiComponent, AsUiRoot } from '@/aiscript/ui.js';
import UiTreeNode from './UiTreeNode.vue';

defineProps<{
	root: AsUiRoot;
	components: Ref<AsUiComponent>[];
}>();
</script>

<style module>
.root { padding: 8px 0; }
</style>
