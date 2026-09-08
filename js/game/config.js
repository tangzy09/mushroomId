// The one place the core layer learns anything about mushrooms.
// Nothing under js/core/ may mention a domain word; it reads this instead.

var GameConfig = {
  storageKey: 'mgame_v1',
  storageKeys: {
    lang: 'mush_lang',
    sound: 'mush_sound_enabled',
    tutorial: 'mush_tutorial_done',
    disclaimer: 'mush_disclaimer_ok'
  },
  siteUrl: 'https://mushroomid.ai-speeds.com',

  rarities: ['common', 'rare', 'epic', 'legend'],
  rarityLabels: { common: '普通', rare: '稀有', epic: '珍稀', legend: '传说' },
  // 野外遇见率（不是抽卡稀有度）：图鉴排序与筛选用它
  encounters: ['common', 'occasional', 'rare', 'seldom'],
  encounterLabels: { common: '常见', occasional: '偶见', rare: '罕见', seldom: '难得一见' },
  encounterColors: { common: '#5B8C3A', occasional: '#2E8B8B', rare: '#D98324', seldom: '#8A6BBE' },
  rarityColors: {
    common: '#7EC8A0', rare: '#4DA6FF', epic: '#B57BFF', legend: '#E0B400'
  },

  gacha: {
    // weights are per mille of 100; they sum to 100 in each row
    normal:  { common: 60, rare: 30, epic: 8, legend: 2 },
    penalty: { common: 75, rare: 20, epic: 4, legend: 1 },
    pity: { epic: 20, legend: 50 },
    fragmentThreshold: 3,          // this many wrong answers -> spores only
    // weather nudges, applied to the normal row; taken out of common
    weatherMod: {
      rain:      { rare: 5 },
      rainAfter: { rare: 5, epic: 2 }
    }
  },

  economy: {
    essenceValue: { common: 10, rare: 50, epic: 100, legend: 400 },
    essenceCost:  { common: 50, rare: 100, epic: 400, legend: 1600 },
    synthCount: 5,                 // spores needed to synthesise one card
    basketSize: 5,                 // spores in a daily basket
    dailyRuns: 50,              // 进山次数
    actionsPerHour: 10          // 浇水次数
  },

  quiz: {
    perRound: 5,
    timerSec: 15,
    defaultImageCount: 3,
    // Difficulty ranges, not single values. Every (type, difficulty)
    // bucket in the bank must be reachable from one of these; see
    // test/check_data.py, which mirrors this table.
    levels: {
      beginner: {
        label: '🍄 菌子萌新',
        image: [1, 2],
        knowledge: { edibility_class: [2], trivia: [2, 3], myth_buster: [1, 2] },
        forceMythBusterRounds: 3   // first N rounds always include one
      },
      intermediate: {
        label: '🧺 采菌爱好者',
        image: [2, 3],
        knowledge: { feature: [2, 3], trivia: [3, 4], edibility_class: [3, 4] }
      },
      expert: {
        label: '🔬 菌物学家',
        image: [3, 4, 5],
        knowledge: { lookalike: [3, 4, 5], feature: [4, 5], cold_fact: [4, 5] }
      }
    }
  },

  // Core reads only this; the visual layout below is the domain's business.
  slots: { max: 10 },

  garden: {
    // Slots are spread from the horizon (y≈0.5) down to the near edge (y≈0.92)
    // and drawn smaller the further back they sit. Ten mature mushrooms in one
    // narrow band overlapped into an unreadable wall; depth is what separates
    // them. Ids are part of the save — move a slot, never rename one.
    slots: [
      // Listed near-to-far: World.slotFor takes the first free match, so the
      // garden fills from the front. The first three mushrooms a new player
      // owns should stand close and large, not as specks on the horizon.
      // The floating garden controls occupy x 0.86–0.98 below y 0.70, so
      // nothing near the viewer may sit under them.
      // Wood slots sit on a log's top surface, so their y matches the log.
      { id: 'R2', kind: 'ground',  x: 0.64,  y: 0.905 },
      { id: 'W4', kind: 'wood',    x: 0.63,  y: 0.710 },  // main log, right
      { id: 'S2', kind: 'special', x: 0.33,  y: 0.895 },
      { id: 'W3', kind: 'wood',    x: 0.44,  y: 0.714 },  // main log, left
      { id: 'L2', kind: 'ground',  x: 0.17,  y: 0.800 },
      { id: 'S1', kind: 'shelf',   x: 0.615, y: 0.498 },  // bracket on the stump
      { id: 'R1', kind: 'ground',  x: 0.855, y: 0.600 },
      { id: 'W2', kind: 'wood',    x: 0.44,  y: 0.543 },  // far log, right
      { id: 'L1', kind: 'ground',  x: 0.10,  y: 0.585 },
      { id: 'W1', kind: 'wood',    x: 0.28,  y: 0.547 }   // far log, left
    ],
    // Draw scale across that span: far ones read as small, near ones as large.
    depth: { near: 1.06, far: 0.52, yFar: 0.50, yNear: 0.92 },
    // The growth machine, four states:
    //
    //   pin --30min--> young --3h--> mature --24h--> sporulate
    //                                  ^                 |
    //                                  +-- tap to take --+
    //
    // The first three are a clock ladder measured from planting; the fourth
    // is not on the ladder — a mature slot enters it when its yield timer
    // elapses and drops back to mature once the spore is taken.
    stages: [
      { id: 'pin',    label: '菌蕾', minutes: 0 },
      { id: 'young',  label: '幼菌', minutes: 30 },
      { id: 'mature', label: '成熟', minutes: 210 }
    ],
    sporulate: { id: 'sporulate', label: '出孢' },
    // Yield timing counts from the moment a slot matures, not from planting,
    // and never stacks: three days away still leaves exactly one to collect.
    yieldHours: 24,
    waterBoostPercent: 8           // one watering advances the whole ramp this much
  },

  biomes: {
    pine:      { label: '🌲 松林',   desc: '松茸、松乳菇、见手青、牛肝菌' },
    broadleaf: { label: '🌳 阔叶林', desc: '鸡油菌、青头菌、鹅膏、干巴菌' },
    deadwood:  { label: '🪵 腐木区', desc: '木耳、平菇、灵芝、荧光小菇' },
    meadow:    { label: '🌾 草地',   desc: '马勃、鬼伞、仙环、草坪毒菇' }
  },
  biomeWeight: 3,                  // species of the chosen biome weigh this much more

  weather: {
    sunny:     { label: '☀️ 晴',   weight: 40 },
    cloudy:    { label: '☁️ 阴',   weight: 25 },
    rain:      { label: '🌧 雨',   weight: 20 },
    rainAfter: { label: '🌈 雨后', weight: 15 }
  },

  milestones: [
    { n: 10,  title: '菌子萌新',   icon: '🍄' },
    { n: 25,  title: '采菌爱好者', icon: '🧺' },
    { n: 50,  title: '山里常客',   icon: '🌲' },
    { n: 100, title: '菌物观察员', icon: '🔍' },
    { n: 150, title: '孢子猎人',   icon: '🌫' }
    // the final milestone is appended at runtime = ENTITIES.length
  ],

  dailyTasks: [
    { id: 'correct', label: '答对 10 题', goal: 10, reward: { fragment: 'common', n: 1 } },
    { id: 'foray',   label: '进山 3 次',  goal: 3,  reward: { essence: 20 } },
    { id: 'water',   label: '浇水 3 次',  goal: 3,  reward: { fragment: 'common', n: 1 } },
    { id: 'toxic',   label: '认出 1 种毒菌', goal: 1, reward: { fragment: 'rare', n: 1 } }
  ],

  // How the core reads a domain object. Core code never touches fields directly.
  entity: {
    displayName: function (e, en) { return en && e.nameEn ? e.nameEn : e.name; },
    subtitle: function (e) { return e.latin; },
    rarity: function (e) { return e.rarity; },
    detailRows: function (e) {
      var en = typeof I18N !== 'undefined' && I18N.lang() === 'en';
      var t = function (k) { return typeof I18N !== 'undefined' ? I18N.t(k) : k; };
      // habitatEn lives in js/i18n_en.gen.js, keyed by id — see app.js's enOf().
      var habitatEn = (typeof I18N_EN !== 'undefined' && I18N_EN[e.id] && I18N_EN[e.id].habitatEn) || null;
      var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var season = en
        ? ((e.season || []).length >= 10 ? t('detail.allYear') : (e.season || []).map(function (mo) { return MON[mo - 1]; }).join(', '))
        : ((e.season || []).length >= 10 ? '全年' : (e.season || []).join('、') + ' 月');
      return [
        [t('detail.latin'), e.latin],
        [t('detail.family'), en ? (e.familyEn || e.family) : e.family],
        [t('detail.habitat'), en ? (habitatEn || e.habitat) : e.habitat],
        [t('detail.substrate'), GameConfig.labels.substrate[e.substrate] || e.substrate],
        [t('detail.sporePrint'), GameConfig.labels.spore[e.sporePrint] || '—'],
        [t('detail.season'), season]
      ];
    }
  },

  // Edibility is a record of how public sources describe a species.
  // It is never advice, and the UI always shows the footnote alongside.
  edibility: {
    cultivated:  { label: '🍽 栽培食用', color: '#5B8C3A', note: '商业栽培食用菌。野生个体请通过正规渠道购买。' },
    wild_edible: { label: '🍽 资料载可食', color: '#5B8C3A', note: '资料记载为野生食用菌。本图鉴不提供任何采食依据。' },
    conditional: { label: '🔥 条件可食', color: '#D98324', note: '资料记载须专业处理后食用，误食有中毒记录。' },
    medicinal:   { label: '💊 药用', color: '#2E8B8B', note: '传统上用作药材，不作食物。' },
    inedible:    { label: '❓ 不可食', color: '#8A8A78', note: '无毒但质地木质或极苦，不作食物。' },
    unknown:     { label: '❓ 食性不明', color: '#8A8A78', note: '食性不明，视同有毒。' },
    poisonous:   { label: '⚠️ 有毒', color: '#D9553F', note: '资料记载为有毒蘑菇。' },
    deadly:      { label: '☠️ 剧毒', color: '#B0203A', note: '资料记载为剧毒，有致死记录。' }
  },

  labels: {
    substrate: {
      wood: '木生', soil: '土生', grass: '草地', litter: '落叶层',
      mycorrhizal: '菌根共生', termite: '白蚁巢', insect: '虫生',
      parasitic: '寄生', conifer_cone: '松果'
    },
    spore: {
      white: '白色', cream: '乳白', pink: '粉红', brown: '褐色', rusty: '锈褐',
      purple_brown: '紫褐', black: '黑色', green: '绿色', olive: '橄榄',
      lilac: '淡紫'
    },
    hymenium: {
      gills: '菌褶', pores: '菌管', teeth: '菌齿', ridges: '棱脊',
      smooth: '光滑', gleba: '孢体'
    },
    // 一期 B 检索维度的展示名
    silhouette: {
      umbrella: '伞形', funnel: '漏斗、喇叭与杯', shelf: '贴树的架子', ball: '球与块',
      coral: '珊瑚与枝状', club: '棒与指', brain: '脑与蜂窝', jelly: '耳与胶质'
    },
    color: {
      white: '白', yellow: '黄', orange: '橙', red: '红', brown: '褐',
      grey: '灰', black: '黑', purple: '紫', green: '绿'
    },
    // 第三刀：菌盖表面（只对伞形 / 漏斗形）与大小（按 capCm 最大记录）
    capSurface: {
      smooth: '光滑', scaly: '有鳞片', warty: '疣点与斑块', slimy: '湿时黏滑', fibrous: '纤维与条纹'
    },
    size: {
      small: '小，5 cm 以内', medium: '中，5–15 cm', large: '大，15 cm 以上'
    }
  },

  share: {
    bg: ['#1F2D1A', '#2F4A2A'],
    fallbackEmoji: '🍄',
    fileName: 'mushroom-card.png',
    footer: '仅供科普娱乐 · 请勿依据本游戏采食野生菌'
  },

  transfer: { magic: 'MGAME1', ext: '.spore' },

  safety: {
    banner: '本图鉴所有「食用 / 有毒」标签仅转述公开资料，不能用于野外鉴定，更不能作为采食依据。野生蘑菇不采、不买、不吃。',
    detail: '同一种蘑菇在不同地区、不同成熟度可能有不同记载，且存在大量肉眼无法区分的相似种。请勿凭本页信息判断真实蘑菇能否食用。',
    emergency: [
      '立刻催吐（仅限意识清醒者）：喝温盐水，刺激咽喉',
      '保留样本：剩余的菌、呕吐物，方便医生鉴定',
      '马上就医或拨打 120，告诉医生「吃了野生菌」，同食者一起去',
      '症状缓解不等于痊愈，剧毒鹅膏有「假愈期」'
    ]
  }
};

