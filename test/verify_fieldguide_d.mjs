/* test/verify_fieldguide_d.mjs — 改良轮行为验收：搜索扩容、第三刀维度、毒种相似种前置、
 * 照片灯箱、多图轮播、题库按需加载、安全横幅收拢、深链
 *   node test/verify_fieldguide_d.mjs [playwright-core 目录]
 * 需要 tools/serve.py 3141 在跑。走真实点击；不信 DOM 是否存在，信它的位置和内容。 */
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

async function openDetail(id) {
  await page.evaluate(() => { if (!document.getElementById('page-collection').classList.contains('active')) document.querySelector('#nav button[data-page="collection"]').click(); });
  await page.waitForTimeout(200);
  const name = await page.evaluate(id => MUSHROOM_DATA.find(m => m.id === id).name, id);
  await page.fill('#coll-search', name);
  await page.waitForTimeout(400);
  const hit = await page.evaluate(nm => {
    const cell = Array.from(document.querySelectorAll('#facet-right .fcard, #facet-grid .fcard, #facet-right .nrow'))
      .find(c => (c.querySelector('b') || c).textContent.trim().startsWith(nm));
    if (cell) { cell.click(); return true; }
    return false;
  }, name);
  await page.waitForTimeout(900);
  return hit;
}
const searchCount = async (q) => {
  await page.evaluate(() => { if (!document.getElementById('page-collection').classList.contains('active')) document.querySelector('#nav button[data-page="collection"]').click(); });
  await page.waitForTimeout(150);
  await page.fill('#coll-search', q);
  await page.waitForTimeout(300);
  return page.evaluate(() => Browse._facet().results().length);
};

/* D1 搜索扩容：中文常见写法要能归一，识别要点/食性标签要进搜索面 */
t('搜「松树」命中生境写「松」的种（原来是 0）', (await searchCount('松树')) > 0, await searchCount('松树'));
t('搜「有毒」命中毒种（原来是 0）', (await searchCount('有毒')) > 0, await searchCount('有毒'));
t('搜「栎树」命中生境写「栎」的种', (await searchCount('栎树')) > 0, await searchCount('栎树'));
await page.fill('#coll-search', '');

/* D2 遇见率四档不再被「常见」一档占了一半以上 */
const encDist = await page.evaluate(() => {
  const c = {};
  MUSHROOM_DATA.forEach(m => { c[m.encounter] = (c[m.encounter] || 0) + 1; });
  return c;
});
t('「常见」占比 < 40%（原来 54%）', encDist.common / 166 < 0.4, JSON.stringify(encDist));

/* D3 毒种「容易认错」紧贴识别要点；非毒种仍在趣味知识之后 */
t('能进毒鹅膏详情', await openDetail('deathcap'));
const orderToxic = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('#detail-body > .card')).map(c => (c.querySelector('h2') || {}).textContent);
  return { idxKeys: cards.indexOf('怎么认'), idxLook: cards.indexOf('容易认错'), idxFact: cards.indexOf('趣味知识'), cards };
});
t('毒种：容易认错紧跟在怎么认之后（早于趣味知识）',
  orderToxic.idxLook > orderToxic.idxKeys && orderToxic.idxLook < orderToxic.idxFact, JSON.stringify(orderToxic));
await page.click('#page-detail [data-back]'); await page.waitForTimeout(300);

t('能进青头菌详情（非毒、有相似种）', await openDetail('greenrussula'));
const orderSafe = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('#detail-body > .card')).map(c => (c.querySelector('h2') || {}).textContent);
  return { idxLook: cards.indexOf('容易认错'), idxFact: cards.indexOf('趣味知识'), cards };
});
t('非毒种：容易认错仍在趣味知识之后', orderSafe.idxLook > orderSafe.idxFact, JSON.stringify(orderSafe));
await page.click('#page-detail [data-back]'); await page.waitForTimeout(300);

/* D4 照片灯箱：点主图放大，点一下关闭 */
t('能进香菇详情', await openDetail('shiitake'));
await page.click('#page-detail .detail-art img.sp-photo');
await page.waitForTimeout(300);
let lbOn = await page.evaluate(() => document.getElementById('lightbox').classList.contains('on'));
t('点照片打开全屏灯箱', lbOn);
const lbSrc = await page.evaluate(() => document.querySelector('#lightbox img').src);
t('灯箱里是同一张图', /shiitake/.test(lbSrc), lbSrc);
await page.click('#lightbox');
await page.waitForTimeout(200);
lbOn = await page.evaluate(() => document.getElementById('lightbox').classList.contains('on'));
t('点一下灯箱关闭', !lbOn);
await page.click('#page-detail [data-back]'); await page.waitForTimeout(300);

