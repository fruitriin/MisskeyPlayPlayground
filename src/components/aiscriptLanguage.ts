// CodeMirror 用の AiScript の簡易トークナイザー
import { StreamLanguage } from '@codemirror/language';
import type { StringStream } from '@codemirror/language';

const KEYWORDS = new Set([
	'let', 'var', 'fn', 'if', 'elif', 'else', 'return', 'each', 'for', 'loop', 'do', 'while',
	'break', 'continue', 'match', 'case', 'default', 'eval', 'exists', 'export', 'meta', 'attr',
]);
const ATOMS = new Set(['true', 'false', 'null']);

type State = {
	inBlockComment: boolean;
	// テンプレート文字列の中で {} に入っている深さ。stack の要素は中括弧のネスト数
	templateStack: number[];
	inTemplate: boolean;
};

function tokenTemplate(stream: StringStream, state: State): string {
	while (!stream.eol()) {
		const ch = stream.next();
		if (ch === '\\') {
			stream.next();
		} else if (ch === '`') {
			state.inTemplate = false;
			return 'string';
		} else if (ch === '{') {
			state.inTemplate = false;
			state.templateStack.push(0);
			return 'string';
		}
	}
	return 'string';
}

export const aiscript = StreamLanguage.define<State>({
	name: 'aiscript',
	startState: () => ({ inBlockComment: false, templateStack: [], inTemplate: false }),
	token(stream, state) {
		if (state.inBlockComment) {
			if (stream.skipTo('*/')) {
				stream.match('*/');
				state.inBlockComment = false;
			} else {
				stream.skipToEnd();
			}
			return 'comment';
		}
		if (state.inTemplate) return tokenTemplate(stream, state);
		if (stream.eatSpace()) return null;

		if (stream.match('//')) {
			stream.skipToEnd();
			return 'comment';
		}
		if (stream.match('/*')) {
			state.inBlockComment = true;
			return 'comment';
		}
		if (stream.match('###')) return 'meta';
		if (stream.match('<:')) return 'keyword';

		const ch = stream.peek();
		if (ch === '"' || ch === '\'') {
			stream.next();
			let escaped = false;
			while (!stream.eol()) {
				const c = stream.next();
				if (c === ch && !escaped) break;
				escaped = !escaped && c === '\\';
			}
			return 'string';
		}
		if (ch === '`') {
			stream.next();
			state.inTemplate = true;
			return tokenTemplate(stream, state);
		}
		if (ch === '{' && state.templateStack.length > 0) {
			stream.next();
			state.templateStack[state.templateStack.length - 1]++;
			return 'bracket';
		}
		if (ch === '}' && state.templateStack.length > 0) {
			stream.next();
			const depth = state.templateStack[state.templateStack.length - 1];
			if (depth === 0) {
				state.templateStack.pop();
				state.inTemplate = true;
				return 'string';
			}
			state.templateStack[state.templateStack.length - 1]--;
			return 'bracket';
		}
		if (stream.match(/^\d+(\.\d+)?/)) return 'number';
		if (ch === '#') {
			stream.next();
			stream.match(/^\[?/);
			return 'meta';
		}
		if (stream.match(/^@/)) return 'keyword';

		// Ui:C:text や Mk:dialog のような名前空間付きの識別子
		const ns = stream.match(/^[A-Za-z_][A-Za-z0-9_]*(:[A-Za-z_][A-Za-z0-9_]*)+/);
		if (ns) return 'namespace';

		const word = stream.match(/^[A-Za-z_][A-Za-z0-9_]*/) as RegExpMatchArray | null;
		if (word) {
			const w = word[0];
			if (KEYWORDS.has(w)) return 'keyword';
			if (ATOMS.has(w)) return 'atom';
			if (stream.peek() === '(') return 'variableName.function';
			if (/^[A-Z][A-Z0-9_]*$/.test(w)) return 'variableName.constant';
			return 'variableName';
		}
		stream.next();
		return /[{}[\]()]/.test(ch ?? '') ? 'bracket' : 'operator';
	},
	languageData: {
		commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
		closeBrackets: { brackets: ['(', '[', '{', '"', '\'', '`'] },
		indentOnInput: /^\s*[}\]]$/,
	},
});
