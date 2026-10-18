/*
 * 1日の画面の計算（data/others/day_ui/rules.js）を、ブラウザなしで確かめるテスト。
 *   node game/tyrano-proto/tools/check_day_rules.js
 *
 * 確かめる表：
 *   - docs/game/design/life-bond.md 6-2（真エンドの計画）を rules.js の行動の計算でなぞり、各回の好感度と段階が表と合うこと。
 *     二人きりで過ごす回の前には、印（ふつうか好物つき）が出ていること。
 *   - life-bond.md 7-2：2〜12日目のまとめと、各行動の前の1行で、K1〜K4 が1回も出ないこと。
 *   - screens.md 3-3 (a)（affection.md 3章の古い計画）のまとめで、K1〜K4 が出ないこと。
 *   - screens.md 3-3 (b)(c) の例、1-3 の表、2-3 の棒と印の例、2-5 の段階5。
 */
const path = require("path");
const R = require(path.join(__dirname, "..", "data", "others", "day_ui", "rules.js"));

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// s の並びは表と同じ（コ・カ・ハ・イ・ノ）
const KEYS = ["konoha", "kabane", "hakuren", "ignia", "noctia"];
function fWith(sList, extra) {
    const f = R.defaults(Object.assign({}, extra || {}));
    KEYS.forEach((k, i) => { f["ev_" + k] = sList[i]; });
    return f;
}

// ---- 1-3 残りの表 ----
const table13 = {
    2: [9, 10, 9], 3: [9, 9, 8], 4: [8, 8, 7], 5: [8, 8, 6], 6: [7, 7, 5], 7: [6, 6, 4], 8: [5, 5, 3],
    9: [4, 4, 3], 10: [3, 3, 2], 11: [2, 2, 1], 12: [1, 1, 0], 13: [0, 0, 0],
};
let ok13 = true, bad13 = [];
Object.keys(table13).forEach((d) => {
    const r = R.remaining(Number(d));
    if (!eq([r.morning, r.noon, r.night], table13[d])) { ok13 = false; bad13.push(d + ":" + [r.morning, r.noon, r.night]); }
});
check("1-3 残りの表（2〜13日目の朝の前）が合う", ok13, bad13.join(" "));
const r9 = R.remaining(9, "noon");
check("1-3 9日目の昼の行動の前は 朝3・昼4・夜3", eq([r9.morning, r9.noon, r9.night], [3, 4, 3]), JSON.stringify(r9));
check("1-3 合計28回（2日目の朝の前）", R.remaining(2).total === 28);

// ---- 2-3 棒・2-4 印 ----
let b = R.bar(25, 1);
check("2-3 コノハ 段階1・好感度25 → 満タン（base10・goal25）", b.base === 10 && b.goal === 25 && b.cells === 10 && b.full, JSON.stringify(b));
b = R.bar(46, 2);
check("2-3 ハクレン 段階2・好感度46 → 満タン（goal45）", b.goal === 45 && b.cells === 10 && b.full, JSON.stringify(b));
b = R.bar(38, 2);
check("2-3 段階2・好感度38 → 5マス", b.cells === 5 && !b.full, JSON.stringify(b));
b = R.bar(44, 2);
check("2-3 切り捨て：段階2・好感度44（goal の1つ手前）は9マスで満タンでない", b.cells === 9 && !b.full, JSON.stringify(b));
b = R.bar(4, 0);
check("2-3 段階0・好感度4 → 8マス（goal5）", b.cells === 8 && !b.full && b.goal === 5, JSON.stringify(b));
check("2-3 段階5は棒を出さない", R.bar(95, 5) === null);

let f = fWith([0, 0, 0, 4, 0], { aff_ignia: 86, day: 8 });
check("2-5 段階4・8日目・満タン → 印の代わりに「9日目から」", R.markStatus(f, "ignia") === "day9");
f.day = 9;
check("2-5 段階4・9日目・満タン → 印", R.markStatus(f, "ignia") === "heart");
f.aff_ignia = 80; f.day = 8;
check("2-5 段階4・8日目・満タンでない → 印なし", R.markStatus(f, "ignia") === null);
f = fWith([0, 0, 0, 5, 0], { aff_ignia: 99, day: 12 });
check("2-5 段階5 → 印なし", R.markStatus(f, "ignia") === null);

