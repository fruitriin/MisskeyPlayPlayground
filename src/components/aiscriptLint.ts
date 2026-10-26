// エディタに静的チェック（src/lint/lint.ts）の結果を波線で出す
import { linter, lintGutter } from '@codemirror/lint';
import type { Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { lint } from '@/lint/lint.js';

export const aiscriptLinter = [
	linter(view => {
		const doc = view.state.doc;
		const toPos = (line: number, column: number) => {
			const l = doc.line(Math.min(Math.max(line, 1), doc.lines));
			return Math.min(l.from + Math.max(column - 1, 0), l.to);
		};
		return lint(doc.toString()).map((d): CmDiagnostic => {
			const from = toPos(d.line, d.column);
			let to = toPos(d.endLine, d.endColumn);
			// 終わりの位置がないときは、その位置の単語の終わりまでにする
			if (to <= from) {
				const line = doc.lineAt(from);
				const rest = line.text.slice(from - line.from);
				to = from + Math.max(1, rest.match(/^[\w:.]+/)?.[0].length ?? 1);
				to = Math.min(to, line.to);
			}
			return { from, to: Math.max(to, from), severity: d.severity, source: d.rule, message: d.message };
		});
	}, { delay: 600 }),
	lintGutter(),
];
