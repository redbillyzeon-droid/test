/*
 * island_battle: 戦闘画面の試作（ティラノスクリプト用）
 *
 * 使い方（.ks から）:
 *   [loadcss file="./data/others/island_battle/battle.css"]
 *   [loadjs storage="island_battle/battle.js"]
 *   [iscript]
 *   IslandBattle.start({ ...設定... , returnStorage: "battle_test.ks", returnTarget: "*after" });
 *   [endscript]
 *   [s]
 *
 * 戦闘が終わると f.battle_result に "win" / "lose" を入れて、returnStorage / returnTarget へ jump する。
 * 絵の素材がないときは、色つきの図形で代わりに表示する（配置と動きの確認用）。
 */
(function () {
    "use strict";

    var DEFAULTS = {
        enemyName: "敵",
        enemies: [],      // { name, hp, atk, img }
        party: [],        // { name, hp, mind, atk, img, skill: { name, power } }
        bondMax: 5,
        autoDelay: 450,   // 自動戦闘の1手の間隔（ミリ秒）
        returnStorage: "",
        returnTarget: "",
    };

    var COMMANDS = [
        { id: "attack", label: "攻撃" },
        { id: "guard", label: "守る" },
        { id: "skill", label: "技" },
        { id: "item", label: "道具" },
        { id: "word", label: "言葉" },
        { id: "bond", label: "絆" },
    ];

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    function rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function Battle(cfg) {
        this.cfg = Object.assign({}, DEFAULTS, cfg);
        this.enemies = this.cfg.enemies.map(function (e) {
            return Object.assign({ maxHp: e.hp, alive: true }, e);
        });
        this.party = this.cfg.party.map(function (p) {
            return Object.assign({ maxHp: p.hp, maxMind: p.mind, guarding: false }, p);
        });
        this.bond = 0;
        this.turnIndex = 0; // 今コマンドを選んでいる味方
        this.selected = 0;  // メニューで選んでいる項目
        this.busy = false;
        this.auto = false;
        this.finished = false;
        this.potions = 2;
    }

    Battle.prototype.mount = function () {
        var base = document.querySelector(".tyrano_base") || document.body;
        var root = el("div", "ib-root");
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

        // 上の中央：絆ゲージ
        var bond = el("div", "ib-bond");
        bond.appendChild(el("div", "ib-bond-label", "絆ゲージ"));
        this.bondEl = el("div", "ib-bond-gems");
        bond.appendChild(this.bondEl);
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
            item.appendChild(el("span", "ib-ico"));
            item.appendChild(el("span", "ib-label", c.label));
            item.addEventListener("mouseenter", function () { self.select(i); });
            item.addEventListener("click", function () { self.select(i); self.command(c.id); });
            self.menuEl.appendChild(item);
            return item;
        });
        root.appendChild(this.menuEl);

        // 中央：敵
        var stage = el("div", "ib-stage");
        this.enemies.forEach(function (e, i) {
            var box = el("div", "ib-enemy" + (i === Math.floor(self.enemies.length / 2) ? " ib-boss" : ""));
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
        var partyEl = el("div", "ib-party");
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
        this.render();
        this.log(this.cfg.enemyName + "が現れた！");
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
        var boss = this.boss();
        var cells = 8;
        var filled = boss ? Math.ceil((boss.hp / boss.maxHp) * cells) : 0;
        this.cellsEl.innerHTML = "";
        for (var i = 0; i < cells; i++) this.cellsEl.appendChild(el("span", "ib-cell" + (i < filled ? "" : " ib-empty")));

        var gems = "";
        for (var g = 0; g < this.cfg.bondMax; g++) gems += g < this.bond ? "◆" : "◇";
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
        this.itemEls[5].classList.toggle("ib-disabled", this.bond < this.cfg.bondMax);
        this.select(this.selected);
    };

    Battle.prototype.log = function (text) {
        this.logEl.textContent = text;
    };

    Battle.prototype.boss = function () {
        return this.enemies[Math.floor(this.enemies.length / 2)];
    };

    Battle.prototype.target = function () {
        var alive = this.enemies.filter(function (e) { return e.alive; });
        // 取り巻きから先に倒す
        var minions = alive.filter(function (e) { return e !== this.boss(); }, this);
        return minions[0] || alive[0];
    };

    Battle.prototype.damage = function (enemy, amount) {
        enemy.hp -= amount;
        if (enemy.hp <= 0) {
            enemy.alive = false;
            enemy.hp = 0;
            this.bond = Math.min(this.cfg.bondMax, this.bond + 1);
        }
        enemy.el.classList.remove("ib-hit");
        void enemy.el.offsetWidth;
        enemy.el.classList.add("ib-hit");
    };

    Battle.prototype.command = function (id) {
        if (this.busy || this.finished) return;
        var actor = this.party[this.turnIndex];
        var t = this.target();
        var msg = "";
        switch (id) {
            case "attack":
                var dmg = rand(actor.atk - 3, actor.atk + 3);
                this.damage(t, dmg);
                msg = actor.name + "の攻撃！ " + t.name + "に " + dmg + " のダメージ";
                break;
            case "guard":
                actor.guarding = true;
                msg = actor.name + "は身を守っている";
                break;
            case "skill":
                if (!actor.skill) { this.log(actor.name + "は技を覚えていない"); return; }
                if (actor.mind < 10) { this.log("心が足りない"); return; }
                actor.mind -= 10;
                var sd = rand(actor.skill.power - 4, actor.skill.power + 4);
                this.damage(t, sd);
                msg = actor.name + "の" + actor.skill.name + "！ " + t.name + "に " + sd + " のダメージ";
                break;
            case "item":
                if (this.potions <= 0) { this.log("道具がない"); return; }
                this.potions--;
                actor.hp = Math.min(actor.maxHp, actor.hp + 40);
                msg = actor.name + "は薬草を使った。HP が回復した（残り " + this.potions + "）";
                break;
            case "word":
                actor.mind = Math.min(actor.maxMind, actor.mind + 15);
                this.bond = Math.min(this.cfg.bondMax, this.bond + 1);
                msg = actor.name + "は仲間に声をかけた。心と絆が高まる";
                break;
            case "bond":
                if (this.bond < this.cfg.bondMax) { this.log("絆ゲージが足りない"); return; }
                this.bond = 0;
                var self = this;
                this.enemies.forEach(function (e) { if (e.alive) self.damage(e, 60); });
                msg = "絆の大技！ すべての敵に大きなダメージ";
                break;
        }
        this.log(msg);
        this.render();
        if (this.checkEnd()) return;
        this.nextActor();
    };

    Battle.prototype.nextActor = function () {
        var n = this.party.length;
        for (var k = 1; k <= n; k++) {
            var idx = this.turnIndex + k;
            if (idx >= n) { this.enemyTurn(); return; }
            if (this.party[idx].hp > 0) { this.turnIndex = idx; this.render(); this.maybeAuto(); return; }
        }
        this.enemyTurn();
    };

    Battle.prototype.enemyTurn = function () {
        var self = this;
        this.busy = true;
        var alive = this.enemies.filter(function (e) { return e.alive; });
        var i = 0;
        (function step() {
            if (i >= alive.length) {
                self.party.forEach(function (p) { p.guarding = false; });
                self.busy = false;
                self.turnIndex = self.party.findIndex(function (p) { return p.hp > 0; });
                self.render();
                if (!self.checkEnd()) self.maybeAuto();
                return;
            }
            var e = alive[i++];
            var targets = self.party.filter(function (p) { return p.hp > 0; });
            if (!targets.length) { self.checkEnd(); return; }
            var p = targets[rand(0, targets.length - 1)];
            var d = rand(e.atk - 2, e.atk + 2);
            if (p.guarding) d = Math.floor(d / 2);
            p.hp -= d;
            p.el.classList.remove("ib-hit");
            void p.el.offsetWidth;
            p.el.classList.add("ib-hit");
            self.log(e.name + "の攻撃！ " + p.name + "に " + d + " のダメージ");
            self.render();
            if (self.checkEnd()) return;
            setTimeout(step, self.cfg.autoDelay);
        })();
    };

    Battle.prototype.toggleAuto = function () {
        this.auto = !this.auto;
        this.autoBtn.textContent = "自動：" + (this.auto ? "ON" : "OFF");
        this.autoBtn.classList.toggle("ib-on", this.auto);
        this.maybeAuto();
    };

    Battle.prototype.maybeAuto = function () {
        if (!this.auto || this.busy || this.finished) return;
        var self = this;
        clearTimeout(this.autoTimer);
        this.autoTimer = setTimeout(function () {
            if (!self.auto || self.busy || self.finished) return;
            var actor = self.party[self.turnIndex];
            var id = "attack";
            if (self.bond >= self.cfg.bondMax) id = "bond";
            else if (actor.hp < actor.maxHp * 0.3 && self.potions > 0) id = "item";
            else if (actor.skill && actor.mind >= 10) id = "skill";
            self.select(COMMANDS.findIndex(function (c) { return c.id === id; }));
            self.command(id);
        }, this.cfg.autoDelay);
    };

    Battle.prototype.checkEnd = function () {
        if (this.finished) return true;
        var win = this.enemies.every(function (e) { return !e.alive; });
        var lose = this.party.every(function (p) { return p.hp <= 0; });
        if (!win && !lose) return false;
        this.finished = true;
        this.busy = true;
        this.render();
        var result = win ? "win" : "lose";
        this.log(win ? "勝利！" : "敗北……");
        var self = this;
        setTimeout(function () { self.finish(result); }, 900);
        return true;
    };

    Battle.prototype.finish = function (result) {
        document.removeEventListener("keydown", this.keyHandler, true);
        clearTimeout(this.autoTimer);
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
        var kag = window.TYRANO && window.TYRANO.kag;
        if (kag) {
            kag.stat.f.battle_result = result;
            // 戦闘後の HP と心を、ゲーム変数に書き戻す
            kag.stat.f.battle_party = this.party.map(function (p) {
                return { name: p.name, hp: Math.max(0, p.hp), mind: Math.max(0, p.mind) };
            });
            if (this.cfg.returnStorage || this.cfg.returnTarget) {
                kag.ftag.startTag("jump", { storage: this.cfg.returnStorage, target: this.cfg.returnTarget });
            }
        }
        if (typeof this.cfg.onEnd === "function") this.cfg.onEnd(result);
    };

    window.IslandBattle = {
        start: function (cfg) {
            var b = new Battle(cfg);
            b.mount();
            window.IslandBattle.current = b;
            return b;
        },
    };
})();
