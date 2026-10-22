/* UPBSA.TV — sign-in and access control
   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
   <script src="upbsa-auth.js" data-mode="admin"></script>     staff pages (email + password)
   <script src="upbsa-auth.js" data-mode="referee"></script>   referee remotes (table PIN, no account)
   data-when="edit"  → only lock when the page is opened with ?edit=1
   The real protection is the database rules (database.rules.json); this file
   is the friendly front door that signs people in so the rules let them write. */
(function (w, d) {
  'use strict';
  var me = d.currentScript || {}, ds = me.dataset || {};
  var params = new URLSearchParams(location.search);
  var MODE = ds.mode || '';
  if (ds.when && !params.get(ds.when)) MODE = '';
  var TABLE = params.get('table');
  if (MODE === 'referee' && !TABLE) MODE = '';           // table picker screen — nothing to lock yet
  var TK = TABLE ? 'table-' + TABLE : null;
  var HASHPIN = null;
  (function () { var m = /(?:^|[#&])pin=(\d{4,8})/.exec(location.hash || ''); if (m) { HASHPIN = m[1]; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } } })();

  var UA = w.UA = { mode: MODE, ready: false, user: null, openPinManager: openPinManager, signOut: signOut };
  if (!w.firebase || !firebase.database) return;

  var Q = firebase.database.Query.prototype, R = firebase.database.Reference.prototype;
  var o = { on: Q.on, off: Q.off, once: Q.once, set: R.set, update: R.update, remove: R.remove, transaction: R.transaction };
  var readyRes, readyP = new Promise(function (r) { readyRes = r; });
  var pending = [];
  function isDenied(e) { return e && (e.code === 'PERMISSION_DENIED' || /permission.denied/i.test(e.message || '')); }

  /* ── staff pages: hold every read until we know who is signed in ── */
  if (MODE === 'admin') {
    Q.on = function (ev, cb) { if (UA.ready) return o.on.apply(this, arguments); pending.push([this, arguments]); return cb; };
    Q.off = function (ev, cb) { if (!UA.ready) pending = pending.filter(function (p) { return !(p[0].isEqual(this) && (!cb || p[1][1] === cb)); }, this); return o.off.apply(this, arguments); };
    Q.once = function () { var self = this, a = arguments; if (UA.ready) return o.once.apply(self, a); return readyP.then(function () { return o.once.apply(self, a); }); };
  }
  /* ── writes: wait for sign-in, and react when the rules say no ── */
  function guard(name) {
    R[name] = function () {
      var self = this, a = arguments;
      var run = function () {
        var p = o[name].apply(self, a);
        return p && p.catch ? p.catch(function (e) {
          if (!isDenied(e)) throw e;
          if (MODE === 'referee') { lostAccess(); return; }        // the referee re-enters the PIN and taps again
          toast('Not saved — this account is not allowed to change that.');
          throw e;
        }) : p;
      };
      if (MODE && !UA.ready && name !== 'transaction') return readyP.then(run);
      return run();
    };
  }
  if (MODE) ['set', 'update', 'remove', 'transaction'].forEach(guard);

  /* ── look ── */
  var CSS = '#ua-gate{position:fixed;inset:0;z-index:2147483000;background:radial-gradient(ellipse at top,#143322,#050a06 70%);display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Barlow Condensed","Inter",system-ui,sans-serif;color:#e8f4e0;}' +
    '#ua-gate *{box-sizing:border-box;}' +
    '.ua-card{width:100%;max-width:360px;text-align:center;}' +
    '.ua-brand{font:900 15px "Barlow Condensed",sans-serif;letter-spacing:6px;color:#f0c040;margin-bottom:4px;}' +
    '.ua-title{font:900 34px "Barlow Condensed",sans-serif;letter-spacing:1px;text-transform:uppercase;margin:6px 0 2px;}' +
    '.ua-sub{font:500 14px "Inter",system-ui,sans-serif;color:rgba(232,244,224,.6);margin-bottom:22px;line-height:1.45;}' +
    '.ua-dots{display:flex;justify-content:center;gap:12px;height:20px;margin-bottom:24px;}' +
    '.ua-dot{width:16px;height:16px;border-radius:50%;border:2px solid rgba(240,192,64,.35);transition:all .12s;}' +
    '.ua-dot.on{background:#f0c040;border-color:#f0c040;box-shadow:0 0 10px rgba(240,192,64,.55);}' +
    '.ua-shake{animation:uaShake .4s;}.ua-err .ua-dot{border-color:#e74c3c;background:#e74c3c;}' +
    '@keyframes uaShake{0%,100%{transform:none}20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}' +
    '.ua-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}' +
    '.ua-k{height:66px;border-radius:14px;border:1px solid rgba(240,192,64,.22);background:rgba(240,192,64,.08);color:#f0c040;font:800 28px "Barlow Condensed",sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
    '.ua-k:active{background:rgba(240,192,64,.25);transform:scale(.96);}' +
    '.ua-k.go{background:#2ecc71;border-color:#2ecc71;color:#06120a;}.ua-k.go:disabled{opacity:.35;}' +
    '.ua-msg{min-height:22px;margin:-10px 0 14px;font:700 15px "Barlow Condensed",sans-serif;letter-spacing:1px;color:#ff8a7a;}' +
    '.ua-msg.ok{color:#59e08a;}' +
    '.ua-in{width:100%;height:50px;margin-bottom:10px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.35);color:#fff;padding:0 14px;font:500 16px "Inter",system-ui,sans-serif;}' +
    '.ua-in:focus{outline:none;border-color:#f0c040;}' +
    '.ua-btn{width:100%;height:50px;border-radius:12px;border:0;background:#f0c040;color:#0b0b0b;font:900 18px "Barlow Condensed",sans-serif;letter-spacing:2px;text-transform:uppercase;cursor:pointer;}' +
    '.ua-btn:disabled{opacity:.5;}.ua-link{background:none;border:0;color:rgba(232,244,224,.6);font:500 13px "Inter",system-ui,sans-serif;margin-top:14px;cursor:pointer;text-decoration:underline;}' +
    '.ua-id{font:600 13px ui-monospace,monospace;word-break:break-all;background:rgba(0,0,0,.4);border:1px dashed rgba(240,192,64,.4);border-radius:10px;padding:10px;margin:0 0 12px;user-select:all;}' +
    '.ua-spin{width:34px;height:34px;margin:10px auto;border-radius:50%;border:3px solid rgba(240,192,64,.2);border-top-color:#f0c040;animation:uaSpin .8s linear infinite;}@keyframes uaSpin{to{transform:rotate(360deg)}}' +
    '#ua-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483001;background:#2a0d0d;border:1px solid #e74c3c;color:#ffd6d0;padding:10px 16px;border-radius:10px;font:600 14px "Inter",system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:90vw;}' +
    /* PIN manager */
    '#ua-pm{position:fixed;inset:0;z-index:2147482999;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px;font-family:"Inter",system-ui,sans-serif;color:#e8f4e0;}' +
    '.ua-pm-box{width:100%;max-width:560px;background:#0b1610;border:1px solid rgba(240,192,64,.3);border-radius:16px;padding:18px;}' +
    '.ua-pm-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}' +
    '.ua-pm-h b{font:900 22px "Barlow Condensed",sans-serif;letter-spacing:1px;color:#f0c040;text-transform:uppercase;}' +
    '.ua-x{background:none;border:0;color:#fff;font-size:24px;cursor:pointer;}' +
    '.ua-pm-note{font-size:13px;color:rgba(232,244,224,.6);margin:0 0 14px;line-height:1.45;}' +
    '.ua-sec{font:900 13px "Barlow Condensed",sans-serif;letter-spacing:3px;color:rgba(240,192,64,.8);margin:16px 0 8px;text-transform:uppercase;}' +
    '.ua-row{display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:center;padding:10px;border-radius:12px;background:rgba(255,255,255,.04);margin-bottom:8px;}' +
    '.ua-row .t{font:900 20px "Barlow Condensed",sans-serif;}.ua-row .s{grid-column:2/4;font-size:12px;color:rgba(232,244,224,.55);margin-top:-2px;}' +
    '.ua-row input{height:40px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.35);color:#fff;padding:0 10px;font:700 18px ui-monospace,monospace;letter-spacing:3px;width:100%;}' +
    '.ua-row input::placeholder{font:500 13px "Inter",system-ui,sans-serif;letter-spacing:0;color:rgba(255,255,255,.35);}' +
    '.ua-acts{display:flex;gap:6px;}.ua-sm{height:40px;padding:0 12px;border-radius:9px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:700 13px "Inter",system-ui,sans-serif;cursor:pointer;white-space:nowrap;}' +
    '.ua-sm.gold{background:#f0c040;color:#0b0b0b;border-color:#f0c040;}.ua-sm.red{border-color:rgba(231,76,60,.6);color:#ff9d92;}' +
    '.ua-staff{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:6px;font:600 12px ui-monospace,monospace;word-break:break-all;}' +
    '.ua-staff span{flex:1;}';
  function addCss() { if (d.getElementById('ua-css')) return; var s = d.createElement('style'); s.id = 'ua-css'; s.textContent = CSS; (d.head || d.documentElement).appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function gate(html) {
    addCss();
    var g = d.getElementById('ua-gate');
    if (!g) { g = d.createElement('div'); g.id = 'ua-gate'; d.body.appendChild(g); }
    g.innerHTML = '<div class="ua-card">' + html + '</div>';
    return g;
  }
  function ungate() { var g = d.getElementById('ua-gate'); if (g) g.remove(); }
  var toastT;
  function toast(msg) {
    addCss(); var t = d.getElementById('ua-toast');
    if (!t) { t = d.createElement('div'); t.id = 'ua-toast'; d.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(function () { t.style.display = 'none'; }, 4000);
  }
  var beat = null;
  function setReady() {
    if (UA.ready) return;
    if (MODE === 'referee' && !beat) beat = setInterval(function () {   // tells the control room this phone is alive
      if (d.visibilityState === 'hidden' || !UA.ready) return;
      probe().then(function (ok) { if (!ok && navigator.onLine) lostAccess(); });
    }, 30000);
    UA.ready = true; readyRes();
    var p = pending; pending = [];
    p.forEach(function (x) { o.on.apply(x[0], x[1]); });
    ungate();
  }

  var auth, db;
  function start() {
    if (!firebase.apps.length) return;                     // page never set up Firebase
    auth = firebase.auth(); db = firebase.database();
    if (MODE === 'admin') gate('<div class="ua-brand">UPBSA.TV</div><div class="ua-spin"></div>');
    if (MODE === 'referee') gate('<div class="ua-brand">UPBSA.TV · TABLE ' + esc(TABLE) + '</div><div class="ua-spin"></div><div class="ua-sub">Connecting…</div>');
    auth.onAuthStateChanged(function (u) {
      UA.user = u;
      if (MODE === 'admin') adminCheck(u);
      else if (MODE === 'referee') refCheck(u);
    });
  }

  /* ════════════ STAFF (email + password) ════════════ */
  var shownLogin = false;
  function adminCheck(u) {
    if (!u || u.isAnonymous) { if (u && u.isAnonymous) auth.signOut(); return showLogin(); }
    o.once.call(db.ref('admins/' + u.uid), 'value').then(function (s) {
      if (s.val() === true) return setReady();
      // very first sign-in after setup: the first staff account becomes the owner
      return o.set.call(db.ref('admins/' + u.uid), true).then(setReady, function () { showNotAdmin(u); });
    }).catch(function () { showNotAdmin(u); });
  }
  function showLogin(msg) {
    shownLogin = true;
    gate('<div class="ua-brand">UPBSA.TV</div><div class="ua-title">Staff sign in</div>' +
      '<div class="ua-sub">' + esc(d.title.replace(/\s*[—-]\s*UPBSA\.TV\s*$/i, '')) + '</div>' +
      '<form id="ua-f"><input class="ua-in" id="ua-e" type="email" autocomplete="username" placeholder="Email" required>' +
      '<input class="ua-in" id="ua-p" type="password" autocomplete="current-password" placeholder="Password" required>' +
      '<div class="ua-msg" id="ua-m">' + esc(msg || '') + '</div><button class="ua-btn" id="ua-b">Sign in</button></form>' +
      '<button class="ua-link" id="ua-r">Forgot password?</button>');
    var f = d.getElementById('ua-f'), m = d.getElementById('ua-m');
    try { var last = localStorage.getItem('ua_last_email'); if (last) { d.getElementById('ua-e').value = last; d.getElementById('ua-p').focus(); } else d.getElementById('ua-e').focus(); } catch (e) { }
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var em = d.getElementById('ua-e').value.trim(), pw = d.getElementById('ua-p').value, b = d.getElementById('ua-b');
      b.disabled = true; m.className = 'ua-msg'; m.textContent = '';
      auth.signInWithEmailAndPassword(em, pw).then(function () { try { localStorage.setItem('ua_last_email', em); } catch (e) { } })
        .catch(function (e) {
          b.disabled = false;
          m.textContent = /wrong-password|user-not-found|invalid-credential|invalid-login/.test(e.code || '') ? 'Wrong email or password' :
            /too-many-requests/.test(e.code || '') ? 'Too many tries — wait a minute and try again' :
            /network/.test(e.code || '') ? 'No internet connection' : (e.message || 'Could not sign in');
        });
    });
    d.getElementById('ua-r').addEventListener('click', function () {
      var em = d.getElementById('ua-e').value.trim();
      if (!em) { m.textContent = 'Type your email first'; return; }
      auth.sendPasswordResetEmail(em).then(function () { m.className = 'ua-msg ok'; m.textContent = 'Reset link sent — check your email'; },
        function () { m.className = 'ua-msg'; m.textContent = 'Could not send the reset email'; });
    });
  }
  function showNotAdmin(u) {
    gate('<div class="ua-brand">UPBSA.TV</div><div class="ua-title">Not a staff account yet</div>' +
      '<div class="ua-sub">Signed in as ' + esc(u.email || '') + '. Ask the owner to add this ID in <b>Admin → Security → Staff</b>:</div>' +
      '<div class="ua-id">' + esc(u.uid) + '</div><button class="ua-btn" id="ua-c">Copy ID</button><button class="ua-link" id="ua-o">Sign out</button>');
    d.getElementById('ua-c').onclick = function () { try { navigator.clipboard.writeText(u.uid); this.textContent = 'Copied ✓'; } catch (e) { } };
    d.getElementById('ua-o').onclick = signOut;
  }
  function signOut() {
    if (!auth) return;
    auth.signOut().then(function () { location.reload(); });
  }

  /* ════════════ REFEREES (table PIN) ════════════ */
  var offset = 0, lost = false;
  function refCheck(u) {
    if (!u) { auth.signInAnonymously().catch(function () { gate('<div class="ua-brand">UPBSA.TV</div><div class="ua-title">No connection</div><div class="ua-sub">Check the internet and reload the page.</div><button class="ua-btn" onclick="location.reload()">Reload</button>'); }); return; }
    o.on.call(db.ref('.info/serverTimeOffset'), 'value', function (s) { offset = s.val() || 0; });
    probe().then(function (ok) { if (ok) setReady(); else showPad(); });
  }
  function probe() {
    return o.set.call(db.ref('refSeen/' + TK + '/' + auth.currentUser.uid), firebase.database.ServerValue.TIMESTAMP)
      .then(function () { return true; }, function () { return false; });
  }
  function lostAccess() {
    if (lost) return; lost = true; UA.ready = false;
    showPad('The PIN for this table has changed. Enter the new PIN, then repeat your last tap.');
  }
  function showPad(note) {
    var pin = '';
    gate('<div class="ua-brand">UPBSA.TV · REFEREE</div><div class="ua-title">Table ' + esc(TABLE) + '</div>' +
      '<div class="ua-sub">' + esc(note || 'Enter the table PIN from the organiser.') + '</div>' +
      '<div class="ua-dots" id="ua-dots"></div><div class="ua-msg" id="ua-m"></div>' +
      '<div class="ua-pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="ua-k" data-k="' + n + '">' + n + '</button>'; }).join('') +
      '<button class="ua-k" data-k="del" aria-label="Delete">⌫</button><button class="ua-k" data-k="0">0</button><button class="ua-k go" data-k="ok" id="ua-ok" disabled>✓</button></div>');
    var dots = d.getElementById('ua-dots'), m = d.getElementById('ua-m'), okB = d.getElementById('ua-ok'), busy = false;
    function draw() {
      var n = Math.max(4, pin.length), h = '';
      for (var i = 0; i < Math.min(n, 8); i++) h += '<div class="ua-dot' + (i < pin.length ? ' on' : '') + '"></div>';
      dots.innerHTML = h; dots.classList.remove('ua-err'); okB.disabled = pin.length < 4;
    }
    function fail(msg) {
      m.className = 'ua-msg'; m.textContent = msg; dots.classList.add('ua-err', 'ua-shake');
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      setTimeout(function () { dots.classList.remove('ua-shake'); pin = ''; draw(); busy = false; }, 700);
    }
    function submit() {
      if (busy || pin.length < 4) return; busy = true; m.textContent = '';
      var uid = auth.currentUser.uid, ref = db.ref('refPass/' + TK + '/' + uid);
      o.once.call(ref, 'value').then(function (s) {
        var v = s.val(), now = Date.now() + offset, n = 1;
        if (v && v.at >= now - 600000) {
          if (v.n >= 10) { var mins = Math.ceil((v.at + 600000 - now) / 60000); return fail('Too many tries — wait ' + mins + ' min'); }
          if (v.at > now - 1600) return new Promise(function (r) { setTimeout(r, 1700); }).then(function () { busy = false; submit(); });
          n = v.n + 1;
        }
        return o.set.call(ref, { pin: pin, n: n, at: firebase.database.ServerValue.TIMESTAMP }).then(probe).then(function (ok) {
          if (ok) { lost = false; m.className = 'ua-msg ok'; m.textContent = 'Unlocked ✓'; setTimeout(setReady, 250); }
          else fail(n >= 10 ? 'Wrong PIN — too many tries, wait 10 min' : 'Wrong PIN — if you scanned a card, it may be an old one');
        }, function () { fail('Too many tries — wait a few minutes'); });
      }).catch(function () { fail('No connection — try again'); });
    }
    d.getElementById('ua-gate').querySelectorAll('.ua-k').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.k;
        if (k === 'del') pin = pin.slice(0, -1); else if (k === 'ok') return submit(); else if (pin.length < 8) pin += k;
        draw();
      });
    });
    d.addEventListener('keydown', function kd(e) {
      if (!d.getElementById('ua-dots')) return d.removeEventListener('keydown', kd);
      if (/^[0-9]$/.test(e.key) && pin.length < 8) { pin += e.key; draw(); }
      else if (e.key === 'Backspace') { pin = pin.slice(0, -1); draw(); }
      else if (e.key === 'Enter') submit();
    });
    draw();
    if (HASHPIN) { pin = HASHPIN; HASHPIN = null; draw(); m.className = 'ua-msg ok'; m.textContent = 'Checking table card…'; submit(); }
  }

  /* ════════════ PIN MANAGER (for the admin panel) ════════════ */
  function rnd() { var a = new Uint32Array(1); (w.crypto || w.msCrypto).getRandomValues(a); return String(a[0] % 1000000).padStart(6, '0'); }
  function openPinManager() {
    if (!db || MODE !== 'admin' || !UA.ready) return;
    addCss();
    var box = d.getElementById('ua-pm'); if (box) box.remove();
    box = d.createElement('div'); box.id = 'ua-pm';
    box.innerHTML = '<div class="ua-pm-box"><div class="ua-pm-h"><b>Security</b><button class="ua-x" id="ua-pm-x">×</button></div>' +
      '<p class="ua-pm-note">Referees open the remote link and type the PIN for their table — no account needed. Changing a PIN or pressing <b>Sign out</b> locks every phone on that table straight away (printed QR cards for that table stop working too — print new ones).</p>' +
      '<div class="ua-sec">Table PINs</div><div id="ua-pm-t"><div class="ua-spin"></div></div>' +
      '<button class="ua-sm" id="ua-pm-add" style="margin-top:4px">+ Add table</button>' +
      '<button class="ua-sm" id="ua-pm-all" style="margin:4px 0 0 6px">New PINs for every table</button>' +
      '<button class="ua-sm gold" id="ua-pm-qr" style="margin:4px 0 0 6px">🖨 Print QR table cards</button>' +
      '<div class="ua-sec">Staff (can use admin pages)</div><div id="ua-pm-s"></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px"><input class="ua-in" id="ua-pm-id" placeholder="Paste a staff member\'s ID" style="margin:0;height:40px;font-size:13px"><button class="ua-sm gold" id="ua-pm-sa">Add</button></div>' +
      '<p class="ua-pm-note" style="margin-top:10px">To add a helper: create their account in Firebase → Authentication → Users, they sign in once on any admin page and it shows their ID to paste here.</p>' +
      '<div class="ua-sec">This device</div><div class="ua-staff"><span>' + esc(auth.currentUser.email || '') + '</span><button class="ua-sm red" id="ua-pm-out">Sign out</button></div></div>';
    d.body.appendChild(box);
    box.addEventListener('click', function (e) { if (e.target === box) box.remove(); });
    d.getElementById('ua-pm-x').onclick = function () { box.remove(); };
    d.getElementById('ua-pm-out').onclick = signOut;
    var pins = {}, seen = {}, tables = [];
    function load() {
      Promise.all([o.once.call(db.ref('secret/pins'), 'value'), o.once.call(db.ref('refSeen'), 'value'), o.once.call(db.ref('matches'), 'value'), o.once.call(db.ref('admins'), 'value')]).then(function (r) {
        pins = r[0].val() || {}; seen = r[1].val() || {};
        var set = {}; [1, 2, 3, 4, 5, 6].forEach(function (n) { set[n] = 1; });
        Object.keys(pins).concat(Object.keys(r[2].val() || {})).forEach(function (k) { var n = parseInt(String(k).replace('table-', ''), 10); if (n > 0) set[n] = 1; });
        tables = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
        drawTables(); drawStaff(r[3].val() || {});
      });
    }
    function active(k) {
      var s = seen[k] || {}, cut = Date.now() - 12 * 3600000;
      return Object.keys(s).filter(function (u) { return s[u] > cut; }).length;
    }
    function drawTables() {
      d.getElementById('ua-pm-t').innerHTML = tables.map(function (n) {
        var k = 'table-' + n, a = active(k);
        return '<div class="ua-row" data-k="' + k + '"><div class="t">T' + n + '</div><input inputmode="numeric" maxlength="8" value="' + esc(pins[k] || '') + '" placeholder="no PIN — locked">' +
          '<div class="ua-acts"><button class="ua-sm" data-a="new" title="Make a new random PIN">🎲</button><button class="ua-sm gold" data-a="save">Save</button></div>' +
          '<div class="s">' + (pins[k] ? (a ? a + ' referee phone' + (a > 1 ? 's' : '') + ' signed in today · <a href="#" data-a="out" style="color:#ff9d92">sign them out</a>' : 'No referee signed in yet') : 'Set a PIN so a referee can score on this table') + '</div></div>';
      }).join('');
      d.querySelectorAll('#ua-pm-t .ua-row').forEach(function (row) {
        var k = row.dataset.k, inp = row.querySelector('input');
        inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, '').slice(0, 8); });
        row.querySelector('[data-a=new]').onclick = function () { inp.value = rnd(); };
        row.querySelector('[data-a=save]').onclick = function () {
          var v = inp.value.trim();
          if (v && v.length < 4) { toast('PIN must be 4 to 8 digits'); return; }
          var up = {}; up['secret/pins/' + k] = v || null;
          if (pins[k] && v !== pins[k]) { up['refPass/' + k] = null; up['refSeen/' + k] = null; }   // old phones must use the new PIN
          o.update.call(db.ref(), up).then(function () { pins[k] = v || undefined; if (up['refSeen/' + k] === null) delete seen[k]; drawTables(); flash(k, v ? 'Saved ✓' : 'PIN removed — table locked'); });
        };
        var out = row.querySelector('[data-a=out]');
        if (out) out.onclick = function (e) {
          e.preventDefault(); var up = {}; up['refPass/' + k] = null; up['refSeen/' + k] = null;
          o.update.call(db.ref(), up).then(function () { delete seen[k]; drawTables(); flash(k, 'Referees signed out'); });
        };
      });
    }
    function flash(k, msg) { var s = d.querySelector('#ua-pm-t [data-k="' + k + '"] .s'); if (s) { s.textContent = msg; s.style.color = '#59e08a'; } }
    function drawStaff(admins) {
      var meId = auth.currentUser.uid;
      d.getElementById('ua-pm-s').innerHTML = Object.keys(admins).filter(function (u) { return admins[u] === true; }).map(function (u) {
        return '<div class="ua-staff"><span>' + esc(u) + (u === meId ? ' (you)' : '') + '</span>' + (u === meId ? '' : '<button class="ua-sm red" data-u="' + esc(u) + '">Remove</button>') + '</div>';
      }).join('');
      d.querySelectorAll('#ua-pm-s [data-u]').forEach(function (b) {
        b.onclick = function () { if (!confirm('Remove this staff account?')) return; o.remove.call(db.ref('admins/' + b.dataset.u)).then(load); };
      });
    }
    d.getElementById('ua-pm-qr').onclick = function () { w.open('table-cards.html', '_blank'); };
    d.getElementById('ua-pm-add').onclick = function () { var n = (tables[tables.length - 1] || 0) + 1; tables.push(n); drawTables(); };
    d.getElementById('ua-pm-all').onclick = function () {
      if (!confirm('Make new PINs for every table? All referee phones will need the new PIN.')) return;
      var up = {}; tables.forEach(function (n) { var k = 'table-' + n; up['secret/pins/' + k] = rnd(); up['refPass/' + k] = null; up['refSeen/' + k] = null; });
      o.update.call(db.ref(), up).then(load);
    };
    d.getElementById('ua-pm-sa').onclick = function () {
      var id = d.getElementById('ua-pm-id').value.trim();
      if (!/^[A-Za-z0-9]{20,40}$/.test(id)) { toast('That does not look like a staff ID'); return; }
      o.set.call(db.ref('admins/' + id), true).then(function () { d.getElementById('ua-pm-id').value = ''; load(); });
    };
    load();
  }

  if (MODE) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
  }
})(window, document);
