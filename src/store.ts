// エディタのコード。画面と AI 向けの操作 API の両方から読み書きする
import { ref, watch } from 'vue';
import { samples } from './samples.js';

const CODE_KEY = 'aiscript-playground:code';

function load(): string | null {
	try {
		return localStorage.getItem(CODE_KEY);
	} catch {
		return null;
	}
}

export const code = ref(load() ?? samples[0].code);

watch(code, v => {
	try {
		localStorage.setItem(CODE_KEY, v);
	} catch {
		// 保存できない環境では何もしない
	}
});
