# 戦闘の敵のデザイン

作成：2026-10-17　／　状態：案。まだ一枚も生成していない。生成して見た目を確かめてから直す。

戦闘の敵の見た目と、NovelAI のプロンプトの案です。対象は `asset-list.md` の「戦闘の敵」の 12 枚と、決戦の後半に出る「ミサキと先輩の幻」1 枚です。

- 元資料：`../battle-ui.md`、`asset-list.md`、`../script/explore_cards.md`、`../script/06_day14_battle.md`、`../characters.md`、`../plan.md`、`.claude/rules/game-adult-content.md`、`outputs/battle_in_engine.png`。
- 数値（HP、攻撃など）と行動は、ゲームデザイン担当が別に決める。ここでは役割を 1 行だけ書く。
- キャラクターの基本のタグは `nai-prompts.md` にある。このファイルは `nai-prompts.md` を書きかえずに、敵の分だけをまとめる（`nai-prompts.md` は別の担当が作業中のため）。あとで `nai-prompts.md` に統合するかは主担当が決める。

---

## 1. 全員に共通する決まり

### 1-1. 戦闘画面での置き方

`outputs/battle_in_engine.png` と試作の CSS（`game/tyrano-proto/data/others/island_battle/battle.css`）から読み取れること（事実）：

| 項目 | 試作での値 |
|---|---|
| 敵を並べる範囲 | 左 400px から右端の 40px 手前まで、上 110px から高さ 380px（横 約 840px） |
| 中央の敵（親玉） | 枠 200×340px。並びの真ん中の敵が親玉の扱いになる |
| 左右の敵 | 枠 150×230px |
| 敵の名前と HP のバー | 敵の絵の足もとに出る |

この枠は試作の仮の図形です。本番の絵の大きさは、プログラム担当と決める。このファイルでは、次の目安で描く（案）。

| 大きさの区分 | 画面での高さの目安 | 使う敵 |
|---|---|---|
| 小 | 160〜200px | 洞窟のコウモリ |
| 中 | 220〜260px | 大イノシシ、岩場の大トカゲ、GM の使い魔、幻影 |
| 大（親玉） | 320〜380px | 森のぬし、山頂の大鷲（1体で出るとき）、GM |
| 演出用 | 画面の中央を広く使う | ミサキと先輩の幻 |

- どの敵も、**正面から、画面の奥からこちらを向いている**構図にする（見本から取り入れた構成）。
- 足もとに名前と HP のバーが出るので、絵の下の端は、足や霧で終わる形にする。下の端で切れた構図（`cropped`）にしない。
- 同じ敵を 2〜3 体並べることがある（モックでは大イノシシ 2 体）。左右反転して並べても不自然にならないように、ほぼ左右対称に描く。

### 1-2. 配色（背景に埋もれないように）

戦闘の背景は 3 枚（森、洞窟、決戦）。決戦は夜明け前の赤黒い空で、試作の画面も赤黒い色です。森と洞窟の背景も暗い色になる見込み（未作成）。

- 敵の体の色は、**背景より明るく、赤から離れた色**を主にする：灰色、砂色、白、青緑。
- 暗い茶色、黒、赤だけでできた体にしない。黒い部分があるときは、白い霧や明るい縁取りで形を見せる。
- 輪郭に明るい光を入れる（`rim lighting`）。
- 赤は、目や小さな飾りなど、狭い範囲だけにする。

### 1-3. 二つの系統と、それぞれの目印

| 系統 | 敵 | 目印 |
|---|---|---|
| 島の生き物 | 大イノシシ、森のぬし、洞窟のコウモリ、岩場の大トカゲ、山頂の大鷲 | 体のどこかに、**青緑に光る模様**がある。模様は、筋や渦のような線。「どこかの世界から流れついた」生き物で、この世界の動物と少しだけちがう |
| GM の側 | GM の使い魔、幻影 5 体、GM、ミサキと先輩の幻 | **GM の白い仮面**と、**白っぽい霧・影**。体の下の端が霧に溶けている |

青緑の模様は、浜の石碑の光る文字（`nai-prompts.md` の背景の例では青）と近い色にして、「この島にあるもの」という印象でそろえる（案）。

#### GM の白い仮面（共通の形、新しく決めた案）

