const STORAGE_KEY = "uyap_resume_state";

const listBtn = document.getElementById("listBtn");
const individualBtn = document.getElementById("individualBtn");
const mergedBtn = document.getElementById("mergedBtn");
const resumeBtn = document.getElementById("resumeBtn");
const cancelResumeBtn = document.getElementById("cancelResumeBtn");
const stopBtn = document.getElementById("stopBtn");
const stopBtnRow = document.getElementById("stopBtnRow");
const selectAllBtn = document.getElementById("selectAllBtn");
const selectNoneBtn = document.getElementById("selectNoneBtn");
const filterSearch = document.getElementById("filterSearch");
const rangeStartEl = document.getElementById("rangeStart");
const rangeEndEl = document.getElementById("rangeEnd");

const resumeBanner = document.getElementById("resumeBanner");
const resumeInfo = document.getElementById("resumeInfo");
const caseInfoEl = document.getElementById("caseInfo");
const filterBox = document.getElementById("filterBox");
const evrakListEl = document.getElementById("evrakList");
const selCountEl = document.getElementById("selCount");
const totCountEl = document.getElementById("totCount");

const progressEl = document.querySelector(".progress");
const bar = document.getElementById("bar");
const countersEl = document.getElementById("counters");
const statusEl = document.getElementById("status");
const curEl = document.getElementById("cur");
const totEl = document.getElementById("tot");
const okCEl = document.getElementById("okC");
const failCEl = document.getElementById("failC");

const downloadButtons = [individualBtn, mergedBtn];
const allActionButtons = [listBtn, individualBtn, mergedBtn, resumeBtn, cancelResumeBtn];

let evraks = [];          // listele cikti
let caseTitle = "";
let folder = "";
let resumeState = null;   // varsa
let running = false;
let okCount = 0;
let failCount = 0;
let total = 0;

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function log(html, cls = "info") {
  statusEl.classList.add("show");
  const d = document.createElement("div");
  d.className = "row " + cls;
  d.innerHTML = html;
  statusEl.appendChild(d);
  statusEl.scrollTop = statusEl.scrollHeight;
}

function setMode(mode) {
  document.body.classList.toggle("mode-merged", mode === "merged");
}

function modeLabel(mode) {
  if (mode === "merged") return "Toplu PDF";
  return "Tek Tek";
}

function setProgress(cur, tot) {
  const pct = tot > 0 ? (cur / tot) * 100 : 0;
  bar.style.width = pct.toFixed(1) + "%";
  curEl.textContent = String(cur);
  totEl.textContent = String(tot);
}

function setRunning(isRunning) {
  running = isRunning;
  if (isRunning) {
    allActionButtons.forEach((b) => (b.disabled = true));
    stopBtnRow.classList.add("show");
    stopBtn.disabled = false;
    stopBtn.textContent = "Durdur";
  } else {
    listBtn.disabled = false;
    const hasSelection = getSelectedItems().length > 0;
    individualBtn.disabled = !hasSelection;
    mergedBtn.disabled = !hasSelection;
    if (resumeState) {
      resumeBtn.disabled = false;
      cancelResumeBtn.disabled = false;
    }
    stopBtnRow.classList.remove("show");
  }
}

function showProgressUi() {
  progressEl.classList.add("show");
  countersEl.classList.add("show");
  statusEl.classList.add("show");
}

function resetProgressCounters(t) {
  okCount = 0;
  failCount = 0;
  total = t || 0;
  okCEl.textContent = "0";
  failCEl.textContent = "0";
  setProgress(0, total);
  statusEl.innerHTML = "";
}

// === UI: RESUME BANNER ===
function showResumeBanner(state) {
  resumeState = state;
  const completed = (state.completedIds || []).length;
  const failed = (state.failed || []).length;
  const tot = state.total || 0;
  const remaining = Math.max(0, tot - completed - failed);
  const folderTxt = state.folder ? `<b>${escapeHtml(state.folder)}</b>` : "";
  const modeTxt = modeLabel(state.mode);
  const mergedWarning = state.mode === "merged"
    ? `<br/><span style="color:#92400e">Not: Toplu PDF modunda devam, tum evraklari yeniden indirir.</span>`
    : "";
  resumeInfo.innerHTML =
    `Yarim kalmis indirme: ${folderTxt} (${modeTxt})<br/>` +
    `Tamamlanan: <b>${completed}</b>, Basarisiz: <b>${failed}</b>, Kalan: <b>${remaining}</b> / Toplam: <b>${tot}</b>` +
    mergedWarning;
  resumeBanner.classList.add("show");
}

