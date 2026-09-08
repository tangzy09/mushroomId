# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 菌菇图鉴 mushroomId

## 项目简介

口袋菌菇图鉴：166 种真实照片配名字，从「现场看得见的特征」查到「它叫什么、怎么认、别和什么混」。
答题是练习工具，菌菇园（抽卡、种植）是「我的」页里的附赠玩法。
无后端、无账号，纯前端 + localStorage + Service Worker（可离线，山里没信号是常态）。

**定位一句话：不教你吃，只教你认。**

> 2026-09-07 由「答题抽卡种菌菇园」的收集游戏改版而来，路径与 fishId 同类改版一致：
> 游戏形态把查阅路径埋了（没抽到的种显示 `???` 不能点）。改版设计与一期 A 计划在
> `docs/superpowers/`。一期 A / B / C 已于 2026-09-07 全部完成（查阅路径、五路检索、全库识别要点与尺度尺、照片分享卡）；
> 2026-09-08 又做了一轮改良（第三刀检索维度、搜索扩容、毒种相似种前置、照片灯箱与多图轮播、
> 物种静态页、题库拆分按需加载），见下方「改良轮（2026-09-08）」一节。
> 二期（观察日志、训练重构、英文界面）待做。

## 安全红线（最高优先级，违反视为严重缺陷）

1. **不做拍照识别。** 不接收用户上传的未知蘑菇照片，就不存在「误判 → 误食」链路。
2. **永远不输出「可食」结论。** `edibility` 只描述「公开资料如何记载」，UI 必须同时显示对应的 `note`。
3. **不做「看图判断能不能吃」的题或玩法。** 食性题题干一律先给菌名。
4. **不写采摘、烹饪、去毒的操作性内容**，包括「煮多久就没事」这类细节。
5. **不写药用功效**（广告法风险），只写「传统上用作药材」。
6. **不用「红伞伞白杆杆」暗示看颜色能判断毒性**；玩梗必带「颜色不能判断毒性」。
7. **把毒菌标成可食是本项目唯一不可接受的 bug 等级。** 改动任何 `poisonous` / `deadly` 条目都要第二人复核。

`test/check_data.py` 里有 `BANNED` 正则表，会拦住绝对化安全表述、去毒指引、功效宣称。新增违禁措辞就加进那张表。

## 技术栈

- 原生 HTML / CSS / JavaScript，零依赖、零构建工具
- 存储：localStorage
- 离线：`sw.js` 三层缓存（核心 / 200px 缩略图层 1.2 MB 预缓存 / 大图按需并回退缩略图）
- 形象：166 种全部有真实照片（`assets/photos/`，来源与授权在 `js/photo_credits.js`，**cc-by 要求显示署名**），
  非成熟态由 `js/game/shroom-art.js` 依据形态字段用 Canvas 绘制。
  2026-09-08 去掉了 15 个开放图库里没有野外活体照的种（东亚特有 / 栽培菌 / 药材 / 块菌），
  规矩改为**没有合格照片的种不收录**；`tools/drop_species.py` 是整体移除物种的工具。
  `app.js` 的 `art()` 是唯一入口：有照片用照片，没有或加载失败回退绘制

## 文件结构

