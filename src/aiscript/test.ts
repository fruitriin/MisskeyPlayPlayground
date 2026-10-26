// playground にだけある定数 PLAYGROUND と、テスト用の関数 Test:*（Misskey 本体にはない）。
// コードでは `if exists PLAYGROUND { ... }` の中でだけ使えば、Misskey に貼っても害がない
import { errors, utils, values } from '@syuilo/aiscript';

export type TestResult = { name: string; ok: boolean; messages: string[] };

type Call = (fn: values.VFn, args: values.Value[]) => Promise<values.Value>;

function show(v: values.Value): string {
	return utils.valToString(v, true);
}

function same(a: values.Value, b: values.Value): boolean {
	return JSON.stringify(utils.valToJs(a)) === JSON.stringify(utils.valToJs(b));
}

export function createTestLib(onResult: (result: TestResult) => void) {
	// いま実行している Test:check。外で Test:eq などを呼んだときは null
	let current: TestResult | null = null;

	const record = (ok: boolean, message: string) => {
		if (current) {
			if (!ok) {
				current.ok = false;
				current.messages.push(message);
			}
		} else {
			onResult({ name: message, ok, messages: [] });
		}
	};

	return {
		PLAYGROUND: values.TRUE,
		'Test:check': values.FN_NATIVE(async ([name, fn], opts) => {
			utils.assertString(name);
			utils.assertFunction(fn);
			const parent = current;
			const result: TestResult = { name: name.value, ok: true, messages: [] };
			current = result;
			try {
				await (opts.call as Call)(fn, []);
			} catch (err) {
				result.ok = false;
				result.messages.push(`実行時エラー: ${err instanceof errors.AiScriptError ? err.message.split('\n')[0] : String(err)}`);
			} finally {
				current = parent;
			}
			onResult(result);
			return values.BOOL(result.ok);
		}),
		'Test:eq': values.FN_NATIVE(([actual, expected, label]) => {
			utils.expectAny(actual);
			utils.expectAny(expected);
			const ok = same(actual, expected);
			const prefix = label && utils.isString(label) ? `${label.value}: ` : '';
			record(ok, ok ? `${prefix}${show(actual)}` : `${prefix}期待 ${show(expected)} / 実際 ${show(actual)}`);
			return values.BOOL(ok);
		}),
		'Test:ne': values.FN_NATIVE(([actual, unexpected, label]) => {
			utils.expectAny(actual);
			utils.expectAny(unexpected);
			const ok = !same(actual, unexpected);
			const prefix = label && utils.isString(label) ? `${label.value}: ` : '';
			record(ok, ok ? `${prefix}${show(actual)}` : `${prefix}${show(unexpected)} 以外を期待したが、同じだった`);
			return values.BOOL(ok);
		}),
		'Test:ok': values.FN_NATIVE(([cond, label]) => {
			utils.assertBoolean(cond);
			const prefix = label && utils.isString(label) ? label.value : '条件';
			record(cond.value, cond.value ? prefix : `${prefix} が false だった`);
			return cond;
		}),
	};
}
