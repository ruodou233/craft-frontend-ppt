/* deck-tools.js — 演出工具（不属于 FX 体系：无 rAF、不碰 canvas、不干扰翻页键）
   - Esc：全部页的网格总览，点击卡片跳页（goTo），Esc/点背景关闭；
     总览打开时方向键仍是原翻页行为，高亮卡跟随 slidechange。
   - T：排练计时胶囊，首次按键/点击自动开始，超过预算变红，双击重置。
     预算取 <talk-stage duration="分钟">，没写按 30 分钟。
   配色用 CSS 变量（--dt-ink / --dt-paper / --dt-accent / --dt-hot / --dt-font），
   在讲稿 :root 里覆盖即可换色。 */
(function () {
  'use strict';

  var BUDGET_MIN = 30;          /* 默认预算；boot 时用 talk-stage 的 duration 覆盖 */
  var Z = 9500;                 /* G6 top canvas 9000 之上 */
  var rehearsalReasons = new Set();

  function setRehearsal(reason, on) {
    if (on) rehearsalReasons.add(reason);
    else rehearsalReasons.delete(reason);
    document.documentElement.toggleAttribute('data-deck-rehearsal', rehearsalReasons.size > 0);
  }

  function injectStyle() {
    if (document.getElementById('deck-tools-style')) return;
    var s = document.createElement('style');
    s.id = 'deck-tools-style';
    s.textContent = [
      ':where(:root){--dt-ink:#16140F;--dt-paper:#F4EFE6;--dt-accent:#F0C419;--dt-hot:#D8442C;--dt-font:"JetBrains Mono",ui-monospace,Menlo,monospace}',
      '.dt-overlay{position:fixed;inset:0;z-index:' + Z + ';background:color-mix(in srgb,var(--dt-ink) 92%,transparent);',
      'display:flex;flex-direction:column;padding:48px 56px;box-sizing:border-box;',
      'font-family:var(--dt-font);overflow:auto}',
      '.dt-head{display:flex;justify-content:space-between;align-items:baseline;',
      'color:var(--dt-paper);font-size:15px;letter-spacing:.18em;margin-bottom:24px}',
      '.dt-head b{color:var(--dt-accent)}',
      '.dt-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}',
      '.dt-card{border:1px solid color-mix(in srgb,var(--dt-paper) 22%,transparent);color:color-mix(in srgb,var(--dt-paper) 85%,transparent);',
      'padding:10px 12px;cursor:pointer;line-height:1.4;background:transparent;text-align:left;',
      'font-family:var(--dt-font);font-size:13px;transition:border-color .15s,background .15s}',
      '.dt-card:hover{border-color:var(--dt-accent);background:color-mix(in srgb,var(--dt-accent) 8%,transparent)}',
      '.dt-card.cur{border-color:var(--dt-hot);background:color-mix(in srgb,var(--dt-hot) 15%,transparent);color:#fff}',
      '.dt-card .n{color:color-mix(in srgb,var(--dt-paper) 45%,transparent);margin-right:8px}',
      '.dt-card.cur .n{color:var(--dt-hot)}',
      '.dt-timer{position:fixed;left:24px;bottom:24px;z-index:' + Z + ';',
      'font-family:var(--dt-font);font-size:15px;letter-spacing:.12em;',
      'color:var(--dt-ink);background:color-mix(in srgb,var(--dt-paper) 90%,transparent);border:1.5px solid var(--dt-ink);',
      'padding:8px 16px;user-select:none;cursor:default;display:none}',
      '.dt-timer b{font-weight:700}',
      '.dt-timer .budget{opacity:.5;margin-left:6px}',
      '.dt-timer.over{color:var(--dt-hot);border-color:var(--dt-hot)}',
      'html[data-deck-presenting]:not([data-deck-rehearsal]) :is(.dt-overlay,.dt-timer){display:none!important}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function isTyping(e) {
    var t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  /* ── 总览 ── */
  function initOverview(stage) {
    var overlay = null, grid = null, countEl = null;

    function slides() {
      return (stage._slides && stage._slides.length)
        ? [].slice.call(stage._slides)
        : [].slice.call(stage.querySelectorAll(':scope > section'));
    }
    function curIndex() {
      var list = slides();
      for (var i = 0; i < list.length; i++) {
        if (list[i].hasAttribute('data-deck-active')) return i;
      }
      return 0;
    }
    function build() {
      var list = slides();
      grid.innerHTML = '';
      list.forEach(function (sec, i) {
        var b = document.createElement('button');
        b.className = 'dt-card';
        b.type = 'button';
        var label = sec.getAttribute('data-label') || ('Slide ' + (i + 1));
        b.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span>' + label;
        b.addEventListener('click', function () { stage.goTo(i); close(); });
        grid.appendChild(b);
      });
      countEl.textContent = String(list.length).padStart(2, '0');
      mark();
    }
    function mark() {
      var idx = curIndex();
      [].forEach.call(grid.children, function (c, i) {
        c.classList.toggle('cur', i === idx);
      });
    }
    function open() {
      if (overlay) return;
      setRehearsal('overview', true);
      overlay = document.createElement('div');
      overlay.className = 'dt-overlay';
      overlay.innerHTML = '<div class="dt-head"><div>OVERVIEW · <b></b> SLIDES</div><div>CLICK TO JUMP · ESC TO CLOSE</div></div><div class="dt-grid"></div>';
      countEl = overlay.querySelector('b');
      grid = overlay.querySelector('.dt-grid');
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      document.body.appendChild(overlay);
      build();
    }
    function close() {
      if (!overlay) return;
      overlay.parentNode.removeChild(overlay);
      overlay = null; grid = null; countEl = null;
      setRehearsal('overview', false);
    }
    stage.addEventListener('slidechange', function () { if (overlay) mark(); });
    window.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.key !== 'Escape' || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      overlay ? close() : open();
    });
  }

  /* ── 排练计时 ── */
  function initTimer() {
    var pill = document.createElement('div');
    pill.className = 'dt-timer';
    document.body.appendChild(pill);

    var t0 = null, iv = 0, visible = false;
    function fmt(ms) {
      var s = Math.floor(ms / 1000);
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
    function render() {
      var elapsed = t0 ? Date.now() - t0 : 0;
      pill.innerHTML = '<b>' + fmt(elapsed) + '</b><span class="budget">/ ' + BUDGET_MIN + ':00</span>';
      pill.classList.toggle('over', elapsed > BUDGET_MIN * 60000);
    }
    function show() {
      visible = true; setRehearsal('timer', true); pill.style.display = 'block'; render();
      iv = setInterval(render, 1000);
    }
    function hide() {
      visible = false; setRehearsal('timer', false); pill.style.display = 'none';
      clearInterval(iv); iv = 0;
    }
    /* 首次手势即开始计时（不管胶囊是否显示） */
    function arm() {
      if (t0) return;
      t0 = Date.now();
    }
    ['keydown', 'click'].forEach(function (ev) {
      window.addEventListener(ev, arm, { capture: true, passive: true });
    });
    window.addEventListener('keydown', function (e) {
      if (!e.defaultPrevented && (e.key === 't' || e.key === 'T') && !isTyping(e) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        visible ? hide() : show();
      }
    });
    pill.addEventListener('dblclick', function () { t0 = Date.now(); render(); });
  }

  function boot() {
    var stage = document.querySelector('talk-stage');
    if (!stage) { setTimeout(boot, 120); return; }
    var minutes = parseFloat(stage.getAttribute('duration'));
    if (minutes > 0) BUDGET_MIN = minutes;
    injectStyle();
    initOverview(stage);
    initTimer();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
