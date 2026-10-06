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
 */
const { chromium } = require("playwright");

const url = process.argv[2] || "http://localhost:8799/index.html";

async function openBattle(browser, errors) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    await page.goto(url);
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
