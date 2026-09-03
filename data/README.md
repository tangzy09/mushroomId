# 数据层

`mushrooms.json` 与 `questions_curated.json` 是**唯一真相源**，人工编辑。
运行 `python3 tools/build_data.py` 生成 `js/data.gen.js`（运行时加载，已 gitignore，勿手改）。

## 安全约定

`edibility` 字段只描述「公开资料如何记载」，不是食用建议。取值：

| 值 | 含义 | UI 标签 |
|---|---|---|
| `cultivated` | 商业栽培食用菌 | 🍽 栽培食用 |
| `wild_edible` | 资料记载为野生食用菌 | 🍽 资料载可食 |
| `conditional` | 资料记载须专业处理，误食有中毒记录 | 🔥 条件可食 |
| `medicinal` | 传统药用，不作食物 | 💊 药用 |
| `inedible` | 无毒但不可食（木质等） | ❓ 不可食 |
| `unknown` | 食性不明 | ❓ 食性不明 |
| `poisonous` | 有毒 | ⚠️ 有毒 |
| `deadly` | 剧毒，有致死记录 | ☠️ 剧毒 |

改动任何 `poisonous` / `deadly` 条目都必须经第二人复核。
