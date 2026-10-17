# NovelAI 用のプロンプト（キャラクターの基本と立ち絵）

作成：2026-10-06　／　更新：2026-10-17（キャラクターごとの服装・表情差分・ネガティブ、生成の手順を追加）
状態：案。まだ一枚も生成していない。実際に生成して見た目を確かめてから直す。

- キャラクターの見た目は `../characters.md` に合わせている。characters.md に書かれていない細かい指定（目の色、髪の長さ、服の色など）は、この文書で決めた**案**で、「（案）」と書いて区別する。
- 表情の種類は `asset-list.md` の立ち絵の表に合わせている。
- タグは英語（Danbooru 系のタグ）。NovelAI Ver4／4.5 で一般的な書き方を基本にし、Ver5 でも同じ書き方のまま試す前提にする。**Ver5 と Ver4.5 でプロンプトの書き方や効き方がどう違うかは要確認**。
- この文書には、成人向けの一枚絵のプロンプトは書かない（立ち絵と基本の設定だけ）。成人向けの一枚絵を作るときは、`.claude/rules/game-adult-content.md`（すべて同意のもとの場面。眠っている、操られている、などに見える構図にしない）に合わせて、別に用意する。

## 1. 全員に共通の決まり

### 1-1. 成人の見た目にする決まり（必ず守る）

- 登場人物は全員、成人として描く。
- 女性キャラクターは、人数のタグ（`1girl`）のすぐ後に `adult, mature female` を**必ず**入れる。
- 男性キャラクターは、`1boy` のすぐ後に `adult, mature male` を**必ず**入れる。`game/tools/nai_generate.py` は、人物のプロンプトに `adult` というタグがそのまま入っていないと止まる（`adult male` だけでは通らない）。
- 共通のネガティブ（下の表）の `child, loli` などは、どの絵でも消さない。
- 生成した絵が子どもっぽく見えたら、その絵は使わない（6章の手順2「良いものを選ぶ」）。

### 1-2. 共通のタグ

| 種類 | タグ |
|---|---|
| 人数と年齢（先頭に置く） | 女性：`1girl, adult, mature female`／男性：`1boy, adult, mature male` |
| 品質 | `masterpiece, best quality, very aesthetic, absurdres` |
| 画風（案） | `anime coloring, soft lighting, detailed eyes` |
| ネガティブ（共通） | `lowres, bad anatomy, bad hands, extra fingers, missing fingers, text, watermark, signature, blurry, jpeg artifacts, child, loli, petite, flat chest, school uniform` |
| ネガティブ（人外のヒロインに足す） | `furry, animal nose, extra ears`（獣の顔になる、耳が4つになる、を防ぐ。ノクティア以外の獣人・竜） |

共通のネガティブは `nai_generate.py` の `COMMON_NEGATIVE` と同じ内容。キャラクターごとのネガティブは `--negative` で足す。

> 注意（プログラム担当への申し送り）：男性キャラクター（黒瀬カイ、先輩）でも共通のネガティブの `flat chest` が入る。男性の胸がふくらむ方向に効くおそれがあるので、男性のときは `flat chest` を外して、`breasts, female` をネガティブに足せるようにしたい。スクリプトの書きかえはプログラム担当の判断。

### 1-3. 立ち絵の決まった形（全員で同じ構図にそろえる）

| 項目 | 内容 |
|---|---|
| 大きさ | 832×1216（縦長。`--size portrait`） |
| 構図のタグ | `full body, standing, straight-on, facing viewer, looking at viewer, arms at sides, simple background, white background` |
| 光 | `soft lighting, even lighting`（影を強くしない。背景に重ねたときに浮かないように） |
| 構図のネガティブ | `cropped, out of frame, from side, from above, from below, dutch angle, multiple views, dynamic pose` |
| 例外 | ハクレンは槍を持つので `arms at sides` を外す。先輩は横顔（5章）。GM の仮面の影は暗い表現（3章） |

- 背景を白にするのは、あとで背景を抜きやすくするため。
- 会話画面の左下の顔の絵は、立ち絵の上半分を切り抜いて使う（`adv-ui.md`）。832×1216 の全身だと顔が小さいので、切り抜いたときに顔がぼやけないか、拡大（アップスケール）が要るかは、試作で**要確認**。
- 頭の高さと足の位置は、生成ではそろいきらない。並べるときの大きさは、ティラノビルダーに入れる前に画像の加工でそろえる（案）。

