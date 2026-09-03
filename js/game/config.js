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
  siteUrl: 'https://mushroomid.example',

  rarities: ['common', 'rare', 'epic', 'legend'],
  rarityLabels: { common: '普通', rare: '稀有', epic: '珍稀', legend: '传说' },
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
      return [
        ['学名', e.latin],
        ['科', e.family],
        ['生境', e.habitat],
        ['基质', GameConfig.labels.substrate[e.substrate] || e.substrate],
        ['孢子印', GameConfig.labels.spore[e.sporePrint] || '—'],
        ['季节', (e.season || []).length >= 10 ? '全年' : (e.season || []).join('、') + ' 月']
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
    banner: '本图鉴为收集类科普游戏，所有「食用 / 有毒」标签仅转述公开资料，不能用于野外鉴定，更不能作为采食依据。野生蘑菇不采、不买、不吃。',
    detail: '同一种蘑菇在不同地区、不同成熟度可能有不同记载，且存在大量肉眼无法区分的相似种。请勿凭本页信息判断真实蘑菇能否食用。',
    emergency: [
      '立刻催吐（仅限意识清醒者）：喝温盐水，刺激咽喉',
      '保留样本：剩余的菌、呕吐物，方便医生鉴定',
      '马上就医或拨打 120，告诉医生「吃了野生菌」，同食者一起去',
      '症状缓解不等于痊愈，剧毒鹅膏有「假愈期」'
    ]
  }
};
