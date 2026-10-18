/*
 * 会話画面の試作を、ブラウザで自動操作して確かめるスクリプト。
 * 前提と使い方は check_battle.js と同じ：
 *   node game/tyrano-proto/tools/check_adv.js http://localhost:8799/index.html
 */
const { chromium } = require("playwright");

const url = process.argv[2] || "http://localhost:8799/index.html";

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    const results = [];
    const check = (name, ok, detail) => results.push({ name, ok, detail });
    const state = () => page.evaluate(() => ({
        name: $(".chara_name_area").text(),
        bust: $(".li-bust").hasClass("show"),
        day: $(".li-day").text(),
        slot: $(".li-slot").text(),
        left: $(".li-left").text(),
        next: $(".li-next").text(),
        msg: $(".message0_fore .message_inner").text(),
        bodyFont: (function () { var e = document.querySelector(".message0_fore .message_inner"); return e ? getComputedStyle(e).fontFamily : "(なし)"; })(),
        nameFont: (function () { var e = document.querySelector(".chara_name_area"); return e ? getComputedStyle(e).fontFamily : "(なし)"; })(),
    }));
    const advance = async () => { await page.mouse.click(700, 400); await page.waitForTimeout(900); };

    await page.goto(url);
    await page.waitForSelector(".glink_button", { timeout: 20000 });
    await page.waitForTimeout(1500); // ボタンが出そろって、押せるようになるまで待つ
    await page.click("text=会話画面のテスト");
    await page.waitForFunction(() => $(".chara_name_area").text() === "コノハ", null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.evaluate(() => document.fonts.ready);

    let s = await state();
    check("日付と時間帯が出る（5日目・昼）", s.day === "5日目" && s.slot === "昼", JSON.stringify(s));
    check("GM との勝負までの日数が出る（9日）", s.left.includes("9"), s.left);
    check("次にやることが出る", s.next.includes("作業台"), s.next);
    check("コノハが話すと、名前の札と顔の絵が出る", s.name === "コノハ" && s.bust, JSON.stringify(s));
    check("本文のフォントがZen Kaku Gothic New", s.bodyFont.includes("LI ZenKaku"), s.bodyFont);
    check("名前の札のフォントがDela Gothic One", s.nameFont.includes("LI Dela"), s.nameFont);
    const fontsLoaded = await page.evaluate(() => document.fonts.check('24px "LI ZenKaku"') && document.fonts.check('24px "LI Dela"'));
    check("フォントの読み込み", fontsLoaded, "fonts/ にフォントがない");

    await page.click(".li-ops div:nth-child(3)"); // ログ
    await page.waitForTimeout(800);
    const logShown = await page.evaluate(() => $(".log_body").length > 0 || $(".layer_menu").css("display") === "block");
    check("ログのボタンで、ログが開く", logShown);
    await page.keyboard.press("Escape");
    await page.evaluate(() => { if (TYRANO.kag.menu.hideMenu) TYRANO.kag.menu.hideMenu(); $(".menu_close").trigger("click"); });
    await page.waitForTimeout(500);
    s = await state();
    check("ログを閉じても、会話が先に進んでいない", s.name === "コノハ", JSON.stringify(s));

    await advance();
    s = await state();
    check("主人公（ユウ）が話すときは、顔の絵を出さない", s.name === "ユウ" && !s.bust, JSON.stringify(s));
    await advance();
    await advance();
    s = await state();
    check("地の文（名前なし）では、顔の絵を出さない", s.name === "" && !s.bust, JSON.stringify(s));
    await advance();
    s = await state();
    check("時間帯が夜に変わり、ノクティアの顔の絵が出る", s.slot === "夜" && s.name === "ノクティア" && s.bust, JSON.stringify(s));

    await page.click(".li-ops div:nth-child(2)"); // オート
    await page.waitForTimeout(300);
    const autoOn = await page.evaluate(() => TYRANO.kag.stat.is_auto === true && $(".li-ops div:nth-child(2)").hasClass("on"));
    // 2026-10-18 追加：オンのボタンは朱の地に白の字（plan.md「選択の色」。金は使わない）
    const onColor = await page.evaluate(() => { const e = document.querySelector(".li-ops div:nth-child(2)"); const cs = getComputedStyle(e); return cs.backgroundColor + " / " + cs.color; });
    await page.click(".li-ops div:nth-child(2)");
    await page.waitForTimeout(300);
    const autoOff = await page.evaluate(() => TYRANO.kag.stat.is_auto === false);
    check("オートのボタンで、オートを入り切りできる", autoOn && autoOff);
    check("オンのボタンは朱の地に白の字", onColor === "rgb(232, 80, 42) / rgb(255, 255, 255)", onColor);

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
