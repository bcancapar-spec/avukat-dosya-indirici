(() => {
  const TR_ASCII_MAP = {
    "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G",
    "ı": "i", "İ": "I", "ö": "o", "Ö": "O",
    "ş": "s", "Ş": "S", "ü": "u", "Ü": "U"
  };

  function turkishToAscii(s) {
    return String(s == null ? "" : s).replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_ASCII_MAP[ch] || ch);
  }

  // pdf-lib StandardFonts WinAnsi encoding ile sinirli — kalan Unicode'u da temizle
  function asciiSafe(s) {
    return turkishToAscii(s)
      .replace(/[^\x20-\x7E]/g, "?");
  }

  function base64ToBytes(b64) {
    const clean = String(b64 || "").replace(/\s+/g, "");
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bytesToBase64(bytes) {
    const CHUNK = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function waitForPdfLib(timeoutMs = 15000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function tick() {
        if (typeof PDFLib !== "undefined") return resolve(PDFLib);
        if (Date.now() - start > timeoutMs) return reject(new Error("pdf-lib CDN yuklenemedi"));
        setTimeout(tick, 50);
      })();
    });
  }

  function formatDateTr(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatDateDot(s) {
    if (!s || s === "tarihsiz") return s || "";
    return String(s).replace(/_/g, ".");
  }

  function truncateText(text, font, size, maxWidth) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    const ell = "...";
    let s = text;
    while (s.length > 0 && font.widthOfTextAtSize(s + ell, size) > maxWidth) {
      s = s.slice(0, -1);
    }
    return s + ell;
  }

  function wrapText(text, font, size, maxWidth) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        if (font.widthOfTextAtSize(w, size) > maxWidth) {
          lines.push(truncateText(w, font, size, maxWidth));
          cur = "";
        } else {
          cur = w;
        }
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawImageOnA4Page(doc, img) {
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const MARGIN = 20;
    const maxW = PAGE_W - 2 * MARGIN;
    const maxH = PAGE_H - 2 * MARGIN;

    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (PAGE_W - w) / 2;
    const y = (PAGE_H - h) / 2;

    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawImage(img, { x, y, width: w, height: h });
    return page;
  }

  async function tiffBytesToJpegBase64(bytes) {
    if (typeof UTIF === "undefined") {
      throw new Error("UTIF kutuphanesi yuklenmedi");
    }
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const ifds = UTIF.decode(ab);
    if (!ifds || ifds.length === 0) {
      throw new Error("TIFF cozulemedi (IFD yok)");
    }
    const page = ifds[0];
    UTIF.decodeImage(ab, page);
    const rgba = UTIF.toRGBA8(page);
    const w = page.width;
    const h = page.height;
    if (!w || !h) throw new Error("TIFF boyutu okunamadi");

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const clamped = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    const imageData = new ImageData(clamped, w, h);
    ctx.putImageData(imageData, 0, 0);

    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    const arrBuf = await blob.arrayBuffer();
    return bytesToBase64(new Uint8Array(arrBuf));
  }

  function splitCaseTitle(caseTitle) {
    const m = String(caseTitle || "").match(/^\s*(\d{4}\s*\/\s*\d+)\s+(.+)$/);
    if (m) return { caseNo: m[1].replace(/\s+/g, ""), mahkeme: m[2].trim() };
    return { caseNo: "", mahkeme: String(caseTitle || "").trim() };
  }

  async function drawKunye(doc, font, fontBold, payload, failedItems) {
    const { rgb } = PDFLib;
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const MARGIN = 50;

    let page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    // Baslik
    const title = "DOSYA BILGILERI";
    const titleSize = 22;
    const titleW = fontBold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
      x: (PAGE_W - titleW) / 2,
      y: y - titleSize,
      size: titleSize,
      font: fontBold,
      color: rgb(0.08, 0.13, 0.36)
    });
    y -= titleSize + 18;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 1,
      color: rgb(0.2, 0.25, 0.45)
    });
    y -= 22;

    const split = splitCaseTitle(payload.caseTitle);
    const downloadedAt = new Date(payload.downloadedAt || Date.now());

    const rows = [
      ["Dosya Basligi", payload.caseTitle || ""],
      ["Mahkeme/Birim", split.mahkeme],
      ["Dosya Numarasi", split.caseNo],
      ["Toplam Evrak Sayisi", String((payload.items || []).length)],
      ["Indirme Tarih ve Saati", formatDateTr(downloadedAt)]
    ];

    const labelSize = 11;
    const labelColW = 150;
    for (const [label, value] of rows) {
      page.drawText(asciiSafe(label) + ":", {
        x: MARGIN, y, size: labelSize, font: fontBold, color: rgb(0.1, 0.1, 0.15)
      });
      const valueLines = wrapText(asciiSafe(value), font, labelSize, PAGE_W - MARGIN - labelColW - MARGIN);
      for (let i = 0; i < valueLines.length; i++) {
        page.drawText(valueLines[i], {
          x: MARGIN + labelColW, y: y - i * (labelSize + 2), size: labelSize, font, color: rgb(0.1, 0.1, 0.15)
        });
      }
      y -= Math.max(1, valueLines.length) * (labelSize + 4) + 4;
    }

    y -= 14;

    // Evrak listesi basligi
    const listTitle = "EVRAK LISTESI";
    page.drawText(listTitle, {
      x: MARGIN, y: y - 14, size: 14, font: fontBold, color: rgb(0.08, 0.13, 0.36)
    });
    y -= 14 + 10;

    const TABLE_X = MARGIN;
    const TABLE_W = PAGE_W - 2 * MARGIN;
    const COL_NO_W = 32;
    const COL_DATE_W = 78;
    const COL_NAME_W = TABLE_W - COL_NO_W - COL_DATE_W;
    const HEADER_H = 18;
    const ROW_TEXT_SIZE = 9;
    const ROW_LINE_H = ROW_TEXT_SIZE + 3;
    const ROW_PAD_Y = 5;
    const BOTTOM_LIMIT = MARGIN;

    function drawTableHeader(yPos) {
      page.drawRectangle({
        x: TABLE_X, y: yPos - HEADER_H, width: TABLE_W, height: HEADER_H,
        color: rgb(0.92, 0.92, 0.96)
      });
      page.drawRectangle({
        x: TABLE_X, y: yPos - HEADER_H, width: TABLE_W, height: HEADER_H,
        borderColor: rgb(0.6, 0.6, 0.7), borderWidth: 0.5, color: rgb(0.92, 0.92, 0.96), opacity: 1
      });
      page.drawText("S.", {
        x: TABLE_X + 6, y: yPos - HEADER_H + 5, size: 10, font: fontBold
      });
      page.drawText("Evrak Adi", {
        x: TABLE_X + COL_NO_W + 6, y: yPos - HEADER_H + 5, size: 10, font: fontBold
      });
      page.drawText("Tarih", {
        x: TABLE_X + COL_NO_W + COL_NAME_W + 6, y: yPos - HEADER_H + 5, size: 10, font: fontBold
      });
      return yPos - HEADER_H;
    }

    y = drawTableHeader(y);

    const items = payload.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const nameLines = wrapText(asciiSafe(it.name || ""), font, ROW_TEXT_SIZE, COL_NAME_W - 12);
      const rowH = Math.max(nameLines.length, 1) * ROW_LINE_H + ROW_PAD_Y;

      if (y - rowH < BOTTOM_LIMIT) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
        y = drawTableHeader(y);
      }

      page.drawLine({
        start: { x: TABLE_X, y: y - rowH },
        end: { x: TABLE_X + TABLE_W, y: y - rowH },
        thickness: 0.4,
        color: rgb(0.82, 0.82, 0.88)
      });
      page.drawLine({
        start: { x: TABLE_X + COL_NO_W, y },
        end: { x: TABLE_X + COL_NO_W, y: y - rowH },
        thickness: 0.4,
        color: rgb(0.82, 0.82, 0.88)
      });
      page.drawLine({
        start: { x: TABLE_X + COL_NO_W + COL_NAME_W, y },
        end: { x: TABLE_X + COL_NO_W + COL_NAME_W, y: y - rowH },
        thickness: 0.4,
        color: rgb(0.82, 0.82, 0.88)
      });

      page.drawText(String(it.index != null ? it.index : i + 1), {
        x: TABLE_X + 6, y: y - ROW_LINE_H, size: ROW_TEXT_SIZE, font
      });
      for (let li = 0; li < nameLines.length; li++) {
        page.drawText(nameLines[li], {
          x: TABLE_X + COL_NO_W + 6,
          y: y - ROW_LINE_H * (li + 1),
          size: ROW_TEXT_SIZE,
          font
        });
      }
      page.drawText(asciiSafe(formatDateDot(it.date)), {
        x: TABLE_X + COL_NO_W + COL_NAME_W + 6,
        y: y - ROW_LINE_H,
        size: ROW_TEXT_SIZE,
        font
      });

      y -= rowH;
    }

    // Tablo sol/sag dis cizgi
    // (basit: zaten her satirin ust/alt cizgisini cizdik; sol/sag iceriklerle birlikte yeterli)

    if (failedItems && failedItems.length > 0) {
      y -= 22;
      const failTitle = "EKLENEMEYEN EVRAKLAR";
      if (y - 30 < BOTTOM_LIMIT) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      page.drawText(failTitle, {
        x: MARGIN, y: y - 14, size: 12, font: fontBold, color: rgb(0.6, 0.1, 0.1)
      });
      y -= 14 + 8;

      const note = "Asagidaki evraklar birlestirilemedigi icin nihai PDF'e dahil edilmemistir:";
      page.drawText(asciiSafe(note), {
        x: MARGIN, y: y - 10, size: 9, font, color: rgb(0.3, 0.1, 0.1)
      });
      y -= 10 + 6;

      const failTextSize = 9;
      const failLineH = failTextSize + 3;
      for (const f of failedItems) {
        const idxStr = f.index != null ? String(f.index) + ". " : "- ";
        const extStr = f.ext ? " (." + String(f.ext).toLowerCase() + ")" : "";
        const dateStr = f.date ? " [" + formatDateDot(f.date) + "]" : "";
        const line = idxStr + (f.name || "(isimsiz)") + extStr + dateStr;
        const lines = wrapText(asciiSafe(line), font, failTextSize, PAGE_W - 2 * MARGIN);
        const blockH = lines.length * failLineH + 2;
        if (y - blockH < BOTTOM_LIMIT) {
          page = doc.addPage([PAGE_W, PAGE_H]);
          y = PAGE_H - MARGIN;
        }
        for (let i = 0; i < lines.length; i++) {
          page.drawText(lines[i], {
            x: MARGIN, y: y - failLineH * (i + 1), size: failTextSize, font, color: rgb(0.3, 0.1, 0.1)
          });
        }
        y -= blockH;
      }
    }
  }

  async function handleMerge(payload) {
    await waitForPdfLib();
    const { PDFDocument, StandardFonts } = PDFLib;

    const finalDoc = await PDFDocument.create();

    const items = payload.items || [];
    let merged = 0;
    const failedItems = [];

    for (const it of items) {
      const ext = String(it.ext || "pdf").toLowerCase();
      try {
        if (ext === "pdf") {
          const bytes = base64ToBytes(it.base64);
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await finalDoc.copyPages(src, src.getPageIndices());
          pages.forEach((p) => finalDoc.addPage(p));
        } else if (ext === "jpg" || ext === "jpeg") {
          const bytes = base64ToBytes(it.base64);
          const img = await finalDoc.embedJpg(bytes);
          drawImageOnA4Page(finalDoc, img);
        } else if (ext === "png") {
          const bytes = base64ToBytes(it.base64);
          const img = await finalDoc.embedPng(bytes);
          drawImageOnA4Page(finalDoc, img);
        } else if (ext === "tiff" || ext === "tif") {
          const bytes = base64ToBytes(it.base64);
          const jpegB64 = await tiffBytesToJpegBase64(bytes);
          const img = await finalDoc.embedJpg(jpegB64);
          drawImageOnA4Page(finalDoc, img);
        } else {
          throw new Error("Desteklenmeyen format: " + ext);
        }
        merged++;
      } catch (e) {
        failedItems.push({
          index: it.index,
          name: it.name || "(isimsiz)",
          ext: it.ext || "",
          date: it.date || ""
        });
        console.warn("[UYAP offscreen] evrak eklenemedi:", it && it.name, ext, e);
      }
    }

    // Kunye'yi ayri bir doc'ta uretip basa ekle (boylece artik failedItems'i biliyoruz)
    const kunyeDoc = await PDFDocument.create();
    const kHelv = await kunyeDoc.embedFont(StandardFonts.Helvetica);
    const kHelvBold = await kunyeDoc.embedFont(StandardFonts.HelveticaBold);
    await drawKunye(kunyeDoc, kHelv, kHelvBold, payload, failedItems);

    const kunyePages = await finalDoc.copyPages(kunyeDoc, kunyeDoc.getPageIndices());
    for (let i = 0; i < kunyePages.length; i++) {
      finalDoc.insertPage(i, kunyePages[i]);
    }

    const out = await finalDoc.save();
    return {
      ok: true,
      base64: bytesToBase64(out),
      mergedCount: merged,
      failedCount: failedItems.length,
      failedItems: failedItems.map((f) => ({ index: f.index, name: f.name, ext: f.ext }))
    };
  }

  // === PARCALI MERGE OTURUMLARI ===
  // chrome.runtime.sendMessage'in 64MiB mesaj sinirini asmamak icin merge
  // islemini BEGIN/APPEND.../FINISH adimlarina boldukten sonra her chunk ayri
  // mesajla offscreen'a aktarilir. Burada oturum bazli buffer'i tutariz; FINISH
  // tum birikmis evraklari handleMerge'e gondererek nihai PDF'i uretir.
  const mergeSessions = new Map();

  function genSessionId() {
    return "ms_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function handleMergeBegin(payload) {
    const sessionId = genSessionId();
    mergeSessions.set(sessionId, {
      meta: {
        folder: payload && payload.folder,
        caseTitle: payload && payload.caseTitle,
        downloadedAt: payload && payload.downloadedAt
      },
      items: []
    });
    return { ok: true, sessionId };
  }

  function handleMergeAppend(payload) {
    const sessionId = payload && payload.sessionId;
    const items = (payload && payload.items) || [];
    const s = mergeSessions.get(sessionId);
    if (!s) return { ok: false, error: "merge oturumu bulunamadi: " + String(sessionId) };
    for (const it of items) s.items.push(it);
    return { ok: true, count: s.items.length };
  }

  async function handleMergeFinish(payload) {
    const sessionId = payload && payload.sessionId;
    const s = mergeSessions.get(sessionId);
    if (!s) return { ok: false, error: "merge oturumu bulunamadi: " + String(sessionId) };
    try {
      return await handleMerge({
        folder: s.meta.folder,
        caseTitle: s.meta.caseTitle,
        downloadedAt: s.meta.downloadedAt,
        items: s.items
      });
    } finally {
      mergeSessions.delete(sessionId);
    }
  }

  function handleMergeCancel(payload) {
    const sessionId = payload && payload.sessionId;
    if (sessionId) mergeSessions.delete(sessionId);
    return { ok: true };
  }

  // Tek bir evragi (pdf/jpg/png/tiff) tek sayfalik A4 PDF'e cevirir.
  // ext=pdf ise base64 oldugu gibi geri doner — boylece individual mod cagirisi
  // tek bir kod yolu kullanabilir.
  async function handleConvertSingle(payload) {
    const ext = String((payload && payload.ext) || "pdf").toLowerCase();
    const b64 = String((payload && payload.base64) || "");
    if (!b64) throw new Error("base64 bos");
    if (ext === "pdf") return { ok: true, base64: b64 };

    await waitForPdfLib();
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.create();

    if (ext === "jpg" || ext === "jpeg") {
      const bytes = base64ToBytes(b64);
      const img = await doc.embedJpg(bytes);
      drawImageOnA4Page(doc, img);
    } else if (ext === "png") {
      const bytes = base64ToBytes(b64);
      const img = await doc.embedPng(bytes);
      drawImageOnA4Page(doc, img);
    } else if (ext === "tiff" || ext === "tif") {
      const bytes = base64ToBytes(b64);
      const jpegB64 = await tiffBytesToJpegBase64(bytes);
      const img = await doc.embedJpg(jpegB64);
      drawImageOnA4Page(doc, img);
    } else {
      throw new Error("Desteklenmeyen format: " + ext);
    }

    const out = await doc.save();
    return { ok: true, base64: bytesToBase64(out) };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.target !== "offscreen") return;
    if (msg.type === "UYAP_OFFSCREEN_MERGE") {
      handleMerge(msg.payload || {}).then(
        (r) => sendResponse(r),
        (err) => sendResponse({ ok: false, error: String((err && err.message) || err) })
      );
      return true;
    }
    if (msg.type === "UYAP_CONVERT_SINGLE") {
      handleConvertSingle(msg.payload || {}).then(
        (r) => sendResponse(r),
        (err) => sendResponse({ ok: false, error: String((err && err.message) || err) })
      );
      return true;
    }
    if (msg.type === "UYAP_OFFSCREEN_MERGE_BEGIN") {
      try { sendResponse(handleMergeBegin(msg.payload || {})); }
      catch (err) { sendResponse({ ok: false, error: String((err && err.message) || err) }); }
      return false;
    }
    if (msg.type === "UYAP_OFFSCREEN_MERGE_APPEND") {
      try { sendResponse(handleMergeAppend(msg.payload || {})); }
      catch (err) { sendResponse({ ok: false, error: String((err && err.message) || err) }); }
      return false;
    }
    if (msg.type === "UYAP_OFFSCREEN_MERGE_FINISH") {
      handleMergeFinish(msg.payload || {}).then(
        (r) => sendResponse(r),
        (err) => sendResponse({ ok: false, error: String((err && err.message) || err) })
      );
      return true;
    }
    if (msg.type === "UYAP_OFFSCREEN_MERGE_CANCEL") {
      try { sendResponse(handleMergeCancel(msg.payload || {})); }
      catch (err) { sendResponse({ ok: false, error: String((err && err.message) || err) }); }
      return false;
    }
  });
})();
