# fishId 架构分析报告 — 面向 mushroomId 复用评估

> 分析对象：`/home/user/fishId`（纯前端，原生 HTML/CSS/JS + localStorage，零构建）
> 分析日期：2026-09-02
> 结论先行：**主游戏骨架（路由 / 存档 / 答题 / 抽卡 / 碎片经济 / 分享 / i18n / 音效）约 70% 可以直接或改名复用；tank.js（鱼缸 Canvas）和 4 个小游戏 HTML 是纯海洋主题，基本不可复用。** 最大的技术债不在代码而在数据层：`data.js` / `fish_data.js` / `questions.js` 三份数据已经分叉，工具链和运行时指向不同的"真相源"。

---

## 1. 模块地图

### 1.1 加载顺序与依赖

`index.html:566-574` 用 `<script defer>` 顺序加载 9 个文件，**每个文件都是一个 IIFE 挂成全局常量，没有 import/export，靠加载顺序保证依赖可用**：

```
i18n.js       → I18n            （无依赖；异步 fetch locales/*.json）
fish_data.js  → FISH_DATA[270]  （纯数据）
questions.js  → QUESTIONS[1087] （纯数据）
storage.js    → Storage         （无依赖）
sound.js      → Sound           （依赖 DOM #bgm-player / #btn-music-toggle / #setting-sound）
quiz.js       → EXTRA_EN, qLang, Quiz   （依赖 FISH_DATA, QUESTIONS, Storage, Sound, I18n, showPage, Gacha）
gacha.js      → Gacha           （依赖 FISH_DATA, QUESTIONS, Storage, Sound, I18n, showPage, rarityLabel, ShareUtils, checkMilestone）
tank.js       → Tank            （依赖 FISH_DATA, Sound, I18n）
app.js        → 约 55 个顶层全局（见 §6.2）
```

依赖方向图（谁调用谁）：

```
app.js ──► Storage / Sound / I18n / Quiz / Gacha / Tank / ShareUtils / FISH_DATA / QUESTIONS
quiz.js ──► Storage.getDifficulty/getImageCount/recordQuiz/updateDailyTaskProgress
        ──► Gacha.startResult(wrong, correct)   [quiz.js:389]
        ──► showPage('gacha')                    [quiz.js:388]  ← 反向依赖 app.js
gacha.js ──► Storage.load/save/addFragment/addEssence/addNewFish/hasCollected
         ──► showPage('tank')                    [gacha.js:445, 459, 470] ← 反向依赖 app.js
         ──► checkMilestone()                    [gacha.js:457] ← 反向依赖 app.js
         ──► ShareUtils.fish/challenge           [gacha.js:379, 383] ← 反向依赖 app.js
tank.js ──► FISH_DATA.find (preloadImages, makeFish)  [tank.js:322, 646]
        ──► Sound.play('wrong') / Sound.switchBGM     [tank.js:854, 1128]
        ──► I18n.t                                    [tank.js:1129]
```

**注意反向依赖**：quiz.js / gacha.js 直接调用 app.js 里定义的 `showPage`、`rarityLabel`、`checkMilestone`、`ShareUtils`，而 app.js 又在它们之后加载。这能工作只是因为调用发生在事件回调里（运行时晚于加载时）。抽通用层时这是第一个要斩断的环。

### 1.2 各文件职责与对外接口

| 文件 | 行数 | 对外暴露 | 职责 |
|---|---|---|---|
| `js/i18n.js` | 83 | `I18n.{t, setLanguage, getLocale, applyDOM, ready}` | 语言检测（`localStorage.fish_lang` → `navigator.language`）、fetch `locales/{zh,en}.json`、`[data-i18n]` DOM 替换、`langchange` 事件 |
| `js/storage.js` | 191 | `Storage.{KEY, defaultData, init, load, save, addCollection, hasCollected, addFragment, addEssence, addToTankSlots, removeFromTankSlots, spendEssence, addNewFish, recordQuiz, get/setDifficulty, get/setImageCount, updateDailyTaskProgress, getDailyChallenge, saveDailyChallenge}` | `fgame_v1` 读写 + 每日重置 + 迁移 |
| `js/sound.js` | 535 | `Sound.{init, play(name,...args), switchBGM, pauseBGM, resumeBGM}` | Web Audio 合成 16 个音效（`click/correct/wrong/tick/voyageStart/gachaReveal/gachaCommon/Rare/Epic/Legend/newFish/enterTank/feed/cardFlip/fishClick/fragment`，sound.js:197-440），BGM `<audio>` 播放列表 |
| `js/quiz.js` | 404 | `Quiz.{prepare, start, stop}`，全局 `qLang(q)`, `EXTRA_EN` | 选题 `pickQuestions()`（quiz.js:175-213）、30s 倒计时、判题、答错卡片、结算跳转 |
| `js/gacha.js` | 200 | `Gacha.{startResult(wrong,correct), showDirect(fish)}` | 概率表 + 保底 + 选鱼 + 结算页渲染 + 放入鱼缸/分解 |
| `js/tank.js` | 1239 | `Tank.{refresh(collections), stop, onFeed}` | 鱼缸 Canvas（背景、装饰、鱼状态机、11 种行为、昼夜、互动） |
| `js/app.js` | 1918 | ~55 个顶层全局（详见 §6.2） | 路由、页面刷新、碎片/精华/宝箱/礼品码/每日任务/每日挑战/教程/分享/里程碑/存档迁移/小游戏 postMessage 桥接/统计上报 |

### 1.3 页面路由机制

