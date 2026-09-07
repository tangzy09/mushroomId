// Glue: routing, page rendering, event wiring. The rules live in
// js/core/; this file only connects them to the DOM.

(function () {
  'use strict';

  var C = GameConfig;
  var byId = {};
  MUSHROOM_DATA.forEach(function (m) { byId[m.id] = m; });

  // the last milestone is the whole collection, whatever its size
  C.milestones = C.milestones.concat([
    { n: MUSHROOM_DATA.length, title: '菌物学家', icon: '🔬' }
  ]);

  var S = Storage.init(C);
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

  // Real photographs cover 166 of the 181 species. The rest keep the drawn
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
    d.innerHTML = '照片 ' + esc(who) + lic +
      (c.url ? ' · <a href="' + esc(c.url) + '" target="_blank" rel="noopener">来源</a>' : '');
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
    return '照片 ' + who + lic;
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
      return Share.offer(card, C, '我在菌菇图鉴里认出了' + sp.name + '。' + C.share.footer);
    }).then(function (how) {
      if (how === 'downloaded') toast('卡片已保存到下载');
      else if (how === 'failed') toast('生成失败，换个浏览器试试');
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
    ['garden', 'collection', 'profile', 'biome', 'quiz', 'reveal', 'detail']
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

  function refreshGardenChrome() {
    var st = Storage.get();
    $('chip-weather').textContent = C.weather[weather].label;
    $('chip-count').textContent = '已收集 ' + Storage.collected() + ' / ' + MUSHROOM_DATA.length;
    $('foray-left').textContent = '(' + st.dailyRuns.free + ')';

    // Spores waiting is the reason a player opens the app on day two, so it
    // is stated up front rather than left for them to spot on the canvas.
    var ready = st.slots.filter(function (sl) {
      return World.growth(sl, C.garden).sporeReady;
    }).length;
    var chip = $('chip-spores');
    chip.hidden = ready === 0;
    chip.textContent = '🌀 ' + ready + ' 个孢子待收';
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
      toast('收到 1 个' + C.rarityLabels[sp.rarity] + '孢子');
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
      '我的菌菇园 · 已收集 ' + Storage.collected() + ' / ' + MUSHROOM_DATA.length), C,
      '我的菌菇园')
      .then(function (how) { if (how === 'downloaded') toast('已保存到下载'); });
  });
  $('btn-night').addEventListener('click', function () { Garden.toggleNight(); });
  $('btn-wind').addEventListener('click', function () { Garden.gust(); });
  $('btn-water').addEventListener('click', function () {
    var st = Storage.get();
    if (st.hourlyActions.count <= 0) { toast('这一小时的水浇完了，等下一小时'); return; }
    Storage.update(function (s) {
      s.hourlyActions.count -= 1;
      var boost = World.waterBoostMs(C.garden);
      s.slots.forEach(function (sl) {
        sl.boostMs = (sl.boostMs || 0) + boost;
      });
    });
    Storage.bumpTask('water', 1);
    Garden.water();
    toast('浇水完成，菌子长快了一点');
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
    if (st.dailyRuns.free <= 0) { toast('今天的体力用完了，明天再来'); return; }
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
    if (st.dailyRuns.free <= 0) { toast('今天的体力用完了'); return; }
    Storage.update(function (s) {
      s.dailyRuns.free -= 1;
      s.lastBiome = chosenBiome;
    });
    Storage.bumpTask('foray', 1);
    refreshGardenChrome();

    $('foray-text').textContent = C.biomes[chosenBiome].label.replace(/^\S+\s/, '') +
      ' · ' + C.weather[weather].label;
    $('foray-anim').classList.add('on');
    startRound();
    setTimeout(function () {
      $('foray-anim').classList.remove('on');
      go('quiz');
      showQuestion();
    }, 1600);
  });

  // ---------------------------------------------------------------- quiz
  function startRound() {
    var st = Storage.get();
    var level = C.quiz.levels[st.difficulty] || C.quiz.levels.beginner;
    round = {
      level: level,
      questions: Quiz.pickQuestions(QUESTIONS, level, {
        perRound: C.quiz.perRound,
        imageCount: st.imageCount,
        roundNumber: (st.stats.totalQuestions / C.quiz.perRound | 0) + 1
      }),
      idx: 0, correct: 0, wrong: 0, toxicHit: false
    };
  }

  var tick = null;
  function showQuestion() {
    clearInterval(tick);
    var q = round.questions[round.idx];
    var pres = Quiz.presentation(q);
    round.pres = pres;
    round.answered = false;

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

    $('q-text').textContent = q.q;
    var box = $('q-opts');
    box.innerHTML = '';
    pres.options.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = '<span>' + opt + '</span>' +
        (pres.optionsEn ? '<span class="en">' + pres.optionsEn[i] + '</span>' : '');
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
    if (choice === -1) parts.push('<b>时间到。</b>');
    if (q.explanation) parts.push(q.explanation);
    var ent2 = q.entityId && byId[q.entityId];
    if (ent2) {
      var ed = C.edibility[ent2.edibility];
      parts.push('<span class="tag">' + ent2.name + '</span>：' + ent2.fact);
      parts.push('<span class="edib" style="background:' + ed.color + '">' + ed.label + '</span> ' +
        '<span class="edib-note">' + ed.note + '</span>');
    }
    ex.innerHTML = '<div class="explain">' + parts.join('<br>') +
      (q.disclaimer ? '<div class="disclaimer-note">本题考察的是资料如何记载，不是「能不能吃」。</div>' : '') +
      '</div>';

    var next = document.createElement('button');
    next.className = 'btn wide';
    next.style.marginTop = '12px';
    next.textContent = round.idx + 1 < round.questions.length ? '下一题' : '看看采到了什么';
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
        '<h2 style="margin-top:26px">只带回了孢子</h2>' +
        '<p class="muted">答错 ' + round.wrong + ' 题，这趟没找到完整的菌子。</p>' +
        '<div class="res" style="display:inline-flex;margin-top:10px">' +
        '<i style="background:' + rarityColor(r) + '"></i>' +
        C.rarityLabels[r] + '孢子 ×1</div>' +
        '<p class="muted" style="margin-top:14px">5 个同档孢子可以合成一张菌卡。</p>';
      addBtn(actions, '回菌菇园', 'btn wide', function () { backTo('garden'); refreshGardenChrome(); });
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
    banner.textContent = deadly ? '☠️ 你遇到了致命的它 — 记住它的样子'
      : C.rarityLabels[sp.rarity] + (isNew ? ' · 新收录' : ' · 重复');
    body.appendChild(banner);

    body.appendChild(art(sp, 190));

    var h = document.createElement('h2');
    h.textContent = sp.name;
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
    q.textContent = '「' + sp.quote + '」';
    body.appendChild(q);

    var f = document.createElement('p');
    f.className = 'muted';
    f.style.maxWidth = '30em';
    f.style.margin = '0 auto';
    f.textContent = sp.fact;
    body.appendChild(f);

    if (perfect) {
      var pf = document.createElement('p');
      pf.style.color = 'var(--accent)';
      pf.style.fontWeight = '600';
      pf.textContent = '全对！额外获得 1 个' + C.rarityLabels[sp.rarity] + '孢子';
      body.appendChild(pf);
    }

    actions.innerHTML = '';
    if (isNew) {
      var full = Storage.placed().length >= C.slots.max;
      addBtn(actions, full ? '菌菇园已满' : '🌲 种进菌菇园', 'btn wide', function () {
        var slot = World.slotFor(sp, C.garden, Storage.placed().map(function (s) { return s.slot; }));
        if (!slot) { toast('菌菇园满了，先从图鉴里移走一个'); return; }
        Storage.place(sp.id, slot.id);
        checkMilestone();
        backTo('garden');
        refreshGardenChrome();
      }).disabled = full;
      if (full) {
        addBtn(actions, '先收进图鉴', 'btn ghost wide', function () {
          checkMilestone(); backTo('garden'); refreshGardenChrome();
        });
      }
      addBtn(actions, '📤', 'btn ghost', function () { shareEntity(sp); });
    } else {
      var val = C.economy.essenceValue[sp.rarity];
      addBtn(actions, '♻️ 分解得 ' + val + ' 腐殖质', 'btn wide', function () {
        Storage.addEssence(val);
        toast('获得 ' + val + ' 腐殖质');
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
          '<p>已经认识 ' + m.n + ' 种菌子了。</p>' +
          (m.n >= 25 && !st.flags.safetyCardSeen ? safetyCardHtml() : '') +
          '<button class="btn wide" id="ms-share">📤 分享成就</button>' +
          '<button class="btn ghost wide" id="ms-close" style="margin-top:8px">继续</button>',
          function (el) {
            el.querySelector('#ms-share').addEventListener('click', function () {
              Share.offer(Share.milestoneCard(ms, MUSHROOM_DATA.length, C), C,
                '菌菇图鉴 · ' + ms.title).then(function (how) {
                  if (how === 'downloaded') toast('卡片已保存到下载');
                });
            });
            el.querySelector('#ms-close').addEventListener('click', closeSheet);
          });
        if (m.n >= 25) { st.flags.safetyCardSeen = true; Storage.commit(); }
      }
    });
  }

  function safetyCardHtml() {
    return '<div class="card safety-card" style="margin-top:12px"><h2>🚑 记住这几步</h2><ol>' +
      C.safety.emergency.map(function (s) { return '<li>' + s + '</li>'; }).join('') +
      '</ol></div>';
  }

  // ---------------------------------------------------------------- collection
  // 图鉴首页整个交给 browse.js（五路检索 + 叠加筛选 + 对比网格）
  function renderCollection() { Browse.render(); }

  function renderDetail(m) {
    var ed = C.edibility[m.edibility];
    var b = $('detail-body');
    $('detail-title').textContent = m.name;
    b.innerHTML = '';

    var box = document.createElement('div');
    box.className = 'detail-art';
    box.appendChild(art(m, 180));
    if (!hasPhoto(m)) {
      // 示意图是按形态字段画的，未必像真的；致命种要把这一点说得很重
      var np = document.createElement('div');
      np.className = 'photo-credit no-photo' + (m.edibility === 'deadly' ? ' warn' : '');
      np.textContent = '暂无照片，示意图仅表示大致形态' +
        (m.edibility === 'deadly' ? '。剧毒物种，切勿据此辨认' : '');
      box.appendChild(np);
    }
    var credit = photoCredit(m);
    if (credit) box.appendChild(credit);
    b.appendChild(box);

    var head = document.createElement('div');
    head.className = 'card';
    head.innerHTML =
      '<div class="row"><b style="font-size:18px">' + m.name + '</b>' +
      '<span class="spacer"></span>' +
      // 详情页徽章是野外遇见率，不是抽卡稀有度——图鉴是现实图鉴
      '<span class="res"><i style="background:' + (C.encounterColors[m.encounter] || '#999') + '"></i>' +
      (C.encounterLabels[m.encounter] || '') + '</span></div>' +
      '<div class="latin" style="margin:2px 0 8px">' + m.latin + ' · ' + m.nameEn + '</div>' +
      '<span class="edib" style="background:' + ed.color + '">' + ed.label + '</span>' +
      '<div class="edib-note" style="margin-top:4px">' + ed.note + '</div>' +
      '<div class="disclaimer-note">' + C.safety.detail + '</div>';
    b.appendChild(head);

    if (m.idKeys && m.idKeys.length) {
      var ik = document.createElement('div');
      ik.className = 'card idkeys';
      ik.innerHTML = '<h2>怎么认</h2><ol>' +
        m.idKeys.map(function (k) { return '<li>' + esc(k.text) + '</li>'; }).join('') +
        '</ol><p class="muted footnote">识别要点由 AI 据公开资料整理，未经真菌学家审校，仅供学习，不能作为采食依据。</p>';
      b.appendChild(ik);
    }

    // 尺度对比尺：「菌盖 5–15 cm」没人有概念，画一把带参考物的尺就有。
    // 按量级三档换参考物；轴长取半程为整数的好看数，中间刻度才不会出现 12.5。
    if (m.capCm && m.capCm.length === 2) {
      var lo = m.capCm[0], hi = m.capCm[1];
      var axis, refCm, refName;
      if (hi <= 5) { axis = 6; refCm = 2.5; refName = '一元硬币'; }
      else if (hi <= 20) { axis = 30; refCm = 18; refName = '手掌'; }
      else { axis = Math.ceil(hi * 1.15 / 30) * 30; refCm = 60; refName = '小臂'; }
      var pct = function (v) { return Math.max(0.8, Math.min(100, v / axis * 100)); };
      var fmt = function (v) { return (v % 1 ? v.toFixed(1) : v) + ' cm'; };
      var isCap = m.silhouette === 'umbrella' || m.silhouette === 'funnel';
      var rl = document.createElement('div');
      rl.className = 'card ruler-card';
      rl.innerHTML = '<h2>多大</h2><div class="ruler">' +
        '<div class="rrow"><span class="rl">本种</span><span class="rt">' +
          '<u class="soft" style="width:' + pct(hi) + '%"></u><u style="width:' + pct(lo) + '%"></u></span>' +
          '<span class="rv">' + (lo === hi ? fmt(lo) : lo + '–' + fmt(hi)) + '</span></div>' +
        '<div class="rrow"><span class="rl">' + refName + '</span><span class="rt">' +
          '<u class="ref" style="width:' + pct(refCm) + '%"></u></span><span class="rv">' + fmt(refCm) + '</span></div>' +
        '<div class="raxis"><span>0</span><span>' + (axis / 2) + '</span><span>' + axis + ' cm</span></div></div>' +
        '<p class="muted footnote">' + (isCap ? '菌盖直径' : '整体大小') + '。实心为常见范围，浅色到最大记录。</p>';
      b.appendChild(rl);
    }

    var info = document.createElement('div');
    info.className = 'card';
    info.innerHTML = '<h2>特征</h2><dl class="kv">' +
      C.entity.detailRows(m).map(function (r) {
        return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
      }).join('') +
      '<dt>子实层</dt><dd>' + (C.labels.hymenium[m.hymenium] || m.hymenium) + '</dd>' +
      '</dl>';
    b.appendChild(info);

    var fact = document.createElement('div');
    fact.className = 'card';
    fact.innerHTML = '<h2>趣味知识</h2><p style="margin:0">' + m.fact + '</p>' +
      '<p class="muted" style="margin:8px 0 0">「' + m.quote + '」</p>';
    b.appendChild(fact);

    if (m.lookalikes && m.lookalikes.length) {
      var lk = document.createElement('div');
      lk.className = 'card';
      lk.innerHTML = '<h2>容易认错</h2><p class="muted" style="margin:0 0 6px">' +
        '外形相似的物种往往需要显微或分子手段才能确认，不要凭肉眼下结论。</p>';
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
        var diff = (m.lookalikeNotes && m.lookalikeNotes[id]) ||
                   (o.lookalikeNotes && o.lookalikeNotes[m.id]) ||
                   (o.idKeys && o.idKeys[0] && o.idKeys[0].text) || '';
        var mixed = toxic(m) !== toxic(o);
        t2.innerHTML = '<b>' + esc(o.name) + '</b> <span class="muted" style="font-size:11px">' + oe.label + '</span>' +
          (diff ? '<br><span class="diff">' + esc(diff) + '</span>' : '') +
          (mixed ? '<br><span class="diff warn">一个可食一个有毒，肉眼未必分得清</span>' : '');
        el.appendChild(t2);
        el.addEventListener('click', function () { openDetail(o); });
        row.appendChild(el);
      });
      lk.appendChild(row);
      b.appendChild(lk);
    }

    var planted = Storage.isPlaced(m.id);
    var act = document.createElement('button');
    act.className = 'btn wide' + (planted ? ' ghost' : '');
    act.textContent = planted ? '从菌菇园移出' : '🌲 种进菌菇园';
    act.addEventListener('click', function () {
      if (planted) {
        Storage.unplace(m.id);
        toast('已移出');
      } else {
        var slot = World.slotFor(m, C.garden, Storage.placed().map(function (s) { return s.slot; }));
        if (!slot) { toast('菌菇园满了'); return; }
        Storage.place(m.id, slot.id);
        toast('已种下，等它长起来');
      }
      renderDetail(m);
      refreshGardenChrome();
    });
    b.appendChild(act);

    var sh = document.createElement('button');
    sh.className = 'btn ghost wide';
    sh.style.marginTop = '8px';
    sh.textContent = '📤 分享这张卡';
    sh.addEventListener('click', function () { shareEntity(m); });
    b.appendChild(sh);
  }

  function openDetail(m) { go('detail', m.id); }

  // ---------------------------------------------------------------- profile
  function renderProfile() {
    var st = Storage.get();
    // 菌菇园退到这里之后，入口卡要把「园里有没有东西等你」说出来，否则没人记得进去
    var placed = Storage.placed().length;
    var ready = (st.slots || []).filter(function (sl) {
      return World.growth(sl, C.garden).sporeReady;
    }).length;
    $('garden-summary').textContent = placed
      ? '园里 ' + placed + ' 株' + (ready ? '，' + ready + ' 株孢子待收' : '')
      : '进山采菌、抽卡、把认出的菌子种进园里';
    if (!$('btn-garden')._wired) {
      $('btn-garden')._wired = true;
      $('btn-garden').addEventListener('click', function () { go('garden'); });
    }
    var strip = $('res-strip');
    strip.innerHTML = C.rarities.map(function (r) {
      return '<span class="res"><i style="background:' + rarityColor(r) + '"></i>' +
        C.rarityLabels[r] + '孢子 ' + (st.fragments[r] || 0) + '</span>';
    }).join('') +
      '<span class="res">🍂 腐殖质 ' + st.fragmentEssence + '</span>';

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
      b.textContent = claimed ? '已领' : '领取';
      b.disabled = !done || claimed;
      b.addEventListener('click', function () {
        Storage.update(function (s) { s.dailyTasks.claimed[task.id] = true; });
        if (task.reward.fragment) Storage.addFragment(task.reward.fragment, task.reward.n);
        if (task.reward.essence) Storage.addEssence(task.reward.essence);
        toast('奖励已领取');
        renderProfile();
      });
      row.appendChild(b);
      tl.appendChild(row);
    });

    var sel = $('sel-difficulty');
    if (!sel.options.length) {
      Object.keys(C.quiz.levels).forEach(function (k) {
        var o = document.createElement('option');
        o.value = k;
        o.textContent = C.quiz.levels[k].label;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        Storage.update(function (s) { s.difficulty = sel.value; });
        toast('难度已切换');
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
      return '<div class="task"><span class="lbl">' + C.rarityLabels[r] + '孢子 ' +
        n + '/' + C.economy.synthCount + '</span>' +
        '<span class="spacer"></span>' +
        '<button class="btn' + (can ? '' : ' ghost') + '" data-syn="' + r + '"' +
        (can ? '' : ' disabled') + '>合成</button></div>';
    }).join('');
    sheet('<h2>🧫 合成菌卡</h2><p class="muted">' + C.economy.synthCount +
      ' 个同档孢子换一张随机同档菌卡。</p>' + rows, function (el) {
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
        '<br><span class="muted" style="font-size:11px">还差 ' + left + ' 种</span></span>' +
        '<span class="spacer"></span><span class="muted">🍂 ' + cost + '</span>' +
        '<button class="btn' + (can && left ? '' : ' ghost') + '" data-shop="' + r + '"' +
        (can && left ? '' : ' disabled') + '>挑一种</button></div>';
    }).join('');
    sheet('<h2>🧫 菌种库</h2><p class="muted">用腐殖质挑一种还没收集到的菌。当前 🍂 ' +
      st.fragmentEssence + '</p>' + rows, function (el) {
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
    if (!pool.length) { toast('这一档已经收集齐了'); return; }
    var cells = pool.map(function (m) {
      return '<button class="cell" data-pick="' + m.id + '">' +
        '<div class="nm">' + m.name + '</div></button>';
    }).join('');
    sheet('<h2>选一种（🍂 ' + cost + '）</h2><div class="grid">' + cells + '</div>',
      function (el) {
        // draw each thumbnail into its cell
        el.querySelectorAll('[data-pick]').forEach(function (b) {
          var m = byId[b.dataset.pick];
          b.insertBefore(art(m, 64), b.firstChild);
          b.addEventListener('click', function () {
            if (!Storage.spendEssence(cost)) { toast('腐殖质不够'); return; }
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
    if (st.lastBasket === Storage.today()) { toast('今天的菌篮已经领过了'); return; }
    Storage.update(function (s) { s.lastBasket = Storage.today(); });
    var got = {};
    for (var i = 0; i < C.economy.basketSize; i++) {
      var r = Gacha.rollFragmentRarity(C.gacha);
      got[r] = (got[r] || 0) + 1;
      Storage.addFragment(r, 1);
    }
    sheet('<h2>🧺 每日菌篮</h2>' +
      Object.keys(got).map(function (r) {
        return '<div class="res" style="display:inline-flex;margin:3px"><i style="background:' +
          rarityColor(r) + '"></i>' + C.rarityLabels[r] + '孢子 ×' + got[r] + '</div>';
      }).join('') +
      '<button class="btn wide" onclick="this.closest(\'.overlay\').classList.remove(\'on\')">收下</button>');
    renderProfile();
  });

  // ---------------------------------------------------------------- transfer
  $('btn-export').addEventListener('click', function () {
    Transfer.exportSave(C)
      .then(function () { toast('存档已导出，请妥善保存'); })
      .catch(function () { toast('导出失败'); });
  });
  $('btn-import').addEventListener('click', function () { $('file-import').click(); });
  $('file-import').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    this.value = '';
    var reader = new FileReader();
    reader.onload = function () {
      sheet('<h2>导入存档</h2><p>导入会<b>覆盖</b>这台设备上的现有进度，无法撤销。</p>' +
        '<button class="btn cta wide" id="imp-yes">确认导入</button>' +
        '<button class="btn ghost wide" id="imp-no" style="margin-top:8px">取消</button>',
        function (el) {
          el.querySelector('#imp-no').addEventListener('click', closeSheet);
          el.querySelector('#imp-yes').addEventListener('click', function () {
            Transfer.importSave(String(reader.result), C).then(function (info) {
              closeSheet();
              sheet('<h2>导入成功</h2><p>已恢复 ' + info.collected +
                ' 种收集记录。刷新页面后生效。</p>' +
                '<button class="btn wide" id="imp-reload">刷新</button>',
                function (e2) {
                  e2.querySelector('#imp-reload').addEventListener('click', function () {
                    location.reload();
                  });
                });
            }).catch(function (err) {
              closeSheet();
              toast(err.message || '导入失败');
            });
          });
        });
    };
    reader.readAsText(f);
  });

  // ---------------------------------------------------------------- boot
  function firstRun() {
    if (localStorage.getItem(C.storageKeys.disclaimer)) { gift(); return; }
    sheet('<h2>开始之前</h2>' +
      '<p>' + C.safety.banner + '</p>' +
      '<p class="muted">这是一本菌菇图鉴。它教你认识菌子的样子和名字，' +
      '不教你判断哪一朵能吃——没有任何简单方法能做到那件事。</p>' +
      '<button class="btn wide" id="btn-agree">我明白了</button>',
      function (el) {
        el.querySelector('#btn-agree').addEventListener('click', function () {
          localStorage.setItem(C.storageKeys.disclaimer, '1');
          closeSheet();
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
    toast('送你三种常见菌，先认识一下');
  }

  refreshGardenChrome();
  root('collection');
  Garden.start();
  firstRun();
  setInterval(function () { Garden.autoNight(); }, 60000);
})();
