// Save export/import round trip. Run: node test/transfer.test.js
//
// Runs the real module against Node's WebCrypto with a small shim for the
// three browser APIs it touches, so the encryption path itself is tested
// rather than mocked.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.dirname(__dirname);

let captured = null;
const store = {};
const ctx = {
  module: { exports: {} }, console, Math, Date, JSON, Promise,
  crypto: globalThis.crypto,
  TextEncoder, TextDecoder, Blob, atob, btoa,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => Object.keys(store).forEach(k => delete store[k])
  },
  URL: { createObjectURL: b => { captured = b; return 'blob:x'; }, revokeObjectURL() {} },
  setTimeout,
  document: {
    createElement: () => ({ click() {}, style: {}, set href(_) {}, set download(_) {} }),
    body: { appendChild() {}, removeChild() {} }
  }
};
vm.createContext(ctx);
const load = rel => vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
load('js/game/config.js');
load('js/core/storage.js');
load('js/core/transfer.js');
const { GameConfig, Storage, Transfer, localStorage: LS } = ctx;

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b),
  `${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

(async function () {
  Storage.init(GameConfig, ctx.localStorage);
  Storage.add('flyagaric');
  Storage.add('matsutake');
  Storage.add('matsutake');
  Storage.addFragment('epic', 4);
  Storage.addEssence(250);
  Storage.place('flyagaric', 'L1');
  LS.setItem(GameConfig.storageKeys.lang, 'zh');
  LS.setItem(GameConfig.storageKeys.disclaimer, '1');
  const before = JSON.parse(LS.getItem(GameConfig.storageKey));

  await Transfer.exportSave(GameConfig);
  ok(captured, 'export produced a file');
  const text = await captured.text();
  ok(text.startsWith(GameConfig.transfer.magic + '\n'), 'file starts with the magic header');
  ok(text.length > 100, 'file has a body');
  ok(!text.includes('flyagaric'), 'the body is not plain text');

  LS.clear();
  eq(LS.getItem(GameConfig.storageKey), null, 'store wiped');

  const info = await Transfer.importSave(text, GameConfig);
  eq(info.collected, 2, 'import reports the collection size');
  const after = JSON.parse(LS.getItem(GameConfig.storageKey));
  eq(after, before, 'main save round-trips byte for byte');
  eq(LS.getItem(GameConfig.storageKeys.lang), 'zh', 'side keys travel too');
  eq(LS.getItem(GameConfig.storageKeys.disclaimer), '1', 'disclaimer flag travels');

  // A duplicate count must survive, not just the species list.
  const mats = after.collections.find(c => c.entityId === 'matsutake');
  eq(mats.count, 2, 'duplicate counts survive');

  async function rejects(input, label) {
    try { await Transfer.importSave(input, GameConfig); fail++; fails.push(label + ': accepted'); }
    catch (e) { ok(!!e.message, label); }
  }
  await rejects('NOTMINE\nabcdef', 'rejects a file from another game');
  await rejects('MGAME1\n!!!not base64!!!', 'rejects a corrupt body');
  await rejects('MGAME1\n' + Buffer.from('short').toString('base64'), 'rejects a truncated body');
  await rejects('no newline at all', 'rejects a file with no header');

  // A good save must not be destroyed by a bad import.
  const guard = JSON.parse(LS.getItem(GameConfig.storageKey));
  try { await Transfer.importSave('MGAME1\n' + Buffer.from('xxxx').toString('base64'), GameConfig); }
  catch (e) { /* expected */ }
  eq(JSON.parse(LS.getItem(GameConfig.storageKey)), guard,
     'a failed import leaves the existing save untouched');

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { fails.forEach(f => console.log('  x ' + f)); process.exit(1); }
})();
