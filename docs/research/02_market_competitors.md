# mushroomId 竞品与市场调研报告（r2_market）

> 调研日期：2026-09-02  
> 方法：WebSearch（US 端）+ 少量 WebFetch。**本环境对 App Store / Google Play / 知乎 / 微信 / 多数新闻站的直接抓取被代理阻断**，因此商店评分、下载量、价格等主要来自搜索摘要与第三方聚合站（AppBrain / Similarweb / justuseapp / 评测博客），凡无法交叉验证的数据均标注「未核实」。  
> 参考产品：鱼鱼图鉴 https://fishid.ai-speeds.com（看图认鱼答题 → 抽卡收集 → 鱼缸养鱼；纯前端 + localStorage）。

---

## 0. 一页结论

1. **市场结构**：海外由「AI 拍照识别 + 订阅制」主导（Picture Mushroom / ShroomID / Champignouf 及数十个套壳 AI 识别 app），公益/科学向由 iNaturalist·Seek、Mushroom Observer 承担，离线检索表向有 Shroomify、Mushroom Book。中文市场没有一个强势的「蘑菇专用」产品：形色/百度识图/微信识物/豆包等通用识图承接了大部分需求，专用 app（菌窝子、蘑菇识别扫一扫、MushroomCCS 等）体量小、评价少；官方端以云南疾控风险地图、中科院昆明植物所「菌物王国」数据库（2026-05 开放）为代表，是科普数据库而非消费级产品。
2. **最大痛点是安全**：2022 澳洲毒物中心研究（Clinical Toxicology）三款主流 app 平均准确率约 50%，最好 67%；2026-02 npj Science of Food 研究最好工具仍有 ~15% 失误；Public Citizen 2024 报告点名 AI 识蘑「可致死」；2025-2026 中国出现多起「AI 识图说无毒 → 全家进 ICU」事件，「豆包误判蘑菇」2026-06 上热搜，抖音副总裁回应「AI 回答仅供参考」；法国 ANSES、德国 MHH、多地中国疾控明确发文「不要用 app/AI 判断可食性」。
3. **用户抱怨集中点**：①订阅套路（免费试用自动转年费 $30；周订阅 $4.99-5.99；无买断）②识别不准（有毒识为可食）③免费额度极少（1 张/天或直接付费墙）④物种不本地化（欧美库识中国/云南菌）⑤不保存历史。
4. **游戏化空白**：现有「蘑菇答题」基本是静态 quiz（Sporcle、first-nature、Mushroom World、fungidentification.xyz、iOS Guess Mushroom），无收集/养成/抽卡循环；Seek 有徽章但是拍照驱动；「Pokédex 式蘑菇收集」仅有 MycoDAO 的 Web3 概念（MycoDEX）和纯娱乐向 NEO Mushroom Garden（虚构菌）。**「真实物种 + 看图答题 + 抽卡收集 + 免费 + 明确不做食用判断」的位置目前无人占据**，且这一定位恰好绕开了行业最大的法律/舆论风险。
5. **季节性**：北半球 9-11 月为欧美搜索与中毒高峰（法国 2025 年 7 月起 500 例，10 月峰值；加州 2025-11 至 2026-01 死帽菌大爆发 35-39 例、4 死）；中国全国中毒 6-10 月，**6 月为峰**（2024 中疾控 599 起）；云南吃菌季 6-11 月，7-8 月上市高峰；东北 7 月初-9 月中，8-9 月最集中。上线窗口建议：**中文版 5 月底前（云南吃菌季开启 + 风险地图发布节点），英文版 8 月底前（北美/欧洲秋季）**。

---

## 1. 竞品对比表

