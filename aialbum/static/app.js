"use strict";

const PAGE = 200;
const FAV = "お気に入り";

const state = {
  chips: [],
  folder: null,
  sort: "mtime",
  order: "desc",
  seed: Math.floor(Math.random() * 1e6),
  items: [],
  total: 0,
  loading: false,
  generation: 0,
  selected: new Set(),
  lastClicked: null,
  viewerIndex: -1,
  facetKind: "prompt",
  facetFilter: "",
};

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

async function api(path, options = {}) {
  const init = { ...options };
  if (init.json !== undefined) {
    init.method = init.method || "POST";
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(init.json);
    delete init.json;
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    let message = res.statusText;
    try { message = (await res.json()).detail || message; } catch (_) {}
    throw new Error(message);
  }
  return res.json();
}

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 2500);
}

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem("aialbum." + key);
    localStorage.setItem("aialbum." + key, value);
  } catch (_) { return null; }
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function queryString(extra = {}) {
  const params = new URLSearchParams({ q: state.chips.join(", "), sort: state.sort, order: state.order, seed: state.seed, ...extra });
  if (state.folder) params.set("folder", state.folder);
  return params.toString();
}

// ---------------------------------------------------------------------------
// 検索チップ
// ---------------------------------------------------------------------------

function addChip(value) {
  value = value.trim().replace(/,/g, " ");
  if (!value || state.chips.includes(value)) return;
  const opposite = value.startsWith("-") ? value.slice(1) : "-" + value;
  state.chips = state.chips.filter((c) => c !== opposite);
  state.chips.push(value);
  onQueryChanged();
}

function removeChip(value) {
  state.chips = state.chips.filter((c) => c !== value);
  onQueryChanged();
}

function toggleChipNegation(value) {
  const index = state.chips.indexOf(value);
  if (index < 0) return;
  state.chips[index] = value.startsWith("-") ? value.slice(1) : "-" + value;
  onQueryChanged();
}

function renderChips() {
  const box = $("chips");
  box.replaceChildren(...state.chips.map((chip) =>
    el("span", {
      class: "chip" + (chip.startsWith("-") ? " neg" : ""),
      title: "クリックで 含む / 除外 を切り替え",
      onclick: () => toggleChipNegation(chip),
    }, chip, el("button", { title: "外す", onclick: (e) => { e.stopPropagation(); removeChip(chip); } }, "×"))
  ));
}

function onQueryChanged() {
  renderChips();
  reload();
  loadFacets();
}

// --- 入力補完 ---

const suggestState = { items: [], active: -1 };

const fetchSuggest = debounce(async () => {
  const input = $("search-input");
  const text = input.value.trim();
  if (!text || text.startsWith('"')) return hideSuggest();
  const negative = text.startsWith("-");
  const last = text.split("|").pop().trim();
  try {
    const items = await api("/api/suggest?" + new URLSearchParams({ prefix: last }));
    const head = text.slice(0, text.length - last.length);
    suggestState.items = items.map((s) => ({
      value: (negative && !head ? "-" : head) + s.value,
      label: s.value,
      count: s.count,
    }));
    suggestState.active = -1;
    renderSuggest();
  } catch (_) { hideSuggest(); }
}, 150);

function renderSuggest() {
  const list = $("suggest");
  if (!suggestState.items.length) return hideSuggest();
  list.replaceChildren(...suggestState.items.map((item, i) =>
    el("li", {
      class: i === suggestState.active ? "active" : "",
      onmousedown: (e) => { e.preventDefault(); pickSuggest(i); },
    }, el("span", {}, item.label), el("small", {}, item.count))
  ));
  list.hidden = false;
}

function hideSuggest() {
  suggestState.items = [];
  $("suggest").hidden = true;
}

function pickSuggest(i) {
  const item = suggestState.items[i];
  if (!item) return;
  $("search-input").value = "";
  hideSuggest();
  addChip(item.value);
}

