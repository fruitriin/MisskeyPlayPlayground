// ミニゲームのサンプル。コードは .ais ファイルにそのまま書く
import sokoban from './sokoban.ais?raw';
import type { Sample } from '../samples.js';

export const games: Sample[] = [
	{ id: 'sokoban', title: '倉庫番', code: sokoban },
];