| 产品 | 定位 | 识别方式 | 物种覆盖 | 收费 | 下载/评分 | 差评集中点 | 安全免责做法 | 来源 |
|---|---|---|---|---|---|---|---|---|
| **Picture Mushroom**（Glority，中国杭州睿琪出海） | 消费级 AI 识蘑，PictureThis 同厂 | AI 拍照 + 付费专家咨询 | 宣称 5,000+ 种、准确率 95.07%（厂商口径，未核实） | 免费每日 5 次；Premium ≈ $29.99/年，免费试用自动转年订 | Google Play 3M+ 安装、4.2-4.3 分/1.5-1.6 万评；iOS 4.5 分（未核实具体数） | 试用自动扣年费、无法退款；识别错误；被 2022 研究点名准确率约 50% | 商店文案标注仅供参考、建议咨询专家（具体条款未抓取到） | [1][2][3][4][21] |
| **Mushroom Identificator / Mushroom Identify - Automatic**（Champignouf，法国 Pingou 个人开发） | 免费 AI 识蘑 + 采菌地图 + **内置 quiz** | AI 拍照 | Google Play 900+ 种；iOS 文案曾写 2000+（口径不一，未核实） | 免费；Premium $4.99/年（仅多设备同步） | Google Play 1M+ 安装、4.43 分/2.1 万评 | 识别「仍在开发中，结果不完美」；2022 研究表现居中 | 商店文案：「自动识别仍在开发，永远不要吃不认识的蘑菇」「你的命比一顿饭值钱」 | [5][6][7][8][31] |
| **ShroomID**（美国，2021 起） | 消费级 AI + 社区求助 + 出菇日历 + 百科（含 lookalikes） | AI 拍照 + 社区人工 | 1,000+ 种 | 免费基础；Premium $4.99/月 或 $27.99/年 | iOS 4.7 / Google Play 4.3（评论数未核实） | 免费额度有限；付费墙 | 文案称「教育工具，不应作为可食性唯一依据」 | [9][10][11] |
| **Shroomify**（英国独立开发者 Simon Grogan） | **离线检索表型电子图鉴**，按地区+月份排序 | 人工特征检索（非 AI 拍照） | 400+ 种、1,000+ 图；UK/爱尔兰/美国分区/加拿大/德国等区域数据集 | 免费 + 一次性买断（约 $5.99 终身，无订阅无广告） | iOS 4.7 / Google Play 4.6；iOS 下载 100k+（未核实） | 物种数偏少、图片少 | 强调「field guide」而非判断器，鼓励人工比对 | [9][12][13][14] |
| **iNaturalist / Seek** | 公益科学社区（Cal Academy + NatGeo） | iNat：AI 建议 + 社区专家复核；Seek：端侧模型、免登录、儿童友好、**徽章+月度挑战** | 全类群；2025 年平台 250M+ 可验证观测（全类群） | 完全免费 | 全球近 400 万观测者、40 万+ 鉴定者 | 首屏安全弹窗每次打开都出现（设计被吐槽）；需网络与社区复核，非即时 | **每次启动强制显示准确性/安全警告**；社区共识为「最准但仍不可信任食用」 | [15][16][17][18] |
| **Mushroom Observer**（2006，非营利） | 专业/爱好者观测数据库 | 社区加权投票鉴定，无消费级 AI | ~50 万观测、160 万图、~2 万种（2024） | 免费、数据开放 | ~1.2 万贡献者 | 界面老旧、面向专业 | 学术定位，不涉及可食判断 | [19][20] |
| **Mushroom Book & Identification**（Appassion，德国） | 传统图鉴 app + 小型神经网络 | 特征检索 + 照片识别（180 种） | 180+ 种、900+ 图（北美+欧洲） | 付费买断（价格未核实） | 评价两极：「野外只有一半时间能用」 | 识别率低、物种少 | — | [22] |
| **Book of Mushrooms**（Android） | 免费图鉴 + 出菇日历 | 检索 | 250+ 种、1,400+ 图 | 免费 | 未核实 | — | — | [22] |
| **Guess Mushroom**（iOS，2013） | **纯答题游戏** | 无 | 500+ 种 | 未核实 | 未核实（老产品） | 无更新 | — | [23] |
| **Fungi Explorer / "Bomma" 蘑菇识别** | **未找到对应产品**。搜索仅命中「bm mushroom」（印度菌菇种植电商）与多位姓 Bomma 的开发者；Google Play 上另有大量「Mushroom Identifier/Fungi ID/Mushrum/Shroomly」等套壳 AI 识别 app（周订阅 $4.99、年 $39.99，宣称 4,500-5,000 种），用户投诉「注册后不订阅无法用」「到期自动扣费拒退」 | AI 拍照 | 4,500-5,000 类（厂商口径） | 周 $4.99 / 月 $9.99 / 年 $39.99 | 未核实 | 付费墙、自动续费 | 多为一行免责 | [24][25] |
| **形色**（杭州睿琪，与 Picture Mushroom 同厂） | 通用植物识别 | AI 拍照 | 植物 4,000+ 种；**未见官方声明支持真菌**（未核实） | 免费 + 会员 | 国内植物识别头部 | 用于识菌属误用场景 | — | [26] |
| **百度识图 / 微信扫一扫识物 / 豆包等通用 AI** | 通用识图 / 大模型 | 通用视觉 | 非专用 | 免费 | 海量 | **2025-2026 多起「AI 说无毒 → 中毒进 ICU」事件均为通用 AI**；豆包事件上热搜 | 豆包：「仅供参考，不能替代专业诊断」；识别结果附「极易与剧毒大青褶伞混淆」提示但用户仍误食 | [27][28][29][30] |
| **菌窝子**（昆明臻海科技，2021 上线，有 app + 微信小程序） | 云南野生菌识别 + 社区 + 行情 | 宣称 AR 识别 + 3D 比对 | 未公布 | 免费（未核实） | 第三方下载站有分发，官方数据未见 | 评价样本极少 | — | [32] |
| **蘑菇识别 / 蘑菇识别扫一扫 / 菇菇识别**（中国 App Store 多款） | 套壳识图 | AI 拍照 | 未公布 | **周订阅 $5.99**（美区口径） | 未核实 | 「不能保证 100% 准确」 | 一行免责 | [33] |
| **毒蘑菇大百科 - 专业图鉴版**（iOS） | 离线百科（图文视频） | 无 | 「上百种」 | 未核实 | 未核实 | — | 含中毒急救知识 | [34] |
| **MushroomCCS**（武汉康礼高中生作品，2025-04 上架 iOS） | AI 识别 + 科普 | 自训 AI | 未公布；宣称准确率 90%+（媒体口径，未核实） | 未核实 | 媒体报道，无商店数据 | 「能告诉用户有毒无毒/能吃不能吃」——**恰是专家反对的做法** | 未见 | [35] |
| **爱识物**（微信小程序，2021 知乎推荐） | 通用识物，含蘑菇比对 | AI + 数十种蘑菇比对，展示学名/毒性/近似种 | 数十种 | 免费 | 未核实 | — | 强调毒性权重 | [36] |
| **官方/科研端** | 云南疾控「野生菌中毒风险地图」（2025：7 高/49 中/73 低；2026：6/49/74）、全省短信提醒、《云南野生毒菌图鉴》+2022 版毒蘑菇识别小程序；中科院昆明植物所「菌物王国」两大数据库（2026-05-29 免费开放：8,648 种真菌资源库 + 423 幅 3D 子实体 / 182 种）；菌物志 Mycopedia（爱好者网站） | 数据库/科普 | 8,648 种（西南大型真菌） | 免费 | — | 非消费级，无游戏化 | 官方口径「不采、不买、不食」 | [37][38][39][40] |