- つるりとした白い楕円の面。飾りはない。
- 目の部分に、細い横長の切れ込みが 2 つ。口と鼻はない。
- 表情がないことが特徴。市販のゲームや作品の仮面に似せない（特定の作品の仮面の形を写さない）。
- 幻影では、仮面を「顔につける」か「体のどこかに浮かぶ・映る」形で必ず入れる。

### 1-4. 怖さの度合い

成人向けのゲームだが、敵はグロテスクにしすぎない。

- 描かない：血、傷口、内臓、むき出しの骨、腐った肉、虫がわく、など。
- 描いてよい：牙、爪、うなる顔、光る目、霧、影。
- 幻影は「怖い」より「さびしい、美しい、不気味」の方向。相棒が心を動かされる形なので、醜くしない。
- 人の形の敵（使い魔、幻影、GM、ミサキと先輩の幻）は、性的な見せ方にしない。服はきちんと着せる。

### 1-5. 生成の手順（plan.md の決定に合わせる）

1. **NovelAI の Ver5 で試作する**。下のプロンプトで、Seed を変えて数枚出し、形と配色がいちばん良いものを選ぶ。
2. **選んだ絵を参照画像にして、Ver4.5 で仕上げる**。プロンプトは同じものを使う。
3. 背景を抜いて、透過の PNG にする。
4. 戦闘画面に置いて、背景（森、洞窟、決戦）の上で埋もれないかを確かめる。

要確認：

- Ver5 と Ver4.5 で、同じタグの効き方がどうちがうか（品質のタグの書き方、`very aesthetic` などが両方で使えるか、を含む）。
- 参照画像の機能の名前と設定、API での指定のしかた（`plan.md` でも要確認）。
- 下の大きさと枚数で、Anlas（有料のポイント）を使うか（`nai-prompts.md` でも要確認）。

### 1-6. 背景の色と、抜き方（案）

| 系統 | 背景のタグ | 理由 |
|---|---|---|
| 島の生き物 | `simple background, white background` | 体の色が白ではないので、白い背景が抜きやすい |
| GM の側（白い霧、白い仮面、白いコート） | `simple background, black background` | 白い背景だと、白い霧や仮面との境目が分からなくなる。黒い背景なら、明るさで霧の半透明を残して抜ける見込み |

黒い背景で霧がきれいに抜けるかは、生成してみるまで分からない（未確認）。だめなら、灰色の背景（`grey background`）でも試す。

### 1-7. 共通のタグ

`nai-prompts.md` の「全員に共通」の品質と画風のタグを使う。ここでは敵の分だけ足す。

| 種類 | タグ |
|---|---|
| 品質・画風（`nai-prompts.md` と同じ） | `masterpiece, best quality, very aesthetic, absurdres, anime coloring` |
| 構図（敵の共通） | `solo, full body, front view, facing viewer, looking at viewer, symmetrical, rim lighting` |
| 島の生き物に足す | `no humans, animal focus, glowing markings, cyan glowing patterns` |
| GM の側に足す | `white mask, white mist, ghostly, smoke, faded edges` |
| ネガティブ（`nai-prompts.md` の共通に足す） | `gore, blood, wound, guts, internal organs, exposed bone, rotting, decay, insects, realistic, photorealistic, 3d, scenery, detailed background, multiple views, cropped, out of frame` |
| ネガティブ（人の形の敵にさらに足す） | `nsfw, nude, cleavage, revealing clothes` |

`nai-prompts.md` の共通のネガティブ（`child, loli, petite` などを含む）は、敵にもそのまま使う。

### 1-8. 生成する大きさと Seed

| 形 | 大きさ |
|---|---|
| 縦長（人の形、森のぬし） | 832×1216 |
| 横長（イノシシ、トカゲ、コウモリ、大鷲） | 1216×832 |

Seed は、下の表の「Seed の案」を最初に試し、良いものができたら、その Seed を記録して使い回す。Seed の数字に意味はない（仮）。

---

## 2. 探索の敵（6体）

### 2-1. 大イノシシ（森）