### 1-4. プロンプトの並べ方

```
[人数と年齢], [体つき・種族], [髪・目・肌], [服装・小物], [表情], [立ち絵の構図], [画風], [品質]
```

表情の部分だけを入れかえて、差分を作る。ほかの部分は、同じキャラクターでは一字も変えない。

## 2. キャラクターごとのタグ

各キャラクターについて、次の順に書く：見た目の基本、服装・小物、表情の差分、差分の案（あれば）、ネガティブに足すタグ。

ファイル名は `<キャラ>_<表情>`（例：`noctia_smile`）。`nai_generate.py` が `_seed<数字>` を後ろに付けて保存する。

### 2-1. ノクティア（吸血鬼）

見た目の基本：

```
1girl, adult, mature female, tall, vampire, long hair, straight hair, black hair, red eyes, pale skin, pointy ears, fangs, large breasts
```

服装・小物：

```
black dress, long dress, plunging neckline, cleavage, off-shoulder dress, black choker, red gemstone, long fingernails, black nails, elegant
```

| 表情 | ファイル名 | 表情のタグ |
|---|---|---|
| 通常 | `noctia_normal` | `light smile, closed mouth, half-closed eyes, calm` |
| 笑顔 | `noctia_smile` | `smile, open mouth, fang, happy` |
| からかい | `noctia_tease` | `smirk, seductive smile, half-closed eyes, raised eyebrow` |
| 照れ | `noctia_blush` | `blush, embarrassed, looking away, closed mouth` |
| 悲しみ | `noctia_sad` | `sad, downcast eyes, furrowed brow, closed mouth` |
| 驚き | `noctia_surprised` | `surprised, wide-eyed, open mouth` |

ネガティブに足す：`short hair, blonde hair, blue eyes, tan, bat wings, wings, sunlight`

- 崩れやすいところ：髪が短くなる、翼が生える（設定にない）、肌が日焼けする。
- 「胸元の開いた黒いドレス」は `plunging neckline, cleavage` で表す。立ち絵は会話画面で常に出るので、露出はドレスの胸元までにする（案）。

### 2-2. コノハ（狐の獣人）★メインヒロイン

見た目の基本：

```
1girl, adult, mature female, fox girl, fox ears, fluffy ears, fox tail, orange hair, medium hair, amber eyes, medium breasts, toned
```

服装・小物：

```
short kimono, white kimono, red trim, red obi, wide sleeves, thighs, sandals, bell hair ornament
```

| 表情 | ファイル名 | 表情のタグ |
|---|---|---|
| 通常 | `konoha_normal` | `smile, closed mouth, bright eyes` |
| 笑顔 | `konoha_smile` | `open mouth smile, grin, happy, energetic` |
| 驚き | `konoha_surprised` | `surprised, wide-eyed, open mouth, ears up` |
| 真面目 | `konoha_serious` | `serious, closed mouth, determined` |
| 悲しみ | `konoha_sad` | `sad, teary eyes, frown, ears down` |
| 照れ | `konoha_blush` | `blush, embarrassed, shy smile, looking away` |

差分の案（しっぽ 1〜5 本）：

- `asset-list.md` の案どおり、しっぽは別の画像にして重ねる。表情の6枚は**しっぽ1本**で作る。
- しっぽの画像は `konoha_tail_1` 〜 `konoha_tail_5`。体の後ろ（腰のあたり）に重ねる。
  - プロンプトの案：`no humans, fox tail, orange fur, fluffy, white tail tip, multiple tails, simple background, white background`（2本以上のとき `multiple tails`。1本のときは外す）。
  - 本数をタグで正しく指定できるかは**要確認**（Danbooru 系には、本数をそのまま指定する一般的なタグがない。`multiple tails` は「たくさん」の意味になりやすい）。思った本数にならなければ、1本のしっぽの画像を角度を変えて並べて、手で組み合わせる。
- 体の絵にしっぽが描かれていると重ねにくいので、表情の6枚は「しっぽが体の後ろに小さく見える」くらいで選ぶ（6章の手順2）。
- 本数と好感度の段階の対応は `characters.md`（最初1本、段階1で2本、段階2で3本、段階4で4本、段階5で5本）。

ネガティブに足す：`furry, animal nose, extra ears, multiple tails, kitsune, kyuubi, short stature, chibi`