---

## 2. 逐产品要点

### 2.1 Picture Mushroom（Glority）
- 定位：PictureThis 的蘑菇版，卖点「秒识别 + 可食性/栖息地信息 + 专家咨询 + 采菌点记录」。[1][4]
- 收费：免费用户每日 5 次；Premium 约 $29.99/年（第三方「取消订阅指南」口径）；最典型投诉是「点了免费试用被直接扣一年 $30」。[3][4]
- 体量：Google Play 3M+ 安装，近 30 天 4.4 万下载；4.23 分/1.6 万评（Similarweb/AppBrain 摘要，未核实）。[21]
- 准确率：厂商宣称 95.07%（未核实）；2022 澳洲研究中三款 app 平均约 50%，最佳 67%。[8][34]
- 对 mushroomId 的启示：它就是「形色」团队，说明国内公司做该品类走的是出海订阅路线；国内版并未强推，说明国内蘑菇专用付费市场被判断为小。

### 2.2 Mushroom Identificator（Champignouf）
- 法国独立开发者，免费、社区口碑好、**自带 quiz** 是最接近「教育+游戏」的现存产品；但 quiz 只是附属功能。[5][6]
- 免责文案值得借鉴：「识别仍在开发，结果不完美」「先当搜索起点，再问专家，你的命比一顿饭值钱」。[31]
- 2022 研究中它被点名，法国 ANSES / The Conversation 2025 文章再次点名 app 识别「高错误风险」。[41][42]

### 2.3 ShroomID
- 美国 2021 年新品，做了「AI + 社区互助 + lookalike 百科 + 出菇日历」组合；$27.99/年。[10][11]
- 评分高（iOS 4.7），说明「AI + 人」混合与百科内容能换来口碑。

### 2.4 Shroomify
- 反 AI 路线：离线检索表 + 地区/月份排序，一次性买断、无广告无数据收集，独立开发者。评分最高（4.6-4.7）。[12][13]
- 证明：**「诚实的工具 + 一次性小额付费」在这个品类可获得最高满意度**；而 AI 订阅型评分普遍 4.2-4.4。

### 2.5 iNaturalist / Seek
- iNat：社区共识「最准的 app，但所有 app 都不能用于食用判断」；Seek 每次启动都弹准确性警告。[15][16]
- Seek 的徽章/挑战是本品类唯一成熟的游戏化案例，但驱动是「出门拍照」，室内无法玩；Medium 有文章批评其游戏化导致孩子为刷徽章而乱拍。[18]
- 2025 年平台 250M+ 可验证观测、~400 万观测者。[17]

