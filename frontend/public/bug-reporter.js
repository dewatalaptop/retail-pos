/*
 * Nuvora bug reporter — drop-in, zero-dependency error reporting for any web app
 * (plain HTML, Vite/React, or the JS layer of a Capacitor Android app).
 *
 * It sends crashes and malfunctions to the App Builder's public `reportAppError`
 * endpoint, where they are de-duplicated into one row per distinct bug and handed
 * straight to Claude Code to fix (see functions/src/bugReports.ts).
 *
 * Use as a classic script:
 *   <script src="bug-reporter.js"></script>
 *   <script>BugReporter.init({ appId: "my-app", key: "<from register-app>", version: "1.0.0" });</script>
 * or as a module:  import "./bug-reporter.js";  window.BugReporter.init({...});
 *
 * Privacy: never reads input values, form data, cookies or storage contents. Click
 * breadcrumbs carry only tag/id/class/short visible label. The server redacts
 * emails, tokens and long numbers again — treat that as a second line of defence.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") {
    root.BugReporter = api.createDefault(root);
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_ENDPOINT = "https://us-central1-ai-app-builder-7bf8e.cloudfunctions.net/reportAppError";
  var QUEUE_KEY = "nuvora.bugQueue.v1";
  var MAX_QUEUE = 20;
  var MAX_PER_SESSION = 25;
  var DEDUPE_MS = 5 * 60 * 1000;
  var MAX_CRUMBS = 30;

  function rand() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function short(s, n) {
    s = s == null ? "" : String(s);
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  // Path only: query strings and fragments routinely carry tokens or ids.
  function pathOf(url) {
    try {
      var u = String(url).split("#")[0].split("?")[0];
      return u.replace(/^https?:\/\/[^/]+/, function (m) {
        return m.replace(/^https?:\/\//, "");
      });
    } catch (e) {
      return "";
    }
  }

  function describeTarget(el) {
    if (!el || !el.tagName) return "";
    var tag = el.tagName.toLowerCase();
    var out = tag;
    if (el.id) out += "#" + short(el.id, 30);
    var cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    if (cls) out += "." + short(cls, 40);
    // Visible label of buttons/links only — never the value of an input.
    if (tag === "button" || tag === "a" || (el.getAttribute && el.getAttribute("role") === "button")) {
      var label = (el.getAttribute && el.getAttribute("aria-label")) || el.textContent || "";
      label = String(label).replace(/\s+/g, " ").trim();
      if (label) out += ' "' + short(label, 30) + '"';
    }
    return out;
  }

  function createBugReporter(env) {
    var win = env.window;
    var doc = env.document;
    var nav = env.navigator || {};
    var realFetch = env.fetch;
    var storage = env.storage || null;

    var cfg = null;
    var crumbs = [];
    var sentThisSession = 0;
    var seen = {}; // dedupe key -> last sent ms
    var sessionId = rand() + rand();
    var installed = false;
    var flushing = false;

    function safeStorageGet(key) {
      try {
        return storage ? storage.getItem(key) : null;
      } catch (e) {
        return null;
      }
    }
    function safeStorageSet(key, value) {
      try {
        if (storage) storage.setItem(key, value);
      } catch (e) {
        /* storage blocked/full: the report is simply not queued */
      }
    }

    function crumb(text) {
      crumbs.push(new Date().toISOString().slice(11, 19) + " " + short(text, 140));
      if (crumbs.length > MAX_CRUMBS) crumbs.shift();
    }

    function detectPlatform() {
      try {
        if (win.Capacitor && win.Capacitor.isNativePlatform && win.Capacitor.isNativePlatform()) return "android";
      } catch (e) {
        /* not Capacitor */
      }
      return "web";
    }

    function isLocalhost() {
      var h = (win.location && win.location.hostname) || "";
      return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "";
    }

    function baseContext() {
      var ctx = {};
      try {
        ctx.online = nav.onLine !== false;
        ctx.language = nav.language || "";
        ctx.viewport = (win.innerWidth || 0) + "x" + (win.innerHeight || 0);
        ctx.route = (win.location && win.location.pathname) || "";
        if (cfg && typeof cfg.context === "function") {
          var extra = cfg.context() || {};
          for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) ctx[k] = extra[k];
        }
      } catch (e) {
        /* a broken context callback must never break reporting */
      }
      return ctx;
    }

    function buildPayload(input) {
      return {
        appId: cfg.appId,
        key: cfg.key,
        kind: input.kind || "error",
        platform: cfg.platform || detectPlatform(),
        version: cfg.version || "",
        message: short(input.message, 400),
        stack: short(input.stack, 4000),
        url: win.location ? win.location.origin + win.location.pathname : "",
        userAgent: short(nav.userAgent || "", 200),
        breadcrumbs: crumbs.slice(),
        context: Object.assign(baseContext(), input.context || {}),
        userNote: short(input.userNote, 1000),
        sessionId: sessionId,
      };
    }

    function post(payload) {
      return realFetch(cfg.endpoint, {
        method: "POST",
        // text/plain: a "simple" request — no CORS preflight round-trip, and the
        // server accepts a JSON string body for exactly this reason.
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).then(function (res) {
        // 4xx (bad key, unknown app, malformed) will never succeed: drop it.
        if (res.status >= 500) throw new Error("server " + res.status);
        return res;
      });
    }

    function readQueue() {
      try {
        var q = JSON.parse(safeStorageGet(QUEUE_KEY) || "[]");
        return Array.isArray(q) ? q : [];
      } catch (e) {
        return [];
      }
    }
    function writeQueue(q) {
      safeStorageSet(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
    }

    function flushQueue() {
      if (flushing || !cfg) return;
      var q = readQueue();
      if (!q.length) return;
      flushing = true;
      var remaining = q.slice();
      (function next() {
        if (!remaining.length) {
          flushing = false;
          writeQueue([]);
          return;
        }
        post(remaining[0])
          .then(function () {
            remaining.shift();
            writeQueue(remaining);
            next();
          })
          .catch(function () {
            flushing = false; // still offline / server down: keep the rest for later
          });
      })();
    }

    function send(input) {
      if (!cfg || !cfg.enabled) return false;
      if (sentThisSession >= MAX_PER_SESSION) return false;
      var first = (input.stack || "").split("\n")[1] || "";
      var dedupeKey = (input.kind || "error") + "|" + short(input.message, 120) + "|" + short(first, 80);
      var now = Date.now();
      if (input.kind !== "manual" && seen[dedupeKey] && now - seen[dedupeKey] < DEDUPE_MS) return false;
      seen[dedupeKey] = now;
      sentThisSession++;

      var payload = buildPayload(input);
      try {
        post(payload).catch(function () {
          var q = readQueue();
          q.push(payload);
          writeQueue(q);
        });
      } catch (e) {
        var q = readQueue();
        q.push(payload);
        writeQueue(q);
      }
      return true;
    }

    function messageOf(err) {
      if (err && typeof err === "object" && "message" in err) return String(err.message);
      return typeof err === "string" ? err : "Unknown error";
    }

    function captureException(err, context, kind) {
      return send({
        kind: kind || "error",
        message: (err && err.name && err.name !== "Error" ? err.name + ": " : "") + messageOf(err),
        stack: (err && err.stack) || "",
        context: context,
      });
    }

    function install() {
      if (installed || !win.addEventListener) return;
      installed = true;

      win.addEventListener("error", function (ev) {
        // Cross-origin scripts surface as an opaque "Script error." with no
        // detail — nothing actionable, so skip it. Resource load errors (img/css)
        // arrive without a message too.
        if (!ev || !ev.message || ev.message === "Script error.") return;
        send({
          kind: "error",
          message: ev.message,
          stack: (ev.error && ev.error.stack) || (ev.filename ? "at " + ev.filename + ":" + ev.lineno + ":" + ev.colno : ""),
        });
      });

      win.addEventListener("unhandledrejection", function (ev) {
        var r = ev && ev.reason;
        send({
          kind: "unhandledrejection",
          message: "Unhandled promise rejection: " + messageOf(r),
          stack: (r && r.stack) || "",
        });
      });

      win.addEventListener("online", flushQueue);

      if (doc && doc.addEventListener) {
        doc.addEventListener(
          "click",
          function (ev) {
            crumb("click " + describeTarget(ev && ev.target));
          },
          true
        );
      }
      if (win.addEventListener) {
        win.addEventListener("popstate", function () {
          crumb("nav " + ((win.location && win.location.pathname) || ""));
        });
        win.addEventListener("hashchange", function () {
          crumb("nav " + ((win.location && win.location.pathname) || ""));
        });
      }
      try {
        var h = win.history;
        if (h && h.pushState) {
          var origPush = h.pushState;
          h.pushState = function () {
            var r = origPush.apply(this, arguments);
            crumb("nav " + ((win.location && win.location.pathname) || ""));
            return r;
          };
        }
      } catch (e) {
        /* frozen history: skip navigation breadcrumbs */
      }

      if (cfg.captureConsole && win.console) {
        ["error", "warn"].forEach(function (level) {
          var orig = win.console[level];
          if (typeof orig !== "function") return;
          win.console[level] = function () {
            try {
              var text = Array.prototype.slice
                .call(arguments)
                .map(function (a) {
                  return a && a.message ? a.message : typeof a === "string" ? a : "";
                })
                .join(" ")
                .trim();
              if (text) crumb("console." + level + " " + text);
              // console.error alone is a weak signal (apps log handled errors on
              // purpose): it is a breadcrumb for the NEXT report, not a report.
            } catch (e) {
              /* never break console */
            }
            return orig.apply(this, arguments);
          };
        });
      }

      if (cfg.captureNetwork && typeof win.fetch === "function") {
        var origFetch = win.fetch;
        win.fetch = function (input, init) {
          var url = typeof input === "string" ? input : input && input.url ? input.url : "";
          var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
          // Never observe our own reports (would loop on a failing endpoint).
          if (url.indexOf(cfg.endpoint) === 0) return origFetch.apply(this, arguments);
          return origFetch.apply(this, arguments).then(
            function (res) {
              crumb(method + " " + pathOf(url) + " " + res.status);
              if (res.status >= 500) {
                send({ kind: "network", message: method + " " + pathOf(url) + " → HTTP " + res.status, stack: "" });
              }
              return res;
            },
            function (err) {
              // Offline is the user's network, not a bug in the app.
              if (nav.onLine !== false) {
                crumb(method + " " + pathOf(url) + " failed");
              }
              throw err;
            }
          );
        };
      }
    }

    // Tiny built-in "Laporkan masalah" dialog: apps can call BugReporter.openDialog()
    // from a Help/Settings menu instead of building their own form.
    function openDialog(opts) {
      if (!doc || !doc.createElement || !cfg) return;
      opts = opts || {};
      var existing = doc.getElementById("nuvora-bug-dialog");
      if (existing) existing.remove();
      var wrap = doc.createElement("div");
      wrap.id = "nuvora-bug-dialog";
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif";
      var box = doc.createElement("div");
      box.style.cssText = "background:#fff;color:#111;border-radius:14px;max-width:420px;width:100%;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.3)";
      box.innerHTML =
        '<h2 style="margin:0 0 6px;font-size:17px">' + (opts.title || "Laporkan masalah") + "</h2>" +
        '<p style="margin:0 0 10px;font-size:13px;color:#555">' + (opts.hint || "Ceritakan apa yang terjadi. Laporan dikirim otomatis ke tim pengembang — tanpa data pribadi.") + "</p>" +
        '<textarea id="nuvora-bug-note" rows="4" maxlength="1000" style="width:100%;box-sizing:border-box;border:1px solid #ccc;border-radius:8px;padding:8px;font:inherit;font-size:14px" placeholder="Contoh: tombol Bayar tidak merespons"></textarea>' +
        '<div id="nuvora-bug-msg" style="min-height:18px;font-size:12px;margin:6px 0"></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button id="nuvora-bug-cancel" type="button" style="padding:9px 14px;border-radius:8px;border:1px solid #ccc;background:#fff;font:inherit;font-size:14px;cursor:pointer">Batal</button>' +
        '<button id="nuvora-bug-send" type="button" style="padding:9px 14px;border-radius:8px;border:0;background:#16a05c;color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer">Kirim</button>' +
        "</div>";
      wrap.appendChild(box);
      doc.body.appendChild(wrap);
      var note = doc.getElementById("nuvora-bug-note");
      var msg = doc.getElementById("nuvora-bug-msg");
      var sendBtn = doc.getElementById("nuvora-bug-send");
      if (note && note.focus) note.focus();
      doc.getElementById("nuvora-bug-cancel").onclick = function () {
        wrap.remove();
      };
      sendBtn.onclick = function () {
        var text = (note.value || "").trim();
        if (!text) {
          msg.textContent = "Tulis dulu singkat apa masalahnya.";
          msg.style.color = "#a12f26";
          return;
        }
        sendBtn.disabled = true;
        reportManual({ userNote: text, message: "Laporan dari pengguna" });
        msg.textContent = "Terkirim. Terima kasih!";
        msg.style.color = "#0d6539";
        setTimeout(function () {
          wrap.remove();
        }, 1200);
      };
    }

    function reportManual(input) {
      return send({
        kind: "manual",
        message: input.message || "Laporan dari pengguna",
        userNote: input.userNote || "",
        stack: input.stack || "",
        context: input.context,
      });
    }

    function init(options) {
      if (!options || !options.appId || !options.key) {
        // A silent no-op would look identical to "no errors happened".
        if (win.console && win.console.warn) win.console.warn("[BugReporter] init needs { appId, key }");
        return api;
      }
      cfg = {
        appId: options.appId,
        key: options.key,
        version: options.version || "",
        platform: options.platform || null,
        endpoint: options.endpoint || DEFAULT_ENDPOINT,
        context: options.context || null,
        captureConsole: options.captureConsole !== false,
        captureNetwork: options.captureNetwork !== false,
        // Localhost noise (dev servers, tests) stays out of the real inbox.
        enabled: options.enabled !== undefined ? !!options.enabled : !isLocalhost(),
      };
      install();
      flushQueue();
      return api;
    }

    var api = {
      init: init,
      captureException: captureException,
      report: reportManual,
      openDialog: openDialog,
      addBreadcrumb: crumb,
      flush: flushQueue,
      // exposed for tests
      _state: function () {
        return { crumbs: crumbs.slice(), sent: sentThisSession, queue: readQueue(), cfg: cfg };
      },
    };
    return api;
  }

  function createDefault(root) {
    var hasWindow = root && typeof root.addEventListener === "function";
    if (!hasWindow) {
      // Non-browser (SSR / node import): inert stub so `import` never throws.
      var noop = function () {
        return stub;
      };
      var stub = { init: noop, captureException: noop, report: noop, openDialog: noop, addBreadcrumb: noop, flush: noop };
      return stub;
    }
    var storage = null;
    try {
      storage = root.localStorage;
    } catch (e) {
      storage = null;
    }
    return createBugReporter({
      window: root,
      document: root.document,
      navigator: root.navigator,
      fetch: typeof root.fetch === "function" ? root.fetch.bind(root) : function () { return Promise.reject(new Error("no fetch")); },
      storage: storage,
    });
  }

  return { createBugReporter: createBugReporter, createDefault: createDefault };
});
