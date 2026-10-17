/* ═══════════════════════════════════════════════════════════════
   UPBSA.TV — SHOOT OUT CLOCK ENGINE
   Shared by shootout-referee.html, shootout-board.html, shootout-overlay.html

   How the clocks stay in sync:
   The referee never streams "14…13…12" to Firebase. It writes start
   timestamps (server-time corrected) and pause state once. Every screen
   computes the countdown locally from those, so all screens hit zero
   at the same moment, even on patchy Wi-Fi.

   Firebase: matches/table-N  (normal match fields + an `so` block)
   so.cfg  : { matchSec, frameSec, shotSec, p2On, p2After, p2Sec,
               penalty, extCount, extSec, warnAt, endRule:'finish'|'stop', reds }
   so.clk  : running ? { running:true, mStart, fStart, sStart, sDur }
                     : { running:false, mEl, fEl, sEl, sDur }
   so.ext  : { p1, p2 }          extensions left this frame
   so.stats: { p1:{shots,ms,tf}, p2:{...} }   shots, total shot ms, time fouls
   so.ev   : { t, txt, sub, ts } last event → stingers/banners
   so.matchUp, so.decider, so.explainer:{on,ts}
   ═══════════════════════════════════════════════════════════════ */
(function (w) {
  if (!firebase.apps.length) firebase.initializeApp({
    apiKey: "AIzaSyAxNVCaOyZvk69fqR-qTCyjbvE1gAbiBXE",
    authDomain: "snooker-scorer-56573.firebaseapp.com",
    databaseURL: "https://snooker-scorer-56573-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "snooker-scorer-56573", storageBucket: "snooker-scorer-56573.firebasestorage.app",
    messagingSenderId: "774218957368", appId: "1:774218957368:web:3b2c9cc363c0627ab35ccd"
  });
  var db = firebase.database();
  var offset = 0;
  db.ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; });

  function now() { return Date.now() + offset; }

  var DEFAULT_CFG = {
    matchSec: 1800, frameSec: 600, shotSec: 20,
    p2On: true, p2After: 300, p2Sec: 15,
    penalty: 5, extCount: 1, extSec: 20, warnAt: 5,
    endRule: 'finish', reds: 15
  };

  var PRESETS = {
    rapid:  { label: 'Rapid',     desc: '20 min match · 5 min frames · 15s → 10s', matchSec: 1200, frameSec: 300, shotSec: 15, p2On: true, p2After: 150, p2Sec: 10, extCount: 0, reds: 6 },
    std:    { label: 'Standard',  desc: '30 min match · 10 min frames · 20s → 15s', matchSec: 1800, frameSec: 600, shotSec: 20, p2On: true, p2After: 300, p2Sec: 15, extCount: 1, reds: 15 },
    long:   { label: 'Long',      desc: '45 min match · 15 min frames · 25s shots', matchSec: 2700, frameSec: 900, shotSec: 25, p2On: false, p2After: 600, p2Sec: 20, extCount: 1, reds: 15 }
  };

  function cfgOf(S) {
    var c = (S && S.so && S.so.cfg) || {};
    var out = {};
    for (var k in DEFAULT_CFG) out[k] = (c[k] === undefined || c[k] === null) ? DEFAULT_CFG[k] : c[k];
    return out;
  }

  /* elapsed ms for clock k ('m' match, 'f' frame, 's' shot) */
  function elapsed(clk, k) {
    if (!clk) return 0;
    if (clk.running) return Math.max(0, now() - (clk[k + 'Start'] || now()));
    return clk[k + 'El'] || 0;
  }

  function phaseAt(cfg, fElMs) {
    return (cfg.p2On && cfg.frameSec && fElMs >= cfg.p2After * 1000) ? 2 : 1;
  }
  function shotSecAt(cfg, fElMs) {
    return phaseAt(cfg, fElMs) === 2 ? cfg.p2Sec : cfg.shotSec;
  }

  /* Everything a screen needs to draw the clocks right now */
  function times(S) {
    var cfg = cfgOf(S), clk = (S && S.so && S.so.clk) || {};
    var mEl = elapsed(clk, 'm'), fEl = elapsed(clk, 'f'), sEl = elapsed(clk, 's');
    var sDur = clk.sDur || shotSecAt(cfg, fEl) * 1000;
    var mTot = cfg.matchSec * 1000, fTot = cfg.frameSec * 1000;
    return {
      running: !!clk.running,
      started: !!(S && S.so && S.so.started),
      hasMatch: cfg.matchSec > 0, hasFrame: cfg.frameSec > 0,
      mRem: cfg.matchSec > 0 ? Math.max(0, mTot - mEl) : null, mTot: mTot,
      fRem: cfg.frameSec > 0 ? Math.max(0, fTot - fEl) : null, fTot: fTot,
      sRem: Math.max(0, sDur - sEl), sDur: sDur, sEl: sEl, fEl: fEl, mEl: mEl,
      phase: phaseAt(cfg, fEl),
      nextShotSec: shotSecAt(cfg, fEl),
      cfg: cfg
    };
  }

  /* ── clock mutations (return a NEW clk object) ── */
  function pause(clk) {
    if (!clk || !clk.running) return clk || { running: false, mEl: 0, fEl: 0, sEl: 0 };
    return { running: false, mEl: elapsed(clk, 'm'), fEl: elapsed(clk, 'f'), sEl: elapsed(clk, 's'), sDur: clk.sDur };
  }
  function resume(clk, cfg) {
    clk = clk || { running: false, mEl: 0, fEl: 0, sEl: 0 };
    if (clk.running) return clk;
    var t = now();
    return {
      running: true,
      mStart: t - (clk.mEl || 0), fStart: t - (clk.fEl || 0), sStart: t - (clk.sEl || 0),
      sDur: clk.sDur || shotSecAt(cfg, clk.fEl || 0) * 1000
    };
  }
  function resetShot(clk, cfg, extraMs) {
    clk = JSON.parse(JSON.stringify(clk || { running: false }));
    var fEl = elapsed(clk, 'f');
    clk.sDur = shotSecAt(cfg, fEl) * 1000 + (extraMs || 0);
    if (clk.running) clk.sStart = now(); else clk.sEl = 0;
    return clk;
  }
  function newFrameClk(clk) {
    var p = pause(clk);
    return { running: false, mEl: p.mEl || 0, fEl: 0, sEl: 0, sDur: 0 };
  }
  /* add ms of time back to a clock (negative = take time away) */
  function adjust(clk, k, deltaMs) {
    clk = JSON.parse(JSON.stringify(clk || { running: false }));
    if (clk.running) clk[k + 'Start'] = (clk[k + 'Start'] || now()) + deltaMs;
    else clk[k + 'El'] = Math.max(0, (clk[k + 'El'] || 0) - deltaMs);
    return clk;
  }

  function fmt(ms) {
    if (ms === null || ms === undefined) return '--:--';
    var s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + ('0' + m).slice(-2) : ('0' + m).slice(-2)) + ':' + ('0' + x).slice(-2);
  }
  function secs(ms) { return Math.ceil(ms / 1000); }

  /* status level for colouring: 'ok' | 'warn' | 'danger' */
  function level(rem, tot, warnMs, dangerMs) {
    if (rem === null) return 'ok';
    if (rem <= dangerMs) return 'danger';
    if (rem <= warnMs) return 'warn';
    return 'ok';
  }

  function splitName(n) {
    var p = (n || '').trim().split(/\s+/);
    return p.length === 1 ? { f: '', l: p[0] } : { f: p[0], l: p.slice(1).join(' ') };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ── offline-safe writes (same idea as referee.html) ── */
  function makeWriter(tbl) {
    var QKEY = 'upbsa_so_q_' + (tbl || '0'), busy = false;
    function gq() { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { return []; } }
    function sq(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch (e) { } }
    function enqueue(path, data) { var q = gq(); q.push({ path: path, data: JSON.parse(JSON.stringify(data)) }); sq(q); }
    function flush() {
      if (busy) return; var q = gq(); if (!q.length) return; busy = true;
      (function nx() {
        var q = gq(); if (!q.length) { busy = false; return; }
        db.ref(q[0].path).set(q[0].data).then(function () { var q2 = gq(); q2.shift(); sq(q2); setTimeout(nx, 80); })
          .catch(function () { busy = false; setTimeout(flush, 3000); });
      })();
    }
    w.addEventListener('online', flush);
    setTimeout(flush, 800);
    return function set(path, data) {
      if (navigator.onLine) db.ref(path).set(data).catch(function () { enqueue(path, data); });
      else enqueue(path, data);
    };
  }

  /* Points still on the table (reds + colours) */
  function ptsLeft(S) {
    var reds = Math.max(0, S.redsRemaining == null ? 15 : S.redsRemaining);
    return reds * 8 + 27;
  }

  w.SO = {
    db: db, now: now, DEFAULT_CFG: DEFAULT_CFG, PRESETS: PRESETS, cfgOf: cfgOf,
    times: times, pause: pause, resume: resume, resetShot: resetShot, newFrameClk: newFrameClk, adjust: adjust,
    phaseAt: phaseAt, shotSecAt: shotSecAt, fmt: fmt, secs: secs, level: level,
    splitName: splitName, esc: esc, makeWriter: makeWriter, ptsLeft: ptsLeft,
    table: new URLSearchParams(location.search).get('table')
  };
})(window);