// 好物つきの印（life-bond.md 7-3：2日目の夜のイグニア、好感度3）
f = fWith([0, 0, 0, 0, 0], { day: 2, slot: "night", aff_ignia: 3, item_fish: 1, aff_kabane: 8 });
check("好物つき：イグニア 好感度3・魚あり → 状態画面は好物つきの印", R.markStatus(f, "ignia") === "gift");
check("好物つき：いまの時間帯（夜）の顔にも好物つきの印", R.markNow(f, "ignia") === "gift");
check("好物なしでも届くカバネは、ふつうの印", R.markNow(f, "kabane") === "heart");
check("好物つきで過ごすと段階のイベントが起きる（判定 3+5+10=18）", R.eventWouldHappen(f, "ignia", true) && !R.eventWouldHappen(f, "ignia", false));
let res = R.applySpend(f, "ignia", true);
check("好物を渡して過ごす：段階1、+27、好感度30、魚 −1、f.gave_fish = 1", res.stage === 1 && res.delta === 27 && f.aff_ignia === 30 && f.item_fish === 0 && f.gave_fish === 1, JSON.stringify(res));
check("渡したあとは好物つきの印が出ない（棒が満タンならふつうの印）", R.markStatus(f, "ignia") === "heart");

// 雨の日の昼のノクティア
f = fWith([0, 0, 0, 0, 1], { day: 5, slot: "noon", weather: "雨", aff_noctia: 40 });
check("雨の日の昼：ノクティアに会える", R.canMeet("noctia", "noon", "雨"));
check("雨の日の昼：状態画面は印、いまの時間帯の印は出さない", R.markStatus(f, "noctia") === "heart" && R.markNow(f, "noctia") === null);
check("雨の日の昼：過ごしてもイベントは起きない", !R.eventWouldHappen(f, "noctia", false));
// 朝のハクレン
f = fWith([0, 0, 0, 0, 0], { day: 5, slot: "morning", aff_hakuren: 8 });
check("朝のハクレン：いまの時間帯の印", R.markNow(f, "hakuren") === "heart");
res = R.applyTrain(f);
check("朝の稽古でハクレンの段階のイベントが起き、力+1・稽古+1", res.event && f.ev_hakuren === 1 && f.str === 2 && f.train_count === 1, JSON.stringify(res));

