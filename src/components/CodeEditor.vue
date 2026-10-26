<template>
<div ref="el" :class="$style.root"/>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { aiscript } from './aiscriptLanguage.js';
import { aiscriptAutocomplete, aiscriptHover } from './aiscriptCompletion.js';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{
	(e: 'update:modelValue', v: string): void;
	(e: 'run'): void;
}>();

const el = ref<HTMLElement>();
let view: EditorView | null = null;

const highlight = HighlightStyle.define([
	{ tag: t.keyword, color: 'var(--syntaxKeyword)', fontWeight: 'bold' },
	{ tag: t.comment, color: 'var(--syntaxComment)', fontStyle: 'italic' },
	{ tag: t.string, color: 'var(--syntaxString)' },
	{ tag: t.number, color: 'var(--syntaxNumber)' },
	{ tag: t.atom, color: 'var(--syntaxNumber)' },
	{ tag: t.namespace, color: 'var(--syntaxNamespace)' },
	{ tag: t.function(t.variableName), color: 'var(--syntaxFunction)' },
	{ tag: t.constant(t.variableName), color: 'var(--syntaxConstant)' },
	{ tag: t.meta, color: 'var(--syntaxMeta)' },
]);

const theme = EditorView.theme({
	'&': { height: '100%', fontSize: '14px', color: 'var(--fg)', backgroundColor: 'var(--editorBg)' },
	'.cm-scroller': { fontFamily: 'Fira Code, Menlo, Consolas, monospace', lineHeight: '1.6' },
	'.cm-content': { caretColor: 'var(--accent)' },
	'.cm-gutters': { backgroundColor: 'var(--editorBg)', color: 'var(--fgTransparentWeak)', border: 'none' },
	'.cm-activeLine': { backgroundColor: 'var(--editorActiveLine)' },
	'.cm-activeLineGutter': { backgroundColor: 'var(--editorActiveLine)' },
	'&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--editorSelection) !important' },
	'&.cm-focused': { outline: 'none' },
	'.cm-tooltip': { backgroundColor: 'var(--panel)', color: 'var(--fg)', border: 'solid 1px var(--divider)', borderRadius: '6px' },
	'.cm-tooltip-hover': { overflow: 'hidden' },
	'.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent)', color: 'var(--fgOnAccent)' },
	'.cm-completionDetail': { opacity: 0.6, marginLeft: '0.5em', fontStyle: 'normal' },
	'.cm-completionInfo': { maxWidth: '420px' },
	'.as-hint': { padding: '6px 8px', maxWidth: '420px', maxHeight: '260px', overflowY: 'auto', fontFamily: 'inherit' },
	'.as-hint-signature': { display: 'block', whiteSpace: 'pre-wrap', fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' },
	'.as-hint-doc': { whiteSpace: 'pre-wrap', fontSize: '12px', lineHeight: '1.5' },
	'.cm-matchingBracket': { backgroundColor: 'var(--editorSelection)', outline: 'none' },
});

onMounted(() => {
	view = new EditorView({
		parent: el.value!,
		state: EditorState.create({
			doc: props.modelValue,
			extensions: [
				lineNumbers(),
				highlightActiveLine(),
				highlightActiveLineGutter(),
				drawSelection(),
				history(),
				bracketMatching(),
				closeBrackets(),
				indentOnInput(),
				indentUnit.of('\t'),
				EditorState.tabSize.of(2),
				aiscript,
				aiscriptAutocomplete,
				aiscriptHover,
				syntaxHighlighting(highlight),
				theme,
				keymap.of([
					{ key: 'Mod-Enter', run: () => { emit('run'); return true; } },
					{ key: 'Mod-s', run: () => { emit('run'); return true; } },
					...closeBracketsKeymap,
					...completionKeymap,
					...defaultKeymap,
					...historyKeymap,
					indentWithTab,
				]),
				EditorView.updateListener.of(update => {
					if (update.docChanged) emit('update:modelValue', update.state.doc.toString());
				}),
			],
		}),
	});
});

watch(() => props.modelValue, v => {
	if (view && v !== view.state.doc.toString()) {
		view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
	}
});

onBeforeUnmount(() => view?.destroy());
</script>

<style module>
.root { height: 100%; overflow: hidden; }
.root :global(.cm-editor) { height: 100%; }
</style>
