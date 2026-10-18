/*
 * 戦闘画面の試作を、ブラウザで自動操作して確かめるスクリプト。
 *
 * 前提：
 *   - ティラノスクリプト本体のフォルダに game/tyrano-proto/data/ の中身をコピーしてある
 *   - そのフォルダを HTTP サーバーで公開している（例：python -m http.server 8799）
 *   - Node.js と Playwright が入っている（npm install playwright。ブラウザは npx playwright install chromium）
 *
 * 使い方：
 *   node game/tyrano-proto/tools/check_battle.js http://localhost:8799/index.html
 *
 * 確かめること：戦闘画面の表示、クリックとキーボードの操作、文字送りが漏れないこと、
 *               自動戦闘、勝ち・負けの分岐、ブラウザのエラーがないこと。
 *   2026-10-17 追加（docs/game/design/battle.md 7章）：
 *               計算（守り、守るの割合、言葉・技の番）、自動戦闘の判断、敵の予告、
 *               探索の1戦（報酬と道具の書き戻し、負けたら f.hp −3）、
 *               決戦の割り込み（f.battle_result = "interrupt"、f.battle_state、f.final_mind_zero）、
 *               中盤の選び直しと後半の選択肢の数、決着のとどめ、全員倒れたとき（"wipe"）のやり直し。
 *   2026-10-18 追加（battle.md 4-1・4-2・5-1・5-3、life-bond.md 3章・4-2、plan.md「選択の色」）：
 *               全員で挑む決戦の支配の力（max(600, 1100 − 100 × 発展度)）と 400 以下の割り込み、
 *               中盤の選び直し（日記の言葉／ほかの4人が支える、合わせて1回）、
 *               好物がだぶるときのめずらしい報酬の置きかえ（薬 ×1）、選択の帯の色（探索は朱、決戦は深紅）、
 *               全員倒れたときの「タイトルに戻る」の説明の文（script/ui_text.md 7-3）。
 */
const { chromium } = require("playwright");

const url = process.argv[2] || "http://localhost:8799/index.html";

async function openBattle(browser, errors, menuText = "戦闘画面のテスト") {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    await page.goto(url);
    // 試作の確認メニューから、テストを選ぶ
    await page.waitForSelector(".glink_button", { timeout: 20000 });
    await page.waitForTimeout(1500); // ボタンが出そろって、押せるようになるまで待つ
    await page.click("text=" + menuText);
    for (let i = 0; i < 30; i++) {
        if (await page.$(".ib-root")) break;
        await page.mouse.click(640, 600);
        await page.waitForTimeout(500);
    }
    return page;
}

async function waitBattleEnd(page) {
    for (let i = 0; i < 120; i++) {
        if (!(await page.$(".ib-root"))) return true;
        await page.waitForTimeout(500);
    }
    return false;
}

// ---- 2026-10-17 追加：小さな道具 --------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const msgText = (page) => page.evaluate(() => $(".message0_fore .message_inner").text());
const glinks = (page) => page.evaluate(() => $(".glink_button").map((i, e) => $(e).text().trim()).get());

// 文字送りのクリックをしながら、条件がそろうまで待つ
async function advanceUntil(page, cond, tries = 40) {
    for (let i = 0; i < tries; i++) {
        if (await cond()) return true;
        await page.mouse.click(640, 600);
        await page.waitForTimeout(400);
    }
    return cond();
}
const hasGlinks = (page) => async () => (await glinks(page)).length > 0;
const hasBattle = (page) => async () => !!(await page.$(".ib-root"));
const msgHas = (page, t) => async () => (await msgText(page)).includes(t);
// クリックせずに、条件がそろうまで待つ
async function waitFor(cond, ms = 5000) {
    for (let i = 0; i < ms / 100; i++) {
        if (await cond()) return true;
        await sleep(100);
    }
    return cond();
}

async function clickGlink(page, text) {
    await page.waitForTimeout(800); // 選択肢が押せるようになるまで待つ
    const now = await glinks(page);
    if (!now.some((t) => t.includes(text))) throw new Error(`選択肢「${text}」がない。いまの選択肢：${JSON.stringify(now)}、文：${await msgText(page)}`);
    await page.click(`.glink_button:has-text("${text}")`);
    for (let i = 0; i < 15; i++) {
        if ((await glinks(page)).length === 0) return;
        await page.waitForTimeout(200);
    }
}

// 自動戦闘の間隔を短くして、テストの時間を縮める
async function fast(page) {
    await page.evaluate(() => { const c = IslandBattle.current.cfg; c.autoDelay = 40; c.endDelay = 300; });
}
async function waitGone(page, sec = 90) {
    for (let i = 0; i < sec * 4; i++) {
        if (!(await page.$(".ib-root"))) return true;
        await page.waitForTimeout(250);
    }
    return false;
}

