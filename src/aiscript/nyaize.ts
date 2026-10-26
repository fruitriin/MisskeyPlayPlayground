// misskey-js の nyaize を移植したもの
const koRegex1 = /[나-낳]/g;
const koRegex2 = /(다$)|(다(?=\.))|(다(?= ))|(다(?=!))|(다(?=\?))/gm;
const koRegex3 = /(야(?=\?))|(야$)|(야(?= ))/gm;

function ifAfter(prefix: string, fn: (x: string) => string) {
	const preLen = prefix.length;
	const regex = new RegExp(prefix, 'i');
	return (x: string, pos: number, string: string) => {
		return pos > 0 && string.substring(pos - preLen, pos).match(regex) ? fn(x) : x;
	};
}

export function nyaize(text: string): string {
	return text
		// ja-JP
		.replaceAll('な', 'にゃ').replaceAll('ナ', 'ニャ').replaceAll('ﾅ', 'ﾆｬ')
		// en-US
		.replace(/a/gi, ifAfter('n', x => x === 'A' ? 'YA' : 'ya'))
		.replace(/ing/gi, ifAfter('morn', x => x === 'ING' ? 'YAN' : 'yan'))
		.replace(/one/gi, ifAfter('every', x => x === 'ONE' ? 'NYAN' : 'nyan'))
		// ko-KR
		.replace(koRegex1, match => String.fromCharCode(
			match.charCodeAt(0) + '냐'.charCodeAt(0) - '나'.charCodeAt(0),
		))
		.replace(koRegex2, '다냥')
		.replace(koRegex3, '냥');
}
