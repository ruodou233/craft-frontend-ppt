/* fx/S5-数字滚动.js — 节拍点亮后，数字从 0 滚到终值（样例页 data-label="数字"）
 * HTML 里直接写终值，删掉本脚本页面照样完整：
 *   <div data-beat="1" data-roll-target="8"><span class="s5-num">8</span>…</div>
 * 逐帧逻辑都在 tick 里；翻走、打印、减少动效都落回终值。 */
FX.register({
  name: 'S5-nums',
  match: function (label) { return label === '数字'; },
  DUR: 1200,
  _items: [],

  activate: function (slide) {
    this._items = [].map.call(slide.querySelectorAll('[data-roll-target]'), function (el) {
      return { el: el, num: el.querySelector('.s5-num') || el,
        target: parseInt(el.getAttribute('data-roll-target'), 10) || 0,
        t: el.classList.contains('beat-on') ? Infinity : -1 };   /* 退回来时已亮的直接是终值 */
    });
  },
  tick: function (dt) {
    var D = this.DUR;
    this._items.forEach(function (it) {
      if (!it.el.classList.contains('beat-on')) { it.t = -1; return; }   /* 熄灭后再亮会重滚 */
      if (it.t >= D) return;
      it.t = Math.min(D, Math.max(0, it.t) + dt);
      it.num.textContent = String(Math.round(it.target * (1 - Math.pow(1 - it.t / D, 3))));
    });
  },
  deactivate: function (slide) { this.finalize(slide); this._items = []; },
  finalize: function (slide) {
    [].forEach.call(slide.querySelectorAll('[data-roll-target]'), function (el) {
      (el.querySelector('.s5-num') || el).textContent = el.getAttribute('data-roll-target');
    });
  },
});
