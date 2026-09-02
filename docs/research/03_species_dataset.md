# mushroomId 物种数据库方案（R3：物种清单 · 字段 · 题库 · 图片版权 · 参考源 · 安全红线）

> 顾问视角：真菌学 + 数据工程。参考产品「鱼鱼图鉴」（270 鱼 / 4 档稀有度 / 1087 题）。
> 调研日期：2026-09-02。学名以 Index Fungorum / MycoBank / Fungal Names 当前接受名为准，凡未逐条核对或存在分类争议者标「待核」。
> 本文所有「食用 / 有毒」信息仅为百科科普与游戏数据设计之用，**不构成任何采食建议**。

---

## 0. 结论速览

| 项 | 建议 |
|---|---|
| 物种规模 | **250 种**（首发 ≥ 200，预留 50 做版本更新）；本文清单 253 种 |
| 稀有度 | common 100 / rare 95 / epic 43 / legend 15（与鱼鱼图鉴 107/106/43/14 对齐） |
| 分档公式 | `score = 知名度(1–5) + 奇特度(1–5) + (6 − 常见度(1–5))`，≤7 common，8–10 rare，11–12 epic，≥13 legend；再用「主题配平」手动微调 |
| 新增字段 | `latin / authority / family / edibility / toxinClass / syndrome / lookalikes / season / substrate / symbiont / region / morphology / sporePrint / size / smell / bioluminescent / colorChange / cultivated / imageCredit` |
| 题库 | 10 类题型，约 1 080 题（4.3 题/种），难度 1–5 |
| 真实照片 | 主源 Wikimedia Commons（只收 CC0 / CC BY / CC BY-SA / PD），次源 iNaturalist（API 过滤 `photo_license=cc0,cc-by`）、Mushroom Observer（默认 CC BY-SA，逐张核对）；**DF20 / FGVCx 2018 / MO106 三个 ML 数据集均为非商用研究许可，不能用作游戏素材** |
| Q 版立绘 | AI 生图可行（北京互联网法院 2023 年已认可有充分人类创作投入的 AI 图可享著作权），但须真菌学审稿 + 标注「AI 辅助生成」 |
| 安全 | 数据层字段只描述「资料记载类别」，UI 层强制免责，禁用「能吃 / 安全」等措辞，明确「本图鉴不能用于野外鉴定」 |

---

## 1. 物种清单（253 种）

### 1.1 分档依据

三个 1–5 分维度：

- **常见度 C**：5 = 超市随处可见 / 全国草坪常见；1 = 仅特定产地或极少报道
- **知名度 K**：5 = 大众都叫得出名字（香菇、松茸、毒蝇伞）；1 = 只有真菌爱好者知道
- **奇特度 U**：5 = 视觉或生物学上极端反常（发光、笼状、恶魔雪茄、僵尸蚂蚁）；1 = 普通伞菌

`score = K + U + (6 − C)`，对应：

| 档 | score | 目标数 | 典型 |
|---|---|---|---|
| common | ≤ 7 | 100 | 栽培菌、草坪常见菌、最常见毒菌（大青褶伞） |
| rare | 8–10 | 95 | 云南野生菌主力、欧美经典野生食用菌、常见剧毒鹅膏 |
| epic | 11–12 | 43 | 干巴菌、鸡枞、长裙竹荪、毒鹅膏、红笼头菌、出血齿菌 |
| legend | ≥ 13 | 15 | 松茸、白松露、冬虫夏草、荧光小菇、恶魔雪茄、天蓝蘑菇、毒蝇伞 |

> 设计取舍：抽卡稀有度 ≠ 生物学珍稀度。毒蝇伞在欧洲很常见，但作为「马里奥蘑菇」知名度 5、奇特度 4，放 legend 更有抽卡爽感；反之很多真正罕见但外观平淡的种（Boletus reticuloceps）只到 rare。

### 1.2 「食性标签」枚举（仅科普，见 §6）

`cultivated` 栽培食用菌 ｜ `wild_edible` 资料记载为野生食用菌 ｜ `conditional` 资料记载须充分加热/专业处理 ｜ `unknown` 食性不明/不宜食用 ｜ `poisonous` 有毒 ｜ `deadly` 剧毒（有致死记录）｜ `medicinal` 药用（不作食物）｜ `inedible` 无毒但木质/不可食

### 1.3 清单

列：`id` 建议直接作为文件名（`assets/mushroom/cute/{id}.webp`）。「英文俗名」缺失处填学名。

#### A. 栽培食用菌 / 药用菌（38 种，主要 common）

| # | id | 中文名 | 学名 | 英文俗名 | 类别 | 稀有度 | 食性标签 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 1 | shiitake | 香菇 | *Lentinula edodes* | Shiitake | 栽培 | common | cultivated | 全球产量第一（中国） |
| 2 | oyster | 平菇（糙皮侧耳） | *Pleurotus ostreatus* | Oyster mushroom | 栽培 | common | cultivated | 会捕食线虫（冷知识） |
| 3 | enoki | 金针菇 | *Flammulina filiformis* | Enoki | 栽培 | common | cultivated | 2018 年从 *F. velutipes* 分出的东亚种 |
| 4 | kingoyster | 杏鲍菇 | *Pleurotus eryngii* | King oyster | 栽培 | common | cultivated | 野生型与刺芹共生 |
| 5 | woodear | 黑木耳 | *Auricularia heimuer* | Black wood ear | 栽培 | common | cultivated | 2014 年定名，此前误作欧洲种 |
| 6 | hairywoodear | 毛木耳 | *Auricularia cornea* | Cloud ear | 栽培 | common | cultivated | 旧名 *A. polytricha* |
| 7 | snowfungus | 银耳 | *Tremella fuciformis* | Snow fungus | 栽培 | common | cultivated | 需与「香灰菌」伴生才能出耳 |
| 8 | lionsmane | 猴头菇 | *Hericium erinaceus* | Lion's mane | 栽培 | common | cultivated | |
| 9 | button | 双孢蘑菇 | *Agaricus bisporus* | Button / Portobello | 栽培 | common | cultivated | 白蘑菇、褐菇、大褐菇是同一种不同成熟度 |
| 10 | strawmushroom | 草菇 | *Volvariella volvacea* | Straw mushroom | 栽培 | common | cultivated | 有菌托，幼体形似剧毒鹅膏 |
| 11 | shimeji | 蟹味菇 / 白玉菇 | *Hypsizygus marmoreus* | Beech mushroom | 栽培 | common | cultivated | 白玉菇为白色品系 |
| 12 | nameko | 滑子菇 | *Pholiota microspora* | Nameko | 栽培 | common | cultivated | 异名 *P. nameko* |
| 13 | teatree | 茶树菇 | *Cyclocybe chaxingu*（待核；或 *C. aegerita*） | Tea tree mushroom | 栽培 | common | cultivated | 学名争议大 |
| 14 | shaggyink | 鸡腿菇（毛头鬼伞） | *Coprinus comatus* | Shaggy ink cap | 栽培/野生 | common | cultivated | 成熟后自溶成墨汁 |
| 15 | winecap | 大球盖菇（赤松茸） | *Stropharia rugosoannulata* | Wine cap | 栽培 | common | cultivated | 商品名「赤松茸」与松茸无关 |
| 16 | goldenoyster | 榆黄蘑 | *Pleurotus citrinopileatus* | Golden oyster | 栽培 | common | cultivated | |
| 17 | pinkoyster | 红平菇 | *Pleurotus djamor* | Pink oyster | 栽培 | common | cultivated | |
| 18 | phoenixoyster | 秀珍菇 | *Pleurotus pulmonarius* | Phoenix oyster | 栽培 | common | cultivated | |
| 19 | bailing | 白灵菇 | *Pleurotus tuoliensis*（待核） | Bailing mushroom | 栽培 | common | cultivated | 新疆阿魏共生 |
| 20 | blackskin | 黑皮鸡枞（长根菇） | *Hymenopellis raphanipes* | Black-skin "termite" mushroom | 栽培 | common | cultivated | 商品名蹭「鸡枞」，实为小奥德蘑类 |
| 21 | lateoyster | 元蘑（亚侧耳） | *Sarcomyxa serotina* | Late oyster | 栽培/野生 | common | cultivated | 东北「冻蘑」 |
| 22 | almond | 姬松茸 | *Agaricus subrufescens* | Almond mushroom | 栽培 | common | cultivated | 与松茸无亲缘；二选一题材 |
| 23 | turkeytail | 云芝 | *Trametes versicolor* | Turkey tail | 药用 | common | medicinal | 假云芝 = 韧革菌 |
| 24 | poria | 茯苓 | *Wolfiporia hoelen* | Poria / Hoelen | 药用 | common | medicinal | 旧名 *W. cocos*；菌核 |
| 25 | maitake | 灰树花 | *Grifola frondosa* | Maitake / Hen of the woods | 栽培 | rare | cultivated | |
| 26 | reishi | 灵芝（赤芝） | *Ganoderma lingzhi* | Lingzhi / Reishi | 药用 | rare | medicinal | 2012 年才与欧洲 *G. lucidum* 区分 |
| 27 | purplelingzhi | 紫芝 | *Ganoderma sinense* | Purple lingzhi | 药用 | rare | medicinal | |
| 28 | militaris | 蛹虫草 | *Cordyceps militaris* | Scarlet caterpillar fungus | 栽培/药用 | rare | medicinal | 北虫草 |
| 29 | cauliflower | 绣球菌 | *Sparassis latifolia*（欧洲 *S. crispa*） | Cauliflower mushroom | 栽培/野生 | rare | cultivated | |
| 30 | elmear | 榆耳 | *Gloeostereum incarnatum* | Elm ear | 栽培 | rare | cultivated | |
| 31 | goldenear | 金耳 | *Naematelia aurantialba* | Golden ear | 栽培 | rare | cultivated | 旧名 *Tremella aurantialba* |
| 32 | blackbolete | 黑牛肝（暗褐脉柄牛肝菌） | *Phlebopus portentosus* | Black bolete | 栽培/野生 | rare | cultivated | 世界首个人工栽培牛肝菌（云南） |
| 33 | morelcult | 梯棱羊肚菌 | *Morchella importuna* | Cultivated morel | 栽培 | rare | cultivated | 中国大田栽培主力种 |
| 34 | tigermilk | 虎奶菇 | *Pleurotus tuber-regium* | Tiger milk mushroom | 栽培 | rare | cultivated | 菌核 |
| 35 | chaga | 桦褐孔菌（白桦茸） | *Inonotus obliquus* | Chaga | 药用 | rare | medicinal | 桦树上的黑色不育菌核 |
| 36 | sanghuang | 桑黄 | *Sanghuangporus sanghuang* | Sanghuang | 药用 | rare | medicinal | 2016 年才定名 |
| 37 | zhuling | 猪苓 | *Polyporus umbellatus* | Umbrella polypore | 药用 | rare | medicinal | 药用菌核 |
| 38 | antrodia | 牛樟芝 | *Taiwanofungus camphoratus* | Niu-chang-chih | 药用 | epic | medicinal | 台湾特有，牛樟树心材 |

