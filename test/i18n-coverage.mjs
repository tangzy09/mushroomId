/* 英文模式下的「残留中文」门禁 —— 把「还剩多少没翻」变成一个数字。
 * 跑法：先 python tools/serve.py 3141，再 node test/i18n-coverage.mjs
 *
 * ⛔ 为什么需要这条：test/i18n.mjs 的键集对齐 / 引擎能切 / 注册完整，在界面
 *    主体仍是中文时**全都是绿的**——它测的是「翻译字典完整」，不是「画出来的
 *    是哪一份字典」。fishId 在 2026-09-06 就吃过这个亏：9 项引擎测试全过、
 *    151 项回归全过，切到英文的截图里 tab / 科名 / 名字 / 筛选 chip 全是中文。
 *
 * ⛔ 第二课：只巡几个主屏还不够。翻译漏得最多的是二级界面——弹层、表单、
 *    确认框，它们要点开才存在。⇒ 下面第二段把每个弹层逐个点开再数。
 *    新加弹层就要在这里加一行。
 *
 * ⛔ 第三课：还有一类连 Playwright 都看不见——只在真机 iOS 壳内触发的分支。
 *    mushroomId 没有 iOS 壳（网页版即全部功能），这一类目前不适用，但
 *    check_hardcoded_zh.py 仍按源码字面量兜底，两条门禁互补。
 *
 * 判据：切到英文，遍历关键屏与全部弹层，数**可见文本里的汉字数**，超上限即红。
 * 上限只许降（棘轮）。目前唯一非零的一项是 quiz——~900 道知识题的题干/选项/
 * 解释仍是纯中文数据（只有 name_from_image 类型的 166 道看图题走了翻译），
 * 这是 CLAUDE.md 里记录过的已知缺口，不是本次门禁要堵的洞。
 *
 * ⚠ 汉字范围用 \u 转义写，别直接写汉字字面量——同形字（U+8C48 vs U+F900）
 *   在屏幕上完全一样，写错会把代理对区圈进来，让每个 emoji 都被判成中文。
 */
import { existsSync } from 'node:fs';
const _exe = process.env.PW_CHROME
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => existsSync(p));
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const pwDir = process.argv[2] || 'C:/Users/tangz/Documents/Projects/fishId/tests/node_modules';
const { chromium } = await import(pathToFileURL(path.join(pwDir, 'playwright-core', 'index.mjs')).href);
const BASE = 'http://127.0.0.1:3141/index.html';

// 当前上限（只许降）。quiz 是已知记录在案的缺口（约 900 道知识题未译），其余锁 0。
// sheet:lang 例外锁 2：语言选择器里的「中文」是语言的本名（专有名词），设计上
// 不随界面语言改变——跟 I18N.NATIVE 里 zh-Hans: '中文' 是同一个东西，别把它
// 当泄漏改掉，也别把上限撤回 0（那样这条门禁反而会去追杀正确行为）。
const MAX = {
  browse: 0, 'browse:filtered': 0, detail: 0, training: 0, profile: 0,
  'sheet:lang': 2, 'sheet:synth': 0, 'sheet:shop': 0, 'sheet:basket': 0,
  'sheet:obsList': 0, 'sheet:obsEdit': 0,
};

