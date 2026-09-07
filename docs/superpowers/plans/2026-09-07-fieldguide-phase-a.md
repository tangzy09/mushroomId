# 菌菇图鉴改版一期 A：查阅路径打通

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从首页两步到任何一种的详情，断网也行；毒种有识别要点，毒/可食配对有人工差异句。

**Architecture:** 底部导航减为「图鉴 / 我的」，图鉴成首页，菌菇园退为「我的」里的二级页；`show()` 从平铺切换改为栈式路由；数据加 `idKeys` / `encounter` / `lookalikeNotes` 三个字段并各配校验门；Service Worker 三层缓存照 fishId 抄。

**Tech Stack:** 原生 HTML/CSS/JS（IIFE 挂全局，无构建），Python 校验脚本，Playwright（`fishId/tests/node_modules` 里的 playwright-core）做行为验收。

**依据：** `docs/superpowers/specs/2026-09-07-fieldguide-redesign-design.md` §1 §3 §4 §5 §6 §9 §10 §11 一期 A 列。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `data/mushrooms.json` | 唯一真源。新增 `idKeys`（毒种 42 条）、`encounter`（181 条）、`lookalikeNotes`（毒/可食配对）；修 4 条学名 | 改 |
| `test/check_data.py` | 数据门。新增三个字段的校验 | 改 |
| `tools/census_to_encounter.py` | 把 iNat 观察数分档成 `encounter`，含本土种修正表 | 新建 |
| `js/game/app.js` | 栈式路由；图鉴解锁与搜索；详情页识别要点/差异句/无照片提示；我的页入口卡 | 改 |
| `js/game/config.js` | 安全文案；`encounter` 标签 | 改 |
| `index.html` | 导航两 tab；图鉴页搜索框；菌菇园页返回钮；我的页入口卡；关于页文案；注册 SW；缓存戳 | 改 |
| `css/style.css` | 搜索框、识别要点、差异句标红、入口卡、无照片提示 | 改 |
| `sw.js` | 三层缓存 | 新建 |
| `test/verify_fieldguide_a.mjs` | 行为验收（真实点击） | 新建 |
| `docs/design/DESIGN.md`、`CLAUDE.md`、`README.md` | 文档跟上 | 改 |

**约定：** 所有 Python 脚本用 `PYTHONIOENCODING=utf-8 python …` 跑；改含中文的文件只用 Write/Edit 工具或 Python `open(..., encoding='utf-8')`，**绝不过 PowerShell**。每个任务末尾 commit。

---

### Task 1: 数据门先行（先红后绿）

**Files:**
- Modify: `test/check_data.py`

- [ ] **Step 1: 在 `check_species` 末尾（`return ids` 之前）加三段校验**

```python
    # --- 一期 A 新字段 ------------------------------------------------
    ENCOUNTER = ("common", "occasional", "rare", "seldom")
    SRC = ("wiki-zh", "wiki-en", "mushroomexpert", "inat", "photo")
    KEYISH = re.compile(r"\d+\s*[–\-~]\s*\d+\s*(μm|µm|um)|[IVX]{2,}|担孢子|囊状体|锁状联合")
    toxic = ("poisonous", "deadly")
    for m in species:
        sid = m["id"]
        if m.get("encounter") not in ENCOUNTER:
            err("%s: encounter must be one of %s, got %r" % (sid, ENCOUNTER, m.get("encounter")))
        keys = m.get("idKeys")
        if m.get("edibility") in toxic:
            # 毒种一期 A 必须有 3 条识别要点，每条带来源
            if not isinstance(keys, list) or len(keys) != 3:
                err("%s: %s species needs exactly 3 idKeys" % (sid, m["edibility"]))
                continue
        if keys:
            for i, k in enumerate(keys):
                if not isinstance(k, dict) or not k.get("text") or k.get("src") not in SRC:
                    err("%s: idKeys[%d] must be {text, src in %s}" % (sid, i, SRC)); continue
                if len(k["text"]) < 6 or len(k["text"]) > 60:
                    err("%s: idKeys[%d] length %d, want 6-60" % (sid, i, len(k["text"])))
                if KEYISH.search(k["text"]):
                    err("%s: idKeys[%d] reads like a dichotomous key, not a field mark: %r"
                        % (sid, i, k["text"]))
    # 毒/可食配对必须有人工差异句，且致命种至少有一个非毒相似种
    for m in species:
        if m.get("edibility") not in toxic:
            continue
        notes = m.get("lookalikeNotes") or {}
        safe = []
        for l in m.get("lookalikes", []):
            o = by_id.get(l)
            if not o or o.get("edibility") in toxic:
                continue
            safe.append(l)
            other_notes = o.get("lookalikeNotes") or {}
            if not notes.get(l) and not other_notes.get(m["id"]):
                err("%s <-> %s: toxic/edible pair needs a hand-written lookalikeNotes entry"
                    % (m["id"], l))
        if m.get("edibility") == "deadly" and m.get("lookalikes") and not safe:
            err("%s: deadly species must list at least one non-toxic lookalike" % m["id"])
```

- [ ] **Step 2: 跑门，确认它红且指出是哪些字段**

Run: `cd mushroomId && PYTHONIOENCODING=utf-8 python test/check_data.py 2>&1 | tail -5`
Expected: `N ERROR(s)`，且错误里包含 `encounter must be one of`、`needs exactly 3 idKeys`、`needs a hand-written lookalikeNotes`。退出码 1。

- [ ] **Step 3: Commit**

```bash
git add test/check_data.py
git commit -m "check_data: 一期 A 三个新字段的门，先红"
```

---

### Task 2: `encounter` 字段

**Files:**
- Create: `tools/census_to_encounter.py`
- Modify: `data/mushrooms.json`

- [ ] **Step 1: 对全部 181 种跑一次遇见率普查**

```bash
cd mushroomId
PYTHONIOENCODING=utf-8 python -c "
import json,io
d=json.load(io.open('data/mushrooms.json',encoding='utf-8'))
json.dump([{'id':m['id'],'sciName':m['latin']} for m in d], io.open('C:/tmp/mushroomId/all181.json','w',encoding='utf-8'), ensure_ascii=False)"
PYTHONIOENCODING=utf-8 python ~/.claude/skills/species-field-guide/fetch_photos.py --census C:/tmp/mushroomId/all181.json --out C:/tmp/mushroomId/census181
```
Expected: `N / 181 拿到观察数`（学名过时的几种查不到，Task 3 修完可重跑）。

