// ISOLATED-world content script:
// - Indirme islerini koordine eder, chrome.runtime ile background.js'e mesaj atar.
// - PDF fetch isleri MAIN world'deki main-list.js'e window.postMessage ile delegate edilir
//   (ISOLATED'tan dogrudan fetch session cookie'lerini eksik gonderiyor; MAIN sayfanin
//   tarayici kimligi ile calistigi icin sorunsuz).
// - Artan retry gecikmesi (3sn, 5sn, 10sn) ile MAX_ATTEMPTS=4.
// - Her basarili evraktan sonra chrome.storage.local'a resume state'i yazar.
// - Bitince INDIRILEMEYENLER.txt'i background.js ile yazdirir.
(() => {
  if (window.__uyapContentInstalled) return;
  window.__uyapContentInstalled = true;

  const FETCH_TIMEOUT_MS = 30000;
  const FETCH_BRIDGE_OVERHEAD_MS = 5000; // postMessage overhead icin ek bekleme
  const INTER_ITEM_DELAY = 300;
  const MAX_ATTEMPTS = 4; // 1 ilk deneme + 3 retry
  const RETRY_DELAYS_MS = [3000, 5000, 10000]; // retry 1: 3sn, retry 2: 5sn, retry 3: 10sn
  const STORAGE_KEY = "uyap_resume_state";
  const PARALLEL_LIMIT = 3;
  // BUGFIX: chrome.runtime.sendMessage 64MiB sinirini asmamak icin merge
  // payload'unu chunk'lara bolup BEGIN/APPEND.../FINISH yoluyla yolluyoruz.
  // Her chunk ayri bir mesaj — boylece tek bir mesaj asla 64MiB'i gormesin.
  const MERGE_CHUNK_SIZE = 10;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const TR_ASCII_MAP = {
    "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G",
    "ı": "i", "İ": "I", "ö": "o", "Ö": "O",
    "ş": "s", "Ş": "S", "ü": "u", "Ü": "U"
  };
  function turkishToAscii(s) {
    return String(s || "").replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_ASCII_MAP[ch] || ch);
  }
  function sanitizeFilename(name) {
    return (
      turkishToAscii(name)
        .replace(/[\\/:*?"<>|\r\n\t]+/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 120) || "evrak"
    );
  }

  // === MAIN-WORLD KOPRU ===
  // main-list.js (MAIN) FETCH_EVRAK_REQUEST mesajlarini dinler, fetch yapar,
  // FETCH_EVRAK_RESPONSE ile cevap doner. Burada unique reqId ile correlation.
  function fetchEvrakAsBase64(rec, timeoutMs) {
    return new Promise((resolve) => {
      if (!rec.evrakId || !rec.dosyaId) {
        resolve({ ok: false, error: "evrakId veya dosyaId eksik", url: "?" });
        return;
      }
      const reqId =
        "uf_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      let settled = false;

      const handler = (event) => {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.__uyap !== true || msg.type !== "FETCH_EVRAK_RESPONSE") return;
        if (msg.reqId !== reqId) return;
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve({
          ok: !!msg.ok,
          base64: msg.base64,
          mimeType: msg.mimeType,
          ext: msg.ext,
          error: msg.error,
          url: msg.url
        });
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", handler);
        resolve({
          ok: false,
          error: "MAIN bridge cevap vermedi (main-list.js inject edilmis mi?)",
          url: "?"
        });
      }, timeoutMs + FETCH_BRIDGE_OVERHEAD_MS);

      window.addEventListener("message", handler);

      try {
        window.postMessage({
          __uyap: true,
          type: "FETCH_EVRAK_REQUEST",
          reqId,
          evrakId: rec.evrakId,
          dosyaId: rec.dosyaId,
          yargiTuru: rec.yargiTuru,   // vatandas portali icin zorunlu
          timeoutMs
        }, "*");
      } catch (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve({ ok: false, error: "postMessage hatasi: " + String((e && e.message) || e), url: "?" });
      }
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      try { chrome.storage.local.set({ [key]: value }, () => resolve(true)); }
      catch (_) { resolve(false); }
    });
  }
  function storageRemove(key) {
    return new Promise((resolve) => {
      try { chrome.storage.local.remove([key], () => resolve(true)); }
      catch (_) { resolve(false); }
    });
  }

  function statusBack(status) {
    try { chrome.runtime.sendMessage({ type: "UYAP_STATUS", status }).catch(() => {}); } catch (_) {}
  }

  // Parcali (chunk'li) merge: BEGIN ile oturum ac, evraklari MERGE_CHUNK_SIZE'lik
  // gruplar halinde APPEND ile yolla, FINISH ile birlestir/yaz. Hata olursa
  // (BEGIN/APPEND basarisiz olursa) CANCEL ile offscreen oturumunu temizle.
  // Donus seklı eski UYAP_MERGE'inkiyle ayni:
  //   { ok, filename, downloadId, mergedCount, failedCount, error? }
  async function mergeChunked(meta, items) {
    let sessionId = null;
    try {
      const beginResp = await chrome.runtime.sendMessage({
        type: "UYAP_MERGE_BEGIN",
        folder: meta.folder,
        caseTitle: meta.caseTitle,
        downloadedAt: new Date().toISOString()
      });
      if (!beginResp || !beginResp.ok || !beginResp.sessionId) {
        return { ok: false, error: (beginResp && beginResp.error) || "merge BEGIN basarisiz" };
      }
      sessionId = beginResp.sessionId;

      for (let i = 0; i < items.length; i += MERGE_CHUNK_SIZE) {
        const chunk = items.slice(i, i + MERGE_CHUNK_SIZE);
        const appendResp = await chrome.runtime.sendMessage({
          type: "UYAP_MERGE_APPEND",
          sessionId,
          items: chunk
        });
        if (!appendResp || !appendResp.ok) {
          return { ok: false, error: (appendResp && appendResp.error) || "merge APPEND basarisiz" };
        }
      }

      const finishResp = await chrome.runtime.sendMessage({
        type: "UYAP_MERGE_FINISH",
        sessionId,
        folder: meta.folder
      });
      // FINISH offscreen tarafinda da oturumu sildigi icin finally'de
      // ek CANCEL yollamaya gerek yok.
      sessionId = null;
      return finishResp || { ok: false, error: "merge FINISH cevap yok" };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    } finally {
      if (sessionId) {
        try {
          await chrome.runtime.sendMessage({ type: "UYAP_MERGE_CANCEL", sessionId });
        } catch (_) {}
      }
    }
  }


  async function downloadSelected(opts) {
    if (window.__uyapContentRunning) return { ok: false, error: "Zaten calisiyor" };
    window.__uyapContentRunning = true;
    window.__uyapStopRequested = false;

    const rawMode = opts && opts.mode;
    const mode = rawMode === "merged" ? "merged" : "individual";
    const isMerged = mode === "merged";

    const items = (opts && Array.isArray(opts.items)) ? opts.items : [];
    const folder = (opts && opts.folder) || "dosya";
    const caseTitle = (opts && opts.caseTitle) || "";
    const resumeCompletedIds = new Set((opts && Array.isArray(opts.completedIds)) ? opts.completedIds : []);

    let okCount = 0;
    let failCount = 0;
    const collected = [];
    const failedList = [];

    try {
      if (items.length === 0) {
        statusBack({ phase: "error", message: "Indirilecek evrak yok." });
        return { ok: false, error: "Indirilecek evrak yok." };
      }

      const total = items.length;
      statusBack({
        phase: "start",
        total,
        folder,
        mode,
        resumedFrom: resumeCompletedIds.size
      });

      const stateBase = {
        startedAt: Date.now(),
        folder,
        caseTitle,
        mode,
        total,
        selected: items,
        completedIds: Array.from(resumeCompletedIds),
        failed: [],
        status: "running"
      };
      await storageSet(STORAGE_KEY, stateBase);

      let stoppedEarly = false;
      let finishedCount = 0; // tamamlanmis (ok+fail+skip) evrak sayisi — paralel progress icin

      // Paralel worker'lar nextIndex'i atomik tuketir (JS single-threaded oldugundan
      // `const i = nextIndex; nextIndex++` arasi await yok — race yok).
      let nextIndex = 0;

      async function processOne(i) {
        const it = items[i];
        const evrakId = it.evrakId;
        const name = sanitizeFilename(it.name || `evrak_${i + 1}`);
        const dateStr = it.dateStr || "tarihsiz";

        // Resume skip (sadece individual)
        if (!isMerged && evrakId && resumeCompletedIds.has(evrakId)) {
          finishedCount++;
          okCount++;
          statusBack({ phase: "skipped-resume", current: finishedCount, total, name });
          return;
        }

        if (!evrakId) {
          finishedCount++;
          failCount++;
          const err = "evrakId yok (AJX cevabinda eksik)";
          failedList.push({ index: it.index, name: it.name, dateStr, error: err });
          statusBack({ phase: "item-fail", current: finishedCount, total, name, error: err });
          return;
        }

        let result = null;
        let lastError = null;

        // Retry mantigi: her evrak icin bagimsiz; bir worker bekleyince digerleri devam eder.
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          if (attempt > 1) {
            const wait = RETRY_DELAYS_MS[attempt - 2] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
            await sleep(wait);
          }
          statusBack({
            phase: "progress",
            current: finishedCount + 1, total, name,
            attempt, maxAttempts: MAX_ATTEMPTS
          });

          try {
            const rec = { evrakId: it.evrakId, dosyaId: it.dosyaId, yargiTuru: it.yargiTuru };
            const r = await fetchEvrakAsBase64(rec, FETCH_TIMEOUT_MS);
            if (r.ok) { result = r; break; }
            lastError = r.error;
          } catch (e) {
            lastError = String((e && e.message) || e);
          }

          if (attempt < MAX_ATTEMPTS) {
            const nextWait = RETRY_DELAYS_MS[attempt - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
            statusBack({
              phase: "attempt-fail",
              current: finishedCount + 1, total, name,
              attempt, maxAttempts: MAX_ATTEMPTS,
              error: lastError, willRetry: true, retryWaitMs: nextWait
            });
          }
        }

        if (!result) {
          finishedCount++;
          failCount++;
          failedList.push({ index: it.index, name: it.name, dateStr, error: lastError || "alinamadi" });
          statusBack({
            phase: "item-fail",
            current: finishedCount, total, name,
            error: lastError || "alinamadi", attempts: MAX_ATTEMPTS
          });
          await storageSet(STORAGE_KEY, {
            ...stateBase,
            completedIds: Array.from(resumeCompletedIds),
            failed: failedList,
            lastUpdate: Date.now()
          });
          return;
        }

        const ext = result.ext || "pdf";
        const mimeType = result.mimeType || "application/pdf";

        if (isMerged) {
          // collected'in sirasi worker tamamlanma sirasina gore degisebilir — birlestirmeden
          // ONCE index'e gore sort edecegiz, oraya guvenebiliriz.
          collected.push({
            index: it.index,
            name: it.name || `evrak_${i + 1}`,
            nameAscii: name,
            date: dateStr,
            ext,
            base64: result.base64
          });
          finishedCount++;
          okCount++;
          resumeCompletedIds.add(evrakId);
          statusBack({ phase: "item-collected", current: finishedCount, total, name, ext });
        } else {
          // Individual mod: evraki UYAP'tan geldigi orijinal formatta (pdf/tiff/jpeg/png)
          // diske yaz. PDF'e cevirme yok — kullanici kaynak dosyayi oldugu gibi istiyor.
          try {
            const filename = `uyap-evraklar/${folder}/${String(it.index).padStart(3, "0")}_${name}_${dateStr}.${ext}`;
            const resp = await chrome.runtime.sendMessage({
              type: "UYAP_DOWNLOAD",
              base64: result.base64,
              mimeType,
              filename
            });
            if (resp && resp.ok) {
              finishedCount++;
              okCount++;
              resumeCompletedIds.add(evrakId);
              statusBack({
                phase: "item-ok",
                current: finishedCount, total, name,
                downloadId: resp.downloadId,
                ext
              });
            } else {
              finishedCount++;
              failCount++;
              const err = (resp && resp.error) || "indirme hatasi";
              failedList.push({ index: it.index, name: it.name, dateStr, error: err });
              statusBack({ phase: "item-fail", current: finishedCount, total, name, error: err });
            }
          } catch (e) {
            finishedCount++;
            failCount++;
            const err = String((e && e.message) || e);
            failedList.push({ index: it.index, name: it.name, dateStr, error: err });
            statusBack({ phase: "item-fail", current: finishedCount, total, name, error: err });
          }
        }

        await storageSet(STORAGE_KEY, {
          ...stateBase,
          completedIds: Array.from(resumeCompletedIds),
          failed: failedList,
          lastUpdate: Date.now()
        });
      }

      async function worker() {
        while (true) {
          if (window.__uyapStopRequested) {
            stoppedEarly = true;
            return;
          }
          const i = nextIndex++;
          if (i >= items.length) return;
          await processOne(i);
          // Worker basina inter-item delay; durduruldysa veya is bittiyse bekleme.
          if (nextIndex < items.length && !window.__uyapStopRequested) {
            await sleep(INTER_ITEM_DELAY);
          }
        }
      }

      const workerCount = Math.max(1, Math.min(PARALLEL_LIMIT, items.length));
      const workers = [];
      for (let w = 0; w < workerCount; w++) workers.push(worker());
      await Promise.all(workers);

      if (stoppedEarly) {
        await storageSet(STORAGE_KEY, {
          ...stateBase,
          completedIds: Array.from(resumeCompletedIds),
          failed: failedList,
          status: "stopped",
          stoppedAt: Date.now(),
          lastUpdate: Date.now()
        });
        statusBack({
          phase: "stopped",
          ok: okCount,
          fail: failCount,
          total: items.length,
          mode
        });
        return { ok: true, stopped: true, okCount, failCount, total: items.length };
      }

      let mergeResult = null;
      if (isMerged && collected.length > 0) {
        // Paralel toplama sirasi kaotik — birlestirmeden once orijinal evrak sirasini geri yukle.
        collected.sort((a, b) => {
          const ai = a.index == null ? Number.MAX_SAFE_INTEGER : a.index;
          const bi = b.index == null ? Number.MAX_SAFE_INTEGER : b.index;
          return ai - bi;
        });
        statusBack({ phase: "merging", count: collected.length });
        try {
          const resp = await mergeChunked({ folder, caseTitle }, collected);
          if (resp && resp.ok) {
            mergeResult = {
              ok: true,
              filename: resp.filename,
              downloadId: resp.downloadId,
              mergedCount: resp.mergedCount,
              failedCount: resp.failedCount
            };
          } else {
            mergeResult = { ok: false, error: (resp && resp.error) || "birlestirme hatasi" };
          }
        } catch (e) {
          mergeResult = { ok: false, error: String((e && e.message) || e) };
        }
      }

      let errorReport = null;
      if (failedList.length > 0) {
        try {
          const reportResp = await chrome.runtime.sendMessage({
            type: "UYAP_ERROR_REPORT",
            folder, caseTitle,
            generatedAt: new Date().toISOString(),
            failed: failedList,
            totalAttempted: items.length,
            okCount, failCount
          });
          errorReport = reportResp && reportResp.ok
            ? { ok: true, filename: reportResp.filename }
            : { ok: false, error: (reportResp && reportResp.error) || "rapor olusturulamadi" };
        } catch (e) {
          errorReport = { ok: false, error: String((e && e.message) || e) };
        }
      }

      await storageRemove(STORAGE_KEY);

      statusBack({
        phase: "done",
        ok: okCount, fail: failCount,
        total: items.length,
        mode, merge: mergeResult, errorReport
      });

      return { ok: true, okCount, failCount, total: items.length };
    } catch (e) {
      statusBack({ phase: "error", message: String((e && e.message) || e) });
      return { ok: false, error: String((e && e.message) || e) };
    } finally {
      window.__uyapContentRunning = false;
    }
  }

  window.__uyapStartDownload = function (opts) {
    return downloadSelected(opts || {});
  };
})();
