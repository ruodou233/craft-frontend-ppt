/* fx/S5-数字滚动.js — 数字从 0 滚到目标值（样例页 data-label="数字"）
 *
 * ── HTML 配套说明 ──────────────────────────────────────────────────────────
 * 页内放若干数字统计元素，HTML 里直接写终值（删掉本脚本，页面照样完整）：
 *
 *   <div class="s5-stats">
 *     <div class="s5-stat" data-beat="1" data-roll-target="100" data-roll-suffix="+">
 *       <span class="s5-num">100</span><span class="s5-unit">+</span>
 *       <div class="s5-label">说明</div>
 *     </div>
 *     <!-- 以此类推 data-beat="2/3/4" -->
 *   </div>
 *
 * data-beat 由 fx-core 内置节拍系统控制（按一次右→键显示一个），
 * 数字在 beat-on 后即触发滚动。
 * ──────────────────────────────────────────────────────────────────────────── */

FX.register({
  name: 'S5-nums',

  match: function (label) { return label === '数字'; },

  /* 已扫描到的滚动目标，每项：{ el, numEl, target, suffix } */
  _items: [],
  /* 所有活跃的 setTimeout handle */
  _timers: [],
  /* MutationObserver，监听 beat-on 出现以触发对应数字滚动 */
  _observer: null,
  /* 当前 slide 引用（deactivate 时清理用） */
  _slide: null,

  mount: function (slide, api) {
    /* mount 只调用一次（fx-core 保证）。
       此处仅扫描元素、保存引用；不启动动画。
       如果 HTML 里尚未有 data-roll-target 元素，items 为空，activate 时静默跳过。 */
    this._scanItems(slide);
    this._slide = slide;
  },

  activate: function (slide, api) {
    this._slide = slide;
    /* 重新扫描（万一 mount 时 DOM 还没注入） */
    if (!this._items.length) this._scanItems(slide);
    if (!this._items.length) return;

    var self = this;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 对每个 item 判断：
       - 若已 beat-on（比如从后往前翻回来） → 直接跳到终值
       - 若尚未 beat-on                     → 挂 observer，beat-on 后触发 */
    self._items.forEach(function (item) {
      if (item.el.classList.contains('beat-on')) {
        /* 已可见，直接滚动 */
        self._animateItem(item, reduced);
      }
      /* observer 统一在下面挂，会捕获后续的 beat-on */
    });

    /* MutationObserver：监听 beat-on 类的添加 */
    if (self._observer) self._observer.disconnect();
    self._observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type !== 'attributes' || m.attributeName !== 'class') return;
        var el = m.target;
        /* 找对应 item */
        self._items.forEach(function (item) {
          if (item.el === el && el.classList.contains('beat-on')) {
            self._animateItem(item, reduced);
          }
        });
      });
    });
    self._items.forEach(function (item) {
      self._observer.observe(item.el, { attributes: true, attributeFilter: ['class'] });
    });
  },

  deactivate: function (slide, api) {
    /* 停止所有定时器 */
    this._timers.forEach(function (id) { clearTimeout(id); });
    this._timers = [];

    /* 停止 observer */
    if (this._observer) { this._observer.disconnect(); this._observer = null; }

    /* 保留最终值（不归零），确保打印/降级展示正常 */
  },

  /* ── 内部：扫描数字元素 ── */
  _scanItems: function (slide) {
    this._items = [];
    var self = this;
    var els = [].slice.call(slide.querySelectorAll('[data-roll-target]'));
    els.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-roll-target'), 10);
      if (isNaN(target)) return;
      var suffix = el.getAttribute('data-roll-suffix') || '';
      /* 数字显示节点：优先找 .s5-num 子元素，否则直接用自身 */
      var numEl = el.querySelector('.s5-num') || el;
      self._items.push({ el: el, numEl: numEl, target: target, suffix: suffix });
    });
  },

  /* ── 内部：对单个 item 启动 setTimeout 链滚动 ── */
  _animateItem: function (item, reduced) {
    var self = this;
    if (reduced) {
      item.numEl.textContent = String(item.target);
      return;
    }

    var dur = 1200;      /* 每个数字滚动持续 ms */
    var fps = 60;        /* 模拟帧率（用 setTimeout 逐帧） */
    var interval = Math.round(1000 / fps);
    var start = null;

    function tick() {
      var now = Date.now();
      if (start === null) start = now;
      var elapsed = now - start;
      var progress = Math.min(1, elapsed / dur);
      /* cubic easeOut：t = 1 - (1-p)^3 */
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(item.target * eased);
      item.numEl.textContent = String(current);

      if (progress < 1) {
        var id = setTimeout(tick, interval);
        self._timers.push(id);
      } else {
        /* 到达终值，附加后缀 */
        item.numEl.textContent = String(item.target);
        if (item.suffix) {
          /* 如果有独立的 .s5-unit 节点，写那里；否则追加到 numEl */
          var unitEl = item.el.querySelector('.s5-unit');
          if (!unitEl) item.numEl.textContent += item.suffix;
          /* .s5-unit 本身 HTML 里已有文字，不需要再写 */
        }
      }
    }

    var id = setTimeout(tick, 0);
    this._timers.push(id);
  },
});
