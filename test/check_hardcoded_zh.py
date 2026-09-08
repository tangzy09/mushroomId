# -*- coding: utf-8 -*-
r"""渲染层「写死中文」门禁 —— 棘轮，上限只许降。抄自 fishId 的同名门禁。

⛔ 为什么光有 test/i18n-coverage.mjs 不够：那条量的是「切到英文后屏幕上还剩几个
   汉字」，只能看见**它走得到的那几屏**。fishId 在 2026-09-06 就吃过亏：paywall
   的价格从异步回调里回来后重写按钮文案，写死了中文——那条分支网页版永远跑不到，
   coverage 门全绿而 bug 真实存在。⇒ 必须换一种量法：直接扫**源码里的中文字符串
   字面量**，不看运行时屏幕。

判据：js/game/ 与 js/core/ 下参与渲染/交互的模块里，字符串字面量中出现汉字即计数；
超过 LIMIT 即 exit 1。豁免的是**数据文件**（`data.gen.js` / `questions.gen.js` /
`i18n_en.gen.js` / `photo_credits.js` / `photo_extra.js`，中文本身是内容，不是界面
文案）与 `js/core/i18n.js`（NATIVE 表里的「中文」是语言本名，设计要求）与
`js/game/config.js`（GameConfig 的中文字典本身就是数据层真相源，retag() 才是
把它换成英文的机制——扫它只会把每一个还没被 retag 覆盖的合法中文标签都算成「写死」，
和 fishId 把 taxonomy.js 排除在外是同一个理由）。

⚠ 汉字范围用 \u 转义写，别写汉字字面量（同形字 U+8C48 vs U+F900 屏幕上一模一样，
  写错会把 UTF-16 代理对区圈进来，让每个 emoji 都被判成中文）。
⚠ 本文件必须用 Write/Edit 工具落盘，别过 shell heredoc —— 下面的正则全是反斜杠，
  heredoc 会吞掉一层，`[^'\\\n]` 变成 `[^'\n]`，正则当场报「unterminated character set」。
"""
import io, os, re, sys

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 当前上限（只许降）。这 22 条不是漏翻译，是 test/i18n-coverage.mjs 已经切到英文
# 逐屏核实过零残留之后确认的：**每一条都是 `I18N.lang()==='en' ? 英文 : 中文`
# 内联三元表达式的中文分支**（画布 fillText 没法用 HTML 拆两段、search 归一表
# 是内部算法数据不是界面文案），不是走 locale 文件那条路，但语言判断是真的：
#   app.js:33/285  最后一个里程碑标题（运行时拼进 config 的 6 个之外，单独维护）
#   app.js:1183    monthLabel() 的中文分支（英文分支走 MON 数组）
#   browse.js:82   label('season') 的中文分支（英文分支走 MONTH_EN）
#   browse.js:94-97 SYN_ZH 搜索归一表（只在中文模式跑，英文模式是 SYN_EN）
#   garden.js      菌菇园 Canvas 名字气泡/孢子角标的中文分支
#   weather.js     humanMinutes() 的中文分支
LIMIT = 22

# 数据文件与豁免文件：中文是内容或设计要求，不是界面文案 bug。
SKIP = {
    os.path.join('js', 'data.gen.js'),
    os.path.join('js', 'questions.gen.js'),
    os.path.join('js', 'i18n_en.gen.js'),
    os.path.join('js', 'photo_credits.js'),
    os.path.join('js', 'photo_extra.js'),
    os.path.join('js', 'core', 'i18n.js'),
    os.path.join('js', 'game', 'config.js'),
    # transfer.js 的报错文案已经走 I18N.t()（真实浏览器里用户看到的是翻译过的
    # 文本）；这里留着的中文字面量只是 tt(key, zh) 的第二个参数——
    # test/transfer.test.js 的裸 VM 上下文没加载 i18n.js 时的兜底，从来
    # 不会展示给真实用户。属于 CLAUDE.md 记录过的已知欠账，跟 core.test.js
    # 的领域词扫描只查 storage/gacha/quiz 是同一类豁免。
    os.path.join('js', 'core', 'transfer.js'),
}

