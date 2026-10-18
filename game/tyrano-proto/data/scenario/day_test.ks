; 1日の流れの画面の試作：動作確認用のシナリオ（ティラノビルダーでは未確認）
; 決まった f の値（docs/game/design/life-bond.md 6-2 の真エンドの計画の途中の日、screens.md 3-3 の例）を入れて、画面を開く。
; 画面と計算は data/others/day_ui/（rules.js・day_save.js・day_ui.js）。

*start
[cm]
[clearfix]
[loadcss file="./data/others/adv_ui/adv.css"]
[loadcss file="./data/others/day_ui/day_ui.css"]
[loadjs storage="adv_ui/adv_ui.js"]
[loadjs storage="day_ui/rules.js"]
[loadjs storage="day_ui/day_save.js"]
[loadjs storage="day_ui/day_ui.js"]

[bg storage="proto_beach_day.png" time=0]
[position layer="message0" left=300 top=516 width=900 height=170 page=fore visible=true frame="none" color="0x111111" opacity=255]
[position layer="message0" page=fore margint=46 marginl=80 marginr=90 marginb=20]
[deffont size=24 color="0xffffff"]
[resetfont]
[ptext name="chara_name_area" layer="message0" color="0x111111" size=24 x=330 y=490]
[chara_config ptext="chara_name_area"]

[iscript]
DayUI.init({ storage: "day_test.ks" });
AdvUI.init({ speakers: { "ユウ": { bust: false } } });
AdvUI.hide();
DayUI.closeAll();
[endscript]
@layopt layer=message0 visible=false

*menu
[cm]
[glink color="black" size=20 x=80 y=60 width=540 text="真エンドの計画：2日目・昼（作業台）" target="*p_plan2_noon"]
[glink color="black" size=20 x=80 y=130 width=540 text="真エンドの計画：2日目・夜（イグニアに魚）" target="*p_plan2_night"]
[glink color="black" size=20 x=80 y=200 width=540 text="真エンドの計画：9日目・朝" target="*p_plan9"]
[glink color="black" size=20 x=80 y=270 width=540 text="3-3 (b)：9日目・夜（このあと K4）" target="*p_b9"]
[glink color="black" size=20 x=660 y=60 width=540 text="3-3 (c)：12日目・朝（K1）" target="*p_c12k1"]
[glink color="black" size=20 x=660 y=130 width=540 text="3-3 (c)：12日目・朝（K2）" target="*p_c12k2"]
[glink color="black" size=20 x=660 y=200 width=540 text="5日目・昼・雨（直す）" target="*p_rain5"]
[glink color="black" size=20 x=660 y=270 width=540 text="真エンドの計画：12日目・昼（13・14日目へ）" target="*p_plan12"]
[glink color="black" size=20 x=80 y=380 width=540 text="自動の枠から読み込む" target="*load"]
[glink color="black" size=20 x=80 y=450 width=540 text="11日目・夜（このあと K1 と K3）" target="*p_k1k3"]
[glink color="black" size=20 x=660 y=380 width=540 text="テストのメニューに戻る" target="*back"]
[s]

*p_plan2_noon
[iscript]
DayUI.preset("plan2_noon");
[endscript]
@jump target="*day_screen"
*p_plan2_night
[iscript]
DayUI.preset("plan2_night");
[endscript]
@jump target="*day_screen"
*p_plan9
[iscript]
DayUI.preset("plan9");
[endscript]
@jump target="*day_screen"
*p_b9
[iscript]
DayUI.preset("b9");
[endscript]
@jump target="*day_screen"
*p_c12k1
[iscript]
DayUI.preset("c12k1");
[endscript]
@jump target="*day_screen"
*p_c12k2
[iscript]
DayUI.preset("c12k2");
[endscript]
@jump target="*day_screen"
*p_k1k3
[iscript]
DayUI.preset("k1k3");
[endscript]
@jump target="*day_screen"
*p_rain5
[iscript]
DayUI.preset("rain5");
[endscript]
@jump target="*day_screen"
*p_plan12
[iscript]
DayUI.preset("plan12");
[endscript]
@jump target="*day_screen"

*load
[cm]
[iscript]
DayUI.openLoad(function () { DayUI.jump("*menu"); });
[endscript]
[s]

*back
@jump storage="test_menu.ks"

; ---- 1日の流れ ----
; 朝：自動セーブA（2〜12日目。枠は1つで、毎朝上書き）→ 朝の記録 → 行動を選ぶ画面
*day_begin
[cm]
@layopt layer=message0 visible=false
[li_autosave slot="A"]
[iscript]
DayUI.beginDay();
[endscript]

*day_screen
[cm]
@layopt layer=message0 visible=false
[iscript]
DayUI.show();
[endscript]
[s]

; 13日目の朝：自動セーブB（試作では、13日目の場面を省略して14日目へ）
*day13
[cm]
[li_autosave slot="B"]
[iscript]
AdvUI.show();
AdvUI.setDate(13, "morning", "晴れ", "");
[endscript]
@layopt layer=message0 visible=true
#
13日目の朝。（試作：自動セーブ「13日目の朝」を書いた。13日目の場面は省略）[p]
[iscript]
TYRANO.kag.stat.f.day = 14;
[endscript]

; 14日目・夜明け前：相棒が決まったあと。自動セーブC。ここから手動セーブを止める（f.day が 14）
*day14
[cm]
@layopt layer=message0 visible=false
[li_autosave slot="C"]
*day14_screen
[iscript]
DayUI.showDay14();
[endscript]
[s]