#### B. 中国 / 云南野生食用菌（55 种，rare 为主）

| # | id | 中文名 | 学名 | 英文俗名 | 类别 | 稀有度 | 食性标签 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 39 | matsutake | 松茸 | *Tricholoma matsutake* | Matsutake | 野生 | legend | wild_edible | 松树外生菌根；不可栽培 |
| 40 | fakematsutake | 假松茸 | *Tricholoma bakamatsutake* | Bakamatsutake | 野生 | rare | wild_edible | 二选一题材 |
| 41 | termite | 鸡枞 | *Termitomyces albuminosus*（待核；云南多种） | Termite mushroom | 野生 | epic | wild_edible | 与大白蚁共生，只长在蚁巢上 |
| 42 | smalltermite | 鸡枞花（小果鸡枞） | *Termitomyces microcarpus* | Small termite mushroom | 野生 | rare | wild_edible | |
| 43 | ganbajun | 干巴菌 | *Thelephora ganbajun* | Ganba fungus | 野生 | epic | wild_edible | 1987 年臧穆定名；云南最贵菌之一 |
| 44 | jianshouqing | 兰茂牛肝菌（红葱·见手青） | *Lanmaoa asiatica* | Lanmao's bolete | 野生 | epic | conditional | 生食/未熟致「小人国」幻视；2025 版云南毒菌名录已移出 |
| 45 | whiteonion | 白葱（玫黄黄肉牛肝菌） | *Butyriboletus roseoflavus* | White onion bolete | 野生 | rare | conditional | 见手青家族 |
| 46 | brownbolete | 茶褐新牛肝菌（黑见手） | *Neoboletus brunneissimus* | — | 野生 | rare | conditional | |
| 47 | magnificus | 华丽新牛肝菌（红见手） | *Neoboletus magnificus* | — | 野生 | rare | conditional | |
| 48 | bainiugan | 白牛肝菌 | *Boletus bainiugan* | White porcini | 野生 | rare | wild_edible | 2017 年从 *B. edulis* 分出 |
| 49 | porcini | 美味牛肝菌 | *Boletus edulis* | Porcini / King bolete | 野生 | rare | wild_edible | 欧洲经典 |
| 50 | reticuloceps | 网盖牛肝菌 | *Boletus reticuloceps* | — | 野生 | rare | wild_edible | |
| 51 | chanterelle | 鸡油菌 | *Cantharellus cibarius* | Chanterelle | 野生 | rare | wild_edible | 假褶 vs 杰克灯真褶 |
| 52 | yunnanchant | 云南鸡油菌 | *Cantharellus yunnanensis*（待核） | Yunnan chanterelle | 野生 | rare | wild_edible | |
| 53 | morel | 羊肚菌 | *Morchella esculenta* | Morel | 野生 | epic | conditional | 必须熟食；鹿花菌为易混种 |
| 54 | blackmorel | 黑脉羊肚菌 | *Morchella elata* | Black morel | 野生 | rare | conditional | |
| 55 | bambooveil | 长裙竹荪 | *Phallus indusiatus* | Veiled lady / Bamboo fungus | 野生/栽培 | epic | cultivated | 鬼笔科却是名菜 |
| 56 | redveil | 红托竹荪 | *Phallus rubrovolvatus* | Red-volva bamboo fungus | 栽培 | rare | cultivated | 贵州织金 |
| 57 | yellowveil | 黄裙竹荪 | *Phallus luteus*（待核，与 *P. multicolor* 混用） | Yellow-net stinkhorn | 野生 | rare | unknown | 资料多记为有毒/不宜食 |
| 58 | greenrussula | 青头菌（变绿红菇） | *Russula virescens* | Green-cracking russula | 野生 | rare | wild_edible | |
| 59 | bigred | 大红菌（灰肉红菇） | *Russula griseocarnosa* | — | 野生 | rare | wild_edible | 福建 / 广西 |
| 60 | saffronmilk | 松乳菇 | *Lactarius deliciosus* | Saffron milk cap | 野生 | common | wild_edible | 乳汁橙色，伤后变绿 |
| 61 | hatsudake | 红汁乳菇 | *Lactarius hatsudake* | Hatsudake | 野生 | rare | wild_edible | 乳汁酒红色 |
| 62 | volemus | 多汁乳菇（奶浆菌） | *Lactifluus volemus* | Weeping milk cap | 野生 | rare | wild_edible | 乳汁极多，鱼腥味 |
| 63 | oldman | 老人头菌 | *Catathelasma ventricosum*（待核） | — | 野生 | rare | wild_edible | 云南 |
| 64 | mongolica | 蒙古口蘑（白蘑） | *Leucocalocybe mongolica* | Mongolian tricholoma | 野生 | epic | wild_edible | 草原蘑菇圈 |
| 65 | friedchicken | 荷叶离褶伞（一窝鸡） | *Lyophyllum decastes* | Fried chicken mushroom | 野生 | common | wild_edible | |
| 66 | tigerpaw | 翘鳞肉齿菌（黑虎掌） | *Sarcodon imbricatus*（待核，或 *S. aspratus*） | Shingled hedgehog | 野生 | rare | wild_edible | 菌齿而非菌褶 |
| 67 | hedgehog | 卷缘齿菌 | *Hydnum repandum* | Hedgehog mushroom | 野生 | rare | wild_edible | |
| 68 | coral | 葡萄状枝瑚菌（扫帚菌） | *Ramaria botrytis* | Pink-tipped coral | 野生 | rare | conditional | 与美丽枝瑚菌混淆 |
| 69 | slipperyjack | 褐环乳牛肝菌（松蘑） | *Suillus luteus* | Slippery jack | 野生 | common | conditional | 黏盖需去皮 |
| 70 | larchbolete | 厚环乳牛肝菌 | *Suillus grevillei* | Larch bolete | 野生 | common | conditional | 只与落叶松共生 |
| 71 | honey | 蜜环菌（榛蘑） | *Armillaria mellea* | Honey fungus | 野生 | common | conditional | 菌索发光；小鸡炖蘑菇 |
| 72 | eggamanita | 红黄鹅膏（鸡蛋菌） | *Amanita hemibapha* | Half-dyed slender caesar | 野生 | rare | conditional | 有菌托，与剧毒鹅膏同属 |
| 73 | caesar | 橙盖鹅膏 | *Amanita caesarea* | Caesar's mushroom | 野生 | epic | wild_edible | 罗马皇帝的蘑菇 |
| 74 | chinesetruffle | 中华块菌（印度块菌） | *Tuber indicum* | Chinese black truffle | 野生 | epic | wild_edible | 云南攀西；地下 |
| 75 | pinecone | 松塔牛肝菌（老头菌） | *Strobilomyces strobilaceus* | Old man of the woods | 野生 | rare | wild_edible | |
| 76 | blacktrumpet | 灰喇叭菌 | *Craterellus cornucopioides* | Black trumpet | 野生 | rare | wild_edible | 「穷人的松露」 |
| 77 | blewit | 紫丁香蘑 | *Lepista nuda* | Wood blewit | 野生 | common | conditional | |
| 78 | sordida | 紫晶蘑 | *Lepista sordida* | — | 野生 | common | conditional | |
| 79 | parasol | 高大环柄菇 | *Macrolepiota procera* | Parasol mushroom | 野生 | rare | conditional | 与大青褶伞混淆（核心二选一） |
| 80 | giantpuffball | 大马勃 | *Calvatia gigantea* | Giant puffball | 野生 | rare | conditional | 幼时全白才记载可食 |
| 81 | puffball | 网纹马勃 | *Lycoperdon perlatum* | Common puffball | 野生 | common | conditional | |
| 82 | lasiosphaera | 脱皮马勃 | *Lasiosphaera fenzlii* | — | 药用 | rare | medicinal | 药典「马勃」 |
| 83 | fieldmushroom | 蘑菇（四孢蘑菇） | *Agaricus campestris* | Field mushroom | 野生 | common | wild_edible | 与黄斑蘑菇混淆 |
| 84 | horsemushroom | 野蘑菇 | *Agaricus arvensis* | Horse mushroom | 野生 | common | wild_edible | 杏仁味 |
| 85 | fairyring | 硬柄小皮伞 | *Marasmius oreades* | Fairy ring champignon | 野生 | common | wild_edible | 草坪蘑菇圈 |
| 86 | velvetfoot | 冬菇（毛柄金钱菌） | *Flammulina velutipes* | Velvet shank | 野生 | common | conditional | 与秋生盔孢伞混淆 |
| 87 | fattyPholiota | 多脂鳞伞（黄伞） | *Pholiota adiposa* | Fat pholiota | 野生/栽培 | rare | conditional | |
| 88 | woodtuft | 毛柄库恩菇 | *Kuehneromyces mutabilis* | Sheathed woodtuft | 野生 | rare | conditional | 与秋生盔孢伞极似 |
| 89 | beefsteak | 牛排菌（肝色牛排菌） | *Fistulina hepatica* | Beefsteak fungus | 野生 | rare | wild_edible | 切开像生牛肉 |
| 90 | chickenwoods | 硫磺菌（硫色绚孔菌） | *Laetiporus sulphureus* | Chicken of the woods | 野生 | rare | conditional | 部分人过敏 |
| 91 | dryadsaddle | 宽鳞多孔菌 | *Cerioporus squamosus* | Dryad's saddle | 野生 | common | conditional | 旧名 *Polyporus squamosus* |
| 92 | charcoalburner | 蓝黄红菇 | *Russula cyanoxantha* | Charcoal burner | 野生 | common | wild_edible | 菌褶柔韧不碎 |
| 93 | blackening | 稀褶红菇（火炭菌） | *Russula nigricans* | Blackening brittlegill | 野生 | common | conditional | **亚稀褶红菇的可食「替身」**，核心二选一 |
| 94 | summertruffle | 夏块菌 | *Tuber aestivum* | Summer truffle | 野生 | rare | wild_edible | |
| 95 | cicadaflower | 蝉花 | *Cordyceps chanhua*（待核；旧 *Isaria cicadae*） | Cicada flower | 药用 | rare | medicinal | |
| 96 | shiraia | 竹黄 | *Shiraia bambusicola* | — | 药用 | rare | medicinal | 竹枝上粉红肉球 |
| 97 | woolmilk | 绒白乳菇（待核） | *Lactifluus vellereus* | Fleecy milkcap | 野生 | common | unknown | 云南「白奶浆菌」 |
| 98 | gomphus | 毛钉菇（喇叭陀螺菌，待核中文名） | *Turbinellus floccosus* | Woolly chanterelle | 野生 | rare | poisonous | 云南有人食用但记载为胃肠型毒菌 |
| 99 | leccinumscab | 褐疣柄牛肝菌 | *Leccinum scabrum* | Birch bolete | 野生 | common | conditional | 桦树共生 |
| 100 | leccinumaur | 橙黄疣柄牛肝菌 | *Leccinum aurantiacum* | Orange birch bolete | 野生 | rare | conditional | |
| 101 | chrysenteron | 红绒盖牛肝菌 | *Xerocomellus chrysenteron* | Red-cracking bolete | 野生 | common | conditional | |
| 102 | castaneus | 栗色圆孔牛肝菌 | *Gyroporus castaneus* | Chestnut bolete | 野生 | common | conditional | |
| 103 | emodensis | 木生条孢牛肝菌 | *Boletellus emodensis* | — | 野生 | rare | unknown | 菌盖粉红裂鳞 |
| 104 | rutilus | 血红铆钉菇 | *Chroogomphus rutilus* | Copper spike | 野生 | common | conditional | 松树下，寄生乳牛肝菌 |
| 105 | terreum | 棕灰口蘑 | *Tricholoma terreum* | Grey knight | 野生 | common | conditional | 近年有毒性争议 |
| 106 | gypsy | 皱盖丝膜菌 | *Cortinarius caperatus* | Gypsy mushroom | 野生 | rare | conditional | 丝膜菌属中少数记载可食 |
| 107 | bombycina | 银丝草菇 | *Volvariella bombycina* | Silky rosegill | 野生 | rare | unknown | |
| 108 | deerpluteus | 灰光柄菇 | *Pluteus cervinus* | Deer shield | 野生 | common | unknown | 粉色孢子印，无菌托 |
| 109 | amethyst | 紫蜡蘑 | *Laccaria amethystina* | Amethyst deceiver | 野生 | common | conditional | 全身紫 |
| 110 | woodblewitgrey | 烟云杯伞 | *Clitocybe nebularis* | Clouded agaric | 野生 | common | unknown | |
| 111 | candolle | 白黄小脆柄菇 | *Psathyrella candolleana* | Pale brittlestem | 野生 | common | unknown | |
| 112 | lilacbonnet | 洁小菇 | *Mycena pura* | Lilac bonnet | 野生 | common | poisonous | 含微量毒蕈碱 |
| 113 | micaceus | 晶粒小鬼伞 | *Coprinellus micaceus* | Glistening inkcap | 野生 | common | unknown | |

