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
  var page = 'garden', prev = 'garden';
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

  function art(sp, px, opts) {
    var cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    var c = cv.getContext('2d');
    c.translate(px / 2, px * 0.93);
    ShroomArt.draw(c, sp, px * 0.82, opts || { stage: 'mature' });
    return cv;
  }

  function rarityColor(r) { return C.rarityColors[r]; }

  function drawArtAt(c, sp, size) { ShroomArt.draw(c, sp, size, { stage: 'mature' }); }

  function shareEntity(sp) {
    Share.offer(Share.entityCard(sp, C, drawArtAt), C,
      '我在菌菇图鉴里认出了' + sp.name + '。' + C.share.footer)
      .then(function (how) {
        if (how === 'downloaded') toast('卡片已保存到下载');
        else if (how === 'failed') toast('生成失败，换个浏览器试试');
      });
  }

  // ---------------------------------------------------------------- router
  function show(id) {
    if (id !== page) { prev = page; page = id; }
    ['garden', 'collection', 'profile', 'biome', 'quiz', 'reveal', 'detail']
      .forEach(function (p) {
        var el = $('page-' + p);
        if (el) el.classList.toggle('active', p === id);
      });
    var navPages = { garden: 1, collection: 1, profile: 1 };
    $('nav').style.display = navPages[id] ? 'flex' : 'none';
    Array.prototype.forEach.call($('nav').children, function (b) {
      b.classList.toggle('on', b.dataset.page === id);
    });
    if (id === 'garden') { Garden.refresh(Storage.get()); Garden.start(); }
    else Garden.stop();
    if (id === 'collection') renderCollection();
    if (id === 'profile') renderProfile();
  }
  window.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-back]');
    if (b) show(prev === page ? 'garden' : prev);
  });
  Array.prototype.forEach.call($('nav').children, function (b) {
    b.addEventListener('click', function () { show(b.dataset.page); });
  });

  // ---------------------------------------------------------------- garden
  $('safety-bar').textContent = C.safety.banner;
  $('safety-bar-2').textContent = C.safety.banner;

  function refreshGardenChrome() {
    var st = Storage.get();
    $('chip-weather').textContent = C.weather[weather].label;
    $('chip-count').textContent = '已收集 ' + Storage.collected() + ' / ' + MUSHROOM_DATA.length;
    $('foray-left').textContent = '(' + st.dailyRuns.free + ')';
  }

  Garden.init($('garden-canvas'), C, byId, Storage.get());
  Garden.setWeather(weather);
  Garden.onTap(function (sp, item) {
    var g = World.growth(item.rec, C.garden);
    if (g.sporeReady) {
      item.rec.lastYieldAt = Date.now();
      Storage.addFragment(sp.rarity, 1);
      Storage.commit();
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
      s.slots.forEach(function (sl) {
        sl.boostMs = (sl.boostMs || 0) + C.garden.waterBoostMinutes * 60000;
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
    show('biome');
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
      show('quiz');
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
      addBtn(actions, '回菌菇园', 'btn wide', function () { show('garden'); refreshGardenChrome(); });
      show('reveal');
      return;
    }

    var rarity = Gacha.rollRarity(C.gacha, round.wrong, st.pityCount, weather);
    Gacha.updatePity(C.gacha, rarity, st.pityCount);
    Storage.commit();
    var sp = Gacha.pickEntity(MUSHROOM_DATA, rarity, chosenBiome, C.biomeWeight);
    if (!sp) { show('garden'); return; }

    var isNew = !Storage.has(sp.id);
    Storage.add(sp.id);
    if (round.correct === C.quiz.perRound) {
      Storage.addFragment(rarity, 1);
    }
    renderReveal(sp, isNew, round.correct === C.quiz.perRound);
    show('reveal');
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
        show('garden');
        refreshGardenChrome();
      }).disabled = full;
      if (full) {
        addBtn(actions, '先收进图鉴', 'btn ghost wide', function () {
          checkMilestone(); show('garden'); refreshGardenChrome();
        });
      }
      addBtn(actions, '📤', 'btn ghost', function () { shareEntity(sp); });
    } else {
      var val = C.economy.essenceValue[sp.rarity];
      addBtn(actions, '♻️ 分解得 ' + val + ' 腐殖质', 'btn wide', function () {
        Storage.addEssence(val);
        toast('获得 ' + val + ' 腐殖质');
        show('garden');
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
  var collFilter = 'all';
  function renderCollection() {
    var st = Storage.get();
    $('coll-count').textContent = Storage.collected() + ' / ' + MUSHROOM_DATA.length;

    var filters = [['all', '全部'], ['owned', '已收集'], ['toxic', '☠️ 毒菌']]
      .concat(C.rarities.map(function (r) { return [r, C.rarityLabels[r]]; }));
    var fb = $('coll-filters');
    fb.innerHTML = '';
    filters.forEach(function (f) {
      var b = document.createElement('button');
      b.className = 'pill' + (collFilter === f[0] ? ' on' : '');
      b.textContent = f[1];
      b.addEventListener('click', function () { collFilter = f[0]; renderCollection(); });
      fb.appendChild(b);
    });

    var list = MUSHROOM_DATA.filter(function (m) {
      if (collFilter === 'all') return true;
      if (collFilter === 'owned') return Storage.has(m.id);
      if (collFilter === 'toxic') return m.edibility === 'poisonous' || m.edibility === 'deadly';
      return m.rarity === collFilter;
    });
    var order = { common: 0, rare: 1, epic: 2, legend: 3 };
    list.sort(function (a, b) { return order[a.rarity] - order[b.rarity]; });

    var g = $('coll-grid');
    g.innerHTML = '';
    list.forEach(function (m) {
      var owned = Storage.has(m.id);
      var cell = document.createElement('button');
      cell.className = 'cell' + (owned ? '' : ' locked');
      cell.appendChild(art(m, 72));
      var nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = owned ? m.name : '???';
      cell.appendChild(nm);
      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = rarityColor(m.rarity);
      cell.appendChild(dot);
      if (owned && (m.edibility === 'deadly' || m.edibility === 'poisonous')) {
        var sk = document.createElement('span');
        sk.className = 'skull';
        sk.textContent = m.edibility === 'deadly' ? '☠️' : '⚠️';
        cell.appendChild(sk);
      }
      cell.addEventListener('click', function () {
        if (owned) openDetail(m);
        else toast('还没收集到这一种');
      });
      g.appendChild(cell);
    });
  }

  function openDetail(m) {
    var ed = C.edibility[m.edibility];
    var b = $('detail-body');
    $('detail-title').textContent = m.name;
    b.innerHTML = '';

    var box = document.createElement('div');
    box.className = 'detail-art';
    box.appendChild(art(m, 180));
    b.appendChild(box);

    var head = document.createElement('div');
    head.className = 'card';
    head.innerHTML =
      '<div class="row"><b style="font-size:18px">' + m.name + '</b>' +
      '<span class="spacer"></span>' +
      '<span class="res"><i style="background:' + rarityColor(m.rarity) + '"></i>' +
      C.rarityLabels[m.rarity] + '</span></div>' +
      '<div class="latin" style="margin:2px 0 8px">' + m.latin + ' · ' + m.nameEn + '</div>' +
      '<span class="edib" style="background:' + ed.color + '">' + ed.label + '</span>' +
      '<div class="edib-note" style="margin-top:4px">' + ed.note + '</div>' +
      '<div class="disclaimer-note">' + C.safety.detail + '</div>';
    b.appendChild(head);

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
      lk.innerHTML = '<h2>易混淆</h2><p class="muted" style="margin:0 0 6px">' +
        '外形相似的物种往往需要显微或分子手段才能确认，不要凭肉眼下结论。</p>';
      var row = document.createElement('div');
      row.className = 'lookalike-row';
      m.lookalikes.forEach(function (id) {
        var o = byId[id];
        if (!o) return;
        var el = document.createElement('button');
        el.className = 'lookalike';
        el.appendChild(art(o, 34));
        var t2 = document.createElement('span');
        var oe = C.edibility[o.edibility];
        t2.innerHTML = o.name + '<br><span class="muted" style="font-size:11px">' + oe.label + '</span>';
        el.appendChild(t2);
        el.addEventListener('click', function () {
          if (Storage.has(o.id)) openDetail(o); else toast('还没收集到 ' + o.name);
        });
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
      openDetail(m);
      refreshGardenChrome();
    });
    b.appendChild(act);

    var sh = document.createElement('button');
    sh.className = 'btn ghost wide';
    sh.style.marginTop = '8px';
    sh.textContent = '📤 分享这张卡';
    sh.addEventListener('click', function () { shareEntity(m); });
    b.appendChild(sh);

    show('detail');
  }

  // ---------------------------------------------------------------- profile
  function renderProfile() {
    var st = Storage.get();
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
          show('reveal');
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
            show('reveal');
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
      '<p class="muted">这是一款收集类科普游戏。它教你认识菌子的样子和名字，' +
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
    var starters = ['shiitake', 'oyster', 'glowmycena'];
    starters.forEach(function (id) {
      if (!byId[id]) return;
      Storage.add(id);
      var slot = World.slotFor(byId[id], C.garden,
        Storage.placed().map(function (s) { return s.slot; }));
      if (slot) {
        Storage.place(id, slot.id);
        // start them grown, so the garden is not empty on day one
        Storage.update(function (s) {
          s.slots.forEach(function (sl) {
            if (sl.id === id) sl.placedAt = Date.now() - 40 * 60000;
          });
        });
      }
    });
    Garden.refresh(Storage.get());
    refreshGardenChrome();
    toast('送你三种常见菌，先认识一下');
  }

  refreshGardenChrome();
  show('garden');
  Garden.start();
  firstRun();
  setInterval(function () { Garden.autoNight(); }, 60000);
})();