### 2.6 Mushroom Observer
- 2006 年起、非营利、~50 万观测/160 万图/~2 万种；数据 CC 开放，是多个学术 CNN 数据集来源（FGVCx 2018 等）。[19][20][43]
- 对 mushroomId 的价值：**图片素材来源之一**（需逐张核对许可证；MO 图片按上传者选择的 CC 协议）。

### 2.7 中文市场
- 没有中文版「Picture Mushroom」级别的头部专用产品；用户实际用的是形色/百度识图/微信识物/豆包/元宝。[26][27][28]
- 专用 app（菌窝子、蘑菇识别扫一扫、菇菇识别）在第三方下载站有分发，商店数据稀薄；中国区 App Store 「蘑菇识别」类多为周订阅 $5.99 套壳。[32][33]
- 官方端强势：云南每年 5 月底发布风险地图 + 全省短信 + 图鉴；2026-05 中科院昆明植物所开放 8,648 种数据库与 3D 子实体库。**这是最权威、最可引用的中文物种数据来源，也是「合作/引用」的对象而非竞品**。[37][38][39]
- 2025 年高中生 MushroomCCS 获大量媒体正面报道，说明「学生/科普」叙事在国内传播友好——但其「告诉你能不能吃」的功能取向是行业反面教材。[35]

### 2.8 教育 / 游戏向
| 产品 | 形式 | 备注 | 来源 |
|---|---|---|---|
| Sporcle「mushroom」标签 | 文字/图片 quiz 集合 | 无收集 | [44] |
| first-nature.com Fungi ID quiz | 多选 + Check Your Score | 静态 | [44] |
| Mushroom World quiz | 6 张图 4 选 1 | 静态 | [44] |
| mushroomidentifiers.com quiz | 50 题、30 秒限时、毒/可食 lookalike | 引流到自家 AI 识别 | [44] |
| fungidentification.xyz | 10/20/30 题 × 4 难度 + Teaching Mode（答后给知识点） | 最接近 quiz.js 的形态，但无收集 | [44] |
| Wild Food UK quiz | 3 级、10 分满分 | 静态 | [44] |
| Guess Mushroom（iOS） | 500+ 种猜名得分 + 排行榜 | 2013 老产品 | [23] |
| Champignouf 内置 quiz | 附属功能 | — | [5] |
| Seek 徽章/挑战 | 拍照驱动 | 室内不可玩 | [18] |
| NEO Mushroom Garden / Idle Mushroom Garden（Beeworks） | 300+ **虚构**菌收集养成 | 纯娱乐，无科普 | [45] |
| Mushroom Picker Simulator（Steam） | 100 种真实蘑菇采集模拟 | PC | [45] |
| MycoDAO MycoDEX | 「现实 Pokédex」概念 + 代币激励 | Web3，硬件未落地（未核实） | [46] |

**结论：没有任何产品把「真实物种看图答题 → 抽卡/收集 → 养成」串成一个循环。** 这正是鱼鱼图鉴已经跑通的模式。

---

## 3. 安全事件、媒体与监管（2022-2026）

### 3.1 关键研究
| 时间 | 研究/报告 | 结论 | 来源 |
|---|---|---|---|
| 2022-12 | Clinical Toxicology 61(3)（澳洲维州毒物中心 + 皇家植物园）：78 份样本测 Picture Mushroom / Mushroom Identificator / iNaturalist | 平均正确约 50%；最好 67%；**有毒被判为可食**的案例存在 | [8][47] |
| 2023-08/09 | 404media / Fortune / Guardian：Amazon 上 AI 生成采菌书 | 纽约真菌学会警告「生死攸关」 | [48][49] |
| 2024-03-18 | Public Citizen《Mushrooming Risk》（Rick Claypool） | 引用 2015 俄勒冈一家四口、2022 俄亥俄男子（鹅膏）因 app 误判入院；ChatGPT/DALL-E 套壳识蘑机器人产出危险信息；Google 曾给出剧毒 Amanita ocreata 的烹饪步骤 | [50][51] |
| 2025 | 清华大学人工智能研究院《图像识别安全报告》 | 自然场景下 AI 对野生菌类高相似物种误判率 32%（仅见媒体转述，**未核实**原始报告） | [29] |
| 2026-02 | npj Science of Food《AI-mediated risks and real-life challenges in mushroom foraging》 | 100+ 张实拍照片、近 60 种；最好工具失误 ~15%，无一工具稳定给出唯一正确答案；AI 缺乏气味/质地/基质/季节等非视觉线索 | [52] |
| 2026-02 | bioRxiv《Human-AI Interaction in Household Mycology》 | 家庭场景人机交互风险（未细读） | [53] |