| 項目 | 内容 |
|---|---|
| 役割 | 森の弱い敵。最初の戦闘の相手になりやすい |
| 出る場所 | 森の「小さな出来事」森-X1（茂みの奥のうなり声）。モックでは森のぬしの左右に 2 体 |
| 見た目 | 人の腰より高い大きなイノシシ。正面から、頭を少し下げて、こちらをにらむ。白っぽい大きな牙が 2 本。毛は灰色がかった薄い茶色 |
| 流れついた不思議さ | 背中のたてがみに沿って、青緑に光る筋が 3 本走る。目は琥珀色 |
| 色の手がかり | 毛は灰茶色（暗くしすぎない）。牙は白。光る筋は青緑 |
| 画面での見せ方 | 中。左右に置かれることが多いので、ほぼ左右対称にする |
| 怖さ | うなって牙を見せる程度。血は描かない |

プロンプト（Ver5 で試作、Ver4.5 で仕上げ）：

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
no humans, animal focus, solo, full body, front view, facing viewer, looking at viewer, symmetrical,
giant boar, wild boar, large white tusks, ash brown fur, bristly mane, amber eyes, head lowered, snarling,
glowing markings, cyan glowing stripes along back, rim lighting,
simple background, white background
```

大きさ：1216×832　／　Seed の案：410101

### 2-2. 森のぬし（森の強い敵）

| 項目 | 内容 |
|---|---|
| 役割 | 森の親玉。大イノシシを従えて出る |
| 出る場所 | 森（モックでは中央に 1 体、左右に大イノシシ）。出る条件は、7日目以降の森の探索の結果「森-X2」（`script/explore_cards.md`） |
| 見た目（新しく決めた案） | 苔に覆われた、巨大な鹿のような獣。枝分かれした木の枝が、角のように頭から伸びる。体は大イノシシの 3 倍ほど。首から胸に長い白い毛。肩と角に、小さな光るきのこと苔が生えている |
| 流れついた不思議さ | 角の枝に、青緑に光る模様が葉脈のように走る。額に、光る渦の模様が 1 つ |
| 色の手がかり | 体は灰緑と、白い胸の毛。角は明るい木の色。光は青緑。暗い緑だけにしない |
| 画面での見せ方 | 大（親玉）。角が上に伸びる縦長の形にして、中央の大きな枠に合わせる |
| 怖さ | 古くて大きいものの、静かな迫力。牙や血ではなく、大きさで見せる |

鹿にした理由：大イノシシと並んだときに、形がはっきり分かれる。角で縦に長くなるので、中央の縦長の枠に合う。「イノシシの親玉」にしたいときは、ゲームデザイン担当と相談して変える。

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
no humans, animal focus, solo, full body, front view, facing viewer, looking at viewer, symmetrical,
giant stag, forest guardian, ancient beast, antlers made of tree branches, moss covered body, long white chest fur,
small glowing mushrooms on shoulders, grey-green fur, glowing eyes,
glowing markings, cyan glowing veins on antlers, glowing spiral mark on forehead, rim lighting, majestic,
simple background, white background
```

大きさ：832×1216　／　Seed の案：410102

### 2-3. 洞窟のコウモリ

| 項目 | 内容 |
|---|---|
| 役割 | 洞窟の弱い敵。数体まとめて出る想定 |
| 出る場所 | 洞窟の「小さな出来事」洞-X1（天井からの羽音） |
| 見た目 | 翼を広げると人の背丈ほどある大きなコウモリ。正面から、翼を大きく広げる。大きな耳。毛は薄い灰色 |
| 流れついた不思議さ | 翼の膜に、青緑に光る血管のような模様。目は小さく、白く光る |
| 色の手がかり | 毛は薄い灰色、翼の膜は灰紫。暗い洞窟の背景の上で、光る模様と明るい毛で形を見せる |
| 画面での見せ方 | 小。横長。2〜3 体並べても重なりすぎない大きさ |
| 怖さ | 口を開けて小さな牙を見せる程度 |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
no humans, animal focus, solo, full body, front view, facing viewer, looking at viewer, symmetrical,
giant bat, spread wings, large ears, light grey fur, grey-purple wing membrane, small white glowing eyes, open mouth, small fangs,
glowing markings, cyan glowing veins on wings, rim lighting,
simple background, white background
```

大きさ：1216×832　／　Seed の案：410103

### 2-4. 岩場の大トカゲ

| 項目 | 内容 |
|---|---|
| 役割 | 岩場の中くらいの敵。かたい |
| 出る場所 | 岩場の「小さな出来事」岩-X1（岩場の陰から顔を出す） |
| 見た目 | 人より長い、大きなトカゲ。正面から、頭を低くして、口を少し開ける。背中に、岩のかけらのようなとげが並ぶ |
| 流れついた不思議さ | 背中のとげが、結晶のように青緑に光る。うろこの一部に、光る線の模様 |
| 竜と分けるための決まり | 翼と角は描かない。うろこの色を赤銅色にしない（イグニアと「竜のうろこ」の素材と区別する） |
| 色の手がかり | うろこは砂色と灰色。とげの光は青緑。目は黄色 |
| 画面での見せ方 | 中。横長 |
| 怖さ | 舌を出す、口を開ける程度 |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
no humans, animal focus, solo, full body, front view, facing viewer, looking at viewer, symmetrical,
giant lizard, monitor lizard, sand-colored scales, grey scales, rocky spikes on back, crystal spikes, yellow eyes,
head lowered, open mouth, forked tongue, no wings, no horns,
glowing markings, cyan glowing crystals, rim lighting,
simple background, white background
```