function setupSearch() {
  const input = $("search-input");
  input.addEventListener("input", fetchSuggest);
  input.addEventListener("blur", () => setTimeout(hideSuggest, 100));
  input.addEventListener("keydown", (e) => {
    const n = suggestState.items.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      suggestState.active = (suggestState.active + 1) % n;
      renderSuggest();
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      suggestState.active = (suggestState.active - 1 + n) % n;
      renderSuggest();
    } else if (e.key === "Tab" && n) {
      e.preventDefault();
      pickSuggest(Math.max(suggestState.active, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestState.active >= 0) return pickSuggest(suggestState.active);
      const text = input.value;
      input.value = "";
      hideSuggest();
      text.split(",").forEach((t) => t.trim() && addChip(t));
    } else if (e.key === "Escape") {
      hideSuggest();
    } else if (e.key === "Backspace" && !input.value && state.chips.length) {
      removeChip(state.chips[state.chips.length - 1]);
    }
  });
}

// ---------------------------------------------------------------------------
// グリッド
// ---------------------------------------------------------------------------

async function reload() {
  state.generation += 1;
  state.items = [];
  state.total = 0;
  state.loading = false;
  state.selected.clear();
  state.lastClicked = null;
  updateSelectionBar();
  $("grid").replaceChildren();
  document.querySelector("main").scrollTop = 0;
  await fetchPage(true);
}

async function fetchPage(first = false) {
  if (state.loading) return;
  if (!first && state.items.length >= state.total) return;
  state.loading = true;
  const generation = state.generation;
  try {
    const data = await api("/api/images?" + queryString({ offset: state.items.length, limit: PAGE }));
    if (generation !== state.generation) return;
    const start = state.items.length;
    state.items.push(...data.items);
    state.total = data.total;
    $("grid").append(...data.items.map((item, i) => makeCell(item, start + i)));
    $("count").textContent = `${state.total.toLocaleString()} 枚`;
    $("empty").hidden = state.total > 0;
  } catch (err) {
    toast("読み込みに失敗しました: " + err.message);
  } finally {
    if (generation === state.generation) state.loading = false;
  }
  // 画面が埋まらないときは続けて読む
  const sentinel = $("sentinel").getBoundingClientRect();
  if (generation === state.generation && sentinel.top < window.innerHeight + 400 && state.items.length < state.total) {
    fetchPage();
  }
}

function makeCell(item, index) {
  const badge = item.source === "novelai" ? "NAI" : item.source === "a1111" ? "SD" : null;
  return el("div", {
    class: "cell",
    "data-index": index,
    title: item.name,
    onclick: (e) => onCellClick(e, index),
  },
  el("img", { src: `/api/thumb/${item.id}`, loading: "lazy", alt: item.name }),
  badge && el("span", { class: "badge" }, badge));
}

function onCellClick(e, index) {
  if (e.shiftKey && state.lastClicked !== null) {
    const [a, b] = [state.lastClicked, index].sort((x, y) => x - y);
    for (let i = a; i <= b; i++) state.selected.add(state.items[i].id);
  } else if (e.ctrlKey || e.metaKey) {
    const id = state.items[index].id;
    state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
  } else if (state.selected.size) {
    const id = state.items[index].id;
    state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
  } else {
    state.lastClicked = index;
    return openViewer(index);
  }
  state.lastClicked = index;
  refreshSelectionMarks();
}

function refreshSelectionMarks() {
  for (const cell of $("grid").children) {
    const item = state.items[Number(cell.dataset.index)];
    cell.classList.toggle("selected", state.selected.has(item.id));
  }
  updateSelectionBar();
}

function updateSelectionBar() {
  $("selection-bar").hidden = state.selected.size === 0;
  $("selection-count").textContent = `${state.selected.size} 枚を選択中`;
}

async function applyUserTag(ids, tag, on) {
  await api("/api/usertags", { json: { ids, tag, on } });
  loadUserTags();
}

function setupSelection() {
  $("sel-clear").onclick = () => { state.selected.clear(); refreshSelectionMarks(); };
  $("sel-all").onclick = () => { state.items.forEach((i) => state.selected.add(i.id)); refreshSelectionMarks(); };
  $("sel-tag").onclick = async () => {
    const tag = prompt("付けるタグの名前", FAV);
    if (!tag) return;
    await applyUserTag([...state.selected], tag.trim(), true);
    toast(`「${tag}」を ${state.selected.size} 枚に付けました`);
  };
  $("sel-untag").onclick = async () => {
    const tag = prompt("外すタグの名前", FAV);
    if (!tag) return;
    await applyUserTag([...state.selected], tag.trim(), false);
    toast(`「${tag}」を外しました`);
    if (state.chips.includes("my:" + tag.trim())) reload();
  };
  const move = async (mode) => {
    const dest = prompt(mode === "copy" ? "コピー先のフォルダ (無ければ作ります)" : "移動先のフォルダ (無ければ作ります)", store("lastDest") || "");
    if (!dest) return;
    store("lastDest", dest);
    try {
      const res = await api("/api/move", { json: { ids: [...state.selected], dest, mode } });
      toast(`${res.done} 枚を${mode === "copy" ? "コピー" : "移動"}しました` + (res.errors.length ? ` (失敗 ${res.errors.length} 件)` : ""));
      if (res.errors.length) console.warn(res.errors);
      loadFolders();
      reload();
    } catch (err) { toast(err.message); }
  };
  $("sel-move").onclick = () => move("move");
  $("sel-copy").onclick = () => move("copy");
}

