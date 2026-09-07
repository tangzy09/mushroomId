/* verify_photos_ui.mjs — 照片进产品后的行为验收
 *
 *   node verify_photos_ui.mjs [playwright-core 目录]
 *
 * ⛔ 两条写法上的硬要求，都是踩过才知道的：
 *   ① 断言必须落在「屏幕上真的出现了照片」，查 naturalWidth（图真的解码了），
 *      不是查 src 有没有值 —— src 写错了照样有值。
 *   ② app.js 是 IIFE，内部函数不挂 window，**只能走真实点击**。
 *      第一版直接调 openDetail() 当场 ReferenceError。
 *      模块层（Storage 等）才是全局的，可以用它准备状态。
 *
 * 验七条，含一条正例地板和一条零异常。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pwDir = process.argv[2] || 'C:/Users/tangz/Documents/Projects/fishId/tests/node_modules';
const { chromium } = await import(pathToFileURL(path.join(pwDir, 'playwright-core', 'index.mjs')).href);

const BASE = 'http://127.0.0.1:3141/index.html';
const creds = JSON.parse(fs.readFileSync('C:/tmp/mushroomId/out/credits.json', 'utf8'));
const withPhoto = Object.keys(creds);

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

await page.goto(BASE, { waitUntil: 'networkidle' });

/* 图鉴里未收集的种是锁着的，用模块层把全部标为已收集 */
await page.evaluate(() => {
  Storage.update(function (s) {
    MUSHROOM_DATA.forEach(function (m) {
      if (!s.collections.some(function (c) { return c.entityId === m.id; })) {
        s.collections.push({ entityId: m.id, count: 1, firstAt: new Date().toISOString() });
      }
    });
  });
});
await page.reload({ waitUntil: 'networkidle' });

/* 首次运行会弹安全协议，它盖住整屏，不关掉后面所有点击都会超时 */
const closeOverlay = async () => {
  await page.evaluate(() => {
    const o = document.getElementById('overlay');
    if (o) o.classList.remove('on');
  });
};
await closeOverlay();

/* 真实点击进图鉴 */
await page.click('#nav button[data-page="collection"]');
await closeOverlay();
await page.waitForSelector('#coll-grid .cell', { timeout: 10000 });
await page.waitForTimeout(1500);

const shots = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#coll-grid img.sp-photo'))
    .map(i => ({ w: i.naturalWidth, src: i.getAttribute('src') })));
const decoded = shots.filter(x => x.w > 0);
const cells = await page.$$('#coll-grid .cell');
t('图鉴列表渲染出格子（正例地板）', cells.length >= 100, cells.length + ' 个格子');
t('列表里出现已解码的照片（≥ 20）', decoded.length >= 20,
  '解码 ' + decoded.length + ' / img 元素 ' + shots.length);
t('列表小图取自 thumb 层', decoded.length > 0 && decoded.every(x => /\/thumb\//.test(x.src)),
  (decoded[0] || {}).src);

/* 点一个有照片的种进详情 */
const name1 = await page.evaluate(id => {
  const m = MUSHROOM_DATA.find(x => x.id === id);
  return m ? m.name : null;
}, withPhoto[0]);
await page.evaluate(nm => {
  const cell = Array.from(document.querySelectorAll('#coll-grid .cell'))
    .find(c => c.querySelector('.nm') && c.querySelector('.nm').textContent === nm);
  if (cell) cell.click();
}, name1);
await page.waitForTimeout(1200);

const d = await page.evaluate(() => {
  const box = document.querySelector('#page-detail .detail-art');
  const img = box && box.querySelector('img.sp-photo');
  const cr = box && box.querySelector('.photo-credit');
  return {
    shown: !!document.querySelector('#page-detail.active, #page-detail.page.active'),
    isImg: !!img, w: img ? img.naturalWidth : 0,
    src: img ? img.getAttribute('src') : '',
    credit: cr ? cr.textContent.trim() : '',
  };
});
t('有照片的种，详情页显示照片（' + name1 + '）', d.isImg && d.w > 0, 'naturalWidth=' + d.w);
t('详情页取自 real 层', /\/real\//.test(d.src), d.src);
t('详情页带署名（cc-by 的法律要求）',
  d.credit.length > 6 && /CC|PD/i.test(d.credit), d.credit);

await page.screenshot({ path: 'C:/tmp/mushroomId/ui-detail-photo.png' });

/* 回列表，点一个没照片的种，必须回退绘制。
   ⚠ 详情页会隐藏底部导航，Playwright 的 click 会卡在"元素不可见"上，
   这里用 DOM 事件绕过可见性检查 —— 验的是渲染结果，不是导航可点性。 */
await page.evaluate(() => {
  document.querySelector('#nav button[data-page="collection"]').click();
});
await closeOverlay();
await page.waitForTimeout(600);
const nameNo = await page.evaluate(ids => {
  const m = MUSHROOM_DATA.find(x => ids.indexOf(x.id) < 0);
  return m ? m.name : null;
}, withPhoto);
await page.evaluate(nm => {
  const cell = Array.from(document.querySelectorAll('#coll-grid .cell'))
    .find(c => c.querySelector('.nm') && c.querySelector('.nm').textContent === nm);
  if (cell) cell.click();
}, nameNo);
await page.waitForTimeout(900);
const dn = await page.evaluate(() => {
  const box = document.querySelector('#page-detail .detail-art');
  return {
    canvas: !!(box && box.querySelector('canvas')),
    img: !!(box && box.querySelector('img.sp-photo')),
    // 「暂无照片」提示复用了 photo-credit 的样式类，它不是署名，排除掉
    credit: !!(box && box.querySelector('.photo-credit:not(.no-photo)')),
  };
});
t('没照片的种回退到绘制（' + nameNo + '）', dn.canvas && !dn.img, JSON.stringify(dn));
t('没照片的种不显示空署名', !dn.credit);
await page.screenshot({ path: 'C:/tmp/mushroomId/ui-detail-drawn.png' });

t('本次运行零 JS 异常', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log('\n' + pass + ' 过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
