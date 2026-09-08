/* test/verify_observations.mjs — 观察日志行为验收：一键记录、编辑表单、GPS 定位、
 * 「我的」入口卡文案、时间线分组与跳转、旧存档指向已删物种的记录会被清掉
 *   node test/verify_observations.mjs [playwright-core 目录]
 * 需要 tools/serve.py 3141 在跑。走真实点击；数字类断言都拿 Storage.get() 对拍，不信文案。 */
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
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 25.1552, longitude: 121.5624 },   // 阳明山，一个固定坐标
  permissions: ['geolocation'],
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });
await page.waitForTimeout(600);

async function openDetail(id) {
  await page.evaluate(() => { if (!document.getElementById('page-collection').classList.contains('active')) document.querySelector('#nav button[data-page="collection"]').click(); });
  await page.waitForTimeout(150);
  const name = await page.evaluate(id => MUSHROOM_DATA.find(m => m.id === id).name, id);
  await page.fill('#coll-search', name);
  await page.waitForTimeout(300);
  await page.evaluate(nm => {
    const cell = Array.from(document.querySelectorAll('#facet-right .fcard, #facet-grid .fcard, #facet-right .nrow'))
      .find(c => (c.querySelector('b') || c).textContent.trim().startsWith(nm));
    if (cell) cell.click();
  }, name);
  await page.waitForTimeout(700);
}
const obsCount = (id) => page.evaluate(id => Storage.observationsFor(id).length, id);
const btnText = () => page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('#page-detail .card'));
  const c = cards.find(c => (c.querySelector('h2') || {}).textContent === '我的观察');
  return c ? c.querySelector('button').textContent : null;
});

/* E1 一键记录：点「我见过」立刻多一条，日期是今天，地点为空 */
await openDetail('flyagaric');
t('毒蝇伞详情页初始按钮是「我见过」', (await btnText()) === '👁 我见过', await btnText());
await page.click('#page-detail button:has-text("我见过")');
await page.waitForTimeout(300);
const rec1 = await page.evaluate(id => Storage.observationsFor(id)[0], 'flyagaric');
t('点一下立刻多一条记录', (await obsCount('flyagaric')) === 1);
t('日期是今天，地点留空', rec1.date === (await page.evaluate(() => Storage.today())) && rec1.place === '', JSON.stringify(rec1));
t('按钮变成「查看 / 补充记录」', (await btnText()) === '👁 查看 / 补充记录', await btnText());

/* E2 再点一次进列表，点那一行进编辑表单，手填地点保存 */
await page.click('#page-detail button:has-text("查看 / 补充记录")');
await page.waitForTimeout(300);
const rowsN1 = await page.evaluate(() => document.querySelectorAll('.obs-item').length);
t('列表里有 1 行', rowsN1 === 1, rowsN1);
await page.click('.obs-item');
await page.waitForTimeout(250);
await page.fill('#obs-place', '阳明山苗圃');
await page.fill('#obs-note', '草地边缘，群生');
await page.click('#obs-save');
await page.waitForTimeout(300);
const rec1b = await page.evaluate(id => Storage.observationsFor(id)[0], 'flyagaric');
t('手填的地点与备注保存进了记录', rec1b.place === '阳明山苗圃' && rec1b.note === '草地边缘，群生', JSON.stringify(rec1b));
t('保存后回到详情页（sheet 已关）', await page.evaluate(() => !document.getElementById('overlay').classList.contains('on')));

/* E3 「+ 再记一次」新开一条，GPS 一键填坐标（用 context 级 mock 的固定坐标） */
await page.click('#page-detail button:has-text("查看 / 补充记录")');
await page.waitForTimeout(300);
await page.click('#obs-add');
await page.waitForTimeout(300);
t('新记录的编辑表单直接打开（地点为空）', (await page.inputValue('#obs-place')) === '');
await page.click('#obs-gps');
await page.waitForTimeout(600);
const gpsVal = await page.inputValue('#obs-place');
t('GPS 一键填坐标，格式带 N/E', /^\d+\.\d{3}°N, \d+\.\d{3}°E$/.test(gpsVal), gpsVal);
await page.click('#obs-save');
await page.waitForTimeout(300);
t('毒蝇伞现在有 2 条记录', (await obsCount('flyagaric')) === 2);

