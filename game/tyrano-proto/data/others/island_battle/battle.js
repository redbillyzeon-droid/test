/*
 * island_battle: 戦闘画面の試作（ティラノスクリプト用）
 *
 * 数字と計算は docs/game/design/battle.md（2026-10-17 の案）に合わせている。
 * 数字はすべて RULES と ENEMIES にまとめ、設定（cfg.rules、cfg.enemies など）で上書きできる。
 *
 * 使い方（.ks から）:
 *   [loadcss file="./data/others/island_battle/battle.css"]
 *   [loadjs storage="island_battle/battle.js"]
 *   [iscript]
 *   IslandBattle.start({ mode: "explore", enemies: ["boar"], returnStorage: "x.ks", returnTarget: "*after" });
 *   [endscript]
 *   [s]
 *
 * 主な設定（battle.md 7-1）:
 *   mode          "explore"（探索）か "final"（決戦）
 *   phase         決戦のとき "first"（前半）か "finish"（決着）
 *   partner       相棒の名前（noctia / konoha / kabane / hakuren / ignia / all / ""）。
 *                 省略すると、探索は f.explore_partner、決戦は f.partner を使う
 *   party         味方を直接渡すとき（省略すると f の能力値から作る）
 *   enemies       敵。ENEMIES の名前（"boar" など）か、{ name, hp, atk, def, pattern, ... }
 *   bondMax       絆ゲージの大きさ（省略すると 探索3／決戦5）
 *   trainCount, dex, wis, items { herb, medicine }, itemLimit, dev, facilities
 *                 省略すると f.train_count、f.dex、f.wis、f.item_herb、f.item_medicine、f.dev、f.built_* から作る
 *                 （発展度は cfg.dev → f.dev → 建てた施設の数、の順に使う）
 *   interruptAt   決戦の前半：GM の支配の力がこの割合以下で止める（既定 0.5。2人で挑むとき）
 *   interruptHp   決戦の前半：GM の支配の力がこの値以下で止める（全員で挑むときの既定 400。
 *                 全員のとき GM の支配の力は max(600, 1100 − 100 × 発展度)。battle.md 4-2・5-1・7-1、life-bond.md 3章）
 *   resumeState   決着：f.battle_state を渡して、前半の終わりから始める
 *   finisher      決着：絆の大技でとどめを刺す（phase "finish" なら既定で true）
 *   rewards, rareRewards, rareChance, rareAlt
 *                 勝ったときに f に足す数（{ item_food: 3 } のように変数名で書く）
 *                 めずらしい報酬が好物とだぶるとき（RARE_BLOCKS。explore_cards.md 冒頭の表）は出さず、
 *                 rareAlt（省略すると敵の rareAlt、なければ 薬 ×1）に置きかえる（battle.md 4-1）
 *   rules         RULES の一部を上書きする（{ guard: { base: 0.5 } } のように）
 *
 * 書き戻し（battle.md 7-4）:
 *   f.battle_result   "win" / "lose"（探索で負け）/ "interrupt"（決戦の前半の割り込み）/ "wipe"（決戦で全員倒れた）
 *   f.item_*          報酬を足し、使った薬草・薬を引く（"wipe" のときは何も変えない＝罰なし）
 *   f.hp              探索で負けたら −3（0 より下げない）。戦闘の HP は入れない
 *   f.battle_state    決戦の前半の終わりの状態（決着の resumeState に渡す）
 *   f.final_mind_zero 前半の終わりに主人公の戦闘の心が 0 なら 1、そうでなければ 0
 *   f.battle_party    戦闘後の HP と心（探索では使わない）
 *
 * 決戦で全員倒れたとき（plan.md 2026-10-17）:
 *   何も書き戻さずに f.battle_result = "wipe" で wipeStorage / wipeTarget（省略時は return*）へ戻る。
 *   .ks は台本の場面を出し、「もう一度」なら IslandBattle.retry() で同じ段階を最初からやり直す。
 *   「タイトルに戻る」は .ks で分ける。
 * 探索で負けたとき：f.battle_result = "lose" で loseStorage / loseTarget（省略時は return*）へ戻る。
 *
 * 絵の素材がないときは、色つきの図形で代わりに表示する（配置と動きの確認用）。
 */
