/* UPBSA.TV — who is watching the public page.
   • presence/bracket/{id}   one entry per open tab, gone when the tab closes  → "watching now"
   • stats/bracket/days/{YYYY-MM-DD}/{visitor}  one per browser per day        → "visitors today"
   • stats/bracket/views/{YYYY-MM-DD}  +1 per page load                         → "page views"
   • stats/bracket/total  +1 the first time a browser ever opens the page      → "visitors in total"
   Nothing personal is stored: the visitor id is a random string kept in this browser. */
(function (w) {
  'use strict';
  if (!w.firebase || !firebase.apps.length) return;
  var db = firebase.database(), PAGE = 'bracket';
  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  var vid = null, first = false;
  try { vid = localStorage.getItem('upbsa_vid'); if (!vid) { vid = rid(); localStorage.setItem('upbsa_vid', vid); first = true; } } catch (e) { vid = rid(); }
  var d = new Date(), day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  var TS = firebase.database.ServerValue.TIMESTAMP, inc = function (ref) { ref.transaction(function (c) { return (c || 0) + 1; }, function () { }, false); };
  var seenToday = false; try { seenToday = localStorage.getItem('upbsa_vday') === day; localStorage.setItem('upbsa_vday', day); } catch (e) { }
  if (!seenToday) db.ref('stats/' + PAGE + '/days/' + day + '/' + vid).set(true).catch(function () { });
  if (first) inc(db.ref('stats/' + PAGE + '/total'));
  inc(db.ref('stats/' + PAGE + '/views/' + day));
  /* live presence: this tab, removed by the server when it disconnects */
  var me = db.ref('presence/' + PAGE).push(), page = function () { return (location.hash || '#live').slice(0, 90); };
  function here() { me.set({ at: TS, p: page() }).catch(function () { }); }
  db.ref('.info/connected').on('value', function (s) { if (s.val() === true) { try { me.onDisconnect().remove(); } catch (e) { } here(); } });
  here();
  w.addEventListener('hashchange', here);
  setInterval(here, 60000);
  w.addEventListener('pagehide', function () { try { me.remove(); } catch (e) { } });
})(window);