/* D5 多图轮播：有 PHOTO_EXTRA 的种，主图+补图横滑，署名随之切换 */
t('能进毒鹅膏详情（有第二张照片）', await openDetail('deathcap'));
const strip = await page.evaluate(() => {
  const s = document.querySelector('#page-detail .photo-strip');
  return s ? { imgs: s.querySelectorAll('img.sp-photo').length, dots: document.querySelectorAll('#page-detail .photo-dots i').length } : null;
});
t('毒鹅膏详情页有照片带（主图+补图）', strip && strip.imgs >= 2 && strip.dots === strip.imgs, JSON.stringify(strip));
const creditBefore = await page.evaluate(() => (document.querySelector('#page-detail .photo-credit') || {}).textContent || '');
await page.evaluate(() => {
  const s = document.querySelector('#page-detail .photo-strip');
  s.scrollLeft = s.clientWidth;
  s.dispatchEvent(new Event('scroll'));
});
await page.waitForTimeout(200);
const creditAfter = await page.evaluate(() => (document.querySelector('#page-detail .photo-credit') || {}).textContent || '');
const dotAfter = await page.evaluate(() => document.querySelectorAll('#page-detail .photo-dots i.on').length === 1 &&
  Array.from(document.querySelectorAll('#page-detail .photo-dots i')).findIndex(i => i.className === 'on'));
t('横滑到第二张后署名跟着变，且第二个点亮', creditAfter !== creditBefore && dotAfter === 1,
  creditBefore + ' -> ' + creditAfter + ' dot=' + dotAfter);
await page.click('#page-detail [data-back]'); await page.waitForTimeout(300);

/* D6 题库按需加载：首屏不该有 QUESTIONS，进一次答题后才有 */
const hasQBefore = await page.evaluate(() => typeof QUESTIONS !== 'undefined');
t('首屏不预加载题库（250 KB 不该白拿）', !hasQBefore);
await page.evaluate(() => document.querySelector('#nav button[data-page="profile"]').click());
await page.waitForTimeout(300);
await page.click('#btn-garden'); await page.waitForTimeout(500);
await page.click('#btn-foray'); await page.waitForTimeout(300);
const bg = await page.$('#biome-grid .biome');
if (bg) { await bg.click(); await page.click('#btn-go'); }
await page.waitForTimeout(2500);
const hasQAfter = await page.evaluate(() => typeof QUESTIONS !== 'undefined' && QUESTIONS.length > 0);
t('进山采菌触发答题后题库已注入', hasQAfter);
await page.evaluate(() => document.querySelector('#nav button[data-page="collection"]').click());
await page.waitForTimeout(300);

/* D7 安全横幅：首开已同意过，横幅收成一行；点一下展开。
   前面几条测试都是绕开首开弹窗直接摘掉 overlay 的，disclaimer 键从没真的写过，
   这里要真的写键 + reload，否则测的是「从没同意过」那条分支，永远看不到收拢。 */
await page.evaluate(() => localStorage.setItem(GameConfig.storageKeys.disclaimer, '1'));
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });
await page.waitForTimeout(600);
const compact = await page.evaluate(() => document.getElementById('safety-bar-2').classList.contains('compact'));
t('已同意过安全声明后横幅收拢成一行', compact);
await page.click('#safety-bar-2');
await page.waitForTimeout(150);
const expanded = await page.evaluate(() => !document.getElementById('safety-bar-2').classList.contains('compact'));
t('点一下横幅展开', expanded);

/* D8 深链：#/m/<id> 直接进详情页。用全新页面加载（带着 hash 首次进入），
   同页面改 hash 的 goto 在 Chromium 里可能只是同文档跳转，不会重跑 boot()。 */
const page2 = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page2.addInitScript(() => localStorage.setItem('mush_lang', 'zh-Hans'));
await page2.goto(BASE + '#/m/shiitake', { waitUntil: 'networkidle' });
await page2.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });
await page2.waitForTimeout(1000);
const deep = await page2.evaluate(() => ({
  active: document.getElementById('page-detail').classList.contains('active'),
  title: (document.getElementById('detail-title') || {}).textContent,
}));
t('#/m/shiitake 深链直接落到详情页', deep.active && deep.title === '香菇', JSON.stringify(deep));
await page2.close();

t('零 JS 异常', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
console.log('\n' + pass + ' 过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