- 崩れやすいところ：獣の顔になる、人の耳と狐の耳が両方出る、しっぽが増える、元気な性格のタグに引っぱられて幼く見える。
- 幼く見えやすいキャラクターなので、`adult, mature female` に加えて、体つきのタグ（`medium breasts, toned`）を外さない。

### 2-3. カバネ（ガシャドクロ）

見た目の基本：

```
1girl, adult, mature female, gyaru, platinum blonde hair, long hair, wavy hair, tan, dark-skinned female, long eyelashes, eyeliner, brown eyes, medium breasts, curvy
```

服装・小物：

```
arm tattoo, chest tattoo, skeleton tattoo, bone tattoo on arms and collarbone, small flower pattern inside the bone tattoo, collarbone, crop top, white crop top, midriff, navel, denim shorts, seashell necklace, hoop earrings, nail polish
```

| 表情 | ファイル名 | 表情のタグ |
|---|---|---|
| 通常 | `kabane_normal` | `smirk, closed mouth, half-closed eyes` |
| 笑い | `kabane_laugh` | `laughing, open mouth, grin, closed eyes` |
| 不機嫌 | `kabane_annoyed` | `annoyed, pout, frown, looking to the side` |
| 照れ | `kabane_blush` | `blush, embarrassed, looking away, pout` |
| 悲しみ | `kabane_sad` | `sad, downcast eyes, closed mouth, teary eyes` |
| 驚き | `kabane_surprised` | `surprised, wide-eyed, open mouth` |

ネガティブに足す：`skeleton, skull, exposed bone, undead, pale skin, black hair, short hair, gothic`

- 崩れやすいところ：タトゥーではなく本物の骨や骸骨が描かれる、肌が白くなる、ゴシック風の服になる。
- タトゥーは「腕と鎖骨」（characters.md）。骨の模様の中に小さな花の模様を入れるのは、人間の村娘だったころの名残として決めた案。花の模様がタグで出るか（自然な文の部分が Ver5／Ver4.5 で効くか）は**要確認**。出なければ `floral tattoo` を足して試す。
- 「つけまつげ」は一般的なタグがないので、`long eyelashes, eyeliner` で表す（案）。
- 巨大な骸骨の姿は戦闘の絵なので、ここでは作らない。

### 2-4. ハクレン（白虎）

見た目の基本：

```
1girl, adult, mature female, tall, muscular female, toned, abs, tiger girl, tiger ears, tiger tail, white hair, streaked hair, black streaks, long hair, high ponytail, golden eyes, sharp eyes, medium breasts
```

服装・小物：

```
chinese armor, ancient chinese armor, shoulder armor, vambraces, armored skirt, red cloth, tassel, holding spear, polearm, spear held upright
```

| 表情 | ファイル名 | 表情のタグ |
|---|---|---|
| 真剣 | `hakuren_serious` | `serious, closed mouth, sharp eyes, determined` |
| 通常 | `hakuren_normal` | `expressionless, closed mouth, calm` |
| 照れ | `hakuren_blush` | `blush, embarrassed, looking away, flustered, closed mouth` |
| 怒り | `hakuren_angry` | `angry, furrowed brow, clenched teeth` |
| 悲しみ | `hakuren_sad` | `sad, downcast eyes, closed mouth` |
| 驚き | `hakuren_surprised` | `surprised, wide-eyed, open mouth` |

構図：槍を持つので、共通の構図のタグから `arms at sides` を外し、`spear held upright` で槍をまっすぐ立てて持たせる（槍の先が画面から切れないように）。

ネガティブに足す：`furry, animal nose, extra ears, orange fur, tiger print, western armor, knight, japanese armor, samurai, broken spear, multiple weapons`

- 崩れやすいところ：西洋の鎧や日本の鎧になる、虎の縞が服や肌の柄になる、槍が曲がる・2本になる、手と槍の握りが崩れる。
- 「古い中華風の武具」は `chinese armor, ancient chinese armor` で表す。このタグが Ver5／Ver4.5 で中華風の鎧として効くかは**要確認**。
- 「かわいいものが好き（隠している）」は立ち絵に出さない（小物にすると隠していることにならないため）。

### 2-5. イグニア（ドラゴン）

見た目の基本：

```
1girl, adult, mature female, tall, dragon girl, small horns, dragon horns, dragon tail, scales on tail, red-brown hair, auburn hair, very long hair, messy hair, golden eyes, slit pupils, large breasts
```

服装・小物：

```
loose clothes, oversized clothes, loose robe, off shoulder, wide sleeves, sleeves past wrists, barefoot
```

