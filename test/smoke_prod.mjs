/* test/smoke_prod.mjs — 部署后对生产站跑的验收冒烟
 *   node test/smoke_prod.mjs [base-url] [playwright-core 目录]
 * 判据：核心文件全 200 且版本戳一致、.git 与内部文件不可下载、页面零异常、
 * 图鉴 166 种画出来、详情页照片真的解码、SW 注册成功。退出码 0 才算部署成功。 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const BASE = (process.argv[2] || 'https://mushroomid.ai-speeds.com').replace(/\/$/, '');
const pwDir = process.argv[3] || 'C:/Users/tangz/Documents/Projects/fishId/tests/node_modules';
const { chromium } = await import(pathToFileURL(path.join(pwDir, 'playwright-core', 'index.mjs')).href);

let pass = 0, fail = 0;
const t = (name, ok, extra) => {
  if (ok) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
};
const code = async (p) => { try { const r = await fetch(BASE + p, { cache: 'no-store' }); return r.status; } catch (e) { return 0; } };

/* 1 静态文件：index 里引用的每个 ?v= 资源都 200，且戳与 sw.js 的 V 一致 */
const html = await (await fetch(BASE + '/index.html', { cache: 'no-store' })).text();
const refs = Array.from(html.matchAll(/(?:src|href)="([^"]+\?v=(\w+))"/g));
const stamps = new Set(refs.map(m => m[2]));
t('index.html 引用带版本戳的资源 ≥ 14 个', refs.length >= 14, refs.length);
t('版本戳只有一个', stamps.size === 1, Array.from(stamps).join());
const sw = await (await fetch(BASE + '/sw.js', { cache: 'no-store' })).text();
const swV = (sw.match(/const V = '(\w+)'/) || [])[1];
t('sw.js 的 V 与 index 的 ?v= 一致', swV && stamps.has(swV), 'sw=' + swV + ' index=' + Array.from(stamps).join());
let bad = [];
for (const m of refs) { const c = await code('/' + m[1]); if (c !== 200) bad.push(m[1] + ':' + c); }
t('引用的资源全部 200', bad.length === 0, bad.join(' '));
for (const p of ['/manifest.webmanifest', '/assets/photos/thumb/index.json', '/assets/photos/real/shiitake.webp', '/assets/photos/thumb/shiitake.webp'])
  t('200 ' + p, (await code(p)) === 200);
const swHdr = (await fetch(BASE + '/sw.js', { cache: 'no-store' })).headers.get('cache-control') || '';
t('sw.js 带 no-cache（否则 SW 推不动）', /no-cache/.test(swHdr), swHdr);

/* 1b 双语静态页与英文界面：两种语言的物种页都在线，sitemap 收录了英文页，英文 locale 真的发上去了 */
const zhPage = await fetch(BASE + '/m/flyagaric.html', { cache: 'no-store' });
const enPage = await fetch(BASE + '/m/en/flyagaric.html', { cache: 'no-store' });
t('中文物种页 200 且 lang=zh-CN', zhPage.status === 200 && /<html lang="zh-CN">/.test(await zhPage.text()), String(zhPage.status));
const enHtml = enPage.status === 200 ? await enPage.text() : '';
t('英文物种页 200 且 lang=en', enPage.status === 200 && /<html lang="en">/.test(enHtml), String(enPage.status));
t('英文物种页 hreflang 互指', /hreflang="zh-CN" href="[^"]+\/m\/flyagaric\.html"/.test(enHtml) && /hreflang="en" href="[^"]+\/m\/en\/flyagaric\.html"/.test(enHtml));
const sm = await (await fetch(BASE + '/sitemap.xml', { cache: 'no-store' })).text();
// 只数 <loc>，别数每条 URL 里的 xhtml:link 备选（那样英文页会被数成 830 条）
const smEn = (sm.match(/<loc>[^<]*\/m\/en\/[\w-]+\.html<\/loc>/g) || []).length, smZh = (sm.match(/<loc>[^<]*\/m\/[\w-]+\.html<\/loc>/g) || []).length;
t('sitemap 收录英文物种页 166 条', smEn === 166, String(smEn));
t('sitemap 收录中文物种页 166 条', smZh === 166, String(smZh));
t('200 /locales/en.js（英文界面已发版）', (await code('/locales/en.js')) === 200);

/* 2 卫生：内部文件与 .git 不可下载 */
for (const p of ['/.git/HEAD', '/CLAUDE.md', '/README.md', '/test/check_data.py', '/tools/build_data.py', '/data/mushrooms.json', '/docs/'])
  t('挡住 ' + p, [403, 404].includes(await code(p)), String(await code(p)));

/* 3 真浏览器：零异常 + 地板量 + 照片解码 + SW */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('requestfailed', r => errs.push('netfail ' + r.url()));
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });
await page.waitForTimeout(1200);
const n = await page.evaluate(() => typeof MUSHROOM_DATA !== 'undefined' ? MUSHROOM_DATA.length : 0);
t('数据 166 种', n === 166, n);
const keys = await page.evaluate(() => MUSHROOM_DATA.filter(m => m.idKeys && m.idKeys.length === 3 && m.capCm).length);
t('线上数据带一期 C 字段（166 种都有 idKeys ×3 与 capCm）', keys === 166, keys);
await page.evaluate(() => document.querySelector('#nav button[data-page="collection"]').click());
await page.waitForSelector('#facet-right .fcard', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
const cells = await page.$$('#facet-right .fcard');
t('图鉴列表画出格子（≥ 60）', cells.length >= 60, cells.length);
const decoded = await page.evaluate(() => Array.from(document.querySelectorAll('#page-collection img.sp-photo')).filter(i => i.naturalWidth > 0).length);
t('列表里照片解码（≥ 20）', decoded >= 20, decoded);
const swOk = await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r));
t('Service Worker 已注册', swOk);
const txt = await page.evaluate(() => document.body.innerText.length);
t('页面文字地板（> 300 字）', txt > 300, txt);
t('零 JS 异常 / 零网络失败', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
console.log('\n' + pass + ' 过 / ' + fail + ' 失败  @ ' + BASE);
process.exit(fail ? 1 : 0);
