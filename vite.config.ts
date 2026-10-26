import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	base: './',
	plugins: [vue()],
	resolve: {
		// mfm-renderer などのライブラリと Vue が2重に読み込まれないようにする
		dedupe: ['vue'],
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
});