// ---------------------------------------------------------------------------
// サイドバー
// ---------------------------------------------------------------------------

async function loadFolders() {
  const folders = await api("/api/folders");
  const list = $("folders");
  const rows = [
    el("li", { class: state.folder ? "" : "active", onclick: () => selectFolder(null) }, el("span", {}, "すべて")),
  ];
  for (const f of folders) {
    rows.push(el("li", {
      class: (f.exists ? "" : "missing ") + (state.folder === f.path ? "active" : ""),
      title: f.exists ? f.path : "フォルダが見つかりません",
      onclick: () => selectFolder(f.path),
    },
    el("span", {}, f.path.split(/[\\/]/).filter(Boolean).pop() || f.path),
    el("span", {},
      el("small", {}, f.count),
      el("button", {
        class: "remove",
        title: "登録を解除 (画像は削除されません)",
        onclick: async (e) => {
          e.stopPropagation();
          if (!confirm(`登録を解除しますか？ (画像ファイルは消えません)\n${f.path}`)) return;
          await api("/api/folders?" + new URLSearchParams({ path: f.path }), { method: "DELETE" });
          if (state.folder && state.folder.startsWith(f.path)) state.folder = null;
          loadFolders(); reload(); loadFacets();
        },
      }, "×"))));
    for (const sub of f.subfolders) {
      if (sub.path === f.path && f.subfolders.length === 1) continue;
      const label = sub.path === f.path ? "(直下)" : sub.path.slice(f.path.length).replace(/^[\\/]/, "");
      rows.push(el("li", {
        class: "sub" + (state.folder === sub.path ? " active" : ""),
        title: sub.path,
        onclick: () => selectFolder(sub.path),
      }, el("span", {}, label), el("small", {}, sub.count)));
    }
  }
  list.replaceChildren(...rows);
}

function selectFolder(path) {
  state.folder = path;
  loadFolders();
  reload();
  loadFacets();
}

async function loadUserTags() {
  const tags = await api("/api/usertags");
  const items = tags.length ? tags : [{ tag: FAV, count: 0 }];
  $("usertags").replaceChildren(...items.map((t) =>
    el("li", { onclick: () => addChip("my:" + t.tag) }, el("span", {}, "★ " + t.tag), el("small", {}, t.count))
  ));
}

const loadFacets = debounce(async () => {
  try {
    const params = new URLSearchParams({ q: state.chips.join(", "), kind: state.facetKind, limit: 500 });
    if (state.folder) params.set("folder", state.folder);
    const facets = await api("/api/facets?" + params);
    const prefix = state.facetKind === "prompt" ? "" : (state.facetKind === "negative" ? "neg" : state.facetKind) + ":";
    const filter = state.facetFilter.toLowerCase();
    const shown = facets.filter((f) => !filter || f.tag.includes(filter));
    $("facets").replaceChildren(...shown.map((f) =>
      el("li", {
        title: "クリック: 絞り込み / 右クリック: 除外",
        onclick: () => addChip(prefix + f.tag),
        oncontextmenu: (e) => { e.preventDefault(); addChip("-" + prefix + f.tag); },
      }, el("span", {}, f.tag), el("small", {}, f.count))
    ));
  } catch (_) {}
}, 200);

function setupSidebar() {
  $("add-folder").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = e.target.elements.path;
    if (!input.value.trim()) return;
    try {
      const res = await api("/api/folders", { json: { path: input.value } });
      input.value = "";
      toast("登録しました: " + res.path);
      loadFolders();
      pollScan();
    } catch (err) { toast(err.message); }
  });
  for (const button of $("facet-tabs").querySelectorAll("button")) {
    button.onclick = () => {
      $("facet-tabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === button));
      state.facetKind = button.dataset.kind;
      loadFacets();
    };
  }
  $("facet-filter").addEventListener("input", (e) => { state.facetFilter = e.target.value; loadFacets(); });
}