#### C. 毒菌 / 剧毒菌（70 种，全部标 poisonous / deadly）

| # | id | 中文名 | 学名 | 英文俗名 | 类别 | 稀有度 | 食性标签 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 114 | deathcap | 毒鹅膏 | *Amanita phalloides* | Death cap | 剧毒 | epic | deadly | 全球致死首位；鹅膏肽 |
| 115 | destroyingangel | 鳞柄白鹅膏 | *Amanita virosa* | Destroying angel | 剧毒 | epic | deadly | 东亚群体是否同种 待核 |
| 116 | verna | 白毒鹅膏（春生鹅膏） | *Amanita verna* | Fool's mushroom | 剧毒 | rare | deadly | |
| 117 | fuliginea | 灰花纹鹅膏 | *Amanita fuliginea* | — | 剧毒 | epic | deadly | **中国致死首位** |
| 118 | exitialis | 致命鹅膏（白毒伞） | *Amanita exitialis* | Guangzhou destroying angel | 剧毒 | epic | deadly | 广东春季 |
| 119 | rimosa | 裂皮鹅膏 | *Amanita rimosa* | — | 剧毒 | rare | deadly | |
| 120 | pallidorosea | 淡红鹅膏 | *Amanita pallidorosea* | — | 剧毒 | rare | deadly | |
| 121 | subpallidorosea | 假淡红鹅膏 | *Amanita subpallidorosea* | — | 剧毒 | rare | deadly | |
| 122 | subjunquillea | 黄盖鹅膏 | *Amanita subjunquillea* | East Asian death cap | 剧毒 | rare | deadly | |
| 123 | oberwinklerana | 欧氏鹅膏 | *Amanita oberwinklerana* | — | 剧毒 | rare | deadly | |
| 124 | flyagaric | 毒蝇伞 | *Amanita muscaria* | Fly agaric | 毒 | legend | poisonous | 鹅膏蕈氨酸/蝇蕈醇；马里奥蘑菇 |
| 125 | panther | 豹斑鹅膏 | *Amanita pantherina* | Panther cap | 毒 | rare | poisonous | 神经精神型 |
| 126 | rubrovolvata | 红托鹅膏 | *Amanita rubrovolvata* | — | 毒 | rare | poisonous | 2025 版云南名录新增 |
| 127 | virgineoides | 锥鳞白鹅膏 | *Amanita virgineoides* | — | 毒 | rare | poisonous | 2025 版新增 |
| 128 | subglobosa | 亚球基鹅膏 | *Amanita subglobosa* | — | 毒 | rare | poisonous | 2025 版新增 |
| 129 | pseudoporphyria | 假褐云斑鹅膏 | *Amanita pseudoporphyria* | — | 毒 | common | poisonous | 云南常见胃肠型 |
| 130 | neoovoidea | 拟卵盖鹅膏 | *Amanita neoovoidea* | — | 毒 | rare | poisonous | 肾损害记录 |
| 131 | citrina | 柠檬黄鹅膏 | *Amanita citrina* | False death cap | 毒 | common | poisonous | 生土豆味 |
| 132 | blusher | 赭盖鹅膏 | *Amanita rubescens* | Blusher | 毒 | common | conditional | 伤后变红；生食有溶血毒 |
| 133 | grisette | 灰鹅膏 | *Amanita vaginata* | Grisette | 毒 | common | unknown | 无菌环有菌托 |
| 134 | lepiotabrun | 肉褐鳞环柄菇 | *Lepiota brunneoincarnata* | Deadly dapperling | 剧毒 | epic | deadly | 城市草坪、花坛 |
| 135 | cristata | 冠状环柄菇 | *Lepiota cristata* | Stinking dapperling | 毒 | common | poisonous | |
| 136 | greenspored | 大青褶伞 | *Chlorophyllum molybdites* | Green-spored parasol | 毒 | common | poisonous | **中国中毒事件数第一**；孢子印绿 |
| 137 | funeralbell | 秋生盔孢伞 | *Galerina marginata* | Funeral bell | 剧毒 | rare | deadly | 与冬菇/库恩菇同木 |
| 138 | sulciceps | 条盖盔孢伞 | *Galerina sulciceps* | — | 剧毒 | rare | deadly | 中国南方 |
| 139 | subnigricans | 亚稀褶红菇 | *Russula subnigricans* | Rank russula | 剧毒 | epic | deadly | 横纹肌溶解型 |
| 140 | sickener | 毒红菇 | *Russula emetica* | The sickener | 毒 | common | poisonous | |
| 141 | japonica | 日本红菇 | *Russula japonica* | — | 毒 | common | poisonous | |
| 142 | trogia | 毒沟褶菌（小白菌） | *Trogia venenata* | Little white mushroom | 剧毒 | epic | deadly | 云南不明原因猝死元凶 |
| 143 | inocybe | 裂丝盖伞 | *Pseudosperma rimosum* | Split fibrecap | 毒 | rare | poisonous | 毒蕈碱；旧名 *Inocybe rimosa* |
| 144 | inocybegeo | 土味丝盖伞（待核中文名） | *Inocybe geophylla* | White fibrecap | 毒 | rare | poisonous | |
| 145 | ivory | 白霜杯伞 | *Clitocybe dealbata* | Ivory funnel | 毒 | rare | poisonous | 毒蕈碱 |
| 146 | livid | 毒粉褶菌 | *Entoloma sinuatum* | Livid pinkgill | 毒 | rare | poisonous | |
| 147 | equestre | 油口蘑 | *Tricholoma equestre* | Yellow knight | 毒 | rare | poisonous | 横纹肌溶解（曾被当美食） |
| 148 | pardinum | 豹斑口蘑（待核中文名） | *Tricholoma pardinum* | Tiger tricholoma | 毒 | rare | poisonous | |
| 149 | rollrim | 卷边桩菇 | *Paxillus involutus* | Brown roll-rim | 毒 | rare | poisonous | 免疫溶血型 |
| 150 | sulphurtuft | 簇生垂幕菇 | *Hypholoma fasciculare* | Sulphur tuft | 毒 | common | poisonous | 与榛蘑混淆 |
| 151 | tsukiyotake | 月夜菌（发光类脐菇） | *Omphalotus japonicus* | Moonlight mushroom | 毒 | epic | poisonous | **发光**；日本中毒首位 |
| 152 | jackolantern | 杰克灯（奥尔类脐菇） | *Omphalotus olearius* | Jack-o'-lantern | 毒 | epic | poisonous | 发光；鸡油菌易混种 |
| 153 | ghostfungus | 幽灵菌 | *Omphalotus nidiformis* | Ghost fungus | 毒 | epic | poisonous | 发光；澳洲 |
| 154 | deadlywebcap | 细鳞丝膜菌 | *Cortinarius rubellus* | Deadly webcap | 剧毒 | rare | deadly | 奥来毒素，肾衰迟发 |
| 155 | orellanus | 奥来丝膜菌 | *Cortinarius orellanus* | Fool's webcap | 剧毒 | rare | deadly | |
| 156 | falsemorel | 鹿花菌 | *Gyromitra esculenta* | False morel | 剧毒 | epic | deadly | 鹿花菌素→一甲基肼（火箭燃料） |
| 157 | firecoral | 火焰茸（鹿角红肉座菌） | *Trichoderma cornu-damae* | Poison fire coral | 剧毒 | legend | deadly | 触摸也可致皮炎；旧名 *Podostroma* |
| 158 | earthball | 橘黄硬皮马勃 | *Scleroderma citrinum* | Common earthball | 毒 | common | poisonous | 与马勃混淆，内部紫黑 |
| 159 | formosa | 美丽枝瑚菌 | *Ramaria formosa* | Beautiful coral | 毒 | rare | poisonous | |
| 160 | inkcap | 墨汁鬼伞 | *Coprinopsis atramentaria* | Common inkcap | 毒 | common | poisonous | 鬼伞素：与酒同食中毒 |
| 161 | yellowstainer | 黄斑蘑菇 | *Agaricus xanthodermus* | Yellow stainer | 毒 | common | poisonous | 基部染黄，墨水味 |
| 162 | venenatus | 毒新牛肝菌 | *Neoboletus venenatus* | — | 毒 | rare | poisonous | |
| 163 | satan | 撒旦牛肝菌 | *Rubroboletus satanas* | Satan's bolete | 毒 | rare | poisonous | |
| 164 | sinicus | 中华红牛肝菌 | *Rubroboletus sinicus*（待核） | — | 毒 | rare | poisonous | |
| 165 | pulveroboletus | 黄粉牛肝菌 | *Pulveroboletus ravenelii* | Powdery sulphur bolete | 毒 | common | poisonous | 云南常见 |
| 166 | heimioporus | 网孢海氏牛肝菌 | *Heimioporus retisporus* | — | 毒 | rare | poisonous | |
| 167 | bitterbolete | 苦粉孢牛肝菌 | *Tylopilus felleus* | Bitter bolete | 毒 | common | inedible | 极苦，与美味牛肝菌混淆 |
| 168 | woollymilk | 毛头乳菇 | *Lactarius torminosus* | Woolly milkcap | 毒 | common | poisonous | |
| 169 | poisonpie | 大毒滑锈伞 | *Hebeloma crustuliniforme* | Poison pie | 毒 | common | poisonous | 萝卜味 |
| 170 | laughing | 橘黄裸伞（大笑菌） | *Gymnopilus junonius* | Spectacular rustgill | 毒 | rare | poisonous | 神经精神型 |
| 171 | conocybe | 皱锥盖伞（待核中文名） | *Pholiotina rugosa* | Deadly conecap | 剧毒 | rare | deadly | 草坪小菌，鹅膏肽；旧 *Conocybe filaris* |
| 172 | bulgaria | 胶陀螺（猪嘴蘑） | *Bulgaria inquinans* | Black bulgar | 毒 | rare | poisonous | 光敏性皮炎型（东北） |
| 173 | ergot | 麦角菌 | *Claviceps purpurea* | Ergot | 毒 | epic | poisonous | 非典型大型菌（菌核）；「圣安东尼之火」 |
| 174 | poisonpax | 云南「见手青」亚型：粉孢牛肝菌（待核种） | *Tylopilus* sp. | — | 毒 | common | poisonous | 可选，填充用 |
| 175 | smithiana | 拟卵盖鹅膏近缘·史氏鹅膏 | *Amanita smithiana* | Smith's amanita | 毒 | rare | poisonous | 北美，误当松茸→肾衰 |
| 176 | ocreata | 西部毁灭天使 | *Amanita ocreata* | Western destroying angel | 剧毒 | rare | deadly | 北美 |
| 177 | bisporigera | 双孢毁灭天使 | *Amanita bisporigera* | Eastern destroying angel | 剧毒 | rare | deadly | 北美 |
| 178 | galerinaAut | 纹缘盔孢伞（待核） | *Galerina autumnalis*（现并入 *G. marginata*） | — | 剧毒 | common | deadly | 建议合并至 #137，仅作别名 |
| 179 | leucocoprinus | 纯黄白鬼伞 | *Leucocoprinus birnbaumii* | Flowerpot parasol | 毒 | common | poisonous | 花盆里长出的黄伞 |
| 180 | panaeolus | 蝶形斑褶菇（待核） | *Panaeolus papilionaceus* | Petticoat mottlegill | 毒 | rare | unknown | 粪生 |
| 181 | chlorophyllumB | 粗鳞大环柄菇（待核） | *Chlorophyllum rhacodes* | Shaggy parasol | 毒 | rare | poisonous | 部分人胃肠中毒 |
| 182 | hypholomaL | 砖红垂幕菇 | *Hypholoma lateritium* | Brick cap | 毒 | common | unknown | |
| 183 | psilocybe | （建议**不收录**裸盖菇属 *Psilocybe* 等致幻管制类） | — | — | — | — | — | 见 §6 |

