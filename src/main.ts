import { computed, createApp } from 'vue';
import MfmPlugin from 'mfm-renderer';
import 'mfm-renderer/style.css';
import App from './App.vue';
import { normalizedServerUrl } from './settings.js';
import { customEmojiMap } from './runner.js';
import { installAiBridge } from './aiBridge.js';
import './style.css';

const app = createApp(App);
app.use(MfmPlugin);
// mfm-renderer はメンションとカスタム絵文字の解決に、これらを inject して使う
// モック利用中は null になり、メンションのアバター取得をしない
app.provide('domain', computed(() => normalizedServerUrl()?.replace(/^https?:\/\//, '') ?? null));
app.provide('emojis', customEmojiMap);
app.provide('debugMode', false);
app.mount('#app');
installAiBridge();
