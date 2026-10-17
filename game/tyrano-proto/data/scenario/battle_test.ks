; 戦闘画面の試作：動作確認用のシナリオ
; *start   ：探索中に獣と出会って戦闘 → 結果で分岐、という流れを試す（数字は試作のまま、直接渡す）
; *explore ：探索の1戦（大イノシシ、相棒コノハ段階1）。数字は docs/game/design/battle.md の既定値
; *final   ：決戦の前半 → 割り込み → 中盤・後半（仮の会話） → 決着、の流れ

*start
[cm]
[loadcss file="./data/others/island_battle/battle.css"]
[loadjs storage="island_battle/battle.js"]

[layopt layer="message0" visible=true]
森の奥で、茂みが大きく揺れた。[p]
コノハ「ユウ、下がって！　何か来る！」[p]
[cm]

[layopt layer="message0" visible=false]
[iscript]
IslandBattle.start({
    enemyName: "森の獣",
    enemies: [
        { name: "大イノシシ", hp: 40, atk: 8 },
        { name: "森のぬし",   hp: 90, atk: 12 },
        { name: "大イノシシ", hp: 40, atk: 8 },
    ],
    party: [
        { name: "ユウ",   hp: 120, mind: 40, atk: 14, color: "#4a5568" },
        { name: "コノハ", hp: 100, mind: 60, atk: 12, color: "#d9822b", skill: { name: "狐火", power: 22 } },
    ],
    items: { herb: 2, medicine: 0 },
    returnStorage: "battle_test.ks",
    returnTarget: "*after_battle",
});
[endscript]
[s]

*after_battle
[layopt layer="message0" visible=true]
[cm]
[if exp="f.battle_result == 'win'"]
コノハ「やったー！　ユウ、けがしてない？」[p]
[jump target="*end"]
[endif]
コノハ「ユウ！　しっかりして！」[p]

*end
[cm]
戦闘のテストは終わりです。結果：[emb exp="f.battle_result"][p]
[s]

; ---------------------------------------------------------------------------
; 探索の1戦：森-X1（大イノシシ）。相棒にコノハ（段階1）を誘っている
; 能力値は f から読む（ないときは battle.md 1-1 の初期値）。ここでは試験用に値を入れる
*explore
[cm]
[loadcss file="./data/others/island_battle/battle.css"]
[loadjs storage="island_battle/battle.js"]
[iscript]
f.hp = 10; f.str = 1; f.mind = 2; f.dex = 1; f.wis = 1; f.train_count = 0;
f.ev_konoha = 1; f.konoha_tails = 2;
f.item_herb = 2; f.item_medicine = 0; f.item_food = 0;
f.explore_partner = "konoha";
[endscript]

[layopt layer="message0" visible=true]
茂みの奥で、低いうなり声がした。……何かが、こっちを見ている。[p]
コノハ「ユウ、うしろにいて！　ボク、速いから！」[p]
[cm]

*explore_battle
[layopt layer="message0" visible=false]
[iscript]
IslandBattle.start({
    mode: "explore",
    partner: f.explore_partner,
    enemies: ["boar"],
    returnStorage: "battle_test.ks",
    returnTarget: "*explore_after",
});
[endscript]
[s]

*explore_after
[layopt layer="message0" visible=true]
[cm]
[if exp="f.battle_result == 'win'"]
大イノシシは、茂みの奥へ逃げていった。牙で掘り返した地面に、芋が転がっている。[p]
コノハ「やったー！　ユウ、見てた？　ボク、役に立った？」[p]
[else]
突き飛ばされて、気づくと森の入り口に倒れていた。なんとか拠点まで歩いて帰った。[p]
コノハ「うう……ごめんね、ユウ。次は、ぜったい勝つから！」[p]
[endif]
[cm]
探索のテストは終わりです。結果：[emb exp="f.battle_result"]　食料：[emb exp="f.item_food"]　体力：[emb exp="f.hp"]　薬草：[emb exp="f.item_herb"][p]
[s]

; ---------------------------------------------------------------------------
; 決戦：前半 → 割り込み → 中盤 → 後半 → 決着（会話は仮の1行と選択肢）
; 試験用の値：相棒コノハ段階4、力6、心3、発展度4（かまど、作業台、家、見張り台）、手がかりあり
*final
[cm]
[loadcss file="./data/others/island_battle/battle.css"]
[loadjs storage="island_battle/battle.js"]
[iscript]
f.str = 6; f.mind = 3; f.dex = 2; f.wis = 2; f.train_count = 3;
f.partner = "konoha"; f.ev_konoha = 4; f.konoha_tails = 4; f.konoha_resolve = 0; f.partner_wavering = 0;
f.item_herb = 2; f.item_medicine = 1;
f.built_stove = 1; f.built_workbench = 1; f.built_house = 1; f.built_tower = 1; f.built_field = 0; f.built_dock = 0;
f.dev = 4;
f.workbench_broken = 0;
f.clue_old_diary = 1;
f.final_mind_zero = 0;
f.final_retry_used = 0;
IslandBattle.retries = 0;
[endscript]
[layopt layer="message0" visible=true]
カイ「さあ、始めようか」（仮）[p]
[cm]

