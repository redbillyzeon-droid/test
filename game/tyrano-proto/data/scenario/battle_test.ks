; 戦闘画面の試作：動作確認用のシナリオ
; 探索中に獣と出会って戦闘 → 結果で分岐、という流れを試す

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