function hideResumeBanner() {
  resumeBanner.classList.remove("show");
  resumeState = null;
}

async function checkResumeState() {
  try {
    const v = await chrome.storage.local.get([STORAGE_KEY]);
    const s = v && v[STORAGE_KEY];
    if (s && s.selected && s.total && (s.status === "running" || s.status === "stopped")) {
      const completed = (s.completedIds || []).length;
      const failed = (s.failed || []).length;
      if (completed + failed < s.total) {
        showResumeBanner(s);
      } else {
        await chrome.storage.local.remove([STORAGE_KEY]);
      }
    }
  } catch (_) {}
}

// === UI: EVRAK LISTESI ===
// Bir folder cb degisiminde / item cb degisiminde tetiklenecek folder header refresh icin
// render anindaki referanslari sakla. key = parentKey (veya "(diger)").
const folderCbRefs = new Map(); // key -> { cb, cntEl, items: [{e, originalIdx}] (filter-onrasi visible olanlar) }

function matchesFilter(e, q) {
  if (!q) return true;
  return (e.name && e.name.toLowerCase().indexOf(q) !== -1)
    || (e.dateStr && e.dateStr.indexOf(q) !== -1)
    || (e.parentKey && e.parentKey.toLowerCase().indexOf(q) !== -1);
}

function refreshFolderHeader(key) {
  const ref = folderCbRefs.get(key);
  if (!ref) return;
  const total = ref.items.length;
  const sel = ref.items.reduce((n, { e }) => n + (e.selected !== false ? 1 : 0), 0);
  ref.cb.checked = total > 0 && sel === total;
  ref.cb.indeterminate = sel > 0 && sel < total;
  ref.cntEl.textContent = `${sel}/${total}`;
}

function renderEvrakList() {
  evrakListEl.innerHTML = "";
  folderCbRefs.clear();
  const q = (filterSearch.value || "").toLowerCase().trim();

  // evraks[] tarih sirasinda — ayni parentKey'e ait item'lar contiguous DEGIL.
  // Visual gruplama icin parentKey'e gore yeniden grupliyoruz; index ve selection
  // state'i ayni evraks[] index'inde duruyor.
  const groups = new Map(); // key -> { items: [{e, originalIdx}] }
  evraks.forEach((e, i) => {
    const key = e.parentKey || "(diger)";
    if (!groups.has(key)) groups.set(key, { items: [] });
    groups.get(key).items.push({ e, originalIdx: i });
  });

  for (const [key, group] of groups) {
    const visibleItems = group.items.filter(({ e }) => matchesFilter(e, q));
    if (q && visibleItems.length === 0) continue; // filtre hicbirini birakmadi — grup gizle

    const groupEl = document.createElement("div");
    groupEl.className = "folder-group";

    const header = document.createElement("div");
    header.className = "folder-header";

    const folderCb = document.createElement("input");
    folderCb.type = "checkbox";
    folderCb.id = "folder_cb_" + (folderCbRefs.size);
    folderCb.title = `Bu klasordeki tum evraklari sec/sec disi birak`;

    const folderLbl = document.createElement("label");
    folderLbl.className = "folder-name";
    folderLbl.htmlFor = folderCb.id;
    folderLbl.textContent = key;
    folderLbl.title = key;

    const cntEl = document.createElement("span");
    cntEl.className = "folder-count";

    header.appendChild(folderCb);
    header.appendChild(folderLbl);
    header.appendChild(cntEl);
    groupEl.appendChild(header);

    // Folder cb degisimi: filtre eslesen item'larin secimini toggle et
    // (filtreye ragmen grubun tamamini secen davranisi istemiyoruz — kullanici
    //  ne goruyorsa onu toggle eder, "Tumunu Sec" butonuyla ayni mantik.)
    folderCb.addEventListener("change", () => {
      const newState = folderCb.checked;
      for (const { e, originalIdx } of visibleItems) {
        e.selected = newState;
        const itemCb = document.getElementById("evcb_" + originalIdx);
        if (itemCb) itemCb.checked = newState;
      }
      folderCb.indeterminate = false;
      refreshFolderHeader(key);
      updateSelectionCount();
    });

    folderCbRefs.set(key, { cb: folderCb, cntEl, items: visibleItems });

    // Item'lar — filtre matchlemeyenler display:none (grup icinde gizli ama yer almis)
    for (const { e, originalIdx } of group.items) {
      const matches = matchesFilter(e, q);
      const row = document.createElement("div");
      row.className = "evrak-item" + (e.isEk ? " ev-ek" : "");
      if (!matches) row.style.display = "none";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "evcb_" + originalIdx;
      cb.dataset.idx = String(originalIdx);
      cb.checked = e.selected !== false;
      cb.addEventListener("change", () => {
        evraks[originalIdx].selected = cb.checked;
        refreshFolderHeader(key);
        updateSelectionCount();
      });

      const lbl = document.createElement("label");
      lbl.htmlFor = cb.id;
      const idText = e.evrakId ? "" : ` <span class="ev-noid">[evrakId yok]</span>`;
      const dateText = e.dateStr && e.dateStr !== "tarihsiz"
        ? `<span class="ev-date">${escapeHtml(e.dateStr.replace(/_/g, "."))}</span>`
        : `<span class="ev-date">(tarihsiz)</span>`;
      const ekPrefix = e.isEk
        ? `<span class="ev-ek-prefix">&#x21B3;</span> <span class="ev-ek-tag">EK${e.sira != null ? "-" + e.sira : ""}</span> `
        : "";
      lbl.innerHTML =
        `<span class="ev-name">${ekPrefix}${String(e.index).padStart(3, "0")}. ${escapeHtml(e.name || "(isimsiz)")}</span>` +
        `${dateText}${idText}`;

      row.appendChild(cb);
      row.appendChild(lbl);
      groupEl.appendChild(row);
    }

    evrakListEl.appendChild(groupEl);
    refreshFolderHeader(key);
  }

  updateSelectionCount();
}

