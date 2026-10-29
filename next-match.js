/* UPBSA.TV — referee remotes: "next match" + player picker
   • When the table is free (or the match just ended) the remote offers the next scheduled
     match for this table — from the Schedule and the tournament brackets — and fills the
     setup form in one tap. The match keeps its schedule ID, so the bracket updates itself.
   • Player names come from a list (registry + draws) and fill in the player's state.
   Works on referee.html, billiards-referee.html and shootout-referee.html. */
(function (w, d) {
  'use strict';
  var T = new URLSearchParams(location.search).get('table');
  if (!T || !w.firebase) return;
  var PAGE = null;
  function g(id) { return d.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function low(s) { return String(s || '').trim().toLowerCase(); }
  function realName(n) { n = String(n || '').trim(); return n && !/^(tbd|bye)$/i.test(n) && !/^(winner|g\d+ #|rr #)/i.test(n); }

  /* hooks used by the remotes' own "create match" code */
  var NM = w.NM = {
    pending: null,
    take: function () {
      var p = NM.pending; NM.pending = null; if (!p) return null;
      var on = Object.keys(MATCHES).filter(function (k) { var m = MATCHES[k]; return k !== 'table-' + T && m && m.matchId === p.matchId; })[0];
      if (on) { alert('This match has just been started on ' + on.replace('table-', 'Table ') + '. Pick another match from the card.'); dismissed = null; render(); throw new Error('match already on ' + on); }
      return p;
    },
    fake: function (p) { var num = String(p.matchId).replace(/^UPBSA-/, '');          // the remotes build 'UPBSA-' + this
      return { transaction: function (fn, cb) { setTimeout(function () { cb(null, true, { val: function () { return num; } }); }, 0); return Promise.resolve(); } }; },
    noop: { set: function () { return Promise.resolve(); }, update: function () { return Promise.resolve(); } },
    /* a finished bracket match is "saved" once its result is in the draw (a staff page — Control Room or
       Tournament Manager — does that within seconds). Clearing the table before then would lose it. */
    saved: function (cur) {
      if (!cur || cur.status !== 'finished' || !cur.matchId) return true;
      if (RES[cur.matchId] && RES[cur.matchId].w) return true;                          // this phone (or another) saved it
      var m = drawMatch(cur.matchId); return !m || !!m.result;
    },
    guard: function (go) {
      var cur = MATCHES['table-' + T];
      if (NM.saved(cur)) return go();
      if (confirm('The result of ' + ((cur.player1 || {}).name || '') + ' v ' + ((cur.player2 || {}).name || '') + ' has not reached the bracket yet.\n\n' +
        'It is saved automatically while the Control Room or Tournament Manager is open on any device. Ask the organiser to open one, wait a few seconds, then try again.\n\n' +
        'Press OK only if you want to clear the table anyway — the bracket will NOT get this result.')) go();
    }
  };
  function drawMatch(mid) {
    var hit = null;
    Object.keys(TOUR).some(function (tid) { var dr = (TOUR[tid] && TOUR[tid].draw) || {}; return Object.keys(dr).some(function (ck) { var ms = (dr[ck] && dr[ck].matches) || {}; return Object.keys(ms).some(function (k) { if (ms[k] && ms[k].matchId === mid) { hit = ms[k]; return true; } }); }); });
    return hit;
  }

  var REG = {}, TOUR = {}, MATCHES = {}, NAMES = {}, RES = {}, me = null, dismissed = '';
  var css = '#nm{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:2147482980;max-width:520px;margin:0 auto;border-radius:18px;background:#0b1610;border:1px solid rgba(240,192,64,.55);box-shadow:0 14px 40px rgba(0,0,0,.6);color:#e8f4e0;font-family:"Inter",system-ui,sans-serif;display:none;overflow:hidden;}' +
    '#nm.on{display:block;animation:nmIn .35s ease;}@keyframes nmIn{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}' +
    '#nm .h{display:flex;align-items:center;gap:8px;padding:10px 14px 0;font:800 12px "Barlow Condensed",sans-serif;letter-spacing:3px;text-transform:uppercase;color:#f0c040;}' +
    '#nm .h .x{margin-left:auto;background:none;border:0;color:rgba(232,244,224,.5);font-size:22px;line-height:1;cursor:pointer;padding:0 4px;}' +
    '#nm .m{padding:6px 14px 2px;}' +
    '#nm .vs{display:flex;align-items:center;gap:10px;font:900 22px/1.05 "Barlow Condensed",sans-serif;text-transform:uppercase;}' +
    '#nm .vs span{flex:1;min-width:0;}#nm .vs span:last-child{text-align:right;}#nm .vs i{font-style:normal;color:rgba(232,244,224,.4);font-size:14px;}' +
    '#nm .st{display:flex;justify-content:space-between;font-size:11px;color:rgba(232,244,224,.5);text-transform:uppercase;letter-spacing:1px;margin-top:2px;}' +
    '#nm .meta{font-size:12px;color:rgba(232,244,224,.65);margin-top:6px;}' +
    '#nm .a{display:flex;gap:8px;padding:10px 14px 12px;}' +
    '#nm button.go{flex:1;height:46px;border-radius:12px;border:0;background:#2ecc71;color:#05140a;font:900 17px "Barlow Condensed",sans-serif;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;}' +
    '#nm button.more{height:46px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#e8f4e0;font:700 13px "Inter",sans-serif;cursor:pointer;}' +
    '#nm .list{display:none;max-height:44vh;overflow:auto;border-top:1px solid rgba(255,255,255,.08);}#nm.open .list{display:block;}' +
    '#nm .it{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer;}#nm .it:active{background:rgba(240,192,64,.1);}' +
    '#nm .it b{flex:1;font:800 15px "Barlow Condensed",sans-serif;text-transform:uppercase;}#nm .it small{font-size:11px;color:rgba(232,244,224,.5);display:block;font-weight:500;text-transform:none;font-family:"Inter",sans-serif;}' +
    '#nm .it em{font-style:normal;font:800 11px "Barlow Condensed",sans-serif;letter-spacing:1px;color:#f0c040;}' +
    '#nm-toast{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147482981;background:#123321;border:1px solid #2ecc71;color:#bff5d2;padding:10px 16px;border-radius:10px;font:600 14px "Inter",sans-serif;display:none;max-width:92vw;text-align:center;}';
  function toast(t) { var e = g('nm-toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(function () { e.style.display = 'none'; }, 3500); }

  /* which tournament a registry entry belongs to → sport + round info */
  function info(r) {
    var out = { sport: r.sport || '', round: r.roundName || '', cat: '', datetime: r.datetime || '' };
    Object.keys(TOUR).some(function (tid) {
      var t = TOUR[tid]; if (!t || !t.draw) return false;
      return Object.keys(t.draw).some(function (ck) {
        var ms = (t.draw[ck] && t.draw[ck].matches) || {};
        return Object.keys(ms).some(function (k) {
          var m = ms[k]; if (!m || m.matchId !== r.matchId) return false;
          out.sport = out.sport || t.sport || ''; out.cat = t.draw[ck].catName || ''; out.round = out.round || m.roundName || '';
          out.datetime = out.datetime || m.datetime || ''; out.table = m.table || 0; out.tourn = t.name; return true;
        });
      });
    });
    return out;
  }
  function pageSport(s) { s = s || 'snooker'; return s === 'billiards' ? 'billiards' : s === 'shootout' ? 'shootout' : 'snooker'; }
  function candidates() {
    var busy = {}; Object.keys(MATCHES).forEach(function (k) { var m = MATCHES[k]; if (m && m.matchId) busy[m.matchId] = 1; });   // live or just finished on a table = not available
    var list = [], inDraw = {};
    function add(id, r, inf) {
      if (busy[id]) return;
      if (pageSport(inf.sport) !== PAGE) return;
      var tn = +(r.tableNumber || inf.table || 0);
      if (tn && String(tn) !== String(T)) return;                       // assigned to another table
      list.push({ id: id, r: r, inf: inf, mine: String(tn) === String(T) });
    }
    /* 1. every bracket: the next playable matches, worked out here, so the remote keeps going
          even when no staff page is open to move winners on */
    if (w.BK) Object.keys(TOUR).forEach(function (tid) {
      var t = TOUR[tid]; if (!t || !t.draw || t.status === 'finished') return;
      Object.keys(t.draw).forEach(function (ck) {
        var md; try { md = BK.model(t, ck, BK.ctx(MATCHES, REG, RES)); } catch (e) { return; }
        if (!md) return;
        md.all.forEach(function (v) {
          if (v.matchId) inDraw[v.matchId] = 1;
          if (v.status !== 'pending' || !v.matchId || !v.p1 || !v.p2 || !realName(v.p1.name) || !realName(v.p2.name)) return;
          var rg = REG[v.matchId] || {};
          var r = { matchId: v.matchId, tournament: t.name || '', bestOf: v.bo || rg.bestOf || 5, tableNumber: v.table || rg.tableNumber || 0,
            p1: v.p1.name, p1state: v.p1.state || '', p2: v.p2.name, p2state: v.p2.state || '', roundName: v.roundName || rg.roundName || '' };
          add(v.matchId, r, { sport: t.sport || '', round: r.roundName || v.group || '', cat: md.catName || '', datetime: v.datetime || rg.datetime || '', table: v.table || 0, tourn: t.name });
        });
      });
    });
    /* 2. scheduled matches that are not part of any bracket */
    Object.keys(REG).forEach(function (id) {
      var r = REG[id]; if (!r || r.status !== 'pending' || inDraw[id] || drawMatch(id)) return;
      if (!realName(r.p1) || !realName(r.p2)) return;
      add(id, r, info(r));
    });
    list.sort(function (a, b) { return (b.mine - a.mine) || String(a.inf.datetime || '9').localeCompare(String(b.inf.datetime || '9')) || String(a.id).localeCompare(String(b.id)); });
    return list;
  }

  /* ── when the match on this table ends, this phone saves the result itself (results/{matchId}),
        so the bracket moves on even if nobody has the Control Room open ── */
  var lastSaved = '';
  function saveResult() {
    var cur = MATCHES['table-' + T]; if (!cur || !cur.matchId || !cur.player1) return;
    var mid = cur.matchId, ex = RES[mid], db = firebase.database(), raw = w.UA && UA.raw;
    var put = function (name, ref, v) { return raw ? UA.raw(name, ref, v) : ref[name](v); };
    if (cur.status === 'finished' && cur.matchWinner) {
      var a = cur.player1 || {}, b = cur.player2 || {};
      var rec = { p1: a.name || '', p2: b.name || '', f1: a.frames || 0, f2: b.frames || 0, w: cur.matchWinner, table: 'table-' + T, tournament: cur.tournament || '', sport: cur.sport || PAGE, at: Date.now() };
      var sig = mid + rec.f1 + '-' + rec.f2 + rec.w;
      if (lastSaved === sig || (ex && ex.f1 === rec.f1 && ex.f2 === rec.f2 && ex.w === rec.w && ex.p1 === rec.p1)) return;
      lastSaved = sig;
      var p = put('set', db.ref('results/' + mid), rec); if (p && p.catch) p.catch(function () { lastSaved = ''; });
    } else if (cur.status !== 'finished' && ex && ex.table === 'table-' + T) {      // the referee pressed Undo after the match ended
      lastSaved = ''; var q = put('remove', db.ref('results/' + mid)); if (q && q.catch) q.catch(function () { });
    }
  }

  /* ── fill each remote's setup form ── */
  function setState(which, state) {
    if (PAGE === 'snooker') {
      var sel = g('setup-p' + which + '-state'), city = g('setup-p' + which + '-city');
      var has = sel && [].some.call(sel.options, function (o) { return low(o.value) === low(state); });
      if (has) { if (city && city.style.display !== 'none' && w.toggleLocType) toggleLocType(which, 'state'); [].forEach.call(sel.options, function (o) { if (low(o.value) === low(state)) sel.value = o.value; }); }
      else if (state && city) { if (city.style.display === 'none' && w.toggleLocType) toggleLocType(which, 'city'); city.value = state; }
    } else if (PAGE === 'billiards') { var b = g('s-s' + which); if (b) b.value = state || ''; }
    else { var s = g('su-p' + which + 's'); if (s) s.value = state || ''; }
  }
  function fill(c) {
    var r = c.r, bo = +r.bestOf || 5;
    if (PAGE === 'snooker') {
      g('setup-p1-name').value = r.p1; g('setup-p2-name').value = r.p2; setState(1, r.p1state); setState(2, r.p2state);
      var tn = g('setup-tourn'); if (tn) tn.value = r.tournament || c.inf.tourn || '';
      var btn = [].filter.call(d.querySelectorAll('.bo-btn'), function (b) { return parseInt(b.textContent, 10) === bo; })[0];
      if (btn) btn.click(); else { w.setupBO = bo; }
      if (w.suPreview) suPreview();
      var go = d.querySelector('[onclick*="startMatchFromRemote"]'); if (go) go.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (PAGE === 'billiards') {
      if (w.openSetup) openSetup(); if (w.selFmt) selFmt('frames');
      g('s-p1').value = r.p1; g('s-p2').value = r.p2; setState(1, r.p1state); setState(2, r.p2state);
      var sb = g('s-bo'); if (sb) { if (![].some.call(sb.options, function (o) { return +o.value === bo; })) { var o = d.createElement('option'); o.value = bo; o.textContent = 'Best of ' + bo; sb.appendChild(o); } sb.value = bo; }
    } else {
      g('su-p1').value = r.p1; g('su-p2').value = r.p2; setState(1, r.p1state); setState(2, r.p2state);
      var st = g('su-tourn'); if (st) st.value = r.tournament || c.inf.tourn || '';
      var chip = d.querySelector('#su-bo [data-v="' + bo + '"]'); if (chip) chip.click();
      if (w.renderPreview) try { renderPreview(); } catch (e) { }
    }
  }
  function use(c) {
    var cur = MATCHES['table-' + T];
    var go = function () {
      NM.pending = { matchId: c.id, tournament: c.r.tournament || c.inf.tourn || '' };
      fill(c); hide(); dismissed = c.id;
      toast('Filled in: ' + c.r.p1 + ' v ' + c.r.p2 + ' — choose who breaks and press Start');
    };
    if (cur && cur.player1 && cur.status === 'finished') {          // free the table first (only once its result is safe)
      NM.guard(function () { firebase.database().ref('matches/table-' + T).remove().then(function () { setTimeout(go, 500); }); });
    } else go();
  }

  /* ── the card ── */
  function hide() { var e = g('nm'); if (e) e.classList.remove('on', 'open'); }
  function render() {
    var el = g('nm'); if (!el) return;
    var cur = MATCHES['table-' + T], free = !cur || !cur.player1 || cur.status === 'finished';
    var setupOpen = PAGE !== 'billiards' || !cur || !cur.player1 || cur.status === 'finished';
    var list = candidates();
    if (!free || !list.length || !setupOpen || (w.UA && !UA.ready)) { hide(); return; }
    var c = list[0]; if (dismissed === c.id && !el.classList.contains('on')) return;
    var meta = [c.inf.cat, c.inf.round, 'Best of ' + (c.r.bestOf || 5), c.inf.datetime ? new Date(c.inf.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''].filter(Boolean).join(' · ');
    el.innerHTML = '<div class="h">' + (c.mine ? 'Next on Table ' + esc(T) : 'Ready to play') + '<button class="x" aria-label="Hide">×</button></div>' +
      '<div class="m"><div class="vs"><span>' + esc(c.r.p1) + '</span><i>v</i><span>' + esc(c.r.p2) + '</span></div>' +
      '<div class="st"><span>' + esc(c.r.p1state || '') + '</span><span>' + esc(c.r.p2state || '') + '</span></div>' +
      '<div class="meta">' + esc((c.r.tournament || c.inf.tourn || '') + (meta ? ' · ' + meta : '')) + '</div></div>' +
      (NM.saved(cur) ? '' : '<div class="meta" style="color:#ffc770;padding:0 14px 8px">⏳ Saving the last result to the bracket… (needs the Control Room open on any device)</div>') +
      '<div class="a"><button class="go">▶ ' + (cur && cur.status === 'finished' ? 'Start next match' : 'Use this match') + '</button>' + (list.length > 1 ? '<button class="more">' + (list.length - 1) + ' more ▾</button>' : '') + '</div>' +
      '<div class="list">' + list.slice(1, 25).map(function (x, i) { return '<div class="it" data-i="' + (i + 1) + '"><b>' + esc(x.r.p1) + ' v ' + esc(x.r.p2) + '<small>' + esc([x.inf.cat, x.inf.round, 'BO' + (x.r.bestOf || 5)].filter(Boolean).join(' · ')) + '</small></b>' + (x.mine ? '<em>THIS TABLE</em>' : '') + '</div>'; }).join('') + '</div>';
    el.classList.add('on');
    el.querySelector('.go').onclick = function () { use(c); };
    el.querySelector('.x').onclick = function () { dismissed = c.id; hide(); };
    var mo = el.querySelector('.more'); if (mo) mo.onclick = function () { el.classList.toggle('open'); };
    el.querySelectorAll('.it').forEach(function (it) { it.onclick = function () { use(list[+it.dataset.i]); }; });
  }

  /* ── player picker ── */
  function namesList() {
    var map = {};
    Object.keys(NAMES).forEach(function (k) { var p = NAMES[k]; if (p && p.n) map[low(p.n)] = { n: p.n, s: p.s || '' }; });
    Object.keys(TOUR).forEach(function (tid) { var dr = (TOUR[tid] && TOUR[tid].draw) || {}; Object.keys(dr).forEach(function (ck) { var c = dr[ck] || {};
      (c.groups || []).forEach(function (gp) { (gp.players || []).forEach(function (p) { if (p && realName(p.name) && !map[low(p.name)]) map[low(p.name)] = { n: p.name, s: p.state || '' }; }); });
      Object.keys(c.matches || {}).forEach(function (k) { var m = c.matches[k]; [m && m.p1, m && m.p2].forEach(function (p) { if (p && realName(p.name) && !map[low(p.name)]) map[low(p.name)] = { n: p.name, s: p.state || '' }; }); }); }); });
    return map;
  }
  function attachPicker() {
    var ids = PAGE === 'snooker' ? ['setup-p1-name', 'setup-p2-name'] : PAGE === 'billiards' ? ['s-p1', 's-p2'] : ['su-p1', 'su-p2'];
    var dl = g('nm-players'); if (!dl) { dl = d.createElement('datalist'); dl.id = 'nm-players'; d.body.appendChild(dl); }
    var map = namesList();
    dl.innerHTML = Object.keys(map).sort().map(function (k) { return '<option value="' + esc(map[k].n) + '">' + esc(map[k].s) + '</option>'; }).join('');
    ids.forEach(function (id, i) {
      var inp = g(id); if (!inp || inp._nm) return; inp._nm = 1;
      inp.setAttribute('list', 'nm-players'); inp.setAttribute('autocomplete', 'off');
      inp.addEventListener('change', function () { var p = namesList()[low(inp.value)]; if (p) { inp.value = p.n; if (p.s) setState(i + 1, p.s); if (w.suPreview) try { suPreview(); } catch (e) { } } });
    });
  }

  function start() {
    PAGE = g('setup-p1-name') ? 'snooker' : g('s-p1') ? 'billiards' : g('su-p1') ? 'shootout' : null;
    if (!PAGE || !firebase.apps.length) return;
    var st = d.createElement('style'); st.textContent = css; d.head.appendChild(st);
    me = d.createElement('div'); me.id = 'nm'; d.body.appendChild(me);
    var t = d.createElement('div'); t.id = 'nm-toast'; d.body.appendChild(t);
    var db = firebase.database();
    db.ref('match_registry').orderByChild('status').equalTo('pending').on('value', function (s) { REG = s.val() || {}; render(); });
    db.ref('tournaments').on('value', function (s) { TOUR = s.val() || {}; render(); attachPicker(); });
    db.ref('matches').on('value', function (s) { MATCHES = s.val() || {}; saveResult(); render(); });
    db.ref('results').on('value', function (s) { RES = s.val() || {}; if (w.BK) BK.results = RES; saveResult(); render(); }, function () { });
    db.ref('meta/playerNames').on('value', function (s) { NAMES = s.val() || {}; attachPicker(); });
    w.addEventListener('ua-ready', function () { setTimeout(render, 50); });   // show the card as soon as the PIN is accepted
    attachPicker();
    ['startNewOnSameTable', 'newMatch'].forEach(function (n) { var f = w[n]; if (typeof f === 'function') w[n] = function () { var a = arguments, self = this; NM.guard(function () { f.apply(self, a); }); }; });
    setInterval(function () { render(); attachPicker(); }, 4000);   // forms are drawn by the page; keep the picker on them
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(window, document);
