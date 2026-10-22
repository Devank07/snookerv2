/* UPBSA.TV — venue board "scan to score" screen
   Shown on the venue scoreboard when the table is empty, and 45 s after a match ends.
   The QR opens the referee remote for this table (go.html). If the board was opened
   with its board link (…#key=…), the QR also carries the table PIN, so the referee's
   phone unlocks by itself, and the PIN is shown big for anyone typing it.
   Needs: firebase app + database (+ auth for the PIN), qrcode.js, upbsa-auth.js (data-mode="board"). */
(function (w, d) {
  'use strict';
  var T = new URLSearchParams(location.search).get('table');
  if (!T && /shootout-board/.test(location.pathname)) T = '1';
  if (!T || !w.firebase) return;
  var AFTER_FINISH = 45000;
  var BASE = location.href.replace(/[#?].*$/, '').replace(/[^\/]*$/, '');
  var pin = null, match = null, finishedSeen = 0, shown = false, lastQR = '';

  var css = '#bq{position:fixed;inset:0;z-index:150;display:none;align-items:center;justify-content:center;gap:6vw;padding:5vh 6vw;background:radial-gradient(ellipse at 30% 0%,#1d4a2a 0%,#0a1f12 45%,#030805 100%);color:#e8f4e0;font-family:"Barlow Condensed","Bebas Neue",system-ui,sans-serif;animation:bqIn .6s ease;}' +
    '#bq.on{display:flex;}@keyframes bqIn{from{opacity:0}to{opacity:1}}' +
    '#bq .l{flex:1;max-width:46vw;}' +
    '#bq .brand{font:900 clamp(14px,1.6vw,30px) "Barlow Condensed",sans-serif;letter-spacing:.5em;color:#f0c040;}' +
    '#bq .tn{font:400 clamp(60px,13vw,260px)/.9 "Bebas Neue",sans-serif;letter-spacing:.02em;margin:1.5vh 0 1vh;}' +
    '#bq .tn small{display:block;font:800 clamp(16px,2vw,40px) "Barlow Condensed",sans-serif;letter-spacing:.4em;color:#f0c040;margin-bottom:-.5vh;}' +
    '#bq .hd{font:900 clamp(22px,3.4vw,66px)/1.05 "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:.02em;}' +
    '#bq .steps{margin-top:3vh;display:flex;flex-direction:column;gap:1.6vh;}' +
    '#bq .st{display:flex;align-items:center;gap:1.2vw;font:700 clamp(15px,1.7vw,34px) "Barlow Condensed",sans-serif;letter-spacing:.04em;color:rgba(232,244,224,.82);}' +
    '#bq .st b{flex:none;width:clamp(26px,2.6vw,52px);height:clamp(26px,2.6vw,52px);border-radius:50%;background:#f0c040;color:#0b0b0b;display:flex;align-items:center;justify-content:center;font:900 clamp(14px,1.5vw,30px) "Barlow Condensed",sans-serif;}' +
    '#bq .last{margin-top:3.5vh;padding:1.4vh 1.4vw;border-left:4px solid #f0c040;background:rgba(0,0,0,.28);font:700 clamp(14px,1.5vw,30px) "Barlow Condensed",sans-serif;letter-spacing:.04em;color:rgba(232,244,224,.75);}' +
    '#bq .last b{color:#fff;}' +
    '#bq .r{flex:none;display:flex;flex-direction:column;align-items:center;}' +
    '#bq .qr{background:#fff;padding:2.2vh;border-radius:2vh;box-shadow:0 2vh 6vh rgba(0,0,0,.55),0 0 0 .5vh rgba(240,192,64,.85);width:min(36vw,62vh);height:min(36vw,62vh);}' +
    '#bq .qr svg{width:100%;height:100%;display:block;}' +
    '#bq .cap{margin-top:2.4vh;font:900 clamp(16px,2vw,40px) "Barlow Condensed",sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#f0c040;}' +
    '#bq .pin{margin-top:1.2vh;display:flex;align-items:baseline;gap:1vw;font:700 clamp(14px,1.5vw,30px) "Barlow Condensed",sans-serif;letter-spacing:.1em;color:rgba(232,244,224,.7);}' +
    '#bq .pin b{font:400 clamp(34px,5vw,100px)/1 "Bebas Neue",sans-serif;letter-spacing:.18em;color:#fff;}' +
    '@media (max-aspect-ratio:1/1){#bq{flex-direction:column;gap:4vh;text-align:center;}#bq .l{max-width:none;}#bq .st{justify-content:center;}#bq .qr{width:min(70vw,44vh);height:min(70vw,44vh);}}';
  var st = d.createElement('style'); st.textContent = css; (d.head || d.documentElement).appendChild(st);

  var el = d.createElement('div'); el.id = 'bq';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function qrSvg(text) { var q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 1, scalable: true }); }

  function paint() {
    var link = BASE + 'go.html?t=' + T + (pin ? '#pin=' + pin : '');
    var done = match && match.status === 'finished' && match.player1;
    var last = '';
    if (done) {
      var p1 = match.player1, p2 = match.player2 || {}, wn = match.matchWinner === 2 ? p2 : match.matchWinner === 1 ? p1 : null;
      last = '<div class="last">Last match: ' + (wn ? '<b>' + esc(wn.name) + '</b> won ' : '<b>' + esc(p1.name) + '</b> v <b>' + esc(p2.name) + '</b> ') + esc((p1.frames || 0) + '–' + (p2.frames || 0)) + '</div>';
    }
    var h = '<div class="l"><div class="brand">UPBSA.TV' + (match && match.tournament ? ' · ' + esc(String(match.tournament).toUpperCase()) : '') + '</div>' +
      '<div class="tn"><small>TABLE</small>' + esc(T) + '</div>' +
      '<div class="hd">' + (done ? 'Next match' : 'Ready for the next match') + '</div>' +
      '<div class="steps"><div class="st"><b>1</b>Referee: scan the code with your phone camera</div>' +
      '<div class="st"><b>2</b>' + (pin ? 'The remote opens already unlocked' : 'Enter the table PIN from the organiser') + '</div>' +
      '<div class="st"><b>3</b>Enter the players and start the match</div></div>' + last + '</div>' +
      '<div class="r"><div class="qr" id="bq-qr"></div><div class="cap">Scan to score</div>' +
      (pin ? '<div class="pin">PIN <b>' + esc(pin) + '</b></div>' : '') + '</div>';
    el.innerHTML = h;
    try { d.getElementById('bq-qr').innerHTML = qrSvg(link); lastQR = link; } catch (e) { }
  }
  function update() {
    var live = match && match.player1 && match.status !== 'finished';
    var want = !live && (!match || !match.player1 || (finishedSeen && Date.now() - finishedSeen >= AFTER_FINISH));
    if (want && !shown) { paint(); el.classList.add('on'); shown = true; }
    else if (!want && shown) { el.classList.remove('on'); shown = false; }
  }
  function start() {
    d.body.appendChild(el);
    firebase.database().ref('matches/table-' + T).on('value', function (s) {
      var m = s.val(), wasDone = match && match.status === 'finished';
      match = m;
      if (m && m.status === 'finished') { if (!wasDone) finishedSeen = Date.now(); }
      else finishedSeen = 0;
      if (shown) paint();
      update();
    });
    if (w.UA && UA.boardPin) UA.boardPin(T, function (p) { pin = p; if (shown) paint(); });
    setInterval(update, 1000);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window, document);