// ---- 計算と自動戦闘の判断（battle.md 1-2、2-1、3-2、4-1、7-2、7-5） ----------------------
async function checkCalc(browser, errors, check) {
    const page = await openBattle(browser, errors, "探索の戦闘");
    const r = await page.evaluate(async () => {
        const IB = IslandBattle;
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        IB.current.destroy();
        const out = {};
        const h = IB.makeHero({ hp: 10, str: 6, mind: 4 });
        out.hero = [h.hp, h.atk, h.def, h.mind];
        const k = IB.makePartner("konoha", { ev_konoha: 4 });
        out.konoha = [k.hp, k.atk, k.def, k.mind];
        out.finalHp = IB.makeHero({ hp: 3, str: 1, mind: 2 }, "final").hp;
        const rnd = Math.random;
        Math.random = () => 0.5;
        try {
            // 守りを引く・守るの割合（稽古3回で 35%）・相棒がいないと絆ゲージを出さない
            let b = IB.start({ mode: "explore", partner: "", party: [{ name: "ユウ", hp: 100, mind: 30, atk: 10 }],
                enemies: [{ name: "岩", hp: 999, atk: 20, def: 4 }], trainCount: 3, autoDelay: 10, endDelay: 10 });
            out.bondHidden = getComputedStyle(b.bondBox).display === "none";
            b.command("attack");
            out.atkLog = b.history.filter((t) => t.includes("ユウの攻撃"))[0];
            await sleep(150);
            out.hit = 100 - b.party[0].hp;
            b.command("guard");
            await sleep(150);
            out.guardHit = 100 - out.hit - b.party[0].hp;
            b.destroy();

            // 技は相棒の番だけ、言葉は主人公の番だけ
            b = IB.start({ mode: "explore", partner: "konoha", enemies: [{ name: "岩", hp: 999, atk: 1 }], autoDelay: 10 });
            const hero = b.party[0];
            out.heroSkill = b.canUse("skill", hero);
            out.heroWord = b.canUse("word", hero);
            out.skillGray = b.itemEls[2].classList.contains("ib-disabled");
            out.bondShown = getComputedStyle(b.bondBox).display !== "none" && b.bondEl.textContent.length === 3;
            b.command("attack");
            b.command("word");
            out.partnerWordLog = b.history[b.history.length - 1];
            out.stillPartner = b.turnIndex === 1;
            b.command("skill");
            out.foxfire = b.history.filter((t) => t.includes("狐火"))[0] || "";
            b.destroy();

            // 自動戦闘の判断
            b = IB.start({ mode: "final", phase: "first", partner: "kabane", enemies: [{ name: "的", hp: 999, atk: 1, boss: true }], autoDelay: 10 });
            const fh = b.party[0], kb = b.party[1];
            fh.mind = 10;
            out.autoLowMind = b.autoChoice(fh);
            fh.mind = 40;
            b.warned = true;
            out.autoWarnHero = b.autoChoice(fh);
            out.autoWarnKabane = b.autoChoice(kb);
            b.destroy();
            b = IB.start({ mode: "final", phase: "finish", partner: "konoha", resumeState: { bond: 2, bondMax: 5, party: [] },
                enemies: [{ name: "的", hp: 999, atk: 1, boss: true }], autoDelay: 10 });
            out.autoFinishWord = b.autoChoice(b.party[0]);
            b.bond = 5;
            out.autoFinishBond = b.autoChoice(b.party[0]);
            b.destroy();

            // 全員で挑むとき：予告のターンに守りの技を使うのは1人だけ（骨の盾を優先）。予告がなければ使わない
            b = IB.start({ mode: "final", phase: "first", partner: "all", enemies: [{ name: "的", hp: 999, atk: 1, boss: true }], autoDelay: 10 });
            const by = (id) => b.party.find((p) => p.id === id);
            b.warned = false;
            out.allNoWarn = [b.autoChoice(by("noctia")), b.autoChoice(by("kabane")), b.autoChoice(by("hakuren"))];
            b.warned = true;
            out.allWarn = [b.autoChoice(by("noctia")), b.autoChoice(by("kabane")), b.autoChoice(by("hakuren"))];
            by("kabane").hp = 0;
            out.allWarnNoKabane = [b.autoChoice(by("noctia")), b.autoChoice(by("hakuren"))];
            b.destroy();

            // 決着で全員で挑むとき：相棒の番に「絆」を1回選べば、5人の大技が順に出て、最後の1人で 0
            b = IB.start({ mode: "final", phase: "finish", partner: "all", resumeState: { bond: 5, bondMax: 5, bossHp: 400, bossMaxHp: 800, party: [] },
                autoDelay: 10, endDelay: 10 });
            out.allParty = b.party.length;
            b.command("attack");
            out.allTurnOf = b.party[b.turnIndex].id;
            b.command("bond");
            await sleep(300);
            out.allFinish = { res: IB.last.result, finisher: IB.last.finisher, order: IB.last.finisherOrder, hp: IB.last.bossHp,
                logs: IB.last.history.filter((t) => /紅の契り|五尾の狐火|本当の姿|白虎の牙|竜の息吹|連携攻撃/.test(t)).length };

            // めずらしい報酬の確率（10% ＋ 知恵 × 5%、最大 50%）
            const rare = async (wis, rv) => {
                Math.random = () => 0.5;
                const bb = IB.start({ mode: "explore", partner: "", enemies: [{ preset: "nushi", hp: 1 }], wis, autoDelay: 10, endDelay: 10 });
                Math.random = () => rv;
                bb.command("attack");
                Math.random = () => 0.5;
                await sleep(100);
                return IB.last.rare;
            };
            const soy0 = Number(TYRANO.kag.stat.f.item_soy_seed || 0);
            out.rareCap = await rare(20, 0.49);
            out.rareSoy = Number(TYRANO.kag.stat.f.item_soy_seed || 0) - soy0;
            out.rareCapNo = await rare(20, 0.51);
            out.rareLowWis = await rare(1, 0.2);

            // 敵の予告と、自動戦闘の守る（主人公だけ、大イノシシの突進）
            b = IB.start({ mode: "explore", partner: "", enemies: [{ preset: "boar", hp: 999 }], autoDelay: 15 });
            b.toggleAuto();
            for (let i = 0; i < 200 && b.enemies[0].acts < 3; i++) await sleep(20);
            const hs = b.history;
            const wi = hs.findIndex((t) => t.includes("【予告】"));
            out.warnIndex = wi;
            out.warnTurn = b.enemies[0].acts;
            out.guardAfterWarn = wi >= 0 && hs.slice(wi + 1).some((t) => t.includes("身を守っている"));
            out.charge = hs.some((t) => t.includes("突進"));
            b.destroy();
        } finally {
            Math.random = rnd;
        }
        return out;
    });
    check("主人公の戦闘の数値（力6・心4：HP120・攻撃20・守り2・心40）", JSON.stringify(r.hero) === "[120,20,2,40]", JSON.stringify(r.hero));
    check("相棒の数値（コノハ段階4：HP125・攻撃19・守り3・心70）", JSON.stringify(r.konoha) === "[125,19,3,70]", JSON.stringify(r.konoha));
    check("決戦は体力10として HP を計算する", r.finalHp === 120, String(r.finalHp));
    check("攻撃で敵の守りを引く（10 − 4 ＝ 6）", (r.atkLog || "").includes(" 6 のダメージ"), r.atkLog);
    check("敵の攻撃が当たる（20）", r.hit === 20, String(r.hit));
    check("守るの割合が稽古の回数で変わる（20 × 35% ＝ 7）", r.guardHit === 7, String(r.guardHit));
    check("相棒がいないときは絆ゲージを出さない", r.bondHidden);
    check("探索の絆ゲージは3、相棒がいれば出す", r.bondShown);
    check("技は主人公の番に使えない（灰色になる）", r.heroSkill === false && r.skillGray, JSON.stringify(r));
    check("言葉は主人公の番だけ", r.heroWord === true && (r.partnerWordLog || "").includes("主人公の番だけ") && r.stillPartner, r.partnerWordLog);
    check("コノハの狐火は3回当たる", r.foxfire.includes("3回当たって"), r.foxfire);
    check("自動：決戦で心が20未満なら言葉", r.autoLowMind === "word", r.autoLowMind);
    check("自動：予告が出たら主人公は守る、カバネは守りの技", r.autoWarnHero === "guard" && r.autoWarnKabane === "skill", r.autoWarnHero + "/" + r.autoWarnKabane);
    check("自動：決着で絆ゲージが満タンでなければ言葉、満タンなら絆", r.autoFinishWord === "word" && r.autoFinishBond === "bond", r.autoFinishWord + "/" + r.autoFinishBond);
    check("自動：予告のないターンは守りの技を使わない", r.allNoWarn.join() === "attack,attack,attack", JSON.stringify(r.allNoWarn));
    check("自動：全員のとき、予告のターンに守りの技はカバネ1人だけ", r.allWarn.join() === "attack,skill,attack", JSON.stringify(r.allWarn));
    check("自動：カバネが倒れていたら、ほかの1人が守りの技", r.allWarnNoKabane.join() === "skill,attack", JSON.stringify(r.allWarnNoKabane));
    const af = r.allFinish || {};
    check("決着（全員）：相棒の番に絆1回で5人の大技が順に出て、支配の力 0",
        r.allParty === 6 && r.allTurnOf === "noctia" && af.res === "win" && af.finisher && af.hp === 0 &&
        (af.order || []).join() === "noctia,konoha,kabane,hakuren,ignia" && af.logs === 5, JSON.stringify({ n: r.allParty, t: r.allTurnOf, af }));
    check("めずらしい報酬：最大50%、出たら f に足す", r.rareCap === true && r.rareSoy === 1 && r.rareCapNo === false, JSON.stringify([r.rareCap, r.rareSoy, r.rareCapNo]));
    check("めずらしい報酬：知恵1なら15%", r.rareLowWis === false, String(r.rareLowWis));
    check("突進の前に予告が出て、自動戦闘が守る", r.warnIndex >= 0 && r.guardAfterWarn && r.charge, JSON.stringify({ wi: r.warnIndex, acts: r.warnTurn, g: r.guardAfterWarn, c: r.charge }));
    await page.close();
}

