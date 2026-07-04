// MAIN-world script: evrak listesini window.__uyapEvrakData'dan (inject.js yakalar) cikarir.
// Eger veri yoksa, list_dosya_evraklar.ajx'i kendisi POST eder.
// Her ana evragin ekEvrakListesi'ndeki ek evraklari da parent'in hemen altina ekler.
// popup.js bu dosyayi inject eder, sonra __uyapMainList() cagirir.
(() => {
  if (window.__uyapMainListInstalled) return;
  window.__uyapMainListInstalled = true;

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

  function parseTrDate(raw) {
    const s = String(raw || "");
    const m = s.match(/(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})/);
    if (!m) return { dateStr: "tarihsiz", sortKey: "99999999", hasDate: false };
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3];
    return {
      dateStr: `${day}_${month}_${year}`,
      sortKey: `${year}${month}${day}`,
      hasDate: true
    };
  }

  async function waitForEvrakData(timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const d = window.__uyapEvrakData;
      if (d && d.tumEvraklar && typeof d.tumEvraklar === "object") return d;
      await sleep(100);
    }
    return null;
  }

  async function fetchEvrakListDirect() {
    const url = window.location.origin + "/list_dosya_evraklar.ajx";
    try {
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body: ""
      });
      if (!resp.ok) return { ok: false, error: `list_dosya_evraklar.ajx HTTP ${resp.status}` };
      const text = await resp.text();
      try {
        const data = JSON.parse(text);
        if (data && data.tumEvraklar) {
          window.__uyapEvrakData = data;
          window.__uyapEvrakDataAt = Date.now();
          return { ok: true, data };
        }
        return { ok: false, error: "Cevapta tumEvraklar yok" };
      } catch (e) {
        return { ok: false, error: "JSON parse hatasi: " + String(e.message || e) };
      }
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }

  function primitiveItemData(ev) {
    const out = {};
    if (!ev || typeof ev !== "object") return out;
    for (const k of Object.keys(ev)) {
      const v = ev[k];
      if (v == null) continue;
      if (typeof v === "object" || typeof v === "function") continue;
      out[k] = v;
    }
    return out;
  }

  // opts:
  //   parentKey: tumEvraklar nesnesinin top-level key'i
  //   isEk: true ise ek evrak
  //   canonicalDosyaId: list_dosya_evraklar.ajx REQUEST BODY'sinden gelen ana dosya dosyaId.
  //     Varsa her evrak icin (ana + ek) ONCELIKLE bunu kullan; cunku response'taki per-evrak
  //     dosyaId'ler alt dosya ID'leri olup view_document_brd.uyap'a "vekil kaydi yok" verir.
  //   inheritedDosyaId: ek evrak icin parent'tan miras (canonical yoksa fallback)
  //   inheritedDateRaw: ek evrak icin parent'tan miras tarih (orn "20/05/2026")
  function buildEvrakRecord(ev, domOrder, opts) {
    opts = opts || {};
    const isEk = !!opts.isEk;

    const evrakId = ev && ev.evrakId != null ? String(ev.evrakId) : null;

    // dosyaId oncelik: canonical (inject body) > ev.dosyaId > inherited
    let dosyaId = null;
    if (opts.canonicalDosyaId) {
      dosyaId = String(opts.canonicalDosyaId);
    } else if (ev && ev.dosyaId != null) {
      dosyaId = String(ev.dosyaId);
    } else if (opts.inheritedDosyaId) {
      dosyaId = String(opts.inheritedDosyaId);
    }

    const tur = isEk
      ? (ev && (ev.ekTuru || ev.tur)) || "ek evrak"
      : (ev && (ev.tur || ev.evrakAdi || ev.evrakTuru || ev.aciklama)) || "evrak";

    const dateRaw = isEk
      ? String(opts.inheritedDateRaw || "")
      : String((ev && (ev.onaylandigiTarih || ev.tarih || ev.olusturmaTarihi)) || "");

    const dateInfo = parseTrDate(dateRaw);

    return {
      rawText: `${tur} ${dateRaw}`.trim(),
      name: String(tur),
      dateStr: dateInfo.dateStr,
      sortKey: dateInfo.sortKey,
      hasDate: dateInfo.hasDate,
      domOrder,
      evrakId,
      dosyaId,
      parentKey: String(opts.parentKey || ""),
      isEk,
      anaEvrakId: isEk && ev ? (ev.anaEvrakId != null ? String(ev.anaEvrakId) : null) : null,
      sira: isEk && ev && ev.sira != null ? Number(ev.sira) : null,
      itemData: primitiveItemData(ev)
    };
  }

  function isElVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function cleanTitle(raw) {
    if (!raw) return "";
    // Satir sonu veya tire goruldugunde kes
    const cutIdx = String(raw).search(/[\n\r–—\-]/);
    let t = cutIdx >= 0 ? String(raw).slice(0, cutIdx) : String(raw);
    return t.replace(/\s+/g, " ").trim();
  }

  // Ornek: "2023/1079 Cal Cumhuriyet Bassavciligi"
  function getCaseTitleFromDom() {
    const selectors = [
      ".dx-popup-wrapper .dx-popup-title .dx-toolbar-before .dx-toolbar-label",
      ".dx-popup-title .dx-toolbar-before .dx-toolbar-label",
      ".dx-popup-wrapper .dx-popup-title .dx-toolbar-label",
      ".dx-popup-title .dx-toolbar-label",
      ".dx-popup-wrapper .dx-popup-title",
      ".dx-popup-title"
    ];
    const matchesPattern = (t) => /\d{4}\s*\/\s*\d+/.test(t);
    let fallback = null;
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!isElVisible(el)) continue;
        const cleaned = cleanTitle(el.textContent || "");
        if (!cleaned) continue;
        if (matchesPattern(cleaned)) return cleaned;
        if (!fallback) fallback = cleaned;
      }
    }
    return fallback || "";
  }

  // tumEvraklar'i flatten et: her ana evragin ardindan kendi ekleri gelir.
  // Ana evraklar tarihe gore sirali, ekler sira'ya gore sirali.
  // canonicalDosyaId: inject.js'in REQUEST BODY'den yakaladigi ana dosya dosyaId.
  function flattenEvraks(tumEvraklar, canonicalDosyaId) {
    const mains = [];
    let order = 0;
    const keys = Object.keys(tumEvraklar);

    for (const key of keys) {
      const arr = tumEvraklar[key];
      if (!Array.isArray(arr)) continue;
      for (const ev of arr) {
        const main = buildEvrakRecord(ev, order++, {
          parentKey: key,
          isEk: false,
          canonicalDosyaId
        });
        if (!main.evrakId) continue;

        // Ek evraklari topla
        const ekListRaw = ev && Array.isArray(ev.ekEvrakListesi) ? ev.ekEvrakListesi : [];
        const ekParentDate = (ev && (ev.onaylandigiTarih || ev.tarih || ev.olusturmaTarihi)) || "";
        const eks = ekListRaw
          .map((ek, idx) => buildEvrakRecord(ek, idx, {
            parentKey: key,
            isEk: true,
            canonicalDosyaId,                  // ek de canonical kullansin
            inheritedDosyaId: main.dosyaId,    // canonical yoksa parent'tan miras
            inheritedDateRaw: ekParentDate
          }))
          .filter((e) => e.evrakId)
          .sort((a, b) => {
            const sa = a.sira != null ? a.sira : 999999;
            const sb = b.sira != null ? b.sira : 999999;
            if (sa !== sb) return sa - sb;
            return a.domOrder - b.domOrder;
          });

        main.__eks = eks;
        mains.push(main);
      }
    }

    // Ana evraklari tarihe gore sirala
    mains.sort((a, b) => {
      if (a.hasDate && b.hasDate) {
        if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
        return a.domOrder - b.domOrder;
      }
      if (a.hasDate) return -1;
      if (b.hasDate) return 1;
      return a.domOrder - b.domOrder;
    });

    // Flatten: her ana evrak + kendi ekleri
    const final = [];
    for (const main of mains) {
      const eks = main.__eks || [];
      delete main.__eks;
      final.push(main);
      for (const ek of eks) final.push(ek);
    }
    return { items: final, firstKey: keys[0] || "" };
  }

  // === MAIN-WORLD FETCH BRIDGE ===
  // ISOLATED content.js fetch ile oturum cookie'lerini eksik gonderdiginden (HTML cevap
  // sonucu) tum view_document_brd.uyap fetch'leri buradan, MAIN world'den yapilir.

  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }
  function looksLikeBase64(s) {
    if (typeof s !== "string") return false;
    const cleaned = s.replace(/\s+/g, "");
    if (cleaned.length < 200) return false;
    return /^[A-Za-z0-9+/=_-]+$/.test(cleaned);
  }
  function isPdfBase64(b64) {
    return typeof b64 === "string" && b64.length > 50 && /^JVBER[a-zA-Z0-9+/=_-]/.test(b64);
  }
  function extractBase64FromJson(obj) {
    const preferredKeys = [
      "data", "base64", "pdf", "pdfBase64", "content",
      "fileContent", "evrak", "icerik", "dosya", "value", "result"
    ];
    const seen = new Set();
    const walk = (n) => {
      if (n == null) return null;
      if (typeof n === "string") {
        const cleaned = n.replace(/\s+/g, "");
        return looksLikeBase64(cleaned) ? cleaned : null;
      }
      if (typeof n !== "object" || seen.has(n)) return null;
      seen.add(n);
      for (const k of preferredKeys) {
        if (k in n) { const v = walk(n[k]); if (v) return v; }
      }
      for (const k of Object.keys(n)) {
        const v = walk(n[k]); if (v) return v;
      }
      return null;
    };
    return walk(obj);
  }

  function buildViewDocUrl(evrakId, dosyaId) {
    const base = window.location.origin + "/view_document_brd.uyap";
    const params = new URLSearchParams();
    if (evrakId != null) params.set("evrakId", String(evrakId));
    if (dosyaId != null) params.set("dosyaId", String(dosyaId));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  // Content-Type -> { mime, ext } eslemesi.
  // UYAP evrakları PDF disinda TIFF, JPEG, PNG olarak da gelebilir (taranmis evraklar).
  function detectMimeAndExt(contentType) {
    const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
    if (!ct) return null;
    if (ct === "application/pdf") return { mime: "application/pdf", ext: "pdf" };
    if (ct === "application/octet-stream") return { mime: "application/pdf", ext: "pdf" }; // UYAP default
    if (ct === "image/tiff" || ct === "image/tif" || ct === "image/x-tiff") return { mime: "image/tiff", ext: "tiff" };
    if (ct === "image/jpeg" || ct === "image/jpg" || ct === "image/pjpeg") return { mime: "image/jpeg", ext: "jpg" };
    if (ct === "image/png") return { mime: "image/png", ext: "png" };
    if (ct === "image/gif") return { mime: "image/gif", ext: "gif" };
    if (ct === "image/bmp") return { mime: "image/bmp", ext: "bmp" };
    if (ct === "image/webp") return { mime: "image/webp", ext: "webp" };
    if (ct.startsWith("image/")) return { mime: ct, ext: ct.replace("image/", "") };
    if (ct === "application/zip") return { mime: ct, ext: "zip" };
    if (ct === "application/msword") return { mime: ct, ext: "doc" };
    if (ct === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return { mime: ct, ext: "docx" };
    return null;
  }

  async function __uyapFetchEvrakImpl(evrakId, dosyaId, opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs || 30000;
    const url = buildViewDocUrl(evrakId, dosyaId);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: ctrl.signal,
        headers: {
          "Accept": "application/pdf,image/*,application/octet-stream,application/json,text/plain,*/*",
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}`, url };
      const ct = resp.headers.get("content-type") || "";
      const mimeInfo = detectMimeAndExt(ct);

      // Taninmis binary mime: dogrudan base64 cevir. PDF disi formatlarda imza
      // kontrolu yapma (TIFF/JPG/PNG bytes farkli).
      if (mimeInfo) {
        const buf = await resp.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        if (!b64 || b64.length < 50) {
          return { ok: false, error: "Bos veya gecersiz binary cevap", url };
        }
        if (mimeInfo.ext === "pdf" && !isPdfBase64(b64)) {
          return { ok: false, error: "PDF imzasi yok (binary)", url };
        }
        return {
          ok: true,
          base64: b64,
          mimeType: mimeInfo.mime,
          ext: mimeInfo.ext,
          url
        };
      }

      // Text / JSON yolu
      const text = await resp.text();
      const trimmed = text.trim();

      // HTML cevap = oturum dustu / vekil yok
      if (/^<!doctype html|^<html|^<head/i.test(trimmed.slice(0, 100))) {
        return { ok: false, error: "Cevap HTML (oturum dustu veya yetki yok)", url };
      }

      // JSON icinde wrap'lenmis base64 — burada PDF varsayim (UYAP bu yolu PDF icin kullaniyor)
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const obj = JSON.parse(trimmed);
          const b64 = extractBase64FromJson(obj);
          if (b64) {
            if (!isPdfBase64(b64)) return { ok: false, error: "JSON base64 PDF degil", url };
            return { ok: true, base64: b64, mimeType: "application/pdf", ext: "pdf", url };
          }
        } catch (_) {}
      }
      const unq = trimmed.replace(/^"+|"+$/g, "").replace(/\s+/g, "");
      if (looksLikeBase64(unq)) {
        if (!isPdfBase64(unq)) return { ok: false, error: "PDF imzasi yok (text)", url };
        return { ok: true, base64: unq, mimeType: "application/pdf", ext: "pdf", url };
      }
      return { ok: false, error: "Cikarilamadi (content-type: " + (ct || "?") + ")", url };
    } catch (e) {
      if (e && e.name === "AbortError") return { ok: false, error: "timeout", url };
      return { ok: false, error: String((e && e.message) || e), url };
    } finally {
      clearTimeout(timer);
    }
  }

  window.__uyapFetchEvrak = __uyapFetchEvrakImpl;

  // ISOLATED content script'in postMessage istegine cevap ver
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.__uyap !== true || msg.type !== "FETCH_EVRAK_REQUEST") return;
    const reqId = msg.reqId;
    let result;
    try {
      result = await __uyapFetchEvrakImpl(msg.evrakId, msg.dosyaId, { timeoutMs: msg.timeoutMs });
    } catch (e) {
      result = { ok: false, error: String((e && e.message) || e) };
    }
    try {
      window.postMessage({
        __uyap: true,
        type: "FETCH_EVRAK_RESPONSE",
        reqId,
        ok: !!result.ok,
        base64: result.base64,
        mimeType: result.mimeType,
        ext: result.ext,
        error: result.error,
        url: result.url
      }, "*");
    } catch (_) {}
  });

  window.__uyapMainList = async function () {
    try {
      let data = await waitForEvrakData(3000);
      if (!data) {
        const direct = await fetchEvrakListDirect();
        if (direct.ok) {
          data = direct.data;
        } else {
          return {
            ok: false,
            error:
              "Evrak verisi alinamadi (" + direct.error + "). " +
              "Lutfen dosya sayfasinin yuklendiginden ve oturumun aktif oldugundan emin olun."
          };
        }
      }

      if (!data || !data.tumEvraklar || typeof data.tumEvraklar !== "object") {
        return { ok: false, error: "Cevapta tumEvraklar yok." };
      }

      // Canonical dosyaId: inject.js'in list_dosya_evraklar.ajx REQUEST BODY'sinden
      // yakaladigi ana dosya dosyaId. Yoksa null — buildEvrakRecord eski davranisa duser.
      const canonicalDosyaId = window.__uyapAnaDosyaId || null;

      const { items, firstKey } = flattenEvraks(data.tumEvraklar, canonicalDosyaId);
      if (items.length === 0) {
        return { ok: false, error: "Evrak bulunamadi." };
      }

      items.forEach((it, i) => { it.index = i + 1; });

      const domTitle = getCaseTitleFromDom();
      const caseTitle = domTitle || firstKey;
      const folder = sanitizeFilename(caseTitle);
      const missingId = items.filter((e) => !e.evrakId).length;
      const anaCount = items.filter((e) => !e.isEk).length;
      const ekCount = items.filter((e) => e.isEk).length;

      return {
        ok: true,
        caseTitle, folder, missingId,
        anaCount, ekCount,
        parentKeys: Object.keys(data.tumEvraklar),
        canonicalDosyaId: canonicalDosyaId,
        canonicalDosyaIdCaptured: !!canonicalDosyaId,
        items
      };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  };
})();
