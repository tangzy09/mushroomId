// Weather and growth. Both are pure functions of a date string or a
// timestamp, so every player sees the same sky on the same day and the
// garden can be advanced without a background timer.

var World = (function () {
  /** Deterministic hash of a date string -> today's weather key. */
  function weatherFor(dateStr, table) {
    var h = 0;
    for (var i = 0; i < dateStr.length; i++) {
      h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
    }
    var keys = Object.keys(table);
    var total = keys.reduce(function (a, k) { return a + table[k].weight; }, 0);
    var roll = h % total, acc = 0;
    for (var j = 0; j < keys.length; j++) {
      acc += table[keys[j]].weight;
      if (roll < acc) return keys[j];
    }
    return keys[0];
  }

  /** How much one watering is worth, in milliseconds of growth. */
  function waterBoostMs(cfg) {
    var full = cfg.stages[cfg.stages.length - 1].minutes;
    return full * (cfg.waterBoostPercent / 100) * 60000;
  }

  /** When a slot planted at `placedAt` with `boostMs` of watering matures. */
  function maturesAt(slot, cfg) {
    var full = cfg.stages[cfg.stages.length - 1].minutes * 60000;
    return slot.placedAt + full - (slot.boostMs || 0);
  }

  /**
   * Growth state of one planted slot.
   *
   * Reads the record that Storage.place writes — placedAt / boostMs /
   * lastYieldAt. Three earlier names here (plantedAt / wateredMs /
   * lastSporeAt) matched nothing on disk, so every reading came out NaN and
   * every mushroom in the game sat at 'pin' forever, watering did nothing
   * and no slot ever produced a spore. Keep these names in step with
   * Storage.place; core.test.js pins them together.
   *
   * Pure in `now`, so a player who closes the tab for three days comes back
   * to the right stage with no background timer and nothing to replay.
   */
  function growth(slot, cfg, now) {
    now = now == null ? Date.now() : now;   // `|| ` would treat now=0 as "unset"
    var minutes = (now - slot.placedAt + (slot.boostMs || 0)) / 60000;
    var stages = cfg.stages;
    var stage = stages[0], next = null;
    for (var i = 0; i < stages.length; i++) {
      if (minutes >= stages[i].minutes) { stage = stages[i]; next = stages[i + 1] || null; }
    }
    var progress = 1;
    if (next) {
      var span = next.minutes - stage.minutes;
      progress = span > 0 ? Math.min(1, (minutes - stage.minutes) / span) : 1;
    }
    var mature = stage.id === stages[stages.length - 1].id;

    // The yield clock starts at maturity, or at the last collection if that
    // came later. One ready spore at a time — being away longer earns no more.
    var yieldMs = cfg.yieldHours * 3600000;
    var since = Math.max(maturesAt(slot, cfg), slot.lastYieldAt || 0);
    var msToSpore = mature ? Math.max(0, since + yieldMs - now) : null;
    var sporeReady = mature && msToSpore === 0;

    return {
      stage: sporeReady ? cfg.sporulate.id : stage.id,
      label: sporeReady ? cfg.sporulate.label : stage.label,
      // 'sporulate' draws like a mature mushroom; this is what art should use.
      drawStage: stage.id,
      progress: progress,
      mature: mature,
      sporeReady: sporeReady,
      // Minutes until the next growth stage, or null once mature.
      minutesLeft: next ? Math.max(0, next.minutes - minutes) : null,
      // Minutes until the next spore, or null while still growing.
      sporeMinutesLeft: msToSpore == null ? null : msToSpore / 60000
    };
  }

  /** Which garden slot a species should occupy, given what is free. */
  function slotFor(entity, cfg, taken) {
    var wants = entity.behavior === 'shelf' ? 'shelf'
      : entity.substrate === 'wood' ? 'wood'
      : (entity.substrate === 'insect' || entity.substrate === 'parasitic' ||
         entity.biome === 'special') ? 'special'
      : 'ground';
    var free = cfg.slots.filter(function (s) { return taken.indexOf(s.id) === -1; });
    var match = free.filter(function (s) { return s.kind === wants; });
    // A mushroom in an imperfect spot beats a mushroom you cannot plant.
    return (match[0] || free[0] || null);
  }

  function humanMinutes(m) {
    if (m == null) return '';
    if (m < 1) return '不到 1 分钟';
    if (m < 60) return Math.ceil(m) + ' 分钟';
    var h = Math.floor(m / 60), r = Math.ceil(m % 60);
    return h + ' 小时' + (r ? ' ' + r + ' 分钟' : '');
  }

  return {
    weatherFor: weatherFor,
    growth: growth,
    maturesAt: maturesAt,
    waterBoostMs: waterBoostMs,
    slotFor: slotFor,
    humanMinutes: humanMinutes
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = World;
