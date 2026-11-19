/* bgm.js — 背景音乐按页名切曲 + 视频页 + 静音键（可选，零依赖）
   <audio id="bgm-track-1" src="assets/audio/01.mp3" data-from="封面" loop preload="auto"></audio>
   <audio id="bgm-track-2" src="assets/audio/02.mp3" data-from="PART 01" loop preload="none"></audio>
   - 曲子从 data-from 那一页起换，按页名找，不按序号；调页序不用改。
   - 浏览器要真实手势才出声：第一次按键或点击后开始播。M 静音／恢复。
   - 页上有 data-fx-focus="video"：进页把音乐压到 0、页内 <video> 从头播，翻走停视频、音乐恢复。
   - 打印前全部暂停，打印完恢复。
   在 fx-core.js 之后引入。 */
(function () {
  'use strict';
  var FADE_MS = 800, VOL = 1, stage, tracks = [], want = null, duck = false, muted = false, armed = false, iv = 0;

  function pick(slide) {
    var labels = [].map.call(stage.querySelectorAll(':scope > section'), function (s) { return s.getAttribute('data-label'); });
    var at = labels.indexOf(slide.getAttribute('data-label')), best = tracks[0];
    tracks.forEach(function (a) { var i = labels.indexOf(a.getAttribute('data-from')); if (i >= 0 && i <= at) best = a; });
    return best;
  }
  function apply() {
    if (!armed) return;
    tracks.forEach(function (a) { if (a === want && !duck && !muted && a.paused) a.play().catch(function () {}); });
    clearInterval(iv);
    var t0 = Date.now();
    iv = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / FADE_MS);
      tracks.forEach(function (a) {
        var target = (a === want && !duck && !muted) ? VOL : 0;
        a.volume = Math.max(0, Math.min(1, a.volume + (target - a.volume) * k));
        if (k === 1 && target === 0 && !a.paused) a.pause();
      });
      if (k === 1) clearInterval(iv);
    }, 50);
  }
  function onSlide(e) {
    var s = e.detail.slide, prev = e.detail.previousSlide;
    if (prev) [].forEach.call(prev.querySelectorAll('video'), function (v) { v.pause(); });
    duck = !!(s && s.getAttribute('data-fx-focus') === 'video');
    if (duck) [].forEach.call(s.querySelectorAll('video'), function (v) { v.currentTime = 0; v.play().catch(function () {}); });
    if (s && tracks.length) want = pick(s);
    apply();
  }
  function boot() {
    stage = document.querySelector('talk-stage');
    tracks = [].slice.call(document.querySelectorAll('audio[id^="bgm-track"]'));
    if (!stage) return;
    tracks.forEach(function (a) { a.volume = 0; });
    stage.addEventListener('slidechange', onSlide);
    var cur = stage.querySelector(':scope > section[data-deck-active]');
    if (cur) onSlide({ detail: { slide: cur } });
    ['keydown', 'pointerdown'].forEach(function (n) {
      window.addEventListener(n, function () {
        if (armed) return;
        armed = true;
        var cur = stage.querySelector(':scope > section[data-deck-active]');
        if (cur) onSlide({ detail: { slide: cur } }); else apply();
      }, true);
    });
    window.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (e.key !== 'm' && e.key !== 'M')) return;
      muted = !muted; apply();
    });
    window.addEventListener('beforeprint', function () { tracks.forEach(function (a) { a.pause(); }); });
    window.addEventListener('afterprint', apply);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