```
mushroomId/
├── index.html                  ← 单页，7 个 page div 切换
├── css/style.css
├── js/
│   ├── core/                   ← 收集游戏内核，禁止出现领域词
│   │   ├── storage.js          ← 内存单例 + 显式 commit + 版本迁移表
│   │   ├── gacha.js            ← 概率、保底、天气修正、按稀有度选实体
│   │   ├── quiz.js             ← 选题、选项乱序、判题
│   │   ├── share.js            ← 分享卡片 Canvas（强制水印）
│   │   └── transfer.js         ← 存档导出导入（`.spore`，AES-GCM）
│   ├── game/                   ← 蘑菇领域层
│   │   ├── config.js           ← core 唯一的领域入口，所有常量在这里
│   │   ├── weather.js          ← 日期 hash 天气 + 生长推进 + 槽位分配（纯函数）
│   │   ├── shroom-art.js       ← 程序化绘制
│   │   ├── garden.js           ← 菌菇园 Canvas
│   │   └── app.js              ← 路由与 DOM 粘合，不放规则
│   ├── photo_credits.js        ← 照片署名 166 条（生成物，来自 skill 的取图管线，勿手改）
│   ├── photo_extra.js          ← 补图署名（生成物）：主图拍不到关键特征的种，第二张图 + 署名
│   ├── data.gen.js             ← 生成物，已 gitignore，勿手改（不含英译字段，见下）
│   ├── questions.gen.js        ← 题库生成物，已 gitignore；250 KB，答题时才按需注入（见「运行时装配」）
│   └── i18n_en.gen.js          ← 生成物，已 gitignore；二期英文界面数据准备，**不被 index.html 引用**
├── sw.js                       ← Service Worker 三层缓存；改 JS/CSS 后 V 与 index.html 的 ?v= 一起 bump
├── assets/photos/real/         ← 900px WebP × 166（详情页；11 个致命种另有 `<id>-2.webp` 补图）
├── assets/photos/thumb/        ← 200px WebP × 166 + index.json（列表；SW 预缓存清单）
├── m/                          ← 166 个物种静态页（生成物，SEO 长尾入口，改数据后重新生成）
├── sitemap.xml / robots.txt    ← 与 m/ 一起由 make_species_pages.py 生成
├── data/
│   ├── mushrooms.json          ← 物种真相源（166 种，含 idKeysEn/habitatEn/factEn/quoteEn 等英译字段）
│   ├── questions_curated.json  ← 人工题真相源（trivia / cold_fact / myth_buster）
│   └── README.md               ← 食性字段规范
├── tools/
│   ├── build_data.py           ← data/*.json → js/data.gen.js + questions.gen.js + i18n_en.gen.js
│   ├── make_species_pages.py   ← data/mushrooms.json → m/*.html + sitemap.xml + robots.txt
│   ├── drop_species.py         ← 整体移除物种（连带 lookalikes / 人工题 / 旧存档引用的清理逻辑在 app.js）
│   ├── census_to_encounter.py  ← iNat 观察数 → encounter 四档（按全库分位数切，非固定阈值）+ 本土种修正表
│   ├── serve.py                ← 本地开发服务器（多线程；SW 预缓存并发请求，单线程会超时）
│   └── build_report_page.py    ← 设计报告 → HTML 页面
├── test/
│   ├── check_data.py           ← 数据校验（含题库可达性）
│   ├── check_species_pages.py  ← 物种静态页与 sitemap 一致性校验
│   ├── core.test.js            ← 内核纯函数测试
│   ├── transfer.test.js        ← 存档导出导入往返
│   ├── facet.test.js           ← facet.js 与 browse.js 原始实现逐值对拍
│   ├── verify_photos_ui.mjs    ← 照片行为验收（真实点击，查 naturalWidth 不查 src）
│   ├── verify_fieldguide_a.mjs ← 一期 A 行为验收
│   ├── verify_fieldguide_b.mjs ← 一期 B 行为验收：五路检索 + 叠加筛选 + 对比网格
│   ├── verify_fieldguide_c.mjs ← 一期 C 行为验收：识别要点 + 尺度对比尺 + 照片分享卡
│   ├── verify_fieldguide_d.mjs ← 改良轮行为验收：搜索扩容 / 第三刀 / 毒种相似种前置 / 灯箱 / 多图 / 深链
│   ├── smoke_prod.mjs          ← 部署后对生产站跑的验收冒烟
│   ├── e2e.html                ← 浏览器里跑完整循环
│   └── cards.html              ← 分享卡片肉眼验收页
└── docs/
    ├── design/DESIGN.md        ← 产品与技术设计报告
    └── research/01–05          ← 五份原始调研
```

## 开发流程

```bash
python3 tools/build_data.py      # 改过 data/*.json 之后必须重跑
python3 tools/make_species_pages.py  # 改了会影响物种页内容的字段之后重跑
python3 test/check_data.py       # 数据校验，退出码非零就是不能提交
python3 test/check_species_pages.py  # 物种页与 sitemap 一致性
node test/core.test.js           # 内核测试
node test/transfer.test.js       # 存档导出导入
node test/facet.test.js          # facet.js 与 browse 原始实现逐值对拍（7200 次）
python3 tools/serve.py 3141      # http://localhost:3141/index.html（多线程，下面五套要它在跑）
node test/verify_photos_ui.mjs    # 照片进列表 / 详情 / 署名               9 项
node test/verify_fieldguide_a.mjs # 一期 A：导航、搜索、详情、路由        22 项
node test/verify_fieldguide_b.mjs # 一期 B：五路检索、叠加、对比网格      22 项
node test/verify_fieldguide_c.mjs # 一期 C：识别要点、对比尺、照片分享卡  23 项
node test/verify_fieldguide_d.mjs # 改良轮：搜索/第三刀/相似种前置/灯箱等 21 项
```

