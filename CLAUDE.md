# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 菌菇图鉴 mushroomId

## 项目简介

看图认菌 → 抽卡收集 → 种进菌菇园的科普收集游戏。
无后端、无账号，纯前端 + localStorage。参考 fishId（鱼鱼图鉴）的架构，但内核已抽成领域无关层。

**定位一句话：不教你吃，只教你认。**

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
- **无图片资源**：所有菌类形象由 `js/game/shroom-art.js` 依据形态字段用 Canvas 绘制

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
│   └── data.gen.js             ← 生成物，已 gitignore，勿手改
├── data/
│   ├── mushrooms.json          ← 物种真相源（181 种）
│   ├── questions_curated.json  ← 人工题真相源（trivia / cold_fact / myth_buster）
│   └── README.md               ← 食性字段规范
├── tools/
│   ├── build_data.py           ← data/*.json → js/data.gen.js
│   ├── serve.py                ← 本地开发服务器
│   └── build_report_page.py    ← 设计报告 → HTML 页面
├── test/
│   ├── check_data.py           ← 数据校验（含题库可达性）
│   ├── core.test.js            ← 内核纯函数测试
│   ├── transfer.test.js        ← 存档导出导入往返
│   ├── e2e.html                ← 浏览器里跑完整循环
│   └── cards.html              ← 分享卡片肉眼验收页
└── docs/
    ├── design/DESIGN.md        ← 产品与技术设计报告
    └── research/01–05          ← 五份原始调研
```

## 开发流程

```bash
python3 tools/build_data.py      # 改过 data/*.json 之后必须重跑
python3 test/check_data.py       # 数据校验，退出码非零就是不能提交
node test/core.test.js           # 内核测试
node test/transfer.test.js       # 存档导出导入
python3 tools/serve.py 3141      # http://localhost:3141/index.html
```

Windows / Git Bash 上没有 `python3`，一律用 `python`。

四条命令里只有前三条是门：`check_data.py` 与两个 node 测试**退出码非零就是不能提交**。
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

新增物种时 `art` 块决定长相。`cap` 支持 `convex / flat / conical / bell / cylinder / funnel / ball / pear / honeycomb`（走菌盖+菌柄模型），以及整体形态 `fan / kidney / hoof / frill / cup / star / tuber / tentacles / cage / ear / club / finger / branch / blob / tongue / saddle / spoon / brain / lump / trumpet`。
特征开关：`spots / scales / cracks / wrinkle / striate / shaggy / inkEdge / droplets / spines / glossy / zones / veil / warts / eggs / rays / flies / glowColor / bruiseColor / ringColor / volvaColor / cluster / tiers / branches`。

改完用接触表检查全部物种：把 `MUSHROOM_DATA` 铺成网格逐个 `ShroomArt.draw`。

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
  "habitat": "…", "fact": "…", "quote": "…",
  "art": { "cap": "convex", "capColor": "#C62B22", "spots": "white", "…": "…" }
}
```

`lookalikes` 必须双向。校验器会报单向引用。

## 当前进度

- [x] 181 种物种数据 + 1165 道题（四类由数据生成）
- [x] 数据校验器（字段、枚举、措辞、题库可达性）
- [x] core 层（storage / gacha / quiz）+ 54 条纯函数测试
- [x] 程序化绘制（无图片资源）
- [x] 菌菇园 Canvas（昼夜、天气、浇水、起风、点击反应、荧光）
- [x] 主循环：选林地 → 答 5 题 → 抽卡 → 定植 / 分解
- [x] 图鉴（筛选、锁定轮廓、详情、易混淆对照）
- [x] 每日任务、每日菌篮、孢子合成、里程碑
- [x] 安全体系（首次协议、常驻横幅、食性脚注、急救卡、强制辨毒误区题）
- [ ] 完整 4 段生长状态机（现为 pin → mature 简化版）
- [x] 14 种行为的形态与反应（含 hygro 读天气开合）
- [x] 分享卡片（菌卡 / 菌菇园 / 里程碑，水印强制）
- [x] 存档导出导入（`.spore`，AES-GCM）
- [x] 菌种库（腐殖质换指定物种）
- [ ] 挑战好友分享、礼品码
- [ ] 英文版
- [ ] 形态检索表（V2）

## 开发约定

- **严禁主动部署**：没有用户明确说「部署」，不执行任何部署操作。
- 改 `data/*.json` 后必须重跑 `build_data.py` 并跑 `check_data.py`。
- 所有日期用 `YYYY-MM-DD` 字符串比较。
- 不引入任何 npm 包或构建工具。
- 含中文的文件一律用 Python `open(..., encoding='utf-8')` 或编辑器工具写入。
- 新增物种后跑一次接触表，确认没画成一团。