function getSelectedItems() {
  return evraks.filter((e) => e.selected !== false);
}

function updateSelectionCount() {
  const sel = getSelectedItems().length;
  selCountEl.textContent = String(sel);
  totCountEl.textContent = String(evraks.length);
  const can = sel > 0 && !running;
  individualBtn.disabled = !can;
  mergedBtn.disabled = !can;
}

// === LISTELE ===
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith("https://avukat.uyap.gov.tr/")) {
    throw new Error("Aktif sekme UYAP avukat portali degil. Once avukat.uyap.gov.tr adresine gidin.");
  }
  return tab;
}

async function executeInMain(tabId, fn, args = []) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId }, world: "MAIN", func: fn, args
  });
  return res ? res.result : null;
}

async function ensureMainListInjected(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId }, world: "MAIN", files: ["main-list.js"]
  });
}

async function ensureContentInjected(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId }, files: ["content.js"]
  });
}

async function executeInIsolated(tabId, fn, args = []) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId }, func: fn, args
  });
  return res ? res.result : null;
}

async function doList() {
  if (running) return;
  setRunning(true);
  statusEl.classList.add("show");
  statusEl.innerHTML = "";
  log("Sayfa taraniyor (MAIN world DevExtreme erisimi)...", "muted");
  try {
    const tab = await getActiveTab();
    await ensureMainListInjected(tab.id);
    const result = await executeInMain(tab.id, async () => {
      if (typeof window.__uyapMainList === "function") return await window.__uyapMainList();
      return { ok: false, error: "main-list scripti yuklenemedi" };
    });

    if (!result || !result.ok) {
      log("Listeleme hatasi: " + escapeHtml((result && result.error) || "bilinmeyen"), "fail");
      setRunning(false);
      return;
    }

    evraks = (result.items || []).map((e) => ({ ...e, selected: true }));
    caseTitle = result.caseTitle || "";
    folder = result.folder || "";

    caseInfoEl.classList.add("show");
    const anaTxt = result.anaCount != null ? `${result.anaCount} ana` : "";
    const ekTxt = result.ekCount ? ` + ${result.ekCount} ek` : "";
    const pkTxt = Array.isArray(result.parentKeys) && result.parentKeys.length
      ? ` &middot; <b>Alt dosya:</b> ${result.parentKeys.map((k) => escapeHtml(k)).join(", ")}`
      : "";
    const canonTxt = result.canonicalDosyaIdCaptured
      ? ` &middot; <span style="color:#059669" title="REQUEST BODY'den ana dosyaId yakalandi">canonical dosyaId &#10003;</span>`
      : ` &middot; <span style="color:#dc2626" title="Ana dosya dosyaId yakalanmadi - sayfayi yenileyip Listele'ye tekrar basin">canonical dosyaId &#10007;</span>`;
    caseInfoEl.innerHTML =
      `<b>Dosya:</b> ${escapeHtml(caseTitle || "(isimsiz)")} &middot; ` +
      `<b>Klasor:</b> ${escapeHtml(folder)} &middot; ` +
      `<b>Evrak:</b> ${evraks.length}${anaTxt || ekTxt ? ` (${anaTxt}${ekTxt})` : ""}` +
      canonTxt +
      pkTxt +
      (result.missingId ? ` &middot; <span style="color:#dc2626">${result.missingId} evrakin evrakId'si yok</span>` : "");
    if (!result.canonicalDosyaIdCaptured) {
      log("UYARI: Ana dosya dosyaId yakalanamadi. Indirme 'vekil kaydi yok' hatasi verebilir. Dosya sekmesini YENILEYIP Listele'ye tekrar basin.", "fail");
    }

    filterBox.classList.add("show");
    filterSearch.value = "";
    renderEvrakList();
    log(`<b>${evraks.length}</b> evrak listelendi. Istemediginiz evraklari checkbox'tan kaldirin.`, "ok");
  } catch (e) {
    log("Hata: " + escapeHtml(String((e && e.message) || e)), "fail");
  } finally {
    setRunning(false);
  }
}