// ---- 探索の1戦（大イノシシ、相棒コノハ段階1） ------------------------------------------
async function checkExplore(browser, errors, check) {
    let page = await openBattle(browser, errors, "探索の戦闘");
    const st = await page.evaluate(() => {
        const b = IslandBattle.current;
        return { partner: b.party.map((p) => p.name), stage: b.party[1] && b.party[1].stage, bond: b.bondEl.textContent };
    });
    check("探索：相棒コノハ（段階1）と戦う", st.partner.join() === "ユウ,コノハ" && st.stage === 1, JSON.stringify(st));
    await page.click('.ib-item[data-cmd="item"]');
    await page.waitForTimeout(300);
    check("探索：道具で薬草を使える", (await page.textContent(".ib-log")).includes("薬草"));
    await fast(page);
    await page.click(".ib-auto");
    check("探索：自動戦闘で最後まで進む", await waitGone(page));
    await advanceUntil(page, msgHas(page, "探索のテストは終わり"));
    const w = await page.evaluate(() => {
        const f = TYRANO.kag.stat.f;
        return { res: f.battle_result, food: f.item_food, herb: f.item_herb, hp: f.hp, turns: IslandBattle.last.turns };
    });
    check("探索：勝つと食料 ×3、使った薬草を引く、体力は変えない", w.res === "win" && w.food === 3 && w.herb === 1 && w.hp === 10, JSON.stringify(w));
    check("探索：相棒がいると3ターン以内で終わる（battle.md 6-1 では1〜2ターン。1ターン目は道具）", w.turns <= 3, String(w.turns));
    await page.close();

    page = await openBattle(browser, errors, "探索の戦闘");
    await page.evaluate(() => {
        const b = IslandBattle.current;
        b.enemies.forEach((e) => { e.hp = e.maxHp = 9999; e.atk = 300; e.pattern = [{}]; });
        b.render();
    });
    await fast(page);
    await page.click(".ib-auto");
    await waitGone(page);
    await advanceUntil(page, msgHas(page, "探索のテストは終わり"));
    const l = await page.evaluate(() => {
        const f = TYRANO.kag.stat.f;
        return { res: f.battle_result, hp: f.hp, food: f.item_food, log: $(".message0_fore .message_inner").text() };
    });
    check("探索：負けると f.hp −3（戦闘の HP は入れない）、報酬なし", l.res === "lose" && l.hp === 7 && l.food === 0, JSON.stringify(l));
    await page.close();
}

// ---- 決戦：前半 → 割り込み → 中盤 → 後半 → 決着 ---------------------------------------
async function checkFinal(browser, errors, check) {
    const page = await openBattle(browser, errors, "決戦の流れ");
    const s0 = await page.evaluate(() => {
        const b = IslandBattle.current, h = b.party[0];
        return { gems: b.bondEl.textContent.length, enemies: b.enemies.map((e) => e.name), gm: b.boss().maxHp,
            hp: h.maxHp, def: h.def, mind: h.maxMind, limit: b.itemLimit, dev: b.dev };
    });
    check("決戦：絆ゲージ5、敵は GM と幻影2体、GM 400", s0.gems === 5 && s0.enemies.length === 3 && s0.gm === 400 && s0.enemies[1].includes("GM"), JSON.stringify(s0));
    check("決戦：施設の支え（かまど HP+10、家 心+10、見張り台 守り+2、作業台 道具4回）、発展度は f.dev", s0.hp === 130 && s0.mind === 45 && s0.def === 4 && s0.limit === 4 && s0.dev === 4, JSON.stringify(s0));
    // 前半の終わりの心が乱数で 0 になると、後半の選択肢が1つになり、下の確認が通れない。
    // 主人公の心を大きくして、乱数に左右されないようにする（心が 0 のときは checkFinalWipe で確かめる）
    await page.evaluate(() => { const h = IslandBattle.current.party[0]; h.mind = h.maxMind = 999; });
    await fast(page);
    await page.click(".ib-auto");
    check("決戦の前半：自動戦闘で割り込みまで進む", await waitGone(page));
    const it = await page.evaluate(() => {
        const f = TYRANO.kag.stat.f;
        return { res: f.battle_result, st: f.battle_state, zero: f.final_mind_zero, herb: f.item_herb, med: f.item_medicine };
    });
    const st = it.st || {};
    check('決戦の前半：支配の力が半分以下で f.battle_result = "interrupt"', it.res === "interrupt" && st.bossHp > 0 && st.bossHp <= 200, JSON.stringify({ res: it.res, boss: st.bossHp }));
    check("決戦の前半：f.battle_state に HP・心・絆・道具を入れ、f.final_mind_zero を書く",
        st.party && st.party.length === 2 && typeof st.bond === "number" && st.items && (it.zero === 0 || it.zero === 1),
        JSON.stringify(st));
    check("決戦の前半：使った道具を持ち物から引く", it.herb === st.items.herb && it.med === st.items.medicine, JSON.stringify(it));

    await advanceUntil(page, hasGlinks(page));
    await clickGlink(page, "正しい言葉");
    await waitFor(msgHas(page, "ここにいる")); // 絆を足す iscript のあとの台詞
    const bond1 = await page.evaluate(() => TYRANO.kag.stat.f.battle_state.bond);
    check("中盤：正しい言葉で絆ゲージ +3（満タンが上限）", bond1 === Math.min(5, st.bond + 3), `${st.bond} → ${bond1}`);

    await advanceUntil(page, hasGlinks(page));
    const late = await glinks(page);
    check("後半：判定値3以上なら選択肢3つ（手がかりあり）", it.zero === 0 && late.length === 3, JSON.stringify({ zero: it.zero, late }));
    if (late.length !== 3) {
        // 黙って飛ばすと総数が変わるので、飛ばしたことを NG で残す
        ["後半：手がかりの選択肢で絆ゲージ +2", "決着：前半の終わりの状態（絆を足したもの）から再開する",
            "決着：絆の大技でとどめを刺して勝つ（支配の力 0）", "決着：勝つと勝ちの場面に進む"]
            .forEach((n) => check(n, false, "飛ばした（後半の選択肢が3つでない）"));
    } else {
        await clickGlink(page, "勝てなかった");
        await waitFor(msgHas(page, "絆ゲージ +2"));
        const bond2 = await page.evaluate(() => TYRANO.kag.stat.f.battle_state.bond);
        check("後半：手がかりの選択肢で絆ゲージ +2", bond2 === Math.min(5, bond1 + 2), `${bond1} → ${bond2}`);
        await advanceUntil(page, hasBattle(page));
        const r = await page.evaluate(() => {
            const b = IslandBattle.current, f = TYRANO.kag.stat.f;
            return { bond: b.bond, want: f.battle_state.bond, enemies: b.enemies.length, hp: b.boss().hp, wantHp: f.battle_state.bossHp,
                heroHp: b.party[0].hp, wantHero: f.battle_state.party[0].hp };
        });
        check("決着：前半の終わりの状態（絆を足したもの）から再開する",
            r.bond === r.want && r.enemies === 1 && r.hp === r.wantHp && r.heroHp === r.wantHero, JSON.stringify(r));
        await fast(page);
        await page.click(".ib-auto");
        await waitGone(page);
        const fin = await page.evaluate(() => ({ res: TYRANO.kag.stat.f.battle_result, last: IslandBattle.last }));
        check("決着：絆の大技でとどめを刺して勝つ（支配の力 0）", fin.res === "win" && fin.last.finisher && fin.last.bossHp === 0, JSON.stringify({ res: fin.res, f: fin.last.finisher, hp: fin.last.bossHp }));
        check("決着：勝つと勝ちの場面に進む", await advanceUntil(page, msgHas(page, "選べなかった")));
    }
    await page.close();
}