// ---------------------------------------------------------------------------
// ビューア
// ---------------------------------------------------------------------------

async function openViewer(index) {
  if (index < 0) return;
  if (index >= state.items.length) {
    if (state.items.length >= state.total) return;
    await fetchPage();
    if (index >= state.items.length) return;
  }
  state.viewerIndex = index;
  const item = state.items[index];
  $("viewer").hidden = false;
  $("v-img").src = `/api/file/${item.id}`;
  $("v-name").textContent = item.name;
  $("v-body").replaceChildren(el("p", { class: "path" }, "読み込み中…"));
  try {
    const detail = await api(`/api/images/${item.id}`);
    if (state.viewerIndex === index) renderDetail(detail);
  } catch (err) {
    $("v-body").replaceChildren(el("p", {}, err.message));
  }
}

function closeViewer() {
  $("viewer").hidden = true;
  $("v-img").removeAttribute("src");
  state.viewerIndex = -1;
}

function copyButton(text) {
  return el("button", {
    onclick: async () => {
      try { await navigator.clipboard.writeText(text); toast("コピーしました"); }
      catch (_) { toast("コピーできませんでした"); }
    },
  }, "コピー");
}

function textBlock(title, text) {
  if (!text) return null;
  return el("div", { class: "block" }, el("h4", {}, title, copyButton(text)), el("pre", {}, text));
}

function tagFilter(value) {
  closeViewer();
  addChip(value);
}

function renderDetail(detail) {
  const meta = detail.meta || {};
  const fav = detail.user_tags.includes(FAV);
  $("v-fav").textContent = fav ? "★" : "☆";
  $("v-fav").classList.toggle("on", fav);
  $("v-fav").onclick = async () => {
    await applyUserTag([detail.id], FAV, !fav);
    renderDetail({ ...detail, user_tags: fav ? detail.user_tags.filter((t) => t !== FAV) : [...detail.user_tags, FAV] });
  };

  const blocks = [];
  blocks.push(textBlock("プロンプト", meta.prompt));
  (meta.characters || []).forEach((c, i) => {
    const pos = c.center ? ` (x ${c.center.x}, y ${c.center.y})` : "";
    blocks.push(textBlock(`キャラクター ${i + 1}${pos}`, c.prompt));
    blocks.push(textBlock(`キャラクター ${i + 1} ネガティブ`, c.negative));
  });
  blocks.push(textBlock("ネガティブ", meta.negative));
  if (meta.source === "unknown") blocks.push(el("p", { class: "path" }, "生成情報が見つかりませんでした"));

  const params = Object.entries(meta.params || {});
  params.unshift(["生成元", { a1111: "SD WebUI / Forge", novelai: "NovelAI", unknown: "不明" }[meta.source] + (meta.stealth ? " (ステルス)" : "")]);
  params.push(["サイズ", `${detail.width} × ${detail.height}`]);
  blocks.push(el("div", { class: "block" },
    el("h4", {}, "パラメータ"),
    el("table", { class: "params" }, params.map(([k, v]) =>
      el("tr", {}, el("td", {}, k), el("td", {}, typeof v === "object" ? JSON.stringify(v) : String(v)))
    ))));

  const tagButtons = [];
  for (const t of detail.tags) {
    if (t.kind === "negative" || t.kind === "char" || t.kind === "source") continue;
    const value = t.kind === "prompt" ? t.tag : `${t.kind}:${t.tag}`;
    tagButtons.push(el("button", {
      title: "クリック: 絞り込み / 右クリック: 除外",
      onclick: () => tagFilter(value),
      oncontextmenu: (e) => { e.preventDefault(); tagFilter("-" + value); },
    }, value));
  }
  if (tagButtons.length) blocks.push(el("div", { class: "block" }, el("h4", {}, "タグ"), el("div", { class: "tagcloud" }, tagButtons)));

  const userInput = el("input", { type: "text", placeholder: "タグを追加して Enter" });
  userInput.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || !userInput.value.trim()) return;
    const tag = userInput.value.trim();
    await applyUserTag([detail.id], tag, true);
    renderDetail({ ...detail, user_tags: [...new Set([...detail.user_tags, tag])] });
  });
  blocks.push(el("div", { class: "block" },
    el("h4", {}, "マイタグ"),
    el("div", { class: "tagcloud" }, detail.user_tags.map((tag) =>
      el("button", {
        class: "user",
        title: "クリックで外す",
        onclick: async () => {
          await applyUserTag([detail.id], tag, false);
          renderDetail({ ...detail, user_tags: detail.user_tags.filter((t) => t !== tag) });
        },
      }, `${tag} ×`))),
    el("div", { class: "inline-form" }, userInput)));

  blocks.push(el("div", { class: "block" },
    el("h4", {}, "ファイル", el("span", {},
      el("button", { onclick: () => api(`/api/reveal/${detail.id}`, { method: "POST" }).catch((e) => toast(e.message)) }, "場所を開く"),
      " ",
      copyButton(detail.path))),
    el("div", { class: "path" }, detail.path)));

  $("v-body").replaceChildren(...blocks.filter(Boolean));
}