> 注：#174、#178 为可合并/可删的冗余项；#183 为不收录说明。实际有效毒菌 67 种。

#### D. 观赏 / 奇特 / 欧美经典（70 种，epic / legend 集中区）

| # | id | 中文名 | 学名 | 英文俗名 | 类别 | 稀有度 | 食性标签 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 184 | glowmycena | 荧光小菇 | *Mycena chlorophos* | Green pepe | 发光 | legend | unknown | 绿光；日本八丈岛、台湾 |
| 185 | bittermycena | 苦扇菇（发光扇菇，待核中文名） | *Panellus stipticus* | Bitter oyster | 发光 | rare | inedible | 北美群体发光 |
| 186 | redcage | 红笼头菌 | *Clathrus ruber* | Red cage / Basket stinkhorn | 奇特 | epic | unknown | |
| 187 | devilsfingers | 章鱼鬼笔（恶魔手指） | *Clathrus archeri* | Devil's fingers | 奇特 | epic | unknown | |
| 188 | whitebasket | 白笼头菌（「灯笼菌」待核） | *Ileodictyon cibarium* | White basket fungus | 奇特 | epic | unknown | 毛利传统食物 |
| 189 | anemone | 星头鬼笔（海葵菌） | *Aseroe rubra* | Anemone stinkhorn | 奇特 | epic | unknown | |
| 190 | lysurus | 五棱散尾鬼笔 | *Lysurus mokusin* | Lantern stinkhorn | 奇特 | rare | unknown | 英文名即 lantern，或为「灯笼菌」所指（待核） |
| 191 | dogstinkhorn | 狗蛇头菌（犬状鬼笔，「狗头菇」待核） | *Mutinus caninus* | Dog stinkhorn | 奇特 | rare | unknown | |
| 192 | stinkhorn | 白鬼笔 | *Phallus impudicus* | Common stinkhorn | 奇特 | rare | unknown | 达尔文之女曾专门铲除 |
| 193 | devilscigar | 恶魔雪茄（地星状肉盘菌） | *Chorioactis geaster* | Devil's cigar | 奇特 | legend | unknown | 仅美国德州 + 日本；开裂时发声 |
| 194 | bleedingtooth | 出血齿菌 | *Hydnellum peckii* | Bleeding tooth | 奇特 | epic | inedible | 渗红色液滴 |
| 195 | bluemushroom | 天蓝蘑菇（霍氏粉褶菌） | *Entoloma hochstetteri* | Sky-blue mushroom | 奇特 | legend | unknown | 新西兰 50 元纸币 |
| 196 | indigomilk | 靛蓝乳菇 | *Lactarius indigo* | Indigo milk cap | 奇特 | epic | wild_edible | 蓝色乳汁 |
| 197 | scarletcup | 猩红肉杯菌 | *Sarcoscypha coccinea* | Scarlet elf cup | 观赏 | rare | unknown | |
| 198 | orangepeel | 橙黄网孢盘菌 | *Aleuria aurantia* | Orange peel fungus | 观赏 | common | unknown | |
| 199 | greenelfcup | 小孢绿杯盘菌 | *Chlorociboria aeruginascens* | Green elfcup | 观赏 | epic | inedible | 把木头染成蓝绿（Tunbridge ware） |
| 200 | candlesnuff | 鹿角炭角菌 | *Xylaria hypoxylon* | Candlesnuff fungus | 奇特 | rare | inedible | 「鹿角菌」之一 |
| 201 | deadmanfingers | 多形炭角菌（死人手指） | *Xylaria polymorpha* | Dead man's fingers | 奇特 | rare | inedible | |
| 202 | kingalfred | 黑轮层炭壳（炭球菌） | *Daldinia concentrica* | King Alfred's cakes | 奇特 | common | inedible | 天然火绒 |
| 203 | earthstar | 尖顶地星 | *Geastrum triplex* | Collared earthstar | 奇特 | rare | inedible | |
| 204 | barometer | 硬皮地星 | *Astraeus hygrometricus* | Barometer earthstar | 奇特 | rare | inedible | 随湿度开合 |
| 205 | birdsnest | 隆纹黑蛋巢菌 | *Cyathus striatus* | Fluted bird's nest | 奇特 | rare | inedible | 雨滴弹射「蛋」 |
| 206 | whitebirdsnest | 白蛋巢菌 | *Crucibulum laeve* | Common bird's nest | 奇特 | common | inedible | |
| 207 | cannonball | 弹球菌 | *Sphaerobolus stellatus* | Cannonball fungus | 奇特 | epic | inedible | 弹射孢子球达 6 m |
| 208 | pisolithus | 豆马勃 | *Pisolithus arhizus* | Dyeball | 奇特 | rare | inedible | 染料 |
| 209 | witchbutter | 橙黄银耳（待核中文名） | *Tremella mesenterica* | Witch's butter | 观赏 | common | unknown | 寄生韧革菌 |
| 210 | blackwitch | 黑耳 | *Exidia glandulosa* | Black witch's butter | 观赏 | common | unknown | |
| 211 | stagshorn | 胶角耳 | *Calocera viscosa* | Yellow stagshorn | 观赏 | common | inedible | 「鹿角菌」之二 |
| 212 | jellyear | 木耳（欧洲种，犹太耳） | *Auricularia auricula-judae* | Jelly ear | 观赏 | rare | wild_edible | 与黑木耳二选一 |
| 213 | tinder | 木蹄层孔菌 | *Fomes fomentarius* | Tinder fungus | 木生 | rare | inedible | 冰人奥茨随身携带 |
| 214 | redbelt | 红缘拟层孔菌 | *Fomitopsis pinicola* | Red-belted conk | 木生 | common | inedible | |
| 215 | birchpolypore | 桦剥管菌 | *Fomitopsis betulina* | Birch polypore | 木生 | rare | inedible | 磨刀皮带 |
| 216 | artistconk | 树舌灵芝 | *Ganoderma applanatum* | Artist's conk | 木生 | common | inedible | 可在下表面刻画 |
| 217 | splitgill | 裂褶菌（白参） | *Schizophyllum commune* | Split gill | 木生 | common | conditional | 2.3 万种「性别」；云南食用；可致真菌感染 |
| 218 | cinnabar | 朱红密孔菌 | *Trametes cinnabarina* | Cinnabar polypore | 木生 | common | inedible | |
| 219 | falseturkey | 毛韧革菌（假云芝） | *Stereum hirsutum* | Hairy curtain crust | 木生 | common | inedible | 云芝二选一 |
| 220 | giantpolypore | 巨盖孔菌 | *Meripilus giganteus* | Giant polypore | 木生 | rare | inedible | |
| 221 | coralhericium | 珊瑚状猴头菌 | *Hericium coralloides* | Coral tooth | 木生 | rare | wild_edible | |
| 222 | crested | 冠锁瑚菌 | *Clavulina coralloides* | Crested coral | 珊瑚状 | common | unknown | |
| 223 | violetcoral | 紫珊瑚菌 | *Clavaria zollingeri* | Violet coral | 珊瑚状 | epic | unknown | |
| 224 | saddle | 皱柄白马鞍菌 | *Helvella crispa* | White saddle | 子囊菌 | rare | unknown | |
| 225 | verpa | 皱盖钟菌 | *Verpa bohemica* | Early morel | 子囊菌 | rare | poisonous | 羊肚菌易混种 |
| 226 | jellybaby | 黄柄胶地锤 | *Leotia lubrica* | Jelly babies | 子囊菌 | common | unknown | |
| 227 | earthtongue | 毛舌菌 | *Trichoglossum hirsutum* | Hairy earthtongue | 子囊菌 | rare | unknown | |
| 228 | wrinkledpeach | 网盖红褶伞（皱盖菇） | *Rhodotus palmatus* | Wrinkled peach | 观赏 | epic | unknown | 榆树；欧洲 12 国红色名录 |
| 229 | bleedingbonnet | 血红小菇 | *Mycena haematopus* | Bleeding fairy helmet | 观赏 | rare | unknown | |
| 230 | magpie | 鹊鬼伞（待核中文名） | *Coprinopsis picacea* | Magpie inkcap | 观赏 | rare | poisonous | |
| 231 | cornflower | 蓝圆孔牛肝菌 | *Gyroporus cyanescens* | Cornflower bolete | 奇特 | epic | wild_edible | 变蓝最剧烈的牛肝菌 |
| 232 | violetwebcap | 紫绒丝膜菌 | *Cortinarius violaceus* | Violet webcap | 观赏 | epic | unknown | |
| 233 | waxcapconic | 变黑湿伞 | *Hygrocybe conica* | Blackening waxcap | 观赏 | common | unknown | |
| 234 | scarletwaxcap | 红湿伞 | *Hygrocybe coccinea* | Scarlet waxcap | 观赏 | rare | unknown | |
| 235 | parrot | 鹦鹉湿伞 | *Gliophorus psittacinus* | Parrot waxcap | 观赏 | epic | unknown | 绿→黄变色 |
| 236 | earpick | 耳匙菌 | *Auriscalpium vulgare* | Earpick fungus | 奇特 | epic | inedible | 只长在松果上 |
| 237 | lobster | 龙虾菇（泌乳菌寄生） | *Hypomyces lactifluorum* | Lobster mushroom | 奇特 | epic | wild_edible | 寄生菌把红菇变成「龙虾」 |
| 238 | huitlacoche | 玉米黑粉菌（墨西哥松露） | *Ustilago maydis* | Huitlacoche | 奇特 | rare | wild_edible | 非典型；玉米病害却是美食 |
| 239 | zombieant | 偏侧蛇虫草（僵尸蚂蚁真菌） | *Ophiocordyceps unilateralis* | Zombie-ant fungus | 虫草 | epic | inedible | 《最后生还者》原型 |
| 240 | caterpillar | 冬虫夏草 | *Ophiocordyceps sinensis* | Caterpillar fungus | 虫草 | legend | medicinal | 青藏高原；蝙蝠蛾幼虫 |
| 241 | blacktruffle | 黑孢块菌（黑松露） | *Tuber melanosporum* | Périgord truffle | 地下 | legend | wild_edible | |
| 242 | whitetruffle | 白块菌（白松露） | *Tuber magnatum* | Alba white truffle | 地下 | legend | wild_edible | 无法栽培（近年零星成功） |
| 243 | titanicus | 巨型鸡枞 | *Termitomyces titanicus* | Giant termite mushroom | 奇特 | legend | wild_edible | 菌盖直径可达 1 m，赞比亚 |
| 244 | humongous | 奥氏蜜环菌 | *Armillaria ostoyae* | Humongous fungus | 奇特 | legend | conditional | 俄勒冈 ~9 km² 单一个体 |
| 245 | stereumostrea | 扇形韧革菌（待核） | *Stereum ostrea* | False turkey tail | 木生 | common | inedible | |
| 246 | greycoprinus | 灰盖鬼伞 | *Coprinopsis cinerea* | Grey inkcap | 粪生 | common | unknown | 模式生物 |
| 247 | dungroundhead | 半卵形斑褶菇（待核） | *Panaeolus semiovatus* | Egghead mottlegill | 粪生 | common | unknown | 马粪 |
| 248 | pilobolus | 水玉霉（子弹霉，待核是否收录） | *Pilobolus crystallinus* | Hat-thrower | 粪生 | rare | inedible | 非大型菌，可作「冷知识」种 |
| 249 | orangepore | 橙黄小孔菌（待核中文名） | *Favolaschia calocera* | Orange pore fungus | 入侵 | rare | unknown | 全球入侵种 |
| 250 | brainmushroom | 皱柄马鞍菌（待核中文名） | *Helvella lacunosa* | Elfin saddle | 子囊菌 | rare | unknown | |
| 251 | amanitajack | 杰克逊鹅膏（待核） | *Amanita jacksonii* | American Caesar | 野生 | rare | wild_edible | 北美 |
| 252 | pinophilus | 松林牛肝菌（待核） | *Boletus pinophilus* | Pine bolete | 野生 | rare | wild_edible | |
| 253 | yellowfoot | 金黄喇叭菌（待核） | *Craterellus tubaeformis* | Yellowfoot | 野生 | rare | wild_edible | |

