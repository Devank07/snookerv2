/* ═══════════════════════════════════════════════════════════════
   UPBSA.TV — SCOREBOARD BUILDER TOOLS
   Loaded after builder.html's own script. Adds:
   1 multi-select, box select, group move, snap + smart guides,
     keyboard shortcuts, copy / paste / duplicate, align & distribute, mirror
   2 Elements list (rename, reorder, hide, lock), right-click menu,
     full-screen 1920×1080 preview
   3 preview scenarios, auto-fit text, "show when" rules
   4 animations, design colours, extra shapes, sponsor logo rotator
   5 thumbnails, version history, export / import, per-table designs
   ═══════════════════════════════════════════════════════════════ */
(function (w) {
  var selIds = [];                       // selected element ids (all in activeLayer)
  var guides = null;                     // {layer, x:[], y:[]} while dragging
  var clip = null;                       // copied elements
  var scenario = 'demo';                 // preview data
  var tableLive = {};                    // key -> ['T1', ...] (per-table designs)
  var tableSlots = {};                   // raw design/tables
  var SNAP = 6;                          // screen px

  var NAMES = {
    'player-name': 'Name', 'score-box-3d': 'Score Box', 'score-plain': 'Score', 'frames': 'Frames Won', 'frame-dots': 'Frame Dots',
    'state': 'State / City', 'best-of': 'Best Of', 'frame-num': 'Frame Number', 'tournament': 'Tournament', 'referee': 'Referee',
    'break-val': 'Current Break', 'break-p1': 'P1 Break', 'break-p2': 'P2 Break', 'break-who': 'Break Player', 'ball-strip': 'Ball History',
    'shot-clock': 'Shot Clock', 'reds-left': 'Reds Left', 'pts-remaining': 'Points Left', 'custom-text': 'Text', 'logo': 'Image',
    'rect': 'Rectangle', 'rect-angled': 'Chevron', 'rect-slant': 'Slant Box', 'line-h': 'Line', 'shot-bar': 'Shot Timer Bar',
    'shot-flash': 'Red Flash', 'match-clock': 'Match Clock', 'frame-clock': 'Frame Clock', 'match-bar': 'Match Time Bar',
    'frame-bar': 'Frame Time Bar', 'ext-dots': 'Extensions', 'sponsor': 'Sponsor Logos'
  };
  var ICONS = { 'player-name': '👤', 'score-box-3d': '🔢', 'score-plain': '🔢', 'frames': '🏆', 'frame-dots': '●', 'state': '📍',
    'tournament': '🏟', 'custom-text': 'T', 'logo': '🖼', 'rect': '▬', 'rect-angled': '◇', 'rect-slant': '▱', 'line-h': '─',
    'shot-bar': '▰', 'shot-flash': '🟥', 'match-clock': '⌛', 'frame-clock': '🕑', 'shot-clock': '⏱', 'sponsor': '💼', 'ball-strip': '🎱' };

  function $(id) { return document.getElementById(id); }
  function layerOf(id) {
    if (layers.score.elements.some(function (e) { return e.id === id; })) return 'score';
    if (layers.break.elements.some(function (e) { return e.id === id; })) return 'break';
    return null;
  }
  function selEls() { return selIds.map(findEl).filter(Boolean); }
  function elName(el) {
    var n = el.label || NAMES[el.type] || el.type;
    if (!el.label && el.player && /Name|Score|Frames|Frame Dots|State|Shot Timer|Red Flash|Extensions/.test(n)) n = 'P' + el.player + ' ' + n;
    return n;
  }
  // only real typing fields keep shortcuts for themselves — sliders, colour squares and checkboxes don't
  var TYPING = { text: 1, number: 1, search: 1, email: 1, url: 1, password: 1, tel: 1 };
  function inField(e) {
    var t = e.target; if (!t) return false;
    if (t.tagName === 'INPUT') return !!TYPING[(t.type || 'text').toLowerCase()];
    return t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
  }
  function maxZ(L) { return L.elements.reduce(function (m, e) { return Math.max(m, e.zIndex || 1); }, 0); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function activateLayer(name) {
    if (activeLayer === name) return;
    activeLayer = name;
    document.querySelectorAll('.layer-tab').forEach(function (t) { t.classList.remove('on'); });
    var tab = $('tab-' + name); if (tab) tab.classList.add('on');
    var lbl = $('canvas-label'); if (lbl) lbl.textContent = (name === 'score' ? 'Score Bar' : 'Break Panel') + ' · 1920px';
  }

  /* ════════════ SELECTION ════════════ */
  function setSel(ids, layer) {
    if (layer) activateLayer(layer);
    selIds = ids.filter(function (id) { return layerOf(id) === activeLayer; });
    selectedId = selIds.length ? selIds[selIds.length - 1] : null;
    render(); refreshProps();
  }
  function refreshProps() {
    if (!selIds.length) { _showPropsEmpty(); return; }
    if (selIds.length > 1) { showMulti(); return; }
    var el = findEl(selIds[0]); if (el) showProps(el);
  }
  var _showPropsEmpty = showPropsEmpty, _showProps = showProps, _selectEl = selectEl, _render = render;

  showPropsEmpty = function () { selIds = []; _showPropsEmpty(); };
  selectEl = function (id, layerName) { selIds = [id]; if (layerName) activateLayer(layerName); _selectEl(id, layerName); };
  showProps = function (el) {
    if (!el) return;
    if (selIds.indexOf(el.id) < 0 || selIds.length > 1 && selectedId !== el.id) selIds = [el.id];
    if (selIds.length > 1) { showMulti(); return; }
    _showProps(el); appendExtras(el); showTab('props', true);
  };
  deleteSelected = function () {
    var ids = selIds.length ? selIds.slice() : (selectedId ? [selectedId] : []);
    if (!ids.length) return;
    pushUndo();
    ['score', 'break'].forEach(function (k) { layers[k].elements = layers[k].elements.filter(function (e) { return ids.indexOf(e.id) < 0; }); });
    selIds = []; selectedId = null; render(); _showPropsEmpty();
    showToast(ids.length > 1 ? ids.length + ' elements deleted' : 'Element deleted');
  };

  /* ════════════ CANVAS ELEMENTS ════════════ */
  var _applyElStyle = applyElStyle, _getElContent = getElContent;
  applyElStyle = function (div, el) {
    _applyElStyle(div, el);
    if (el.type === 'rect' && el.gradDir === 'h' && (el.bgTop || el.bgBot))
      div.style.background = 'linear-gradient(90deg,' + (el.bgTop || el.bgColor || '#000') + ',' + (el.bgBot || el.bgColor || '#000') + ')';
    if (el.type === 'rect-slant') {
      div.style.clipPath = 'polygon(0% 0%,92% 0%,100% 100%,8% 100%)';
      if (el.bgTop || el.bgBot) div.style.background = 'linear-gradient(160deg,' + (el.bgTop || el.bgColor || '#333') + ',' + (el.bgBot || el.bgColor || '#111') + ')';
    }
  };
  getElContent = function (el) { if (el.type === 'rect-slant') return null; return _getElContent(el); };

  makeElDiv = function (el, layerName) {
    var div = document.createElement('div');
    var on = layerName === activeLayer && selIds.indexOf(el.id) >= 0;
    div.className = 'cv-el' + (on ? ' selected' : '') + (el.locked ? ' is-locked' : '') + (el.hidden ? ' is-hidden' : '');
    div.dataset.id = el.id; div.dataset.layer = layerName;
    div.style.left = el.x + 'px'; div.style.top = el.y + 'px';
    div.style.width = el.w + 'px'; div.style.height = el.h + 'px';
    div.style.zIndex = el.zIndex || 1;
    div.style.opacity = el.opacity !== undefined ? el.opacity : 1;
    applyElStyle(div, el);
    var content = getElContent(el);
    if (content !== null) div.innerHTML = content;
    if (!el.hidden && w.SBLive && !SBLive.visible(el, getLiveData())) div.classList.add('when-off');
    if (on && selIds.length === 1 && !el.locked) {
      var rh = document.createElement('div');
      rh.className = 'rh'; rh.style.cssText = 'bottom:-4px;right:-4px;';
      rh.addEventListener('mousedown', function (e) { e.stopPropagation(); e.preventDefault(); startResize(el, layerName, e); });
      div.appendChild(rh);
    }
    div.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || e.target.classList.contains('rh')) return;
      e.stopPropagation(); e.preventDefault();
      if (layerName !== activeLayer) { activateLayer(layerName); selIds = []; }
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        var i = selIds.indexOf(el.id);
        if (i >= 0) selIds.splice(i, 1); else selIds.push(el.id);
        selectedId = selIds.length ? selIds[selIds.length - 1] : null;
        render(); refreshProps(); return;
      }
      if (selIds.indexOf(el.id) < 0) { selIds = [el.id]; selectedId = el.id; render(); refreshProps(); }
      startMove(el, layerName, e);
    });
    return div;
  };

  render = function () {
    _render();
    ['canvas-scale', 'break-scale'].forEach(function (sid) {
      var sc = $(sid); if (!sc) return;
      sc.querySelectorAll('.cv-el').forEach(function (d) {
        var el = findEl(d.dataset.id);
        if (el && w.SBLive && SBLive.isText(el.type) && el.fit !== false) SBLive.fit(d);
      });
    });
    drawGuides();
    scheduleSide();
  };

  /* ════════════ SNAPPING & GUIDES ════════════ */
  function bbox(items) {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    items.forEach(function (e) { x1 = Math.min(x1, e.x); y1 = Math.min(y1, e.y); x2 = Math.max(x2, e.x + e.w); y2 = Math.max(y2, e.y + e.h); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  function snapTargets(layerName, exclude) {
    var L = layers[layerName], xs = [0, CANVAS_W / 2, CANVAS_W], ys = [0, L.height / 2, L.height];
    L.elements.forEach(function (e) {
      if (exclude.indexOf(e.id) >= 0 || e.hidden) return;
      xs.push(e.x, e.x + e.w / 2, e.x + e.w); ys.push(e.y, e.y + e.h / 2, e.y + e.h);
      // mirror position of this element across the centre — keeps P1/P2 symmetric
      xs.push(CANVAS_W - e.x - e.w, CANVAS_W - e.x);
    });
    return { xs: xs, ys: ys };
  }
  function snapAxis(edges, cands, thr) {
    var best = null;
    edges.forEach(function (v) { cands.forEach(function (c) { var d = c - v; if (Math.abs(d) <= thr && (best === null || Math.abs(d) < Math.abs(best))) best = d; }); });
    if (best === null) return { d: 0, lines: [] };
    var lines = [];
    edges.forEach(function (v) { cands.forEach(function (c) { if (Math.abs(c - (v + best)) < 0.6 && lines.indexOf(c) < 0) lines.push(c); }); });
    return { d: best, lines: lines };
  }
  function snapBox(b, T) {
    var thr = SNAP / zoom;
    var sx = snapAxis([b.x, b.x + b.w / 2, b.x + b.w], T.xs, thr), sy = snapAxis([b.y, b.y + b.h / 2, b.y + b.h], T.ys, thr);
    return { dx: sx.d, dy: sy.d, gx: sx.lines, gy: sy.lines };
  }
  function drawGuides() {
    if (!guides) return;
    var sc = $(guides.layer === 'score' ? 'canvas-scale' : 'break-scale'); if (!sc) return;
    var px = (1 / zoom) + 'px';
    guides.x.forEach(function (x) { var d = document.createElement('div'); d.className = 'bt-guide'; d.style.cssText = 'left:' + x + 'px;top:0;bottom:0;width:' + px; sc.appendChild(d); });
    guides.y.forEach(function (y) { var d = document.createElement('div'); d.className = 'bt-guide'; d.style.cssText = 'top:' + y + 'px;left:0;right:0;height:' + px; sc.appendChild(d); });
    if (guides.tip) { var t = document.createElement('div'); t.className = 'bt-tip'; t.textContent = guides.tip.txt;
      t.style.cssText = 'left:' + guides.tip.x + 'px;top:' + guides.tip.y + 'px;font-size:' + (11 / zoom) + 'px;padding:' + (2 / zoom) + 'px ' + (6 / zoom) + 'px;'; sc.appendChild(t); }
  }

  startMove = function (el, layerName, e) {
    var ids = selIds.indexOf(el.id) >= 0 ? selIds.slice() : [el.id];
    var items = ids.map(findEl).filter(function (x) { return x && !x.locked; });
    if (!items.length) return;
    var start = items.map(function (it) { return { it: it, x: it.x, y: it.y }; });
    var b0 = bbox(items), T = snapTargets(layerName, ids), sx = e.clientX, sy = e.clientY, moved = false;
    function onMove(ev) {
      var dx = (ev.clientX - sx) / zoom, dy = (ev.clientY - sy) / zoom;
      if (!moved) { if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return; pushUndo(); moved = true; }
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }          // straight lines
      var s = ev.altKey ? { dx: 0, dy: 0, gx: [], gy: [] } : snapBox({ x: b0.x + dx, y: b0.y + dy, w: b0.w, h: b0.h }, T);
      dx += s.dx; dy += s.dy;
      start.forEach(function (o) { o.it.x = Math.round(o.x + dx); o.it.y = Math.round(o.y + dy); });
      guides = { layer: layerName, x: s.gx, y: s.gy, tip: { x: Math.round(b0.x + dx), y: Math.max(0, Math.round(b0.y + dy) - 22 / zoom), txt: Math.round(b0.x + dx) + ', ' + Math.round(b0.y + dy) } };
      render();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
      guides = null; render(); if (moved) refreshProps();
    }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  };

  startResize = function (el, layerName, e) {
    var it = findEl(el.id); if (!it) return;
    var ow = it.w, oh = it.h, ratio = ow / Math.max(1, oh), sx = e.clientX, sy = e.clientY, moved = false, T = snapTargets(layerName, [el.id]);
    function onMove(ev) {
      if (!moved) { pushUndo(); moved = true; }
      var nw = ow + (ev.clientX - sx) / zoom, nh = oh + (ev.clientY - sy) / zoom, gx = [], gy = [];
      if (ev.shiftKey) nh = nw / ratio;
      if (!ev.altKey) {
        var thr = SNAP / zoom, r = snapAxis([it.x + nw], T.xs, thr), bt = snapAxis([it.y + nh], T.ys, thr);
        nw += r.d; gx = r.lines; if (!ev.shiftKey) { nh += bt.d; gy = bt.lines; }
      }
      it.w = Math.max(6, Math.round(nw)); it.h = Math.max(4, Math.round(nh));
      guides = { layer: layerName, x: gx, y: gy, tip: { x: it.x + it.w + 6 / zoom, y: it.y + it.h, txt: it.w + ' × ' + it.h } };
      render();
    }
    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); guides = null; render(); if (moved) refreshProps(); }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  };

  /* box select: drag on empty canvas */
  ['canvas-frame', 'break-frame'].forEach(function (fid) {
    var frame = $(fid); if (!frame) return;
    var layerName = fid === 'canvas-frame' ? 'score' : 'break';
    frame.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (!(e.target === frame || e.target.classList.contains('canvas-scale') || e.target.classList.contains('canvas-grid'))) return;
      var add = e.shiftKey, keep = add ? selIds.slice() : [];
      activateLayer(layerName);
      var r = frame.getBoundingClientRect(), x0 = e.clientX - r.left, y0 = e.clientY - r.top, box = null;
      function onMove(ev) {
        var x1 = ev.clientX - r.left, y1 = ev.clientY - r.top;
        if (!box) { if (Math.abs(x1 - x0) < 4 && Math.abs(y1 - y0) < 4) return; box = document.createElement('div'); box.className = 'bt-marquee'; frame.appendChild(box); }
        var L = Math.min(x0, x1), T = Math.min(y0, y1);
        box.style.cssText = 'left:' + L + 'px;top:' + T + 'px;width:' + Math.abs(x1 - x0) + 'px;height:' + Math.abs(y1 - y0) + 'px;';
        var cx = L / zoom, cy = T / zoom, cw = Math.abs(x1 - x0) / zoom, ch = Math.abs(y1 - y0) / zoom;
        var hit = layers[layerName].elements.filter(function (el) {
          return !el.locked && el.x < cx + cw && el.x + el.w > cx && el.y < cy + ch && el.y + el.h > cy;
        }).map(function (el) { return el.id; });
        selIds = keep.concat(hit.filter(function (id) { return keep.indexOf(id) < 0; }));
        selectedId = selIds.length ? selIds[selIds.length - 1] : null;
        render();
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
        if (box) { box.remove(); refreshProps(); }
      }
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    }, true);
  });

  /* ════════════ EDIT ACTIONS ════════════ */
  function copySel() {
    var els = selEls(); if (!els.length) return;
    clip = { layer: activeLayer, items: clone(els) };
    try { localStorage.setItem('upbsa_builder_clip', JSON.stringify(clip)); } catch (e) { }
    showToast('Copied ' + els.length + ' element' + (els.length > 1 ? 's' : ''));
  }
  function paste(offset) {
    if (!clip) { try { clip = JSON.parse(localStorage.getItem('upbsa_builder_clip') || 'null'); } catch (e) { } }
    if (!clip || !clip.items.length) { showToast('Nothing to paste'); return; }
    pushUndo();
    var L = layers[activeLayer], z = maxZ(L), ids = [];
    var same = clip.layer === activeLayer, off = offset !== undefined ? offset : (same ? 16 : 0);
    clip.items.forEach(function (it, i) {
      var c = clone(it); c.id = genId(); c.x += off; c.y += off; c.zIndex = z + i + 1; delete c.locked;
      L.elements.push(c); ids.push(c.id);
    });
    if (same) clip.items.forEach(function (it) { it.x += off; it.y += off; });   // next paste steps again
    setSel(ids);
    showToast('Pasted ' + ids.length);
  }
  function duplicate() { var saved = clip; copySelQuiet(); paste(16); clip = saved; }
  function copySelQuiet() { var els = selEls(); if (els.length) clip = { layer: activeLayer, items: clone(els) }; }
  function cut() { copySel(); deleteSelected(); }

  var nudgeTimer = null;
  function nudge(dx, dy) {
    var els = selEls().filter(function (e) { return !e.locked; }); if (!els.length) return;
    if (!nudgeTimer) pushUndo();
    clearTimeout(nudgeTimer); nudgeTimer = setTimeout(function () { nudgeTimer = null; refreshProps(); }, 600);
    els.forEach(function (e) { e.x += dx; e.y += dy; });
    render();
  }
  function normaliseZ(L) {
    L.elements.slice().sort(function (a, b) { return (a.zIndex || 1) - (b.zIndex || 1); }).forEach(function (e, i) { e.zIndex = i + 1; });
  }
  function zOrder(how) {
    var L = layers[activeLayer], els = selEls(); if (!els.length) return;
    pushUndo(); normaliseZ(L);
    var order = L.elements.slice().sort(function (a, b) { return a.zIndex - b.zIndex; });
    var picked = order.filter(function (e) { return selIds.indexOf(e.id) >= 0; });
    var rest = order.filter(function (e) { return selIds.indexOf(e.id) < 0; });
    if (how === 'front') order = rest.concat(picked);
    else if (how === 'back') order = picked.concat(rest);
    else {
      var step = how === 'up' ? 1 : -1;
      var idxs = picked.map(function (p) { return order.indexOf(p); });
      if (step > 0) idxs.reverse();
      idxs.forEach(function (i) { var j = i + step; if (j < 0 || j >= order.length || selIds.indexOf(order[j].id) >= 0) return; var t = order[i]; order[i] = order[j]; order[j] = t; });
    }
    order.forEach(function (e, i) { e.zIndex = i + 1; });
    render(); refreshProps();
  }
  function mirrorEl(el) {
    var c = clone(el); c.id = genId();
    c.x = CANVAS_W - el.x - el.w;
    if (c.player == 1) c.player = 2; else if (c.player == 2) c.player = 1;
    if (c.type === 'break-p1') { c.type = 'break-p2'; } else if (c.type === 'break-p2') { c.type = 'break-p1'; }
    if (c.align === 'left') c.align = 'right'; else if (c.align === 'right') c.align = 'left';
    if (c.anchor === 'left') c.anchor = 'right'; else if (c.anchor === 'right') c.anchor = 'left';
    if (c.label) c.label = c.label.replace(/\bP1\b/g, '§').replace(/\bP2\b/g, 'P1').replace(/§/g, 'P2');
    return c;
  }
  function mirrorSel() {
    var els = selEls(); if (!els.length) return;
    pushUndo(); var L = layers[activeLayer], z = maxZ(L), ids = [];
    els.forEach(function (el, i) { var c = mirrorEl(el); c.zIndex = (el.zIndex || 1); L.elements.push(c); ids.push(c.id); });
    setSel(ids); showToast('Mirrored ' + ids.length + ' to the other side');
  }
  function mirrorLayout() {
    var L = layers[activeLayer], mid = CANVAS_W / 2;
    var left = L.elements.filter(function (e) { return e.x + e.w / 2 < mid - 2; });
    var right = L.elements.filter(function (e) { return e.x + e.w / 2 > mid + 2; });
    if (!left.length) { showToast('Nothing on the left half to mirror'); return; }
    if (!confirm('Copy the LEFT half of the ' + (activeLayer === 'score' ? 'score bar' : 'break panel') + ' onto the right half?\n\n' +
      left.length + ' element(s) will be mirrored (P1 → P2) and the ' + right.length + ' element(s) now on the right half will be replaced.\nElements in the centre are not touched. You can Undo this.')) return;
    pushUndo();
    L.elements = L.elements.filter(function (e) { return right.indexOf(e) < 0; });
    left.forEach(function (e) { L.elements.push(mirrorEl(e)); });
    selIds = []; selectedId = null; render(); _showPropsEmpty();
    showToast('Right half now mirrors the left half');
  }
  function alignSel(mode) {
    var els = selEls().filter(function (e) { return !e.locked; }); if (!els.length) return;
    pushUndo();
    var ref = els.length === 1 ? { x: 0, y: 0, w: CANVAS_W, h: layers[activeLayer].height } : bbox(els);
    els.forEach(function (e) {
      if (mode === 'left') e.x = ref.x; if (mode === 'hcenter') e.x = Math.round(ref.x + ref.w / 2 - e.w / 2); if (mode === 'right') e.x = ref.x + ref.w - e.w;
      if (mode === 'top') e.y = ref.y; if (mode === 'vcenter') e.y = Math.round(ref.y + ref.h / 2 - e.h / 2); if (mode === 'bottom') e.y = ref.y + ref.h - e.h;
    });
    render(); refreshProps();
  }
  function distribute(axis) {
    var els = selEls(); if (els.length < 3) { showToast('Select 3 or more elements to space them evenly'); return; }
    pushUndo();
    var k = axis === 'h' ? 'x' : 'y', s = axis === 'h' ? 'w' : 'h';
    els.sort(function (a, b) { return a[k] - b[k]; });
    var span = els[els.length - 1][k] + els[els.length - 1][s] - els[0][k], total = els.reduce(function (t, e) { return t + e[s]; }, 0);
    var gap = (span - total) / (els.length - 1), pos = els[0][k];
    els.forEach(function (e) { e[k] = Math.round(pos); pos += e[s] + gap; });
    render(); refreshProps();
  }
  function matchSize(dim) {
    var ref = findEl(selectedId), els = selEls(); if (!ref || els.length < 2) return;
    pushUndo(); els.forEach(function (e) { e[dim] = ref[dim]; }); render(); refreshProps();
  }
  function setFlag(key, val) {
    var els = selEls(); if (!els.length) return;
    pushUndo();
    var v = val === undefined ? !els.every(function (e) { return e[key]; }) : val;
    els.forEach(function (e) { if (v) e[key] = true; else delete e[key]; });
    if (key === 'locked' && v) { /* locked items stay selected via the list */ }
    render(); refreshProps();
  }
  function selectAll() { setSel(layers[activeLayer].elements.filter(function (e) { return !e.locked; }).map(function (e) { return e.id; })); }

  /* ════════════ KEYBOARD ════════════ */
  document.addEventListener('keydown', function (e) {
    if ($('pv-modal') && $('pv-modal').classList.contains('open')) {
      if (e.key === 'Escape' || (e.key === 'p' && !e.ctrlKey && !e.metaKey)) { e.preventDefault(); closePreview(); }
      return;
    }
    if (e.key === 'Escape') { hideCtx(); closeModal(); if (selIds.length) showPropsEmpty(); return; }
    if (inField(e)) return;
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); selIds = []; return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); selIds = []; return; }
    if (mod && k === 'c') { e.preventDefault(); copySel(); return; }
    if (mod && k === 'x') { e.preventDefault(); cut(); return; }
    if (mod && k === 'v') { e.preventDefault(); paste(); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
    if (mod && k === 'a') { e.preventDefault(); selectAll(); return; }
    if (mod && k === 'l') { e.preventDefault(); setFlag('locked'); return; }
    if (mod && k === 'h') { e.preventDefault(); setFlag('hidden'); return; }
    if (mod && k === 'm') { e.preventDefault(); mirrorSel(); return; }
    if (mod && e.key === ']') { e.preventDefault(); zOrder('front'); return; }
    if (mod && e.key === '[') { e.preventDefault(); zOrder('back'); return; }
    if (mod) return;
    if (e.key === ']') { zOrder('up'); return; }
    if (e.key === '[') { zOrder('down'); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { if (selIds.length) { e.preventDefault(); deleteSelected(); } return; }
    var st = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-st, 0); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); nudge(st, 0); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, -st); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, st); return; }
    if (k === 'p') { openPreview(); return; }
    if (e.key === '?') { showShortcuts(); return; }
  });

  /* ════════════ PROPERTIES: extra groups ════════════ */
  function opt(v, t, cur) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + t + '</option>'; }
  function appendExtras(el) {
    var pc = $('props-content'); if (!pc) return;
    var h = '';
    // behaviour
    h += '<div class="prop-group"><div class="prop-group-title">Behaviour</div>';
    h += '<div class="prop-row"><div class="prop-lbl">Name in Elements list</div><input class="prop-in" value="' + esc(el.label || '') + '" placeholder="' + esc(elName(Object.assign({}, el, { label: '' }))) + '" oninput="BT.prop(\'label\',this.value)"></div>';
    h += '<div class="prop-row"><div class="prop-lbl">Show when</div><select class="prop-select" onchange="BT.prop(\'showWhen\',this.value)">';
    SBLive.WHEN.forEach(function (o) { if (!el.player && /table|leading/.test(o[0])) return; h += opt(o[0], o[1], el.showWhen || 'always'); });
    h += '</select></div>';
    h += '<div class="prop-row"><div class="prop-lbl">Animation on OBS</div><div style="display:flex;gap:5px"><select class="prop-select" onchange="BT.prop(\'anim\',this.value)">';
    [['none', 'None'], ['pop', 'Pop when it changes'], ['flash', 'Flash when it changes'], ['slide', 'Slide in when it appears'], ['glow', 'Glow while player is at table'], ['pulse', 'Gentle pulse']].forEach(function (o) { h += opt(o[0], o[1], el.anim || 'none'); });
    h += '</select><button class="align-btn" style="flex:0 0 auto;padding:5px 9px" title="Preview" onclick="BT.playAnim()">▶</button></div></div>';
    if (SBLive.isText(el.type))
      h += '<div class="prop-row"><label class="bt-check"><input type="checkbox" ' + (el.fit !== false ? 'checked' : '') + ' onchange="BT.prop(\'fit\',this.checked?undefined:false)"> Shrink long text to fit the box</label></div>';
    if (el.type === 'rect' && (el.bgTop || el.bgBot)) {
      h += '<div class="prop-row"><div class="prop-lbl">Gradient direction</div><div class="prop-align-row">';
      [['v', 'Top → bottom'], ['h', 'Left → right']].forEach(function (o) { h += '<div class="align-btn' + ((el.gradDir || 'v') === o[0] ? ' on' : '') + '" onclick="BT.prop(\'gradDir\',\'' + o[0] + '\',true)">' + o[1] + '</div>'; });
      h += '</div></div>';
    }
    h += '</div>';
    // sponsor logos
    if (el.type === 'sponsor') {
      h += '<div class="prop-group"><div class="prop-group-title">Sponsor logos</div><div class="bt-logos">';
      (el.images || []).forEach(function (src, i) { h += '<div class="bt-logo"><img src="' + src + '"><button title="Remove" onclick="BT.removeLogo(' + i + ')">✕</button></div>'; });
      h += '</div><label class="tb-btn" style="display:block;text-align:center;margin:6px 0;cursor:pointer;position:relative">＋ Add logos<input type="file" accept="image/*" multiple style="position:absolute;inset:0;opacity:0;cursor:pointer" onchange="BT.addLogos(this)"></label>';
      h += '<div class="prop-row"><div class="prop-lbl">Seconds per logo</div><input class="prop-in" type="number" min="2" max="60" value="' + (el.interval || 6) + '" oninput="BT.prop(\'interval\',+this.value)"></div></div>';
    }
    // arrange
    h += '<div class="prop-group"><div class="prop-group-title">Arrange</div><div class="bt-grid4">';
    h += btn('⤒ Front', "BT.z('front')", 'Bring to front (Ctrl+])') + btn('↑ Up', "BT.z('up')", 'Forward (])') + btn('↓ Down', "BT.z('down')", 'Backward ([)') + btn('⤓ Back', "BT.z('back')", 'Send to back (Ctrl+[)');
    h += '</div><div class="bt-grid3" style="margin-top:5px">';
    h += btn('⇤ Centre', "BT.align('hcenter')", 'Centre left-right on the canvas') + btn('⇕ Middle', "BT.align('vcenter')", 'Centre top-bottom on the canvas') + btn('⧉ Copy', 'BT.duplicate()', 'Duplicate (Ctrl+D)');
    h += btn('⇋ Mirror', 'BT.mirror()', 'Make a mirrored copy for the other player (Ctrl+M)') + btn(el.locked ? '🔓 Unlock' : '🔒 Lock', "BT.flag('locked')", 'Lock so it cannot be moved by accident (Ctrl+L)') + btn(el.hidden ? '👁 Show' : '🚫 Hide', "BT.flag('hidden')", 'Hide on OBS (Ctrl+H)');
    h += '</div></div>';
    var del = pc.querySelector('.prop-del');
    if (del) del.insertAdjacentHTML('beforebegin', h); else pc.insertAdjacentHTML('beforeend', h);
  }
  function btn(t, fn, title) { return '<button class="align-btn" title="' + (title || '') + '" onclick="' + fn + '">' + t + '</button>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function showMulti() {
    var pe = $('props-empty'), pc = $('props-content'), els = selEls();
    if (pe) pe.style.display = 'none'; if (pc) pc.style.display = 'block';
    $('props-title').textContent = els.length + ' elements selected';
    $('props-sub').textContent = 'Shift+click to add or remove · drag to move together';
    var h = '<div class="prop-group"><div class="prop-group-title">Align</div><div class="bt-grid3">';
    h += btn('⇤ Left', "BT.align('left')") + btn('⇔ Centre', "BT.align('hcenter')") + btn('⇥ Right', "BT.align('right')");
    h += btn('⤒ Top', "BT.align('top')") + btn('⇕ Middle', "BT.align('vcenter')") + btn('⤓ Bottom', "BT.align('bottom')");
    h += '</div></div><div class="prop-group"><div class="prop-group-title">Spacing & size</div><div class="bt-grid2">';
    h += btn('↔ Space evenly', "BT.distribute('h')") + btn('↕ Space evenly', "BT.distribute('v')");
    h += btn('Same width', "BT.matchSize('w')", 'Make all as wide as the last one clicked') + btn('Same height', "BT.matchSize('h')", 'Make all as tall as the last one clicked');
    h += '</div></div><div class="prop-group"><div class="prop-group-title">Together</div>';
    var tc = els.filter(function (e) { return SBLive.isText(e.type); });
    if (tc.length) h += '<div class="prop-row"><div class="prop-lbl">Text colour (' + tc.length + ')</div><div class="prop-color-row"><input type="color" value="' + ((tc[0].color || '#ffffff').slice(0, 7)) + '" oninput="BT.bulk(\'color\',this.value)"></div></div>';
    h += '<div class="prop-row"><div class="prop-lbl">Show when</div><select class="prop-select" onchange="BT.bulk(\'showWhen\',this.value)"><option value="">— keep each one\'s setting —</option>';
    SBLive.WHEN.forEach(function (o) { h += opt(o[0], o[1], ''); });
    h += '</select></div><div class="bt-grid3">';
    h += btn('⧉ Copy', 'BT.duplicate()') + btn('⇋ Mirror', 'BT.mirror()') + btn('⤒ Front', "BT.z('front')");
    h += btn('🔒 Lock', "BT.flag('locked')") + btn('🚫 Hide', "BT.flag('hidden')") + btn('⤓ Back', "BT.z('back')");
    h += '</div></div><button class="prop-del" onclick="deleteSelected()">Delete ' + els.length + ' elements</button>';
    pc.innerHTML = h; showTab('props', true);
  }

  /* ════════════ RIGHT PANEL TABS + ELEMENTS LIST ════════════ */
  var curTab = 'props';
  function showTab(t, soft) {
    if (soft && curTab === 'list') return;     // stay on the list while picking from it
    curTab = t;
    document.querySelectorAll('.rp-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    var hdr = document.querySelector('.rp-header'), body = document.querySelector('.rp-body'), list = $('el-list-pane');
    if (hdr) hdr.style.display = t === 'props' ? '' : 'none';
    if (body) body.style.display = t === 'props' ? '' : 'none';
    if (list) list.style.display = t === 'list' ? 'flex' : 'none';
    if (t === 'list') renderList();
  }
  var sideQueued = false;
  function scheduleSide() {
    if (sideQueued) return; sideQueued = true;
    requestAnimationFrame(function () { sideQueued = false; if (curTab === 'list') renderList(); updateCount(); renderColours(); });
  }
  function updateCount() { var c = $('el-count'); if (c) c.textContent = layers.score.elements.length + layers.break.elements.length; }
  var dragRow = null;
  function renderList() {
    var box = $('el-list'); if (!box) return;
    document.querySelectorAll('.el-layer-btn').forEach(function (b) { b.classList.toggle('on', b.dataset.layer === activeLayer); });
    var L = layers[activeLayer];
    var rows = L.elements.slice().sort(function (a, b) { return (b.zIndex || 1) - (a.zIndex || 1); });
    if (!rows.length) { box.innerHTML = '<div class="sb-empty">No elements on this layer yet.<br>Drag some in from the left.</div>'; return; }
    box.innerHTML = '';
    rows.forEach(function (el) {
      var r = document.createElement('div');
      r.className = 'el-row' + (selIds.indexOf(el.id) >= 0 ? ' on' : '') + (el.hidden ? ' hid' : '');
      r.draggable = true; r.dataset.id = el.id;
      r.innerHTML = '<span class="el-grip">⋮⋮</span><span class="el-ic">' + (ICONS[el.type] || '◻') + '</span>' +
        '<span class="el-nm" title="Double-click to rename">' + esc(elName(el)) + '</span>' +
        (el.showWhen && el.showWhen !== 'always' ? '<span class="el-tag" title="Has a Show-when rule">IF</span>' : '') +
        (el.anim && el.anim !== 'none' ? '<span class="el-tag" title="Animated">✦</span>' : '') +
        '<button class="el-b" data-k="hidden" title="' + (el.hidden ? 'Show on OBS' : 'Hide on OBS') + '">' + (el.hidden ? '🚫' : '👁') + '</button>' +
        '<button class="el-b" data-k="locked" title="' + (el.locked ? 'Unlock' : 'Lock') + '">' + (el.locked ? '🔒' : '🔓') + '</button>';
      r.addEventListener('click', function (e) {
        var b = e.target.closest('.el-b');
        if (b) { e.stopPropagation(); pushUndo(); if (el[b.dataset.k]) delete el[b.dataset.k]; else el[b.dataset.k] = true; render(); if (selIds.length) refreshProps(); return; }
        if (e.shiftKey || e.ctrlKey || e.metaKey) { var i = selIds.indexOf(el.id); if (i >= 0) selIds.splice(i, 1); else selIds.push(el.id); setSel(selIds.slice()); }
        else setSel([el.id]);
      });
      r.addEventListener('dblclick', function () {
        var n = prompt('Name this element (shown only in the builder):', el.label || elName(el));
        if (n === null) return; pushUndo(); if (n.trim()) el.label = n.trim(); else delete el.label; render();
      });
      r.addEventListener('dragstart', function (e) { dragRow = el.id; r.classList.add('drag'); try { e.dataTransfer.setData('text/plain', 'row'); } catch (x) { } });
      r.addEventListener('dragend', function () { dragRow = null; r.classList.remove('drag'); });
      r.addEventListener('dragover', function (e) { if (!dragRow) return; e.preventDefault(); var rc = r.getBoundingClientRect(); r.classList.toggle('drop-above', e.clientY < rc.top + rc.height / 2); r.classList.toggle('drop-below', e.clientY >= rc.top + rc.height / 2); });
      r.addEventListener('dragleave', function () { r.classList.remove('drop-above', 'drop-below'); });
      r.addEventListener('drop', function (e) {
        e.preventDefault(); if (!dragRow || dragRow === el.id) return;
        var above = r.classList.contains('drop-above'); r.classList.remove('drop-above', 'drop-below');
        pushUndo();
        var order = rows.filter(function (x) { return x.id !== dragRow; }), moving = findEl(dragRow);
        var at = order.indexOf(el); order.splice(above ? at : at + 1, 0, moving);
        order.forEach(function (x, i) { x.zIndex = order.length - i; });   // top of list = front
        render();
      });
      box.appendChild(r);
    });
  }

  /* ════════════ RIGHT-CLICK MENU ════════════ */
  function hideCtx() { var m = $('bt-ctx'); if (m) m.style.display = 'none'; }
  function showCtx(x, y, items) {
    var m = $('bt-ctx');
    m.innerHTML = items.map(function (it) { return it === '-' ? '<div class="ctx-sep"></div>' : '<div class="ctx-it" data-a="' + it[0] + '"><span>' + it[1] + '</span><kbd>' + (it[2] || '') + '</kbd></div>'; }).join('');
    m.style.display = 'block';
    var r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  }
  var CTX = { copy: copySel, cut: cut, paste: function () { paste(); }, dup: duplicate, mirror: mirrorSel, front: function () { zOrder('front'); }, back: function () { zOrder('back'); },
    lock: function () { setFlag('locked'); }, hide: function () { setFlag('hidden'); }, del: deleteSelected, all: selectAll, preview: function () { openPreview(); }, mirrorLayout: mirrorLayout };
  ['canvas-frame', 'break-frame'].forEach(function (fid) {
    var f = $(fid); if (!f) return;
    f.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var lay = fid === 'canvas-frame' ? 'score' : 'break', d = e.target.closest('.cv-el');
      if (d) {
        if (lay !== activeLayer || selIds.indexOf(d.dataset.id) < 0) setSel([d.dataset.id], lay);
        var el = findEl(d.dataset.id);
        showCtx(e.clientX, e.clientY, [['dup', 'Duplicate', 'Ctrl+D'], ['copy', 'Copy', 'Ctrl+C'], ['cut', 'Cut', 'Ctrl+X'], ['paste', 'Paste', 'Ctrl+V'], '-',
          ['mirror', 'Mirror to other player', 'Ctrl+M'], ['front', 'Bring to front', 'Ctrl+]'], ['back', 'Send to back', 'Ctrl+['], '-',
          ['lock', el && el.locked ? 'Unlock' : 'Lock', 'Ctrl+L'], ['hide', el && el.hidden ? 'Show on OBS' : 'Hide on OBS', 'Ctrl+H'], '-', ['del', 'Delete', 'Del']]);
      } else {
        activateLayer(lay);
        showCtx(e.clientX, e.clientY, [['paste', 'Paste', 'Ctrl+V'], ['all', 'Select all', 'Ctrl+A'], '-', ['mirrorLayout', 'Copy left half onto right half…', ''], ['preview', 'Full-screen preview', 'P']]);
      }
    });
  });
  document.addEventListener('click', function (e) {
    var it = e.target.closest && e.target.closest('.ctx-it');
    if (it) { hideCtx(); (CTX[it.dataset.a] || function () { })(); return; }
    if (!e.target.closest || !e.target.closest('#bt-ctx')) hideCtx();
  });
  w.addEventListener('blur', hideCtx);

  /* ════════════ PREVIEW SCENARIOS ════════════ */
  var SCEN = [['demo', 'Sample match'], ['long', 'Very long names'], ['century', 'Century break'], ['decider', 'Deciding frame'],
    ['final', 'Shot clock — final seconds'], ['p2', 'Player 2 at the table'], ['nobreak', 'No break on'], ['won', 'Match won']];
  function scenarioData(v) {
    var d = clone(DEMO); d.status = 'active'; d.shotClockEnabled = true; d.matchId = 'PREVIEW';
    switch (v) {
      case 'long': d.player1.name = 'MOHAMMED SHAHNAWAZ SIDDIQUI'; d.player1.state = 'Jammu & Kashmir'; d.player2.name = 'VENKATESH RAMAKRISHNAN IYER'; d.player2.state = 'Andhra Pradesh';
        d.tournament = '2ND NATIONAL HEYBALL & SNOOKER CHAMPIONSHIP 2026 — QUARTER FINAL'; d.referee = 'Rajiv Kumar Srivastava'; break;
      case 'century': d.currentBreak = 124; d.player1.currentBreak = 124; d.breakPlayer = 1; d.player1.score = 124; d.player2.score = 8;
        d.breakBalls = []; for (var i = 0; i < 14; i++) d.breakBalls.push({ color: i % 2 ? 'black' : 'red', value: i % 2 ? 7 : 1 }); break;
      case 'decider': d.bestOf = 9; d.player1.frames = 4; d.player2.frames = 4; d.currentFrame = 9; break;
      case 'p2': d.turn = 2; d.breakPlayer = 2; d.currentBreak = 33; d.player1.currentBreak = 0; d.player2.currentBreak = 33; break;
      case 'nobreak': d.currentBreak = 0; d.player1.currentBreak = 0; d.breakBalls = []; break;
      case 'won': d.status = 'finished'; d.matchWinner = 1; d.player1.frames = 5; d.player2.frames = 3; d.currentBreak = 0; d.player1.currentBreak = 0; d.breakBalls = []; break;
    }
    return d;
  }
  getLiveData = function () {
    if (scenario.indexOf('live') === 0) return liveMatchData || DEMO;
    return scenarioData(scenario);
  };
  var previewClock = false;
  SBLive.demoState = function () {
    var base = { so: true, live: true, hasShot: true, sRem: 12400, sDur: 20000, warn: 5000, hasMatch: true, mRem: 1122000, mTot: 1800000,
      matchUp: false, endRule: 'finish', hasFrame: true, fRem: 375000, fTot: 600000, extCount: 1, ext: { p1: 1, p2: 0 } };
    if (previewClock) {               // full-screen preview: clocks really run
      var t = Date.now(); base.sRem = 20000 - (t % 20000); base.mRem = 1122000 - (t % 60000); base.fRem = 375000 - (t % 60000);
    }
    if (scenario === 'final') base.sRem = previewClock ? 5000 - (Date.now() % 5000) : 3200;
    if (scenario === 'decider') { base.mRem = 0; base.matchUp = true; }
    if (scenario === 'won') base.live = false;
    return base;
  };
  function setScenario(v) {
    scenario = v;
    if (v.indexOf('live') === 0) setPreviewTable(+v.slice(4));
    ['table-sel', 'pv-scen'].forEach(function (id) { var s = $(id); if (s && s.value !== v) s.value = v; });
    render(); if (selIds.length) refreshProps();
  }
  var prevRef = null;
  setPreviewTable = function (n) {
    activePreviewTable = n;
    if (prevRef) prevRef.off('value');
    prevRef = db.ref('matches/table-' + n);
    prevRef.on('value', function (s) { liveMatchData = s.val(); if (scenario.indexOf('live') === 0) render(); });
  };
  try { db.ref('matches/table-' + (activePreviewTable || 1)).off('value'); } catch (e) { }   // drop the old, never-removed listener
  liveMatchData = null;

  /* ════════════ FULL-SCREEN PREVIEW ════════════ */
  var pvTimer = null, pvAnim = false;
  function staticEl(el, m) {
    var d = document.createElement('div');
    d.style.cssText = 'position:absolute;overflow:hidden;box-sizing:border-box;left:' + el.x + 'px;top:' + el.y + 'px;width:' + el.w + 'px;height:' + el.h + 'px;z-index:' + (el.zIndex || 1) + ';opacity:' + (el.opacity !== undefined ? el.opacity : 1);
    applyElStyle(d, el);
    if (SBLive.isLive(el.type)) {
      if (el.type === 'shot-flash') { var r = SBLive.render(el, m, SBLive.demoState()); d.style.background = el.color || '#ff2a1a'; d.style.opacity = r.flash || 0; }
      else { var r2 = SBLive.render(el, m, SBLive.demoState()); if (r2.hide) d.style.visibility = 'hidden'; d.innerHTML = r2.html || ''; }
    } else { var c = getElContent(el); if (c !== null) d.innerHTML = c; }
    if (pvAnim) {
      if (el.anim === 'pop') d.classList.add('a-pop'); if (el.anim === 'flash') d.classList.add('a-flash'); if (el.anim === 'slide') d.classList.add('a-slide');
    }
    if (el.anim === 'glow' && el.player && el.player == m.turn) d.classList.add('a-glow');
    if (el.anim === 'pulse') d.classList.add('a-pulse');
    return d;
  }
  function layerBox(L, m) {
    var box = document.createElement('div');
    box.style.cssText = 'position:relative;width:1920px;height:' + L.height + 'px;overflow:hidden;background:' + hexOp(L.bgColor, L.bgOpacity) + ';border-top:' + (L.borderWidth || 0) + 'px solid ' + (L.borderColor || 'transparent') + ';';
    if (L.bgImage) { box.style.backgroundImage = 'url(' + L.bgImage + ')'; box.style.backgroundSize = 'cover'; box.style.backgroundPosition = 'center'; }
    L.elements.slice().sort(function (a, b) { return (a.zIndex || 1) - (b.zIndex || 1); }).forEach(function (el) {
      if (!SBLive.visible(el, m)) return;
      box.appendChild(staticEl(el, m));
    });
    return box;
  }
  function buildStage(stage, theme, scale) {
    var m = getLiveData(), L = theme;
    stage.innerHTML = '';
    var wrap = document.createElement('div'); wrap.style.cssText = 'position:absolute;left:0;bottom:0;width:1920px;';
    if (L.break && L.break.visible !== false && (m.currentBreak || 0) > 0) wrap.appendChild(layerBox(L.break, m));
    wrap.appendChild(layerBox(L.score, m));
    stage.appendChild(wrap);
    // fit text after it is in the page
    wrap.querySelectorAll(':scope > div > div').forEach(function (d) { if (d.firstElementChild) SBLive.fit(d); });
  }
  function openPreview() {
    var mdl = $('pv-modal'); if (!mdl) return;
    mdl.classList.add('open'); previewClock = true; pvAnim = true;
    var sc = $('pv-scen'); if (sc) sc.value = scenario;
    drawPreview(); setTimeout(function () { pvAnim = false; }, 120);
    clearInterval(pvTimer); pvTimer = setInterval(drawPreview, 120);
  }
  function closePreview() { var mdl = $('pv-modal'); if (mdl) mdl.classList.remove('open'); clearInterval(pvTimer); previewClock = false; render(); }
  function drawPreview() {
    var host = $('pv-host'), stage = $('pv-stage'); if (!host || !stage) return;
    var s = Math.min(host.clientWidth / 1920, host.clientHeight / 1080);
    stage.style.transform = 'scale(' + s + ')';
    stage.style.left = Math.max(0, (host.clientWidth - 1920 * s) / 2) + 'px'; stage.style.top = Math.max(0, (host.clientHeight - 1080 * s) / 2) + 'px';
    var bg = ($('pv-bg') || {}).value || 'felt'; stage.className = 'pv-stage bg-' + bg;
    buildStage(stage, layers, s);
  }
  function playAnims() { pvAnim = true; drawPreview(); setTimeout(function () { pvAnim = false; }, 150); }
  function playAnimOne() {
    var el = findEl(selectedId); if (!el) return;
    var d = document.querySelector('.cv-el[data-id="' + el.id + '"]'); if (!d) return;
    var cls = { pop: 'a-pop', flash: 'a-flash', slide: 'a-slide', glow: 'a-glow', pulse: 'a-pulse' }[el.anim || 'none'];
    if (!cls) { showToast('Pick an animation first'); return; }
    d.classList.remove(cls); void d.offsetWidth; d.classList.add(cls);
  }

  /* ════════════ DESIGN COLOURS ════════════ */
  var COLOR_KEYS = ['color', 'activeColor', 'bgColor', 'bgTop', 'bgBot', 'borderColor', 'glowColor', 'warnColor', 'dangerColor'];
  function normCol(c) { if (typeof c !== 'string') return null; c = c.trim().toLowerCase(); if (/^#[0-9a-f]{3}$/.test(c)) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return c || null; }
  function collectColours() {
    var map = {};
    function add(c) { c = normCol(c); if (!c || c === 'transparent') return; map[c] = (map[c] || 0) + 1; }
    ['score', 'break'].forEach(function (k) {
      var L = layers[k]; if (L.bgOpacity !== 0) add(L.bgColor); if (L.borderWidth) add(L.borderColor);
      L.elements.forEach(function (el) {
        COLOR_KEYS.forEach(function (key) {
          if (key === 'bgColor' && !(el.bgOpacity > 0) && el.type !== 'rect' && el.type !== 'rect-angled' && el.type !== 'rect-slant') return;
          if (key === 'borderColor' && !el.borderWidth) return;
          if (key === 'glowColor' && !el.glowSize) return;
          if (el[key]) add(el[key]);
        });
      });
    });
    return Object.keys(map).sort(function (a, b) { return map[b] - map[a]; }).map(function (c) { return { c: c, n: map[c] }; });
  }
  var colourSig = '';
  function renderColours() {
    var box = $('dc-list'); if (!box) return;
    var cols = collectColours(), sig = JSON.stringify(cols); if (sig === colourSig) return; colourSig = sig;
    box.innerHTML = cols.slice(0, 18).map(function (o) {
      var hex = /^#[0-9a-f]{6}/.test(o.c);
      return '<label class="dc-sw" title="' + o.c + ' · used ' + o.n + '×' + (hex ? ' — click to change everywhere' : ' — click to replace') + '" style="--c:' + o.c + '">' +
        (hex ? '<input type="color" value="' + o.c.slice(0, 7) + '" data-old="' + o.c + '" onfocus="BT.colStart(this)" oninput="BT.colLive(this)">' : '<span onclick="BT.colPrompt(\'' + o.c + '\')"></span>') +
        '<i>' + o.n + '</i></label>';
    }).join('') || '<div class="sb-empty">No colours yet</div>';
  }
  var colOld = null;
  function replaceColour(oldC, newC) {
    ['score', 'break'].forEach(function (k) {
      var L = layers[k];
      if (normCol(L.bgColor) === oldC) L.bgColor = newC; if (normCol(L.borderColor) === oldC) L.borderColor = newC;
      L.elements.forEach(function (el) { COLOR_KEYS.forEach(function (key) { if (normCol(el[key]) === oldC) el[key] = newC; }); });
    });
    syncLayerControls(); render();
  }

  /* ════════════ EXTRA SHAPES ════════════ */
  var SHAPES = {
    'pill': { base: 'rect', props: { w: 260, h: 56, borderRadius: 999, bgColor: '#f0c040', bgOpacity: 100 } },
    'circle': { base: 'rect', props: { w: 80, h: 80, borderRadius: 999, bgColor: '#f0c040', bgOpacity: 100 } },
    'rect-slant': { base: 'rect-slant', props: { w: 300, h: 80, bgColor: '#f0c040', bgOpacity: 100 } },
    'grad-strip': { base: 'rect', props: { w: 900, h: 8, bgTop: '#f0c040', bgBot: '#ff8a3d', gradDir: 'h', bgColor: '#f0c040', bgOpacity: 100, borderRadius: 4, label: 'Gradient Strip' } },
    'sponsor': { base: 'sponsor', props: { w: 220, h: 80, images: [], interval: 6, bgOpacity: 0 } }
  };
  var _drop = dropOnCanvas;
  dropOnCanvas = function (e) {
    var t = libDragType, sh = SHAPES[t];
    if (sh) libDragType = sh.base;
    var base = libDragType;
    _drop(e);
    libDragType = base;
    // new boxes use their colour, not a hidden grey gradient (that made the colour picker look broken)
    var made = selectedId && findEl(selectedId);
    if (made && /^rect/.test(made.type) && libDragType !== 'score-box-3d') { delete made.bgTop; delete made.bgBot; }
    if (sh && selectedId) {
      var el = findEl(selectedId), cx = el.x + el.w / 2, cy = el.y + el.h / 2;
      Object.keys(sh.props).forEach(function (k) { el[k] = clone(sh.props[k]); });
      el.x = Math.max(0, Math.round(cx - el.w / 2)); el.y = Math.max(0, Math.round(cy - el.h / 2));
      render(); showProps(el);
    }
    libDragType = null;
    selIds = selectedId ? [selectedId] : [];
    if (made && /^rect/.test(made.type)) render();
  };

  /* ════════════ LIBRARY: thumbnails, history, export / import, per-table ════════════ */
  var thumbCache = {};
  function thumbFor(key, t) {
    var sig = key + ':' + (t.updatedAt || 0);
    if (thumbCache[sig]) return thumbCache[sig].cloneNode(true);
    var norm = normaliseTheme(t); if (!norm) return null;
    var L = norm.score, m = scenarioData('demo');
    var els = L.elements.filter(function (e) { return SBLive.visible(e, m); });
    var full = (L.bgOpacity === undefined || L.bgOpacity > 20) || !els.length;
    var b = full ? { x: 0, y: 0, w: CANVAS_W, h: L.height } : bbox(els);
    var W = 236, H = 44, s = Math.min(W / b.w, H / b.h);
    var outer = document.createElement('div'); outer.className = 'sb-thumb';
    var inner = document.createElement('div');
    inner.style.cssText = 'position:absolute;left:' + ((W - b.w * s) / 2) + 'px;top:' + ((H - b.h * s) / 2) + 'px;width:' + b.w + 'px;height:' + b.h + 'px;transform:scale(' + s + ');transform-origin:0 0;overflow:hidden;';
    var lb = layerBox(L, m); lb.style.position = 'absolute'; lb.style.left = (-b.x) + 'px'; lb.style.top = (-b.y) + 'px';
    inner.appendChild(lb); outer.appendChild(inner);
    thumbCache[sig] = outer;
    return outer.cloneNode(true);
  }
  var _rtl = renderThemeList;
  renderThemeList = function () {
    _rtl();
    document.querySelectorAll('#theme-list .sb-item').forEach(function (d) {
      var k = d.dataset.key, t = savedThemes[k]; if (!k || !t) return;
      var th = thumbFor(k, t); if (th) { d.classList.add('has-thumb'); d.insertBefore(th, d.firstChild); }
      var sw = d.querySelector('.sb-swatch'); if (sw && th) sw.remove();
      var meta = d.querySelector('.sb-meta');
      if (meta && tableLive[k]) meta.insertAdjacentHTML('afterbegin', '<span class="sb-live">● LIVE · ' + tableLive[k].join(' ') + '</span>');
      var acts = d.querySelector('.sb-acts');
      if (acts) { var h = document.createElement('button'); h.className = 'sb-btn'; h.title = 'Version history'; h.textContent = '🕘'; h.addEventListener('click', function (e) { e.stopPropagation(); openHistory(k); }); acts.insertBefore(h, acts.lastChild); }
    });
  };

  // version history — every save keeps a copy (last 15 per scoreboard)
  var KEEP = 15;
  function recordVersion(key) {
    var t = buildTheme(); t.name = curName(); var at = Date.now();
    var ref = db.ref('design/history/' + key).push();
    ref.set({ name: t.name, mode: t.mode || 'snooker', layers: t.layers, savedAt: at }).then(function () {
      return db.ref('design/historyIndex/' + key + '/' + ref.key).set(at);
    }).then(function () {
      return db.ref('design/historyIndex/' + key).once('value');
    }).then(function (s) {
      var idx = s.val() || {}, ids = Object.keys(idx).sort(function (a, b) { return idx[a] - idx[b]; });
      ids.slice(0, Math.max(0, ids.length - KEEP)).forEach(function (id) {
        db.ref('design/history/' + key + '/' + id).remove(); db.ref('design/historyIndex/' + key + '/' + id).remove();
      });
    }).catch(function (e) { console.warn('history', e); });
  }
  var _save = saveTheme;
  saveTheme = function (asNew) {
    var p = _save(asNew);
    p.then(function (key) {
      recordVersion(key);
      // keep per-table copies of this scoreboard up to date
      Object.keys(tableSlots).forEach(function (n) {
        ['snooker', 'shootout'].forEach(function (mode) {
          var sl = tableSlots[n] && tableSlots[n][mode];
          if (sl && sl.sourceKey === key && !asNew) { var t = buildTheme(); t.name = curName(); t.sourceKey = key; db.ref('design/tables/' + n + '/' + mode).set(t); }
        });
      });
    }).catch(function () { });
    return p;
  };
  function openHistory(key) {
    var t = savedThemes[key] || {};
    modal('<h3>🕘 Versions of "' + esc(t.name || key) + '"</h3><p>Every save keeps a copy (the last ' + KEEP + '). Open one to look at it; press 💾 Save to make it the current version.</p><div id="hist-list" class="hist-list"><div class="sb-empty">Loading…</div></div><div class="bt-mbtns"><button class="um-btn" onclick="BT.closeModal()">Close</button></div>');
    db.ref('design/historyIndex/' + key).once('value').then(function (s) {
      var idx = s.val() || {}, ids = Object.keys(idx).sort(function (a, b) { return idx[b] - idx[a]; });
      var box = $('hist-list'); if (!box) return;
      if (!ids.length) { box.innerHTML = '<div class="sb-empty">No earlier versions yet — they are kept from now on, each time you save.</div>'; return; }
      box.innerHTML = ids.map(function (id, i) {
        return '<div class="hist-row"><span>' + (i === 0 ? '<b>Latest</b> · ' : '') + new Date(idx[id]).toLocaleString() + '</span><button class="sb-btn go" onclick="BT.openVersion(\'' + key + '\',\'' + id + '\')">Open</button></div>';
      }).join('');
    });
  }
  function openVersion(key, id) {
    db.ref('design/history/' + key + '/' + id).once('value').then(function (s) {
      var v = s.val(); var norm = v && normaliseTheme(v); if (!norm) { showToast('Could not open that version'); return; }
      if (currentKey !== key && !confirmLeave()) return;
      pushUndo(); useLayers(norm); currentKey = key;
      var t = savedThemes[key]; var sn = t && normaliseTheme(t); savedHash = sn ? hashOf(sn) : null;
      $('theme-name-input').value = v.name || ''; setMode(v.mode, true); setSvState(); closeModal(); renderThemeList();
      showToast('Opened the version from ' + new Date(v.savedAt).toLocaleString() + ' — press 💾 Save to restore it');
    });
  }

  // export / import a design file
  function exportDesign() {
    var t = buildTheme(); t.name = curName() || 'Scoreboard';
    var blob = new Blob([JSON.stringify({ format: 'upbsa-scoreboard', version: 1, exportedAt: new Date().toISOString(), design: t }, null, 1)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (t.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'scoreboard') + '.upbsa.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    showToast('Downloaded "' + a.download + '"');
  }
  function importDesign(input) {
    var f = input.files && input.files[0]; input.value = ''; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var j = JSON.parse(r.result), t = j.design || j, norm = normaliseTheme(t);
        if (!norm) throw new Error('not a scoreboard design');
        if (!confirmLeave()) return;
        pushUndo(); useLayers(norm); currentKey = null; savedHash = null; draftHashAtLoad = null;
        $('theme-name-input').value = (t.name || 'Imported') + ' (imported)'; setMode(t.mode, true); setSvState(); renderThemeList();
        showToast('Imported — press 💾 Save to add it to My Scoreboards');
      } catch (e) { showToast('⚠ That file is not a UPBSA scoreboard design'); }
    };
    r.readAsText(f);
  }

  // per-table designs
  db.ref('design/tables').on('value', function (s) {
    tableSlots = s.val() || {}; tableLive = {};
    Object.keys(tableSlots).forEach(function (n) {
      ['snooker', 'shootout'].forEach(function (mode) {
        var sl = tableSlots[n][mode]; if (!sl || !sl.sourceKey) return;
        (tableLive[sl.sourceKey] = tableLive[sl.sourceKey] || []).push('T' + n);
      });
    });
    renderThemeList(); renderTableSlots();
  });
  function liveTarget() { var s = $('live-target'); return s ? s.value : 'all'; }
  var _apply = applyToOBS;
  applyToOBS = function () {
    var tgt = liveTarget(); if (tgt === 'all') return _apply();
    saveTheme(false).then(function (key) {
      var t = buildTheme(); t.name = curName(); t.sourceKey = key; t.updatedAt = Date.now();
      return db.ref('design/tables/' + tgt + '/' + designMode).set(t).then(function () {
        showToast('"' + t.name + '" is now LIVE on Table ' + tgt + (designMode === 'shootout' ? ' (Shoot Out matches)' : '') + ' ✓');
      });
    }).catch(function () { });
  };
  function renderTableSlots() {
    var box = $('tbl-slots'); if (!box) return;
    var rows = [];
    Object.keys(tableSlots).sort().forEach(function (n) {
      ['snooker', 'shootout'].forEach(function (mode) {
        var sl = tableSlots[n][mode]; if (!sl) return;
        rows.push('<div class="ts-row"><span><b>T' + n + '</b>' + (mode === 'shootout' ? ' ⏱' : '') + ' · ' + esc(sl.name || 'Design') + '</span><button class="sb-btn del" title="Table ' + n + ' goes back to the all-tables design" onclick="BT.clearTable(' + n + ',\'' + mode + '\')">✕</button></div>');
      });
    });
    box.innerHTML = rows.length ? '<div class="prop-lbl" style="margin:8px 0 4px">Tables with their own design</div>' + rows.join('') : '';
  }
  function clearTable(n, mode) {
    if (!confirm('Table ' + n + ' will go back to the all-tables ' + (mode === 'shootout' ? 'Shoot Out ' : '') + 'design. OK?')) return;
    db.ref('design/tables/' + n + '/' + mode).remove().then(function () { showToast('Table ' + n + ' uses the all-tables design again'); });
  }

  /* ════════════ MODALS & HELP ════════════ */
  function modal(html) { var m = $('bt-modal'); $('bt-modal-box').innerHTML = html; m.classList.add('open'); }
  function closeModal() { var m = $('bt-modal'); if (m) m.classList.remove('open'); }
  function showShortcuts() {
    var rows = [['Click / Shift+click', 'Select / add to selection'], ['Drag on empty canvas', 'Box-select'], ['Arrows · Shift+arrows', 'Nudge 1px · 10px'],
      ['Shift while dragging', 'Move in a straight line'], ['Alt while dragging', 'Turn snapping off'], ['Shift while resizing', 'Keep proportions'],
      ['Ctrl+C · X · V', 'Copy · cut · paste'], ['Ctrl+D', 'Duplicate'], ['Ctrl+M', 'Mirror copy for the other player'], ['Delete', 'Delete'],
      ['Ctrl+Z · Ctrl+Y', 'Undo · redo'], ['Ctrl+A', 'Select all'], ['[ · ]', 'Send backward · bring forward'], ['Ctrl+[ · Ctrl+]', 'Send to back · bring to front'],
      ['Ctrl+L · Ctrl+H', 'Lock · hide on OBS'], ['P', 'Full-screen preview'], ['Ctrl+S', 'Save'], ['Right-click', 'More actions']];
    modal('<h3>⌨ Keyboard shortcuts</h3><div class="kb-list">' + rows.map(function (r) { return '<div><kbd>' + r[0] + '</kbd><span>' + r[1] + '</span></div>'; }).join('') + '</div><div class="bt-mbtns"><button class="um-btn primary" onclick="BT.closeModal()">Got it</button></div>');
  }

  /* ════════════ PUBLIC (used by onclick handlers) ════════════ */
  w.BT = {
    prop: function (k, v, rerenderProps) {
      var el = findEl(selectedId); if (!el) return;
      if (v === undefined || v === '' && k === 'label') delete el[k]; else el[k] = v;
      render(); if (rerenderProps || k === 'showWhen' || k === 'anim') refreshProps();
    },
    bulk: function (k, v) { if (v === '') return; var els = selEls(); if (!els.length) return; if (!BT._bulkUndo) { pushUndo(); BT._bulkUndo = setTimeout(function () { BT._bulkUndo = null; }, 800); } els.forEach(function (e) { if (k !== 'color' || SBLive.isText(e.type)) e[k] = v; }); render(); },
    layerBox: layerBox, demoData: scenarioData,
    z: zOrder, align: alignSel, distribute: distribute, matchSize: matchSize, duplicate: duplicate, mirror: mirrorSel, mirrorLayout: mirrorLayout,
    flag: setFlag, playAnim: playAnimOne, playAnims: playAnims, preview: openPreview, closePreview: closePreview, drawPreview: function () { if ($('pv-modal').classList.contains('open')) drawPreview(); },
    scenario: setScenario, tab: showTab, layer: function (l) { activateLayer(l); selIds = []; selectedId = null; render(); _showPropsEmpty(); renderList(); },
    shortcuts: showShortcuts, closeModal: closeModal, openVersion: openVersion, exportDesign: exportDesign, importDesign: importDesign, clearTable: clearTable,
    addLogos: function (input) {
      var el = findEl(selectedId), files = [].slice.call(input.files || []); input.value = ''; if (!el || !files.length) return;
      var left = files.length; pushUndo(); el.images = el.images || [];
      files.forEach(function (f) { var r = new FileReader(); r.onload = function () { shrinkImage(r.result, 800, function (small) { el.images.push(small); if (--left === 0) { render(); refreshProps(); showToast(files.length + ' logo(s) added'); } }); }; r.readAsDataURL(f); });
    },
    removeLogo: function (i) { var el = findEl(selectedId); if (!el || !el.images) return; pushUndo(); el.images.splice(i, 1); render(); refreshProps(); },
    colStart: function (inp) { colOld = inp.dataset.old; inp._undo = false; },
    colLive: function (inp) { if (!inp._undo) { pushUndo(); inp._undo = true; } var nv = inp.value.toLowerCase(); replaceColour(colOld, nv); colOld = nv; inp.dataset.old = nv; },
    colPrompt: function (c) { var nv = prompt('Replace ' + c + ' everywhere in this design with:', c); if (!nv || nv === c) return; pushUndo(); replaceColour(c, nv.trim()); },
    _clearSel: function () { selIds = []; },
    select: function (ids) { setSel(ids); },
    get selection() { return selIds.slice(); }
  };

  /* initial paint with the new pieces */
  var ts = $('table-sel'); if (ts) ts.value = scenario;
  render(); updateCount(); renderColours(); renderThemeList(); renderTableSlots();
})(window);

/* undo / redo also clear the multi-selection */
(function () {
  var _u = undo, _r = redo;
  // keep whatever is still there selected, so the properties panel doesn't go blank
  function keepSel(fn) {
    var keep = window.BT ? BT.selection : [];
    fn();
    if (!window.BT) return;
    BT._clearSel();
    var ok = keep.filter(function (id) { return !!findEl(id); });
    if (ok.length) BT.select(ok);
  }
  undo = function () { keepSel(_u); };
  redo = function () { keepSel(_r); };
})();