Windows / Git Bash 上没有 `python3`，一律用 `python`。五套 `verify_*.mjs` 用 Playwright
自带的 Chromium（默认从 fishId 的 `tests/node_modules` 借，第一个参数可改目录），
走真实点击，每条都有退出码。

前面的命令里除 `serve.py` 外全是门：**退出码非零就是不能提交**。
`core.test.js` 是一张平铺的 `t(name, fn)` 列表，**没有单测过滤参数**，整个文件跑完不到一秒，直接整跑。
两个浏览器页是**肉眼验收，没有判据、没有退出码**，别把「打开了 e2e 页」当成测试通过：

- `test/e2e.html` — iframe 里跑完整循环，右侧打印每一步，`JS ERROR:` 行是唯一的红灯
- `test/cards.html` — 三张分享卡片的成图

`node test/*.js` 都靠 `js/data.gen.js` 存在，**先跑 `build_data.py`**，否则测试直接抛。

## 运行时装配

没有模块系统、没有打包器。每个文件是一个 IIFE 挂全局：
`GameConfig` / `Storage` / `Gacha` / `Quiz` / `Share` / `Transfer` / `World` / `ShroomArt` / `Garden`。

`index.html` 底部的 `<script>` **顺序即依赖**：config → core 五件 → weather/art/garden → `data.gen.js` → `app.js`。
新增文件要同时加进这里、`test/core.test.js` 顶部的 `load()` 列表（那边用 `vm` 把源码灌进一个假上下文），
以及需要它的 `test/*.html`。core 与部分 game 文件末尾都有一行 `module.exports` 守卫，就是为了 node 侧能读。

每个 script 标签带 `?v=YYYYMMDDx` 缓存戳，**发布前统一升一次**；本地开发不受影响，`serve.py` 发 `no-store`。

## 架构约定

依赖方向是单向的：`app.js` → `core/*` + `game/*` → `GameConfig` + `data.gen.js`。
`app.js` 是唯一碰 DOM 的文件（单页 7 个 `.page` div，`show(id)` 切换），规则一律不写在里面；
`weather.js` 是纯函数（日期 hash 出天气、推进生长、分配槽位），`garden.js` 只负责把状态画到 Canvas。
改行为先问「这属于内核、领域规则、还是画面」，别在 `app.js` 里塞第四种。

### 1. 单一数据真相源

`data/*.json` 是唯一真相源，`js/data.gen.js` 是生成物。
**fishId 的教训**：`data.js` 与 `fish_data.js + questions.js` 分叉，144 道题的英文选项不一致，同步脚本方向还是反的。这里靠「JSON 是源、JS 是生成物、生成物进 gitignore」从结构上避免。

### 2. core 层不许出现领域词

core 通过 `GameConfig` 取一切领域信息；新增领域概念先加到 config，不要塞进 core。

`test/core.test.js` 最后一条测试 grep `mushroom|fungus|fungi|spore|garden|foray|蘑菇|菌`（剥掉注释后），
但**只扫 `storage.js` / `gacha.js` / `quiz.js` 三个文件**。
后加的 `share.js`（一句中文文案）与 `transfer.js`（`SECRET`、下载文件名、报错文案）确实带着领域词，
属于已知欠账：这两处的字面量该走 `GameConfig`，补完再把文件加进那张扫描表。
**新写 core 文件时直接加进扫描表**，别让欠账变成三笔。

### 3. 结构化题目由数据生成

`name_from_image` / `edibility_class` / `feature` / `lookalike` 四类题由 `tools/build_data.py` 从物种字段生成，改数据自动同步。只有 `trivia` / `cold_fact` / `myth_buster` 是人工写的。

### 4. 题库可达性

**每个 `(type, difficulty)` 桶都必须至少被一个难度设置抽到。**
fishId 有 43% 的题因为难度配置与题库分布对不上而永远抽不到。
`test/check_data.py` 的 `LEVELS` 表是 `js/game/config.js` 的镜像，改一处必须改另一处；`core.test.js` 里也有一条断言两者一致。

### 5. 存档只有一份内存副本

