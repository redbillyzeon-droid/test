; 試作の確認メニュー
*start
[cm]
[clearfix]
@layopt layer=message0 visible=false
[iscript]
if (window.AdvUI) AdvUI.hide();
[endscript]
[glink color="black" size=26 x=440 y=260 width=400 text="会話画面のテスト" target="*adv"]
[glink color="black" size=26 x=440 y=360 width=400 text="戦闘画面のテスト" target="*battle"]
[s]

*adv
[iscript]
if (window.AdvUI) AdvUI.show();
[endscript]
@jump storage="adv_test.ks"

*battle
@jump storage="battle_test.ks"