ネガティブに足す：`dragon, wings, horns, red scales`

大きさ：1216×832　／　Seed の案：410104

### 2-5. 山頂の大鷲

| 項目 | 内容 |
|---|---|
| 役割 | 山頂の強い敵。空から来る |
| 出る場所 | 山頂の「小さな出来事」山-X1（頭上を横切る大きな影） |
| 見た目 | 翼を広げると家の幅ほどある大鷲。正面から、翼を大きく広げて、こちらに向かってくる。爪を前に出す |
| 流れついた不思議さ | 風切り羽の先に、青緑に光る模様。尾羽が長く、光る筋が入る |
| 色の手がかり | 羽は銀に近い灰色と白。くちばしと目は金色。暗い茶色の羽にしない |
| 画面での見せ方 | 1 体で出るときは大（親玉）。横長で、翼が並びの範囲いっぱいに広がる形 |
| 怖さ | 鋭い目と爪で見せる |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
no humans, animal focus, solo, full body, front view, facing viewer, looking at viewer, symmetrical,
giant eagle, spread wings, silver grey feathers, white feathers, golden beak, golden eyes, talons forward, long tail feathers,
glowing markings, cyan glowing patterns on flight feathers, rim lighting, dynamic,
simple background, white background
```

大きさ：1216×832　／　Seed の案：410105

### 2-6. GM の使い魔（沈没船）

| 項目 | 内容 |
|---|---|
| 役割 | 探索の最後の敵。GM の側の敵が初めて出る |
| 出る場所 | 沈没船の「小さな出来事」船-X2（甲板に、仮面をつけた黒い影が音もなく立つ） |
| 見た目 | 人より少し背の高い、細長い人の形の影。フードのついた、すそのぼろぼろな外套。顔は GM の白い仮面だけで、ほかは影。腕は長く、指先が霧になって消えている。足はなく、外套のすそが白い霧に溶ける |
| 色の手がかり | 体は黒に近い紺。外套の縁と霧は白。仮面は白。黒い体が赤黒い背景に埋もれないように、縁を白い霧で囲む |
| 画面での見せ方 | 中。縦長。浮いているように、足もとを霧にする |
| 怖さ | 静かで不気味。顔がないことで見せる |
| 人の形の扱い | 性別を決めない影。年齢の印象は大人（`adult, tall` を入れる） |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
1other, adult, tall, solo, full body, front view, facing viewer, looking at viewer, symmetrical,
shadow creature, faceless, white mask, expressionless mask, mask with narrow eye slits,
dark navy hooded cloak, tattered cloak, long arms, fingertips fading into mist, no legs, floating,
white mist, ghostly, smoke, faded edges, white outline, rim lighting,
simple background, black background
```

大きさ：832×1216　／　Seed の案：410106

---

## 3. 決戦の幻影（5体）

### 3-0. 幻影に共通する決まり

