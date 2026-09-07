/* facet.js — 图鉴的叠加筛选引擎（领域无关，零依赖）
 *
 * 从 fishId/js/browse.js 抽出来的那 60 行。剩下的 300 行是渲染，各产品自己写；
 * 这里只管三件容易抄错的事：交集过滤、剩余计数、对比网格的触发判据。
 *
 * 用法（蘑菇为例）：
 *   const F = Facet.create({
 *     data: MUSHROOM_DATA,
 *     dims: {
 *       hymenium:  { field: 'hymenium' },                       // 单选
 *       silhouette:{ field: m => SIL_GROUP[m.art.cap] },        // 单选，值算出来
 *       colors:    { field: 'colorGroup', multi: true },        // 多选 AND
 *       substrate: { field: 'substrate' },
 *       season:    { field: 'season', array: true },            // 实体值是数组，条件单值
 *     }
 *   });
 *   F.pick('hymenium', 'gills');      // 再点同一个值 = 取消
 *   F.pick('colors', 'red');          // 多选维度自动 toggle
 *   F.results();                      // 交集结果
 *   F.countIf('substrate', 'wood');   // 「其余条件不变时，选它还剩几种」
 *   F.gridMode();                     // 该不该切到两列对比网格
 *
 * ⛔ 三条不要改的语义：
 *   1. 换检索入口（tab）不清筛选 —— 这里根本没有 tab 概念，state 只被 pick/clear 动。
 *   2. countIf 必须跳过该维度自身的条件，否则每个选项都显示 0。
 *   3. 多选维度里，已选中的值只豁免它自己，其余已选值照常参与过滤，
 *      不然显示的是无视其他条件的虚高数。
 */
(function (root) {
  'use strict';

  function valueOf(dim, item) {
    return typeof dim.field === 'function' ? dim.field(item) : item[dim.field];
  }

  /* 单个维度上，item 是否满足「取值为 value」 */
  function hits(dim, item, value) {
    const v = valueOf(dim, item);
    if (dim.array) return Array.isArray(v) && v.indexOf(value) >= 0;
    return v === value;
  }

  function create(spec) {
    const data = spec.data || [];
    const dims = spec.dims || {};
    const grid = Object.assign({ minActive: 2, maxItems: 8 }, spec.grid || {});
    const names = Object.keys(dims);

    // 多选维度的条件是数组，其余是单值 null
    const state = {};
    names.forEach(k => { state[k] = dims[k].multi ? [] : null; });

    const isSet = k => dims[k].multi ? state[k].length > 0 : state[k] != null;

    /* item 是否通过全部条件；skip 指定的维度不参与（facet 计数用） */
    function pass(item, skip) {
      for (const k of names) {
        if (k === skip || !isSet(k)) continue;
        const dim = dims[k];
        if (dim.multi) {
          // 多选默认 AND：全部选中的值都要命中。dim.any=true 时改成 OR。
          const ok = dim.any
            ? state[k].some(v => hits(dim, item, v))
            : state[k].every(v => hits(dim, item, v));
          if (!ok) return false;
        } else if (!hits(dim, item, state[k])) return false;
      }
      return true;
    }

    function results() { return data.filter(x => pass(x, null)); }

    function activeCount() {
      return names.reduce((n, k) =>
        n + (dims[k].multi ? state[k].length : (state[k] != null ? 1 : 0)), 0);
    }

    /* 「其余条件不变时，(dim=value) 还剩几种」 */
    function countIf(name, value) {
      const dim = dims[name];
      if (!dim) throw new Error('facet: 未声明的维度 ' + name);
      let n = 0;
      for (const item of data) {
        if (dim.multi) {
          if (!pass(item, name)) continue;                       // 其他维度照常
          const sel = state[name];
          if (dim.any) {
            // OR 语义：加上这个值只会变宽，命中它即可
            if (!hits(dim, item, value)) continue;
          } else {
            // AND 语义：已选值里只豁免 value 自己，其余照常参与
            if (!sel.every(v => v === value || hits(dim, item, v))) continue;
            if (!hits(dim, item, value)) continue;
          }
        } else {
          if (!pass(item, name)) continue;
          if (!hits(dim, item, value)) continue;
        }
        n++;
      }
      return n;
    }

    /* 一次算出某维度全部候选值的剩余计数，省得渲染时逐个调 */
    function counts(name, values) {
      const out = {};
      (values || allValues(name)).forEach(v => { out[v] = countIf(name, v); });
      return out;
    }

    /* 数据里这个维度实际出现过的值（不含 null / undefined / 空数组） */
    function allValues(name) {
      const dim = dims[name], set = new Set();
      data.forEach(item => {
        const v = valueOf(dim, item);
        if (dim.array) { if (Array.isArray(v)) v.forEach(x => set.add(x)); }
        else if (v != null && v !== '') set.add(v);
      });
      return Array.from(set);
    }

    /* 单选：同值再点 = 取消。多选：toggle。 */
    function pick(name, value) {
      const dim = dims[name];
      if (!dim) throw new Error('facet: 未声明的维度 ' + name);
      if (dim.multi) {
        const i = state[name].indexOf(value);
        if (i >= 0) state[name].splice(i, 1); else state[name].push(value);
      } else {
        state[name] = state[name] === value ? null : value;
      }
      return state[name];
    }

    function drop(name, value) {
      const dim = dims[name];
      if (dim.multi && value !== undefined) {
        const i = state[name].indexOf(value);
        if (i >= 0) state[name].splice(i, 1);
      } else state[name] = dim.multi ? [] : null;
    }

    function clear() { names.forEach(k => { state[k] = dims[k].multi ? [] : null; }); }

    /* 条件够多、结果够少 ⇒ 用户在比对而不是浏览，换成两列大图网格 */
    function gridMode() {
      const n = results().length;
      return activeCount() >= grid.minActive && n > 0 && n <= grid.maxItems;
    }

    /* 给筛选条渲染用：当前生效的条件，展平成 [{dim, value}] */
    function chips() {
      const out = [];
      names.forEach(k => {
        if (!isSet(k)) return;
        if (dims[k].multi) state[k].forEach(v => out.push({ dim: k, value: v }));
        else out.push({ dim: k, value: state[k] });
      });
      return out;
    }

    return {
      state, dims, data,
      pass, results, activeCount, countIf, counts, allValues,
      pick, drop, clear, gridMode, chips,
      isSet
    };
  }

  const Facet = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = Facet;
  else root.Facet = Facet;
})(typeof globalThis !== 'undefined' ? globalThis : this);
