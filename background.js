const OFFSCREEN_URL = "offscreen.html";

async function hasOffscreenDocument() {
  try {
    if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"]
      });
      return contexts && contexts.length > 0;
    }
  } catch (_) {}
  if (chrome.offscreen && typeof chrome.offscreen.hasDocument === "function") {
    try { return await chrome.offscreen.hasDocument(); } catch (_) {}
  }
  return false;
}

async function ensureOffscreen() {
  if (await hasOffscreenDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["BLOBS"],
      justification: "pdf-lib ile evrak PDF'lerini tek bir PDF'e birlestirir"
    });
  } catch (e) {
    if (!/already|exists/i.test(String((e && e.message) || e))) throw e;
  }
}

const TR_ASCII_MAP = {
  "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G",
  "ı": "i", "İ": "I", "ö": "o", "Ö": "O",
  "ş": "s", "Ş": "S", "ü": "u", "Ü": "U"
};

function turkishToAsciiServer(s) {
  return String(s || "").replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_ASCII_MAP[ch] || ch);
}

function sanitizeFolderName(s) {
  return turkishToAsciiServer(s)
    .replace(/[\\/:*?"<>|\r\n\t]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120) || "dosya";
}

function downloadBase64File(base64, filename, mimeType) {
  return new Promise((resolve) => {
    const mt = mimeType || "application/pdf";
    const url = `data:${mt};base64,${base64}`;
    chrome.downloads.download(
      { url, filename, conflictAction: "uniquify", saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else if (downloadId === undefined) {
          resolve({ ok: false, error: "downloadId yok" });
        } else {
          resolve({ ok: true, downloadId });
        }
      }
    );
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  const CHUNK = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function downloadTextFile(text, filename, mime = "text/plain;charset=utf-8") {
  return new Promise((resolve) => {
    // UTF-8 BOM Windows Not Defteri Turkce uyumu icin
    const withBom = "﻿" + text;
    const b64 = utf8ToBase64(withBom);
    const url = `data:${mime};base64,${b64}`;
    chrome.downloads.download(
      { url, filename, conflictAction: "overwrite", saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else if (downloadId === undefined) {
          resolve({ ok: false, error: "downloadId yok" });
        } else {
          resolve({ ok: true, downloadId });
        }
      }
    );
  });
}

async function handleMerge(payload) {
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    return { ok: false, error: "birlestirilecek evrak yok" };
  }

  await ensureOffscreen();

  let offscreenResult;
  try {
    offscreenResult = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "UYAP_OFFSCREEN_MERGE",
      payload
    });
  } catch (e) {
    return { ok: false, error: "offscreen mesaj hatasi: " + String((e && e.message) || e) };
  }

  if (!offscreenResult || !offscreenResult.ok || !offscreenResult.base64) {
    return {
      ok: false,
      error: (offscreenResult && offscreenResult.error) || "offscreen birlestirme basarisiz"
    };
  }

  const folder = sanitizeFolderName(payload.folder || "dosya");
  const filename = `uyap-evraklar/${folder}/${folder}_TUM_EVRAKLAR.pdf`;
  const dl = await downloadBase64File(offscreenResult.base64, filename, "application/pdf");
  if (!dl.ok) return { ok: false, error: dl.error };

  return {
    ok: true,
    downloadId: dl.downloadId,
    filename,
    mergedCount: offscreenResult.mergedCount,
    failedCount: offscreenResult.failedCount
  };
}

function formatDateTr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildErrorReportText(payload) {
  const folder = payload.folder || "dosya";
  const caseTitle = payload.caseTitle || "";
  const gen = new Date(payload.generatedAt || Date.now());
  const failed = Array.isArray(payload.failed) ? payload.failed : [];
  const total = payload.totalAttempted || 0;
  const okC = payload.okCount || 0;
  const failC = payload.failCount || failed.length;

  const lines = [];
  lines.push("UYAP EVRAK INDIRME - INDIRILEMEYEN EVRAKLAR RAPORU");
  lines.push("=".repeat(60));
  lines.push(`Dosya              : ${caseTitle}`);
  lines.push(`Klasor             : ${folder}`);
  lines.push(`Rapor Tarihi       : ${formatDateTr(gen)}`);
  lines.push(`Toplam Denenen     : ${total}`);
  lines.push(`Basarili           : ${okC}`);
  lines.push(`Basarisiz          : ${failC}`);
  lines.push("");
  lines.push("INDIRILEMEYEN EVRAKLAR:");
  lines.push("-".repeat(60));
  if (failed.length === 0) {
    lines.push("(Hata yok)");
  } else {
    failed.forEach((f, i) => {
      const idx = f.index != null ? f.index : i + 1;
      const name = f.name || "(isimsiz)";
      const date = f.dateStr || f.date || "tarihsiz";
      const err = f.error || "bilinmeyen hata";
      lines.push(`${String(idx).padStart(3, "0")}. ${name}`);
      lines.push(`     Tarih : ${date.replace(/_/g, ".")}`);
      lines.push(`     Hata  : ${err}`);
      lines.push("");
    });
  }
  lines.push("=".repeat(60));
  lines.push("Tekrar denemek icin UYAP Evrak Indirici eklentisini tekrar acin.");
  lines.push("'Devam Et' butonu ile kaldigi yerden devam edilebilir.");
  return lines.join("\r\n");
}

// === PARCALI MERGE RELAY ===
// content.js cilt/koleksiyon evraklarini tek mesajda gondermek yerine
// BEGIN/APPEND/FINISH adimlariyla chunk'lara bolup yolluyor. Boylece
// chrome.runtime.sendMessage'in 64MiB sinirini asmiyoruz.

async function handleMergeBeginBg(payload) {
  await ensureOffscreen();
  try {
    const res = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "UYAP_OFFSCREEN_MERGE_BEGIN",
      payload: {
        folder: payload && payload.folder,
        caseTitle: payload && payload.caseTitle,
        downloadedAt: payload && payload.downloadedAt
      }
    });
    return res || { ok: false, error: "offscreen cevap yok" };
  } catch (e) {
    return { ok: false, error: "offscreen mesaj hatasi: " + String((e && e.message) || e) };
  }
}