- GM が呼び出す影。相棒の「失ったもの」の形をとる（`battle-ui.md`、`06_day14_battle.md`）。
- 決戦の前半で、GM の左右に 2 体出る。2 体は同じ絵（片方を左右反転）でもよい（案）。
- 体は白い霧でできていて、少し透けている。体の下の端は霧に溶ける。
- GM の白い仮面を、顔につけるか、体のどこかに浮かぶ・映る形で入れる。
- 相棒の色を、小さな範囲だけ差し色に使う（下の表）。
- 中盤の会話の場面で見せる幻（`06_day14_battle.md` の「見せられる幻」の表）と、同じ形にする。会話の場面で別に一枚絵を作るかは未定。

| 幻影 | 差し色 | 仮面の入れ方 |
|---|---|---|
| ノクティア（ルカ） | 赤（ノクティアの瞳の色。小さく） | ルカの顔の上半分を覆う |
| コノハ（稲荷の狐たち） | 橙（コノハの髪の色） | 先頭の狐の顔につく |
| カバネ（村娘） | 白に近い金（カバネの髪の色） | 手鏡の中に、顔の代わりに仮面が映る |
| ハクレン（白い旗の民） | 黒の縞（ハクレンの髪の縞） | 旗を持つ者の顔につく。後ろの民は顔のない影 |
| イグニア（竜の群れ） | 金（イグニアの瞳の色） | 先頭の竜の顔に、仮面のような白い板 |

### 3-1. ノクティアの幻影：ルカ

| 項目 | 内容 |
|---|---|
| 役割 | 幻影。倒すと絆ゲージがたまる |
| 元の場面 | 若いままのルカが、手を差し出している |
| 見た目（新しく決めた案） | 若い成人の男性。古風な白いシャツと、長い外套。片手をこちらへ差し出す。顔の上半分は GM の白い仮面で、口もとだけがやさしく笑っている。胸に、小さな赤いバラを 1 輪 |
| ルカの顔を決めない理由 | ルカの顔は、どの資料にも決まっていない。仮面で隠すことで、ノクティアの記憶の中の人として見せる |
| 色の手がかり | 白い霧と、白いシャツ。差し色は胸のバラの赤（小さく） |
| 画面での見せ方 | 中。縦長。差し出す手が画面の手前に来る |
| 怖さ | 怖さより、さびしさ |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
1boy, adult male, young adult, solo, full body, front view, facing viewer, looking at viewer,
white mask covering upper face, mask with narrow eye slits, gentle smile,
white shirt, long coat, old-fashioned clothes, reaching out hand, outstretched hand, small red rose on chest,
translucent body, lower body fading into white mist, white mist, ghostly, smoke, faded edges, rim lighting,
simple background, black background
```

大きさ：832×1216　／　Seed の案：410201

### 3-2. コノハの幻影：稲荷の狐たち

| 項目 | 内容 |
|---|---|
| 役割 | 幻影。倒すと絆ゲージがたまる |
| 元の場面 | 社の前で、白い狐たちが、コノハを手招きしている |
| 見た目（新しく決めた案） | 白い狐が 3 匹、重なるように座っている。真ん中の大きな狐が前に出て、前足を上げて手招きする。真ん中の狐の顔に、GM の白い仮面。左右の狐は霧に半分溶けている。しっぽの先が橙色に光る |
| 社の扱い | 鳥居や社の建物は描かない（赤い鳥居は背景の赤に埋もれる。実在の社の意匠を写さないため）。社の気配は、狐の首の白い紙の飾り（紙垂に似た形）だけにする |
| 色の手がかり | 白い毛と白い霧。差し色はしっぽの先の橙 |
| 画面での見せ方 | 中。横に少し広い形 |
| 怖さ | やさしく誘う形。牙は見せない |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
no humans, animal focus, three foxes, white fox, front view, facing viewer, looking at viewer, symmetrical,
center fox larger, center fox wearing white mask, mask with narrow eye slits, raised paw, beckoning,
paper streamers on neck, orange glowing tail tips, side foxes fading into mist,
white mist, ghostly, smoke, faded edges, rim lighting,
simple background, black background
```

大きさ：1216×832　／　Seed の案：410202

### 3-3. カバネの幻影：人間だったころの村娘

