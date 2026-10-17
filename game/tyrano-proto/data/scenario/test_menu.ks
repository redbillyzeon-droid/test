; 試作の確認メニュー（2026-10-17 に足したボタンは、検査スクリプトが文字送りでクリックする y=400・600 付近を避けて置いている）
*start
[cm]
[clearfix]
@layopt layer=message0 visible=false
[iscript]
if (window.AdvUI) AdvUI.hide();
[endscript]
[glink color="black" size=26 x=440 y=260 width=400 text="会話画面のテスト" target="*adv"]
[glink color="black" size=26 x=440 y=360 width=400 text="戦闘画面のテスト" target="*battle"]
[glink color="black" size=26 x=440 y=460 width=400 text="探索の戦闘（大イノシシ）" target="*explore"]
[glink color="black" size=26 x=440 y=160 width=400 text="決戦の流れ（前半から決着）" target="*final"]
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
