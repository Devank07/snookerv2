/* UPBSA.TV — Enter a Draw: import a prepared draw file, and edit player names in a saved draw.
   A draw file ({ upbsa:'draw', event:{…}, category, draw:{ format:'knockout', linked:true, matches:{…} } })
   can describe any bracket: each match names the match that feeds each slot (src1 / src2), so seeded players
   can join in later rounds. Used on draw-entry.html (needs its globals: db, T, g, toast, BK). */
(function (w, d) {
  'use strict';
  var css = '.imp{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.75);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:28px 12px;}' +
    '.imp .bx{width:100%;max-width:640px;background:#0b1610;border:1px solid rgba(240,192,64,.35);border-radius:16px;padding:18px;color:#e8f4e0;font-family:Inter,system-ui,sans-serif;}' +
    '.imp h3{display:flex;align-items:center;font:900 22px "Barlow Condensed",sans-serif;letter-spacing:1px;text-transform:uppercase;color:#f0c040;margin:0 0 6px;}.imp h3 span{flex:1;}' +
    '.imp .x{background:none;border:0;color:#fff;font-size:26px;cursor:pointer;}' +
    '.imp p{font-size:13px;color:rgba(232,244,224,.6);line-height:1.5;margin:4px 0 12px;}' +
    '.imp .sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0;}.imp .sum div{padding:10px;border-radius:10px;background:rgba(255,255,255,.04);text-align:center;}' +
    '.imp .sum b{display:block;font:400 26px "Bebas Neue",sans-serif;color:#f0c040;}.imp .sum span{font-size:11px;color:rgba(232,244,224,.55);}' +
    '.imp label{display:block;font:700 12px Inter,sans-serif;color:rgba(232,244,224,.6);margin:10px 0 4px;}' +
    '.imp input,.imp select{width:100%;height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:#06100a;color:#fff;padding:0 10px;font:500 14px Inter,sans-serif;}' +
    '.imp .row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}' +
    '.imp .acts{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}' +
    '.imp .r{display:grid;grid-template-columns:96px 1fr 90px;gap:8px;align-items:center;padding:6px 0;border-top:1px solid rgba(255,255,255,.06);}' +
    '.imp .r small{font:700 11px "Barlow Condensed",sans-serif;letter-spacing:1px;color:rgba(232,244,224,.5);text-transform:uppercase;}' +
    '.imp .r.open input:first-of-type{border-color:rgba(240,192,64,.6);}' +
    '.imp .m{min-height:20px;font:600 13px Inter,sans-serif;margin-top:10px;}.imp .m.er{color:#ff9d92;}.imp .m.ok{color:#59e08a;}' +
    '.imp .list{max-height:52vh;overflow:auto;margin-top:8px;}';
  var st = d.createElement('style'); st.textContent = css; d.head.appendChild(st);
  function el(html) { var o = d.createElement('div'); o.className = 'imp'; o.innerHTML = '<div class="bx">' + html + '</div>'; d.body.appendChild(o); o.addEventListener('click', function (e) { if (e.target === o) o.remove(); }); return o; }
  function esc(s) { return BK.esc(s); }
  function realP(p) { return p && p.name && !p.tbd && !p.bye && !/^(tbd|bye)$/i.test(p.name); }

  /* ── import ── */
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var j; try { j = JSON.parse(r.result); } catch (e) { toast('That file is not a draw file'); return; }
      if (!j || !j.draw || !j.draw.matches) { toast('That file is not a draw file'); return; }
      showImport(j);
    };
    r.readAsText(file);
  }
  function showImport(j) {
    var ms = j.draw.matches, keys = Object.keys(ms), names = {}, open = 0, rounds = {};
    keys.forEach(function (k) { var m = ms[k]; rounds[m.round] = 1; [m.p1, m.p2].forEach(function (p) { if (realP(p)) names[p.name.toLowerCase()] = 1; else if (p && p.placeholder) open++; }); });
    var ev = j.event || {}, ids = Object.keys(T).filter(function (id) { return T[id] && T[id].name; });
    var same = ids.filter(function (id) { return String(T[id].name).toLowerCase() === String(ev.name || '').toLowerCase(); })[0];
    var o = el('<h3><span>Import a draw</span><button class="x">×</button></h3>' +
      '<p>' + esc(ev.subtitle ? ev.subtitle + ' · ' : '') + '<b>' + esc(ev.name || 'Unnamed event') + '</b>' + (ev.startDate ? ' · ' + esc(ev.startDate) + (ev.endDate ? ' – ' + esc(ev.endDate) : '') : '') + '</p>' +
      '<div class="sum"><div><b>' + Object.keys(names).length + '</b><span>players</span></div><div><b>' + keys.length + '</b><span>matches</span></div><div><b>' + Object.keys(rounds).length + '</b><span>rounds</span></div><div><b>' + open + '</b><span>open slots</span></div></div>' +
      '<label>Put it in</label><select id="im-ev">' + ids.map(function (id) { return '<option value="' + id + '"' + (id === same ? ' selected' : '') + '>' + esc(T[id].name) + '</option>'; }).join('') + '<option value="__new"' + (same ? '' : ' selected') + '>+ New event (from the file)</option></select>' +
      '<div id="im-new"><div class="row"><div><label>Event name</label><input id="im-name" value="' + esc(ev.name || '') + '"></div><div><label>Line above the name</label><input id="im-sub" value="' + esc(ev.subtitle || '') + '"></div></div>' +
      '<div class="row"><div><label>Venue</label><input id="im-venue" value="' + esc(ev.venue || '') + '" placeholder="Venue, city"></div><div><label>Reds</label><select id="im-reds"><option value="15">15 reds</option><option value="10">10 reds</option><option value="6">6 reds</option></select></div></div></div>' +
      '<label>Category name</label><input id="im-cat" value="' + esc(j.category || j.draw.catName || 'Open') + '">' +
      (open ? '<p style="margin-top:12px">' + open + ' slot' + (open > 1 ? 's say' : ' says') + ' “Player to be named”. Fill them in later with <b>✎ Edit names</b>, or give the opponent a walkover in Tournament Manager → Result.</p>' : '') +
      '<div class="m" id="im-m"></div><div class="acts"><button class="btn" id="im-x">Cancel</button><button class="btn gold" id="im-go">Import &amp; publish</button></div>');
    var q = function (id) { return o.querySelector('#' + id); };
    q('im-reds').value = String(ev.reds || 15);
    var sync = function () { q('im-new').style.display = q('im-ev').value === '__new' ? '' : 'none'; };
    q('im-ev').onchange = sync; sync();
    o.querySelector('.x').onclick = q('im-x').onclick = function () { o.remove(); };
    q('im-go').onclick = function () {
      var tid = q('im-ev').value, cat = q('im-cat').value.trim(), ck = BK.ck(cat), m = q('im-m');
      if (!cat) { m.className = 'm er'; m.textContent = 'Give the category a name.'; return; }
      var t = T[tid], old = t && t.draw && t.draw[ck];
      if (old && !old.empty && !confirm(t.name + ' already has a ' + cat + ' draw. Replace it?')) return;
      q('im-go').disabled = true; m.className = 'm'; m.textContent = 'Saving…';
      var draw = JSON.parse(JSON.stringify(j.draw)); draw.catName = cat; draw.manual = true; draw.importedAt = Date.now();
      var list = Object.keys(draw.matches).map(function (k) { return draw.matches[k]; }).sort(function (a, b) { return (a.round - b.round) || (parseInt(String(a.id).split('_m')[1], 10) - parseInt(String(b.id).split('_m')[1], 10)); });
      var mk = tid !== '__new' ? Promise.resolve(tid) : (function () {
        var ref = db.ref('tournaments').push();
        return ref.set({ name: q('im-name').value.trim() || ev.name || 'New event', subtitle: q('im-sub').value.trim(), sport: ev.sport || 'snooker', reds: +q('im-reds').value || 15,
          venue: q('im-venue').value.trim(), startDate: ev.startDate || '', endDate: ev.endDate || ev.startDate || '', tables: ev.tables || (w.UPT && UPT.count) || 3, tvTable: 1,
          status: 'active', createdAt: Date.now(), categories: {} }).then(function () { return ref.key; });
      })();
      mk.then(function (id) {
        tid = id; var tt = T[tid] || {}, tName = tt.name || q('im-name').value.trim() || ev.name || '';
        return new Promise(function (res, rej) {
          db.ref('meta/matchCounter').transaction(function (c) { return (c || 0) + list.length; }, function (err, ok, snap) {
            if (err || !ok) return rej(err || 'counter');
            var end = snap.val(), start = end - list.length + 1, up = {};
            list.forEach(function (mm, i) {
              mm.matchId = 'UPBSA-' + String(start + i).padStart(4, '0');
              up['match_registry/' + mm.matchId] = { matchId: mm.matchId, tournament: tName, bestOf: mm.bo || 7, tableNumber: mm.table || 0, status: 'pending',
                p1: realP(mm.p1) ? mm.p1.name : 'TBD', p1state: (mm.p1 && mm.p1.state) || '', p2: realP(mm.p2) ? mm.p2.name : 'TBD', p2state: (mm.p2 && mm.p2.state) || '',
                stage: mm.stage || 'ko', roundName: mm.roundName || '', datetime: mm.datetime || '', createdAt: Date.now() };
            });
            if (old && old.matches) Object.keys(old.matches).forEach(function (k) { var om = old.matches[k]; if (om && om.matchId && !up['match_registry/' + om.matchId]) up['match_registry/' + om.matchId + '/status'] = 'cancelled'; });
            up['tournaments/' + tid + '/draw/' + ck] = draw;
            var has = Object.keys(tt.categories || {}).some(function (k) { return tt.categories[k] && tt.categories[k].name === cat; });
            if (!has) up['tournaments/' + tid + '/categories/m_' + ck] = { name: cat, format: 'knockout' };
            if (tid === id && tt.name && ev.reds && !tt.reds) up['tournaments/' + tid + '/reds'] = ev.reds;
            db.ref().update(up).then(res, rej);
          });
        });
      }).then(function () {
        m.className = 'm ok'; m.innerHTML = 'Imported — <a href="bracket.html#e/' + tid + '/' + ck + '" target="_blank" style="color:#f0c040">open the public page ↗</a>';
        toast('Draw imported'); q('im-go').textContent = 'Done'; q('im-go').onclick = function () { o.remove(); };
        q('im-go').disabled = false;
        if (g('ev')) { setTimeout(function () { g('ev').value = tid; if (w.catOpts) catOpts(); if (g('cat').querySelector('option[value="' + CSS.escape(cat) + '"]')) { g('cat').value = cat; if (w.showExisting) showExisting(); } }, 600); }
      }, function (e) { q('im-go').disabled = false; m.className = 'm er'; m.textContent = 'Could not import: ' + (e && e.message || e); });
    };
  }

  /* ── edit the names in a saved draw (fill "Player to be named", fix spelling, change district) ── */
  function editNames(tid, ck) {
    var t = T[tid], dr = t && t.draw && t.draw[ck]; if (!dr) return;
    var ms = dr.matches || {}, rows = [];
    var minR = Math.min.apply(null, Object.keys(ms).map(function (k) { return +ms[k].round || 1; }));
    Object.keys(ms).sort(function (a, b) { return (ms[a].round - ms[b].round) || (parseInt(a.split('_m')[1], 10) - parseInt(b.split('_m')[1], 10)); }).forEach(function (k) {
      var m = ms[k];
      ['p1', 'p2'].forEach(function (s) {
        if (m[s === 'p1' ? 'src1' : 'src2']) return;                         // filled by the winner of an earlier match
        if (!dr.linked && (+m.round || 1) > minR) return;                     // normal draws: first-round slots only
        var p = m[s] || {}; if (p.bye || /^bye$/i.test(p.name || '')) return;
        rows.push({ k: k, s: s, m: m, p: p });
      });
    });
    var o = el('<h3><span>Edit names · ' + esc(dr.catName || ck) + '</span><button class="x">×</button></h3>' +
      '<p>Change a name or district and press Save. Slots marked in gold are still “Player to be named”. Names already played can be changed too — results stay with the slot.</p>' +
      '<input id="en-f" placeholder="Find…" style="margin-bottom:6px"><div class="list">' + rows.map(function (r, i) {
        var lbl = BK.shortRound(r.m.roundName) + ' · ' + (r.m.datetime ? r.m.datetime.slice(8, 10) + '/' + r.m.datetime.slice(5, 7) + ' ' + r.m.datetime.slice(11) : '') + (r.m.table ? ' T' + r.m.table : '');
        return '<div class="r' + (realP(r.p) ? '' : ' open') + '" data-i="' + i + '"><small>' + esc(lbl) + '</small><input data-n value="' + esc(realP(r.p) ? r.p.name : '') + '" placeholder="Player to be named"><input data-s value="' + esc(r.p.state || '') + '" placeholder="District"></div>';
      }).join('') + '</div><div class="m" id="en-m"></div><div class="acts"><button class="btn" id="en-x">Close</button><button class="btn gold" id="en-go">Save names</button></div>');
    var q = function (id) { return o.querySelector('#' + id); };
    o.querySelector('.x').onclick = q('en-x').onclick = function () { o.remove(); };
    q('en-f').oninput = function () { var f = this.value.trim().toLowerCase(); o.querySelectorAll('.r').forEach(function (x) { x.style.display = !f || x.querySelector('[data-n]').value.toLowerCase().indexOf(f) >= 0 || x.querySelector('small').textContent.toLowerCase().indexOf(f) >= 0 ? '' : 'none'; }); };
    q('en-go').onclick = function () {
      var up = {}, n = 0;
      o.querySelectorAll('.r').forEach(function (x) {
        var r = rows[+x.dataset.i], nm = x.querySelector('[data-n]').value.trim(), stt = x.querySelector('[data-s]').value.trim();
        var was = realP(r.p) ? r.p.name : '', wasS = r.p.state || '';
        if (nm === was && stt === wasS) return;
        var base = 'tournaments/' + tid + '/draw/' + ck + '/matches/' + r.k + '/' + r.s;
        up[base] = nm ? { name: nm, state: stt } : { name: 'TBD', tbd: true, placeholder: 'Player to be named' };
        if (r.m.matchId) { up['match_registry/' + r.m.matchId + '/' + r.s] = nm || 'TBD'; up['match_registry/' + r.m.matchId + '/' + r.s + 'state'] = stt; }
        n++;
      });
      if (!n) { q('en-m').className = 'm'; q('en-m').textContent = 'Nothing changed.'; return; }
      db.ref().update(up).then(function () { q('en-m').className = 'm ok'; q('en-m').textContent = n + ' name' + (n > 1 ? 's' : '') + ' saved — live on the public page.'; toast('Names saved'); },
        function (e) { q('en-m').className = 'm er'; q('en-m').textContent = 'Not saved: ' + e.message; });
    };
  }
  w.DrawImport = { file: importFile, show: showImport, editNames: editNames };

  /* buttons on the page */
  function wire() {
    var top = d.querySelector('.top .sp'); if (!top || d.getElementById('imp-btn')) return;
    var inp = d.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.style.display = 'none'; inp.id = 'imp-file';
    inp.onchange = function () { var f = inp.files[0]; inp.value = ''; if (f) importFile(f); };
    var b = d.createElement('button'); b.className = 'btn gold'; b.id = 'imp-btn'; b.textContent = '⬆ Import a draw file'; b.onclick = function () { inp.click(); };
    top.parentNode.insertBefore(b, top.nextSibling); top.parentNode.appendChild(inp);
  }
  /* the "already has a draw" note gets an Edit names button; linked draws can't be edited slot-by-slot here */
  var _show = w.showExisting;
  if (_show) w.showExisting = function () {
    _show.apply(this, arguments);
    var t = T[g('ev').value], n = w.catName ? catName() : '', ck = n && BK.ck(n), dr = t && ck && t.draw && t.draw[ck], box = g('exists');
    if (!dr || dr.empty || !box) return;
    var wb = box.querySelector('.warn'); if (!wb || wb.querySelector('#editnames')) return;
    var e = d.createElement('button'); e.className = 'btn sm'; e.id = 'editnames'; e.textContent = '✎ Edit names'; e.style.marginLeft = '6px';
    e.onclick = function () { editNames(g('ev').value, ck); }; wb.appendChild(e);
    if (dr.linked) { var le = wb.querySelector('#loadex'); if (le) le.remove(); wb.insertAdjacentHTML('beforeend', '<div style="margin-top:6px">This is an imported bracket (players join in later rounds) — edit names here, or import a new file to replace it.</div>'); }
  };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', wire); else wire();
})(window, document);