(function () {
    "use strict";

    // ---- 数字（battle.md の値が既定） ----------------------------------------------------
    var RULES = {
        // 1-1 の初期値（f に値がないときに使う）
        statDefaults: { hp: 10, str: 1, dex: 1, wis: 1, mind: 2, train_count: 0 },
        // 1-2 主人公の戦闘の数値
        hero: { hpBase: 70, hpPer: 5, atkBase: 8, atkPer: 2, defDiv: 3, mindBase: 20, mindPer: 5 },
        finalHp: 10, // 決戦は体力10として計算する
        // 3-2 相棒の能力（s ＝ 段階）
        stageBonus: { hp: 10, atk: 2, defDiv: 2, mind: 5 },
        partners: {
            noctia: {
                name: "ノクティア", color: "#5b3a6e", hp: 80, atk: 12, def: 1, mind: 60,
                skill: { name: "夜の帳", type: "nullify" },
                ult: { name: "紅の契り", type: "single", power: 120, heroCost: 15 },
            },
            konoha: {
                name: "コノハ", color: "#d9822b", hp: 85, atk: 11, def: 1, mind: 50,
                skill: { name: "狐火", type: "multi", hits: 3, min: 5, max: 9 },
                ult: { name: "五尾の狐火", type: "all", perTail: 18 },
            },
            kabane: {
                name: "カバネ", color: "#7a7a6a", hp: 110, atk: 13, def: 2, mind: 40,
                skill: { name: "骨の盾", type: "wall" },
                ult: { name: "本当の姿", type: "all", power: 80, wall: true },
            },
            hakuren: {
                name: "ハクレン", color: "#c9c9d6", hp: 100, atk: 14, def: 2, mind: 40,
                skill: { name: "西方の守り", type: "cover" },
                ult: { name: "白虎の牙", type: "single", power: 150, needHero: true },
            },
            ignia: {
                name: "イグニア", color: "#b5432f", hp: 95, atk: 10, def: 1, mind: 50,
                skill: { name: "小さな火", type: "burn", min: 6, max: 10, burn: 5, burnTurns: 3 },
                ult: { name: "竜の息吹", type: "all", power: 60, powerAwake: 100 },
            },
        },
        partnerOrder: ["noctia", "konoha", "kabane", "hakuren", "ignia"],
        // 2-1 計算
        attackSpread: 3,
        enemySpread: 2,
        skillSpread: 4,   // 種類のない技（試作のまま power ±4）
        minDamage: 1,
        guard: { base: 0.5, perTrain: 0.05, min: 0.25 },
        wallRate: 0.5,    // 骨の盾・本当の姿
        coverRate: 0.5,   // 西方の守り
        skillCost: 10,
        word: { partnerMind: 15, heroMind: 10, bond: 1, bondFinisher: 2 },
        // 2-2 道具
        items: { herbBase: 30, herbPerDex: 3, medicineMind: 20, medicineHp: 20, limit: 3, limitWorkbench: 4 },
        // 2-3 絆ゲージ
        bondMax: { explore: 3, final: 5 },
        bondPerKill: 1,
        // 3-4 大技
        ultStage: 4,
        comboName: "連携攻撃",
        comboPower: 40,
        resolveMult: 1.25,
        // 4-1 めずらしい報酬。好物がだぶるときの代わり（explore_cards.md の各戦闘の「代わり」。案）
        rare: { base: 0.10, perWis: 0.05, max: 0.5 },
        rareAlt: { item_medicine: 1 },
        // 7-4 探索で負けたとき
        loseHpCost: 3,
        // 5-1 割り込み（2人で挑むとき：割合）
        interruptAt: 0.5,
        // 4-2、5-1 全員で挑むとき：支配の力 ＝ max(min, base − perDev × 発展度)、interruptHp 以下で中盤へ
        allFinal: { base: 1100, perDev: 100, min: 600, interruptHp: 400 },
        // 5-2 発展度と施設
        seal: { alwaysUpTo: 2, firstGuardUpTo: 4 }, // 0〜2：毎回、3〜4：1回目だけ防ぐ、5〜：なくならない
        facilities: { stoveHp: 10, fieldHerb: 2, houseMind: 10, towerDef: 2, dockDamage: 30 },
        // 7-5 自動戦闘
        autoLowHp: 0.3,
        autoLowMind: 20,
    };

    // 4-1、4-2 の敵。pattern は行動の巡り（1回目、2回目…と順にくり返す）。{} はふつうの攻撃。
    var ENEMIES = {
        boar: {
            name: "大イノシシ", hp: 40, atk: 8, def: 0,
            pattern: [{}, {}, { name: "突進", power: 12, warn: "大イノシシが、身を低くして地面をかいている……！" }],
            rewards: { item_food: 3 },
        },
        nushi: {
            name: "森のぬし", hp: 90, atk: 12, def: 2, boss: true,
            pattern: [{}, {}, { name: "地ならし", type: "all", power: 10, warn: "森のぬしが、前足を高く上げた……！" }],
            rewards: { item_food: 4, item_wood: 3 }, rareRewards: { item_soy_seed: 1 }, rareAlt: { item_medicine: 1 },
        },
        bat: {
            name: "洞窟のコウモリ", hp: 18, atk: 6, def: 0,
            pattern: [{}, {}, { name: "超音波", type: "mind", power: 5 }],
            rewards: { item_ore: 2 }, rareRewards: { item_medicine: 1 },
        },
        lizard: {
            name: "岩場の大トカゲ", hp: 60, atk: 10, def: 3,
            onHalf: { name: "岩にこもる", type: "defup", power: 4 },
            rewards: { item_stone: 3 }, rareRewards: { item_scale: 1 },
        },
        eagle: {
            name: "山頂の大鷲", hp: 60, atk: 14, def: 1,
            pattern: [{}, {}, { name: "急降下", power: 28, warn: "大鷲が、高く舞い上がった……！" }],
            rewards: { item_food: 2 }, rareRewards: { gift_white_flower: 1 }, rareAlt: { item_medicine: 1 },
        },
        familiar: {
            // 金具 ×2 は、変数名が台本にないので入れていない
            name: "GM の使い魔", hp: 90, atk: 12, def: 2,
            pattern: [{}, { name: "囁き", type: "mind", power: 8, target: "hero" }],
            rewards: { item_medicine: 1 },
        },
        gm: {
            // 全員で挑むときの支配の力は RULES.allFinal から計算する（allPower）
            name: "GM（黒瀬カイ）", hp: 400, allPower: true, atk: 20, def: 4, boss: true,
            pattern: [
                {},
                { name: "囁き", type: "mind", power: 15, target: "hero" },
                { name: "支配の波", type: "all", power: 12, seal: true, warn: "カイの周りの空気が、重く沈んでいく……！" },
            ],
        },
        // 幻影（相棒の「失ったもの」）。HP 50、攻撃10、守り0
        illusion_noctia: { name: "ルカの影", hp: 50, atk: 10, def: 0, pattern: [{ target: "noctia", mindOnHit: 10 }] },
        illusion_konoha: { name: "稲荷の白狐", hp: 50, atk: 10, def: 0, pattern: [{ hits: 2, power: 6 }] },
        illusion_kabane: { name: "村娘の影", hp: 50, atk: 10, def: 0, pattern: [{ target: "kabane", blockSkill: true }] },
        illusion_hakuren: { name: "白い旗の民の影", hp: 50, atk: 10, def: 0, pattern: [{ target: "hakuren", mindOnHit: 10 }] },
        illusion_ignia: { name: "竜の群れの影", hp: 50, atk: 10, def: 0, pattern: [{ type: "all", power: 5 }] },
    };

    // 好物がだぶるとき（explore_cards.md 冒頭「好物がだぶるとき」の表、life-bond.md 1-1・1-6）：
    // めずらしい報酬の変数名 → 出さない条件。好物か途中の物を持っている、植えた、渡した
    var RARE_BLOCKS = {
        gift_white_flower: function (f) {
            return num(f.gift_white_flower, 0) > 0 || num(f.gave_white_flower, 0) > 0;
        },
        item_soy_seed: function (f) {
            return num(f.item_soy_seed, 0) > 0 || num(f.item_soy, 0) > 0 || num(f.gift_fried_tofu, 0) > 0 ||
                num(f.soy_plant_day, 0) !== 0 || num(f.gave_fried_tofu, 0) > 0;
        },
    };

    var ITEM_NAMES = {
        item_food: "食料", item_wood: "木材", item_soy_seed: "大豆の種", item_ore: "鉱石", item_stone: "石材",
        item_scale: "竜のうろこ", item_medicine: "薬", item_herb: "薬草", gift_white_flower: "山頂の白い花",
    };

    var DEFAULTS = {
        mode: "explore",
        phase: "first",
        enemyName: "",
        autoDelay: 450,   // 自動戦闘の1手の間隔（ミリ秒）
        endDelay: 900,    // 決着がついてから画面を閉じるまで
        returnStorage: "",
        returnTarget: "",
        loseStorage: "",
        loseTarget: "",
        wipeStorage: "",
        wipeTarget: "",
    };

    var COMMANDS = [
        { id: "attack", label: "攻撃" },
        { id: "guard", label: "守る" },
        { id: "skill", label: "技" },
        { id: "item", label: "道具" },
        { id: "word", label: "言葉" },
        { id: "bond", label: "絆" },
    ];
    var DEFENSIVE = { nullify: 1, wall: 1, cover: 1 };

    // ---- 小さな道具 -------------------------------------------------------------------
    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }
    function rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function num(v, d) {
        var n = Number(v);
        return v === undefined || v === null || v === "" || isNaN(n) ? d : n;
    }
    function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
    function merge(base, over) {
        var out = Object.assign({}, base);
        if (!isObj(over)) return out;
        Object.keys(over).forEach(function (k) {
            out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
        });
        return out;
    }
    function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
    function gameVars() {
        var kag = window.TYRANO && window.TYRANO.kag;
        return kag && kag.stat && kag.stat.f ? kag.stat.f : {};
    }

    // ---- 味方と敵を作る ---------------------------------------------------------------
    function makeHero(f, rules, mode) {
        var d = rules.statDefaults, h = rules.hero;
        var body = mode === "final" ? rules.finalHp : num(f.hp, d.hp);
        var str = num(f.str, d.str), mind = num(f.mind, d.mind);
        return {
            id: "hero", hero: true, name: "ユウ", color: "#4a5568",
            hp: h.hpBase + body * h.hpPer,
            atk: h.atkBase + str * h.atkPer,
            def: Math.floor(str / h.defDiv),
            mind: h.mindBase + mind * h.mindPer,
        };
    }

    function makePartner(id, f, rules) {
        var base = rules.partners[id];
        if (!base) return null;
        var s = num(f["ev_" + id], 0), b = rules.stageBonus;
        var p = {
            id: id, name: base.name, color: base.color, img: base.img,
            stage: s,
            hp: base.hp + b.hp * s,
            atk: base.atk + b.atk * s,
            def: base.def + Math.floor(s / b.defDiv),
            mind: base.mind + b.mind * s,
            skill: Object.assign({}, base.skill),
            ult: Object.assign({}, base.ult),
            resolve: num(f[id + "_resolve"], 0) === 1,
        };
        if (id === "konoha") p.tails = num(f.konoha_tails, Math.max(1, s));
        if (id === "ignia") p.awake = num(f.ignia_awake, 0) === 1;
        return p;
    }

    function makeEnemy(spec, rules, opts) {
        var e = typeof spec === "string" ? Object.assign({ key: spec }, ENEMIES[spec]) : Object.assign({}, spec.preset ? ENEMIES[spec.preset] : {}, spec);
        if (!e.name) e.name = "敵";
        if (opts.all && e.allPower) {
            var A = rules.allFinal;
            e.hp = Math.max(A.min, A.base - A.perDev * num(opts.dev, 0));
        }
        e.def = num(e.def, 0);
        e.pattern = e.pattern && e.pattern.length ? e.pattern : [{}];
        return e;
    }

    // ---- 戦闘 ---------------------------------------------------------------------------
    function Battle(cfg) {
        var f = gameVars();
        this.f = f;
        this.rawCfg = cfg;
        this.cfg = Object.assign({}, DEFAULTS, cfg);
        var c = this.cfg;
        var R = this.rules = merge(RULES, c.rules);
        this.final = c.mode === "final";
        this.resume = this.final && c.phase === "finish" && c.resumeState ? clone(c.resumeState) : null;
        this.finisher = c.finisher != null ? !!c.finisher : this.final && c.phase === "finish";

        // 相棒
        var partner = c.partner;
        if (partner === undefined) partner = this.final ? f.partner : f.explore_partner;
        partner = partner || "";
        this.partnerId = partner;
        var allMode = partner === "all";

        // 決戦の前半の割り込み：2人は割合（interruptAt）、全員は値（interruptHp。既定 400）
        var firstHalf = this.final && c.phase !== "finish";
        this.interruptAt = firstHalf ? num(c.interruptAt, R.interruptAt) : null;
        this.interruptHp = null;
        if (firstHalf) {
            if (c.interruptHp != null) this.interruptHp = num(c.interruptHp, 0);
            else if (allMode && c.interruptAt == null) this.interruptHp = R.allFinal.interruptHp;
        }

        // 施設と発展度（決戦だけ）
        var fac = c.facilities;
        if (!fac) {
            fac = {
                stove: num(f.built_stove, 0) === 1,
                workbench: num(f.built_workbench, 0) === 1 && num(f.workbench_broken, 0) !== 1,
                field: num(f.built_field, 0) === 1,
                house: num(f.built_house, 0) === 1,
                tower: num(f.built_tower, 0) === 1,
                dock: num(f.built_dock, 0) === 1,
            };
        }
        if (!this.final) fac = {};
        this.facilities = fac;
        var built = Object.keys(fac).filter(function (k) { return fac[k]; }).length;
        this.dev = c.dev != null ? num(c.dev, 0) : num(f.dev, built);

        // 能力
        var sd = R.statDefaults;
        this.trainCount = num(c.trainCount, num(f.train_count, sd.train_count));
        this.dex = num(c.dex, num(f.dex, sd.dex));
        this.wis = num(c.wis, num(f.wis, sd.wis));

        // 味方
        var party;
        if (c.party && c.party.length) {
            party = c.party.map(function (p, i) {
                var q = Object.assign({}, p);
                if (q.hero == null) q.hero = i === 0;
                if (!q.id) q.id = q.hero ? "hero" : "p" + i;
                if (q.stage == null && !q.hero) q.stage = 1;
                return q;
            });
        } else {
            party = [makeHero(f, R, c.mode)];
            var ids = allMode ? R.partnerOrder : partner ? [partner] : [];
            ids.forEach(function (id) { var p = makePartner(id, f, R); if (p) party.push(p); });
        }
        var self = this;
        this.party = party.map(function (p) {
            var q = Object.assign({ def: 0, guarding: false, sealed: false, skillBlocked: 0 }, p);
            q.def = num(q.def, 0);
            if (fac.stove) q.hp += R.facilities.stoveHp;
            if (fac.house && q.hero) q.mind += R.facilities.houseMind;
            if (fac.tower) q.def += R.facilities.towerDef;
            q.maxHp = q.hp;
            q.maxMind = q.mind;
            if (q.skill && !q.skill.type) q.skill.type = "single";
            return q;
        });
        this.hasPartner = this.party.some(function (p) { return !p.hero; });

        // 敵
        var specs = c.enemies && c.enemies.length ? c.enemies : this.defaultEnemies(allMode);
        this.enemies = specs.map(function (s) {
            var e = makeEnemy(s, R, { all: allMode, dev: self.dev });
            return Object.assign({ maxHp: e.hp, alive: true, acts: 0, tempDef: 0, tempDefLeft: 0, burn: null, halfDone: false }, e);
        });
        var bossIdx = this.enemies.findIndex(function (e) { return e.boss; });
        this.bossIndex = bossIdx >= 0 ? bossIdx : Math.floor(this.enemies.length / 2);
        if (!c.enemyName) c.enemyName = this.boss() ? this.boss().name : "敵";

        // 道具
        var items = c.items || { herb: num(f.item_herb, 0), medicine: num(f.item_medicine, 0) };
        this.items = { herb: num(items.herb, 0), medicine: num(items.medicine, 0) };
        this.bonusHerb = 0;
        if (fac.field && !this.resume) { this.items.herb += R.facilities.fieldHerb; this.bonusHerb = R.facilities.fieldHerb; }
        this.itemLimit = c.itemLimit != null ? num(c.itemLimit, R.items.limit) : fac.workbench ? R.items.limitWorkbench : R.items.limit;
        this.itemsUsed = 0;
        this.usedStock = { herb: 0, medicine: 0 }; // 持ち物（f.item_*）から使った数

        // 絆ゲージ
        this.bondMax = c.bondMax != null ? num(c.bondMax, 5) : this.final ? R.bondMax.final : R.bondMax.explore;
        this.bond = 0;
        this.waveCount = 0;

        // 決着：前半の終わりの状態から始める
        if (this.resume) this.applyResume(this.resume);

        this.turn = 0;
        this.turnIndex = 0; // 今コマンドを選んでいる味方
        this.selected = 0;  // メニューで選んでいる項目
        this.busy = false;
        this.auto = false;
        this.finished = false;
        this.nullify = 0;
        this.wall = 0;      // 骨の盾（そのターン）
        this.ultWall = 0;   // 本当の姿：いまのターンに効いている
        this.ultWallNext = 0; // 本当の姿：次のターンに効かせる
        this.cover = null;
        this.warned = false;
        this.history = [];
        self.timers = [];
    }

    Battle.prototype.defaultEnemies = function (allMode) {
        if (!this.final) return ["boar"];
        if (this.cfg.phase === "finish") return ["gm"];
        var ids;
        if (allMode) {
            // 好感度の低い2人の分の幻影
            var f = this.f;
            ids = this.rules.partnerOrder.slice().sort(function (a, b) { return num(f["aff_" + a], 0) - num(f["aff_" + b], 0); }).slice(0, 2);
        } else {
            ids = [this.partnerId, this.partnerId];
        }
        var ill = ids.map(function (id) { return ENEMIES["illusion_" + id] ? "illusion_" + id : { name: "幻影", hp: 50, atk: 10, def: 0 }; });
        return [ill[0], "gm", ill[1]];
    };

    Battle.prototype.applyResume = function (st) {
        var byId = {};
        (st.party || []).forEach(function (p) { byId[p.id] = p; });
        this.party.forEach(function (p) {
            var s = byId[p.id];
            if (!s) return;
            p.maxHp = num(s.maxHp, p.maxHp);
            p.maxMind = num(s.maxMind, p.maxMind);
            p.hp = num(s.hp, p.hp);
            p.mind = num(s.mind, p.mind);
        });
        var boss = this.boss();
        if (boss) {
            boss.maxHp = num(st.bossMaxHp, boss.maxHp);
            boss.hp = num(st.bossHp, boss.hp);
        }
        if (st.items) this.items = { herb: num(st.items.herb, 0), medicine: num(st.items.medicine, 0) };
        this.bonusHerb = num(st.bonusHerb, 0);
        if (st.bondMax != null && this.cfg.bondMax == null) this.bondMax = num(st.bondMax, this.bondMax);
        this.bond = Math.min(this.bondMax, num(st.bond, 0));
        this.waveCount = num(st.waveCount, 0);
    };

    Battle.prototype.later = function (fn, ms) {
        var self = this;
        var t = setTimeout(function () { if (!self.destroyed) fn(); }, ms);
        this.timers.push(t);
        return t;
    };

    Battle.prototype.mount = function () {
        var base = document.querySelector(".tyrano_base") || document.body;
        var root = el("div", "ib-root" + (this.final ? " ib-final" : ""));
        // ティラノスクリプト本体のクリック処理（文字送り）に届かないようにする
        ["click", "mousedown", "touchstart"].forEach(function (ev) {
            root.addEventListener(ev, function (e) { e.stopPropagation(); });
        });

        // 左上：敵の名前と残りのマス
        var bar = el("div", "ib-enemybar");
        bar.appendChild(el("span", "ib-enemyname", this.cfg.enemyName));
        this.cellsEl = el("span", "ib-cells");
        bar.appendChild(this.cellsEl);
        root.appendChild(bar);

        // 上の中央：絆ゲージ（相棒がいないときは出さない）
        var bond = el("div", "ib-bond");
        bond.appendChild(el("div", "ib-bond-label", "絆ゲージ"));
        this.bondEl = el("div", "ib-bond-gems");
        bond.appendChild(this.bondEl);
        if (!this.hasPartner) bond.style.display = "none";
        this.bondBox = bond;
        root.appendChild(bond);

        // 右上：自動戦闘
        this.autoBtn = el("div", "ib-auto", "自動：OFF");
        this.autoBtn.addEventListener("click", this.toggleAuto.bind(this));
        root.appendChild(this.autoBtn);

        // 左：コマンドメニュー
        this.menuEl = el("div", "ib-menu");
        this.menuTitle = el("div", "ib-menu-title");
        this.menuEl.appendChild(this.menuTitle);
        var self = this;
        this.itemEls = COMMANDS.map(function (c, i) {
            var item = el("div", "ib-item");
            item.dataset.cmd = c.id;
            item.appendChild(el("span", "ib-ico"));
            item.appendChild(el("span", "ib-label", c.label));
            item.addEventListener("mouseenter", function () { self.select(i); });
            item.addEventListener("click", function () { self.select(i); self.command(c.id); });
            self.menuEl.appendChild(item);
            return item;
        });
        this.itemInfo = el("div", "ib-iteminfo");
        this.menuEl.appendChild(this.itemInfo);
        root.appendChild(this.menuEl);

        // 中央：敵
        var stage = el("div", "ib-stage");
        this.enemies.forEach(function (e, i) {
            var box = el("div", "ib-enemy" + (i === self.bossIndex ? " ib-boss" : ""));
            var body = el("div", "ib-enemy-body");
            if (e.img) body.style.backgroundImage = "url(" + e.img + ")";
            box.appendChild(body);
            box.appendChild(el("div", "ib-enemy-name", e.name));
            var hp = el("div", "ib-enemy-hp");
            hp.appendChild(el("i"));
            box.appendChild(hp);
            e.el = box;
            stage.appendChild(box);
        });
        root.appendChild(stage);

        // 下：味方のカード
        var partyEl = el("div", "ib-party" + (this.party.length > 3 ? " ib-party-many" : ""));
        this.party.forEach(function (p) {
            var card = el("div", "ib-card");
            var photo = el("div", "ib-photo");
            var face = el("div", "ib-face", p.img ? "" : p.name.charAt(0));
            if (p.img) face.style.backgroundImage = "url(" + p.img + ")";
            if (p.color) face.style.backgroundColor = p.color;
            photo.appendChild(face);
            card.appendChild(photo);
            var stats = el("div", "ib-stats");
            p.hpEl = el("span", "ib-v");
            p.mindEl = el("span", "ib-v");
            p.hpBar = el("i");
            p.mindBar = el("i");
            stats.appendChild(row("HP", p.hpEl));
            stats.appendChild(barOf(p.hpBar, ""));
            stats.appendChild(row("心", p.mindEl));
            stats.appendChild(barOf(p.mindBar, " ib-mind"));
            card.appendChild(stats);
            card.appendChild(el("div", "ib-name", p.name));
            p.el = card;
            partyEl.appendChild(card);
        });
        root.appendChild(partyEl);

        // 下の中央：ログ
        this.logEl = el("div", "ib-log");
        root.appendChild(this.logEl);

        function row(k, v) {
            var r = el("div", "ib-row");
            r.appendChild(el("span", "ib-k", k));
            r.appendChild(v);
            return r;
        }
        function barOf(i, extra) {
            var b = el("div", "ib-bar" + extra);
            b.appendChild(i);
            return b;
        }

        this.keyHandler = this.onKey.bind(this);
        document.addEventListener("keydown", this.keyHandler, true);

        base.appendChild(root);
        this.root = root;
        this.log(this.resume ? "決着の時だ。" : this.cfg.enemyName + "が現れた！");

        // 船着き場：1ターン目の初めに、幻影1体に30（前半だけ）
        if (this.facilities.dock && !this.resume) {
            var m = this.minions()[0];
            if (m) {
                this.damage(m, this.rules.facilities.dockDamage);
                this.log("船で回りこんだ仲間が、" + m.name + "に " + this.rules.facilities.dockDamage + " のダメージ！");
            }
        }
        this.startPlayerPhase();
    };

    Battle.prototype.onKey = function (e) {
        if (this.finished) return;
        var handled = true;
        if (e.key === "ArrowUp") this.select((this.selected + COMMANDS.length - 1) % COMMANDS.length);
        else if (e.key === "ArrowDown") this.select((this.selected + 1) % COMMANDS.length);
        else if (e.key === "Enter" || e.key === " ") this.command(COMMANDS[this.selected].id);
        else if (e.key === "a" || e.key === "A") this.toggleAuto();
        else handled = false;
        if (handled) { e.preventDefault(); e.stopPropagation(); }
    };

    Battle.prototype.select = function (i) {
        this.selected = i;
        this.itemEls.forEach(function (item, j) { item.classList.toggle("ib-sel", i === j); });
    };

    Battle.prototype.render = function () {
        if (!this.root) return;
        var boss = this.boss();
        var cells = 8;
        var filled = boss ? Math.ceil((Math.max(0, boss.hp) / boss.maxHp) * cells) : 0;
        this.cellsEl.innerHTML = "";
        for (var i = 0; i < cells; i++) this.cellsEl.appendChild(el("span", "ib-cell" + (i < filled ? "" : " ib-empty")));

        var gems = "";
        for (var g = 0; g < this.bondMax; g++) gems += g < this.bond ? "◆" : "◇";
        this.bondEl.textContent = gems;

        this.enemies.forEach(function (e) {
            e.el.classList.toggle("ib-dead", !e.alive);
            e.el.querySelector(".ib-enemy-hp i").style.width = Math.max(0, (e.hp / e.maxHp) * 100) + "%";
        });
        var self = this;
        this.party.forEach(function (p, i) {
            p.hpEl.textContent = Math.max(0, p.hp);
            p.mindEl.textContent = Math.max(0, p.mind);
            p.hpBar.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + "%";
            p.mindBar.style.width = Math.max(0, (p.mind / p.maxMind) * 100) + "%";
            p.el.classList.toggle("ib-active", i === self.turnIndex && !self.finished);
            p.el.classList.toggle("ib-down", p.hp <= 0);
        });
        var actor = this.party[this.turnIndex];
        this.menuTitle.textContent = actor ? actor.name + "の行動" : "";
        COMMANDS.forEach(function (c, j) {
            self.itemEls[j].classList.toggle("ib-disabled", !actor || !self.canUse(c.id, actor));
        });
        this.itemInfo.textContent = "薬草 " + this.items.herb + "　薬 " + this.items.medicine + "　（あと " + Math.max(0, this.itemLimit - this.itemsUsed) + " 回）";
        this.select(this.selected);
    };

    Battle.prototype.log = function (text) {
        this.history.push(text);
        if (this.logEl) this.logEl.textContent = text;
    };

    Battle.prototype.boss = function () {
        return this.enemies[this.bossIndex];
    };
    Battle.prototype.minions = function () {
        var boss = this.boss();
        return this.enemies.filter(function (e) { return e.alive && e !== boss; });
    };
    Battle.prototype.hero = function () {
        return this.party.find(function (p) { return p.hero; });
    };
    Battle.prototype.alive = function () {
        return this.party.filter(function (p) { return p.hp > 0; });
    };

    Battle.prototype.target = function () {
        // 取り巻きから先に倒す
        var alive = this.enemies.filter(function (e) { return e.alive; });
        return this.minions()[0] || alive[0];
    };
    Battle.prototype.strongest = function () {
        var alive = this.enemies.filter(function (e) { return e.alive; });
        return alive.sort(function (a, b) { return b.hp - a.hp; })[0];
    };

    Battle.prototype.damage = function (enemy, amount) {
        if (!enemy || !enemy.alive) return;
        enemy.hp -= amount;
        if (enemy.hp <= 0) {
            enemy.alive = false;
            enemy.hp = 0;
            if (this.hasPartner) this.bond = Math.min(this.bondMax, this.bond + this.rules.bondPerKill);
        }
        if (enemy.el) {
            enemy.el.classList.remove("ib-hit");
            void enemy.el.offsetWidth;
            enemy.el.classList.add("ib-hit");
        }
    };

    Battle.prototype.enemyDef = function (e) {
        return e.def + (e.tempDefLeft > 0 ? e.tempDef : 0);
    };

    // ---- コマンド ---------------------------------------------------------------------
    Battle.prototype.bondUsers = function (actor) {
        // 決着で全員で挑むとき：どの番でも「絆」1回で、相棒全員の大技を順に出す（7-3、5-5）
        // 主人公が倒れていると使えない大技（白虎の牙）の相棒は除く（3-4）。全員のときは、その1人を飛ばして続ける
        var self = this;
        if (this.finisher && this.partnerId === "all") return this.party.filter(function (p) { return !p.hero && !self.ultBlocked(p); });
        if (!actor.hero) return actor.stage >= 1 && !this.ultBlocked(actor) ? [actor] : [];
        var alive = this.party.filter(function (p) { return !p.hero && p.stage >= 1 && p.hp > 0 && !self.ultBlocked(p); });
        alive.sort(function (a, b) { return b.stage - a.stage; });
        return alive.length ? [alive[0]] : [];
    };

    // 大技の条件を満たさない（主人公が倒れているときの白虎の牙）。段階1〜3の連携攻撃は条件なし
    Battle.prototype.ultBlocked = function (p) {
        var u = p.ult || {};
        if (!(p.stage >= this.rules.ultStage && u.type && u.needHero)) return false;
        var hero = this.hero();
        return !(hero && hero.hp > 0);
    };

    Battle.prototype.canUse = function (id, actor) {
        var R = this.rules;
        switch (id) {
            case "skill":
                return !actor.hero && !!actor.skill && actor.skillBlocked <= 0 && actor.mind >= R.skillCost;
            case "word":
                return !!actor.hero;
            case "item":
                return this.itemsUsed < this.itemLimit && (this.items.herb > 0 || this.items.medicine > 0);
            case "bond":
                return this.hasPartner && this.bond >= this.bondMax && this.bondUsers(actor).length > 0;
            default:
                return true;
        }
    };

    Battle.prototype.command = function (id) {
        if (this.busy || this.finished) return;
        var actor = this.party[this.turnIndex];
        if (!actor) return;
        var R = this.rules;
        var t = this.target();
        var msg = "";
        var self = this;
        switch (id) {
            case "attack": {
                var dmg = Math.max(R.minDamage, rand(actor.atk - R.attackSpread, actor.atk + R.attackSpread) - this.enemyDef(t));
                this.damage(t, dmg);
                msg = actor.name + "の攻撃！ " + t.name + "に " + dmg + " のダメージ";
                break;
            }
            case "guard":
                actor.guarding = true;
                msg = actor.name + "は身を守っている";
                break;
            case "skill":
                if (actor.hero) { this.log("技は、相棒の番だけ使える"); return; }
                if (!actor.skill) { this.log(actor.name + "は技を覚えていない"); return; }
                if (actor.skillBlocked > 0) { this.log(actor.name + "は、いま技を使えない"); return; }
                if (actor.mind < R.skillCost) { this.log("心が足りない"); return; }
                actor.mind -= R.skillCost;
                msg = this.useSkill(actor, t);
                break;
            case "item":
                if (!this.canUse("item", actor)) {
                    this.log(this.itemsUsed >= this.itemLimit ? "この戦いでは、もう道具を使えない" : "道具がない");
                    return;
                }
                msg = this.useItem(actor);
                break;
            case "word": {
                if (!actor.hero) { this.log("言葉は、主人公の番だけ使える"); return; }
                actor.mind = Math.min(actor.maxMind, actor.mind + R.word.heroMind);
                this.party.forEach(function (p) {
                    if (!p.hero && p.hp > 0) p.mind = Math.min(p.maxMind, p.mind + R.word.partnerMind);
                });
                var add = this.finisher ? R.word.bondFinisher : R.word.bond;
                if (this.hasPartner) this.bond = Math.min(this.bondMax, this.bond + add);
                msg = actor.name + "は仲間に声をかけた。心" + (this.hasPartner ? "と絆" : "") + "が高まる";
                break;
            }
            case "bond":
                if (!this.hasPartner) { this.log("絆を使える相棒がいない"); return; }
                if (this.bond < this.bondMax) { this.log("絆ゲージが足りない"); return; }
                if (!this.bondUsers(actor).length) { this.log(actor.name + "は、まだ絆の技を使えない"); return; }
                this.bond = 0;
                if (this.finisher) { this.finishingBlow(actor); return; }
                msg = this.useUlt(this.bondUsers(actor)[0]);
                break;
        }
        this.log(msg);
        this.render();
        if (this.checkEnd()) return;
        this.nextActor();
    };

    Battle.prototype.useSkill = function (actor, t) {
        var R = this.rules, sk = actor.skill, s = num(actor.stage, 0);
        var self = this;
        switch (sk.type) {
            case "multi": {
                var total = 0, n = num(sk.hits, 3);
                for (var i = 0; i < n; i++) {
                    var tt = this.target();
                    if (!tt) break;
                    var d = rand(sk.min, sk.max) + s;
                    this.damage(tt, d);
                    total += d;
                }
                return actor.name + "の" + sk.name + "！ " + n + "回当たって、合わせて " + total + " のダメージ";
            }
            case "burn": {
                var bd = rand(sk.min, sk.max) + s;
                this.damage(t, bd);
                if (t.alive) t.burn = { power: sk.burn, left: sk.burnTurns };
                return actor.name + "の" + sk.name + "！ " + t.name + "に " + bd + " のダメージ。火がついた";
            }
            case "nullify":
                this.nullify = 1;
                return actor.name + "の" + sk.name + "。次の敵の攻撃を1回打ち消す";
            case "wall":
                this.wall = 1;
                return actor.name + "の" + sk.name + "。このターン、味方の受けるダメージが半分になる";
            case "cover":
                this.cover = actor;
                return actor.name + "の" + sk.name + "。このターン、" + (this.hero() ? this.hero().name : "主人公") + "への攻撃を引き受ける";
            default: {
                var sd = Math.max(R.minDamage, rand(sk.power - R.skillSpread, sk.power + R.skillSpread));
                this.damage(t, sd);
                return actor.name + "の" + sk.name + "！ " + t.name + "に " + sd + " のダメージ";
            }
        }
    };

    Battle.prototype.useItem = function (actor) {
        var R = this.rules;
        // 試作の仮：心の減り方のほうが大きく、薬があれば薬。そうでなければ薬草
        var hpRate = actor.hp / actor.maxHp, mindRate = actor.mind / actor.maxMind;
        var kind = this.items.herb > 0 ? "herb" : "medicine";
        if (this.items.medicine > 0 && (mindRate < hpRate || this.items.herb <= 0)) kind = "medicine";
        this.items[kind]--;
        this.itemsUsed++;
        if (kind === "herb" && this.bonusHerb > 0) this.bonusHerb--;
        else this.usedStock[kind]++;
        if (kind === "herb") {
            var heal = R.items.herbBase + R.items.herbPerDex * this.dex;
            actor.hp = Math.min(actor.maxHp, actor.hp + heal);
            return actor.name + "は薬草を使った。HP が " + heal + " 回復した";
        }
        actor.hp = Math.min(actor.maxHp, actor.hp + R.items.medicineHp);
        actor.mind = Math.min(actor.maxMind, actor.mind + R.items.medicineMind);
        return actor.name + "は薬を使った。心と HP が回復した";
    };

    // 大技（または段階1〜3の連携攻撃）
    Battle.prototype.useUlt = function (p) {
        var R = this.rules, hero = this.hero(), self = this;
        var u = p.ult || {};
        var useUlt = p.stage >= R.ultStage && u.type; // 白虎の牙の条件は bondUsers で見る
        if (!useUlt) {
            this.enemies.forEach(function (e) { if (e.alive) self.damage(e, R.comboPower); });
            return p.name + "との" + R.comboName + "！ すべての敵に " + R.comboPower + " のダメージ";
        }
        var power = u.power;
        if (u.perTail) power = u.perTail * num(p.tails, p.stage);
        if (u.powerAwake && p.awake) power = u.powerAwake;
        if (p.resolve) power = Math.floor(power * R.resolveMult);
        if (u.heroCost && hero && hero.hp > 0) hero.hp = Math.max(1, hero.hp - u.heroCost);
        if (u.wall) this.ultWallNext = 1; // 次のターン、味方の受けるダメージ半分（3-4）
        if (u.type === "all") {
            this.enemies.forEach(function (e) { if (e.alive) self.damage(e, power); });
            return p.name + "の" + u.name + "！ すべての敵に " + power + " のダメージ" + (u.wall ? "。次のターン、味方の受けるダメージが半分になる" : "");
        }
        var t = this.strongest();
        this.damage(t, power);
        return p.name + "の" + u.name + "！ " + t.name + "に " + power + " のダメージ";
    };

    // 決着のとどめ：大技の大きさにかかわらず、GM の支配の力を 0 にする（5-5）
    // 全員で挑むときは、相棒の大技を順に出し、途中の大技は支配の力を 1 まで削る。最後の1人で 0 にする
    Battle.prototype.finishingBlow = function (actor) {
        var users = this.bondUsers(actor);
        var self = this, i = 0;
        this.busy = true;
        this.finisherOrder = [];
        (function step() {
            if (i < users.length) {
                var p = users[i++];
                var name = p.stage >= self.rules.ultStage && p.ult && p.ult.name ? p.ult.name : self.rules.comboName;
                self.finisherOrder.push(p.id);
                var boss = self.boss();
                if (i < users.length && boss) {
                    var u = p.ult || {};
                    var power = u.perTail ? u.perTail * num(p.tails, p.stage) : u.powerAwake && p.awake ? u.powerAwake : u.power || self.rules.comboPower;
                    boss.hp = Math.max(1, boss.hp - power);
                }
                self.log(p.name + "の" + name + "！");
                self.render();
                self.later(step, users.length > 1 ? self.cfg.autoDelay : 0);
                return;
            }
            var boss = self.boss();
            boss.hp = 0;
            boss.alive = false;
            self.enemies.forEach(function (e) { e.alive = false; e.hp = 0; });
            self.finishedByFinisher = true;
            self.log("絆の大技が、カイの支配の力を打ち砕いた！");
            self.busy = false;
            self.render();
            self.checkEnd();
        })();
    };

    // ---- ターンの進み方 -----------------------------------------------------------------
    Battle.prototype.nextAction = function (e) {
        if (e.onHalf && !e.halfDone && e.hp <= e.maxHp / 2) return e.onHalf;
        return e.pattern[e.acts % e.pattern.length];
    };

    Battle.prototype.startPlayerPhase = function () {
        this.turn++;
        var self = this;
        var warns = [];
        this.enemies.forEach(function (e) {
            if (!e.alive) return;
            var a = self.nextAction(e);
            if (a && a.warn) warns.push(a.warn);
        });
        this.warned = warns.length > 0;
        // 予告は、直前のログ（敵の行動）を消さずに後ろへ足す
        if (warns.length) {
            var prev = this.logEl && this.turn > 1 ? this.logEl.textContent : "";
            this.log((prev ? prev + "　" : "") + "【予告】" + warns.join(" "));
        }
        var first = this.party.findIndex(function (p) { return p.hp > 0; });
        this.beginActor(first);
    };

    Battle.prototype.beginActor = function (idx) {
        this.turnIndex = idx;
        this.render();
        var actor = this.party[idx];
        if (actor && actor.sealed) {
            actor.sealed = false;
            this.busy = true;
            this.log(actor.name + "は、支配の波に体をしばられて動けない！");
            var self = this;
            this.later(function () { self.busy = false; self.nextActor(); }, this.cfg.autoDelay);
            return;
        }
        this.maybeAuto();
    };

    Battle.prototype.nextActor = function () {
        var n = this.party.length;
        for (var idx = this.turnIndex + 1; idx < n; idx++) {
            if (this.party[idx].hp > 0) { this.beginActor(idx); return; }
        }
        this.enemyTurn();
    };

    Battle.prototype.hitParty = function (p, power, a, e) {
        var R = this.rules;
        var target = p;
        var rate = 1;
        if (target.hero && this.cover && this.cover.hp > 0 && this.cover !== target) {
            target = this.cover;
            rate = Math.min(rate, R.coverRate);
        }
        var d = rand(power - R.enemySpread, power + R.enemySpread) - target.def;
        d = Math.max(R.minDamage, d);
        if (target.guarding) rate = Math.min(rate, Math.max(R.guard.min, R.guard.base - R.guard.perTrain * this.trainCount));
        if (this.wall > 0 || this.ultWall > 0) rate = Math.min(rate, R.wallRate);
        d = Math.max(R.minDamage, Math.floor(d * rate));
        target.hp -= d;
        if (a.mindOnHit) target.mind = Math.max(0, target.mind - a.mindOnHit);
        if (a.blockSkill) target.skillBlocked = 2; // 次のターンまで
        target.el.classList.remove("ib-hit");
        void target.el.offsetWidth;
        target.el.classList.add("ib-hit");
        return { target: target, dmg: d };
    };

    Battle.prototype.enemyAct = function (e) {
        var a = this.nextAction(e);
        if (a === e.onHalf) e.halfDone = true;
        else e.acts++;
        var type = a.type || "attack";
        var power = a.power != null ? a.power : e.atk;
        var label = a.name ? e.name + "の" + a.name + "！" : e.name + "の攻撃！";
        var alive = this.alive();
        var self = this;
        if (!alive.length) return;

        // 夜の帳：予告の出ている行動があれば、それを優先して打ち消す（攻撃でない行動でも。2026-10-17 利用者の決定）
        if (this.nullify > 0 && a.warn) {
            this.nullify = 0;
            return label + " ……しかし、夜の帳が打ち消した";
        }
        if (type === "defup") {
            e.tempDef = power;
            e.tempDefLeft = 2; // 次のターンまで
            return label + " 守りが固くなった";
        }
        if (type === "mind") {
            var mt;
            if (a.target === "hero") {
                // 囁きは主人公だけを狙う（4-1、4-2）。倒れていれば空振り
                var hh = this.hero();
                if (!hh || hh.hp <= 0) return label + " ……しかし、" + (hh ? hh.name : "主人公") + "には届かなかった";
                mt = hh;
            } else {
                mt = alive[rand(0, alive.length - 1)];
            }
            mt.mind = Math.max(0, mt.mind - power);
            return label + " " + mt.name + "の心が " + power + " 減った";
        }
        // 夜の帳：次の敵の「攻撃」1回を打ち消す（3-3）。守りを固める・心を減らす行動では使わない。
        // このターンにまだ予告の行動が残っていれば、そちらのためにとっておく
        if (this.nullify > 0 && !this.warnPending) {
            this.nullify = 0;
            return label + " ……しかし、夜の帳が打ち消した";
        }
        var parts = [];
        if (type === "all") {
            alive.forEach(function (p) { var r = self.hitParty(p, power, a, e); parts.push(r.target.name + " " + r.dmg); });
        } else {
            var t = null;
            if (a.target) t = alive.find(function (p) { return p.id === a.target || (a.target === "hero" && p.hero); });
            if (!t) t = alive[rand(0, alive.length - 1)];
            var hits = num(a.hits, 1);
            for (var h = 0; h < hits; h++) {
                if (t.hp <= 0) break;
                var r = this.hitParty(t, power, a, e);
                parts.push(r.target.name + " " + r.dmg);
            }
        }
        var msg = label + " ダメージ（" + parts.join("、") + "）";
        if (a.seal) {
            this.waveCount++;
            var S = this.rules.seal;
            var sealed = this.dev <= S.alwaysUpTo || (this.dev <= S.firstGuardUpTo && this.waveCount >= 2);
            var hero = this.hero();
            if (hero && hero.hp > 0) {
                if (sealed) { hero.sealed = true; msg += " " + hero.name + "の体が動かない……"; }
                else msg += " 島のみんなの支えで、" + hero.name + "は立っていられた";
            }
        }
        return msg;
    };

    Battle.prototype.enemyTurn = function () {
        var self = this;
        this.busy = true;
        // やけど
        this.enemies.forEach(function (e) {
            if (e.alive && e.burn && e.burn.left > 0) {
                self.damage(e, e.burn.power);
                e.burn.left--;
                self.log(e.name + "はやけどで " + e.burn.power + " のダメージ");
            }
        });
        this.render();
        if (this.checkEnd()) return;
        var alive = this.enemies.filter(function (e) { return e.alive; });
        var i = 0;
        (function step() {
            if (self.finished) return;
            // まだ動いていない敵に、予告の出ている行動が残っているか（夜の帳の優先に使う）
            self.warnPending = alive.slice(i).some(function (e) { var na = e.alive && self.nextAction(e); return !!(na && na.warn); });
            if (i >= alive.length) {
                self.party.forEach(function (p) { p.guarding = false; if (p.skillBlocked > 0) p.skillBlocked--; });
                self.enemies.forEach(function (e) { if (e.tempDefLeft > 0) e.tempDefLeft--; });
                self.wall = Math.max(0, self.wall - 1);
                self.ultWall = self.ultWallNext; // 本当の姿は、使ったターンの次のターンに効く
                self.ultWallNext = 0;
                self.cover = null;
                self.busy = false;
                self.render();
                if (!self.checkEnd()) self.startPlayerPhase();
                return;
            }
            var e = alive[i++];
            if (!e.alive) { step(); return; }
            var msg = self.enemyAct(e);
            if (msg) self.log(msg);
            self.render();
            if (self.checkEnd()) return;
            self.later(step, self.cfg.autoDelay);
        })();
    };

    // ---- 自動戦闘（7-5） ----------------------------------------------------------------
    Battle.prototype.toggleAuto = function () {
        this.auto = !this.auto;
        this.autoBtn.textContent = "自動：" + (this.auto ? "ON" : "OFF");
        this.autoBtn.classList.toggle("ib-on", this.auto);
        this.maybeAuto();
    };

    Battle.prototype.autoChoice = function (actor) {
        var R = this.rules;
        var can = this.canUse.bind(this);
        var lowHp = actor.hp < actor.maxHp * R.autoLowHp && can("item", actor);
        if (actor.hero) {
            if (this.finisher && this.hasPartner && this.bond < this.bondMax) return "word";
            if (can("bond", actor)) return "bond";
            if (this.final && actor.mind < R.autoLowMind) return "word";
            if (this.warned) return "guard";
            if (lowHp) return "item";
            return "attack";
        }
        if (can("bond", actor)) return "bond";
        var defensive = actor.skill && DEFENSIVE[actor.skill.type];
        // 守りの技は、予告が出たターンだけ。予告のないターンは技を飛ばして攻撃する（7-5）
        if (this.warned && defensive && can("skill", actor) && this.isGuardian(actor)) return "skill";
        if (lowHp) return "item";
        if (!defensive && can("skill", actor)) return "skill";
        return "attack";
    };

    // 予告のターンに守りの技を使う相棒。全員で挑むときは1人だけ（骨の盾を優先、なければ並び順で最初）
    Battle.prototype.isGuardian = function (actor) {
        if (this.wall > 0 || this.nullify > 0 || this.cover) return false; // このターンはもう使った
        var self = this;
        // 本当の姿の半減が効いているターンは、骨の盾を重ねても変わらないので候補から外す
        var cands = this.party.filter(function (p) {
            return !p.hero && p.hp > 0 && p.skill && DEFENSIVE[p.skill.type] && self.canUse("skill", p) &&
                !(p.skill.type === "wall" && self.ultWall > 0);
        });
        var pick = cands.find(function (p) { return p.skill.type === "wall"; }) || cands[0];
        return pick === actor;
    };

    Battle.prototype.maybeAuto = function () {
        if (!this.auto || this.busy || this.finished) return;
        var self = this;
        clearTimeout(this.autoTimer);
        this.autoTimer = this.later(function () {
            if (!self.auto || self.busy || self.finished) return;
            var actor = self.party[self.turnIndex];
            if (!actor) return;
            var id = self.autoChoice(actor);
            self.select(COMMANDS.findIndex(function (c) { return c.id === id; }));
            self.command(id);
        }, this.cfg.autoDelay);
    };

    // ---- 終わり ---------------------------------------------------------------------
    Battle.prototype.checkEnd = function () {
        if (this.finished) return true;
        var win = this.enemies.every(function (e) { return !e.alive; });
        var lose = this.party.every(function (p) { return p.hp <= 0; });
        var boss = this.boss();
        // 前半の割り込みは、一撃で 0 になっても（alive より先に）判定する。とどめは決着の絆の大技で刺す（5-5）
        var limit = !boss ? 0 : this.interruptHp != null ? this.interruptHp : boss.maxHp * this.interruptAt;
        var interrupt = !lose && this.interruptAt != null && !!boss && boss.hp <= limit;
        if (interrupt) {
            win = false;
            if (boss.hp <= 0) { boss.hp = 1; boss.alive = true; } // 決着を支配の力 1 から始める
        }
        if (!win && !lose && !interrupt) return false;
        this.finished = true;
        this.busy = true;
        this.render();
        var result = win ? "win" : lose ? (this.final ? "wipe" : "lose") : "interrupt";
        if (result === "win") this.log("勝利！" + this.rewardText());
        else if (result === "wipe") this.log("視界が、端のほうから黒くなっていく……");
        else if (result === "lose") this.log("敗北……");
        else this.log("カイが、ふっと手を止めた……");
        var self = this;
        this.later(function () { self.finish(result); }, this.cfg.endDelay);
        return true;
    };

    // 勝ったときの報酬を決める（めずらしい報酬は 10% ＋ 知恵 × 5%、最大 50%）
    Battle.prototype.rewardText = function () {
        var c = this.cfg, R = this.rules, boss = this.boss() || {};
        var rewards = Object.assign({}, c.rewards || (this.final ? {} : boss.rewards || {}));
        var rare = c.rareRewards || (this.final ? null : boss.rareRewards);
        var chance = c.rareChance != null ? num(c.rareChance, 0) : Math.min(R.rare.max, R.rare.base + R.rare.perWis * this.wis);
        this.gotRare = false;
        this.rareReplaced = [];
        if (rare && Math.random() < chance) {
            this.gotRare = true;
            // 好物がだぶるときは、その報酬を出さずに代わり（薬 ×1 など）にする（battle.md 4-1）
            var f = this.f, give = Object.assign({}, rare);
            var blocked = Object.keys(rare).filter(function (k) { return RARE_BLOCKS[k] && RARE_BLOCKS[k](f); });
            if (blocked.length) {
                blocked.forEach(function (k) { delete give[k]; });
                var alt = c.rareAlt || (this.final ? null : boss.rareAlt) || R.rareAlt || {};
                Object.keys(alt).forEach(function (k) { give[k] = (give[k] || 0) + alt[k]; });
                this.rareReplaced = blocked;
            }
            Object.keys(give).forEach(function (k) { rewards[k] = (rewards[k] || 0) + give[k]; });
        }
        this.rewards = rewards;
        var names = Object.keys(rewards).map(function (k) { return (ITEM_NAMES[k] || k) + " ×" + rewards[k]; });
        return names.length ? " " + names.join("、") + " を手に入れた" : "";
    };

    Battle.prototype.snapshot = function () {
        var boss = this.boss();
        return {
            partner: this.partnerId,
            party: this.party.map(function (p) {
                return { id: p.id, name: p.name, hp: Math.max(0, p.hp), mind: Math.max(0, p.mind), maxHp: p.maxHp, maxMind: p.maxMind };
            }),
            bond: this.bond,
            bondMax: this.bondMax,
            bossHp: boss ? Math.max(0, boss.hp) : 0,
            bossMaxHp: boss ? boss.maxHp : 0,
            items: { herb: this.items.herb, medicine: this.items.medicine },
            bonusHerb: this.bonusHerb,
            waveCount: this.waveCount,
            dev: this.dev,
        };
    };

    Battle.prototype.destroy = function () {
        this.destroyed = true;
        document.removeEventListener("keydown", this.keyHandler, true);
        this.timers.forEach(clearTimeout);
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    };

    Battle.prototype.finish = function (result) {
        this.destroy();
        var f = this.f;
        var c = this.cfg;
        var hero = this.hero();
        f.battle_result = result;
        var penaltyFree = result === "wipe"; // 決戦で全員倒れたとき：罰なし。何も書き戻さない
        if (!penaltyFree) {
            // 使った薬草・薬を持ち物から引く
            var self = this;
            ["herb", "medicine"].forEach(function (k) {
                if (self.usedStock[k] > 0) f["item_" + k] = Math.max(0, num(f["item_" + k], 0) - self.usedStock[k]);
            });
            // 戦闘後の HP と心（探索では使わない）
            f.battle_party = this.party.map(function (p) {
                return { name: p.name, hp: Math.max(0, p.hp), mind: Math.max(0, p.mind) };
            });
        }
        if (result === "win" && this.rewards) {
            var rw = this.rewards;
            Object.keys(rw).forEach(function (k) { f[k] = num(f[k], 0) + rw[k]; });
        }
        if (result === "lose" && !this.final) {
            f.hp = Math.max(0, num(f.hp, this.rules.statDefaults.hp) - this.rules.loseHpCost);
        }
        if (result === "interrupt") {
            f.battle_state = this.snapshot();
            f.final_mind_zero = hero && hero.mind <= 0 ? 1 : 0;
        }
        IslandBattle.last = {
            result: result,
            mode: c.mode,
            phase: c.phase,
            finisher: !!this.finishedByFinisher,
            finisherOrder: this.finisherOrder || [],
            bossHp: this.boss() ? Math.max(0, this.boss().hp) : 0,
            rewards: this.rewards || null,
            rare: !!this.gotRare,
            rareReplaced: (this.rareReplaced || []).slice(),
            itemsUsed: this.itemsUsed,
            turns: this.turn,
            history: this.history.slice(),
        };
        var kag = window.TYRANO && window.TYRANO.kag;
        var storage = c.returnStorage, target = c.returnTarget;
        if (result === "lose" && (c.loseStorage || c.loseTarget)) { storage = c.loseStorage || storage; target = c.loseTarget; }
        if (result === "wipe" && (c.wipeStorage || c.wipeTarget)) { storage = c.wipeStorage || storage; target = c.wipeTarget; }
        if (kag && (storage || target)) {
            kag.ftag.startTag("jump", { storage: storage, target: target });
        }
        if (typeof c.onEnd === "function") c.onEnd(result);
    };

    var IslandBattle = window.IslandBattle = {
        RULES: RULES,
        ENEMIES: ENEMIES,
        RARE_BLOCKS: RARE_BLOCKS,
        retries: 0,
        start: function (cfg) {
            if (IslandBattle.current && !IslandBattle.current.destroyed) IslandBattle.current.destroy();
            IslandBattle.lastCfg = cfg;
            var b = new Battle(cfg);
            b.mount();
            IslandBattle.current = b;
            return b;
        },
        // 決戦で全員倒れたあと：同じ段階を最初からやり直す（設定はそのまま。罰なし）
        retry: function () {
            if (!IslandBattle.lastCfg) return null;
            IslandBattle.retries++;
            return IslandBattle.start(IslandBattle.lastCfg);
        },
        // 中盤・後半の結果で、f.battle_state の絆ゲージを足す（n を省くと満タン）
        addBond: function (state, n) {
            if (!state) return;
            var max = num(state.bondMax, RULES.bondMax.final);
            state.bond = n == null ? max : Math.min(max, num(state.bond, 0) + n);
        },
        makeHero: function (f, mode) { return makeHero(f || gameVars(), RULES, mode); },
        makePartner: function (id, f) { return makePartner(id, f || gameVars(), RULES); },
    };
})();