/* E4 删除其中一条 */
await page.click('#page-detail button:has-text("查看 / 补充记录")');
await page.waitForTimeout(300);
const rowsN2 = await page.evaluate(() => document.querySelectorAll('.obs-item').length);
t('列表里现在有 2 行', rowsN2 === 2, rowsN2);
await page.click('.obs-item');
await page.waitForTimeout(250);
await page.click('#obs-del');
await page.waitForTimeout(300);
t('删除后剩 1 条', (await obsCount('flyagaric')) === 1);
await page.click('#page-detail [data-back]');
await page.waitForTimeout(300);

/* E5 再给另一种记一笔，去「我的」看入口卡与统计 */
await openDetail('matsutake');
await page.click('#page-detail button:has-text("我见过")');
await page.waitForTimeout(300);
await page.click('#page-detail [data-back]');
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#nav button[data-page="profile"]').click());
await page.waitForTimeout(400);
const want = await page.evaluate(() => {
  const st = Storage.get();
  const sp = {}; st.observations.forEach(o => sp[o.entityId] = 1);
  return { species: Object.keys(sp).length, total: st.observations.length };
});
const summary = await page.evaluate(() => document.getElementById('obs-summary').textContent);
t('「我的」入口卡文案与真实统计一致', summary === ('已记录 ' + want.species + ' 种 · ' + want.total + ' 条'), summary + ' vs ' + JSON.stringify(want));

/* E6 进观察日志页，统计三个数字、月份分组、点一行直接打开编辑表单 */
await page.click('#btn-observations');
await page.waitForTimeout(400);
const active = await page.evaluate(() => document.getElementById('page-observations').classList.contains('active'));
t('点入口卡进了我的观察页', active);
const stats = await page.evaluate(() => Array.from(document.querySelectorAll('.obs-stats b')).map(b => +b.textContent));
t('统计数字与真实一致（种/条/地点）', stats[0] === want.species && stats[1] === want.total, JSON.stringify(stats) + ' want.species=' + want.species + ' want.total=' + want.total);
const monthN = await page.evaluate(() => document.querySelectorAll('.obs-month').length);
t('有月份分组', monthN >= 1, monthN);
const rowN = await page.evaluate(() => document.querySelectorAll('#obs-body .obs-item').length);
t('时间线行数等于总记录数', rowN === want.total, rowN + ' vs ' + want.total);
const bodyText = await page.evaluate(() => document.getElementById('page-observations').innerText.length);
t('页面地板量（真的画出来了，不是激活了一个空页面）', bodyText > 50, bodyText);
await page.click('#obs-body .obs-item');
await page.waitForTimeout(300);
const sheetOpen = await page.evaluate(() => document.getElementById('overlay').classList.contains('on') &&
  !!document.getElementById('obs-place'));
t('点时间线一行直接打开编辑表单（不用先跳详情页）', sheetOpen);
await page.evaluate(() => document.getElementById('overlay').classList.remove('on'));

/* E7 旧存档里有指向已下线物种的观察记录，开机要清掉，不能抛异常 */
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem(GameConfig.storageKey));
  raw.observations.push({ oid: 'o_ghost', entityId: 'nonexistent-species-xyz', date: '2020-01-01', place: '', note: '', ts: 1 });
  localStorage.setItem(GameConfig.storageKey, JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });
await page.waitForTimeout(600);
const ghostGone = await page.evaluate(() => Storage.get().observations.every(o => o.entityId !== 'nonexistent-species-xyz'));
t('开机清掉了指向已下线物种的观察记录', ghostGone);
await page.evaluate(() => document.querySelector('#nav button[data-page="profile"]').click());
await page.waitForTimeout(300);
await page.click('#btn-observations');
await page.waitForTimeout(400);
t('清完之后我的观察页正常渲染，零异常', errs.length === 0, errs.slice(0, 3).join(' | '));

t('本次运行零 JS 异常', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
console.log('\n' + pass + ' 过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
