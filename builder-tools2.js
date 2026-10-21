/* ═══════════════════════════════════════════════════════════════
   UPBSA.TV — SCOREBOARD BUILDER TOOLS 2
   Loaded after builder-tools.js. Adds:
   • Smart text — one element, any wording, live values in {braces}
   • "When this player is at the table" styling for ANY element
   • Fit-to-screen zoom, Ctrl+scroll zoom around the cursor, Space/middle-drag pan
   • Better property controls — drag-to-scrub numbers, sliders, design-colour
     swatches on every colour field, and Undo for property edits
   • YouTube player-controls zone guide (canvas + full-screen preview)
   ═══════════════════════════════════════════════════════════════ */
(function (w) {
  function $(id) { return document.getElementById(id); }
  function sel() { return (w.BT && BT.selection) || []; }
  function cur() { var s = sel(); return s.length === 1 ? findEl(s[0]) : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  /* ── one Undo step per burst of typing / dragging in the properties panel ── */
  var burst = null;
  function undoBurst() { if (!burst) pushUndo(); clearTimeout(burst); burst = setTimeout(function () { burst = null; }, 800); }
  // Undo / Redo end the current burst, so the next edit always gets its own Undo step
  var _undo2 = undo, _redo2 = redo;
  undo = function () { clearTimeout(burst); burst = null; _undo2(); };
  redo = function () { clearTimeout(burst); burst = null; _redo2(); };
  var _uep = updateElProp;
  updateElProp = function (k, v) { undoBurst(); _uep(k, v); };
  if (w.BT) {
    var _btProp = BT.prop;
    BT.prop = function (k, v, re) { undoBurst(); _btProp(k, v, re); };
  }

  /* ════════════ RENDERING HOOKS (builder canvas + preview + thumbnails) ════════════ */
  var _ap = applyElStyle, _gc = getElContent;
  applyElStyle = function (div, el) { _ap(div, SBLive.effective(el, getLiveData())); };
  getElContent = function (el) {
    var m = getLiveData(), e = SBLive.effective(el, m);
    if (e.type === 'smart-text') return SBLive.render(e, m, SBLive.demoState()).html;
    return _gc(e);
  };
  var _render = render;
  render = function () {
    _render();
    var m = getLiveData();
    document.querySelectorAll('#canvas-scale .cv-el, #break-scale .cv-el').forEach(function (d) {
      var el = findEl(d.dataset.id); if (!el || !el.at || !el.at.on) return;
      var e = SBLive.effective(el, m);
      if (e.opacity !== undefined && e !== el && !el.hidden) d.style.opacity = e.opacity;
      if (e !== el) d.classList.add('is-at');
    });
    drawYTZone();
  };

  /* ════════════ SMART TEXT ════════════ */
  var TOKEN_HELP = {
    'p1.name': 'P1 full name', 'p1.first': 'P1 first name', 'p1.surname': 'P1 surname', 'p1.state': 'P1 state / city', 'p1.score': 'P1 points',
    'p1.frames': 'P1 frames won', 'p1.break': 'P1 current break', 'p2.name': 'P2 full name', 'p2.first': 'P2 first name', 'p2.surname': 'P2 surname',
    'p2.state': 'P2 state / city', 'p2.score': 'P2 points', 'p2.frames': 'P2 frames won', 'p2.break': 'P2 current break',
    'frame': 'Frame number', 'bestOf': 'Best of', 'firstTo': 'Frames needed to win', 'tournament': 'Tournament', 'referee': 'Referee', 'table': 'Table number',
    'matchId': 'Match ID', 'atTable': 'Name of player at the table', 'atSurname': 'Surname of player at the table', 'leader': 'Surname of the leader (or LEVEL)',
    'lead': 'Points lead', 'break': 'Current break', 'breakPlayer': 'Name of the player on a break', 'reds': 'Reds left', 'ptsLeft': 'Points left on the table',
    'matchClock': 'Match clock', 'frameClock': 'Frame clock', 'shotClock': 'Shot clock seconds'
  };
  var IDEAS = ['FRAME {frame} OF {bestOf}', 'BEST OF {bestOf} · FIRST TO {firstTo}', '{leader} LEADS BY {lead}', '{p1.surname} ({p1.state})',
    '{breakPlayer} · BREAK {break}', '{reds} REDS · {ptsLeft} ON TABLE', 'REF: {referee}', 'TABLE {table} · {tournament}'];
  function smartUI(el) {
    var h = '<div class="prop-group bt-smart"><div class="prop-group-title">Smart text</div>';
    h += '<div class="prop-row"><div class="prop-lbl">Wording — live values go in {braces}</div>' +
      '<textarea class="prop-in bt-tpl" id="bt-tpl" rows="2" spellcheck="false">' + esc(el.template || '') + '</textarea></div>';
    h += '<div class="bt-tpl-out" id="bt-tpl-out"></div>';
    SBLive.TOKENS.forEach(function (g) {
      h += '<div class="bt-tok-g">' + g[0] + '</div><div class="bt-toks">' +
        g[1].map(function (t) { return '<button class="bt-tok" data-t="' + t + '" title="' + esc(TOKEN_HELP[t] || t) + '">' + t + '</button>'; }).join('') + '</div>';
    });
    h += '<div class="bt-tok-g">Ideas</div><div class="bt-ideas">' + IDEAS.map(function (i) { return '<button class="bt-idea">' + esc(i) + '</button>'; }).join('') + '</div></div>';
    return h;
  }
  function wireSmart(el) {
    var ta = $('bt-tpl'); if (!ta) return;
    function out() { var o = $('bt-tpl-out'); if (o) o.innerHTML = '→ ' + (SBLive.fillTemplate(ta.value, getLiveData(), SBLive.demoState()) || '<i>empty</i>'); }
    ta.addEventListener('input', function () { undoBurst(); el.template = ta.value; render(); out(); });
    document.querySelectorAll('.bt-tok').forEach(function (b) {
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () {
        var t = '{' + b.dataset.t + '}', s = ta.selectionStart || ta.value.length, e2 = ta.selectionEnd || s;
        ta.value = ta.value.slice(0, s) + t + ta.value.slice(e2); ta.focus(); ta.selectionStart = ta.selectionEnd = s + t.length;
        ta.dispatchEvent(new Event('input'));
      });
    });
    document.querySelectorAll('.bt-idea').forEach(function (b) {
      b.addEventListener('click', function () { ta.value = b.textContent; ta.dispatchEvent(new Event('input')); });
    });
    out();
  }
  var _drop = dropOnCanvas;
  dropOnCanvas = function (e) {
    var t = libDragType; _drop(e);
    var el = selectedId && findEl(selectedId);
    if (t === 'smart-text' && el) { el.template = 'FRAME {frame} OF {bestOf}'; el.w = 360; el.h = 40; el.fontSize = 22; el.fontWeight = 800; el.letterSpacing = 3; render(); showProps(el); }
  };

  /* ════════════ "WHEN THIS PLAYER IS AT THE TABLE" ════════════ */
  function colRow(lbl, key, val, def) {
    var v = val || '';
    return '<div class="prop-row"><div class="prop-lbl">' + lbl + '</div><div class="prop-color-row">' +
      '<input type="color" value="' + ((v && v.charAt(0) === '#') ? v.slice(0, 7) : def) + '" data-at="' + key + '">' +
      '<input class="prop-in" value="' + esc(v) + '" placeholder="unchanged" data-at="' + key + '"></div></div>';
  }
  function numRow(lbl, key, val, min, max, step) {
    return '<div class="prop-row"><div class="prop-lbl">' + lbl + '</div><input class="prop-in" type="number" data-at="' + key + '" data-range="' + min + ',' + max + ',' + step + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + (val === undefined ? '' : val) + '" placeholder="unchanged"></div>';
  }
  function atUI(el) {
    var a = el.at || {}, on = !!a.on, txt = SBLive.isText(el.type);
    var h = '<div class="prop-group bt-at' + (on ? ' on' : '') + '"><div class="prop-group-title">When this player is at the table</div>';
    h += '<div class="prop-row"><label class="bt-check"><input type="checkbox" id="bt-at-on" ' + (on ? 'checked' : '') + '> Change how this looks for the player at the table</label></div>';
    if (on) {
      if (!el.player) {
        h += '<div class="prop-row"><div class="prop-lbl">Follow which player</div><div class="prop-align-row">' +
          [[1, 'Player 1'], [2, 'Player 2']].map(function (o) { return '<div class="align-btn' + ((a.player || 1) == o[0] ? ' on' : '') + '" data-atp="' + o[0] + '">' + o[1] + '</div>'; }).join('') + '</div></div>';
      }
      if (txt) h += colRow('Text colour', 'color', a.color, '#f0c040');
      h += colRow('Background', 'bgColor', a.bgColor, '#2ecc71') + numRow('Background opacity %', 'bgOpacity', a.bgOpacity, 0, 100, 1);
      h += colRow('Border colour', 'borderColor', a.borderColor, '#f0c040') + numRow('Border width', 'borderWidth', a.borderWidth, 0, 20, 1);
      h += colRow('Glow colour', 'glowColor', a.glowColor, '#f0c040') + numRow('Glow size', 'glowSize', a.glowSize, 0, 60, 1);
      h += numRow('Opacity (0–1)', 'opacity', a.opacity, 0, 1, 0.05);
      h += '<div class="bt-at-hint">Preview it: pick “Player 2 at the table” in the Test-with menu to see the other side.</div>';
    }
    return h + '</div>';
  }
  function wireAt(el) {
    var cb = $('bt-at-on'); if (!cb) return;
    cb.addEventListener('change', function () {
      pushUndo(); el.at = el.at || {}; el.at.on = cb.checked;
      if (cb.checked && !el.at.color && !el.at.bgColor && !el.at.borderColor && !el.at.glowColor) {   // a sensible start
        if (SBLive.isText(el.type)) el.at.color = '#f0c040'; else { el.at.glowColor = '#f0c040'; el.at.glowSize = 18; }
      }
      render(); showProps(el);
    });
    document.querySelectorAll('[data-atp]').forEach(function (b) { b.addEventListener('click', function () { pushUndo(); el.at.player = +b.dataset.atp; render(); showProps(el); }); });
    document.querySelectorAll('#props-content [data-at]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        undoBurst(); el.at = el.at || { on: true };
        var k = inp.dataset.at, v = inp.value;
        if (v === '') delete el.at[k]; else el.at[k] = inp.type === 'number' ? +v : v;
        var row = inp.closest('.prop-color-row');
        if (row) row.querySelectorAll('[data-at]').forEach(function (o) { if (o === inp) return; if (o.type === 'color') { if (/^#[0-9a-f]{6}/i.test(v)) o.value = v.slice(0, 7); } else o.value = v; });
        render();
      });
    });
  }

  /* ── hook into the properties panel ── */
  var _sp = showProps;
  showProps = function (el) {
    _sp(el);
    if (!el || sel().length > 1) return;
    var pc = $('props-content'); if (!pc) return;
    if (el.type === 'smart-text') { pc.insertAdjacentHTML('afterbegin', smartUI(el)); wireSmart(el); }
    var groups = pc.querySelectorAll('.prop-group'), beh = null;
    groups.forEach(function (gp) { var t = gp.querySelector('.prop-group-title'); if (t && /Behaviour/i.test(t.textContent)) beh = gp; });
    var html = atUI(el);
    if (beh) beh.insertAdjacentHTML('beforebegin', html); else { var del = pc.querySelector('.prop-del'); if (del) del.insertAdjacentHTML('beforebegin', html); }
    wireAt(el);
  };

  /* ════════════ BETTER CONTROLS: scrub, sliders, swatches ════════════ */
  var RANGES = { opacity: [0, 1, 0.05], bgOpacity: [0, 100, 1], fontSize: [6, 200, 1], letterSpacing: [-5, 30, 0.5], borderRadius: [0, 120, 1],
    glowSize: [0, 60, 1], maxOpacity: [0, 1, 0.05], borderWidth: [0, 20, 1], dotSize: [4, 40, 1], interval: [2, 60, 1] };
  var BRAND = ['#f0c040', '#ffffff', '#000000', '#2ecc71', '#e74c3c', '#5fb8ff', '#ff8a3d', '#0a1610'];
  function paletteNow() {
    var seen = {}, out = [];
    function add(c) { if (typeof c !== 'string') return; c = c.trim().toLowerCase(); if (!/^#[0-9a-f]{6}$/.test(c) || seen[c]) return; seen[c] = 1; out.push(c); }
    var counts = {};
    ['score', 'break'].forEach(function (k) {
      layers[k].elements.forEach(function (el) { ['color', 'bgColor', 'borderColor', 'activeColor', 'bgTop', 'bgBot'].forEach(function (key) { var c = el[key]; if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) counts[c.toLowerCase()] = (counts[c.toLowerCase()] || 0) + 1; }); });
    });
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8).forEach(add);
    BRAND.forEach(add);
    return out.slice(0, 12);
  }
  function enhance() {
    var pc = $('props-content'); if (!pc) return;
    var pal = null;
    pc.querySelectorAll('.prop-color-row').forEach(function (row) {
      if (row.dataset.sw) return; row.dataset.sw = '1';
      pal = pal || paletteNow();
      var box = document.createElement('div'); box.className = 'bt-sw-row';
      pal.forEach(function (c) {
        var s = document.createElement('button'); s.className = 'bt-sw'; s.style.background = c; s.title = c;
        s.addEventListener('mousedown', function (e) { e.preventDefault(); });
        s.addEventListener('click', function () {
          var t = row.querySelector('input.prop-in') || row.querySelector('input[type=color]');
          t.value = c; t.dispatchEvent(new Event('input', { bubbles: true }));
          var col = row.querySelector('input[type=color]'); if (col && col !== t) col.value = c;
        });
        box.appendChild(s);
      });
      row.parentNode.insertBefore(box, row.nextSibling);
    });
    pc.querySelectorAll('input[type=number]').forEach(function (inp) {
      if (inp.dataset.bt) return; inp.dataset.bt = '1';
      inp.classList.add('bt-scrub'); inp.title = inp.title || 'Drag left/right to change · Shift = faster';
      var key = inp.dataset.key || inp.dataset.at, rg = RANGES[key] || (inp.dataset.range ? inp.dataset.range.split(',').map(Number) : null);
      if (rg && !inp.closest('.prop-in-row')) {
        var r = document.createElement('input'); r.type = 'range'; r.className = 'bt-range'; r.min = rg[0]; r.max = rg[1]; r.step = rg[2];
        r.value = inp.value === '' ? rg[0] : inp.value;
        r.addEventListener('input', function () { inp.value = r.value; inp.dispatchEvent(new Event('input', { bubbles: true })); });
        inp.addEventListener('input', function () { if (inp.value !== '') r.value = inp.value; });
        inp.parentNode.insertBefore(r, inp.nextSibling);
      }
    });
  }
  new MutationObserver(function () { enhance(); }).observe($('props-content'), { childList: true });

  /* drag-to-scrub any number field */
  document.addEventListener('mousedown', function (e) {
    var inp = e.target;
    if (!inp || inp.tagName !== 'INPUT' || inp.type !== 'number' || !inp.closest('#props-content') || document.activeElement === inp) return;
    e.preventDefault();
    var sx = e.clientX, start = parseFloat(inp.value) || 0, step = parseFloat(inp.step) || 1, moved = false;
    if (inp.step === '' || inp.step === 'any') step = (inp.dataset.key === 'opacity' || inp.dataset.at === 'opacity') ? 0.05 : 1;
    var mn = inp.min !== '' ? parseFloat(inp.min) : -Infinity, mx = inp.max !== '' ? parseFloat(inp.max) : Infinity;
    function mv(ev) {
      var dx = ev.clientX - sx; if (!moved && Math.abs(dx) < 3) return;
      if (!moved) { moved = true; document.body.classList.add('bt-scrubbing'); }
      var v = start + Math.round(dx / 3) * step * (ev.shiftKey ? 10 : 1);
      v = Math.min(mx, Math.max(mn, v)); v = Math.round(v * 1000) / 1000;
      if (String(v) !== inp.value) { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    function up() {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.classList.remove('bt-scrubbing');
      if (!moved) { inp.focus(); inp.select(); }
    }
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }, true);

  /* ════════════ ZOOM & PAN ════════════ */
  var area = document.querySelector('.canvas-area'), zsel = $('zoom-sel'), zmode = 'fit';
  function zoomLabel() {
    var o = $('zoom-custom'); if (!o) { o = document.createElement('option'); o.id = 'zoom-custom'; o.value = 'custom'; zsel.appendChild(o); }
    o.textContent = Math.round(zoom * 100) + '%'; o.hidden = false;
    zsel.value = zmode === 'fit' ? 'fit' : 'custom';
    var f = zsel.querySelector('option[value=fit]'); if (f) f.textContent = 'Fit' + (zmode === 'fit' ? ' (' + Math.round(zoom * 100) + '%)' : '');
  }
  function fitZoom() {
    if (!area) return;
    var avail = area.clientWidth - 64, z = Math.max(0.2, Math.min(1.5, avail / CANVAS_W));
    zmode = 'fit'; setZoom(Math.round(z * 1000) / 1000); zoomLabel();
  }
  function zoomTo(z, cx, cy) {
    z = Math.max(0.15, Math.min(2.5, z));
    var r = area.getBoundingClientRect(), px = (cx === undefined ? r.width / 2 : cx - r.left), py = (cy === undefined ? r.height / 2 : cy - r.top);
    var ox = (area.scrollLeft + px) / zoom, oy = (area.scrollTop + py) / zoom;
    zmode = 'custom'; setZoom(Math.round(z * 1000) / 1000); zoomLabel();
    area.scrollLeft = ox * zoom - px; area.scrollTop = oy * zoom - py;
  }
  if (zsel) {
    var fo = document.createElement('option'); fo.value = 'fit'; fo.textContent = 'Fit'; zsel.insertBefore(fo, zsel.firstChild);
    zsel.onchange = function () { var v = zsel.value; if (v === 'fit') fitZoom(); else if (v !== 'custom') { zmode = 'custom'; setZoom(+v); zoomLabel(); } };
  }
  if (area) {
    area.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault(); zoomTo(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY);
    }, { passive: false });
    var space = false, pan = null;
    document.addEventListener('keydown', function (e) {
      var t = e.target; if (t && ((t.tagName === 'INPUT' && /^(text|number|search|email|url|password|tel)$/i.test(t.type || 'text')) || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.code === 'Space' && !space) { space = true; area.classList.add('can-pan'); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomTo(zoom * 1.2); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomTo(zoom / 1.2); }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); fitZoom(); }
    });
    document.addEventListener('keyup', function (e) { if (e.code === 'Space') { space = false; area.classList.remove('can-pan'); } });
    area.addEventListener('mousedown', function (e) {
      if (!(space && e.button === 0) && e.button !== 1) return;
      e.preventDefault(); e.stopPropagation();
      pan = { x: e.clientX, y: e.clientY, sl: area.scrollLeft, st: area.scrollTop }; area.classList.add('panning');
      function mv(ev) { area.scrollLeft = pan.sl - (ev.clientX - pan.x); area.scrollTop = pan.st - (ev.clientY - pan.y); }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); area.classList.remove('panning'); pan = null; }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    }, true);
    w.addEventListener('resize', function () { if (zmode === 'fit') fitZoom(); });
  }

  /* ════════════ YOUTUBE PLAYER-CONTROLS ZONE ════════════ */
  // Approximate, measured on a 1080p video: the play bar + progress bar cover ~72px, the dark fade behind them ~150px.
  var YT_BAR = 72, YT_FADE = 150, YT_TOP = 70;
  var ytOn = false; try { ytOn = localStorage.getItem('upbsa_yt_zone') === '1'; } catch (e) { }
  function zoneDivs(sc, H, offsetBottom) {
    function band(from, to, cls, label) {
      if (to <= from) return;
      var d = document.createElement('div'); d.className = cls;
      d.style.cssText = 'top:' + from + 'px;height:' + (to - from) + 'px;';
      if (label) { var t = document.createElement('span'); t.textContent = label; t.style.fontSize = (12 / zoom) + 'px'; t.style.padding = (2 / zoom) + 'px ' + (8 / zoom) + 'px'; d.appendChild(t); }
      sc.appendChild(d);
    }
    // a point at canvas y is (H - y + offsetBottom) px above the bottom of the video
    var redFrom = H - Math.max(0, YT_BAR - offsetBottom), fadeFrom = H - Math.max(0, YT_FADE - offsetBottom);
    band(Math.max(0, fadeFrom), Math.max(0, Math.min(H, redFrom)), 'bt-yt-fade', redFrom >= H ? 'Behind YouTube’s dark fade when viewers hover' : '');
    band(Math.max(0, redFrom), H, 'bt-yt', 'Covered by YouTube’s play bar when viewers hover');
  }
  function drawYTZone() {
    var btn = $('bt-yt-btn'); if (btn) btn.classList.toggle('on', ytOn);
    if (!ytOn) return;
    var s = $('canvas-scale'), b = $('break-scale');
    if (s) zoneDivs(s, layers.score.height, 0);
    var bo = $('break-outer');
    if (b && bo && bo.style.display !== 'none') zoneDivs(b, layers['break'].height, layers.score.height);
  }
  function toggleYT() { ytOn = !ytOn; try { localStorage.setItem('upbsa_yt_zone', ytOn ? '1' : '0'); } catch (e) { } render(); syncPvZone(); }
  // full-screen preview overlay
  function syncPvZone() {
    var host = $('pv-host'), st = $('pv-stage'), z = $('pv-zone'), cb = $('pv-yt');
    if (cb) cb.checked = ytOn;
    if (!host || !st) return;
    if (!z) { z = document.createElement('div'); z.id = 'pv-zone'; z.className = 'pv-zone';
      z.innerHTML = '<div class="pz-top"><span>YouTube title &amp; buttons (on hover)</span></div><div class="pz-fade"></div><div class="pz-bar"><span>YouTube play bar (on hover)</span></div>'; host.appendChild(z); }
    z.style.display = ytOn ? 'block' : 'none';
    z.style.transform = st.style.transform; z.style.left = st.style.left; z.style.top = st.style.top;
    z.querySelector('.pz-top').style.height = YT_TOP + 'px';
    z.querySelector('.pz-fade').style.cssText = 'bottom:' + YT_BAR + 'px;height:' + (YT_FADE - YT_BAR) + 'px;';
    z.querySelector('.pz-bar').style.height = YT_BAR + 'px';
  }
  setInterval(function () { var m = $('pv-modal'); if (m && m.classList.contains('open')) syncPvZone(); }, 200);

  /* ════════════ PUBLIC ════════════ */
  w.BT2 = { fit: fitZoom, zoomTo: zoomTo, toggleYT: toggleYT, pvYT: function (on) { ytOn = !!on; try { localStorage.setItem('upbsa_yt_zone', ytOn ? '1' : '0'); } catch (e) { } syncPvZone(); render(); } };

  // start fitted to the screen
  setTimeout(fitZoom, 60);
  render();
})(window);
