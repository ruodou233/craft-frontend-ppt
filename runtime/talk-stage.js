/* talk-stage.js — 网页演讲翻页底座（零依赖，file:// 可用）
 *
 * 用法：在 <head> 里同步加载，然后
 *   <talk-stage width="1920" height="1080" duration="30">
 *     <section data-label="封面">…</section>
 *     <section data-label="…" data-deck-skip>…</section>   顺序翻页时跳过
 *   </talk-stage>
 *   <script type="application/json" id="speaker-notes">["第 1 页备注", ""]</script>
 *
 * 按键：→ / PageDown / 空格 下一步，← / PageUp 上一步，Home / End 首末页，
 *       P 演讲者窗，F 全屏。只在冒泡阶段处理且先看 defaultPrevented，
 *       所以页内节拍和特效在捕获阶段拦下的键不会翻页。
 * 事件：stage 上的 slidechange（detail: slide, previousSlide, index,
 *       previousIndex, total, reason），document 上的 talkgeometrychange。
 * 接口：goTo(i) next() prev() openPresenter()；slides/_slides、index、total、
 *       notes/_notes（可写）。
 * 当前页带 data-deck-active；URL 用 #N（从 1 起）深链接。
 *
 * 按行为规格独立实现；接口名沿用 Claude Design 演讲组件的约定，以便旧特效直接可用，
 * 但不含其代码。Apache-2.0。 */
