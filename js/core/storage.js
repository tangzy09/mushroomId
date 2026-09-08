// Save data. One in-memory copy, explicit commits, versioned migrations.
//
// fishId reloaded and re-serialised the whole save on every access, which
// let a stale snapshot overwrite a fresh write and silently roll daily
// task progress back. Here the state is read once, mutated in place, and
// written by commit(); nothing hands out a detached copy to save later.

var Storage = (function () {
  var CURRENT_VERSION = 1;
  var cfg = null;      // set by init()
  var state = null;

  // Migrations run in order until the save reaches CURRENT_VERSION.
  // Add one per schema change; never edit an existing entry.
  var MIGRATIONS = {
    // 1: shape of the first release — nothing to migrate into yet.
  };

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function thisHour() { return today() + 'T' + new Date().getHours(); }

  function defaults() {
    var e = cfg.economy;
    return {
      version: CURRENT_VERSION,
      userId: 'u_' + Math.random().toString(36).slice(2, 9),
      createdAt: new Date().toISOString(),
      collections: [],                 // [{entityId, count, firstAt}]
      observations: [],                // [{oid, entityId, date:'YYYY-MM-DD', place, note, ts}]
      mastery: {},                     // {entityId: 0..3} — only picture questions move this
      lastQuiz: {},                    // {entityId: 'YYYY-MM-DD'} — last time a picture question ran, for decay
      wrong: [],                       // [entityId], no duplicates — answered wrong at least once, not since fixed
      slots: [],                       // [{id, slot, placedAt, lastYieldAt, boostMs}]
      fragments: { common: 0, rare: 0, epic: 0, legend: 0 },
      fragmentEssence: 0,
      pityCount: { epic: 0, legend: 0 },
      dailyRuns: { date: '', free: e.dailyRuns },
      hourlyActions: { hour: '', count: e.actionsPerHour },
      lastBasket: '',
      bonusBaskets: 0,
      lastBiome: 'pine',
      lastSeen: Date.now(),
      stats: { totalQuestions: 0, correctAnswers: 0, playDays: 1, toxicIdentified: 0 },
      flags: { milestones: [], safetyCardSeen: false, lastPlayDate: today() },
      difficulty: 'beginner',
      imageCount: cfg.quiz.defaultImageCount,
      usedCodes: [],
      dailyTasks: { date: '', progress: {}, claimed: {} }
    };
  }

  function migrate(data) {
    var v = data.version || 0;
    while (v < CURRENT_VERSION) {
      v += 1;
      if (MIGRATIONS[v]) MIGRATIONS[v](data);
      data.version = v;
    }
    return data;
  }

  /** Fill in fields added since this save was written. */
  function backfill(data) {
    var d = defaults();
    Object.keys(d).forEach(function (k) {
      if (data[k] === undefined || data[k] === null) data[k] = d[k];
    });
    Object.keys(d.stats).forEach(function (k) {
      if (typeof data.stats[k] !== 'number') data.stats[k] = d.stats[k];
    });
    ['milestones'].forEach(function (k) {
      if (!Array.isArray(data.flags[k])) data.flags[k] = [];
    });
    cfg.rarities.forEach(function (r) {
      if (typeof data.fragments[r] !== 'number') data.fragments[r] = 0;
    });
    return data;
  }

  var DAY_MS = 24 * 60 * 60 * 1000;
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / DAY_MS); }

  /** A star not reviewed in 30 days quietly comes back down, one at a time.
   *  Resets the clock to today so it does not decay again tomorrow. */
  function decayMastery(data, t) {
    Object.keys(data.mastery).forEach(function (id) {
      if (data.mastery[id] <= 0) return;
      var last = data.lastQuiz[id];
      if (last && daysBetween(last, t) > 30) {
        data.mastery[id] -= 1;
        data.lastQuiz[id] = t;
      }
    });
  }

  /** Daily and hourly resets. Returns true if anything changed. */
  function rollover(data) {
    var t = today(), changed = false;
    if (data.dailyRuns.date !== t) {
      data.dailyRuns = { date: t, free: cfg.economy.dailyRuns };
      changed = true;
      decayMastery(data, t);
    }
    if (data.hourlyActions.hour !== thisHour()) {
      data.hourlyActions = { hour: thisHour(), count: cfg.economy.actionsPerHour };
      changed = true;
    }
    if (data.dailyTasks.date !== t) {
      data.dailyTasks = { date: t, progress: {}, claimed: {} };
      changed = true;
    }
    if (data.flags.lastPlayDate !== t) {
      data.flags.lastPlayDate = t;
      data.stats.playDays = (data.stats.playDays || 0) + 1;
      changed = true;
    }
    return changed;
  }

  var api = {
    init: function (config, storageImpl) {
      cfg = config;
      this._store = storageImpl || (typeof localStorage !== 'undefined' ? localStorage : null);
      var raw = null, loaded = null;
      try { raw = this._store && this._store.getItem(cfg.storageKey); } catch (e) { raw = null; }
      if (raw) {
        try { loaded = JSON.parse(raw); } catch (e) { loaded = null; }
      }
      state = loaded;                 // never inherit the previous session
      state = backfill(migrate(state || defaults()));
      rollover(state);
      this.commit();
      return state;
    },

    /** The live state object. Mutate it, then commit(). */
    get: function () { return state; },

    commit: function () {
      try {
        this._store && this._store.setItem(cfg.storageKey, JSON.stringify(state));
      } catch (e) { /* private mode, quota — the session still works */ }
      return state;
    },

    /** Mutate and persist in one step, so no caller holds a stale copy. */
    update: function (fn) {
      var r = fn(state);
      this.commit();
      return r;
    },

    today: today,
    thisHour: thisHour,

    // --- collection ---------------------------------------------------
    has: function (id) {
      return state.collections.some(function (c) { return c.entityId === id; });
    },
    collected: function () { return state.collections.length; },
    add: function (id) {
      var found = null;
      state.collections.forEach(function (c) { if (c.entityId === id) found = c; });
      if (found) { found.count += 1; this.commit(); return false; }
      state.collections.push({ entityId: id, count: 1, firstAt: new Date().toISOString() });
      this.commit();
      return true;                    // true means it was new
    },

    // --- spores and humus ---------------------------------------------
    addFragment: function (rarity, n) {
      state.fragments[rarity] = (state.fragments[rarity] || 0) + (n || 1);
      this.commit();
    },
    spendFragment: function (rarity, n) {
      if ((state.fragments[rarity] || 0) < n) return false;
      state.fragments[rarity] -= n;
      this.commit();
      return true;
    },
    addEssence: function (n) {
      state.fragmentEssence += n;
      this.commit();
    },
    spendEssence: function (n) {
      if (state.fragmentEssence < n) return false;
      state.fragmentEssence -= n;
      this.commit();
      return true;
    },

    // --- display slots ---------------------------------------------------
    placed: function () { return state.slots; },
    isPlaced: function (id) {
      return state.slots.some(function (s) { return s.id === id; });
    },
    place: function (id, slot) {
      if (this.isPlaced(id)) return false;
      if (state.slots.length >= cfg.slots.max) return false;
      // These three field names are the growth machine's whole input; the
      // reader lives in the domain layer and once looked for different ones,
      // which left every mushroom frozen at its first stage. core.test.js
      // builds a record here and feeds it to the reader to keep them in step.
      state.slots.push({
        id: id, slot: slot, placedAt: Date.now(),
        lastYieldAt: Date.now(), boostMs: 0
      });
      this.commit();
      return true;
    },
    unplace: function (id) {
      state.slots = state.slots.filter(function (s) { return s.id !== id; });
      this.commit();
    },

    // --- field notes -----------------------------------------------------
    // A record of "I actually saw this one, here, on this day" — separate
    // from `collections` (which tracks the collecting minigame). One entity
    // can have many of these over time; each is edited or removed on its own.
    observationsFor: function (id) {
      return state.observations.filter(function (o) { return o.entityId === id; });
    },
    allObservations: function () {
      return state.observations.slice().sort(function (a, b) { return b.ts - a.ts; });
    },
    addObservation: function (id, fields) {
      var rec = {
        oid: 'o_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        entityId: id, date: today(), place: '', note: '', ts: Date.now()
      };
      Object.assign(rec, fields || {});
      state.observations.push(rec);
      this.commit();
      return rec;
    },
    updateObservation: function (oid, fields) {
      var rec = null;
      state.observations.forEach(function (o) { if (o.oid === oid) rec = o; });
      if (!rec) return null;
      Object.assign(rec, fields);
      this.commit();
      return rec;
    },
    deleteObservation: function (oid) {
      var before = state.observations.length;
      state.observations = state.observations.filter(function (o) { return o.oid !== oid; });
      this.commit();
      return state.observations.length !== before;
    },

    // --- practice ---------------------------------------------------------
    // Proficiency is a picture-recognition signal only (per the design note:
    // "熟练度只记看图题" — a right/wrong on a text trivia question says nothing
    // about whether someone can pick the thing out of a crowd). markQuizzed
    // resets the 30-day decay clock; call it whenever a picture question about
    // that entity is answered, right or wrong.
    masteryFor: function (id) { return state.mastery[id] || 0; },
    bumpMastery: function (id, delta) {
      var v = (state.mastery[id] || 0) + delta;
      state.mastery[id] = Math.max(0, Math.min(3, v));
      this.commit();
    },
    markQuizzed: function (id) {
      state.lastQuiz[id] = today();
      this.commit();
    },
    wrongList: function () { return state.wrong.slice(); },
    addWrong: function (id) {
      if (state.wrong.indexOf(id) === -1) { state.wrong.push(id); this.commit(); }
    },
    removeWrong: function (id) {
      var i = state.wrong.indexOf(id);
      if (i !== -1) { state.wrong.splice(i, 1); this.commit(); }
    },

    // --- counters ------------------------------------------------------
    recordQuiz: function (total, correct) {
      state.stats.totalQuestions += total;
      state.stats.correctAnswers += correct;
      this.commit();
    },
    bumpTask: function (taskId, n) {
      var p = state.dailyTasks.progress;
      p[taskId] = (p[taskId] || 0) + (n || 1);
      this.commit();
    },
    reset: function () {
      state = defaults();
      this.commit();
      return state;
    },

    _defaults: defaults,
    _migrate: migrate,
    _rollover: rollover,
    CURRENT_VERSION: CURRENT_VERSION
  };
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Storage;