### 3.2 中国事件线（2024-2026）
- 2024-04：澎湃「用 AI 软件识别毒蘑菇？AI 犯错后人吃下毒鹅膏差点丢命」。[54]
- 2025-07：四川康定情侣用 AI 逐一扫描，AI 判「可食用红菇」实为有毒；同月武汉一家三口 AI 判「无毒」全家中毒，孩子 ICU 8 天。[27]
- 2026-03/04：深圳两周 12 人采食中毒（致命白毒伞等）；[55]
- 2026-05：云南大学附属医院 5 月起陆续收治，其中一位是主任医师。[28]
- 2026-06-05：「不可相信豆包识别的蘑菇」上热搜；抖音副总裁李亮回应：豆包识别为「鸡腿菇」但同时提示「极易与剧毒大青褶伞混淆」，「AI 的回答仅供参考」。[28][56]
- 2026-07：武汉一家三口（4 岁女童肝酶飙 100 倍进 PICU）；端午另一 9 岁男童误食含鹅膏毒素的「funeral bell」。[27][57]
- 2026-08：多地疾控发文「不能使用 AI 识别工具、识图软件判断野生菌能否食用」。[27]

### 3.3 海外事件线
- 法国：2025-07-01 起至 10 月初 500 例中毒；ANSES 明确「用 app 识别蘑菇错误风险高」；监测自 2025 年起改为全年。[41][58]
- 德国：汉诺威医学院（MHH）警告「app 和图鉴都不能防混淆」。[59]
- 美国加州：2025-11-18 至 2026-01-06 死帽菌「超级爆发」35-39 例、4 死、3-4 例肝移植，横跨 9 县，移民群体（墨西哥、中国）占比高——因死帽菌与其原产地可食种相似。**部分博客称「AI app 是多起事件的诱因」（mushroomtracker.ca，营销站，未核实）**，主流媒体（NBC/KQED/SF Chronicle）未将其归因于 app。[60][61][62]
- 澳洲：维州毒物中心 2025 年 400+ 通蘑菇暴露来电，近半为 5 岁以下儿童。[8]

### 3.4 监管与平台
- 截至 2026-05，美国/欧盟均无针对消费级 AI 识别 app 的专门法规（博客口径，未核实）。[63]
- Apple 2026-03 起要求 Health & Fitness / Medical 类及「频繁引用医疗信息」的 app 在 App Store Connect 声明「受监管医疗器械状态」，2027 年初前未声明不能更新——**蘑菇 app 若强调「可食/有毒」判断，可能被归入此范围**（推测，未核实）。[64]
- 2024 Apple 拒审 193 万个 app（宏观背景）。[64]

### 3.5 行业「安全免责」最佳实践（综合）
1. **产品定位层面**：明确「教育/识别辅助/娱乐」，**永远不输出「可食」结论**；Shroomify、Seek、Champignouf 的口碑都建立在「不替你做决定」上。
2. **入口强提示**：Seek 每次启动弹准确性警告（虽被嫌烦，但社区认可其必要性）；建议首次 + 每次进入「真实照片」相关页面时弹一次，可设「今日不再提示」。
3. **文案模板**（综合 mushroomidentifiers.com / FungiAtlas / Know The Spore / Champignouf）：
   - 「本产品仅用于教育与娱乐，识别结果可能不准确。」
   - 「切勿依据本产品判断任何野生蘑菇是否可以触摸、烹饪或食用。」
   - 「食用野生菌前请咨询当地真菌学会/专业人员；如出现不适立即就医并保留样本。」
   - 「相似有毒种」并列展示（lookalike 卡），把「危险相似」当成知识点而不是判定。[65]
4. **数据层面**：物种卡片显示「毒性等级」时使用权威来源（中疾控 246 种致毒蘑菇名录、云南图鉴、中科院数据库），并标注来源与「该信息不构成食用建议」。[66]
5. **法律层面**：真菌学会标准 Terms of Use & Liability Waiver（Arizona / Madison Mycological Society）——「as is」「不承担任何因使用信息产生的责任」；但 mushroomtracker 等亦指出「结果页底部一行免责 ≠ 工作流内的安全护栏」，产品设计要避免「鼓励依赖」（例如不要做「拍照→告诉你能不能吃」流程）。[63][67]
6. **不做拍照识别** 本身就是最大的护栏：mushroomId 只做「已知物种的看图选择题」，不接收用户上传的未知蘑菇照片，从根本上不产生「误判→误食」链路。

---

## 4. 用户核心需求与抱怨（App Store / Google Play / 知乎 / 小红书 / 论坛）

