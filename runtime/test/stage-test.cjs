/* talk-stage 自动验收，第一部分（A 翻页、B 跳过页、C 深链接、D 事件时序、E 缩放、F 触摸）。
 * 入口在 stage-test-2.cjs。需要一份 Playwright（不在本仓依赖里）和本机 Google Chrome：
 *   NODE_PATH=<装了 playwright 的 node_modules> node runtime/test/stage-test-2.cjs [file|http|both] */
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGE = 'runtime/test/stage-test.html';
const results = [];
function rec(id, ok, note) {
  results.push({ id, ok: !!ok, note: note || '' });
  console.log((ok ? 'PASS ' : 'FAIL ') + id + (note ? '  ' + note : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  return new Promise((resolve) => {
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function run(base, tag) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const url = (q) => base + PAGE + (q || '');
  const T = (id) => tag + ':' + id;
  let page = await ctx.newPage();
  const open = async (q, opts) => {
    if (page) await page.close();
    page = await (opts && opts.ctx || ctx).newPage();
    page.on('pageerror', (e) => console.log('  pageerror', e.message));
    await page.goto(url(q));
    await page.waitForFunction(() => window.__log && window.__log.some((x) => x.type === 'slidechange'));
    await sleep(50);
    return page;
  };
  const S = (fn, arg) => page.evaluate(fn, arg);
  const changes = () => S(() => __log.filter((x) => x.type === 'slidechange'));
  const active = () => S(() => [...document.querySelectorAll('[data-deck-active]')].map((e) => e.getAttribute('data-label')));
  const idx = () => S(() => document.querySelector('talk-stage').index);
  const key = async (k) => { await page.keyboard.press(k); await sleep(30); };

  /* ── A 翻页 ── */
  await open('');
  let c = await changes();
  rec(T('A1'), c.length === 1 && c[0].index === 0 && c[0].prev === null && c[0].reason === 'init' &&
    (await S(() => location.hash)) === '#1' && (await active()).length === 1, JSON.stringify(c[0]));
  await key('ArrowRight');
  let a2 = (await active())[0] === 'P2';
  const n0 = (await changes()).length;
  await key('ArrowRight'); await key('ArrowRight');
  const beatsOn = await S(() => document.querySelectorAll('section[data-label="P2"] .beat-on').length);
  a2 = a2 && beatsOn === 2 && (await changes()).length === n0 && (await active())[0] === 'P2';
  await key('ArrowRight');
  a2 = a2 && (await active())[0] === 'P3';
  await key('ArrowLeft');
  a2 = a2 && (await active())[0] === 'P2';
  await key('ArrowLeft');
  const b1 = await S(() => document.querySelectorAll('section[data-label="P2"] .beat-on').length);
  await key('ArrowLeft');
  const b0 = await S(() => document.querySelectorAll('section[data-label="P2"] .beat-on').length);
  const stillP2 = (await active())[0] === 'P2';
  await key('ArrowLeft');
  rec(T('A2'), a2 && b1 === 1 && b0 === 0 && stillP2 && (await active())[0] === 'P1', 'beats=' + beatsOn);

  await S(() => document.querySelector('talk-stage').goTo(5));
  let ok3 = true;
  await key('PageDown'); ok3 = ok3 && (await active())[0] === 'P7';
  await key('PageUp'); ok3 = ok3 && (await active())[0] === 'P6';
  await key('Space'); ok3 = ok3 && (await active())[0] === 'P7';
  await key('ArrowLeft');
  let before = (await changes()).length;
  await key('ArrowDown'); await key('Enter');
  await page.mouse.click(800, 450);
  await page.mouse.wheel(0, 400); await sleep(100);
  ok3 = ok3 && (await changes()).length === before && (await active())[0] === 'P6';
  rec(T('A3'), ok3);

  await S(() => document.querySelector('talk-stage').goTo(0));
  before = (await changes()).length;
  await key('ArrowLeft');
  let a4 = (await changes()).length === before && (await active())[0] === 'P1';
  await S(() => document.querySelector('talk-stage').goTo(6));
  before = (await changes()).length;
  await key('ArrowRight');
  a4 = a4 && (await changes()).length === before && (await active())[0] === 'P7';
  rec(T('A4'), a4);

  await S(() => document.querySelector('talk-stage').goTo(0));
  before = (await changes()).length;
  for (const m of ['Meta', 'Control', 'Alt']) { await key(m + '+ArrowRight'); }
  let a5 = (await changes()).length === before;
  await S(() => document.querySelector('talk-stage').goTo(2));
  await page.focus('#field');
  before = (await changes()).length;
  await key('ArrowRight');
  a5 = a5 && (await changes()).length === before && (await active())[0] === 'P3';
  await S(() => document.activeElement.blur());
  rec(T('A5'), a5);

  const a6 = await S(() => ['Escape', 't', 'T', 'm', 'M'].map((k) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    return ev.defaultPrevented;
  }));
  rec(T('A6'), a6.every((x) => x === false), JSON.stringify(a6));

  await S(() => { window.__cap = (e) => { if (e.key === 'ArrowRight') e.preventDefault(); }; window.addEventListener('keydown', __cap, true); });
  before = (await changes()).length;
  await key('ArrowRight');
  rec(T('A7'), (await changes()).length === before && (await active())[0] === 'P3');
  await S(() => window.removeEventListener('keydown', __cap, true));

  const a8 = await S(() => {
    const st = document.querySelector('talk-stage');
    const n = __log.filter((x) => x.type === 'slidechange').length;
    const r = st.goTo(5);
    const sync = { r, active: document.querySelector('[data-deck-active]').getAttribute('data-label'), hash: location.hash,
      last: __log.filter((x) => x.type === 'slidechange').slice(-1)[0], grew: __log.filter((x) => x.type === 'slidechange').length - n };
    const n2 = __log.filter((x) => x.type === 'slidechange').length;
    st.goTo(5);
    sync.again = __log.filter((x) => x.type === 'slidechange').length - n2;
    sync.neg = (st.goTo(-3), st.index);
    sync.big = (st.goTo(99), st.index);
    sync.frac = (st.goTo(2.7), st.index);
    return sync;
  });
  rec(T('A8'), a8.r === 5 && a8.active === 'P6' && a8.hash === '#6' && a8.grew === 1 && a8.last.reason === 'api' &&
    a8.again === 0 && a8.neg === 0 && a8.big === 7 && a8.frac === 2, JSON.stringify(a8).slice(0, 160));

  /* ── B 跳过页与 slot 页 ── */
  await S(() => document.querySelector('talk-stage').goTo(2));
  await key('ArrowRight'); let b = (await active())[0] === 'P5';
  await key('ArrowLeft'); b = b && (await active())[0] === 'P3';
  rec(T('B1'), b);
  await S(() => document.querySelector('talk-stage').goTo(3));
  b = (await active())[0] === 'P4';
  await key('ArrowRight'); b = b && (await active())[0] === 'P5';
  await S(() => document.querySelector('talk-stage').goTo(3));
  await key('ArrowLeft'); b = b && (await active())[0] === 'P3';
  rec(T('B2'), b);
  await key('End'); b = (await active())[0] === 'P7';
  before = (await changes()).length;
  await key('ArrowRight'); b = b && (await active())[0] === 'P7' && (await changes()).length === before;
  await key('Home'); b = b && (await active())[0] === 'P1';
  rec(T('B3'), b);
  const b4 = await S(() => {
    const st = document.querySelector('talk-stage');
    const slot = st.querySelector('[slot]');
    return { len: st._slides.length, total: st.total, noSlot: !st._slides.includes(slot), parent: slot.parentNode === st,
      vis: slot.getBoundingClientRect().width === 0 && slot.getBoundingClientRect().height === 0 };
  });
  rec(T('B4'), b4.len === 8 && b4.total === 8 && b4.noSlot && b4.parent && b4.vis, JSON.stringify(b4));
  await S(() => document.querySelector('section[data-label="P5"]').setAttribute('data-deck-skip', ''));
  await S(() => document.querySelector('talk-stage').goTo(2));
  await key('ArrowRight');
  rec(T('B5'), (await active())[0] === 'P6');
  await S(() => document.querySelector('section[data-label="P5"]').removeAttribute('data-deck-skip'));
  /* B6：删当前页 / 删别的页 */
  const b6 = await S(async () => {
    const st = document.querySelector('talk-stage');
    st.goTo(5);
    const n = __log.filter((x) => x.type === 'slidechange').length;
    st.querySelector('section[data-label="P6"]').remove();
    await new Promise((r) => setTimeout(r, 30));
    const L = __log.filter((x) => x.type === 'slidechange');
    const r1 = { grew: L.length - n, last: L[L.length - 1], active: st.querySelector('[data-deck-active]').getAttribute('data-label'), total: st.total, hash: location.hash };
    const n2 = L.length;
    st.querySelector('section[data-label="P1"]').remove();
    await new Promise((r) => setTimeout(r, 30));
    r1.grew2 = __log.filter((x) => x.type === 'slidechange').length - n2;
    r1.index2 = st.index; r1.hash2 = location.hash;
    return r1;
  });
  rec(T('B6'), b6.grew === 1 && b6.last.reason === 'mutation' && b6.active === 'P7' && b6.total === 7 &&
    b6.grew2 === 0 && b6.index2 === 4 && b6.hash2 === '#5', JSON.stringify(b6).slice(0, 200));

  /* ── C 深链接 ── */
  await open('#6');
  c = await changes();
  rec(T('C1'), c.length === 1 && c[0].index === 5 && c[0].reason === 'init', JSON.stringify(c.map((x) => x.index)));
  const deep = async (h) => { await open(h); return { a: (await active())[0], h: await S(() => location.hash) }; };
  const c2 = [await deep('#4'), await deep('#0'), await deep('#99'), await deep('#abc')];
  rec(T('C2'), c2[0].a === 'P4' && c2[1].a === 'P1' && c2[2].a === 'P8' && c2[3].a === 'P1' && c2[3].h === '#1', JSON.stringify(c2));
  await open('?route=x#6');
  await key('ArrowRight'); await key('ArrowRight');
  const c3 = await S(() => ({ search: location.search, hash: location.hash, len: history.length }));
  rec(T('C3'), c3.search === '?route=x' && c3.hash === '#7' && c3.len <= 2, JSON.stringify(c3));
  await S(() => { location.hash = '#3'; });
  await sleep(100);
  c = await changes();
  rec(T('C4'), (await active())[0] === 'P3' && c[c.length - 1].reason === 'hash');
  await open('?parsedelete=1#6');
  const c5 = await S(() => ({ a: document.querySelector('[data-deck-active]').getAttribute('data-label'),
    total: document.querySelector('talk-stage').total, hl: __hashLog, n: __log.filter((x) => x.type === 'slidechange').length }));
  rec(T('C5'), c5.a === 'P8' && c5.total === 6 && c5.hl.every((h) => h === '#6') && c5.n === 1, JSON.stringify(c5));

  /* ── D slidechange 时序 ── */
  await open('');
  for (let i = 0; i < 6; i++) await key('End'), await key('Home');
  c = await changes();
  rec(T('D1'), c.every((x) => x.activeAtCallback === x.slide && !x.prevStillActive && x.hash === '#' + (x.index + 1) && x.total === 8),
    c.length + ' events');
  const d2 = await S(() => {
    const st = document.querySelector('talk-stage');
    const seen = [];
    const A = () => { throw new Error('A 故意抛错'); };
    const B = (e) => seen.push(e.detail.index);
    st.addEventListener('slidechange', A); st.addEventListener('slidechange', B);
    const oe = window.onerror; window.onerror = () => true;
    st.goTo(4);
    window.onerror = oe;
    st.removeEventListener('slidechange', A); st.removeEventListener('slidechange', B);
    return { seen, idx: st.index, act: document.querySelector('[data-deck-active]').getAttribute('data-label') };
  });
  rec(T('D2'), d2.seen[0] === 4 && d2.idx === 4 && d2.act === 'P5', JSON.stringify(d2));
  const d3 = await S(() => {
    const st = document.querySelector('talk-stage');
    const s1 = [], s2 = [];
    let once = true;
    const L1 = (e) => { s1.push(e.detail.index); if (once) { once = false; st.goTo(0); } };
    const L2 = (e) => s2.push(e.detail.index);
    st.addEventListener('slidechange', L1); st.addEventListener('slidechange', L2);
    st.goTo(6);
    st.removeEventListener('slidechange', L1); st.removeEventListener('slidechange', L2);
    return { s1, s2, idx: st.index };
  });
  rec(T('D3'), JSON.stringify(d3.s1) === '[6,0]' && JSON.stringify(d3.s2) === '[6,0]' && d3.idx === 0, JSON.stringify(d3));
  const d4 = await S(() => {
    const st = document.querySelector('talk-stage');
    const n = __log.length;
    st.goTo(2);
    return __log.slice(n).map((x) => x.type + ':' + x.slide);
  });
  rec(T('D4'), d4.join() === 'slidechange:P3,fx:slide:P3', d4.join());
  const d5 = await S(async () => {
    const st = document.querySelector('talk-stage');
    __probe = 0;
    for (let i = 0; i < 3; i++) { st.goTo(5); await new Promise((r) => setTimeout(r, 120)); st.goTo(6); await new Promise((r) => setTimeout(r, 60)); }
    await new Promise((r) => setTimeout(r, 100));
    return __probe;
  });
  rec(T('D5'), d5 === 3, 'animationstart=' + d5);
  const d6 = await S(() => {
    let got = 0;
    const f = (e) => { if (e.detail && e.detail.reason) got++; };
    document.addEventListener('slidechange', f);
    document.querySelector('talk-stage').goTo(1);
    document.removeEventListener('slidechange', f);
    return got;
  });
  rec(T('D6'), d6 === 1);

  /* ── E 缩放 ── */
  const rect = () => S(() => { const r = document.querySelector('[data-deck-active]').getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, t: r.top }; });
  const near = (a, b) => Math.abs(a - b) < 0.6;
  let r = await rect();
  rec(T('E1'), near(r.w, 1600) && near(r.h, 900) && near(r.l, 0) && near(r.t, 0), JSON.stringify(r));
  await S(() => { window.__geo = []; document.addEventListener('talkgeometrychange', (e) => __geo.push(e.detail)); });
  await page.setViewportSize({ width: 1000, height: 1000 }); await sleep(150);
  r = await rect();
  rec(T('E2'), near(r.w, 1000) && near(r.h, 562.5) && near(r.t, 218.75) && near(r.l, 0), JSON.stringify(r));
  await page.setViewportSize({ width: 2560, height: 1440 }); await sleep(150);
  r = await rect();
  rec(T('E3'), near(r.w, 2560), JSON.stringify(r));
  const geo = await S(() => __geo);
  rec(T('E4'), geo.length === 2 && near(geo[0].scale, 1000 / 1920) && near(geo[1].scale * 1920, 2560), JSON.stringify(geo.map((g) => +g.scale.toFixed(4))));
  await page.setViewportSize({ width: 1600, height: 900 }); await sleep(150);
  const e5 = await S(async () => {
    const st = document.querySelector('talk-stage');
    const n = __geo.length;
    st.style.setProperty('--fx-bass-scale', '1.006');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 60));
    const r = document.querySelector('[data-deck-active]').getBoundingClientRect();
    const out = { w: r.width, cx: r.left + r.width / 2, cy: r.top + r.height / 2, events: __geo.length - n };
    st.style.removeProperty('--fx-bass-scale');
    return out;
  });
  rec(T('E5'), Math.abs(e5.w - 1600 * 1.006) < 0.6 && near(e5.cx, 800) && near(e5.cy, 450) && e5.events === 0, JSON.stringify(e5));
  const e6 = await S(() => {
    const st = document.querySelector('talk-stage');
    const el = document.querySelector('section[data-label="P2"] .beat');
    el.style.translate = '7px 3px';
    for (let i = 0; i < 8; i++) st.goTo(i % 3);
    return { tr: el.style.translate, inl: [...st.children].map((s) => s.style.transform + s.style.translate).join('') };
  });
  rec(T('E6'), e6.tr === '7px 3px' && e6.inl === '', JSON.stringify(e6));
  const e7 = await S(() => FX.toStagePoint(innerWidth / 2, innerHeight / 2));
  rec(T('E7'), Math.abs(e7.x - 960) < 1 && Math.abs(e7.y - 540) < 1, JSON.stringify([e7.x, e7.y]));

  await browser.close();
}

