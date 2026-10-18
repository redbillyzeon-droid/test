/*
 * day_ui/day_ui.js：1日の流れの画面の試作（行動を選ぶ画面、一覧、探索マップ、結果のカード、1日のまとめ、状態画面）
 *
 * 計算は rules.js（LIRules）、自動セーブは day_save.js（DaySave）。この file は画面だけ。
 * 中身・クリック数は docs/game/design/screens.md 2・5章、見た目と座標は docs/game/menu-ui.md、文は script/ui_text.md。
 * 絵は仮の図形（顔はヒロインの色の四角と名前）。
 *
 * .ks からの使い方（data/scenario/day_test.ks）：
 *   [loadjs storage="day_ui/rules.js"] [loadjs storage="day_ui/day_save.js"] [loadjs storage="day_ui/day_ui.js"]
 *   [iscript] DayUI.init({ storage: "day_test.ks" }); [endscript]
 *   *day_begin
 *   [li_autosave slot="A"]
 *   [iscript] DayUI.beginDay(); [endscript]
 *   *day_screen
 *   [iscript] DayUI.show(); [endscript]
 *   [s]
 * 行動がすべて終わると、まとめ →［次の日へ］で f.day を +1 し、.ks のラベル（*day_begin・*day13・*day14）へ飛ぶ。
 */
