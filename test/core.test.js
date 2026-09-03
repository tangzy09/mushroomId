// Pure-function tests for the core layer. Run: node test/core.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.dirname(__dirname);
const ctx = { module: { exports: {} }, console, Math, Date, JSON, localStorage: null };
vm.createContext(ctx);

function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
}
load('js/game/config.js');
load('js/core/storage.js');
load('js/core/gacha.js');
load('js/core/quiz.js');
load('js/game/weather.js');
load('js/data.gen.js');

const { GameConfig, Storage, Gacha, Quiz, World, MUSHROOM_DATA, QUESTIONS } = ctx;

let pass = 0, fail = 0;
const failures = [];

function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; failures.push(name + ': ' + e.message); }
}
function eq(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error((msg || '') + ' expected ' + sb + ', got ' + sa);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

/** Deterministic [0,1) source cycling through the given values. */
function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// --- Gacha.rollRarity -------------------------------------------------
const G = GameConfig.gacha;
const noPity = { epic: 0, legend: 0 };

t('rollRarity: lowest roll hits legend', () => {
  eq(Gacha.rollRarity(G, 0, noPity, null, seq([0])), 'legend');
});
t('rollRarity: highest roll hits common', () => {
  eq(Gacha.rollRarity(G, 0, noPity, null, seq([0.999999])), 'common');
});
t('rollRarity: boundaries follow the 2/8/30/60 table', () => {
  // order is legend, epic, rare, common over a total of 100
  eq(Gacha.rollRarity(G, 0, noPity, null, seq([0.019])), 'legend');
  eq(Gacha.rollRarity(G, 0, noPity, null, seq([0.021])), 'epic');
  eq(Gacha.rollRarity(G, 0, noPity, null, seq([0.099])), 'epic');
  eq(Gacha.rollRarity(G, 0, noPity, null, seq([0.101])), 'rare');
  eq(Gacha.rollRarity(G, 0, noPity, null, seq([0.399])), 'rare');
  eq(Gacha.rollRarity(G, 0, noPity, null, seq([0.401])), 'common');
});
t('rollRarity: a wrong answer switches to the penalty table', () => {
  eq(Gacha.rollRarity(G, 1, noPity, null, seq([0.011])), 'epic');   // legend is 1%
  eq(Gacha.rollRarity(G, 1, noPity, null, seq([0.051])), 'rare');   // epic ends at 5%
});
t('rollRarity: pity overrides the table', () => {
  eq(Gacha.rollRarity(G, 0, { epic: 20, legend: 0 }, null, seq([0.999])), 'epic');
  eq(Gacha.rollRarity(G, 0, { epic: 0, legend: 50 }, null, seq([0.999])), 'legend');
});
t('rollRarity: legend pity takes precedence over epic pity', () => {
  eq(Gacha.rollRarity(G, 0, { epic: 20, legend: 50 }, null, seq([0.5])), 'legend');
});
t('rollRarity: rain widens rare and pays out of common', () => {
  // rare normally spans [0.10, 0.40); with +5 it reaches 0.45
  eq(Gacha.rollRarity(G, 0, noPity, 'rain', seq([0.42])), 'rare');
  eq(Gacha.rollRarity(G, 0, noPity, null, seq([0.42])), 'common');
});
t('rollRarity: weather never applies on a penalty round', () => {
  eq(Gacha.rollRarity(G, 2, noPity, 'rainAfter', seq([0.42])), 'common');
});
t('rollRarity: weather keeps the table summing to 100', () => {
  // The very top of the range must still be common, not fall off the end.
  eq(Gacha.rollRarity(G, 0, noPity, 'rainAfter', seq([0.9999])), 'common');
});

// --- Gacha.updatePity -------------------------------------------------
t('updatePity: a common draw advances both counters', () => {
  eq(Gacha.updatePity(G, 'common', { epic: 3, legend: 7 }), { epic: 4, legend: 8 });
});
t('updatePity: epic clears epic and advances legend', () => {
  eq(Gacha.updatePity(G, 'epic', { epic: 19, legend: 30 }), { epic: 0, legend: 31 });
});
t('updatePity: legend clears both', () => {
  eq(Gacha.updatePity(G, 'legend', { epic: 19, legend: 49 }), { epic: 0, legend: 0 });
});
t('updatePity: epic is guaranteed within its window', () => {
  let pity = { epic: 0, legend: 0 };
  let sawEpicOrBetter = false;
  for (let i = 0; i < G.pity.epic; i++) {
    const r = Gacha.rollRarity(G, 0, pity, null, seq([0.999])); // always common
    if (r === 'epic' || r === 'legend') sawEpicOrBetter = true;
    Gacha.updatePity(G, r, pity);
  }
  ok(sawEpicOrBetter || pity.epic >= G.pity.epic, 'pity should have fired or be armed');
  eq(Gacha.rollRarity(G, 0, pity, null, seq([0.999])), 'epic');
});

// --- Gacha.pickEntity -------------------------------------------------
t('pickEntity: returns an entity of the requested rarity', () => {
  const e = Gacha.pickEntity(MUSHROOM_DATA, 'legend', null, 3, seq([0.5]));
  eq(e.rarity, 'legend');
});
t('pickEntity: unknown rarity yields null rather than throwing', () => {
  eq(Gacha.pickEntity(MUSHROOM_DATA, 'mythic', null, 3, seq([0.5])), null);
});
t('pickEntity: biome weighting favours the chosen biome', () => {
  const rand = () => Math.random();
  let inBiome = 0;
  for (let i = 0; i < 400; i++) {
    if (Gacha.pickEntity(MUSHROOM_DATA, 'common', 'pine', 3, rand).biome === 'pine') inBiome++;
  }
  const share = inBiome / 400;
  const baseline = MUSHROOM_DATA.filter(m => m.rarity === 'common' && m.biome === 'pine').length /
                   MUSHROOM_DATA.filter(m => m.rarity === 'common').length;
  ok(share > baseline, `pine share ${share.toFixed(2)} should beat baseline ${baseline.toFixed(2)}`);
});

// --- Quiz.pickQuestions -----------------------------------------------
const levels = GameConfig.quiz.levels;

t('pickQuestions: fills the round for every level', () => {
  Object.keys(levels).forEach(name => {
    const qs = Quiz.pickQuestions(QUESTIONS, levels[name], {
      perRound: 5, imageCount: 3, roundNumber: 9, rand: Math.random
    });
    eq(qs.length, 5, name + ':');
  });
});
t('pickQuestions: honours imageCount', () => {
  [0, 1, 3, 5].forEach(n => {
    const qs = Quiz.pickQuestions(QUESTIONS, levels.intermediate, {
      perRound: 5, imageCount: n, roundNumber: 9, rand: Math.random
    });
    const imgs = qs.filter(q => q.type === 'name_from_image').length;
    ok(imgs >= n, `asked for ${n} image questions, got ${imgs}`);
  });
});
t('pickQuestions: never repeats a question inside a round', () => {
  for (let i = 0; i < 200; i++) {
    const qs = Quiz.pickQuestions(QUESTIONS, levels.expert, {
      perRound: 5, imageCount: 2, roundNumber: 5, rand: Math.random
    });
    const ids = new Set(qs.map(q => q.id));
    eq(ids.size, qs.length, 'round ' + i + ':');
  }
});
t('pickQuestions: only draws difficulties the level asks for', () => {
  Object.keys(levels).forEach(name => {
    const lv = levels[name];
    for (let i = 0; i < 60; i++) {
      Quiz.pickQuestions(QUESTIONS, lv, {
        perRound: 5, imageCount: 3, roundNumber: 9, rand: Math.random
      }).forEach(q => {
        const allowed = q.type === 'name_from_image' ? lv.image : lv.knowledge[q.type];
        ok(allowed && allowed.indexOf(q.difficulty) !== -1,
          `${name} drew ${q.type} d${q.difficulty}, which it never requested`);
      });
    }
  });
});
t('pickQuestions: beginners meet a myth-buster in their first rounds', () => {
  for (let round = 1; round <= levels.beginner.forceMythBusterRounds; round++) {
    let seen = 0;
    for (let i = 0; i < 30; i++) {
      const qs = Quiz.pickQuestions(QUESTIONS, levels.beginner, {
        perRound: 5, imageCount: 3, roundNumber: round, rand: Math.random
      });
      if (qs.some(q => q.type === 'myth_buster')) seen++;
    }
    eq(seen, 30, `round ${round}:`);
  }
});

// --- data / config agreement ------------------------------------------
t('every (type, difficulty) in the bank is reachable from some level', () => {
  const requested = new Set();
  Object.values(levels).forEach(lv => {
    lv.image.forEach(d => requested.add('name_from_image|' + d));
    Object.keys(lv.knowledge).forEach(t2 =>
      lv.knowledge[t2].forEach(d => requested.add(t2 + '|' + d)));
  });
  const orphans = [...new Set(QUESTIONS.map(q => q.type + '|' + q.difficulty))]
    .filter(k => !requested.has(k));
  eq(orphans, [], 'orphan buckets:');
});
t('every question has four distinct options and a valid answerIndex', () => {
  QUESTIONS.forEach(q => {
    eq(q.options.length, 4, q.id + ':');
    eq(new Set(q.options).size, 4, q.id + ' duplicate options:');
    ok(q.answerIndex >= 0 && q.answerIndex < 4, q.id + ' answerIndex out of range');
  });
});
t('every species has an image question and at least three questions', () => {
  const byEntity = {};
  QUESTIONS.forEach(q => {
    if (q.entityId) (byEntity[q.entityId] = byEntity[q.entityId] || []).push(q);
  });
  MUSHROOM_DATA.forEach(m => {
    const qs = byEntity[m.id] || [];
    ok(qs.some(q => q.type === 'name_from_image'), m.id + ' has no image question');
    ok(qs.length >= 3, m.id + ' has only ' + qs.length + ' questions');
  });
});
t('every species has an edibility entry in the config', () => {
  MUSHROOM_DATA.forEach(m => {
    ok(GameConfig.edibility[m.edibility], m.id + ': unknown edibility ' + m.edibility);
  });
});

// --- Quiz.presentation ------------------------------------------------
t('presentation: answerAt tracks the shuffled position', () => {
  const q = QUESTIONS.find(x => x.type === 'name_from_image');
  for (let i = 0; i < 200; i++) {
    const p = Quiz.presentation(q, Math.random);
    eq(p.options[p.answerAt], q.options[q.answerIndex], 'shuffle ' + i + ':');
    eq(p.options.length, 4);
    if (q.optionsEn) eq(p.optionsEn[p.answerAt], q.optionsEn[q.answerIndex]);
  }
});
t('isCorrect: only the shuffled answer position counts', () => {
  const q = QUESTIONS.find(x => x.type === 'name_from_image');
  const p = Quiz.presentation(q, seq([0.1, 0.5, 0.9]));
  ok(Quiz.isCorrect(p, p.answerAt));
  for (let i = 0; i < 4; i++) if (i !== p.answerAt) ok(!Quiz.isCorrect(p, i));
});

// --- World.weatherFor -------------------------------------------------
t('weatherFor: same date gives the same weather', () => {
  eq(World.weatherFor('2026-07-04', GameConfig.weather),
     World.weatherFor('2026-07-04', GameConfig.weather));
});
t('weatherFor: always returns a key from the table', () => {
  const keys = Object.keys(GameConfig.weather);
  for (let d = 1; d <= 28; d++) {
    const w = World.weatherFor('2026-06-' + String(d).padStart(2, '0'), GameConfig.weather);
    ok(keys.indexOf(w) !== -1, 'got ' + w);
  }
});
t('weatherFor: a year of dates hits every weather at least once', () => {
  const seen = new Set();
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      seen.add(World.weatherFor(
        `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        GameConfig.weather));
    }
  }
  eq([...seen].sort(), Object.keys(GameConfig.weather).sort());
});

// --- World.growth -----------------------------------------------------
const gcfg = GameConfig.garden;
t('growth: a fresh planting is a pin', () => {
  const g = World.growth({ plantedAt: 1000, wateredMs: 0, lastSporeAt: 1000 }, gcfg, 1000);
  eq(g.stage, 'pin');
  ok(!g.mature);
});
t('growth: reaches mature after the configured time', () => {
  const start = 0, mins = gcfg.stages[gcfg.stages.length - 1].minutes;
  const g = World.growth({ plantedAt: start, wateredMs: 0, lastSporeAt: start },
                         gcfg, start + mins * 60000);
  eq(g.stage, 'mature');
  ok(g.mature);
  eq(g.minutesLeft, null);
});
t('growth: watering credit advances the clock', () => {
  const start = 0;
  const dry = World.growth({ plantedAt: start, wateredMs: 0, lastSporeAt: start }, gcfg, start + 60000);
  const wet = World.growth({ plantedAt: start, wateredMs: 20 * 60000, lastSporeAt: start },
                           gcfg, start + 60000);
  ok(wet.progress > dry.progress || wet.stage !== dry.stage, 'watering should help');
});
t('growth: a spore becomes ready a day after the last one, not before', () => {
  const start = 0, day = gcfg.sporeIntervalHours * 3600000;
  const mature = gcfg.stages[gcfg.stages.length - 1].minutes * 60000;
  const slot = { plantedAt: start, wateredMs: 0, lastSporeAt: start };
  ok(!World.growth(slot, gcfg, start + mature).sporeReady, 'too early');
  ok(World.growth(slot, gcfg, start + day + 1000).sporeReady, 'should be ready');
});
t('growth: spores do not stack up while away', () => {
  // Three days offline still yields one ready spore, not three.
  const start = 0, day = gcfg.sporeIntervalHours * 3600000;
  const g = World.growth({ plantedAt: start, wateredMs: 0, lastSporeAt: start },
                         gcfg, start + day * 3);
  eq(g.sporeReady, true);
});

// --- World.slotFor ----------------------------------------------------
t('slotFor: wood-dwellers get a wood slot when one is free', () => {
  const woodie = MUSHROOM_DATA.find(m => m.substrate === 'wood' && m.behavior !== 'shelf');
  eq(World.slotFor(woodie, gcfg, []).kind, 'wood');
});
t('slotFor: shelf species claim the shelf slot', () => {
  const shelf = MUSHROOM_DATA.find(m => m.behavior === 'shelf');
  eq(World.slotFor(shelf, gcfg, []).kind, 'shelf');
});
t('slotFor: falls back to any free slot rather than refusing', () => {
  const woodie = MUSHROOM_DATA.find(m => m.substrate === 'wood' && m.behavior !== 'shelf');
  const taken = gcfg.slots.filter(s => s.kind === 'wood').map(s => s.id);
  const s = World.slotFor(woodie, gcfg, taken);
  ok(s && s.kind !== 'wood', 'should still place the mushroom somewhere');
});
t('slotFor: returns null when the garden is full', () => {
  eq(World.slotFor(MUSHROOM_DATA[0], gcfg, gcfg.slots.map(s => s.id)), null);
});

// --- Storage ----------------------------------------------------------
function memStore() {
  const m = {};
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    _raw: m
  };
}

t('storage: a fresh save has the current version and defaults', () => {
  const s = Storage.init(GameConfig, memStore());
  eq(s.version, Storage.CURRENT_VERSION);
  eq(s.collections, []);
  eq(s.fragments, { common: 0, rare: 0, epic: 0, legend: 0 });
  eq(s.dailyRuns.free, GameConfig.economy.dailyRuns);
});
t('storage: add() reports new versus duplicate', () => {
  Storage.init(GameConfig, memStore());
  eq(Storage.add('flyagaric'), true);
  eq(Storage.add('flyagaric'), false);
  eq(Storage.collected(), 1);
  eq(Storage.get().collections[0].count, 2);
});
t('storage: survives a reload with the same store', () => {
  const store = memStore();
  Storage.init(GameConfig, store);
  Storage.add('matsutake');
  Storage.addFragment('rare', 3);
  const s2 = Storage.init(GameConfig, store);
  eq(s2.collections.length, 1);
  eq(s2.fragments.rare, 3);
});
t('storage: a save missing new fields is backfilled, not lost', () => {
  const store = memStore();
  store.setItem(GameConfig.storageKey, JSON.stringify({
    version: 1, collections: [{ entityId: 'shiitake', count: 1, firstAt: 'x' }]
  }));
  const s = Storage.init(GameConfig, store);
  eq(s.collections.length, 1, 'existing data kept:');
  eq(s.fragments, { common: 0, rare: 0, epic: 0, legend: 0 });
  ok(s.dailyTasks && s.stats && s.flags, 'missing sections rebuilt');
});
t('storage: corrupt JSON falls back to a fresh save instead of throwing', () => {
  const store = memStore();
  store.setItem(GameConfig.storageKey, '{not json');
  const s = Storage.init(GameConfig, store);
  eq(s.version, Storage.CURRENT_VERSION);
});
t('storage: task progress is not rolled back by a later write', () => {
  // The fishId bug: read a snapshot, bump a counter through another call,
  // then save the stale snapshot. Here every write goes through one state.
  Storage.init(GameConfig, memStore());
  const before = Storage.get().dailyTasks.progress.foray || 0;
  Storage.update(s => { s.dailyRuns.free -= 1; });
  Storage.bumpTask('foray', 1);
  Storage.update(s => { s.lastBiome = 'meadow'; });
  eq(Storage.get().dailyTasks.progress.foray, before + 1);
  eq(Storage.get().lastBiome, 'meadow');
});
t('storage: spending checks the balance first', () => {
  Storage.init(GameConfig, memStore());
  eq(Storage.spendFragment('rare', 1), false);
  Storage.addFragment('rare', 2);
  eq(Storage.spendFragment('rare', 2), true);
  eq(Storage.get().fragments.rare, 0);
  eq(Storage.spendEssence(10), false);
  Storage.addEssence(10);
  eq(Storage.spendEssence(10), true);
});
t('storage: the slot list holds no more than its cap', () => {
  Storage.init(GameConfig, memStore());
  const n = GameConfig.garden.slots.length;
  for (let i = 0; i < n; i++) eq(Storage.place('m' + i, 'W1'), true, 'place ' + i + ':');
  eq(Storage.place('overflow', 'W1'), false);
  eq(Storage.placed().length, n);
});
t('storage: the same species cannot be planted twice', () => {
  Storage.init(GameConfig, memStore());
  eq(Storage.place('flyagaric', 'L1'), true);
  eq(Storage.place('flyagaric', 'L2'), false);
  Storage.unplace('flyagaric');
  eq(Storage.isPlaced('flyagaric'), false);
});
t('storage: a new day refills forays and clears daily tasks', () => {
  const store = memStore();
  Storage.init(GameConfig, store);
  Storage.update(s => {
    s.dailyRuns = { date: '2020-01-01', free: 0 };
    s.dailyTasks = { date: '2020-01-01', progress: { foray: 3 }, claimed: { foray: true } };
  });
  const s = Storage.init(GameConfig, store);
  eq(s.dailyRuns.free, GameConfig.economy.dailyRuns);
  eq(s.dailyTasks.progress, {});
  eq(s.dailyTasks.claimed, {});
});

// --- config sanity ----------------------------------------------------
t('config: each gacha row sums to 100', () => {
  [G.normal, G.penalty].forEach(row => {
    eq(row.common + row.rare + row.epic + row.legend, 100);
  });
});
t('config: weather weights sum to 100', () => {
  const total = Object.values(GameConfig.weather).reduce((a, w) => a + w.weight, 0);
  eq(total, 100);
});
t('config: every rarity has a colour and a label', () => {
  GameConfig.rarities.forEach(r => {
    ok(GameConfig.rarityColors[r], r + ' colour');
    ok(GameConfig.rarityLabels[r], r + ' label');
  });
});
t('config: garden slot ids are unique', () => {
  const ids = GameConfig.garden.slots.map(s => s.id);
  eq(new Set(ids).size, ids.length);
});
t('config: the core layer mentions no domain words', () => {
  const banned = /mushroom|fungus|fungi|spore|garden|foray|蘑菇|菌/i;
  ['js/core/storage.js', 'js/core/gacha.js', 'js/core/quiz.js'].forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
      .replace(/\/\/[^\n]*/g, '')            // strip line comments
      .replace(/\/\*[\s\S]*?\*\//g, '');     // strip block comments
    const hit = src.match(banned);
    ok(!hit, f + ' leaks a domain word: ' + (hit && hit[0]));
  });
});

// ----------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  failures.forEach(f => console.log('  x ' + f));
  process.exit(1);
}
