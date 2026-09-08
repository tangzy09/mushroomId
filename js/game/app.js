// Glue: routing, page rendering, event wiring. The rules live in
// js/core/; this file only connects them to the DOM.

(function () {
  'use strict';

  // Language must be settled before anything reads a label, or the engine
  // is up and every locale is registered while the screen still shows the
  // wrong one — a real failure mode, not a hypothetical one.
  I18N.setLang(I18N.detect(), { persist: false });
  GameConfig.retag(I18N.lang());
  // Static data-i18n markup must be stamped in before any boot-time render
  // (deep links can call renderDetail/renderProfile before this line ends) —
  // running this any later would clobber real content with the placeholder
  // text still sitting in index.html's data-i18n elements.
  I18N.applyDom();

  var C = GameConfig;
  var byId = {};
  MUSHROOM_DATA.forEach(function (m) { byId[m.id] = m; });

  // English idKeys/habitat/fact/quote/lookalikeNotes live in js/i18n_en.gen.js
  // (build_data.py strips them out of data.gen.js so Chinese-only users don't
  // download 85 KB of text they'll never see), keyed by species id — same
  // lookup-by-id shape as PHOTO_CREDITS/PHOTO_EXTRA, not merged onto MUSHROOM_DATA.
  function enOf(id) { return (typeof I18N_EN !== 'undefined' && I18N_EN[id]) || {}; }

  // the last milestone is the whole collection, whatever its size. Appended
  // at runtime (after MUSHROOM_DATA loads), so it sits outside config.js's
  // retag snapshot — its title has to be kept in sync by hand on every
  // language switch (see the #set-lang handler below).
  C.milestones = C.milestones.concat([
    { n: MUSHROOM_DATA.length, title: I18N.lang() === 'en' ? 'Mycologist' : '菌物学家', icon: '🔬' }
  ]);

  var S = Storage.init(C);
  // 数据里下线过物种（2026-09-08 去掉 15 个无照片种）。旧存档里指向它们的收集与园位
  // 要清掉，否则 byId 查不到会在菌菇园与「我的」里抛异常。
  (function pruneGone() {
    var before = S.collections.length + S.slots.length + S.observations.length;
    S.collections = S.collections.filter(function (c) { return !!byId[c.entityId]; });
    S.slots = S.slots.filter(function (s) { return !!byId[s.id]; });
    S.observations = S.observations.filter(function (o) { return !!byId[o.entityId]; });
    if (S.collections.length + S.slots.length + S.observations.length !== before) Storage.commit();
  })();
  var today = Storage.today();
  var weather = World.weatherFor(today, C.weather);

  var $ = function (id) { return document.getElementById(id); };
  var round = null;          // active quiz round

  // ---------------------------------------------------------------- utils
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('on'); }, 2000);
  }

  function sheet(html, onOpen) {
    $('sheet').innerHTML = html;
    $('overlay').classList.add('on');
    if (onOpen) onOpen($('sheet'));
  }
  function closeSheet() { $('overlay').classList.remove('on'); }
  $('overlay').addEventListener('click', function (e) {
    if (e.target === $('overlay')) closeSheet();
  });

  function drawnArt(sp, px, opts) {
    var cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    var c = cv.getContext('2d');
    var base = px * 0.93, size = px * 0.82;
    // Tall species used to run off the top of the box. Shrink whatever does
    // not fit rather than clipping its cap.
    var room = base - px * 0.04;
    var h = ShroomArt.heightOf(sp) * size;
    if (h > room) size *= room / h;
    c.translate(px / 2, base);
    ShroomArt.draw(c, sp, size, opts || { stage: 'mature' });
    return cv;
  }

  // Every one of the 166 species has a real photograph (the 15 without one were
  // dropped on 2026-09-08). Non-mature growth stages still keep the drawn
  // form, which is not a stopgap: a drawing can show the volva and the ring
  // that photographs of those species happen to miss.
  function hasPhoto(sp) {
    return typeof PHOTO_CREDITS !== 'undefined' && !!PHOTO_CREDITS[sp.id];
  }

  function art(sp, px, opts) {
    // Growth stages other than mature only exist as drawings.
    var stage = (opts && opts.stage) || 'mature';
    if (!hasPhoto(sp) || stage !== 'mature') return drawnArt(sp, px, opts);
    var im = document.createElement('img');
    im.className = 'sp-photo';
    im.width = px; im.height = px;
    im.loading = 'lazy';
    im.alt = sp.name;
    im.src = 'assets/photos/' + (px <= 96 ? 'thumb' : 'real') + '/' + sp.id + '.webp';
    // A missing or broken file falls back to the drawing rather than a gap.
    im.addEventListener('error', function () {
      if (im.parentNode) im.parentNode.replaceChild(drawnArt(sp, px, opts), im);
    });
    return im;
  }

  // cc-by and cc-by-sa both require the credit to be shown wherever the photo
  // is. This goes under the detail-page image; nowhere else shows a big one.
  function photoCredit(sp) {
    if (!hasPhoto(sp)) return null;
    var c = PHOTO_CREDITS[sp.id];
    var d = document.createElement('div');
    d.className = 'photo-credit';
    // iNat 的 attribution 本身就写着 "(CC BY)"，再拼一次 license 会重复成
    // 「… (CC BY) · CC-BY」。只有原文里认不出授权时才补。
    var who = (c.by || '').replace(/\s*\/\s*(CC0|CC-BY(-SA)?|PD)\s*$/i, '').trim();
    var lic = /\b(CC0|CC[ -]BY|public domain)\b/i.test(who)
      ? '' : ' · ' + esc((c.license || '').toUpperCase());
    // CC0 / 公有领域的记录 iNat 写成 "no rights reserved"，界面上直说
    if (/^(no rights reserved|public domain)$/i.test(who)) { who = I18N.t('photo.publicDomain'); lic = ' · ' + esc((c.license || 'CC0').toUpperCase()); }
    d.innerHTML = I18N.t('photo.credit', { who: esc(who) }) + lic +
      (c.url ? ' · <a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + I18N.t('photo.source') + '</a>' : '');
    return d;
  }

  // 全屏看图：黑底、原图、双指缩放靠浏览器（touch-action: pinch-zoom）。点一下关。
  function openLightbox(src, alt) {
    var lb = $('lightbox');
    if (!lb) return;
    var im = lb.querySelector('img');
    im.src = src; im.alt = alt || '';
    lb.classList.add('on');
  }

  // 补图：关键特征在主图上看不到时用（菌托、菌褶、切面）。PHOTO_EXTRA 是生成物，可能不存在。
  function extraPhotos(m) {
    return (typeof PHOTO_EXTRA !== 'undefined' && PHOTO_EXTRA[m.id]) || [];
  }
  function extraCreditEl(ex) {
    var d = document.createElement('div');
    d.className = 'photo-credit';
    var who = (ex.by || '').replace(/\s*\/\s*(CC0|CC-BY(-SA)?|PD)\s*$/i, '').trim();
    var lic = /\b(CC0|CC[ -]BY|public domain)\b/i.test(who) ? '' : ' · ' + esc((ex.license || '').toUpperCase());
    if (/^(no rights reserved|public domain)$/i.test(who)) { who = I18N.t('photo.publicDomain'); lic = ' · ' + esc((ex.license || 'CC0').toUpperCase()); }
    d.innerHTML = I18N.t('photo.credit', { who: esc(who) }) + lic +
      (ex.url ? ' · <a href="' + esc(ex.url) + '" target="_blank" rel="noopener">' + I18N.t('photo.source') + '</a>' : '');
    return d;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function rarityColor(r) { return C.rarityColors[r]; }

  function drawArtAt(c, sp, size) { ShroomArt.draw(c, sp, size, { stage: 'mature' }); }

  // 分享卡优先用真实照片；照片拿不到（无照片 / 离线没缓存）就回退绘制，
  // 两条路都走 entityCard，只是 opts 不同。署名跟着照片一起进卡。
  function shareCredit(sp) {
    if (!hasPhoto(sp)) return '';
    var c = PHOTO_CREDITS[sp.id];
    var who = (c.by || '').replace(/\s*\/\s*(CC0|CC-BY(-SA)?|PD)\s*$/i, '').trim();
    var lic = /\b(CC0|CC[ -]BY|public domain)\b/i.test(who) ? '' : ' · ' + (c.license || '').toUpperCase();
    return I18N.t('photo.credit', { who: who }) + lic;
  }

  function loadPhoto(sp) {
    return new Promise(function (resolve) {
      if (!hasPhoto(sp)) { resolve(null); return; }
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = 'assets/photos/real/' + sp.id + '.webp';
    });
  }

  function shareEntity(sp) {
    loadPhoto(sp).then(function (photo) {
      var card = Share.entityCard(sp, C, drawArtAt, { photo: photo, credit: shareCredit(sp) });
      return Share.offer(card, C, I18N.t('share.identified', { name: I18N.pick(sp.name, sp.nameEn) }) + C.share.footer);
    }).then(function (how) {
      if (how === 'downloaded') toast(I18N.t('toast.cardSaved'));
      else if (how === 'failed') toast(I18N.t('toast.shareFailed'));
    });
  }

  // ---------------------------------------------------------------- router
  // 栈式：根 tab 用 root()，进子页用 go()，返回用 back()。
  // show() 只负责把某页画出来，不动栈——popstate 回来时也走它。
  var ROOTS = { collection: 1, profile: 1 };
  var stack = [{ page: 'collection' }];
  var page = 'collection';

  function show(id, arg) {
    page = id;
    ['garden', 'collection', 'profile', 'biome', 'quiz', 'reveal', 'detail', 'observations', 'training']
      .forEach(function (p) {
        var el = $('page-' + p);
        if (el) el.classList.toggle('active', p === id);
      });
    $('nav').style.display = ROOTS[id] ? 'flex' : 'none';
    Array.prototype.forEach.call($('nav').children, function (b) {
      b.classList.toggle('on', b.dataset.page === id);
    });
    if (id === 'garden') { Garden.refresh(Storage.get()); Garden.start(); }
    else Garden.stop();
    if (id === 'collection') renderCollection();
    if (id === 'profile') renderProfile();
    if (id === 'detail' && arg && byId[arg]) renderDetail(byId[arg]);
    if (id === 'observations') renderObservations();
    if (id === 'training') renderTraining();
  }
  function root(id) {
    stack = [{ page: id }];
    history.replaceState({ depth: 1, page: id }, '');
    show(id);
  }
  function go(id, arg) {
    stack.push({ page: id, arg: arg });
    history.pushState({ depth: stack.length, page: id, arg: arg }, '');
    show(id, arg);
  }
  function back() {
    if (stack.length > 1) history.back();
    else root('collection');
  }
  // 回到栈里最近的某一页（reveal 的「回菌菇园」用）
  function backTo(id) {
    var i = stack.length - 1;
    while (i > 0 && stack[i].page !== id) i--;
    if (i === stack.length - 1) { show(stack[i].page, stack[i].arg); return; }
    var steps = stack.length - 1 - i;
    stack.length = i + 1;
    history.go(-steps);
  }
  window.addEventListener('popstate', function (e) {
    var d = (e.state && e.state.depth) || 1;
    while (stack.length > d && stack.length > 1) stack.pop();
    if (e.state && e.state.page) stack[stack.length - 1] = { page: e.state.page, arg: e.state.arg };
    var top = stack[stack.length - 1];
    show(top.page, top.arg);
  });
  window.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-back]');
    if (b) back();
  });
  Array.prototype.forEach.call($('nav').children, function (b) {
    b.addEventListener('click', function () { root(b.dataset.page); });
  });

  // ---------------------------------------------------------------- garden
  $('safety-bar').textContent = C.safety.banner;
  $('safety-bar-2').textContent = C.safety.banner;
  // 横幅永不消失，但首开弹窗确认过之后收成一行（点一下展开）；每屏两行 + 弹窗是三遍同一句话
  (function compactBanners() {
    var seen = false;
    try { seen = !!localStorage.getItem(C.storageKeys.disclaimer); } catch (e) {}
    ['safety-bar', 'safety-bar-2'].forEach(function (id) {
      var el = $(id);
      el.classList.toggle('compact', seen);
      el.addEventListener('click', function () { el.classList.toggle('compact'); });
    });
    window.compactSafetyBars = function () {
      ['safety-bar', 'safety-bar-2'].forEach(function (id) { $(id).classList.add('compact'); });
    };
  })();

  // ---------------------------------------------------------------- language
  function setLangCurrentLabel() {
    var el = $('lang-current');
    if (el) el.textContent = I18N.NATIVE[I18N.lang()];
  }
  function relanguage(code) {
    I18N.setLang(code);
    GameConfig.retag(I18N.lang());
    // The final milestone is appended at runtime (see above) and sits
    // outside config.js's retag snapshot, so it needs a manual re-sync here.
    C.milestones[C.milestones.length - 1].title = I18N.lang() === 'en' ? 'Mycologist' : '菌物学家';
    I18N.applyDom();
    $('safety-bar').textContent = C.safety.banner;
    $('safety-bar-2').textContent = C.safety.banner;
    document.title = I18N.t('meta.appName');
    setLangCurrentLabel();
    var top = stack[stack.length - 1];
    show(top.page, top.arg);
  }
  $('set-lang').addEventListener('click', function () {
    sheet('<h2>' + I18N.t('settings.chooseLanguage') + '</h2>' +
      I18N.SUPPORTED.map(function (code) {
        return '<button class="row lang-opt" data-lang="' + code + '" style="width:100%;text-align:left;background:none;border:none;padding:0">' +
          '<span class="lbl">' + I18N.NATIVE[code] + '</span><span class="spacer"></span>' +
          (I18N.lang() === code ? '<span class="chev">✓</span>' : '') +
          '</button>';
      }).join(''),
      function (el) {
        Array.prototype.forEach.call(el.querySelectorAll('.lang-opt'), function (b) {
          b.addEventListener('click', function () {
            relanguage(b.dataset.lang);
            closeSheet();
          });
        });
      });
  });
  setLangCurrentLabel();

  function refreshGardenChrome() {
    var st = Storage.get();
    $('chip-weather').textContent = C.weather[weather].label;
    $('chip-count').textContent = I18N.t('garden.collected', { n: Storage.collected(), total: MUSHROOM_DATA.length });
    $('foray-left').textContent = '(' + st.dailyRuns.free + ')';

    // Spores waiting is the reason a player opens the app on day two, so it
    // is stated up front rather than left for them to spot on the canvas.
    var ready = st.slots.filter(function (sl) {
      return World.growth(sl, C.garden).sporeReady;
    }).length;
    var chip = $('chip-spores');
    chip.hidden = ready === 0;
    chip.textContent = I18N.t('garden.sporesWaiting', { n: ready });
  }

  Browse.init({ data: MUSHROOM_DATA, C: C, art: art, openDetail: openDetail, $: $ });
  Garden.init($('garden-canvas'), C, byId, Storage.get());
  Garden.setWeather(weather);
  Garden.onTap(function (sp, item) {
    var g = World.growth(item.rec, C.garden);
    if (g.sporeReady) {
      item.rec.lastYieldAt = Date.now();
      Storage.addFragment(sp.rarity, 1);
      Storage.commit();
      Garden.harvested(item);
      toast(I18N.t('toast.gotFragment', { rarity: C.rarityLabels[sp.rarity] }));
      refreshGardenChrome();
    }
  });
  $('garden-canvas').addEventListener('pointerdown', function (e) {
    var r = this.getBoundingClientRect();
    Garden.tap(e.clientX - r.left, e.clientY - r.top);
  });

  var pressTimer = null;
  $('garden-canvas').addEventListener('pointerdown', function () {
    pressTimer = setTimeout(function () { Garden.toggleNight(); }, 800);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    $('garden-canvas').addEventListener(ev, function () { clearTimeout(pressTimer); });
  });

  $('btn-share-garden').addEventListener('click', function () {
    Share.offer(Share.sceneCard($('garden-canvas'), C,
      I18N.t('garden.shareCaption', { n: Storage.collected(), total: MUSHROOM_DATA.length })), C,
      I18N.t('garden.shareText'))
      .then(function (how) { if (how === 'downloaded') toast(I18N.t('toast.savedToDownloads')); });
  });
  $('btn-night').addEventListener('click', function () { Garden.toggleNight(); });
  $('btn-wind').addEventListener('click', function () { Garden.gust(); });
  $('btn-water').addEventListener('click', function () {
    var st = Storage.get();
    if (st.hourlyActions.count <= 0) { toast(I18N.t('toast.outOfWaterThisHour')); return; }
    Storage.update(function (s) {
      s.hourlyActions.count -= 1;
      var boost = World.waterBoostMs(C.garden);
      s.slots.forEach(function (sl) {
        sl.boostMs = (sl.boostMs || 0) + boost;
      });
    });
    Storage.bumpTask('water', 1);
    Garden.water();
    toast(I18N.t('toast.watered'));
  });

  // shake to make wind
  if (window.DeviceMotionEvent) {
    var last = 0;
    window.addEventListener('devicemotion', function (e) {
      var a = e.accelerationIncludingGravity;
      if (!a) return;
      var m = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
      if (m > 32 && Date.now() - last > 1200) { last = Date.now(); Garden.gust(); }
    });
  }

  // ---------------------------------------------------------------- foray
  $('btn-foray').addEventListener('click', function () {
    var st = Storage.get();
    if (st.dailyRuns.free <= 0) { toast(I18N.t('toast.outOfForaysToday')); return; }
    renderBiomes();
    go('biome');
  });

  var chosenBiome = Storage.get().lastBiome || 'pine';
  function renderBiomes() {
    var g = $('biome-grid');
    g.innerHTML = '';
    Object.keys(C.biomes).forEach(function (k) {
      var b = C.biomes[k];
      var el = document.createElement('button');
      el.className = 'biome' + (k === chosenBiome ? ' on' : '');
      el.innerHTML = '<b>' + b.label + '</b><span>' + b.desc + '</span>';
      el.addEventListener('click', function () {
        chosenBiome = k;
        renderBiomes();
      });
      g.appendChild(el);
    });
  }

  $('btn-go').addEventListener('click', function () {
    var st = Storage.get();
    if (st.dailyRuns.free <= 0) { toast(I18N.t('toast.outOfForays')); return; }
    Storage.update(function (s) {
      s.dailyRuns.free -= 1;
      s.lastBiome = chosenBiome;
    });
    Storage.bumpTask('foray', 1);
    refreshGardenChrome();

    $('foray-text').textContent = C.biomes[chosenBiome].label.replace(/^\S+\s/, '') +
      ' · ' + C.weather[weather].label;
    $('foray-anim').classList.add('on');
    ensureQuestions(function () {
    startRound();
    setTimeout(function () {
      $('foray-anim').classList.remove('on');
      go('quiz');
      showQuestion();
    }, 1600);
    });
  });

  // ---------------------------------------------------------------- quiz
  // 题库 250 KB 单独成文件，进答题时才注入；版本戳跟 data.gen.js 的 script 标签走
  function ensureQuestions(cb) {
    if (typeof QUESTIONS !== 'undefined') { cb(); return; }
    var ref = document.querySelector('script[src*="data.gen.js"]');
    var v = ref && /\?v=([^&]+)/.exec(ref.getAttribute('src'));
    var s = document.createElement('script');
    s.src = 'js/questions.gen.js' + (v ? '?v=' + v[1] : '');
    s.onload = function () { if (typeof QUESTIONS !== 'undefined') cb(); else toast(I18N.t('toast.questionBankFailed')); };
    s.onerror = function () { toast(I18N.t('toast.questionBankFailedRetry')); };
    document.head.appendChild(s);
  }

  function startRound() {
    var st = Storage.get();
    var level = C.quiz.levels[st.difficulty] || C.quiz.levels.beginner;
    round = {
      mode: 'gacha',
      level: level,
      questions: Quiz.pickQuestions(QUESTIONS, level, {
        perRound: C.quiz.perRound,
        imageCount: st.imageCount,
        roundNumber: (st.stats.totalQuestions / C.quiz.perRound | 0) + 1
      }),
      idx: 0, correct: 0, wrong: 0, toxicHit: false
    };
  }

  // ---------------------------------------------------------------- training
  // Quiz is downgraded to a tool here: no card, no reward, just the same
  // question/answer machinery pointed at a different, smaller pool. Reusing
  // showQuestion()/answer() means a "mode" can be nothing more than which
  // questions were picked and what happens when the round ends.
  function startTrainingRound(questions, opts) {
    round = {
      mode: 'training', label: (opts && opts.label) || I18N.t('training.generic'),
      onDone: opts && opts.onDone,
      questions: questions, idx: 0, correct: 0, wrong: 0, toxicHit: false
    };
    go('quiz');
    showQuestion();
  }

  function imageQuestionsFor(ids, take) {
    var pool = QUESTIONS.filter(function (q) {
      return q.type === 'name_from_image' && ids.indexOf(q.entityId) >= 0;
    });
    return shuffledCopy(pool).slice(0, take || pool.length);
  }

  function shuffledCopy(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Every entry point that reads QUESTIONS goes through ensureQuestions first —
  // a session that goes straight to training without ever foraying once
  // would otherwise hit QUESTIONS as an undefined global.
  function startSingleQuiz(m) {
    ensureQuestions(function () {
      // The picture question goes first and is never shuffled out — a
      // field guide's "quick test" that skips the one question shaped like
      // "is this what you think it is" would be a strange omission.
      var pool = QUESTIONS.filter(function (q) { return q.entityId === m.id; });
      var img = pool.filter(function (q) { return q.type === 'name_from_image'; });
      var rest = shuffledCopy(pool.filter(function (q) { return q.type !== 'name_from_image'; }));
      var qs = img.concat(rest).slice(0, 5);
      if (!qs.length) { toast(I18N.t('toast.noQuestionsForSpecies')); return; }
      startTrainingRound(qs, { label: I18N.pick(m.name, m.nameEn) + I18N.t('training.quickTestSuffix') });
    });
  }

  // "范围闪卡": whatever the field guide's current filter turned up, quizzed
  // as pictures. Reads Browse's live result set, not a snapshot — the whole
  // point is "test me on what I'm looking at right now".
  function startScopedFlashcards() {
    ensureQuestions(function () {
      var ids = Browse._facet ? Browse._facet().results().map(function (m) { return m.id; }) : [];
      var qs = imageQuestionsFor(ids, C.quiz.perRound);
      if (!qs.length) { toast(I18N.t('toast.filterCollectionFirst')); return; }
      startTrainingRound(qs, { label: I18N.t('training.flashcards') });
    });
  }

  // "易混对决": two options only — the species and its closest lookalike —
  // built on the fly rather than pulled from the bank, because the bank's
  // questions were never shaped like this.
  function duelQuestion(a) {
    var pool = (a.lookalikes || []).map(function (id) { return byId[id]; }).filter(Boolean);
    if (!pool.length) return null;
    var b = pool[Math.floor(Math.random() * pool.length)];
    var diff = (a.lookalikeNotes && a.lookalikeNotes[b.id]) ||
      (b.lookalikeNotes && b.lookalikeNotes[a.id]) ||
      (b.idKeys && b.idKeys[0] && b.idKeys[0].text) || '';
    var aFirst = Math.random() < 0.5;
    var aName = I18N.pick(a.name, a.nameEn), bName = I18N.pick(b.name, b.nameEn);
    var options = aFirst ? [aName, bName] : [bName, aName];
    return {
      id: 'duel-' + a.id + '-' + b.id, type: 'lookalike_duel', entityId: a.id,
      q: I18N.t('training.whichOne'), options: options, answerIndex: aFirst ? 0 : 1,
      explanation: diff
    };
  }
  function startDuelQuiz() {
    var candidates = MUSHROOM_DATA.filter(function (m) { return m.lookalikes && m.lookalikes.length; });
    var qs = [], tries = 0;
    while (qs.length < C.quiz.perRound && tries < candidates.length * 3) {
      tries++;
      var a = candidates[Math.floor(Math.random() * candidates.length)];
      if (qs.some(function (q) { return q.entityId === a.id; })) continue;
      var q = duelQuestion(a);
      if (q) qs.push(q);
    }
    if (!qs.length) { toast(I18N.t('toast.noDuelPairsYet')); return; }
    startTrainingRound(qs, { label: I18N.t('training.duel') });
  }

  // "每日 5 题": lowest score first — high mastery and species already seen
  // in real life both push a species toward the back of the line.
  function dailyFiveIds() {
    var st = Storage.get();
    return MUSHROOM_DATA
      .map(function (m) {
        var seen = Storage.has(m.id) || Storage.observationsFor(m.id).length > 0;
        var score = Storage.masteryFor(m.id) * 10 - (seen ? 3 : 0) + Math.random();
        return { id: m.id, score: score };
      })
      .sort(function (x, y) { return x.score - y.score; })
      .slice(0, C.quiz.perRound)
      .map(function (x) { return x.id; });
  }
  function startDailyFive() {
    ensureQuestions(function () {
      var qs = imageQuestionsFor(dailyFiveIds());
      if (!qs.length) { toast(I18N.t('toast.questionBankNotReady')); return; }
      startTrainingRound(qs, { label: I18N.t('training.dailyFive') });
    });
  }

  function startWrongBook() {
    var ids = Storage.wrongList();
    if (!ids.length) { toast(I18N.t('toast.wrongBookEmpty')); return; }
    ensureQuestions(function () {
      var qs = imageQuestionsFor(ids, ids.length);
      if (!qs.length) qs = shuffledCopy(QUESTIONS.filter(function (q) { return ids.indexOf(q.entityId) >= 0; })).slice(0, ids.length);
      if (!qs.length) { toast(I18N.t('toast.wrongBookQuestionsMissing')); return; }
      startTrainingRound(qs, { label: I18N.t('training.wrongBook') });
    });
  }

  // A stable pick that changes once a day, not once a page load.
  function todaysPick() {
    var d = Storage.today();
    var h = 0;
    for (var i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
    return MUSHROOM_DATA[h % MUSHROOM_DATA.length];
  }

  function renderTraining() {
    var host = $('training-body');
    host.innerHTML = '';

    var pick = todaysPick();
    var todayCard = document.createElement('div');
    todayCard.className = 'card';
    todayCard.innerHTML = '<h2>' + I18N.t('training.pickOfTheDay') + '</h2>';
    var row = document.createElement('div');
    row.className = 'row';
    var thumb = document.createElement('span');
    thumb.className = 'tp-thumb';
    thumb.appendChild(art(pick, 56));
    row.appendChild(thumb);
    var info = document.createElement('span');
    info.style.flex = '1';
    info.innerHTML = '<b>' + esc(I18N.pick(pick.name, pick.nameEn)) + '</b><br><span class="muted" style="font-size:12px">' + esc(pick.latin) + '</span>';
    row.appendChild(info);
    todayCard.appendChild(row);
    var goBtn = document.createElement('button');
    goBtn.className = 'btn wide';
    goBtn.style.marginTop = '10px';
    goBtn.textContent = I18N.t('training.goTest');
    goBtn.addEventListener('click', function () { startSingleQuiz(pick); });
    todayCard.appendChild(goBtn);
    host.appendChild(todayCard);

    var wrongN = Storage.wrongList().length;
    [
      { label: I18N.t('training.flashcards'), desc: I18N.t('training.flashcardsDesc'), fn: startScopedFlashcards, icon: '🗂️' },
      { label: I18N.t('training.duel'), desc: I18N.t('training.duelDesc'), fn: startDuelQuiz, icon: '⚔️' },
      { label: I18N.t('training.dailyFive'), desc: I18N.t('training.dailyFiveDesc'), fn: startDailyFive, icon: '📅' },
      { label: I18N.t('training.wrongBook'), desc: wrongN ? I18N.t('training.wrongBookCount', { n: wrongN }) : I18N.t('training.wrongBookEmptyGood'), fn: startWrongBook, icon: '📕' }
    ].forEach(function (m) {
      var card = document.createElement('button');
      card.className = 'card entry-card';
      card.innerHTML = '<span class="ico">' + m.icon + '</span>' +
        '<span class="entry-text"><b>' + esc(m.label) + '</b><span class="muted">' + esc(m.desc) + '</span></span>' +
        '<span class="chev">›</span>';
      card.addEventListener('click', m.fn);
      host.appendChild(card);
    });
  }

  var tick = null;
  function showQuestion() {
    clearInterval(tick);
    var q = round.questions[round.idx];
    var pres = Quiz.presentation(q);
    round.pres = pres;
    round.answered = false;

    $('quiz-title').textContent = round.mode === 'training' ? round.label : I18N.t('quiz.title');
    $('quiz-idx').textContent = (round.idx + 1) + ' / ' + round.questions.length;
    $('quiz-bar').style.width = (round.idx / round.questions.length * 100) + '%';
    $('q-explain').innerHTML = '';

    // The picture is the species itself, drawn from its characters.
    var artBox = $('q-art');
    artBox.innerHTML = '';
    if (q.entityId && byId[q.entityId]) {
      artBox.appendChild(art(byId[q.entityId], 210));
      artBox.style.display = 'grid';
    } else {
      artBox.style.display = 'none';
    }

    // name_from_image is the one question type whose prompt is a fixed
    // template rather than per-question authored content, so it is the one
    // type this pass can translate outright; the other 900-odd bank
    // questions (feature/lookalike/edibility_class/trivia/cold_fact/
    // myth_buster + curated) are still Chinese-only — see CLAUDE.md.
    $('q-text').textContent = q.type === 'name_from_image' ? I18N.t('quiz.whichMushroom') : q.q;
    // English options for name_from_image were baked in at build time
    // (optionsEn); other types show only what the bank has.
    var showEn = I18N.lang() === 'en' && pres.optionsEn;
    var box = $('q-opts');
    box.innerHTML = '';
    pres.options.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = showEn ? '<span>' + esc(pres.optionsEn[i]) + '</span>' : '<span>' + opt + '</span>';
      b.addEventListener('click', function () { answer(i); });
      box.appendChild(b);
    });

    var left = C.quiz.timerSec;
    $('timer-bar').style.width = '100%';
    $('timer-wrap').classList.remove('low');
    tick = setInterval(function () {
      left -= 0.1;
      $('timer-bar').style.width = Math.max(0, left / C.quiz.timerSec * 100) + '%';
      $('timer-wrap').classList.toggle('low', left <= 5);
      if (left <= 0) { clearInterval(tick); answer(-1); }
    }, 100);
  }

  function answer(choice) {
    if (round.answered) return;
    round.answered = true;
    clearInterval(tick);

    var pres = round.pres, q = pres.question;
    var right = choice === pres.answerAt;
    if (right) round.correct++; else round.wrong++;

    // The wrong book tracks any question type; proficiency only moves for
    // "can you pick it out of a crowd" questions (image-based, real or duel).
    if (q.entityId) {
      if (right) Storage.removeWrong(q.entityId);
      else Storage.addWrong(q.entityId);
      if (q.type === 'name_from_image' || q.type === 'lookalike_duel') {
        Storage.markQuizzed(q.entityId);
        Storage.bumpMastery(q.entityId, right ? 1 : -1);
      }
    }

    // Getting a poisonous species right is the daily task worth having.
    if (right && (q.type === 'edibility_class' || q.type === 'lookalike')) {
      var ent = byId[q.entityId];
      var answerText = q.options[q.answerIndex];
      if ((ent && (ent.edibility === 'poisonous' || ent.edibility === 'deadly')) ||
          /有毒|剧毒/.test(answerText)) {
        round.toxicHit = true;
      }
    }

    Array.prototype.forEach.call($('q-opts').children, function (b, i) {
      b.disabled = true;
      if (i === pres.answerAt) b.classList.add('right');
      else if (i === choice) b.classList.add('wrong');
    });

    var ex = $('q-explain');
    var parts = [];
    if (choice === -1) parts.push('<b>' + I18N.t('quiz.timeUp') + '</b>');
    if (q.explanation) parts.push(q.explanation);
    var ent2 = q.entityId && byId[q.entityId];
    if (ent2) {
      var ed = C.edibility[ent2.edibility];
      parts.push('<span class="tag">' + esc(I18N.pick(ent2.name, ent2.nameEn)) + '</span>：' + esc(I18N.pick(ent2.fact, enOf(ent2.id).factEn)));
      parts.push('<span class="edib" style="background:' + ed.color + '">' + ed.label + '</span> ' +
        '<span class="edib-note">' + ed.note + '</span>');
    }
    ex.innerHTML = '<div class="explain">' + parts.join('<br>') +
      (q.disclaimer ? '<div class="disclaimer-note">' + I18N.t('quiz.disclaimerNote') + '</div>' : '') +
      '</div>';

    var next = document.createElement('button');
    next.className = 'btn wide';
    next.style.marginTop = '12px';
    var isLast = round.idx + 1 >= round.questions.length;
    next.textContent = !isLast ? I18N.t('quiz.nextQuestion') : (round.mode === 'training' ? I18N.t('quiz.seeResults') : I18N.t('quiz.seeWhatYouFound'));
    next.addEventListener('click', advance);
    ex.appendChild(next);
    next.scrollIntoView({ block: 'nearest' });
  }

  function advance() {
    // A double tap on this button used to run the draw twice and hand out
    // two cards for one round.
    if (!round || round.done) return;
    round.idx++;
    if (round.idx < round.questions.length) { showQuestion(); return; }
    round.done = true;
    clearInterval(tick);
    $('q-opts').innerHTML = '';
    $('q-explain').innerHTML = '';
    Storage.recordQuiz(round.questions.length, round.correct);
    Storage.bumpTask('correct', round.correct);
    if (round.toxicHit) {
      Storage.bumpTask('toxic', 1);
      Storage.update(function (s) { s.stats.toxicIdentified += 1; });
    }
    if (round.mode === 'training') {
      var onDone = round.onDone, correct = round.correct, total = round.questions.length;
      back();
      toast(I18N.t('toast.roundScore', { correct: correct, total: total }));
      if (onDone) onDone();
      return;
    }
    doDraw();
  }

  // ---------------------------------------------------------------- draw
  function doDraw() {
    var st = Storage.get();
    var body = $('reveal-body'), actions = $('reveal-actions');
    actions.innerHTML = '';

    if (round.wrong >= C.gacha.fragmentThreshold) {
      var r = Gacha.rollFragmentRarity(C.gacha);
      Storage.addFragment(r, 1);
      body.innerHTML =
        '<h2 style="margin-top:26px">' + I18N.t('reveal.sporesOnlyTitle') + '</h2>' +
        '<p class="muted">' + I18N.t('reveal.sporesOnlyBody', { n: round.wrong }) + '</p>' +
        '<div class="res" style="display:inline-flex;margin-top:10px">' +
        '<i style="background:' + rarityColor(r) + '"></i>' +
        C.rarityLabels[r] + I18N.t('common.fragmentSuffixX1') + '</div>' +
        '<p class="muted" style="margin-top:14px">' + I18N.t('reveal.synthHint') + '</p>';
      addBtn(actions, I18N.t('reveal.backToGarden'), 'btn wide', function () { backTo('garden'); refreshGardenChrome(); });
      go('reveal');
      return;
    }

    var rarity = Gacha.rollRarity(C.gacha, round.wrong, st.pityCount, weather);
    Gacha.updatePity(C.gacha, rarity, st.pityCount);
    Storage.commit();
    var sp = Gacha.pickEntity(MUSHROOM_DATA, rarity, chosenBiome, C.biomeWeight);
    if (!sp) { backTo('garden'); return; }

    var isNew = !Storage.has(sp.id);
    Storage.add(sp.id);
    if (round.correct === C.quiz.perRound) {
      Storage.addFragment(rarity, 1);
    }
    renderReveal(sp, isNew, round.correct === C.quiz.perRound);
    go('reveal');
  }

  function addBtn(parent, text, cls, fn) {
    var b = document.createElement('button');
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', fn);
    parent.appendChild(b);
    return b;
  }

  function renderReveal(sp, isNew, perfect) {
    var ed = C.edibility[sp.edibility];
    var deadly = sp.edibility === 'deadly';
    var body = $('reveal-body'), actions = $('reveal-actions');

    body.innerHTML = '';
    var banner = document.createElement('div');
    banner.className = 'rarity-banner';
    banner.style.background = rarityColor(sp.rarity);
    banner.style.color = sp.rarity === 'legend' ? '#3A2E00' : '#fff';
    banner.textContent = deadly ? I18N.t('reveal.deadlyBanner')
      : C.rarityLabels[sp.rarity] + (isNew ? I18N.t('reveal.newSuffix') : I18N.t('reveal.dupeSuffix'));
    body.appendChild(banner);

    body.appendChild(art(sp, 190));

    var h = document.createElement('h2');
    h.textContent = I18N.pick(sp.name, sp.nameEn);
    body.appendChild(h);
    var la = document.createElement('div');
    la.className = 'latin';
    la.textContent = sp.latin;
    body.appendChild(la);

    var e = document.createElement('div');
    e.className = 'edib';
    e.style.background = ed.color;
    e.textContent = ed.label;
    body.appendChild(e);
    var en = document.createElement('div');
    en.className = 'edib-note';
    en.textContent = ed.note;
    body.appendChild(en);

    var q = document.createElement('p');
    q.className = 'quote';
    q.textContent = I18N.t('common.quoteOpen') + I18N.pick(sp.quote, enOf(sp.id).quoteEn) + I18N.t('common.quoteClose');
    body.appendChild(q);

    var f = document.createElement('p');
    f.className = 'muted';
    f.style.maxWidth = '30em';
    f.style.margin = '0 auto';
    f.textContent = I18N.pick(sp.fact, enOf(sp.id).factEn);
    body.appendChild(f);

    if (perfect) {
      var pf = document.createElement('p');
      pf.style.color = 'var(--accent)';
      pf.style.fontWeight = '600';
      pf.textContent = I18N.t('reveal.perfectBonus', { rarity: C.rarityLabels[sp.rarity] });
      body.appendChild(pf);
    }

    actions.innerHTML = '';
    if (isNew) {
      var full = Storage.placed().length >= C.slots.max;
      addBtn(actions, full ? I18N.t('garden.full') : I18N.t('garden.plant'), 'btn wide', function () {
        var slot = World.slotFor(sp, C.garden, Storage.placed().map(function (s) { return s.slot; }));
        if (!slot) { toast(I18N.t('toast.gardenFullRemoveOne')); return; }
        Storage.place(sp.id, slot.id);
        checkMilestone();
        backTo('garden');
        refreshGardenChrome();
      }).disabled = full;
      if (full) {
        addBtn(actions, I18N.t('reveal.keepInGuide'), 'btn ghost wide', function () {
          checkMilestone(); backTo('garden'); refreshGardenChrome();
        });
      }
      addBtn(actions, '📤', 'btn ghost', function () { shareEntity(sp); });
    } else {
      var val = C.economy.essenceValue[sp.rarity];
      addBtn(actions, I18N.t('reveal.recycle', { n: val }), 'btn wide', function () {
        Storage.addEssence(val);
        toast(I18N.t('toast.gotEssence', { n: val }));
        backTo('garden');
        refreshGardenChrome();
      });
      addBtn(actions, '📤', 'btn ghost', function () { shareEntity(sp); });
    }
  }

  function checkMilestone() {
    var st = Storage.get();
    var n = Storage.collected();
    C.milestones.forEach(function (m) {
      if (n >= m.n && st.flags.milestones.indexOf(m.n) === -1) {
        st.flags.milestones.push(m.n);
        Storage.commit();
        var ms = m;
        sheet('<h2>' + m.icon + ' ' + m.title + '</h2>' +
          '<p>' + I18N.t('milestone.body', { n: m.n }) + '</p>' +
          (m.n >= 25 && !st.flags.safetyCardSeen ? safetyCardHtml() : '') +
          '<button class="btn wide" id="ms-share">📤 ' + I18N.t('milestone.share') + '</button>' +
          '<button class="btn ghost wide" id="ms-close" style="margin-top:8px">' + I18N.t('common.continue') + '</button>',
          function (el) {
            el.querySelector('#ms-share').addEventListener('click', function () {
              Share.offer(Share.milestoneCard(ms, MUSHROOM_DATA.length, C), C,
                I18N.t('meta.appName') + ' · ' + ms.title).then(function (how) {
                  if (how === 'downloaded') toast(I18N.t('toast.cardSaved'));
                });
            });
            el.querySelector('#ms-close').addEventListener('click', closeSheet);
          });
        if (m.n >= 25) { st.flags.safetyCardSeen = true; Storage.commit(); }
      }
    });
  }

  function safetyCardHtml() {
    return '<div class="card safety-card" style="margin-top:12px"><h2>🚑 ' + I18N.t('safety.rememberSteps') + '</h2><ol>' +
      C.safety.emergency.map(function (s) { return '<li>' + s + '</li>'; }).join('') +
      '</ol></div>';
  }

  // ---------------------------------------------------------------- collection
  // 图鉴首页整个交给 browse.js（五路检索 + 叠加筛选 + 对比网格）
  function renderCollection() { Browse.render(); }

  function renderDetail(m) {
    var ed = C.edibility[m.edibility];
    var b = $('detail-body');
    $('detail-title').textContent = I18N.pick(m.name, m.nameEn);
    b.innerHTML = '';

    var box = document.createElement('div');
    box.className = 'detail-art';
    // 照片满宽（CSS 拉到 100%），点击进全屏放大；无照片时 400px 画布居中。
    // 部分致命种主图拍不到关键特征（菌托 / 菌褶细节），extraPhotos(m) 有值时改成
    // 可横滑的照片带，署名跟着当前滑到的那张走。
    var extra = extraPhotos(m);
    if (hasPhoto(m) && extra.length) {
      var strip = document.createElement('div');
      strip.className = 'photo-strip';
      var mainPic = art(m, 400);
      mainPic.addEventListener('click', function () { openLightbox(mainPic.currentSrc || mainPic.src, I18N.pick(m.name, m.nameEn)); });
      strip.appendChild(mainPic);
      extra.forEach(function (ex) {
        var im = document.createElement('img');
        im.className = 'sp-photo';
        im.loading = 'lazy';
        im.alt = m.name;
        im.src = ex.file;
        im.addEventListener('click', function () { openLightbox(im.currentSrc || im.src, I18N.pick(m.name, m.nameEn)); });
        strip.appendChild(im);
      });
      box.appendChild(strip);
      var dots = document.createElement('div');
      dots.className = 'photo-dots';
      var frames = [null].concat(extra);           // null = 主图，用 PHOTO_CREDITS
      frames.forEach(function (_, i) { var i2 = document.createElement('i'); if (i === 0) i2.className = 'on'; dots.appendChild(i2); });
      box.appendChild(dots);
      var creditHost = document.createElement('div');
      box.appendChild(creditHost);
      var renderCredit = function (idx) {
        creditHost.innerHTML = '';
        var c = idx === 0 ? photoCredit(m) : extraCreditEl(extra[idx - 1]);
        if (c) creditHost.appendChild(c);
        Array.prototype.forEach.call(dots.children, function (d, i) { d.className = i === idx ? 'on' : ''; });
      };
      renderCredit(0);
      strip.addEventListener('scroll', function () {
        var idx = Math.round(strip.scrollLeft / strip.clientWidth);
        renderCredit(Math.max(0, Math.min(frames.length - 1, idx)));
      }, { passive: true });
    } else {
      var pic = art(m, 400);
      box.appendChild(pic);
      if (hasPhoto(m)) {
        pic.addEventListener('click', function () { openLightbox(pic.currentSrc || pic.src, I18N.pick(m.name, m.nameEn)); });
      }
      if (!hasPhoto(m)) {
        // 示意图是按形态字段画的，未必像真的；致命种要把这一点说得很重
        var np = document.createElement('div');
        np.className = 'photo-credit no-photo' + (m.edibility === 'deadly' ? ' warn' : '');
        np.textContent = I18N.t('detail.noPhoto') +
          (m.edibility === 'deadly' ? I18N.t('detail.noPhotoDeadly') : '');
        box.appendChild(np);
      }
      var credit = photoCredit(m);
      if (credit) box.appendChild(credit);
    }
    b.appendChild(box);

    var head = document.createElement('div');
    head.className = 'card';
    head.innerHTML =
      '<div class="row"><b style="font-size:18px">' + esc(I18N.pick(m.name, m.nameEn)) + '</b>' +
      '<span class="spacer"></span>' +
      // 详情页徽章是野外遇见率，不是抽卡稀有度——图鉴是现实图鉴
      '<span class="res"><i style="background:' + (C.encounterColors[m.encounter] || '#999') + '"></i>' +
      (C.encounterLabels[m.encounter] || '') + '</span></div>' +
      '<div class="latin" style="margin:2px 0 8px">' + m.latin + (I18N.lang() !== 'en' ? ' · ' + m.nameEn : '') + '</div>' +
      '<span class="edib" style="background:' + ed.color + '">' + ed.label + '</span>' +
      '<div class="edib-note" style="margin-top:4px">' + ed.note + '</div>' +
      '<div class="disclaimer-note">' + C.safety.detail + '</div>';
    b.appendChild(head);

    var idKeysEn = enOf(m.id).idKeysEn;
    if (m.idKeys && m.idKeys.length) {
      var ik = document.createElement('div');
      ik.className = 'card idkeys';
      var idkTexts = (I18N.lang() === 'en' && idKeysEn && idKeysEn.length === m.idKeys.length)
        ? idKeysEn : m.idKeys.map(function (k) { return k.text; });
      ik.innerHTML = '<h2>' + I18N.t('detail.howToTell') + '</h2><ol>' +
        idkTexts.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
        '</ol><p class="muted footnote">' + I18N.t('detail.idKeysFootnote') + '</p>';
      b.appendChild(ik);
    }

    // 毒 / 致命种的「容易认错」紧贴识别要点（设计 §3：高危种的相似种块不能沉到页底）
    if (isToxicSp(m)) { var lkTop = lookalikeCard(m); if (lkTop) b.appendChild(lkTop); }

    // 尺度对比尺：「菌盖 5–15 cm」没人有概念，画一把带参考物的尺就有。
    // 按量级三档换参考物；轴长取半程为整数的好看数，中间刻度才不会出现 12.5。
    if (m.capCm && m.capCm.length === 2) {
      var lo = m.capCm[0], hi = m.capCm[1];
      var axis, refCm, refName;
      if (hi <= 5) { axis = 6; refCm = 2.5; refName = I18N.t('detail.refCoin'); }
      else if (hi <= 20) { axis = 30; refCm = 18; refName = I18N.t('detail.refPalm'); }
      else { axis = Math.ceil(hi * 1.15 / 30) * 30; refCm = 60; refName = I18N.t('detail.refForearm'); }
      var pct = function (v) { return Math.max(0.8, Math.min(100, v / axis * 100)); };
      var fmt = function (v) { return (v % 1 ? v.toFixed(1) : v) + ' cm'; };
      var isCap = m.silhouette === 'umbrella' || m.silhouette === 'funnel';
      var rl = document.createElement('div');
      rl.className = 'card ruler-card';
      rl.innerHTML = '<h2>' + I18N.t('detail.howBig') + '</h2><div class="ruler">' +
        '<div class="rrow"><span class="rl">' + I18N.t('detail.thisSpecies') + '</span><span class="rt">' +
          '<u class="soft" style="width:' + pct(hi) + '%"></u><u style="width:' + pct(lo) + '%"></u></span>' +
          '<span class="rv">' + (lo === hi ? fmt(lo) : lo + '–' + fmt(hi)) + '</span></div>' +
        '<div class="rrow"><span class="rl">' + refName + '</span><span class="rt">' +
          '<u class="ref" style="width:' + pct(refCm) + '%"></u></span><span class="rv">' + fmt(refCm) + '</span></div>' +
        '<div class="raxis"><span>0</span><span>' + (axis / 2) + '</span><span>' + axis + ' cm</span></div></div>' +
        '<p class="muted footnote">' + (isCap ? I18N.t('detail.capDiameter') : I18N.t('detail.overallSize')) + I18N.t('detail.rulerFootnote') + '</p>';
      b.appendChild(rl);
    }

    var info = document.createElement('div');
    info.className = 'card';
    info.innerHTML = '<h2>' + I18N.t('detail.characteristics') + '</h2><dl class="kv">' +
      C.entity.detailRows(m).map(function (r) {
        return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
      }).join('') +
      '<dt>' + I18N.t('detail.hymenium') + '</dt><dd>' + (C.labels.hymenium[m.hymenium] || m.hymenium) + '</dd>' +
      '</dl>';
    b.appendChild(info);

    var fact = document.createElement('div');
    fact.className = 'card';
    fact.innerHTML = '<h2>' + I18N.t('detail.funFact') + '</h2><p style="margin:0">' + esc(I18N.pick(m.fact, enOf(m.id).factEn)) + '</p>' +
      '<p class="muted" style="margin:8px 0 0">' + I18N.t('common.quoteOpen') + esc(I18N.pick(m.quote, enOf(m.id).quoteEn)) + I18N.t('common.quoteClose') + '</p>';
    b.appendChild(fact);

    // 非毒种的相似种是「顺带认识一下」，留在趣味知识之后就好
    if (!isToxicSp(m)) { var lkBottom = lookalikeCard(m); if (lkBottom) b.appendChild(lkBottom); }

    b.appendChild(observationCard(m));

    var quizBtn = document.createElement('button');
    quizBtn.className = 'btn ghost wide';
    quizBtn.style.marginBottom = '8px';
    var stars = Storage.masteryFor(m.id);
    quizBtn.textContent = I18N.t('detail.quizMe') + (stars ? '　' + '★'.repeat(stars) + '☆'.repeat(3 - stars) : '');
    quizBtn.addEventListener('click', function () { startSingleQuiz(m); });
    b.appendChild(quizBtn);

    var planted = Storage.isPlaced(m.id);
    var act = document.createElement('button');
    act.className = 'btn wide' + (planted ? ' ghost' : '');
    act.textContent = planted ? I18N.t('detail.unplant') : I18N.t('garden.plant');
    act.addEventListener('click', function () {
      if (planted) {
        Storage.unplace(m.id);
        toast(I18N.t('toast.unplanted'));
      } else {
        var slot = World.slotFor(m, C.garden, Storage.placed().map(function (s) { return s.slot; }));
        if (!slot) { toast(I18N.t('toast.gardenFull')); return; }
        Storage.place(m.id, slot.id);
        toast(I18N.t('toast.planted'));
      }
      renderDetail(m);
      refreshGardenChrome();
    });
    b.appendChild(act);

    var sh = document.createElement('button');
    sh.className = 'btn ghost wide';
    sh.style.marginTop = '8px';
    sh.textContent = I18N.t('detail.shareCard');
    sh.addEventListener('click', function () { shareEntity(m); });
    b.appendChild(sh);
  }

  function isToxicSp(x) { return x.edibility === 'poisonous' || x.edibility === 'deadly'; }

  function lookalikeCard(m) {
    if (m.lookalikes && m.lookalikes.length) {
      var lk = document.createElement('div');
      lk.className = 'card';
      lk.innerHTML = '<h2>' + I18N.t('detail.lookalikes') + '</h2><p class="muted" style="margin:0 0 6px">' +
        I18N.t('detail.lookalikesIntro') + '</p>';
      var row = document.createElement('div');
      row.className = 'lookalike-row';
      var toxic = function (x) { return x.edibility === 'poisonous' || x.edibility === 'deadly'; };
      m.lookalikes.forEach(function (id) {
        var o = byId[id];
        if (!o) return;
        var el = document.createElement('button');
        el.className = 'lookalike';
        el.appendChild(art(o, 34));
        var t2 = document.createElement('span');
        var oe = C.edibility[o.edibility];
        // 差异句：毒/可食配对必有人工句（校验门保证），其余取对方第一条识别要点
        var mEn = enOf(m.id), oEn = enOf(o.id);
        var enDiff = (mEn.lookalikeNotesEn && mEn.lookalikeNotesEn[id]) ||
                     (oEn.lookalikeNotesEn && oEn.lookalikeNotesEn[m.id]) ||
                     (oEn.idKeysEn && oEn.idKeysEn[0]) || '';
        var diff = (m.lookalikeNotes && m.lookalikeNotes[id]) ||
                   (o.lookalikeNotes && o.lookalikeNotes[m.id]) ||
                   (o.idKeys && o.idKeys[0] && o.idKeys[0].text) || '';
        var diffText = I18N.lang() === 'en' && enDiff ? enDiff : diff;
        var mixed = toxic(m) !== toxic(o);
        t2.innerHTML = '<b>' + esc(I18N.pick(o.name, o.nameEn)) + '</b> <span class="muted" style="font-size:11px">' + oe.label + '</span>' +
          (diffText ? '<br><span class="diff">' + esc(diffText) + '</span>' : '') +
          (mixed ? '<br><span class="diff warn">' + I18N.t('detail.mixedWarning') + '</span>' : '');
        el.appendChild(t2);
        el.addEventListener('click', function () { openDetail(o); });
        row.appendChild(el);
      });
      lk.appendChild(row);
      return lk;
    }
    return null;
  }

  // ---------------------------------------------------------------- observations
  // "I actually saw this one, here, on this day" — separate from the
  // collecting minigame. First tap logs today with blank place/note (the
  // skill's rule: any design that asks for a form before the first tap makes
  // people not bother logging); a second tap opens the list to edit or add another.
  function formatCoord(lat, lon) {
    var la = Math.abs(lat).toFixed(3), lo = Math.abs(lon).toFixed(3);
    return la + '°' + (lat >= 0 ? 'N' : 'S') + ', ' + lo + '°' + (lon >= 0 ? 'E' : 'W');
  }

  function monthLabel(dateStr) {
    var p = (dateStr || '').split('-');
    if (p.length < 2) return I18N.t('obs.unknownDate');
    var y = parseInt(p[0], 10), mo = parseInt(p[1], 10);
    if (I18N.lang() === 'en') {
      var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return MON[mo - 1] + ' ' + y;
    }
    return y + '年' + mo + '月';
  }

  function openObsEditForm(sp, rec) {
    sheet('<h2>' + esc(I18N.pick(sp.name, sp.nameEn)) + ' · ' + I18N.t('obs.recordTitle') + '</h2>' +
      '<label class="muted" style="font-size:12px">' + I18N.t('obs.date') + '</label>' +
      '<input type="date" class="obs-field" id="obs-date" value="' + esc(rec.date) + '">' +
      '<label class="muted" style="font-size:12px;display:block;margin-top:10px">' + I18N.t('obs.place') + '</label>' +
      '<div class="row" style="margin-top:4px">' +
        '<input type="text" class="obs-field" id="obs-place" placeholder="' + esc(I18N.t('obs.placePh')) + '" value="' + esc(rec.place) + '">' +
        '<button class="btn ghost" id="obs-gps" style="flex:none;padding:9px 12px">📍</button>' +
      '</div>' +
      '<label class="muted" style="font-size:12px;display:block;margin-top:10px">' + I18N.t('obs.note') + '</label>' +
      '<textarea class="obs-field" id="obs-note" placeholder="' + esc(I18N.t('obs.notePh')) + '">' + esc(rec.note) + '</textarea>' +
      '<button class="btn wide" id="obs-save" style="margin-top:14px">' + I18N.t('common.save') + '</button>' +
      '<button class="btn ghost wide" id="obs-del" style="margin-top:8px">' + I18N.t('obs.deleteRecord') + '</button>',
      function (el) {
        el.querySelector('#obs-save').addEventListener('click', function () {
          Storage.updateObservation(rec.oid, {
            date: el.querySelector('#obs-date').value || Storage.today(),
            place: el.querySelector('#obs-place').value.trim(),
            note: el.querySelector('#obs-note').value.trim()
          });
          closeSheet();
          toast(I18N.t('toast.saved'));
          if (page === 'detail') renderDetail(sp);
          if (page === 'observations') renderObservations();
        });
        el.querySelector('#obs-del').addEventListener('click', function () {
          Storage.deleteObservation(rec.oid);
          closeSheet();
          toast(I18N.t('toast.recordDeleted'));
          if (page === 'detail') renderDetail(sp);
          if (page === 'observations') renderObservations();
        });
        el.querySelector('#obs-gps').addEventListener('click', function () {
          if (!navigator.geolocation) { toast(I18N.t('toast.geoUnsupported')); return; }
          toast(I18N.t('toast.locating'));
          navigator.geolocation.getCurrentPosition(function (pos) {
            el.querySelector('#obs-place').value = formatCoord(pos.coords.latitude, pos.coords.longitude);
          }, function () { toast(I18N.t('toast.geoFailed')); }, { timeout: 8000 });
        });
      });
  }

  function openObsListSheet(sp) {
    var list = Storage.observationsFor(sp.id).sort(function (a, b) { return b.ts - a.ts; });
    var rows = list.map(function (r) {
      return '<button class="obs-item" data-oid="' + esc(r.oid) + '"><span class="info">' +
        '<b>' + esc(r.date) + '</b>' +
        '<span>' + esc(r.place || I18N.t('obs.noPlaceYet')) + (r.note ? ' · ' + esc(r.note) : '') + '</span>' +
        '</span></button>';
    }).join('');
    sheet('<h2>' + esc(I18N.pick(sp.name, sp.nameEn)) + ' · ' + I18N.t('obs.myObservations') + '</h2>' + (rows || '<p class="muted">' + I18N.t('obs.noRecordsYet') + '</p>') +
      '<button class="btn wide" id="obs-add" style="margin-top:14px">' + I18N.t('obs.recordAnother') + '</button>',
      function (el) {
        Array.prototype.forEach.call(el.querySelectorAll('.obs-item'), function (row) {
          row.addEventListener('click', function () {
            var rec = list.filter(function (r) { return r.oid === row.dataset.oid; })[0];
            if (rec) openObsEditForm(sp, rec);
          });
        });
        el.querySelector('#obs-add').addEventListener('click', function () {
          openObsEditForm(sp, Storage.addObservation(sp.id, {}));
        });
      });
  }

  function observationCard(m) {
    var card = document.createElement('div');
    card.className = 'card';
    var list = Storage.observationsFor(m.id);
    var last = list.length ? list.slice().sort(function (a, b) { return b.ts - a.ts; })[0] : null;
    card.innerHTML = '<h2>' + I18N.t('obs.myObservations') + '</h2><p class="muted" style="margin:0 0 8px">' +
      (last ? I18N.t('obs.recordedNTimes', { n: list.length, date: esc(last.date) }) : I18N.t('obs.notRecordedYet')) +
      '</p>';
    var btn = document.createElement('button');
    btn.className = 'btn wide' + (list.length ? ' ghost' : '');
    btn.textContent = list.length ? I18N.t('obs.viewOrAdd') : I18N.t('obs.iSawThis');
    btn.addEventListener('click', function () {
      if (!list.length) {
        Storage.addObservation(m.id, {});
        toast(I18N.t('toast.observationLogged'));
        renderDetail(m);
      } else {
        openObsListSheet(m);
      }
    });
    card.appendChild(btn);
    return card;
  }

  function renderObservations() {
    var all = Storage.allObservations();
    var host = $('obs-body');
    var speciesSeen = {}, places = {};
    all.forEach(function (o) {
      speciesSeen[o.entityId] = 1;
      if (o.place) places[o.place.trim()] = 1;
    });
    var stats = document.createElement('div');
    stats.className = 'card obs-stats';
    stats.innerHTML =
      '<span class="s"><b>' + Object.keys(speciesSeen).length + '</b><span>' + I18N.t('obs.statSpecies') + '</span></span>' +
      '<span class="s"><b>' + all.length + '</b><span>' + I18N.t('obs.statRecords') + '</span></span>' +
      '<span class="s"><b>' + Object.keys(places).length + '</b><span>' + I18N.t('obs.statPlaces') + '</span></span>';
    host.innerHTML = '';
    host.appendChild(stats);
    if (!all.length) {
      var empty = document.createElement('div');
      empty.className = 'fempty';
      empty.innerHTML = I18N.t('obs.emptyState');
      host.appendChild(empty);
      return;
    }
    var lastMonth = null;
    all.forEach(function (o) {
      var sp = byId[o.entityId];
      if (!sp) return;
      var mo = monthLabel(o.date);
      if (mo !== lastMonth) {
        lastMonth = mo;
        var h = document.createElement('div');
        h.className = 'obs-month';
        h.textContent = mo;
        host.appendChild(h);
      }
      var row = document.createElement('button');
      row.className = 'obs-item';
      var thumb = document.createElement('span');
      thumb.className = 'thumb';
      thumb.appendChild(art(sp, 44));
      row.appendChild(thumb);
      var info = document.createElement('span');
      info.className = 'info';
      info.innerHTML = '<b>' + esc(I18N.pick(sp.name, sp.nameEn)) + '</b><span>' + esc(o.date) +
        (o.place ? ' · ' + esc(o.place) : '') + '</span>';
      row.appendChild(info);
      row.addEventListener('click', function () { openObsEditForm(sp, o); });
      host.appendChild(row);
    });
  }

  function openDetail(m) { go('detail', m.id); }

  // ---------------------------------------------------------------- profile
  function renderProfile() {
    var st = Storage.get();
    var obsSpecies = {};
    st.observations.forEach(function (o) { obsSpecies[o.entityId] = 1; });
    var obsN = Object.keys(obsSpecies).length;
    $('obs-summary').textContent = obsN
      ? I18N.t('obs.summaryFilled', { species: obsN, total: st.observations.length })
      : I18N.t('obs.summaryEmpty');
    var wrongN = st.wrong.length;
    $('training-summary').textContent = wrongN
      ? I18N.t('training.summaryWrong', { n: wrongN })
      : I18N.t('training.summaryEmpty');
    // 菌菇园退到这里之后，入口卡要把「园里有没有东西等你」说出来，否则没人记得进去
    var placed = Storage.placed().length;
    var ready = (st.slots || []).filter(function (sl) {
      return World.growth(sl, C.garden).sporeReady;
    }).length;
    $('garden-summary').textContent = placed
      ? I18N.t('garden.summaryFilled', { n: placed }) + (ready ? I18N.t('garden.summaryReady', { n: ready }) : '')
      : I18N.t('garden.summaryEmpty');
    if (!$('btn-garden')._wired) {
      $('btn-garden')._wired = true;
      $('btn-garden').addEventListener('click', function () { go('garden'); });
    }
    var strip = $('res-strip');
    strip.innerHTML = C.rarities.map(function (r) {
      return '<span class="res"><i style="background:' + rarityColor(r) + '"></i>' +
        C.rarityLabels[r] + I18N.t('common.fragmentSuffix') + ' ' + (st.fragments[r] || 0) + '</span>';
    }).join('') +
      '<span class="res">🍂 ' + I18N.t('profile.essence') + ' ' + st.fragmentEssence + '</span>';

    var tl = $('task-list');
    tl.innerHTML = '';
    C.dailyTasks.forEach(function (task) {
      var got = st.dailyTasks.progress[task.id] || 0;
      var done = got >= task.goal;
      var claimed = !!st.dailyTasks.claimed[task.id];
      var row = document.createElement('div');
      row.className = 'task';
      row.innerHTML = '<span class="lbl">' + task.label + '</span>' +
        '<span class="bar"><i style="width:' + Math.min(100, got / task.goal * 100) + '%"></i></span>' +
        '<span class="muted" style="min-width:3em;text-align:right">' +
        Math.min(got, task.goal) + '/' + task.goal + '</span>';
      var b = document.createElement('button');
      b.className = 'btn' + (done && !claimed ? '' : ' ghost');
      b.textContent = claimed ? I18N.t('common.claimed') : I18N.t('common.claim');
      b.disabled = !done || claimed;
      b.addEventListener('click', function () {
        Storage.update(function (s) { s.dailyTasks.claimed[task.id] = true; });
        if (task.reward.fragment) Storage.addFragment(task.reward.fragment, task.reward.n);
        if (task.reward.essence) Storage.addEssence(task.reward.essence);
        toast(I18N.t('toast.rewardClaimed'));
        renderProfile();
      });
      row.appendChild(b);
      tl.appendChild(row);
    });

    var sel = $('sel-difficulty');
    // Rebuilt every render (not just once) so a language switch re-labels the
    // options too — a one-time populate would freeze them in whatever
    // language was active on first paint.
    sel.innerHTML = '';
    Object.keys(C.quiz.levels).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = C.quiz.levels[k].label;
      sel.appendChild(o);
    });
    if (!sel._bound) {
      sel._bound = true;
      sel.addEventListener('change', function () {
        Storage.update(function (s) { s.difficulty = sel.value; });
        toast(I18N.t('toast.difficultyChanged'));
      });
    }
    sel.value = st.difficulty;

    var rng = $('rng-image');
    rng.max = C.quiz.perRound;
    rng.value = st.imageCount;
    $('rng-image-val').textContent = st.imageCount;
    rng.oninput = function () {
      $('rng-image-val').textContent = rng.value;
      Storage.update(function (s) { s.imageCount = +rng.value; });
    };

    $('emergency-list').innerHTML =
      C.safety.emergency.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    $('about-count').textContent = MUSHROOM_DATA.length;
  }

  $('btn-synth').addEventListener('click', function () {
    var st = Storage.get();
    var rows = C.rarities.map(function (r) {
      var n = st.fragments[r] || 0;
      var can = n >= C.economy.synthCount;
      return '<div class="task"><span class="lbl">' + C.rarityLabels[r] + I18N.t('common.fragmentSuffix') + ' ' +
        n + '/' + C.economy.synthCount + '</span>' +
        '<span class="spacer"></span>' +
        '<button class="btn' + (can ? '' : ' ghost') + '" data-syn="' + r + '"' +
        (can ? '' : ' disabled') + '>' + I18N.t('profile.synthesize') + '</button></div>';
    }).join('');
    sheet('<h2>🧫 ' + I18N.t('profile.synthCardTitle') + '</h2><p class="muted">' +
      I18N.t('profile.synthCardBody', { n: C.economy.synthCount }) + '</p>' + rows, function (el) {
      el.querySelectorAll('[data-syn]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = b.dataset.syn;
          if (!Storage.spendFragment(r, C.economy.synthCount)) return;
          var sp = Gacha.pickEntity(MUSHROOM_DATA, r, null, 1);
          var isNew = !Storage.has(sp.id);
          Storage.add(sp.id);
          closeSheet();
          renderReveal(sp, isNew, false);
          go('reveal');
        });
      });
    });
  });

  $('btn-shop').addEventListener('click', function () {
    var st = Storage.get();
    var rows = C.rarities.map(function (r) {
      var cost = C.economy.essenceCost[r];
      var can = st.fragmentEssence >= cost;
      var left = MUSHROOM_DATA.filter(function (m) {
        return m.rarity === r && !Storage.has(m.id);
      }).length;
      return '<div class="task"><span class="lbl">' + C.rarityLabels[r] +
        '<br><span class="muted" style="font-size:11px">' + I18N.t('profile.stillMissing', { n: left }) + '</span></span>' +
        '<span class="spacer"></span><span class="muted">🍂 ' + cost + '</span>' +
        '<button class="btn' + (can && left ? '' : ' ghost') + '" data-shop="' + r + '"' +
        (can && left ? '' : ' disabled') + '>' + I18N.t('profile.pickOne') + '</button></div>';
    }).join('');
    sheet('<h2>🧫 ' + I18N.t('profile.shopTitle') + '</h2><p class="muted">' +
      I18N.t('profile.shopBody', { n: st.fragmentEssence }) + '</p>' + rows, function (el) {
      el.querySelectorAll('[data-shop]').forEach(function (b) {
        b.addEventListener('click', function () { pickFromShop(b.dataset.shop); });
      });
    });
  });

  function pickFromShop(rarity) {
    var cost = C.economy.essenceCost[rarity];
    var pool = MUSHROOM_DATA.filter(function (m) {
      return m.rarity === rarity && !Storage.has(m.id);
    });
    if (!pool.length) { toast(I18N.t('toast.tierComplete')); return; }
    var cells = pool.map(function (m) {
      return '<button class="cell" data-pick="' + m.id + '">' +
        '<div class="nm">' + esc(I18N.pick(m.name, m.nameEn)) + '</div></button>';
    }).join('');
    sheet('<h2>' + I18N.t('profile.pickSpecies', { n: cost }) + '</h2><div class="grid">' + cells + '</div>',
      function (el) {
        // draw each thumbnail into its cell
        el.querySelectorAll('[data-pick]').forEach(function (b) {
          var m = byId[b.dataset.pick];
          b.insertBefore(art(m, 64), b.firstChild);
          b.addEventListener('click', function () {
            if (!Storage.spendEssence(cost)) { toast(I18N.t('toast.notEnoughEssence')); return; }
            Storage.add(m.id);
            closeSheet();
            renderReveal(m, true, false);
            go('reveal');
          });
        });
      });
  }

  $('btn-basket').addEventListener('click', function () {
    var st = Storage.get();
    if (st.lastBasket === Storage.today()) { toast(I18N.t('toast.basketAlreadyClaimed')); return; }
    Storage.update(function (s) { s.lastBasket = Storage.today(); });
    var got = {};
    for (var i = 0; i < C.economy.basketSize; i++) {
      var r = Gacha.rollFragmentRarity(C.gacha);
      got[r] = (got[r] || 0) + 1;
      Storage.addFragment(r, 1);
    }
    sheet('<h2>🧺 ' + I18N.t('profile.dailyBasketTitle') + '</h2>' +
      Object.keys(got).map(function (r) {
        return '<div class="res" style="display:inline-flex;margin:3px"><i style="background:' +
          rarityColor(r) + '"></i>' + C.rarityLabels[r] + I18N.t('common.fragmentSuffix') + ' ×' + got[r] + '</div>';
      }).join('') +
      '<button class="btn wide" onclick="this.closest(\'.overlay\').classList.remove(\'on\')">' + I18N.t('common.accept') + '</button>');
    renderProfile();
  });

  // ---------------------------------------------------------------- observations
  $('btn-observations').addEventListener('click', function () { go('observations'); });
  $('btn-training').addEventListener('click', function () { go('training'); });

  // ---------------------------------------------------------------- transfer
  $('btn-export').addEventListener('click', function () {
    Transfer.exportSave(C)
      .then(function () { toast(I18N.t('toast.exportSaved')); })
      .catch(function () { toast(I18N.t('toast.exportFailed')); });
  });
  $('btn-import').addEventListener('click', function () { $('file-import').click(); });
  $('file-import').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    this.value = '';
    var reader = new FileReader();
    reader.onload = function () {
      sheet('<h2>' + I18N.t('profile.importTitle') + '</h2><p>' + I18N.t('profile.importWarning') + '</p>' +
        '<button class="btn cta wide" id="imp-yes">' + I18N.t('profile.importConfirm') + '</button>' +
        '<button class="btn ghost wide" id="imp-no" style="margin-top:8px">' + I18N.t('common.cancel') + '</button>',
        function (el) {
          el.querySelector('#imp-no').addEventListener('click', closeSheet);
          el.querySelector('#imp-yes').addEventListener('click', function () {
            Transfer.importSave(String(reader.result), C).then(function (info) {
              closeSheet();
              sheet('<h2>' + I18N.t('profile.importSuccessTitle') + '</h2><p>' +
                I18N.t('profile.importSuccessBody', { n: info.collected }) + '</p>' +
                '<button class="btn wide" id="imp-reload">' + I18N.t('common.refresh') + '</button>',
                function (e2) {
                  e2.querySelector('#imp-reload').addEventListener('click', function () {
                    location.reload();
                  });
                });
            }).catch(function (err) {
              closeSheet();
              toast(err.message || I18N.t('toast.importFailed'));
            });
          });
        });
    };
    reader.readAsText(f);
  });

  // ---------------------------------------------------------------- boot
  function firstRun() {
    if (localStorage.getItem(C.storageKeys.disclaimer)) { gift(); return; }
    sheet('<h2>' + I18N.t('intro.title') + '</h2>' +
      '<p>' + C.safety.banner + '</p>' +
      '<p class="muted">' + I18N.t('intro.body') + '</p>' +
      '<button class="btn wide" id="btn-agree">' + I18N.t('intro.agree') + '</button>',
      function (el) {
        el.querySelector('#btn-agree').addEventListener('click', function () {
          localStorage.setItem(C.storageKeys.disclaimer, '1');
          closeSheet();
          if (window.compactSafetyBars) window.compactSafetyBars();
          gift();
        });
      });
  }

  /** New players start with something alive in the garden. */
  function gift() {
    if (Storage.collected() > 0) return;
    // Two already grown and one still young: the garden has something to look
    // at from the first second, and one slot visibly changing to explain what
    // growth is. Nothing starts with a spore ready — that is tomorrow's reason
    // to come back.
    var full = C.garden.stages[C.garden.stages.length - 1].minutes;
    var starters = [
      { id: 'shiitake',   ageMinutes: full + 30 },
      { id: 'oyster',     ageMinutes: full + 10 },
      { id: 'glowmycena', ageMinutes: Math.round(full * 0.25) }
    ];
    starters.forEach(function (st) {
      var id = st.id;
      if (!byId[id]) return;
      Storage.add(id);
      var slot = World.slotFor(byId[id], C.garden,
        Storage.placed().map(function (s) { return s.slot; }));
      if (slot) {
        Storage.place(id, slot.id);
        Storage.update(function (s) {
          s.slots.forEach(function (sl) {
            if (sl.id !== id) return;
            sl.placedAt = Date.now() - st.ageMinutes * 60000;
            sl.lastYieldAt = Date.now();
          });
        });
      }
    });
    Garden.refresh(Storage.get());
    refreshGardenChrome();
    toast(I18N.t('toast.starterGift'));
  }

  refreshGardenChrome();
  root('collection');
  // 深链：物种静态页（m/<id>.html）底部「在图鉴里打开」带 #/m/<id> 进来，直接落到详情
  (function deepLink() {
    var h = /^#\/m\/([\w-]+)/.exec(location.hash || '');
    if (h && byId[h[1]]) go('detail', h[1]);
  })();
  Garden.start();
  firstRun();
  setInterval(function () { Garden.autoNight(); }, 60000);

  // Everything above is private to this closure by design (app.js is glue,
  // not an API). This one accessor exists only so behaviour tests can read
  // the active quiz round without guessing at DOM structure — same reason
  // Browse exposes `_facet()`.
  window._quizRound = function () { return round; };
})();