// ---------------------------------------------------------------------
// English overrides + the retag mechanism. Every label/note/desc dictionary
// above stays the single source of truth *shape*-wise; this block only ever
// overwrites leaf text values in place, so every existing "C.rarityLabels[r]"
// style call site elsewhere in the app keeps working untouched regardless of
// which language is live — nothing outside this file needs to know a
// language switch happened.
var I18N_EN_OVERRIDES = {
  "rarityLabels": {
    "common": "Common",
    "rare": "Rare",
    "epic": "Epic",
    "legend": "Legendary"
  },
  "encounterLabels": {
    "common": "Common",
    "occasional": "Occasional",
    "rare": "Rare",
    "seldom": "Rarely Seen"
  },
  "quiz": {
    "levels": {
      "beginner": {
        "label": "🍄 New Forager"
      },
      "intermediate": {
        "label": "🧺 Foraging Enthusiast"
      },
      "expert": {
        "label": "🔬 Mycologist"
      }
    }
  },
  "biomes": {
    "pine": {
      "label": "🌲 Pine Forest",
      "desc": "Matsutake, Saffron Milk Cap, Blue-staining Bolete, Boletes"
    },
    "broadleaf": {
      "label": "🌳 Broadleaf Forest",
      "desc": "Chanterelle, Quilted Green Russula, Amanita, Ganbajun"
    },
    "deadwood": {
      "label": "🪵 Deadwood",
      "desc": "Wood Ear, Oyster Mushroom, Reishi, Glowing Mycena"
    },
    "meadow": {
      "label": "🌾 Meadow",
      "desc": "Puffball, Inky Cap, Fairy Ring Mushroom, Lawn Toadstools"
    }
  },
  "weather": {
    "sunny": {
      "label": "☀️ Sunny"
    },
    "cloudy": {
      "label": "☁️ Cloudy"
    },
    "rain": {
      "label": "🌧 Rain"
    },
    "rainAfter": {
      "label": "🌈 After Rain"
    }
  },
  "milestones": [
    {
      "title": "New Forager"
    },
    {
      "title": "Foraging Enthusiast"
    },
    {
      "title": "Mountain Regular"
    },
    {
      "title": "Fungi Observer"
    },
    {
      "title": "Spore Hunter"
    }
  ],
  "dailyTasks": [
    {
      "label": "Answer 10 questions correctly"
    },
    {
      "label": "Forage 3 times"
    },
    {
      "label": "Water 3 times"
    },
    {
      "label": "Identify 1 toxic species"
    }
  ],
  "edibility": {
    "cultivated": {
      "label": "🍽 Cultivated Edible",
      "note": "A commercially cultivated edible fungus. Buy wild specimens only through reputable, regulated sources."
    },
    "wild_edible": {
      "label": "🍽 Reported Edible (Wild)",
      "note": "Reference sources describe this as an edible wild fungus. This guide provides no basis whatsoever for foraging or consumption."
    },
    "conditional": {
      "label": "🔥 Edible With Preparation",
      "note": "Sources report it requires expert processing before it can be eaten; cases of poisoning from improper handling have been recorded."
    },
    "medicinal": {
      "label": "💊 Medicinal",
      "note": "Traditionally used as a medicinal ingredient, not as food."
    },
    "inedible": {
      "label": "❓ Inedible",
      "note": "Non-toxic, but woody or intensely bitter in texture — not eaten as food."
    },
    "unknown": {
      "label": "❓ Edibility Unknown",
      "note": "Edibility is unknown and should be treated as poisonous."
    },
    "poisonous": {
      "label": "⚠️ Poisonous",
      "note": "Reference sources list this as a poisonous mushroom."
    },
    "deadly": {
      "label": "☠️ Deadly Poisonous",
      "note": "Reference sources describe this as highly toxic, with recorded fatalities."
    }
  },
  "labels": {
    "substrate": {
      "wood": "Wood",
      "soil": "Soil",
      "grass": "Grassland",
      "litter": "Leaf Litter",
      "mycorrhizal": "Mycorrhizal",
      "termite": "Termite Mound",
      "insect": "Insects",
      "parasitic": "Parasitic",
      "conifer_cone": "Conifer Cone"
    },
    "spore": {
      "white": "White",
      "cream": "Cream",
      "pink": "Pink",
      "brown": "Brown",
      "rusty": "Rusty Brown",
      "purple_brown": "Purple-brown",
      "black": "Black",
      "green": "Green",
      "olive": "Olive",
      "lilac": "Lilac"
    },
    "hymenium": {
      "gills": "Gills",
      "pores": "Pores",
      "teeth": "Teeth",
      "ridges": "Ridges",
      "smooth": "Smooth",
      "gleba": "Gleba"
    },
    "silhouette": {
      "umbrella": "Umbrella",
      "funnel": "Funnels, Trumpets & Cups",
      "shelf": "Shelf Brackets",
      "ball": "Balls & Lumps",
      "coral": "Corals & Branches",
      "club": "Clubs & Fingers",
      "brain": "Brains & Honeycombs",
      "jelly": "Ears & Jellies"
    },
    "color": {
      "white": "White",
      "yellow": "Yellow",
      "orange": "Orange",
      "red": "Red",
      "brown": "Brown",
      "grey": "Grey",
      "black": "Black",
      "purple": "Purple",
      "green": "Green"
    },
    "capSurface": {
      "smooth": "Smooth",
      "scaly": "Scaly",
      "warty": "Warty & Patchy",
      "slimy": "Slimy When Wet",
      "fibrous": "Fibrous & Streaky"
    },
    "size": {
      "small": "Small, up to 5 cm",
      "medium": "Medium, 5–15 cm",
      "large": "Large, over 15 cm"
    }
  },
  "share": {
    "footer": "For education and entertainment only · Never forage wild mushrooms based on this game"
  },
  "safety": {
    "banner": "Every ‘edible / poisonous’ label in this guide simply repeats publicly available sources. It cannot be used for field identification, and must never serve as grounds for foraging. Do not pick, buy, or eat wild mushrooms.",
    "detail": "The same species can be described differently across regions and stages of maturity, and countless look-alike species cannot be told apart by eye. Never use the information on this page to judge whether a real mushroom is safe to eat.",
    "emergency": [
      "Induce vomiting immediately (conscious victims only): drink warm salted water and stimulate the throat.",
      "Save samples: keep the remaining mushroom and any vomit to help doctors identify the species.",
      "Seek medical care immediately or call 120 (China's emergency medical number); tell the doctor ‘wild mushrooms were eaten’ and bring everyone who ate them.",
      "Symptom relief does not mean recovery — deadly Amanita poisoning has a deceptive ‘false recovery’ phase."
    ]
  }
};