(function () {
  'use strict';
  if (!window.customElements || customElements.get('talk-stage')) return;

  var NEXT_KEYS = { ArrowRight: 1, PageDown: 1, ' ': 1 };
  var PREV_KEYS = { ArrowLeft: 1, PageUp: 1 };
  var SWIPE_MIN = 60, SWIPE_RATIO = 1.5, SWIPE_MS = 800, FONT_WAIT_MS = 3000;

  function num(v, d) { var n = parseFloat(v); return n > 0 ? n : d; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function isTypingTarget(e) {
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    return !!t && t.nodeType === 1 && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  /* 文档级样式：只放打印分页（@page 和分页规则必须在文档层）。 */
  function docStyle(w, h) {
    var el = document.getElementById('talk-stage-doc-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'talk-stage-doc-style';
      (document.head || document.documentElement).appendChild(el);
    }
    var printable = 'section:not([slot]):not([data-deck-skip])';
    el.textContent =
      '@page{size:' + w + 'px ' + h + 'px;margin:0}\n' +
      '@media print{' +
      'html,body{margin:0!important;padding:0!important;height:auto!important;overflow:visible!important}' +
      'talk-stage{position:static!important;inset:auto!important;width:auto!important;height:auto!important;overflow:visible!important}' +
      'talk-stage>section{position:relative!important;inset:auto!important;' +
      '-webkit-print-color-adjust:exact;print-color-adjust:exact;break-inside:avoid}' +
      'talk-stage>' + printable + '~' + printable + '{break-before:page}' +
      '}';
  }

  function shadowCSS(w, h) {
    return '' +
      ':host{position:fixed;inset:0;display:block;overflow:hidden;background:#000}' +
      '.canvas{position:absolute;left:50%;top:50%;width:' + w + 'px;height:' + h + 'px;' +
      'margin:-' + (h / 2) + 'px 0 0 -' + (w / 2) + 'px;transform-origin:50% 50%;' +
      'transform:scale(calc(var(--ts-fit,1) * var(--fx-bass-scale,1)))}' +
      /* 页的默认尺寸和定位只是兜底：页面自己的 CSS 优先 */
      '::slotted(section){position:relative;box-sizing:border-box;width:' + w + 'px;height:' + h + 'px;overflow:hidden}' +
      '@media not print{::slotted(section:not([data-deck-active])){display:none!important}}' +
      '.toast{position:absolute;right:24px;bottom:24px;max-width:520px;padding:12px 18px;' +
      'font:15px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif;color:#fff;background:rgba(20,20,20,.92);' +
      'border:1px solid rgba(255,255,255,.25);border-radius:6px;z-index:2147483647;pointer-events:none}' +
      '.toast[hidden]{display:none}' +
      '@media print{:host{visibility:visible}' +
      '.canvas{position:static;margin:0;width:auto;height:auto;transform:none;visibility:visible!important}' +
      '::slotted(section[data-deck-skip]){display:none!important}.toast{display:none!important}}';
  }

  function TalkStage() {
    return Reflect.construct(HTMLElement, [], TalkStage);
  }
  TalkStage.prototype = Object.create(HTMLElement.prototype);
  TalkStage.prototype.constructor = TalkStage;
  Object.setPrototypeOf(TalkStage, HTMLElement);
  TalkStage.observedAttributes = ['width', 'height'];
  var P = TalkStage.prototype;

  P._init = function () {
    if (this._inited) return;
    this._inited = true;
    this._list = [];
    this._cur = null;
    this._idx = -1;
    this._started = false;
    this._queue = [];
    this._dispatching = false;
    this._notesRaw = [];
    this._notesSet = false;
    this._geo = null;
    this._synthReason = null;
    this._presenterSeen = false;
    this._styleSig = '';
    this._timerReset();
    var root = this.attachShadow({ mode: 'open' });
    root.innerHTML = '<style></style><div class="canvas" part="canvas"><slot></slot></div>' +
      '<div class="toast" hidden role="status"></div>';
    this._style = root.firstChild;
    this._canvas = root.querySelector('.canvas');
    this._toast = root.querySelector('.toast');
    this._applySize();
    /* 等字体：保持已排版但不可见，最长 3 秒 */
    var canvas = this._canvas, shown = false;
    canvas.style.visibility = 'hidden';
    function show() { if (!shown) { shown = true; canvas.style.visibility = ''; } }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(show, show);
    else show();
    setTimeout(show, FONT_WAIT_MS);
  };

  P._applySize = function () {
    this._W = num(this.getAttribute('width'), 1920);
    this._H = num(this.getAttribute('height'), 1080);
    if (this._style) this._style.textContent = shadowCSS(this._W, this._H);
    docStyle(this._W, this._H);
    this._fit();
  };

  P.attributeChangedCallback = function () { if (this._inited) this._applySize(); };

  P.connectedCallback = function () {
    this._init();
    if (this._bound) return;
    this._bound = true;
    var self = this;
    this._onKey = function (e) { self._key(e); };
    window.addEventListener('keydown', this._onKey);
    this._bindTouch();
    this._onHash = function () { self._fromHash(); };
    window.addEventListener('hashchange', this._onHash);
    this._onFit = function () { self._fit(); };
    window.addEventListener('resize', this._onFit);
    document.addEventListener('fullscreenchange', this._onFit);
    window.addEventListener('afterprint', this._onFit);
    if (window.ResizeObserver) { this._ro = new ResizeObserver(this._onFit); this._ro.observe(this); }
    this._bindChannel();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { self._start(); });
    } else {
      this._start();
    }
    this._fit();
  };

  /* ── 页列表与首次激活 ── */
  P._computeList = function () {
    return [].filter.call(this.children, function (el) {
      return el.tagName === 'SECTION' && !el.hasAttribute('slot');
    });
  };

  P._start = function () {
    if (this._started) return;
    this._started = true;
    var self = this;
    if (!this._notesSet) this._readNotes();
    this._list = this._computeList();
    this._list.forEach(function (s) { s.removeAttribute('data-deck-active'); });
    var h = this._parseHash();
    if (this._list.length) this._switch(h.index, 'init');
    else this._writeHash();
    this._mo = new MutationObserver(function () { self._mutated(); });
    this._mo.observe(this, { childList: true });
    this._fit();
  };

  P._mutated = function () {
    var cur = this._cur, oldIdx = this._idx;
    this._list = this._computeList();
    var list = this._list;
    list.forEach(function (s) { if (s !== cur) s.removeAttribute('data-deck-active'); });
    if (!list.length) { if (cur) cur.removeAttribute('data-deck-active'); this._cur = null; this._idx = -1; return; }
    var ni = cur ? list.indexOf(cur) : -1;
    if (ni >= 0) {
      if (ni !== this._idx) { this._idx = ni; this._writeHash(); }
      this._broadcast();
      return;
    }
    this._idx = -1;
    this._switch(Math.min(Math.max(oldIdx, 0), list.length - 1), 'mutation', cur);
  };

  /* ── 切页核心：先改属性，再改 hash，再派发，再广播；回调里再翻页就排队 ── */
  P._switch = function (i, reason, removedPrev) {
    if (!this._started) this._start();
    var list = this._list;
    if (!list.length) return -1;
    i = Math.trunc(Number(i));
    if (!isFinite(i)) i = 0;
    i = Math.max(0, Math.min(list.length - 1, i));
    if (this._dispatching) { this._queue.push([i, reason]); return i; }
    var next = list[i];
    var prev = removedPrev || this._cur;
    if (next === this._cur && !removedPrev) return i;
    var prevIdx = removedPrev ? -1 : this._idx;
    if (prev) prev.removeAttribute('data-deck-active');
    next.setAttribute('data-deck-active', '');
    this._cur = next;
    this._idx = i;
    this._writeHash();
    this._timerOnSwitch(reason);
    this._dispatching = true;
    try {
      this.dispatchEvent(new CustomEvent('slidechange', {
        bubbles: true, composed: true,
        detail: {
          slide: next, previousSlide: reason === 'init' ? null : (prev || null),
          index: i, previousIndex: reason === 'init' ? -1 : prevIdx,
          total: list.length, reason: reason,
        },
      }));
    } finally {
      this._dispatching = false;
    }
    this._broadcast(reason === 'init');
    while (this._queue.length && !this._dispatching) {
      var q = this._queue.shift();
      this._switch(q[0], q[1]);
    }
    return this._idx;
  };

  /* 顺序翻页：跳过 data-deck-skip（每次现读属性） */
  P._step = function (dir, reason) {
    var list = this._list, i = this._idx + dir;
    while (i >= 0 && i < list.length && list[i].hasAttribute('data-deck-skip')) i += dir;
    if (i < 0 || i >= list.length) return this._idx;
    return this._switch(i, reason);
  };
  P._edge = function (last, reason) {
    var list = this._list, i = last ? list.length - 1 : 0, dir = last ? -1 : 1;
    while (i >= 0 && i < list.length && list[i].hasAttribute('data-deck-skip')) i += dir;
    if (i < 0 || i >= list.length) return this._idx;
    return this._switch(i, reason);
  };
  P._nextPlayable = function (from) {
    var list = this._list, i = from + 1;
    while (i < list.length && list[i].hasAttribute('data-deck-skip')) i++;
    return i < list.length ? i : -1;
  };

  /* ── 深链接 #N ── */
  P._parseHash = function () {
    var h = location.hash.replace(/^#/, '');
    if (!/^-?\d+$/.test(h)) return { index: 0 };
    return { index: parseInt(h, 10) - 1 };
  };
  P._writeHash = function () {
    if (!this._started) return;
    var want = '#' + (this._idx >= 0 ? this._idx + 1 : 1);
    if (location.hash === want) return;
    try {
      history.replaceState(history.state, '', location.pathname + location.search + want);
    } catch (e) {
      location.replace(want);
    }
  };
  P._fromHash = function () {
    if (!this._started) return;
    var i = this._parseHash().index;
    this._switch(i, 'hash');
    this._writeHash();
  };

  /* ── 键盘：冒泡阶段，尊重 defaultPrevented ── */
  P._key = function (e) {
    if (e.defaultPrevented || !this._started || !this.isConnected) return;
    if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e)) return;
    var k = e.key, reason = this._synthReason || 'keyboard';
    if (NEXT_KEYS[k]) { e.preventDefault(); this._step(1, reason); }
    else if (PREV_KEYS[k]) { e.preventDefault(); this._step(-1, reason); }
    else if (k === 'Home') { e.preventDefault(); this._edge(false, reason); }
    else if (k === 'End') { e.preventDefault(); this._edge(true, reason); }
    else if ((k === 'p' || k === 'P') && reason === 'keyboard') { e.preventDefault(); this.openPresenter(); }
    else if ((k === 'f' || k === 'F') && reason === 'keyboard') { e.preventDefault(); this._toggleFullscreen(); }
  };

  /* 合成 keydown：触摸和演讲者窗的翻页都走这条路，页内节拍照样生效 */
  P._synthKey = function (key, reason) {
    var ev = new KeyboardEvent('keydown', { key: key, code: key, bubbles: true, cancelable: true, composed: true });
    this._synthReason = reason;
    try { (document.body || document.documentElement).dispatchEvent(ev); }
    finally { this._synthReason = null; }
  };

  P._toggleFullscreen = function () {
    var d = document;
    var p = d.fullscreenElement ? d.exitFullscreen() : d.documentElement.requestFullscreen();
    if (p && p.catch) p.catch(function () {});
  };

  /* ── 触摸：只认 touch / pen 的水平快滑 ── */
  P._bindTouch = function () {
    var self = this, g = null;
    function finish(x, y) {
      var s = g; g = null;
      if (!s || performance.now() - s.t > SWIPE_MS) return;
      var dx = x - s.x, dy = y - s.y;
      if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= SWIPE_RATIO * Math.abs(dy)) return;
      self._synthKey(dx < 0 ? 'ArrowRight' : 'ArrowLeft', 'touch');
    }
    window.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      if (e.defaultPrevented || !e.isPrimary) { g = null; return; }
      g = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), cancelled: false };
    });
    window.addEventListener('pointerup', function (e) {
      if (g && e.pointerId === g.id && !g.cancelled) finish(e.clientX, e.clientY);
    });
    /* 浏览器接管手势时会发 pointercancel；这时改用 touchend 的坐标收尾 */
    window.addEventListener('pointercancel', function (e) { if (g && e.pointerId === g.id) g.cancelled = true; });
    window.addEventListener('touchend', function (e) {
      if (g && g.cancelled && e.changedTouches && e.changedTouches[0]) {
        finish(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    });
  };

  /* ── 缩放：fit × --fx-bass-scale，几何变化时在 document 上派发事件 ── */
  P._fit = function () {
    if (!this._canvas) return;
    var cw = this.clientWidth, ch = this.clientHeight;
    if (!cw || !ch) return;
    var fit = Math.min(cw / this._W, ch / this._H);
    this._canvas.style.setProperty('--ts-fit', String(fit));
    var r = this.getBoundingClientRect();
    var w = this._W * fit, h = this._H * fit;
    var geo = { scale: fit, offsetX: r.left + (cw - w) / 2, offsetY: r.top + (ch - h) / 2, width: w, height: h };
    var old = this._geo;
    if (old && old.scale === geo.scale && old.offsetX === geo.offsetX && old.offsetY === geo.offsetY &&
        old.width === geo.width && old.height === geo.height) return;
    this._geo = geo;
    document.dispatchEvent(new CustomEvent('talkgeometrychange', { detail: geo }));
  };

  /* ── 备注：#speaker-notes 是 JSON 字符串数组，按页序对齐 ── */
  P._readNotes = function () {
    var tag = document.getElementById('speaker-notes'), raw = [];
    if (tag) {
      try {
        raw = JSON.parse(tag.textContent || '[]');
        if (!Array.isArray(raw)) throw new Error('not an array');
      } catch (err) {
        console.warn('[talk-stage] #speaker-notes 不是合法的 JSON 字符串数组，按无备注处理', err);
        raw = [];
      }
    }
    this._notesRaw = raw;
  };
  P._noteList = function () {
    var raw = this._notesRaw || [], out = [];
    for (var i = 0; i < this._list.length; i++) out.push(raw[i] == null ? '' : String(raw[i]));
    return out;
  };
  P._setNotes = function (v) {
    this._notesRaw = Array.isArray(v) ? v.slice() : [];
    this._notesSet = true;
    this._broadcast();
  };

  /* ── 公开接口 ── */
  P.goTo = function (i) {
    if (!this._started) this._start();
    if (!this._list.length) return -1;
    return this._switch(i, 'api');
  };
  P.next = function () { return this._step(1, 'api'); };
  P.prev = function () { return this._step(-1, 'api'); };
  Object.defineProperties(P, {
    slides: { get: function () { return (this._list || []).slice(); } },
    _slides: { get: function () { return (this._list || []).slice(); } },
    index: { get: function () { return this._idx; } },
    total: { get: function () { return (this._list || []).length; } },
    notes: { get: function () { return this._noteList(); }, set: function (v) { this._setNotes(v); } },
    _notes: { get: function () { return this._noteList(); }, set: function (v) { this._setNotes(v); } },
  });

  /* ── 排练计时：状态只存在观众窗；演讲者窗只显示和发命令。按页元素记账，增删页不串号 ── */
  P._timerReset = function () {
    this._t = { started: false, running: false, startedAt: 0, acc: 0, since: 0,
      page: null, pageAcc: 0, pageSince: 0, per: new Map() };
    this._timerLoop(false);
  };
  P._timerEnter = function (sec) {
    var t = this._t;
    t.page = sec || null; t.pageAcc = 0; t.pageSince = Date.now();
    if (!sec) return;
    var rec = t.per.get(sec) || { ms: 0, visits: 0 };
    rec.visits += 1;
    t.per.set(sec, rec);
  };
  P._timerCommitPage = function () {
    var t = this._t;
    if (!t.page) return;
    var rec = t.per.get(t.page) || { ms: 0, visits: 0 };
    rec.ms += t.pageAcc + (t.running ? Date.now() - t.pageSince : 0);
    t.per.set(t.page, rec);
    t.pageAcc = 0;
  };
  P._timerStart = function () {
    var t = this._t, now = Date.now();
    if (t.running) return;
    t.running = true; t.since = now;
    if (!t.started) {
      t.started = true; t.startedAt = now; t.acc = 0;
      this._timerEnter(this._cur);
    } else {
      t.pageSince = now;
    }
    this._timerLoop(true);
  };
  P._timerPause = function () {
    var t = this._t, now = Date.now();
    if (!t.running) return;
    t.acc += now - t.since;
    t.pageAcc += now - t.pageSince;
    t.running = false;
    this._timerLoop(false);
  };
  /* 每次切页：把上一页的停留记到它头上，新页进入次数 +1；暂停时只换页不计数 */
  P._timerOnSwitch = function (reason) {
    var t = this._t;
    if (!t.started) {
      if (this._presenterSeen && reason !== 'init' && reason !== 'mutation') this._timerStart();
      return;
    }
    this._timerCommitPage();
    if (t.running) this._timerEnter(this._cur);
    else { t.page = this._cur; t.pageAcc = 0; }
  };
  P._timerLoop = function (on) {
    var self = this;
    if (on && !this._tickIv) {
      this._tickIv = setInterval(function () { self._post({ type: 'tick', timer: self._timerState() }); }, 1000);
    } else if (!on && this._tickIv) {
      clearInterval(this._tickIv); this._tickIv = 0;
    }
  };
  P._timerState = function () {
    var t = this._t, now = Date.now(), list = this._list || [], per = [];
    var live = t.pageAcc + (t.running ? now - t.pageSince : 0);
    list.forEach(function (sec, i) {
      var rec = t.per.get(sec);
      if (!rec) return;
      per.push({ index: i, label: sec.getAttribute('data-label') || '',
        ms: rec.ms + (sec === t.page ? live : 0), visits: rec.visits });
    });
    var minutes = num(this.getAttribute('duration'), 0);
    return {
      running: t.running, started: t.started, startedAt: t.startedAt,
      elapsedMs: t.acc + (t.running ? now - t.since : 0),
      pageElapsedMs: t.page && t.page === this._cur ? live : 0,
      budgetMs: minutes * 60000, perPage: per,
    };
  };

  /* ── 演讲者窗通道 ── */
  P._channelName = function () { return 'talk-stage:' + location.pathname; };
  P._bindChannel = function () {
    if (!window.BroadcastChannel || this._bc) return;
    var self = this;
    this._session = Math.random().toString(36).slice(2);
    this._bc = new BroadcastChannel(this._channelName());
    this._bc.onmessage = function (e) { self._onMessage(e.data || {}); };
    window.addEventListener('pagehide', function () { self._post({ type: 'bye', session: self._session }); });
  };
  P._post = function (msg) {
    if (!this._bc) return;
    try { this._bc.postMessage(msg); } catch (err) { /* 通道已关闭 */ }
  };
  P._onMessage = function (m) {
    if (!this._started) return;
    if (m.type === 'hello') {
      this._presenterSeen = true;
      this._broadcast(true);
    } else if (m.type === 'nav') {
      var map = { next: 'ArrowRight', prev: 'ArrowLeft', first: 'Home', last: 'End' };
      if (map[m.action]) this._synthKey(map[m.action], 'remote');
      else if (m.action === 'goto') this._switch(m.index, 'remote');
    } else if (m.type === 'timer-cmd') {
      if (m.action === 'start') this._timerStart();
      else if (m.action === 'pause') this._timerPause();
      else if (m.action === 'reset') this._timerReset();
      this._broadcast();
    }
  };

  /* 静态快照：去掉脚本、音频、画布，视频换成封面图 */
  function snapshot(sec) {
    if (!sec) return '';
    var c = sec.cloneNode(true);
    c.setAttribute('data-deck-active', '');
    [].forEach.call(c.querySelectorAll('script,audio,canvas,iframe,object,embed'), function (n) { n.remove(); });
    [c].concat([].slice.call(c.querySelectorAll('*'))).forEach(function (el) {
      [].slice.call(el.attributes).forEach(function (a) { if (/^on/i.test(a.name)) el.removeAttribute(a.name); });
    });
    [].forEach.call(c.querySelectorAll('video'), function (v) {
      var r = document.createElement(v.getAttribute('poster') ? 'img' : 'div');
      if (v.getAttribute('poster')) { r.setAttribute('src', v.getAttribute('poster')); r.setAttribute('alt', ''); }
      if (v.className) r.className = v.className;
      if (v.getAttribute('style')) r.setAttribute('style', v.getAttribute('style'));
      r.setAttribute('data-ts-video', '');
      v.replaceWith(r);
    });
    return c.outerHTML;
  }
  function collectStyles() {
    var out = [];
    [].forEach.call(document.querySelectorAll('style,link[rel~="stylesheet"]'), function (el) {
      if (el.id === 'talk-stage-doc-style') return;
      if (el.tagName === 'STYLE') out.push({ t: 's', v: el.textContent });
      else if (el.href) out.push({ t: 'l', v: el.href });
    });
    return out;
  }

  P._broadcast = function (force) {
    if (!this._bc || !this._started) return;
    var list = this._list, i = this._idx, cur = list[i];
    var ni = this._nextPlayable(i);
    var notes = this._noteList();
    var msg = {
      type: 'state', session: this._session,
      index: i, total: list.length,
      label: cur ? (cur.getAttribute('data-label') || '') : '',
      skip: !!(cur && cur.hasAttribute('data-deck-skip')),
      nextIndex: ni, nextLabel: ni >= 0 ? (list[ni].getAttribute('data-label') || '') : '',
      note: i >= 0 ? notes[i] : '',
      timer: this._timerState(),
      title: document.title,
      file: decodeURIComponent(location.pathname.split('/').pop() || 'talk').replace(/\.[^.]+$/, ''),
      width: this._W, height: this._H,
    };
    if (this._presenterSeen) {
      msg.currentHTML = snapshot(cur);
      msg.nextHTML = ni >= 0 ? snapshot(list[ni]) : '';
      var styles = collectStyles();
      var sig = styles.length + ':' + styles.reduce(function (n, s) { return n + s.v.length; }, 0);
      if (force || sig !== this._styleSig) {
        this._styleSig = sig;
        msg.styles = styles;
        msg.base = location.href.split('#')[0];
      }
    }
    this._post(msg);
  };

  /* ── 打开演讲者窗：空白同源弹窗，由本窗写入界面，不重新加载演讲页 ── */
  P.openPresenter = function () {
    var name = 'talk-presenter:' + location.pathname;
    var w = null;
    try { w = window.open('', name, 'popup,width=1280,height=800'); } catch (err) { w = null; }
    if (!w) { this._showToast('浏览器拦截了演讲者窗，请允许本页弹出窗口后再按 P'); return null; }
    var built = true;
    try { built = !!w.document.documentElement.hasAttribute('data-talk-presenter'); } catch (err) { built = true; }
    if (!built) {
      var cfg = { channel: this._channelName(), width: this._W, height: this._H };
      var html = '<!doctype html><html data-talk-presenter lang="zh-CN"><head><meta charset="utf-8">' +
        '<base href="' + location.href.split('#')[0].replace(/"/g, '&quot;') + '">' +
        '<title>演讲者 · ' + (document.title || '').replace(/</g, '&lt;') + '</title></head><body>' +
        '<script>(' + presenterMain.toString() + ')(' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ');<\/script></body></html>';
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
    try { w.focus(); } catch (err) { /* 忽略 */ }
    return w;
  };

  P._showToast = function (text) {
    var t = this._toast, self = this;
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(function () { t.hidden = true; }, 3000);
  };

  /* ── 演讲者窗的界面脚本：整段以文本写进弹窗，在弹窗自己的环境里运行。
       观众窗刷新不会中断它，靠 BroadcastChannel 重新同步。 ── */
  function presenterMain(cfg) {
    var W = cfg.width, H = cfg.height;
    var bc = new BroadcastChannel(cfg.channel);
    var st = null, timer = null, timerAt = 0, session = null, helloFor = null, connected = false;
    var fontSize = 26;
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function mmss(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
    function send(m) { try { bc.postMessage(m); } catch (e) { /* 忽略 */ } }

    document.documentElement.setAttribute('data-fx-motion', 'reduced');
    var own = document.createElement('style');
    own.id = 'ts-presenter-own';
    own.textContent =
      'html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:#111!important}' +
      ':where(.ts-preview){display:block;position:absolute!important;inset:auto!important;left:0!important;top:0!important;margin:0!important;' +
      'width:' + W + 'px!important;height:' + H + 'px!important;overflow:hidden!important;transform-origin:0 0!important}' +
      ':where(.ts-preview)>section{position:relative;box-sizing:border-box;width:' + W + 'px;height:' + H + 'px;overflow:hidden;display:block}' +
      '.ts-preview *,.ts-preview *::before,.ts-preview *::after{animation-duration:0s!important;animation-delay:0s!important;' +
      'animation-iteration-count:1!important;transition:none!important}' +
      '.ts-preview [data-beat]{opacity:1!important;transform:none!important}' +
      '.ts-frame{position:absolute;inset:0;overflow:hidden;background:#000}';

    var host = document.createElement('div');
    host.id = 'ts-presenter';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' +
      ':host{all:initial}' +
      '*{box-sizing:border-box}' +
      '.app{position:fixed;inset:0;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,1fr);' +
      'grid-template-rows:auto minmax(0,1fr) minmax(0,.9fr);gap:12px;padding:12px;background:#111;color:#eee;' +
      'font:15px/1.5 system-ui,-apple-system,"PingFang SC","Noto Sans SC",sans-serif}' +
      '.bar{grid-column:1/3;display:flex;align-items:center;gap:16px;min-height:36px}' +
      '.page{font-size:20px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}' +
      '.skip{color:#f5b041;font-weight:400;margin-left:6px}' +
      '.clock{font:600 20px ui-monospace,Menlo,monospace;color:#aaa}' +
      '.lost{background:#a93226;color:#fff;padding:4px 10px;border-radius:4px}.lost[hidden]{display:none}' +
      '.cur{grid-row:2;min-height:0;display:flex;align-items:center;justify-content:center}' +
      '.box{position:relative;aspect-ratio:' + W + '/' + H + ';width:100%;flex:none;' +
      'border:1px solid #333;background:#000;overflow:hidden}' +
      '.side{grid-row:2/4;grid-column:2;display:flex;flex-direction:column;gap:10px;min-height:0}' +
      '.cap{color:#888;font-size:13px;letter-spacing:.06em}' +
      '.times{display:flex;gap:18px;align-items:baseline;font-family:ui-monospace,Menlo,monospace}' +
      '.total{font-size:34px;font-weight:700}.total.over{color:#e74c3c}.budget{color:#888;font-size:18px}' +
      '.pagetime{font-size:20px;color:#bbb}' +
      '.btns{display:flex;flex-wrap:wrap;gap:8px}' +
      'button{font:inherit;color:#eee;background:#222;border:1px solid #444;border-radius:4px;padding:6px 12px;cursor:pointer}' +
      'button:hover{border-color:#888}button:focus-visible{outline:2px solid #5dade2;outline-offset:1px}' +
      '.tablewrap{flex:1;min-height:80px;overflow:auto;border:1px solid #333}' +
      'table{width:100%;border-collapse:collapse;font-size:13px}' +
      'th,td{padding:3px 8px;text-align:left;border-bottom:1px solid #2a2a2a;white-space:nowrap}' +
      'td.l{white-space:normal}th{position:sticky;top:0;background:#1b1b1b;color:#999;font-weight:500}' +
      'tr.on td{background:#1f3a52;color:#fff}' +
      '.notes{grid-row:3;grid-column:1;min-height:0;overflow:auto;padding:12px 16px;background:#181818;border:1px solid #333;' +
      'white-space:pre-wrap;word-break:break-word;line-height:1.55}' +
      '.notes.empty{color:#777}' +
      '</style>' +
      '<div class="app">' +
      '<div class="bar"><div class="page" id="page">等待观众窗…</div><span class="lost" id="lost" hidden>观众窗已断开</span>' +
      '<span class="clock" id="clock"></span></div>' +
      '<div class="cur" id="curwrap"><div class="box" id="curbox"><slot name="cur"></slot></div></div>' +
      '<div class="side">' +
      '<div class="cap" id="nextcap">下一页</div><div class="box" id="nextbox" style="width:100%"><slot name="next"></slot></div>' +
      '<div class="times"><span class="total" id="total">00:00</span><span class="budget" id="budget"></span>' +
      '<span class="pagetime">本页 <b id="pagetime">00:00</b></span></div>' +
      '<div class="btns"><button id="prev">上一步</button><button id="next">下一步</button>' +
      '<button id="run">开始计时</button><button id="reset">重置计时</button>' +
      '<button id="fminus" title="备注字号 -">A-</button><button id="fplus" title="备注字号 +">A+</button>' +
      '<button id="csv">导出 CSV</button></div>' +
      '<div class="tablewrap"><table><thead><tr><th>页</th><th>页名</th><th>累计</th><th>进入</th></tr></thead>' +
      '<tbody id="rows"></tbody></table></div>' +
      '</div>' +
      '<div class="notes empty" id="notes">本页无备注</div>' +
      '</div>';
    function $(id) { return root.getElementById(id); }

    function makeFrame(slot) {
      var f = document.createElement('div');
      f.className = 'ts-frame';
      f.slot = slot;
      var p = document.createElement('talk-stage');
      p.className = 'ts-preview';
      f.appendChild(p);
      host.appendChild(f);
      return { frame: f, stage: p, html: null };
    }
    var cur = makeFrame('cur'), nxt = makeFrame('next');
    function fitPreview(pv) {
      var w = pv.frame.clientWidth;
      if (w) pv.stage.style.transform = 'scale(' + (w / W) + ')';
    }
    function fitAll() {
      var wrap = $('curwrap'), box = $('curbox');
      var bw = Math.max(0, Math.min(wrap.clientWidth, wrap.clientHeight * W / H) - 2);
      box.style.width = bw + 'px';
      fitPreview(cur); fitPreview(nxt);
    }
    if (window.ResizeObserver) { var ro = new ResizeObserver(fitAll); ro.observe($('curwrap')); ro.observe(nxt.frame); }
    window.addEventListener('resize', fitAll);

    function setPreview(pv, html) {
      if (pv.html === html) return;
      pv.html = html;
      pv.stage.innerHTML = html || '';
      fitPreview(pv);
    }
    function applyStyles(list, base) {
      [].slice.call(document.head.querySelectorAll('[data-ts-copied]')).forEach(function (n) { n.remove(); });
      if (base) {
        var b = document.head.querySelector('base');
        if (b) b.href = base;
      }
      list.forEach(function (s) {
        var n;
        if (s.t === 'l') { n = document.createElement('link'); n.rel = 'stylesheet'; n.href = s.v; }
        else { n = document.createElement('style'); n.textContent = s.v; }
        n.setAttribute('data-ts-copied', '');
        document.head.insertBefore(n, own.parentNode === document.head ? own : null);
      });
      if (own.parentNode !== document.head) document.head.appendChild(own);
    }

    function renderTimer() {
      if (!timer) return;
      var live = timer.running ? Date.now() - timerAt : 0;
      var total = timer.elapsedMs + live;
      $('total').textContent = mmss(total);
      $('total').classList.toggle('over', timer.budgetMs > 0 && total > timer.budgetMs);
      $('budget').textContent = timer.budgetMs > 0 ? '/ ' + mmss(timer.budgetMs) : '';
      $('pagetime').textContent = mmss(timer.pageElapsedMs + live);
      $('run').textContent = timer.running ? '暂停计时' : (timer.started ? '继续计时' : '开始计时');
    }
    function renderRows() {
      var tb = $('rows');
      tb.textContent = '';
      (timer ? timer.perPage : []).forEach(function (r) {
        var tr = document.createElement('tr');
        if (st && r.index === st.index) tr.className = 'on';
        [String(r.index + 1), r.label, mmss(r.ms), String(r.visits)].forEach(function (v, k) {
          var td = document.createElement('td');
          if (k === 1) td.className = 'l';
          td.textContent = v;
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
    }
    function setTimer(t) { timer = t; timerAt = Date.now(); renderTimer(); renderRows(); }

    function render() {
      if (!st) return;
      var total = st.total;
      $('page').textContent = (st.index >= 0 ? pad(st.index + 1) : '--') + ' / ' + pad(total) + (st.label ? ' · ' + st.label : '');
      if (st.skip) {
        var s = document.createElement('span'); s.className = 'skip'; s.textContent = '（跳过页）'; $('page').appendChild(s);
      }
      $('nextcap').textContent = st.nextIndex >= 0 ? '下一页 · ' + pad(st.nextIndex + 1) + (st.nextLabel ? ' ' + st.nextLabel : '') : '下一页 · 已是最后一页';
      var n = $('notes');
      if (st.note) { n.textContent = st.note; n.classList.remove('empty'); }
      else { n.textContent = '本页无备注'; n.classList.add('empty'); }
      document.title = '演讲者 · ' + (st.index + 1) + '/' + total + (st.title ? ' · ' + st.title : '');
    }

    bc.onmessage = function (e) {
      var m = e.data || {};
      if (m.type === 'state') {
        if (m.session !== session) { session = m.session; helloFor = null; }
        if (m.currentHTML === undefined && helloFor !== session) { helloFor = session; send({ type: 'hello' }); }
        connected = true;
        $('lost').hidden = true;
        if (m.styles) applyStyles(m.styles, m.base);
        st = m;
        if (m.currentHTML !== undefined) { setPreview(cur, m.currentHTML); setPreview(nxt, m.nextHTML); }
        render();
        if (m.timer) setTimer(m.timer);
      } else if (m.type === 'tick') {
        if (m.timer) { timer = m.timer; timerAt = Date.now(); renderTimer(); renderRows(); }
      } else if (m.type === 'bye') {
        connected = false;
        $('lost').hidden = false;
      }
    };

    function nav(action) { send({ type: 'nav', action: action }); }
    $('prev').onclick = function () { nav('prev'); };
    $('next').onclick = function () { nav('next'); };
    $('run').onclick = function () { send({ type: 'timer-cmd', action: timer && timer.running ? 'pause' : 'start' }); };
    $('reset').onclick = function () { send({ type: 'timer-cmd', action: 'reset' }); };
    function setFont(px) { fontSize = Math.max(18, Math.min(48, px)); $('notes').style.fontSize = fontSize + 'px'; }
    $('fminus').onclick = function () { setFont(fontSize - 2); };
    $('fplus').onclick = function () { setFont(fontSize + 2); };
    setFont(fontSize);
    $('csv').onclick = function () {
      var rows = [['页码', '页名', '累计秒', '进入次数']];
      (timer ? timer.perPage : []).forEach(function (r) { rows.push([r.index + 1, r.label, Math.round(r.ms / 1000), r.visits]); });
      var csv = rows.map(function (r) {
        return r.map(function (v) { v = String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
      }).join('\r\n');
      var d = new Date();
      var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'rehearsal-' + ((st && st.file) || 'talk') + '-' + stamp + '.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    window.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      var map = { ArrowRight: 'next', PageDown: 'next', ' ': 'next', ArrowLeft: 'prev', PageUp: 'prev', Home: 'first', End: 'last' };
      if (map[e.key]) { e.preventDefault(); nav(map[e.key]); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); setFont(fontSize - 2); }
      else if (e.key === '=' || e.key === '+') { e.preventDefault(); setFont(fontSize + 2); }
    });

    function clock() {
      var d = new Date();
      $('clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
      renderTimer();
    }
    setInterval(clock, 250);
    clock();
    /* 还没收到观众窗消息时，每 2 秒打一次招呼 */
    setInterval(function () { if (!connected) send({ type: 'hello' }); }, 2000);
    document.head.appendChild(own);
    document.body.appendChild(host);
    fitAll();
    send({ type: 'hello' });
  }

  customElements.define('talk-stage', TalkStage);
}());
