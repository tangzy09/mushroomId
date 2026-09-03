// Question selection and round state. Knows nothing about mushrooms:
// questions carry an entityId, and the caller supplies a lookup.

var Quiz = (function () {
  /** All questions matching a (type, difficulty-range) request. */
  function bucket(questions, type, diffs) {
    return questions.filter(function (q) {
      return q.type === type && diffs.indexOf(q.difficulty) !== -1;
    });
  }

  function shuffled(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * Choose the questions for one round.
   *
   * Slots 1..imageCount are image questions; the rest are drawn from the
   * level's knowledge pool. Within a round no question repeats and, where
   * the pool allows, no entity repeats either.
   *
   * @param {Array}  questions   the whole bank
   * @param {object} level       GameConfig.quiz.levels[x]
   * @param {object} opts        {perRound, imageCount, roundNumber, rand}
   */
  function pickQuestions(questions, level, opts) {
    opts = opts || {};
    var perRound = opts.perRound || 5;
    var imageCount = Math.max(0, Math.min(perRound, opts.imageCount == null ? 3 : opts.imageCount));
    var rand = opts.rand || Math.random;
    var picked = [], usedIds = {}, usedEntities = {};

    function take(pool) {
      // Prefer a question about an entity this round has not used yet.
      var fresh = pool.filter(function (q) {
        return !usedIds[q.id] && (!q.entityId || !usedEntities[q.entityId]);
      });
      var relaxed = pool.filter(function (q) { return !usedIds[q.id]; });
      var from = fresh.length ? fresh : relaxed;
      if (!from.length) return false;
      var q = from[Math.floor(rand() * from.length)];
      usedIds[q.id] = true;
      if (q.entityId) usedEntities[q.entityId] = true;
      picked.push(q);
      return true;
    }

    var imagePool = bucket(questions, 'name_from_image', level.image);
    for (var i = 0; i < imageCount; i++) take(imagePool);

    // The beginner level owes new players a myth-buster in early rounds:
    // "no folk test tells you whether a mushroom is safe" is the single
    // most important thing this game has to teach.
    var forced = level.forceMythBusterRounds || 0;
    if (forced && opts.roundNumber && opts.roundNumber <= forced &&
        level.knowledge.myth_buster && picked.length < perRound) {
      take(bucket(questions, 'myth_buster', level.knowledge.myth_buster));
    }

    var knowledgePool = [];
    Object.keys(level.knowledge).forEach(function (type) {
      knowledgePool = knowledgePool.concat(bucket(questions, type, level.knowledge[type]));
    });
    // Rotate through the requested types so one huge bucket cannot crowd
    // the others out of a round.
    var types = shuffled(Object.keys(level.knowledge), rand);
    var guard = 0;
    while (picked.length < perRound && guard < 200) {
      guard++;
      var type = types[(picked.length + guard) % types.length];
      if (!take(bucket(questions, type, level.knowledge[type]))) {
        if (!take(knowledgePool)) break;
      }
    }
    // Last resort: an under-filled round is worse than a repeated type.
    guard = 0;
    while (picked.length < perRound && guard < 200) {
      guard++;
      if (!take(imagePool) && !take(knowledgePool)) break;
    }
    return picked;
  }

  /** Present a question with its options in a stable, shuffled order. */
  function presentation(q, rand) {
    rand = rand || Math.random;
    var idx = q.options.map(function (_, i) { return i; });
    for (var i = idx.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return {
      question: q,
      order: idx,
      options: idx.map(function (i) { return q.options[i]; }),
      optionsEn: q.optionsEn ? idx.map(function (i) { return q.optionsEn[i]; }) : null,
      answerAt: idx.indexOf(q.answerIndex)
    };
  }

  function isCorrect(pres, chosen) { return chosen === pres.answerAt; }

  return {
    pickQuestions: pickQuestions,
    presentation: presentation,
    isCorrect: isCorrect,
    _bucket: bucket
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Quiz;
