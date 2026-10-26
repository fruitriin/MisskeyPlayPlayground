// AiScript 公式ドキュメント（docs/ai/aiscript/）と src/reference/play.json から、
// エディタの補完用データ（src/reference/std.json）と AI 向け資料（docs/ai/play-api.md）を作る
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { Interpreter } from '@syuilo/aiscript';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

// "#### @Core:type(_v_: any): str" のような見出しと、その下の説明文を取り出す
function parseDoc(md) {
	const entries = [];
	let current = null;
	let inCode = false;
	for (const line of md.split('\n')) {
		if (line.startsWith('```')) {
			inCode = !inCode;
			continue;
		}
		if (inCode) continue;
		const h = line.match(/^#{3,4} ([@#])(.+)$/);
		if (h) {
			const signature = h[2].replace(/(^|[(\s,])_([^_\s]+)_(?=[\s:,)?=])/g, '$1$2').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/`/g, '').trim();
			current = { mark: h[1], signature, doc: [] };
			entries.push(current);
			continue;
		}
		if (/^#{1,4} /.test(line)) {
			current = null;
			continue;
		}
		if (current && line.trim() !== '') current.doc.push(line.replace(/\s+$/, '').replace(/\\$/, ''));
	}
	return entries.map(e => ({ ...e, doc: e.doc.join('\n').replace(/ {2,}\n/g, '\n').trim() }));
}

const std = [];

for (const file of ['std.md', 'std-math.md']) {
	for (const e of parseDoc(read(`docs/ai/aiscript/${file}`))) {
		const name = e.signature.match(/^[A-Za-z_][\w:]*/)?.[0];
		if (!name) continue;
		const typeLine = e.doc.match(/^型: (.+)$/m);
		std.push({
			name,
			kind: e.mark === '@' ? 'function' : 'constant',
			signature: e.mark === '@' ? e.signature : `${name}: ${typeLine?.[1].replace(/`/g, '') ?? 'value'}`,
			doc: e.doc.replace(/^型: .+\n?/m, '').trim(),
		});
	}
}

// Math の定数は表で書かれているので別に読む
for (const m of read('docs/ai/aiscript/std-math.md').matchAll(/^\| `(Math:\w+)` \| (.+?) \|/gm)) {
	std.push({ name: m[1], kind: 'constant', signature: `${m[1]}: num`, doc: m[2].replace(/\$/g, '') });
}

// 組み込みプロパティ: "@(v: str).to_num(): num | null"
const props = [];
for (const e of parseDoc(read('docs/ai/aiscript/builtin-props.md'))) {
	const m = e.signature.match(/^\((\w+): (\w+)(?:<[^)]*>)?\)\.(\w+)(.*)$/);
	if (!m) continue;
	const typeLine = e.doc.match(/^型: (.+)$/m);
	props.push({
		name: m[3],
		receiver: m[2],
		kind: e.mark === '@' ? 'method' : 'property',
		signature: e.mark === '@' ? `(${m[2]}).${m[3]}${m[4]}` : `(${m[2]}).${m[3]}: ${typeLine?.[1].replace(/`/g, '') ?? 'value'}`,
		doc: e.doc.replace(/^型: .+\n?/m, '').trim(),
	});
}

// ドキュメントにはないが実行時に存在する関数も、名前だけ補完に出す
const documented = new Set(std.map(e => e.name));
const runtimeNames = [...new Interpreter({}).scope.getAll().keys()];
const undocumented = runtimeNames.filter(n => !documented.has(n));
for (const name of undocumented) {
	std.push({ name, kind: 'function', signature: `${name}(...)`, doc: '（公式ドキュメントに記載なし）' });
}
const notInRuntime = std.filter(e => !runtimeNames.includes(e.name) && !['print', 'readline'].includes(e.name)).map(e => e.name);

writeFileSync(new URL('src/reference/std.json', root), JSON.stringify({ functions: std, properties: props }, null, '\t') + '\n');
console.log(`std: ${std.length} 件（ドキュメントなし ${undocumented.length} 件: ${undocumented.join(', ') || 'なし'}）`);
console.log(`ドキュメントにあるが 1.2.1 に存在しない: ${notInRuntime.join(', ') || 'なし'}`);
console.log(`組み込みプロパティ: ${props.length} 件`);

// docs/ai/play-api.md を作る
const play = JSON.parse(read('src/reference/play.json'));
const lines = [
	'<!-- このファイルは scripts/build-reference.mjs が src/reference/play.json から生成する。直接編集しないこと -->',
	'',
	'# Misskey Play API リファレンス',
	'',
	'Misskey の Play（とスクラッチパッド・AiScript App ウィジェット）で、AiScript の標準関数に加えて使える定数と関数の一覧です。',
	'定義は Misskey 本体の `packages/frontend/src/aiscript/ui.ts` と `api.ts` に合わせています。',
	'',
	'## 定数',
	'',
	'| 名前 | 型 | 説明 |',
	'| --- | --- | --- |',
	...play.constants.map(c => `| \`${c.name}\` | \`${c.type.replace(/\|/g, '\\|')}\` | ${c.doc} |`),
	'',
	'## 関数',
	'',
];
for (const f of play.functions) {
	lines.push(`### \`${f.signature}\``, '', f.doc, '');
}
lines.push('## UI 部品（`Ui:C:*`）', '', play.componentCommon.doc, '');
for (const c of play.components) {
	lines.push(`### \`Ui:C:${c.name}(props, id?)\``, '', c.doc, '', '| プロパティ | 型 | 説明 |', '| --- | --- | --- |');
	for (const p of c.props) lines.push(`| \`${p.name}\` | \`${p.type.replace(/\|/g, '\\|')}\` | ${p.doc} |`);
	lines.push('');
}
writeFileSync(new URL('docs/ai/play-api.md', root), lines.join('\n'));
console.log('docs/ai/play-api.md を書き出しました');