| 項目 | 内容 |
|---|---|
| 役割 | 幻影。倒すと絆ゲージがたまる |
| 元の場面 | 人間の村娘のカバネが、鏡の前で笑っている |
| 見た目（新しく決めた案） | 成人の女性の村娘。戦の時代の素朴な着物（小袖）、黒い髪を後ろで一つに結ぶ。肌は日焼けしていない。腕と鎖骨のタトゥーはない（GM が「体を返す」と誘う姿なので）。手に丸い手鏡を持ち、こちらに向ける。鏡の中には、顔の代わりに GM の白い仮面が映る。本人の顔は、やわらかく笑っている |
| 年齢の扱い | 必ず成人の女性に見えるようにする。プロンプトに `adult, mature female` を入れる |
| 色の手がかり | 白い霧、くすんだ白の着物。差し色は、髪ひもの白に近い金（いまのカバネの髪の色） |
| 画面での見せ方 | 中。縦長。鏡が画面の中央に来る |
| 怖さ | 骸骨の要素は入れない。鏡の仮面だけが不気味 |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
1girl, adult, mature female, solo, full body, front view, facing viewer, looking at viewer,
villager, plain kimono, kosode, black hair, tied hair, low ponytail, pale gold hair ribbon, gentle smile, no tattoos,
holding hand mirror, mirror facing viewer, white mask reflected in mirror,
translucent body, lower body fading into white mist, white mist, ghostly, smoke, faded edges, rim lighting,
simple background, black background
```

ネガティブに足す：`skeleton, skull, tattoo, tan skin`

大きさ：832×1216　／　Seed の案：410203

### 3-4. ハクレンの幻影：白い旗の民

| 項目 | 内容 |
|---|---|
| 役割 | 幻影。倒すと絆ゲージがたまる |
| 元の場面 | 白い旗の下で、民がハクレンの名を呼んでいる |
| 見た目（新しく決めた案） | 古い中華風の服を着た、旗を持つ大人の人影が中央に 1 人。高い竿に、大きな白い旗。旗には黒い縞の模様（ハクレンの髪の縞と同じ形）。旗を持つ者の顔は GM の白い仮面。その足もとに、祈るように手を合わせる民の影が数人。民は顔のない白い影で、霧に溶けている |
| 旗の扱い | 実在の国や団体の旗、文字、紋章は入れない |
| 色の手がかり | 白い旗と白い霧。差し色は旗の黒い縞 |
| 画面での見せ方 | 中。旗の竿で縦に長い形 |
| 怖さ | 声が聞こえてきそうな、静かな群れ |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
adult, solo focus, full body, front view, facing viewer, looking at viewer, symmetrical,
standard bearer, holding flag, tall flagpole, large white flag, black stripes pattern on flag,
ancient chinese clothes, white mask, mask with narrow eye slits,
crowd of faceless silhouettes at feet, praying, hands together, white silhouettes,
translucent body, fading into white mist, white mist, ghostly, smoke, faded edges, rim lighting,
simple background, black background
```

ネガティブに足す：`text, emblem, national flag`

大きさ：832×1216　／　Seed の案：410204

### 3-5. イグニアの幻影：竜の群れ