`Storage.get()` 返回活对象，改完调 `commit()`，或直接用 `Storage.update(fn)`。
**不要**先 `load()` 出快照、中间调别的写方法、最后再保存快照——fishId 的每日任务进度就是这样被回滚的，`core.test.js` 里有一条测试复现那个序列。

新增字段：直接加进 `defaults()`，`backfill()` 会补进老存档。
改变字段语义：往 `MIGRATIONS` 加一条并升 `CURRENT_VERSION`，**不要修改已有条目**。

### 6. 绘制从形态字段来

新增物种时 `art` 块决定长相。`cap` 支持 `convex / flat / conical / bell / cylinder / funnel / ball / pear / egg / honeycomb`（走菌盖+菌柄模型），以及整体形态 `fan / kidney / hoof / frill / cup / star / tuber / tentacles / cage / ear / club / finger / branch / blob / tongue / saddle / spoon / brain / lump / round / trumpet`。

**`cap` 写了个绘制代码不认识的值不会报错，会静悄悄退回普通凸形菌盖。**
`round` / `egg` / `trumpet` 三个值就这样在数据里躺了很久，六个物种一直被画成一模一样的圆包子。
`test/check_data.py` 的 `check_art` 现在**从 `shroom-art.js` 里正则读出所有能画的形状**再比对数据——
是读出来的不是抄一份清单，抄的迟早会漂。加新形状只要在绘制代码里加分支，这道门自动认。
特征开关：`spots / scales / cracks / wrinkle / striate / shaggy / inkEdge / droplets / spines / glossy / zones / veil / warts / eggs / rays / flies / glowColor / bruiseColor / ringColor / volvaColor / cluster / tiers / branches`。

改完用接触表检查全部物种：把 `MUSHROOM_DATA` 铺成网格逐个 `ShroomArt.draw`。

`ShroomArt.heightOf(sp)` 返回一株画出来有多高（每单位 `size`），**是量出来的不是算出来的**：
画一次到离屏画布、找最上面那行有像素的，按物种缓存。
凡是要放在菌子上方的东西（孢子角标、名字气泡）或要把它塞进方框里（`app.js` 的 `art()`），
都用它，别自己拿菌柄高加菌盖高去推——马勃、树舌、珊瑚菌根本不走那个模型。

### 7. 生长状态机的字段名是跨层契约

一个槽位的记录由 `js/core/storage.js` 的 `place()` 写出，只有三个字段：
`placedAt` / `lastYieldAt` / `boostMs`。读它的是 `js/game/weather.js` 的 `World.growth`。

**写的那一层和读的那一层曾经各叫各的**（读侧找 `plantedAt` / `wateredMs` / `lastSporeAt`），
于是每次算出来都是 `NaN`，**全游戏每一株永远停在菌蕾、浇水毫无作用、没有任何槽位产过孢子**——
而 54 条测试全绿，因为测试是手搓字面量喂给读侧的，用的正是读侧那套名字。
`core.test.js` 现在有一条测试**从 `Storage.place` 造记录再喂给 `World.growth`**，
改任一侧的字段名都会红。加新字段照这条路补测试，别再手搓记录。

四段是 `pin → young → mature → sporulate`，前三段是从定植起算的时钟阶梯，
第四段不在阶梯上：成熟槽的产孢计时到点就进 `sporulate`，收走孢子回到 `mature`。
`growth()` 返回的 `stage` 是状态机的状态，`drawStage` 是给 `ShroomArt` 的形态——
出孢期照成熟的样子画，别把 `stage` 直接传给绘制。

产孢计时**从成熟那一刻起算**，且不叠加：离线三天回来也只有一个待收。

### 8. 菌菇园的构图不是随便摆的

`config.js` 的 `garden.slots` 有三条硬约束，改坐标前先读：

- **顺序是近到远**，因为 `World.slotFor` 取第一个空位。新手头三株必须在近处画得大。
- **画布右侧 x 0.86–0.98、y 0.70 以下是浮动按钮**（浇水/昼夜/起风/分享），近处槽位不许压进去。
- **wood 槽的 y 要落在某根木头的顶面上**，`garden.js` 里 `fallenLog` / `stump` 的坐标是配套的。

`garden.depth` 把 y 映射成绘制缩放：远的画小、近的画大。十株成熟菌挤在一条窄带里会糊成一片墙，
拉开纵深是唯一解。每株脚下有落地阴影，夜里整幅压一层冷色、再让 `glowColor` 物种透回来。