async function touchSuite(base, tag) {
  const T = (id) => tag + ':' + id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(base + PAGE);
  await page.waitForFunction(() => window.__log && __log.length);
  const cdp = await ctx.newCDPSession(page);
  const act = () => page.evaluate(() => document.querySelector('[data-deck-active]').getAttribute('data-label'));
  async function swipe(x0, y0, x1, y1, holdMs, type) {
    const kind = type || 'touch';
    if (kind === 'mouse') {
      await page.mouse.move(x0, y0); await page.mouse.down();
      if (holdMs) await sleep(holdMs);
      for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8);
      await page.mouse.up(); await sleep(60); return;
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    if (holdMs) await sleep(holdMs);
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 8, y: y0 + (y1 - y0) * i / 8 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(80);
  }
  await swipe(900, 450, 700, 450);
  let f1 = (await act()) === 'P2';
  await swipe(900, 450, 700, 450);
  const beat = await page.evaluate(() => document.querySelectorAll('section[data-label="P2"] .beat-on').length);
  f1 = f1 && beat === 1 && (await act()) === 'P2';
  await swipe(700, 450, 900, 450);
  const beat0 = await page.evaluate(() => document.querySelectorAll('section[data-label="P2"] .beat-on').length);
  await swipe(700, 450, 900, 450);
  rec(T('F1'), f1 && beat0 === 0 && (await act()) === 'P1', 'beat=' + beat);
  await swipe(800, 200, 830, 400);
  let f2 = (await act()) === 'P1';
  await swipe(900, 450, 700, 450, 900);
  f2 = f2 && (await act()) === 'P1';
  rec(T('F2'), f2);
  await page.evaluate(() => document.querySelector('talk-stage').goTo(4));
  const box = await page.evaluate(() => { const r = document.getElementById('grab').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await swipe(box.x, box.y, box.x - 200, box.y);
  rec(T('F3'), (await act()) === 'P5');
  await page.evaluate(() => document.querySelector('talk-stage').goTo(0));
  await swipe(900, 450, 650, 450, 0, 'mouse');
  rec(T('F4'), (await act()) === 'P1');
  await browser.close();
}

module.exports = { run, touchSuite, rec, results, serve, sleep, ROOT, PAGE, chromium };
