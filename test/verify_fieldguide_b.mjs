/* test/verify_fieldguide_b.mjs — 一期 B 行为验收：五路检索 + 叠加筛选 + 对比网格
 *   node test/verify_fieldguide_b.mjs [playwright-core 目录]
 * 每条都对应设计稿 §2 的一条规矩。走真实点击；计数断言拿真实结果数对拍，不信显示。 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const pwDir = process.argv[2] || 'C:/Users/tangz/Documents/Projects/fishId/tests/node_modules';
const { chromium } = await import(pathToFileURL(path.join(pwDir, 'playwright-core', 'index.mjs')).href);
const BASE = 'http://127.0.0.1:3141/index.html';

let pass = 0, fail = 0;
const t = (name, ok, extra) => {
  if (ok) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page.addInitScript(() => localStorage.setItem('mush_lang', 'zh-Hans'));
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });
await page.waitForTimeout(800);

const tabs = () => page.evaluate(() => Array.from(document.querySelectorAll('#facet-tabs button')).map(b => b.dataset.tab));
const results = () => page.evaluate(() => Browse._facet().results().length);
const active = () => page.evaluate(() => Browse._facet().activeCount());
const warn = () => page.evaluate(() => { const w = document.getElementById('facet-warn'); return w.hidden ? '' : w.textContent; });
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(250); };

/* B1 五路里初始四路可见，菌盖背面是条件维度先不出现 */
let tb = await tabs();
// 2026-09-08 加「大小」为第三刀：伞形 86 种在轮廓+颜色之后仍常 >8 种，加了 capCm 分档
t('初始五个入口：轮廓/长在哪/颜色/大小/名字', tb.join() === 'silhouette,substrate,colors,size,name', tb.join());

/* B2 左栏显示的剩余计数 == 真选下去的结果数（计数不骗人） */
const first = await page.evaluate(() => {
  const r = document.querySelector('#facet-left .frow:not(.zero)');
  return { val: r.dataset.val, shown: +r.querySelector('.n').textContent };
});
await click('#facet-left .frow[data-val="' + first.val + '"]');
t('剩余计数与真实结果一致（' + first.val + '：显示 ' + first.shown + '）', first.shown === await results(), '实际 ' + await results());
t('选中后筛选条出现 chip', (await page.$$('#facet-bar .fchip:not(.ghost)')).length === 1);

/* B3 选了伞形，菌盖背面这一路才出现 */
await click('#facet-bar .fchip:not(.ghost)');          // 先清掉刚才那个
await click('#facet-left .frow[data-val="umbrella"]');
tb = await tabs();
t('选伞形后出现「菌盖背面」', tb.indexOf('hymenium') >= 0, tb.join());

/* B4 切 tab 不清筛选 */
await click('#facet-tabs button[data-tab="substrate"]');
t('切到「长在哪」筛选仍在', (await active()) === 1, '条件数 ' + await active());

/* B5 零计数的类目不可点 */
const zeroDisabled = await page.evaluate(() => {
  const z = document.querySelector('#facet-left .frow.zero');
  return z ? z.disabled === true : null;
});
if (zeroDisabled !== null) t('零计数的类目 disabled', zeroDisabled === true);
else console.log('  ·    当前维度没有零计数项，跳过');

/* B6 毒种对照提示：结果里毒与非毒同在 */
const w1 = await warn();
t('结果同含毒种与非毒种时顶部有提示', /有毒菌/.test(w1), w1);

/* B7 颜色 tab 常驻「颜色不能判断毒性」 */
await click('#facet-tabs button[data-tab="colors"]');
t('颜色 tab 有毒性警示', /颜色不能判断毒性/.test(await warn()), await warn());

/* B8 叠加到 8 种以内切两列对比网格，每格带识别要点或学名 */
const gridState = await page.evaluate(() => {
  const F = Browse._facet();
  const dims = ['substrate', 'colors', 'hymenium', 'ring', 'volva'];
  for (let round = 0; round < 10 && !F.gridMode(); round++) {
    let added = false;
    for (const k of dims) {
      if (F.isSet(k) && !F.dims[k].multi) continue;
      const vals = F.allValues(k).map(v => [v, F.countIf(k, v)]).filter(x => x[1] > 0).sort((a, b) => a[1] - b[1]);
      if (!vals.length) continue;
      F.pick(k, vals[0][0]); added = true; break;
    }
    if (!added) break;
  }
  Browse.render();
  return { grid: F.gridMode(), n: F.results().length, active: F.activeCount(),
    shown: !document.getElementById('facet-grid').hidden,
    cells: document.querySelectorAll('#facet-grid .gcell').length,
    hints: Array.from(document.querySelectorAll('#facet-grid .gcell i')).filter(i => i.textContent.trim()).length };
});
t('条件 ≥2 且结果 ≤8 时切对比网格', gridState.grid && gridState.shown && gridState.cells === gridState.n,
  JSON.stringify(gridState));