- 页面 = `index.html` 里 10 个 `<div id="page-X" class="page">`，CSS `.page{display:none} .page.active{display:flex}`（style.css:43-52）。
- `PAGES` 白名单（app.js:23）、`NAV_PAGES`（app.js:24）决定底栏显隐。
- `showPage(pageId)`（app.js:62-143）：切 `.active` → 更新 `previousPage/currentPage` → 底栏/音乐按钮显隐 → **离开鱼缸时 `Tank.stop()`（app.js:98）** → 离开小游戏页时清空 iframe `src` 并 `Sound.resumeBGM()` → 进入页面时按需 `refreshTankPage / refreshCollectionPage / refreshProfilePage`。
- `goBack()`（app.js:145）只是 `showPage(previousPage)`，**单级历史，无栈**。从 tank → collection → fish-detail → back → collection → back → 回到 fish-detail（因为 previousPage 被覆盖），是个已知小坑。
- 不使用 hash/History API，浏览器后退键直接退出页面。

---

## 2. 数据模型

### 2.1 FISH_DATA 条目（fish_data.js:2-26）

| 字段 | 类型 | 说明 | 领域耦合 |
|---|---|---|---|
| `id` | string | 唯一键，全小写英文（`clownfish`） | 通用 |
| `name` / `nameEn` | string | 中文名 / 英文名 | 通用 |
| `aka` | string[] | 别名（详情页「又名」、图鉴搜索） | 通用 |
| `rarity` | `common\|rare\|epic\|legend` | 稀有度 | 通用 |
| `image_q` / `image_real` | path | Q 版图 / 真实照片，路径硬编码 `assets/fish/{cute,real}/{id}.webp` | 路径含 `fish` |
| `habitat` / `habitat_en` | string | 栖息地 | **语义领域化**（蘑菇→"生境/基质"） |
| `fact` / `fact_en` | string | 趣味知识 | 通用 |
| `quote` / `quote_en` | string | 拟人语录 | 通用 |
| `questions` | string[] | 该鱼关联题 ID | 通用 |
| `tankSize` | number 0.2–2.6 | 鱼缸内体型倍数，仅 tank.js:674 用 | **纯鱼缸耦合** |

270 条全部字段齐全（脚本核验：`nameEn`/`habitat_en`/`fact_en`/`quote_en` 缺失均为 0）。

### 2.2 QUESTIONS 条目（questions.js:2-24）

| 字段 | 类型 | 覆盖数 | 说明 |
|---|---|---|---|
| `id` | string | 1087 | `q_{fishId}_{02..05\|nfi}` |
| `fishId` | string | 1087 | 关联鱼（**字段名领域化**） |
| `type` | `name_from_image\|trivia\|cold_fact` | 270 / 576 / 241 | 题型 |
| `difficulty` | 1–5 | d1:57 d2:516 d3:170 d4:229 d5:115 | 见下表 |
| `question` / `q_en` | string | 1087 / 1087 | 题干 |
| `options` / `opts_en` | string[4] | 1087 / 1087 | 4 选项 |
| `answer` / `ans_en` | string | 1087 / 1087 | 答案（**按文本匹配**，quiz.js:332 `val === qLang(q).answer`） |
| `explanation` | string | 455 | 解析（**目前 UI 完全没用到**，答错时显示的是 `fish.fact`，quiz.js:362） |
| `image` | path | 116 | 仅早期题带，运行时不用（quiz.js:258 一律用 `fish.image_real`） |

题型 × 难度实际分布（脚本统计）：

| type | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| name_from_image | 57 | 169 | 44 | – | – |
| trivia | – | 347 | – | 229 | – |
| cold_fact | – | – | 126 | – | 115 |

`pickQuestions` 的配置（quiz.js:179-183）只请求 `(nfi, d1/2/3)`、`(trivia, d4)`、`(cold_fact, d5)`，所以 **d2 的 347 道 trivia 和 d3 的 126 道 cold_fact 共 473 道题在主流程里永远抽不到**（约占题库 43%）。这不是 bug，是难度重排后留下的死数据。

### 2.3 三份数据文件的关系 — 真相源已分叉

| 文件 | 行数 | 内容 | 谁在用 |
|---|---|---|---|
| `js/data.js` | 30293 | `FISH_DATA`(270, **无** `*_en` 三字段) + `QUESTIONS`(1087) | `test/run_tests.py:71`、`test/test_run.js:7`、`count_stats.py:5`、`update_difficulty.py:35`、`sync_questions.py:8`、`review_*.html`、`deploy_batch2.py:72` |
| `js/fish_data.js` | 6612 | `FISH_DATA`(270, 含 `habitat_en/fact_en/quote_en`) | **`index.html:567`（运行时）**、`idle.html:283` |
| `js/questions.js` | 24487 | `QUESTIONS`(1087) | **`index.html:568`（运行时）** |

脚本对比结果：
- FISH_DATA：两份共有字段 **0 处差异**，fish_data.js 是 data.js 的超集（多 3 个英文字段）。
- QUESTIONS：**144 道题的 `opts_en` 不同、34 道 `ans_en` 不同**。data.js 里有 145 个 `opts_en` 数组仍混着中文（如 `q_manta_nfi` 的 `opts_en: ['蝠(fú)鲼(fèn)', '蓝点魟(hóng)', ...]`），questions.js 已修正为 `['Manta Ray', 'Bluespotted Stingray', ...]`。
- `sync_questions.py` 的方向是 **data.js → questions.js**（注释写明"Extract translated QUESTIONS from data.js"）。**现在 questions.js 比 data.js 新，重跑该脚本会把 145 处修好的翻译打回去。**
- `catfish.html:446` 自带一份 `FISH200` 常量（约 221 条 `id:'…'`），**并不引用 fish_data.js**，CLAUDE.md 说"来自 js/fish_data.js"是错的。

