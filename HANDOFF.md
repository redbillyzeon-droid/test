# 引き継ぎメモ：ComfyUIで実写の動画から動画を作る（V2V）

## ゴール
- 自分で撮影した動画を元に、ComfyUIで**実写の動画**を作る。
  - 候補A：撮影した動画の人物を、別の人物（または別の服装の自分）に置き換える → **Wan 2.2 Animate**
  - 候補B：自分の映像のまま、背景・服装・雰囲気を変える → **Wan VACE / Fun Control（Depth）**
  - **A・Bのどちらにするかは未決定**
- 出力は**DVDくらいの画質**（480p・約30fps）。

## PC環境
| 項目 | 内容 |
|---|---|
| GPU | RTX 5080（VRAM 16GB、Blackwell世代） |
| RAM | 32GB |
| ComfyUIの起動方法 | **Stability Matrix** |
| OS | 未確認（おそらくWindows） |

### 注意点
- RTX 50シリーズでは、**CUDA 12.8以降に対応したPyTorch**が必要。Stability Matrix本体とComfyUIを最新版にしておくこと。
  - `no kernel image is available` のようなエラーが出たら、ComfyUIを更新するか再インストールする。
- RAMが32GBなので、14Bモデルは**GGUF版（Q4_K_M〜Q5_K_M）**を使う。あわせて、Windowsの**仮想メモリ（ページファイル）を32〜64GB**に増やす。

## 必要なカスタムノード
- ComfyUI-Manager
- VideoHelperSuite（動画の読み込みと保存）
- ComfyUI-GGUF
- comfyui_controlnet_aux（DWPose、Depth Anythingなどの前処理）
- ComfyUI-Frame-Interpolation（RIFE）

## モデルの置き場所（Stability Matrix）
`StabilityMatrix\Data\Models\` の下に、次のように置く。
- 本体モデル → `DiffusionModels`（または `unet`）
- テキストエンコーダー（`umt5_xxl_fp8_e4m3fn_scaled`）→ `TextEncoders`（または `CLIP`）
- VAE → `VAE`
- LoRA（LightX2Vなど）→ `Lora`

フォルダ名はバージョンによって少し違うことがあるので、実際のフォルダ一覧で確認すること。

## 推奨設定
| 項目 | 値 |
|---|---|
| 解像度 | 832×480（16:9） |
| 長さ | 81フレームずつ（16fpsで約5秒）。元の動画は3〜5秒に切り、`force_rate` 16 で読み込む |
| モデル | Wan 2.2 Animate 14B または VACE 14B（GGUF Q4〜Q5） |
| 高速化 | LightX2V LoRA を使い、4〜8ステップ、CFG 1.0 |
| 実写らしくするプロンプト | `photorealistic, natural lighting, shot on 35mm, film grain`（ネガティブプロンプト：`anime, cartoon, illustration, CGI`） |
| フレーム補間 | RIFE で2倍 → Video Combine で 30fps、h264-mp4、crf 17〜19 |
| 任意 | 4x-UltraSharp などで2倍にアップスケールする |

ワークフローの流れ：
```
Load Video → 前処理(DWPose / Depth) → Wan(Animate / VACE) → VAE Decode
  → RIFE VFI (x2) → Video Combine (30fps, mp4)
```

まず試すなら、**Wan 2.2 TI2V 5B**（テンプレートにある）で動作確認をするのがおすすめ。

## DVDディスクにする場合
DVDStylerなどでmp4をDVD-Video形式（MPEG-2）に変換して書き込む。

## 注意
実在の人物に置き換える場合は、**本人の許可を取ること**（自分自身なら問題ない）。

## 次にやること（ローカルのセッションで）
1. [ ] OSとStability Matrix / ComfyUIのバージョンを確認する。`nvidia-smi` でドライバとCUDAのバージョンも確認する。
2. [ ] ComfyUIが起動するか、RTX 50シリーズで問題なく動くかを確認する。
3. [ ] 上記のカスタムノードをインストールする。
4. [ ] 候補A（Animate）と候補B（VACE）のどちらにするかを決める。
5. [ ] 決めたほうのモデルファイルをダウンロードして、指定のフォルダに置く。
6. [ ] 3〜5秒のテスト動画で生成してみる。

## ローカルでの引き継ぎ方法
- 会話を引き継ぐ：`claude --teleport`
- PCで直接作業させる：Stability Matrixのフォルダでターミナルを開き、`claude remote-control` を実行する（またはClaude Desktopアプリを使う）。そのうえで、このファイルを読ませる。
