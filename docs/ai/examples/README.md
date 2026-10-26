<!-- scripts/build-reference.mjs が src/samples.ts から生成する -->
# サンプル一覧

どれも AiScript 1.2.1 と、この playground のモック API で動作を確認しています。

- [ゲームのひな形（中身が上・部品とテストが下）](template.ais)
- [はじめての UI](hello.ais)
- [カウンター（update）](counter.ais)
- [フォーム部品ひとそろい](forms.ais)
- [container の装飾](container.ais)
- [MFM の clickable](clickable.ais)
- [おみくじ（Play の定番）](omikuji.ais)
- [ダイアログと入力](dialogs.ais)
- [Mk:save / Mk:load](storage.ais)
- [投稿フォーム](postform.ais)
- [Mk:api でサーバー情報](api.ais)
- [タイムラインとリアクション（Mk:api）](timeline.ais)
- [コンソール出力だけ](console.ais)

## ガイドの例（docs/guide/minigame.md で使っているもの）

- [数当てゲーム: 状態（答えと回数）→ 操作（ボタン）→ 表示の更新、の基本の形](guide-guess.ais)
- [盤面を絵文字で描き、マスのタップで操作する。タップしたマスと上下左右の色が反転する](guide-lights.ais)
- [時間で動かす: Async:interval は止めるための関数を返す](guide-timer.ais)
