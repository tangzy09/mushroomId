/* i18n 门禁：键集一致 / 占位符一致 / 注册完整 / 真能切得过去。
 * 跑法：先 python tools/serve.py 3141，再 node test/i18n.mjs
 *
 * ⛔ 这套断言要能抓住「菜单里选得到、切过去还是英文」——那种 bug 在只测
 *    「文件存在」时全绿。所以判据是 registered() === SUPPORTED，且逐语言
 *    setLang 后 t() 必须答出非空且不等于键名。照抄 fishId 验证过的形状。 */
import { existsSync } from 'node:fs';
const _exe = process.env.PW_CHROME
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => existsSync(p));
const LAUNCH = Object.assign({ args: ['--no-sandbox'] }, _exe ? { executablePath: _exe } : {});
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const pwDir = process.argv[2] || 'C:/Users/tangz/Documents/Projects/fishId/tests/node_modules';
const { chromium } = await import(pathToFileURL(path.join(pwDir, 'playwright-core', 'index.mjs')).href);

const b = await chromium.launch(LAUNCH);
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('CONSOLE ' + m.text()); });

let n = 0, fails = [];
const step = async (name, fn) => {
  n++;
  try { const r = await fn(); if (r === false) { fails.push(name); console.log('✗', name); } else console.log('✓', name); }
  catch (e) { fails.push(name + ' :: ' + e.message.split('\n')[0]); console.log('✗', name, '::', e.message.split('\n')[0]); }
};

await page.goto('http://localhost:3141/index.html');
await page.waitForTimeout(900);

await step('引擎已加载且 SUPPORTED 正确', async () =>
  await page.evaluate(() => typeof I18N === 'object' && I18N.SUPPORTED.join(',') === 'zh-Hans,en'));

await step('每种语言都真的注册了（registered === SUPPORTED）', async () => {
  const r = await page.evaluate(() => ({ reg: I18N.registered(), sup: I18N.SUPPORTED.slice().sort() }));
  console.log('    registered =', JSON.stringify(r.reg));
  return r.reg.join(',') === r.sup.join(',');
});

await step('逐语言 t() 答得出真值（不是键名）', async () => {
  const r = await page.evaluate(() => {
    const out = {};
    for (const l of I18N.SUPPORTED) { I18N.setLang(l, { persist: false }); out[l] = I18N.t('common.cancel'); }
    return out;
  });
  console.log('    common.cancel =', JSON.stringify(r));
  return Object.values(r).every(v => v && v !== 'common.cancel');
});

await step('两种语言的译文确实不同（不是同一份）', async () => {
  const r = await page.evaluate(() => {
    I18N.setLang('zh-Hans', { persist: false }); const a = I18N.t('photo.publicDomain');
    I18N.setLang('en', { persist: false }); const b = I18N.t('photo.publicDomain');
    return [a, b];
  });
  console.log('    zh / en =', JSON.stringify(r));
  return r[0] !== r[1] && r[0] && r[1];
});

await step('缺键返回键名本身（未翻译的一眼可见）', async () =>
  await page.evaluate(() => I18N.t('no.such.key.here') === 'no.such.key.here'));

await step('键集与占位符：en 与 zh-Hans 完全对齐', async () => {
  const r = await page.evaluate(() => {
    const walk = (o, p = '', a = {}) => {
      for (const k in o) { const v = o[k], np = p ? p + '.' + k : k; (v && typeof v === 'object') ? walk(v, np, a) : a[np] = v; }
      return a;
    };
    const tok = s => typeof s === 'string' ? (s.match(/\{\w+\}/g) || []).sort().join(',') : '';
    const en = walk(window.LOCALE_EN), zh = walk(window.LOCALE_ZH_HANS);
    const miss = Object.keys(en).filter(k => !(k in zh));
    const extra = Object.keys(zh).filter(k => !(k in en));
    const ph = Object.keys(en).filter(k => k in zh && tok(en[k]) !== tok(zh[k]));
    return { n: Object.keys(en).length, miss, extra, ph };
  });
  console.log('    en 共 %d 键 · 缺 %d · 多 %d · 占位符错 %d', r.n, r.miss.length, r.extra.length, r.ph.length);
  if (r.miss.length) console.log('      缺:', r.miss.slice(0, 8).join(', '));
  if (r.extra.length) console.log('      多:', r.extra.slice(0, 8).join(', '));
  if (r.ph.length) console.log('      占位符:', r.ph.slice(0, 8).join(', '));
  return r.n > 0 && !r.miss.length && !r.extra.length && !r.ph.length;
});

await step('detect(): 存档值优先于系统语言', async () => {
  const r = await page.evaluate(() => {
    localStorage.setItem(I18N.KEY, 'en');
    const a = I18N.detect();
    localStorage.setItem(I18N.KEY, 'zh-Hans');
    const b = I18N.detect();
    localStorage.removeItem(I18N.KEY);
    return [a, b];
  });
  console.log('    存 en →', r[0], ' 存 zh-Hans →', r[1]);
  return r[0] === 'en' && r[1] === 'zh-Hans';
});

await step('canonical(): zh-CN / zh-TW / en-GB 都能落到发货语言', async () => {
  const r = await page.evaluate(() => ['zh-CN', 'zh-TW', 'zh-Hant', 'en-GB', 'en-US', 'fr'].map(c => [c, I18N.canonical(c)]));
  console.log('    ', JSON.stringify(r));
  const m = Object.fromEntries(r);
  return m['zh-CN'] === 'zh-Hans' && m['zh-TW'] === 'zh-Hans' && m['en-GB'] === 'en' && m['fr'] === null;
});

await step('setLang 会写 <html lang> 且触发 onChange', async () => {
  const r = await page.evaluate(() => {
    let fired = 0;
    I18N.onChange(() => fired++);
    I18N.setLang('en', { persist: false });
    const a = document.documentElement.getAttribute('lang');
    I18N.setLang('zh-Hans', { persist: false });
    const b = document.documentElement.getAttribute('lang');
    return { a, b, fired };
  });
  console.log('    lang 属性:', r.a, '/', r.b, ' onChange 触发', r.fired, '次');
  return r.a === 'en' && r.b === 'zh-CN' && r.fired >= 2;
});

// ⛔ 反向测过的门禁才是真门禁：切到英文后，语言切换器和图鉴 tab 必须真的变了字
await step('切到英文后 #set-lang 的 lang-current 与图鉴 tab 真的换了字', async () => {
  const r = await page.evaluate(() => {
    I18N.setLang('en', { persist: false });
    I18N.applyDom();
    return {
      langCurrent: document.getElementById('lang-current').textContent,
      collectionTab: document.querySelector('#nav [data-page="collection"]').textContent
    };
  });
  console.log('    lang-current =', r.langCurrent, ' · 图鉴 tab =', r.collectionTab);
  return r.langCurrent === 'English' && /Guide/.test(r.collectionTab);
});

console.log('\n' + n + ' 步，失败 ' + fails.length);
fails.forEach(f => console.log('  ✗ ' + f));
console.log(errs.length ? errs.length + ' JS errors' : '0 JS errors');
await b.close();
process.exit(fails.length === 0 && errs.length === 0 ? 0 : 1);
