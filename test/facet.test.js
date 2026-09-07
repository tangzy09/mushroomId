/* facet.test.js — 对拍测试：facet.js 必须与 fishId/js/browse.js 的原始手写实现逐值一致
 *
 *   node facet.test.js                          用内置合成数据（60 条）跑
 *   node facet.test.js path/to/fish_data.js     用 fishId 的 270 条真实数据跑
 *
 * 退出码：0 通过 / 1 有不一致 / 2 测试自身无效（覆盖不足，见下）
 *
 * ⛔ 为什么要有「测试自身无效」这个退出码：
 *   「两份实现结果一致」在**两边都返回 0**时天然为真。所以这里强制两条地板：
 *   总比对次数够多，且**非零计数的比对**够多。少了就是量具没量到东西，
 *   报绿等于说谎。
 */
'use strict';
const Facet = require(process.env.FACET || '../js/core/facet.js');   // FACET= 用来跑变异体，验证这道门真的在量

/* ── 参照实现：从 fishId/js/browse.js 逐行搬来，一个字没改 ────────── */
function reference(DATA, FILTER) {
  function pass(f, skip) {
    if (skip !== 'family' && FILTER.family && f.family !== FILTER.family) return false;
    if (skip !== 'shape' && FILTER.shape && f.shape !== FILTER.shape) return false;
    if (skip !== 'colors' && FILTER.colors.length &&
        !FILTER.colors.every(c => f.colors.indexOf(c) >= 0)) return false;
    if (skip !== 'size' && FILTER.size && f.sizeBand !== FILTER.size) return false;
    if (skip !== 'region' && FILTER.region && f.regions.indexOf(FILTER.region) < 0) return false;
    return true;
  }
  const results = () => DATA.filter(f => pass(f, null));
  const activeCount = () =>
    (FILTER.family ? 1 : 0) + (FILTER.shape ? 1 : 0) + FILTER.colors.length +
    (FILTER.size ? 1 : 0) + (FILTER.region ? 1 : 0);
  function countIf(dim, value) {
    let n = 0;
    for (const f of DATA) {
      if (dim === 'colors') {
        if (!pass(f, 'colors')) continue;
        if (!FILTER.colors.every(c => c === value || f.colors.indexOf(c) >= 0)) continue;
        if (f.colors.indexOf(value) < 0) continue;
      } else {
        if (!pass(f, dim)) continue;
        if (dim === 'family' && f.family !== value) continue;
        if (dim === 'shape' && f.shape !== value) continue;
        if (dim === 'size' && f.sizeBand !== value) continue;
        if (dim === 'region' && f.regions.indexOf(value) < 0) continue;
      }
      n++;
    }
    return n;
  }
  return { results, activeCount, countIf };
}

/* ── 数据：真实的或合成的 ─────────────────────────────────────── */
function loadReal(p) {
  const fs = require('fs'), vm = require('vm');
  const ctx = { };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(p, 'utf8') + '\n;this.__d = typeof FISH_DATA !== "undefined" ? FISH_DATA : null;', ctx);
  if (!ctx.__d) throw new Error('没在 ' + p + ' 里找到 FISH_DATA');
  return ctx.__d;
}

function synth() {
  const FAM = ['A科', 'B科', 'C科', 'D科'];
  const SHP = ['disk', 'oval', 'long', 'flat'];
  const COL = ['red', 'yellow', 'blue', 'white', 'bars', 'spots'];
  const SIZ = ['palm', 'arm', 'sub', 'big'];
  const REG = ['indopac', 'carib', 'temperate', 'deep'];
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pickN = (arr, n) => {
    const c = arr.slice(), out = [];
    for (let i = 0; i < n && c.length; i++) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]);
    return out;
  };
  const out = [];
  for (let i = 0; i < 60; i++) {
    out.push({
      id: 'sp' + i,
      family: FAM[Math.floor(rnd() * FAM.length)],
      shape: SHP[Math.floor(rnd() * SHP.length)],
      colors: pickN(COL, 1 + Math.floor(rnd() * 3)),
      sizeBand: SIZ[Math.floor(rnd() * SIZ.length)],
      regions: pickN(REG, 1 + Math.floor(rnd() * 2))
    });
  }
  return out;
}