*final_first
[layopt layer="message0" visible=false]
[iscript]
IslandBattle.start({
    mode: "final",
    phase: "first",
    returnStorage: "battle_test.ks",
    returnTarget: "*final_mid",
    wipeTarget: "*final_first_down",
});
[endscript]
[s]

; 前半で全員倒れたとき（f.battle_result = "wipe"。罰なし。「もう一度」で前半の最初から）
*final_first_down
[layopt layer="message0" visible=true]
[cm]
視界が、端のほうから黒くなっていく。……まだだ。まだ、終われない。（仮）[p]
[glink color="black" size=24 x=440 y=240 width=400 text="もう一度" target="*final_first_retry"]
[glink color="black" size=24 x=440 y=320 width=400 text="タイトルに戻る" target="*final_to_title"]
[s]
*final_first_retry
[cm]
[layopt layer="message0" visible=false]
[iscript]
IslandBattle.retry();
[endscript]
[s]

; 中盤：相棒への誘い
*final_mid
[layopt layer="message0" visible=true]
[cm]
カイ「……強いね。じゃあ、少しだけ、思い出させてあげよう」（仮）[p]
[if exp="f[f.partner + '_resolve'] == 1"]
コノハ「いらない。ボクは、ユウといる」（仮。段階5：はっきり断る）[p]
[iscript]
IslandBattle.addBond(f.battle_state);
[endscript]
[jump target="*final_late"]
[endif]
[if exp="f['ev_' + f.partner] <= 3 || f.partner_wavering == 1"]
[jump target="*mid_lost"]
[endif]
*mid_choice
[cm]
[glink color="black" size=22 x=340 y=240 width=600 text="（正しい言葉）お前は、お前のままでいい（仮）" target="*mid_right"]
[glink color="black" size=22 x=340 y=340 width=600 text="（まちがえる）行きたいなら、行けばいい（仮）" target="*mid_wrong"]
[s]
*mid_right
[cm]
[iscript]
IslandBattle.addBond(f.battle_state, 3);
[endscript]
コノハ「……ううん。ボクは、ここにいる！」（仮）[p]
[jump target="*final_late"]
*mid_wrong
[cm]
[if exp="f.dev >= 4 && f.final_retry_used != 1"]
[eval exp="f.final_retry_used = 1"]
島のみんなの声が聞こえた。……もう一度、言葉を選べる。（仮）[p]
[jump target="*mid_choice"]
[endif]
*mid_lost
[cm]
相棒が、幻に負けた。（仮。コノハなら NTR エンド、ほかは鬱エンド）[p]
[jump target="*final_test_end"]

; 後半：主人公への誘い。判定値が2以下なら、選択肢は1つだけ（plan.md 2026-10-17）
*final_late
[cm]
[iscript]
tf.judge = Number(f.mind) - (f.final_mind_zero == 1 ? 1 : 0);
tf.has_clue = (f.clue_old_diary == 1 || f.clue_tally_marks == 1) ? 1 : 0;
[endscript]
カイ「ミサキを、取り戻したくはないか」（仮）[p]
[glink color="black" size=22 x=340 y=200 width=600 text="……ミサキを、取り戻したい" target="*late_lost"]
[if exp="tf.judge >= 3"]
[glink color="black" size=22 x=340 y=300 width=600 text="コノハ！" target="*late_name"]
[if exp="tf.has_clue == 1"]
[glink color="black" size=22 x=340 y=400 width=600 text="お前も、勝てなかったんだろう。自分自身に" target="*late_clue"]
[endif]
[endif]
[s]
*late_lost
[cm]
鬱エンド（仮）。[p]
[jump target="*final_test_end"]
*late_clue
[cm]
[iscript]
IslandBattle.addBond(f.battle_state, 2);
[endscript]
カイ「……っ」（仮。絆ゲージ +2）[p]
[jump target="*final_finish"]
*late_name
[cm]
コノハ「うん！　ボク、ここにいるよ！」（仮）[p]

; 決着：前半の終わりの状態（中盤・後半で足した絆ゲージ込み）から再開
*final_finish
[cm]
[layopt layer="message0" visible=false]
[iscript]
IslandBattle.start({
    mode: "final",
    phase: "finish",
    resumeState: f.battle_state,
    returnStorage: "battle_test.ks",
    returnTarget: "*final_end",
    wipeTarget: "*final_finish_down",
});
[endscript]
[s]

*final_finish_down
[layopt layer="message0" visible=true]
[cm]
膝が、床についた。……ああ。立つさ。（仮）[p]
[glink color="black" size=24 x=440 y=240 width=400 text="もう一度" target="*final_finish_retry"]
[glink color="black" size=24 x=440 y=320 width=400 text="タイトルに戻る" target="*final_to_title"]
[s]
*final_finish_retry
[cm]
[layopt layer="message0" visible=false]
[iscript]
IslandBattle.retry();
[endscript]
[s]

; タイトルに戻る（試作では、確認メニューに戻る。本番ではタイトル画面へ）
*final_to_title
[cm]
[layopt layer="message0" visible=false]
@jump storage="test_menu.ks"

*final_end
[layopt layer="message0" visible=true]
[cm]
カイ「……俺は、選べなかったのにな」（仮。決着で勝った）[p]

*final_test_end
[cm]
決戦のテストは終わりです。結果：[emb exp="f.battle_result"][p]
[s]