// ---- 確認役のレビューで直したところ（battle.md 3-3、3-4、4-1、4-2、5-1） ---------------------
async function checkFixes(browser, errors, check) {
    const page = await openBattle(browser, errors, "探索の戦闘");
    const r = await page.evaluate(async () => {
        const IB = IslandBattle;
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        const waitTurn = async (b, n) => { for (let i = 0; i < 300 && !(b.turn >= n && !b.busy) && !b.finished; i++) await sleep(10); };
        const lost = (b) => b.party.reduce((s, p) => s + (p.maxHp - p.hp), 0);
        IB.current.destroy();
        const out = {};
        const f = TYRANO.kag.stat.f;
        const saveF = JSON.parse(JSON.stringify(f));
        const rnd = Math.random;
        Math.random = () => 0.5;
        const hero = () => ({ name: "ユウ", hp: 1000, mind: 50, atk: 5, def: 0 });
        const rock = (pattern) => ({ name: "岩", hp: 99999, atk: 20, def: 0, pattern: pattern || [{}] });
        const noctia = () => ({ id: "noctia", name: "ノクティア", hp: 1000, mind: 50, atk: 5, def: 0, stage: 1, skill: { name: "夜の帳", type: "nullify" } });
        try {
            // 1. 本当の姿：使ったターンの敵の番には効かず、次のターンに半分（20 → 10）、その次は戻る
            let b = IB.start({ mode: "explore", party: [hero(),
                { id: "kabane", name: "カバネ", hp: 1000, mind: 50, atk: 5, def: 0, stage: 4, skill: { name: "骨の盾", type: "wall" }, ult: { name: "本当の姿", type: "all", power: 1, wall: true } },
                noctia()], enemies: [rock()], autoDelay: 10, endDelay: 10 });
            const kb = b.party[1], nc = b.party[2];
            b.warned = true;
            out.guard1 = [b.autoChoice(nc), b.autoChoice(kb)];
            b.warned = false;
            b.bond = b.bondMax;
            b.command("attack"); b.command("bond"); b.command("attack");
            await waitTurn(b, 2);
            out.wallT1 = lost(b);
            b.warned = true;
            out.guard2 = [b.autoChoice(nc), b.autoChoice(kb)];
            b.warned = false;
            b.command("attack"); b.command("attack"); b.command("attack");
            await waitTurn(b, 3);
            out.wallT2 = lost(b) - out.wallT1;
            b.command("attack"); b.command("attack"); b.command("attack");
            await waitTurn(b, 4);
            out.wallT3 = lost(b) - out.wallT1 - out.wallT2;
            b.destroy();

            // 2. 白虎の牙：主人公が倒れていると使えない（段階1〜3の連携攻撃は使える）
            const hk = (stage) => ({ id: "hakuren", name: "ハクレン", hp: 1000, mind: 50, atk: 5, def: 0, stage,
                skill: { name: "西方の守り", type: "cover" }, ult: { name: "白虎の牙", type: "single", power: 150, needHero: true } });
            b = IB.start({ mode: "explore", party: [hero(), hk(4)], enemies: [rock()], autoDelay: 10 });
            b.bond = b.bondMax;
            out.hkAlive = b.canUse("bond", b.party[1]);
            b.party[0].hp = 0;
            out.hkDead = b.canUse("bond", b.party[1]);
            out.hkDeadAuto = b.autoChoice(b.party[1]);
            b.destroy();
            b = IB.start({ mode: "explore", party: [hero(), hk(2)], enemies: [rock()], autoDelay: 10 });
            b.bond = b.bondMax;
            b.party[0].hp = 0;
            out.hkComboDead = b.canUse("bond", b.party[1]);
            b.destroy();
            // 決着（ハクレンだけ）：主人公が倒れていれば、とどめの絆も使えない
            f.ev_hakuren = 4;
            b = IB.start({ mode: "final", phase: "finish", partner: "hakuren", resumeState: { bond: 5, bondMax: 5, bossHp: 200, bossMaxHp: 400, party: [] }, autoDelay: 10, endDelay: 10 });
            b.party[0].hp = 0;
            out.hkFinishSolo = b.canUse("bond", b.party[1]);
            b.destroy();
            // 決着（全員）：主人公が倒れていると、ハクレンを飛ばして4人の大技が順に出る。ハクレンの番でも絆を使える
            b = IB.start({ mode: "final", phase: "finish", partner: "all", resumeState: { bond: 5, bondMax: 5, bossHp: 400, bossMaxHp: 800, party: [] }, autoDelay: 10, endDelay: 10 });
            b.party[0].hp = 0;
            b.turnIndex = b.party.findIndex((p) => p.id === "hakuren");
            out.hkAllCan = b.canUse("bond", b.party[b.turnIndex]);
            b.command("bond");
            await sleep(400);
            out.hkAll = { res: IB.last.result, finisher: IB.last.finisher, order: IB.last.finisherOrder, hp: IB.last.bossHp,
                fang: IB.last.history.some((t) => t.includes("白虎の牙")) };
            delete f.ev_hakuren;

            // 3. 夜の帳：囁き（心を減らす行動）では使わず、次の攻撃を打ち消す
            b = IB.start({ mode: "explore", party: [hero(), noctia()],
                enemies: [rock([{ name: "囁き", type: "mind", power: 5, target: "hero" }, {}])], autoDelay: 10 });
            b.command("attack"); b.command("skill");
            await waitTurn(b, 2);
            out.nullAfterWhisper = { nullify: b.nullify, mind: b.party[0].mind, lost: lost(b) };
            b.command("attack"); b.command("attack");
            await waitTurn(b, 3);
            out.nullAfterAttack = { nullify: b.nullify, lost: lost(b), log: b.history.some((t) => t.includes("夜の帳が打ち消した")) };
            b.destroy();

            // 8. 夜の帳：2人の決戦で、予告のターンは幻影の攻撃ではなく支配の波を打ち消す
            b = IB.start({ mode: "final", phase: "first", partner: "noctia", items: { herb: 0, medicine: 0 }, autoDelay: 10, endDelay: 10 });
            b.boss().acts = 2; // 次の GM の行動は支配の波（予告あり）
            b.warned = true;
            b.command("attack"); b.command("skill");
            await waitTurn(b, 2);
            const hs = b.history;
            out.nullWave = { nullify: b.nullify, wave: b.waveCount, lost: lost(b),
                waveNull: hs.some((t) => t.includes("支配の波！ ……しかし、夜の帳が打ち消した")),
                illusionHit: hs.filter((t) => t.includes("ルカの影") && t.includes("ダメージ（")).length };
            b.destroy();

            // 4. 主人公の番の絆：倒れた相棒しかいなければ使えない
            b = IB.start({ mode: "explore", party: [hero(), { name: "相棒", hp: 100, mind: 50, atk: 5, stage: 1 }], enemies: [rock()], autoDelay: 10 });
            b.bond = b.bondMax;
            out.bondAlive = b.canUse("bond", b.party[0]);
            b.party[1].hp = 0;
            out.bondDead = b.canUse("bond", b.party[0]);
            b.command("bond");
            out.bondDeadKept = b.bond === b.bondMax;
            b.destroy();

            // 5. 決戦の前半：一撃で支配の力が 0 になっても割り込む（決着は 1 から）
            b = IB.start({ mode: "final", phase: "first", partner: "", party: [{ name: "ユウ", hp: 100, mind: 50, atk: 9999, def: 0 }],
                enemies: [{ name: "幻影", hp: 50, atk: 1, def: 0 }, { name: "GM", hp: 400, atk: 1, def: 0, boss: true }, { name: "幻影", hp: 50, atk: 1, def: 0 }],
                items: { herb: 0, medicine: 0 }, autoDelay: 10, endDelay: 10 });
            b.target = function () { return this.boss(); };
            b.command("attack");
            await sleep(200);
            out.oneShot = { res: IB.last && IB.last.result, hp: IB.last && IB.last.bossHp, st: f.battle_state && f.battle_state.bossHp };

            // 6. 囁き：主人公が倒れていれば空振り（相棒の心は減らない）
            b = IB.start({ mode: "explore", party: [hero(), { name: "相棒", hp: 100, mind: 50, atk: 5, stage: 1 }],
                enemies: [rock([{ name: "囁き", type: "mind", power: 15, target: "hero" }])], autoDelay: 10 });
            b.party[0].hp = 0;
            b.turnIndex = 1;
            b.command("attack");
            await waitTurn(b, 2);
            out.whisperMiss = { mind: b.party[1].mind, log: b.history.filter((t) => t.includes("囁き"))[0] || "" };
            b.destroy();
        } finally {
            Math.random = rnd;
            Object.keys(f).forEach((k) => { if (!(k in saveF)) delete f[k]; });
            Object.assign(f, saveF);
        }
        return out;
    });
    check("本当の姿：使ったターンの敵の番には半減しない（20）", r.wallT1 === 20, String(r.wallT1));
    check("本当の姿：次のターンに味方の受けるダメージ半分（10）", r.wallT2 === 10, String(r.wallT2));
    check("本当の姿：その次のターンは元に戻る（20）", r.wallT3 === 20, String(r.wallT3));
    check("自動：本当の姿が効くターンは骨の盾を重ねず、ほかの相棒が守りの技",
        (r.guard1 || []).join() === "attack,skill" && (r.guard2 || []).join() === "skill,attack", JSON.stringify([r.guard1, r.guard2]));
    check("白虎の牙：主人公が倒れていると絆を使えない（自動も選ばない）", r.hkAlive === true && r.hkDead === false && r.hkDeadAuto !== "bond", JSON.stringify([r.hkAlive, r.hkDead, r.hkDeadAuto]));
    check("白虎の牙：段階1〜3の連携攻撃は、主人公が倒れていても使える", r.hkComboDead === true, String(r.hkComboDead));
    check("決着（ハクレンだけ）：主人公が倒れているとき、とどめの絆を使えない", r.hkFinishSolo === false, String(r.hkFinishSolo));
    const ha = r.hkAll || {};
    check("決着（全員）：主人公が倒れていると、ハクレンを飛ばして4人の大技で 0",
        r.hkAllCan === true && ha.res === "win" && ha.finisher && ha.hp === 0 && !ha.fang && (ha.order || []).join() === "noctia,konoha,kabane,ignia", JSON.stringify({ can: r.hkAllCan, ha }));
    check("夜の帳：囁きでは消費しない", r.nullAfterWhisper.nullify === 1 && r.nullAfterWhisper.mind === 45 && r.nullAfterWhisper.lost === 0, JSON.stringify(r.nullAfterWhisper));
    check("夜の帳：次の攻撃を打ち消す", r.nullAfterAttack.nullify === 0 && r.nullAfterAttack.lost === 0 && r.nullAfterAttack.log, JSON.stringify(r.nullAfterAttack));
    const nw = r.nullWave || {};
    check("夜の帳：2人の決戦で、予告のターンは幻影の攻撃ではなく支配の波を打ち消す",
        nw.nullify === 0 && nw.waveNull && nw.wave === 0 && nw.illusionHit === 2 && nw.lost > 0, JSON.stringify(nw));
    check("主人公の番の絆：倒れた相棒しかいなければ使えない", r.bondAlive === true && r.bondDead === false && r.bondDeadKept, JSON.stringify([r.bondAlive, r.bondDead, r.bondDeadKept]));
    check("決戦の前半：一撃で 0 にしても割り込む（決着は支配の力 1 から）", (r.oneShot || {}).res === "interrupt" && r.oneShot.hp === 1 && r.oneShot.st === 1, JSON.stringify(r.oneShot));
    check("囁き：主人公が倒れていれば空振り（相棒の心は減らない）", r.whisperMiss.mind === 50 && r.whisperMiss.log.includes("届かなかった"), JSON.stringify(r.whisperMiss));
    await page.close();
}

