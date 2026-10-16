; 会話画面（日常パート）の試作：動作確認用のシナリオ

*start
[cm]
[clearfix]
[loadcss file="./data/others/adv_ui/adv.css"]
[loadjs storage="adv_ui/adv_ui.js"]

; 日付と時間帯を変えるマクロ（f.day / f.slot / f.weather / f.next_hint に入れて、表示を更新する）
[macro name="adv_date"]
[iscript]
AdvUI.setDate(mp.day, mp.slot, mp.weather, mp.next);
[endscript]
[endmacro]

; 背景と立ち絵（仮の画像。本番は NovelAI の絵）
[bg storage="proto_beach_day.png" time=0]
[chara_new name="konoha" storage="chara/proto/konoha.png" jname="コノハ"]
[chara_new name="noctia" storage="chara/proto/noctia.png" jname="ノクティア"]

; 会話の枠：黒い、斜めに切った吹き出し（形は adv.css の clip-path）
[position layer="message0" left=300 top=516 width=900 height=170 page=fore visible=true frame="none" color="0x111111" opacity=255]
[position layer="message0" page=fore margint=46 marginl=80 marginr=90 marginb=20]
[deffont size=24 color="0xffffff"]
[resetfont]

; 名前の札
[ptext name="chara_name_area" layer="message0" color="0x111111" size=24 x=330 y=490]
[chara_config ptext="chara_name_area"]

[iscript]
AdvUI.init({
    theme: "A",
    speakers: {
        "コノハ":     { color: "#d9822b", tag: "#ffd9a8" },
        "ノクティア": { color: "#7a1e34", tag: "#f3c6cf" },
        "ユウ":       { bust: false },
    },
});
[endscript]

[adv_date day=5 slot="noon" weather="晴れ" next="作業台を建てると、松明が作れる"]
@layopt layer=message0 visible=true

[chara_show name="konoha" left=480 top=40 time=300]

#コノハ
ユウ、見て見て！　でっかい魚！[r]
今日のごはんは、ボクが獲ったんだよ！[p]

#ユウ
すごいな、コノハ。こんなに大きいの、どうやって獲ったんだ？[p]

#コノハ
えへへ。しっぽで、こう……ばしゃーん！って！[p]

#
砂浜に、コノハのしっぽの跡が、くっきり残っていた。[p]

; 時間帯を夜に変える
[adv_date slot="night" next="夜は、洞窟でノクティアに会える"]
[chara_hide name="konoha" time=300]
[chara_show name="noctia" left=500 top=40 time=300]

#ノクティア
あら、坊や。こんな夜更けに、わたくしに会いに来たの？[p]

#
会話画面のテストは終わりです。[p]
@jump storage="test_menu.ks"