## 数据字段

```json
{
  "id": "flyagaric",
  "name": "毒蝇伞", "nameEn": "Fly agaric", "latin": "Amanita muscaria",
  "family": "鹅膏科",
  "rarity": "common|rare|epic|legend",
  "edibility": "cultivated|wild_edible|conditional|medicinal|inedible|unknown|poisonous|deadly",
  "biome": "pine|broadleaf|deadwood|meadow|special",
  "substrate": "wood|soil|grass|litter|mycorrhizal|termite|insect|parasitic|conifer_cone",
  "season": [7,8,9,10],
  "sporePrint": "white|cream|pink|brown|rusty|purple_brown|black|green|olive|lilac",
  "hymenium": "gills|pores|teeth|ridges|smooth|gleba",
  "ring": true, "volva": true,
  "size": 1.0,
  "behavior": "default|puff|glow|bruise|jelly|cluster|ink|stink|hygro|splash|coral|veil|shelf|parasite",
  "lookalikes": ["caesar"],
  "lookalikeNotes": { "caesar": "凯撒鹅膏菌盖光滑无白点，菌褶和菌柄黄色" },
  "idKeys": [ { "text": "红色菌盖上散布白色疣状鳞片", "src": "wiki-zh" }, "…", "…" ],
  "encounter": "common|occasional|rare|seldom",
  "habitat": "…", "fact": "…", "quote": "…",
  "art": { "cap": "convex", "capColor": "#C62B22", "spots": "white", "…": "…" }
}
```

`lookalikes` 必须双向。校验器会报单向引用。

三个一期 A 新字段，各有门（`test/check_data.py`）：

- **`idKeys`**：识别要点，每条 `{text, src}`，`src ∈ wiki-zh / wiki-en / mushroomexpert / inat / photo`。
  写法是一句现场看得见的话（6–60 字），不是检索表术语（数值范围、μm、罗马数字会被门拦下）。
  **166 种全部恰好 3 条**（毒种 40 种一期 A 人工写，其余一期 C 补齐）。
  详情页脚注如实写「AI 据公开资料整理，未经真菌学家审校」。
- **`capCm`**：`[常见下限, 最大记录]`，伞形 / 漏斗形是菌盖直径，其余是整体大小；门要求 `0 < lo ≤ hi ≤ 200`。
  详情页「多大」对比尺按 `hi` 三档换参考物：≤5 比一元硬币（轴 6）、≤20 比手掌 18（轴 30）、
  更大比小臂 60（轴按 30 取整）。数值取自 Wikipedia 描述，不精确，用途是给量级不是给测量。
- **`lookalikeNotes`**：`{对方id: 差异句}`。**毒/可食配对必须有人工句**，门保证；其余配对渲染时取对方 `idKeys[0]`。
  「特征」不等于「区别」，这类句子不允许自动生成。
- **`encounter`**：野外遇见率四档，由 `tools/census_to_encounter.py` 从 iNat 观察数分档 + 本土种修正表得出。
  ⛔ 它不是 `rarity`（抽卡概率），图鉴排序与筛选只用 `encounter`。iNat 观察数对中国物种系统性偏低，
  修正表是这个字段成立的前提，不是补丁。**分档阈值按全库分位数取，不是固定数字**——166 种换了一批之后
  「常见」曾经占到 54%（四档失去区分度），阈值改成 18000/4000/200 后落到 30%（common 50 / occasional 74 / rare 26 / seldom 16）。
- **`capSurface`**：菌盖表面五档（`smooth/scaly/warty/slimy/fibrous`），**只对 `silhouette` 为
  `umbrella`/`funnel` 的种存在**，其余种没有这个字段。伞形约占全库一半，「轮廓 + 颜色」两刀之后
  仍常剩 30+ 种，这是第三刀。
- **`idKeysEn` / `habitatEn` / `lookalikeNotesEn` / `factEn` / `quoteEn`**：二期英文界面的数据层准备。
  **`build_data.py` 会把这五个字段从 `data.gen.js` 里剥离**，单独写进 `js/i18n_en.gen.js`
  （生成物，不被 `index.html` 引用）——现在的中文界面用不上它们，留在主数据文件里就是让每个用户
  白白多下 85 KB 不会显示的文本。改这几个字段只改 `data/mushrooms.json`，两处生成都会自动同步。