**不收录或谨慎处理**：黏菌（*Fuligo septica* 黄黏菌）不是真菌；地衣是共生体；裸盖菇属 *Psilocybe*、光盖伞等致幻管制种建议整体不收录（见 §6）；#174 / #178 为占位可删。

### 1.4 各档数量建议与配平

按上表初稿统计（脚本核对后）：common ≈ 92、rare ≈ 100、epic ≈ 43、legend ≈ 15，总 250（去掉 3 个占位/说明行）。配平时建议：

1. **每档主题均衡**：每档都要有「食用 / 毒 / 奇特」三类，避免「legend 全是毒菌」的观感；
2. **易混淆对必须跨档或同档成对存在**（松茸/姬松茸、羊肚菌/鹿花菌、鸡油菌/杰克灯、大青褶伞/高大环柄菇、稀褶红菇/亚稀褶红菇、冬菇/秋生盔孢伞、黑木耳/黑耳、云芝/毛韧革菌、灵芝/树舌、草菇/白毒鹅膏），保证抽卡后能触发「看图二选一」题；
3. common 里补足草坪常见种（晶粒小鬼伞、白黄小脆柄菇等）让「随处可见」的体验成立；
4. 发光菌（荧光小菇、月夜菌、杰克灯、幽灵菌、苦扇菇、蜜环菌菌索）可做「夜晚模式」彩蛋，对应鱼缸长按夜晚模式。

