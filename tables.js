/* UPBSA.TV — how many tables the venue has (set in the Control Room).
   UPT.count  → current number (starts from the last known value, default 6)
   UPT.list() → [1..count]
   UPT.on(fn) → fn(count) now and whenever it changes
   UPT.MAX    → the most tables any page will listen to */
(function (w) {
  var KEY = 'upbsa_table_count', MAX = 20, cbs = [];
  var start = 6; try { var c = parseInt(localStorage.getItem(KEY), 10); if (c > 0 && c <= MAX) start = c; } catch (e) { }
  var UPT = w.UPT = {
    MAX: MAX, count: start,
    list: function () { var a = []; for (var i = 1; i <= UPT.count; i++) a.push(i); return a; },
    on: function (fn) { cbs.push(fn); try { fn(UPT.count); } catch (e) { } },
    set: function (n) { n = Math.max(1, Math.min(MAX, parseInt(n, 10) || 6)); return firebase.database().ref('settings/tableCount').set(n); }
  };
  function watch() {
    if (!w.firebase || !firebase.apps.length) return;
    firebase.database().ref('settings/tableCount').on('value', function (s) {
      var v = parseInt(s.val(), 10); v = v > 0 && v <= MAX ? v : 6;
      if (v === UPT.count && UPT._got) return;
      UPT._got = true; UPT.count = v;
      try { localStorage.setItem(KEY, v); } catch (e) { }
      cbs.forEach(function (fn) { try { fn(v); } catch (e) { } });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else setTimeout(watch, 0);
})(window);