**结论：运行时真相源 = `fish_data.js` + `questions.js`；工具链/测试真相源 = `data.js`。已分叉，且方向相反。** 这是 mushroomId 里最应该第一天就避免的坑（§7.1）。

---

## 3. localStorage 存档与迁移

### 3.1 主存档 `fgame_v1`（storage.js:6-28）

```js
{
  version: 1,                         // 常量，从未变过
  userId, createdAt,
  collections: [{fishId, count, firstAt}],
  tankSlots: string[≤10],
  fragments: {common, rare, epic, legend},
  fragmentEssence: number,
  pityCount: {epic, legend},
  dailyVoyages: {date, free:50, ad:0},   // ad 字段无人读写（广告位遗留）
  feedData: {hour, count:10},
  stats: {totalQuestions, correctAnswers, playDays},  // playDays 永远是 1，无人递增
  flags: {milestones: number[]},
  difficulty: 'beginner'|'intermediate'|'expert',
  imageCount: 1-5,
  usedCodes: string[], bonusChests, lastChest: 'YYYY-MM-DD',
  dailyChallenge: {date, score, results} | null,
  dailyTasks: {date, progress:{correct,voyage,feed}, claimed:{}}
}
```

### 3.2 迁移方式：无版本号、逐字段补丁

`Storage.init()`（storage.js:30-58）每次启动执行：
- `dailyVoyages.date !== today` → 重置（:34）
- `!data.tankSlots` → 从 collections 取前 10（:40）
- `!data.dailyTasks || date 变` → 重置（:44）
- `boxfish → sharpnosepuffer` ID 重命名（:49-56）—— **鱼 ID 级迁移硬编码在存储层**

`version` 字段（:8）永远是 1，没有 `if (data.version < 2) {...}` 的阶梯式迁移。新增字段靠 `data.x || default` 在使用点兜底（如 app.js:1707 `if (!data.flags) data.flags = {}`）。

### 3.3 分散在主存档之外的 key（共 9 个）

`fgame_v1`, `fish_lang`, `fish_sound_enabled`, `fish_tutorial_done`, `fish_tank_hint_shown`, `fish_game_rewards`, `fishstats_uid`, `fishstats_day`，加上小游戏各自的 `fish_bbq_v1 / fish_catfish_v1 / fish_idle_v1`。**`SaveTransfer.exportSave`（app.js:1816）只导出 `fgame_v1`**，迁移设备后语言、教程、小游戏进度全部丢失。

### 3.4 读写模式

`Storage.load()` 每次 `JSON.parse` 整个存档；app.js 调了 20 次、gacha.js 2 次。没有内存缓存，也没有事务——`btn-voyage` 点击（app.js:671-689）先 `load()` 再 `updateDailyTaskProgress`（内部又 load/save）再 `save(data)`，**后一个 save 用的是前面的旧快照，中间 `updateDailyTaskProgress` 写入的 progress 会被覆盖**。实际没出问题只是因为 `updateDailyTaskProgress` 改的 `dailyTasks.progress` 对象与 `data` 快照里的是同一次 parse... 不，是两次独立 parse。看代码：`data.dailyVoyages.free--`（:682）→ `Storage.updateDailyTaskProgress('voyage', 1)`（:683，内部 load→改→save）→ `Storage.save(data)`（:684，用的是 :672 的旧快照，其 `dailyTasks.progress.voyage` 还是旧值）。**这是一个真实的竞态 bug：出海任务进度会被立即回滚。** 同样模式见 `btn-feed`（app.js:716-729）。建议 mushroomId 的 Storage 改成"内存单例 + 显式 commit"。

---

## 4. 核心循环与各子系统入口

### 4.1 主循环

| 阶段 | 入口 | 关键逻辑 |
|---|---|---|
| 出海 | `#btn-voyage` click → app.js:671 | 次数扣减；≤0 时**免费再送 50**（:673-679，等于无限）；`Sound.play('voyageStart')`；`_reportStat('voyage')` |
| 过场 | `startVoyage()` app.js:691-712 | 建 `.voyage-overlay` DOM，2.5s；期间 `Quiz.prepare()` 预选题 + 预载图 |
| 答题 | `Quiz.start()` quiz.js:229 → `showQuestion()` :248 | 每题 30s（**SYSTEM.md 写 15s，文档过时**）；`onAnswer` :327；答错 `showWrongInfo` :348 显示 `fish.habitat + fish.fact`（不是题目的 `explanation`） |
| 结算 | `advance()` quiz.js:381 → `Storage.recordQuiz` → `showPage('gacha')` → `Gacha.startResult(wrong, correct)` | |
| 抽卡 | `Gacha.startResult` gacha.js:401 | `rollRarity(wrong, pity)` :294 → `updatePity` :306 → `wrong>=3 ? addFragment : pickFish→selectFish` |
| 入缸 | `#btn-enter-tank` gacha.js:444 | 重复 → `Storage.addEssence`；新 → `Storage.addNewFish`（自动进 tankSlots 若 <10）→ `checkMilestone` → `showPage('tank')` |

`pickFish`（gacha.js:320）有个隐藏耦合：它用 `FISH_DIFF_MAP`（从 `name_from_image` 题的 difficulty 反推每条鱼的"难度"）**优先抽取与当前难度匹配的鱼**。即鱼池是按题库难度分层的，鱼本身没有难度字段。

### 4.2 子系统要点