| 抱怨 | 典型表述 | 来源 |
|---|---|---|
| 订阅套路 | 「点免费试用直接扣一年 $30」「到期自动续费拒退 $16」「只有周订阅 $4.99/5.99」「没有买断」 | [3][24][25][33] |
| 付费墙过早 | 「只能识别 1 张就要付费，没法测试好不好用」「注册后不订阅无法使用」 | [24][25] |
| 识别不准 | 「常见野生菌一半以上识错」「Cortinarius iodes（有毒）识成可食 blewit」「野外只有一半时间能用」 | [24][22] |
| 物种/地域缺失 | 欧美库识不了亚洲/中国物种；Shroomify 靠「按地区+月份」排序反而获好评；加州移民因死帽菌像家乡可食种中毒 | [12][60] |
| 体验 | 不保存历史；广告；每次启动弹警告（Seek） | [24][15] |
| 中文侧 | 知乎「有识别蘑菇的 APP 吗」类问题热度稳定但回答稀少，推荐的多是通用识物小程序；小红书搜索结果未能抓取（**未核实**） | [36] |

**需求侧**（正面评价与搜索行为推断）：
- 「秒识别」快感 → 可以转化为「看图答题」的即时反馈。
- 「出菇日历 / 本地物种」→ 图鉴按地区/季节筛选。
- 「lookalike 百科」（ShroomID 高分点）→ 题目干扰项用相似种，答后展示「相似有毒种」卡片。
- 「离线、无账号、无广告、不收集数据」（Shroomify/Seek 高分点）→ 纯前端 + localStorage 天然满足。
- 「儿童/家庭」（Seek 儿童友好；澳洲近半来电涉幼儿）→ Q 版画风 + 「不要摸不要吃」教育。

---

## 5. 市场空白与切入位置

| 空白 | 现状 | mushroomId 切入 |
|---|---|---|
| **游戏化真实图鉴** | quiz 站静态、Seek 靠出门拍照、养成游戏用虚构菌 | 鱼鱼图鉴模式复用：看图答题 → 抽卡 → 菌圃（腐木/落叶层/草地/沙地）养成 |
| **零风险的蘑菇产品** | 所有识别 app 都背着「误判致死」的舆论/法律风险，2026 年豆包事件后国内监管/媒体敏感度极高 | 不做拍照识别、不输出可食结论、把「毒性」作为图鉴知识而非判定；反而可借势「别信 AI 识菌，先学会认菌」做传播 |
| **中文本土物种** | 头部产品欧美库为主；中文专用 app 弱；官方数据库权威但无产品化 | 以云南/东北/华南常见食用菌 + 中疾控 246 种致毒菌为骨架，首批 150-250 种；引用中科院/疾控口径提升可信度 |
| **免费 + 无账号** | AI 类周/年订阅；免费的只有公益与独立开发者 | 完全免费、localStorage，与鱼鱼图鉴共享存档迁移 |
| **教育/儿童/家庭** | Seek 是唯一儿童向；国内官方科普以文章/短信为主 | Q 版画风 + 「毒菇不采不吃」教程卡 + 「相似有毒种」对比题 |
| **季节性内容** | 出菇日历是付费点 | 每日任务/限时活动跟随「吃菌季」（6-11 月中文；9-11 月英文） |
| **官方合作机会** | 云南疾控每年 5 月底发布地图、全省短信；中科院数据库刚开放 | 争取引用授权/科普合作，作为 5 月底「吃菌季」的公益游戏 |

**建议定位一句话**：「不教你吃，只教你认」——用鱼鱼图鉴同款抽卡收集，把中疾控/云南疾控/中科院的科普数据做成能玩的中文蘑菇图鉴。

**风险提示**：
- 即使不做识别，「毒性」信息本身也需谨慎：建议只用「可食/条件可食/不宜/有毒/剧毒」五档官方分类，并在剧毒物种卡片加醒目「致死」标识与「不采不买不食」口号。
- 真实照片版权：Wikimedia Commons（同鱼鱼图鉴）、Mushroom Observer（逐张核 CC 协议）、iNaturalist（CC-BY-NC 需核对）。
- SEO 关键词碰撞：「蘑菇识别」类搜索意图是识别而非游戏，页面文案需清晰区隔避免被当成识别工具误用。

---

## 6. 季节性与地域

