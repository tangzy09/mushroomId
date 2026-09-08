/* test/verify_fieldguide_c.mjs — 一期 C 行为验收：全库识别要点 + 尺度对比尺 + 照片分享卡
 *   node test/verify_fieldguide_c.mjs [playwright-core 目录]
 * 需要 tools/serve.py 3141 在跑。走真实点击；分享卡验的是「点按钮真的落下一个文件」，
 * 卡片内容用像素对拍（有照片 vs 无照片、有署名 vs 无署名必须画得不一样），不信返回值。 */
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
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('mush_lang', 'zh-Hans'));
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });
await page.waitForTimeout(800);

/* C1 数据地板：166 种全部有 3 条识别要点与两元 capCm */
const floor = await page.evaluate(() => {
  const all = MUSHROOM_DATA;
  const noKeys = all.filter(m => !m.idKeys || m.idKeys.length !== 3).map(m => m.id);
  const noCap = all.filter(m => !m.capCm || m.capCm.length !== 2 || !(m.capCm[0] > 0 && m.capCm[0] <= m.capCm[1])).map(m => m.id);
  return { n: all.length, noKeys, noCap };
});
t('全库 166 种', floor.n === 166, floor.n);
t('每种 3 条识别要点', floor.noKeys.length === 0, floor.noKeys.slice(0, 5).join());
t('每种两元 capCm 且 0<lo≤hi', floor.noCap.length === 0, floor.noCap.slice(0, 5).join());

/* 用搜索框定位并真实点击进详情 */
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
const ruler = () => page.evaluate(() => {
  const r = document.querySelector('#page-detail .ruler-card');
  if (!r) return null;
  const rows = Array.from(r.querySelectorAll('.rrow'));
  const bars = Array.from(r.querySelectorAll('.rt u')).map(u => parseFloat(u.style.width));
  return {
    rows: rows.length,
    ref: rows[1] ? rows[1].querySelector('.rl').textContent : '',
    axis: r.querySelector('.raxis span:last-child').textContent,
    bars, foot: r.querySelector('.footnote').textContent,
    visible: r.getBoundingClientRect().height > 0,
  };
});
const idkeys = () => page.evaluate(() => Array.from(document.querySelectorAll('#page-detail .idkeys li')).map(l => l.textContent.trim()));

/* C2 非毒种（香菇）详情页有「怎么认」3 条 + 对比尺，参考物是手掌 */
t('能进香菇详情', await openDetail('shiitake'));
let ks = await idkeys();
t('香菇「怎么认」3 条且都是句子', ks.length === 3 && ks.every(k => k.length >= 6), ks.join(' / '));
let r = await ruler();
t('对比尺出现且可见（两行）', r && r.rows === 2 && r.visible, JSON.stringify(r));
t('5–15 cm 的种比手掌，轴 30 cm', r && r.ref === '手掌' && r.axis === '30 cm', r && (r.ref + ' ' + r.axis));
t('实心段 ≤ 浅色段（常见下限 ≤ 最大记录）', r && r.bars[1] <= r.bars[0] && r.bars[0] > 0, r && r.bars.join());
t('伞形种脚注写「菌盖直径」', r && /菌盖直径/.test(r.foot), r && r.foot);
await page.goBack(); await page.waitForTimeout(400);

/* C3 小种比硬币、大种比小臂；非伞形写「整体大小」 */
t('能进蓝小菇详情', await openDetail('bluemushroom'));
r = await ruler();
t('≤5 cm 的种比一元硬币，轴 6 cm', r && r.ref === '一元硬币' && r.axis === '6 cm', r && (r.ref + ' ' + r.axis));
await page.goBack(); await page.waitForTimeout(400);
t('能进大马勃详情', await openDetail('giantpuffball'));
r = await ruler();
t('80 cm 的种比小臂，轴按 30 取整（120 cm）', r && r.ref === '小臂' && r.axis === '120 cm', r && (r.ref + ' ' + r.axis));
t('球形种脚注写「整体大小」', r && /整体大小/.test(r.foot), r && r.foot);
t('最大记录条不超过 100%', r && r.bars.every(b => b <= 100), r && r.bars.join());

/* C4 分享卡：有照片 vs 无照片、有署名 vs 无署名，像素必须不同；且照片区不是背景色 */
const card = await page.evaluate(async () => {
  const sp = MUSHROOM_DATA.find(m => m.id === 'giantpuffball');
  const draw = (c, e, s) => ShroomArt.draw(c, e, s, { stage: 'mature' });
  const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/photos/real/giantpuffball.webp'; });
  if (!img) return { noImg: true };
  const a = Share.entityCard(sp, GameConfig, draw);
  const b = Share.entityCard(sp, GameConfig, draw, { photo: img, credit: '照片 Someone · CC-BY' });
  const c = Share.entityCard(sp, GameConfig, draw, { photo: img });
  const px = (cv, x0, y0, w, h) => cv.getContext('2d').getImageData(x0 * 2, y0 * 2, w * 2, h * 2).data;
  const diff = (p, q) => { let n = 0; for (let i = 0; i < p.length; i += 4) if (p[i] !== q[i] || p[i + 1] !== q[i + 1] || p[i + 2] !== q[i + 2]) n++; return n; };
  const photoDiff = diff(px(a, 125, 70, 230, 230), px(b, 125, 70, 230, 230));
  const creditDiff = diff(px(b, 0, 560, 480, 20), px(c, 0, 560, 480, 20));
  const textSame = diff(px(b, 0, 340, 480, 100), px(c, 0, 340, 480, 100));
  return { w: b.width, h: b.height, photoDiff, creditDiff, textSame };
});
t('照片能加载进分享卡（真实文件）', !card.noImg);
t('卡片 2x 渲染 960×1240', card.w === 960 && card.h === 1240, card.w + '×' + card.h);
t('照片区与绘制版像素不同（≥ 5 万点）', card.photoDiff >= 50000, card.photoDiff);
t('署名行有字（与无署名版不同）', card.creditDiff > 200, card.creditDiff);
t('名字 / 学名区不受照片影响', card.textSame === 0, card.textSame);

/* C5 点「分享这张卡」在无 navigator.share 的环境真的落下一个 PNG */
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
  page.evaluate(() => { const b = Array.from(document.querySelectorAll('#page-detail button')).find(x => /分享/.test(x.textContent)); if (b) b.click(); }),
]);
t('点分享按钮落下 mushroom-card.png', !!dl && dl.suggestedFilename() === 'mushroom-card.png', dl && dl.suggestedFilename());
if (dl) {
  const p = 'C:/tmp/mushroomId/share-card-c.png';
  await dl.saveAs(p);
  const { statSync } = await import('node:fs');
  t('分享卡文件 > 30 KB（带照片）', statSync(p).size > 30000, statSync(p).size + ' bytes');
}

t('零 JS 异常', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close();
console.log('\n' + pass + ' 过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