| 子系统 | 位置 | 要点 |
|---|---|---|
| 碎片合成 | `synthesize(rarity)` app.js:506 | 5 碎片 → 同稀有度随机鱼 → `Gacha.showDirect(fish)` 走完整仪式 |
| 精华商店 | `openEssenceShop` app.js:544 / `confirmEssenceExchange` :584 | `ESSENCE_COST` :523；渲染同稀有度全部鱼、已拥有置灰 |
| 精华来源 | `Storage.addEssence` storage.js:100 | `ESSENCE_VALUE` 在 storage.js:101 和 gacha.js:280 **重复定义** |
| 每日宝箱 | `openChest` app.js:429 | `WEIGHTS` :442 与 gacha `TABLES.normal` 数值相同但独立写；5 个碎片；`bonusChests` 优先 |
| 礼品码 | `GIFT_CODES` app.js:958 / `redeemGiftCode` :990 | 明文硬编码 24 个码，每码 5 宝箱，`usedCodes` 防重 |
| 每日任务 | `DAILY_TASKS_DEF` app.js:56 / `renderDailyTasks` :317 / `claimDailyTask` :345 | 进度由 `Storage.updateDailyTaskProgress` 累加（quiz.js:387, app.js:683/728） |
| 里程碑 | `MILESTONES` app.js:1699 / `checkMilestone` :1705 | 阈值 `[10,25,50,100,150,200,270]`，**270 硬编码 = 鱼总数**；触发在 gacha.js:457 |
| 每日挑战 | app.js:1121-1268 | 日期做 LCG 种子选 3 鱼（:32-48），**复用 quiz 页 DOM 但绕过 Quiz 模块**（`window._dcActive` 旗标 quiz.js:398 / app.js:1885 双监听） |
| 分享 | `ShareUtils` app.js:1272-1695 | 5 个 Canvas 生成器（fish/tank/milestone/challenge/dailyChallenge），2×DPR，`navigator.share` 降级下载；深蓝海洋渐变 `#0A2A4A→#0D3B5E` 和 `fishid.ai-speeds.com` 域名硬编码 5 处 |
| 存档迁移 | `SaveTransfer` app.js:1798 | AES-GCM + PBKDF2，`APP_SECRET`/`SALT`/`MAGIC='FGAME1'` 硬编码；btoa 循环拼接（:1830-1832）已规避 Safari 问题 |
| 小游戏桥 | `window.addEventListener('message')` app.js:1026 | 校验 `e.origin === location.origin`；`FISH_GAME_WIN / BBQ_RUSH_COMPLETE / CATFISH_COMPLETE / *_REQUEST_COLLECTION` |
| 统计上报 | app.js:4-21 | `fetch(BASE+'/api/stats/event')` —— **项目声称"无后端"但有一个后端 endpoint**，域名硬编码 |

---

## 5. 通用性评估（逐模块打分）

评级：**A 可直接复用** / **B 改名换皮即可** / **C 需重写** / **D 不适用**

