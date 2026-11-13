/* UPBSA.TV — clear the stream after a match ends.
   The finished scoreboard and winner card stay up for a short while, then the overlay goes clear
   until the next match starts on that table. Time is set in the Control Room (Moments → After a match),
   or per OBS source with ?finished=SECONDS (0 = keep it up until the table is cleared). */
(function (w) {
  'use strict';
  var Q = new URLSearchParams(location.search), urlN = Q.get('finished');
  var HIDE = urlN != null ? +urlN : 25, cur = null, at = 0, t = null, cb = null, listening = false;
  function listen() {
    if (listening || urlN != null || !w.firebase || !firebase.apps.length) return; listening = true;
    firebase.database().ref('settings/moments/hideAfter').on('value', function (s) { var v = s.val(); HIDE = v == null ? 25 : +v; if (cb) cb(); }, function () { });
  }
  w.OVF = {
    /* true when the finished match has been on screen long enough and should go away */
    gone: function (s, again) {
      cb = again; listen();
      if (!s || s.status !== 'finished') { cur = null; clearTimeout(t); return false; }
      if (cur !== s.matchId) { cur = s.matchId; at = Math.min(Date.now(), +s.finishedAt || Date.now()); }
      if (!(HIDE > 0)) return false;
      var left = HIDE * 1000 - (Date.now() - at);
      if (left <= 0) return true;
      clearTimeout(t); t = setTimeout(function () { if (cb) cb(); }, left + 80);
      return false;
    }
  };
})(window);
