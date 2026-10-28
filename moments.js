/* UPBSA.TV — automatic stream moments (runs inside the OBS overlays)
   • Match starts    → intro card: event, round, both players, best of
   • Frame ends      → frame card: who won it, the points, match score, best breaks
   • Match finishes  → after the winner flash: who they play next in the bracket (or champion)
   All triggered by the referee's taps. Switch each one on/off in the Control Room
   (settings/moments). Add ?moments=0 to an overlay URL to turn them off for that source. */
(function (w, d) {
  'use strict';
  var Q = new URLSearchParams(location.search);
  if (Q.get('moments') === '0' || !w.firebase) return;
  var T = Q.get('table') || '1', SO = /shootout-overlay/.test(location.pathname);
  var CFG = { intro: true, frame: true, after: true }, TOUR = {}, REG = {}, MATCHES = {}, prev = null, loadedAt = Date.now(), queue = [], showing = false;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function once(key) { try { if (sessionStorage.getItem('mo_' + key)) return false; sessionStorage.setItem('mo_' + key, '1'); } catch (e) { } return true; }
  var css = '#mo{position:fixed;left:50%;bottom:250px;transform:translate(-50%,40px);opacity:0;width:1180px;z-index:60;pointer-events:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.9,.3,1.1);font-family:"Barlow Condensed","Bebas Neue",sans-serif;color:#fff;}' +
    '#mo.on{opacity:1;transform:translate(-50%,0);}' +
    '#mo .c{border-radius:22px;background:linear-gradient(180deg,rgba(14,32,20,.97),rgba(5,12,8,.97));border:2px solid rgba(240,192,64,.75);box-shadow:0 24px 70px rgba(0,0,0,.6);overflow:hidden;}' +
    '#mo .tp{display:flex;align-items:center;gap:14px;padding:16px 30px;background:linear-gradient(90deg,rgba(240,192,64,.22),rgba(240,192,64,.04));font:900 24px "Barlow Condensed",sans-serif;letter-spacing:6px;text-transform:uppercase;color:#f0c040;}' +
    '#mo .tp span{flex:1;}#mo .tp b{font-weight:800;color:rgba(255,255,255,.75);letter-spacing:3px;font-size:20px;}' +
    '#mo .vs{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:30px;padding:26px 36px 22px;}' +
    '#mo .p{min-width:0;}#mo .p.r{text-align:right;}' +
    '#mo .n{font:900 54px/1 "Barlow Condensed",sans-serif;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '#mo .s{font:800 22px "Barlow Condensed",sans-serif;letter-spacing:4px;text-transform:uppercase;color:rgba(232,244,224,.6);margin-top:6px;}' +
    '#mo .mid{text-align:center;font:400 80px/1 "Bebas Neue",sans-serif;color:#f0c040;letter-spacing:2px;}' +
    '#mo .mid small{display:block;font:800 18px "Barlow Condensed",sans-serif;letter-spacing:4px;color:rgba(232,244,224,.6);margin-top:4px;}' +
    '#mo .ft{display:flex;justify-content:center;gap:40px;padding:0 30px 22px;font:800 22px "Barlow Condensed",sans-serif;letter-spacing:2px;text-transform:uppercase;color:rgba(232,244,224,.75);}' +
    '#mo .ft b{color:#fff;}#mo .w .n{color:#f0c040;}#mo .l{opacity:.6;}' +
    '#mo .big{padding:26px 36px 10px;text-align:center;font:900 58px/1.05 "Barlow Condensed",sans-serif;text-transform:uppercase;}' +
    '#mo .big em{font-style:normal;color:#f0c040;}' +
    '#mo .sub{text-align:center;padding:0 30px 26px;font:800 26px "Barlow Condensed",sans-serif;letter-spacing:2px;text-transform:uppercase;color:rgba(232,244,224,.7);}';
  var st = d.createElement('style'); st.textContent = css; (d.head || d.documentElement).appendChild(st);
  var el = null;

  function show(html, ms) { queue.push([html, ms]); if (!showing) next(); }
  function next() {
    var it = queue.shift(); if (!it) { showing = false; return; }
    showing = true; el.innerHTML = '<div class="c">' + it[0] + '</div>';
    requestAnimationFrame(function () { el.classList.add('on'); });
    setTimeout(function () { el.classList.remove('on'); setTimeout(next, 700); }, it[1]);
  }
  function where(mid) {
    var hit = null; if (!mid || !w.BK) return null;
    Object.keys(TOUR).some(function (tid) { var dr = (TOUR[tid] && TOUR[tid].draw) || {}; return Object.keys(dr).some(function (ck) { var ms = (dr[ck] && dr[ck].matches) || {}; return Object.keys(ms).some(function (k) { if (ms[k] && ms[k].matchId === mid) { hit = { t: TOUR[tid], ck: ck }; return true; } }); }); });
    if (!hit) return null;
    var md = BK.model(hit.t, hit.ck, BK.ctx(MATCHES, REG)); if (!md) return null;
    var v = md.all.filter(function (x) { return x.matchId === mid; })[0];
    return v ? { t: hit.t, md: md, v: v } : null;
  }
  function names(m) { return [(m.player1 || {}).name || 'Player 1', (m.player2 || {}).name || 'Player 2']; }

  /* ── the three moments ── */
  function intro(m) {
    var w2 = where(m.matchId), n = names(m), top = [m.tournament || (w2 && w2.t.name) || '', w2 ? w2.md.catName : ''].filter(Boolean).join(' · ');
    show('<div class="tp"><span>' + esc(top || 'Next match') + '</span><b>' + esc(w2 && w2.v.roundName ? w2.v.roundName : 'Table ' + T) + '</b></div>' +
      '<div class="vs"><div class="p"><div class="n">' + esc(n[0]) + '</div><div class="s">' + esc((m.player1 || {}).state || '') + '</div></div>' +
      '<div class="mid">VS<small>BEST OF ' + esc(m.bestOf || '') + '</small></div>' +
      '<div class="p r"><div class="n">' + esc(n[1]) + '</div><div class="s">' + esc((m.player2 || {}).state || '') + '</div></div></div>', 8000);
  }
  function frameEnd(p, m) {
    var a = m.player1 || {}, b = m.player2 || {}, pa = p.player1 || {}, pb = p.player2 || {};
    var won = (a.frames || 0) > (pa.frames || 0) ? 1 : 2, n = names(m), fno = (pa.frames || 0) + (pb.frames || 0) + 1;
    var s1 = pa.score || 0, s2 = pb.score || 0, need = Math.ceil((m.bestOf || 1) / 2);
    var lead = a.frames === b.frames ? 'All square' : (a.frames > b.frames ? n[0] : n[1]).split(' ').slice(-1)[0] + ' leads';
    var bb1 = m.bestBreak1 || p.bestBreak1 || 0, bb2 = m.bestBreak2 || p.bestBreak2 || 0;
    show('<div class="tp"><span>Frame ' + fno + ' to ' + esc(n[won - 1]) + '</span><b>' + esc(lead) + (m.status !== 'finished' ? ' · first to ' + need : '') + '</b></div>' +
      '<div class="vs"><div class="p' + (won === 1 ? ' w' : ' l') + '"><div class="n">' + esc(n[0]) + '</div><div class="s">' + s1 + ' points' + (bb1 ? ' · best break ' + bb1 : '') + '</div></div>' +
      '<div class="mid">' + esc(a.frames || 0) + ' – ' + esc(b.frames || 0) + '<small>FRAMES</small></div>' +
      '<div class="p r' + (won === 2 ? ' w' : ' l') + '"><div class="n">' + esc(n[1]) + '</div><div class="s">' + s2 + ' points' + (bb2 ? ' · best break ' + bb2 : '') + '</div></div></div>', 7000);
  }
  function afterMatch(m) {
    var wn = m.matchWinner ? (m['player' + m.matchWinner] || {}).name : null; if (!wn) return;
    var a = m.player1 || {}, b = m.player2 || {}, w2 = where(m.matchId), line = '', sub = '';
    if (w2 && (w2.v.stage === 'ko' || w2.v.stage === 'part3')) {
      var ko = w2.md.stages[w2.md.stages.length - 1], ri = -1, mi = -1;
      ko.rounds.forEach(function (r, i) { var j = r.matches.indexOf(w2.v); if (j >= 0) { ri = i; mi = j; } });
      if (ri === ko.rounds.length - 1) { line = '<em>' + esc(wn) + '</em> is the champion'; sub = (w2.md.catName || '') + ' · ' + (w2.t.name || ''); }
      else if (ri >= 0) { var nx = ko.rounds[ri + 1].matches[Math.floor(mi / 2)], other = mi % 2 ? nx.p1 : nx.p2;
        line = '<em>' + esc(wn) + '</em> goes through to the ' + esc(ko.rounds[ri + 1].name);
        sub = BK.isTbd(other) ? 'Next: ' + (other.from ? other.from.replace(/^Winner /, 'winner of ') : 'opponent to be decided') : 'Next: v ' + other.name; }
    } else if (w2) { line = '<em>' + esc(wn) + '</em> wins'; sub = (w2.v.group || w2.v.roundName || '') + ' · ' + (w2.md.catName || ''); }
    else { line = '<em>' + esc(wn) + '</em> wins the match'; sub = m.tournament || ''; }
    show('<div class="tp"><span>Result</span><b>' + esc(a.name || '') + ' ' + esc(a.frames || 0) + ' – ' + esc(b.frames || 0) + ' ' + esc(b.name || '') + '</b></div>' +
      '<div class="big">' + line + '</div><div class="sub">' + esc(sub) + '</div>', 11000);
  }

  function onMatch(m) {
    var p = prev; prev = m ? JSON.parse(JSON.stringify(m)) : null;
    if (!m || !m.player1) return;
    var mid = m.matchId || 'x', b = m.player2 || {};
    var fresh = m.status === 'active' && !(m.player1.frames || b.frames) && (m.currentFrame || 1) === 1 && !(m.player1.score || b.score);
    if (!p || p.matchId !== m.matchId) { if (fresh && !SO && CFG.intro && once(mid + '_intro')) intro(m); return; }
    var f0 = (p.player1.frames || 0) + ((p.player2 || {}).frames || 0), f1 = (m.player1.frames || 0) + (b.frames || 0);
    if (f1 === f0 + 1 && CFG.frame && m.status !== 'finished' && once(mid + '_f' + f1)) frameEnd(p, m);
    if (p.status !== 'finished' && m.status === 'finished' && CFG.after && once(mid + '_after')) setTimeout(function () { afterMatch(m); }, 6500);
  }

  function start() {
    if (!firebase.apps.length) return;
    el = d.createElement('div'); el.id = 'mo'; d.body.appendChild(el);
    var db = firebase.database();
    db.ref('settings/moments').on('value', function (s) { var v = s.val() || {}; CFG = { intro: v.intro !== false, frame: v.frame !== false, after: v.after !== false }; });
    db.ref('tournaments').on('value', function (s) { TOUR = s.val() || {}; });
    db.ref('match_registry').on('value', function (s) { REG = s.val() || {}; });
    db.ref('matches').on('value', function (s) { MATCHES = s.val() || {}; });
    db.ref('matches/table-' + T).on('value', function (s) { onMatch(s.val()); });
    w.UPBSA_moment = { intro: function () { if (prev) intro(prev); }, frame: function () { if (prev) frameEnd(prev, prev); }, after: function () { if (prev) afterMatch(prev); } };   // for testing from OBS's "Interact"
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(window, document);