| 項目 | 内容 |
|---|---|
| 役割 | 幻影。倒すと絆ゲージがたまる |
| 元の場面 | 竜の群れが、空からイグニアを呼んでいる |
| 見た目（新しく決めた案） | 白い霧でできた竜が 3 頭、からみ合うように宙に浮かぶ。真ん中の竜が正面を向き、翼を広げる。真ん中の竜の顔に、GM の仮面と同じ形の白い板。左右の竜は、首と翼だけが霧から出ている。目は金色 |
| 色の手がかり | 竜は赤銅色にしない（赤黒い背景に埋もれるため）。白い霧の体に、うろこの縁だけ淡い赤銅色。差し色は金色の目 |
| 画面での見せ方 | 中。翼で横に広がる形。決戦の背景（もとはイグニアの巣）の上に出るので、白さで目立たせる |
| 怖さ | 大きく、さびしい群れ。牙はむき出しにしない |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
no humans, three dragons, western dragon, front view, facing viewer, looking at viewer, symmetrical,
center dragon spread wings, center dragon wearing white mask, white mask plate on face, golden eyes,
dragons made of white mist, faint copper edges on scales, side dragons emerging from mist, floating,
white mist, ghostly, smoke, faded edges, rim lighting,
simple background, black background
```

大きさ：1216×832　／　Seed の案：410205

---

## 4. GM（黒瀬カイ）の決戦用の姿

| 項目 | 内容 |
|---|---|
| 役割 | 決戦の親玉。「支配の力」を 0 にすれば勝ち |
| 元の資料 | 30 歳くらい、整った顔、目に光がない、白いコート（`characters.md`）。決戦の始まりは「素顔・無表情」の立ち絵（`06_day14_battle.md`） |
| 見た目（新しく決めた案） | 素顔のカイが、正面に立つ。表情はなく、目に光がない。白い長いコートが風で広がる。片手に、ひびの入った白い仮面を持つ（12 日目までつけていた仮面）。もう片方の手は、こちらに向けて開く。コートのすそから、黒い影がのび、その縁が白い霧になって左右に広がる。背後に、GM の仮面と同じ形の、大きな白い仮面の影が、霧の中にうっすら浮かぶ |
| 色の手がかり | 白いコートと白い霧が主。黒い髪と、すその黒い影で引きしめる。赤は使わない。赤黒い空の上で、いちばん白く見えるようにする |
| 画面での見せ方 | 大（親玉）。ゲームの中でいちばん大きな敵。中央に、縦長に置く。幻影 2 体が左右に並んでも、頭ひとつ以上高くする |
| 怖さ | 人間の姿のまま、静かに大きく見せる。怪物にはしない |
| 人の形の扱い | `adult male, around 30 years old` を入れる（`nai-prompts.md` の基本タグと同じ） |

`nai-prompts.md` の黒瀬カイの基本タグに、決戦用のタグを足したもの：

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
1boy, adult male, around 30 years old, black hair, handsome, empty eyes, white coat, expressionless,
solo, full body, front view, facing viewer, looking at viewer, standing,
long white coat, coat flowing in wind, holding cracked white mask, mask with narrow eye slits, open hand reaching toward viewer,
black shadow spreading from coat hem, shadow edges turning into white mist,
giant faint white mask silhouette behind him, white mist, smoke, rim lighting, ominous,
simple background, black background
```

大きさ：832×1216　／　Seed の案：立ち絵の Seed（`nai-prompts.md` で決める予定のもの）を最初に試す。まだ決まっていなければ 410301

顔を立ち絵とそろえるため、Ver4.5 で仕上げるときの参照画像に、立ち絵の「素顔（無表情）」も使えるかを試す（参照画像の機能は要確認）。

---

## 5. ミサキと先輩の幻（決戦の後半、演出用）

| 項目 | 内容 |
|---|---|
| 役割 | 攻撃しても倒せない。「言葉」で向き合うと消える（`battle-ui.md`） |
| 元の場面 | 後半、主人公があの夜の廊下に立たされる。少しだけ開いた寝室のドアの隙間（`06_day14_battle.md`） |
| 見た目（新しく決めた案） | 縦に細く光る「ドアの隙間」の光の帯が中央にあり、その前に二人が立つ。ミサキは普段着で、こちらを振り返り、何か言いたそうな顔（泣き顔の手前）。先輩は少し後ろに立ち、ミサキの肩に片手を置く。先輩の顔は影で見せない（`asset-list.md` の「顔をはっきり見せない」に合わせる）。目に入るのは、先輩のよく磨いた革靴だけ（「いい靴は男の名刺だ」の口ぐせから） |
| GM の側の目印 | 二人とも、輪郭が白い霧でぼやけ、少し透けている。仮面はつけない（GM の仮面をつけると、二人が GM の手下のように見えるため）。代わりに、ドアの隙間の光の帯の中に、GM の仮面の形が小さく浮かぶ |
| 倒せないことの見せ方 | ほかの敵より透けていて、霧がゆらいでいる。攻撃が当たっても、霧が散ってまた戻る（動きはプログラム担当と相談） |
| 色の手がかり | 白い霧と、ドアの隙間の暖かい白い光。服はくすんだ色。赤は使わない |
| 画面での見せ方 | 演出用。中央に大きく。GM と入れかえて置くか、GM の前に重ねるかは、プログラム担当と決める |
| 成人向けの扱い | 性的な場面として描かない。二人とも、きちんと服を着て立っているだけ。抱き合う、肌を見せる、などの構図にしない（あの夜の出来事は、ドアの隙間の光と、肩に置いた手だけで伝える） |
| 怖さ | 化け物にしない。主人公の記憶の中の二人として、生々しすぎない程度に |

