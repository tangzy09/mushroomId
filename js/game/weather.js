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

  /**
   * Growth state of one planted slot.
   * Elapsed real time plus watering credit decides the stage, so a player
   * who closes the tab still comes back to a grown mushroom.
   */
  function growth(slot, cfg, now) {
    now = now || Date.now();
    var minutes = (now - slot.plantedAt) / 60000 + (slot.wateredMs || 0) / 60000;
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
    var sporeReady = mature &&
      (now - (slot.lastSporeAt || slot.plantedAt)) >= cfg.sporeIntervalHours * 3600000;
    return {
      stage: stage.id,
      label: stage.label,
      progress: progress,
      mature: mature,
      sporeReady: sporeReady,
      // Minutes until the next stage, or null once mature.
      minutesLeft: next ? Math.max(0, next.minutes - minutes) : null
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
    slotFor: slotFor,
    humanMinutes: humanMinutes
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = World;