## 改良轮（2026-09-08）

上线后主人问「这个 app 还有什么可以改良」，把 166 种数据跑了一遍统计、手机视口逐屏截图、
搜索与检索链路实测，找到的问题按值不值得改排了序（报告存过 `C:\tmp\mushroomId\improvements-2026-09-08.md`），
这一轮把其中能一次做完的都做了：

- **检索第三刀**：加 `capSurface`（菌盖表面）与 `size`（按 `capCm` 上限分小/中/大）两个维度；
  `browse.js` 的 `DIMS`/`TABS`/`ORDER` 都要跟着加，`capSurface` 的 tab 与 `hymenium` 共用
  `hymeniumApplies()` 的显示条件（只对伞形/漏斗形有意义）。
- **搜索扩容**：`browse.js` 的 `matchesQuery` 原来只搜六七个字段的原文，搜「松树」（生境写的是「松」）、
  搜「有毒」（标签是「☠️ 剧毒」）都是 0 结果。改成 `haystack()` 把识别要点文本、食性标签也编进搜索面，
  外加一张 `SYN` 常见写法归一表（松树/松木/松林 → 松，能吃/可食 → 食，……）在搜索词与文本两边都跑一遍。
- **遇见率重新分档**：见上「数据字段」。
- **毒种「容易认错」前置**：`renderDetail()` 现在按 `isToxicSp(m)` 分两个插入点——毒/致命种紧跟在
  「怎么认」之后（`lookalikeCard()` 抽成一个返回元素而不是直接 `appendChild` 的函数，两处调用），
  非毒种仍留在「趣味知识」之后。这是设计稿 §3 本来就要求的，一期 A 漏掉了。
- **识别要点第二轮 + 毒种相似种补对**：23 种识别要点里生境句排在前两位或有短句的问题（子代理批量改写，
  每句 8–40 字、最多留一条生境句且必须放第三条），另外给 5 个原来没有相似种的毒种（卷边桩菇、
  大毒滑锈伞、纯黄白鬼伞、松塔牛肝菌、麦角菌）各配了 1–2 个相似种和差异句。
- **照片灯箱 + 多图轮播**：详情页主图满宽、点击进 `#lightbox` 全屏（双指缩放靠浏览器 `touch-action`）。
  11 个致命种的主图拍不到关键特征（菌托、菌褶细节），从 iNat 同一条观察记录的其它照片里挑了 8 张
  补图（3 种候选不足或质量不够没配），存进 `js/photo_extra.js`（生成物）；详情页照片区变成
  `.photo-strip` 横滑带，署名跟着滑到哪张走（`scroll` 事件算 `scrollLeft / clientWidth`）。
- **松茸主图换掉**：原图是手持切面照，从候选里挑了一张原位、带菌褶菌柄细节的换上，回源复核确认
  （`recheck_photos.py --only`）零误配。另三张被点名的采集摆拍图（黄盖鹅膏、毒新牛肝菌、玫黄黄肉
  牛肝菌）iNat 候选池太小（2–5 张，且是同一次拍摄的不同角度），没有更好的可换，保持原样。
- **题库拆分**：`QUESTIONS`（250 KB）单独生成 `js/questions.gen.js`，`app.js` 的 `ensureQuestions()`
  在第一次真的要答题（进山采菌）时才 `<script>` 动态注入，图鉴首屏不再为它买单。
- **物种静态页**：`tools/make_species_pages.py` 生成 `m/<id>.html` × 166 + `sitemap.xml` + `robots.txt`，
  参照 fishId 的 `make_species_pages.py` 但只做中文单语（没有英文 UI 就不该生成看起来完整实则半吊子的英文页）。
  `app.js` 的 `deepLink()` 接住 `#/m/<id>` hash，静态页的「在图鉴里打开」按钮跳回来能直接落到详情页。
  `test/check_species_pages.py` 是这批页面的验收门（文件数、深链、og:image、sitemap 一致性），反向测过
  （临时删一个文件确认会红）。
- **安全横幅收拢**：首开弹窗确认过之后，两处常驻横幅从两行收成一行（点一下展开，内容不变、
  永远不可关闭），避免同一句安全声明在弹窗+两处横幅重复三遍占屏幕。