t('对比网格每格带识别要点或学名', gridState.hints === gridState.cells, gridState.hints + '/' + gridState.cells);

/* B9 清空 */
await click('#facet-clear');
t('清空后回到全部 166 种', (await results()) === 166 && (await active()) === 0, await results());

/* B9b 第三刀「菌盖表面」：伞形+白色两刀之后常剩 >8 种（审计过 36 种），
   加这一维要让它真的能再收窄，且收窄后结果全部匹配那个值 */
await click('#facet-tabs button[data-tab="silhouette"]');
await click('#facet-left .frow[data-val="umbrella"]');
await click('#facet-tabs button[data-tab="colors"]');
await click('#facet-left .frow[data-val="white"]');
const beforeThird = await results();
await click('#facet-tabs button[data-tab="capSurface"]');
const csVal = await page.evaluate(() => {
  const r = document.querySelector('#facet-left .frow:not(.zero)');
  return r ? r.dataset.val : null;
});
t('伞形+白色后「菌盖表面」有可选项', !!csVal, csVal);
if (csVal) {
  await click('#facet-left .frow[data-val="' + csVal + '"]');
  const afterThird = await results();
  const allMatch = await page.evaluate(v => Browse._facet().results().every(m => m.capSurface === v), csVal);
  t('选菌盖表面后结果收窄且全部匹配（' + csVal + '）', afterThird > 0 && afterThird <= beforeThird && allMatch,
    afterThird + ' <= ' + beforeThird);
}
await click('#facet-clear');

/* B9c 第三刀「大小」：直接选档，结果全部落在 capCm 范围内 */
await click('#facet-tabs button[data-tab="size"]');
await click('#facet-left .frow[data-val="small"]');
const smallOk = await page.evaluate(() =>
  Browse._facet().results().length > 0 &&
  Browse._facet().results().every(m => m.capCm && m.capCm[1] <= 5));
t('大小＝小 时结果非空且全部 capCm 上限 ≤5', smallOk);
await click('#facet-clear');

/* B10 改轮廓为球块，菌盖背面 tab 收起且条件被清 */
await click('#facet-tabs button[data-tab="silhouette"]');   // 清空不切 tab，先回到轮廓
await click('#facet-left .frow[data-val="umbrella"]');
await click('#facet-tabs button[data-tab="hymenium"]');
await click('#facet-left .frow:not(.zero)');
t('伞形下能选菌盖背面', (await active()) === 2, await active());
/* 选了菌褶之后「球与块」计数为零、行被禁用，点不动是对的；
   真实能走的路是再点一次伞形把它取消，菌盖背面应随之收起并清掉 */
await click('#facet-tabs button[data-tab="silhouette"]');
await click('#facet-left .frow[data-val="umbrella"]');
tb = await tabs();
const hymCleared = await page.evaluate(() => !Browse._facet().isSet('hymenium'));
t('取消伞形后菌盖背面 tab 收起、条件被清', tb.indexOf('hymenium') < 0 && hymCleared && (await active()) === 0,
  tb.join() + ' cleared=' + hymCleared + ' active=' + await active());
/* 条件已经归零，「清空」按设计不再显示，这里不用点 */

/* B11 幽灵 chip：有菌托 */
await click('#facet-bar .fchip.ghost[data-pick="volva"]');
const allVolva = await page.evaluate(() => Browse._facet().results().every(m => !!m.volva));
t('点「有菌托」后结果全部有菌托（' + await results() + ' 种）', allVolva && (await results()) > 0);
await click('#facet-clear');

/* B12 名字 tab：按拼音排、有首字母索引头 */
await click('#facet-tabs button[data-tab="name"]');
const nameList = await page.evaluate(() => ({
  heads: document.querySelectorAll('#facet-left .mon').length,
  cards: document.querySelectorAll('#facet-left .fcard').length,
  firstHead: (document.querySelector('#facet-left .mon') || {}).textContent
}));
t('名字 tab 有首字母索引头且列出全部', nameList.heads >= 10 && nameList.cards === 166, JSON.stringify(nameList));

/* B13 搜索与筛选叠加，计数仍对 */
await page.fill('#coll-search', 'amanita');
await page.waitForTimeout(300);
await click('#facet-tabs button[data-tab="silhouette"]');
const nSearch = await results();
await click('#facet-left .frow[data-val="umbrella"]');
const nBoth = await results();
const shownBoth = await page.evaluate(() => +document.querySelector('#facet-bar .fcnt b').textContent);
t('搜索 amanita 命中鹅膏属（≥10）', nSearch >= 10, nSearch);
t('搜索 + 轮廓叠加，显示计数 == 真实结果', nBoth <= nSearch && nBoth > 0 && shownBoth === nBoth, nBoth + ' vs ' + shownBoth);
await click('#facet-clear');
t('清空同时清掉搜索', (await results()) === 166 && (await page.inputValue('#coll-search')) === '');

t('零 JS 异常', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close();
console.log('\n' + pass + ' 过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