| 模块 | 评级 | 理由 |
|---|---|---|
| `i18n.js` | **A** | 零领域词汇。唯一改动：`localStorage` key `fish_lang`（i18n.js:7, 49）和 fetch 路径的 `?v=` 版本号硬编码（:35, 45）。建议把 key 改成参数。 |
| `storage.js` | **B** | 逻辑通用，但字段名 `fishId`、`tankSlots`、`addNewFish`、`addToTankSlots`、`dailyVoyages`、`feedData` 全是领域词；`boxfish→sharpnosepuffer` 迁移（:49-56）要删；`KEY:'fgame_v1'` 改。建议抽成 `Storage(config)` 工厂，把 `KEY`、默认值、每日重置规则注入。 |
| `gacha.js` 概率/保底核心（:289-318） | **A** | `TABLES`、`rollRarity`、`updatePity` 完全领域无关，30 行可原样搬走。 |
| `gacha.js` 其余（:320-473） | **B** | `pickFish` 依赖 `FISH_DATA` + `FISH_DIFF_MAP`；`selectFish` 硬编码 12 个 DOM id（`gacha-fish-name`、`btn-enter-tank`…）和字段 `habitat/quote/fact/image_real`。改名 + 把 DOM id 抽成配置即可。 |
| `quiz.js` 选题 `pickQuestions`（:175-213） | **A-** | 算法本身与鱼无关（按 type/difficulty 槽位抽题、去重同实体）。唯一耦合是 `q.fishId`（:201, 209）→ 改成 `q.entityId`。**但难度配置表（:179-183）把 `beginner/intermediate/expert` 映射到具体 type/difficulty 组合，这是策划配置，应外提。** |
| `quiz.js` 渲染（:248-378） | **B** | `FISH_DATA.find`（:258, 269, 288, 350）、`fish.image_real`、`EXTRA_EN` 表（:1-155，是给旧题目选项补英文名的临时 hack，mushroomId 不需要）、DOM id `wrong-fish-*`。 |
| `tank.js` | **C/D** | 1239 行中：装饰系统（海草/珊瑚/礁石/浮游生物 :331-369）、背景（水体渐变/光柱/焦散 :372-566）、泡泡（:567）、11 种鱼行为（`FISH_BEHAVIOR` :23-289 是 216 条鱼 ID 的硬编码映射）、状态机（:741-1056）全部是海洋语义。**可保留的骨架约 15%**：`refresh/stop/loop` 结构（:1147-1207）、昼夜 `skyBlend` 插值（:305-317, 1187-1191）、点击命中检测（:1094-1119）、长按/摇晃（:1121-1144）、`RARITY_STYLE` 概念（:291）。蘑菇「菌菇园」是静态生长物，没有游动、受惊、追食，**行为模型要从头设计**（生长阶段 / 孢子粒子 / 昼夜荧光 / 露珠？）。建议不迁移，写新的 `garden.js`。 |
| `sound.js` 合成原语（:15-196） | **A** | `tone/toneRev/playNoise/waterDrop/bubble/sparkle/getReverb/makeDelay` 是通用合成器。 |
| `sound.js` 音效集（:197-440） | **B** | 16 个音效命名（`voyageStart/enterTank/feed/fishClick`）和音色（水滴/气泡/水下混响）都是海洋质感；蘑菇森林应换成木质/风铃/沙沙声。API `play(name)` 和 BGM 播放列表结构（:454-478）保留。`localStorage` key `fish_sound_enabled`（:447）改。 |
| `app.js` 路由 `showPage/goBack`（:23-147） | **B** | 通用，但 `PAGES` 列表、iframe 卸载分支（:101-116, 122-142）与 4 个小游戏绑死。建议改成 `pageHooks = {onEnter, onLeave}` 注册表。 |
| `app.js` 碎片/精华/宝箱/礼品码/每日任务（:317-598, :956-1020） | **B** | 全部只依赖 rarity 四档 + Storage，改名即可。`GIFT_CODES` 换新码。 |
| `app.js` 图鉴/详情页（:218-314, :602-667） | **B** | 依赖 `FISH_DIFF_MAP` 分组、`image_q`、`tankSlots`。「按题目难度分组展示」这个设计对蘑菇可能不合适（蘑菇更自然按科/属或可食性分组）。 |
| `app.js` `ShareUtils`（:1272-1695） | **B** | 布局代码通用；要改：深蓝渐变 5 处、域名 5 处、🐠 fallback emoji 3 处、`fish-card.png` 文件名、`MILESTONE_TEXTS` 里的 270。 |
| `app.js` `SaveTransfer`（:1798-1880） | **A** | 改 3 个常量（`APP_SECRET`、`SALT`、`MAGIC`）和文件后缀 `.fish` 即可。 |
| `app.js` `Tutorial`（:821-954） | **B** | 结构通用；文案全在 locales 里。 |
| `app.js` 每日挑战（:31-48, :1121-1268） | **B** | 种子选实体的算法通用；但它绕过 Quiz 模块直接操作 quiz 页 DOM，抽通用层时应合并进 Quiz（作为"固定题序模式"）。 |
| `app.js` 小游戏桥接（:1022-1119） | **D** | 4 个小游戏（bbq/catfish/idle/game，共 ~360KB）全是鱼主题，不迁移。桥接协议（`postMessage` + origin 校验 + 奖励表）模式可参考。 |
| `css/style.css` | **B** | 2319 行；403 个选择器中 72 个含 `fish/tank/voyage/feed/ocean/sea/wave`。配色变量（:2-25）、页面切换（:42-56）、header/nav/toast/overlay/卡片体系可直接用；`.tank-*`、`.fish-card`、`.wrong-fish-*` 改名；`.album-*/.btn-upload/.fish-select`（:1441-1548）是**死 CSS**（index.html 和 app.js 均无引用），直接删。 |
| `locales/*.json` | **B** | 247 键 zh/en 完全对齐。约 40% 键名含 `tank/fish/voyage/feed`，值几乎全部要重写。 |
| `index.html` | **B** | 10 个 page div 的骨架保留；SEO/OG/JSON-LD 块（:8-46）换内容；4 个 iframe 页删掉。 |
| 数据文件 | **C** | schema 可以照抄（§7.3 映射表），内容全换。 |
| Python 工具链 | **B** | `serve.py`、`compress_images.py`、`process_cute_batch.py`（rembg 去背景）、`process_real.py`（水印）、`photo_picker.html`、`review_questions.html` 都是通用素材流水线，改路径即可。 |
| `test/` | **C** | 见 §6.4。 |

---

## 6. 代码质量与技术债

### 6.1 数据层

1. **三份数据分叉**（§2.3）—— 最严重。`data.js` 30293 行 + `fish_data.js` 6612 行 + `questions.js` 24487 行 = 61k 行，其中 30k 是过期副本，仍被测试和 7 个脚本引用。
2. `data.js` 单文件 30k 行，Edit 工具和 git diff 都很痛苦；CLAUDE.md 特意警告"严禁 VS Code 保存"就是因为它。
3. 43% 题目（d2 trivia / d3 cold_fact）在主流程不可达（§2.2）。
4. `explanation` 字段 455 条从未在 UI 展示。
5. 答案按**文本匹配**（quiz.js:332），且中英文答案是两套字符串——任何改名都要同步 4 处（`options/answer/opts_en/ans_en`）。应改成索引匹配 `answerIndex`。
6. `image` 字段（116 条）已废弃但未清理。

### 6.2 全局命名空间

`app.js` 向 `window` 挂了 **55 个顶层标识符**（`PAGES, NAV_PAGES, currentPage, previousPage, _catfishBest, dailySeed, getDailyFish, FISH_DIFF_MAP, DAILY_TASKS_DEF, DAILY_TASKS, showPage, goBack, refreshTankPage, _lastCollectionHash, _collFilter, _searchDebounceTimer, refreshCollectionPage, renderDailyTasks, claimDailyTask, refreshProfilePage, openChest, synthesize, ESSENCE_COST, RARITY_LABELS, RARITY_META, showToast, openEssenceShop, confirmEssenceExchange, openFishDetail, updateDetailTankBtn, startVoyage, rarityLabel, TUTORIAL_SLIDES, Tutorial, GIFT_CODES, redeemGiftCode, GAME_RARITY, handleBBQComplete, handleCatfishComplete, window._dcActive, _dcFish, _dcIdx, _dcAnswers, _dcDate, _dcPickOptions, startDailyChallenge, _dcShowQuestion, dcOnAnswer, _dcAdvance, _dcFinish, ShareUtils, MILESTONES, MILESTONE_LABELS, checkMilestone, showMilestoneOverlay, SaveTransfer`），加上 quiz.js 的 `EXTRA_EN, qLang`。其他模块各 1 个 IIFE 全局，还算克制。