⚠ 两个当场发现的测试坑，都是这一轮反向验证时抓到的：
- **加了「大小」入口后，`verify_fieldguide_b.mjs` 里断言 tab 列表精确等于四个的那条会红**——
  这是**预期内的红**（tab 数量确实变了），改断言不是掩盖问题；同理 `verify_fieldguide_a.mjs` 里
  写死「毒种 42 个」的断言在物种数变化后也要改成「读数据算 + 正例地板」，不能再写死数字。
- **在 SW 已注册的页面上用 `page.route` 掐断图片请求测「加载失败回退绘制」是测不出来的**——
  SW 的离线策略会拿同名缩略图顶上（那是它的设计），`page.route` 也拦不到 SW 发起的请求。
  这条要在**禁用 Service Worker 的新 context**（`browser.newContext({ serviceWorkers: 'block' })`）里测，
  测的才是 `app.js` 自己的回退逻辑，不是 SW 的回退逻辑——两层回退，两套判据，别混着测。
- **测 `#/hash` 深链不能用同页面 `page.goto` 改 hash**——Chromium 下同文档的 hash-only 跳转不一定
  重跑应用的 boot 流程，`waitUntil: 'networkidle'` 可能立刻通过而页面其实没变。要测「一个从没打开过
  这个 app 的人点了带 hash 的链接」，就得用一个全新的 page/context 去 `goto` 那个带 hash 的完整 URL。

## 当前进度

- [x] 166 种物种数据 + 题库（四类由数据生成）
- [x] 数据校验器（字段、枚举、措辞、题库可达性）
- [x] core 层（storage / gacha / quiz）+ 54 条纯函数测试
- [x] 程序化绘制（无图片资源）
- [x] 菌菇园 Canvas（昼夜、天气、浇水、起风、点击反应、荧光）
- [x] 主循环：选林地 → 答 5 题 → 抽卡 → 定植 / 分解
- [x] 图鉴（筛选、锁定轮廓、详情、易混淆对照）
- [x] 每日任务、每日菌篮、孢子合成、里程碑
- [x] 安全体系（首次协议、常驻横幅、食性脚注、急救卡、强制辨毒误区题）
- [x] 完整 4 段生长状态机（`pin → young → mature → sporulate`，收孢子回到 mature）
- [x] 14 种行为的形态与反应（含 hygro 读天气开合）
- [x] 分享卡片（菌卡 / 菌菇园 / 里程碑，水印强制）
- [x] 存档导出导入（`.spore`，AES-GCM）
- [x] 菌种库（腐殖质换指定物种）
- [x] 166 种真实照片（三来源，全部可商用授权，逐张人眼过目，验收门八项）
- [x] **2026-09-08 照片回源复核**：`recheck_photos.py`（skill 里）对 166 张逐张回到 iNat / Commons / GBIF
      复核「现在的鉴定还是不是这个种、本地文件是不是那张图」，加 14 张接触表人眼再过一遍；
      无照片的 15 种整体下线
- [x] **一期 A（2026-09-07）**：导航减为图鉴/我的、图鉴全部物种可点、栈式路由可多级返回、
      全字段搜索、毒种 42 种识别要点、毒/可食配对人工差异句、无照片致命种提示、
      离线三层缓存、遇见率字段、安全文案不再自称游戏。行为验收 23 项全过
- [x] **一期 B（2026-09-07）**：五路形态检索（轮廓 / 菌盖背面 / 长在哪 / 颜色 / 名字，`facet.js` 拷自 skill）、
      `silhouette` / `colorGroup` / `pinyin` 字段各配门、叠加筛选剩余计数、条件维度、对比网格、
      毒种对照提示。行为验收 18 项全过
- [x] **一期 C（2026-09-07）**：其余 139 种识别要点（全库 × 3）、`capCm` 全库每种一条 + 详情页尺度对比尺、
      分享卡改用真实照片（圆角方图 + 署名行，无照片回退绘制，丝带改遇见率）。行为验收 23 项全过
- [ ] 二期：观察日志「我见过」、认菌训练重构、英文界面
      （**语言只做中文与英文**，2026-09-08 定；引擎可照 fishId 的 `i18n.js` 拷，数据层 `nameEn` 已有）
- [x] 15 种无照片的种：已于 2026-09-08 整体下线（清单在 `C:\tmp\mushroomId\README.md`），
      要么保持绘制，要么找国内机构授权
