/* UPBSA.TV — referee app helpers (loaded on the referee remotes and go.html)
   • installable "UPBSA Referee" app (install button / iPhone hint)
   • keeps the phone screen awake while scoring
   • remembers the table so the app opens straight onto it
   • reports the phone battery to the Control Room
   • records breaks and match finish times for the event summary */
(function (w, d) {
  'use strict';
  var Q = new URLSearchParams(location.search), T = Q.get('table');
  var standalone = w.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ── service worker (needed for install + offline) ── */
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(function () { });

  /* ── install banner ── */
  var deferred = null;
  var css = '#ra-inst{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147482990;display:none;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:#0b1610;border:1px solid rgba(240,192,64,.45);box-shadow:0 10px 30px rgba(0,0,0,.55);color:#e8f4e0;font:500 13px "Inter",system-ui,sans-serif;max-width:460px;margin:0 auto;}' +
    '#ra-inst.on{display:flex;}#ra-inst img{width:38px;height:38px;border-radius:10px;}#ra-inst div{flex:1;line-height:1.35;}#ra-inst b{display:block;font:900 16px "Barlow Condensed",sans-serif;letter-spacing:1px;text-transform:uppercase;color:#f0c040;}' +
    '#ra-inst button{height:36px;padding:0 14px;border-radius:9px;border:0;background:#f0c040;color:#0b0b0b;font:800 13px "Inter",sans-serif;cursor:pointer;}#ra-inst .x{background:none;color:rgba(232,244,224,.5);font-size:20px;padding:0 6px;}';
  function banner(ios) {
    if (standalone || ls('ra_inst_hide') === '1' || d.getElementById('ra-inst')) return;
    var st = d.createElement('style'); st.textContent = css; d.head.appendChild(st);
    var b = d.createElement('div'); b.id = 'ra-inst';
    b.innerHTML = '<img src="referee-192.png" alt=""><div><b>Referee app</b>' + (ios ? 'Tap <span style="font-size:16px">⎋</span> Share, then <i>Add to Home Screen</i>' : 'Opens straight to your table, full screen, screen stays on') + '</div>' +
      (ios ? '' : '<button id="ra-go">Install</button>') + '<button class="x" id="ra-x" aria-label="Close">×</button>';
    d.body.appendChild(b); b.classList.add('on');
    d.getElementById('ra-x').onclick = function () { b.remove(); ls('ra_inst_hide', '1'); };
    var go = d.getElementById('ra-go');
    if (go) go.onclick = function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.then(function () { b.remove(); deferred = null; }); };
  }
  w.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; if (d.body) banner(false); else d.addEventListener('DOMContentLoaded', function () { banner(false); }); });
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !w.MSStream;
  if (ios && !standalone) d.addEventListener('DOMContentLoaded', function () { setTimeout(function () { banner(true); }, 1500); });
  w.addEventListener('appinstalled', function () { var b = d.getElementById('ra-inst'); if (b) b.remove(); });

  if (!T || !w.firebase) return;            // go.html / table picker: nothing more to do
  var TK = 'table-' + T;

  /* ── keep the screen on while the remote is open ── */
  var lock = null;
  function wake() { if (!('wakeLock' in navigator) || lock || d.visibilityState !== 'visible') return; navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }).catch(function () { }); }
  d.addEventListener('visibilitychange', wake);
  d.addEventListener('pointerdown', wake, { passive: true });

  /* ── wait until the remote is unlocked ── */
  function whenReady(fn) { (function chk() { if (w.UA && UA.ready && firebase.apps.length && firebase.auth && firebase.auth().currentUser) fn(); else setTimeout(chk, 1000); })(); }
  whenReady(function () {
    ls('upbsa_ref_table', T);
    wake();
    var db = firebase.database(), uid = firebase.auth().currentUser.uid, TS = firebase.database.ServerValue.TIMESTAMP;
    function raw(name, path, v) { try { return UA.raw(name, db.ref(path), v).catch(function () { }); } catch (e) { } }

    /* battery → Control Room */
    var bat = null;
    function sendBat() { if (!bat || !UA.ready) return; raw('set', 'refBat/' + TK + '/' + uid, { l: Math.round(bat.level * 100), c: !!bat.charging, at: TS }); }
    if (navigator.getBattery) navigator.getBattery().then(function (b) { bat = b; sendBat(); b.addEventListener('levelchange', sendBat); b.addEventListener('chargingchange', sendBat); setInterval(sendBat, 60000); }).catch(function () { });

    /* breaks + finish times → event summary */
    var prev = null, logged = {};
    try { logged = JSON.parse(sessionStorage.getItem('ra_logged') || '{}'); } catch (e) { }
    db.ref('matches/' + TK).on('value', function (s) {
      var m = s.val();
      if (m && m.player1 && prev && prev.mid === m.matchId) {
        // a break ended: it drops to 0, or the other player came to the table, or the frame moved on
        var cb = m.currentBreak || 0, who = m.breakPlayer || m.turn;
        if (prev.cb >= 10 && (cb === 0 || who !== prev.who || m.currentFrame !== prev.fr) && cb < prev.cb) {
          var p = prev.who === 2 ? m.player2 : m.player1, key = (String(m.matchId || 'm') + '_' + prev.fr + '_' + prev.who + '_' + prev.cb).replace(/[.#$\[\]\/]/g, '_');
          if (!logged[key]) {
            logged[key] = 1; try { sessionStorage.setItem('ra_logged', JSON.stringify(logged)); } catch (e) { }
            raw('set', 'breaks/' + TK + '/' + key, { v: prev.cb, name: (p && p.name) || '', matchId: m.matchId || '', frame: prev.fr || 1, tournament: m.tournament || '', sport: m.sport || 'snooker', at: TS });
          }
        }
        if (prev.status !== 'finished' && m.status === 'finished' && m.matchId) {
          var wn = m.matchWinner ? (m['player' + m.matchWinner] || {}).name || '' : '';
          raw('update', 'match_registry/' + m.matchId, { tableKey: TK, status: 'finished', endTime: TS, winner: wn, p1frames: m.player1.frames || 0, p2frames: (m.player2 || {}).frames || 0 });
        }
      }
      prev = m && m.player1 ? { mid: m.matchId, cb: m.currentBreak || 0, who: m.breakPlayer || m.turn, fr: m.currentFrame, status: m.status } : null;
    });
  });
})(window, document);