### 6.3 重复定义（改一处漏一处的风险）

| 常量 | 位置 |
|---|---|
| `FISH_DIFF_MAP` 构建 | gacha.js:283-286 **和** app.js:51-54（完全相同的 5 行） |
| `ESSENCE_VALUE` | storage.js:101、gacha.js:280 |
| 稀有度权重 60/30/8/2 | gacha.js:290（TABLES.normal）、app.js:442（openChest WEIGHTS）、app.js:879-882（教程表格文案） |
| 稀有度颜色 | style.css:14-18（CSS 变量）、app.js:1273（ShareUtils）、app.js:879-882（Tutorial） |
| 鱼名双语取值 `_en && f.nameEn ? f.nameEn : f.name` | gacha.js:354、quiz.js:262/354、app.js:266/567/610/1131/1174/1214/1381/1568/1655、tank.js:1106 —— **13 处**手写，没有 `fishName(f)` helper |
| 站点 URL | app.js:5、:1316、:1401、:1430、:1485、:1583、:1686、index.html:389 |

### 6.4 测试

- `test/run_tests.py`（311 行，48 个断言，**当前全部通过**）：纯 Python 正则/字符串检查——数据完整性 + "某字符串是否存在于 html"。**读的是过期的 `data.js`**（:71），对运行时真正加载的 `fish_data.js/questions.js` 零覆盖。
- `test/test_run.js`：**已坏**——`assert(FISH_DATA.length === 8)`（:30）、`fish.questions.length === 4`（:40），是 MVP 时代遗物。
- `test/test_run.py`、`test_achievements.py`、`sim_bbq.py`：Playwright 驱动 bbq.html，与主游戏无关。
- `test/test.html`（55KB）：早期单文件原型，与现在代码无关。
- **主游戏的 quiz / gacha / storage / 路由没有任何行为测试。** `rollRarity`/`updatePity`/`pickQuestions` 都是纯函数，本来最容易测。

### 6.5 运行时坑

1. **i18n 竞态**：`TUTORIAL_SLIDES`（app.js:821-863）和 `Tutorial.RARITY_ROWS`（:878-883）在脚本加载时同步调用 `I18n.t()`，而 `I18n.ready` 的 `fetch('locales/zh.json')` 是异步的（i18n.js:33-40）。`I18n.t` 在字典为空时返回 key 本身（i18n.js:14）。若 JSON 还没回来（慢网络、首次无缓存），首访用户的教程会显示 `tutorial.s1_title` 这样的原始 key。app.js 中**没有任何 `langchange` 监听**去重建这些常量，切换语言后教程/稀有度表也不会更新。
2. **存档覆盖竞态**（§3.4）：`btn-voyage`（app.js:671-689）和 `btn-feed`（:716-729）先 `load()` 快照、中间调 `updateDailyTaskProgress`（内部独立 load/save）、最后 `save(旧快照)`，**每日任务进度被回滚**。
3. `goBack()` 单级历史（§1.3）。
4. `Storage.init` 每次启动把 `dailyVoyages.free` 钳到 50（storage.js:36），而 `btn-voyage` 在 0 时又送 50（app.js:673-679），出海次数实际上无限——CLAUDE.md 描述的"每日出海次数"机制形同虚设。
5. `stats.playDays` 从未递增（永远 1）；`dailyVoyages.ad` 从未使用。
6. `tank.js:854` 章鱼喷墨借用 `Sound.play('wrong')`。
7. `debug_storage.html` **已被 git 跟踪**（`git ls-files` 含它），CLAUDE.md 说"勿部署到线上"但没有 `.gitignore`/部署排除机制，靠人记。
8. `app.js:4-21` 统计上报 endpoint 硬编码 `https://fishid.ai-speeds.com/api/stats/event`，本地开发时每次启动都会发一个失败的跨域请求（有 `.catch`，无害但噪声）。
9. 文档漂移：SYSTEM.md 写 15s 倒计时（实际 30s，quiz.js:300）、catfish 10 关（实际 100）、出海 9999（实际 50）、礼品码 4 个（实际 24）；CLAUDE.md 说 catfish 用 fish_data.js（实际内嵌）。CLAUDE.md 51KB 已经变成变更日志而非架构文档。
10. 编码：项目所有 Python 脚本都 `sys.stdout.reconfigure(encoding='utf-8')` + `open(..., encoding='utf-8')`，index.html 以 BOM 开头（`﻿<!DOCTYPE`，index.html:1）——这是 Windows 环境的痕迹，Linux/nginx 下无害但最好去掉。
11. 死 CSS ~110 行（style.css:1441-1548 相册/上传）。
12. `catfish.html` 内嵌 221 条鱼数据副本，与 FISH_DATA 改名不同步。

### 6.6 安全/健壮性（小项）

- `innerHTML` 大量拼接鱼名/题目（app.js:267, 276, 570; quiz.js:290）——数据是静态可信的，但 `EXTRA_EN` 键里有 `'蠵(xī)龟 <- 这个是答案'`（quiz.js:119）这种调试残留，说明数据没经过校验管道。
- 礼品码明文（app.js:958）——任何人 view-source 即得。若 mushroomId 也用礼品码，至少存 hash。
- `SaveTransfer` 密钥硬编码（app.js:1799-1801），CLAUDE.md 已明确定位为"防误操作不防破解"，OK。