- [x] **改良轮（2026-09-08）**：检索第三刀（菌盖表面 + 大小）、搜索扩容与常见写法归一、遇见率按
      分位数重切、毒种「容易认错」前置、23 种识别要点第二轮改写、5 个毒种补相似种、照片灯箱、
      11 个致命种多图轮播补关键特征（8 张配到）、松茸主图换成原位照、题库拆分按需加载
      （首屏省 250 KB）、166 个物种静态页 + sitemap + robots.txt、二期英文数据层准备
      （`i18n_en.gen.js`，不占当前用户下载量）。新增行为验收 21 项（`verify_fieldguide_d.mjs`）+
      物种页验收门（`check_species_pages.py`），一期 A/B 的两处历史断言（写死「毒种 42」「四个 tab」）
      改成读数据算。全套门（数据 / core 58 / transfer 15 / facet 对拍 / photos 9 / A 22 / B 22 / C 23 / D 21 /
      物种页）跑通

## 开发约定

- **严禁主动部署**：没有用户明确说「部署」，不执行任何部署操作。

## 部署（线上 https://mushroomid.ai-speeds.com）

EC2 3.26.95.240（与 fishId 同一台），nginx 配置 `/etc/nginx/conf.d/mushroomid.conf`，
**站点根目录 `/var/www/mushroomid` 是一个 git clone**（远端 github.com/tangzy09/mushroomId），
发版就是在服务器上 `fetch + reset --hard` 到目标分支。`deploy.sh`（不入库，带主机与密钥路径）
把「本地门 → push → 服务器 reset → 重建 data.gen.js → 探活」串成一条。手动等价步骤：

```bash
# 本地：门全绿、已 push（缓存戳 index.html ?v= 与 sw.js 的 V 同一串）
ssh -i $pem ec2-user@3.26.95.240 "D=/var/www/mushroomid; B=<分支>;
  sudo git -C \$D fetch origin \$B && sudo git -C \$D reset --hard origin/\$B &&
  cd \$D && sudo python3 tools/build_data.py | tail -1"
node test/smoke_prod.mjs        # 线上冒烟 23 项，退出码 0 才算部署成功
```

- `js/data.gen.js` 被 gitignore，服务器上要重建（服务器是 Python 3.9）。想让线上与本地测过的字节完全一致，
  就 scp 本地那份覆盖过去再比 md5。
- 照片（`assets/photos/` 333 个文件 23 MB）**在 git 里**，reset 时一并到位，不用单独传。
- nginx 三条规则缺一不可：`location ~ /\.(git|svn|hg|env)` 封仓库；`location = /sw.js` 与
  `/index.html`、`/manifest.webmanifest` 的 `no-cache`；`^/(CLAUDE.md|README.md|deploy.sh|docs|test|tools|data)` 封内部文件
  （git 部署把整个仓库放进了 web root，这条是补救）。`smoke_prod.mjs` 对这三条都有断言。
- ⛔ 用 `sed -i '/x/a\ ...'` 往 nginx 配置里插多行会被挤成**一行**，而第一段是注释 ⇒ 整行都成注释、
  `nginx -t` 照样通过、规则一条没生效（2026-09-08 实证）。改配置用 python 逐行写，改完 `sed -n` 看真实行。
- 磁盘只剩约 800 MB，别往服务器放大文件；`.bak` 配置副本积多了要清。
- 改 `data/*.json` 后必须重跑 `build_data.py` 并跑 `check_data.py`。
- 所有日期用 `YYYY-MM-DD` 字符串比较。
- 不引入任何 npm 包或构建工具。
- 含中文的文件一律用 Python `open(..., encoding='utf-8')` 或编辑器工具写入。
- **改 JS/CSS 后发版前，`index.html` 的 `?v=` 与 `sw.js` 顶部的 `V` 用同一个日期串一起 bump**，只改一个等于没发版。
  `sw.js` 的 `CORE_URLS` 必须与 `index.html` 的 script 标签一一对应，漏一个离线时就是 ReferenceError。
- 改过 `data/*.json` 之后**必须重跑 `build_data.py`**，页面加载的是 `data.gen.js`。一期 A 就因为漏了这步，
  三条详情页断言红了半天。
- 行为验收走真实点击。`app.js` 是 IIFE，内部函数不挂 window；模块层（`Storage` 等）才是全局的。
  首次运行的安全协议弹层盖住整屏，测试里不关掉后面所有点击都会超时。
- 新增物种后跑一次接触表，确认没画成一团。
