"""check_species_pages.py — m/*.html、m/en/*.html 与 sitemap.xml 的验收门（退出码非零就是不能提交）

查这些事：
  ① 每个物种在两种语言下各有一个文件，文件名与 id 对应，没有多出来的孤儿页；
  ② 每页 canonical 指向自己（不跨语言指）；hreflang 列全 zh-CN / en / x-default，指向的文件真实存在，
     且两个版本互指同一对 URL；<html lang> 与语言一致；
  ③ 中文页出现中文名、英文页出现英文名，两者都出现学名；深链 href 是 #/m/<id>；
  ④ 模板没有漏格式化的 {占位符} 残留，产物里没有 markdown 星号 `**`；
  ⑤ 英文页真的是英文模板（栏目标题 "How to Tell"），不是中文页复制过去；
  ⑥ og:image 指向真实存在的照片文件；
  ⑦ sitemap.xml 的 URL 数 = 2 × 物种数 + 1，每条 loc 对应真实文件，lastmod 不在未来；
  ⑧ lastmod 清单 tools/species_pages_lastmod.json 覆盖每一页。
改完 data/mushrooms.json 要先跑 tools/make_species_pages.py 再跑这道门。
"""
import json, os, re, sys
from datetime import date

# Windows 的 cp1252 终端打不出最后那行「OK — N 个物种页」里的中文，脚本会在所有断言
# 都过了之后崩在 print 上、退出码 1 —— 一道在成功时报红的门。把 stdout 钉成 UTF-8。
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://mushroomid.ai-speeds.com'
LANG_DIRS = {'zh': '', 'en': 'en/'}
HREFLANG = {'zh': 'zh-CN', 'en': 'en'}

errors = []


def err(msg):
    errors.append(msg)


def rel_of(lang, sid):
    return 'm/%s%s.html' % (LANG_DIRS[lang], sid)


def url_of(lang, sid):
    return '%s/%s' % (BASE, rel_of(lang, sid))


def check_page(lang, m, html):
    sid = m['id']
    tag = '%s/%s' % (lang, sid)
    other = 'en' if lang == 'zh' else 'zh'

    mm = re.search(r'<html lang="([^"]+)"', html)
    if not mm or mm.group(1) != HREFLANG[lang]:
        err('%s: <html lang> 应为 %s，实为 %s' % (tag, HREFLANG[lang], mm and mm.group(1)))

    can = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    if not can:
        err('%s: 没有 canonical' % tag)
    elif can.group(1) != url_of(lang, sid):
        err('%s: canonical 不指自己: %s' % (tag, can.group(1)))

    alts = dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', html))
    for code, want in (('zh-CN', url_of('zh', sid)), ('en', url_of('en', sid)), ('x-default', url_of('en', sid))):
        if alts.get(code) != want:
            err('%s: hreflang %s 应为 %s，实为 %s' % (tag, code, want, alts.get(code)))
    for code, href in alts.items():
        rel = href[len(BASE) + 1:] if href.startswith(BASE + '/') else None
        if not rel or not os.path.exists(os.path.join(ROOT, rel)):
            err('%s: hreflang %s 指向不存在的文件 %s' % (tag, code, href))

    name = m['name'] if lang == 'zh' else (m.get('nameEn') or m['name'])
    if name not in html:
        err('%s: 页面没出现物种名 %s' % (tag, name))
    if m['latin'] not in html:
        err('%s: 页面没出现学名' % tag)
    if ('#/m/%s' % sid) not in html:
        err('%s: 深链 href 缺失或不对' % tag)
    if re.search(r'\{[a-zA-Z_]+\}', html):
        err('%s: 模板占位符没格式化干净' % tag)
    if '**' in html:
        err('%s: 产物里有 markdown 星号' % tag)

    marker = '<h2>How to Tell</h2>' if lang == 'en' else '<h2>怎么认</h2>'
    if marker not in html:
        err('%s: 不是该语言的模板（缺 %s）' % (tag, marker))
    # 英文页不许把中文安全声明原样带过去（那说明模板没按语言分支）
    if lang == 'en' and '野生蘑菇不采、不买、不吃' in html:
        err('%s: 英文页里出现了中文安全声明' % tag)

    img_m = re.search(r'og:image" content="[^"]*?/(assets/photos/real/[^"]+\.webp)"', html)
    if not img_m:
        err('%s: 没有 og:image' % tag)
    elif not os.path.exists(os.path.join(ROOT, img_m.group(1))):
        err('%s: og:image 指向不存在的文件 %s' % (tag, img_m.group(1)))

    # 另一语言的入口链接必须指向存在的文件
    om = re.search(r'<header>.*?<a href="([^"]+)" hreflang="%s"' % HREFLANG[other], html, re.S)
    if not om:
        err('%s: 页眉缺另一语言的入口' % tag)
    else:
        target = os.path.normpath(os.path.join(ROOT, 'm', LANG_DIRS[lang], om.group(1)))
        if not os.path.exists(target):
            err('%s: 页眉语言切换指向不存在的文件 %s' % (tag, om.group(1)))


