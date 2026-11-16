/* fx/S21-概率打字机.js — 概率打字机特效
   页面：data-label="概率"（纸白页）

   立意：演示"下一个词最可能是什么"——LLM 按概率选词，
         在第 6 个词故意选中高概率但错误的词，句子越跑越偏，
         最终盖上"看起来对 · 实际错"朱红斜印章。

   节奏（beat 驱动）：
     beat-on 前：静态排版完整可读（打字机卡片隐藏在 data-beat 里，刷新不播动画也是完整页）
     beat1 出现：打字机卡片出现，自动开始逐词演示
     印章落下时广播 fx:glitch 事件，页面上有 glitch 特效就会跟着抖一下（样例里没有，事件无人接收也无害）

   文案：下面的词表写死在脚本里，换讲稿时按讲稿原意改，不编造数据。

   规则遵守：
     - 无 addEventListener（用 tick 内 classList.contains 轮询 beat）
     - 无新 rAF（所有逻辑在 tick）
     - deactivate 清干净所有 DOM / timer / 状态
     - 颜色只用 CSS 变量或已有色值
     - 无 emoji
*/

FX.register({
  name: 'S21-typewriter',
  match: function (label) { return label === '概率'; },

  /* ─── 内部状态 ─── */
  _active:    false,
  _slide:     null,
  _container: null,   /* 注入到 slide 的根 div */
  _beatEl:    null,   /* data-beat="1" 元素 */

  /* 打字机状态机 */
  _state:     'idle',   /* idle | typing | choosing | stamped */
  _wordIdx:   0,        /* 当前在打第几个词 */
  _charIdx:   0,        /* 当前词已打出的字符数 */
  _timer:     0,        /* 帧内累计时间 ms */
  _waitTimer: 0,        /* 候选词展示等待计时 ms */
  _stampAlpha: 0,       /* 印章透明度 0→1 */
  _glitchFired: false,  /* 保证 fx:glitch 只广播一次 */
  _generation:  0,      /* 每次进/离页递增，阻断旧轮次状态 */

  /* ─── 词表（样例：概率选词把句子带偏）
     每个词含 candidates（候选词+概率）和 chosen（实际被选中的索引）
     第 6 个词（idx=5）故意选错：高概率但语义错误的词
  ─── */
  _words: [
    /* 0 */ { candidates: [{ w: '这份',   p: '68%' }, { w: '那份',   p: '21%' }, { w: '本次',   p: '11%' }], chosen: 0 },
    /* 1 */ { candidates: [{ w: '报告',   p: '72%' }, { w: '数据',   p: '18%' }, { w: '调研',   p: '10%' }], chosen: 0 },
    /* 2 */ { candidates: [{ w: '的',     p: '81%' }, { w: '里的',   p: '12%' }, { w: '给出的', p: '7%'  }], chosen: 0 },
    /* 3 */ { candidates: [{ w: '结论',   p: '55%' }, { w: '重点',   p: '33%' }, { w: '建议',   p: '12%' }], chosen: 0 },
    /* 4 */ { candidates: [{ w: '是',     p: '79%' }, { w: '在于',   p: '14%' }, { w: '表明',   p: '7%'  }], chosen: 0 },
    /* 5 故意选错：「销量」在这个位置概率最高，但报告讲的是别的事，句子从这里开始跑偏 */
    /* 5 */ { candidates: [{ w: '销量',   p: '64%' }, { w: '成本',   p: '27%' }, { w: '风险',   p: '9%'  }], chosen: 0, wrong: true },
    /* 6+ 之后每一步都「合理」，整句却越来越笃定地错下去 */
    /* 6 */ { candidates: [{ w: '一定',   p: '58%' }, { w: '可能',   p: '31%' }, { w: '或许',   p: '11%' }], chosen: 0 },
    /* 7 */ { candidates: [{ w: '会',     p: '83%' }, { w: '将',     p: '12%' }, { w: '能',     p: '5%'  }], chosen: 0 },
    /* 8 */ { candidates: [{ w: '继续',   p: '66%' }, { w: '大幅',   p: '25%' }, { w: '稳步',   p: '9%'  }], chosen: 0 },
    /* 9 */ { candidates: [{ w: '上涨',   p: '71%' }, { w: '增长',   p: '22%' }, { w: '翻倍',   p: '7%'  }], chosen: 0 },
  ],

  /* 打字速度 ms / 字符 */
  _CHAR_DELAY:   60,
  /* 候选词展示时间 ms */
  _WAIT_BEFORE:  500,   /* 打完一词后停多久再展示候选 */
  _WAIT_CHOOSE:  900,   /* 候选展示后停多久再"选中"落下 */
  /* 印章渐显速度 */
  _STAMP_SPEED:  1.8,   /* alpha/s */

  /* ─── DOM 元素引用 ─── */
  _sentenceEl:   null,  /* 已打出词的容器 */
  _candidatesEl: null,  /* 候选词气泡容器 */
  _stampEl:      null,  /* 印章 */
  _cursorEl:     null,  /* 光标 */

  /* ─── mount：建 DOM，只跑一次 ─── */
  mount: function (slide, api) {
    var self = this;
    self._slide = slide;

    /* 样式（只注入一次） */
    if (!document.getElementById('s21-style')) {
      var s = document.createElement('style');
      s.id = 's21-style';
      s.textContent = [
        /* 外框卡片 */
        '#s21-box {',
        '  position:absolute;',
        '  left:120px; right:120px; bottom:100px;',
        '  background:var(--paper-2);',
        '  border:2px solid rgba(22,20,15,.12);',
        '  padding:40px 48px 48px;',
        '  box-shadow:4px 4px 0 rgba(22,20,15,.10);',
        '}',
        /* 候选词行 */
        '#s21-candidates {',
        '  display:flex; gap:24px; margin-bottom:22px; min-height:54px;',
        '  align-items:center;',
        '}',
        '.s21-cand {',
        '  font-family:"JetBrains Mono",monospace;',
        '  font-size:26px; line-height:1;',
        '  padding:6px 16px 8px;',
        '  border:1.5px solid rgba(22,20,15,.20);',
        '  color:var(--ink-soft);',
        '  opacity:0; transform:translateY(-8px);',
        '  transition:opacity .25s,transform .25s;',
        '}',
        '.s21-cand.visible {',
        '  opacity:1; transform:none;',
        '}',
        '.s21-cand.chosen {',
        '  border-color:var(--accent);',
        '  color:var(--accent);',
        '  background:rgba(122,31,46,.06);',
        '}',
        /* 句子行 */
        '#s21-sentence {',
        '  font-family:"Noto Serif SC","Source Han Serif SC",serif;',
        '  font-size:56px; font-weight:700; line-height:1.35;',
        '  color:var(--ink);',
        '  min-height:80px;',
        '  display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 0;',
        '}',
        /* 单词 span */
        '.s21-word {',
        '  display:inline-block;',
        '}',
        '.s21-word.wrong-word {',
        '  color:var(--accent);',
        '  text-decoration:underline;',
        '  text-decoration-color:var(--accent);',
        '  text-underline-offset:4px;',
        '}',
        /* 光标 */
        '#s21-cursor {',
        '  display:inline-block;',
        '  width:3px; height:60px;',
        '  background:var(--ink);',
        '  margin-left:4px;',
        '  vertical-align:middle;',
        '  animation:s21blink .7s step-end infinite;',
        '}',
        '@keyframes s21blink { 50%{opacity:0} }',
        '#s21-box.s21-hit { animation:s21hit .18s cubic-bezier(.2,.8,.3,1) both; }',
        '@keyframes s21hit { 0%,100%{transform:none} 28%{transform:translate(4px,2px)} 68%{transform:translate(-4px,-2px)} }',
        'html[data-fx-motion="reduced"] #s21-cursor{animation:none;opacity:1}',
        /* 印章 */
        '#s21-stamp {',
        '  position:absolute;',
        '  right:48px; bottom:48px;',
        '  font-family:"JetBrains Mono",monospace;',
        '  font-size:28px; font-weight:700; letter-spacing:.05em;',
        '  color:var(--accent);',
        '  border:3px solid var(--accent);',
        '  padding:10px 22px 12px;',
        '  transform:rotate(-8deg);',
        '  opacity:0;',
        '  pointer-events:none;',
        '  line-height:1.3;',
        '  text-align:center;',
        '}',
        /* HUD 小标签 */
        '#s21-label {',
        '  font-family:"JetBrains Mono",monospace;',
        '  font-size:20px; letter-spacing:.15em;',
        '  color:var(--ink-soft);',
        '  margin-bottom:14px;',
        '  opacity:.6;',
        '}',
      ].join('\n');
      document.head.appendChild(s);
    }
  },

  /* ─── activate：翻到此页时重置并准备 ─── */
  activate: function (slide, api) {
    var self = this;
    self._active   = true;
    self._slide    = slide;
    self._state    = 'idle';
    self._wordIdx  = 0;
    self._charIdx  = 0;
    self._timer    = 0;
    self._waitTimer = 0;
    self._stampAlpha = 0;
    self._glitchFired = false;
    self._generation++;

    /* 找 beat 元素（由 HTML patch 添加的 data-beat="1"） */
    self._beatEl = slide.querySelector('[data-beat="1"]');

    /* 建卡片 DOM（若已存在就复用） */
    var box = slide.querySelector('#s21-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 's21-box';

      var lbl = document.createElement('div');
      lbl.id = 's21-label';
      lbl.textContent = 'DEMO · LLM 选词过程';
      box.appendChild(lbl);

      var cands = document.createElement('div');
      cands.id = 's21-candidates';
      box.appendChild(cands);

      var sent = document.createElement('div');
      sent.id = 's21-sentence';
      box.appendChild(sent);

      var cur = document.createElement('span');
      cur.id = 's21-cursor';
      sent.appendChild(cur);

      var stamp = document.createElement('div');
      stamp.id = 's21-stamp';
      stamp.textContent = '看起来对\n实际错';
      stamp.style.whiteSpace = 'pre';
      box.appendChild(stamp);

      /* 把卡片放在 beat-on 控制的容器内，beat-on 前 opacity=0（靠 data-beat CSS） */
      /* 不使用 data-beat 包裹，直接附加到 slide，靠 _beatEl 轮询控制 visibility */
      slide.appendChild(box);
    }

    self._container   = box;
    self._candidatesEl = box.querySelector('#s21-candidates');
    self._sentenceEl   = box.querySelector('#s21-sentence');
    self._stampEl      = box.querySelector('#s21-stamp');
    self._cursorEl     = box.querySelector('#s21-cursor');

    /* 重置视觉状态 */
    self._resetVisual();
  },

  /* ─── deactivate：清干净 ─── */
  deactivate: function (slide, api) {
    var self = this;
    self._active = false;
    self._generation++;

    /* 移除注入的卡片 DOM */
    var box = slide ? slide.querySelector('#s21-box') : null;
    if (box && box.parentNode) {
      box.parentNode.removeChild(box);
    }
    self._container    = null;
    self._candidatesEl = null;
    self._sentenceEl   = null;
    self._stampEl      = null;
    self._cursorEl     = null;
    self._beatEl       = null;
    self._state        = 'idle';
  },

  /* ─── tick：所有帧逻辑 ─── */
  tick: function (dt, api) {
    var self = this;
    if (!self._active) return;

    /* beat 轮询：beat1 出现时启动打字机 */
    if (self._state === 'idle') {
      var beatOn = self._beatEl && self._beatEl.classList.contains('beat-on');
      if (beatOn) {
        self._state    = 'pre-type';  /* 等 WAIT_BEFORE ms 后开始打字 */
        self._timer    = 0;
        self._wordIdx  = 0;
        self._charIdx  = 0;
        /* 显示卡片 */
        if (self._container) self._container.style.opacity = '1';
      }
      return;
    }

    /* ── 印章淡入 ── */
    if (self._state === 'stamped') {
      if (self._stampAlpha < 1) {
        self._stampAlpha = Math.min(1, self._stampAlpha + self._STAMP_SPEED * dt / 1000);
        if (self._stampEl) self._stampEl.style.opacity = String(self._stampAlpha);

        /* 广播 fx:glitch 一次（配合 S10） */
        if (!self._glitchFired && self._stampAlpha >= 0.05) {
          self._glitchFired = true;
          window.dispatchEvent(new CustomEvent('fx:glitch', { detail: { duration: 400 } }));
          /* 局部卡片撞击，不再覆盖整页/舞台 transform。 */
          if (self._container) {
            self._container.classList.remove('s21-hit');
            void self._container.offsetWidth;
            self._container.classList.add('s21-hit');
          }
        }
      }
      return;
    }

    self._timer += dt;

    /* ── pre-type: 进入打字前短暂停顿 ── */
    if (self._state === 'pre-type') {
      if (self._timer >= 300) {
        self._timer = 0;
        self._state = 'typing';
      }
      return;
    }

    /* ── typing: 当前词逐字符打出 ── */
    if (self._state === 'typing') {
      var word = self._words[self._wordIdx];
      if (!word) {
        /* 所有词打完 → 展示印章 */
        self._state = 'stamped';
        self._stampAlpha = 0;
        return;
      }
      var target = word.candidates[word.chosen].w;

      if (self._timer >= self._CHAR_DELAY) {
        self._timer = 0;
        self._charIdx++;

        /* 更新光标前的打字内容（临时 span） */
        self._updateTypingDisplay(target.slice(0, self._charIdx));

        if (self._charIdx >= target.length) {
          /* 词打完 → 等候选词展示 */
          self._state     = 'wait-show-cands';
          self._waitTimer = 0;
          self._charIdx   = 0;
        }
      }
      return;
    }

    /* ── wait-show-cands: 展示候选词 ── */
    if (self._state === 'wait-show-cands') {
      self._waitTimer += dt;
      if (self._waitTimer >= self._WAIT_BEFORE) {
        var w2 = self._words[self._wordIdx];
        self._showCandidates(w2.candidates);
        self._state     = 'wait-choose';
        self._waitTimer = 0;
      }
      return;
    }

    /* ── wait-choose: 候选词已展示，等选中落下 ── */
    if (self._state === 'wait-choose') {
      self._waitTimer += dt;
      if (self._waitTimer >= self._WAIT_CHOOSE) {
        var w3 = self._words[self._wordIdx];
        /* 高亮选中项 */
        self._highlightChosen(w3.chosen);
        /* 将词提交到句子行 */
        self._commitWord(w3.candidates[w3.chosen].w, !!w3.wrong);
        /* 清候选，进入下一词 */
        self._waitTimer = 0;
        var clearDelay = 350;
        /* 利用 pre-next 状态等候选消失动画 */
        self._state = 'pre-next';
        self._timer = 0;
        /* 标记是否有 wrong */
        self._pendingWrong = !!w3.wrong;
      }
      return;
    }

    /* ── pre-next: 候选淡出后进入下一词 ── */
    if (self._state === 'pre-next') {
      if (self._timer >= 350) {
        self._clearCandidates();
        self._wordIdx++;
        self._charIdx = 0;
        self._timer   = 0;

        if (self._wordIdx >= self._words.length) {
          /* 所有词完成 */
          self._state = 'stamped';
          self._stampAlpha = 0;
        } else {
          self._state = 'typing';
        }
      }
      return;
    }
  },

  /* ─── 视觉辅助方法 ─── */

  _resetVisual: function () {
    var self = this;
    if (!self._sentenceEl || !self._candidatesEl || !self._stampEl) return;

    /* 清句子（保留光标） */
    while (self._sentenceEl.firstChild) {
      self._sentenceEl.removeChild(self._sentenceEl.firstChild);
    }
    if (self._cursorEl) self._sentenceEl.appendChild(self._cursorEl);

    /* 清候选 */
    self._candidatesEl.innerHTML = '';

    /* 隐藏印章 */
    self._stampEl.style.opacity = '0';

    /* 卡片初始隐藏（beat-on 前） */
    if (self._container) self._container.style.opacity = '0';
  },

  /* 更新正在打字的那个词（放在光标前的临时 span） */
  _updateTypingDisplay: function (partial) {
    var self = this;
    var sent = self._sentenceEl;
    if (!sent) return;

    /* 移除旧的 typing-span */
    var old = sent.querySelector('.s21-typing');
    if (old) sent.removeChild(old);

    if (partial) {
      var span = document.createElement('span');
      span.className = 's21-word s21-typing';
      span.textContent = partial;
      sent.insertBefore(span, self._cursorEl);
    }
  },

  /* 展示候选词气泡 */
  _showCandidates: function (candidates) {
    var self = this;
    var el = self._candidatesEl;
    if (!el) return;
    el.innerHTML = '';
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      var div = document.createElement('div');
      div.className = 's21-cand';
      div.textContent = c.w + '  ' + c.p;
      div.dataset.idx = String(i);
      el.appendChild(div);
      div.style.transitionDelay = (i * 35) + 'ms';
    }
    /* 同步触发布局后统一开启过渡，无异步回调可越过代次。 */
    void el.offsetWidth;
    [].slice.call(el.children).forEach(function (item) { item.classList.add('visible'); });
  },

  /* 高亮选中的候选词 */
  _highlightChosen: function (idx) {
    var self = this;
    var el = self._candidatesEl;
    if (!el) return;
    var items = el.querySelectorAll('.s21-cand');
    if (items[idx]) items[idx].classList.add('chosen');
  },

  /* 清候选词 */
  _clearCandidates: function () {
    var self = this;
    if (self._candidatesEl) self._candidatesEl.innerHTML = '';
  },

  /* 将词提交到句子行 */
  _commitWord: function (text, isWrong) {
    var self = this;
    var sent = self._sentenceEl;
    if (!sent) return;

    /* 移除 typing span */
    var old = sent.querySelector('.s21-typing');
    if (old) sent.removeChild(old);

    var span = document.createElement('span');
    span.className = 's21-word' + (isWrong ? ' wrong-word' : '');
    span.textContent = text;

    /* 插入到光标之前 */
    sent.insertBefore(span, self._cursorEl);
  },
});
