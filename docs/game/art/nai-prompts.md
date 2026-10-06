# NovelAI 用のプロンプト（キャラクターの基本）

作成：2026-10-06　／　状態：案。実際に生成して、見た目を確かめてから直す（まだ一枚も生成していない）。

キャラクターの見た目は `../characters.md` に合わせている。タグは英語（NovelAI の Danbooru 系タグ）。

## 全員に共通

| 種類 | タグ |
|---|---|
| 品質 | `masterpiece, best quality, very aesthetic, absurdres` |
| 画風（案） | `anime coloring, soft lighting, detailed eyes` |
| 年齢をはっきりさせる | `adult, mature female, tall`（女性キャラクター全員。ほかのタグより前に置く） |
| ネガティブ（共通） | `lowres, bad anatomy, bad hands, extra fingers, missing fingers, text, watermark, signature, blurry, jpeg artifacts, child, loli, petite, flat chest, school uniform` |

立ち絵は `simple background, white background, full body, standing, looking at viewer` を足す（背景を抜きやすくするため）。

## キャラクターごとの基本タグ

### ノクティア（吸血鬼）

```
1girl, adult, mature female, tall, vampire, long hair, black hair, red eyes, pale skin, pointy ears, fangs,
black dress, off-shoulder dress, cleavage, elegant, seductive smile
```

### コノハ（狐の獣人）★メインヒロイン

```
1girl, adult, mature female, fox girl, fox ears, fox tail, orange hair, medium hair, amber eyes,
short kimono, cheerful, open mouth smile, energetic
```

しっぽの本数は `multiple tails` と本数の指定で差分を作る（うまくいかなければ、しっぽを別に描いて重ねる）。

### カバネ（ガシャドクロ）

```
1girl, adult, mature female, gyaru, platinum blonde hair, long hair, tan skin, false eyelashes,
skeleton tattoo, bone tattoo on arms, collarbone tattoo, crop top, midriff, navel, hoop earrings, smirk
```

### ハクレン（白虎）

```
1girl, adult, mature female, tall, muscular female, tiger girl, tiger ears, tiger tail, white hair, black streaks in hair,
long hair, ponytail, golden eyes, chinese armor, holding spear, serious
```

### イグニア（ドラゴン）

```
1girl, adult, mature female, tall, dragon girl, dragon horns, small horns, dragon tail, scales,
copper hair, very long hair, golden eyes, slit pupils, loose robe, sleepy, half-closed eyes
```

### 黒瀬カイ（GM）

```
1boy, adult male, around 30 years old, black hair, handsome, empty eyes, white coat, expressionless
```

12日目までの「仮面の影」は `white mask, silhouette, shadow, backlighting` を足す。

### ミサキ

```
1girl, adult, mature female, office lady, brown hair, bob cut, casual clothes
```

## 背景の例

| 場所 | タグの例 |
|---|---|
| 浜辺（朝） | `scenery, no humans, tropical beach, white sand, clear water, blue sky, morning, jungle in background` |
| 森 | `scenery, no humans, dense jungle, sunlight filtering through trees, path` |
| 洞窟 | `scenery, no humans, cave interior, torchlight, rock walls` |
| 浜の石碑 | `scenery, no humans, night, beach, black stone monolith, glowing blue letters` |
| 決戦の背景 | `scenery, no humans, ruined nest on cliff, dark red sky, before dawn, ominous` |

## 生成の設定（案、要確認）

| 項目 | 値 |
|---|---|
| モデル | NovelAI の最新の画像モデル（名前は API の資料で確認する） |
| 立ち絵の大きさ | 832×1216（縦長） |
| 背景・一枚絵の大きさ | 1216×832（横長）。あとで 1280×720 に切り抜く |
| Seed | キャラクターごとに固定する。最初の1枚で決める |

大きさや枚数によって、NovelAI の Anlas（有料のポイント）を使う場合がある。どの設定なら追加の費用がかからないかは、利用者の契約プランと NovelAI の資料で**要確認**。
