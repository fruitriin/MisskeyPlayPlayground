// 画面と AI 向けの操作 API が使うサンプルの一覧（通常のサンプルとミニゲーム）
import { samples } from './samples.js';
import { games } from './games/index.js';

export const sampleGroups = [
	{ label: 'サンプル', items: samples },
	{ label: 'ミニゲーム', items: games },
];

export const allSamples = [...samples, ...games];