(function () {
    "use strict";
    // [loadjs] は .ks を通るたびに読み直すので、2回目からは何もしない（前のものに付けたイベントが二重に動くのを防ぐ）
    if (window.DayUI) return;

    var R = function () { return window.LIRules; };
    var TX = function () { return window.LIRules.TEXT; };

    // ヒロインの色（adv-ui.md の表：主の色・名前の札の地・棒の色）
    var COLOR = {
        konoha: { main: "#d9822b", tag: "#ffd9a8", bar: "#f0a050" },
        noctia: { main: "#7a1e34", tag: "#f3c6cf", bar: "#c23a5a" },
        kabane: { main: "#cfc3a0", tag: "#f4eedd", bar: "#e3d6ae" },
        hakuren: { main: "#e9e9ef", tag: "#ffffff", bar: "#c9c9d6" },
        ignia: { main: "#b5432f", tag: "#f2c2b0", bar: "#d8694f" },
    };

    // 行動の説明の帯（ui_text.md に無い。試作の仮の文）
    var ACT_DESC = {
        explore: "探索：エリアを選んで素材を集める。ヒロインを1人誘える",
        spend: "ヒロインと過ごす：会える人と二人きりで、またはみんなで過ごす",
        build: "建てる・作る：素材で施設を建て、道具を作る。施設は誰かと一緒に建てられる",
        train: "鍛える：朝はハクレンと稽古（力）、夜はノクティアと薬の勉強（知恵）",
        rest: "休む：体力を回復する",
    };

    var HEART_SVG = '<svg viewBox="0 0 32 32" class="du-svg"><path d="M16 28 C 4 19 2 13 4 8.5 C 6 4 12 3.5 16 9 C 20 3.5 26 4 28 8.5 C 30 13 28 19 16 28 Z" fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round"/><path d="M12 10 L 17 16 L 14 19 L 19 24" fill="none" stroke="#f0c43a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var GIFT_BADGE = '<span class="du-gbadge"><svg viewBox="0 0 20 20"><rect x="5" y="8" width="10" height="8" rx="2" fill="#fff"/><path d="M10 8 L 6 4 L 8 8 Z M10 8 L 14 4 L 12 8 Z" fill="#fff"/></svg></span>';

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }
    function stop(e) { e.stopPropagation(); }
    function guard(node) {
        ["click", "mousedown", "mouseup", "touchstart", "contextmenu"].forEach(function (ev) { node.addEventListener(ev, stop); });
    }
    function onClick(node, fn) {
        node.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); fn(e); });
        return node;
    }
    function markEl(kind, size) {
        var m = el("span", "du-mark " + kind + " s" + (size || 28));
        if (kind === "heart" || kind === "gift") m.innerHTML = HEART_SVG + (kind === "gift" ? GIFT_BADGE : "");
        else if (kind === "day9") m.textContent = TX().stage5From9Tag;
        return m;
    }
    function face(name, size, extraCls) {
        var c = COLOR[name];
        var e = el("div", "du-face" + (extraCls ? " " + extraCls : ""));
        e.dataset.name = name;
        e.style.width = e.style.height = size + "px";
        e.style.background = "linear-gradient(160deg, " + c.main + ", #222)";
        var lab = el("span", "du-face-label", R().NAME[name].charAt(0));
        e.appendChild(lab);
        return e;
    }
    function nameTag(name) {
        var t = el("span", "du-nametag", R().NAME[name]);
        t.style.background = COLOR[name].tag;
        return t;
    }
    function diamonds(s, size) {
        var w = el("span", "du-dias s" + (size || 22));
        for (var i = 1; i <= 5; i++) {
            var d = el("i", "du-dia");
            if (i <= s) d.classList.add(i >= 4 ? "gold" : "white");
            if (i <= s && i === 5) d.classList.add("double");
            w.appendChild(d);
        }
        return w;
    }
    function barEl(name, affVal, s, extra) {
        var b = R().bar(affVal, s);
        var w = el("span", "du-bar");
        if (!b) return w;
        for (var i = 0; i < 10; i++) {
            var c = el("i", "du-cell");
            if (i < b.cells) {
                c.classList.add("on");
                c.style.background = b.full ? "#f0c43a" : COLOR[name].bar;
                if (extra && i >= extra.from) c.classList.add("new");
            }
            w.appendChild(c);
        }
        if (b.full) w.classList.add("full");
        return w;
    }
    function slotTag(slot, on) {
        var t = el("span", "du-slottag " + slot + (on ? " on" : ""), R().SLOT_LABEL[slot]);
        return t;
    }

    var DayUI = {
        storage: "day_test.ks",
        layer: null,
        mode: null,       // "actions" | "summary" | "day14" | null
        sub: null,        // 開いている一覧など（"spend" | "explore" | "map" | "build" | "helpers" | "card" | "load"）
        statusOpen: false,
        lineCache: null,

        f: function () { return window.TYRANO.kag.stat.f; },
        kag: function () { return window.TYRANO.kag; },

        init: function (opts) {
            opts = opts || {};
            if (opts.storage) this.storage = opts.storage;
            var base = document.querySelector(".tyrano_base") || document.body;
            if (!this.layer || !this.layer.parentNode) {
                this.layer = el("div", "du-layer");
                base.appendChild(this.layer);
            }
            if (window.DaySave) window.DaySave.install();
            if (!this.listening) {
                this.listening = true;
                var self = this;
                // セーブを読み込むときは、開いている画面を全部閉じる（画面は .ks の DayUI.show() で開き直す）
                this.kag().on("load-start", function () { self.closeAll(); });
                // 手動セーブ（行動を選ぶ画面・まとめで、[s] で止まっているところ）を読み込んだときは、
                // シナリオが先へ進まないので、ここで画面を開き直す。
                // ティラノ Ver6.00 では、手動セーブの読み込みで "load-complete" が来なかった（試した）。
                // そこで "load-beforemaking"（make.ks を呼ぶ直前）から少し待って、まだ画面が無ければ開く
                this.kag().on("load-beforemaking", function () {
                    setTimeout(function () {
                        var f = self.f();
                        if (self.mode || self.kag().stat.current_scenario !== self.storage) return;
                        if (Number(f.day) <= 12 && (f.du_mode === "actions" || f.du_mode === "summary")) self.show();
                    }, 400);
                });
            }
            return this;
        },

        // ---- 状態 ----
        isBusy: function () { return this.statusOpen || !!this.sub; },

        // 1日の画面（day_test.ks）を使っている間だけ true。会話・戦闘のテストでは、セーブの停止や f の初期値の書き足しをしない
        active: function () {
            var k = window.TYRANO && window.TYRANO.kag;
            return !!(k && k.stat.current_scenario === this.storage);
        },

        closeAll: function () {
            if (this.layer) this.layer.innerHTML = "";
            this.lineCache = null; // セーブを読み込んだときも、1行を計算し直す
            this.mode = null;
            this.sub = null;
            this.statusOpen = false;
            if (window.AdvUI && window.AdvUI.opsLayer) window.AdvUI.opsLayer.classList.remove("du-hide-ops");
            if (window.AdvUI && window.AdvUI.setNextLine) window.AdvUI.setNextLine(null);
        },

        clearScreen: function () {
            this.layer.innerHTML = "";
            this.sub = null;
            this.statusOpen = false;
        },

        jump: function (target, storage) {
            var k = this.kag();
            k.cancelStrongStop();
            k.ftag.startTag("jump", { storage: storage || this.storage, target: target });
        },

        // ---- 1日の始まりと、画面を開く ----

        // その日の朝（自動セーブのあと）：時間帯を最初の自由行動に、朝の記録を取る
        beginDay: function () {
            var f = R().defaults(this.f());
            f.slot = R().firstFreeSlot(Number(f.day)) || "morning";
            f.day_start = R().snapshot(f);
            f.du_mode = "actions";
            this.lineCache = null;
        },

        // いまの f.du_mode の画面を開く（セーブを読み込んだあとも、ここで開き直す）
        show: function () {
            var f = R().defaults(this.f());
            if (!f.day_start) f.day_start = R().snapshot(f);
            if (f.du_mode === "summary") this.openSummary();
            else this.openActions();
        },

        // ---- 行動を選ぶ画面（screens.md 5-2、menu-ui.md 2章） ----
        openActions: function () {
            var self = this, f = this.f(), Rr = R();
            this.clearScreen();
            this.mode = "actions";
            f.du_mode = "actions";
            if (window.AdvUI) {
                window.AdvUI.show();
                window.AdvUI.setDate(f.day, f.slot, f.weather, null);
                window.AdvUI.opsLayer.classList.add("du-hide-ops");
                window.AdvUI.setNextLine(this.currentLine(), this.lineKind);
                window.AdvUI.setStatusButton(true);
            }
            var root = el("div", "du-actions");
            root.appendChild(el("div", "du-dim"));
            guard(root);

            var meet = Rr.meetList(f.slot, f.weather);
            var anyHeartSpend = meet.some(function (k) { return Rr.markNow(f, k) === "heart"; });

            var acts = el("div", "du-acts");
            var trainLabel = f.slot === "morning" ? "鍛える：ハクレンと稽古" : f.slot === "night" ? "鍛える：薬の勉強" : "鍛える";
            var list = [
                { id: "explore", label: "探索" },
                { id: "spend", label: "ヒロインと過ごす", heart: anyHeartSpend },
                { id: "build", label: "建てる・作る" },
                { id: "train", label: trainLabel, heart: f.slot === "morning" && Rr.markNow(f, "hakuren") === "heart", disabled: f.slot === "noon" },
                { id: "rest", label: "休む" },
            ];
            var desc = el("div", "du-desc", "");
            list.forEach(function (a) {
                var b = el("div", "du-act du-big");
                b.dataset.act = a.id;
                b.appendChild(el("span", "du-act-icon " + a.id));
                b.appendChild(el("span", "du-act-label", a.label));
                if (a.heart) {
                    var tag = el("span", "du-evtag");
                    tag.appendChild(markEl("heart", 32));
                    tag.appendChild(el("span", "", TX().small.eventHere));
                    b.appendChild(tag);
                }
                if (a.disabled) {
                    b.classList.add("disabled");
                    b.appendChild(el("span", "du-why", TX().small.noonTrain));
                } else {
                    onClick(b, function () { self.onAction(a.id); });
                }
                b.addEventListener("mouseenter", function () { desc.textContent = ACT_DESC[a.id]; });
                acts.appendChild(b);
            });
            root.appendChild(acts);

            // いま会える（中央の横）
            var box = el("div", "du-meet");
            box.appendChild(el("div", "du-meet-title", TX().canMeetNow));
            var faces = el("div", "du-meet-faces");
            meet.forEach(function (k) {
                var w = el("div", "du-meet-one");
                var fc = face(k, 84);
                fc.style.height = "100px";
                var m = Rr.markNow(f, k);
                if (m) { var mk = markEl(m, 24); mk.classList.add("du-face-mark"); fc.appendChild(mk); }
                w.appendChild(fc);
                w.appendChild(el("div", "du-meet-name", Rr.NAME[k]));
                faces.appendChild(w);
            });
            box.appendChild(faces);
            root.appendChild(box);
            root.appendChild(desc);

            // すみ：セーブ・ロード・設定
            var sys = el("div", "du-sys");
            [["セーブ", function () { window.DaySave.openSave(); }], ["ロード", function () { self.openLoad(); }],
                ["設定", function () { window.DaySave.toast("（試作：設定の画面はまだない）"); }]].forEach(function (p) {
                sys.appendChild(onClick(el("div", "du-small", p[0]), p[1]));
            });
            sys.appendChild(onClick(el("div", "du-small du-exit", "テストのメニュー"), function () { self.exit(); }));
            root.appendChild(sys);
            this.layer.appendChild(root);
            this.actionsRoot = root;
        },

        // 「次にやること」の1行。同じ日・時間帯の間は同じ行を出す（H9 は出したときに1回だけと記録する）
        currentLine: function () {
            var f = this.f();
            var key = f.day + "_" + f.slot;
            if (!this.lineCache || this.lineCache.key !== key) {
                var line = R().nextLine(f, f.next_hint_script || "");
                if (line.kind === "H9") f.hint_day9_shown = 1;
                this.lineCache = { key: key, line: line };
            }
            this.lineKind = this.lineCache.line.kind;
            return this.lineCache.line.text;
        },

        onAction: function (id) {
            if (id === "spend") return this.openSpend();
            if (id === "explore") return this.openInvite();
            if (id === "build") return this.openBuild();
            var f = this.f();
            if (id === "train") {
                var r = R().applyTrain(f);
                if (!r) return;
                if (r.kind === "train") return this.showCard(this.spendCard(r, "ハクレンと稽古した", ["力 +1", "稽古 +1"]));
                return this.showCard({ title: "ノクティアと薬の勉強をした", lines: ["ノクティア +3", "知恵 +1"] });
            }
            if (id === "rest") {
                var rr = R().applyRest(f);
                return this.showCard({ title: "休んだ", lines: ["体力 +" + rr.delta + "（" + rr.hp + "／10）"] });
            }
        },

        // ---- 一覧のパネル（menu-ui.md 2-1） ----
        panel: function (kind, title) {
            var self = this;
            if (this.panelEl && this.panelEl.parentNode) this.panelEl.parentNode.removeChild(this.panelEl);
            this.sub = kind;
            if (this.actionsRoot) {
                this.actionsRoot.classList.add("panel-open");
                var acts = this.actionsRoot.querySelectorAll(".du-act");
                var map = { spend: "spend", invite: "explore", build: "build", helpers: "build" };
                Array.prototype.forEach.call(acts, function (a) { a.classList.toggle("on", a.dataset.act === map[kind]); });
            }
            var p = el("div", "du-panel");
            p.dataset.kind = kind;
            guard(p);
            p.appendChild(el("div", "du-panel-title", title));
            var body = el("div", "du-panel-body");
            p.appendChild(body);
            var back = onClick(el("div", "du-btn du-back", "戻る"), function () { self.closePanel(); });
            p.appendChild(back);
            p.addEventListener("contextmenu", function (e) { e.preventDefault(); self.closePanel(); });
            this.actionsRoot.appendChild(p);
            this.panelEl = p;
            return body;
        },
        closePanel: function () {
            if (this.panelEl && this.panelEl.parentNode) this.panelEl.parentNode.removeChild(this.panelEl);
            this.panelEl = null;
            this.sub = null;
            if (this.actionsRoot) {
                this.actionsRoot.classList.remove("panel-open");
                Array.prototype.forEach.call(this.actionsRoot.querySelectorAll(".du-act"), function (a) { a.classList.remove("on"); });
            }
        },

        // 過ごす相手の一覧
        openSpend: function () {
            var self = this, f = this.f(), Rr = R();
            var body = this.panel("spend", "誰と過ごす？");
            var meet = Rr.meetList(f.slot, f.weather);
            meet.forEach(function (k) {
                var row = el("div", "du-row");
                row.dataset.name = k;
                var hit = el("div", "du-row-main");
                hit.appendChild(face(k, 64));
                var nm = el("span", "du-row-name", Rr.NAME[k]);
                nm.style.color = COLOR[k].tag;
                hit.appendChild(nm);
                var st = el("span", "du-row-stage");
                st.appendChild(diamonds(Number(f["ev_" + k]), 16));
                st.appendChild(el("span", "du-row-stagetext", TX().stage[Number(f["ev_" + k])]));
                hit.appendChild(st);
                var m = Rr.markNow(f, k);
                var mcell = el("span", "du-row-mark");
                if (m === "heart") mcell.appendChild(markEl("heart", 32)); // 好物つきの印は［過ごす］には出さない
                hit.appendChild(mcell);
                onClick(hit, function () { self.doSpend(k, false); });
                row.appendChild(hit);
                var right = el("div", "du-row-right");
                var rainNoon = k === "noctia" && f.slot === "noon";
                if (Rr.hasGift(f, k)) {
                    var gb = el("div", "du-giftbtn");
                    gb.appendChild(el("span", "du-gicon " + Rr.GIFT[k].have));
                    var gl = el("span", "du-glabel");
                    gl.appendChild(el("b", "", TX().gift.button));
                    gl.appendChild(el("small", "", m === "gift" ? TX().gift.marked : Rr.fmt(TX().gift.sub, { gift: Rr.GIFT[k].label })));
                    gb.appendChild(gl);
                    if (m === "gift") gb.appendChild(markEl("gift", 28));
                    onClick(gb, function () { self.doSpend(k, true); });
                    right.appendChild(gb);
                    if (rainNoon) right.appendChild(el("div", "du-note small", TX().small.rainNoon));
                } else if (rainNoon) {
                    right.appendChild(el("div", "du-note", TX().small.rainNoon));
                }
                row.appendChild(right);
                body.appendChild(row);
            });
            var all = el("div", "du-row du-row-all");
            var hitAll = el("div", "du-row-main");
            var faces = el("span", "du-mini-faces");
            meet.forEach(function (k) { faces.appendChild(face(k, 40)); });
            hitAll.appendChild(faces);
            hitAll.appendChild(el("span", "du-row-name", "みんなと過ごす"));
            hitAll.appendChild(el("span", "du-note", "段階のイベントは起きない"));
            onClick(hitAll, function () {
                var r = Rr.applyAll(f);
                self.showCard({ title: "みんなと過ごした", lines: [r.who.map(function (k) { return Rr.NAME[k]; }).join("・") + " +" + r.delta] });
            });
            all.appendChild(hitAll);
            body.appendChild(all);
        },

        doSpend: function (name, withGift) {
            var r = R().applySpend(this.f(), name, withGift);
            var title = withGift ? R().GIFT[name].label + "を渡して、" + R().NAME[name] + "と過ごした" : R().NAME[name] + "と過ごした";
            this.showCard(this.spendCard(r, title, []));
        },

        spendCard: function (r, title, extra) {
            var lines = [];
            if (r.event) lines.push("（段階" + r.stage + "のイベント。試作では場面を省略）");
            lines = lines.concat(r.lines || []).concat(extra || []);
            var card = { title: title, lines: lines, gold: [] };
            if (r.event) card.gold.push(R().NAME[r.name] + "：" + TX().stage[r.stage]);
            if (r.mindUp) card.mind = TX().mindUp;
            card.stageUp = !!r.event;
            return card;
        },

        // 探索：誰と行く？（5-2）
        openInvite: function () {
            var self = this, f = this.f(), Rr = R();
            var body = this.panel("invite", "誰と行く？");
            var solo = el("div", "du-row");
            solo.dataset.name = "";
            var hit = el("div", "du-row-main");
            hit.appendChild(el("span", "du-row-name", "一人で行く"));
            onClick(hit, function () { self.openMap(null); });
            solo.appendChild(hit);
            body.appendChild(solo);
            Rr.meetList(f.slot, f.weather).forEach(function (k) {
                var row = el("div", "du-row");
                row.dataset.name = k;
                var h = el("div", "du-row-main");
                h.appendChild(face(k, 64));
                var nm = el("span", "du-row-name", Rr.NAME[k]);
                nm.style.color = COLOR[k].tag;
                h.appendChild(nm);
                h.appendChild(el("span", "du-note", Rr.fmt(TX().map.specialty, { item: Rr.SPECIALTY[k].label })));
                h.appendChild(el("span", "du-note du-right", TX().small.exploreInvite));
                onClick(h, function () { self.openMap(k); });
                row.appendChild(h);
                body.appendChild(row);
            });
        },

        // 探索マップ（5-3、menu-ui.md 4章）。札の配置と「初めて」の札・「？」の枠まで
        openMap: function (partner) {
            var self = this, f = this.f(), Rr = R();
            this.closePanel();
            this.sub = "map";
            var m = el("div", "du-map " + f.slot);
            guard(m);
            m.addEventListener("contextmenu", function (e) { e.preventDefault(); m.parentNode.removeChild(m); self.sub = null; });
            m.appendChild(el("div", "du-map-title", "どこへ行く？"));
            Rr.AREAS.forEach(function (a) {
                var c = el("div", "du-area");
                c.dataset.area = a.id;
                c.style.left = a.x + "px";
                c.style.top = a.y + "px";
                var card = el("div", "du-area-card");
                if (Rr.areaHidden(f, a.id)) {
                    c.classList.add("du-unknown");  // "hidden" はティラノの CSS で表示が消えるので使わない
                    card.textContent = "？？？";
                    c.appendChild(card);
                    m.appendChild(c);
                    return;
                }
                card.appendChild(el("span", "du-area-name", a.label));
                c.appendChild(card);
                var open = Rr.areaOpen(f, a.id);
                if (a.battle) card.appendChild(el("span", "du-claw", "///"));
                var mats = el("div", "du-mats");
                a.mats.forEach(function (x) { mats.appendChild(el("span", "du-mat", x.charAt(0))); });
                if (open && Rr.areaFirst(f, a.id) && a.firstSure) mats.appendChild(el("span", "du-qbox", "？"));
                c.appendChild(mats);
                var who = el("div", "du-area-who");
                Object.keys(a.meet).forEach(function (k) {
                    if (k !== partner && a.meet[k].indexOf(f.slot) >= 0) who.appendChild(face(k, 40));
                });
                if (open) c.appendChild(who); // 行けないエリアには、会えそうな人を出さない（試作で決めた）
                if (!open) {
                    c.classList.add("locked");
                    c.appendChild(el("div", "du-area-lock", Rr.areaLockText(f, a.id)));
                } else {
                    if (Rr.areaFirst(f, a.id)) c.appendChild(el("span", "du-first", TX().map.first));
                    onClick(c, function () {
                        var r = Rr.applyExplore(f, a.id, partner);
                        if (m.parentNode) m.parentNode.removeChild(m);
                        self.sub = null;
                        self.showCard({ title: a.label + "を探索した", lines: r.lines });
                    });
                }
                m.appendChild(c);
            });
            var with_ = el("div", "du-map-with", partner ? "同行：" + Rr.NAME[partner] : "一人で行く");
            m.appendChild(with_);
            m.appendChild(onClick(el("div", "du-btn du-back", "戻る"), function () {
                if (m.parentNode) m.parentNode.removeChild(m);
                self.sub = null;
                self.openInvite();
            }));
            this.actionsRoot.appendChild(m);
        },

        // 建てる一覧（5-2、menu-ui.md 2-1）
        openBuild: function () {
            var self = this, f = this.f(), Rr = R();
            var body = this.panel("build", "建てる・作る");
            body.classList.add("du-grid");
            Rr.buildList(f).forEach(function (row) {
                var r = el("div", "du-brow " + row.kind + (row.ok ? "" : " short"));
                r.dataset.id = row.id;
                r.dataset.kind = row.kind;
                r.appendChild(el("span", "du-brow-name", row.label));
                var cost = el("span", "du-brow-cost");
                Object.keys(row.cost).forEach(function (k) {
                    var have = Number(f[k] || 0), need = row.cost[k];
                    cost.appendChild(el("span", "du-cost" + (have < need ? " lack" : ""),
                        have < need ? Rr.fmt(TX().small.short, { item: Rr.ITEM_LABEL[k], n: need - have }) : Rr.ITEM_LABEL[k] + " " + Math.min(have, need) + "/" + need));
                });
                if (row.needBench) cost.appendChild(el("span", "du-cost lack", "作業台が要る"));
                r.appendChild(cost);
                if (row.kind === "facility" && row.yukari) {
                    var y = el("span", "du-yukari-mini");
                    var fc = face(row.yukari, 32);
                    if (!Rr.canMeet(row.yukari, f.slot, f.weather)) fc.classList.add("away");
                    y.appendChild(fc);
                    var tag = el("span", "du-yukari", TX().build.yukari);
                    tag.style.borderLeftColor = COLOR[row.yukari].main;
                    y.appendChild(tag);
                    if (!Rr.canMeet(row.yukari, f.slot, f.weather)) {
                        Rr.SLOTS.filter(function (s) { return Rr.canMeet(row.yukari, s, f.weather); }).forEach(function (s) { y.appendChild(slotTag(s, true)); });
                    }
                    r.appendChild(y);
                }
                if (row.ok) {
                    onClick(r, function () {
                        if (row.kind === "tool") {
                            var res = Rr.applyBuild(f, "tool", row.id, []);
                            self.showCard(self.buildCard(res, row));
                        } else self.openHelpers(row);
                    });
                }
                body.appendChild(r);
            });
        },

        // 「誰と建てる？」「誰と直す？」（menu-ui.md 2-2）
        openHelpers: function (row) {
            var self = this, f = this.f(), Rr = R();
            var repair = row.kind === "repair";
            var t = TX().build;
            var body = this.panel("helpers", repair ? t.titleRepair : t.title);
            var d = Rr.buildHelpersDefault(f, row.kind, row.id);
            var sel = d.selected.slice();
            var head = el("div", "du-h-head");
            head.appendChild(el("span", "du-h-fac", row.label + "（" + Object.keys(row.cost).map(function (k) { return Rr.ITEM_LABEL[k] + " " + row.cost[k]; }).join("・") + "）"));
            var count = el("span", "du-hcount");
            head.appendChild(count);
            body.appendChild(head);
            var cards = el("div", "du-hcards");
            var okBtn;
            function render() {
                count.innerHTML = "";
                if (sel.length === 0) count.textContent = repair ? t.aloneRepair : t.alone;
                else { count.appendChild(document.createTextNode("手伝い ")); count.appendChild(el("b", "", String(sel.length))); count.appendChild(document.createTextNode("／2")); }
                Array.prototype.forEach.call(cards.children, function (c) { c.classList.toggle("sel", sel.indexOf(c.dataset.name) >= 0); });
            }
            d.candidates.forEach(function (k) {
                var c = el("div", "du-hcard");
                c.dataset.name = k;
                c.appendChild(face(k, 140));
                c.appendChild(nameTag(k));
                if (d.yukari === k) {
                    var y = el("span", "du-yukari", t.yukari);
                    y.style.borderLeftColor = COLOR[k].main;
                    c.appendChild(y);
                }
                if (k === "kabane") c.appendChild(el("span", "du-strtag", "力 +1"));
                c.appendChild(el("span", "du-check", "✓"));
                c.appendChild(el("span", "du-help", "手伝う"));
                if (d.locked.indexOf(k) >= 0) c.classList.add("locked");
                onClick(c, function () {
                    var i = sel.indexOf(k);
                    if (i >= 0) {
                        if (d.locked.indexOf(k) >= 0) { c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); return; }
                        sel.splice(i, 1);
                    } else if (sel.length >= 2) {
                        count.classList.remove("flash"); void count.offsetWidth; count.classList.add("flash");
                        return;
                    } else sel.push(k);
                    render();
                });
                cards.appendChild(c);
            });
            body.appendChild(cards);
            body.appendChild(el("div", "du-h-note", repair ? t.noteRepair : t.note));
            okBtn = onClick(el("div", "du-btn du-hok", repair ? t.okRepair : t.ok), function () {
                var res = Rr.applyBuild(f, row.kind, row.id, sel);
                self.showCard(self.buildCard(res, row));
            });
            body.appendChild(okBtn);
            render();
        },

        buildCard: function (res, row) {
            var Rr = R(), lines = [];
            Object.keys(row.cost).forEach(function (k) { lines.push(Rr.ITEM_LABEL[k] + " −" + row.cost[k]); });
            if (res.helpers && res.helpers.length) lines.push(res.helpers.map(function (h) { return Rr.NAME[h.name] + " +" + h.delta; }).join("、"));
            if (res.strUp) lines.push("力 +1");
            (res.lines || []).forEach(function (l) { lines.push(l); });
            var card = { title: res.label, lines: lines, gold: [] };
            if (res.devAfter !== res.devBefore) card.gold.push("島の発展度 " + res.devBefore + " → " + res.devAfter);
            return card;
        },

        // ---- 結果のカード（5-4）。クリック1回で閉じて次の時間帯へ ----
        showCard: function (card) {
            var self = this;
            this.closePanel();
            this.sub = "card";
            var wrap = el("div", "du-cardwrap");
            guard(wrap);
            var c = el("div", "du-card" + (card.stageUp ? " joined" : ""));
            c.appendChild(el("div", "du-card-title", card.title));
            (card.lines || []).forEach(function (l) { c.appendChild(el("div", "du-card-line", l)); });
            (card.gold || []).forEach(function (l) { c.appendChild(el("div", "du-card-line gold", l)); });
            if (card.mind) c.appendChild(el("div", "du-card-line mind", card.mind));
            c.appendChild(el("div", "du-card-next", "クリックで次へ"));
            wrap.appendChild(c);
            onClick(wrap, function () { self.afterAction(); });
            this.actionsRoot.appendChild(wrap);
        },

        afterAction: function () {
            var f = this.f();
            var next = R().nextFreeSlot(Number(f.day), f.slot);
            if (next) { f.slot = next; this.openActions(); }
            else this.openSummary();
        },

        // ---- 1日のまとめ（5-5、menu-ui.md 5章） ----
        openSummary: function () {
            var self = this, f = this.f(), Rr = R();
            this.clearScreen();
            this.mode = "summary";
            f.du_mode = "summary";
            if (window.AdvUI) { window.AdvUI.hide(); }
            var S = Rr.summary(f);
            if (S.warnings.some(function (w) { return w.kind === "K3"; })) f.warn_all_lost = 1;
            var root = el("div", "du-summary");
            guard(root);
            root.appendChild(el("div", "du-sum-title", S.title));
            var days = el("div", "du-days");
            for (var d = 1; d <= 14; d++) {
                var c = el("span", "du-dcell" + (d < f.day ? " done" : d === Number(f.day) ? " now" : "") + (d === 14 ? " final" : ""), String(d));
                if (d === 8) c.dataset.top = "発表";
                if (d === 14) c.dataset.top = "決戦";
                days.appendChild(c);
            }
            root.appendChild(days);
            root.appendChild(el("div", "du-sum-left", "GM との勝負まで あと" + S.left + "日"));

            function box(cls, title) {
                var b = el("div", "du-sum-box " + cls);
                b.appendChild(el("div", "du-sum-boxtitle", title));
                root.appendChild(b);
                return b;
            }
            var got = box("got", "手に入れたもの");
            if (!S.got.length) got.appendChild(el("div", "du-none", "なし"));
            S.got.forEach(function (g) { got.appendChild(el("div", "du-sum-line", g.label + " +" + g.n)); });
            var built = box("built", "建てたもの・作ったもの");
            if (!S.built.length) built.appendChild(el("div", "du-none", "なし"));
            S.built.forEach(function (b) { built.appendChild(el("div", "du-sum-line", b)); });
            if (S.devAfter !== S.devBefore) built.appendChild(el("div", "du-sum-line gold", "島の発展度 " + S.devBefore + " → " + S.devAfter));
            var mates = box("mates", "仲間");
            if (!S.mates.length) mates.appendChild(el("div", "du-none", "なし"));
            S.mates.forEach(function (m) {
                var r = el("div", "du-sum-mate" + (m.stageUp && m.stage >= 4 ? " joined" : ""));
                r.dataset.name = m.name;
                r.appendChild(face(m.name, 56));
                r.appendChild(nameTag(m.name));
                if (m.cells != null) r.appendChild(barEl(m.name, Number(f["aff_" + m.name]), m.stage, { from: m.cellsBefore }));
                else r.appendChild(el("span", "du-gold", TX().stage[5]));
                if (m.stageUp) r.appendChild(el("div", "du-sum-stage", Rr.NAME[m.name] + "：" + m.stageText));
                mates.appendChild(r);
            });
            var yu = box("yu", "ユウ");
            S.yu.forEach(function (l) { yu.appendChild(el("div", "du-sum-yu", l)); });
            yu.appendChild(el("div", "du-sum-yu", "体力 " + S.hp + "／10"));
            var rest = el("div", "du-sum-rest");
            rest.appendChild(document.createTextNode("明日からの行動　"));
            ["morning", "noon", "night"].forEach(function (s, i) {
                rest.appendChild(slotTag(s, true));
                rest.appendChild(document.createTextNode(String(S.R[s]) + (i < 2 ? "・" : "")));
            });
            // 明日からの行動と警告は、下の帯の上にそろえて縦に積む。警告が長いときは上へのびる（切らない）
            var bottom = el("div", "du-sum-bottom");
            bottom.appendChild(rest);
            root.appendChild(bottom);
            var warn = el("div", "du-sum-warn");
            S.warnings.forEach(function (w) {
                var b = el("div", "du-warn " + w.kind);
                b.dataset.kind = w.kind;
                w.lines.forEach(function (l) { b.appendChild(el("div", "", l)); });
                warn.appendChild(b);
            });
            bottom.appendChild(warn);
            root.appendChild(onClick(el("div", "du-btn du-sum-save", "セーブ"), function () { window.DaySave.openSave(); }));
            root.appendChild(onClick(el("div", "du-btn du-sum-detail", "くわしく"), function () { self.openStatus(); }));
            root.appendChild(onClick(el("div", "du-btn du-big du-sum-next", "次の日へ"), function () { self.nextDay(); }));
            onClick(root, function () { self.nextDay(); }); // 画面のどこを押しても次の日へ（ボタンは外す）
            this.layer.appendChild(root);
        },

        nextDay: function () {
            var f = this.f();
            if (this.statusOpen) return;
            f.day = Number(f.day) + 1;
            f.du_mode = "actions";
            f.next_hint_script = "";
            this.closeAll();
            if (f.day <= 12) this.jump("*day_begin");
            else if (f.day === 13) this.jump("*day13");
            else this.jump("*day14");
        },

        // ---- 14日目（手動セーブを止めている画面。試作のテスト用） ----
        showDay14: function () {
            var self = this;
            this.clearScreen();
            this.mode = "day14";
            if (window.AdvUI) window.AdvUI.hide();
            var root = el("div", "du-day14");
            guard(root);
            root.appendChild(el("div", "du-sum-title", "14日目・夜明け前"));
            root.appendChild(el("div", "du-day14-note", "（試作：13日目の場面と決戦は省略。ここから先は手動セーブができない）"));
            var sv = onClick(el("div", "du-btn du-day14-save disabled", "セーブ"), function () { window.DaySave.openSave(); });
            root.appendChild(sv);
            root.appendChild(el("div", "du-day14-why", TX().save.day14));
            root.appendChild(onClick(el("div", "du-btn du-big du-day14-restart", "14日目の朝からやり直す"), function () {
                window.DaySave.restartDay14(function () { self.exit(); });
            }));
            root.appendChild(onClick(el("div", "du-btn du-day14-exit", "テストのメニュー"), function () { self.exit(); }));
            this.layer.appendChild(root);
        },

        // ---- ロード（自動の3枠を上に。menu-ui.md 6-1） ----
        openLoad: function (onBack) {
            var self = this;
            var prevSub = this.sub;
            this.sub = "load";
            var w = el("div", "du-load");
            guard(w);
            w.appendChild(el("div", "du-load-title", "ロード"));
            ["A", "B", "C"].forEach(function (s) {
                var data = window.DaySave.read(s);
                var c = el("div", "du-aslot" + (data ? "" : " empty"));
                c.dataset.slot = s;
                c.appendChild(el("span", "du-auto-tag", "自動"));
                var nm = data ? data.title : window.DaySave.label(s, "?").replace("（?日目・朝）", "");
                c.appendChild(el("div", "du-aslot-name", nm));
                c.appendChild(el("div", "du-aslot-date", data ? data.save_date : "まだない"));
                if (data && data.img_data) { var img = el("img", "du-aslot-img"); img.src = data.img_data; c.appendChild(img); }
                c.appendChild(el("span", "du-lock", "🔒"));
                if (data) onClick(c, function () { w.parentNode.removeChild(w); self.sub = null; window.DaySave.load(s); });
                w.appendChild(c);
            });
            w.appendChild(onClick(el("div", "du-btn du-load-manual", "手動の枠"), function () {
                w.parentNode.removeChild(w); self.sub = prevSub; self.kag().menu.displayLoad();
            }));
            w.appendChild(onClick(el("div", "du-btn du-back", "戻る"), function () {
                w.parentNode.removeChild(w); self.sub = prevSub;
                if (typeof onBack === "function") onBack();
            }));
            this.layer.appendChild(w);
        },

        // ---- 状態画面（2章、menu-ui.md 3章） ----
        openStatus: function (tab) {
            var self = this, Rr = R();
            // 1日の画面の外（会話画面の「状態」ボタン）では、f に初期値を書き足さない（写しで見る）
            var f = this.active() ? Rr.defaults(this.f()) : Rr.defaults(JSON.parse(JSON.stringify(this.f())));
            var atSummary = this.active() && f.du_mode === "summary";
            if (this.statusEl && this.statusEl.parentNode) this.statusEl.parentNode.removeChild(this.statusEl);
            this.statusOpen = true;
            var w = el("div", "du-status");
            guard(w);
            w.addEventListener("contextmenu", function (e) { e.preventDefault(); self.closeStatus(); });
            var tabs = el("div", "du-tabs");
            [["mates", "仲間"], ["yu", "ユウと島"]].forEach(function (t) {
                var b = el("div", "du-tab" + ((tab || "mates") === t[0] ? " on" : ""), t[1]);
                b.dataset.tab = t[0];
                onClick(b, function () { self.openStatus(t[0]); });
                tabs.appendChild(b);
            });
            w.appendChild(tabs);
            w.appendChild(onClick(el("div", "du-btn du-close", "×"), function () { self.closeStatus(); }));
            var Rn = Rr.statusRemaining(f, atSummary);
            var top = el("div", "du-st-top");
            top.appendChild(el("b", "", f.day + "日目・" + Rr.SLOT_LABEL[f.slot]));
            var left = el("span", "");
            left.appendChild(document.createTextNode("GM との勝負まで あと"));
            left.appendChild(el("em", "", String(Math.max(0, 14 - Number(f.day)))));
            left.appendChild(document.createTextNode("日"));
            top.appendChild(left);
            var rr = el("span", "");
            rr.appendChild(document.createTextNode("残りの行動 "));
            ["morning", "noon", "night"].forEach(function (s, i) { rr.appendChild(slotTag(s, true)); rr.appendChild(document.createTextNode(Rn[s] + (i < 2 ? "・" : ""))); });
            top.appendChild(rr);
            w.appendChild(top);
            if ((tab || "mates") === "mates") this.statusMates(w, f, atSummary);
            else this.statusYu(w, f);
            this.layer.appendChild(w);
            this.statusEl = w;
        },
        closeStatus: function () {
            if (this.statusEl && this.statusEl.parentNode) this.statusEl.parentNode.removeChild(this.statusEl);
            this.statusEl = null;
            this.statusOpen = false;
        },

        statusMates: function (w, f, atSummary) {
            var Rr = R();
            var rows = el("div", "du-st-rows");
            Rr.ORDER.forEach(function (k) {
                var s = Number(f["ev_" + k]);
                var r = el("div", "du-srow" + (s >= 4 ? " joined" : ""));
                r.dataset.name = k;
                var fc = face(k, 76);
                fc.style.filter = s <= 1 ? "saturate(.8)" : s === 2 ? "saturate(.9)" : "";
                r.appendChild(fc);
                r.appendChild(nameTag(k));
                var st = el("div", "du-st-stage");
                st.appendChild(diamonds(s, 22));
                var words = TX().stage[s];
                if (s === 4) {
                    var p = el("div", "du-st-words gold");
                    p.appendChild(document.createTextNode("心が通った"));
                    p.appendChild(el("small", "", "（決戦の相棒になれる）"));
                    st.appendChild(p);
                } else st.appendChild(el("div", "du-st-words" + (s === 5 ? " gold" : ""), words));
                r.appendChild(st);
                var bc = el("div", "du-st-bar");
                if (s >= 5) bc.appendChild(el("div", "du-gold big", TX().stage[5]));
                else {
                    bc.appendChild(el("div", "du-tiny", "次の段階まで"));
                    bc.appendChild(barEl(k, Number(f["aff_" + k]), s));
                    var b = Rr.bar(Number(f["aff_" + k]), s);
                    if (s === 4 && Number(f.day) <= 8 && !b.full) bc.appendChild(el("div", "du-tiny", TX().stage5From9Small));
                }
                r.appendChild(bc);
                var mk = el("div", "du-st-mark");
                var m = Rr.markStatus(f, k);
                if (m) mk.appendChild(markEl(m, 32));
                r.appendChild(mk);
                var sl = el("div", "du-st-slots");
                Rr.SLOTS.forEach(function (x) { sl.appendChild(slotTag(x, Rr.canMeet(k, x, "") || (k === "noctia" && x === "noon" && f.weather === "雨"))); });
                if (k === "noctia") sl.appendChild(el("div", "du-tiny", TX().noctiaRain));
                r.appendChild(sl);
                if (Rr.canMeet(k, f.slot, f.weather)) r.appendChild(el("span", "du-nowtag", TX().canMeetNow));
                rows.appendChild(r);
            });
            w.appendChild(rows);
            var P = Rr.allPanel(f, atSummary);
            var a = el("div", "du-all" + (P.done ? " done" : ""));
            a.appendChild(el("div", "du-all-title", TX().allTitle));
            if (P.done) a.appendChild(el("div", "du-gold big du-all-done", P.text));
            else {
                var l1 = el("div", "du-all-count");
                l1.appendChild(document.createTextNode("あと "));
                l1.appendChild(el("b", "", String(P.sum)));
                l1.appendChild(document.createTextNode(" 回（二人きりで過ごす・ハクレンとの稽古）／残りの行動 "));
                l1.appendChild(el("b", "", String(P.R)));
                l1.appendChild(document.createTextNode(" 回"));
                a.appendChild(l1);
                P.tight.slice(0, 3).forEach(function (t) { a.appendChild(el("div", "du-all-tight", t)); });
                if (P.tight.length > 3) a.appendChild(el("div", "du-all-tight", "ほか " + (P.tight.length - 3) + " 件"));
                if (P.prospect) a.appendChild(el("div", "du-warn du-all-prospect " + P.prospect, P.prospectText));
            }
            a.appendChild(el("div", "du-legend", TX().gift.legend)); // 好物の印の凡例（ui_text.md 8-1）
            w.appendChild(a);
        },

        statusYu: function (w, f) {
            var Rr = R();
            var col = el("div", "du-yu");
            col.appendChild(el("div", "du-yu-title", "ユウ"));
            function line(name, val, max, note, extra) {
                var r = el("div", "du-yu-row");
                r.appendChild(el("span", "du-yu-name", name));
                r.appendChild(el("span", "du-yu-val", val + (max ? "／" + max : "")));
                r.appendChild(el("span", "du-yu-note", note));
                if (extra) r.appendChild(el("span", "du-yu-warn", extra));
                col.appendChild(r);
            }
            line("体力", f.hp, 10, "1日に行動できる回数、戦闘の体力", Number(f.hp) <= 3 ? TX().small.restHint : "");
            line("力", f.str, 10, "戦闘の攻撃と守り、重い素材を運べる");
            line("器用さ", f.dex, 6, "作れる物、料理、薬草の回復量");
            line("知恵", f.wis, 6, "めずらしい物を見つけやすい");
            var tr = el("div", "du-yu-row");
            tr.appendChild(el("span", "du-yu-name", Rr.fmt(TX().small.train, { n: Number(f.train_count || 0) })));
            col.appendChild(tr);
            var items = el("div", "du-items");
            items.appendChild(el("div", "du-yu-title", "持ち物"));
            Object.keys(Rr.ITEM_LABEL).forEach(function (k) {
                if (k.indexOf("gift_") === 0) return;
                var n = Number(f[k] || 0);
                if (n <= 0) return;
                var it = el("span", "du-item", Rr.ITEM_LABEL[k] + " " + n);
                if (k === "item_fish" && !Number(f.gave_fish)) {
                    var ini = el("i", "du-ini", Rr.INITIAL.ignia);
                    ini.style.background = COLOR.ignia.tag;
                    ini.title = Rr.fmt(TX().small.giftOf, { name: Rr.NAME.ignia });
                    it.appendChild(ini);
                }
                items.appendChild(it);
            });
            // 道具（screens.md 2-8 の「素材・道具・好物を数で」）
            Rr.TOOLS.forEach(function (t) {
                if (Number(f["tool_" + t.id])) { var it = el("span", "du-item du-tool", t.label); it.dataset.tool = t.id; items.appendChild(it); }
            });
            col.appendChild(items);
            w.appendChild(col);

            var isl = el("div", "du-island");
            var dv = el("div", "du-dev");
            dv.appendChild(document.createTextNode("島の発展度 "));
            dv.appendChild(el("b", "", String(Rr.devOf(f))));
            dv.appendChild(document.createTextNode("／6"));
            isl.appendChild(dv);
            isl.appendChild(el("div", "du-tiny", TX().small.devNote));
            var facs = el("div", "du-facs");
            Rr.FACILITIES.forEach(function (fa) {
                var built = Number(f["built_" + fa.id]);
                var broken = fa.id === "workbench" && built && Number(f.workbench_broken);
                var c = el("div", "du-fac" + (built ? " built" : "") + (broken ? " broken" : ""));
                c.dataset.id = fa.id;
                c.appendChild(el("b", "", fa.label));
                if (broken) c.appendChild(el("div", "du-fac-note bad", TX().small.broken));
                else if (built) c.appendChild(el("div", "du-fac-note", "建てた"));
                else {
                    c.appendChild(el("div", "du-fac-note", Object.keys(fa.cost).map(function (k) { return Rr.ITEM_LABEL[k] + " " + fa.cost[k]; }).join("・")));
                    var y = el("span", "du-yukari", TX().build.yukari + "：" + Rr.NAME[fa.yukari]);
                    y.style.borderLeftColor = COLOR[fa.yukari].main;
                    c.appendChild(y);
                }
                facs.appendChild(c);
            });
            isl.appendChild(facs);
            // 好物の欄（2-8）：まだ見つけていない好物は「？」と頭文字
            var gifts = el("div", "du-gifts");
            gifts.appendChild(el("div", "du-yu-title", "好物"));
            Rr.ORDER.forEach(function (k) {
                var g = Rr.GIFT[k];
                var gave = Number(f[g.gave]);
                var have = Number(f[g.have]) >= 1 && !gave;
                var c = el("div", "du-gift " + (gave ? "gave" : have ? "have" : "unknown"));
                c.dataset.name = k;
                if (!gave && !have) c.appendChild(el("span", "du-gift-q", "？"));
                else {
                    c.appendChild(el("span", "du-gicon " + g.have));
                    c.appendChild(el("span", "du-gift-name", g.label));
                    if (gave) c.appendChild(el("span", "du-gave", "渡した"));
                }
                var ini = el("i", "du-ini", Rr.INITIAL[k]);
                ini.style.background = COLOR[k].tag;
                c.appendChild(ini);
                c.title = gave ? Rr.fmt(TX().small.gaveTo, { name: Rr.NAME[k] }) : have ? Rr.fmt(TX().small.giftOf, { name: Rr.NAME[k] }) : "";
                gifts.appendChild(c);
            });
            isl.appendChild(gifts);
            w.appendChild(isl);
        },

        // ---- テスト用 ----
        exit: function () {
            this.closeAll();
            this.jump("*start", "test_menu.ks");
        },

        // 決まった f を入れる（docs の計画の途中の日）。name は day_test.ks のボタンと同じ
        preset: function (name) {
            var f = this.f();
            Object.keys(f).forEach(function (k) { delete f[k]; });
            var P = PRESETS[name];
            Object.assign(f, JSON.parse(JSON.stringify(P.f)));
            R().defaults(f);
            f.dev = R().devOf(f);
            // 朝の記録：その日の朝の状態（start があれば、それを重ねたもの）
            var s0 = Object.assign({}, f, P.start || {});
            f.day_start = R().snapshot(s0);
            f.du_mode = P.mode || "actions";
            this.lineCache = null;
        },
    };

    // テスト用の決まった f（数字は docs の表から）
    var PRESETS = {
        // life-bond.md 6-2：2日目・昼（作業台を建てる前。2日目はカバネを外せない）
        plan2_noon: { f: { day: 2, slot: "noon", aff_konoha: 5, aff_kabane: 3, aff_hakuren: 3, aff_ignia: 0, aff_noctia: 3,
            item_fish: 2, item_wood: 3, item_shell: 1, next_hint_script: "「建てる・作る」で、作業台を建てられる（木材が3つ必要）" },
            start: { item_fish: 0, item_wood: 0, item_shell: 0, aff_konoha: 2 } },
        // life-bond.md 6-2：2日目・夜（イグニアに魚を渡す回）
        plan2_night: { f: { day: 2, slot: "night", aff_konoha: 5, aff_kabane: 8, aff_hakuren: 3, aff_ignia: 3, aff_noctia: 3,
            item_fish: 2, item_wood: 0, item_shell: 1, built_workbench: 1, str: 2 },
            start: { aff_konoha: 2, aff_kabane: 3, aff_ignia: 0, item_fish: 0, item_shell: 0, built_workbench: 0, str: 1 } },
        // life-bond.md 6-2：9日目・朝（8日目の中間発表のあと）
        plan9: { f: { day: 9, slot: "morning", aff_konoha: 71, aff_kabane: 29, aff_hakuren: 45, aff_ignia: 79, aff_noctia: 81,
            ev_konoha: 3, ev_kabane: 1, ev_hakuren: 2, ev_ignia: 3, ev_noctia: 4, built_workbench: 1, workbench_broken: 1, built_stove: 1,
            gave_fish: 1, gave_red_fruit: 1, item_fish: 1, str: 2, mind: 6, explore_forest: 1, visit_river: 1 } },
        // screens.md 3-3 (b)：9日目・夜（このあと寄り道すると、まとめに K4）
        b9: { f: { day: 9, slot: "night", aff_konoha: 72, aff_kabane: 35, aff_hakuren: 33, aff_ignia: 35, aff_noctia: 35,
            ev_konoha: 4, ev_kabane: 2, ev_hakuren: 2, ev_ignia: 2, ev_noctia: 2, tool_torch: 1, explore_forest: 3, built_workbench: 1, built_stove: 1, built_field: 1 },
            start: { aff_hakuren: 13, ev_hakuren: 1, aff_ignia: 17, ev_ignia: 1 } },
        // screens.md 3-3 (c)：12日目・朝、誰も段階4でない。カバネ s=1 → K1
        c12k1: { f: { day: 12, slot: "morning", aff_konoha: 22, aff_kabane: 20, aff_hakuren: 12, aff_ignia: 14, aff_noctia: 12,
            ev_konoha: 1, ev_kabane: 1, ev_hakuren: 0, ev_ignia: 0, ev_noctia: 0 } },
        // 同じで カバネ s=2 → K2
        c12k2: { f: { day: 12, slot: "morning", aff_konoha: 22, aff_kabane: 40, aff_hakuren: 12, aff_ignia: 14, aff_noctia: 12,
            ev_konoha: 1, ev_kabane: 2, ev_hakuren: 0, ev_ignia: 0, ev_noctia: 0 } },
        // 11日目・夜、誰も段階4でない（カバネ s=1）。このあと寄り道すると、まとめに K1 と K3（5行）が出る
        k1k3: { f: { day: 11, slot: "night", aff_konoha: 22, aff_kabane: 15, aff_hakuren: 2, aff_ignia: 2, aff_noctia: 2,
            ev_konoha: 1, ev_kabane: 1 } },
        // 雨の日の昼（ノクティアに会える。イベントは起きない）。作業台が壊れていて、直せる
        rain5: { f: { day: 5, slot: "noon", weather: "雨", aff_konoha: 29, aff_kabane: 10, aff_hakuren: 25, aff_ignia: 32, aff_noctia: 48,
            ev_konoha: 1, ev_hakuren: 1, ev_ignia: 1, ev_noctia: 2, gift_red_fruit: 1, built_workbench: 1, workbench_broken: 1, item_wood: 4, item_clay: 3 } },
        // life-bond.md 6-2：12日目・昼（全員段階4。このあと13日目・14日目の自動セーブ）
        plan12: { f: { day: 12, slot: "noon", aff_konoha: 84, aff_kabane: 89, aff_hakuren: 80, aff_ignia: 92, aff_noctia: 81,
            ev_konoha: 4, ev_kabane: 4, ev_hakuren: 4, ev_ignia: 4, ev_noctia: 4, built_workbench: 1, workbench_broken: 1, built_stove: 1,
            gave_fish: 1, gave_red_fruit: 1, gave_rainbow_shell: 1, str: 2, mind: 11, explore_forest: 1, visit_river: 1, visit_beach: 1 } },
    };
    DayUI.PRESETS = PRESETS;

    window.DayUI = DayUI;
})();