| 地区 | 高峰月 | 依据 | 来源 |
|---|---|---|---|
| 中国全国 | 6-10 月，**6 月为峰**（2024：599 起/1,486 人/13 死，前五省四川、云南、湖南、贵州、重庆；死亡分布贵州 5、四川 2、重庆 2、黑龙江 2、湖南 1、江苏 1） | 中疾控周报 2025-05 | [66] |
| 云南 | 吃菌季 6-11 月，7-8 月上市峰（木水花市场日销 ~200 吨）；风险地图每年 5 月底-6 月初发布；2024 死亡 11 人为十年最低；近五年年均 400+ 起/1,500+ 人/30+ 死（老口径） | 云南疾控/新华/京报 | [37][38][68][69] |
| 东北（吉林/黑龙江） | 7 月初-9 月中，**8-9 月最集中**（肉褐鳞环柄菇）；2025-08-30 延边疾控预警 | 光明网/腾讯新闻 | [70] |
| 华南（深圳/广东） | 3-4 月清明雨后 + 6 月（致命白毒伞、大青褶伞在小区草坪） | 光明网/新浪 | [55] |
| 欧洲（法/德/意/波） | 9-11 月，**10 月峰**；法国 2025-07 起 500 例 | ANSES / Food Safety News / MHH | [41][58][59] |
| 北美太平洋西北 | 9-11 月，**10-11 月最佳**，鸡油菌 11 月峰直到初霜 | Mushroom Appreciation 等 | [71] |
| 北美加州 | 11-1 月雨后（2025-26 死帽菌大爆发） | NBC/KQED | [60][61] |
| 澳洲（维州） | 秋季 3-5 月（南半球）；2025 年 400+ 通来电 | SGST | [8] |
| 搜索热度 | Google Trends「mushroom identification」秋季峰值属于常识级结论，**未取得可引用的年度曲线数据（Trends 无法抓取，未核实）**；西班牙 9 年市场研究证实 Google 搜索量与野生菌需求同步且逐年上升，牛肝菌价格在季初与圣诞双高 | ScienceDirect 2023 | [72] |

**上线节奏建议**：中文版 5 月中旬前完成（赶云南 5 月底风险地图 + 6 月全国峰）；英文版 8 月底前（北美/欧洲 9 月开季）；每年 3 月华南清明档可做「草坪毒菇」主题活动。

---

## 7. 来源列表

