; 試作の確認メニュー（2026-10-17 に足したボタンは、検査スクリプトが文字送りでクリックする y=400・600 付近を避けて置いている）
; ボタンを足すとき：中央の列（x=440）は y=160・260・360・460 を使用中。右の列（x=880）は y=160・460 を使用中。
; 検査スクリプトがクリックする (640,600)・(700,400)・(900,300) に重ならない場所に置く（右の列の空きは y=60・y=560）。
*start
[cm]
[clearfix]
@layopt layer=message0 visible=false
[iscript]
if (window.AdvUI) AdvUI.hide();
if (window.DayUI) DayUI.closeAll();
[endscript]
[glink color="black" size=26 x=440 y=260 width=400 text="会話画面のテスト" target="*adv"]
[glink color="black" size=26 x=440 y=360 width=400 text="戦闘画面のテスト" target="*battle"]
[glink color="black" size=26 x=440 y=460 width=400 text="探索の戦闘（大イノシシ）" target="*explore"]
[glink color="black" size=26 x=440 y=160 width=400 text="決戦の流れ（前半から決着）" target="*final"]
[glink color="black" size=26 x=880 y=160 width=360 text="決戦の中盤（選び直し）" target="*mid_test"]
[glink color="black" size=26 x=880 y=460 width=360 text="1日の画面のテスト" target="*day"]
[s]

*adv
[iscript]
if (window.AdvUI) AdvUI.show();
[endscript]
@jump storage="adv_test.ks"

*battle
@jump storage="battle_test.ks"

*explore
@jump storage="battle_test.ks" target="*explore"

*final
@jump storage="battle_test.ks" target="*final"

*mid_test
@jump storage="battle_test.ks" target="*mid_test"

*day
@jump storage="day_test.ks"
