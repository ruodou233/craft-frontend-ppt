/* route.js — 路线开关 + 每页底部的章节条和页码（可选）。
   在 <head> 里、talk-stage.js 之前加载：
     <link rel="stylesheet" href="runtime/route.css">
     <script src="runtime/route.js"></script>
     <script src="runtime/talk-stage.js"></script>
   配置写在 talk-stage.js 之前的一段 JSON 里（没有这段就只画页码条）：
     <script type="application/json" id="talk-route">
     { "chapters": [ {"name": "开场", "start": "封面"}, {"name": "正文", "start": "第一个问题"} ],
       "routes":   { "short": ["封面", "第一个问题", "结尾"] } }
     </script>
   - 带 ?route=short 打开：解析 <section> 时就移除不在该路线里的页，讲者备注同步重排；
     不带参数一页都不动。
   - 每页底部注入 .tr-bar：章节分段 + 「07 / 24」页码。章节按页名起点自动归章，
     中间新插的页自动归入所在章节。
   - 页名（data-label）是接口：改名要同步改这里的 start 和路线。 */
(function () {
  'use strict';

  var cfg = { chapters: [], routes: {}, hideOn: [] };
  function readConfig() {
    var tag = document.getElementById('talk-route');
    if (!tag) return;
    try {
      var c = JSON.parse(tag.textContent || '{}');
      cfg.chapters = Array.isArray(c.chapters) ? c.chapters : [];
      cfg.routes = c.routes && typeof c.routes === 'object' ? c.routes : {};
      cfg.hideOn = Array.isArray(c.hideOn) ? c.hideOn : [];
    } catch (e) {
      console.warn('[route] #talk-route 不是合法 JSON，忽略', e);
    }
  }
  readConfig();

  var routeName = new URLSearchParams(location.search).get('route');
  var keepList = routeName && cfg.routes[routeName];
  var keep = Array.isArray(keepList) ? new Set(keepList) : null;
  var seen = [];                 // 原始页序的 data-label（讲者备注按它对齐）
  var seenSet = new WeakSet();
  var observers = [];

  if (keep) document.documentElement.setAttribute('data-route', routeName);

  function labelOf(el) { return el.getAttribute('data-label') || ''; }
  function isSlide(el) {
    return el.nodeType === 1 && el.tagName === 'SECTION' && !el.hasAttribute('slot');
  }

  function handleSection(el) {
    if (!keep || seenSet.has(el) || !isSlide(el)) return;
    seenSet.add(el);
    seen.push(labelOf(el));
    if (!keep.has(labelOf(el))) el.remove();
  }

  /* 解析阶段：先找到 <talk-stage>，再盯着它的直接子节点，来一页判一页。 */
  function watchStage(stage) {
    [].slice.call(stage.children).forEach(handleSection);
    var mo = new MutationObserver(function (records) {
      records.forEach(function (r) { [].forEach.call(r.addedNodes, handleSection); });
    });
    mo.observe(stage, { childList: true });
    observers.push(mo);
  }

  if (keep) {
    var finder = new MutationObserver(function () {
      var stage = document.querySelector('talk-stage');
      if (!stage) return;
      finder.disconnect();
      watchStage(stage);
    });
    finder.observe(document.documentElement, { childList: true, subtree: true });
    observers.push(finder);
  }

  function rewriteNotes(stage) {
    var tag = document.getElementById('speaker-notes');
    if (!tag) return;
    var all;
    try { all = JSON.parse(tag.textContent || '[]'); } catch (e) { return; }
    var out = [];
    seen.forEach(function (label, i) {
      if (keep.has(label)) out.push(all[i] == null ? '' : all[i]);
    });
    tag.textContent = '\n' + JSON.stringify(out, null, 1) + '\n';
    if ('_notes' in stage) stage._notes = out;
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function injectBars(stage) {
    var secs = [].slice.call(stage.children).filter(isSlide);
    var total = secs.length;
    var chapters = cfg.chapters;
    var starts = chapters.map(function (c) {
      return secs.findIndex(function (s) { return labelOf(s) === c.start; });
    });
    var chOf = [], cur = 0;
    secs.forEach(function (s, i) {
      starts.forEach(function (st, k) { if (st === i) cur = k; });
      chOf.push(cur);
    });
    var shown = chapters.map(function (c, k) { return chOf.indexOf(k) >= 0; });
    var hide = new Set(cfg.hideOn);

    secs.forEach(function (s, i) {
      if (hide.has(labelOf(s)) || s.querySelector(':scope > .tr-bar')) return;
      var bar = document.createElement('div');
      bar.className = 'tr-bar';
      bar.setAttribute('aria-hidden', 'true');
      chapters.forEach(function (c, k) {
        if (!shown[k]) return;
        var seg = document.createElement('span');
        seg.className = 'tr-seg' + (k === chOf[i] ? ' on' : '');
        seg.textContent = c.name;
        bar.appendChild(seg);
      });
      var pg = document.createElement('span');
      pg.className = 'tr-page';
      pg.innerHTML = '<b>' + pad2(i + 1) + '</b> / ' + pad2(total);
      bar.appendChild(pg);
      s.appendChild(bar);
      /* 有些特效进页时会整段重写 section 内容，条被冲掉了就立刻补回去。 */
      new MutationObserver(function () {
        if (bar.parentNode !== s) s.appendChild(bar);
      }).observe(s, { childList: true });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var stage = document.querySelector('talk-stage');
    if (!stage) return;
    if (keep) {
      [].slice.call(stage.children).forEach(handleSection);   // 兜底：没被观察到的页
      observers.forEach(function (o) { o.disconnect(); });
      rewriteNotes(stage);
    }
    injectBars(stage);
  });
})();