---

## 7. 给 mushroomId 的具体建议

### 7.1 第一天就做对的三件事

1. **单一数据真相源**：只保留 `data/mushrooms.json` + `data/questions.json`（纯 JSON，不是 JS），运行时 `fetch` 或用一个 5 行的 `build_data.py` 生成 `js/data.gen.js`。所有脚本/测试读 JSON，运行时读生成物，生成物进 `.gitignore` 或标记 `// GENERATED`。fishId 的分叉就是因为"JS 常量文件既是源码又是数据"。
2. **答案用索引不用文本**：`{options:[...], answerIndex: 0}`，中英文只是 `options_zh/options_en` 两个数组，答案下标共享。
3. **Storage 改内存单例 + 版本迁移表**：
   ```js
   const MIGRATIONS = { 1: d => {...}, 2: d => {...} };
   function migrate(d){ while (d.version < CURRENT) MIGRATIONS[++d.version](d); }
   ```
   避免 §3.4 的快照覆盖 bug。

### 7.2 建议目录结构

```
mushroomId/
├── index.html
├── css/
│   ├── core.css          ← 从 style.css 抽：变量/重置/page/header/nav/toast/overlay/卡片/按钮（≈900 行）
│   └── theme.css         ← 蘑菇配色 + garden 页 + 领域选择器
├── js/
│   ├── core/             ← "collection-game core"，禁止出现领域词
│   │   ├── i18n.js       ← 原样，key 参数化
│   │   ├── storage.js    ← 工厂 + 迁移表
│   │   ├── router.js     ← showPage/goBack 改成历史栈 + pageHooks 注册
│   │   ├── quiz.js       ← pickQuestions(config) + 渲染，实体字段通过 adapter 取
│   │   ├── gacha.js      ← rollRarity/updatePity/pickEntity + 结算渲染
│   │   ├── economy.js    ← 碎片/精华/宝箱/礼品码/每日任务（从 app.js 抽 :317-598, :956-1020）
│   │   ├── milestone.js
│   │   ├── share.js      ← ShareUtils，主题色/域名/emoji 从 config 读
│   │   ├── transfer.js   ← SaveTransfer
│   │   ├── sound.js      ← 合成原语 + play(name) 注册表
│   │   └── tutorial.js
│   ├── game/             ← 领域层
│   │   ├── config.js     ← 见 7.4
│   │   ├── garden.js     ← 新写，替代 tank.js
│   │   ├── sfx.js        ← 蘑菇音效集，注册到 Sound
│   │   └── app.js        ← 只剩 glue：init + 页面刷新函数 + 事件绑定（目标 <500 行）
│   └── data.gen.js       ← 生成物
├── data/
│   ├── mushrooms.json
│   └── questions.json
├── locales/{zh,en}.json
├── assets/mushroom/{cute,real}/
├── tools/                ← serve.py / compress / rembg / watermark / picker / review（改路径搬过来）
└── test/
    ├── data_check.py     ← 读 data/*.json（从 run_tests.py §1-2 改）
    └── core.test.js      ← rollRarity/updatePity/pickQuestions/migrate 的纯函数测试（node 直接跑）
```

### 7.3 命名/字段映射表

| fishId | mushroomId | 出处/备注 |
|---|---|---|
| `FISH_DATA` | `ENTITIES`（core）/ `MUSHROOM_DATA`（game） | core 层只认 `ENTITIES` |
| `fish.id / name / nameEn / aka / rarity / fact / quote` | 同名保留 | 通用 |
| `fish.habitat` | `mushroom.habitat`（生境：林地/草地/腐木）或拆 `substrate` | 语义仍成立 |
| `fish.image_q / image_real` | `image_cute / image_real` | 去掉 `_q` 缩写 |
| `fish.tankSize` | `mushroom.gardenSize` 或删 | 仅 garden.js 用 |
| `fish.questions` | 保留 | |
| **新增** | `edibility: 'edible'\|'inedible'\|'toxic'\|'deadly'` | 蘑菇图鉴的核心属性，也是绝佳题型（"这个能吃吗？"），且可做免责声明 |
| **新增** | `family`（科）| 图鉴分组比"题目难度分组"更自然 |
| `q.fishId` | `q.entityId` | quiz.js:201/209/220/258/269/350 |
| `q.type: name_from_image` | 保留 | |
| `q.type: trivia / cold_fact` | 保留，或加 `edibility_from_image` | |
| `q.answer / ans_en` | `answerIndex` | §7.1 |
| `tank` (page/nav/canvas) | `garden` | 页面 id `page-garden`、`#garden-canvas` |
| `tankSlots` | `gardenSlots` | storage |
| `addToTankSlots / removeFromTankSlots / addNewFish` | `plant / unplant / addNewEntity` | storage |
| `btn-enter-tank` / `gacha.btn_enter_tank` | `btn-plant` / `gacha.btn_plant`（"种进菌园"） | gacha.js:349, 365 |
| `dailyVoyages` / `btn-voyage` / `startVoyage` / `voyageStart` sfx | `dailyForays`（采菇=foray，是真实术语）/ `btn-foray` / `startForay` | 过场文案"进山采菇中…" |
| `feedData` / `btn-feed` / `Tank.onFeed` | `waterData` / `btn-water`（浇水）或 `mist`（喷雾） | 每小时 10 次的节流逻辑照搬 |
| `fragments` / `fragmentEssence` | `spores`（孢子）/ `mycelium`（菌丝）| 主题化命名，逻辑不变 |
| `fish_tutorial_done / fish_lang / fish_sound_enabled / fgame_v1` | `mush_tutorial_done / mush_lang / mush_sound_enabled / mgame_v1` | 全部 localStorage key 集中到 `config.storageKeys` |
| `ShareUtils.fish / .tank` | `share.entity / share.garden` | |
| `MILESTONES=[...,270]` | 从 `ENTITIES.length` 推导最后一档 | app.js:1699 |
| `FISH_BEHAVIOR`（11 种游动行为） | **不映射**。菌园行为建议：`growthStage`（0-3，随入园天数）、`glow`（夜间荧光种）、`spore`（点击喷孢子粒子）、`sway`（风摆）| garden.js 新设计 |
| `Sound: voyageStart/enterTank/feed/fishClick/bubble/waterDrop` | `forayStart/plant/water/tap` + 新原语 `rustle/woodKnock/chime` | 海洋质感→森林质感 |
| `.fish` 存档后缀 / `MAGIC='FGAME1'` | `.mush` / `'MGAME1'` | app.js:1801, 1837 |
| `assets/fish/cute` | `assets/mushroom/cute` | |
| 深蓝分享底色 `#0A2A4A→#0D3B5E` | 苔绿/棕 | app.js:1346, 1449, 1516, 1597 |

