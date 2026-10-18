/*
 * day_ui/day_save.js：自動セーブの3枠と、手動セーブを止めるしくみの試作（ティラノスクリプト Ver6.00 で確かめた）
 *
 * 正本：docs/game/design/screens.md 4章（4-1 枠、4-2 セーブできないところ、4-3 14日目）、
 *       docs/game/script/ui_text.md 7章（枠の名前、セーブできないときの文）
 *
 * しくみ：
 *   - ティラノの [autosave] は、保存先が1つ（localStorage の "<projectID>_tyrano_auto_save"）だけ。
 *     そこで、[autosave] と同じ手順（kag.menu.snapSave → localStorage に書く）のタグ [li_autosave slot="A|B|C"] を
 *     JavaScript で足し、枠ごとに別のキー "<projectID>_li_auto_A" などに書く。手動のセーブ（"_tyrano_data"）とは
 *     キーが別なので、手動のセーブで上書きされない。
 *   - 読み込みは、ティラノの loadAutoSave と同じく kag.menu.loadGameData を使う。
 *   - 手動セーブを止める：kag.menu.displaySave・doSave・setQuickSave を包み、止める理由があれば文を出して何もしない。
 *     止める理由：14日目（f.day ≥ 14）、探索の戦闘中（.ib-root がある）、状態画面などを開いている間（DayUI.isBusy()）。
 */
(function () {
    "use strict";
    // [loadjs] は .ks を通るたびに読み直すので、2回目からは何もしない（前のものに付けたイベントが二重に動くのを防ぐ）
    if (window.DaySave) return;

    function kag() { return window.TYRANO && window.TYRANO.kag; }
    function T() { return window.LIRules ? window.LIRules.TEXT : null; }

    var DaySave = {
        installed: false,

        key: function (slot) { return kag().config.projectID + "_li_auto_" + slot; },

        label: function (slot, day) {
            var t = T().save;
            if (slot === "A") return t.slotA.replace("{day}", day);
            if (slot === "B") return t.slotB;
            return t.slotC;
        },

        install: function () {
            var k = kag();
            if (!k || this.installed) return this;
            this.installed = true;
            var self = this;

            // [li_autosave slot="A"]：[autosave] と同じ手順で、枠ごとのキーに書く
            var tagDef = {
                vital: [],
                pm: { slot: "" },
                start: function (pm) {
                    var that = this;
                    var f = that.kag.stat.f;
                    var slot = pm.slot || (window.LIRules ? window.LIRules.autosaveSlotFor(f.day) : "A");
                    if (!slot) { that.kag.ftag.nextOrder(); return; }
                    self.write(slot, function () { that.kag.ftag.nextOrder(); });
                },
            };
            var t = Object.create(tagDef);
            t.kag = k;
            k.ftag.master_tag.li_autosave = t;

            // 手動セーブを止める
            var menu = k.menu;
            ["displaySave", "doSave", "setQuickSave"].forEach(function (name) {
                var orig = menu[name];
                if (typeof orig !== "function" || orig.__li_wrapped) return;
                var wrapped = function () {
                    var why = self.blockReason();
                    if (why) {
                        self.toast(why);
                        // メニューの「セーブ」から来たときに、ボタンが押せなくならないよう、メニューを閉じる
                        // ティラノの「閉じる」と同じ後始末（メニューの層を空にして、メニューボタンを戻す）
                        if (name === "displaySave") {
                            var lm = k.layer.getMenuLayer(); lm.hide(); lm.empty();
                            if (k.stat.visible_menu_button == true) $(".button_menu").show();
                        }
                        return false;
                    }
                    return orig.apply(this, arguments);
                };
                wrapped.__li_wrapped = true;
                menu[name] = wrapped;
            });
            return this;
        },

        // 自動の枠に書く。cb(data)
        write: function (slot, cb) {
            var k = kag(), self = this;
            var f = k.stat.f;
            var title = this.label(slot, f.day);
            k.menu.snapSave(title, function () {
                var data = k.menu.snap;
                data.save_date = k.menu.getDateStr();
                data.title = title;
                data.li_slot = slot;
                data.li_day = f.day;
                $.setStorage(self.key(slot), data, k.config.configSave);
                k.trigger("storage-autosave");
                // kag.menu.snap を残すと、あとの doSave がこの写しを使ってしまう（doSave は snap があれば撮り直さない）
                k.menu.snap = null;
                if (cb) cb(data);
            });
        },

        read: function (slot) {
            var k = kag();
            var raw = $.getStorage(this.key(slot), k.config.configSave);
            if (!raw) return null;
            try { return JSON.parse(raw); } catch (e) { return null; }
        },

        has: function (slot) { return !!this.read(slot); },

        load: function (slot) {
            var data = this.read(slot);
            if (!data) return false;
            if (window.DayUI) window.DayUI.closeAll();
            kag().menu.loadGameData($.extend(true, {}, data), { auto_next: "yes" });
            return true;
        },

        // 「14日目の朝からやり直す」：自動C、なければ B、なければ fallback（タイトルの代わり）
        restartDay14: function (fallback) {
            if (this.load("C")) return "C";
            if (this.load("B")) return "B";
            if (typeof fallback === "function") fallback();
            return null;
        },

        blockReason: function () {
            var k = kag();
            var t = T().save;
            var f = k ? k.stat.f : {};
            if (document.querySelector(".ib-root")) return t.battle;
            // 14日目と「画面を開いている間」は、1日の画面（DayUI）を使っている間だけ見る。
            // 同じ実行で、そのあとに会話・戦闘のテストへ移ったときは止めない
            var dayActive = window.DayUI && window.DayUI.active();
            if (dayActive && Number(f.day) >= 14) return t.day14;
            if (dayActive && window.DayUI.isBusy()) return t.busy;
            return "";
        },

        // セーブの画面を開く（止める理由があれば文だけ出す）
        openSave: function () { kag().menu.displaySave(); },

        toast: function (text) {
            var old = document.querySelector(".du-toast");
            if (old) old.parentNode.removeChild(old);
            var e = document.createElement("div");
            e.className = "du-toast";
            e.textContent = text;
            var base = document.querySelector(".tyrano_base") || document.body;
            base.appendChild(e);
            ["click", "mousedown", "touchstart"].forEach(function (ev) { e.addEventListener(ev, function (x) { x.stopPropagation(); }); });
            setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 3000);
        },
    };

    window.DaySave = DaySave;
})();
