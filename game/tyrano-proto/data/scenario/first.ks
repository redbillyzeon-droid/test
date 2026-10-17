; 試作確認用の first.ks（新しく作ったテスト用プロジェクトでだけ使う。本番のプロジェクトの first.ks は上書きしない）
[title name="ロスト・アイランド 試作"]
; ティラノビルダー v3.05a（ティラノスクリプト Ver6.00）では、標準のライブラリは system/tyrano.ks にある
@call storage="system/tyrano.ks"
[hidemenubutton]
@jump storage="test_menu.ks"
[s]
