/*
 * Misskey の packages/frontend/src/aiscript/api.ts を元に、playground 向けに書き換えたもの
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { errors, utils, values } from '@syuilo/aiscript';
import { assertStringAndIsIn } from './common.js';
import { nyaize } from './nyaize.js';
import * as os from '@/os.js';
import { settings, effectiveServerUrl, callApi } from '@/settings.js';

const DIALOG_TYPES = [
	'error',
	'info',
	'success',
	'warning',
	'waiting',
	'question',
] as const;

export function aiScriptReadline(q: string): Promise<string> {
	return os.inputText({ title: q }).then(({ result }) => result ?? '');
}

function optionalString(v: values.Value | undefined): string | undefined {
	if (v == null) return undefined;
	if (utils.isString(v)) return v.value;
	utils.assertNull(v);
	return undefined;
}

function dialogType(v: values.Value | undefined, fallback: typeof DIALOG_TYPES[number]): typeof DIALOG_TYPES[number] {
	if (v == null) return fallback;
	if (utils.isString(v)) {
		assertStringAndIsIn(v, DIALOG_TYPES);
		return v.value;
	}
	utils.assertNull(v);
	return fallback;
}

export function createAiScriptEnv(opts: { storageKey: string; customEmojis: unknown[] }) {
	const user = settings.dummyUser;
	const storageKey = (key: string) => `aiscript:${opts.storageKey}:${key}`;

	return {
		USER_ID: user.id ? values.STR(user.id) : values.NULL,
		USER_NAME: user.name ? values.STR(user.name) : values.NULL,
		USER_USERNAME: user.username ? values.STR(user.username) : values.NULL,
		CUSTOM_EMOJIS: utils.jsToVal(opts.customEmojis),
		LOCALE: values.STR(settings.locale),
		SERVER_URL: values.STR(effectiveServerUrl() ?? window.location.origin),
		'Mk:dialog': values.FN_NATIVE(async ([title, text, type]) => {
			await os.alert({
				type: dialogType(type, 'info'),
				title: optionalString(title),
				text: optionalString(text),
			});
			return values.NULL;
		}),
		'Mk:confirm': values.FN_NATIVE(async ([title, text, type]) => {
			const confirm = await os.confirm({
				type: dialogType(type, 'question'),
				title: optionalString(title),
				text: optionalString(text),
			});
			return confirm.canceled ? values.FALSE : values.TRUE;
		}),
		'Mk:toast': values.FN_NATIVE(([text]) => {
			utils.assertString(text);
			os.toast(text.value);
			return values.NULL;
		}),
		'Mk:api': values.FN_NATIVE(async ([ep, param, token]) => {
			utils.assertString(ep);
			if (ep.value.includes('://') || ep.value.includes('..')) {
				throw new errors.AiScriptRuntimeError('invalid endpoint');
			}

			let actualToken: string | null = null;
			if (token != null && !utils.isNull(token)) {
				utils.assertString(token);
				actualToken = token.value;
			}

			if (param == null) {
				throw new errors.AiScriptRuntimeError('expected param');
			}
			utils.assertObject(param);

			return callApi(ep.value, utils.valToJs(param) as Record<string, unknown>, actualToken).then(res => {
				return utils.jsToVal(res);
			}, err => {
				return values.ERROR('request_failed', utils.jsToVal(err instanceof Error ? { message: err.message } : err));
			});
		}),
		'Mk:save': values.FN_NATIVE(([key, value]) => {
			utils.assertString(key);
			utils.expectAny(value);
			localStorage.setItem(storageKey(key.value), JSON.stringify(utils.valToJs(value)));
			return values.NULL;
		}),
		'Mk:load': values.FN_NATIVE(([key]) => {
			utils.assertString(key);
			const raw = localStorage.getItem(storageKey(key.value));
			return utils.jsToVal(raw == null ? null : JSON.parse(raw));
		}),
		'Mk:remove': values.FN_NATIVE(([key]) => {
			utils.assertString(key);
			localStorage.removeItem(storageKey(key.value));
			return values.NULL;
		}),
		'Mk:url': values.FN_NATIVE(() => {
			return values.STR(window.location.href);
		}),
		'Mk:nyaize': values.FN_NATIVE(([text]) => {
			utils.assertString(text);
			return values.STR(nyaize(text.value));
		}),
	};
}