| 表情 | ファイル名 | 表情のタグ |
|---|---|---|
| 眠り | `ignia_sleep` | `closed eyes, sleepy, light smile, head tilt, drooling` |
| ぼんやり | `ignia_dazed` | `half-closed eyes, sleepy, expressionless, blank stare` |
| 笑顔 | `ignia_smile` | `gentle smile, half-closed eyes, happy` |
| 照れ | `ignia_blush` | `blush, half-closed eyes, looking away, light smile` |
| 悲しみ | `ignia_sad` | `sad, downcast eyes, closed mouth` |
| 真剣（目を覚ました顔） | `ignia_serious` | `serious, wide open eyes, sharp eyes, glowing eyes, closed mouth` |

ネガティブに足す：`furry, extra ears, large horns, long horns, wings, dragon wings, armor, muscular female, scales on face`

- 崩れやすいところ：角が大きくなる、翼が生える、ゆったりした服が鎧や露出の多い服になる、うろこが顔中に出る。
- 「赤銅色」は Danbooru 系に決まったタグがないので、`red-brown hair, auburn hair` で表す（案）。色が赤すぎる・茶色すぎるときは、片方を外して試す。
- 翼は characters.md に書かれていない。人の姿では翼なし、空から見回るのは竜の姿のとき、として翼をネガティブに入れた（案。**要確認**：利用者の意図）。
- 「眠り」の表情は、立ったまま目を閉じた立ち絵にする（会話の中で眠そうにしている場面用）。寝ころんだ姿にはしない。

## 3. 黒瀬カイ（GM）

見た目の基本：

```
1boy, adult, mature male, around 30 years old, tall, slim, black hair, short hair, messy bangs, handsome, dark eyes, empty eyes, dull eyes
```

服装・小物：

```
white coat, long coat, black shirt, black pants, black gloves
```

| 表情 | ファイル名 | 表情のタグ |
|---|---|---|
| 仮面の影 | `kai_masked` | `white mask, full-face mask, masked, silhouette, shadow, backlighting, dark, faceless` |
| 素顔（無表情） | `kai_blank` | `expressionless, closed mouth, empty eyes` |
| 素顔（笑い） | `kai_smile` | `cold smile, smirk, empty eyes, shaded face` |
| 素顔（崩れた顔） | `kai_broken` | `despair, crying, tears, wide-eyed, gritted teeth, trembling` |

差分の案（仮面の影と素顔）：

- 仮面の影は、体の形がわかる程度に暗くし、白い仮面だけがはっきり見えるようにする。顔が見えないので、素顔と同じ人物に見えるかは、背の高さと白いコートの形で合わせる。
- 仮面の影は背景を白にすると影らしく見えないので、`simple background, grey background` で作り、ゲームに入れるときに背景を抜く（案）。
- 13日目に仮面を外す一枚絵は、この文書の範囲外（asset-list.md の一枚絵）。

ネガティブに足す：`breasts, female, 1girl, colorful clothes, smile`（`smile` は「無表情」と「崩れた顔」のときだけ足す）

- 崩れやすいところ：女性的な顔や体になる、白いコートが別の色になる、目に光が入る。
- 黒髪、黒い服、手袋は characters.md にない案。

## 4. ミサキ（前の世界の恋人）

見た目の基本：

```
1girl, adult, mature female, around 25 years old, brown hair, bob cut, brown eyes, medium breasts
```

服装・小物：

```
casual clothes, beige cardigan, white blouse, long skirt, small necklace
```

| 表情 | ファイル名 | 表情のタグ |
|---|---|---|
| 通常 | `misaki_normal` | `gentle smile, closed mouth` |
| 泣き顔 | `misaki_cry` | `crying, tears, sad, frown, teary eyes` |

ネガティブに足す：`animal ears, tail, fantasy, armor, school uniform, kimono`

- 崩れやすいところ：島のヒロインと同じ画風に引っぱられて、ファンタジーの服や耳が出る。
- characters.md には見た目の指定がない。茶色のボブと家で着る服は案。前の版にあった `office lady` は、ミサキの仕事が決まっていないので外した。
- 年齢は書かれていないが、主人公（25歳）と5年付き合っているので、同じくらいの年の成人として `around 25 years old` を入れた（案）。

## 5. 先輩（佐久間）

立ち絵は「横顔（顔をはっきり見せない）」の1枚だけ。プロローグでだけ使う。