// ---- life-bond.md 6-2 の計画をなぞる ----
const plan = R.defaults({ day: 2, slot: "noon", weather: "晴れ" });
Object.assign(plan, { aff_konoha: 5, aff_kabane: 3, aff_hakuren: 3, aff_ignia: 0, aff_noctia: 3, item_fish: 2, item_wood: 3 }); // 2日目・朝のあと
const affRow = () => KEYS.map((k) => plan["aff_" + k]);
const evRow = () => KEYS.map((k) => plan["ev_" + k]);
const fails = [];
const lineFails = [];
const markFails = [];
const summaryRows = {};
function lineCheck() {
    const J = R.judgeNow(plan);
    if (J.K1 || J.K2) lineFails.push(plan.day + plan.slot + (J.K1 ? " K1" : " K2"));
}
function step(day, slot, fn, expectAff, label) {
    plan.day = day; plan.slot = slot;
    if (R.isFreeSlot(day, slot)) lineCheck();
    fn();
    if (expectAff && !eq(affRow(), expectAff)) fails.push(`${day}日目${slot} ${label}: ${affRow()} ≠ ${expectAff}`);
}
function spend(name, gift) {
    return () => {
        const m = R.markNow(plan, name);
        if (gift ? !(m === "gift" || m === "heart") : m !== "heart") markFails.push(`${plan.day}日目 ${name} 印=${m}`);
        const r = R.applySpend(plan, name, gift);
        if (!r.event) fails.push(`${plan.day}日目 ${name}: イベントが起きない`);
    };
}
function endOfDay(day) {
    plan.day = day;
    summaryRows[day] = { s: evRow(), J: R.judgeSummary(plan), W: R.summaryWarnings(plan) };
}
step(2, "noon", () => R.applyBuild(plan, "facility", "workbench", ["kabane", "ignia"]), [5, 8, 3, 3, 3], "作業台");
step(2, "night", spend("ignia", true), [5, 8, 3, 30, 3], "イグニア＋魚");
endOfDay(2);
step(3, "morning", () => R.applyExplore(plan, "forest", "hakuren"), [5, 8, 6, 30, 3], "森（ハクレン）");
check("6-2 3日目・朝の森で赤い果実と木材+2", plan.gift_red_fruit === 1 && plan.item_wood === 2, `果実${plan.gift_red_fruit} 木材${plan.item_wood}`);
step(3, "noon", spend("konoha"), [22, 8, 6, 30, 3], "コノハ");
step(3, "night", spend("noctia", true), [22, 8, 6, 30, 30], "ノクティア＋果実");
endOfDay(3);
// 4日目・朝昼：嵐（固定の場面）
Object.assign(plan, { day: 4 });
plan.aff_konoha += 7; plan.aff_kabane += 2; plan.aff_hakuren += 2; plan.aff_ignia += 2;
plan.workbench_broken = 1; plan.item_wood = Math.max(0, plan.item_wood - 3); plan.dev = R.devOf(plan);
check("6-2 嵐のあと 29・10・8・32・30、発展度0", eq(affRow(), [29, 10, 8, 32, 30]) && plan.dev === 0, affRow() + " dev" + plan.dev);
step(4, "night", spend("noctia"), [29, 10, 8, 32, 48], "ノクティア");
endOfDay(4);
step(5, "morning", spend("hakuren"), [29, 10, 25, 32, 48], "ハクレン");
step(5, "noon", spend("konoha"), [47, 10, 25, 32, 48], "コノハ");
step(5, "night", spend("ignia"), [47, 10, 25, 50, 48], "イグニア");
endOfDay(5);
step(6, "morning", spend("hakuren"), [47, 10, 43, 50, 48], "ハクレン");
step(6, "noon", () => R.applyExplore(plan, "river", "ignia"), [47, 10, 43, 53, 48], "川（イグニア）");
check("6-2 6日目・昼の川で粘土3", plan.item_clay === 3);
step(6, "night", spend("noctia"), [47, 10, 43, 53, 66], "ノクティア");
endOfDay(6);
step(7, "morning", spend("kabane"), [47, 27, 43, 53, 66], "カバネ");
step(7, "noon", () => {
    const d = R.buildHelpersDefault(plan, "facility", "stove");
    if (d.selected[0] !== "ignia" || d.selected.length !== 2) fails.push("かまどの最初の手伝いにゆかり（イグニア）がいない：" + d.selected);
    R.applyBuild(plan, "facility", "stove", ["ignia", "konoha"]);
}, [50, 27, 43, 58, 66], "かまど");
check("6-2 7日目・かまどで発展度1", plan.dev === 1);
step(7, "night", spend("noctia"), [50, 27, 43, 58, 79], "ノクティア");
endOfDay(7);
step(8, "morning", spend("konoha"), [69, 27, 43, 58, 79], "コノハ");
step(8, "noon", spend("ignia"), [69, 27, 43, 77, 79], "イグニア");
plan.slot = "night";
KEYS.forEach((k) => { plan["aff_" + k] += 2; }); // 中間発表（固定）
check("6-2 8日目・夜（中間発表）のあと 71・29・45・79・81", eq(affRow(), [71, 29, 45, 79, 81]), affRow());
endOfDay(8);
step(9, "morning", spend("hakuren"), [71, 29, 64, 79, 81], "ハクレン");
step(9, "noon", spend("kabane"), [71, 47, 64, 79, 81], "カバネ");
step(9, "night", spend("ignia"), [71, 47, 64, 92, 81], "イグニア");
endOfDay(9);
step(10, "morning", () => R.applyExplore(plan, "beach", "hakuren"), [71, 47, 67, 92, 81], "浜辺（ハクレン）");
check("6-2 10日目・朝の初めての浜辺で虹色の貝殻", plan.gift_rainbow_shell === 1);
step(10, "noon", spend("konoha"), [84, 47, 67, 92, 81], "コノハ");
step(10, "night", spend("kabane", true), [84, 76, 67, 92, 81], "カバネ＋貝殻");
endOfDay(10);
step(11, "morning", spend("hakuren"), [84, 76, 80, 92, 81], "ハクレン");
step(11, "noon", spend("kabane"), [84, 89, 80, 92, 81], "カバネ");
plan.slot = "night"; lineCheck(); // 11日目の夜（空き）
endOfDay(11);
plan.day = 12; plan.slot = "morning"; lineCheck(); plan.slot = "noon"; lineCheck(); // 12日目（空き）
endOfDay(12);

