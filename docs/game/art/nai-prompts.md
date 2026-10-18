# NovelAI 用のプロンプト（キャラクターの基本と立ち絵）

作成：2026-10-06　／　更新：2026-10-17（キャラクターごとの服装・表情差分・ネガティブ、生成の手順を追加。9章に画面用の背景を追加。9-3 に拠点の背景3枚を追加。9-3 の夜の版を「後日の案」に）
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

ネガティブに足す：`furry, animal nose, extra ears, multiple tails, kitsune, kyuubi, short stature, chibi`（Ver5 では、さらに `off shoulder, bare shoulders, cleavage, socks, tabi` を足した。2026-10-18、記録の表）

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

- Ver5 と Ver4.5 のモデルの正式な名前と、API で指定する名前。2026-10-18 に API で確かめた：Ver4.5 は `nai-diffusion-4-5-full`、Ver5 は `nai-diffusion-5-full`（`--model nai-diffusion-5-full`）で、どちらも生成できた。Ver5 の名前は公式の資料にはなく、コミュニティのツールが使う名前を試したもの。
- Ver4.5 で参照画像を使うときは、画像をそのまま送らず、先に `https://image.novelai.net/ai/encode-vibe` で vibe に変換してから `reference_image_multiple` に入れる（`D:\AI社員	ools
ai_generate.py` の実績。生の画像だと 500 になる）。`nai_generate.py` はまだこの形に対応していない。
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
| **コノハ** | 通常 | 試作 Ver5（**基準の絵**） | `v5_konoha_normal_seed340993522.png` | 340993522 | `nai-diffusion-5-full` | 832×1216 | 2-2 のとおり（基本・服装・通常の表情・1-3 の構図・画風・品質） | 2-2 のとおり ＋ `off shoulder, bare shoulders, cleavage, socks, tabi`（Ver5 は肩出し・胸元・足袋が出やすかったため） | — | — | 肩を出さない、素足に草履、しっぽは中くらいで右へ出る。鈴は2つ（Ver5 は `bell hair ornament` を左右一対で描きやすい。利用者が2つでよいと判断）。全13枚（Ver4.5 5枚、Ver5 8枚）から利用者が選んだ | 2026-10-18 |

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

## 9. 画面用の背景（2026-10-17 追加、案）

`menu-ui.md` の探索マップとタイトル画面に使う。人物は描かないので、`adult` のタグは入れない（`no humans`）。ネガティブは共通のものに、下の表の分を足す。大きさは 8章の背景と同じ 1216×832（あとで 1280×720 に切り抜く）。

### 9-1. 島の全体図（探索マップ）

ファイル名：`ui_island_map`。Seed の案：90001, 90002, 90003, 90004。

```
scenery, no humans, illustrated map, fantasy map, bird's-eye view, from above, a single small tropical island surrounded by calm blue sea, white sand beach on the south shore, dense green jungle in the center, a river flowing from the center to the east coast, grey rocky area on the east side, dark cliffs with a cave entrance on the west side, a tall mountain peak in the north, a small rocky cape on the south coast, a wrecked wooden ship in shallow water off the southern cape, hand-painted, watercolor, soft colors, morning light, masterpiece, best quality, very aesthetic, absurdres
```

ネガティブに足す：`text, letters, words, labels, numbers, compass rose, grid, legend, frame, border, people, character, buildings, city, multiple islands, modern ship`

- 島が画面の中央に入り、上下に海が少し残る構図を選ぶ（1280×720 に切り抜くと、上下が約 80px ずつ切れるため）。
- エリアの位置（北に山頂、西に洞窟、南に浜辺、南の岬の沖に沈没船など）は、`menu-ui.md` 4章の札の位置に合わせたい。NovelAI で方角どおりに描けるかは**要確認**。外れたら、札の位置を絵に合わせて直す（絵を優先）。
- 2026-10-17 直し：沈没船を「南東の沖」から「南の岬の沖」にした（8日目の木の札「南の岬に、船がある」に合わせる）。
- 地図に文字が描かれやすい。文字が入ったものは使わない（6章の手順2の基準8）。
- 夜は画面の膜（紺 45%）で暗くするので、夜の版は作らない。

### 9-2. タイトル画面の背景

ファイル名：`ui_title`。Seed の案：91001, 91002, 91003, 91004。

```
scenery, no humans, tropical island beach at dawn, view from the shore, a black stone monolith standing on the sand, faint glowing blue letters on the monolith, dark navy sky turning orange at the horizon, calm waves, footprints in the sand, driftwood, quiet, melancholic, hopeful, wide shot, anime coloring, soft lighting, masterpiece, best quality, very aesthetic, absurdres
```

ネガティブに足す：`text, logo, title, watermark, people, character, silhouette, ship, buildings, bright daylight`

- 左上にロゴ（文字で作る。x 60〜680、y 80〜280）、右側にボタン（x 900〜1220、y 300〜522）が乗るので、石碑は画面の中央からやや下（1280×720 で x 560〜860、y 330〜700 の目安）に来る構図を選ぶ（`menu-ui.md` 6-2）。右寄りの石碑はボタンに隠れるので使わない。少しずれている絵は、1280×720 に切り抜く位置を左右にずらして合わせる。
- 2026-10-17 直し：前は「中央からやや右下」と書いていたが、ボタンの列に隠れるので直した。
- 石碑の「光る文字」は模様に見えればよい。読める文字（英語や日本語）になったものは使わない。
- 夜明け（暗い紺からオレンジ）は、「失ったあとに、また朝が来る」の意味で選んだ案。

### 9-3. 拠点の背景（発展度で3枚。2026-10-17 追加）