```
masterpiece, best quality, very aesthetic, absurdres, anime coloring,
1girl, 1boy, adult, mature female, adult male, full body, front view, standing, fully clothed,
woman: brown hair, bob cut, casual clothes, looking back at viewer, sad expression, about to cry,
man: standing behind her, hand on her shoulder, face hidden in shadow, faceless, business suit, polished leather shoes,
narrow vertical strip of light behind them, light from door gap, small white mask shape in the light,
translucent, blurred outline, white mist, ghostly, faded edges,
simple background, black background
```

ネガティブに足す：`nsfw, nude, kiss, hug, embrace, bed, underwear`

大きさ：832×1216　／　Seed の案：ミサキの立ち絵の Seed（未定）を最初に試す。まだ決まっていなければ 410401

ミサキの顔は、立ち絵（`asset-list.md` の「ミサキ：通常、泣き顔」）とそろえる。`woman:` `man:` のような書き方で人物ごとにタグを分けられるかは、NovelAI の機能として要確認（Ver4.5 以降の「キャラクターごとのプロンプト」で分ける方法があるかもしれないが、確かめていない）。

---

## 6. 生成してほしいものの一覧

| ファイル名（案） | 敵 | 大きさ | 背景 | Seed の案 |
|---|---|---|---|---|
| `enemy_boar.png` | 大イノシシ | 1216×832 | 白 | 410101 |
| `enemy_forest_lord.png` | 森のぬし | 832×1216 | 白 | 410102 |
| `enemy_bat.png` | 洞窟のコウモリ | 1216×832 | 白 | 410103 |
| `enemy_lizard.png` | 岩場の大トカゲ | 1216×832 | 白 | 410104 |
| `enemy_eagle.png` | 山頂の大鷲 | 1216×832 | 白 | 410105 |
| `enemy_familiar.png` | GM の使い魔 | 832×1216 | 黒 | 410106 |
| `phantom_noctia.png` | 幻影：ルカ | 832×1216 | 黒 | 410201 |
| `phantom_konoha.png` | 幻影：稲荷の狐たち | 1216×832 | 黒 | 410202 |
| `phantom_kabane.png` | 幻影：村娘 | 832×1216 | 黒 | 410203 |
| `phantom_hakuren.png` | 幻影：白い旗の民 | 832×1216 | 黒 | 410204 |
| `phantom_ignia.png` | 幻影：竜の群れ | 1216×832 | 黒 | 410205 |
| `enemy_gm.png` | GM（決戦） | 832×1216 | 黒 | 立ち絵の Seed、なければ 410301 |
| `phantom_misaki.png` | ミサキと先輩の幻 | 832×1216 | 黒 | ミサキの Seed、なければ 410401 |

ファイル名と置き場所は案。プログラム担当の決まり（`game/` の下の画像の置き方）があれば、そちらに合わせる。

---

## 7. 決めていないこと・要確認

- Ver5 と Ver4.5 のタグの効き方のちがい、参照画像の機能の設定と API での指定のしかた（要確認）。
- 生成する大きさと枚数で Anlas を使うか（要確認）。
- NovelAI の生成画像を商用で使えるか、販売サイトでの AI 作品の扱い（`asset-list.md` で要確認のまま）。
- 黒い背景で、白い霧の半透明がきれいに抜けるか（未確認。生成して試す）。
- 本番の敵の絵の大きさ（試作の枠は仮）。プログラム担当と決める。
- 森のぬしを鹿の形にしたこと（新しく決めた案）。ゲームデザイン担当の考えとちがえば直す。
- 森のぬしが出る条件：決まった（7日目以降の「森-X2」。2026-10-17）。
- 全員で挑むときに、どの幻影が出るか（5 人分を出すか、2 体だけか）。ゲームデザイン担当が決める。
- ミサキと先輩の幻を、GM と入れかえて置くか、重ねるか。プログラム担当と決める。
- 人物ごとにタグを分ける書き方（ミサキと先輩の幻）が NovelAI で使えるか（要確認）。
- 戦闘の背景（森、洞窟、決戦）はまだ作っていない。背景ができたら、敵を重ねて、埋もれないかを確かめる。
