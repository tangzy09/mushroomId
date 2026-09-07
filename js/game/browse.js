/* browse.js — 图鉴首页：五路检索 + 叠加筛选 + 对比网格
 *
 * 五个 tab 不是五个页面，是同一份筛选状态的五个编辑入口（引擎在 js/core/facet.js）。
 * 三条不要改的语义：切 tab 不清筛选；每个类目显示「其余条件不变时还剩几种」；
 * 条件 >= 2 且结果 <= 8 时切两列对比网格。
 *
 * 这个领域独有的责任：用形态筛出来的一组，很可能正好是「长得像但一个能吃一个会死」。
 * 所以结果里同时有毒种和非毒种时顶部常驻提示；颜色 tab 常驻「颜色不能判断毒性」。
 * 没有「食性」这一路，只有一个用来学毒菌的开关，不提供找可食种的路径。
 */
var Browse = (function () {
  'use strict';

  var DATA, C, art, openDetail, $, L;
  var F = null;                 // Facet 实例，搜索改变数据集时重建
  var tab = 'silhouette';
  var query = '';
  var GRID_MAX = 8;

  var DIMS = {
    silhouette: { field: 'silhouette' },
    hymenium:   { field: 'hymenium' },
    substrate:  { field: function (m) {
      // 虫体与寄生这几种太少，合成一档
      var s = m.substrate;
      return (s === 'insect' || s === 'parasitic' || s === 'termite') ? 'parasitic' : s;
    } },
    colors:     { field: 'colorGroup', multi: true, array: true },
    ring:       { field: function (m) { return m.ring ? 'yes' : 'no'; } },
    volva:      { field: function (m) { return m.volva ? 'yes' : 'no'; } },
    season:     { field: 'season', array: true },
    toxic:      { field: function (m) {
      return (m.edibility === 'poisonous' || m.edibility === 'deadly') ? 'yes' : 'no';
    } }
  };
  // 菌盖背面只对伞形和漏斗形有意义；马勃、珊瑚菌、胶质菌没有背面
  var hymeniumApplies = function () {
    var s = F.state.silhouette;
    return s === 'umbrella' || s === 'funnel';
  };
  var TABS = [
    { key: 'silhouette', label: '轮廓' },
    { key: 'hymenium',   label: '菌盖背面', when: hymeniumApplies },
    { key: 'substrate',  label: '长在哪' },
    { key: 'colors',     label: '颜色' },
    { key: 'name',       label: '名字' }
  ];
  var GHOSTS = [
    { key: 'ring',   value: 'yes', label: '有菌环' },
    { key: 'volva',  value: 'yes', label: '有菌托' },
    { key: 'season', value: null,  label: '当季' },
    { key: 'toxic',  value: 'yes', label: '☠️ 有毒与剧毒' }
  ];

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  };
  var isToxic = function (m) { return m.edibility === 'poisonous' || m.edibility === 'deadly'; };

  function label(dim, v) {
    if (dim === 'silhouette') return (L.silhouette || {})[v] || v;
    if (dim === 'hymenium') return (L.hymenium || {})[v] || v;
    if (dim === 'substrate') return v === 'parasitic' ? '虫体与寄生' : ((L.substrate || {})[v] || v);
    if (dim === 'colors') return (L.color || {})[v] || v;
    if (dim === 'season') return v + ' 月';
    if (dim === 'ring') return '有菌环';
    if (dim === 'volva') return '有菌托';
    if (dim === 'toxic') return '☠️ 有毒与剧毒';
    return v;
  }

  function matchesQuery(m, q) {
    if (!q) return true;
    var hay = [m.name, m.nameEn, m.latin, m.family, m.habitat, m.pinyin, m.pyAbbr,
      (m.aka || []).join(' '), (L.substrate || {})[m.substrate]].join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  // 搜索改变数据集时重建 Facet；条件带过去，这样搜索与筛选叠加而计数仍然正确
  function build() {
    var pool = query ? DATA.filter(function (m) { return matchesQuery(m, query); }) : DATA;
    var prev = F ? F.state : null;
    F = Facet.create({ data: pool, dims: DIMS, grid: { minActive: 2, maxItems: GRID_MAX } });
    if (prev) Object.keys(prev).forEach(function (k) {
      F.state[k] = Array.isArray(prev[k]) ? prev[k].slice() : prev[k];
    });
  }

  // ---------------------------------------------------------------- 渲染
  function renderTabs() {
    $('facet-tabs').innerHTML = TABS.filter(function (t) { return !t.when || t.when(); })
      .map(function (t) {
        return '<button data-tab="' + t.key + '"' + (t.key === tab ? ' class="on"' : '') + '>' +
          esc(t.label) + '</button>';
      }).join('');
  }

  function renderBar() {
    var out = F.chips().map(function (c) {
      return '<button class="fchip" data-drop="' + c.dim + '" data-val="' + esc(c.value) + '">' +
        esc(label(c.dim, c.value)) + ' ×</button>';
    });
    GHOSTS.forEach(function (g) {
      if (F.isSet(g.key)) return;
      var v = g.value == null ? (new Date().getMonth() + 1) : g.value;
      out.push('<button class="fchip ghost" data-pick="' + g.key + '" data-val="' + esc(v) + '">＋ ' +
        esc(g.label) + '</button>');
    });
    if (F.activeCount() || query) out.push('<button class="fchip ghost" id="facet-clear">清空</button>');
    var n = F.results().length;
    out.push('<span class="fcnt">' + (F.activeCount() || query ? '剩 ' : '共 ') + '<b>' + n + '</b> 种</span>');
    $('facet-bar').innerHTML = out.join('');
  }

  function renderWarn() {
    var list = F.results();
    var msgs = [];
    var hasT = list.some(isToxic), hasS = list.some(function (m) { return !isToxic(m); });
    if (hasT && hasS && (F.activeCount() || query)) {
      msgs.push('这组里有毒菌，它们和可食种可能长得一样。毒种带 ☠️ 或 ⚠️ 标记。');
    }
    if (tab === 'colors') msgs.push('颜色不能判断毒性，且会随干湿和成熟度变化。');
    var w = $('facet-warn');
    w.hidden = !msgs.length;
    w.textContent = msgs.join(' ');
  }

  // 每个类目配一张代表缩略图：该组里第一个有照片的种
  var repCache = {};
  function repArt(dim, v) {
    var k = dim + ':' + v;
    if (!repCache[k]) {
      var m = DATA.find(function (x) {
        var val = typeof DIMS[dim].field === 'function' ? DIMS[dim].field(x) : x[DIMS[dim].field];
        var hit = Array.isArray(val) ? val.indexOf(v) >= 0 : val === v;
        return hit && typeof PHOTO_CREDITS !== 'undefined' && PHOTO_CREDITS[x.id];
      }) || DATA.find(function (x) {
        var val = typeof DIMS[dim].field === 'function' ? DIMS[dim].field(x) : x[DIMS[dim].field];
        return Array.isArray(val) ? val.indexOf(v) >= 0 : val === v;
      });
      repCache[k] = m || null;
    }
    return repCache[k];
  }

  var ORDER = {
    silhouette: ['umbrella', 'funnel', 'shelf', 'ball', 'coral', 'club', 'brain', 'jelly'],
    hymenium: ['gills', 'pores', 'teeth', 'ridges', 'smooth', 'gleba'],
    substrate: ['wood', 'mycorrhizal', 'soil', 'grass', 'litter', 'parasitic', 'conifer_cone'],
    colors: ['white', 'yellow', 'orange', 'red', 'brown', 'grey', 'black', 'purple', 'green']
  };

  function renderLeft() {
    var left = $('facet-left');
    if (tab === 'name') { renderNameList(left); return; }
    var vals = ORDER[tab] || F.allValues(tab);
    var have = F.allValues(tab);
    left.innerHTML = vals.filter(function (v) { return have.indexOf(v) >= 0; }).map(function (v) {
      var n = F.countIf(tab, v);
      var on = DIMS[tab].multi ? F.state[tab].indexOf(v) >= 0 : F.state[tab] === v;
      var rep = repArt(tab, v);
      return '<button class="frow' + (on ? ' on' : '') + (n ? '' : ' zero') + '"' +
        (n ? '' : ' disabled') + ' data-pick="' + tab + '" data-val="' + esc(v) + '">' +
        '<span class="rep" data-rep="' + (rep ? rep.id : '') + '"></span>' +
        '<span class="lbl">' + esc(label(tab, v)) + '</span><span class="n">' + n + '</span></button>';
    }).join('');
    // 代表图另插：art() 返回元素，不走 innerHTML
    Array.prototype.forEach.call(left.querySelectorAll('.rep'), function (el) {
      var m = el.dataset.rep && DATA.find(function (x) { return x.id === el.dataset.rep; });
      if (m) el.appendChild(art(m, 36));
    });
    left.scrollTop = 0;
  }

  function cardEl(m) {
    var b = document.createElement('button');
    b.className = 'fcard';
    b.appendChild(art(m, 44));
    var s = document.createElement('span');
    s.className = 'lbl';
    s.innerHTML = '<b>' + esc(m.name) + '</b>' +
      (isToxic(m) ? ' <span class="tox">' + (m.edibility === 'deadly' ? '☠️' : '⚠️') + '</span>' : '') +
      '<i>' + esc(m.latin) + '</i>';
    b.appendChild(s);
    b.addEventListener('click', function () { openDetail(m); });
    return b;
  }

  function renderRight() {
    var right = $('facet-right');
    right.innerHTML = '';
    var list = F.results();
    if (!list.length) {
      right.innerHTML = '<div class="fempty">这些条件下没有菌子<br>去掉一两个条件再试</div>';
      return;
    }
    var CAP = 90;
    list.slice(0, CAP).forEach(function (m) { right.appendChild(cardEl(m)); });
    if (list.length > CAP) {
      var more = document.createElement('div');
      more.className = 'fempty';
      more.textContent = '还有 ' + (list.length - CAP) + ' 种没显示，再加个条件';
      right.appendChild(more);
    }
    right.scrollTop = 0;
  }

  function renderNameList(host) {
    var list = F.results().slice().sort(function (a, b) {
      return (a.pinyin || '').localeCompare(b.pinyin || '');
    });
    host.innerHTML = '';
    var last = '';
    list.forEach(function (m) {
      var ini = m.initial || '#';
      if (ini !== last) {
        last = ini;
        var h = document.createElement('div');
        h.className = 'mon';
        h.textContent = ini;
        host.appendChild(h);
      }
      host.appendChild(cardEl(m));
    });
    if (!list.length) host.innerHTML = '<div class="fempty">当前筛选条件下没有菌子</div>';
  }

  function renderGrid() {
    var g = $('facet-grid');
    g.innerHTML = '';
    F.results().forEach(function (m) {
      var cell = document.createElement('button');
      cell.className = 'gcell';
      cell.appendChild(art(m, 160));
      var t = document.createElement('span');
      var hint = (m.idKeys && m.idKeys[0] && m.idKeys[0].text) || m.latin;
      t.innerHTML = '<b>' + esc(m.name) +
        (isToxic(m) ? ' <span class="tox">' + (m.edibility === 'deadly' ? '☠️' : '⚠️') + '</span>' : '') +
        '</b><i>' + esc(hint) + '</i>';
      cell.appendChild(t);
      cell.addEventListener('click', function () { openDetail(m); });
      g.appendChild(cell);
    });
    var note = document.createElement('div');
    note.className = 'fempty';
    note.style.gridColumn = '1 / -1';
    note.textContent = '只剩 ' + F.results().length + ' 种，左右比对最快 · 点开看完整识别要点';
    g.appendChild(note);
  }

  function render() {
    if (!F) build();
    // 轮廓改成非伞形后，菌盖背面这个条件失去意义，连同它的 tab 一起收起
    if (!hymeniumApplies()) {
      if (F.isSet('hymenium')) F.drop('hymenium');
      if (tab === 'hymenium') tab = 'silhouette';
    }
    renderTabs();
    renderBar();
    renderWarn();
    var grid = F.gridMode() && tab !== 'name';
    $('facet-split').hidden = grid;
    $('facet-grid').hidden = !grid;
    if (grid) { renderGrid(); return; }
    var nameMode = tab === 'name';
    $('facet-split').classList.toggle('name-mode', nameMode);
    renderLeft();
    if (!nameMode) renderRight();
  }

  // ---------------------------------------------------------------- 交互
  function wire() {
    var page = $('page-collection');
    page.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-tab],[data-pick],[data-drop],#facet-clear');
      if (!t) return;
      if (t.id === 'facet-clear') {
        F.clear(); query = ''; $('coll-search').value = ''; build();
      } else if (t.dataset.tab) {
        tab = t.dataset.tab;                       // 换 tab 不清筛选
      } else if (t.dataset.pick) {
        var dim = t.dataset.pick, val = t.dataset.val;
        if (dim === 'season') val = parseInt(val, 10);
        F.pick(dim, val);
      } else if (t.dataset.drop) {
        var v2 = t.dataset.val;
        if (t.dataset.drop === 'season') v2 = parseInt(v2, 10);
        F.drop(t.dataset.drop, v2);
      }
      render();
    });
    var inp = $('coll-search');
    inp.addEventListener('input', function () {
      query = inp.value.trim().toLowerCase();
      build();
      render();
    });
  }

  var wired = false;
  return {
    init: function (o) {
      DATA = o.data; C = o.C; art = o.art; openDetail = o.openDetail; $ = o.$;
      L = C.labels || {};
      build();
      if (!wired) { wire(); wired = true; }
    },
    render: render,
    // 给验收用
    _facet: function () { return F; }
  };
})();
