/* UPBSA.TV share cards — result, champion, standings and player cards drawn on a canvas (1080×1350),
   then shared through the phone's share sheet or saved as a PNG. Uses the page's light/dark theme. */
(function (w) {
  var SC = w.SC = {};
  var W = 1080, H = 1350;
  function pal() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? { bg: '#0A0D10', card: '#12161B', line: '#232A31', text: '#E9EEF2', dim: '#AEB8C1', faint: '#808B96', win: '#FFC531', winTx: '#0A0C0F', gold: '#FFC531', goldSoft: '#2A2410', sunk: '#1A2027', ink: '#05070A', inkTx: '#E9EEF2', inkDim: '#8E99A4', live: '#FF4D5E', acc: '#FFC531' }
      : { bg: '#F2F3EE', card: '#FFFFFF', line: '#E3E5DD', text: '#15201A', dim: '#3E4A43', faint: '#5E6B63', win: '#0B6B3F', winTx: '#FFFFFF', gold: '#8A6100', goldSoft: '#FFF3D6', sunk: '#ECEDE7', ink: '#15201A', inkTx: '#FFFFFF', inkDim: '#B8C2BC', live: '#D7263D', acc: '#0B6B3F' };
  }
  var GOLD = '#FFC531';
  function font(wt, px, fam) { return wt + ' ' + px + 'px ' + (fam === 'g' ? '"Space Grotesk", Inter, sans-serif' : 'Inter, sans-serif'); }
  /* shrink text until it fits; ellipsis as a last resort */
  function fit(c, text, maxW, px, wt, fam, min) {
    text = String(text == null ? '' : text); min = Math.min(min || 28, px);
    for (; px >= min; px -= 2) { c.font = font(wt, px, fam); if (c.measureText(text).width <= maxW) return px; }
    c.font = font(wt, min, fam); while (text.length > 1 && c.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return { px: min, text: text + '…' };
  }
  function txt(c, text, x, y, maxW, px, wt, fam, color, align, min) {
    var r = fit(c, text, maxW, px, wt, fam, min), t = String(text == null ? '' : text);
    if (typeof r === 'object') { t = r.text; r = r.px; }
    c.font = font(wt, r, fam); c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = 'alphabetic'; c.fillText(t, x, y); return r;
  }
  function rr(c, x, y, w, h, r, fill, stroke) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); } }
  function cut(c, x, y, w, h, k, fill) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w - k, y); c.lineTo(x + w, y + k); c.lineTo(x + w, y + h); c.lineTo(x + k, y + h); c.lineTo(x, y + h - k); c.closePath(); c.fillStyle = fill; c.fill(); }
  function loadImg(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function siteUrl() { if (/^file:/.test(location.href)) return 'devank07.github.io/snookerv2'; var b = document.querySelector('base'); return (b ? b.href : location.href.split(/[?#]/)[0].replace(/[^\/]*$/, '')).replace(/^https?:\/\//, '').replace(/\/$/, ''); }

  function frame(c, P, logo, eventLine, sub) {
    c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
    /* broadcast stripes, top right */
    c.save(); c.fillStyle = GOLD;
    c.beginPath(); c.moveTo(830, 0); c.lineTo(W, 0); c.lineTo(W, 330); c.lineTo(730, 330); c.closePath(); c.fill();
    c.globalAlpha = .35; c.beginPath(); c.moveTo(760, 0); c.lineTo(800, 0); c.lineTo(700, 330); c.lineTo(660, 330); c.closePath(); c.fill(); c.restore();
    /* brand */
    if (logo) { c.save(); rr(c, 72, 70, 92, 92, 22); c.clip(); c.drawImage(logo, 72, 70, 92, 92); c.restore(); }
    c.font = font(700, 46, 'g'); c.fillStyle = P.text; c.textAlign = 'left'; c.fillText('UPBSA', 186, 132); var bw = c.measureText('UPBSA').width; c.fillStyle = P.live; c.fillText('.TV', 186 + bw, 132);
    c.fillStyle = GOLD; c.fillRect(72, 186, 120, 6);
    /* event */
    var y = 262;
    if (sub) { c.font = font(800, 24, 'i'); var sw = Math.min(c.measureText(sub.toUpperCase()).width + 36, 640); rr(c, 72, y - 34, sw, 48, 24, P.goldSoft); txt(c, sub.toUpperCase(), 90, y - 2, 604, 24, 800, 'i', P.gold); y += 62; }
    txt(c, eventLine, 72, y, 640, 38, 700, 'g', P.dim, 'left', 26);
    /* footer */
    c.fillStyle = P.ink; c.fillRect(0, H - 150, W, 150); c.fillStyle = GOLD; c.fillRect(0, H - 150, 220, 8);
    txt(c, 'Live draws, results & rankings', 72, H - 86, 620, 30, 700, 'g', P.inkTx);
    txt(c, siteUrl(), 72, H - 44, 620, 24, 600, 'i', P.inkDim);
    rr(c, W - 392, H - 112, 320, 64, 14, '#E3002B'); txt(c, '▶  YouTube @upbsa', W - 232, H - 70, 290, 26, 800, 'i', '#FFFFFF', 'center');
  }
  function pill(c, x, y, label, bg, fg) { c.font = font(800, 24, 'i'); var w = c.measureText(label).width + 36; rr(c, x, y, w, 46, 10, bg); c.fillStyle = fg; c.textAlign = 'left'; c.fillText(label, x + 18, y + 32); return w; }

  var draw = {
    match: function (c, P, d) {
      var y = 470;
      var x = 72; x += pill(c, x, y, 'RESULT', P.live, '#FFFFFF') + 14; if (d.round) pill(c, x, y, d.round.toUpperCase(), P.sunk, P.dim);
      y = 570;
      [[d.a, d.ad, d.fa, d.w === 1], [d.b, d.bd, d.fb, d.w === 2]].forEach(function (p, i) {
        var top = y + i * 250; rr(c, 72, top, W - 144, 220, 26, P.card, P.line);
        if (p[3]) { c.fillStyle = P.win; c.fillRect(72, top + 24, 8, 172); }
        txt(c, p[0], 116, top + 112, 640, 64, 700, 'g', p[3] ? P.text : P.faint, 'left', 34);
        txt(c, (p[3] ? 'WINNER' + (p[1] ? '  ·  ' : '') : '') + (p[1] || ''), 116, top + 162, 600, 26, 800, 'i', p[3] ? P.acc : P.faint);
        cut(c, W - 72 - 190, top + 25, 170, 170, 22, p[3] ? P.win : P.sunk);
        txt(c, p[2], W - 72 - 105, top + 145, 150, 108, 700, 'g', p[3] ? P.winTx : P.faint, 'center');
      });
      txt(c, d.meta || '', 72, 1110, W - 144, 28, 600, 'i', P.faint);
    },
    champion: function (c, P, d) {
      var cx = W / 2;
      c.save(); c.globalAlpha = .9; c.fillStyle = P.goldSoft; c.beginPath(); c.arc(cx, 640, 300, 0, Math.PI * 2); c.fill(); c.restore();
      c.font = '170px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.fillText('🏆', cx, 620);
      var lab = d.cat ? 'CHAMPION · ' + d.cat.toUpperCase() : 'CHAMPION'; c.font = font(800, 24, 'i'); pill(c, cx - (c.measureText(lab).width + 36) / 2, 680, lab, GOLD, '#15201A');
      txt(c, d.name, cx, 850, W - 160, 104, 700, 'g', P.text, 'center', 44);
      if (d.state) txt(c, d.state, cx, 904, 600, 30, 800, 'i', P.faint, 'center');
      if (d.final) txt(c, d.final, cx, 1000, W - 200, 34, 600, 'i', P.dim, 'center', 24);
      if (d.meta) txt(c, d.meta, cx, 1060, W - 200, 28, 600, 'i', P.faint, 'center', 22);
    },
    standings: function (c, P, d) {
      pill(c, 72, 430, (d.title || 'STANDINGS').toUpperCase(), P.ink, P.inkTx);
      var y = 510, rows = d.rows.slice(0, 8), rh = Math.min(76, Math.floor(640 / Math.max(rows.length, 1)));
      rows.forEach(function (r, i) {
        var top = y + i * (rh + 6), medal = r.pos === '1' ? GOLD : r.pos === '2' ? '#AEB7C2' : r.pos === '3' || r.pos === '=3' ? '#C98A4B' : null;
        rr(c, 72, top, W - 144, rh, 14, P.card, P.line);
        if (medal) { c.fillStyle = medal; c.fillRect(72, top + 12, 7, rh - 24); }
        txt(c, r.pos, 150, top + rh / 2 + 15, 110, 40, 700, 'g', medal && r.pos !== '2' && r.pos !== '3' && r.pos !== '=3' ? P.gold : P.dim, 'center');
        txt(c, r.name, 222, top + rh / 2 + 13, 470, 36, 700, 'g', P.text, 'left', 24);
        txt(c, r.note || '', W - 100, top + rh / 2 + 10, 300, 24, 700, 'i', P.faint, 'right', 18);
      });
    },
    player: function (c, P, d) {
      cut(c, 72, 420, 170, 170, 26, P.ink); txt(c, d.init, 157, 535, 140, 76, 700, 'g', GOLD, 'center');
      txt(c, d.name, 272, 510, W - 350, 74, 700, 'g', P.text, 'left', 36);
      txt(c, [d.titles ? '🏆 ' + d.titles + '× CHAMPION' : 'UPBSA PLAYER', d.state].filter(Boolean).join('  ·  '), 272, 566, W - 350, 26, 800, 'i', P.gold);
      var tiles = [[d.wl, 'Matches won'], [d.pct + '%', 'Win rate'], [d.fd, 'Frame difference'], [d.hb || '–', 'Highest break']];
      tiles.forEach(function (t, i) { var x = 72 + (i % 2) * 476, y = 650 + Math.floor(i / 2) * 200; rr(c, x, y, 460, 180, 22, i === 0 ? P.goldSoft : P.card, P.line);
        txt(c, t[0], x + 32, y + 100, 400, 76, 700, 'g', i === 0 ? P.gold : P.text); txt(c, t[1], x + 32, y + 146, 400, 26, 700, 'i', P.faint); });
      if (d.form && d.form.length) { txt(c, 'FORM', 72, 1100, 200, 22, 800, 'i', P.faint);
        d.form.slice(0, 10).forEach(function (f, i) { var x = 170 + i * 66; rr(c, x, 1064, 54, 54, 12, f ? P.win : P.sunk); txt(c, f ? 'W' : 'L', x + 27, 1101, 40, 26, 800, 'i', f ? P.winTx : P.faint, 'center'); }); }
    }
  };

  SC.make = function (kind, d) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var c = cv.getContext('2d'), P = pal();
    var fonts = document.fonts ? Promise.all(['700 80px "Space Grotesk"', '800 30px Inter', '600 30px Inter', '700 30px Inter'].map(function (f) { return document.fonts.load(f).catch(function () { }); })) : Promise.resolve();
    return Promise.all([fonts, loadImg('upbsa-logo.jpg')]).then(function (r) {
      frame(c, P, r[1], d.event || '', d.sub || ''); draw[kind](c, P, d); return cv;
    });
  };

  /* preview sheet with Share / Download */
  function sheet() {
    var el = document.getElementById('sc-sheet'); if (el) return el;
    var st = document.createElement('style');
    st.textContent = '#sc-sheet{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(8,12,10,.72);backdrop-filter:blur(4px);}#sc-sheet.on{display:flex;}' +
      '#sc-sheet .bx{width:min(440px,100%);max-height:100%;overflow:auto;padding:16px;border-radius:20px;background:var(--card,#fff);color:var(--text,#15201A);box-shadow:0 24px 60px rgba(0,0,0,.4);}' +
      '#sc-sheet img{display:block;width:100%;border-radius:12px;border:1px solid var(--line,#E3E5DD);background:var(--sunk,#eee);aspect-ratio:1080/1350;}' +
      '#sc-sheet .ac{display:flex;gap:8px;margin-top:12px;}#sc-sheet button{flex:1;height:46px;border-radius:12px;border:1px solid var(--line2,#D3D7CC);background:var(--card,#fff);color:var(--text,#15201A);font:700 14px Inter,sans-serif;cursor:pointer;}' +
      '#sc-sheet button.pr{background:var(--tab-on,#15201A);border-color:var(--tab-on,#15201A);color:var(--tab-on-tx,#fff);}#sc-sheet p{font:500 12.5px Inter,sans-serif;color:var(--faint,#5E6B63);margin-top:10px;text-align:center;}';
    document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'sc-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Share card');
    el.innerHTML = '<div class="bx"><img alt="Share card preview"><div class="ac"><button class="pr" id="sc-share" type="button">Share</button><button id="sc-dl" type="button">Download</button><button id="sc-x" type="button">Close</button></div><p>Ready for WhatsApp status and Instagram.</p></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) { if (e.target === el || e.target.id === 'sc-x') el.classList.remove('on'); });
    return el;
  }
  SC.open = function (kind, d, filename) {
    var el = sheet(), img = el.querySelector('img'); img.removeAttribute('src'); el.classList.add('on');
    var sh = el.querySelector('#sc-share'), dl = el.querySelector('#sc-dl'); sh.disabled = dl.disabled = true;
    filename = (filename || 'upbsa-card').replace(/[^a-z0-9\-]+/gi, '-').toLowerCase() + '.png';
    SC.make(kind, d).then(function (cv) {
      img.src = cv.toDataURL('image/png');
      cv.toBlob(function (blob) {
        var file = blob && w.File ? new File([blob], filename, { type: 'image/png' }) : null;
        var canShare = file && navigator.canShare && navigator.canShare({ files: [file] });
        sh.style.display = canShare ? '' : 'none'; sh.disabled = dl.disabled = false;
        sh.onclick = function () { navigator.share({ files: [file], title: d.shareTitle || 'UPBSA.TV', text: d.shareText || '' }).catch(function () { }); };
        dl.onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
      }, 'image/png');
    });
  };
})(window);