---

## 2. 数据字段设计

### 2.1 字段总表（在 fish 结构上扩展）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✓ | 英文短 id，做文件名与题目引用 |
| `name` | string | ✓ | 中文正式名（以《中国大型菌物资源图鉴》/ 名录为准） |
| `nameEn` | string | ✓ | 英文俗名；没有则填空串，UI 回落到 latin |
| `latin` | string | ✓ | 拉丁学名（当前接受名） |
| `authority` | string | | 命名人及年份，如 `"(L.) Lam. 1783"` |
| `synonyms` | string[] | | 异名（用于名称核对与搜索） |
| `aka` | string[] | | 中文别名 / 商品名 / 方言名 |
| `taxon` | object | ✓ | `{ phylum, order, family, genus }`，可出「属于哪个科」题 |
| `rarity` | enum | ✓ | common / rare / epic / legend |
| `image_q` / `image_real` | string | ✓ | 同鱼 |
| `imageCredit` | object | ✓ | `{ author, license, source, url }`，CC 署名必需 |
| `edibility` | enum | ✓ | §1.2 八值 |
| `edibilityNote` | string | | 措辞受 §6 约束的一句话 |
| `toxinClass` | enum[] | | `amatoxin / orellanine / gyromitrin / muscarine / ibotenic / coprine / gi_irritant / rhabdomyolysis / hypoglycemic / hemolytic / photosensitizing / unknown` |
| `syndrome` | enum[] | | 中国临床 7 型：`liver / kidney / rhabdo / gi / neuro / hemolytic / dermatitis` |
| `lookalikes` | string[] | | 易混淆种 id；出题干扰项优先级最高 |
| `season` | int[] | ✓ | 出菇月份 1–12（北半球，中国为主） |
| `substrate` | enum | ✓ | `soil / wood / dung / insect / litter / mycorrhizal / termite / parasitic / grass / conifer_cone` |
| `symbiont` | string[] | | 共生树种 / 宿主：`["Pinus", "Quercus", "白蚁"]` |
| `habitat` | string | ✓ | 一句话生境（同鱼） |
| `region` | string[] | ✓ | 分布：`["云南", "东亚", "欧洲", "北美", "全球"]` |
| `morphology` | object | ✓ | `{ cap, hymenium, stipe, ring, volva, flesh }`；`hymenium` 枚举 `gills / pores / teeth / smooth / ridges / gleba / none` |
| `sporePrint` | enum | | `white / cream / pink / brown / rusty / purple_brown / black / green / olive / yellow / none` |
| `size` | object | | `{ capCm: [3, 12], heightCm: [5, 15] }` |
| `smell` | string | | 「生土豆味」「杏仁味」「腐尸味」 |
| `colorChange` | string | | 伤变色：`"blue"` / `"red"` / `"none"` |
| `bioluminescent` | bool | | 发光 |
| `cultivated` | bool | | 是否有商业栽培 |
| `iucn` | string | | 红色名录等级（如有） |
| `fact` / `quote` | string | ✓ | 同鱼 |
| `tankSize` → `gardenSize` | number | | 「菌圃」展示体型倍数 |
| `behavior` | enum | | 菌圃动画行为：`sway / puff(马勃喷孢) / glow / deliquesce(墨汁自溶) / open(地星开合) / bleed` |
| `questions` | string[] | ✓ | 题 id |

### 2.2 JSON 示例

```json
{
  "id": "flyagaric",
  "name": "毒蝇伞",
  "nameEn": "Fly agaric",
  "latin": "Amanita muscaria",
  "authority": "(L.) Lam. 1783",
  "synonyms": ["Agaricus muscarius L."],
  "aka": ["毒蝇鹅膏", "蛤蟆菌", "捕蝇菌"],
  "taxon": { "phylum": "Basidiomycota", "order": "Agaricales", "family": "Amanitaceae", "genus": "Amanita" },
  "rarity": "legend",
  "image_q": "assets/mushroom/cute/flyagaric.webp",
  "image_real": "assets/mushroom/real/flyagaric.webp",
  "imageCredit": {
    "author": "Onderwijsgek",
    "license": "CC BY-SA 3.0",
    "source": "Wikimedia Commons",
    "url": "https://commons.wikimedia.org/wiki/File:Amanita_muscaria_3_vliegenzwammen_op_rij.jpg"
  },
  "edibility": "poisonous",
  "edibilityNote": "资料记载为有毒蘑菇（神经精神型）。本图鉴不提供任何采食依据。",
  "toxinClass": ["ibotenic"],
  "syndrome": ["neuro"],
  "lookalikes": ["caesar", "eggamanita", "rubrovolvata"],
  "season": [7, 8, 9, 10],
  "substrate": "mycorrhizal",
  "symbiont": ["Betula", "Pinus", "Picea"],
  "habitat": "桦树、松树林地，外生菌根",
  "region": ["北半球温带", "云南", "东北"],
  "morphology": {
    "cap": "鲜红色，散布白色疣状鳞片（菌幕残片），雨后可被冲掉",
    "hymenium": "gills",
    "stipe": "白色，基部球状膨大，环带状菌托残迹",
    "ring": true,
    "volva": true,
    "flesh": "白色"
  },
  "sporePrint": "white",
  "size": { "capCm": [8, 20], "heightCm": [8, 20] },
  "smell": "无明显气味",
  "colorChange": "none",
  "bioluminescent": false,
  "cultivated": false,
  "fact": "菌盖上的白点是幼时包裹整个子实体的「菌幕」碎片，被雨水冲掉后就成了光秃秃的红伞。",
  "quote": "我是最有名的蘑菇，但你只能在游戏里吃我。",
  "gardenSize": 1.0,
  "behavior": "sway",
  "questions": ["q_flyagaric_img", "q_flyagaric_spore", "q_flyagaric_trivia_01", "q_flyagaric_cold_01"]
}
```

第二例（条件可食 + 云南 + 变色）：

```json
{
  "id": "jianshouqing",
  "name": "兰茂牛肝菌",
  "nameEn": "Lanmao's bolete",
  "latin": "Lanmaoa asiatica",
  "authority": "G. Wu & Zhu L. Yang 2015",
  "aka": ["红葱", "见手青", "红牛肝"],
  "taxon": { "phylum": "Basidiomycota", "order": "Boletales", "family": "Boletaceae", "genus": "Lanmaoa" },
  "rarity": "epic",
  "edibility": "conditional",
  "edibilityNote": "资料记载：云南传统食用菌，生食或加热不足会导致幻视等神经精神型中毒。本条目仅为科普。",
  "toxinClass": ["unknown"],
  "syndrome": ["neuro"],
  "lookalikes": ["whiteonion", "brownbolete", "magnificus", "venenatus"],
  "season": [6, 7, 8, 9],
  "substrate": "mycorrhizal",
  "symbiont": ["Pinus yunnanensis"],
  "region": ["云南"],
  "morphology": { "cap": "红褐至砖红色", "hymenium": "pores", "stipe": "黄色带红斑", "ring": false, "volva": false, "flesh": "黄色，伤后迅速变蓝" },
  "sporePrint": "olive",
  "colorChange": "blue",
  "fact": "「见手青」不是一种菌，而是云南人对一类伤后变蓝牛肝菌的统称。",
  "quote": "别碰我，我会脸青的。"
}
```

### 2.3 数据校验脚本要点（Python）

- 每条 `latin` 通过 GBIF `GET https://api.gbif.org/v1/species/match?name=` 匹配 `matchType == EXACT` 且 `kingdom == Fungi`，否则标 `待核`；再抽样人工对 Index Fungorum / MycoBank。
- `lookalikes` 必须双向存在且都在库中。
- `edibility ∈ {poisonous, deadly}` 时 `toxinClass` 与 `syndrome` 非空。
- `imageCredit.license` 只允许 `CC0 / CC BY x.x / CC BY-SA x.x / Public domain`；出现 `NC` / `ND` 直接报错。
- 每种至少 1 道 `name_from_image` + 2 道其他题。

---

## 3. 题库设计

### 3.1 题型与数量（目标 ≈ 1 080 题，250 种）

