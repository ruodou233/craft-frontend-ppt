/* 验收第二部分：G 减少动效、H 打印、I 备注、J 演讲者窗、K 不要的东西；以及入口。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, touchSuite, rec, results, serve, sleep, ROOT, PAGE, chromium } = require('./stage-test.cjs');

async function motionSuite(base, tag) {
  const T = (id) => tag + ':' + id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + PAGE);
  await page.waitForFunction(() => window.__log && __log.length);
  const S = (f, a) => page.evaluate(f, a);
  const n1 = await S(() => __log.filter((x) => x.type === 'slidechange').length);
  await page.keyboard.press('ArrowRight');
  const g1 = await S(() => ({ a: document.querySelector('[data-deck-active]').getAttribute('data-label'),
    n: __log.filter((x) => x.type === 'slidechange').length,
    trans: getComputedStyle(document.querySelector('[data-deck-active]')).transitionDuration }));
  rec(T('G1'), n1 === 1 && g1.a === 'P2' && g1.n === 2, JSON.stringify(g1));
  const beats = await S(() => [...document.querySelectorAll('section[data-label="P2"] [data-beat]')].map((e) => getComputedStyle(e).opacity));
  await page.keyboard.press('ArrowRight');
  rec(T('G2'), beats.every((o) => o === '1') && (await S(() => document.querySelector('[data-deck-active]').getAttribute('data-label'))) === 'P3', JSON.stringify(beats));
  const before = await S(() => __log.filter((x) => x.type === 'slidechange').length);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await sleep(150);
  const g3 = await S(() => ({ n: __log.filter((x) => x.type === 'slidechange').length,
    a: document.querySelector('[data-deck-active]').getAttribute('data-label'), m: document.documentElement.getAttribute('data-fx-motion') }));
  const src = fs.readFileSync(path.join(ROOT, 'runtime/talk-stage.js'), 'utf8');
  const outside = src.slice(0, src.indexOf('function presenterMain')).includes('data-fx-motion');
  rec(T('G3'), g3.n === before && g3.a === 'P3' && g3.m === 'heavy' && !outside, JSON.stringify(g3) + ' 观众窗代码不碰 data-fx-motion=' + !outside);
  await browser.close();
}

async function printSuite(base, tag) {
  const T = (id) => tag + ':' + id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + PAGE + '#6');
  await page.waitForFunction(() => window.__log && __log.length);
  await sleep(100);
  const S = (f, a) => page.evaluate(f, a);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const txt = pdf.toString('latin1');
  const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const boxes = [...new Set((txt.match(/\/MediaBox\s*\[[^\]]*\]/g) || []))];
  fs.writeFileSync(path.join(os.tmpdir(), 'talk-stage-print-' + tag + '.pdf'), pdf);
  rec(T('H1'), pages === 6 && boxes.length === 1 && /1440\s+810/.test(boxes[0]), 'pages=' + pages + ' ' + boxes.join());
  await page.emulateMedia({ media: 'print' });
  await S(() => window.dispatchEvent(new Event('beforeprint')));
  const pr = await S(() => [...document.querySelector('talk-stage').children].filter((s) => !s.hasAttribute('slot')).map((s) => {
    const r = s.getBoundingClientRect(), cs = getComputedStyle(s);
    return { l: s.getAttribute('data-label'), w: Math.round(r.width), h: Math.round(r.height), d: cs.display,
      bb: cs.breakBefore, bg: cs.backgroundColor };
  }));
  const beatsPrint = await S(() => [...document.querySelectorAll('section[data-label="P2"] [data-beat]')].map((e) => getComputedStyle(e).opacity));
  const toastShown = await S(() => getComputedStyle(document.querySelector('talk-stage').shadowRoot.querySelector('.toast')).display);
  await S(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
  await sleep(100);
  const slotRect = await S(() => { const r = document.querySelector('talk-stage > [slot]').getBoundingClientRect(); return r.width + r.height; });
  const shown = pr.filter((p) => p.d !== 'none').map((p) => p.l).join();
  const sizes = pr.filter((p) => p.d !== 'none').every((p) => p.w === 1920 && p.h === 1080);
  const breaks = pr.filter((p) => p.d !== 'none').map((p) => p.bb).join();
  rec(T('H1b'), shown === 'P1,P2,P3,P5,P6,P7' && sizes && breaks === 'auto,page,page,page,page,page' && slotRect === 0, shown + ' | ' + breaks + ' | slot=' + slotRect);
  rec(T('H2'), beatsPrint.every((o) => o === '1'), JSON.stringify(beatsPrint));
  const h3 = await S(() => ({ a: document.querySelector('[data-deck-active]').getAttribute('data-label'), h: location.hash,
    n: __log.filter((x) => x.type === 'slidechange').length }));
  rec(T('H3'), h3.a === 'P6' && h3.h === '#6' && h3.n === 1, JSON.stringify(h3));
  const r = await S(() => { const r = document.querySelector('[data-deck-active]').getBoundingClientRect(); return [r.width, r.height, r.left, r.top]; });
  rec(T('H4'), Math.abs(r[0] - 1600) < 1 && Math.abs(r[1] - 900) < 1 && toastShown === 'none', JSON.stringify(r));
  await browser.close();
}

async function notesSuite(base, tag) {
  const T = (id) => tag + ':' + id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const out = {};
  for (const v of ['', 'empty', 'short', 'bad']) {
    const warns = [], errs = [];
    page.removeAllListeners('console'); page.removeAllListeners('pageerror');
    page.on('console', (m) => { if (m.type() === 'warning' && /talk-stage/.test(m.text())) warns.push(m.text()); });
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base + PAGE + (v ? '?notes=' + v : ''));
    await page.waitForFunction(() => window.__log && __log.length);
    await sleep(50);
    out[v || 'full'] = { notes: await page.evaluate(() => document.querySelector('talk-stage').notes), warns: warns.length, errs: errs.length };
  }
  const f = out.full.notes;
  rec(T('I1'), f.length === 8 && f[2].includes('\n') && f[4] === '<b>x</b>', JSON.stringify(f).slice(0, 80));
  rec(T('I2'), out.empty.notes.length === 8 && out.empty.notes.every((n) => n === '') &&
    out.short.notes.slice(0, 3).join() === '一,二,三' && out.short.notes[3] === '' && out.short.notes.length === 8 &&
    out.bad.notes.every((n) => n === '') && out.bad.warns === 1 && out.full.warns === 0 &&
    Object.values(out).every((o) => o.errs === 0), 'bad 警告=' + out.bad.warns);
  await browser.close();
}

module.exports = { motionSuite, printSuite, notesSuite };

async function presenterSuite(base, tag) {
  const T = (id) => tag + ':' + id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(base + PAGE);
  await page.waitForFunction(() => window.__log && __log.length);
  const popP = ctx.waitForEvent('page');
  await page.keyboard.press('p');
  const pop = await popP;
  await pop.waitForLoadState();
  const P = (f, a) => pop.evaluate(f, a);
  const ui = () => P(() => {
    const r = document.getElementById('ts-presenter').shadowRoot;
    const g = (id) => r.getElementById(id);
    const cur = document.querySelector('[slot=cur] talk-stage > section');
    const nxt = document.querySelector('[slot=next] talk-stage > section');
    return { page: g('page').textContent, next: g('nextcap').textContent, notes: g('notes').textContent,
      noteLines: g('notes').getClientRects().length && g('notes').innerText.split('\n').length,
      bold: g('notes').querySelector('b') !== null,
      total: g('total').textContent, over: g('total').classList.contains('over'), clock: g('clock').textContent,
      lost: !g('lost').hidden, cur: cur && cur.getAttribute('data-label'), nxt: nxt && nxt.getAttribute('data-label'),
      rows: [...g('rows').children].map((tr) => [...tr.children].map((td) => td.textContent)),
      media: document.querySelectorAll('[slot] video, [slot] audio, [slot] script, [slot] canvas').length,
      anims: document.getAnimations().length };
  });
  const waitUI = async (pred, ms) => { const t0 = Date.now(); let u; while (Date.now() - t0 < (ms || 2000)) { u = await ui(); if (pred(u)) return u; await sleep(30); } return u; };
  let u = await waitUI((x) => x.cur === 'P1');
  const pages0 = ctx.pages().length;
  await page.bringToFront();
  await page.keyboard.press('p');
  await sleep(200);
  rec(T('J1'), u.cur === 'P1' && u.nxt === 'P2' && u.notes === '第 1 条' && u.total === '00:00' && /^\d\d:\d\d$/.test(u.clock) &&
    ctx.pages().length === pages0, JSON.stringify({ page: u.page, cur: u.cur, nxt: u.nxt, notes: u.notes, total: u.total, pages: ctx.pages().length }));

  await page.evaluate(() => document.querySelector('talk-stage').goTo(2));
  const t0 = Date.now();
  u = await waitUI((x) => x.cur === 'P3', 1000);
  const dt = Date.now() - t0;
  rec(T('J2'), u.cur === 'P3' && u.nxt === 'P5' && /03 \/ 08/.test(u.page) && dt < 300,
    'ms=' + dt + ' ' + u.page + ' next=' + u.nxt);
  const lines = await P(() => document.getElementById('ts-presenter').shadowRoot.getElementById('notes').innerText.split('\n').length);
  rec(T('I1b'), lines === 2, '第 3 条显示 ' + lines + ' 行');

  await page.evaluate(() => document.querySelector('talk-stage').goTo(1));
  await waitUI((x) => x.cur === 'P2');
  await pop.bringToFront();
  await pop.keyboard.press('ArrowRight');
  await sleep(150);
  const j3a = await page.evaluate(() => ({ a: document.querySelector('[data-deck-active]').getAttribute('data-label'),
    beats: document.querySelectorAll('section[data-label="P2"] .beat-on').length,
    reason: __log.filter((x) => x.type === 'slidechange').slice(-1)[0].reason }));
  await pop.keyboard.press('End');
  await sleep(150);
  const j3b = await page.evaluate(() => ({ a: document.querySelector('[data-deck-active]').getAttribute('data-label'),
    reason: __log.filter((x) => x.type === 'slidechange').slice(-1)[0].reason }));
  rec(T('J3'), j3a.a === 'P2' && j3a.beats === 1 && j3b.a === 'P7' && j3b.reason === 'remote', JSON.stringify([j3a, j3b]));
  const timerStarted = await page.evaluate(() => document.querySelector('talk-stage')._timerState().started);

  /* J4：先重置，再测 1.5 秒 + 1 秒 */
  await P(() => document.getElementById('ts-presenter').shadowRoot.getElementById('reset').click());
  await sleep(100);
  await page.evaluate(() => document.querySelector('talk-stage').goTo(2));
  await sleep(1500);
  await page.evaluate(() => document.querySelector('talk-stage').goTo(4));
  let p3 = await page.evaluate(() => document.querySelector('talk-stage')._timerState().perPage.find((r) => r.index === 2));
  await page.evaluate(() => document.querySelector('talk-stage').goTo(2));
  await sleep(1000);
  await page.evaluate(() => document.querySelector('talk-stage').goTo(4));
  const p3b = await page.evaluate(() => document.querySelector('talk-stage')._timerState().perPage.find((r) => r.index === 2));
  await P(() => document.getElementById('ts-presenter').shadowRoot.getElementById('run').click());
  await sleep(150);
  const paused1 = await page.evaluate(() => document.querySelector('talk-stage')._timerState());
  await sleep(800);
  const paused2 = await page.evaluate(() => document.querySelector('talk-stage')._timerState());
  rec(T('J4'), timerStarted && Math.abs(p3.ms - 1500) < 250 && p3.visits === 1 && Math.abs(p3b.ms - 2500) < 350 && p3b.visits === 2 &&
    !paused1.running && paused2.elapsedMs === paused1.elapsedMs,
    `P3 ${p3.ms}ms/${p3.visits} → ${p3b.ms}ms/${p3b.visits}; 暂停后 ${paused1.elapsedMs}=${paused2.elapsedMs}`);

  /* J6：导出 CSV（在重置之前） */
  const dl = pop.waitForEvent('download');
  await P(() => document.getElementById('ts-presenter').shadowRoot.getElementById('csv').click());
  const d = await dl;
  const buf = fs.readFileSync(await d.path());
  const csv = buf.toString('utf8');
  rec(T('J6'), buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF && /^\uFEFF页码,页名,累计秒,进入次数\r\n/.test(csv) &&
    /\r\n3,P3,\d+,2/.test(csv) && /^rehearsal-stage-test-\d{8}-\d{4}\.csv$/.test(d.suggestedFilename()),
    d.suggestedFilename() + ' ' + JSON.stringify(csv.slice(0, 60)));

  await P(() => document.getElementById('ts-presenter').shadowRoot.getElementById('reset').click());
  await sleep(150);
  const reset = await page.evaluate(() => document.querySelector('talk-stage')._timerState());
  rec(T('J4b'), !reset.started && reset.elapsedMs === 0 && reset.perPage.length === 0, '重置清零');

  /* J5：把预算改成 0.02 分钟（1.2 秒），开始计时后变红 */
  await page.evaluate(() => document.querySelector('talk-stage').setAttribute('duration', '0.02'));
  await P(() => document.getElementById('ts-presenter').shadowRoot.getElementById('run').click());
  await sleep(1800);
  u = await ui();
  rec(T('J5'), u.over === true, 'total=' + u.total);

  /* I3：运行中改写 _notes */
  await page.evaluate(() => { const st = document.querySelector('talk-stage'); st.goTo(0); st._notes = ['新备注 A', '新备注 B']; });
  u = await waitUI((x) => x.notes === '新备注 A', 800);
  rec(T('I3'), u.notes === '新备注 A');
  rec(T('I1c'), !u.bold, 'notes 按纯文本显示');

  /* J10：预览里没有媒体、没有动画 */
  await page.evaluate(() => document.querySelector('talk-stage').goTo(6));
  u = await waitUI((x) => x.cur === 'P7', 800);
  const hasPoster = await P(() => !!document.querySelector('[slot=cur] [data-ts-video]'));
  rec(T('J10'), u.media === 0 && hasPoster, 'media=' + u.media + ' anims=' + u.anims);

  /* J7：刷新观众窗（「已断开」可能只闪一下，用观察器记下来） */
  await P(() => { window.__lostSeen = false; const el = document.getElementById('ts-presenter').shadowRoot.getElementById('lost');
    new MutationObserver(() => { if (!el.hidden) window.__lostSeen = true; }).observe(el, { attributes: true }); });
  await page.reload();
  await page.waitForFunction(() => window.__log && __log.length);
  u = await waitUI((x) => !x.lost && x.cur === 'P7', 4000);
  const lostSeen = await P(() => window.__lostSeen);
  rec(T('J7'), lostSeen && !u.lost && u.cur === 'P7', 'lost=' + lostSeen + ' after=' + u.cur);

  /* J8：弹窗被拦截 */
  await pop.close();
  await page.bringToFront();
  await page.evaluate(() => { window.open = () => null; });
  await page.keyboard.press('p');
  await sleep(100);
  const toast = await page.evaluate(() => { const t = document.querySelector('talk-stage').shadowRoot.querySelector('.toast'); return { hidden: t.hidden, text: t.textContent, d: getComputedStyle(t).display }; });
  await page.emulateMedia({ media: 'print' });
  const toastPrint = await page.evaluate(() => getComputedStyle(document.querySelector('talk-stage').shadowRoot.querySelector('.toast')).display);
  await page.emulateMedia({ media: 'screen' });
  await sleep(3100);
  const gone = await page.evaluate(() => document.querySelector('talk-stage').shadowRoot.querySelector('.toast').hidden);
  rec(T('J8'), !toast.hidden && /拦截/.test(toast.text) && toastPrint === 'none' && gone, JSON.stringify(toast));

  /* K：不要的东西 */
  const k = await page.evaluate(async () => {
    const st = document.querySelector('talk-stage');
    const before = { i: st.index, n: __log.length };
    window.postMessage({ anything: true }, '*');
    await new Promise((r) => setTimeout(r, 100));
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.querySelector('[data-deck-active]').dispatchEvent(ev);
    const shadowVisible = [...st.shadowRoot.children].filter((n) => n.tagName !== 'STYLE' && n.className !== 'canvas' && !n.hidden).length;
    const extraChildren = [...st.children].filter((n) => n.tagName !== 'SECTION').length;
    return { same: st.index === before.i && __log.length === before.n, ctx: ev.defaultPrevented, shadowVisible, extraChildren };
  });
  rec(T('K1'), k.same);
  rec(T('K2'), k.ctx === false);
  rec(T('K3'), k.shadowVisible === 0 && k.extraChildren === 0, JSON.stringify(k));
  await browser.close();
}

async function main() {
  const mode = process.argv[2] || 'both';
  const bases = [];
  let srv = null;
  if (mode !== 'http') bases.push(['file', 'file://' + ROOT + '/']);
  if (mode !== 'file') { srv = await serve(); bases.push(['http', 'http://127.0.0.1:' + srv.address().port + '/']); }
  for (const [tag, base] of bases) {
    for (const fn of [run, touchSuite, motionSuite, printSuite, notesSuite, presenterSuite]) {
      try { await fn(base, tag); } catch (e) { rec(tag + ':' + fn.name, false, '异常 ' + e.message.split('\n')[0]); }
    }
  }
  if (srv) srv.close();
  const fail = results.filter((r) => !r.ok);
  console.log('\n合计 ' + results.length + ' 项，失败 ' + fail.length + (fail.length ? '：' + fail.map((r) => r.id).join(', ') : ''));
  process.exitCode = fail.length ? 1 : 0;
}

if (require.main === module) main();
