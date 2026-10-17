"""nai_generate.py のテスト（ネットワークには接続しない。標準ライブラリの unittest だけで動く）。

実行：python -m unittest game/tools/test_nai_generate.py -v
      （pytest があれば python -m pytest game/tools/test_nai_generate.py でも動く）
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nai_generate as nai  # noqa: E402

MALE_PROMPT = "1boy, adult, mature male, around 30 years old, black hair"
FEMALE_PROMPT = "1girl, adult, mature female, fox ears"
PNG_BYTES = nai.PNG_MAGIC + b"\x00" * 32  # 中身は使わない。先頭の印だけ本物にする


def tags(text: str) -> list[str]:
    return [t.lower() for t in nai.split_tags(text)]


def run_main(argv: list[str]) -> tuple[int | str | None, str]:
    out = io.StringIO()
    code: int | str | None
    with contextlib.redirect_stdout(out), mock.patch.object(nai, "generate", side_effect=AssertionError("送信してはいけない")):
        try:
            code = nai.main(argv)
        except SystemExit as e:
            code = e.code
    return code, out.getvalue()


class NegativeTest(unittest.TestCase):
    def test_detect_gender(self):
        self.assertEqual(nai.detect_gender(MALE_PROMPT), "male")
        self.assertEqual(nai.detect_gender(FEMALE_PROMPT), "female")
        self.assertEqual(nai.detect_gender("1boy, 1girl, adult"), "mixed")
        self.assertEqual(nai.detect_gender("no humans, scenery"), "none")

    def test_male_negative_has_no_flat_chest(self):
        neg = tags(nai.build_negative("", "male"))
        self.assertNotIn("flat chest", neg)
        self.assertIn("breasts", neg)
        self.assertIn("female", neg)
        # 成人の見た目にするためのタグは、男性でも消さない
        for t in ("child", "loli", "petite"):
            self.assertIn(t, neg)

    def test_male_negative_removes_flat_chest_even_if_added(self):
        neg = tags(nai.build_negative("breasts, female, 1girl, flat chest, smile", "male"))
        self.assertNotIn("flat chest", neg)
        self.assertEqual(neg.count("breasts"), 1)  # 重なったタグは1つにする
        self.assertEqual(neg.count("female"), 1)
        self.assertIn("smile", neg)

    def test_female_and_mixed_keep_common_negative(self):
        for g in ("female", "mixed", "none"):
            neg = tags(nai.build_negative("furry", g))
            self.assertIn("flat chest", neg, g)
            self.assertNotIn("breasts", neg, g)
            self.assertEqual(neg[-1], "furry")

    def test_main_male_dry_run(self):
        code, out = run_main(["--name", "kai", "--prompt", MALE_PROMPT, "--seed", "1"])
        self.assertEqual(code, 0)
        payload = json.loads(out.split("送る内容：", 1)[1].split("\n注意", 1)[0])
        neg = payload["parameters"]["negative_prompt"]
        self.assertNotIn("flat chest", tags(neg))
        self.assertEqual(payload["parameters"]["v4_negative_prompt"]["caption"]["base_caption"], neg)

    def test_main_gender_override(self):
        code, out = run_main(["--name", "x", "--prompt", MALE_PROMPT, "--seed", "1", "--gender", "female"])
        self.assertEqual(code, 0)
        self.assertIn("flat chest", out)

    def test_male_prompt_still_needs_adult(self):
        code, _ = run_main(["--name", "x", "--prompt", "1boy, mature male"])
        self.assertIsInstance(code, str)
        self.assertIn("adult", code)

    def test_check_prompt_three_people_needs_adult(self):
        # 3girls・3boys も人物として扱い、adult がなければ止める（既存の 1girl・1other も落とさない）
        for head in ("3girls", "3boys", "1girl", "multiple boys", "1other"):
            with self.subTest(head=head):
                with self.assertRaises(SystemExit) as cm:
                    nai.check_prompt(f"{head}, fox ears")
                self.assertIn("adult", str(cm.exception.code))
                nai.check_prompt(f"{head}, adult, fox ears")  # adult があれば止めない


class ReferenceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.png = Path(self.tmp.name) / "v5_konoha_normal_seed20003.png"
        self.png.write_bytes(PNG_BYTES)

    def tearDown(self):
        self.tmp.cleanup()

    def test_dry_run_with_reference(self):
        code, out = run_main(["--name", "konoha_smile", "--prompt", FEMALE_PROMPT, "--seed", "2",
                              "--reference", str(self.png), "--reference-strength", "0.5"])
        self.assertEqual(code, 0)
        self.assertIn("要確認", out)
        payload = json.loads(out.split("送る内容：", 1)[1].split("\n注意", 1)[0])
        p = payload["parameters"]
        self.assertEqual(p[nai.REFERENCE_KEYS["strength"]], [0.5])
        self.assertEqual(p[nai.REFERENCE_KEYS["information"]], [1.0])
        # 表示では base64 の中身を出さない
        self.assertTrue(p[nai.REFERENCE_KEYS["images"]][0].startswith("<PNG base64"))

    def test_add_reference_sends_base64(self):
        payload = nai.build_payload(FEMALE_PROMPT, "x", "portrait", 1, nai.DEFAULT_MODEL, 28, 5.0)
        nai.add_reference(payload, nai.load_reference(self.png), 0.6, 1.0)
        import base64
        sent = payload["parameters"][nai.REFERENCE_KEYS["images"]][0]
        self.assertEqual(base64.b64decode(sent), PNG_BYTES)

    def test_run_with_reference_needs_confirmation(self):
        # 項目名が要確認のあいだは、--run でも送信しない（キーを読む前に止まる）
        with mock.patch.dict("os.environ", {}, clear=False):
            code, _ = run_main(["--name", "x", "--prompt", FEMALE_PROMPT, "--reference", str(self.png), "--run"])
        self.assertIsInstance(code, str)
        self.assertIn("--reference-confirmed", code)

    def test_reference_must_be_png(self):
        bad = Path(self.tmp.name) / "a.png"
        bad.write_bytes(b"not a png")
        code, _ = run_main(["--name", "x", "--prompt", FEMALE_PROMPT, "--reference", str(bad)])
        self.assertIsInstance(code, str)
        self.assertIn("PNG", code)

    def test_reference_strength_range(self):
        code, _ = run_main(["--name", "x", "--prompt", FEMALE_PROMPT, "--reference", str(self.png), "--reference-strength", "1.5"])
        self.assertIsInstance(code, str)


if __name__ == "__main__":
    unittest.main()
