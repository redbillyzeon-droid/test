/*
 * adv_ui：会話画面（日常パート）の試作（ティラノスクリプト用）
 *
 * ティラノスクリプトの文字送り・ログ・オート・スキップはそのまま使い、
 * 日付の表示、顔の絵、名前の札の色などを上に重ねる。
 *
 * 使い方（.ks から。詳しくは data/scenario/adv_test.ks）:
 *   [loadcss file="./data/others/adv_ui/adv.css"]
 *   [loadjs storage="adv_ui/adv_ui.js"]
 *   [iscript] AdvUI.init({ speakers: {...} }); [endscript]
 *   [adv_date day=5 slot="noon" weather="晴れ" next="作業台を建てると、松明が作れる"]
 *   #コノハ
 *   ユウ、見て見て！[p]
 *
 * 名前の札（chara_name_area）の文字が変わるのを見張って、話している人物の顔の絵を出す。
 */
(function () {
    "use strict";

    var SLOT_LABEL = { morning: "朝", noon: "昼", night: "夜" };
    var LAST_DAY = 14; // GM との勝負の日（docs/game/outline.md）

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    var AdvUI = {
        speakers: {},
        hud: null,

        init: function (opts) {
            opts = opts || {};
            this.speakers = opts.speakers || {};
            var base = document.querySelector(".tyrano_base") || document.body;
            if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);

            var hud = el("div", "li-hud");
            hud.appendChild(el("div", "li-band top"));
            hud.appendChild(el("div", "li-band bottom"));

            var date = el("div", "li-date");
            this.dayEl = el("div", "li-day");
            var side = el("div", "li-side");
            this.weatherEl = el("div", "li-weather");
            this.slotEl = el("div", "li-slot");
            side.appendChild(this.weatherEl);
            side.appendChild(this.slotEl);
            date.appendChild(this.dayEl);
            date.appendChild(side);
            hud.appendChild(date);

            var hint = el("div", "li-hint");
            this.leftEl = el("div", "li-left");
            this.nextEl = el("div", "li-next");
            hint.appendChild(this.leftEl);
            hint.appendChild(el("br"));
            hint.appendChild(this.nextEl);
            hud.appendChild(hint);

            this.bustEl = el("div", "li-bust");
            this.bustLabel = el("div", "li-bust-label");
            this.bustEl.appendChild(this.bustLabel);
            hud.appendChild(this.bustEl);
            this.tailEl = el("div", "li-tail");
            hud.appendChild(this.tailEl);

            var ops = el("div", "li-ops");
            this.opSkip = el("div", "", "早送り");
            this.opAuto = el("div", "", "オート");
            var opLog = el("div", "", "ログ");
            ops.appendChild(this.opSkip);
            ops.appendChild(this.opAuto);
            ops.appendChild(opLog);
            // ボタンを押しても、文字送りのクリックにならないようにする
            [ops].forEach(function (n) {
                ["click", "mousedown", "touchstart"].forEach(function (ev) {
                    n.addEventListener(ev, function (e) { e.stopPropagation(); });
                });
            });
            this.opSkip.addEventListener("click", this.toggleSkip.bind(this));
            this.opAuto.addEventListener("click", this.toggleAuto.bind(this));
            opLog.addEventListener("click", this.showLog.bind(this));
            // 操作のボタンは、ティラノスクリプトのクリック受付の層（z-index 9999）より上、
            // メニュー画面（ログなど、z-index 1000000000）より下の、別の層に置く
            if (this.opsLayer && this.opsLayer.parentNode) this.opsLayer.parentNode.removeChild(this.opsLayer);
            var opsLayer = el("div", "li-ops-layer");
            opsLayer.appendChild(ops);
            base.appendChild(opsLayer);
            this.opsLayer = opsLayer;

            // 会話の枠（message0）より下、立ち絵より上に置きたいので、message0 の直前に入れる
            var msg = base.querySelector(".message0_fore");
            if (msg && msg.parentNode === base) base.insertBefore(hud, msg);
            else base.appendChild(hud);
            this.hud = hud;

            this.watchName();
            this.render();
            return this;
        },

        setDate: function (day, slot, weather, next) {
            var f = this.f();
            if (f) {
                if (day != null && day !== "") f.day = Number(day);
                if (slot) f.slot = slot;
                if (weather) f.weather = weather;
                if (next != null) f.next_hint = next;
            }
            this.render();
        },

        f: function () {
            return window.TYRANO && window.TYRANO.kag ? window.TYRANO.kag.stat.f : null;
        },

        render: function () {
            if (!this.hud) return;
            var f = this.f() || {};
            var day = Number(f.day || 1);
            var slot = f.slot || "morning";
            this.dayEl.innerHTML = "";
            this.dayEl.appendChild(document.createTextNode(String(day)));
            this.dayEl.appendChild(el("small", "", "日目"));
            this.weatherEl.textContent = (f.weather === "雨" ? "☂ " : f.weather === "嵐" ? "⚡ " : "☀ ") + (f.weather || "晴れ");
            this.slotEl.textContent = SLOT_LABEL[slot] || slot;
            this.slotEl.className = "li-slot " + slot;
            var left = Math.max(0, LAST_DAY - day);
            this.leftEl.innerHTML = "";
            this.leftEl.appendChild(document.createTextNode("GM との勝負まで "));
            this.leftEl.appendChild(el("b", "", String(left)));
            this.leftEl.appendChild(document.createTextNode(" 日"));
            this.nextEl.textContent = f.next_hint ? "次にやること：" + f.next_hint : "";
        },

        // 名前の札の文字が変わったら、顔の絵と札の色を切りかえる
        watchName: function () {
            var self = this;
            if (this.observer) this.observer.disconnect();
            var tryAttach = function () {
                var nameEl = document.querySelector(".chara_name_area");
                if (!nameEl) { setTimeout(tryAttach, 200); return; }
                self.observer = new MutationObserver(function () { self.onSpeaker(nameEl.textContent.trim()); });
                self.observer.observe(nameEl, { childList: true, characterData: true, subtree: true });
                self.onSpeaker(nameEl.textContent.trim());
            };
            tryAttach();
        },

        onSpeaker: function (name) {
            this.syncOps();
            var sp = this.speakers[name];
            var nameEl = document.querySelector(".chara_name_area");
            if (nameEl) nameEl.style.background = sp && sp.tag ? sp.tag : "";
            var showBust = !!(sp && sp.bust !== false);
            this.bustEl.classList.toggle("show", showBust);
            this.tailEl.classList.toggle("show", showBust);
            if (!showBust) return;
            if (sp.img) {
                this.bustEl.style.backgroundImage = "url(" + sp.img + ")";
                this.bustLabel.textContent = "";
            } else {
                this.bustEl.style.backgroundImage = "linear-gradient(160deg, " + (sp.color || "#888") + ", #222)";
                this.bustLabel.textContent = name + "（顔の絵）";
            }
            // 同じ人が続けて話すときも、少し動かす
            this.bustEl.style.animation = "none";
            void this.bustEl.offsetWidth;
            this.bustEl.style.animation = "";
        },

        kag: function () { return window.TYRANO && window.TYRANO.kag; },

        // ティラノスクリプトの [button role="skip"] / role="auto" と同じ手順で切りかえる
        toggleSkip: function () {
            var kag = this.kag();
            if (!kag) return;
            if (kag.stat.is_skip) {
                kag.setSkip(false);
            } else {
                if (kag.layer.layer_event.isDisplayed()) kag.layer.layer_event.click();
                kag.setSkip(true);
            }
            this.syncOps();
        },

        toggleAuto: function () {
            var kag = this.kag();
            if (!kag) return;
            if (kag.stat.is_auto) {
                kag.setAuto(false);
            } else {
                if (kag.layer.layer_event.isDisplayed()) kag.layer.layer_event.click();
                kag.setAuto(true);
            }
            this.syncOps();
        },

        syncOps: function () {
            var kag = this.kag();
            if (!kag) return;
            this.opSkip.classList.toggle("on", !!kag.stat.is_skip);
            this.opAuto.classList.toggle("on", !!kag.stat.is_auto);
        },

        showLog: function () {
            var kag = this.kag();
            if (kag && kag.menu && kag.menu.displayLog) kag.menu.displayLog();
        },

        hide: function () {
            if (this.hud) this.hud.style.display = "none";
            if (this.opsLayer) this.opsLayer.style.display = "none";
        },
        show: function () {
            if (this.hud) this.hud.style.display = "";
            if (this.opsLayer) this.opsLayer.style.display = "";
        },
    };

    window.AdvUI = AdvUI;
})();
