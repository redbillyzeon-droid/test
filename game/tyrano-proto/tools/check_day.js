/*
 * 1日の流れの画面の試作（data/scenario/day_test.ks、data/others/day_ui/）を、ブラウザで自動操作して確かめるスクリプト。
 * 前提と使い方は check_adv.js と同じ：
 *   node game/tyrano-proto/tools/check_day.js http://127.0.0.1:8799/index.html
 * 計算そのものは check_day_rules.js（ブラウザなし）で確かめる。ここは画面と、自動セーブ・セーブの停止。
 */
const { chromium } = require("playwright");

const url = process.argv[2] || "http://127.0.0.1:8799/index.html";

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    const results = [];
    const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const wait = (ms) => page.waitForTimeout(ms);
    let clicks = 0;
    const click = async (sel) => { clicks++; await page.click(sel); await wait(250); };
    const text = (sel) => ev((s) => $(s).text(), sel);

    await page.goto(url);
    await ev(() => localStorage.clear());
    await page.goto(url);
    await page.waitForSelector(".glink_button", { timeout: 20000 });
    await wait(1500);

    async function openPreset(label) {
        if (!(await page.$(`.glink_button:has-text("${label}")`))) {
            if (await page.$(".glink_button:has-text('1日の画面のテスト')")) { /* もうテストのメニュー */ }
            else if (await page.$(".du-exit")) await page.click(".du-exit");
            else if (await page.$(".du-day14-exit")) await page.click(".du-day14-exit");
            else await ev(() => DayUI.exit()); // まとめの画面などから（テスト用の戻り道）
            await page.waitForSelector(".glink_button:has-text('1日の画面のテスト')", { timeout: 15000 });
            await wait(1200);
            await wait(1200);
            await page.click("text=1日の画面のテスト");
        }
        await page.waitForSelector(`.glink_button:has-text("${label}")`, { timeout: 15000 });
        await wait(1200);
        await page.click(`.glink_button:has-text("${label}")`);
        await page.waitForSelector(".du-act", { timeout: 15000 });
        await wait(400);
    }

    // ---- A. 9日目・朝（life-bond.md 6-2 の計画の途中） ----
    await openPreset("真エンドの計画：9日目・朝");
    let s = await ev(() => ({
        acts: $(".du-act").length, day: $(".li-day").text(), slot: $(".li-slot").text(), next: $(".li-next").text(),
        faces: $(".du-meet-one .du-face").map((i, e) => e.dataset.name + ":" + ($(e).find(".du-mark.heart").length ? "heart" : $(e).find(".du-mark.gift").length ? "gift" : "-")).get().join(","),
        spendTag: $(".du-act[data-act=spend] .du-evtag").text(), trainHeart: $(".du-act[data-act=train] .du-mark.heart").length,
    }));
    check("行動を選ぶ画面：行動のボタンが5つ、日付は9日目・朝", s.acts === 5 && s.day === "9日目" && s.slot === "朝", JSON.stringify(s));
    check("「次にやること」の1行：作業台が壊れているので、ヒント2（H9 より先）", s.next === "次にやること：壊れたものは「建てる・作る」で直せる", s.next);
    check("「いま会える」の顔：コノハ・カバネ・ハクレンに印", s.faces === "konoha:heart,kabane:heart,hakuren:heart", s.faces);
    check("［ヒロインと過ごす］に「イベントあり」、朝の［鍛える］にもハクレンの印", s.spendTag.includes("イベントあり") && s.trainHeart === 1, JSON.stringify(s));

    clicks = 0;
    await click(".li-status-btn");
    s = await ev(() => ({
        open: $(".du-status").length, rows: $(".du-srow").map((i, e) => e.dataset.name).get().join(","),
        rowText: $(".du-srow").text(), all: $(".du-all").text(),
        marks: $(".du-srow").map((i, e) => e.dataset.name + ":" + ($(e).find(".du-st-mark .du-mark").attr("class") || "-").replace("du-mark ", "").replace(/ s\d+/, "")).get().join(","),
        noctiaWords: $(".du-srow[data-name=noctia] .du-st-words").text(),
        now: $(".du-srow").filter((i, e) => $(e).find(".du-nowtag").length).map((i, e) => e.dataset.name).get().join(","),
        cells: $(".du-srow[data-name=noctia] .du-cell.on").length,
    }));
    check("状態画面がクリック1回で開く。5人の行（ノクティア・コノハ・カバネ・ハクレン・イグニアの順）", clicks === 1 && s.open === 1 && s.rows === "noctia,konoha,kabane,hakuren,ignia", JSON.stringify(s));
    check("状態画面のヒロインの行に数字が出ない（好感度を出さない）", !/[0-9０-９]/.test(s.rowText), s.rowText.match(/.{0,8}[0-9].{0,8}/));
    check("状態画面の印：ノクティアはなし、ほかの4人はふつうの印", s.marks === "noctia:-,konoha:heart,kabane:heart,hakuren:heart,ignia:heart", s.marks);
    check("段階4のことば「心が通った（決戦の相棒になれる）」", s.noctiaWords === "心が通った（決戦の相棒になれる）", s.noctiaWords);
    check("ノクティアの棒：好感度81・段階4 → 7マス（(81−70)÷15）", s.cells === 7, String(s.cells));
    check("「いま会える」の札は、朝に会える3人だけ", s.now === "konoha,kabane,hakuren", s.now);
    check("「全員と心を通わせるまで」：あと7回／残りの行動11回", s.all.includes("あと 7 回") && s.all.includes("残りの行動 11 回"), s.all);
    clicks = 0;
    await click(".du-tab[data-tab=yu]");
    s = await ev(() => ({ yu: $(".du-status").text(), gifts: $(".du-gift").map((i, e) => e.dataset.name + ":" + e.className.replace("du-gift ", "") + ":" + $(e).find(".du-ini").text()).get().join(","),
        q: $(".du-gift.unknown .du-gift-q").length, broken: $(".du-fac[data-id=workbench]").text() }));
    check("タブの切りかえはクリック1回（ユウと島）", clicks === 1 && s.yu.includes("島の発展度"), s.yu.slice(0, 60));
    check("ユウと島：心（f.mind）は出さない", !s.yu.includes("心"), s.yu.match(/.{0,6}心.{0,6}/));
    check("好物の欄：ノクティア・イグニアは「渡した」、ほかの3人は「？」と頭文字", s.gifts === "noctia:gave:ノ,konoha:unknown:コ,kabane:unknown:カ,hakuren:unknown:ハ,ignia:gave:イ" && s.q === 3, s.gifts);
    check("作業台：壊れている（発展度に数えない）", s.broken.includes("壊れている（発展度に数えない）"), s.broken);
    clicks = 0;
    await click(".du-close");
    check("×で閉じる（クリック1回）", clicks === 1 && (await ev(() => $(".du-status").length)) === 0);
    await page.click(".li-status-btn"); await wait(200);
    await page.click(".du-status", { button: "right", position: { x: 600, y: 650 } }); await wait(200);
    check("右クリックでも閉じる", (await ev(() => $(".du-status").length)) === 0);

    await page.click(".li-status-btn"); await wait(200);
    await ev(() => TYRANO.kag.menu.displaySave()); await wait(300);
    s = await ev(() => ({ toast: $(".du-toast").text(), list: $(".save_list").length }));
    check("状態画面を開いている間は、手動セーブを止めて文を出す", s.toast === "画面を閉じてから、セーブしてください" && s.list === 0, JSON.stringify(s));
    await page.click(".du-close"); await wait(200);

    // 建てる一覧：作業台を直す（木材が足りない）
    await click(".du-act[data-act=build]");
    s = await ev(() => ({ repair: $(".du-brow.repair").text(), short: $(".du-brow.repair").hasClass("short"), field: $(".du-brow[data-id=field] .du-yukari").text() }));
    check("建てる一覧：直す（木材 あと2、押せない）、まだ建てていない施設に「ゆかり」の札", s.repair.includes("木材 あと2") && s.short && s.field === "ゆかり", JSON.stringify(s));
    await click(".du-panel .du-back");

    // 探索マップ
    clicks = 0;
    await click(".du-act[data-act=explore]");
    s = await ev(() => ({ invite: $(".du-panel").text() }));
    check("誘う相手の一覧：［一人で行く］、得意の素材、「イベントは『過ごす』で」", s.invite.includes("一人で行く") && s.invite.includes("得意：木材") && s.invite.includes("イベントは「過ごす」で"), s.invite);
    await click(".du-panel .du-row[data-name=''] .du-row-main");
    s = await ev(() => ({
        areas: $(".du-area").length, first: $(".du-area").filter((i, e) => $(e).find(".du-first").length).map((i, e) => e.dataset.area).get().join(","),
        q: $(".du-area").filter((i, e) => $(e).find(".du-qbox").length).map((i, e) => e.dataset.area).get().join(","),
        locked: $(".du-area.locked").map((i, e) => e.dataset.area + ":" + $(e).find(".du-area-lock").text()).get().join(","),
        hidden: $(".du-area.du-unknown").text(), hiddenShown: $(".du-area.du-unknown").is(":visible"), pos: $(".du-area[data-area=beach]").css("left") + "," + $(".du-area[data-area=beach]").css("top"),
    }));
    check("探索マップ：7つのエリア、浜辺の札は (480, 540)", s.areas === 7 && s.pos === "480px,540px", JSON.stringify(s));
    check("「初めて」の札は、行けてまだ行っていない浜辺だけ（森・川は行った）", s.first === "beach", s.first);
    check("「？」の枠は浜辺だけ（川・岩場には付けない）", s.q === "beach", s.q);
    check("行けないエリアの条件：山頂・洞窟・岩場", s.locked === "summit:縄ばしごを作ると行ける,cave:松明を作ると行ける,rock:森をあと2回探索すると行ける", s.locked);
    check("沈没船は「？？？」の札で見える", s.hidden === "？？？" && s.hiddenShown, s.hidden);
    await click(".du-area[data-area=beach]");
    s = await ev(() => $(".du-card").text());
    check("探索はクリック2回（一人で行く・エリア）。初めての浜辺で虹色の貝殻", clicks === 3 && s.includes("虹色の貝殻"), clicks + " " + s);
    await click(".du-cardwrap");
    check("結果のカードはクリック1回で閉じて、次の時間帯（昼）へ", (await text(".li-slot")) === "昼");

    // 過ごす（二人きり）：段階のイベント
    clicks = 0;
    await click(".du-act[data-act=spend]");
    await click(".du-row[data-name=ignia] .du-row-main");
    s = await ev(() => $(".du-card").text());
    check("過ごすはクリック1回（一覧の行）で結果。イグニア段階4のことばが出る", clicks === 2 && s.includes("イグニア：心が通った（決戦の相棒になれる）"), s);
    check("段階4の結果のカードに「ユウの心が、少し強くなった」（数字なし）", s.includes("ユウの心が、少し強くなった"), s);
    await click(".du-cardwrap");

    // ---- B. 2日目・夜（イグニアに魚） ----
    await openPreset("真エンドの計画：2日目・夜（イグニアに魚）");
    s = await ev(() => ({ faces: $(".du-meet-one .du-face").map((i, e) => e.dataset.name + ":" + ($(e).find(".du-mark.gift").length ? "gift" : $(e).find(".du-mark.heart").length ? "heart" : "-")).get().join(",") }));
    check("好物つきの印：「いま会える」のイグニアの顔に好物つき、カバネはふつうの印", s.faces === "noctia:-,kabane:heart,ignia:gift", s.faces);
    await click(".du-act[data-act=spend]");
    s = await ev(() => ({ btn: $(".du-row[data-name=ignia] .du-giftbtn").text(), giftMark: $(".du-row[data-name=ignia] .du-giftbtn .du-mark.gift").length,
        plainMark: $(".du-row[data-name=ignia] .du-row-mark .du-mark").length }));
    check("過ごす一覧：イグニアの行に［好物を渡して過ごす］と好物つきの印（［過ごす］には出さない）",
        s.btn.includes("好物を渡して過ごす") && s.btn.includes("好物でイベントあり") && s.giftMark === 1 && s.plainMark === 0, JSON.stringify(s));
    await click(".du-row[data-name=ignia] .du-giftbtn");
    s = await ev(() => $(".du-card").text());
    check("［好物を渡して過ごす］で段階1のイベント、「+10（好物）」", s.includes("+10（好物）") && s.includes("イグニア：打ち解けた"), s);
    await click(".du-cardwrap");
    s = await ev(() => ({ open: $(".du-summary").length, title: $(".du-sum-title").text(), mates: $(".du-sum-mate").map((i, e) => e.dataset.name).get().join(","),
        rest: $(".du-sum-rest").text(), btns: [$(".du-sum-save").text(), $(".du-sum-detail").text(), $(".du-sum-next").text()].join("/"),
        warn: $(".du-sum-warn").text(), stage: $(".du-sum-mate[data-name=ignia] .du-sum-stage").text(), nums: $(".du-sum-box.mates").text() }));
    check("夜の行動のあと、1日のまとめ（「2日目が終わった」）", s.open === 1 && s.title === "2日目が終わった", JSON.stringify(s));
    check("まとめ：［セーブ］［くわしく］［次の日へ］", s.btns === "セーブ/くわしく/次の日へ", s.btns);
    check("まとめ：仲間の欄に、上がった人と段階のことば（数字は出さない）", s.mates.includes("ignia") && s.stage === "イグニア：打ち解けた" && !/[0-9]/.test(s.nums), JSON.stringify(s));
    check("まとめ：明日からの行動 朝9・昼9・夜8、警告なし", s.rest.includes("9・") && s.rest.includes("8") && s.warn === "", s.rest + " / " + s.warn);
    await click(".du-sum-detail");
    check("［くわしく］で状態画面が開く", (await ev(() => $(".du-status").length)) === 1);
    await click(".du-close");
    check("状態画面を閉じても、まとめのまま", (await ev(() => $(".du-summary").length)) === 1);
    await page.click(".du-sum-next");
    await page.waitForSelector(".du-act", { timeout: 15000 }); await wait(500);
    s = await ev(() => ({ day: TYRANO.kag.stat.f.day, slot: TYRANO.kag.stat.f.slot, A: DaySave.read("A") }));
    check("［次の日へ］で3日目の朝。自動セーブA（毎朝）が書かれる", s.day === 3 && s.slot === "morning" && s.A && s.A.title === "自動：毎朝（3日目・朝）", JSON.stringify({ day: s.day, slot: s.slot, title: s.A && s.A.title }));

    // 手動セーブ → 読み込み（行動を選ぶ画面に戻る）
    // セーブの画面（displaySave）で枠を押したときと同じく、snap を空にしてから doSave
    await ev(() => new Promise((r) => { TYRANO.kag.menu.snap = null; TYRANO.kag.menu.doSave(0, () => r()); }));
    await click(".du-act[data-act=rest]");
    await click(".du-cardwrap");
    await ev(() => TYRANO.kag.menu.loadGame(0));
    await wait(2500);
    s = await ev(() => ({ slot: TYRANO.kag.stat.f.slot, acts: $(".du-act").length }));
    check("手動セーブを読み込むと、行動を選ぶ画面が開き直す（3日目の朝）", s.slot === "morning" && s.acts === 5, JSON.stringify(s));
    // 自動の枠から読み込む
    await click(".du-act[data-act=rest]");
    await click(".du-cardwrap");
    const before = await ev(() => DaySave.read("A").save_date);
    await click(".du-sys .du-small:nth-child(2)");
    s = await ev(() => $(".du-aslot").map((i, e) => e.dataset.slot + ":" + $(e).find(".du-aslot-name").text()).get().join(","));
    check("ロード：自動の3枠を上に（毎朝・13日目の朝・14日目・決戦の前）", s === "A:自動：毎朝（3日目・朝）,B:自動：13日目の朝,C:自動：14日目・決戦の前", s);
    await page.click(".du-aslot[data-slot=A]");
    await wait(2500);
    s = await ev(() => ({ day: TYRANO.kag.stat.f.day, slot: TYRANO.kag.stat.f.slot, acts: $(".du-act").length, date: DaySave.read("A").save_date }));
    check("自動A を読み込むと3日目の朝の画面。読み込みで枠を書き直さない", s.day === 3 && s.slot === "morning" && s.acts === 5 && s.date === before, JSON.stringify(s));

    // ---- C. 2日目・昼の作業台（カバネを外せない） ----
    await openPreset("真エンドの計画：2日目・昼（作業台）");
    check("2日目は台本の【次にやること】をいちばん上に", (await text(".li-next")).includes("作業台を建てられる"), await text(".li-next"));
    clicks = 0;
    await click(".du-act[data-act=build]");
    await click(".du-brow[data-id=workbench]");
    s = await ev(() => ({ title: $(".du-panel-title").text(), sel: $(".du-hcard.sel").map((i, e) => e.dataset.name).get().join(","),
        yukari: $(".du-hcard").filter((i, e) => $(e).find(".du-yukari").length).map((i, e) => e.dataset.name).get().join(","), count: $(".du-hcount").text() }));
    check("「誰と建てる？」：カバネ（ゆかり）ともう1人に最初から印、手伝い 2／2", s.title === "誰と建てる？" && s.sel === "konoha,kabane" && s.yukari === "kabane" && s.count === "手伝い 2／2", JSON.stringify(s));
    await click(".du-hcard[data-name=kabane]");
    check("2日目の作業台：カバネは外せない", (await ev(() => $(".du-hcard[data-name=kabane]").hasClass("sel"))));
    await click(".du-hcard[data-name=ignia]");
    check("3人目は選べない（2人まで）", !(await ev(() => $(".du-hcard[data-name=ignia]").hasClass("sel"))));
    await click(".du-hcard[data-name=konoha]");
    check("2人目は外せる（手伝い 1／2）", (await text(".du-hcount")) === "手伝い 1／2");
    await click(".du-hcard[data-name=ignia]");
    clicks = 0;
    await click(".du-hok");
    s = await ev(() => $(".du-card").text());
    check("［建てる］で結果：カバネ +5（ゆかり）、イグニア +3、力 +1、発展度 0 → 1", s.includes("カバネ +5") && s.includes("イグニア +3") && s.includes("力 +1") && s.includes("島の発展度 0 → 1"), s);
    await click(".du-cardwrap");

    // ---- D. 3-3 (b)：9日目の夜に寄り道 → まとめに K4 ----
    await openPreset("3-3 (b)：9日目・夜（このあと K4）");
    await click(".du-act[data-act=rest]");
    await click(".du-cardwrap");
    s = await ev(() => $(".du-sum-warn .du-warn").map((i, e) => e.dataset.kind + ":" + $(e).text()).get().join(" | "));
    check("3-3 (b) 9日目のまとめに K4 の警告と、(2)(6) の行", s === "K4:全員と心を通わせるなら、もう寄り道はできない。夜の残り2回は、全部ノクティアと過ごす残り8回は、全部まだ心が通っていない人と過ごす", s);

    // まとめから［くわしく］で開いた状態画面は、まとめと同じ時点で数える（レビューの指摘 A1）
    await click(".du-sum-detail");
    s = await ev(() => ({ top: $(".du-st-top").text(), prospect: $(".du-all-prospect").text(), all: $(".du-all-count").text(),
        legend: $(".du-legend").is(":visible") ? $(".du-legend").text() : "(見えない)" }));
    check("A1 まとめの［くわしく］：残りの行動は 朝3・昼3・夜2、見込みは「もう寄り道はできない」（まとめの K4 と同じ）",
        s.top.includes("残りの行動 朝3・昼3・夜2") && s.prospect === "もう寄り道はできない" && s.all.includes("残りの行動 8 回"), JSON.stringify(s));
    check("A2 状態画面に好物の印の凡例が見える", s.legend === "好物の印：好物を渡して二人きりで過ごすと、何かが起きる", s.legend);
    await click(".du-tab[data-tab=yu]");
    s = await ev(() => $(".du-items .du-tool").map((i, e) => $(e).text()).get().join(","));
    check("A3 ユウと島の持ち物に道具（松明）が出る", s === "松明", s);
    await click(".du-close");

    // ---- K1 と K3 が同時に出るまとめ（レビューの指摘 B4：警告を切らない） ----
    await openPreset("11日目・夜（このあと K1 と K3）");
    await click(".du-act[data-act=rest]");
    await click(".du-cardwrap");
    s = await ev(() => {
        const ws = $(".du-sum-warn .du-warn").get();
        const rest = document.querySelector(".du-sum-rest").getBoundingClientRect();
        const box = document.querySelector(".du-sum-warn");
        const r = box.getBoundingClientRect();
        return { kinds: ws.map((e) => e.dataset.kind).join(","), lines: $(".du-sum-warn .du-warn > div").length,
            top: Math.round(r.top), bottom: Math.round(r.bottom), restBottom: Math.round(rest.bottom),
            clipped: box.scrollHeight > box.clientHeight + 1 || getComputedStyle(box).overflow === "hidden" };
    });
    check("B4 K1 と K3 の5行が切れずに出る（下の帯 y 698 より上、明日からの行動の下）",
        s.kinds === "K1,K3" && s.lines === 5 && !s.clipped && s.bottom <= 698 && s.top >= s.restBottom, JSON.stringify(s));

    // ---- E. 3-3 (c)：12日目の朝の1行 ----
    await openPreset("3-3 (c)：12日目・朝（K1）");
    s = await ev(() => ({ t: $(".li-next").text(), c: $(".li-next").attr("class") }));
    check("3-3 (c) カバネ s=1 → 1行に K1（墨赤）", s.t === "もう誰とも心を通わせられない。相棒は迷ったままになる" && s.c.includes("k1"), JSON.stringify(s));
    await openPreset("3-3 (c)：12日目・朝（K2）");
    s = await ev(() => ({ t: $(".li-next").text(), c: $(".li-next").attr("class") }));
    check("3-3 (c) カバネ s=2 → 1行に K2（朱）とカバネの名前", s.t === "まだ誰とも心が通っていない。カバネに二人きりで会おう" && s.c.includes("k2"), JSON.stringify(s));

    // ---- F. 雨の日の昼 ----
    await openPreset("5日目・昼・雨（直す）");
    await click(".du-act[data-act=spend]");
    s = await ev(() => ({ row: $(".du-row[data-name=noctia]").text(), mark: $(".du-row[data-name=noctia] .du-mark").length }));
    check("雨の日の昼：ノクティアに「雨の昼はイベントなし」、印なし", s.row.includes("雨の昼はイベントなし") && s.mark === 0, JSON.stringify(s));
    await click(".du-panel .du-back");
    await click(".du-act[data-act=build]");
    await click(".du-brow[data-kind=repair]");
    s = await ev(() => ({ title: $(".du-panel-title").text(), yukari: $(".du-hcard .du-yukari").length, ok: $(".du-hok").text() }));
    check("直すとき：「誰と直す？」、「ゆかり」の札なし、［直す］", s.title === "誰と直す？" && s.yukari === 0 && s.ok === "直す", JSON.stringify(s));
    await click(".du-panel .du-back");

    // ---- G. 12日目 → 13日目（自動B）→ 14日目（自動C、手動セーブを止める） ----
    await openPreset("真エンドの計画：12日目・昼（13・14日目へ）");
    await click(".du-act[data-act=rest]");
    await click(".du-cardwrap");
    s = await ev(() => ({ rest: $(".du-sum-rest").text(), warn: $(".du-sum-warn").text() }));
    check("12日目のまとめ：明日からの行動は0、警告なし", /0・.*0・.*0/.test(s.rest) && s.warn === "", JSON.stringify(s));
    await page.click(".du-sum-next");
    await wait(2500);
    s = await ev(() => ({ day: TYRANO.kag.stat.f.day, B: !!DaySave.read("B"), C: !!DaySave.read("C") }));
    check("13日目の朝：自動B が書かれる（C はまだ）", s.day === 13 && s.B && !s.C, JSON.stringify(s));
    for (let i = 0; i < 10 && !(await page.$(".du-day14")); i++) { await page.mouse.click(700, 400); await wait(800); }
    s = await ev(() => ({ day: TYRANO.kag.stat.f.day, C: DaySave.read("C") }));
    check("14日目・夜明け前：自動C が書かれる", s.day === 14 && s.C && s.C.title === "自動：14日目・決戦の前", JSON.stringify({ day: s.day, title: s.C && s.C.title }));
    await click(".du-day14-save");
    s = await ev(() => ({ toast: $(".du-toast").text(), list: $(".save_list").length }));
    check("14日目は［セーブ］を押しても、セーブの画面が開かず文が出る", s.toast === "14日目はセーブできません。決戦の前の自動セーブから、やり直せます" && s.list === 0, JSON.stringify(s));
    const slot0 = await ev(() => JSON.stringify(TYRANO.kag.menu.getSaveData().data[1]));
    await ev(() => TYRANO.kag.menu.doSave(1));
    await ev(() => TYRANO.kag.menu.setQuickSave());
    await wait(500);
    s = await ev(() => ({ slot: JSON.stringify(TYRANO.kag.menu.getSaveData().data[1]), quick: localStorage.getItem(TYRANO.kag.config.projectID + "_tyrano_quick_save") }));
    check("14日目は doSave・クイックセーブも止まる（手動の枠が変わらない）", s.slot === slot0 && !s.quick, "");
    // ティラノ標準のメニューの「セーブ」から止めたとき、メニューボタンが戻る（レビューの指摘 B2）
    await ev(() => { TYRANO.kag.stat.visible_menu_button = true; $(".button_menu").show(); TYRANO.kag.menu.showMenu(); });
    await page.waitForSelector(".menu_save", { timeout: 10000 });
    await wait(500);
    await page.click(".menu_save");
    await wait(500);
    s = await ev(() => ({ toast: $(".du-toast").text(), menu: $(".layer_menu").css("display"), menuItems: $(".layer_menu .menu_save").length,
        btn: $(".button_menu").css("display"), list: $(".save_list").length }));
    check("B2 14日目にメニューの「セーブ」を押すと、文を出してメニューを閉じ、メニューボタンを戻す",
        s.toast.startsWith("14日目はセーブできません") && s.menu === "none" && s.menuItems === 0 && s.btn !== "none" && s.list === 0, JSON.stringify(s));
    await ev(() => { TYRANO.kag.stat.visible_menu_button = false; $(".button_menu").hide(); });
    await ev(() => { TYRANO.kag.stat.f.day = 13; }); // 「14日目の朝からやり直す」で、本当に C の状態に戻るか
    await click(".du-day14-restart");
    await wait(2500);
    s = await ev(() => ({ day: TYRANO.kag.stat.f.day, screen: $(".du-day14").length, ev: TYRANO.kag.stat.f.ev_noctia }));
    check("「14日目の朝からやり直す」で自動C を読み、14日目・夜明け前に戻る", s.day === 14 && s.screen === 1 && s.ev === 4, JSON.stringify(s));

    // 1日の画面を出たあと（テストのメニュー）は、14日目のままでもセーブを止めない。状態画面で f に書き足さない（B7）
    await page.click(".du-day14-exit");
    await page.waitForSelector(".glink_button:has-text('会話画面のテスト')", { timeout: 15000 });
    await wait(800);
    s = await ev(() => {
        const f = TYRANO.kag.stat.f;
        delete f.hp; delete f.str;
        DayUI.openStatus("yu");
        const r = { day: f.day, why: DaySave.blockReason(), hp: "hp" in f, str: "str" in f, scen: TYRANO.kag.stat.current_scenario };
        DayUI.closeStatus();
        return r;
    });
    check("B7 1日の画面の外では、14日目でも手動セーブを止めない", s.day === 14 && s.why === "" && s.scen === "test_menu.ks", JSON.stringify(s));
    check("B7 1日の画面の外で状態画面を開いても、f に初期値を書き足さない", !s.hp && !s.str, JSON.stringify(s));

    check("ブラウザのエラーがない", errors.length === 0, errors.slice(0, 5).join(" / "));
    await browser.close();

    let failed = 0;
    for (const r of results) {
        console.log(`[${r.ok ? "OK" : "NG"}] ${r.name}${r.ok || !r.detail ? "" : "  (" + r.detail + ")"}`);
        if (!r.ok) failed++;
    }
    console.log(`結果: ${results.length - failed}/${results.length} 合格`);
    process.exit(failed ? 1 : 0);
})();
