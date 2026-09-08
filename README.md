<div align="center">

# 🍄 菌菇图鉴 mushroomId

**不教你吃，只教你认**

166 种真实照片配名字 · 从现场看得见的特征查到它叫什么 · 可离线

</div>

---

## 是什么

口袋菌菇图鉴。首页就是图鉴，166 种全部可查；每种都有真实照片（来源与授权逐张注明，回源复核过物种）、
怎么认（每种三条识别要点）、容易和什么认错（毒/可食配对有人工写的差异句）。
五路检索（轮廓 / 长在哪 / 颜色 / 大小 / 名字，伞形种再叠一路菌盖表面）可以叠加着选，
搜索框认「松树」「有毒」这类口语写法，不用记生境原文或标签图标。166 种各有一个静态页
（`m/<id>.html`），是搜索引擎能索引到的长尾入口。装成 PWA 后断网也能翻列表和搜索，
因为山里没信号是常态。

详情页点「👁 我见过」记一笔观察——日期自动填今天，地点可以一键 GPS 定位，备注随手写；
「我的」页的「我的观察」按月列出所有记录，三个数字（见过的种 / 观察记录 / 去过的地点）
一眼看出自己认了多少、去了多少地方。这条记录和下面「菌菇园」的收集小游戏是两回事，互不影响。

「我的」页的「认菌训练」是独立于抽卡的答题入口：详情页「测一测」单种速测（熟练度攒到几星
按钮上直接看得到）、范围闪卡（按图鉴当前筛选出题）、易混对决（两个最像的种二选一，答错了才
知道自己到底分不分得清）、每日 5 题（自动挑你最生疏的种）、错题本（答错一次就记住，答对一次
才移出）。答题不再是抽卡的门票，是查完之后顺手练一下的工具。

## 附赠玩法：菌菇园

从「我的」页进。

```
选一片林地 → 答 5 道题 → 抽卡 → 种进菌菇园 → 它慢慢长大，每天产孢子
```

菌蕾 → 幼菌 → 成熟 → 出孢，收走孢子回到成熟。三小时半长成，此后每天一个孢子，
离线三天回来也只有一个待收。浇水一次推进整条曲线的 8%。

- **166 种真实菌类**，从香菇、松茸、见手青到毒鹅膏、荧光小菇、蛹虫草
- **1064 道题**：看图认菌、食性类别、孢子印、基质、季节、易混淆、辨毒误区（进答题才按需加载，图鉴首屏不背这 250 KB）
- **每种都有真实照片**，来源与授权逐张注明，点击可全屏放大；11 个致命种另配第二张图补主图拍不到的关键特征；
  非成熟态的形象由代码依据形态特征绘制
- **菌菇园**：侧视森林剖面，十个槽位按纵深铺开，昼夜与天气变化，浇水、起风、荧光夜
- 纯前端，无账号，数据只存在你自己的浏览器里

## 三条产品红线

1. 不做用户拍照识别。
2. 永远不输出「可食」结论；食性只作为「资料记载类别」的图鉴知识。
3. 不做「看图判断能不能吃」的任何题或玩法。

现有蘑菇识别软件在真实中毒标本上的准确率约为 50%，2024 至 2026 年间已有多起「AI 说无毒」导致的中毒事件。本项目因此选择不碰识别这件事，只做「认识它的样子和名字」。

## 本地运行

```bash
python3 tools/build_data.py          # 生成 js/data.gen.js + questions.gen.js + i18n_en.gen.js
python3 tools/make_species_pages.py  # 生成 m/*.html + sitemap.xml + robots.txt
python3 tools/serve.py 3141          # http://localhost:3141/index.html
```

Windows / Git Bash 上没有 `python3`，用 `python`。

测试（前四条退出码非零就是不能提交）：

```bash
python3 test/check_data.py           # 数据校验（字段、措辞、题库可达性、菌盖形状可画）
python3 test/check_species_pages.py  # 物种静态页与 sitemap 一致性
node test/core.test.js               # 内核纯函数测试
node test/transfer.test.js           # 存档导出导入往返
node test/facet.test.js              # 筛选引擎对拍
# 下面七套要先起 python tools/serve.py 3141，走真实点击，共 142 项
node test/verify_photos_ui.mjs
node test/verify_fieldguide_a.mjs
node test/verify_fieldguide_b.mjs
node test/verify_fieldguide_c.mjs
node test/verify_fieldguide_d.mjs
node test/verify_observations.mjs
node test/verify_training.mjs
# 浏览器里肉眼验收：http://localhost:3141/test/e2e.html  完整循环
#                   http://localhost:3141/test/cards.html 分享卡片
```

## 文档

| 文件 | 说明 |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | 开发约定、架构约定、数据字段 |
| [`docs/design/DESIGN.md`](docs/design/DESIGN.md) | 产品与技术设计报告 |
| [`data/README.md`](data/README.md) | 食性字段规范 |
| `docs/research/01–05` | fishId 架构、竞品市场、物种数据、玩法、AI 识别可行性五份调研 |

## 架构

```
js/core/     收集游戏内核，不含任何领域词（有测试强制）
js/game/     蘑菇领域层：config 是内核唯一的领域入口
data/*.json  唯一真相源；js/data.gen.js 是生成物
```

四类结构化题目由物种数据生成，改数据自动同步。题库每个「题型 × 难度」桶都必须被某个难度设置抽到，校验器会拦住孤儿桶。

---

本项目所有「食用 / 有毒」信息仅转述公开资料，**不能用于野外鉴定，更不能作为采食依据**。野生蘑菇不采、不买、不吃。