const b = await chromium.launch(Object.assign({ args: ['--no-sandbox'] }, _exe ? { executablePath: _exe } : {}));
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  // Runs on every document load this context makes, including the bare
  // about:blank bounces used below to force a real reload on a hash-only
  // URL change — localStorage throws there (no real origin), which would
  // otherwise show up as a false pageerror on every run.
  try {
    localStorage.setItem('mush_lang', 'en');
    // Skip the first-run disclaimer sheet — it isn't what this gate is
    // checking, and a sheet sitting open would swallow every later click.
    localStorage.setItem('mush_disclaimer_ok', '1');
  } catch (e) { /* about:blank */ }
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('CONSOLE ' + m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// 量具自检：正例（汉字必须命中）与反例（emoji / 拉丁重音字母必须不命中）
const selftest = await page.evaluate(() => {
  const CJK = /[\u4e00-\u9fff]/g;
  const hit = s => (s.match(CJK) || []).length;
  return { zh: hit('菌菇图鉴'), emoji: hit('🔒🍄👁'), latin: hit('Café Ångström') };
});
console.log('量具自检：汉字=' + selftest.zh + '(应=4)  emoji=' + selftest.emoji + '(应=0)  拉丁=' + selftest.latin + '(应=0)');
if (selftest.zh !== 4 || selftest.emoji !== 0 || selftest.latin !== 0) {
  console.log('❌ 量具坏了，结论不可信'); await b.close(); process.exit(2);
}

const lang = await page.evaluate(() => I18N.lang());
if (lang !== 'en') { console.log('❌ 没切到英文，当前 ' + lang); await b.close(); process.exit(2); }

const count = () => page.evaluate(() => {
  const t = document.body.innerText || '';
  const m = t.match(/[\u4e00-\u9fff]/g) || [];
  return { n: m.length, sample: [...new Set(m)].slice(0, 24).join(''), floor: t.replace(/\s/g, '').length };
});
const countSheet = () => page.evaluate(() => {
  const el = document.querySelector('#overlay.on #sheet');
  if (!el) return { n: -1, sample: 'NO-SHEET', floor: 0 };
  const t = el.innerText || '';
  const m = t.match(/[\u4e00-\u9fff]/g) || [];
  return { n: m.length, sample: [...new Set(m)].slice(0, 24).join(''), floor: t.replace(/\s/g, '').length };
});

const screens = [];
const go = async (page$) => { await page.evaluate((p) => { location.hash = ''; }, page$); };

screens.push(['browse', await count()]);

// 筛选 chip 只在真的选了条件时才存在，默认那一屏是空的——必须真选两个条件
await page.click('#facet-tabs button[data-tab="silhouette"]');
await page.waitForTimeout(200);
await page.click('#facet-left .frow:not(.zero)');
await page.waitForTimeout(300);
await page.click('#facet-tabs button[data-tab="colors"]');
await page.waitForTimeout(200);
await page.click('#facet-left .frow:not(.zero)');
await page.waitForTimeout(400);
screens.push(['browse:filtered', await count()]);
await page.click('#facet-clear').catch(() => {});
await page.waitForTimeout(300);

// deathcap：致命种，带识别要点/相似种/趣味知识/体长对比尺，量得到的东西最多
// ⚠ #/m/<id> 只在真正的整页加载时才生效——app.js 的深链只在 boot 时读一次
// location.hash，没有 hashchange 监听。goto 到「同源同路径只差 hash」的地址
// 是浏览器的同文档跳转，不会重新加载，deepLink() 就永远不会再跑一次，点开的
// 其实还是上一屏。先弹去 about:blank 强制下一次 goto 是真的整页加载。
await page.goto('about:blank');
await page.goto(BASE + '#/m/deathcap', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
screens.push(['detail', await count()]);

// The bottom nav is hidden on the detail page (it isn't a ROOT page), so the
// way back is its own back button — boot always does root('collection') then
// go('detail', id) for a hash deep link, so the history stack is 2 deep here.
await page.click('#page-detail [data-back]');
await page.waitForTimeout(300);
await page.click('#nav button[data-page="profile"]');
await page.waitForTimeout(400);
screens.push(['profile', await count()]);

await page.click('#btn-training');
await page.waitForTimeout(400);
screens.push(['training', await count()]);
// 'training' isn't a ROOT page either — its own back button, not the (hidden) nav.
await page.click('#page-training [data-back]');
await page.waitForTimeout(300);

/* ── 二级界面：每个弹层点开再数 ──────────────────────────── */
const closeSheet = async () => { await page.evaluate(() => document.getElementById('overlay').classList.remove('on')); await page.waitForTimeout(200); };
const sheet = async (key, open) => {
  await closeSheet();
  try { await open(); } catch (e) { screens.push([key, { n: 999, sample: 'OPEN-FAILED ' + e.message.slice(0, 60), floor: 0 }]); return; }
  await page.waitForTimeout(500);
  screens.push([key, await countSheet()]);
};

await sheet('sheet:lang', () => page.click('#set-lang'));
await sheet('sheet:synth', () => page.click('#btn-synth'));
await sheet('sheet:shop', () => page.click('#btn-shop'));
await sheet('sheet:basket', () => page.click('#btn-basket'));

// 观察弹层：先在详情页记一条，再点「View / Add Record」打开列表弹层，
// 再从列表弹层点「+ Add Another Record」打开编辑表单弹层。
await closeSheet();
await page.goto('about:blank');
await page.goto(BASE + '#/m/deathcap', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.click('#detail-body button:has-text("I\'ve Seen This")');
await page.waitForTimeout(400);
await sheet('sheet:obsList', () => page.click('#detail-body button:has-text("View / Add Record")'));
// ⚠ Not through the generic sheet() helper — its leading closeSheet() would
// hide the obsList sheet #obs-add lives inside before this click ever runs.
try {
  await page.click('#obs-add');
  await page.waitForTimeout(500);
  screens.push(['sheet:obsEdit', await countSheet()]);
} catch (e) {
  screens.push(['sheet:obsEdit', { n: 999, sample: 'OPEN-FAILED ' + e.message.slice(0, 60), floor: 0 }]);
}

console.log('\n=== 英文模式下的残留汉字 ===');
let bad = 0;
for (const [k, r] of screens) {
  const lim = MAX[k];
  const isSheet = k.startsWith('sheet:');
  // 地板量：弹层 >10，主屏 >80。屏上没东西时「零汉字」天然为真，不查地板就是假绿。
  const floorOk = r.floor > (isSheet ? 10 : 80);
  const ok = r.n >= 0 && r.n <= lim && floorOk;
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${k.padEnd(16)} ${String(r.n).padStart(4)} 字 (上限 ${lim})` +
    `  地板 ${r.floor} 字  ${r.sample}`);
}
console.log(errs.length ? errs.length + ' JS errors' : '0 JS errors');
errs.slice(0, 5).forEach(e => console.log('   ', e));

console.log('\n' + (bad ? bad + ' 屏超出上限' : '全部在上限内'));
await b.close();
process.exit(bad === 0 && errs.length === 0 ? 0 : 1);
