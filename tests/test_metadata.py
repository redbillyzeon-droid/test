from aialbum.metadata import read_metadata
from aialbum.tags import split_prompt, tags_for

from samples import (
    make_a1111_jpeg,
    make_a1111_png,
    make_nai_png,
    make_plain_png,
    make_stealth_png,
)


def test_a1111_png(tmp_path):
    meta = read_metadata(make_a1111_png(tmp_path / "a.png"))
    assert meta.source == "a1111"
    assert meta.prompt.startswith("masterpiece")
    assert "BREAK smile" in meta.prompt
    assert meta.negative == "(worst quality:1.4), lowres, bad hands"
    assert meta.params["Sampler"] == "Euler a"
    assert meta.params["Lora hashes"] == "detail_tweaker: 1234abcd"
    assert meta.params["Version"] == "neo"
    assert meta.model == "animagine-xl-4.0"
    assert meta.seed == 123456
    assert meta.steps == 28


def test_a1111_tags(tmp_path):
    meta = read_metadata(make_a1111_png(tmp_path / "a.png"))
    tags = tags_for(meta)
    prompt = [t for k, t in tags if k == "prompt"]
    assert prompt == [
        "masterpiece", "best quality", "1girl", "long hair", "blue eyes",
        "yor briar (spy x family)", "smile",
    ]
    assert ("lora", "detail_tweaker") in tags
    assert ("negative", "worst quality") in tags
    assert ("model", "animagine-xl-4.0") in tags
    assert ("source", "a1111") in tags


def test_jpeg_exif_both_endians(tmp_path):
    for le in (False, True):
        meta = read_metadata(make_a1111_jpeg(tmp_path / f"a{le}.jpg", little_endian=le))
        assert meta.source == "a1111"
        assert meta.seed == 123456
        assert meta.prompt.startswith("masterpiece")


def test_novelai_v4(tmp_path):
    meta = read_metadata(make_nai_png(tmp_path / "n.png"))
    assert meta.source == "novelai"
    assert meta.model == "NovelAI Diffusion V4.5"
    assert meta.seed == 987654321
    assert meta.params["Sampler"] == "k_euler_ancestral"
    assert meta.negative == "lowres, bad anatomy"
    assert [c["prompt"] for c in meta.characters] == [
        "girl, red hair, school uniform",
        "girl, [black hair], kimono",
    ]
    assert meta.characters[0]["negative"] == "hat"
    assert meta.characters[0]["center"] == {"x": 0.3, "y": 0.5}

    tags = tags_for(meta)
    prompt = [t for k, t in tags if k == "prompt"]
    assert prompt[:5] == ["2girls", "outdoors", "masterpiece", "cherry blossoms", "artist:foo"]
    assert "red hair" in prompt and "black hair" in prompt
    assert ("char", "kimono") in tags
    assert ("negative", "hat") in tags
    assert ("source", "novelai") in tags


def test_stealth(tmp_path):
    for compressed in (True, False):
        path = make_stealth_png(tmp_path / f"s{compressed}.png", compressed=compressed)
        meta = read_metadata(path)
        assert meta.stealth
        assert meta.source == "novelai"
        assert meta.seed == 987654321
        assert read_metadata(path, stealth="never").source == "unknown"


def test_plain_image(tmp_path):
    meta = read_metadata(make_plain_png(tmp_path / "p.png"))
    assert meta.source == "unknown"
    assert meta.width == 32


def test_split_prompt_variants():
    assert split_prompt("(a:1.3), [b], {{c}}, ((d)), e:0.5") == ["a", "b", "c", "d", "e"]
    assert split_prompt("-1::bad thing::, 2::x, y::") == ["bad thing", "x", "y"]
    assert split_prompt("a AND b\nc | d") == ["a", "b", "c", "d"]
    assert split_prompt("artist:someone, Long_Hair") == ["artist:someone", "long hair"]