// === INDIRME ===
async function startDownload(mode, payloadOverride) {
  if (running) return;

  let items, completedIds, fld, ttl;
  if (payloadOverride) {
    items = payloadOverride.items;
    completedIds = payloadOverride.completedIds || [];
    fld = payloadOverride.folder;
    ttl = payloadOverride.caseTitle;
  } else {
    items = getSelectedItems().map((e) => ({
      index: e.index,
      name: e.name,
      dateStr: e.dateStr,
      evrakId: e.evrakId,
      dosyaId: e.dosyaId,
      parentKey: e.parentKey || "",
      isEk: !!e.isEk,
      sira: e.sira != null ? e.sira : null,
      anaEvrakId: e.anaEvrakId || null,
      itemData: e.itemData
    }));
    completedIds = [];
    fld = folder;
    ttl = caseTitle;
    if (items.length === 0) {
      log("Hic evrak secilmedi.", "fail");
      return;
    }

    // Aralik filtresi: SADECE Tek Tek Indir modunda, evrakın `it.index` degerine gore.
    // Bos input = sinir yok. Toplu PDF modu etkilenmez.
    // (Resume akisi payloadOverride ile gelir; bu blok calismaz.)
    if (mode === "individual") {
      const rs = parseInt(rangeStartEl.value, 10);
      const re = parseInt(rangeEndEl.value, 10);
      const lo = Number.isFinite(rs) && rs > 0 ? rs : null;
      const hi = Number.isFinite(re) && re > 0 ? re : null;
      if (lo != null && hi != null && lo > hi) {
        log(`Gecersiz aralik: ${lo} > ${hi}. (Bas <= Bit olmali.)`, "fail");
        return;
      }
      if (lo != null || hi != null) {
        const before = items.length;
        items = items.filter((it) => {
          const ix = it.index;
          if (typeof ix !== "number") return false;
          if (lo != null && ix < lo) return false;
          if (hi != null && ix > hi) return false;
          return true;
        });
        const loTxt = lo != null ? String(lo) : "*";
        const hiTxt = hi != null ? String(hi) : "*";
        if (items.length === 0) {
          log(`Aralik ${loTxt}-${hiTxt}: secili evraklar arasinda eslesen yok.`, "fail");
          return;
        }
        log(`Aralik ${loTxt}-${hiTxt} uygulandi: ${before} secimden <b>${items.length}</b> evrak indirilecek.`, "muted");
      }
    }
  }

  setRunning(true);
  setMode(mode);
  showProgressUi();
  resetProgressCounters(items.length);
  log(`Indirme baslatiliyor: <b>${items.length}</b> evrak, mod: <b>${modeLabel(mode)}</b>` +
      (completedIds.length ? ` (devam: ${completedIds.length} tamamlanmis atlanacak)` : ""), "info");

  try {
    const tab = await getActiveTab();
    // ONCE main-list.js (MAIN world) — postMessage handler hazir olsun
    await ensureMainListInjected(tab.id);
    // SONRA content.js (ISOLATED) — fetch isteklerini main-list.js'e bridge eder
    await ensureContentInjected(tab.id);
    const result = await executeInIsolated(tab.id, (opts) => {
      if (typeof window.__uyapStartDownload === "function") {
        return window.__uyapStartDownload(opts);
      }
      return Promise.resolve({ ok: false, error: "content scripti yuklenemedi" });
    }, [{ mode, items, completedIds, folder: fld, caseTitle: ttl }]);

    if (result && !result.ok) {
      log("Indirme baslatilamadi: " + escapeHtml(result.error || "bilinmeyen"), "fail");
      setRunning(false);
    }
  } catch (e) {
    log("Hata: " + escapeHtml(String((e && e.message) || e)), "fail");
    setRunning(false);
  }
}

