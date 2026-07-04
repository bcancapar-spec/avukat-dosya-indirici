// MAIN-world, document_start content script.
// Iki gorevi var:
// 1) /list_dosya_evraklar.ajx RESPONSE'unu yakalayip window.__uyapEvrakData'ya yaz.
// 2) Ayni istegin REQUEST BODY'sindeki dosyaId'yi yakalayip window.__uyapAnaDosyaId'ye yaz.
//    Cunku response icindeki evrak basina gelen dosyaId'ler ALT DOSYA ID'leri (vekil hatasi)
//    verir; gercek/dogru dosyaId istegin body'sindeki dosyaId'dir (ana dosya).
(function () {
  if (window.__uyapEvrakInterceptorInstalled) return;
  window.__uyapEvrakInterceptorInstalled = true;

  const URL_PATTERN = "/list_dosya_evraklar.ajx";

  // === RESPONSE PARSING ===
  function captureFromText(text) {
    if (!text) return;
    try {
      const data = JSON.parse(text);
      if (data && data.tumEvraklar && typeof data.tumEvraklar === "object") {
        window.__uyapEvrakData = data;
        window.__uyapEvrakDataAt = Date.now();
      }
    } catch (_) {}
  }

  // === REQUEST BODY PARSING (dosyaId) ===
  function parseBodyForDosyaId(body) {
    if (body == null) return null;
    try {
      if (typeof body === "string") {
        if (!body.length) return null;
        const t = body.trim();
        if (t.startsWith("{") || t.startsWith("[")) {
          try {
            const obj = JSON.parse(t);
            if (obj && obj.dosyaId != null) return String(obj.dosyaId);
          } catch (_) {}
        }
        // form-encoded fallback (dosyaId=...&pageNumber=1)
        try {
          const params = new URLSearchParams(body);
          const v = params.get("dosyaId");
          if (v != null) return v;
        } catch (_) {}
        return null;
      }
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        const v = body.get("dosyaId");
        return v != null ? String(v) : null;
      }
      if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        return body.get("dosyaId");
      }
      // Blob/ArrayBuffer/ReadableStream — atla
    } catch (_) {}
    return null;
  }

  function captureBodyDosyaId(body) {
    try {
      const id = parseBodyForDosyaId(body);
      if (id) {
        window.__uyapAnaDosyaId = id;
        window.__uyapAnaDosyaIdAt = Date.now();
      }
    } catch (_) {}
  }

  // === XHR PATCH ===
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__uyapUrl = String(url || "");
    this.__uyapMethod = String(method || "").toUpperCase();
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    if (xhr.__uyapUrl && xhr.__uyapUrl.indexOf(URL_PATTERN) !== -1) {
      // REQUEST BODY'den dosyaId
      captureBodyDosyaId(body);

      // RESPONSE
      xhr.addEventListener("load", function () {
        try {
          let text = "";
          const rt = xhr.responseType || "";
          if (rt === "" || rt === "text") {
            text = xhr.responseText || "";
          } else if (rt === "json") {
            try { text = JSON.stringify(xhr.response); } catch (_) {}
          } else if (typeof xhr.response === "string") {
            text = xhr.response;
          } else if (xhr.response) {
            try { text = JSON.stringify(xhr.response); } catch (_) {}
          }
          captureFromText(text);
        } catch (_) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  // === FETCH PATCH ===
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string"
      ? input
      : (input && (input.url || String(input))) || "";

    if (url && url.indexOf(URL_PATTERN) !== -1) {
      // REQUEST BODY'den dosyaId — once init.body, sonra Request.body (ReadableStream ise atla)
      try {
        if (init && init.body != null) {
          captureBodyDosyaId(init.body);
        }
      } catch (_) {}
    }

    const resp = await origFetch.apply(this, arguments);

    if (url && url.indexOf(URL_PATTERN) !== -1) {
      try {
        const cloned = resp.clone();
        const text = await cloned.text();
        captureFromText(text);
      } catch (_) {}
    }
    return resp;
  };
})();