| 题型 code | 名称 | 题干模板 | 数量 | 难度范围 | 说明 |
|---|---|---|---|---|---|
| `name_from_image` | 看图认名 | 「这是什么蘑菇？」 | 250 | 1–5 | 每种 1 题；难度 = 稀有度 + 是否有 lookalike；干扰项优先 `lookalikes`，其次同科同色 |
| `edibility_class` | 食性类别（科普） | 「资料记载中，X 属于以下哪一类？」 | 140 | 2–4 | 选项固定 4 类：栽培食用菌 / 有毒 / 剧毒 / 药用不作食。**只对分类清楚的种出题**，不对 conditional / unknown 出题；每题带免责脚注 |
| `lookalike_pair` | 易混淆二选一 | 「下面哪一张是松茸？」（两张真图） | 80 | 3–5 | 需要新 UI（双图）；对子来自 `lookalikes` |
| `spore_print` | 孢子印颜色 | 「X 的孢子印是什么颜色？」 | 60 | 3–5 | 大青褶伞（绿）、鹅膏（白）、蘑菇属（褐/紫褐）、红菇（白/乳）等 |
| `substrate` | 基质/共生 | 「X 通常长在哪里？」 | 80 | 2–4 | 白蚁巢 / 松果 / 马粪 / 榆树 / 昆虫 |
| `season` | 季节 | 「云南松茸主要在哪个季节？」 | 40 | 2–3 | |
| `morphology` | 形态特征 | 「哪一项是鹅膏属的典型特征？」「X 的子实层是菌褶还是菌管？」 | 90 | 2–5 | 菌托/菌环/菌褶/菌管/菌齿/变色 |
| `trivia` | 趣味常识 | 同鱼 | 200 | 2–4 | |
| `cold_fact` | 冷知识 | 同鱼 | 120 | 4–5 | |
| `myth_buster` | 辨毒误区 | 「以下哪种方法能可靠判断蘑菇是否有毒？」 | 20 | 1–2 | **正确答案永远是「都不可靠」**，用于安全教育 |
| **合计** | | | **1 080** | | 4.3 题/种 |

### 3.2 难度分级

- **d1–d2（认鱼新手 → 认菌新手）**：栽培菌看图、超级知名种、`myth_buster`、大类形态（有没有菌褶）。
- **d3（爱好者）**：野生菌看图、常见毒菌、孢子印、基质、季节。
- **d4**：鹅膏属内区分、牛肝菌属内区分、易混淆二选一（外观差异明显对）。
- **d5（专家）**：稀褶 vs 亚稀褶红菇、冬菇 vs 秋生盔孢伞、灰花纹鹅膏 vs 灰鹅膏、冷知识（分类学年份、毒素化学）。

难度设置映射复用鱼鱼图鉴：新手 = 看图 d1 + 知识 d≤3；爱好者 = 看图 d2–3 + 知识 d4；专家 = 看图 d3–5 + `cold_fact` d5 + `lookalike_pair`。

### 3.3 干扰项生成规则

1. `lookalikes` 里的种（最高优先）；
2. 同属；
3. 同科同 `sporePrint` 或同 `colorChange`；
4. 同稀有度随机（兜底）。

`name_from_image` 中，若正确答案是剧毒种，干扰项必须包含 ≥1 个其 `lookalikes` 里的可食种，反之亦然——让玩家在游戏里反复看到「像的东西不一定一样」。

### 3.4 10 道示例题

```js
// 1 看图认名 d1
{ id:"q_shiitake_img", type:"name_from_image", fishId:"shiitake", difficulty:1,
  q:"这是什么蘑菇？", options:["香菇","平菇","杏鲍菇","草菇"], answer:0 }

// 2 看图认名 d5（lookalike 干扰）
{ id:"q_subnigricans_img", type:"name_from_image", fishId:"subnigricans", difficulty:5,
  q:"这是什么蘑菇？", options:["亚稀褶红菇","稀褶红菇","蓝黄红菇","毒红菇"], answer:0,
  explain:"亚稀褶红菇菌褶稀疏、伤后变红但不变黑，是中国致死人数最多的红菇。稀褶红菇伤后先红后黑。" }

// 3 食性类别（科普）d2
{ id:"q_deathcap_edib", type:"edibility_class", fishId:"deathcap", difficulty:2,
  q:"资料记载中，毒鹅膏（Amanita phalloides）属于以下哪一类？",
  options:["栽培食用菌","药用真菌","剧毒蘑菇","无毒但不可食"], answer:2,
  disclaimer:true }

// 4 易混淆二选一 d4（双图）
{ id:"q_pair_matsutake", type:"lookalike_pair", fishId:"matsutake", difficulty:4,
  q:"下面哪一张是松茸（Tricholoma matsutake）？",
  images:["assets/mushroom/real/matsutake.webp","assets/mushroom/real/almond.webp"], answer:0,
  explain:"姬松茸是蘑菇属的栽培菌，菌褶成熟后变褐；松茸菌褶白色、有浓郁松脂香，只能野生。" }

// 5 孢子印 d3
{ id:"q_greenspored_spore", type:"spore_print", fishId:"greenspored", difficulty:3,
  q:"大青褶伞的孢子印是什么颜色？", options:["白色","绿色","黑色","粉红色"], answer:1,
  explain:"绿色孢子印是它区别于高大环柄菇（白色孢子印）的关键。" }

// 6 基质/共生 d3
{ id:"q_termite_substrate", type:"substrate", fishId:"termite", difficulty:3,
  q:"鸡枞只会长在什么地方？", options:["腐木上","牛粪上","白蚁巢上","松果上"], answer:2 }

// 7 季节 d2
{ id:"q_morel_season", type:"season", fishId:"morel", difficulty:2,
  q:"野生羊肚菌在中国主要出现在哪个季节？", options:["春季","盛夏","深秋","隆冬"], answer:0 }

// 8 形态 d4
{ id:"q_amanita_morph", type:"morphology", fishId:"deathcap", difficulty:4,
  q:"以下哪一组特征同时出现，最提示「鹅膏属」？",
  options:["菌褶白色 + 菌柄基部有菌托 + 菌柄上有菌环","菌管黄色 + 伤后变蓝","菌褶自溶成墨汁","孢子印绿色"], answer:0 }

// 9 冷知识 d5
{ id:"q_splitgill_cold", type:"cold_fact", fishId:"splitgill", difficulty:5,
  q:"裂褶菌以什么生物学纪录闻名？",
  options:["拥有超过 2 万种交配型（「性别」）","子实体可发绿光","能把木头染成蓝色","菌盖直径可达 1 米"], answer:0 }

// 10 辨毒误区 d1（安全教育）
{ id:"q_myth_01", type:"myth_buster", fishId:null, difficulty:1,
  q:"以下哪种方法可以可靠判断野生蘑菇是否有毒？",
  options:["颜色鲜艳的才有毒","和大蒜同煮不变黑就没毒","被虫咬过的就没毒","以上都不可靠"], answer:3,
  explain:"目前没有任何简单可靠的民间辨毒方法。剧毒的灰花纹鹅膏就是灰扑扑的。" }
```

---

## 4. 图片来源与版权

### 4.1 各来源许可对比

| 来源 | 图片许可 | 可商用？ | 署名要求 | 评价 |
|---|---|---|---|---|
| **Wikimedia Commons** | 逐张：CC0 / PD / CC BY / CC BY-SA（Commons 不接受 NC/ND） | ✓（全部允许商用） | 作者 + 许可 + 链接；SA 需同许可发布衍生图 | **主源**。鱼鱼图鉴已有流程（`download_batch2.py` / `photo_picker.html`）可直接复用；API 可按文件读 `extmetadata.LicenseShortName`、`Artist` |
| **iNaturalist** | 用户自选；**默认 CC BY-NC**，也有大量 CC0 / CC BY / CC BY-SA | 仅 CC0 / CC BY / CC BY-SA 的照片可商用 | 同上；API `GET /v1/observations?taxon_id=&quality_grade=research&photo_license=cc0,cc-by,cc-by-sa` | **次源**，中国种（鹅膏、牛肝菌）覆盖比 Commons 好；「研究级」是鉴定质量标签，与许可无关 |
| **Mushroom Observer** | 站点默认 CC BY-SA，用户可改为 NC 或 PD | 视每张而定 | 同上；Commons 已有 `{{MushroomObserver}}` 模板可作参考 | 北美种丰富；逐张核对 |
| **GBIF** | 聚合器：每条记录的 `media[].license` 单独解析（CC0 / CC BY / CC BY-NC） | 视记录 | 需回溯原始发布者署名 | 只作**索引**，实际下载回源站（iNat/MO/标本馆） |
| **Danish Fungi 2020 (DF20)** | 作者声明 BSD + 商用限制；「仅非商业研究」 | ✗ | — | **不可用**于游戏素材，即使免费游戏也属产品用途 |
| **FGVCx Fungi 2018** | Danish Svampe Atlas ToS：非商业研究/教育；**禁止再分发图片** | ✗ | — | **不可用** |
| **MO106** | 从 FGVCx 2018 + Mushroom Observer 拼合，未附明确许可 | ✗（继承上游限制） | — | **不可直接用**；只可当「哪些种 MO 上图多」的线索，再去 MO 原站按许可取图 |
| Atlas of Danish Fungi（svampe.databasen.org） | 站点 ToS 逐张 | 多数不可 | — | 不建议 |

**实践建议**

1. 复用鱼鱼图鉴的 `assets/fish/real/` 流程：候选 3 张 → `photo_picker.html` 人挑 → `process_real.py` 缩放 + 水印。**水印文字必须保留署名信息**（例如「© Onderwijsgek · CC BY-SA 3.0 · via Wikimedia Commons」）或改为在详情页显示署名，而不是只打站点 logo——CC BY 的署名义务不能被自家水印覆盖。
2. 新建 `credits.html`（或详情页「图片来源」折叠区）自动从 `imageCredit` 渲染：作者、许可、原链接。鱼鱼图鉴目前没有做这一步，建议一并补上。
3. **优先 CC0 / CC BY**，减少 SA 义务；若用 CC BY-SA，缩放加水印后的图必须仍按 CC BY-SA 提供（在 credits 页声明即可，不影响游戏代码本身的许可）。
4. 避免任何 NC 图片——网站挂了「鱼友群」引流、未来若加广告或付费，NC 的风险是真实的。
5. iNaturalist 抓取时同时存 `observation_id`、`photo_id`、`user.login`、`license_code`；iNat 要求署名到用户名而非平台。
6. 中国特有种（灰花纹鹅膏、毒沟褶菌、干巴菌、鸡枞）Commons 缺图时，优先找 iNat CC BY 照片；实在没有可联系中科院昆明植物所 / 作者授权，或在数据中先用 `image_real: null` + UI 显示「照片征集中」。