- [ ] **Step 2: 写分档脚本**

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""census_to_encounter.py — iNat 观察数 -> encounter 四档，并套本土种修正表

    python tools/census_to_encounter.py C:/tmp/mushroomId/census181/census.json

阈值来自设计稿 §5。⛔ iNat 观察数对中国物种系统性偏低（用户集中在欧美），
所以修正表不是补丁，是这个字段成立的前提：菜市场买得到的一律不低于 occasional。
"""
import json, sys, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECIES = os.path.join(ROOT, "data", "mushrooms.json")

def band(n):
    if n is None: return "seldom"
    if n >= 10000: return "common"
    if n >= 1000: return "occasional"
    if n >= 100: return "rare"
    return "seldom"

# 本土常见种：观察数被 iNat 用户分布压低了，按国内实际抬到不低于此档
FLOOR = {
    "shiitake": "common", "enoki": "common", "oyster": "common", "kingoyster": "common",
    "woodear": "common", "snowfungus": "common", "button": "common", "strawmushroom": "common",
    "shimeji": "common", "nameko": "occasional", "matsutake": "occasional",
    "jianshouqing": "occasional", "bainiugan": "occasional", "whiteonion": "occasional",
    "ganbajun": "occasional", "termite": "occasional", "chinesetruffle": "occasional",
    "poria": "occasional", "cauliflower": "occasional", "witchbutter": "occasional",
    "goldenear": "occasional", "redveil": "occasional", "bigred": "occasional",
    "sanghuang": "rare", "caterpillar": "rare", "reishi": "occasional",
    "bambooveil": "occasional", "blackskin": "occasional", "almond": "occasional",
}
ORDER = ["seldom", "rare", "occasional", "common"]

def main(census_path):
    cen = {r["id"]: r.get("observations") for r in json.load(io.open(census_path, encoding="utf-8"))}
    sp = json.load(io.open(SPECIES, encoding="utf-8"))
    changed = 0
    for m in sp:
        e = band(cen.get(m["id"]))
        if m["id"] in FLOOR and ORDER.index(FLOOR[m["id"]]) > ORDER.index(e):
            e = FLOOR[m["id"]]
        if m.get("encounter") != e:
            m["encounter"] = e; changed += 1
    io.open(SPECIES, "w", encoding="utf-8").write(json.dumps(sp, ensure_ascii=False, indent=2) + "\n")
    from collections import Counter
    print("写入 %d 条，分布 %s" % (changed, dict(Counter(m["encounter"] for m in sp))))

if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 3: 跑它**

Run: `PYTHONIOENCODING=utf-8 python tools/census_to_encounter.py C:/tmp/mushroomId/census181/census.json`
Expected: `写入 181 条，分布 {...}`，四档都有。

- [ ] **Step 4: 门里 encounter 那条应转绿**

Run: `PYTHONIOENCODING=utf-8 python test/check_data.py 2>&1 | grep -c "encounter must"`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add tools/census_to_encounter.py data/mushrooms.json
git commit -m "encounter：iNat 观察数分档 + 本土种修正表"
```

---

### Task 3: 修四条过时学名

**Files:**
- Modify: `data/mushrooms.json`

- [ ] **Step 1: 用脚本改，旧名进 `aka`**

```python
# 一次性脚本，用 Bash heredoc 跑（不含反斜杠，安全）
import json, io
p = 'data/mushrooms.json'
sp = json.load(io.open(p, encoding='utf-8'))
FIX = {
    'ivory':     ('Clitocybe dealbata',      'Collybia dealbata'),
    'candolle':  ('Psathyrella candolleana', 'Candolleomyces candolleanus'),
    'sordida':   ('Lepista sordida',         'Collybia sordida'),
    'blackskin': ('Hymenopellis raphanipes', 'Oudemansiella raphanipes'),
}
for m in sp:
    if m['id'] in FIX:
        old, new = FIX[m['id']]
        assert m['latin'] == old, (m['id'], m['latin'])
        m['latin'] = new
        m.setdefault('aka', [])
        if old not in m['aka']: m['aka'].append(old)
io.open(p, 'w', encoding='utf-8').write(json.dumps(sp, ensure_ascii=False, indent=2) + '\n')
print('ok')
```

- [ ] **Step 2: 门仍只剩 idKeys / lookalikeNotes 两类错误**

Run: `PYTHONIOENCODING=utf-8 python test/check_data.py 2>&1 | grep -E "latin|binomial" | wc -l`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add data/mushrooms.json
git commit -m "学名更新四条，旧名进 aka（验收门指出的分类修订）"
```

---

### Task 4: 毒种 42 种识别要点（内容任务）

**Files:**
- Modify: `data/mushrooms.json`

**写作规范（每条都要过 Task 1 的门）：**
- 三句，每句 6–60 字，**现场看得见**：形状、颜色、菌环、菌托、菌褶颜色、变色反应、生境、气味。
- 不写检索表术语（孢子尺寸、罗马数字、显微特征）。
- 不写任何「能不能吃」「怎么处理」；毒种的要点写「怎么认出它」。
- 每条 `src` 取 `wiki-zh` / `wiki-en` / `mushroomexpert` / `inat` / `photo` 之一，优先前两个。
- 第一句要是这个种**最标志性**的一条，它会被相似种页面当差异句复用。

- [ ] **Step 1: 写前三种，跑门确认写法能过**

```json
"deathcap": {
  "idKeys": [
    { "text": "菌柄基部有一圈白色杯状菌托，常埋在落叶下", "src": "wiki-zh" },
    { "text": "菌盖黄绿至橄榄色，湿时略带光泽，边缘无条纹", "src": "wiki-en" },
    { "text": "菌褶始终白色，菌柄上部有白色膜质菌环", "src": "wiki-zh" }
  ]
},
"destroyingangel": {
  "idKeys": [
    { "text": "通体纯白，菌柄基部有大型白色囊状菌托", "src": "wiki-zh" },
    { "text": "菌盖光滑无鳞片，成熟后略呈丝绸质感", "src": "wiki-en" },
    { "text": "菌褶白色不变粉，这一点区别于可食的蘑菇属", "src": "mushroomexpert" }
  ]
},
"flyagaric": {
  "idKeys": [
    { "text": "红色菌盖上散布白色疣状鳞片，雨后可能被冲掉", "src": "wiki-zh" },
    { "text": "菌柄白色，基部球状膨大并有数圈环带状菌托残迹", "src": "wiki-en" },
    { "text": "菌柄上部有下垂的白色菌环", "src": "photo" }
  ]
}
```

Run: `PYTHONIOENCODING=utf-8 python test/check_data.py 2>&1 | grep -E "deathcap|destroyingangel|flyagaric" | grep idKeys | wc -l`
Expected: `0`（这三种的 idKeys 错误清零）

- [ ] **Step 2: 写其余 39 种**

清单（`edibility` 为 poisonous / deadly 的全部 id）：inkcap, fuliginea, exitialis, panther, citrina, subjunquillea, greenspored, lepiotabrun, subnigricans, sickener, funeralbell, sulphurtuft, deadlywebcap, falsemorel, jackolantern, tsukiyotake, yellowstainer, rollrim, satan, earthball, formosa, gomphus, ivory, livid, equestre, poisonpie, leucocoprinus, japonica, woollymilk, laughing, ergot, conocybe, smithiana, lilacbonnet, firecoral, trogia, venenatus, verpa, magpie。

写法同 Step 1。每写完 10 种跑一次门。

- [ ] **Step 3: 门里 idKeys 相关错误清零**

Run: `PYTHONIOENCODING=utf-8 python test/check_data.py 2>&1 | grep idKeys | wc -l`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add data/mushrooms.json
git commit -m "毒种 42 种识别要点，每条附来源"
```

---

### Task 5: 毒/可食配对的人工差异句（内容任务）

**Files:**
- Modify: `data/mushrooms.json`

**规范：** 差异句写在**毒种一方**的 `lookalikeNotes` 里，键是可食种 id，值是一句「看哪里能分开」，6–60 字，必须是现场看得见的差别，不写「专业人士才能区分」这种废话；实在只能靠显微区分的写「肉眼不可靠，两者都当有毒处理」。

- [ ] **Step 1: 写前三对，跑门**

```json
"deathcap": {
  "lookalikeNotes": {
    "greenrussula": "青头菌没有菌环和菌托，菌柄脆，一掰就断",
    "strawmushroom": "草菇菌褶成熟后变粉红，死帽菇始终白色",
    "caesar": "凯撒鹅膏菌盖橙红、菌褶和菌柄黄色；死帽菇菌盖橄榄绿、菌褶白色"
  }
}
```

Run: `PYTHONIOENCODING=utf-8 python test/check_data.py 2>&1 | grep "deathcap <->" | wc -l`
Expected: `0`

- [ ] **Step 2: 写完全部配对**

跑门列出所有缺句的对：
`PYTHONIOENCODING=utf-8 python test/check_data.py 2>&1 | grep "hand-written" | sed 's/:.*//' | sort -u`
逐对补，直到列表为空。

- [ ] **Step 3: 全门绿**

Run: `PYTHONIOENCODING=utf-8 python test/check_data.py 2>&1 | tail -1`
Expected: `OK — no errors.`

- [ ] **Step 4: 反向测这道门**

把 `deathcap.lookalikeNotes.greenrussula` 临时删掉，跑门，Expected 出现 `deathcap <-> greenrussula: toxic/edible pair needs`；恢复。

- [ ] **Step 5: Commit**

```bash
git add data/mushrooms.json
git commit -m "毒/可食配对的人工差异句，校验门全绿"
```

---

### Task 6: 栈式路由

**Files:**
- Modify: `js/game/app.js`（router 段，约第 113–140 行）
- Create: `test/verify_fieldguide_a.mjs`（先只写路由部分）

- [ ] **Step 1: 写行为验收的路由部分（先红）**

```js
/* test/verify_fieldguide_a.mjs — 一期 A 行为验收（走真实点击）
 *   node test/verify_fieldguide_a.mjs [playwright-core 目录]
 * 断言落在屏幕上发生了什么，不落在代码里写了什么。 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const pwDir = process.argv[2] || 'C:/Users/tangz/Documents/Projects/fishId/tests/node_modules';
const { chromium } = await import(pathToFileURL(path.join(pwDir, 'playwright-core', 'index.mjs')).href);
const BASE = 'http://127.0.0.1:3141/index.html';

let pass = 0, fail = 0;
const t = (name, ok, extra) => {
  if (ok) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const active = () => page.evaluate(() => (document.querySelector('.page.active') || {}).id);
const closeOverlay = () => page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await closeOverlay();

/* R1 首页是图鉴 */
t('首页是图鉴', (await active()) === 'page-collection', await active());

/* R2 详情 -> 相似种详情 -> 返回 回到上一个详情 */
await page.click('#coll-grid .cell');
await page.waitForTimeout(400);
const first = await page.evaluate(() => document.getElementById('detail-title').textContent);
const hasLk = await page.$('#page-detail .lookalike');
if (hasLk) {
  await hasLk.click();
  await page.waitForTimeout(400);
  const second = await page.evaluate(() => document.getElementById('detail-title').textContent);
  t('点相似种进入另一个详情', second !== first, second);
  await page.click('#page-detail [data-back]');
  await page.waitForTimeout(400);
  const back1 = await page.evaluate(() => document.getElementById('detail-title').textContent);
  t('返回回到上一个详情，不是图鉴', back1 === first && (await active()) === 'page-detail', back1);
  await page.click('#page-detail [data-back]');
  await page.waitForTimeout(400);
}
t('再返回回到图鉴', (await active()) === 'page-collection', await active());

/* R3 浏览器后退键也能返回 */
await page.click('#coll-grid .cell');
await page.waitForTimeout(300);
await page.goBack();
await page.waitForTimeout(300);
t('浏览器后退回到图鉴', (await active()) === 'page-collection', await active());

t('零 JS 异常', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close();
console.log('\n' + pass + ' 过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
```

Run: 先起服务器 `PYTHONIOENCODING=utf-8 python tools/serve.py 3141`（另一窗口），然后 `node test/verify_fieldguide_a.mjs`
Expected: `首页是图鉴` FAIL（现在首页是 garden）。

- [ ] **Step 2: 把 router 段替换成栈式**

把 `function show(id) {...}` 到 `window.addEventListener('click', ...[data-back]...)` 整段替换为：

```js
  // ---------------------------------------------------------------- router
  // 栈式：根 tab 用 root()，进子页用 go()，返回用 back()。
  // show() 只负责把某页画出来，不动栈——popstate 回来时也走它。
  var ROOTS = { collection: 1, profile: 1 };
  var stack = [{ page: 'collection' }];
  var page = 'collection';

  function show(id, arg) {
    page = id;
    ['garden', 'collection', 'profile', 'biome', 'quiz', 'reveal', 'detail']
      .forEach(function (p) {
        var el = $('page-' + p);
        if (el) el.classList.toggle('active', p === id);
      });
    $('nav').style.display = ROOTS[id] ? 'flex' : 'none';
    Array.prototype.forEach.call($('nav').children, function (b) {
      b.classList.toggle('on', b.dataset.page === id);
    });
    if (id === 'garden') { Garden.refresh(Storage.get()); Garden.start(); }
    else Garden.stop();
    if (id === 'collection') renderCollection();
    if (id === 'profile') renderProfile();
    if (id === 'detail' && arg && byId[arg]) renderDetail(byId[arg]);
  }
  function root(id) {
    stack = [{ page: id }];
    history.replaceState({ depth: 1, page: id }, '');
    show(id);
  }
  function go(id, arg) {
    stack.push({ page: id, arg: arg });
    history.pushState({ depth: stack.length, page: id, arg: arg }, '');
    show(id, arg);
  }
  function back() {
    if (stack.length > 1) history.back();
    else root('collection');
  }
  // 回到栈里最近的某一页（reveal 的「回菌菇园」用）
  function backTo(id) {
    var i = stack.length - 1;
    while (i > 0 && stack[i].page !== id) i--;
    if (i === stack.length - 1) return;
    var steps = stack.length - 1 - i;
    stack.length = i + 1;
    history.go(-steps);
  }
  window.addEventListener('popstate', function (e) {
    var d = (e.state && e.state.depth) || 1;
    while (stack.length > d && stack.length > 1) stack.pop();
    if (e.state && e.state.page) stack[stack.length - 1] = { page: e.state.page, arg: e.state.arg };
    var top = stack[stack.length - 1];
    show(top.page, top.arg);
  });
  window.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-back]');
    if (b) back();
  });
```

删除顶部的 `var page = 'garden', prev = 'garden';`（`page` 已在新段声明）。

- [ ] **Step 3: 把 13 处 `show(...)` 调用改成对应语义**

| 行（改前） | 改成 |
|---|---|
| `show('biome')`（进山采菌） | `go('biome')` |
| `show('quiz')` | `go('quiz')` |
| reveal 里 `addBtn(actions, '回菌菇园', ..., function () { show('garden'); refreshGardenChrome(); })` | `function () { backTo('garden'); refreshGardenChrome(); }` |
| `show('reveal')`（三处） | `go('reveal')` |
| `if (!sp) { show('garden'); return; }` | `if (!sp) { backTo('garden'); return; }` |
| 其余 `show('garden')`（三处） | `backTo('garden')` |
| `show('detail')`（openDetail 末尾） | 见 Step 4 |
| 启动时 `show('garden')` | `root('collection')` |
| nav 点击 handler 里的 `show(b.dataset.page)` | `root(b.dataset.page)` |

- [ ] **Step 4: 把 `openDetail` 拆成 `renderDetail`（只渲染）+ `openDetail`（入栈）**

把 `function openDetail(m) {` 改名为 `function renderDetail(m) {`，删掉它末尾的 `show('detail');`。新增：

```js
  function openDetail(m) { go('detail', m.id); }
```

`renderDetail` 里两处 `openDetail(m)` 回调（种进/移出菌菇园后刷新）改成 `renderDetail(m)`。

- [ ] **Step 5: 跑验收，路由五条应全过**

Run: `node test/verify_fieldguide_a.mjs`
Expected: 路由相关全 OK（图鉴解锁前「点相似种」那两条可能因 `还没收集到` 被跳过，Task 8 后再看）。

- [ ] **Step 6: 现有测试不能坏**

Run: `node test/core.test.js && node test/transfer.test.js`
Expected: 都 `0 failed`。

- [ ] **Step 7: Commit**

```bash
git add js/game/app.js test/verify_fieldguide_a.mjs
git commit -m "栈式路由：go/root/back/backTo，详情页可多级返回，浏览器后退可用"
```

---

### Task 7: 导航调换与菌菇园退位

**Files:**
- Modify: `index.html`（nav、garden 页头、profile 页顶）
- Modify: `js/game/app.js`（renderProfile 入口卡）
- Modify: `css/style.css`

- [ ] **Step 1: nav 减为两个按钮**

`index.html` 里
```html
<nav class="bottom-nav" id="nav">
  <button data-page="garden" class="on"><span class="ico">🌲</span>菌菇园</button>
  <button data-page="collection"><span class="ico">📖</span>图鉴</button>
  <button data-page="profile"><span class="ico">🧺</span>我的</button>
</nav>
```
改成
```html
<nav class="bottom-nav" id="nav">
  <button data-page="collection" class="on"><span class="ico">📖</span>图鉴</button>
  <button data-page="profile"><span class="ico">🧺</span>我的</button>
</nav>
```
并把 `<div class="page has-nav active" id="page-garden">` 改成 `<div class="page" id="page-garden">`，`id="page-collection"` 那个加 `active`。

- [ ] **Step 2: 菌菇园页加返回钮**

在 `<div class="garden-top">` 第一个子元素前插入：
```html
      <button class="back chip" data-back>← 我的</button>
```

- [ ] **Step 3: 我的页顶部加入口卡**

`index.html` `#page-profile .page-body` 的第一个 `<div class="card">` 之前插入：
```html
    <button class="card entry-card" id="btn-garden">
      <span class="ico">🌲</span>
      <span class="entry-text"><b>菌菇园</b><span class="muted" id="garden-summary">进山采菌、抽卡、把认出的菌子种进园里</span></span>
      <span class="chev">›</span>
    </button>
```

- [ ] **Step 4: renderProfile 里填摘要并绑点击**

`renderProfile` 开头（`var strip = ...` 之前）加：
```js
    var placed = Storage.placed().length;
    var ready = st.slots ? st.slots.filter(function (sl) { return sl && sl.ready; }).length : 0;
    $('garden-summary').textContent = placed
      ? '园里 ' + placed + ' 株' + (ready ? '，' + ready + ' 株孢子待收' : '')
      : '进山采菌、抽卡、把认出的菌子种进园里';
    if (!$('btn-garden')._wired) {
      $('btn-garden')._wired = true;
      $('btn-garden').addEventListener('click', function () { go('garden'); });
    }
```
（`ready` 的判据以 `Storage` 现有 slot 结构为准，若字段名不同改成对应的；这行只影响文案。）

- [ ] **Step 5: 样式**

`css/style.css` 末尾加：
```css
.entry-card { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer; }
.entry-card .ico { font-size: 28px; }
.entry-card .entry-text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.entry-card .chev { color: var(--muted); font-size: 22px; }
.garden-top .back.chip { font-size: 12px; }
```

- [ ] **Step 6: 验收里加两条**

在 R1 之后插入：
```js
/* R1b 我的页有菌菇园入口，点进去有返回 */
await page.click('#nav button[data-page="profile"]');
await page.waitForTimeout(300);
await page.click('#btn-garden');
await page.waitForTimeout(500);
t('从我的进菌菇园', (await active()) === 'page-garden', await active());
await page.click('#page-garden [data-back]');
await page.waitForTimeout(300);
t('菌菇园返回回到我的', (await active()) === 'page-profile', await active());
await page.click('#nav button[data-page="collection"]');
await page.waitForTimeout(300);
```

Run: `node test/verify_fieldguide_a.mjs`
Expected: 新两条 OK。

- [ ] **Step 7: Commit**

```bash
git add index.html js/game/app.js css/style.css test/verify_fieldguide_a.mjs
git commit -m "导航减为图鉴/我的，菌菇园退为我的页入口卡"
```

---

### Task 8: 图鉴解锁、筛选器改遇见率、搜索框

**Files:**
- Modify: `js/game/app.js`（renderCollection、renderDetail 的 lookalike 点击）
- Modify: `js/game/config.js`（encounter 标签）
- Modify: `index.html`（搜索框）
- Modify: `css/style.css`

- [ ] **Step 1: config 加 encounter 标签**

`rarityLabels` 下一行加：
```js
  encounters: ['common', 'occasional', 'rare', 'seldom'],
  encounterLabels: { common: '常见', occasional: '偶见', rare: '罕见', seldom: '难得一见' },
```

- [ ] **Step 2: 图鉴页头加搜索框**

`index.html` `#page-collection` 里 `<div class="coll-tools" id="coll-filters"></div>` 之前插入：
```html
    <input class="search" id="coll-search" type="search" placeholder="搜名字、学名、科、生境…" autocomplete="off">
```

- [ ] **Step 3: 重写 renderCollection**

```js
  var collFilter = 'all';
  var collQuery = '';
  function matchesQuery(m, q) {
    if (!q) return true;
    var hay = [m.name, m.nameEn, m.latin, m.family, m.habitat,
      (m.aka || []).join(' '), C.labels.substrate && C.labels.substrate[m.substrate],
      C.labels.biome && C.labels.biome[m.biome]].join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  }
  function renderCollection() {
    $('coll-count').textContent = MUSHROOM_DATA.length + ' 种';

    var filters = [['all', '全部'], ['toxic', '☠️ 有毒与剧毒']]
      .concat(C.encounters.map(function (r) { return [r, C.encounterLabels[r]]; }));
    var fb = $('coll-filters');
    fb.innerHTML = '';
    filters.forEach(function (f) {
      var b = document.createElement('button');
      b.className = 'pill' + (collFilter === f[0] ? ' on' : '');
      b.textContent = f[1];
      b.addEventListener('click', function () { collFilter = f[0]; renderCollection(); });
      fb.appendChild(b);
    });
    var inp = $('coll-search');
    if (!inp._wired) {
      inp._wired = true;
      inp.addEventListener('input', function () { collQuery = inp.value.trim().toLowerCase(); renderCollection(); });
    }

    var q = collQuery;
    var list = MUSHROOM_DATA.filter(function (m) {
      if (!matchesQuery(m, q)) return false;
      if (collFilter === 'all') return true;
      if (collFilter === 'toxic') return m.edibility === 'poisonous' || m.edibility === 'deadly';
      return m.encounter === collFilter;
    });
    var order = { common: 0, occasional: 1, rare: 2, seldom: 3 };
    list.sort(function (a, b) { return (order[a.encounter] - order[b.encounter]) || a.name.localeCompare(b.name, 'zh'); });

    var g = $('coll-grid');
    g.innerHTML = '';
    if (!list.length) {
      g.innerHTML = '<div class="muted" style="grid-column:1/-1;padding:24px 8px;text-align:center">没有匹配的菌子</div>';
      return;
    }
    list.forEach(function (m) {
      var cell = document.createElement('button');
      cell.className = 'cell';
      cell.appendChild(art(m, 72));
      var nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = m.name;
      cell.appendChild(nm);
      if (m.edibility === 'deadly' || m.edibility === 'poisonous') {
        var sk = document.createElement('span');
        sk.className = 'skull';
        sk.textContent = m.edibility === 'deadly' ? '☠️' : '⚠️';
        cell.appendChild(sk);
      }
      cell.addEventListener('click', function () { openDetail(m); });
      g.appendChild(cell);
    });
  }
```
（`C.labels.substrate` / `C.labels.biome` 若 config 里不存在，去掉那两项即可；搜索仍覆盖名字、学名、科、生境。）

- [ ] **Step 4: 相似种点击直接进详情**

`renderDetail` 里
```js
        el.addEventListener('click', function () {
          if (Storage.has(o.id)) openDetail(o); else toast('还没收集到 ' + o.name);
        });
```
改成
```js
        el.addEventListener('click', function () { openDetail(o); });
```

- [ ] **Step 5: 样式**

```css
.search { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 15px; margin-bottom: 8px; background: #fff; }
.cell.locked { display: none; } /* 不再有锁，保险起见让旧样式失效 */
```

- [ ] **Step 6: 验收加四条**

在路由段之后插入：
```js
/* C1 全部可点，没有 ??? */
const qs = await page.evaluate(() => Array.from(document.querySelectorAll('#coll-grid .nm')).filter(n => n.textContent === '???').length);
t('图鉴里没有 ???', qs === 0, qs + ' 个');
const cellN = await page.evaluate(() => document.querySelectorAll('#coll-grid .cell').length);
t('图鉴列出全部物种', cellN === 181, cellN + ' 个');
/* C2 毒种标记永远显示 */
const skulls = await page.evaluate(() => document.querySelectorAll('#coll-grid .skull').length);
t('毒种标记全部显示（42）', skulls === 42, skulls + ' 个');
/* C3 搜索命中生境与学名 */
await page.fill('#coll-search', 'amanita');
await page.waitForTimeout(200);
const nA = await page.evaluate(() => document.querySelectorAll('#coll-grid .cell').length);
t('搜学名 amanita 命中鹅膏属（≥10）', nA >= 10, nA + ' 个');
await page.fill('#coll-search', '松');
await page.waitForTimeout(200);
const nS = await page.evaluate(() => document.querySelectorAll('#coll-grid .cell').length);
t('搜「松」命中生境含松的种（≥5）', nS >= 5, nS + ' 个');
await page.fill('#coll-search', '');
await page.waitForTimeout(200);
```

Run: `node test/verify_fieldguide_a.mjs`
Expected: 四条 OK，且 Task 6 里「点相似种」两条现在也 OK。

- [ ] **Step 7: Commit**

```bash
git add js/game/app.js js/game/config.js index.html css/style.css test/verify_fieldguide_a.mjs
git commit -m "图鉴解锁：181 种全部可点，筛选改遇见率，加全字段搜索"
```

---

### Task 9: 详情页：识别要点、差异句与标红、无照片致命种提示

**Files:**
- Modify: `js/game/app.js`（renderDetail）
- Modify: `css/style.css`

- [ ] **Step 1: 照片块下加无照片提示**

`renderDetail` 里 `box.appendChild(art(m, 180));` 之后、`var credit = photoCredit(m);` 之前加：
```js
    if (!hasPhoto(m)) {
      var np = document.createElement('div');
      np.className = 'photo-credit no-photo';
      np.textContent = '暂无照片，示意图仅表示大致形态' +
        (m.edibility === 'deadly' ? '。剧毒物种，切勿据此辨认' : '');
      if (m.edibility === 'deadly') np.classList.add('warn');
      box.appendChild(np);
    }
```

- [ ] **Step 2: 头卡之后插入识别要点块**

`b.appendChild(head);` 之后加：
```js
    if (m.idKeys && m.idKeys.length) {
      var ik = document.createElement('div');
      ik.className = 'card idkeys';
      ik.innerHTML = '<h2>怎么认</h2><ol>' +
        m.idKeys.map(function (k) { return '<li>' + esc(k.text) + '</li>'; }).join('') +
        '</ol><p class="muted footnote">识别要点由 AI 据公开资料整理，未经真菌学家审校，仅供学习，不能作为采食依据。</p>';
      b.appendChild(ik);
    }
```

- [ ] **Step 3: 相似种块加差异句与标红**

把 lookalikes 段里 `m.lookalikes.forEach(function (id) { ... });` 整段替换为：
```js
      var toxic = function (x) { return x.edibility === 'poisonous' || x.edibility === 'deadly'; };
      m.lookalikes.forEach(function (id) {
        var o = byId[id];
        if (!o) return;
        var el = document.createElement('button');
        el.className = 'lookalike';
        el.appendChild(art(o, 34));
        var t2 = document.createElement('span');
        var oe = C.edibility[o.edibility];
        var diff = (m.lookalikeNotes && m.lookalikeNotes[id]) ||
                   (o.lookalikeNotes && o.lookalikeNotes[m.id]) ||
                   (o.idKeys && o.idKeys[0] && o.idKeys[0].text) || '';
        var mixed = toxic(m) !== toxic(o);
        t2.innerHTML = '<b>' + esc(o.name) + '</b> <span class="muted" style="font-size:11px">' + oe.label + '</span>' +
          (diff ? '<br><span class="diff">' + esc(diff) + '</span>' : '') +
          (mixed ? '<br><span class="diff warn">一个可食一个有毒，肉眼未必分得清</span>' : '');
        el.appendChild(t2);
        el.addEventListener('click', function () { openDetail(o); });
        row.appendChild(el);
      });
```
并把 `<h2>易混淆</h2>` 改为 `<h2>容易认错</h2>`。

- [ ] **Step 4: 样式**

```css
.idkeys ol { margin: 0; padding-left: 1.3em; font-size: 14.5px; line-height: 1.55; }
.idkeys .footnote { font-size: 11px; margin: 8px 0 0; }
.lookalike { align-items: flex-start; }
.lookalike .diff { font-size: 12px; color: var(--ink-2, #555); line-height: 1.4; }
.lookalike .diff.warn, .photo-credit.warn { color: #B0203A; font-weight: 600; }
.photo-credit.no-photo { font-size: 11px; }
```

- [ ] **Step 5: 验收加三条**

```js
/* D1 毒种详情有识别要点三条 + 脚注 */
await page.fill('#coll-search', '死帽菇');
await page.waitForTimeout(200);
await page.click('#coll-grid .cell');
await page.waitForTimeout(500);
const dk = await page.evaluate(() => ({
  n: document.querySelectorAll('#page-detail .idkeys li').length,
  foot: /未经真菌学家审校/.test(document.querySelector('#page-detail .idkeys') ? document.querySelector('#page-detail .idkeys').textContent : ''),
  warn: document.querySelectorAll('#page-detail .lookalike .diff.warn').length,
  diffs: document.querySelectorAll('#page-detail .lookalike .diff:not(.warn)').length,
}));
t('死帽菇有三条识别要点', dk.n === 3, dk.n + ' 条');
t('识别要点带「未经审校」脚注', dk.foot);
t('死帽菇的可食相似种标红', dk.warn >= 1, dk.warn + ' 处');
t('相似种带差异句', dk.diffs >= 1, dk.diffs + ' 句');
await page.click('#page-detail [data-back]');
await page.waitForTimeout(300);
/* D2 无照片致命种有「切勿据此辨认」 */
await page.fill('#coll-search', '致命鹅膏');
await page.waitForTimeout(200);
await page.click('#coll-grid .cell');
await page.waitForTimeout(500);
const np = await page.evaluate(() => (document.querySelector('#page-detail .no-photo') || {}).textContent || '');
t('无照片致命种显示「切勿据此辨认」', /切勿据此辨认/.test(np), np);
await page.click('#page-detail [data-back]');
await page.fill('#coll-search', '');
await page.waitForTimeout(200);
```

Run: `node test/verify_fieldguide_a.mjs`
Expected: 五条 OK。

- [ ] **Step 6: Commit**

```bash
git add js/game/app.js css/style.css test/verify_fieldguide_a.mjs
git commit -m "详情页：识别要点、相似种差异句与毒/可食标红、无照片致命种提示"
```

---

### Task 10: 安全与关于文案

**Files:**
- Modify: `js/game/config.js`（safety.banner）
- Modify: `js/game/app.js`（firstRun）
- Modify: `index.html`（关于页）
- Modify: `manifest.webmanifest`

- [ ] **Step 1: 横幅**

`safety.banner` 里「本图鉴为收集类科普游戏，」改为「本图鉴」，其余不动。

- [ ] **Step 2: 首次协议**

`firstRun` 里
```js
      '<p class="muted">这是一款收集类科普游戏。它教你认识菌子的样子和名字，' +
```
改为
```js
      '<p class="muted">这是一本菌菇图鉴。它教你认识菌子的样子和名字，' +
```

- [ ] **Step 3: 关于页**

`index.html` 关于卡的 `<p class="muted">` 整段改为：
```html
      <p class="muted" style="margin:0">
        本图鉴收录 <b id="about-count">181</b> 种真实菌类，其中 166 种配有真实照片，来自
        iNaturalist 社区鉴定记录、Wikimedia Commons 与 GBIF，均为可商用的开放授权，照片下方注明摄影者。
        其余 15 种暂无合格照片，以示意图表示大致形态。
        识别要点由 AI 据公开资料整理，未经真菌学家审校，仅供学习。
        食性标签仅转述公开资料，<b>不能用于野外鉴定，更不能作为采食依据</b>。
      </p>
```

- [ ] **Step 4: manifest**

`name` 改「菌菇图鉴 — 看图认菌」，`description` 改「181 种真实菌菇照片配名字，从现场看得见的特征查到它叫什么、怎么认、别和什么混。本图鉴不提供野外鉴定或采食建议。」

- [ ] **Step 5: 验收加一条**

```js
/* S1 首次协议文案不再说「游戏」 */
await page.evaluate(() => localStorage.removeItem('mush_disclaimer_ok'));
await page.reload({ waitUntil: 'networkidle' });
const sheetTxt = await page.evaluate(() => (document.getElementById('sheet') || {}).textContent || '');
t('首次协议说的是图鉴不是游戏', /菌菇图鉴/.test(sheetTxt) && !/收集类科普游戏/.test(sheetTxt));
await closeOverlay();
```
放在最前面（goto 之后、R1 之前），因为它要清存档。

- [ ] **Step 6: Commit**

```bash
git add js/game/config.js js/game/app.js index.html manifest.webmanifest test/verify_fieldguide_a.mjs
git commit -m "安全与关于文案：从「游戏」改为「图鉴」，说明照片来源与识别要点的可靠性"
```

---

### Task 11: Service Worker 三层缓存

**Files:**
- Create: `sw.js`
- Modify: `index.html`（注册）
- Modify: `tools/serve.py`（确认 `.webp` 与 `.js` 的 MIME 正确，通常已对）

- [ ] **Step 1: 写 sw.js**

```js
/* sw.js — 三层离线缓存（照 fishId 的方案）
 * L1 核心：代码 + 数据，装机时逐条预缓存
 * L2 缩略图：assets/photos/thumb/ 166 张 1.2 MB，激活后后台预缓存 —— 断网时列表与检索全可用
 * L3 大图：assets/photos/real/，浏览时按需写入；拿不到时回退同名缩略图
 *
 * 发版：改任何 JS/CSS 后同步 bump V（与 index.html 的 ?v= 用同一个日期串）。
 * 缓存键一律归一化为不带查询串的 pathname，读写同键。
 */
const V = '20260907b';
const CORE = 'mush-core-' + V;
const THUMB = 'mush-thumb-v1';
const IMG = 'mush-img-v1';          // 不带版本：升级时不丢用户已下载的大图
const KEEP = [CORE, THUMB, IMG];

const CORE_URLS = [
  'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/game/config.js', 'js/core/storage.js', 'js/core/gacha.js', 'js/core/quiz.js',
  'js/core/share.js', 'js/core/transfer.js', 'js/game/weather.js', 'js/game/shroom-art.js',
  'js/game/garden.js', 'js/data.gen.js', 'js/photo_credits.js', 'js/game/app.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png'
];
const CORE_SET = new Set(CORE_URLS.map(u => new URL(u, self.registration.scope).pathname));
const isImg = p => /\/assets\/photos\/real\//.test(p);
const isThumb = p => /\/assets\/photos\/thumb\//.test(p);
const isCore = p => CORE_SET.has(p);
const keyOf = url => url.pathname;

async function precacheThumbs() {
  const cache = await caches.open(THUMB);
  let names = [];
  try { names = await (await fetch('assets/photos/thumb/index.json')).json(); } catch (e) { return; }
  for (const n of names) {
    const u = 'assets/photos/thumb/' + n;
    try {
      const k = new URL(u, self.registration.scope).pathname;
      if (!(await cache.match(k))) { const r = await fetch(u); if (r.ok) await cache.put(k, r); }
    } catch (e) { /* 单张失败不影响其余 */ }
  }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CORE);
    const results = await Promise.allSettled(CORE_URLS.map(async u => {
      const r = await fetch(u, { cache: 'reload' });
      if (!r.ok) throw new Error(u + ' ' + r.status);
      await cache.put(new URL(u, self.registration.scope).pathname, r);
    }));
    const failed = results.filter(r => r.status === 'rejected');
    failed.forEach(r => console.warn('[sw] 预缓存失败:', r.reason && r.reason.message));
    if (failed.length === 0) self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.indexOf('mush-') === 0 && KEEP.indexOf(k) < 0).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
  precacheThumbs();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const key = keyOf(url);

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { return await fetch(req); }
      catch (err) {
        const c = await caches.open(CORE);
        return (await c.match(new URL('index.html', self.registration.scope).pathname)) || Response.error();
      }
    })());
    return;
  }
  if (isThumb(key) || isImg(key)) {
    e.respondWith((async () => {
      const hit = await caches.match(key);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) { const c = await caches.open(isThumb(key) ? THUMB : IMG); c.put(key, res.clone()); }
        return res;
      } catch (err) {
        if (isImg(key)) {
          const id = key.split('/').pop();
          const t = await caches.match(new URL('assets/photos/thumb/' + id, self.registration.scope).pathname);
          if (t) return t;
        }
        return Response.error();
      }
    })());
    return;
  }
  if (isCore(key)) {
    e.respondWith((async () => {
      const c = await caches.open(CORE);
      const hit = await c.match(key);
      const net = fetch(req).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
```

- [ ] **Step 2: 注册**

`index.html` 最后一个 `<script>` 之后加：
```html
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js'); });
}
</script>
```

- [ ] **Step 3: 缓存戳全站 bump 到 `20260907b`**

`index.html` 里所有 `?v=20260907a` 改为 `?v=20260907b`（与 `sw.js` 顶部 `V` 一致）。

- [ ] **Step 4: 离线验收加两条**

```js
/* O1 断网后列表与详情仍可用 */
await page.waitForTimeout(3000);              // 给 SW 时间装好并预缓存缩略图
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const ctx = page.context();
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(800);
await closeOverlay();
const offCells = await page.evaluate(() => document.querySelectorAll('#coll-grid .cell').length);
t('断网后图鉴列表仍渲染（181）', offCells === 181, offCells + ' 个');
const offThumb = await page.evaluate(() => {
  const i = document.querySelector('#coll-grid img.sp-photo'); return i ? i.naturalWidth : -1;
});
t('断网后缩略图仍能解码', offThumb > 0, 'naturalWidth=' + offThumb);
await ctx.setOffline(false);
```
放在「零 JS 异常」之前。

Run: `node test/verify_fieldguide_a.mjs`
Expected: 两条 OK。若第一次跑 O2 红，多半是预缓存没跑完，把等待加到 5 秒再跑一次；仍红才是 SW 的问题。

- [ ] **Step 5: 反向测**

把 `sw.js` 的 `CORE_URLS` 里 `js/game/app.js` 临时删掉，改 `V`，重跑验收，Expected `断网后图鉴列表仍渲染` FAIL；恢复。

- [ ] **Step 6: Commit**

```bash
git add sw.js index.html test/verify_fieldguide_a.mjs
git commit -m "离线三层缓存：核心预缓存、缩略图层后台预缓存、大图按需并回退缩略图"
```

---

### Task 12: 全量验收、文档、收尾

**Files:**
- Modify: `CLAUDE.md`、`README.md`、`docs/design/DESIGN.md`

- [ ] **Step 1: 全部门跑一遍**

```bash
PYTHONIOENCODING=utf-8 python tools/build_data.py
PYTHONIOENCODING=utf-8 python test/check_data.py | tail -1        # OK — no errors.
node test/core.test.js | tail -1                                     # 0 failed
node test/transfer.test.js | tail -1                                 # 0 failed
node test/verify_photos_ui.mjs | tail -1                             # 0 失败
node test/verify_fieldguide_a.mjs | tail -1                          # 0 失败
```

- [ ] **Step 2: CLAUDE.md**

「项目简介」改为以查阅为主的描述；文件结构加 `sw.js`、`js/photo_credits.js`、`assets/photos/`、`tools/census_to_encounter.py`、`test/verify_fieldguide_a.mjs`；「开发流程」加两条 node 验收；「数据字段」加 `idKeys` / `encounter` / `lookalikeNotes` 三行；「当前进度」勾掉一期 A 各项，加一期 B/C 待办；「发版」加「`?v=` 与 `sw.js` 的 `V` 一起 bump」。

- [ ] **Step 3: README.md 与 DESIGN.md**

README 的一句话定位改为图鉴；DESIGN.md 顶部加一行「v0.4：2026-09-07 改版为以查阅为主，见 `docs/superpowers/specs/2026-09-07-fieldguide-redesign-design.md`」。

- [ ] **Step 4: Commit 并推送**

```bash
git add CLAUDE.md README.md docs/design/DESIGN.md
git commit -m "文档跟上一期 A：项目定位、新字段、新门、发版规矩"
git push origin HEAD
```

- [ ] **Step 5: 本地过一遍再交付**

起 `tools/serve.py 3141`，用 Chrome 打开，按设计稿 §11 一期 A 的判据走一遍：首页两步到任一详情；相似种能来回；断网（DevTools → Network → Offline）刷新后列表和缩略图都在；毒种详情有三条要点和红字。截图发给用户。**不部署**，等确认。

---

## 自审

**Spec 覆盖（设计稿一期 A 列）：** 导航调换 ✓ T7；图鉴解锁 ✓ T8；页面栈 ✓ T6；搜索框 ✓ T8；毒种识别要点 ✓ T4；相似种标红与人工差异句 ✓ T5 T9；无照片致命种提示 ✓ T9；离线 ✓ T11；encounter ✓ T2；安全文案 ✓ T10；学名修订 ✓ T3；门禁 ✓ T1 + 各任务验收；反向测 ✓ T5 T11。

**类型一致性：** `idKeys` 元素统一为 `{text, src}`（T1 门、T4 数据、T9 渲染）；`lookalikeNotes` 是 `{otherId: string}`（T1、T5、T9）；`encounter` 四值与 `C.encounters` 一致（T1、T2、T8）；路由 `go(id, arg)` / `root(id)` / `back()` / `backTo(id)` / `show(id, arg)`（T6 定义，T7 T8 使用）；`renderDetail` / `openDetail` 分工（T6 定义，T8 T9 使用）。

**风险：** T6 路由重构是唯一会牵动全局的改动，验收里已有五条覆盖多级返回与浏览器后退；T4/T5 是内容任务，质量靠门禁约束写法、靠脚注如实标注可靠性。