check("6-2 の計画を rules.js でなぞると、好感度が表と全部合う", fails.length === 0, fails.join(" / "));
check("6-2 の計画で、二人きりで過ごす前に必ず印が出ている（3-3 自動テスト(3)）", markFails.length === 0, markFails.join(" / "));
check("6-2 の計画で、11日目の昼に5人とも段階4", eq(evRow(), [4, 4, 4, 4, 4]), evRow());

// life-bond.md 7-2 の表（s と余り）
const t72 = {
    2: { s: [0, 0, 0, 1, 0], rem: [5, 4, 10, 10, 9, 7] },
    3: { s: [1, 0, 0, 1, 1], rem: [4, 4, 9, 9, 8, 6] },
    4: { s: [1, 0, 0, 1, 2], rem: [4, 4, 9, 9, 8, 6] },
    5: { s: [2, 0, 1, 2, 2], rem: [4, 3, 9, 8, 7, 6] },
    6: { s: [2, 0, 2, 2, 3], rem: [4, 3, 8, 7, 7, 5] },
    7: { s: [2, 1, 2, 2, 4], rem: [3, null, 6, 6, 6, 4] },
    8: { s: [3, 1, 2, 3, 4], rem: [2, null, 5, 6, 5, 4] },
    9: { s: [3, 2, 3, 4, 4], rem: [2, null, 4, null, 4, 4] },
    10: { s: [4, 3, 3, 4, 4], rem: [1, null, 3, null, 2, 3] },
    11: { s: [4, 4, 4, 4, 4], rem: [null, null, null, null, null, null] },
    12: { s: [4, 4, 4, 4, 4], rem: [null, null, null, null, null, null] },
};
const bad72 = [];
let anyK72 = [];
Object.keys(t72).forEach((d) => {
    const row = summaryRows[d];
    if (!row) { bad72.push(d + "：まとめなし"); return; }
    if (!eq(row.s, t72[d].s)) bad72.push(`${d}日目 s ${row.s} ≠ ${t72[d].s}`);
    const rem = row.J.formulas.map((e) => (e.active ? e.rem : null));
    if (!eq(rem, t72[d].rem)) bad72.push(`${d}日目 余り ${rem} ≠ ${t72[d].rem}`);
    const J = row.J;
    if (J.K1 || J.K2 || J.K3 || J.K4 || row.W.list.length) anyK72.push(d + "日目");
});
check("life-bond 7-2：2〜12日目のまとめの s と余りが表と合う", bad72.length === 0, bad72.join(" / "));
check("life-bond 7-2：2〜12日目のまとめで K1〜K4 が1回も出ない", anyK72.length === 0, anyK72.join(" "));
check("life-bond 7-2：各行動の前の1行で K1・K2 が1回も出ない", lineFails.length === 0, lineFails.join(" "));
check("life-bond 7-2：10日目のまとめの (1) は余り1で、K4 は出ない", summaryRows[10].J.formulas[0].rem === 1 && !summaryRows[10].J.K4);
check("life-bond 7-2：10日目のまとめの状態画面の「きつい人」は (1) ハクレンの1行",
    eq(summaryRows[10].J.tight.map((e) => e.id), [1]));

// ---- screens.md 3-3 (a)：affection.md 3章の古い計画 ----
const t33a = {
    2: [0, 0, 0, 0, 0], 3: [1, 0, 0, 0, 1], 4: [1, 0, 0, 1, 1], 5: [2, 0, 1, 1, 1], 6: [2, 0, 2, 2, 2], 7: [3, 1, 2, 2, 2],
    8: [3, 2, 2, 2, 2], 9: [3, 2, 3, 3, 3], 10: [4, 2, 4, 3, 4], 11: [4, 4, 4, 4, 4], 12: [4, 4, 4, 4, 4],
};
const rem33a = {
    2: [5, 4, 10, 9, 9, 6], 7: [3, 1, 7, 4, 4, 3], 8: [2, 1, 5, 3, 3, 2], 9: [2, 1, 4, 3, 3, 2], 10: [null, null, null, 2, null, 2],
};
const any33a = [], badRem33a = [];
Object.keys(t33a).forEach((d) => {
    const fx = fWith(t33a[d], { day: Number(d) });
    const W = R.summaryWarnings(fx);
    if (W.list.length) any33a.push(d + "日目 " + W.list.map((w) => w.kind).join(","));
    if (rem33a[d]) {
        const rem = W.judge.formulas.map((e) => (e.active ? e.rem : null));
        if (!eq(rem, rem33a[d])) badRem33a.push(`${d}日目 ${rem} ≠ ${rem33a[d]}`);
    }
});
check("3-3 (a) 古い計画：2〜12日目のまとめで K1〜K4 が1回も出ない（7〜9日目は (2) が余り1でも出ない）", any33a.length === 0, any33a.join(" / "));
check("3-3 (a) 古い計画：余りが表と合う（2・7・8・9・10日目）", badRem33a.length === 0, badRem33a.join(" / "));
// 行動の画面の1行：10日目の朝（s 3・2・3・3・3）で K2 が出ない
f = fWith([3, 2, 3, 3, 3], { day: 10, slot: "morning" });
check("3-3 (a) 10日目の朝の1行で K2 は出ない", !R.judgeNow(f).K2 && !R.judgeNow(f).K1);