// === RESUME ===
async function doResume() {
  if (!resumeState) return;
  const completedIds = new Set(resumeState.completedIds || []);
  // selected (full list) icinden tamamlanmamis olanlari getir; tamamlananlar zaten skip edilir ama yine de tum listeyi gonderiyoruz
  const items = resumeState.selected || [];
  const mode = resumeState.mode || "individual";
  hideResumeBanner();
  await startDownload(mode, {
    items,
    completedIds: Array.from(completedIds),
    folder: resumeState.folder,
    caseTitle: resumeState.caseTitle
  });
}

async function doCancelResume() {
  try { await chrome.storage.local.remove([STORAGE_KEY]); } catch (_) {}
  hideResumeBanner();
  log("Yarim kalmis indirme iptal edildi.", "muted");
}

// === DURDUR ===
async function doStop() {
  if (!running) return;
  stopBtn.disabled = true;
  stopBtn.textContent = "Durduruluyor...";
  log("Durdurma istendi. Mevcut evrak bitince donguden cikilacak.", "muted");
  try {
    const tab = await getActiveTab();
    await executeInIsolated(tab.id, () => {
      window.__uyapStopRequested = true;
      return true;
    });
  } catch (e) {
    log("Durdurma bayragi set edilemedi: " + escapeHtml(String((e && e.message) || e)), "fail");
    stopBtn.disabled = false;
    stopBtn.textContent = "Durdur";
  }
}

// === SECIM BUTONLARI ===
// Filtre aktifken sadece filtreyle eslesenleri toggle ediyoruz; matchesFilter
// renderEvrakList ile ayni (parentKey de dahil) — boylece klasor adina filter'lasan
// kullanici "Tumunu Sec"e basinca beklenen klasorun item'lari secilir.
selectAllBtn.addEventListener("click", () => {
  const q = (filterSearch.value || "").toLowerCase().trim();
  evraks.forEach((e) => {
    if (matchesFilter(e, q)) e.selected = true;
  });
  renderEvrakList();
});

selectNoneBtn.addEventListener("click", () => {
  const q = (filterSearch.value || "").toLowerCase().trim();
  evraks.forEach((e) => {
    if (matchesFilter(e, q)) e.selected = false;
  });
  renderEvrakList();
});

filterSearch.addEventListener("input", renderEvrakList);
listBtn.addEventListener("click", doList);
individualBtn.addEventListener("click", () => startDownload("individual"));
mergedBtn.addEventListener("click", () => startDownload("merged"));
resumeBtn.addEventListener("click", doResume);
cancelResumeBtn.addEventListener("click", doCancelResume);
stopBtn.addEventListener("click", doStop);

