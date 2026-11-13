/* UPBSA.TV — keep long-running screens (OBS overlays, venue boards, referee remotes) on the latest version.
   • Control Room → "Refresh screens" reloads every open overlay / board at once (settings/reload).
   • Every few minutes the page checks version.txt; when the site has been updated it reloads itself,
     but only while its table has no match being played (and nobody is typing on a remote). */
(function (w, d) {
  'use strict';
  var Q = new URLSearchParams(location.search), TBL = Q.get('table') || Q.get('t') || '';
  var KIND = /referee/.test(location.pathname) ? 'remote' : 'screen';
  var mine = null, started = Date.now(), seenReload = null, M = null;
  function reload() {
    var u = new URL(location.href); u.searchParams.set('_r', Date.now().toString(36));   // new address = OBS can't serve its old copy
    location.replace(u.toString());
  }
  function quiet() {
    if (KIND === 'remote') {
      var a = d.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return false;
      if (w.NM && NM.pending) return false;
    }
    if (!TBL || !M) return true;
    return !(M.player1 && M.status === 'active');                     // never in the middle of a match
  }
  function check() {
    fetch('version.txt?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (v) {
      v = (v || '').trim(); if (!v) return;
      if (mine === null) { mine = v; return; }
      if (v !== mine && quiet()) reload();
    }, function () { });
  }
  function start() {
    if (!w.firebase || !firebase.apps.length) return setTimeout(start, 500);
    var db = firebase.database();
    if (TBL) db.ref('matches/table-' + TBL).on('value', function (s) { M = s.val(); }, function () { });
    if (KIND === 'screen') db.ref('settings/reload').on('value', function (s) {
      var v = s.val(); if (seenReload === null) { seenReload = v || 0; return; }
      if (v && v !== seenReload && Date.now() - started > 3000) reload();
    }, function () { });
    check(); setInterval(check, 4 * 60 * 1000);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(window, document);
