/* 界面语言引擎 —— 零依赖，与本项目的 <script> 加载方式一致（不 fetch，
 * 避免 file:// 下取不到文件）。照抄 fishId 验证过的形状，一字未改逻辑。
 *
 * 约定：
 *  - locale 文件**自注册**：locales/<code>.js 末尾调 I18N.register(code, DICT)。
 *    ⛔ 别在别处手抄一份清单——漏一行的症状是「菜单里选得到、切过去还是英文，
 *    而且所有测试全绿」。「文件加载了」与「语言可用」必须是同一件事。
 *  - detect() 顺序：存档里的值 → navigator.languages 逐个前缀匹配 → FALLBACK。
 *  - 前缀表**从 SUPPORTED 派生**，不手写第二张表（那是同步点，加语言必漏）。
 *  - t(path) 缺键**返回 path 本身**：没翻的键在界面上原样露出，一眼可查。
 */
(function (global) {
  var SUPPORTED = ['zh-Hans', 'en'];
  var FALLBACK = 'zh-Hans';
  var NATIVE = { 'zh-Hans': '中文', en: 'English' };
  var KEY = 'mush_lang';

  var DICTS = {};
  var cur = FALLBACK;
  var listeners = [];

  var PREFIX = {};
  SUPPORTED.forEach(function (l) {
    var p = l.split('-')[0];
    if (!(p in PREFIX)) PREFIX[p] = l;
  });

  function canonical(code) {
    if (!code) return null;
    if (SUPPORTED.indexOf(code) !== -1) return code;
    var p = String(code).split('-')[0].toLowerCase();
    return PREFIX[p] || null;
  }

  function register(code, dict) {
    if (SUPPORTED.indexOf(code) === -1) {
      throw new Error('I18N.register: 未登记的语言码 ' + code + '（先加进 SUPPORTED）');
    }
    DICTS[code] = dict;
  }

  function registered() { return Object.keys(DICTS).sort(); }

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function detect() {
    var s = canonical(stored());
    if (s) return s;
    var langs = (global.navigator && (navigator.languages || [navigator.language])) || [];
    for (var i = 0; i < langs.length; i++) {
      var c = canonical(langs[i]);
      if (c) return c;
    }
    return FALLBACK;
  }

  function lang() { return cur; }

  function setLang(code, opts) {
    var c = canonical(code) || FALLBACK;
    cur = c;
    if (!opts || opts.persist !== false) {
      try { localStorage.setItem(KEY, c); } catch (e) { /* private mode */ }
    }
    try {
      document.documentElement.setAttribute('lang', c === 'zh-Hans' ? 'zh-CN' : c);
    } catch (e) { /* no document (node test context) */ }
    listeners.forEach(function (fn) { try { fn(c); } catch (e) { /* one bad listener must not break the rest */ } });
    return c;
  }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  /** t('a.b', {n:1}) —— 缺键返回 path 本身（未翻译的键在界面上可见） */
  function t(path, params) {
    var v = DICTS[cur];
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length && v != null; i++) v = v[parts[i]];
    if (typeof v !== 'string') return path;
    if (params) {
      v = v.replace(/\{(\w+)\}/g, function (m, k) {
        return params[k] != null ? params[k] : m;
      });
    }
    return v;
  }

  /** 中英两种写法二选一：给数据字段用（英文缺失时自动回中文，不留空白） */
  function pick(zh, en) {
    if (cur === 'en') return (en != null && en !== '') ? en : zh;
    return zh;
  }

  /** 刷一遍 DOM 里所有 data-i18n 标记的元素。
   *  静态 HTML 里的文案（导航 tab、页头）不经过 JS 渲染，只能这样刷。
   *  切语言后必须再调一次，否则它们会留在旧语言。 */
  function applyDom(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      if (v) el.textContent = v;
    });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n-ph'));
      if (v) el.setAttribute('placeholder', v);
    });
    (root || document).querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n-title'));
      if (v) el.setAttribute('title', v);
    });
  }

  global.I18N = {
    SUPPORTED: SUPPORTED, FALLBACK: FALLBACK, NATIVE: NATIVE, KEY: KEY,
    register: register, registered: registered, canonical: canonical,
    detect: detect, lang: lang, setLang: setLang, onChange: onChange,
    t: t, pick: pick, applyDom: applyDom
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) module.exports = (typeof window !== 'undefined' ? window.I18N : globalThis.I18N);