```
1boy, adult, mature male, around 35 years old, short hair, black hair, slicked back hair, business suit, dark suit, necktie, wristwatch, leather shoes, shiny shoes,
profile, from side, face in shadow, shaded face, standing, full body, simple background, white background
```

| 表情 | ファイル名 | 表情のタグ |
|---|---|---|
| 横顔 | `sakuma_profile` | （上のプロンプトのまま。表情のタグは入れない） |

ネガティブに足す：`breasts, female, 1girl, looking at viewer, facing viewer, detailed face, casual clothes`

- 共通の構図（正面、目線）の例外。顔をはっきり見せないため、横向きで顔に影を落とす。
- 「いい靴は男の名刺だ」の口ぐせに合わせて、磨いた革靴を描く（案）。年齢 35 歳くらい、髪型、腕時計は案。

## 6. 生成の手順（Ver5 で試作 → Ver4.5 で差分）

利用者の手順（2026-10-17）：まず NovelAI の Ver5 で作り、良さそうなものができたら、それを参照画像にして Ver4.5 で出力する。

**要確認（まとめ）**：

- Ver5 と Ver4.5 のモデルの正式な名前と、API で指定する名前。`nai_generate.py` の既定は `nai-diffusion-4-5-full`（これも要確認と書かれている）。Ver5 の名前はまだ分からない。
- Ver5 と Ver4.5 で、プロンプトの書き方（タグと自然な文の扱い、品質のタグを自動で足すかどうか など）がどう違うか。
- 参照画像の機能の**正式な名前**、設定の項目（強さなど）と**おすすめの値**、API での指定のしかた。この文書では「参照画像の機能」と呼ぶ。値は試しながら決め、決めた値を下の表に書く。
- 参照画像の機能を使うと Anlas（有料のポイント）がいくら増えるか。
- いまの `nai_generate.py` は参照画像を送る項目を持っていない。API で手順2を行うには、スクリプトの書きかえが要る（プログラム担当の仕事）。それまでは、利用者が NovelAI の画面で行う。

### 手順1：Ver5 で試作する

1. キャラクターごとに、「通常」の表情のプロンプト（見た目の基本＋服装・小物＋「通常」の表情＋立ち絵の構図＋画風＋品質）を作る。
2. Seed を変えて4枚ずつ作る（Seed の案は下の表）。
3. 4枚とも使えなければ、タグを直してから、もう4枚作る。直したタグは、この文書にも反映する。

| キャラクター | 試作のファイル名 | Seed の案 |
|---|---|---|
| ノクティア | `v5_noctia_normal` | 10001, 10002, 10003, 10004 |
| コノハ | `v5_konoha_normal` | 20001, 20002, 20003, 20004 |
| カバネ | `v5_kabane_normal` | 30001, 30002, 30003, 30004 |
| ハクレン | `v5_hakuren_serious`（基本の表情が「真剣」のため） | 40001, 40002, 40003, 40004 |
| イグニア | `v5_ignia_dazed`（基本の表情が「ぼんやり」のため） | 50001, 50002, 50003, 50004 |
| 黒瀬カイ | `v5_kai_blank`（素顔で試作し、仮面の影はあとで作る） | 60001, 60002, 60003, 60004 |
| ミサキ | `v5_misaki_normal` | 70001, 70002, 70003, 70004 |
| 先輩 | `v5_sakuma_profile` | 80001, 80002, 80003, 80004 |

Seed の数字に意味はない（あとで探しやすいように、キャラクターごとに桁をそろえただけ）。

### 手順2：良いものを選ぶ

次の項目をすべて満たすものを選ぶ。1つでも外れたら使わない。

| # | 基準 | 見るところ |
|---|---|---|
| 1 | 成人に見える | 顔つき、背の高さ、体つきが大人の女性（男性）に見える。幼く見えるものは、ほかが良くても使わない |
| 2 | 顔の特徴が設定どおり | 髪の色と長さ、目の色、種族の特徴（耳、角、牙、しっぽ）が2章のとおり。耳やしっぽが多すぎない |
| 3 | 服装が設定どおり | ノクティアの胸元の開いた黒いドレス、コノハの短い着物、カバネの腕と鎖骨のタトゥーとへそ出し、ハクレンの中華風の武具と槍、イグニアのゆったりした服と小さな角、GM の白いコート |
| 4 | 手と指が崩れていない | 指の数、関節の向き。ハクレンは槍の握り方も見る |
| 5 | 構図がそろっている | 全身が入っている（頭と足が切れていない）、正面、立ち、白い背景、こちらを見ている（先輩と仮面の影を除く） |
| 6 | 顔の絵に切り抜ける | 上半分を切り抜いたとき、顔が十分な大きさではっきりしている |
| 7 | 重ねやすい | 背景が白一色で、体の輪郭がはっきりしている。コノハはしっぽが目立たない |
| 8 | 文字や署名がない | 絵の中に文字、透かし、署名のようなものがない |