function setupViewer() {
  $("v-close").onclick = closeViewer;
  $("v-prev").onclick = () => openViewer(state.viewerIndex - 1);
  $("v-next").onclick = () => openViewer(state.viewerIndex + 1);
  $("viewer").addEventListener("click", (e) => { if (e.target.classList.contains("viewer-image")) closeViewer(); });
  document.addEventListener("keydown", (e) => {
    if ($("viewer").hidden || e.target.tagName === "INPUT") return;
    if (e.key === "Escape") closeViewer();
    else if (e.key === "ArrowLeft") openViewer(state.viewerIndex - 1);
    else if (e.key === "ArrowRight") openViewer(state.viewerIndex + 1);
    else if (e.key.toLowerCase() === "f") $("v-fav").click();
  });
}

// ---------------------------------------------------------------------------
// スキャン状況
// ---------------------------------------------------------------------------

async function pollScan() {
  clearTimeout(pollScan.timer);
  try {
    const s = await api("/api/scan");
    if (s.running) {
      $("scan-status").textContent = `読み込み中… ${s.done} / ${s.total}`;
      pollScan.wasRunning = true;
      pollScan.timer = setTimeout(pollScan, 1000);
      return;
    }
    $("scan-status").textContent = s.errors.length ? `読めなかったファイル: ${s.errors.length} 件` : "";
    if (pollScan.wasRunning) {
      pollScan.wasRunning = false;
      if (s.added || s.removed) toast(`読み込み完了: 追加・更新 ${s.added} / 削除 ${s.removed}`);
      loadFolders(); loadUserTags(); loadFacets(); reload();
    }
  } catch (_) {
    pollScan.timer = setTimeout(pollScan, 3000);
  }
}

// ---------------------------------------------------------------------------
// 起動
// ---------------------------------------------------------------------------

function setupControls() {
  const sort = $("sort");
  const order = $("order");
  const size = $("size");
  state.sort = store("sort") || "mtime";
  state.order = store("order") || "desc";
  sort.value = state.sort;
  order.textContent = state.order === "asc" ? "↑" : "↓";
  size.value = store("size") || 220;
  document.documentElement.style.setProperty("--thumb", size.value + "px");

  sort.onchange = () => {
    state.sort = sort.value;
    if (state.sort === "random") state.seed = Math.floor(Math.random() * 1e6);
    store("sort", state.sort);
    reload();
  };
  order.onclick = () => {
    state.order = state.order === "asc" ? "desc" : "asc";
    order.textContent = state.order === "asc" ? "↑" : "↓";
    store("order", state.order);
    if (state.sort === "random") state.seed = Math.floor(Math.random() * 1e6);
    reload();
  };
  size.oninput = () => {
    document.documentElement.style.setProperty("--thumb", size.value + "px");
    store("size", size.value);
  };
  $("export").onclick = () => { window.location = "/api/export.csv?" + queryString(); };
  $("rescan").onclick = async () => {
    const res = await api("/api/scan", { method: "POST" });
    if (!res.started) toast("読み込み中です");
    pollScan();
  };

  new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) fetchPage();
  }, { root: document.querySelector("main"), rootMargin: "800px" }).observe($("sentinel"));
}

setupControls();
setupSearch();
setupSelection();
setupSidebar();
setupViewer();
loadFolders();
loadUserTags();
loadFacets();
reload();
pollScan();