async function handleMergeAppendBg(payload) {
  try {
    const res = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "UYAP_OFFSCREEN_MERGE_APPEND",
      payload: {
        sessionId: payload && payload.sessionId,
        items: (payload && payload.items) || []
      }
    });
    return res || { ok: false, error: "offscreen cevap yok" };
  } catch (e) {
    return { ok: false, error: "offscreen mesaj hatasi: " + String((e && e.message) || e) };
  }
}

async function handleMergeFinishBg(payload) {
  let offscreenResult;
  try {
    offscreenResult = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "UYAP_OFFSCREEN_MERGE_FINISH",
      payload: { sessionId: payload && payload.sessionId }
    });
  } catch (e) {
    return { ok: false, error: "offscreen mesaj hatasi: " + String((e && e.message) || e) };
  }
  if (!offscreenResult || !offscreenResult.ok || !offscreenResult.base64) {
    return {
      ok: false,
      error: (offscreenResult && offscreenResult.error) || "offscreen birlestirme basarisiz"
    };
  }

  const folder = sanitizeFolderName(payload.folder || "dosya");
  const filename = `uyap-evraklar/${folder}/${folder}_TUM_EVRAKLAR.pdf`;
  const dl = await downloadBase64File(offscreenResult.base64, filename, "application/pdf");
  if (!dl.ok) return { ok: false, error: dl.error };

  return {
    ok: true,
    downloadId: dl.downloadId,
    filename,
    mergedCount: offscreenResult.mergedCount,
    failedCount: offscreenResult.failedCount
  };
}

async function handleMergeCancelBg(payload) {
  try {
    const res = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "UYAP_OFFSCREEN_MERGE_CANCEL",
      payload: { sessionId: payload && payload.sessionId }
    });
    return res || { ok: true };
  } catch (_) {
    return { ok: true };
  }
}

async function handleConvertSingle(payload) {
  if (!payload || !payload.base64) {
    return { ok: false, error: "base64 eksik" };
  }
  await ensureOffscreen();
  let res;
  try {
    res = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "UYAP_CONVERT_SINGLE",
      payload: { base64: payload.base64, ext: payload.ext }
    });
  } catch (e) {
    return { ok: false, error: "offscreen mesaj hatasi: " + String((e && e.message) || e) };
  }
  if (!res || !res.ok || !res.base64) {
    return { ok: false, error: (res && res.error) || "donusum basarisiz" };
  }
  return { ok: true, base64: res.base64 };
}

async function handleErrorReport(payload) {
  const folder = sanitizeFolderName(payload.folder || "dosya");
  const text = buildErrorReportText(payload);
  const filename = `uyap-evraklar/${folder}/INDIRILEMEYENLER.txt`;
  const dl = await downloadTextFile(text, filename);
  if (!dl.ok) return { ok: false, error: dl.error };
  return { ok: true, filename, downloadId: dl.downloadId };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.target === "offscreen") return;

  if (msg.type === "UYAP_DOWNLOAD") {
    const { base64, filename, mimeType } = msg;
    if (!base64 || !filename) {
      sendResponse({ ok: false, error: "base64 veya filename eksik" });
      return true;
    }
    downloadBase64File(base64, filename, mimeType).then(sendResponse);
    return true;
  }

  if (msg.type === "UYAP_MERGE") {
    handleMerge(msg).then(
      (r) => sendResponse(r),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true;
  }

  if (msg.type === "UYAP_MERGE_BEGIN") {
    handleMergeBeginBg(msg).then(
      (r) => sendResponse(r),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true;
  }

  if (msg.type === "UYAP_MERGE_APPEND") {
    handleMergeAppendBg(msg).then(
      (r) => sendResponse(r),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true;
  }

  if (msg.type === "UYAP_MERGE_FINISH") {
    handleMergeFinishBg(msg).then(
      (r) => sendResponse(r),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true;
  }

  if (msg.type === "UYAP_MERGE_CANCEL") {
    handleMergeCancelBg(msg).then(
      (r) => sendResponse(r),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true;
  }

  if (msg.type === "UYAP_CONVERT_SINGLE") {
    handleConvertSingle(msg.payload || { base64: msg.base64, ext: msg.ext }).then(
      (r) => sendResponse(r),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true;
  }

  if (msg.type === "UYAP_ERROR_REPORT") {
    handleErrorReport(msg).then(
      (r) => sendResponse(r),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("[UYAP Indirici] Yuklendi.");
});
