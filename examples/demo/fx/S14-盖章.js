/* fx/S14-盖章.js — 盖章入场特效
   页面：章节页（样例里是 data-label="PART 01"，红底）。
   印章文字读页上的 data-stamp-label / data-stamp-num / data-stamp-sub，没写就用默认值。
   契约：FX.register({ name, match, mount, activate, deactivate, tick })
   规则：
     - 不准 addEventListener
     - 不准开新 rAF，所有渲染在 tick()
     - deactivate 后移除所有 ink dot divs，不改写 slide transform

   时序（_t 从 activate 开始累加）：
     0 - 0.5s   印章从屏外砸下（scale 3→1，rotate 5°→0°，y -200→0）
     落地瞬间    slide 震 4px（不震 talk-stage，避免与低音呼吸冲突），5-8 颗墨屑飞溅
     0.5s+       墨屑粒子持续飞散、淡出（约 1s）
*/

FX.register({
  name: 'S14-stamp',
  /* 要盖章的章节页页名；换讲稿时改这里。 */
  _CHAPTER_LABELS: ['PART 01'],
  match: function (label) { return this._CHAPTER_LABELS.indexOf(label) >= 0; },

  /* ---- internal state ---- */
  _active:       false,
  _t:            0,        /* ms，activate 后累加 */
  _slide:        null,
  _stampEl:      null,
  _inkContainer: null,
  _playing:      false,
  _landed:       false,    /* 是否已触发落地震屏 */
  _inkParticles: null,     /* Array of ink particle objects */
  _shaking:      false,    /* 震屏进行中 */
  _shakeT:       0,        /* 震屏计时器 */

  /* ---- helpers ---- */
  _injectStyle: function () {
    if (document.getElementById('s14-style')) return;
    var s = document.createElement('style');
    s.id = 's14-style';
    s.textContent = [
      '.s14-stamp-el {',
      '  position: absolute;',
      '  width: 280px;',
      '  height: 280px;',
      '  left: 50%;',
      '  top: 50%;',
      '  margin-left: -140px;',
      '  margin-top: -140px;',
      '  z-index: 200;',
      '  pointer-events: none;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  justify-content: center;',
      '  border: 6px solid rgba(255,255,255,0.85);',
      '  box-sizing: border-box;',
      '  font-family: "JetBrains Mono", "Courier New", monospace;',
      '  font-weight: 900;',
      '  color: #fff;',
      '  text-align: center;',
      '  line-height: 1.15;',
      '  mix-blend-mode: normal;',
      '  will-change: transform, opacity;',
      '  transform-origin: center center;',
      '}',
      '.s14-stamp-el .s14-part-label {',
      '  font-size: 18px;',
      '  letter-spacing: .35em;',
      '  opacity: .75;',
      '  text-transform: uppercase;',
      '}',
      '.s14-stamp-el .s14-part-num {',
      '  font-size: 72px;',
      '  letter-spacing: .05em;',
      '}',
      '.s14-stamp-el .s14-part-sub {',
      '  font-size: 14px;',
      '  letter-spacing: .25em;',
      '  opacity: .65;',
      '  text-transform: uppercase;',
      '}',
      '.s14-ink-container {',
      '  position: absolute;',
      '  inset: 0;',
      '  z-index: 199;',
      '  pointer-events: none;',
      '  overflow: hidden;',
      '}',
      '.s14-ink-dot {',
      '  position: absolute;',
      '  border-radius: 50%;',
      '  background: rgba(255,255,255,0.7);',
      '  pointer-events: none;',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  },

  _createStamp: function (slide) {
    var existing = slide.querySelector('.s14-stamp-el');
    if (existing) return existing;
    var el = document.createElement('div');
    el.className = 's14-stamp-el';
    var parts = [
      ['s14-part-label', slide.getAttribute('data-stamp-label') || 'PART'],
      ['s14-part-num', slide.getAttribute('data-stamp-num') || '01'],
      ['s14-part-sub', slide.getAttribute('data-stamp-sub') || ''],
    ];
    parts.forEach(function (p) {
      var line = document.createElement('div');
      line.className = p[0];
      line.textContent = p[1];
      el.appendChild(line);
    });
    el.style.opacity = '0';
    el.style.transform = 'scale(3) rotate(5deg) translateY(-200px)';
    slide.appendChild(el);
    return el;
  },

  _createInkContainer: function (slide) {
    var existing = slide.querySelector('.s14-ink-container');
    if (existing) return existing;
    var el = document.createElement('div');
    el.className = 's14-ink-container';
    slide.appendChild(el);
    return el;
  },

  _resetStamp: function () {
    var el = this._stampEl;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'scale(3) rotate(5deg) translateY(-200px)';
  },

  _clearInk: function () {
    if (this._inkContainer) {
      this._inkContainer.innerHTML = '';
    }
    this._inkParticles = [];
  },

  _spawnInkParticles: function () {
    var container = this._inkContainer;
    if (!container) return;
    var count = 5 + Math.floor(Math.random() * 4); /* 5-8 */
    var particles = [];
    /* stamp center in slide coords: roughly 50% x, 50% y (280px stamp) */
    var cx = 960; /* 1920/2 */
    var cy = 540; /* 1080/2 */

    for (var i = 0; i < count; i++) {
      var dot = document.createElement('div');
      dot.className = 's14-ink-dot';
      var size = 4 + Math.random() * 8;
      dot.style.width  = size + 'px';
      dot.style.height = size + 'px';

      /* start near stamp edge, random angle */
      var angle   = Math.random() * Math.PI * 2;
      var dist    = 100 + Math.random() * 60; /* from stamp center */
      var startX  = cx + Math.cos(angle) * dist;
      var startY  = cy + Math.sin(angle) * dist;

      dot.style.left = startX + 'px';
      dot.style.top  = startY + 'px';
      dot.style.opacity = '0.8';
      container.appendChild(dot);

      /* velocity */
      var speed = 300 + Math.random() * 400; /* px/s */
      particles.push({
        el:    dot,
        x:     startX,
        y:     startY,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed,
        life:  0,          /* ms elapsed */
        total: 700 + Math.random() * 400, /* ms lifetime */
      });
    }
    this._inkParticles = particles;
  },

  /* ---- FX lifecycle ---- */
  mount: function (slide, api) {
    var self = this;
    self._slide = slide;
    self._injectStyle();

    /* 清理曾错挂到其他页的印章节点。 */
    [].slice.call(document.querySelectorAll('.s14-stamp-el, .s14-ink-container')).forEach(function (node) {
      var owner = node.closest('section');
      if (owner && owner !== slide) node.remove();
    });

    /* 每页复用唯一节点，反复激活不增长 DOM。 */
    self._stampEl = self._createStamp(slide);
    self._inkContainer = self._createInkContainer(slide);
    self._inkParticles = [];
  },

  activate: function (slide, api) {
    var self = this;
    self._slide   = slide;
    self._active  = true;
    self._t       = 0;
    self._playing = false;
    self._landed  = false;
    self._shaking = false;
    self._shakeT  = 0;

    /* ensure DOM elements exist (mount may have run on a different slide instance) */
    if (!self._stampEl || !slide.contains(self._stampEl)) {
      self._stampEl = self._createStamp(slide);
    }
    if (!self._inkContainer || !slide.contains(self._inkContainer)) {
      self._inkContainer = self._createInkContainer(slide);
    }

    self._clearInk();
    self._resetStamp();

    /* small delay before animation starts */
    var startDelay = 50;
    self._startAt = startDelay;
    self._playing = false; /* will flip to true once _t >= _startAt */
  },

  deactivate: function (slide, api) {
    var self = this;
    self._active  = false;
    self._playing = false;
    self._t       = 0;
    self._landed  = false;
    self._shaking = false;
    self._shakeT  = 0;

    /* hide stamp */
    if (self._stampEl) {
      self._stampEl.style.opacity   = '0';
      self._stampEl.style.transform = 'scale(3) rotate(5deg) translateY(-200px)';
    }

    /* remove ink particles (DOM dots) */
    self._clearInk();

    if (self._stampEl) self._stampEl.style.filter = '';
  },

  finalize: function (slide, api) {
    this._slide = slide;
    this._stampEl = this._createStamp(slide);
    this._inkContainer = this._createInkContainer(slide);
    this._clearInk();
    this._active = false;
    this._t = 0;
    this._playing = false;
    this._landed = true;
    this._shaking = false;
    if (api.motion.reduced) {
      /* 原页已有完整章节标题，Reduced 不再叠加中央大章。 */
      this._resetStamp();
    } else {
      this._stampEl.style.opacity = '1';
      this._stampEl.style.transform = 'scale(1) rotate(0deg) translateY(0)';
      this._stampEl.style.filter = '';
    }
  },

  tick: function (dt, api) {
    var self = this;
    if (!self._active) return;

    self._t += dt;

    /* ---- start delay ---- */
    if (!self._playing) {
      if (self._t >= self._startAt) {
        self._playing = true;
        self._t = 0; /* reset timer so animation timing is clean */
      } else {
        return;
      }
    }

    /* ---- stamp drop animation (0 - 500ms) ---- */
    var STAMP_DUR = 500; /* ms */
    var progress  = Math.min(self._t / STAMP_DUR, 1);

    /* easeOutCubic: fast approach, soft landing */
    var p = 1 - Math.pow(1 - progress, 3);

    var scale     = 3 - p * 2;              /* 3 → 1 */
    var rotation  = (1 - p) * 5;            /* 5° → 0° */
    var translateY = (1 - p) * -200;        /* -200px → 0 */
    var opacity   = Math.min(progress * 4, 1); /* quick fade in */

    if (self._stampEl) {
      self._stampEl.style.opacity   = opacity.toFixed(3);
      self._stampEl.style.transform =
        'scale(' + scale.toFixed(4) + ') ' +
        'rotate(' + rotation.toFixed(3) + 'deg) ' +
        'translateY(' + translateY.toFixed(2) + 'px)';
    }

    /* ---- landing impact (fires once at progress >= 1) ---- */
    if (progress >= 1 && !self._landed) {
      self._landed = true;

      /* 冲击只作用于印章本身，不覆盖 section transform。 */
      if (self._stampEl) {
        self._stampEl.style.filter = 'drop-shadow(4px 4px 0 rgba(22,20,15,.22))';
        self._shakeT  = 0;
        self._shaking = true;
      }

      /* spawn ink particles */
      self._spawnInkParticles();
    }

    /* ---- shake recovery (poll in tick, no setTimeout) ---- */
    if (self._shaking) {
      self._shakeT = (self._shakeT || 0) + dt;
      if (self._shakeT >= 30) {
        self._shaking = false;
        if (self._stampEl) self._stampEl.style.filter = '';
      }
    }

    /* ---- ink particles update ---- */
    var alive = [];
    var particles = self._inkParticles || [];
    for (var i = 0; i < particles.length; i++) {
      var pk = particles[i];
      pk.life += dt;

      if (pk.life >= pk.total) {
        /* expired: remove from DOM */
        if (pk.el && pk.el.parentNode) {
          pk.el.parentNode.removeChild(pk.el);
        }
        continue;
      }

      /* move */
      var dtSec = dt / 1000;
      pk.x += pk.vx * dtSec;
      pk.y += pk.vy * dtSec;

      /* gravity-like drag: slow down over time */
      pk.vx *= 0.97;
      pk.vy *= 0.97;

      /* fade out in last 40% of life */
      var lifeRatio = pk.life / pk.total;
      var fadeStart = 0.6;
      var alpha = lifeRatio > fadeStart
        ? 0.8 * (1 - (lifeRatio - fadeStart) / (1 - fadeStart))
        : 0.8;

      if (pk.el) {
        pk.el.style.left    = pk.x.toFixed(1) + 'px';
        pk.el.style.top     = pk.y.toFixed(1) + 'px';
        pk.el.style.opacity = alpha.toFixed(3);
      }

      alive.push(pk);
    }
    self._inkParticles = alive;
  },
});
