# 菌菇图鉴 mushroomId — CLAUDE.md

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
│   │   └── quiz.js             ← 选题、选项乱序、判题
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
│   └── e2e.html                ← 浏览器里跑完整循环
└── docs/
    ├── design/DESIGN.md        ← 产品与技术设计报告
    └── research/01–05          ← 五份原始调研
```

## 开发流程

```bash
python3 tools/build_data.py      # 改过 data/*.json 之后必须重跑
python3 test/check_data.py       # 数据校验，退出码非零就是不能提交
node test/core.test.js           # 内核测试
python3 tools/serve.py 3141      # http://localhost:3141/index.html
```

浏览器里跑完整循环：`http://localhost:3141/test/e2e.html`，右侧会打印每一步。

## 架构约定

### 1. 单一数据真相源

`data/*.json` 是唯一真相源，`js/data.gen.js` 是生成物。
**fishId 的教训**：`data.js` 与 `fish_data.js + questions.js` 分叉，144 道题的英文选项不一致，同步脚本方向还是反的。这里靠「JSON 是源、JS 是生成物、生成物进 gitignore」从结构上避免。

### 2. core 层不许出现领域词

`js/core/` 里 grep 不到 `mushroom` / `garden` / `foray` / `蘑菇` / `菌`。
`test/core.test.js` 有一条测试专门 grep 这三个文件，加词会红。
core 通过 `GameConfig` 取一切领域信息；新增领域概念先加到 config，不要塞进 core。

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
- [ ] 剩余 8 种行为动画（ink / stink / hygro / splash / coral / veil / shelf / parasite 已有数据，按 default 绘制）
- [ ] 分享卡片、存档导入导出、精华商店
- [ ] 英文版
- [ ] 形态检索表（V2）

## 开发约定

- **严禁主动部署**：没有用户明确说「部署」，不执行任何部署操作。
- 改 `data/*.json` 后必须重跑 `build_data.py` 并跑 `check_data.py`。
- 所有日期用 `YYYY-MM-DD` 字符串比较。
- 不引入任何 npm 包或构建工具。
- 含中文的文件一律用 Python `open(..., encoding='utf-8')` 或编辑器工具写入。
- 新增物种后跑一次接触表，确认没画成一团。