### 4.2 Q 版立绘 AI 生成的可行性

- **法律**：北京互联网法院 2023-11 「春风送来了温柔」案认定：使用者有充分提示词设计、参数调整与筛选等智力投入的 AI 图片可构成作品、享有著作权；2025 年后的案例要求能提供创作过程记录。建议保存每张图的 prompt / seed / 迭代记录。
- **合规**：2025-09-01 起《人工智能生成合成内容标识办法》生效，主要约束服务提供者，但作为发布方，建议在「关于」页与 `README` 注明「Q 版形象由 AI 辅助生成并经人工修订」。
- **科学性**：AI 极易画错菌托/菌环/菌褶与菌管的区分、孢子印颜色等关键特征。流程建议：真菌学 checklist（有无菌托、菌环、子实层类型、主色、伤变色）→ 生成 → 对照 checklist 审 → `process_cute_batch.py` 去背景。
- **风格一致**：与鱼鱼图鉴同一套「Q 版 / 圆润 / 大眼睛 / 扁平」，但蘑菇没有眼睛位置，建议统一「菌盖上两颗眼睛 + 菌柄当身体」的拟人规则。
- 训练数据版权争议（Stability / Midjourney 诉讼）仍在进行，选用允许商用的模型/服务条款并留存记录即可，风险可接受。

---

## 5. 权威参考来源（事实核查用）

### 5.1 中国毒蘑菇 / 食用菌

| 来源 | 用途 | 链接 |
|---|---|---|
| 中科院昆明植物研究所《云南常见毒菌（毒蘑菇）2022 版》（杨祝良团队） | 云南 24 种毒菌图版与名录 | http://www.kib.cas.cn/xwzx/zhxw/202204/t20220424_6437134.html |
| 《云南常见毒菌 2025 版》（中华全国供销合作总社昆明食用菌研究所） | 新增红托鹅膏、锥鳞白鹅膏、亚球基鹅膏；移出兰茂牛肝菌 | 见光明网 / 新浪 2025-09 报道（待核原文） |
| 《中国毒蘑菇新修订名录》（《菌物学报》，2024，待核卷期） | 全国毒蘑菇种级名录 + 中毒类型 | https://wap.emushroom.net/qikan/show-17437.html |
| 中国疾控中心职业卫生与中毒控制所（niohp.chinacdc.cn）+ *China CDC Weekly* 年度「Mushroom Poisoning Outbreaks — China」系列（李海蛟等） | 年度中毒事件、致死种排名（灰花纹鹅膏、裂皮鹅膏、淡红鹅膏、肉褐鳞环柄菇、亚稀褶红菇为前五致死种） | https://niohp.chinacdc.cn/ ；weekly.chinacdc.cn |
| 国家食品安全风险评估中心 CFSA | 食源性疾病监测、毒蘑菇科普口径 | https://www.cfsa.net.cn |
| 云南省疾控局 / 云南省卫健委「野生菌食用宝典」 | 云南官方科普口径与措辞 | https://ynsjkj.yn.gov.cn ；http://ynswsjkw.yn.gov.cn |
| 陈作红 等《毒蘑菇识别与中毒防治》（科学出版社，2016） | 中国毒蘑菇专著 | 纸质 |
| 李玉 等《中国大型菌物资源图鉴》（中原农民出版社，2015） | 中文正式名、分布 | 纸质 |
| 中国生物物种名录（sp2000.org.cn）真菌部分 | 中文名 ↔ 学名 | http://www.sp2000.org.cn |
| 中国食用菌协会 / 农业农村部食用菌品种 | 栽培菌商品名 | — |

### 5.2 学名核对

| 来源 | 说明 |
|---|---|
| **Index Fungorum / Species Fungorum**（Kew） | 名称合法性 + 当前接受名；https://www.indexfungorum.org ；有 Web Service |
| **MycoBank**（Westerdijk） | 新名注册主库，97.7% 新名在此注册；https://www.mycobank.org |
| **Fungal Names**（中科院微生物所，nmdc.cn/fungalnames） | 三大官方名录库之一，中国作者发表的新名最全；https://nmdc.cn/fungalnames/ |
| GBIF Backbone API | 批量脚本匹配用；https://api.gbif.org/v1/species/match |
| iNaturalist 分类页 | 俗名、分布图、照片索引 |
| 《生物多样性》年度「世界及中国菌物新命名发表概况」 | 追踪近年改名（如 *Auricularia heimuer* 2014、*Flammulina filiformis* 2018、*Sanghuangporus* 2016） |

### 5.3 英文科普校对

MushroomExpert.com（M. Kuo）、First Nature、Wikipedia（仅作索引，引用其脚注原文献）、*Fungi of Temperate Europe*（Læssøe & Petersen 2019）。

### 5.4 事实核查工作流（对齐鱼鱼图鉴的 60-agent workflow）

1. 学名批处理：GBIF match → 非 EXACT 者人工查 Index Fungorum；
2. 食性/毒性：**只允许引用** 5.1 表内来源；任何食性字段值改动都要附来源 id；
3. 冷知识：每条 `fact` 附 1 个可追溯来源（论文 DOI 或官方页面），存 `factSource` 字段（不展示，仅审计）；
4. 中文名：以《中国大型菌物资源图鉴》为准，商品名进 `aka`。

---

## 6. 安全红线

### 6.1 数据层措辞规范

| 字段值 | 允许的展示措辞 | 禁止措辞 |
|---|---|---|
| `cultivated` | 「商业栽培食用菌」 | 「安全」「放心吃」 |
| `wild_edible` | 「资料记载为野生食用菌（仅供科普）」 | 「可食用」单独出现、「美味」作为判断词 |
| `conditional` | 「资料记载须专业处理后食用，误食有中毒记录」 | 任何加工/去毒方法细节（不写「煮 X 分钟就没事」） |
| `unknown` | 「食性不明 / 不建议尝试」 | — |
| `poisonous` | 「有毒（XX 型中毒）」 | — |
| `deadly` | 「剧毒，有致死记录」 | 「少量无碍」之类相对化表述 |
| `medicinal` | 「传统药用，不作食物」 | 任何功效宣称（疗效、抗癌等——广告法风险） |

补充规则：

- 不写「无毒」二字；用「资料记载为食用菌」。
- 不出现「如何区分 A 和 B 以便采摘」的操作性文字；`lookalikes` 说明只写「外观相似，专业人员也需显微/分子鉴定」。
- 不提供烹饪、去毒、解酒等操作。
- 见手青类一律 `conditional` 而非 `wild_edible`，即便 2025 版名录移出。
- 药用菌不写功效，只写「传统上用作药材」。
- 致幻管制类（裸盖菇等）整体不收录，避免成为检索入口。

### 6.2 UI 免责文案（建议）

**首次启动 / 每次进入图鉴页顶部（不可关闭的一行）**
> 本图鉴为收集类科普游戏，所有「食用 / 有毒」标签仅转述公开资料，**不能用于野外鉴定，更不能作为采食依据**。野生蘑菇不采、不买、不吃。

**物种详情页（食性标签旁的 ⓘ）**
> 同一种蘑菇在不同地区、不同成熟度可能有不同记载，且存在大量肉眼无法区分的相似种。请勿凭本页信息判断真实蘑菇能否食用。

**`edibility_class` 题目脚注**
> 本题考察的是「资料如何记载」，不是「能不能吃」。任何野生蘑菇都不应凭记忆或图片判断食用。

**分享卡片底部（复用 ShareUtils）**
> 「认识它，不代表能吃它。」+ 站点 URL

**中毒急救提示（详情页底部，仅对 poisonous/deadly 显示）**
> 若误食野生蘑菇出现不适，立即就医并保留剩余蘑菇样本；可拨打 12320 卫生热线。

### 6.3 产品层建议

- 标题/SEO 不使用「辨毒」「鉴别」「能吃吗」等词，避免搜索引擎把它当鉴定工具；用「蘑菇图鉴收集游戏」。
- `myth_buster` 题型强制进入新手教程（前 3 局必出 1 题），把「没有可靠的民间辨毒法」灌输成游戏常识。
- 不做「上传照片识别」功能。
- 「菌圃」互动（对应鱼缸喂食）不要设计成「采摘」「烹饪」动作；改为「浇水 / 撒孢子 / 夜灯」。
- README / 关于页明确：数据参考中科院昆明植物所、中国疾控中心公开资料；如发现错误请通过 issue 反馈。

---

## 附：待核清单（集中列出，方便逐条核对）

学名待核：#13 茶树菇、#19 白灵菇、#41 鸡枞、#52 云南鸡油菌、#57 黄裙竹荪、#63 老人头、#66 黑虎掌、#95 蝉花、#97 绒白乳菇、#115 鳞柄白鹅膏东亚群体、#164 中华红牛肝菌、#171 皱锥盖伞、#174/#178 占位项。
中文名待核：#98 毛钉菇、#144 土味丝盖伞、#148 豹斑口蘑、#185 苦扇菇、#188/#190「灯笼菌」所指、#191「狗头菇」所指、#203 尖顶地星、#209 橙黄银耳、#230 鹊鬼伞、#245 扇形韧革菌、#247/#249/#250/#251/#252/#253。
文献待核：《中国毒蘑菇新修订名录》卷期与总种数；《云南常见毒菌 2025 版》原文全名单。
