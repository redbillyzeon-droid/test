/*
 * day_ui/rules.js：1日の流れの画面の「計算」だけをまとめたもの（画面から切り離した関数）。
 *
 * 正本：
 *   docs/game/design/screens.md（1-3 残りの数え方、2-3 棒、2-4・2-5 印、2-7 欄、3-2 警告、3-4 ヒント、5-2 一覧）
 *   docs/game/design/life-bond.md（1-3〜1-5 好物、2-1・2-2 一緒に建てる、2-3 誘ったときの得意）
 *   docs/game/design/affection.md（2章 A〜E）
 *   docs/game/script/ui_text.md（画面の文。TEXT にそのまま写した。文を変えるときは ui_text.md が先）
 *
 * ブラウザでは window.LIRules、Node では require("./rules.js") で使う。
 * 値はすべて f（TYRANO.kag.stat.f と同じ形のただのオブジェクト）から読む。画面の DOM には触らない。
 */
(function (root) {
    "use strict";

    // ---- 共通の値 ------------------------------------------------------------------------

    // 状態画面の並び順（plan.md の表の順で固定。screens.md 2-2）
    var ORDER = ["noctia", "konoha", "kabane", "hakuren", "ignia"];
    var NAME = { noctia: "ノクティア", konoha: "コノハ", kabane: "カバネ", hakuren: "ハクレン", ignia: "イグニア" };
    var INITIAL = { noctia: "ノ", konoha: "コ", kabane: "カ", hakuren: "ハ", ignia: "イ" };
    var SLOTS = ["morning", "noon", "night"];
    var SLOT_LABEL = { morning: "朝", noon: "昼", night: "夜" };
    var LAST_DAY = 14;

    // 段階の値（段階1〜5）。T[0] は使わない
    var T = [0, 10, 30, 50, 70, 90];

    // 自由行動の時間帯（screens.md 1-3。固定の場面を除いたもの）
    var FREE = {
        2: ["noon", "night"],
        3: ["morning", "noon", "night"],
        4: ["night"],
        5: ["morning", "noon", "night"],
        6: ["morning", "noon", "night"],
        7: ["morning", "noon", "night"],
        8: ["morning", "noon"],
        9: ["morning", "noon", "night"],
        10: ["morning", "noon", "night"],
        11: ["morning", "noon", "night"],
        12: ["morning", "noon"],
    };

    // 会える時間帯（life-bond.md 2-1。雨の日の昼はノクティアも）
    var MEET = {
        morning: ["konoha", "kabane", "hakuren"],
        noon: ["konoha", "kabane", "ignia"],
        night: ["noctia", "kabane", "ignia"],
    };

    // 段階のイベントが起きうる時間帯（screens.md 1-3 の表）
    var EVENT_SLOTS = {
        hakuren: ["morning"],
        noctia: ["night"],
        konoha: ["morning", "noon"],
        ignia: ["noon", "night"],
        kabane: ["morning", "noon", "night"],
    };

    // 好物（life-bond.md 1-1・1-6）。イグニアは生の魚（f.item_fish）を1匹使う
    var GIFT = {
        noctia: { have: "gift_red_fruit", gave: "gave_red_fruit", label: "赤い果実" },
        kabane: { have: "gift_rainbow_shell", gave: "gave_rainbow_shell", label: "虹色の貝殻" },
        hakuren: { have: "gift_white_flower", gave: "gave_white_flower", label: "山頂の白い花" },
        konoha: { have: "gift_fried_tofu", gave: "gave_fried_tofu", label: "油揚げ" },
        ignia: { have: "item_fish", gave: "gave_fish", label: "焼き魚" },
    };

    // 誘ったときの得意な素材（life-bond.md 2-3）
    var SPECIALTY = {
        kabane: { item: "item_wood", n: 3, label: "木材" },
        hakuren: { item: "item_wood", n: 2, label: "木材" },
        konoha: { item: "item_fish", n: 2, label: "魚" },
        ignia: { item: "item_clay", n: 3, label: "粘土" },
        noctia: { item: "item_herb", n: 2, label: "薬草" },
    };

    // 素材の名前（f.item_*。explore_cards.md の変数表）
    var ITEM_LABEL = {
        item_wood: "木材", item_stone: "石材", item_clay: "粘土", item_fish: "魚", item_shell: "貝殻",
        item_fruit: "果実", item_herb: "薬草", item_water: "水", item_ore: "鉱石", item_mushroom: "きのこ",
        item_scale: "竜のうろこ", item_food: "食料", item_medicine: "薬", item_soy_seed: "大豆の種", item_soy: "大豆",
        gift_red_fruit: "赤い果実", gift_rainbow_shell: "虹色の貝殻", gift_white_flower: "山頂の白い花", gift_fried_tofu: "油揚げ",
    };

    // 施設（system.md「島づくり」、life-bond.md 2-2 のゆかりの人）
    var FACILITIES = [
        { id: "workbench", label: "作業台", cost: { item_wood: 3 }, yukari: "kabane" },
        { id: "stove", label: "かまど", cost: { item_clay: 3 }, yukari: "ignia" },
        { id: "field", label: "畑", cost: { item_wood: 3 }, yukari: "konoha" },
        { id: "house", label: "家", cost: { item_wood: 10, item_stone: 5 }, yukari: "noctia" },
        { id: "tower", label: "見張り台", cost: { item_wood: 8, item_stone: 5 }, yukari: "hakuren" },
        { id: "dock", label: "船着き場", cost: { item_wood: 12, item_stone: 8 }, yukari: "kabane" },
    ];
    // 道具。素材の数は system.md に無い（life-bond.md 8章「決めていないこと」）。試作の仮の値
    var TOOLS = [
        { id: "torch", label: "松明", cost: { item_wood: 1 }, needs: "workbench" },
        { id: "ladder", label: "縄ばしご", cost: { item_wood: 2 }, needs: "workbench" },
    ];
    // 嵐で壊れた作業台を直す（life-bond.md 6-4 の例「作業台を直す（木材2）」）
    var REPAIR_COST = { item_wood: 2 };

    // 探索のエリア（screens.md 5-3、menu-ui.md 4章の札の位置）
    var AREAS = [
        { id: "summit", label: "山頂", x: 560, y: 120, firstSure: true, battle: true, meet: { hakuren: ["morning"] }, mats: ["白い花", "食料"] },
        { id: "cave", label: "洞窟", x: 150, y: 260, firstSure: true, battle: true, meet: { noctia: ["night"] }, mats: ["鉱石", "きのこ"] },
        { id: "forest", label: "森", x: 380, y: 340, firstSure: true, battle: true, meet: { kabane: ["morning", "noon"], konoha: ["morning", "noon"] }, mats: ["木材", "果実", "薬草"] },
        { id: "river", label: "川", x: 780, y: 300, firstSure: false, battle: false, meet: { kabane: ["morning", "noon"] }, mats: ["水", "魚", "粘土"] },
        { id: "rock", label: "岩場", x: 1000, y: 420, firstSure: false, battle: true, meet: { ignia: ["noon", "night"] }, mats: ["石材", "竜のうろこ"] },
        { id: "beach", label: "浜辺", x: 480, y: 540, firstSure: true, battle: false, meet: { konoha: ["morning", "noon"] }, mats: ["魚", "木材", "貝殻"] },
        { id: "ship", label: "沈没船", x: 740, y: 500, firstSure: true, battle: true, meet: {}, mats: ["前の世界の道具", "手がかり"] },
    ];

    // ---- 画面の文（正本は docs/game/script/ui_text.md。ここは写し） ------------------------------
    var TEXT = {
        stage: ["出会ったばかり", "打ち解けた", "一緒に過ごすようになった", "失ったものを打ち明けてくれた",
            "心が通った（決戦の相棒になれる）", "想いが通じた"],
        canMeetNow: "いま会える",
        noctiaRain: "雨の日は昼も（イベントは夜だけ）",
        stage5From9Small: "段階5は9日目から",
        stage5From9Tag: "9日目から",
        allTitle: "全員と心を通わせるまで",
        allDone: "全員と心が通った",
        prospectK4: "もう寄り道はできない",
        prospectK3: "間に合わない見込み",
        tight: {
            1: "ハクレン（朝だけ）：あと{n}回／朝の残り{R}回",
            2: "ノクティア（夜だけ）：あと{n}回／夜の残り{R}回",
            3: "ハクレンとコノハ（朝・昼）：あと{n}回／朝と昼の残り{R}回",
            4: "ノクティアとイグニア（昼・夜）：あと{n}回／昼と夜の残り{R}回",
            5: "ハクレンとノクティア（朝・夜）：あと{n}回／朝と夜の残り{R}回",
            6: "5人あわせて：あと{n}回／残り{R}回",
        },
        line: {
            K1: "もう誰とも心を通わせられない。相棒は迷ったままになる",
            K2: "まだ誰とも心が通っていない。{name}に二人きりで会おう",
            K2noname: "まだ誰とも心が通っていない。二人きりで会いに行こう",
            H9: "心が通った人と、もっと深い時間を過ごせるようになった",
        },
        summaryWarn: {
            K1: ["もう、決戦までに誰とも心を通わせられない。", "このままでは、決戦の相棒は迷ったまま、幻に負ける。", "やり直すなら、手動セーブか、今朝の自動セーブから。"],
            K2: ["まだ、誰とも心が通っていない。", "決戦の相棒になれるのは、心が通った人だけ。", "会える時間帯に、二人きりで会いに行こう。{name}なら、急げばまだ間に合うかもしれない。"],
            K3: ["5人全員と心を通わせるのは、もう間に合わない見込み。", "一人でも心が通えば、その人が決戦の相棒になれる。"],
            K4: ["全員と心を通わせるなら、もう寄り道はできない。"],
        },
        k4row: {
            1: "朝の残り{R}回は、全部{who}と過ごす",
            2: "夜の残り{R}回は、全部{who}と過ごす",
            3: "朝と昼の残り{R}回は、全部{who}と過ごす",
            4: "昼と夜の残り{R}回は、全部{who}と過ごす",
            5: "朝と夜の残り{R}回は、全部{who}と過ごす",
            6: "残り{R}回は、全部まだ心が通っていない人と過ごす",
        },
        hint: {
            1: "体力が少ない。「休む」で回復できる",
            2: "壊れたものは「建てる・作る」で直せる",
            3: "松明を作ると、洞窟に行ける",
            4: "心が通った人と、もっと深い時間を過ごせるようになった",
            5: "森をあと{n}回探索すると、岩場に行ける",
            6: "施設を建てると、決戦でみんなが支えてくれる",
            7: "{name}と二人きりで過ごすと、何か起きそう",
            "7hakuren": "ハクレンと過ごすか稽古すると、何か起きそう",
            "7gift": "{name}に好物を渡して過ごすと、何か起きそう",
            8: "{name}の好物を持っている。二人きりのときに渡せる",
            9: "まだ行っていない場所には、何かあるかもしれない",
            10: "気になる人に、会いに行こう",
        },
        small: {
            exploreInvite: "イベントは「過ごす」で",
            rainNoon: "雨の昼はイベントなし",
            eventHere: "イベントあり",
            noonTrain: "昼は鍛えられない",
            restHint: "休むと回復",
            broken: "壊れている（発展度に数えない）",
            devNote: "発展度が高いほど、決戦でみんなが支えてくれる",
            train: "稽古 {n}回（守るが強くなる）",
            giftOf: "{name}の好物",
            gaveTo: "{name}に渡した",
            short: "{item} あと{n}",
        },
        gift: { button: "好物を渡して過ごす", sub: "{gift}を渡す（1回だけ）", marked: "好物でイベントあり", card: "+10（好物）",
            legend: "好物の印：好物を渡して二人きりで過ごすと、何かが起きる" },
        build: {
            title: "誰と建てる？", titleRepair: "誰と直す？",
            note: "2人まで手伝ってもらえる。一緒に建てると、仲が深まる", noteRepair: "2人まで手伝ってもらえる。一緒に直すと、仲が深まる",
            yukari: "ゆかり", ok: "建てる", okRepair: "直す", alone: "一人で建てる", aloneRepair: "一人で直す",
        },
        map: { first: "初めて", specialty: "得意：{item}" },
        mindUp: "ユウの心が、少し強くなった",
        save: {
            slotA: "自動：毎朝（{day}日目・朝）", slotB: "自動：13日目の朝", slotC: "自動：14日目・決戦の前",
            busy: "画面を閉じてから、セーブしてください",
            battle: "戦闘中は、セーブできません",
            day14: "14日目はセーブできません。決戦の前の自動セーブから、やり直せます",
        },
    };

    function fmt(s, v) {
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; });
    }
    function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
    function ev(f, name) { return num(f["ev_" + name]); }
    function aff(f, name) { return num(f["aff_" + name]); }

    // ---- 1-3 残りの自由行動 -------------------------------------------------------------------

    // day の slot から後（slot を含む）の、朝・昼・夜それぞれの残り。slot を省くと、その日の朝の前の残り
    function remaining(day, slot) {
        var r = { morning: 0, noon: 0, night: 0 };
        var start = slot ? SLOTS.indexOf(slot) : 0;
        for (var d = day; d <= 12; d++) {
            var list = FREE[d] || [];
            for (var i = 0; i < list.length; i++) {
                if (d > day || SLOTS.indexOf(list[i]) >= start) r[list[i]]++;
            }
        }
        r.total = r.morning + r.noon + r.night;
        return r;
    }

    function isFreeSlot(day, slot) { return (FREE[day] || []).indexOf(slot) >= 0; }
    function firstFreeSlot(day) { return (FREE[day] || [])[0] || null; }
    function nextFreeSlot(day, slot) {
        var list = FREE[day] || [];
        var i = SLOTS.indexOf(slot);
        for (var k = 0; k < list.length; k++) if (SLOTS.indexOf(list[k]) > i) return list[k];
        return null;
    }

    // その人に関わる時間帯の残り R(名前)
    function rOf(name, R) {
        var r = 0;
        EVENT_SLOTS[name].forEach(function (s) { r += R[s]; });
        return r;
    }

    // n(名前) ＝ 4 − f.ev（4以上なら0）
    function nOf(s) { return Math.max(0, 4 - num(s)); }

    // ---- 2-3 棒 ---------------------------------------------------------------------------------

    function bar(affVal, s) {
        s = num(s);
        if (s >= 5) return null; // 段階5：棒は出さない
        var goal = T[s + 1] - 5;
        var base = s === 0 ? 0 : T[s];
        var ratio = (num(affVal) - base) / (goal - base);
        if (ratio < 0) ratio = 0;
        if (ratio > 1) ratio = 1;
        var cells = Math.floor(ratio * 10 + 1e-9);
        return { goal: goal, base: base, cells: cells, full: num(affVal) >= goal };
    }

    // ---- 2-4・2-5 印 ---------------------------------------------------------------------------

    function canMeet(name, slot, weather) {
        if (name === "noctia" && slot === "noon" && weather === "雨") return true;
        return (MEET[slot] || []).indexOf(name) >= 0;
    }
    function meetList(slot, weather) {
        return ORDER.filter(function (n) { return canMeet(n, slot, weather); });
    }
    // その時間帯に、その人の段階のイベントが起きうるか（雨の昼のノクティアは起きない）
    function eventPossibleIn(name, slot) { return EVENT_SLOTS[name].indexOf(slot) >= 0; }

    function hasGift(f, name) {
        var g = GIFT[name];
        return num(f[g.have]) >= 1 && !num(f[g.gave]);
    }

    // 状態画面用の印。"heart"（次に二人きりで過ごすとイベント）、"gift"（好物つき）、"day9"（9日目からの札）、null
    function markStatus(f, name) {
        var s = ev(f, name);
        if (s >= 5) return null;
        var b = bar(aff(f, name), s);
        var nextOk = (s + 1 < 5) || num(f.day) >= 9;
        if (b.full) return nextOk ? "heart" : "day9";
        if (nextOk && hasGift(f, name) && aff(f, name) + 10 >= b.goal) return "gift";
        return null;
    }
    // いまの時間帯用の印（会えて、その時間帯にイベントが起きうるときだけ）
    function markNow(f, name) {
        var slot = f.slot, weather = f.weather;
        if (!canMeet(name, slot, weather) || !eventPossibleIn(name, slot)) return null;
        var m = markStatus(f, name);
        return m === "day9" ? null : m;
    }

    // ---- 3-2 警告 -------------------------------------------------------------------------------

    // 6つの式。lhs ＝ 左辺、rhs ＝ 右辺、rem ＝ 余り
    function formulas(f, R) {
        var n = {};
        ORDER.forEach(function (k) { n[k] = nOf(ev(f, k)); });
        var sum = ORDER.reduce(function (a, k) { return a + n[k]; }, 0);
        var list = [
            { id: 1, who: ["hakuren"], lhs: n.hakuren, rhs: R.morning },
            { id: 2, who: ["noctia"], lhs: n.noctia, rhs: R.night },
            { id: 3, who: ["hakuren", "konoha"], lhs: n.hakuren + n.konoha, rhs: R.morning + R.noon },
            { id: 4, who: ["noctia", "ignia"], lhs: n.noctia + n.ignia, rhs: R.noon + R.night },
            { id: 5, who: ["hakuren", "noctia"], lhs: n.hakuren + n.noctia, rhs: R.morning + R.night },
            { id: 6, who: ORDER.slice(), lhs: sum, rhs: R.total },
        ];
        list.forEach(function (e) { e.rem = e.rhs - e.lhs; e.active = e.lhs > 0; });
        return { list: list, n: n, sum: sum };
    }

    // K1〜K4 の判定。dayForK2 は K2 の「f.day ≥ 10」に使う日（まとめでは次の日）
    function judge(f, R, dayForK2) {
        var F = formulas(f, R);
        var c4 = ORDER.filter(function (k) { return ev(f, k) >= 4; }).length;
        var B = -Infinity, bName = null;
        ORDER.forEach(function (k) {
            var v = rOf(k, R) - F.n[k];
            if (v > B) { B = v; bName = k; } // 同じ値なら、並び順で先の人
        });
        var allLow = ORDER.every(function (k) { return ev(f, k) <= 2; });
        var active = F.list.filter(function (e) { return e.active; });
        var K3 = active.some(function (e) { return e.rem < 0; });
        var K4 = !K3 && active.some(function (e) { return e.rem === 0; });
        return {
            c4: c4, B: B, bName: bName, formulas: F.list, n: F.n, sum: F.sum,
            K1: c4 === 0 && B < 0,
            K2: c4 === 0 && B >= 0 && (B <= 1 || (num(dayForK2) >= 10 && allLow)),
            K3: K3, K4: K4,
            tight: active.filter(function (e) { return e.rem <= 1; }),
            zero: active.filter(function (e) { return e.rem === 0; }),
            allDone: c4 === ORDER.length,
        };
    }

    // 行動を選ぶ画面を出すとき（いまの時間帯を含めた R）
    function judgeNow(f) { return judge(f, remaining(num(f.day), f.slot), num(f.day)); }
    // 1日のまとめ（次の日の朝の前の R。12日目は13日目の行で全部0）
    function judgeSummary(f) { return judge(f, remaining(num(f.day) + 1), num(f.day) + 1); }

    function whoText(names, n) {
        var left = names.filter(function (k) { return n[k] > 0; }).map(function (k) { return NAME[k]; });
        return left.join("か");
    }

    // 状態画面の残り。1日のまとめから開いたとき（atSummary）は、まとめと同じ時点（次の日の朝の前）で数える。
    // いまの時間帯で数えると、使い終わった時間帯が残りに入り、まとめの警告と食い違う
    function statusRemaining(f, atSummary) {
        return atSummary ? remaining(num(f.day) + 1) : remaining(num(f.day), f.slot);
    }

    // 状態画面の「全員と心を通わせるまで」の欄（2-7）
    function allPanel(f, atSummary) {
        var R = statusRemaining(f, atSummary);
        var J = judge(f, R, num(f.day) + (atSummary ? 1 : 0));
        if (J.allDone) return { done: true, text: TEXT.allDone };
        return {
            done: false,
            sum: J.sum,
            R: R.total,
            prospect: J.K3 ? "K3" : J.K4 ? "K4" : null,
            prospectText: J.K3 ? TEXT.prospectK3 : J.K4 ? TEXT.prospectK4 : "",
            tight: J.tight.map(function (e) { return fmt(TEXT.tight[e.id], { n: e.lhs, R: e.rhs }); }),
        };
    }

    // 1日のまとめの警告（3-2、ui_text.md 3-2）。K3 は f.warn_all_lost で1回だけ（ここでは f を変えない）
    function summaryWarnings(f) {
        var J = judgeSummary(f);
        var out = [];
        if (J.K1) out.push({ kind: "K1", lines: TEXT.summaryWarn.K1.slice() });
        else if (J.K2) out.push({ kind: "K2", lines: TEXT.summaryWarn.K2.map(function (l) { return fmt(l, { name: NAME[J.bName] }); }) });
        if (J.K3 && !num(f.warn_all_lost)) out.push({ kind: "K3", lines: TEXT.summaryWarn.K3.slice() });
        if (J.K4) {
            var lines = TEXT.summaryWarn.K4.slice();
            J.zero.slice(0, 2).forEach(function (e) {
                lines.push(fmt(TEXT.k4row[e.id], { R: e.rhs, who: whoText(e.who, J.n) }));
            });
            out.push({ kind: "K4", lines: lines });
        }
        return { list: out, judge: J };
    }

    // ---- 3-1・3-4 「次にやること」の1行 ---------------------------------------------------------

    function areaOpen(f, id) {
        switch (id) {
            case "beach": case "forest": case "river": return true;
            case "cave": return !!num(f.tool_torch);
            case "rock": return num(f.explore_forest) >= 3;
            case "summit": return !!num(f.tool_ladder);
            case "ship": return !!num(f.shipwreck_hint) && !!num(f.built_dock);
        }
        return false;
    }
    function areaLockText(f, id) {
        switch (id) {
            case "cave": return "松明を作ると行ける";
            case "rock": return "森をあと" + (3 - num(f.explore_forest)) + "回探索すると行ける";
            case "summit": return "縄ばしごを作ると行ける";
            case "ship": return "船着き場を建てると行ける";
        }
        return "";
    }
    function visited(f, id) {
        if (id === "forest") return num(f.explore_forest) > 0;
        return !!num(f["visit_" + id]);
    }
    function areaFirst(f, id) { return areaOpen(f, id) && !visited(f, id); }
    function areaHidden(f, id) { return id === "ship" && !num(f.shipwreck_hint); }

    // ふつうのヒント（3-4）。{no, text}
    function normalHint(f) {
        var day = num(f.day);
        if (num(f.hp) <= 3) return { no: 1, text: TEXT.hint[1] };
        if (num(f.workbench_broken) === 1) return { no: 2, text: TEXT.hint[2] };
        if (day >= 4 && !num(f.tool_torch)) return { no: 3, text: TEXT.hint[3] };
        if (day === 9 && f.slot === "morning" && !num(f.hint_day9_shown) && ORDER.some(function (k) { return ev(f, k) === 4; }))
            return { no: 4, text: TEXT.hint[4], h9: true };
        var fc = num(f.explore_forest);
        if (fc >= 1 && fc <= 2) return { no: 5, text: fmt(TEXT.hint[5], { n: 3 - fc }) };
        if (num(f.dev) <= 2 && day >= 7) return { no: 6, text: TEXT.hint[6] };
        for (var i = 0; i < ORDER.length; i++) {
            var k = ORDER[i], m = markNow(f, k);
            if (m === "heart") return { no: 7, text: (k === "hakuren" && f.slot === "morning") ? TEXT.hint["7hakuren"] : fmt(TEXT.hint[7], { name: NAME[k] }) };
            if (m === "gift") return { no: 7, text: fmt(TEXT.hint["7gift"], { name: NAME[k] }) };
        }
        for (var j = 0; j < ORDER.length; j++) {
            var h = ORDER[j];
            if (canMeet(h, f.slot, f.weather) && hasGift(f, h)) return { no: 8, text: fmt(TEXT.hint[8], { name: NAME[h] }) };
        }
        if (AREAS.some(function (a) { return areaFirst(f, a.id); })) return { no: 9, text: TEXT.hint[9] };
        return { no: 10, text: TEXT.hint[10] };
    }

    // 行動を選ぶ画面の1行（3-1）。script は台本の【次にやること】（なければ空）
    function nextLine(f, script) {
        var J = judgeNow(f);
        var K = null;
        if (J.K1) K = { kind: "K1", text: TEXT.line.K1 };
        else if (J.K2) K = { kind: "K2", text: J.bName ? fmt(TEXT.line.K2, { name: NAME[J.bName] }) : TEXT.line.K2noname };
        if (script && num(f.day) === 2) return { kind: "script", text: script };
        if (K) return K;
        if (script) return { kind: "script", text: script };
        var h = normalHint(f);
        return { kind: h.h9 ? "H9" : "hint", text: h.text, no: h.no };
    }

    // ---- 行動の結果（試作のための最小の計算） -----------------------------------------------------
    //
    // 段階の判定は affection.md 2章 A・B と life-bond.md 1-4。イベントの中の選択の値と日常の会話の値は
    // 台本ごとに違うので、試作では life-bond.md 6-1 の値（段階1 +4、段階2 +5、段階3 +6（ノクティア +5）、
    // 段階4 +8）と、会話は最小の +5 を仮に使う。段階5の選択の値は書かれていないので、仮に +8。
    var CHOICE = { 1: 4, 2: 5, 3: 6, 4: 8, 5: 8 };
    function choiceValue(name, stage) { return (name === "noctia" && stage === 3) ? 5 : CHOICE[stage]; }

    // 「過ごす」（二人きり）で段階のイベントが起きるか。withGift なら判定に +10
    function eventWouldHappen(f, name, withGift) {
        var s = ev(f, name);
        if (s >= 5) return false;
        if (!eventPossibleIn(name, f.slot)) return false; // 雨の昼のノクティアなど
        if (s + 1 === 5 && num(f.day) < 9) return false;
        return aff(f, name) + 5 + (withGift ? 10 : 0) >= T[s + 1];
    }

    function addAff(f, name, d) { f["aff_" + name] = aff(f, name) + d; }

    // 二人きりで過ごす。結果のカードの行を返す
    function applySpend(f, name, withGift) {
        var lines = [];
        var gave = withGift && hasGift(f, name);
        var happen = eventWouldHappen(f, name, gave);
        var res = { name: name, event: happen, stage: null, gift: gave, delta: 0, lines: lines, mindUp: false };
        if (gave) {
            var g = GIFT[name];
            f[g.gave] = 1;
            f[g.have] = Math.max(0, num(f[g.have]) - 1);
        }
        if (happen) {
            var st = ev(f, name) + 1;
            f["ev_" + name] = st;
            var d = 5 + (st <= 3 ? 8 : 0) + choiceValue(name, st);
            res.stage = st;
            res.delta = d;
            lines.push("+5（会えた分）");
            if (st <= 3) lines.push("+8（心が近づいた）");
            lines.push("+" + choiceValue(name, st) + "（イベントの選択。試作の仮の値）");
            if (st >= 3) { f.mind = num(f.mind) + 1; res.mindUp = true; }
        } else {
            res.delta = 5;
            lines.push("+5（日常の会話。試作の仮の値）");
        }
        if (gave) { res.delta += 10; lines.push(TEXT.gift.card); }
        addAff(f, name, res.delta);
        return res;
    }

    // みんなと過ごす（affection.md C）
    function applyAll(f) {
        var who = meetList(f.slot, f.weather);
        var d = num(f.built_stove) ? 4 : 3;
        who.forEach(function (k) { addAff(f, k, d); });
        return { who: who, delta: d };
    }

    // 鍛える（affection.md E）。朝：ハクレンと稽古（段階のイベントも起きる）、夜：ノクティアと薬の勉強
    function applyTrain(f) {
        if (f.slot === "morning") {
            var r;
            if (eventWouldHappen(f, "hakuren", false)) r = applySpend(f, "hakuren", false);
            else { addAff(f, "hakuren", 3); r = { name: "hakuren", event: false, delta: 3, lines: ["+3（稽古）"] }; }
            f.str = Math.min(10, num(f.str) + 1);
            f.train_count = num(f.train_count) + 1;
            r.kind = "train";
            return r;
        }
        if (f.slot === "night") {
            addAff(f, "noctia", 3);
            f.wis = Math.min(6, num(f.wis) + 1);
            return { name: "noctia", event: false, delta: 3, lines: ["+3（薬の勉強）"], kind: "study" };
        }
        return null;
    }

    // 休む（回復量は決まっていない。試作の仮の値 +3）
    function applyRest(f) {
        var before = num(f.hp);
        f.hp = Math.min(10, before + 3);
        return { hp: f.hp, delta: f.hp - before };
    }

    // ---- 建てる（life-bond.md 2-1） ---------------------------------------------------------------

    function devOf(f) {
        var d = 0;
        FACILITIES.forEach(function (fa) {
            if (!num(f["built_" + fa.id])) return;
            if (fa.id === "workbench" && num(f.workbench_broken)) return;
            d++;
        });
        return d;
    }
    function shortage(f, cost) {
        var out = [];
        Object.keys(cost).forEach(function (k) {
            var lack = cost[k] - num(f[k]);
            if (lack > 0) out.push({ item: k, label: ITEM_LABEL[k] || k, n: lack });
        });
        return out;
    }
    function payCost(f, cost) { Object.keys(cost).forEach(function (k) { f[k] = num(f[k]) - cost[k]; }); }

    // 建てる一覧（まだ建てていない施設、作れる道具、直す）
    function buildList(f) {
        var rows = [];
        if (num(f.built_workbench) && num(f.workbench_broken)) {
            rows.push({ kind: "repair", id: "workbench", label: "作業台を直す", cost: REPAIR_COST, short: shortage(f, REPAIR_COST) });
        }
        FACILITIES.forEach(function (fa) {
            if (num(f["built_" + fa.id])) return;
            rows.push({ kind: "facility", id: fa.id, label: fa.label, cost: fa.cost, yukari: fa.yukari, short: shortage(f, fa.cost) });
        });
        TOOLS.forEach(function (t) {
            if (num(f["tool_" + t.id])) return;
            var needBench = !num(f.built_workbench) || num(f.workbench_broken);
            rows.push({ kind: "tool", id: t.id, label: t.label, cost: t.cost, short: shortage(f, t.cost), needBench: needBench });
        });
        rows.forEach(function (r) { r.ok = r.short.length === 0 && !r.needBench; });
        return rows;
    }

    // 「誰と建てる？」の最初の選び方。ゆかりの人（会えるとき）と、もう1人。
    // もう1人は、会える人のうち段階がいちばん低い人（同じなら並び順で先）。試作で決めた選び方。
    // 2日目の作業台は、カバネを外せない（locked）
    function buildHelpersDefault(f, kind, id) {
        var can = meetList(f.slot, f.weather);
        var fa = FACILITIES.filter(function (x) { return x.id === id; })[0];
        var yukari = kind === "facility" && fa ? fa.yukari : null;
        // 試作で決めた解釈：ゆかりの人がその時間帯にいない施設と「直す」でも、最初から2人を選んでおく
        // （menu-ui.md 2-2 の「ゆかりの人ともう1人」を「2人まで埋める」と読んだ。0人・1人にしたいときは顔を押して外す）
        var sel = [];
        if (yukari && can.indexOf(yukari) >= 0) sel.push(yukari);
        var rest = can.filter(function (k) { return sel.indexOf(k) < 0; })
            .sort(function (a, b) { return ev(f, a) - ev(f, b) || ORDER.indexOf(a) - ORDER.indexOf(b); });
        while (sel.length < 2 && rest.length) sel.push(rest.shift());
        var locked = (kind === "facility" && id === "workbench" && num(f.day) === 2) ? ["kabane"] : [];
        locked.forEach(function (k) { if (sel.indexOf(k) < 0 && can.indexOf(k) >= 0) sel[sel.length >= 2 ? 1 : sel.length] = k; });
        return { candidates: can, selected: sel, yukari: kind === "facility" ? yukari : null, locked: locked };
    }

    // 建てる・直す・作る
    function applyBuild(f, kind, id, helpers) {
        helpers = (helpers || []).slice(0, 2);
        var res = { kind: kind, id: id, helpers: [], devBefore: devOf(f), lines: [] };
        if (kind === "tool") {
            var t = TOOLS.filter(function (x) { return x.id === id; })[0];
            payCost(f, t.cost);
            f["tool_" + id] = 1;
            f.dex = Math.min(6, num(f.dex) + 1);
            res.label = t.label + "を作った";
            res.lines.push("器用さ +1");
            res.devAfter = devOf(f);
            return res;
        }
        if (kind === "repair") {
            payCost(f, REPAIR_COST);
            f.workbench_broken = 0;
            res.label = "作業台を直した";
        } else {
            var fa = FACILITIES.filter(function (x) { return x.id === id; })[0];
            payCost(f, fa.cost);
            f["built_" + id] = 1;
            res.label = fa.label + "を建てた";
            res.yukari = fa.yukari;
        }
        helpers.forEach(function (k) {
            var d = (kind === "facility" && k === res.yukari) ? 5 : 3;
            addAff(f, k, d);
            res.helpers.push({ name: k, delta: d });
            if (k === "kabane") { f.str = Math.min(10, num(f.str) + 1); res.strUp = true; }
        });
        f.dev = devOf(f);
        res.devAfter = f.dev;
        return res;
    }

    // ---- 探索（試作では、マップとエリアの「初めて」まで。結果は最小限） ---------------------------------

    function giftBlocked(f, giftKey) {
        switch (giftKey) {
            case "gift_rainbow_shell": return num(f.gift_rainbow_shell) || num(f.gave_rainbow_shell);
            case "gift_red_fruit": return num(f.gift_red_fruit) || num(f.gave_red_fruit);
            case "gift_white_flower": return num(f.gift_white_flower) || num(f.gave_white_flower);
            case "item_soy_seed": return num(f.item_soy_seed) || num(f.item_soy) || num(f.gift_fried_tofu) || num(f.soy_plant_day) || num(f.gave_fried_tofu);
        }
        return 0;
    }
    function applyExplore(f, areaId, partner) {
        var res = { area: areaId, partner: partner || null, lines: [], first: areaFirst(f, areaId) };
        f.explore_partner = partner || ""; // 誘った相手（life-bond.md 9-3 #4、ui_text.md の変数表）。一人のときは空
        var first = res.first;
        if (areaId === "forest") f.explore_forest = num(f.explore_forest) + 1;
        else f["visit_" + areaId] = 1;
        var rare = null;
        if (areaId === "beach" && first) rare = "gift_rainbow_shell";
        if (areaId === "forest" && num(f.explore_forest) === 1) rare = "gift_red_fruit";
        if (areaId === "forest" && num(f.explore_forest) === 2) rare = "item_soy_seed";
        if (areaId === "summit" && first) rare = "gift_white_flower";
        if (areaId === "cave" && first) rare = "clue_tally_marks";
        if (areaId === "ship" && first) rare = "clue_old_diary";
        if (rare && !giftBlocked(f, rare)) {
            f[rare] = num(f[rare]) + (rare.indexOf("clue_") === 0 ? 0 : 1);
            if (rare.indexOf("clue_") === 0) f[rare] = 1;
            res.rare = rare;
            res.lines.push((ITEM_LABEL[rare] || (rare === "clue_tally_marks" ? "壁の線（手がかり）" : "日記（手がかり）")) + " を見つけた");
        }
        if (partner) {
            addAff(f, partner, 3);
            var sp = SPECIALTY[partner];
            f[sp.item] = num(f[sp.item]) + sp.n;
            res.lines.push(NAME[partner] + " +3");
            res.lines.push("得意：" + sp.label + " ×" + sp.n);
        }
        res.lines.push("（試作：いつもの結果・出会い・戦闘はまだ入れていない）");
        return res;
    }

    // ---- 1日のまとめ：朝の記録との差（5-5） -----------------------------------------------------------

    var TRACK_ITEMS = Object.keys(ITEM_LABEL);
    function snapshot(f) {
        var s = { aff: {}, ev: {}, items: {}, built: {}, tools: {}, str: num(f.str), dex: num(f.dex), wis: num(f.wis), hp: num(f.hp),
            train_count: num(f.train_count), dev: devOf(f) };
        ORDER.forEach(function (k) { s.aff[k] = aff(f, k); s.ev[k] = ev(f, k); });
        TRACK_ITEMS.forEach(function (k) { s.items[k] = num(f[k]); });
        FACILITIES.forEach(function (fa) { s.built[fa.id] = num(f["built_" + fa.id]); });
        TOOLS.forEach(function (t) { s.tools[t.id] = num(f["tool_" + t.id]); });
        s.broken = num(f.workbench_broken);
        return s;
    }

    function summary(f) {
        var s0 = f.day_start || snapshot(f);
        var day = num(f.day);
        var got = [];
        TRACK_ITEMS.forEach(function (k) {
            var d = num(f[k]) - num(s0.items[k]);
            if (d > 0) got.push({ item: k, label: ITEM_LABEL[k], n: d });
        });
        var built = [];
        FACILITIES.forEach(function (fa) { if (num(f["built_" + fa.id]) && !num(s0.built[fa.id])) built.push(fa.label); });
        if (s0.broken && !num(f.workbench_broken)) built.push("作業台（直した）");
        TOOLS.forEach(function (t) { if (num(f["tool_" + t.id]) && !num(s0.tools[t.id])) built.push(t.label); });
        var devNow = devOf(f);
        var yu = [];
        [["str", "力"], ["dex", "器用さ"], ["wis", "知恵"]].forEach(function (p) {
            var d = num(f[p[0]]) - num(s0[p[0]]);
            if (d > 0) yu.push(p[1] + " +" + d);
        });
        var tc = num(f.train_count) - num(s0.train_count);
        if (tc > 0) yu.push("稽古 +" + tc);
        var mates = [];
        ORDER.forEach(function (k) {
            var dAff = aff(f, k) - num(s0.aff[k]);
            var up = ev(f, k) > num(s0.ev[k]);
            if (dAff > 0 || up) {
                var b = bar(aff(f, k), ev(f, k));
                var b0 = bar(num(s0.aff[k]), num(s0.ev[k]));
                mates.push({ name: k, label: NAME[k], cells: b ? b.cells : null, cellsBefore: (b0 && !up) ? b0.cells : 0,
                    full: b ? b.full : false, stageUp: up, stage: ev(f, k), stageText: up ? TEXT.stage[ev(f, k)] : "" });
            }
        });
        var Rn = remaining(day + 1);
        var W = summaryWarnings(f);
        return {
            title: day + "日目が終わった",
            got: got, built: built, devBefore: num(s0.dev), devAfter: devNow,
            yu: yu, hp: num(f.hp), mates: mates,
            left: Math.max(0, LAST_DAY - day),
            R: Rn, warnings: W.list, judge: W.judge,
        };
    }

    // ---- 自動セーブの枠（screens.md 4-1） --------------------------------------------------------------
    // 2〜12日目の朝は A、13日目の朝は B、14日目・夜明け前は C
    function autosaveSlotFor(day) {
        day = num(day);
        if (day >= 2 && day <= 12) return "A";
        if (day === 13) return "B";
        if (day === 14) return "C";
        return null;
    }

    // 足りない値を0で埋める（試作のテスト用の f を作るとき）
    function defaults(f) {
        var base = { day: 2, slot: "noon", weather: "晴れ", hp: 10, str: 1, dex: 1, wis: 1, mind: 2, train_count: 0, dev: 0,
            workbench_broken: 0, explore_forest: 0, warn_all_lost: 0, hint_day9_shown: 0 };
        Object.keys(base).forEach(function (k) { if (f[k] == null || f[k] === "") f[k] = base[k]; });
        ORDER.forEach(function (k) {
            if (f["aff_" + k] == null) f["aff_" + k] = 0;
            if (f["ev_" + k] == null) f["ev_" + k] = 0;
        });
        return f;
    }

    var API = {
        ORDER: ORDER, NAME: NAME, INITIAL: INITIAL, SLOTS: SLOTS, SLOT_LABEL: SLOT_LABEL, T: T, FREE: FREE, MEET: MEET,
        EVENT_SLOTS: EVENT_SLOTS, GIFT: GIFT, SPECIALTY: SPECIALTY, ITEM_LABEL: ITEM_LABEL, FACILITIES: FACILITIES, TOOLS: TOOLS,
        AREAS: AREAS, TEXT: TEXT, LAST_DAY: LAST_DAY,
        fmt: fmt, remaining: remaining, isFreeSlot: isFreeSlot, firstFreeSlot: firstFreeSlot, nextFreeSlot: nextFreeSlot,
        rOf: rOf, nOf: nOf, bar: bar, canMeet: canMeet, meetList: meetList, eventPossibleIn: eventPossibleIn,
        hasGift: hasGift, markStatus: markStatus, markNow: markNow,
        formulas: formulas, judge: judge, judgeNow: judgeNow, judgeSummary: judgeSummary, allPanel: allPanel, statusRemaining: statusRemaining,
        summaryWarnings: summaryWarnings, normalHint: normalHint, nextLine: nextLine,
        areaOpen: areaOpen, areaLockText: areaLockText, areaFirst: areaFirst, areaHidden: areaHidden, visited: visited,
        eventWouldHappen: eventWouldHappen, applySpend: applySpend, applyAll: applyAll, applyTrain: applyTrain, applyRest: applyRest,
        devOf: devOf, shortage: shortage, buildList: buildList, buildHelpersDefault: buildHelpersDefault, applyBuild: applyBuild,
        applyExplore: applyExplore, snapshot: snapshot, summary: summary, autosaveSlotFor: autosaveSlotFor, defaults: defaults,
    };

    if (typeof module !== "undefined" && module.exports) module.exports = API;
    else root.LIRules = API;
})(typeof window !== "undefined" ? window : this);
