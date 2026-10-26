// AiScript のファイルを静的チェックする: node scripts/lint-ais.mjs ファイル.ais [...]
// 問題がなければ終了コード 0、エラーがあれば 1 を返す
import { readFileSync } from 'node:fs';
import { lint } from '../src/lint/lint.ts';

const files = process.argv.slice(2);
if (files.length === 0) {
	console.error('使い方: npm run lint:ais -- ファイル.ais [...]');
	process.exit(2);
}
let errors = 0;
for (const file of files) {
	const diagnostics = lint(readFileSync(file, 'utf8'));
	for (const d of diagnostics) {
		console.log(`${file}:${d.line}:${d.column} ${d.severity} [${d.rule}] ${d.message}`);
		if (d.severity === 'error') errors++;
	}
	if (diagnostics.length === 0) console.log(`${file}: 問題なし`);
}
process.exit(errors > 0 ? 1 : 0);
