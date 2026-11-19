/* fx-core.js — 网页演讲特效运行时（配合 talk-stage.js）
   统一 rAF / 鼠标与舞台坐标 / 音频分析 / Canvas 分层 / 页生命周期 /
   页内拍点 / 动态 reduced-motion / 自动降质。

   兼容旧 FX.register({ name, match, mount, activate, deactivate, tick })；
   新模块可选实现 finalize(slide, api)，用于快进与 Reduced 静态终态。 */
(function () {
  'use strict';

  var W = 1920;
  var H = 1080;
  var effects = [];
  var globals = [];
  var active = [];
  var mountedGlobals = new WeakSet();
  var mountedSlides = new WeakMap();
  var curSlide = null;
  var stage = null;
  var booted = false;
  var generation = 0;

  /* ── Motion 状态：系统偏好可动态变化，也允许排练时手动覆盖 ── */
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var manualMotion = null;
  var motion = { mode: motionQuery.matches ? 'reduced' : 'heavy', reduced: motionQuery.matches, low: false };

  function resolveMotion() {
    var mode = manualMotion || (motionQuery.matches ? 'reduced' : 'heavy');
    motion.mode = mode;
    motion.reduced = mode === 'reduced';
    motion.low = mode === 'low';
    document.documentElement.setAttribute('data-fx-motion', mode);
    return mode;
  }

  /* ── 唯一舞台几何：把视口/留黑坐标映射到 1920×1080 ── */
  var geometry = {
    left: 0, top: 0, width: W, height: H,
    scaleX: 1, scaleY: 1, scale: 1,
    offsetX: 0, offsetY: 0,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    W: W, H: H,
  };

  function updateGeometry() {
    var target = curSlide || stage;
    if (!target || !target.getBoundingClientRect) return geometry;
    var rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return geometry;
    geometry.left = rect.left;
    geometry.top = rect.top;
    geometry.width = rect.width;
    geometry.height = rect.height;
    geometry.scaleX = rect.width / W;
    geometry.scaleY = rect.height / H;
    geometry.scale = Math.min(geometry.scaleX, geometry.scaleY);
    geometry.offsetX = rect.left;
    geometry.offsetY = rect.top;
    geometry.dpr = Math.min(window.devicePixelRatio || 1, quality < 1 ? 1 : 2);
    return geometry;
  }

  function toStagePoint(clientX, clientY) {
    var g = updateGeometry();
    var nx = g.width ? (clientX - g.left) / g.width : 0.5;
    var ny = g.height ? (clientY - g.top) / g.height : 0.5;
    var inside = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
    var cx = Math.max(0, Math.min(1, nx));
    var cy = Math.max(0, Math.min(1, ny));
    return {
      x: cx * W,
      y: cy * H,
      nx: cx,
      ny: cy,
      inside: inside,
      scale: g.scale,
      dpr: g.dpr,
    };
  }

  /* ── 鼠标：全局唯一监听，旧 FX 继续读取 0–1 坐标 ── */
  var mouse = { x: 0.5, y: 0.5, inside: false, stageX: W / 2, stageY: H / 2 };
  var tx = 0.5;
  var ty = 0.5;
  var targetInside = false;
  document.addEventListener('mousemove', function (event) {
    var point = toStagePoint(event.clientX, event.clientY);
    targetInside = point.inside;
    if (!point.inside) return;
    tx = point.nx;
    ty = point.ny;
  }, { passive: true });

  /* ── 音频：首次真实手势后原子初始化；失败保持 0，不打断主循环 ── */
  var audio = { level: 0, bass: 0, health: 'idle' };
  var audioContext = null;
  var analyser = null;
  var freq = null;
  var audioInitAttempted = false;

  function initAudio() {
    if (audioContext && analyser && freq) {
      if (audioContext.state === 'suspended') audioContext.resume().catch(function () {});
      return;
    }
    if (audioInitAttempted) return;
    audioInitAttempted = true;
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) { audio.health = 'unsupported'; return; }

    var ctx = null;
    try {
      var elements = [].slice.call(document.querySelectorAll('audio[id^="bgm-track"]'));
      if (!elements.length) { audio.health = 'no-tracks'; return; }
      /* file:// 下 Chrome 把媒体接进分析器后只输出静音，所以不接，让 <audio> 原样出声 */
      if (location.protocol === 'file:') { audio.health = 'native-file-fallback'; return; }
      ctx = new AudioCtor();
      var nextAnalyser = ctx.createAnalyser();
      nextAnalyser.fftSize = 256;
      nextAnalyser.smoothingTimeConstant = 0.82;
      var nextFreq = new Uint8Array(nextAnalyser.frequencyBinCount);
      elements.forEach(function (element) {
        ctx.createMediaElementSource(element).connect(nextAnalyser);
      });
      nextAnalyser.connect(ctx.destination);
      audioContext = ctx;
      analyser = nextAnalyser;
      freq = nextFreq;
      audio.health = 'ready';
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    } catch (error) {
      audio.health = 'fallback';
      audio.level = 0;
      audio.bass = 0;
      if (ctx && ctx.close) ctx.close().catch(function () {});
      audioContext = null;
      analyser = null;
      freq = null;
    }
  }

  ['click', 'keydown', 'pointerdown'].forEach(function (eventName) {
    document.addEventListener(eventName, initAudio, { capture: true, passive: true });
  });

  function readAudio() {
    if (!analyser || !freq) return;
    try {
      analyser.getByteFrequencyData(freq);
      var sum = 0;
      var bass = 0;
      var bassN = Math.max(4, freq.length >> 4);
      for (var i = 0; i < freq.length; i++) sum += freq[i];
      for (var j = 0; j < bassN; j++) bass += freq[j];
      audio.level = sum / freq.length / 255;
      audio.bass = bass / bassN / 255;
    } catch (error) {
      audio.level = 0;
      audio.bass = 0;
      audio.health = 'fallback';
    }
  }

  /* ── 画质预算 ── */
  var quality = 1;
  var fpsAcc = 0;
  var fpsN = 0;
  var lowSince = 0;
  var okSince = 0;

  function setQuality(next) {
    if (quality === next) return;
    quality = next;
    updateGeometry();
    window.dispatchEvent(new CustomEvent('fx:quality', { detail: { quality: quality } }));
  }

  function budget(dt, now) {
    fpsAcc += dt;
    fpsN += 1;
    if (fpsAcc < 500) return;
    var fps = 1000 / (fpsAcc / fpsN);
    FX.fps = Math.round(fps);
    fpsAcc = 0;
    fpsN = 0;
    if (fps < 45) {
      okSince = 0;
      if (!lowSince) lowSince = now;
      if (now - lowSince > 2000) setQuality(0.5);
    } else if (fps > 55) {
      lowSince = 0;
      if (!okSince) okSince = now;
      if (now - okSince > 5000) setQuality(1);
    }
  }

  /* ── Canvas 分层：默认保持旧 1920×1080 buffer；新模块可 opt-in DPR ── */
  var Z = { under: 0, over: 30, top: 60 };
  var globalCanvases = [];

  function sizeCanvas(canvas, cssW, cssH, dprAware) {
    var dpr = dprAware ? updateGeometry().dpr : 1;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    canvas.fxWidth = cssW;
    canvas.fxHeight = cssH;
    canvas.fxDpr = dpr;
    var context = canvas.getContext('2d');
    if (context && dprAware) context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeCanvas(slide, band, options) {
    options = options || {};
    var canvas = document.createElement('canvas');
    var dprAware = !!options.dprAware;
    if (slide) {
      sizeCanvas(canvas, W, H, dprAware);
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:' + (Z[band] || 0);
      band === 'under' ? slide.insertBefore(canvas, slide.firstChild) : slide.appendChild(canvas);
    } else {
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:' + (band === 'top' ? 9000 : 8000);
      globalCanvases.push({ canvas: canvas, dprAware: dprAware });
      sizeCanvas(canvas, window.innerWidth, window.innerHeight, dprAware);
      document.body.appendChild(canvas);
    }
    return canvas;
  }

  function resizeGlobalCanvases() {
    updateGeometry();
    globalCanvases.forEach(function (entry) {
      sizeCanvas(entry.canvas, window.innerWidth, window.innerHeight, entry.dprAware);
    });
  }
  window.addEventListener('resize', resizeGlobalCanvases, { passive: true });
  // talk-stage can resize inside an unchanged window (split view / preview
  // rail / embedded host). Its geometry event is the canonical invalidation
  // signal for both pointer mapping and viewport-sized global canvases.
  document.addEventListener('talkgeometrychange', resizeGlobalCanvases, { passive: true });

  /* ── 可重复随机数：新模块用 api.seeded(name)；旧 api.rand 保持原行为 ── */
  function hashSeed(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seeded(name) {
    var label = curSlide ? (curSlide.getAttribute('data-label') || '') : '';
    var state = hashSeed(String(name || 'fx') + '|' + label) || 1;
    return function (min, max) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      var unit = (state >>> 0) / 4294967296;
      if (arguments.length === 0) return unit;
      if (arguments.length === 1) return unit * min;
      return min + unit * (max - min);
    };
  }

  /* ── 生命周期调用与 API ── */
  function call(effect, hook, first, second) {
    try {
      if (effect && typeof effect[hook] === 'function') effect[hook](first, second);
      return true;
    } catch (error) {
      console.error('[FX] ' + (effect.name || 'unnamed') + '.' + hook, error);
      return false;
    }
  }

  function ensureMounted(effect, slide) {
    if (!slide) {
      if (mountedGlobals.has(effect)) return true;
      if (!call(effect, 'mount', null, api)) return false;
      mountedGlobals.add(effect);
      return true;
    }
    var slides = mountedSlides.get(effect);
    if (!slides) {
      slides = new WeakSet();
      mountedSlides.set(effect, slides);
    }
    if (slides.has(slide)) return true;
    if (!call(effect, 'mount', slide, api)) return false;
    slides.add(slide);
    return true;
  }

  function revealBeats(slide) {
    if (!slide) return;
    [].slice.call(slide.querySelectorAll('[data-beat]')).forEach(function (element) {
      if (!element.hasAttribute('data-fx-reduced-visible')) {
        element.setAttribute('data-fx-reduced-visible', element.classList.contains('beat-on') ? 'was-on' : 'forced');
      }
      element.classList.add('beat-on');
    });
  }

  function restoreBeatsAfterReduced(slide) {
    if (!slide) return;
    [].slice.call(slide.querySelectorAll('[data-fx-reduced-visible]')).forEach(function (element) {
      if (element.getAttribute('data-fx-reduced-visible') === 'forced') element.classList.remove('beat-on');
      element.removeAttribute('data-fx-reduced-visible');
    });
  }

  function finalizeCurrent() {
    if (!curSlide) return;
    revealBeats(curSlide);
    active.forEach(function (effect) { call(effect, 'finalize', curSlide, api); });
  }

  var api = {
    canvas: makeCanvas,
    mouse: mouse,
    audio: audio,
    motion: motion,
    toStagePoint: toStagePoint,
    seeded: seeded,
    rand: function (a, b) { return a + Math.random() * (b - a); },
    requestFinal: finalizeCurrent,
    W: W,
    H: H,
    get slide() { return curSlide; },
    get stage() { return stage; },
    get geometry() { return updateGeometry(); },
    get quality() { return motion.low ? Math.min(quality, 0.5) : quality; },
    get generation() { return generation; },
  };

  /* ── 页内拍点 ── */
  var beatStyle = document.createElement('style');
  beatStyle.id = 'fx-core-beat-style';
  beatStyle.textContent =
    '[data-beat]{opacity:0;transform:translateY(20px);transition:opacity .5s,transform .5s cubic-bezier(.2,.7,.2,1)}' +
    '[data-beat].beat-on{opacity:1;transform:none}' +
    'html[data-fx-motion="reduced"] [data-beat]{opacity:1!important;transform:none!important;transition:none!important}' +
    '@media print{[data-beat]{opacity:1!important;transform:none!important;transition:none!important}}';
  document.head.appendChild(beatStyle);

  function beats(slide) {
    return [].slice.call(slide.querySelectorAll('[data-beat]')).sort(function (a, b) {
      return (+a.dataset.beat) - (+b.dataset.beat);
    });
  }

  window.addEventListener('keydown', function (event) {
    /* talk-stage may have synchronously switched its active DOM while its
       slidechange event is still queued behind author entrance handling.
       Reconcile from the canonical active attribute before consuming a key,
       otherwise a fast jump + ArrowRight can test the previous page's beats. */
    if (stage) {
      var visibleSlide = stage.querySelector(':scope > section[data-deck-active]');
      if (visibleSlide && visibleSlide !== curSlide) switchSlide(curSlide, visibleSlide);
    }
    if (!curSlide || motion.reduced) return;
    var forward = event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown';
    var backward = event.key === 'ArrowLeft' || event.key === 'PageUp';
    if (!forward && !backward) return;
    var items = beats(curSlide);
    if (!items.length) return;
    if (forward) {
      var next = items.find(function (element) { return !element.classList.contains('beat-on'); });
      if (next) {
        next.classList.add('beat-on');
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    } else {
      var visible = items.filter(function (element) { return element.classList.contains('beat-on'); });
      if (visible.length) {
        visible[visible.length - 1].classList.remove('beat-on');
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }
  }, true);

  /* ── 切页：global mount 一次；page effect 每次 activate/deactivate ── */
  function matches(effect, label) {
    return effect.match !== 'global' && typeof effect.match === 'function' && effect.match(label);
  }

  function switchSlide(previous, next) {
    generation += 1;
    active.forEach(function (effect) { call(effect, 'deactivate', previous, api); });
    globals.forEach(function (effect) { call(effect, 'deactivate', previous, api); });
    active = [];
    curSlide = next;
    updateGeometry();
    if (!next) return;

    if (!motion.reduced) {
      restoreBeatsAfterReduced(next);
      /* 从前面翻进来（Home、总览、goTo 往后跳）时节拍从零开始；按 ← 退回来仍保留全亮 */
      if (previous && previous !== next && previous.isConnected &&
          (previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        [].forEach.call(next.querySelectorAll('[data-beat].beat-on'), function (el) { el.classList.remove('beat-on'); });
      }
    }

    var label = next.getAttribute('data-label') || '';
    effects.forEach(function (effect) {
      if (!matches(effect, label)) return;
      if (motion.reduced) {
        revealBeats(next);
        if (typeof effect.finalize === 'function') {
          if (!ensureMounted(effect, next)) return;
          call(effect, 'finalize', next, api);
          active.push(effect);
        }
        return;
      }
      if (!ensureMounted(effect, next)) return;
      call(effect, 'activate', next, api);
      active.push(effect);
    });

    if (motion.reduced) revealBeats(next);
    window.dispatchEvent(new CustomEvent('fx:slide', {
      detail: { slide: next, prev: previous, label: label, generation: generation, motion: motion.mode },
    }));
  }

  function remountCurrentForMotion() {
    var wasReduced = motion.reduced;
    resolveMotion();
    if (wasReduced && !motion.reduced) {
      /* Reduced may have been used to traverse/export the entire deck.
         Clear every forced terminal marker now, not only the current page,
         so a later deep jump still starts its beat sequence at step zero. */
      if (stage) {
        [].slice.call(stage.querySelectorAll(':scope > section')).forEach(restoreBeatsAfterReduced);
      } else {
        restoreBeatsAfterReduced(curSlide);
      }
    }
    if (!motion.reduced) {
      globals.forEach(function (effect) { ensureMounted(effect, null); });
    }
    if (curSlide) switchSlide(curSlide, curSlide);
    window.dispatchEvent(new CustomEvent('fx:motion', { detail: { mode: motion.mode } }));
    if (motion.reduced) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      last = 0;
      audio.level = 0;
      audio.bass = 0;
    } else {
      last = performance.now();
      scheduleLoop();
    }
  }

  if (motionQuery.addEventListener) motionQuery.addEventListener('change', remountCurrentForMotion);
  else if (motionQuery.addListener) motionQuery.addListener(remountCurrentForMotion);

  /* ── 主循环：后台真正暂停，恢复时重置时间基准 ── */
  var last = 0;
  var rafId = 0;
  var printing = false;
  var printBeatState = [];

  function scheduleLoop() {
    if (!rafId && !document.hidden && !motion.reduced && !printing) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function loop(now) {
    rafId = 0;
    if (document.hidden) return;
    var dt = last ? Math.min(50, Math.max(0, now - last)) : 16.67;
    last = now;
    mouse.x += (tx - mouse.x) * 0.07;
    mouse.y += (ty - mouse.y) * 0.07;
    mouse.stageX = mouse.x * W;
    mouse.stageY = mouse.y * H;
    mouse.inside = targetInside;
    readAudio();
    budget(dt, now);
    globals.forEach(function (effect) { call(effect, 'tick', dt, api); });
    active.forEach(function (effect) { call(effect, 'tick', dt, api); });
    scheduleLoop();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      audio.level = 0;
      audio.bass = 0;
      if (audioContext && audioContext.state === 'running') audioContext.suspend().catch(function () {});
    } else {
      last = performance.now();
      if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(function () {});
      scheduleLoop();
    }
  });

  /* ── 打印：真实遍历每一页并把可终态化的模块全部落到静态终态 ──
     talk-stage 用 @media print 把所有 section 放进打印流；这里随后为
     每页 mount/finalize。afterprint 精确恢复 beat，并重新激活当前页。 */
  function finalizeAllForPrint() {
    printing = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    audio.level = 0;
    audio.bass = 0;
    printBeatState = [];
    if (!stage) return;

    [].slice.call(stage.querySelectorAll(':scope > section')).forEach(function (slide) {
      [].slice.call(slide.querySelectorAll('[data-beat]')).forEach(function (element) {
        printBeatState.push({ element: element, wasOn: element.classList.contains('beat-on') });
        element.classList.add('beat-on');
      });
      var label = slide.getAttribute('data-label') || '';
      effects.forEach(function (effect) {
        if (!matches(effect, label) || typeof effect.finalize !== 'function') return;
        if (!ensureMounted(effect, slide)) return;
        call(effect, 'finalize', slide, api);
      });
    });
  }

  function restoreAfterPrint() {
    printBeatState.forEach(function (entry) {
      entry.element.classList.toggle('beat-on', entry.wasOn);
    });
    printBeatState = [];
    printing = false;
    if (curSlide) switchSlide(curSlide, curSlide);
    last = performance.now();
    scheduleLoop();
  }

  window.addEventListener('beforeprint', finalizeAllForPrint);
  window.addEventListener('afterprint', restoreAfterPrint);

  /* ── 公共入口 ── */
  window.FX = {
    fps: 60,
    register: function (effect) {
      if (!effect || typeof effect !== 'object') return;
      effects.push(effect);
      if (effect.match === 'global') {
        globals.push(effect);
        if (booted && !motion.reduced) ensureMounted(effect, null);
      }
    },
    finalizeCurrent: finalizeCurrent,
    setMotion: function (mode) {
      if (mode === 'auto') manualMotion = null;
      else if (mode === 'heavy' || mode === 'low' || mode === 'reduced') manualMotion = mode;
      else return motion.mode;
      remountCurrentForMotion();
      return motion.mode;
    },
    toStagePoint: toStagePoint,
    get slide() { return curSlide; },
    get stage() { return stage; },
    get count() { return effects.length; },
    get motion() { return motion.mode; },
    get geometry() { return updateGeometry(); },
    get audioHealth() { return audio.health; },
  };

  /* ── 启动 ── */
  function boot() {
    stage = document.querySelector('talk-stage');
    if (!stage) { setTimeout(boot, 120); return; }
    booted = true;
    resolveMotion();
    if (!motion.reduced) globals.forEach(function (effect) { ensureMounted(effect, null); });
    stage.addEventListener('slidechange', function (event) {
      switchSlide(event.detail.previousSlide || null, event.detail.slide || null);
    });
    var current = stage.querySelector('section[data-deck-active]');
    if (current) switchSlide(null, current);
    last = performance.now();
    scheduleLoop();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
}());
