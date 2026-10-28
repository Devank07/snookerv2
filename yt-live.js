/* UPBSA.TV — YouTube live streams
   settings/youtube   {handle, channelId}            public: channel link + "whatever is live" embed
   secret/ytKey       YouTube Data API key           staff only (optional, enables auto-detect)
   live/youtube       {at, live:[…], upcoming:[…]}   written by the Control Room, read by everyone
   live/streams       {table-3:{id,title}}           a stream link set by hand for a table
   YT.poll(db)  → (Control Room) checks the channel every 2 minutes, at most one device at a time.
   Cost: 2 API units per check ≈ 1,500 a day, well inside YouTube's free 10,000. */
(function (w) {
  'use strict';
  var YT = w.YT = { DEFAULT: '@upbsa' };
  YT.idFrom = function (s) {
    s = String(s || '').trim(); if (!s) return '';
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    var m = /(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/.exec(s); return m ? m[1] : '';
  };
  YT.handle = function (s) { s = String(s || '').trim(); var m = /youtube\.com\/(@[\w.-]+)/i.exec(s); if (m) return m[1]; if (/^@[\w.-]+$/.test(s)) return s; if (/^[\w.-]+$/.test(s)) return '@' + s; return ''; };
  YT.channelUrl = function (cfg) { cfg = cfg || {}; return cfg.handle ? 'https://www.youtube.com/' + cfg.handle : cfg.channelId ? 'https://www.youtube.com/channel/' + cfg.channelId : 'https://www.youtube.com/' + YT.DEFAULT; };
  YT.embed = function (id, mute) { return 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0&modestbranding=1' + (mute ? '&mute=1' : ''); };
  YT.embedChannel = function (cid) { return 'https://www.youtube-nocookie.com/embed/live_stream?channel=' + cid + '&autoplay=1&playsinline=1&rel=0'; };
  YT.tableOf = function (title) { var m = /\b(?:table|tbl|t)\s*[-#:]?\s*(\d{1,2})\b/i.exec(title || ''); return m ? +m[1] : 0; };

  /* every live stream a page should offer: auto-detected + set by hand */
  YT.streams = function (auto, manual) {
    var out = [], seen = {};
    Object.keys(manual || {}).forEach(function (k) { var s = manual[k]; if (!s || !s.id || seen[s.id]) return; seen[s.id] = 1; out.push({ id: s.id, title: s.title || ('Table ' + k.replace('table-', '')), table: parseInt(k.replace('table-', ''), 10) || 0, manual: true }); });
    ((auto && auto.live) || []).forEach(function (s) { if (!s || !s.id) return; if (seen[s.id]) { out.forEach(function (o) { if (o.id === s.id) { o.title = s.title || o.title; o.viewers = s.viewers; o.thumb = s.thumb; } }); return; } seen[s.id] = 1; out.push({ id: s.id, title: s.title, table: s.table || YT.tableOf(s.title), viewers: s.viewers, thumb: s.thumb, started: s.started }); });
    return out;
  };

  var API = 'https://www.googleapis.com/youtube/v3/';
  function j(url) { return fetch(url).then(function (r) { return r.json().then(function (d) { if (!r.ok || d.error) throw new Error((d.error && d.error.message) || r.status); return d; }); }); }
  YT.check = function (key, cfg) {
    var cid = cfg.channelId;
    var getId = cid ? Promise.resolve(cid) : j(API + 'channels?part=id&forHandle=' + encodeURIComponent((cfg.handle || YT.DEFAULT).replace(/^@/, '')) + '&key=' + key).then(function (d) { if (!d.items || !d.items[0]) throw new Error('Channel not found'); return d.items[0].id; });
    return getId.then(function (id) {
      cid = id;
      return j(API + 'playlistItems?part=contentDetails&maxResults=15&playlistId=UU' + id.slice(2) + '&key=' + key);
    }).then(function (d) {
      var ids = (d.items || []).map(function (x) { return x.contentDetails && x.contentDetails.videoId; }).filter(Boolean);
      if (!ids.length) return { channelId: cid, live: [], upcoming: [] };
      return j(API + 'videos?part=snippet,liveStreamingDetails&id=' + ids.join(',') + '&key=' + key).then(function (v) {
        var live = [], up = [];
        (v.items || []).forEach(function (x) {
          var sn = x.snippet || {}, ls = x.liveStreamingDetails || {}, th = (sn.thumbnails && (sn.thumbnails.medium || sn.thumbnails.default) || {}).url || '';
          var o = { id: x.id, title: sn.title || '', thumb: th, table: YT.tableOf(sn.title) };
          if (sn.liveBroadcastContent === 'live') { o.viewers = +ls.concurrentViewers || 0; o.started = ls.actualStartTime ? Date.parse(ls.actualStartTime) : 0; live.push(o); }
          else if (sn.liveBroadcastContent === 'upcoming') { o.at = ls.scheduledStartTime ? Date.parse(ls.scheduledStartTime) : 0; up.push(o); }
        });
        up.sort(function (a, b) { return a.at - b.at; });
        return { channelId: cid, live: live, upcoming: up.slice(0, 5) };
      });
    });
  };

  /* Control Room: keep live/youtube fresh */
  YT.poll = function (db, onStatus) {
    var key = null, cfg = {}, busy = false, EVERY = 120000;
    db.ref('secret/ytKey').on('value', function (s) { key = s.val() || null; tick(); });
    db.ref('settings/youtube').on('value', function (s) { cfg = s.val() || {}; });
    function tick() {
      if (!key || busy) { if (onStatus) onStatus(key ? 'busy' : 'nokey'); return; }
      busy = true;
      db.ref('live/youtube/at').once('value').then(function (s) {
        var at = s.val() || 0;
        if (Date.now() - at < EVERY - 5000) { busy = false; if (onStatus) onStatus('fresh', at); return; }   // another device checked just now
        return YT.check(key, cfg).then(function (r) {
          var up = { 'live/youtube': { at: firebase.database.ServerValue.TIMESTAMP, live: r.live, upcoming: r.upcoming } };
          if (r.channelId && r.channelId !== cfg.channelId) up['settings/youtube/channelId'] = r.channelId;
          return db.ref().update(up).then(function () { busy = false; if (onStatus) onStatus('ok', Date.now(), r); });
        });
      }).catch(function (e) { busy = false; if (onStatus) onStatus('error', Date.now(), e && e.message); });
    }
    setInterval(tick, 30000);
    return { now: function () { db.ref('live/youtube/at').set(0).then(tick); } };
  };
})(window);
