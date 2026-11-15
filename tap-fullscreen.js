/* UPBSA.TV — venue boards: tap or click anywhere to go fullscreen, tap again to leave.
   Buttons, links and boxes you type in keep working as normal. */
(function (w, d) {
  'use strict';
  function isFull() { return !!(d.fullscreenElement || d.webkitFullscreenElement); }
  function enter() { var e = d.documentElement, f = e.requestFullscreen || e.webkitRequestFullscreen; if (f) { try { var p = f.call(e, { navigationUI: 'hide' }); if (p && p.catch) p.catch(function () { }); } catch (x) { } } }
  function leave() { var f = d.exitFullscreen || d.webkitExitFullscreen; if (f) { try { var p = f.call(d); if (p && p.catch) p.catch(function () { }); } catch (x) { } } }
  var supported = !!(d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen);
  d.addEventListener('click', function (e) {
    if (!supported) return;
    if (e.target.closest('a,button,input,select,textarea,label,[contenteditable],[role=button],#ua-gate,.ua-gate,.ua-box')) return;
    if (w.getSelection && String(w.getSelection())) return;
    isFull() ? leave() : enter();
  });
  /* a small hint the first time, so people know */
  if (supported) w.addEventListener('load', function () {
    try { if (localStorage.getItem('upbsa_fs_hint')) return; localStorage.setItem('upbsa_fs_hint', '1'); } catch (x) { }
    var h = d.createElement('div'); h.textContent = 'Tap anywhere for fullscreen';
    h.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;padding:9px 16px;border-radius:999px;background:rgba(0,0,0,.75);border:1px solid rgba(240,192,64,.5);color:#f0c040;font:700 14px Inter,system-ui,sans-serif;letter-spacing:.5px;pointer-events:none;transition:opacity .6s';
    d.body.appendChild(h); setTimeout(function () { h.style.opacity = '0'; setTimeout(function () { h.remove(); }, 700); }, 4000);
  });
})(window, document);
