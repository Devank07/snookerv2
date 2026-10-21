/* ═══════════════════════════════════════════════════════════════
   UPBSA.TV — LIVE CLOCK ELEMENTS for builder designs
   Shared by builder.html (preview) and overlay.html (on stream), so
   what you design is exactly what OBS shows.

   Works for Shoot Out matches (match / frame / shot clocks from
   shootout-core.js) and for normal snooker (shot clock + elapsed
   frame / match time).
   ═══════════════════════════════════════════════════════════════ */
(function (w) {
  var TYPES = {
    'shot-clock': 1, 'shot-bar': 1, 'shot-flash': 1,
    'match-clock': 1, 'frame-clock': 1, 'match-bar': 1, 'frame-bar': 1, 'ext-dots': 1, 'sponsor': 1, 'smart-text': 1
  };
  /* elements whose text can be shrunk to fit their box */
  var TEXT_TYPES = { 'player-name': 1, 'state': 1, 'tournament': 1, 'referee': 1, 'custom-text': 1, 'break-who': 1,
    'frame-num': 1, 'best-of': 1, 'score-plain': 1, 'score-box-3d': 1, 'frames': 1, 'break-val': 1, 'break-p1': 1, 'break-p2': 1,
    'match-clock': 1, 'frame-clock': 1, 'shot-clock': 1, 'reds-left': 1, 'pts-remaining': 1, 'smart-text': 1 };

  /* ── Smart text: one element, any wording, live values in {braces} ── */
  var TOKENS = [
    ['Players', ['p1.name', 'p1.first', 'p1.surname', 'p1.state', 'p1.score', 'p1.frames', 'p1.break',
                 'p2.name', 'p2.first', 'p2.surname', 'p2.state', 'p2.score', 'p2.frames', 'p2.break']],
    ['Match', ['frame', 'bestOf', 'firstTo', 'tournament', 'referee', 'table', 'matchId']],
    ['Live', ['atTable', 'atSurname', 'leader', 'lead', 'break', 'breakPlayer', 'reds', 'ptsLeft']],
    ['Clocks', ['matchClock', 'frameClock', 'shotClock']]
  ];
  function firstOf(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function surnameOf(n) { var p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p.slice(1).join(' ') : (p[0] || ''); }
  function tokenValues(m, cs) {
    m = m || {}; cs = cs || {};
    var p1 = m.player1 || {}, p2 = m.player2 || {}, t = {};
    [[1, p1], [2, p2]].forEach(function (x) {
      var n = x[0], p = x[1];
      t['p' + n + '.name'] = p.name || ''; t['p' + n + '.first'] = firstOf(p.name); t['p' + n + '.surname'] = surnameOf(p.name);
      t['p' + n + '.state'] = p.state || ''; t['p' + n + '.score'] = p.score || 0; t['p' + n + '.frames'] = p.frames || 0; t['p' + n + '.break'] = p.currentBreak || 0;
    });
    var at = m.turn === 2 ? p2 : p1, d = (p1.score || 0) - (p2.score || 0), reds = Math.max(0, m.redsRemaining == null ? 15 : m.redsRemaining);
    t.frame = m.currentFrame || 1; t.bestOf = m.bestOf || 1; t.firstTo = Math.ceil((m.bestOf || 1) / 2);
    t.tournament = m.tournament || ''; t.referee = m.referee || ''; t.table = m.tableNumber || ''; t.matchId = m.matchId || '';
    t.atTable = at.name || ''; t.atSurname = surnameOf(at.name);
    t.leader = d > 0 ? surnameOf(p1.name) : d < 0 ? surnameOf(p2.name) : 'LEVEL'; t.lead = Math.abs(d);
    t['break'] = m.currentBreak || 0; t.breakPlayer = m.breakPlayer === 2 ? (p2.name || '') : (p1.name || '');
    t.reds = reds; t.ptsLeft = reds * 8 + 27;
    t.matchClock = cs.so ? (cs.matchUp ? (cs.endRule === 'finish' ? 'LAST FRAME' : 'TIME UP') : (cs.hasMatch ? mmss(cs.mRem) : '')) : (cs.hasMatch ? mmss(cs.mEl, true) : '');
    t.frameClock = cs.so ? (cs.hasFrame ? (cs.fRem <= 0 ? 'TIME UP' : mmss(cs.fRem)) : '') : (cs.hasFrame ? mmss(cs.fEl, true) : '');
    t.shotClock = cs.hasShot ? Math.ceil(cs.sRem / 1000) : '';
    return t;
  }
  function escH(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fillTemplate(tpl, m, cs) {
    var t = tokenValues(m, cs);
    return String(tpl == null ? '' : tpl).replace(/\{\s*([a-zA-Z0-9.]+)\s*\}/g, function (all, k) { return k in t ? escH(t[k]) : escH(all); });
  }

  /* ── "When this player is at the table" style overrides, for any element ── */
  var AT_KEYS = ['color', 'bgColor', 'bgOpacity', 'borderColor', 'borderWidth', 'glowColor', 'glowSize', 'opacity'];
  function effective(el, m) {
    var a = el && el.at;
    if (!a || !a.on) return el;
    var who = el.player || a.player || 0;
    if (!who || !m || who != m.turn || m.status === 'finished') return el;
    var e = {}; for (var k in el) e[k] = el[k];
    AT_KEYS.forEach(function (key) { if (a[key] !== undefined && a[key] !== '') e[key] = a[key]; });
    if (a.color) e.activeColor = a.color;
    if (a.bgColor) { delete e.bgTop; delete e.bgBot; if (a.bgOpacity === undefined && !(e.bgOpacity > 0)) e.bgOpacity = 100; }
    if (a.glowColor && a.glowSize === undefined && !e.glowSize) e.glowSize = 18;
    return e;
  }

  /* "Show when" rules — the same answer in the builder preview and on OBS */
  var WHEN = [
    ['always', 'Always'], ['break', 'Only during a break'], ['no-break', 'Only when there is no break'],
    ['at-table', 'Only when this player is at the table'], ['not-at-table', 'Only when this player is NOT at the table'],
    ['leading', 'Only when this player is leading'], ['shotclock', 'Only when the shot clock is on'],
    ['decider', 'Only in the deciding frame'], ['finished', 'Only when the match is over'], ['playing', 'Only while the match is being played']
  ];
  function visible(el, m) {
    if (!el || el.hidden) return false;
    m = m || {};
    var p1 = m.player1 || {}, p2 = m.player2 || {}, need = Math.ceil((m.bestOf || 1) / 2);
    switch (el.showWhen || 'always') {
      case 'break': return (m.currentBreak || 0) > 0;
      case 'no-break': return (m.currentBreak || 0) === 0;
      case 'at-table': return !!el.player && el.player == m.turn;
      case 'not-at-table': return !!el.player && el.player != m.turn;
      case 'leading': var a = el.player == 1 ? p1 : p2, b = el.player == 1 ? p2 : p1; return (a.score || 0) > (b.score || 0);
      case 'shotclock': return !!(m.so || m.shotClockEnabled);
      case 'decider': return !!((m.so && m.so.decider) || (need > 1 && (p1.frames || 0) === need - 1 && (p2.frames || 0) === need - 1));
      case 'finished': return m.status === 'finished';
      case 'playing': return m.status !== 'finished';
    }
    return true;
  }

  /* Shrink text that would overflow its box (keeps long names inside the design) */
  function fit(box) {
    var t = box && box.firstElementChild; if (!t) return;
    if (t.dataset.fs === undefined) t.dataset.fs = t.style.fontSize || '';   // the size the design asked for
    t.style.fontSize = t.dataset.fs;
    if (!box.clientWidth || t.scrollWidth <= t.clientWidth + 1) return;
    var size = parseFloat(getComputedStyle(t).fontSize), min = size * 0.45;
    while (t.scrollWidth > t.clientWidth + 1 && size > min) { size *= 0.94; t.style.fontSize = size + 'px'; }
  }

  function now() { return w.SO ? w.SO.now() : Date.now(); }

  /* Everything the clock elements need, for any kind of match */
  function clockState(m) {
    if (m && m.so && w.SO) {
      var t = w.SO.times(m), c = t.cfg;
      return {
        so: true, live: t.running && t.started, hasShot: true,
        sRem: t.sRem, sDur: t.sDur, warn: c.warnAt * 1000,
        hasMatch: t.hasMatch, mRem: t.mRem, mTot: t.mTot, matchUp: !!m.so.matchUp, endRule: c.endRule,
        hasFrame: t.hasFrame, fRem: t.fRem, fTot: t.fTot,
        extCount: c.extCount, ext: m.so.ext || {}
      };
    }
    var n = now(), on = !!(m && m.shotClockEnabled && m.shotClockStarted);
    var dur = ((m && m.shotClockDuration) || 60) * 1000;
    return {
      so: false, live: on, hasShot: on,
      sRem: on ? Math.max(0, dur - (n - m.shotClockStarted)) : dur, sDur: dur, warn: 10000,
      hasMatch: !!(m && m.matchStartTime), mEl: m && m.matchStartTime ? n - m.matchStartTime : 0,
      hasFrame: !!(m && m.frameStartTime), fEl: m && m.frameStartTime ? n - m.frameStartTime : 0,
      extCount: 0, ext: {}
    };
  }

  /* fixed numbers for the builder preview */
  function demoState() {
    return { so: true, live: true, hasShot: true, sRem: 12400, sDur: 20000, warn: 5000,
      hasMatch: true, mRem: 1122000, mTot: 1800000, matchUp: false, endRule: 'finish',
      hasFrame: true, fRem: 375000, fTot: 600000, extCount: 1, ext: { p1: 1, p2: 0 } };
  }

  function mmss(ms, up) {
    var s = up ? Math.floor(ms / 1000) : Math.ceil(ms / 1000); s = Math.max(0, s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + ('0' + m).slice(-2) : ('0' + m).slice(-2)) + ':' + ('0' + x).slice(-2);
  }
  function lvl(rem, warnMs, dangerMs) { return rem <= dangerMs ? 'danger' : rem <= warnMs ? 'warn' : 'ok'; }
  function pick(el, l, base) { return l === 'danger' ? (el.dangerColor || '#ff3b2f') : l === 'warn' ? (el.warnColor || '#f5a623') : (base || el.color || '#ffffff'); }
  /* red flash strength 0..1 — one flash per second, two per second in the last 2 */
  function pulse(rem, warnMs) {
    if (rem <= 0) return 0.8;
    if (rem > warnMs) return 0;
    var period = rem <= 2000 ? 500 : 1000;
    return Math.pow((rem % period) / period, 2.2);
  }

  function textWrap(el) {
    var al = el.align || 'center', jc = al === 'left' ? 'flex-start' : al === 'right' ? 'flex-end' : 'center';
    return 'width:100%;height:100%;display:flex;align-items:center;justify-content:' + jc + ';overflow:hidden;padding:0 6px;line-height:1;' +
      "font-family:'" + (el.fontFamily || 'Bebas Neue') + "',sans-serif;font-size:" + (el.fontSize || 40) + 'px;font-weight:' + (el.fontWeight || 400) +
      ';text-transform:' + (el.textTransform || 'none') + ';letter-spacing:' + (el.letterSpacing || 0) + 'px;white-space:nowrap;font-variant-numeric:tabular-nums;';
  }

  /* Returns { html, hide, flash } for one element */
  function render(el, m, cs) {
    var turn = m && m.turn, at = el.player == turn;
    switch (el.type) {
      case 'shot-clock': {
        if (!cs.hasShot) return { hide: true };
        var sec = Math.ceil(cs.sRem / 1000), l = cs.live ? lvl(cs.sRem, Math.max(cs.warn * 2, 10000), cs.warn) : 'ok';
        return { html: '<div style="' + textWrap(el) + 'color:' + pick(el, l) + ';">' + sec + (el.showUnit === false || el.showUnit === 'no' ? '' : 's') + '</div>' };
      }
      case 'shot-bar': {
        if (!cs.hasShot) return { hide: true };
        var frac = at && cs.live && cs.sDur ? cs.sRem / cs.sDur : 1;
        var l2 = at && cs.live ? lvl(cs.sRem, Math.max(cs.warn * 2, 10000), cs.warn) : 'ok';
        var anchor = el.anchor || (el.player == 1 ? 'right' : 'left');
        var col = pick(el, l2, el.color || '#2ecc71');
        return { html: '<div style="width:' + (Math.max(0, Math.min(1, frac)) * 100).toFixed(2) + '%;height:100%;background:' + col +
          ';' + (anchor === 'right' ? 'margin-left:auto;' : '') + 'opacity:' + (at ? 1 : 0.2) + ';border-radius:inherit;' +
          (l2 === 'danger' ? 'box-shadow:0 0 14px ' + col + ';' : '') + '"></div>' };
      }
      case 'shot-flash': {
        var on = at && cs.live && cs.hasShot;
        return { html: '', flash: on ? pulse(cs.sRem, cs.warn) * (el.maxOpacity === undefined ? 0.75 : el.maxOpacity) : 0 };
      }
      case 'match-clock': {
        if (!cs.hasMatch) return { hide: true };
        if (cs.so) {
          var up = cs.matchUp ? (cs.endRule === 'finish' ? 'LAST FRAME' : 'TIME UP') : null;
          var l3 = up ? 'danger' : lvl(cs.mRem, 60000, 30000);
          return { html: '<div style="' + textWrap(el) + 'color:' + pick(el, l3) + ';">' + (up || mmss(cs.mRem)) + '</div>' };
        }
        return { html: '<div style="' + textWrap(el) + 'color:' + (el.color || '#fff') + ';">' + mmss(cs.mEl, true) + '</div>' };
      }
      case 'frame-clock': {
        if (!cs.hasFrame) return { hide: true };
        if (cs.so) {
          var l4 = cs.fRem <= 0 ? 'danger' : lvl(cs.fRem, 60000, 15000);
          return { html: '<div style="' + textWrap(el) + 'color:' + pick(el, l4) + ';">' + (cs.fRem <= 0 ? 'TIME UP' : mmss(cs.fRem)) + '</div>' };
        }
        return { html: '<div style="' + textWrap(el) + 'color:' + (el.color || '#fff') + ';">' + mmss(cs.fEl, true) + '</div>' };
      }
      case 'match-bar': case 'frame-bar': {
        var isM = el.type === 'match-bar', has = isM ? cs.hasMatch : cs.hasFrame;
        if (!has || !cs.so) return { hide: true };
        var rem = isM ? (cs.matchUp ? 0 : cs.mRem) : cs.fRem, tot = isM ? cs.mTot : cs.fTot;
        var l5 = isM ? (cs.matchUp ? 'danger' : lvl(rem, 60000, 30000)) : lvl(rem, 60000, 15000);
        return { html: '<div style="width:' + (tot ? rem / tot * 100 : 0).toFixed(2) + '%;height:100%;border-radius:inherit;background:' +
          pick(el, l5, el.color || (isM ? '#5fb8ff' : '#59e08a')) + ';' + (el.anchor === 'right' ? 'margin-left:auto;' : '') + '"></div>' };
      }
      case 'sponsor': {
        var imgs = el.images || [];
        if (!imgs.length) return { html: '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.35);font:700 12px \'Barlow Condensed\',sans-serif;letter-spacing:2px;border:1px dashed rgba(255,255,255,.25);">SPONSOR LOGOS</div>' };
        var every = Math.max(2, +el.interval || 6) * 1000, idx = Math.floor(now() / every) % imgs.length;
        return { html: '<img src="' + imgs[idx] + '" style="width:100%;height:100%;object-fit:contain;animation:sbFade .7s ease;">' };
      }
      case 'smart-text': {
        var al = el.align || 'center';
        return { html: '<div style="' + textWrap(el) + 'color:' + (el.color || '#ffffff') + ';">' + (fillTemplate(el.template, m, cs) || '&nbsp;') + '</div>' };
      }
      case 'ext-dots': {
        if (!cs.extCount) return { hide: true };
        var left = cs.ext['p' + el.player] || 0, d = '', sz = el.dotSize || 12, c = el.color || '#f0c040';
        for (var i = 0; i < cs.extCount; i++) d += '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;border:2px solid ' + c + ';background:' + (i < left ? c : 'transparent') + ';flex-shrink:0;"></div>';
        var jc = (el.align || 'center') === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center';
        return { html: '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:' + jc + ';gap:5px;">' + d + '</div>' };
      }
    }
    return { html: '' };
  }

  /* Paint into an element's div (overlay calls this every frame) */
  function paint(div, el, m, cs) {
    var r = render(el, m, cs);
    div.style.visibility = r.hide ? 'hidden' : '';
    if (el.type === 'shot-flash') {
      div.style.background = el.color || '#ff2a1a';
      div.style.opacity = String(r.flash || 0);
      return;
    }
    if (r.html !== undefined && div._lastHtml !== r.html) {
      div.innerHTML = r.html; div._lastHtml = r.html;
      if (TEXT_TYPES[el.type] && el.fit !== false && div.isConnected) fit(div);   // live text keeps fitting as it changes
    }
  }

  // fade used by the sponsor rotator
  if (!document.getElementById('sblive-css')) {
    var st = document.createElement('style'); st.id = 'sblive-css';
    st.textContent = '@keyframes sbFade{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}';
    (document.head || document.documentElement).appendChild(st);
  }

  w.SBLive = { TYPES: TYPES, TEXT_TYPES: TEXT_TYPES, WHEN: WHEN, isLive: function (t) { return !!TYPES[t]; },
    isText: function (t) { return !!TEXT_TYPES[t]; }, visible: visible, fit: fit,
    TOKENS: TOKENS, tokenValues: tokenValues, fillTemplate: fillTemplate, effective: effective, AT_KEYS: AT_KEYS,
    clockState: clockState, demoState: demoState, render: render, paint: paint };
})(window);