// サンプルを .ais として書き出す（AI が実例として読めるように）
const { samples } = await import('../src/samples.ts');
rmSync(new URL('docs/ai/examples/', root), { recursive: true, force: true });
mkdirSync(new URL('docs/ai/examples/', root), { recursive: true });
for (const sample of samples) {
	// Misskey は 1 行目の `/// @ 1.2.1` しか読まないので、タイトルはその後ろに入れる
	const [first, ...rest] = sample.code.split('\n');
	const body = first.startsWith('/// @') ? [first, `// ${sample.title}`, ...rest] : [`// ${sample.title}`, first, ...rest];
	writeFileSync(new URL(`docs/ai/examples/${sample.id}.ais`, root), body.join('\n'));
}
// ガイドの例（docs/guide/examples）も書き出す
const copyAis = (dir, prefix) => readdirSync(new URL(dir, root)).filter(f => f.endsWith('.ais')).map(f => {
	const name = `${prefix}${f}`;
	writeFileSync(new URL(`docs/ai/examples/${name}`, root), readFileSync(new URL(dir + f, root)));
	return { name, title: readFileSync(new URL(dir + f, root), 'utf8').split('\n').find(l => l.startsWith('// '))?.slice(3) ?? f };
});
const guideExamples = copyAis('docs/guide/examples/', 'guide-');
writeFileSync(new URL('docs/ai/examples/README.md', root), [
	'<!-- scripts/build-reference.mjs が src/samples.ts から生成する -->',
	'# サンプル一覧',
	'',
	'どれも AiScript 1.2.1 と、この playground のモック API で動作を確認しています。',
	'',
	...samples.map(s => `- [${s.title}](${s.id}.ais)`),
	'',
	'## ガイドの例（docs/guide/minigame.md で使っているもの）',
	'',
	...guideExamples.map(g => `- [${g.title}](${g.name})`),
	'',
].join('\n'));
console.log(`docs/ai/examples/ に サンプル ${samples.length} 件・ガイドの例 ${guideExamples.length} 件を書き出しました`);

// 公開サイトでも読めるよう、docs/ai を public/ai にコピーする（public/ai は git 管理外）
rmSync(new URL('public/ai/', root), { recursive: true, force: true });
cpSync(new URL('docs/ai/', root), new URL('public/ai/', root), { recursive: true });