// ---- 3-3 (b) ----
f = fWith([4, 2, 1, 1, 2], { day: 8 });
let W = R.summaryWarnings(f);
check("3-3 (b) 8日目のまとめ：K4 は出ない", !W.judge.K4 && W.list.length === 0, JSON.stringify(W.list));
check("3-3 (b) 8日目のまとめ：余りは 1・1・5・2・2・1", eq(W.judge.formulas.map((e) => e.rem), [1, 1, 5, 2, 2, 1]));
check("3-3 (b) 8日目：状態画面のきつい人の行は (1)(2)(6)", eq(W.judge.tight.map((e) => e.id), [1, 2, 6]));
f = fWith([4, 2, 2, 2, 2], { day: 9 });
W = R.summaryWarnings(f);
check("3-3 (b) 9日目のまとめ（寄り道1回）：K4 が出る", W.judge.K4 && W.list.length === 1 && W.list[0].kind === "K4", JSON.stringify(W.list));
check("3-3 (b) K4 に添える行は (2) ノクティアと (6) 5人あわせて", W.list[0] && eq(W.list[0].lines, [
    "全員と心を通わせるなら、もう寄り道はできない。", "夜の残り2回は、全部ノクティアと過ごす", "残り8回は、全部まだ心が通っていない人と過ごす"]),
    W.list[0] && W.list[0].lines.join(" | "));
f = fWith([4, 2, 2, 1, 2], { day: 9 });
W = R.summaryWarnings(f);
check("3-3 (b) 寄り道2回（イベント1つ）：K3 が出る（K4 は出ない）", W.judge.K3 && !W.judge.K4 && W.list.map((w) => w.kind).join() === "K3", JSON.stringify(W.list.map((w) => w.kind)));
f.warn_all_lost = 1;
W = R.summaryWarnings(f);
check("3-3 (b) K3 は1回だけ（f.warn_all_lost = 1 のあとは出ない）", W.list.length === 0 && W.judge.K3);
check("2-7 状態画面の見込みは K3 を出し続ける", R.allPanel(Object.assign(f, { day: 10, slot: "morning" })).prospect === "K3");

// ---- まとめから開いた状態画面（レビューの指摘 A1）：まとめと同じ時点で数える ----
f = fWith([4, 2, 2, 2, 2], { day: 9, slot: "night" });
let P = R.allPanel(f, true);
check("A1 3-3 (b) 9日目のまとめから開いた状態画面：残り8回（朝3・昼3・夜2）で見込みは K4", P.R === 8 && P.prospect === "K4" && R.summaryWarnings(f).judge.K4, JSON.stringify(P));
P = R.allPanel(f, false);
check("A1 同じ f を「いまの時間帯（9日目の夜）」で数えると残り9回で見込みなし（まとめから開くときは使わない）", P.R === 9 && P.prospect === null, JSON.stringify(P));
let r2 = R.statusRemaining(f, true);
check("A1 まとめから開いた状態画面の「残りの行動」は 朝3・昼3・夜2", r2.morning === 3 && r2.noon === 3 && r2.night === 2, JSON.stringify(r2));
// 探索で f.explore_partner を書く（レビューの指摘 B6）
f = R.defaults({ day: 3, slot: "morning" });
R.applyExplore(f, "forest", "hakuren");
let okP = f.explore_partner === "hakuren";
R.applyExplore(f, "river", null);
check("B6 探索で f.explore_partner を書く（誘った相手。一人のときは空）", okP && f.explore_partner === "", String(f.explore_partner));