### 7.4 通用层的 config 契约（示意）

```js
// js/game/config.js — core 层唯一的领域入口
const GameConfig = {
  storageKey: 'mgame_v1',
  storageKeys: { lang:'mush_lang', sound:'mush_sound_enabled', tutorial:'mush_tutorial_done' },
  siteUrl: 'https://mushroomid.example',
  rarities: ['common','rare','epic','legend'],
  rarityColors: {...},                   // 唯一定义，CSS 变量由此注入
  gacha: { normal:[...], penalty:[...], pity:{epic:20, legend:50}, fragmentThreshold:3 },
  economy: { essenceValue:{...}, essenceCost:{...}, synthCount:5, chestSize:5 },
  quiz: { perRound:5, timerSec:30,
          levels: { beginner:{imgDiff:1,kType:'trivia',kDiff:4}, ... } },
  slots: { max:10 },
  milestones: [10,25,50,100,150,200],    // 最后一档自动 = ENTITIES.length
  entity: {                              // adapter：core 通过这些取字段，不直接摸对象
    displayName: (e, lang) => lang==='en' && e.nameEn ? e.nameEn : e.name,
    realImage: e => e.image_real,
    cuteImage: e => e.image_cute,
    detailFields: ['habitat','edibility','fact'],
  },
  share: { bg:['#1f2d1a','#2f4a2a'], fallbackEmoji:'🍄', fileName:'mushroom-card.png' },
};
```

有了这个 adapter，`quiz.js` 里 13 处 `_en && fish.nameEn ? fish.nameEn : fish.name` 收敛成 1 处，core 层 grep 不到任何 `fish/mushroom` 字样。

### 7.5 可以直接 copy 的代码块（按行号）

| 目标文件 | 来源 | 改动 |
|---|---|---|
| core/i18n.js | i18n.js 全文 | 2 个 key 字符串 |
| core/gacha.js | gacha.js:289-318 | 0 |
| core/quiz.js | quiz.js:175-213 | `fishId→entityId`，cfg 外提 |
| core/transfer.js | app.js:1798-1880 | 3 常量 + 后缀 |
| core/share.js | app.js:1272-1335（工具函数 + `_doShare`）| 域名 |
| core/router.js | app.js:62-97, 145-147 | 去掉 iframe 分支，加 hooks |
| core/economy.js | app.js:429-519, 544-598, 990-1020, 317-364 | 改名 |
| core/milestone.js | app.js:1699-1724 | 阈值外提 |
| core/tutorial.js | app.js:865-954 | slides 外提 + 加 langchange 重建 |
| core/sound.js | sound.js:1-196, 445-535 | key 字符串 |
| core/storage.js | storage.js 结构 | 重写为工厂 + 迁移表 |
| css/core.css | style.css:1-128, 312-445, 532-560, 786-1119, 1583-1700, 1848-1876 | 改名 |
| tools/* | serve.py, compress_images.py, process_cute_batch.py, process_real.py, photo_picker.html, review_questions.html | 路径 |

### 7.6 不建议带过去的

- `tank.js`（重写 garden.js）
- `bbq.html / catfish.html / idle.html / game.html` 及其桥接代码（app.js:1022-1119）
- `data.js`（30k 行过期副本）
- `EXTRA_EN`（quiz.js:1-155）
- `test/test_run.js`、`test/test.html`
- `style.css:1441-1548`（死 CSS）
- `app.js:4-21` 统计上报（除非 mushroomId 也有后端）
- `debug_storage.html`——若要保留，放 `tools/` 并在部署脚本里显式排除

### 7.7 工作量粗估（以现有代码为基线）

| 部分 | 估计 |
|---|---|
| 抽 core 层 + 写 config adapter | 2–3 天（主要是拆 app.js 和消重复常量） |
| garden.js 新写（生长/荧光/孢子/昼夜/点击）| 3–5 天，取决于视觉野心 |
| 数据：N 种蘑菇 × 4 题 + 双语 + 素材流水线 | 与 N 线性；fishId 270 种花了约 4 个月迭代，工具链可复用能省一半 |
| CSS 主题化 | 1 天 |
| 音效换质感 | 1 天 |
| 测试补齐（纯函数 + 数据校验）| 1 天 |