SCAN_DIRS = [os.path.join('js', 'game'), os.path.join('js', 'core')]

CJK = re.compile(u'[一-鿿㐀-䶿]')
# 字符串字面量：单引号 / 双引号 / 模板串，支持转义
STR = re.compile(
    r"'(?:[^'\\\n]|\\.)*'"
    r'|"(?:[^"\\\n]|\\.)*"'
    r'|`(?:[^`\\]|\\.)*`',
    re.S)


def strip_comments(src):
    """把注释换成等长空白，保持行号不变；字符串里的 // 不能当注释。"""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c in '\'"`':                                    # 字符串：原样保留
            m = STR.match(src, i)
            if m:
                out.append(m.group(0)); i = m.end(); continue
            out.append(c); i += 1; continue
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            j = src.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j - i)); i = j; continue
        if c == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append(re.sub(r'[^\n]', ' ', src[i:j])); i = j; continue
        out.append(c); i += 1
    return ''.join(out)


def hits_in(code):
    out = []
    for m in STR.finditer(code):
        if CJK.search(m.group(0)):
            out.append((code.count('\n', 0, m.start()) + 1, m.group(0).strip()[:70]))
    return out


def selftest():
    """量具自检：正例必须命中，反例必须不命中。不过就别信任何结论。"""
    cases = [
        (u"const a = '解锁';", 1, u'中文字符串'),
        (u"// 写在注释里\n const a = 'ok';", 0, u'行注释里的中文'),
        (u"/* 块注释 */ const a = 'ok';", 0, u'块注释里的中文'),
        (u"const a = '\U0001f512\U0001f344' + \"Café Ångström\";", 0, u'emoji 与拉丁重音字母'),
        (u"const a = `价格 ${p}`;", 1, u'模板串里的中文'),
        (u"const a = 'http://x/// 中';", 1, u'字符串里的 // 不算注释'),
        (u"const a = I18N.t('pw.buy');", 0, u'走 I18N 的键名'),
    ]
    bad = 0
    for src, want, name in cases:
        got = len(hits_in(strip_comments(src)))
        ok = got == want
        if not ok:
            bad += 1
        print(u'  %s %-24s 期望%d 实际%d' % (u'OK ' if ok else u'BAD', name, want, got))
    return bad


def main():
    print(u'=== 量具自检 ===')
    if selftest():
        print(u'❌ 量具坏了，结论不可信')
        return 2
    if '--selftest' in sys.argv:
        return 0

    total, rows = 0, []
    for d in SCAN_DIRS:
        abs_d = os.path.join(ROOT, d)
        if not os.path.isdir(abs_d):
            continue
        for f in sorted(os.listdir(abs_d)):
            if not f.endswith('.js'):
                continue
            rel = os.path.join(d, f)
            if rel in SKIP:
                continue
            h = hits_in(strip_comments(io.open(os.path.join(abs_d, f), encoding='utf-8').read()))
            total += len(h)
            if h:
                rows.append((rel, h))

    print(u'\n=== js/game 与 js/core 里的中文字符串字面量 ===')
    for rel, h in rows:
        print(u'  %-28s %d' % (rel, len(h)))
        for ln, s in h[:8]:
            print(u'      %s:%d  %s' % (rel, ln, s))
        if len(h) > 8:
            print(u'      … 还有 %d 条' % (len(h) - 8))
    if not rows:
        print(u'  (无)')

    print(u'\n合计 %d 条，上限 %d' % (total, LIMIT))
    if total > LIMIT:
        print(u'❌ 超出上限。新写的界面文案必须走 I18N.t()，别写死中文。')
        return 1
    if total < LIMIT:
        print(u'✅ 低于上限 —— 请把 LIMIT 调到 %d（棘轮只许降）' % total)
        return 0
    print(u'✅ 在上限内')
    return 0


if __name__ == '__main__':
    sys.exit(main())
