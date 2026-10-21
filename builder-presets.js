/* UPBSA.TV — scoreboard presets (v2)
   A fresh set of ready-made designs, plus preset cards that show a real
   preview of each design instead of a coloured stripe.
   Loaded after builder-tools2.js. */
(function (w) {
  'use strict';
  var CW = 1920;
  var COND = 'Barlow Condensed', BEBAS = 'Bebas Neue';

  function ext(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  /* element helpers ------------------------------------------------------ */
  function box(x, y, wd, h, o) { return ext({ type: 'rect', player: 0, x: x, y: y, w: wd, h: h, bgOpacity: 100, zIndex: 2 }, o); }
  function txt(type, p, x, y, wd, h, o) {
    return ext({ type: type, player: p, x: x, y: y, w: wd, h: h, fontFamily: COND, fontWeight: 800, fontSize: 20, color: '#ffffff',
      textTransform: 'uppercase', letterSpacing: 0, align: 'center', zIndex: 5 }, o);
  }
  function num(type, p, x, y, wd, h, size, color, o) { return txt(type, p, x, y, wd, h, ext({ fontFamily: BEBAS, fontWeight: 400, fontSize: size, color: color, textTransform: 'none' }, o)); }
  function smart(tpl, x, y, wd, h, o) { return txt('smart-text', 0, x, y, wd, h, ext({ template: tpl }, o)); }
  function turn(p, x, y, wd, h, color, o) { return box(x, y, wd, h, ext({ player: p, bgColor: color, showWhen: 'at-table', zIndex: 6 }, o)); }

  /* mirror a Player-1 element onto the Player-2 side */
  function mirror(el) {
    var m = JSON.parse(JSON.stringify(el));
    m.x = CW - el.x - el.w;
    if (m.player == 1) m.player = 2; else if (m.player == 2) m.player = 1;
    if (m.align === 'left') m.align = 'right'; else if (m.align === 'right') m.align = 'left';
    if (m.type === 'rect-slant') m.type = 'rect-angled'; else if (m.type === 'rect-angled') m.type = 'rect-slant';
    if (m.gradDir === 'h' && (m.bgTop || m.bgBot)) { var t = m.bgTop; m.bgTop = m.bgBot; m.bgBot = t; }
    return m;
  }
  /* shared elements + Player-1 side (mirrored to Player 2, with optional P2 colour changes) */
  function build(center, p1, p2fix) {
    var out = center.slice();
    p1.forEach(function (el, i) { out.push(el); var m = mirror(el); if (p2fix && p2fix[i]) m = ext(m, p2fix[i]); out.push(m); });
    return out;
  }
  function ids(list, pre) { list.forEach(function (el, i) { el.id = pre + (i + 1); }); return list; }
  function layer(h, els, o) { return ext({ height: h, bgColor: '#000000', bgOpacity: 0, borderColor: '#000000', borderWidth: 0, elements: ids(els, 'e') }, o); }
  function brk(h, els, o) { return ext({ height: h, bgColor: '#000000', bgOpacity: 0, borderColor: '#000000', borderWidth: 0, visible: true, elements: ids(els, 'b') }, o); }

  var DIM = 'rgba(255,255,255,.45)', SHADOW = 'rgba(0,0,0,.55)';
  var P = {};

  /* 1 ── TOUR GOLD: floating centre bug, gold score slabs */
  P.tour = { name: 'Tour Gold', tag: 'Floating centre bug · gold score slabs', accent: '#f0c040',
    score: layer(136, build([
      box(760, 0, 400, 28, { bgColor: '#0b0f1a', borderRadius: 6, zIndex: 1 }),
      txt('tournament', 0, 770, 1, 380, 20, { fontSize: 13, color: '#e6c35c', letterSpacing: 3 }),
      box(330, 20, 1260, 70, { bgColor: '#0b0f1a', bgTop: '#171d2e', bgBot: '#0a0d16', borderRadius: 6, borderColor: 'rgba(255,255,255,.08)', borderWidth: 1, glowColor: SHADOW, glowSize: 22 }),
      num('best-of', 0, 920, 26, 80, 36, 28, 'rgba(255,255,255,.6)'),
      txt('frame-num', 0, 900, 60, 120, 22, { fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.38)', letterSpacing: 2 })
    ], [
      box(330, 90, 630, 2, { bgColor: '#f0c040', bgTop: 'rgba(240,192,64,0)', bgBot: '#f0c040', gradDir: 'h', zIndex: 3 }),
      box(840, 20, 78, 70, { bgColor: '#ffffff', bgOpacity: 6, zIndex: 3 }),
      num('frames', 1, 840, 20, 78, 70, 54, '#ffffff'),
      box(728, 20, 112, 70, { bgColor: '#f0c040', bgTop: '#f8d873', bgBot: '#c8951a', zIndex: 3 }),
      num('score-plain', 1, 728, 20, 112, 70, 60, '#0b0b0b', { activeColor: '#0b0b0b', shadow: false }),
      txt('player-name', 1, 370, 24, 346, 42, { fontSize: 34, fontWeight: 900, align: 'right', letterSpacing: 1, activeColor: '#ffffff', at: { on: true, color: '#f8d873' } }),
      txt('state', 1, 370, 64, 346, 22, { fontSize: 14, fontWeight: 700, color: DIM, letterSpacing: 3, align: 'right' }),
      turn(1, 330, 20, 6, 70, '#f0c040', { glowColor: '#f0c040', glowSize: 10 })
    ])),
    brk: brk(58, [
      box(650, 6, 620, 46, { bgColor: '#0b0f1a', borderRadius: 6, borderColor: 'rgba(240,192,64,.45)', borderWidth: 1, glowColor: SHADOW, glowSize: 18, zIndex: 1 }),
      txt('break-who', 0, 668, 6, 262, 46, { fontSize: 15, color: '#e6c35c', letterSpacing: 2, align: 'right' }),
      num('break-val', 0, 934, 6, 96, 46, 42, '#ffffff'),
      ext(box(1034, 10, 226, 38), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* 2 ── CORNER PRO: two-row corner scoreboard */
  function cornerRow(p, y) {
    return [
      turn(p, 48, y, 6, 51, '#f2c230'),
      txt('player-name', p, 64, y, 318, 51, { fontSize: 28, align: 'left', letterSpacing: 1, activeColor: '#ffffff' }),
      box(386, y, 62, 51, { bgColor: '#ffffff', bgOpacity: 7, zIndex: 3 }),
      num('frames', p, 386, y, 62, 51, 40, '#ffffff'),
      box(448, y, 100, 51, { player: p, bgColor: '#1c2330', zIndex: 3, at: { on: true, bgColor: '#f2c230' } }),
      num('score-plain', p, 448, y, 100, 51, 44, '#ffffff', { activeColor: '#111111' })
    ];
  }
  P.corner = { name: 'Corner Pro', tag: 'Two-row corner board · keeps the table clear', accent: '#d4001a',
    score: layer(196, [
      box(48, 10, 500, 26, { bgColor: '#d4001a' }),
      txt('tournament', 0, 54, 10, 300, 26, { fontSize: 13, letterSpacing: 2, align: 'left' }),
      smart('FRAME {frame} · BEST OF {bestOf}', 350, 10, 192, 26, { fontSize: 13, letterSpacing: 1, align: 'right' }),
      box(48, 36, 500, 103, { bgColor: '#0b0e14', bgOpacity: 96, zIndex: 1, glowColor: SHADOW, glowSize: 20 }),
      box(48, 87, 500, 1, { bgColor: '#ffffff', bgOpacity: 10, zIndex: 4 })
    ].concat(cornerRow(1, 36), cornerRow(2, 88), [
      box(48, 139, 500, 26, { bgColor: '#0b0e14', bgOpacity: 85, zIndex: 1 }),
      smart('REDS LEFT {reds}  ·  POINTS REMAINING {ptsLeft}', 56, 139, 484, 26, { fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.6)', letterSpacing: 2, align: 'left' })
    ])),
    brk: brk(56, [
      box(48, 6, 500, 44, { bgColor: '#0b0e14', bgOpacity: 96, zIndex: 1 }),
      box(48, 6, 6, 44, { bgColor: '#d4001a' }),
      txt('break-who', 0, 60, 6, 150, 44, { fontSize: 14, color: '#f2c230', letterSpacing: 1, align: 'left' }),
      num('break-val', 0, 208, 6, 72, 44, 38, '#ffffff'),
      ext(box(284, 9, 258, 38), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* 3 ── GLASS: see-through pill */
  var GL = '#7df9ff';
  P.glass = { name: 'Glass', tag: 'See-through pill · minimal', accent: GL,
    score: layer(124, build([
      box(520, 26, 880, 64, { bgColor: '#0a0a0a', bgOpacity: 55, borderRadius: 999, borderColor: 'rgba(255,255,255,.22)', borderWidth: 1, glowColor: 'rgba(0,0,0,.35)', glowSize: 30, zIndex: 1 }),
      box(890, 34, 140, 48, { bgColor: '#ffffff', borderRadius: 999, zIndex: 3 }),
      smart('{p1.frames}  –  {p2.frames}', 890, 34, 140, 48, { fontFamily: BEBAS, fontWeight: 400, fontSize: 36, color: '#0a0a0a', letterSpacing: 2 }),
      smart('FRAME {frame}  ·  BEST OF {bestOf}', 830, 94, 260, 22, { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.75)', letterSpacing: 3, bgColor: '#000000', bgOpacity: 45, borderRadius: 999 })
    ], [
      txt('player-name', 1, 552, 26, 236, 64, { fontSize: 30, fontWeight: 700, align: 'right', letterSpacing: 1, activeColor: '#ffffff' }),
      num('score-plain', 1, 792, 26, 92, 64, 50, '#ffffff', { activeColor: GL }),
      turn(1, 808, 80, 60, 3, GL, { borderRadius: 2, glowColor: GL, glowSize: 10 })
    ])),
    brk: brk(56, [
      box(760, 6, 400, 44, { bgColor: '#0a0a0a', bgOpacity: 55, borderRadius: 999, borderColor: 'rgba(255,255,255,.22)', borderWidth: 1, zIndex: 1 }),
      txt('custom-text', 0, 780, 6, 80, 44, { text: 'BREAK', fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,.65)' }),
      num('break-val', 0, 856, 6, 68, 44, 36, GL),
      ext(box(924, 9, 226, 38), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* 4 ── BAIZE: green cloth, wood rail, cream score plates */
  var CREAM = '#f6efd9', FELT = '#0c3a1d', BRASS = '#e9c46a';
  P.baize = { name: 'Baize', tag: 'Green cloth & wood rail · plates light up', accent: BRASS,
    score: layer(132, build([
      box(270, 22, 1380, 74, { bgColor: '#145a2e', bgTop: '#1e6a3a', bgBot: FELT, borderRadius: 12, borderColor: '#7a4b25', borderWidth: 3, glowColor: 'rgba(0,0,0,.5)', glowSize: 24, zIndex: 1 }),
      box(276, 28, 1368, 62, { bgOpacity: 0, borderRadius: 9, borderColor: 'rgba(233,196,106,.35)', borderWidth: 1 }),
      txt('custom-text', 0, 945, 26, 30, 50, { text: '◆', fontSize: 14, color: BRASS }),
      smart('BEST OF {bestOf}', 860, 72, 200, 20, { fontSize: 12, color: 'rgba(246,239,217,.6)', letterSpacing: 3 })
    ], [
      num('frames', 1, 866, 26, 84, 50, 54, BRASS),
      box(730, 32, 122, 54, { player: 1, bgColor: CREAM, borderRadius: 8, zIndex: 3, at: { on: true, bgColor: BRASS } }),
      num('score-plain', 1, 730, 32, 122, 54, 52, FELT, { activeColor: FELT, shadow: false }),
      txt('player-name', 1, 310, 28, 405, 42, { fontSize: 36, color: CREAM, activeColor: CREAM, align: 'right', letterSpacing: 1 }),
      txt('state', 1, 310, 66, 405, 22, { fontSize: 14, fontWeight: 700, color: 'rgba(246,239,217,.55)', letterSpacing: 3, align: 'right' })
    ])),
    brk: brk(58, [
      box(700, 6, 520, 46, { bgColor: '#145a2e', bgTop: '#1e6a3a', bgBot: FELT, borderRadius: 10, borderColor: '#7a4b25', borderWidth: 2, zIndex: 1 }),
      txt('break-who', 0, 716, 6, 200, 46, { fontSize: 14, color: BRASS, align: 'right', letterSpacing: 1 }),
      num('break-val', 0, 920, 6, 70, 46, 40, CREAM),
      ext(box(990, 10, 222, 38), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* 5 ── ARENA: esports slants, neon turn lights */
  var MAG = '#ff2bd6', CYAN = '#22e3ff';
  P.arena = { name: 'Arena', tag: 'Esports slants · neon turn lights', accent: MAG,
    score: layer(156, build([
      box(905, 16, 110, 90, { bgColor: '#07020d', borderRadius: 6, borderColor: 'rgba(255,255,255,.18)', borderWidth: 2, glowColor: 'rgba(0,0,0,.6)', glowSize: 20, zIndex: 3 }),
      smart('{p1.frames}-{p2.frames}', 905, 22, 110, 54, { fontFamily: BEBAS, fontWeight: 400, fontSize: 48, letterSpacing: 2 }),
      num('best-of', 0, 905, 74, 110, 26, 22, 'rgba(255,255,255,.5)'),
      txt('tournament', 0, 660, 110, 600, 24, { fontSize: 13, letterSpacing: 4, color: 'rgba(255,255,255,.7)', bgColor: '#07020d', bgOpacity: 80, borderRadius: 4 })
    ], [
      ext(box(330, 24, 640, 74, { bgColor: '#200a35', bgTop: '#3a1060', bgBot: '#13051f', zIndex: 1 }), { type: 'rect-slant' }),
      txt('player-name', 1, 395, 28, 360, 44, { fontSize: 34, fontWeight: 900, align: 'left', letterSpacing: 1, activeColor: '#ffffff' }),
      txt('state', 1, 400, 68, 300, 22, { fontSize: 14, letterSpacing: 3, color: '#ff7be5', align: 'left' }),
      num('score-plain', 1, 770, 24, 120, 74, 64, '#ffffff', { activeColor: MAG }),
      turn(1, 400, 100, 480, 4, MAG, { borderRadius: 2, glowColor: MAG, glowSize: 16 })
    ], [
      { bgColor: '#081f30', bgTop: '#0b3550', bgBot: '#04131d' }, null,
      { color: '#7aeeff' }, { activeColor: CYAN }, { bgColor: CYAN, glowColor: CYAN }
    ])),
    brk: brk(58, [
      ext(box(680, 6, 580, 46, { bgColor: '#200a35', bgTop: '#3a1060', bgBot: '#13051f', zIndex: 1 }), { type: 'rect-slant' }),
      txt('break-who', 0, 730, 6, 190, 46, { fontSize: 14, fontWeight: 900, color: '#ff7be5', align: 'right', letterSpacing: 1 }),
      num('break-val', 0, 920, 6, 70, 46, 40, '#ffffff'),
      ext(box(990, 10, 226, 38), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* 6 ── TRICOLOUR: saffron, white & green */
  var SAF = '#ff9933', IGR = '#138808', NAVY = '#0a1530';
  P.tricolour = { name: 'Tricolour', tag: 'Saffron, white & green · national events', accent: SAF,
    score: layer(152, build([
      box(300, 20, 440, 5, { bgColor: SAF, zIndex: 3 }), box(740, 20, 440, 5, { bgColor: '#ffffff', zIndex: 3 }), box(1180, 20, 440, 5, { bgColor: IGR, zIndex: 3 }),
      box(300, 25, 1320, 74, { bgColor: NAVY, bgTop: '#0e1d40', bgBot: '#060f26', glowColor: SHADOW, glowSize: 22, zIndex: 1 }),
      box(880, 25, 160, 74, { bgColor: '#000080', bgTop: '#12309a', bgBot: '#071a5e' }),
      txt('custom-text', 0, 944, 25, 32, 56, { text: '–', fontFamily: BEBAS, fontWeight: 400, fontSize: 30, color: 'rgba(255,255,255,.5)' }),
      smart('BEST OF {bestOf}', 880, 78, 160, 18, { fontSize: 11, letterSpacing: 3, color: 'rgba(255,255,255,.65)' }),
      box(710, 99, 500, 26, { bgColor: '#060f26', zIndex: 1 }),
      txt('tournament', 0, 716, 99, 488, 26, { fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,.75)' })
    ], [
      num('frames', 1, 884, 25, 62, 56, 50, '#ffffff'),
      box(770, 25, 110, 74, { bgColor: SAF, bgTop: '#ffb04d', bgBot: '#f07c00' }),
      num('score-plain', 1, 770, 25, 110, 74, 62, '#1a0d00', { activeColor: '#1a0d00', shadow: false }),
      txt('player-name', 1, 330, 30, 425, 42, { fontSize: 34, fontWeight: 900, align: 'right', letterSpacing: 1, activeColor: '#ffffff', at: { on: true, color: '#ffb04d' } }),
      txt('state', 1, 330, 70, 425, 22, { fontSize: 14, letterSpacing: 3, color: 'rgba(255,255,255,.5)', align: 'right' }),
      turn(1, 300, 25, 6, 74, SAF)
    ], [
      null, { bgColor: IGR, bgTop: '#1fb51f', bgBot: '#0d6e0d' }, { color: '#ffffff', activeColor: '#ffffff', shadow: true },
      { at: { on: true, color: '#5fe35f' } }, null, { bgColor: '#1fb51f' }
    ])),
    brk: brk(58, [
      box(690, 6, 540, 46, { bgColor: NAVY, zIndex: 1 }),
      box(690, 6, 6, 46, { bgColor: SAF }), box(1224, 6, 6, 46, { bgColor: IGR }),
      txt('break-who', 0, 706, 6, 210, 46, { fontSize: 15, color: '#ffb04d', align: 'right', letterSpacing: 1 }),
      num('break-val', 0, 920, 6, 76, 46, 40, '#ffffff'),
      ext(box(998, 10, 222, 38), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* 7 ── CLEAN WHITE: light TV style */
  var RED = '#d10a11', INK = '#111827';
  P.white = { name: 'Clean White', tag: 'Light TV style · score box turns red', accent: RED,
    score: layer(132, build([
      box(380, 4, 320, 24, { bgColor: RED, zIndex: 1 }),
      txt('tournament', 0, 388, 4, 306, 24, { fontSize: 13, letterSpacing: 2, align: 'left' }),
      box(1340, 4, 200, 24, { bgColor: INK, zIndex: 1 }),
      smart('FRAME {frame} · BEST OF {bestOf}', 1344, 4, 192, 24, { fontSize: 12, letterSpacing: 1 }),
      box(380, 28, 1160, 66, { bgColor: '#ffffff', glowColor: 'rgba(0,0,0,.35)', glowSize: 24, zIndex: 1 }),
      box(880, 28, 160, 66, { bgColor: INK }),
      num('best-of', 0, 938, 28, 44, 66, 20, 'rgba(255,255,255,.45)'),
      box(380, 94, 1160, 4, { bgColor: RED })
    ], [
      num('frames', 1, 882, 28, 60, 66, 48, '#ffffff'),
      box(786, 28, 94, 66, { player: 1, bgColor: '#eef0f3', at: { on: true, bgColor: RED } }),
      num('score-plain', 1, 786, 28, 94, 66, 54, INK, { activeColor: '#ffffff', shadow: false }),
      txt('player-name', 1, 410, 32, 366, 40, { fontSize: 32, color: INK, activeColor: INK, align: 'right', letterSpacing: 1, shadow: false }),
      txt('state', 1, 410, 70, 366, 20, { fontSize: 13, fontWeight: 700, color: '#6b7280', letterSpacing: 3, align: 'right' })
    ])),
    brk: brk(56, [
      box(700, 6, 520, 44, { bgColor: '#ffffff', glowColor: 'rgba(0,0,0,.3)', glowSize: 18, zIndex: 1 }),
      box(700, 6, 6, 44, { bgColor: RED }),
      txt('break-who', 0, 716, 6, 200, 44, { fontSize: 14, color: INK, align: 'right', letterSpacing: 1 }),
      num('break-val', 0, 920, 6, 70, 44, 38, RED),
      ext(box(990, 9, 226, 38), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* 8 ── BIG SCREEN: full width, extra-large text */
  var GOLD = '#f0c040';
  P.big = { name: 'Big Screen', tag: 'Full width, extra-large text · best on phones', accent: GOLD,
    score: layer(124, build([
      num('best-of', 0, 918, 14, 84, 66, 34, 'rgba(255,255,255,.55)'),
      smart('FRAME {frame}', 826, 86, 268, 30, { fontSize: 18, letterSpacing: 4, color: 'rgba(255,255,255,.45)' })
    ], [
      txt('player-name', 1, 40, 8, 600, 66, { fontSize: 52, fontWeight: 900, align: 'left', letterSpacing: 1, activeColor: '#ffffff', at: { on: true, color: '#f8d873' } }),
      txt('state', 1, 40, 76, 280, 34, { fontSize: 20, letterSpacing: 3, color: 'rgba(240,192,64,.75)', align: 'left' }),
      ext(box(330, 76, 300, 34), { type: 'frame-dots', player: 1, dotSize: 16, color: GOLD, zIndex: 5 }),
      box(660, 10, 150, 104, { bgColor: GOLD, bgTop: '#f8d873', bgBot: '#c8951a', borderRadius: 8 }),
      num('score-plain', 1, 660, 10, 150, 104, 92, '#0b0b0b', { activeColor: '#0b0b0b', shadow: false }),
      num('frames', 1, 826, 8, 92, 80, 76, '#ffffff'),
      turn(1, 0, 0, 10, 124, GOLD)
    ]), { bgColor: '#07130c', bgOpacity: 96, borderColor: GOLD, borderWidth: 3 }),
    brk: brk(64, [
      txt('break-who', 0, 520, 0, 420, 64, { fontSize: 22, color: GOLD, align: 'right', letterSpacing: 2 }),
      num('break-val', 0, 950, 0, 130, 64, 58, '#ffffff'),
      ext(box(1086, 14, 320, 36), { type: 'ball-strip', zIndex: 3 })
    ], { bgColor: '#0a1a10', bgOpacity: 96, borderColor: GOLD, borderWidth: 2 }) };

  /* 9 ── CRUCIBLE: maroon & gold, silver score boxes */
  P.crucible = { name: 'Crucible', tag: 'Maroon & gold with silver score boxes', accent: '#c9a227',
    score: layer(150, build([
      box(360, 28, 1200, 68, { bgColor: '#111111', bgTop: '#1c1c1c', bgBot: '#0a0a0a', borderColor: 'rgba(201,162,39,.35)', borderWidth: 1, glowColor: SHADOW, glowSize: 22, zIndex: 1 }),
      box(790, 18, 340, 88, { bgColor: '#5a0b10', bgTop: '#74121a', bgBot: '#3a0508', borderColor: '#c9a227', borderWidth: 2, borderRadius: 4, glowColor: 'rgba(0,0,0,.5)', glowSize: 16 }),
      num('best-of', 0, 890, 24, 140, 40, 32, '#f6e7b8'),
      txt('frame-num', 0, 890, 62, 140, 22, { fontSize: 13, fontWeight: 700, letterSpacing: 3, color: 'rgba(246,231,184,.6)' }),
      box(760, 106, 400, 22, { bgColor: '#0a0a0a', borderColor: 'rgba(201,162,39,.35)', borderWidth: 1, zIndex: 1 }),
      txt('tournament', 0, 766, 106, 388, 22, { fontSize: 12, letterSpacing: 3, color: '#c9a227' })
    ], [
      num('frames', 1, 800, 22, 86, 60, 60, GOLD),
      num('score-box-3d', 1, 680, 31, 106, 62, 50, '#111111', { bgTop: '#f7f7f7', bgBot: '#b5b5b5', borderColor: '#8a8a8a', zIndex: 4 }),
      txt('player-name', 1, 390, 30, 284, 42, { fontSize: 30, align: 'right', letterSpacing: 1, activeColor: '#ffffff', at: { on: true, color: GOLD } }),
      txt('state', 1, 390, 70, 284, 22, { fontSize: 13, fontWeight: 700, letterSpacing: 3, color: '#c9a227', align: 'right' }),
      turn(1, 360, 28, 5, 68, GOLD)
    ])),
    brk: brk(58, [
      box(690, 6, 540, 46, { bgColor: '#5a0b10', bgTop: '#74121a', bgBot: '#3a0508', borderColor: '#c9a227', borderWidth: 2, borderRadius: 4, zIndex: 1 }),
      txt('break-who', 0, 706, 6, 210, 46, { fontSize: 15, color: '#f6e7b8', align: 'right', letterSpacing: 1 }),
      num('break-val', 0, 920, 6, 76, 46, 42, GOLD),
      ext(box(998, 10, 222, 38), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* 10 ── RACE BOARD: race-to frames for pool & heyball */
  var YEL = '#ffd400';
  P.race = { name: 'Race Board', tag: 'Race-to racks · pool & heyball', accent: YEL,
    score: layer(124, build([
      box(440, 24, 1040, 72, { bgColor: '#0b0b0b', bgOpacity: 96, borderRadius: 8, borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, glowColor: SHADOW, glowSize: 20, zIndex: 1 }),
      txt('custom-text', 0, 920, 28, 80, 20, { text: 'RACE TO', fontSize: 12, letterSpacing: 2, color: 'rgba(255,255,255,.55)' }),
      smart('{firstTo}', 920, 46, 80, 46, { fontFamily: BEBAS, fontWeight: 400, fontSize: 44 }),
      txt('tournament', 0, 710, 100, 500, 22, { fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,.7)', bgColor: '#0b0b0b', bgOpacity: 80, borderRadius: 4, zIndex: 3 })
    ], [
      box(820, 24, 100, 72, { bgColor: YEL, bgTop: '#ffe14d', bgBot: '#f2c200' }),
      num('frames', 1, 820, 24, 100, 72, 64, '#0b0b0b', { shadow: false }),
      txt('player-name', 1, 480, 28, 330, 42, { fontSize: 34, fontWeight: 900, align: 'right', letterSpacing: 1, activeColor: '#ffffff', at: { on: true, color: YEL } }),
      ext(box(486, 68, 150, 22), { type: 'frame-dots', player: 1, dotSize: 10, color: YEL, zIndex: 5 }),
      txt('state', 1, 640, 68, 170, 22, { fontSize: 14, fontWeight: 700, letterSpacing: 3, color: DIM, align: 'right' }),
      turn(1, 440, 24, 6, 72, YEL)
    ])),
    brk: brk(56, [
      box(700, 6, 520, 44, { bgColor: '#0b0b0b', bgOpacity: 96, borderRadius: 8, zIndex: 1 }),
      txt('break-who', 0, 716, 6, 200, 44, { fontSize: 14, color: YEL, align: 'right', letterSpacing: 1 }),
      num('break-val', 0, 920, 6, 70, 44, 38, '#ffffff'),
      ext(box(990, 9, 226, 38), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* 11 ── SLIM LINE: smallest footprint */
  var ICE = '#4fd1ff';
  P.slim = { name: 'Slim Line', tag: 'Smallest footprint · clean feed', accent: ICE,
    score: layer(92, build([
      box(560, 26, 800, 44, { bgColor: '#0d0d0d', bgOpacity: 92, borderRadius: 4, glowColor: 'rgba(0,0,0,.4)', glowSize: 18, zIndex: 1 }),
      box(914, 26, 92, 44, { bgColor: ICE }),
      smart('{p1.frames} ({bestOf}) {p2.frames}', 914, 26, 92, 44, { fontFamily: BEBAS, fontWeight: 400, fontSize: 26, color: '#04121a' })
    ], [
      txt('player-name', 1, 576, 26, 262, 44, { fontSize: 24, align: 'right', letterSpacing: 1, activeColor: '#ffffff' }),
      num('score-plain', 1, 842, 26, 70, 44, 34, '#ffffff', { activeColor: ICE }),
      turn(1, 600, 66, 238, 3, ICE)
    ])),
    brk: brk(50, [
      box(760, 4, 400, 40, { bgColor: '#0d0d0d', bgOpacity: 92, borderRadius: 4, zIndex: 1 }),
      txt('custom-text', 0, 776, 4, 70, 40, { text: 'BREAK', fontSize: 12, letterSpacing: 3, color: ICE }),
      num('break-val', 0, 842, 4, 62, 40, 30, '#ffffff'),
      ext(box(906, 6, 240, 36), { type: 'ball-strip', zIndex: 3 })
    ]) };

  /* ── swap in the new set (Shoot Out stays first) ── */
  var ORDER = ['shootout', 'tour', 'corner', 'glass', 'baize', 'arena', 'tricolour', 'white', 'big', 'crucible', 'race', 'slim'];
  var next = {};
  if (w.PRESETS && PRESETS.shootout) next.shootout = ext(PRESETS.shootout, { tag: 'Match, frame & shot clocks' });
  Object.keys(P).forEach(function (k) { var p = P[k]; next[k] = { name: p.name, tag: p.tag, accent: p.accent, score: p.score, break: p.brk }; });
  PRESETS = next;
  w.UPBSA_PRESET_ORDER = ORDER;

  /* ── preset cards with a real preview ── */
  var TW = 256, TH = 74;
  function thumb(p) {
    var m = BT.demoData ? BT.demoData('demo') : getLiveData();
    var S = p.score, B = p.break, gap = 0;
    var vis = function (L) { return L.elements.filter(function (e) { return SBLive.visible(e, m); }); };
    var full = function (L) { return L.bgOpacity > 20; };
    var bb = null;
    function add(L, dy) {
      var r = full(L) ? { x: 0, y: 0, w: CW, h: L.height } : null;
      if (!r) { var es = vis(L); if (!es.length) return; var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9; es.forEach(function (e) { x1 = Math.min(x1, e.x); y1 = Math.min(y1, e.y); x2 = Math.max(x2, e.x + e.w); y2 = Math.max(y2, e.y + e.h); }); r = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }; }
      r.y += dy;
      if (!bb) bb = r; else { var nx = Math.min(bb.x, r.x), ny = Math.min(bb.y, r.y); bb = { x: nx, y: ny, w: Math.max(bb.x + bb.w, r.x + r.w) - nx, h: Math.max(bb.y + bb.h, r.y + r.h) - ny }; }
    }
    var bH = B && B.visible !== false ? B.height : 0;
    if (bH) add(B, 0);
    add(S, bH + gap);
    if (!bb) return null;
    var pad = 24; bb = { x: bb.x - pad, y: bb.y - pad, w: bb.w + pad * 2, h: bb.h + pad * 2 };
    var gw = document.querySelector('.preset-grid'), tw = (gw && gw.clientWidth > 60 ? gw.clientWidth - 4 : TW);
    var s = Math.min(tw / bb.w, TH / bb.h);
    var outer = document.createElement('div'); outer.className = 'pc-thumb';
    var inner = document.createElement('div');
    inner.style.cssText = 'position:absolute;left:50%;top:50%;width:' + bb.w + 'px;height:' + bb.h + 'px;transform:translate(-50%,-50%) scale(' + s + ');transform-origin:50% 50%;';
    var stack = document.createElement('div');
    stack.style.cssText = 'position:absolute;left:' + (-bb.x) + 'px;top:' + (-bb.y) + 'px;width:' + CW + 'px;';
    if (bH) stack.appendChild(BT.layerBox(B, m));
    stack.appendChild(BT.layerBox(S, m));
    inner.appendChild(stack); outer.appendChild(inner);
    return outer;
  }
  function buildGrid() {
    var grid = document.querySelector('.preset-grid'); if (!grid || !w.BT || !BT.layerBox) return;
    grid.classList.add('v2'); grid.innerHTML = '';
    ORDER.forEach(function (k) {
      var p = PRESETS[k]; if (!p) return;
      var c = document.createElement('div'); c.className = 'preset-card';
      c.setAttribute('onclick', "loadPreset('" + k + "')");
      var th = null; try { th = thumb(p); } catch (e) { th = null; }
      if (th) c.appendChild(th);
      var nm = document.createElement('div'); nm.className = 'pc-name';
      nm.innerHTML = '<span class="pc-dot" style="background:' + (p.accent || '#f0c040') + '"></span>' + p.name + (p.tag ? '<span class="pc-tag">' + p.tag + '</span>' : '');
      c.appendChild(nm);
      grid.appendChild(c);
    });
  }
  w.UPBSA_buildPresetGrid = buildGrid;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildGrid); else buildGrid();
  buildGrid();
})(window);