// Snapshot of the *original* (Chinese) values at the same paths, captured
// once before any retag() call, so switching back to Chinese is a real
// restore rather than "whatever the object happens to hold right now".
function _i18nSnapshot(overrides, live) {
  if (Array.isArray(overrides)) {
    return overrides.map(function (item, i) {
      return (item && typeof item === 'object' && !Array.isArray(item))
        ? _i18nSnapshot(item, live[i]) : live[i];
    });
  }
  var out = {};
  Object.keys(overrides).forEach(function (k) {
    var v = overrides[k];
    out[k] = (v && typeof v === 'object') ? _i18nSnapshot(v, live[k]) : live[k];
  });
  return out;
}
var I18N_ZH_OVERRIDES = _i18nSnapshot(I18N_EN_OVERRIDES, GameConfig);

function _i18nApply(live, overrides) {
  if (Array.isArray(overrides)) {
    overrides.forEach(function (item, i) {
      if (!live[i]) return;
      if (item && typeof item === 'object' && !Array.isArray(item)) _i18nApply(live[i], item);
      else live[i] = item;
    });
    return;
  }
  Object.keys(overrides).forEach(function (k) {
    var v = overrides[k];
    if (v && typeof v === 'object') _i18nApply(live[k], v);
    else live[k] = v;
  });
}

/** Swap every retaggable label/note/desc in place. Call at boot and on every
 *  language switch — cheap (a few dozen leaf assignments), and every module
 *  that reads GameConfig.rarityLabels / .edibility / .labels / .biomes /
 *  .weather / .milestones / .dailyTasks / .share / .safety picks the new
 *  values up for free since they all hold the *same* object references. */
GameConfig.retag = function (lang) {
  _i18nApply(GameConfig, lang === 'en' ? I18N_EN_OVERRIDES : I18N_ZH_OVERRIDES);
};
