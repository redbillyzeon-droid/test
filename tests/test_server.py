import os

import pytest
from fastapi.testclient import TestClient

from aialbum.server import create_app

from samples import make_a1111_jpeg, make_a1111_png, make_nai_png, make_plain_png, make_stealth_png


@pytest.fixture
def env(tmp_path):
    images = tmp_path / "images"
    (images / "forge").mkdir(parents=True)
    (images / "nai").mkdir()
    make_a1111_png(images / "forge" / "a.png")
    make_a1111_jpeg(images / "forge" / "b.jpg")
    make_nai_png(images / "nai" / "n.png")
    make_stealth_png(images / "nai" / "s.png")
    make_plain_png(images / "plain.png")

    app = create_app(tmp_path / "data")
    client = TestClient(app)
    res = client.post("/api/folders", json={"path": str(images)})
    assert res.status_code == 200
    app.state.scanner.wait()
    return client, images, app


def names(client, **params):
    res = client.get("/api/images", params=params)
    assert res.status_code == 200
    return sorted(i["name"] for i in res.json()["items"])


def test_scan_and_search(env):
    client, images, app = env
    status = client.get("/api/scan").json()
    assert status["added"] == 5 and not status["errors"]

    assert names(client) == ["a.png", "b.jpg", "n.png", "plain.png", "s.png"]
    assert names(client, q="long hair") == ["a.png", "b.jpg"]
    assert names(client, q="long_hair, -smile") == []
    assert names(client, q="kimono | long hair") == ["a.png", "b.jpg", "n.png", "s.png"]
    assert names(client, q="source:novelai") == ["n.png", "s.png"]
    assert names(client, q="char:red hair") == ["n.png", "s.png"]
    assert names(client, q="lora:detail_tweaker") == ["a.png", "b.jpg"]
    assert names(client, q="cherry*") == ["n.png", "s.png"]
    assert names(client, q="seed:123456") == ["a.png", "b.jpg"]
    assert names(client, q='"spy x family"') == ["a.png", "b.jpg"]
    assert names(client, q="neg:bad hands") == ["a.png", "b.jpg"]
    assert names(client, folder=str(images / "nai")) == ["n.png", "s.png"]


def test_sort_and_paging(env):
    client, _, _ = env
    items = client.get("/api/images", params={"sort": "name", "order": "asc"}).json()["items"]
    assert [i["name"] for i in items] == ["a.png", "b.jpg", "n.png", "plain.png", "s.png"]
    first = client.get("/api/images", params={"sort": "random", "seed": 7, "limit": 3}).json()["items"]
    rest = client.get("/api/images", params={"sort": "random", "seed": 7, "offset": 3}).json()["items"]
    assert len({i["id"] for i in first + rest}) == 5


def test_facets_suggest_detail(env):
    client, _, _ = env
    facets = client.get("/api/facets", params={"q": "source:novelai"}).json()
    assert {"tag": "kimono", "count": 2} in facets
    suggest = client.get("/api/suggest", params={"prefix": "long"}).json()
    assert suggest[0]["value"] == "long hair"
    suggest = client.get("/api/suggest", params={"prefix": "lora:det"}).json()
    assert suggest[0]["value"] == "lora:detail_tweaker"

    item_id = client.get("/api/images", params={"q": "source:novelai"}).json()["items"][0]["id"]
    detail = client.get(f"/api/images/{item_id}").json()
    assert detail["meta"]["characters"][1]["prompt"] == "girl, [black hair], kimono"
    assert client.get(f"/api/thumb/{item_id}").headers["content-type"] == "image/webp"
    assert client.get(f"/api/file/{item_id}").status_code == 200


def test_user_tags_survive_move(env, tmp_path):
    client, images, app = env
    item = client.get("/api/images", params={"q": "source:novelai", "sort": "name", "order": "asc"}).json()["items"][0]
    assert client.post("/api/usertags", json={"ids": [item["id"]], "tag": "お気に入り"}).status_code == 200
    assert names(client, q="my:お気に入り") == ["n.png"]

    dest = images / "best"
    res = client.post("/api/move", json={"ids": [item["id"]], "dest": str(dest)}).json()
    assert res["done"] == 1 and not res["errors"]
    assert (dest / "n.png").exists() and not (images / "nai" / "n.png").exists()

    # 再スキャンしても消えず、お気に入りも残る
    client.post("/api/scan")
    app.state.scanner.wait()
    assert names(client, q="my:お気に入り") == ["n.png"]
    assert names(client, folder=str(dest)) == ["n.png"]
    assert client.get("/api/scan").json()["removed"] == 0


def test_copy_outside_registers_folder(env, tmp_path):
    client, _, _ = env
    item = client.get("/api/images", params={"q": "source:a1111"}).json()["items"][0]
    outside = tmp_path / "outside"
    res = client.post("/api/move", json={"ids": [item["id"]], "dest": str(outside), "mode": "copy"}).json()
    assert res["done"] == 1
    folders = [f["path"] for f in client.get("/api/folders").json()]
    assert os.path.normpath(str(outside)) in folders
    assert len(client.get("/api/images", params={"q": "source:a1111"}).json()["items"]) == 3


def test_incremental_rescan(env):
    client, images, app = env
    os.remove(images / "plain.png")
    make_a1111_png(images / "new.png")
    client.post("/api/scan")
    app.state.scanner.wait()
    status = client.get("/api/scan").json()
    assert status["added"] == 1 and status["removed"] == 1


def test_export_csv(env):
    client, _, _ = env
    res = client.get("/api/export.csv", params={"q": "source:novelai"})
    assert res.status_code == 200
    lines = res.text.strip().splitlines()
    assert len(lines) == 3