// === STATUS MESAJLARI ===
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "UYAP_STATUS") return;
  const s = msg.status || {};
  switch (s.phase) {
    case "preparing":
      log(escapeHtml(s.message || "Hazirlaniyor..."), "muted");
      break;
    case "start":
      total = s.total || 0;
      setProgress(0, total);
      setMode(s.mode);
      log(
        `Indirme basladi: <b>${total}</b> evrak. ` +
          (s.folder ? `Klasor: <b>${escapeHtml(s.folder)}</b>. ` : "") +
          (s.resumedFrom ? `(${s.resumedFrom} onceden tamamlanmis)` : ""),
        "info"
      );
      break;
    case "skipped-resume":
      okCount++;
      okCEl.textContent = String(okCount);
      setProgress(s.current, s.total);
      log(`(${s.current}/${s.total}) ${escapeHtml(s.name)} &rarr; daha once tamamlanmis, atlandi`, "muted");
      break;
    case "progress": {
      setProgress(s.current - 1, s.total);
      const attemptSuffix =
        s.attempt && s.attempt > 1
          ? ` <span style="color:#b45309">[deneme ${s.attempt}/${s.maxAttempts}]</span>`
          : "";
      log(`(${s.current}/${s.total}) ${escapeHtml(s.name)}${attemptSuffix} ...`, "muted");
      break;
    }
    case "attempt-fail": {
      const waitSec = Math.round((s.retryWaitMs || 0) / 1000);
      log(
        `  &rarr; deneme ${s.attempt}/${s.maxAttempts} basarisiz: ${escapeHtml(s.error || "")}${
          waitSec ? ` (${waitSec}sn sonra tekrar)` : ""
        }`,
        "fail"
      );
      break;
    }
    case "item-ok": {
      okCount++;
      okCEl.textContent = String(okCount);
      setProgress(s.current, s.total);
      const extInfo = s.ext && s.ext !== "pdf" ? ` <span style="color:#7c3aed">(.${escapeHtml(s.ext)})</span>` : "";
      const mergeNote = s.nonMergedInMerge ? ` <span style="color:#7c3aed">[merge disi - ayri kaydedildi]</span>` : "";
      const convNote = s.convertedToPdf && s.originalExt
        ? ` <span style="color:#0d9488">[.${escapeHtml(s.originalExt)} &rarr; .pdf]</span>`
        : "";
      log(`  &rarr; indirildi${extInfo}${convNote}${mergeNote}`, "ok");
      break;
    }
    case "item-warning": {
      log(`  &rarr; UYARI: ${escapeHtml(s.message || "")}`, "fail");
      break;
    }
    case "item-collected":
      okCount++;
      okCEl.textContent = String(okCount);
      setProgress(s.current, s.total);
      log(`  &rarr; toplandi (hafizada)`, "ok");
      break;
    case "item-fail": {
      failCount++;
      failCEl.textContent = String(failCount);
      setProgress(s.current, s.total);
      const attemptsStr = s.attempts ? ` (${s.attempts} deneme sonrasi)` : "";
      log(`  &rarr; HATA${attemptsStr}: ${escapeHtml(s.error || "")}`, "fail");
      break;
    }
    case "merging":
      log(`Birlestirme: <b>${s.count}</b> evrak pdf-lib ile birlestiriliyor...`, "info");
      break;
    case "done":
      if (s.mode === "merged" && s.merge) {
        if (s.merge.ok) {
          log(
            `Birlestirilmis PDF kaydedildi: <b>${escapeHtml(s.merge.filename)}</b>` +
              (s.merge.failedCount ? ` (${s.merge.failedCount} evrak birlestirmede atlandi)` : ""),
            "ok"
          );
        } else {
          log(`Birlestirme hatasi: ${escapeHtml(s.merge.error || "")}`, "fail");
        }
      }
      if (s.errorReport) {
        if (s.errorReport.ok) {
          log(`Hata raporu kaydedildi: <b>${escapeHtml(s.errorReport.filename)}</b>`, "fail");
        } else {
          log(`Hata raporu olusturulamadi: ${escapeHtml(s.errorReport.error || "")}`, "fail");
        }
      }
      log(
        `Bitti. Basarili: <b>${s.ok}</b>, Hatali: <b>${s.fail}</b>, Toplam: <b>${s.total}</b>.`,
        s.fail ? "fail" : "ok"
      );
      hideResumeBanner();
      setRunning(false);
      break;
    case "stopped":
      log(
        `Indirme durduruldu, <b>${s.ok || 0}</b> evrak indirildi. ` +
          `Popup'i tekrar acip <b>Devam Et</b> ile surdurebilirsiniz.`,
        "fail"
      );
      setRunning(false);
      checkResumeState();
      break;
    case "error":
      log(`Hata: ${escapeHtml(s.message || "")}`, "fail");
      setRunning(false);
      break;
  }
});

// === BASLAT ===
checkResumeState();
