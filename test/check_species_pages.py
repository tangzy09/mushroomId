"""check_species_pages.py — m/*.html 与 sitemap.xml 的验收门（退出码非零就是不能提交）

查五件事：① 166 个物种各有一个文件，文件名与 id 对应；② 每页标题带中文名与学名，
深链 href 是 #/m/<id>；③ 模板没有漏格式化的 {占位符} 残留；④ og:image 指向真实存在
的照片文件；⑤ sitemap.xml 的 URL 数量与文件数一致、每条都是 m/<id>.html 的形状。
改完 data/mushrooms.json 要先跑 tools/make_species_pages.py 再跑这道门。
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M_DIR = os.path.join(ROOT, 'm')

errors = []


def err(msg):
    errors.append(msg)


def main():
    sp = json.load(open(os.path.join(ROOT, 'data', 'mushrooms.json'), encoding='utf-8'))
    ids = {m['id'] for m in sp}
    byid = {m['id']: m for m in sp}

    if not os.path.isdir(M_DIR):
        err('m/ 目录不存在，先跑 tools/make_species_pages.py')
        return report()

    files = {f[:-5] for f in os.listdir(M_DIR) if f.endswith('.html')}
    missing = ids - files
    extra = files - ids
    if missing:
        err('缺物种页 %d 个: %s' % (len(missing), ', '.join(sorted(missing))[:200]))
    if extra:
        err('多出物种页（数据里已删但页面还在）%d 个: %s' % (len(extra), ', '.join(sorted(extra))[:200]))

    for sid in sorted(ids & files):
        m = byid[sid]
        html = open(os.path.join(M_DIR, sid + '.html'), encoding='utf-8').read()
        if m['name'] not in html:
            err('%s: 页面没出现物种中文名' % sid)
        if m['latin'] not in html:
            err('%s: 页面没出现学名' % sid)
        if ('#/m/%s' % sid) not in html:
            err('%s: 深链 href 缺失或不对' % sid)
        if re.search(r'\{[a-zA-Z_]+\}', html):
            err('%s: 模板占位符没格式化干净' % sid)
        img_m = re.search(r'og:image" content="[^"]*?/(assets/photos/real/[^"]+\.webp)"', html)
        if not img_m:
            err('%s: 没有 og:image' % sid)
        else:
            if not os.path.exists(os.path.join(ROOT, img_m.group(1))):
                err('%s: og:image 指向不存在的文件 %s' % (sid, img_m.group(1)))

    sm_path = os.path.join(ROOT, 'sitemap.xml')
    if not os.path.exists(sm_path):
        err('sitemap.xml 不存在')
    else:
        sm = open(sm_path, encoding='utf-8').read()
        locs = re.findall(r'<loc>([^<]+)</loc>', sm)
        m_locs = [u for u in locs if '/m/' in u]
        if len(m_locs) != len(ids):
            err('sitemap 里物种页 URL 数 %d，应为 %d' % (len(m_locs), len(ids)))
        bad = [u for u in m_locs if not re.search(r'/m/[\w-]+\.html$', u)]
        if bad:
            err('sitemap 里有形状不对的物种页 URL: %s' % bad[:3])
        sm_ids = {re.search(r'/m/([\w-]+)\.html$', u).group(1) for u in m_locs if re.search(r'/m/([\w-]+)\.html$', u)}
        if sm_ids != ids:
            err('sitemap 里的 id 集合与数据不一致，差集: %s' % (sorted((sm_ids ^ ids)))[:200])

    return report()


def report():
    if errors:
        print('check_species_pages: %d 处问题' % len(errors))
        for e in errors[:60]:
            print('  x', e)
        return 1
    print('check_species_pages: OK — %d 个物种页 + sitemap 一致' % len(os.listdir(M_DIR)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
