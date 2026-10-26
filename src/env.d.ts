/// <reference types="vite/client" />
declare module '*.vue' {
	import type { DefineComponent } from 'vue';
	const component: DefineComponent<object, object, unknown>;
	export default component;
}

declare module 'mfm-renderer' {
	import type { Plugin } from 'vue';
	const plugin: Plugin;
	export default plugin;
}