// ---- 3-3 (c) ----
f = fWith([0, 2, 0, 0, 0], { day: 12, slot: "morning" });
let J = R.judgeNow(f);
check("3-3 (c) 12日目の朝・カバネ s=2 → K2（B=0）", J.K2 && !J.K1 && J.B === 0 && J.bName === "kabane", JSON.stringify({ K1: J.K1, K2: J.K2, B: J.B }));
check("3-3 (c) K2 の1行に、いちばん余裕のある人の名前", R.nextLine(f).text === "まだ誰とも心が通っていない。カバネに二人きりで会おう", R.nextLine(f).text);
f = fWith([0, 1, 0, 0, 0], { day: 12, slot: "morning" });
J = R.judgeNow(f);
check("3-3 (c) 12日目の朝・カバネ s=1 → K1", J.K1 && !J.K2, JSON.stringify({ K1: J.K1, B: J.B }));
check("3-3 (c) K1 は1行のいちばん上", R.nextLine(f, "台本の行").kind === "K1");
f = fWith([2, 2, 2, 2, 2], { day: 11, slot: "morning" });
check("3-3 (c) 11日目の朝・5人とも s≤2 → K2（f.day ≥ 10）", R.judgeNow(f).K2);
f = fWith([2, 2, 2, 2, 2], { day: 9 });
check("3-3 (c) まとめは次の日の日付で見る：9日目のまとめから K2（この例は n の合計10 > 8 で K3 も出る）", R.summaryWarnings(f).list.map((w) => w.kind).join() === "K2,K3", R.summaryWarnings(f).list.map((w) => w.kind).join());
f = fWith([2, 2, 2, 2, 2], { day: 8 });
check("3-3 (c) 8日目のまとめ（次の日は9日目）では、5人とも s≤2 でも K2 は出ない", !R.summaryWarnings(f).judge.K2);
f = fWith([2, 2, 2, 2, 2], { day: 9, slot: "night" });
check("3-3 (c) 9日目の夜の1行では、まだ K2 は出ない", !R.judgeNow(f).K2);

// ---- K4 の人の名前（ui_text.md 3-2：n=0 の人の名前は出さない） ----
f = fWith([2, 4, 4, 4, 4], { day: 11 }); // コノハだけ n=2。12日目の朝の前は 朝1・昼1・夜0
W = R.summaryWarnings(f);
check("K4 の行：(3) でハクレンが段階4なら「全部コノハと過ごす」", W.list.length && W.list[0].lines.indexOf("朝と昼の残り2回は、全部コノハと過ごす") >= 0, W.list.map((w) => w.lines.join("|")).join(" / "));