def main():
    sp = json.load(open(os.path.join(ROOT, 'data', 'mushrooms.json'), encoding='utf-8'))
    ids = {m['id'] for m in sp}
    byid = {m['id']: m for m in sp}
    n_pages = 0

    for lang, sub in LANG_DIRS.items():
        d = os.path.join(ROOT, 'm', sub)
        if not os.path.isdir(d):
            err('%s 目录不存在，先跑 tools/make_species_pages.py' % os.path.relpath(d, ROOT))
            continue
        files = {f[:-5] for f in os.listdir(d) if f.endswith('.html')}
        missing, extra = ids - files, files - ids
        if missing:
            err('[%s] 缺物种页 %d 个: %s' % (lang, len(missing), ', '.join(sorted(missing))[:200]))
        if extra:
            err('[%s] 多出物种页（数据里已删但页面还在）%d 个: %s' % (lang, len(extra), ', '.join(sorted(extra))[:200]))
        for sid in sorted(ids & files):
            html = open(os.path.join(d, sid + '.html'), encoding='utf-8').read()
            check_page(lang, byid[sid], html)
            n_pages += 1

    sm_path = os.path.join(ROOT, 'sitemap.xml')
    if not os.path.exists(sm_path):
        err('sitemap.xml 不存在')
    else:
        sm = open(sm_path, encoding='utf-8').read()
        locs = re.findall(r'<loc>([^<]+)</loc>', sm)
        m_locs = [u for u in locs if '/m/' in u]
        if len(m_locs) != 2 * len(ids):
            err('sitemap 里物种页 URL 数 %d，应为 %d（两种语言）' % (len(m_locs), 2 * len(ids)))
        for u in m_locs:
            rel = u[len(BASE) + 1:] if u.startswith(BASE + '/') else ''
            if not rel or not os.path.exists(os.path.join(ROOT, rel)):
                err('sitemap 里的 URL 没有对应文件: %s' % u)
        today = date.today().isoformat()
        future = [d for d in re.findall(r'<lastmod>([^<]+)</lastmod>', sm) if d > today]
        if future:
            err('sitemap 里有 %d 条 lastmod 在未来（如 %s）—— 生成器用了 UTC？' % (len(future), future[0]))
        want = {url_of(l, s) for s in ids for l in LANG_DIRS}
        if set(m_locs) != want:
            err('sitemap 里的物种页 URL 集合与数据不一致，差集 %d 条' % len(set(m_locs) ^ want))

    mf_path = os.path.join(ROOT, 'tools', 'species_pages_lastmod.json')
    if not os.path.exists(mf_path):
        err('lastmod 清单 tools/species_pages_lastmod.json 不存在')
    else:
        mf = json.load(open(mf_path, encoding='utf-8'))
        want_rel = {rel_of(l, s) for s in ids for l in LANG_DIRS}
        if set(mf) != want_rel:
            err('lastmod 清单覆盖的页面与数据不一致，差集 %d 条' % len(set(mf) ^ want_rel))

    return report(n_pages)


def report(n_pages):
    if errors:
        print('check_species_pages: %d 处问题' % len(errors))
        for e in errors[:60]:
            print('  x', e)
        if len(errors) > 60:
            print('  ... 另有 %d 处' % (len(errors) - 60))
        return 1
    print('check_species_pages: OK — %d 个物种页（中英各半）+ sitemap + lastmod 清单一致' % n_pages)
    return 0


if __name__ == '__main__':
    sys.exit(main())