// ---- 決戦で全員倒れたとき（"wipe"）・選び直し・判定値2以下 --------------------------------
async function wipeNow(page) {
    await page.evaluate(() => {
        const b = IslandBattle.current;
        b.party.forEach((p) => { p.hp = 1; });
        b.enemies.forEach((e) => { e.pattern = [{ type: "all", power: 300 }]; e.acts = 0; e.onHalf = null; });
        b.render();
    });
    await fast(page);
    // 自動戦闘だと決着で大技を使って勝ってしまうので、全員「守る」を選んで敵の番にする
    for (let i = 0; i < 10; i++) {
        const st = await page.evaluate(() => { const b = IslandBattle.current; return b && !b.destroyed ? { busy: b.busy, fin: b.finished } : null; });
        if (!st || st.fin) break;
        if (!st.busy) await page.click('.ib-item[data-cmd="guard"]');
        await page.waitForTimeout(150);
    }
    return waitGone(page);
}
async function interruptNow(page, mindZero) {
    // 主人公の番に、幻影を倒した状態・支配の力を割り込みのすぐ上にして、攻撃1回で割り込ませる
    await page.evaluate((z) => {
        const b = IslandBattle.current;
        b.minions().forEach((e) => { e.alive = false; e.hp = 0; });
        b.boss().hp = Math.floor(b.boss().maxHp / 2) + 1;
        if (z) b.party[0].mind = 0;
        b.render();
    }, mindZero);
    await page.click('.ib-item[data-cmd="attack"]');
    return waitGone(page, 10);
}