/* ── 跑 ───────────────────────────────────────────────────────── */
const arg = process.argv[2];
const DATA = arg ? loadReal(arg) : synth();
const SRC = arg ? '真实数据 ' + arg : '内置合成数据';

const F = Facet.create({
  data: DATA,
  dims: {
    family: { field: 'family' },
    shape:  { field: 'shape' },
    colors: { field: 'colors', multi: true, array: true },
    size:   { field: 'sizeBand' },
    region: { field: 'regions', array: true }
  }
});

const VALUES = {
  family: F.allValues('family'),
  shape:  F.allValues('shape'),
  colors: F.allValues('colors'),
  size:   F.allValues('size'),
  region: F.allValues('region')
};

let seed = 987654321;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const maybe = (arr, p) => rnd() < p ? arr[Math.floor(rnd() * arr.length)] : null;

let cmp = 0, nonzero = 0, bad = 0;
const fails = [];

for (let round = 0; round < 300; round++) {
  // 随机一组条件，直接写进两边的状态
  const colors = [];
  const nc = rnd() < 0.45 ? 1 + Math.floor(rnd() * 2) : 0;
  for (let i = 0; i < nc; i++) {
    const c = VALUES.colors[Math.floor(rnd() * VALUES.colors.length)];
    if (colors.indexOf(c) < 0) colors.push(c);
  }
  const FILTER = {
    family: maybe(VALUES.family, 0.35),
    shape:  maybe(VALUES.shape, 0.35),
    colors: colors,
    size:   maybe(VALUES.size, 0.3),
    region: maybe(VALUES.region, 0.3)
  };
  F.clear();
  if (FILTER.family) F.pick('family', FILTER.family);
  if (FILTER.shape) F.pick('shape', FILTER.shape);
  colors.forEach(c => F.pick('colors', c));
  if (FILTER.size) F.pick('size', FILTER.size);
  if (FILTER.region) F.pick('region', FILTER.region);

  const R = reference(DATA, FILTER);

  const chk = (what, a, b) => {
    cmp++;
    if (a !== 0 || b !== 0) nonzero++;
    if (a !== b) {
      bad++;
      if (fails.length < 8) fails.push(what + ': facet=' + a + ' 参照=' + b +
        ' 条件=' + JSON.stringify(FILTER));
    }
  };

  chk('results', F.results().length, R.results().length);
  chk('activeCount', F.activeCount(), R.activeCount());
  for (const dim of Object.keys(VALUES))
    for (const v of VALUES[dim])
      chk('countIf(' + dim + ',' + v + ')', F.countIf(dim, v), R.countIf(dim, v));
}

/* 单选维度「同值再点 = 取消」 */
F.clear();
F.pick('family', VALUES.family[0]);
F.pick('family', VALUES.family[0]);
if (F.activeCount() !== 0) { bad++; fails.push('单选维度再点一次没有取消'); }

/* 网格判据：条件 ≥2 且结果 ≤8 */
F.clear();
if (F.gridMode()) { bad++; fails.push('零条件时不该进网格模式'); }

console.log('数据源：' + SRC + '（' + DATA.length + ' 条）');
console.log('比对 ' + cmp + ' 次，其中非零 ' + nonzero + ' 次，不一致 ' + bad + ' 次');
fails.forEach(s => console.log('  ✗ ' + s));

/* 地板：没量到足够东西就不算通过 */
if (cmp < 5000 || nonzero < 500) {
  console.log('❌ 测试覆盖不足（比对 ' + cmp + '，非零 ' + nonzero + '），结果不可信');
  process.exit(2);
}
if (bad) { console.log('❌ facet.js 与参照实现不一致'); process.exit(1); }
console.log('✓ facet.js 与 browse.js 原始实现逐值一致');
