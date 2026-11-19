/* fx/G8-拆字.js — 全局逐字入场（split text + 逐字符错峰动画）
   对象：各页 h1.anim-rise / h2.anim-rise 标题——中文逐字、西文按词，
        替换原 anim-rise 整行入场为逐字错峰升起（per-character stagger）。
        另对加了 .g8-mask 的金句做遮罩文字揭示（masked text reveal，按 <br> 分段逐段升起）。
   行为：fx:slide 进入新页时处理，离开时把原 DOM 与 class 原样恢复（重复进出可重播）。
   契约：不开 rAF、不设定时器、不监听鼠标键盘——纯 CSS transition + transition-delay。
   无障碍：标题根记 aria-label 原文，拆分包装节点全部 aria-hidden；
          reduced-motion 时（fx:slide 的 detail.motion 为 reduced）不拆字，标题按原样显示。 */
FX.register({
  name: 'G8-split',
  match: 'global',

  _done: [],   /* 本页处理记录 [{el, html, hadRise}]，离开时恢复 */

  _injectStyle: function () {
    if (document.getElementById('g8-style')) return;
    var s = document.createElement('style');
    s.id = 'g8-style';
    s.textContent = [
      /* 逐字：错峰升起 + 淡入 */
      '.g8-c{display:inline-block;opacity:0;transform:translateY(.55em);',
      'transition:opacity .5s cubic-bezier(.2,.7,.2,1),transform .5s cubic-bezier(.2,.7,.2,1);',
      'transition-delay:var(--g8d,0ms);will-change:transform,opacity}',
      '.g8-w{white-space:nowrap}',               /* 西文词不拆行 */
      '.g8-on .g8-c{opacity:1;transform:none}',
      /* 遮罩金句：分段在 overflow 隐藏容器内升起 */
      '.g8-m{display:block;overflow:hidden}',
      '.g8-mi{display:block;transform:translateY(115%);',
      'transition:transform .75s cubic-bezier(.2,.7,.2,1);transition-delay:var(--g8d,0ms);will-change:transform}',
      '.g8-on .g8-mi{transform:none}',
    ].join('\n');
    document.head.appendChild(s);
  },

  /* 恢复上一页的全部改动 */
  _restore: function () {
    this._done.forEach(function (r) {
      r.el.innerHTML = r.html;
      if (r.hadRise) r.el.classList.add('anim-rise');
      r.el.classList.remove('g8-on');
      r.el.removeAttribute('aria-label');
    });
    this._done = [];
  },

  /* 把一个文本节点拆成单元序列：CJK 逐字，[A-Za-z0-9] 连续段按词，其余原样 */
  _tokenize: function (text) {
    var units = [];
    var re = /([A-Za-z0-9+&@%#$.·\-]+)|([\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef])|(\s+|.)/g;
    var m;
    while ((m = re.exec(text))) {
      if (m[1]) units.push({ t: m[1], word: true });
      else if (m[2]) units.push({ t: m[2], word: false });
      else units.push({ t: m[3], word: null });   /* 空白/标点原样保留 */
    }
    return units;
  },

  /* 递归拆分：保留 .accent / <b> 等内联元素的颜色与字重，只拆文本节点 */
  _splitInto: function (node, counter) {
    var self = this;
    [].slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var frag = document.createDocumentFragment();
        self._tokenize(child.nodeValue).forEach(function (u) {
          if (u.word === null) { frag.appendChild(document.createTextNode(u.t)); return; }
          var sp = document.createElement('span');
          sp.className = 'g8-c' + (u.word ? ' g8-w' : '');
          sp.setAttribute('aria-hidden', 'true');
          sp.style.setProperty('--g8d', (140 + counter.i * 30) + 'ms');
          sp.textContent = u.t;
          counter.i++;
          frag.appendChild(sp);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1 && child.tagName !== 'BR' && !child.classList.contains('g8-c')) {
        self._splitInto(child, counter);
      }
    });
  },

  _processTitle: function (el) {
    var label = (el.textContent || '').replace(/\s+/g, ' ').trim();
    this._done.push({ el: el, html: el.innerHTML, hadRise: el.classList.contains('anim-rise') });
    el.classList.remove('anim-rise');
    el.setAttribute('aria-label', label);
    this._splitInto(el, { i: 0 });
    void el.offsetWidth;          /* 强制 reflow，让初始态先生效 */
    el.classList.add('g8-on');
  },

  _processMask: function (el) {
    this._done.push({ el: el, html: el.innerHTML, hadRise: el.classList.contains('anim-rise') });
    el.classList.remove('anim-rise');
    el.setAttribute('aria-label', (el.textContent || '').replace(/\s+/g, ' ').trim());
    /* 按 <br> 分段，每段一个遮罩容器逐段升起 */
    var segs = el.innerHTML.split(/<br\s*\/?>/i);
    var rebuilt = segs.map(function (seg, i) {
      return '<span class="g8-m" aria-hidden="true"><span class="g8-mi" style="--g8d:' + (160 + i * 140) + 'ms">' + seg + '</span></span>';
    }).join('');
    el.innerHTML = rebuilt;
    void el.offsetWidth;
    el.classList.add('g8-on');
  },

  mount: function (_, api) {
    this._injectStyle();
    var self = this;
    window.addEventListener('fx:slide', function (e) {
      self._restore();
      var slide = e.detail.slide;
      if (!slide || e.detail.motion === 'reduced') return;
      /* 金句遮罩揭示优先（带 g8-mask 的不再走逐字） */
      [].slice.call(slide.querySelectorAll('.g8-mask')).forEach(function (el) {
        if (!el.hasAttribute('data-beat')) self._processMask(el);
      });
      /* 标题逐字错峰（data-g8-skip = 被其他专用特效接管的标题，跳过） */
      [].slice.call(slide.querySelectorAll('h1.anim-rise, h2.anim-rise')).forEach(function (el) {
        if (el.classList.contains('g8-mask') || el.hasAttribute('data-beat') || el.hasAttribute('data-g8-skip')) return;
        if (el.closest('.topbar')) return;
        self._processTitle(el);
      });
    });
  },
});