async function checkFinalWipe(browser, errors, check) {
    let page = await openBattle(browser, errors, "決戦の流れ");
    await wipeNow(page);
    const w = await page.evaluate(() => {
        const f = TYRANO.kag.stat.f;
        return { res: f.battle_result, herb: f.item_herb, med: f.item_medicine, st: f.battle_state === undefined };
    });
    check('前半で全員倒れる：f.battle_result = "wipe"、何も書き戻さない（罰なし）', w.res === "wipe" && w.herb === 2 && w.med === 1 && w.st, JSON.stringify(w));
    await advanceUntil(page, hasGlinks(page));
    const ch = await glinks(page);
    check("全員倒れたとき：選択肢は「もう一度」と「タイトルに戻る」", ch.join() === "もう一度,タイトルに戻る", JSON.stringify(ch));
    const note = await msgText(page);
    check("全員倒れたとき：選択肢の下に「タイトルに戻る」の説明（ui_text.md 7-3）",
        note.includes("「続きから」→「14日目・決戦の前」で、出発の前からやり直せます"), note);
    await clickGlink(page, "もう一度");
    await advanceUntil(page, hasBattle(page), 10);
    const re = await page.evaluate(() => {
        const b = IslandBattle.current, h = b.party[0];
        return { retries: IslandBattle.retries, hp: h.hp, max: h.maxHp, bond: b.bond, gm: b.boss().hp };
    });
    check("もう一度：前半の最初から（HP 満タン、絆0、GM 400）", re.retries === 1 && re.hp === re.max && re.bond === 0 && re.gm === 400, JSON.stringify(re));

    await interruptNow(page, true);
    const z = await page.evaluate(() => ({ res: TYRANO.kag.stat.f.battle_result, zero: TYRANO.kag.stat.f.final_mind_zero }));
    check("前半の終わりに心が0なら f.final_mind_zero = 1", z.res === "interrupt" && z.zero === 1, JSON.stringify(z));
    await advanceUntil(page, hasGlinks(page));
    await clickGlink(page, "まちがえる");
    await advanceUntil(page, hasGlinks(page));
    const again = await glinks(page);
    check("中盤：発展度4以上なら、まちがえても1回だけ選び直せる", again.some((t) => t.includes("正しい言葉")), JSON.stringify(again));
    await clickGlink(page, "正しい言葉");
    await advanceUntil(page, hasGlinks(page));
    const one = await glinks(page);
    check("後半：判定値2以下（心3 − 1）なら選択肢は1つだけ", one.length === 1 && one[0].includes("取り戻したい"), JSON.stringify(one));
    await page.close();

    // 決着で全員倒れたとき：決着の最初（前半の終わり＋足した絆）から
    page = await openBattle(browser, errors, "決戦の流れ");
    await interruptNow(page, false);
    await advanceUntil(page, hasGlinks(page));
    await clickGlink(page, "正しい言葉");
    await advanceUntil(page, hasGlinks(page));
    await clickGlink(page, "コノハ！");
    await advanceUntil(page, hasBattle(page));
    const st = await page.evaluate(() => JSON.parse(JSON.stringify(TYRANO.kag.stat.f.battle_state)));
    await wipeNow(page);
    const fw = await page.evaluate(() => TYRANO.kag.stat.f.battle_result);
    check('決着で全員倒れる：f.battle_result = "wipe"', fw === "wipe", fw);
    await advanceUntil(page, hasGlinks(page));
    await clickGlink(page, "もう一度");
    await advanceUntil(page, hasBattle(page), 10);
    const r2 = await page.evaluate(() => {
        const b = IslandBattle.current;
        return { bond: b.bond, gm: b.boss().hp, hero: b.party[0].hp };
    });
    check("もう一度：決着の最初から（前半の終わりの状態＋足した絆）", r2.bond === st.bond && r2.gm === st.bossHp && r2.hero === st.party[0].hp, JSON.stringify({ r2, bond: st.bond, gm: st.bossHp }));
    await page.evaluate(() => IslandBattle.current.destroy());
    await page.close();

    // タイトルに戻る
    page = await openBattle(browser, errors, "決戦の流れ");
    await wipeNow(page);
    await advanceUntil(page, hasGlinks(page));
    await clickGlink(page, "タイトルに戻る");
    await page.waitForTimeout(1500);
    const menu = await glinks(page);
    check("タイトルに戻る：.ks で分けられる（試作では確認メニューへ）", menu.some((t) => t.includes("戦闘画面のテスト")), JSON.stringify(menu));
    await page.close();
}

