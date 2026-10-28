/* UPBSA.TV — bracket engine (shared by the public bracket, the stream overlay,
   the Tournament Manager, the manual draw page and the Control Room).
   Draws live in  tournaments/{tid}/draw/{catKey}  (Tournament Manager format):
     { format:'knockout'|'rr'|'hybrid', catName, groups:[{name,advance,players}], players,
       matches:{ key:{ id, matchId, stage:'ko'|'rr'|'part1'|'part2'|'part3', round, roundName,
                       group, groupIndex, p1:{name,state,tbd,bye}, p2, bo, table, datetime, result:{f1,f2,w} } } }
   Results come from (1) the table the match is on, (2) the result saved in the draw,
   (3) the match registry — so a result never disappears when a table is cleared.
   BK.model()  → everything a page needs to draw the event, with winners moved forward.
   BK.sync()   → (staff pages only) saves results and fills next-round players. */
(function (w) {
  'use strict';
  var BK = w.BK = {};

  function ck(n) { return (n || '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase(); }
  function idx(id) { var m = /_m(\d+)$/.exec(id || ''); return m ? +m[1] : 0; }
  function low(s) { return String(s || '').trim().toLowerCase(); }
  function isBye(p) { return !!(p && (p.bye || /^bye$/i.test(String(p.name || '').trim()))); }
  function isTbd(p) { return !p || p.tbd || !String(p.name || '').trim() || /^tbd$/i.test(String(p.name).trim()); }
  function real(p) { return p && !isTbd(p) && !isBye(p); }
  function P(name, state, extra) { var o = { name: name, state: state || '' }; for (var k in extra || {}) o[k] = extra[k]; return o; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  BK.ck = ck; BK.esc = esc; BK.isBye = isBye; BK.isTbd = isTbd;

  /* ── context: live tables + registry ── */
  BK.ctx = function (matchesByTable, registry) {
    var live = {};
    Object.keys(matchesByTable || {}).forEach(function (k) {
      var m = matchesByTable[k]; if (m && m.matchId && m.player1) { live[m.matchId] = m; m._table = m._table || parseInt(String(k).replace('table-', ''), 10) || m.tableNumber; }
    });
    return { live: live, reg: registry || {} };
  };

  /* ── one match: who won, or is it live ── */
  function resolve(m, p1, p2, ctx) {
    var out = { status: 'pending', f1: null, f2: null, w: 0, live: null };
    if (isBye(p1) || isBye(p2)) {
      if (isBye(p1) && isBye(p2)) { out.status = 'bye'; out.w = 1; out.byeBoth = true; return out; }
      if (isBye(p2) && real(p1)) { out.status = 'bye'; out.w = 1; return out; }
      if (isBye(p1) && real(p2)) { out.status = 'bye'; out.w = 2; return out; }
      return out;                                          // a BYE waiting for its opponent
    }
    var lm = m.matchId && ctx.live[m.matchId];
    function side(name) {                                 // which draw side a name belongs to (referee may have swapped)
      var n = low(name); if (!n) return 0;
      if (p1 && low(p1.name) === n) return 1; if (p2 && low(p2.name) === n) return 2; return 0;
    }
    if (lm) {
      var a = lm.player1 || {}, b = lm.player2 || {}, swap = side(a.name) === 2 || side(b.name) === 1;
      var f1 = swap ? (b.frames || 0) : (a.frames || 0), f2 = swap ? (a.frames || 0) : (b.frames || 0);
      if (lm.status === 'finished') {
        var mw = lm.matchWinner ? (swap ? 3 - lm.matchWinner : lm.matchWinner) : (f1 > f2 ? 1 : f2 > f1 ? 2 : 0);
        if (mw) { out.status = 'done'; out.f1 = f1; out.f2 = f2; out.w = mw; return out; }
      } else {
        out.status = 'live'; out.f1 = f1; out.f2 = f2;
        out.live = { pts1: swap ? b.score : a.score, pts2: swap ? a.score : b.score, turn: lm.turn ? (swap ? 3 - lm.turn : lm.turn) : 0,
          brk: lm.currentBreak || 0, frame: lm.currentFrame || 1, table: lm._table || lm.tableNumber || m.table || 0 };
        return out;
      }
    }
    if (m.result && m.result.w) { out.status = 'done'; out.f1 = m.result.f1; out.f2 = m.result.f2; out.w = m.result.w; return out; }
    var r = m.matchId && ctx.reg[m.matchId];
    if (r && r.status === 'finished' && (r.p1frames != null || r.winner)) {
      var g1 = +r.p1frames || 0, g2 = +r.p2frames || 0, ww = 0;
      if (r.winner) ww = side(r.winner);
      if (!ww) ww = g1 > g2 ? 1 : g2 > g1 ? 2 : 0;
      if (ww) { out.status = 'done'; out.f1 = g1; out.f2 = g2; out.w = ww; return out; }
    }
    return out;
  }

  /* ── standings for a group / round robin ── */
  function standings(players, vms) {
    var rows = {}, order = [];
    function row(p) { var k = low(p.name); if (!rows[k]) { rows[k] = { name: p.name, state: p.state || '', P: 0, W: 0, L: 0, FF: 0, FA: 0 }; order.push(k); } return rows[k]; }
    (players || []).forEach(function (p) { if (real(p)) row(p); });
    var complete = true;
    vms.forEach(function (v) {
      if (real(v.p1)) row(v.p1); if (real(v.p2)) row(v.p2);
      if (v.status !== 'done' && v.status !== 'bye') { complete = false; return; }
      if (v.status !== 'done' || !real(v.p1) || !real(v.p2)) return;
      var a = row(v.p1), b = row(v.p2);
      a.P++; b.P++; a.FF += +v.f1 || 0; a.FA += +v.f2 || 0; b.FF += +v.f2 || 0; b.FA += +v.f1 || 0;
      if (v.w === 1) { a.W++; b.L++; } else if (v.w === 2) { b.W++; a.L++; }
    });
    var list = order.map(function (k) { return rows[k]; });
    list.sort(function (x, y) { return (y.W - x.W) || ((y.FF - y.FA) - (x.FF - x.FA)) || (y.FF - x.FF) || x.name.localeCompare(y.name); });
    list.forEach(function (r, i) { r.pos = i + 1; r.FD = r.FF - r.FA; });
    if (!vms.length) complete = false;
    return { rows: list, complete: complete };
  }

  function roundName(left, size) { return left === 1 ? 'Final' : left === 2 ? 'Semi Final' : left === 3 ? 'Quarter Final' : 'Round of ' + size; }
  function seedOrder(n) { if (n <= 1) return [1]; var prev = seedOrder(n / 2), out = []; prev.forEach(function (s) { out.push(s, n + 1 - s); }); return out; }
  function catCfg(t, name) { var c = null; Object.keys((t && t.categories) || {}).forEach(function (k) { if (t.categories[k] && t.categories[k].name === name) c = t.categories[k]; }); return c || {}; }
  function boFor(cfg, left) { return left === 1 ? (cfg.bo_final || 9) : left === 2 ? (cfg.bo_sf || 9) : left === 3 ? (cfg.bo_rr || 7) : (cfg.bo_group || 5); }

  /* ── knockout tree (fills missing rounds, moves winners on) ── */
  function knockout(list, ctx, opts) {
    opts = opts || {};
    var byRound = {};
    list.forEach(function (m) { var r = +m.round || 1; (byRound[r] = byRound[r] || []).push(m); });
    var rks = Object.keys(byRound).map(Number).sort(function (a, b) { return a - b; });
    if (!rks.length && !opts.seeds) return { rounds: [], champion: null };
    var first = rks.length ? byRound[rks[0]].sort(function (a, b) { return idx(a.id || a.key) - idx(b.id || b.key); }) : [];
    var n0 = first.length || Math.max(1, Math.pow(2, Math.ceil(Math.log2(Math.max(2, (opts.seeds || []).length)))) / 2);
    var R = Math.max(1, Math.round(Math.log2(n0)) + 1), size = n0 * 2;
    var rounds = [];
    for (var r = 0; r < R; r++) {
      var stored = rks[r] !== undefined ? byRound[rks[r]].sort(function (a, b) { return idx(a.id || a.key) - idx(b.id || b.key); }) : [];
      var count = n0 / Math.pow(2, r), ms = [];
      for (var i = 0; i < count; i++) {
        var m = stored[i], virt = !m;
        if (virt) {
          var rn = rks[0] !== undefined ? rks[0] + r : r + 1;
          m = { id: (opts.prefix || 'ko_r') + rn + '_m' + i, virtual: true, stage: opts.stage || 'ko', round: rn, roundName: roundName(R - r, size / Math.pow(2, r)), p1: P('TBD', '', { tbd: true }), p2: P('TBD', '', { tbd: true }), bo: opts.bo ? opts.bo(R - r) : 0, table: 0 };
        }
        ms.push(m);
      }
      rounds.push({ name: (ms[0] && ms[0].roundName) || roundName(R - r, size / Math.pow(2, r)), left: R - r, list: ms });
    }
    var vRounds = [], champion = null;
    rounds.forEach(function (rd, ri) {
      var vms = rd.list.map(function (m, i) {
        var p1 = m.p1, p2 = m.p2;
        if (ri === 0 && opts.seeds) {                        // first knockout round seeded from an earlier stage
          var order = seedOrder(size), s1 = order[i * 2] - 1, s2 = order[i * 2 + 1] - 1;
          if (isTbd(p1)) p1 = opts.seeds[s1] || P('BYE', '', { bye: true });
          if (isTbd(p2)) p2 = opts.seeds[s2] || P('BYE', '', { bye: true });
        }
        if (ri > 0) {
          var prev = vRounds[ri - 1], fa = prev[i * 2], fb = prev[i * 2 + 1];
          var wa = fa && fa.winner, wb = fb && fb.winner;
          if (wa) p1 = wa; else if (isTbd(p1)) p1 = P('TBD', '', { tbd: true, from: fa ? 'Winner ' + fa.label : '' });
          if (wb) p2 = wb; else if (isTbd(p2)) p2 = P('TBD', '', { tbd: true, from: fb ? 'Winner ' + fb.label : '' });
        }
        var res = resolve(m, p1, p2, ctx);
        var v = { key: m.key || m.id, id: m.id, virtual: !!m.virtual, stage: m.stage || opts.stage || 'ko', matchId: m.matchId || '', round: m.round, roundName: rd.name,
          p1: p1, p2: p2, status: res.status, f1: res.f1, f2: res.f2, w: res.w, live: res.live, bo: m.bo || 0, table: (res.live && res.live.table) || m.table || 0,
          datetime: m.datetime || '', label: rd.name.replace('Round of ', 'R') + (rd.list.length > 1 ? ' ' + (i + 1) : ''), stored: m };
        v.winner = res.w === 1 ? (res.byeBoth ? P('BYE', '', { bye: true }) : p1) : res.w === 2 ? p2 : null;
        return v;
      });
      vRounds.push(vms);
    });
    var fin = vRounds[vRounds.length - 1];
    if (fin && fin.length === 1 && fin[0].winner && real(fin[0].winner)) champion = fin[0].winner;
    return { rounds: rounds.map(function (rd, i) { return { name: rd.name, left: rd.left, matches: vRounds[i] }; }), champion: champion };
  }

  function flatVm(m, ctx) {
    var res = resolve(m, m.p1, m.p2, ctx);
    var v = { key: m.key || m.id, id: m.id, stage: m.stage, matchId: m.matchId || '', round: m.round, roundName: m.roundName || '', group: m.group, groupIndex: m.groupIndex,
      p1: m.p1, p2: m.p2, status: res.status, f1: res.f1, f2: res.f2, w: res.w, live: res.live, bo: m.bo || 0, table: (res.live && res.live.table) || m.table || 0, datetime: m.datetime || '', stored: m };
    v.winner = res.w === 1 ? m.p1 : res.w === 2 ? m.p2 : null;
    return v;
  }

  /* ── the whole category ── */
  BK.model = function (t, catKey, ctx) {
    var draw = t && t.draw && t.draw[catKey];
    if (!draw || draw.empty) return null;
    ctx = ctx || { live: {}, reg: {} };
    var cfg = catCfg(t, draw.catName), all = [];
    Object.keys(draw.matches || {}).forEach(function (k) { var m = draw.matches[k]; if (m) { m.key = k; m.id = m.id || k; all.push(m); } });
    var bo = function (left) { return boFor(cfg, left); };
    var out = { format: draw.format, catName: draw.catName || catKey, catKey: catKey, manual: !!draw.manual, stages: [], champion: null, all: [] };
    if (draw.format === 'knockout') {
      var ko = knockout(all, ctx, { stage: 'ko', prefix: 'ko_r', bo: bo });
      out.stages.push({ kind: 'ko', title: 'Knockout', rounds: ko.rounds }); out.champion = ko.champion;
    } else if (draw.format === 'rr') {
      var vms = all.map(function (m) { return flatVm(m, ctx); }).sort(function (a, b) { return idx(a.id) - idx(b.id); });
      var st = standings(draw.players || [], vms);
      out.stages.push({ kind: 'table', title: 'Round Robin', rows: st.rows, complete: st.complete, matches: vms, advance: 1 });
      if (st.complete && st.rows[0]) out.champion = st.rows[0];
    } else {
      // hybrid: groups → (round robin) → knockout
      var groups = draw.groups || [], adv = (groups[0] && groups[0].advance) || cfg.advance || 2;
      var p1m = all.filter(function (m) { return m.stage === 'part1'; });
      var gOut = groups.map(function (g, gi) {
        var gm = p1m.filter(function (m) { return (m.groupIndex != null ? +m.groupIndex : -1) === gi || m.group === g.name; })
          .map(function (m) { return flatVm(m, ctx); }).sort(function (a, b) { return idx(a.id) - idx(b.id); });
        var st = standings(g.players || [], gm);
        return { name: g.name, advance: g.advance || adv, rows: st.rows, complete: st.complete, matches: gm };
      });
      if (gOut.length) out.stages.push({ kind: 'groups', title: 'Group Stage', groups: gOut });
      function place(gi, pi) { var g = gOut[gi]; return g && g.complete && g.rows[pi] ? P(g.rows[pi].name, g.rows[pi].state) : P((g ? g.name.replace('Group ', 'G') : 'G' + (gi + 1)) + ' #' + (pi + 1), '', { tbd: true }); }
      var p2m = all.filter(function (m) { return m.stage === 'part2'; }).sort(function (a, b) { return idx(a.id) - idx(b.id); });
      var seeds;
      if (p2m.length) {
        var koN = gOut.length * adv, pairs = [];
        for (var a = 0; a < koN; a++) for (var b = a + 1; b < koN; b++) pairs.push([a, b]);
        var rvms = p2m.map(function (m, k) {
          var pr = pairs[k] || [0, 1], c = {}; for (var x in m) c[x] = m[x];
          if (isTbd(c.p1) || /^winner g/i.test(c.p1 && c.p1.name || '')) c.p1 = place(Math.floor(pr[0] / adv), pr[0] % adv);
          if (isTbd(c.p2) || /^winner g/i.test(c.p2 && c.p2.name || '')) c.p2 = place(Math.floor(pr[1] / adv), pr[1] % adv);
          return flatVm(c, ctx);
        });
        var rst = standings([], rvms);
        out.stages.push({ kind: 'table', title: 'Round Robin', rows: rst.rows, complete: rst.complete, matches: rvms, advance: koN });
        seeds = []; for (var s = 0; s < koN; s++) seeds.push(rst.complete && rst.rows[s] ? P(rst.rows[s].name, rst.rows[s].state) : P('RR #' + (s + 1), '', { tbd: true }));
      } else {
        seeds = []; for (var pi = 0; pi < adv; pi++) for (var gi = 0; gi < gOut.length; gi++) seeds.push(place(gi, pi));
      }
      var p3m = all.filter(function (m) { return m.stage === 'part3'; });
      if (p3m.length || seeds.length > 1) {
        var ko3 = knockout(p3m, ctx, { stage: 'part3', prefix: 'p3_r', seeds: seeds, bo: bo });
        out.stages.push({ kind: 'ko', title: 'Knockout', rounds: ko3.rounds }); out.champion = ko3.champion;
      }
    }
    out.stages.forEach(function (st) {
      if (st.kind === 'ko') st.rounds.forEach(function (r) { out.all = out.all.concat(r.matches); });
      else if (st.kind === 'groups') st.groups.forEach(function (g) { out.all = out.all.concat(g.matches); });
      else out.all = out.all.concat(st.matches);
    });
    return out;
  };

  /* ── staff pages: save results + fill next-round players (idempotent) ── */
  var syncing = false;
  BK.sync = function (db, tournaments, ctx) {
    if (syncing) return Promise.resolve(0); syncing = true;
    var up = {}, creates = [], now = Date.now();
    Object.keys(tournaments || {}).forEach(function (tid) {
      var t = tournaments[tid]; if (!t || !t.draw) return;
      Object.keys(t.draw).forEach(function (ck2) {
        var md; try { md = BK.model(t, ck2, ctx); } catch (e) { return; }
        if (!md) return;
        var base = 'tournaments/' + tid + '/draw/' + ck2;
        md.all.forEach(function (v) {
          var m = v.stored || {};
          if (v.virtual) { if (real(v.p1) || real(v.p2)) creates.push({ base: base, v: v, t: t }); return; }
          var path = base + '/matches/' + v.key;
          if ((v.status === 'done') && (!m.result || m.result.w !== v.w || m.result.f1 !== v.f1 || m.result.f2 !== v.f2)) {
            up[path + '/result'] = { f1: v.f1, f2: v.f2, w: v.w, at: now }; up[path + '/status'] = 'done';
          }
          var rg = v.matchId && ctx.reg[v.matchId];
          if (rg && v.status === 'live' && rg.status === 'pending') { up['match_registry/' + v.matchId + '/status'] = 'active'; if (v.table) up['match_registry/' + v.matchId + '/tableNumber'] = v.table; up['match_registry/' + v.matchId + '/startTime'] = now; }
          if (rg && (v.status === 'done' || v.status === 'bye') && rg.status !== 'finished' && rg.status !== 'walkover' && v.winner) {
            var rp = 'match_registry/' + v.matchId + '/';
            up[rp + 'status'] = v.status === 'bye' ? 'walkover' : 'finished'; up[rp + 'winner'] = v.winner.name;
            if (v.status === 'done') { up[rp + 'p1frames'] = v.f1; up[rp + 'p2frames'] = v.f2; if (!rg.endTime) up[rp + 'endTime'] = now; }
          }
          ['p1', 'p2'].forEach(function (s) {
            var p = v[s], cur = m[s];
            if (real(p) || isBye(p)) {
              if (!cur || low(cur.name) !== low(p.name)) {
                up[path + '/' + s] = { name: p.name, state: p.state || '' }; if (isBye(p)) up[path + '/' + s].bye = true;
                var r = v.matchId && ctx.reg[v.matchId];
                if (r && r.status !== 'finished' && !isBye(p)) { up['match_registry/' + v.matchId + '/' + s] = p.name; up['match_registry/' + v.matchId + '/' + s + 'state'] = p.state || ''; }
              }
            }
          });
        });
        if (md.champion && low(t.draw[ck2].champion && t.draw[ck2].champion.name) !== low(md.champion.name)) up[base + '/champion'] = { name: md.champion.name, state: md.champion.state || '', at: now };
      });
    });
    var work = Object.keys(up).length ? db.ref().update(up) : Promise.resolve();
    return work.then(function () {
      if (!creates.length) return 0;
      // new knockout rounds: give each a match ID and a registry entry
      return new Promise(function (res) {
        db.ref('meta/matchCounter').transaction(function (c) { return (c || 0) + creates.length; }, function (err, ok, snap) {
          if (err || !ok) return res(0);
          var end = snap.val(), start = end - creates.length + 1, jobs = [];
          creates.forEach(function (c, i) {
            var v = c.v, mid = 'UPBSA-' + String(start + i).padStart(4, '0');
            var obj = { id: v.id, matchId: mid, stage: v.stage, round: v.round, roundName: v.roundName, p1: { name: v.p1.name, state: v.p1.state || '' }, p2: { name: v.p2.name, state: v.p2.state || '' },
              status: 'pending', table: 0, bo: v.bo || 5 };
            if (isTbd(v.p1)) obj.p1.tbd = true; if (isTbd(v.p2)) obj.p2.tbd = true;
            jobs.push(new Promise(function (r2) {
              db.ref(c.base + '/matches/' + v.id).transaction(function (cur) { return cur ? undefined : obj; }, function (e, committed) {
                if (!committed) return r2();
                db.ref('match_registry/' + mid).set({ matchId: mid, tournament: c.t.name || '', bestOf: obj.bo, tableNumber: 0, status: 'pending',
                  p1: isTbd(v.p1) ? 'TBD' : v.p1.name, p1state: v.p1.state || '', p2: isTbd(v.p2) ? 'TBD' : v.p2.name, p2state: v.p2.state || '',
                  stage: v.stage, roundName: v.roundName, createdAt: Date.now() }).then(r2, r2);
              });
            }));
          });
          Promise.all(jobs).then(function () { res(creates.length); });
        });
      });
    }).then(function (n) { syncing = false; return n; }, function () { syncing = false; return 0; });
  };

  /* watch everything and keep draws up to date (call on staff pages) */
  BK.autoSync = function (db, onDone) {
    var T = {}, M = {}, R = {}, seen = { t: 0, m: 0, r: 0 }, timer = null;
    function kick() { if (!seen.t || !seen.m || !seen.r) return; clearTimeout(timer); timer = setTimeout(function () { BK.sync(db, T, BK.ctx(M, R)).then(function (n) { if (onDone) onDone(n); }); }, 1200); }
    db.ref('tournaments').on('value', function (s) { T = s.val() || {}; seen.t = 1; kick(); });
    db.ref('matches').on('value', function (s) { M = s.val() || {}; seen.m = 1; kick(); });
    db.ref('match_registry').on('value', function (s) { R = s.val() || {}; seen.r = 1; kick(); });
  };

  /* ════════════ DRAWING ════════════ */
  BK.css = function () {
    return '.bk-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:6px 2px 14px;}' +
      '.bk-tree{position:relative;}' +
      '.bk-rh{position:absolute;top:0;height:26px;display:flex;align-items:center;justify-content:center;font:800 12px "Barlow Condensed",sans-serif;letter-spacing:3px;text-transform:uppercase;color:var(--bk-dim,rgba(232,244,224,.55));border-bottom:1px solid var(--bk-line,rgba(255,255,255,.08));}' +
      '.bk-rh.fin{color:var(--bk-gold,#f0c040);}' +
      '.bk-svg{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;}' +
      '.bk-svg path{fill:none;stroke:var(--bk-wire,rgba(255,255,255,.16));stroke-width:2;}' +
      '.bk-svg path.won{stroke:var(--bk-gold,#f0c040);stroke-opacity:.7;}' +
      '.bk-m{position:absolute;border-radius:10px;background:var(--bk-card,#0d1b12);border:1px solid var(--bk-line2,rgba(255,255,255,.1));overflow:hidden;display:flex;flex-direction:column;}' +
      '.bk-m.live{border-color:rgba(46,204,113,.75);box-shadow:0 0 0 1px rgba(46,204,113,.35),0 0 22px rgba(46,204,113,.18);animation:bkPulse 1.8s ease-in-out infinite;}' +
      '@keyframes bkPulse{50%{box-shadow:0 0 0 1px rgba(46,204,113,.15),0 0 6px rgba(46,204,113,.05);}}' +
      '.bk-meta{display:flex;align-items:center;gap:6px;height:18px;padding:0 9px;font:800 10.5px "Barlow Condensed",sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:var(--bk-dim,rgba(232,244,224,.5));background:rgba(0,0,0,.25);}' +
      '.bk-meta .lv{color:#59e08a;}.bk-meta .lv:before{content:"● ";}.bk-meta .sp{flex:1;}' +
      '.bk-p{flex:1;display:flex;align-items:center;gap:8px;padding:0 9px;min-height:0;border-top:1px solid rgba(255,255,255,.05);}' +
      '.bk-p .n{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:800 15px "Barlow Condensed",sans-serif;letter-spacing:.3px;color:var(--bk-text,#e8f4e0);}' +
      '.bk-p .n small{font:600 10.5px "Barlow Condensed",sans-serif;letter-spacing:1px;color:var(--bk-dim,rgba(232,244,224,.45));margin-left:6px;text-transform:uppercase;}' +
      '.bk-p .s{font:400 22px/1 "Bebas Neue",sans-serif;min-width:20px;text-align:right;color:var(--bk-text,#e8f4e0);}' +
      '.bk-p.w{background:linear-gradient(90deg,rgba(240,192,64,.16),rgba(240,192,64,.03));}.bk-p.w .n,.bk-p.w .s{color:var(--bk-gold,#f0c040);}' +
      '.bk-p.l .n,.bk-p.l .s{opacity:.45;}.bk-p.t .n{color:var(--bk-dim,rgba(232,244,224,.4));font-weight:600;font-style:italic;}' +
      '.bk-p.b .n{color:var(--bk-dim,rgba(232,244,224,.3));letter-spacing:3px;}' +
      '.bk-p .at{width:7px;height:7px;border-radius:50%;background:#f0c040;box-shadow:0 0 8px #f0c040;flex:none;}' +
      '.bk-p.hl{background:rgba(95,184,255,.16)!important;}.bk-p.hl .n{color:#9fd3ff!important;opacity:1!important;}' +
      '.bk-champ{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-radius:12px;border:1px solid rgba(240,192,64,.6);background:linear-gradient(180deg,rgba(240,192,64,.22),rgba(240,192,64,.05));}' +
      '.bk-champ b{font:400 26px/1 "Bebas Neue",sans-serif;color:var(--bk-gold,#f0c040);letter-spacing:1px;}.bk-champ span{font:800 11px "Barlow Condensed",sans-serif;letter-spacing:3px;color:var(--bk-dim,rgba(232,244,224,.6));}';
  };
  function pRow(v, s) {
    var p = v[s], cls = isBye(p) ? 'b' : isTbd(p) ? 't' : v.w === (s === 'p1' ? 1 : 2) ? 'w' : v.w ? 'l' : '';
    var sc = (v.status === 'done' || v.status === 'live') ? (s === 'p1' ? v.f1 : v.f2) : '';
    var at = v.live && v.live.turn === (s === 'p1' ? 1 : 2);
    var name = isBye(p) ? 'BYE' : isTbd(p) ? (p && p.from ? p.from : (p && p.name && !/^tbd$/i.test(p.name) ? p.name : 'TBD')) : p.name;
    return '<div class="bk-p ' + cls + '" data-p="' + esc(real(p) ? low(p.name) : '') + '">' + (at ? '<span class="at"></span>' : '') + '<div class="n">' + esc(name) + (real(p) && p.state ? '<small>' + esc(p.state) + '</small>' : '') + '</div><div class="s">' + (sc == null ? '' : esc(sc)) + '</div></div>';
  }
  function metaLine(v) {
    var a = [];
    if (v.status === 'live') a.push('<span class="lv">Live' + (v.table ? ' · T' + v.table : '') + '</span>');
    else if (v.status === 'done') a.push('<span>Final</span>');
    else if (v.status === 'bye') a.push('<span>Walkover</span>');
    else if (v.table) a.push('<span>Table ' + v.table + '</span>');
    if (v.datetime && v.status === 'pending') { var d = new Date(v.datetime); if (!isNaN(d)) a.push('<span>' + d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span>'); }
    var yu = BK.watchUrl ? BK.watchUrl(v) : '';
    if (yu) a.push('<a class="bk-yt" href="' + esc(yu) + '" target="_blank" rel="noopener" title="Watch this match live on YouTube">▶ Livestream</a>');
    a.push('<span class="sp"></span>'); if (v.bo) a.push('<span>BO' + v.bo + '</span>');
    return '<div class="bk-meta">' + a.join('') + '</div>';
  }
  BK.matchBox = function (v, style) {
    return '<div class="bk-m' + (v.status === 'live' ? ' live' : '') + '" data-mid="' + esc(v.matchId) + '" style="' + (style || '') + '">' + metaLine(v) + pRow(v, 'p1') + pRow(v, 'p2') + '</div>';
  };
  /* knockout tree with connector lines. opts: {mw, mh, gap, vgap, champion} */
  BK.renderKO = function (stage, opts) {
    opts = opts || {};
    var rounds = stage.rounds || []; if (!rounds.length) return '<div class="bk-empty">No knockout matches yet.</div>';
    var MW = opts.mw || 230, MH = opts.mh || 74, GAP = opts.gap || 46, VG = opts.vgap || 14, HEAD = 34;
    var n0 = rounds[0].matches.length, H = n0 * (MH + VG), champW = opts.champion ? Math.min(MW, 200) : 0;
    var W = rounds.length * MW + (rounds.length - 1) * GAP + (champW ? GAP + champW : 0);
    var html = '', paths = '';
    rounds.forEach(function (rd, ri) {
      var x = ri * (MW + GAP), n = rd.matches.length, step = H / n;
      html += '<div class="bk-rh' + (rd.left === 1 ? ' fin' : '') + '" style="left:' + x + 'px;width:' + MW + 'px">' + esc(rd.name) + '</div>';
      rd.matches.forEach(function (v, i) {
        var cy = HEAD + (i + 0.5) * step, y = cy - MH / 2;
        html += BK.matchBox(v, 'left:' + x + 'px;top:' + y + 'px;width:' + MW + 'px;height:' + MH + 'px;');
        if (ri < rounds.length - 1) {
          var nx = (ri + 1) * (MW + GAP), ncy = HEAD + (Math.floor(i / 2) + 0.5) * (H / (n / 2)), mx = x + MW + GAP / 2;
          paths += '<path class="' + (v.winner && real(v.winner) ? 'won' : '') + '" d="M' + (x + MW) + ' ' + cy + ' H' + mx + ' V' + ncy + ' H' + nx + '"/>';
        }
      });
    });
    if (champW) {
      var fx = (rounds.length - 1) * (MW + GAP), cx = fx + MW + GAP, cyc = HEAD + H / 2, ch = opts.champion;
      paths += '<path class="won" d="M' + (fx + MW) + ' ' + cyc + ' H' + cx + '"/>';
      html += '<div class="bk-champ" style="left:' + cx + 'px;top:' + (cyc - 40) + 'px;width:' + champW + 'px;height:80px"><span>🏆 CHAMPION</span><b>' + esc(ch.name) + '</b></div>';
    }
    return '<div class="bk-wrap"><div class="bk-tree" style="width:' + W + 'px;height:' + (H + HEAD) + 'px"><svg class="bk-svg" width="' + W + '" height="' + (H + HEAD) + '">' + paths + '</svg>' + html + '</div></div>';
  };
  BK.fmtTime = function (dt) { var d = new Date(dt); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
})(window);
