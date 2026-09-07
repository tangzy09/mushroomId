/* test/verify_fieldguide_a.mjs — 一期 A 行为验收（走真实点击）
 *   node test/verify_fieldguide_a.mjs [playwright-core 目录]
 * 断言落在屏幕上发生了什么，不落在代码里写了什么。
 * 需要 tools/serve.py 3141 在跑。 */
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
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const active = () => page.evaluate(() => (document.querySelector('.page.active') || {}).id);
const closeOverlay = () => page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });

await page.goto(BASE, { waitUntil: 'networkidle' });
/* 首次赠送要点「我明白了」才发放；这里直接用模块层给几种收集状态，
   图鉴解锁（Task 8）之后这一步无害，留着让路由验收不依赖解锁顺序 */
await page.evaluate(() => {
  Storage.update(function (s) {
    MUSHROOM_DATA.slice(0, 6).forEach(function (m) {
      if (!s.collections.some(function (c) { return c.entityId === m.id; })) {
        s.collections.push({ entityId: m.id, count: 1, firstAt: new Date().toISOString() });
      }
    });
  });
});
await page.reload({ waitUntil: 'networkidle' });
await closeOverlay();

/* R1 首页是图鉴 */
t('首页是图鉴', (await active()) === 'page-collection', await active());

/* R1b 我的页有菌菇园入口，点进去有返回 */
await page.click('#nav button[data-page="profile"]');
await page.waitForTimeout(300);
await page.click('#btn-garden');
await page.waitForTimeout(500);
t('从我的进菌菇园', (await active()) === 'page-garden', await active());
await page.click('#page-garden [data-back]');
await page.waitForTimeout(300);
t('菌菇园返回回到我的', (await active()) === 'page-profile', await active());
await page.click('#nav button[data-page="collection"]');
await page.waitForTimeout(300);

/* R2 详情 -> 相似种详情 -> 返回 回到上一个详情 */
/* 图鉴解锁前只有首次赠送的三种能点；解锁后 .locked 消失，选择器照样成立 */
const gotCell = await page.click('#coll-grid .cell:not(.locked)', { timeout: 3000 }).then(() => true).catch(() => false);
t('图鉴里有可点的格子', gotCell);
if (!gotCell) {
  console.log('\n' + pass + ' 过 / ' + (fail + 1) + ' 失败（图鉴未渲染，后续断言跳过）');
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(400);
const first = await page.evaluate(() => document.getElementById('detail-title').textContent);
const hasLk = await page.$('#page-detail .lookalike');
if (hasLk) {
  await hasLk.click();
  await page.waitForTimeout(400);
  const second = await page.evaluate(() => document.getElementById('detail-title').textContent);
  t('点相似种进入另一个详情', second !== first, second);
  await page.click('#page-detail [data-back]');
  await page.waitForTimeout(400);
  const back1 = await page.evaluate(() => document.getElementById('detail-title').textContent);
  t('返回回到上一个详情，不是图鉴', back1 === first && (await active()) === 'page-detail', back1);
  await page.click('#page-detail [data-back]');
  await page.waitForTimeout(400);
} else {
  await page.click('#page-detail [data-back]');
  await page.waitForTimeout(400);
}
t('再返回回到图鉴', (await active()) === 'page-collection', await active());

/* R3 浏览器后退键也能返回 */
await page.click('#coll-grid .cell:not(.locked)');
await page.waitForTimeout(300);
await page.goBack();
await page.waitForTimeout(300);
t('浏览器后退回到图鉴', (await active()) === 'page-collection', await active());

/* C1 全部可点，没有 ??? */
const qs = await page.evaluate(() => Array.from(document.querySelectorAll('#coll-grid .nm')).filter(n => n.textContent === '???').length);
t('图鉴里没有 ???', qs === 0, qs + ' 个');
const cellN = await page.evaluate(() => document.querySelectorAll('#coll-grid .cell').length);
t('图鉴列出全部物种', cellN === 181, cellN + ' 个');
/* C2 毒种标记永远显示 */
const skulls = await page.evaluate(() => document.querySelectorAll('#coll-grid .skull').length);
t('毒种标记全部显示（42）', skulls === 42, skulls + ' 个');
/* C3 搜索命中学名与生境 */
await page.fill('#coll-search', 'amanita');
await page.waitForTimeout(200);
const nA = await page.evaluate(() => document.querySelectorAll('#coll-grid .cell').length);
t('搜学名 amanita 命中鹅膏属（≥10）', nA >= 10, nA + ' 个');
await page.fill('#coll-search', '松');
await page.waitForTimeout(200);
const nS = await page.evaluate(() => document.querySelectorAll('#coll-grid .cell').length);
t('搜「松」命中生境含松的种（≥5）', nS >= 5, nS + ' 个');
await page.fill('#coll-search', '');
await page.waitForTimeout(200);

/* D1 毒种详情有识别要点三条 + 脚注 + 可食相似种标红 */
await page.fill('#coll-search', '死帽菇');
await page.waitForTimeout(200);
await page.click('#coll-grid .cell');
await page.waitForTimeout(500);
const dk = await page.evaluate(() => ({
  n: document.querySelectorAll('#page-detail .idkeys li').length,
  foot: /未经真菌学家审校/.test((document.querySelector('#page-detail .idkeys') || {}).textContent || ''),
  warn: document.querySelectorAll('#page-detail .lookalike .diff.warn').length,
  diffs: document.querySelectorAll('#page-detail .lookalike .diff:not(.warn)').length,
}));
t('死帽菇有三条识别要点', dk.n === 3, dk.n + ' 条');
t('识别要点带「未经审校」脚注', dk.foot);
t('死帽菇的可食相似种标红', dk.warn >= 1, dk.warn + ' 处');
t('相似种带差异句', dk.diffs >= 1, dk.diffs + ' 句');
await page.click('#page-detail [data-back]');
await page.waitForTimeout(300);
/* D2 无照片致命种有「切勿据此辨认」 */
await page.fill('#coll-search', '致命鹅膏');
await page.waitForTimeout(200);
await page.click('#coll-grid .cell');
await page.waitForTimeout(500);
const np = await page.evaluate(() => (document.querySelector('#page-detail .no-photo') || {}).textContent || '');
t('无照片致命种显示「切勿据此辨认」', /切勿据此辨认/.test(np), np);
await page.click('#page-detail [data-back]');
await page.fill('#coll-search', '');
await page.waitForTimeout(200);

t('零 JS 异常', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close();
console.log('\n' + pass + ' 过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