[1] https://appfollow.io/ios/picturemushroommushroomid/1474578078  
[2] https://apps.apple.com/gb/app/picture-mushroom-identifier/id1474578078  
[3] https://justuseapp.com/cancel/1474578078/picture-mushroom-mushroom-id  
[4] https://play.google.com/store/apps/details?id=com.glority.picturemushroom&hl=en_US  
[5] https://apps.apple.com/us/app/mushroom-identificator/id1227854971  
[6] https://play.google.com/store/apps/details?id=com.pingou.champignouf&hl=en_US  
[7] https://similarweb.com/app/google-play/com.pingou.champignouf/statistics  
[8] https://www.sgst.com.au/mushroom-foragers-warned-against-using-ai-apps-for-identification/  
[9] https://realmushrooms.com/blogs/rm/best-mushroom-identification-app-top-3-reviewed  
[10] https://apps.apple.com/us/app/shroomid-identify-mushrooms/id1547653790  
[11] https://www.mushroomtracker.ca/blog/best-mushroom-foraging-apps-2026.html  
[12] https://apps.apple.com/gb/app/shroomify-mushroom-id/id1490594715  
[13] https://ecocation.org/best-free-mushroom-identification-apps/  
[14] https://mwm.ai/apps/shroomify-mushroom-id-usa/1490594715  
[15] https://forum.inaturalist.org/t/what-fungi-identifier-apps-are-reliable/49004  
[16] https://www.inaturalist.org/pages/seek_app  
[17] https://www.inaturalist.org/blog/113107-we-ve-reached-250-million-verifiable-observations  
[18] https://medium.com/@clairedlmk/when-gamification-goes-wrong-b19cca8842bd  
[19] https://en.wikipedia.org/wiki/Mushroom_Observer  
[20] https://mushroomobserver.org/info/intro  
[21] https://www.similarweb.com/app/google/com.glority.picturemushroom/  
[22] https://grocycle.com/best-mushroom-identification-apps/  
[23] https://apps.apple.com/us/app/guess-mushroom/id777236213  
[24] https://play.google.com/store/apps/details?id=com.ai.mushroom_identifier&hl=en  
[25] https://apps.apple.com/us/app/mushroom-identifier-fungus-id/id1589931673  
[26] https://www.32r.com/app/34565.html  
[27] https://news.qq.com/rain/a/20260805A06NS700  
[28] https://finance.sina.com.cn/wm/2026-06-05/doc-iniakfhp1613648.shtml  
[29] https://k.sina.com.cn/article_7880068208_1d5b04c7006801mbkq.html  
[30] https://www.ithome.com/0/960/476.htm  
[31] https://champignouf.com/  
[32] https://m.tech.china.com/tech/article/20210625/20210625812035.html  
[33] https://apps.apple.com/cn/app/id6443446222  
[34] https://apps.apple.com/cn/app/id1616840887  
[35] https://news.qq.com/rain/a/20250415A079K200  
[36] https://zhuanlan.zhihu.com/p/386690068  
[37] https://m.163.com/dy/article/K18CO2J80550EB0R.html  
[38] https://m.gmw.cn/2026-05/26/content_1304471523.htm  
[39] https://www.news.cn/tech/20260529/ce39adddf8ec46f78086a739743f8d09/c.html  
[40] http://www.mycopedia.top/  
[41] https://www.anses.fr/en/content/mushroom-picking-beware-of-the-risks-of-poisoning  
[42] https://theconversation.com/pour-la-cueillette-des-champignons-ne-vous-fiez-pas-aux-applis-pour-les-identifier-266275  
[43] https://mushroomobserver.org/articles/20  
[44] https://www.sporcle.com/games/tags/mushroom ; https://www.first-nature.com/fungi/~id-quiz.php ; https://www.mushroom.world/quiz ; https://mushroomidentifiers.com/mushroom-identification-quiz ; https://fungidentification.xyz/ ; https://www.wildfooduk.com/articles/test-your-mushroom-knowledge-with-this-educational-quiz/  
[45] https://apps.apple.com/us/app/neo-mushroom-garden/id855028978 ; https://store.steampowered.com/app/1370610/Mushroom_Picker_Simulator/  
[46] https://www.mycodao.com/projects/myco-app-mycodex  
[47] https://pubmed.ncbi.nlm.nih.gov/36794335/  
[48] https://www.404media.co/ai-generated-mushroom-foraging-books-amazon/  
[49] https://fortune.com/2023/09/03/ai-written-mushroom-hunting-guides-sold-on-amazon-potentially-deadly/  
[50] https://www.citizen.org/article/mushroom-risk-ai-app-misinformation/  
[51] https://www.citizen.org/wp-content/uploads/ai-mushroom-apps-risk-misinformation-report-2024.pdf  
[52] https://www.nature.com/articles/s41538-026-00752-4  
[53] https://www.biorxiv.org/content/10.64898/2026.02.24.707810v1.full  
[54] https://www.thepaper.cn/newsDetail_forward_27028217  
[55] https://m.gmw.cn/2026-04/03/content_1304404081.htm  
[56] https://tidenews.com.cn/news.html?id=3464706  
[57] https://unwire.hk/2026/07/30/ai-mushroom-poison-hk/ai/  
[58] https://www.foodsafetynews.com/2025/10/hundreds-poisoned-by-mushrooms-in-france/  
[59] https://www.mhh.de/en/presse/mhh-insight/news-detailed-view/deadly-danger-mhh-warns-of-death-cap-mushrooms  
[60] https://www.nbcnews.com/news/us-news/4-people-died-eating-death-cap-mushrooms-california-rcna257899  
[61] https://www.kqed.org/science/1999828/california-combats-largest-mushroom-poisoning-outbreak-in-the-country  
[62] https://www.sfchronicle.com/bayarea/article/death-cap-mushrooms-poison-21320813.php  
[63] https://www.mushroomtracker.ca/blog/ai-mushroom-identification-safe-2026.html （营销博客，数据未核实）  
[64] https://developer.apple.com/news/?id=nyqbfz1y ; https://appleinsider.com/articles/25/05/30/millions-of-apps-were-denied-by-apple-in-2024-amid-fraud-crackdown  
[65] https://mushroomidentifiers.com/safety-disclaimer ; https://fungiatlas.com/disclaimer/ ; https://knowthespore.com/disclaimer/  
[66] https://news.qq.com/rain/a/20250522A0162400 ; https://weekly.chinacdc.cn/news/media-briefing/8b868075-5b3b-4eeb-b1e4-fb982949d474_en.htm  
[67] https://www.arizonamushroomsociety.org/terms-use-liability-waiver ; https://madisonmycologicalsociety.com/mms-terms-of-use-and-liability-waiver/  
[68] https://news.sina.com.cn/zx/gj/2026-06-23/doc-iniekzkq1942329.shtml  
[69] https://m.gmw.cn/2025-06/05/content_1304052423.htm  
[70] https://m.gmw.cn/2025-09/01/content_1304132015.htm  
[71] https://www.mushroom-appreciation.com/fall-mushroom-foraging-in-the-pacific-northwest.html  
[72] https://www.sciencedirect.com/science/article/pii/S1389934123000886  