// ---- H9・ふつうのヒントの順番（3-4） ----
f = fWith([3, 1, 2, 3, 4], { day: 9, slot: "morning", tool_torch: 1, dev: 3, explore_forest: 3, visit_beach: 1, visit_river: 1, visit_rock: 1 });
let h = R.normalHint(f);
check("3-4 H9：9日目の朝で段階4の人がいれば、ふつうのヒントの4番目", h.no === 4 && h.h9, JSON.stringify(h));
f.hint_day9_shown = 1;
check("3-4 H9 は1回だけ（f.hint_day9_shown のあとは出ない）", R.normalHint(f).no !== 4);
f = fWith([3, 1, 2, 3, 4], { day: 9, slot: "morning", workbench_broken: 1 });
check("3-4 9日目の朝でも、作業台が壊れていれば 2 が先（H9 は出ない）", R.normalHint(f).no === 2);
const orderCases = [
    [{ hp: 3 }, 1], [{ workbench_broken: 1 }, 2], [{ day: 4 }, 3], [{ day: 4, tool_torch: 1, explore_forest: 1 }, 5],
    [{ day: 7, tool_torch: 1, explore_forest: 3, dev: 2 }, 6],
];
const badOrder = [];
orderCases.forEach(([ex, no]) => {
    const fx = R.defaults(Object.assign({ day: 3, slot: "noon" }, ex));
    const got = R.normalHint(fx).no;
    if (got !== no) badOrder.push(`${JSON.stringify(ex)} → ${got}（期待 ${no}）`);
});
f = R.defaults({ day: 5, slot: "noon", tool_torch: 1, explore_forest: 3, dev: 3, aff_konoha: 30, ev_konoha: 1 });
if (R.normalHint(f).no !== 7) badOrder.push("7 印（コノハ）");
f = R.defaults({ day: 5, slot: "morning", tool_torch: 1, explore_forest: 3, dev: 3, aff_hakuren: 6 });
if (R.normalHint(f).text !== "ハクレンと過ごすか稽古すると、何か起きそう") badOrder.push("7 朝のハクレン：" + R.normalHint(f).text);
f = R.defaults({ day: 5, slot: "night", tool_torch: 1, explore_forest: 3, dev: 3, aff_ignia: 0, item_fish: 1 });
if (R.normalHint(f).text !== "イグニアに好物を渡して過ごすと、何か起きそう") badOrder.push("7 好物つき：" + R.normalHint(f).text);
f = R.defaults({ day: 5, slot: "night", tool_torch: 1, explore_forest: 3, dev: 3, aff_ignia: 12, ev_ignia: 1, item_fish: 1 });
if (R.normalHint(f).no !== 8) badOrder.push("8 好物を持っている：" + JSON.stringify(R.normalHint(f)));
f = R.defaults({ day: 5, slot: "night", tool_torch: 1, explore_forest: 3, dev: 3, aff_ignia: 12, ev_ignia: 1, visit_beach: 0 });
if (R.normalHint(f).no !== 9) badOrder.push("9 まだ行っていない：" + R.normalHint(f).no);
f = R.defaults({ day: 5, slot: "night", tool_torch: 1, explore_forest: 3, dev: 3, aff_ignia: 12, ev_ignia: 1, visit_beach: 1, visit_river: 1, visit_rock: 1, visit_cave: 1 });
if (R.normalHint(f).no !== 10) badOrder.push("10 どれもない：" + R.normalHint(f).no);
check("3-4 ふつうのヒント10個の順番", badOrder.length === 0, badOrder.join(" / "));
f = R.defaults({ day: 2, slot: "noon" });
check("3-1 2日目は台本の行をいちばん上に", R.nextLine(f, "作業台を建ててみよう").kind === "script");

// ---- 建てる（2日目の作業台はカバネを外せない、ゆかり +5） ----
f = R.defaults({ day: 2, slot: "noon", item_wood: 3 });
let d = R.buildHelpersDefault(f, "facility", "workbench");
check("2日目の作業台：カバネ（ゆかり）が最初から選ばれ、外せない", d.selected[0] === "kabane" && d.locked.indexOf("kabane") >= 0 && d.yukari === "kabane" && d.selected.length === 2, JSON.stringify(d));
f = R.defaults({ day: 5, slot: "night", built_workbench: 1, workbench_broken: 1, item_wood: 2 });
d = R.buildHelpersDefault(f, "repair", "workbench");
check("直すとき：ゆかりの札なし（yukari = null）、2人を選ぶ", d.yukari === null && d.selected.length === 2 && d.locked.length === 0, JSON.stringify(d));
res = R.applyBuild(f, "repair", "workbench", ["kabane", "ignia"]);
check("直す：手伝いは各 +3（ゆかりの +5 なし）、発展度が戻る", res.helpers.every((x) => x.delta === 3) && f.dev === 1 && f.workbench_broken === 0, JSON.stringify(res));
f = R.defaults({ day: 5, slot: "noon", item_wood: 1 });
const rows = R.buildList(f);
const field = rows.filter((x) => x.id === "field")[0];
check("建てる一覧：足りないものは「木材 あと2」", field && !field.ok && field.short[0].n === 2 && field.short[0].label === "木材");
check("自動セーブの枠：2・12日目は A、13日目は B、14日目は C", R.autosaveSlotFor(2) === "A" && R.autosaveSlotFor(12) === "A" && R.autosaveSlotFor(13) === "B" && R.autosaveSlotFor(14) === "C");

let failed = 0;
for (const r of results) {
    console.log(`[${r.ok ? "OK" : "NG"}] ${r.name}${r.ok || !r.detail ? "" : "  (" + r.detail + ")"}`);
    if (!r.ok) failed++;
}
console.log(`結果: ${results.length - failed}/${results.length} 合格`);
process.exit(failed ? 1 : 0);