`menu-ui.md` 2-3、`design/life-bond.md` 5章・8章 Q10（2026-10-17 決定）。拠点は「森を抜けた先の小さな広場。大きな木の根元に、葉っぱで屋根をかけただけの小屋」（`script/00_prologue_day1.md` 228〜230行）。海は台本に出てこないので描かない。

3枚は「同じ場所が育った」と分かるように、場所と構図を変えない。プロンプトは「共通の部分」＋「発展度ごとの部分」＋「品質」で作り、共通の部分は3枚で一字も変えない。

共通の部分：

```
scenery, no humans, a small grassy clearing in a tropical jungle, a huge old tree with thick roots on the left side, dense green jungle surrounding the clearing, a stone-ringed campfire in the center of the clearing, a small hut built against the roots of the huge tree, blue sky above the treetops, daytime, soft sunlight, eye level, wide shot, anime coloring, soft lighting, hand-painted
```

発展度ごとの部分：

| 発展度 | ファイル名 | Seed の案 | 発展度ごとの部分 |
|---|---|---|---|
| 0〜1 | `bg_base_dev0` | 92001, 92002, 92003, 92004 | `a tiny hut with a roof of large leaves, a pile of driftwood, a few fishing nets drying on a branch, castaway camp, simple, rustic, lonely but warm` |
| 2〜3 | `bg_base_dev2` | 92001, 92002, 92003, 92004（0〜1 と同じ） | `the leaf hut reinforced with wooden planks, log benches around the campfire, a wooden drying rack, stacked firewood, a low wooden fence, a trodden dirt path leading into the jungle, lived-in, cozy` |
| 4〜6 | `bg_base_dev4` | 92001, 92002, 92003, 92004（0〜1 と同じ） | `a tiny peaceful village in the clearing, several small wooden huts with leaf roofs on low stone foundations, stone-paved paths, log benches around the campfire, wooden drying racks, wooden fences with small flowers, rope bridges between the trees, lived-in, cozy, warm and lively` |

品質（3枚とも最後に足す）：`masterpiece, best quality, very aesthetic, absurdres`

ネガティブに足す（3枚とも同じ）：

```
text, watermark, people, character, silhouette, animals, ocean, sea, beach, modern buildings, concrete, metal roof, glass windows, car, power lines, city, castle, ruins, destroyed, watchtower, tower, pier, dock, boat, farm field, crops, oven, kiln, forge, night, dark
```

- 人物は描かないので、`adult` のタグは入れない（`no humans`）。`nai_generate.py` の `check_prompt` は、タグに `no humans` があれば `adult` の確かめをしない（2026-10-17、コードを読んで確かめた。動かしてはいない）。
- 施設そのもの（かまど、作業台、畑、家、見張り台、船着き場）は、どれと分かる形で描かない（`menu-ui.md` 2-3）。どの施設を建てたかは人によって違うため。そのため、見張り台・船着き場・畑・かまどに当たるタグをネガティブに入れた。発展度4〜6の「小屋がいくつか」は、特定の施設ではなく暮らしの量として描く。
- 1280×720 に切り抜いたとき、焚き火が x 460〜700 に、大木の幹が左（x 60〜460）に来るものを選ぶ（`menu-ui.md` 2-3 の表）。左右は切り抜く位置で合わせる。上下は約 80px ずつ切れるので、焚き火が絵の上下の中央に近いものを選ぶ。
- 1日目・2日目の【背景：森の中の広場・昼】と同じ場所なので、`bg_base_dev0` を兼ねて使える（使うかはシナリオ担当とプログラム担当が決める）。
- 文字や看板のようなものが描かれた絵は使わない（6章の手順2の基準8）。

作る順（案）：

1. `bg_base_dev0` を Seed 4つで作り、構図の良い1枚を選ぶ（上の切り抜きの条件と、6章の手順2の基準8）。
2. 選んだ1枚を参照画像にして、同じ Seed で `bg_base_dev2`、`bg_base_dev4` を作る。大木と広場の形が変わらず、小屋や道だけが増えるように、参照画像の強さを決める（6章の手順3と同じやり方。`nai_generate.py` には `--reference`・`--reference-strength` があるが、API の項目名はスクリプトの中でも**要確認**。参照画像の機能が人物の見た目を引き継ぐためのもので、背景の構図を保つのに効くかも**要確認**）。
3. 参照画像を使えないときは、同じ Seed と共通の部分だけで作り、3枚を並べて見比べ、同じ場所に見える組を選ぶ。同じ場所に見えなければ、2枚目・3枚目は画像の一部を描き直す機能（あるかどうか**要確認**）で、1枚目に小屋や道を描き足す。
4. 3枚を並べて、0〜1 → 2〜3 → 4〜6 の順に、はっきり育って見えるかを確かめる。差が小さいときは、発展度ごとの部分のタグを足す（例：4〜6 に `many huts`）。

夜の版（後日の案。いまは作らない）：2026-10-17 決定（`plan.md` の表の末尾）で、拠点の夜は、昼の3枚に夜の膜（紺 #2b3a78、`adv-ui.md` の夜の色）と図形の焚き火の光を重ねて始める（`menu-ui.md` 2-3）。膜で足りないと分かったときだけ、夜の絵3枚を作る。そのときは、共通の部分の `blue sky above the treetops, daytime, soft sunlight` を `night, starry sky above the treetops, warm firelight from the campfire, moonlight` に、ネガティブの `night, dark` を `daytime, bright sky` に入れかえ、昼の絵を参照画像にして作る。ファイル名は `bg_base_dev0_night`・`bg_base_dev2_night`・`bg_base_dev4_night`、Seed は昼に選んだ1枚と同じ。作るかどうかは主担当と利用者が決める。

