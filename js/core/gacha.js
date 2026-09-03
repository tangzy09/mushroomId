// Draw logic: rarity roll, pity counters, entity pick.
// Entirely domain-agnostic — it knows only rarity strings and a config.

var Gacha = (function () {
  /**
   * Roll a rarity.
   * @param {object} cfg      GameConfig.gacha
   * @param {number} wrong    wrong answers this round
   * @param {object} pity     {epic, legend} counters
   * @param {string} weather  optional weather key for the modifier table
   * @param {function} rand   optional [0,1) source, for tests
   */
  function rollRarity(cfg, wrong, pity, weather, rand) {
    rand = rand || Math.random;

    // Pity wins over the table: it is the promise the UI makes to players.
    if (pity && pity.legend >= cfg.pity.legend) return 'legend';
    if (pity && pity.epic >= cfg.pity.epic) return 'epic';

    var table = wrong > 0 ? cfg.penalty : cfg.normal;
    var w = { common: table.common, rare: table.rare, epic: table.epic, legend: table.legend };

    // Weather nudges the good rows up and pays for it out of common,
    // so the distribution still sums to 100 and pity pacing is untouched.
    var mod = wrong === 0 && weather && cfg.weatherMod ? cfg.weatherMod[weather] : null;
    if (mod) {
      Object.keys(mod).forEach(function (k) {
        var give = Math.min(mod[k], w.common);
        w[k] += give;
        w.common -= give;
      });
    }

    var total = w.common + w.rare + w.epic + w.legend;
    var roll = rand() * total;
    var acc = 0;
    var order = ['legend', 'epic', 'rare', 'common'];
    for (var i = 0; i < order.length; i++) {
      acc += w[order[i]];
      if (roll < acc) return order[i];
    }
    return 'common';
  }

  /** Advance or clear pity counters after a draw. Mutates and returns pity. */
  function updatePity(cfg, rarity, pity) {
    if (rarity === 'legend') { pity.epic = 0; pity.legend = 0; }
    else if (rarity === 'epic') { pity.epic = 0; pity.legend += 1; }
    else { pity.epic += 1; pity.legend += 1; }
    return pity;
  }

  /**
   * Pick one entity of the given rarity, favouring the chosen biome.
   * Falls back to the whole rarity pool when the biome has none.
   */
  function pickEntity(entities, rarity, biome, biomeWeight, rand) {
    rand = rand || Math.random;
    var pool = entities.filter(function (e) { return e.rarity === rarity; });
    if (!pool.length) return null;

    var weights = pool.map(function (e) {
      return biome && e.biome === biome ? (biomeWeight || 3) : 1;
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = rand() * total, acc = 0;
    for (var i = 0; i < pool.length; i++) {
      acc += weights[i];
      if (roll < acc) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /** Weighted pick of a rarity for loose spores, using the normal row. */
  function rollFragmentRarity(cfg, rand) {
    rand = rand || Math.random;
    var t = cfg.normal;
    var total = t.common + t.rare + t.epic + t.legend;
    var roll = rand() * total, acc = 0;
    var order = ['legend', 'epic', 'rare', 'common'];
    for (var i = 0; i < order.length; i++) {
      acc += t[order[i]];
      if (roll < acc) return order[i];
    }
    return 'common';
  }

  return {
    rollRarity: rollRarity,
    updatePity: updatePity,
    pickEntity: pickEntity,
    rollFragmentRarity: rollFragmentRarity
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Gacha;
