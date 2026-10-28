/* UPBSA.TV — backups (staff pages)
   BACKUP.download()        save everything to a .json file on this device
   BACKUP.snapshot(reason)  keep a copy inside the database (last 8 are kept)
   BACKUP.restoreFile(file) / BACKUP.restoreSnap(key)  put a backup back
   BACKUP.panel()           the Backups window used on the admin panel */
(function (w, d) {
  'use strict';
  var KEEP = 8;
  function db() { return firebase.database(); }
  function stamp(t) { var x = new Date(t || Date.now()), p = function (n) { return String(n).padStart(2, '0'); }; return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()) + '_' + p(x.getHours()) + p(x.getMinutes()); }
  function all() { return db().ref().once('value').then(function (s) { var v = s.val() || {}; delete v.backups; return v; }); }
  function save(name, data) {
    var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    var a = d.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; d.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function count(v) { return { events: Object.keys(v.tournaments || {}).length, players: Object.keys(v.players || {}).length, matches: Object.keys(v.match_registry || {}).length, tables: Object.keys(v.matches || {}).length }; }
  var B = w.BACKUP = {};
  B.download = function () { return all().then(function (v) { save('upbsa-backup-' + stamp() + '.json', { upbsa: 1, at: Date.now(), data: v }); return count(v); }); };
  B.snapshot = function (reason) {
    return all().then(function (v) {
      var ref = db().ref('backups').push();
      return ref.set({ at: firebase.database.ServerValue.TIMESTAMP, reason: reason || 'Manual', data: v, size: JSON.stringify(v).length }).then(function () {
        return db().ref('backups').once('value').then(function (s) {
          var list = []; s.forEach(function (c) { list.push({ k: c.key, at: (c.val() || {}).at || 0 }); });
          list.sort(function (a, b) { return b.at - a.at; });
          var up = {}; list.slice(KEEP).forEach(function (x) { up['backups/' + x.k] = null; });
          return Object.keys(up).length ? db().ref().update(up) : null;
        });
      });
    });
  };
  function put(data) {
    if (!data || typeof data !== 'object') return Promise.reject(new Error('Not a backup file'));
    var me = firebase.auth && firebase.auth().currentUser, up = {};
    Object.keys(data).forEach(function (k) { if (k !== 'backups') up[k] = data[k]; });
    up.admins = data.admins || {}; if (me) up.admins[me.uid] = true;          // never lock yourself out
    var keys = Object.keys(up), jobs = keys.map(function (k) { var o = {}; o[k] = up[k]; return db().ref().update(o); });
    return Promise.all(jobs);
  }
  B.restoreFile = function (file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { try { var j = JSON.parse(r.result); res(j.data || j); } catch (e) { rej(new Error('That file is not a backup')); } }; r.onerror = rej; r.readAsText(file); })
      .then(function (data) { return B.snapshot('Before restoring a file').then(function () { return put(data); }).then(function () { return count(data); }); });
  };
  B.restoreSnap = function (key) {
    return db().ref('backups/' + key + '/data').once('value').then(function (s) { var data = s.val(); if (!data) throw new Error('Backup not found');
      return B.snapshot('Before restoring a saved copy').then(function () { return put(data); }).then(function () { return count(data); }); });
  };
  B.downloadSnap = function (key) { return db().ref('backups/' + key).once('value').then(function (s) { var v = s.val(); if (v) save('upbsa-backup-' + stamp(v.at) + '.json', { upbsa: 1, at: v.at, data: v.data }); }); };

  /* ── window ── */
  var css = '#bkp{position:fixed;inset:0;z-index:2147482990;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px;font-family:"Inter",system-ui,sans-serif;color:#e8f4e0;}' +
    '#bkp .bx{width:100%;max-width:560px;background:#0b1610;border:1px solid rgba(240,192,64,.35);border-radius:16px;padding:18px;}' +
    '#bkp .hh{display:flex;align-items:center;justify-content:space-between;font:900 22px "Barlow Condensed",sans-serif;letter-spacing:1px;color:#f0c040;text-transform:uppercase;}' +
    '#bkp .x{background:none;border:0;color:#fff;font-size:26px;cursor:pointer;}' +
    '#bkp p{font-size:13px;color:rgba(232,244,224,.6);line-height:1.5;margin:6px 0 12px;}' +
    '#bkp .row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}' +
    '#bkp button.b{height:42px;padding:0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:700 13px "Inter",sans-serif;cursor:pointer;}' +
    '#bkp button.g{background:#f0c040;border-color:#f0c040;color:#0b0b0b;}#bkp button.r{color:#ff9d92;border-color:rgba(231,76,60,.45);}' +
    '#bkp .sec{font:900 13px "Barlow Condensed",sans-serif;letter-spacing:3px;color:rgba(240,192,64,.8);text-transform:uppercase;margin:14px 0 8px;}' +
    '#bkp .it{display:flex;align-items:center;gap:8px;padding:10px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:6px;font-size:13px;}' +
    '#bkp .it span{flex:1;}#bkp .it small{display:block;color:rgba(232,244,224,.5);}' +
    '#bkp .it button{height:32px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#fff;font:700 12px "Inter",sans-serif;cursor:pointer;}' +
    '#bkp .msg{min-height:20px;font:600 13px "Inter",sans-serif;color:#59e08a;margin-top:4px;}#bkp .msg.er{color:#ff9d92;}';
  B.panel = function () {
    if (!d.getElementById('bkp-css')) { var st = d.createElement('style'); st.id = 'bkp-css'; st.textContent = css; d.head.appendChild(st); }
    var o = d.getElementById('bkp'); if (o) o.remove();
    o = d.createElement('div'); o.id = 'bkp';
    o.innerHTML = '<div class="bx"><div class="hh">Backups<button class="x" id="bk-x">×</button></div>' +
      '<p>A backup is a copy of everything — events, draws, results, players, schedules, designs, PINs and settings. A copy is also saved here automatically before a Tournament Reset or a restore.</p>' +
      '<div class="row"><button class="b g" id="bk-dl">⬇ Download backup</button><button class="b" id="bk-sv">💾 Save a copy here</button><button class="b r" id="bk-up">⬆ Restore from file…</button><input type="file" id="bk-file" accept=".json,application/json" style="display:none"></div>' +
      '<div class="msg" id="bk-msg"></div><div class="sec">Saved copies (last ' + KEEP + ')</div><div id="bk-list"><p>Loading…</p></div></div>';
    d.body.appendChild(o);
    var msg = function (t, er) { var m = d.getElementById('bk-msg'); m.textContent = t; m.className = 'msg' + (er ? ' er' : ''); };
    var sum = function (c) { return c.events + ' events, ' + c.matches + ' matches, ' + c.players + ' players'; };
    o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
    d.getElementById('bk-x').onclick = function () { o.remove(); };
    d.getElementById('bk-dl').onclick = function () { msg('Preparing…'); B.download().then(function (c) { msg('Downloaded — ' + sum(c) + '. Keep the file somewhere safe.'); }, function (e) { msg('Could not download: ' + e.message, 1); }); };
    d.getElementById('bk-sv').onclick = function () { msg('Saving…'); B.snapshot('Manual').then(function () { msg('Copy saved.'); list(); }, function (e) { msg('Could not save: ' + e.message, 1); }); };
    d.getElementById('bk-up').onclick = function () { d.getElementById('bk-file').click(); };
    d.getElementById('bk-file').onchange = function () {
      var f = this.files[0]; this.value = ''; if (!f) return;
      var c = prompt('Restoring replaces what is in the system now with the backup "' + f.name + '".\nA copy of the current data is saved first.\n\nType RESTORE to continue:', ''); if (!c || c.trim().toUpperCase() !== 'RESTORE') return;
      msg('Restoring…'); B.restoreFile(f).then(function (c2) { msg('Restored — ' + sum(c2) + '.'); list(); }, function (e) { msg(e.message, 1); });
    };
    function list() {
      db().ref('backups').once('value').then(function (s) {
        var items = []; s.forEach(function (c) { var v = c.val() || {}; items.push({ k: c.key, at: v.at || 0, reason: v.reason || '', size: v.size || 0 }); });
        items.sort(function (a, b) { return b.at - a.at; });
        var el = d.getElementById('bk-list'); if (!el) return;
        el.innerHTML = items.length ? items.map(function (x) { return '<div class="it"><span>' + new Date(x.at).toLocaleString() + '<small>' + (x.reason || '') + (x.size ? ' · ' + Math.round(x.size / 1024) + ' KB' : '') + '</small></span><button data-dl="' + x.k + '">⬇</button><button data-rs="' + x.k + '">Restore</button></div>'; }).join('') : '<p>No saved copies yet.</p>';
        el.querySelectorAll('[data-dl]').forEach(function (b) { b.onclick = function () { B.downloadSnap(b.dataset.dl); }; });
        el.querySelectorAll('[data-rs]').forEach(function (b) { b.onclick = function () {
          var c = prompt('Put this saved copy back? What is in the system now is replaced (a copy is saved first).\n\nType RESTORE to continue:', ''); if (!c || c.trim().toUpperCase() !== 'RESTORE') return;
          msg('Restoring…'); B.restoreSnap(b.dataset.rs).then(function (c2) { msg('Restored — ' + sum(c2) + '.'); list(); }, function (e) { msg(e.message, 1); }); }; });
      });
    }
    list();
  };
})(window, document);