// ---- 2026-10-18 の設計（全員の決戦の支配の力、好物がだぶるとき、選択の色、中盤の選び直し） ----------
async function checkDesign(browser, errors, check) {
    let page = await openBattle(browser, errors, "探索の戦闘");
    const r = await page.evaluate(async () => {
        const IB = IslandBattle;
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        IB.current.destroy();
        const out = {};
        const f = TYRANO.kag.stat.f;
        const saveF = JSON.parse(JSON.stringify(f));
        const resetF = () => {
            Object.keys(f).forEach((k) => { if (!(k in saveF)) delete f[k]; });
            Object.assign(f, JSON.parse(JSON.stringify(saveF)));
        };
        const rnd = Math.random;
        Math.random = () => 0.5;
        try {
            // 1. 全員で挑む決戦の支配の力：max(600, 1100 − 100 × 発展度)。割り込みは 400 以下（値）
            out.allPower = [0, 3, 4, 6].map((dev) => {
                const b = IB.start({ mode: "final", phase: "first", partner: "all", dev, items: { herb: 0, medicine: 0 }, autoDelay: 10 });
                const v = { dev, max: b.boss().maxHp, hp: b.boss().hp, cut: b.interruptHp };
                b.destroy();
                return v;
            });
            let b = IB.start({ mode: "final", phase: "first", partner: "all", dev: 3, items: { herb: 0, medicine: 0 }, autoDelay: 10, endDelay: 10 });
            const boss = b.boss();
            b.minions().forEach((e) => { e.alive = false; e.hp = 0; });
            boss.hp = 402;
            b.damage(boss, 1);
            out.at401 = b.checkEnd();
            b.damage(boss, 1);
            out.at400 = b.checkEnd();
            await sleep(150);
            out.allInterrupt = { res: IB.last && IB.last.result, st: f.battle_state && f.battle_state.bossHp, max: f.battle_state && f.battle_state.bossMaxHp };
            resetF();
            // 2人で挑むときは変えない（支配の力 400、半分で中盤へ）
            b = IB.start({ mode: "final", phase: "first", partner: "konoha", dev: 6, items: { herb: 0, medicine: 0 }, autoDelay: 10 });
            out.duo = { max: b.boss().maxHp, cut: b.interruptHp, at: b.interruptAt };
            b.destroy();

            // 2. めずらしい報酬で好物がだぶるとき：出さずに薬 ×1
            const rare = async (preset, vars) => {
                resetF();
                Object.assign(f, vars);
                Math.random = () => 0.5;
                const bb = IB.start({ mode: "explore", partner: "", enemies: [{ preset, hp: 1 }], wis: 20, autoDelay: 10, endDelay: 10 });
                Math.random = () => 0.1; // めずらしい報酬が出る
                bb.command("attack");
                Math.random = () => 0.5;
                await sleep(100);
                const L = IB.last;
                return { rare: L.rare, rw: L.rewards, rep: L.rareReplaced, med: Number(f.item_medicine || 0) };
            };
            out.rare = {
                eagleFree: await rare("eagle", {}),
                eagleHave: await rare("eagle", { gift_white_flower: 1 }),
                eagleGave: await rare("eagle", { gave_white_flower: 1 }),
                nushiFree: await rare("nushi", {}),
                nushiSeed: await rare("nushi", { item_soy_seed: 1 }),
                nushiSoy: await rare("nushi", { item_soy: 1 }),
                nushiTofu: await rare("nushi", { gift_fried_tofu: 1 }),
                nushiPlanted: await rare("nushi", { soy_plant_day: 6 }),
                nushiGave: await rare("nushi", { gave_fried_tofu: 1 }),
                batMed: await rare("bat", { gift_white_flower: 1, item_soy_seed: 1 }),
            };
            resetF();

            // 3. 選択の帯の色：探索は朱 #e8502a、決戦は深紅 #c4262e（白の字）。地は生成り #efe9dc
            const colors = (cfg) => {
                const bb = IB.start(Object.assign({ autoDelay: 100000, items: { herb: 0, medicine: 0 } }, cfg));
                bb.select(1);
                const sel = getComputedStyle(bb.root.querySelector(".ib-item.ib-sel"));
                bb.autoBtn.classList.add("ib-on");
                const auto = getComputedStyle(bb.autoBtn);
                const v = { sel: sel.backgroundColor, selText: sel.color, auto: auto.backgroundColor, autoText: auto.color,
                    bar: getComputedStyle(bb.root.querySelector(".ib-enemybar")).backgroundColor,
                    menu: getComputedStyle(bb.menuEl).backgroundColor };
                bb.destroy();
                return v;
            };
            out.colorExplore = colors({ mode: "explore", partner: "", enemies: [{ name: "岩", hp: 999, atk: 1 }] });
            out.colorFinal = colors({ mode: "final", phase: "first", partner: "konoha" });
        } finally {
            Math.random = rnd;
            if (IB.current && !IB.current.destroyed) IB.current.destroy();
            resetF();
        }
        return out;
    });
    const ap = (r.allPower || []).map((v) => v.max).join();
    check("全員の決戦：発展度0・3・4・6 で支配の力 1100・800・700・600", ap === "1100,800,700,600" &&
        r.allPower.every((v) => v.hp === v.max && v.cut === 400), JSON.stringify(r.allPower));
    const ai = r.allInterrupt || {};
    check("全員の決戦：支配の力 401 では止めず、400 以下で interrupt", r.at401 === false && r.at400 === true &&
        ai.res === "interrupt" && ai.st === 400 && ai.max === 800, JSON.stringify({ a: r.at401, b: r.at400, ai }));
    check("2人の決戦は変えない（支配の力 400、半分で中盤へ）", r.duo.max === 400 && r.duo.cut === null && r.duo.at === 0.5, JSON.stringify(r.duo));
    const R = r.rare || {};
    const isMed = (x) => !!x && x.rare && !!x.rw && x.rw.item_medicine === 1 && !x.rw.gift_white_flower && !x.rw.item_soy_seed && x.med === 1;
    check("めずらしい報酬：だぶらなければ白い花・大豆の種が出る",
        R.eagleFree.rw.gift_white_flower === 1 && !R.eagleFree.rw.item_medicine && R.nushiFree.rw.item_soy_seed === 1 && !R.nushiFree.rw.item_medicine,
        JSON.stringify([R.eagleFree, R.nushiFree]));
    check("めずらしい報酬：白い花を持っている・渡したあとは、薬 ×1 に置きかえる",
        isMed(R.eagleHave) && isMed(R.eagleGave) && R.eagleHave.rw.item_food === 2 && (R.eagleHave.rep || []).join() === "gift_white_flower",
        JSON.stringify([R.eagleHave, R.eagleGave]));
    check("めずらしい報酬：大豆の種・大豆・油揚げを持っている、植えた、油揚げを渡したあとは、薬 ×1 に置きかえる",
        isMed(R.nushiSeed) && isMed(R.nushiSoy) && isMed(R.nushiTofu) && isMed(R.nushiPlanted) && isMed(R.nushiGave) &&
        R.nushiSeed.rw.item_food === 4 && R.nushiSeed.rw.item_wood === 3,
        JSON.stringify([R.nushiSeed, R.nushiSoy, R.nushiTofu, R.nushiPlanted, R.nushiGave]));
    check("めずらしい報酬：好物でない報酬（コウモリの薬）は変えない", R.batMed.rw.item_medicine === 1 && !(R.batMed.rep || []).length, JSON.stringify(R.batMed));
    const ce = r.colorExplore || {}, cf = r.colorFinal || {};
    check("選択の帯の色：探索は朱 #e8502a、白の字（自動のオンも）",
        ce.sel === "rgb(232, 80, 42)" && ce.selText === "rgb(255, 255, 255)" && ce.auto === "rgb(232, 80, 42)" && ce.autoText === "rgb(255, 255, 255)", JSON.stringify(ce));
    check("選択の帯の色：決戦は深紅 #c4262e、白の字（自動のオンも）",
        cf.sel === "rgb(196, 38, 46)" && cf.selText === "rgb(255, 255, 255)" && cf.auto === "rgb(196, 38, 46)" && cf.autoText === "rgb(255, 255, 255)", JSON.stringify(cf));
    check("地の色は生成り #efe9dc", ce.bar === "rgb(239, 233, 220)" && /^rgba\(239, 233, 220/.test(ce.menu), JSON.stringify({ bar: ce.bar, menu: ce.menu }));
    await page.close();

    // 4. 中盤の選び直し（battle_test.ks *mid_test。前半の戦闘は飛ばす）
    const midScenes = (pg) => pg.evaluate(() => ((TYRANO.kag.variable.tf || {}).test_mid_scenes || []).join());
    const openMid = async (variant) => {
        const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        pg.on("pageerror", (e) => errors.push("pageerror: " + e.message));
        pg.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
        await pg.goto(url);
        await pg.waitForSelector(".glink_button", { timeout: 20000 });
        await pg.waitForTimeout(1500);
        // test_menu.ks に入口がないので、battle_test.ks の *mid_test へ直接飛ぶ
        await pg.evaluate(() => {
            TYRANO.kag.stat.is_strong_stop = false;
            TYRANO.kag.ftag.startTag("jump", { storage: "battle_test.ks", target: "*mid_test" });
        });
        await advanceUntil(pg, async () => (await glinks(pg)).some((t) => t.includes(variant)), 20);
        await clickGlink(pg, variant);
        await advanceUntil(pg, hasGlinks(pg));
        return pg;
    };
    const ended = (pg) => advanceUntil(pg, msgHas(pg, "決戦のテストは終わり"));

    // 日記あり・発展度3：まちがえる → 日記の場面 → 選び直し1回。2回目は選び直しなし
    page = await openMid("日記あり・発展度3");
    await clickGlink(page, "まちがえる");
    await advanceUntil(page, hasGlinks(page));
    const d1 = { scenes: await midScenes(page), ch: await glinks(page), used: await page.evaluate(() => TYRANO.kag.stat.f.final_retry_used) };
    check("中盤：日記ありでまちがえる → 日記の言葉の場面で選び直し（f.final_retry_used = 1）",
        d1.scenes === "diary" && d1.ch.some((t) => t.includes("正しい言葉")) && d1.used === 1, JSON.stringify(d1));
    await clickGlink(page, "まちがえる");
    const d2end = await ended(page);
    const d2 = await midScenes(page);
    check("中盤：選び直しは1回だけ（2回目のまちがいで幻に負ける）", d2end && d2 === "diary,lost", d2);
    await page.close();

    // 日記なし・発展度4：まちがえる → ほかの4人が支える → 正しい言葉で絆 +3
    page = await openMid("日記なし・発展度4");
    await clickGlink(page, "まちがえる");
    await advanceUntil(page, hasGlinks(page));
    const s1 = { scenes: await midScenes(page), ch: await glinks(page) };
    check("中盤：日記なし・発展度4でまちがえる → ほかの4人が支える場面で選び直し",
        s1.scenes === "support" && s1.ch.some((t) => t.includes("正しい言葉")), JSON.stringify(s1));
    await clickGlink(page, "正しい言葉");
    await waitFor(msgHas(page, "ここにいる"));
    const s2 = await page.evaluate(() => TYRANO.kag.stat.f.battle_state.bond);
    check("中盤：選び直して正しければ絆 +3（2 → 5）", s2 === 5, String(s2));
    await page.close();

    // 両方：日記の場面だけ。2回目は選び直しなし
    page = await openMid("日記あり・発展度4（両方）");
    await clickGlink(page, "まちがえる");
    await advanceUntil(page, hasGlinks(page));
    const b1 = await midScenes(page);
    await clickGlink(page, "まちがえる");
    const b2end = await ended(page);
    const b2 = await midScenes(page);
    check("中盤：日記と発展度4の両方 → 日記の場面だけ、選び直しは合わせて1回", b1 === "diary" && b2end && b2 === "diary,lost", JSON.stringify([b1, b2]));
    await page.close();

    // どちらもない：選び直しなし
    page = await openMid("日記なし・発展度3");
    await clickGlink(page, "まちがえる");
    const n1end = await ended(page);
    const n1 = await midScenes(page);
    check("中盤：日記なし・発展度3なら選び直しなし（幻に負ける）", n1end && n1 === "lost", n1);
    await page.close();
}

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const results = [];
    const check = (name, ok, detail) => results.push({ name, ok, detail });

    // 勝ちの流れ
    let page = await openBattle(browser, errors);
    check("戦闘画面が出る", !!(await page.$(".ib-root")));
    await page.keyboard.press("ArrowDown");
    check("矢印キーで選べる", (await page.textContent(".ib-item.ib-sel .ib-label")) === "守る");
    await page.keyboard.press("ArrowUp");
    await page.click(".ib-item:nth-of-type(2)");
    await page.waitForTimeout(300);
    check("攻撃でダメージが出る", (await page.textContent(".ib-log")).includes("ダメージ"));
    await page.mouse.click(900, 300);
    await page.waitForTimeout(300);
    check("戦闘中のクリックで文字送りが進まない", !!(await page.$(".ib-root")));
    await page.click(".ib-auto");
    check("自動戦闘で最後まで進む", await waitBattleEnd(page));
    await page.waitForTimeout(1500);
    const win = await page.evaluate(() => ({
        res: TYRANO.kag.stat.f.battle_result,
        msg: $(".message0_fore .message_inner").text(),
    }));
    check("勝つと勝ちの分岐に進む", win.res === "win" && win.msg.includes("やったー"), JSON.stringify(win));
    await page.close();

    // 負けの流れ（敵を強くして確かめる）
    page = await openBattle(browser, errors);
    await page.evaluate(() => {
        const b = IslandBattle.current;
        b.enemies.forEach((e) => { e.hp = e.maxHp = 9999; e.atk = 60; });
        b.party.forEach((p) => { p.hp = 5; });
        b.render();
    });
    await page.click(".ib-auto");
    await waitBattleEnd(page);
    await page.waitForTimeout(1500);
    const lose = await page.evaluate(() => ({
        res: TYRANO.kag.stat.f.battle_result,
        msg: $(".message0_fore .message_inner").text(),
    }));
    check("負けると負けの分岐に進む", lose.res === "lose" && lose.msg.includes("しっかりして"), JSON.stringify(lose));
    await page.close();

    // 1つの組が例外で止まっても、ほかの組は続けて結果を出す
    for (const [name, fn] of [["計算と自動戦闘", checkCalc], ["探索の1戦", checkExplore], ["レビューの修正", checkFixes], ["決戦の流れ", checkFinal], ["全員倒れたとき", checkFinalWipe], ["2026-10-18 の設計", checkDesign]]) {
        try {
            await fn(browser, errors, check);
        } catch (e) {
            check(name + "：途中で止まらない", false, String(e.message).split("\n").slice(0, 2).join(" "));
        }
    }

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