選んだ1枚を、そのキャラクターの「基準の絵」にする。基準の絵が決まるまで、手順3に進まない。

### 手順3：Ver4.5 で、参照画像を使って表情差分を出す

1. 基準の絵を参照画像にする（機能の名前と設定は要確認）。
2. プロンプトは手順1と同じものを使い、表情のタグだけを2章の表に合わせて入れかえる。
3. まず「通常」の表情で1枚作り、基準の絵と見比べて、参照画像の強さを決める（同じ人物に見えるか、表情がちゃんと変わるか）。決めた値を記録の表に書く。
4. 同じ設定、同じ Seed で、残りの表情を作る。顔が変わりすぎるときは、Seed を変えるより先に、参照画像の強さを見直す。
5. できた差分も、手順2の基準（とくに1と2）で確かめる。表情を変えると幼く見えることがある（照れ、驚き、泣き顔）ので、注意して見る。
6. 表情だけを描きかえる別の方法として、NovelAI の画面で顔の部分だけを描き直す機能を使えるかもしれない（機能があるか、使い方ともに**要確認**）。

### 記録の表（ひな形）

選んだ画像と、その設定を記録する。Seed とプロンプトが分かれば、同じ絵を作り直せる。

| キャラクター | 表情 | 段階（試作 Ver5／差分 Ver4.5） | ファイル名 | Seed | モデル | 大きさ | プロンプト（全文、またはこの文書との差分） | ネガティブ（共通に足したもの） | 参照画像（ファイル名） | 参照画像の設定（強さなど） | 選んだ理由・気になる点 | 日付 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| （例）コノハ | 通常 | 試作 Ver5 | `v5_konoha_normal_seed20003.png` | 20003 | （要確認） | 832×1216 | 2-2 のとおり | 2-2 のとおり | — | — | （例）耳としっぽの数が正しい | |
| （例）コノハ | 笑顔 | 差分 Ver4.5 | `konoha_smile_seed20003.png` | 20003 | （要確認） | 832×1216 | 表情のタグだけ 2-2「笑顔」 | 2-2 のとおり | `v5_konoha_normal_seed20003.png` | （要確認） | | |
| | | | | | | | | | | | | |

- 生成した画像と、`nai_generate.py` が一緒に保存する設定の JSON は `outputs/nai/` にある（Git 管理外）。この表は、どれを採用したかを残すためのもの。
- 採用した Seed は、ほかの絵（一枚絵など）でも同じキャラクターに使い回す（`asset-list.md` の「生成するときの注意」）。

## 7. 背景の例

| 場所 | タグの例 |
|---|---|
| 浜辺（朝） | `scenery, no humans, tropical beach, white sand, clear water, blue sky, morning, jungle in background` |
| 森 | `scenery, no humans, dense jungle, sunlight filtering through trees, path` |
| 洞窟 | `scenery, no humans, cave interior, torchlight, rock walls` |
| 浜の石碑 | `scenery, no humans, night, beach, black stone monolith, glowing blue letters` |
| 決戦の背景 | `scenery, no humans, ruined nest on cliff, dark red sky, before dawn, ominous` |

## 8. 生成の設定（案、要確認）

| 項目 | 値 |
|---|---|
| モデル | 試作は Ver5、差分は Ver4.5（2026-10-17、利用者の手順）。正式な名前と API での指定は要確認 |
| 立ち絵の大きさ | 832×1216（縦長） |
| 背景・一枚絵の大きさ | 1216×832（横長）。あとで 1280×720 に切り抜く |
| Seed | キャラクターごとに、手順2で選んだ基準の絵の Seed に固定する |

大きさや枚数、参照画像の機能によって、NovelAI の Anlas（有料のポイント）を使う場合がある。どの設定なら追加の費用がかからないかは、利用者の契約プランと NovelAI の資料で**要確認**。

NovelAI の生成画像を商用で使えるか、DLsite・FANZA で AI で作った絵をどう扱うかも**要確認**（`asset-list.md`）。
