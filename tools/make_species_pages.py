# -*- coding: utf-8 -*-
"""生成 m/<id>.html — 166 个物种静态页 + sitemap.xml。

改版前整站只有一个可索引页面（index.html，单页应用）。每种菌一个静态页是新的
长尾搜索入口：标题「毒鹅膏 Amanita phalloides — 怎么认？识别要点与图片」，正文即
详情页内容，带 Taxon 结构化数据，底部深链回 #/m/<id>（js/game/app.js 的 deepLink()
已能接这个 hash）。参照 fishId 的 make_species_pages.py，按拼音排上一种/下一种。

⚠ 安全红线同样适用于静态页：不给「能不能吃」的结论，食性标签必须带 note 一起出现，
毒/致命种必须显示「不能用于野外鉴定」的免责声明——这不是详情页独有的责任，是
整个产品的责任，静态页不能因为是「SEO 页面」就绕过。

用法：python tools/make_species_pages.py
"""
import json, os, re, urllib.parse
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'm')
BASE = 'https://mushroomid.ai-speeds.com'

ENCOUNTER = {'common': '常见', 'occasional': '偶见', 'rare': '罕见', 'seldom': '难得一见'}
EDIBILITY = {
    'cultivated':  ('🍽 栽培食用', '商业栽培食用菌。野生个体请通过正规渠道购买。'),
    'wild_edible': ('🍽 资料载可食', '资料记载为野生食用菌。本图鉴不提供任何采食依据。'),
    'conditional': ('🔥 条件可食', '资料记载须专业处理后食用，误食有中毒记录。'),
    'medicinal':   ('💊 药用', '传统上用作药材，不作食物。'),
    'inedible':    ('❓ 不可食', '无毒但质地木质或极苦，不作食物。'),
    'unknown':     ('❓ 食性不明', '食性不明，视同有毒。'),
    'poisonous':   ('⚠️ 有毒', '资料记载为有毒蘑菇。'),
    'deadly':      ('☠️ 剧毒', '资料记载为剧毒，有致死记录。'),
}
HYMENIUM = {'gills': '菌褶', 'pores': '菌管', 'teeth': '菌齿', 'ridges': '棱脊', 'smooth': '光滑', 'gleba': '孢体'}
SUBSTRATE = {'wood': '木生', 'soil': '土生', 'grass': '草地', 'litter': '落叶层', 'mycorrhizal': '菌根共生',
             'termite': '白蚁巢', 'insect': '虫生', 'parasitic': '寄生', 'conifer_cone': '松果'}


def esc(s):
    return (str(s if s is not None else '').replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


CSS = """*{box-sizing:border-box}body{margin:0;background:#F7F4EF;color:#2A2620;
font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
font-size:16px;line-height:1.7}
.wrap{max-width:680px;margin:0 auto;background:#fff;min-height:100vh}
header{padding:14px 18px;border-bottom:.5px solid #E6DFD3;font-size:13px;color:#8A7F6B}
header a{color:#5B8C3A;text-decoration:none}
img.hero{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#EDE7D9}
main{padding:18px 18px 40px}
h1{font-size:27px;margin:0;line-height:1.25}
.sci{font-family:"Songti SC",Georgia,serif;font-style:italic;font-size:15px;margin-top:2px;color:#6B6252}
.aka{color:#8A7F6B;font-size:13px;margin-top:4px}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}
.bdg{font-size:12px;padding:3px 10px;border-radius:3px;background:#EAF0E2;color:#3E6425;font-weight:600}
.bdg.grey{background:#F2EEE3;color:#8A7F6B}
.bdg.warn{background:#FBEAEA;color:#A32F3A}
.note{font-size:13px;color:#8A7F6B;margin:2px 0 0}
.safety{background:#F5EDE6;border:1px solid #E6D6C6;color:#6E5A48;font-size:12.5px;
line-height:1.5;padding:10px 12px;border-radius:8px;margin:14px 0}
h2{font-size:12px;font-weight:700;letter-spacing:.12em;color:#8A7F6B;margin:26px 0 8px}
ul.idk{list-style:none;margin:0;padding:0}
ul.idk li{padding-left:20px;position:relative;margin-bottom:7px}
ul.idk li::before{content:"\\2713";position:absolute;left:0;color:#5B8C3A;font-weight:700}
dl{display:grid;grid-template-columns:70px 1fr;gap:7px 12px;margin:0;font-size:15px}
dt{color:#8A7F6B}dd{margin:0}
.sim{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px}
.sim a{flex:0 0 140px;text-decoration:none;color:inherit}
.sim img{width:140px;height:105px;object-fit:cover;border-radius:6px;display:block;background:#EDE7D9}
.sim b{display:block;font-size:13px;margin-top:5px}
.sim i{display:block;font-style:normal;font-size:12px;color:#A32F3A;line-height:1.4}
p.fact{color:#4A4335;margin:0}
.cta{display:block;margin:26px 0 6px;padding:14px;border-radius:10px;background:#5B8C3A;color:#fff;
text-align:center;font-weight:600;text-decoration:none}
nav.pn{display:flex;justify-content:space-between;gap:12px;margin-top:22px;font-size:14px}
nav.pn a{color:#5B8C3A;text-decoration:none;max-width:46%}
footer{padding:20px 18px 34px;font-size:12px;color:#8A7F6B;border-top:.5px solid #EDE7D9;margin-top:24px}
footer a{color:#5B8C3A}"""

PAGE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{name} {latin} — 怎么认？识别要点与图片 | 菌菇图鉴</title>
<meta name="description" content="{desc}">
<meta name="keywords" content="{name},{nameEn},{latin},{family},菌菇图鉴,蘑菇识别,野生菌">
<link rel="canonical" href="{base}/m/{id}.html">
<meta property="og:type" content="article">
<meta property="og:title" content="{name} {latin} — 怎么认？">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{base}/{img}">
<meta property="og:url" content="{base}/m/{id}.html">
<link rel="icon" href="../assets/icons/icon-192.png">
<meta name="theme-color" content="#F7F4EF">
<style>{css}</style>
<script type="application/ld+json">{ld}</script>
</head>
<body>
<div class="wrap">
<header><a href="../index.html">菌菇图鉴</a> &rsaquo; {name}</header>
<img class="hero" src="../{img}" alt="{name} {nameEn}" loading="eager">
<main>
<h1>{name}</h1>
<div class="sci">{latin}{nameEnPart}</div>
{akahtml}
<div class="badges">{badges}</div>
<p class="note">{edibNote}</p>
<div class="safety">同一种蘑菇在不同地区、不同成熟度可能有不同记载，且存在大量肉眼无法区分的相似种。
请勿凭本页信息判断真实蘑菇能否食用。野生蘑菇不采、不买、不吃。</div>

<h2>怎么认</h2>
<ul class="idk">{idk}</ul>
<p class="note">识别要点由 AI 据公开资料整理，未经真菌学家审校，仅供学习，不能作为采食依据。</p>

<h2>基础数据</h2>
<dl>
<dt>科</dt><dd>{family}</dd>
<dt>子实层</dt><dd>{hymenium}</dd>
<dt>长在哪</dt><dd>{substrate}</dd>
<dt>多大</dt><dd>{size}</dd>
<dt>遇见率</dt><dd>{encounter}</dd>
{habitatrow}</dl>
{simblock}
<h2>趣味知识</h2>
<p class="fact">{fact}</p>

<a class="cta" href="../index.html#/m/{id}">在图鉴里打开 · 可叠加筛选与照片 ›</a>
<nav class="pn">{prevnext}</nav>
</main>
<footer>照片来自 iNaturalist / Wikimedia Commons / GBIF 的可商用开放授权，逐张标注摄影者。
<a href="../index.html">菌菇图鉴</a> 收录 166 种真实菌类，按轮廓 / 长在哪 / 颜色 / 大小 / 名字五路检索，支持离线使用。</footer>
</div>
</body>
</html>
"""


def _dup(a, b):
    a, b = (a or '').strip(), (b or '').strip()
    return not a or a == b or a in b or b in a


def build_page(f, prev, nxt, by_id):
    edib_label, edib_note = EDIBILITY[f['edibility']]
    badges = ['<span class="bdg">%s</span>' % esc(ENCOUNTER.get(f['encounter'], f['encounter'])),
               '<span class="bdg grey">%s</span>' % esc(f['family']),
               '<span class="bdg%s">%s</span>' % ('' if f['edibility'] in ('poisonous', 'deadly') else ' grey', esc(edib_label))]

    idk = [k['text'] for k in f['idKeys']]
    desc = ('%s（%s）怎么认：%s%s%s' % (f['name'], f['latin'], idk[0], '。' if idk[0][-1] not in '。！？' else '', idk[1]))[:150]

    sims = [s for s in (f.get('lookalikes') or []) if s in by_id]
    simblock = ''
    if sims:
        cards = ''
        for sid in sims:
            g = by_id[sid]
            note = (f.get('lookalikeNotes') or {}).get(sid) or (g.get('lookalikeNotes') or {}).get(f['id']) or \
                (g['idKeys'][0]['text'] if g.get('idKeys') else '')
            img = 'assets/photos/thumb/%s.webp' % sid
            cards += ('<a href="%s.html"><img src="../%s" alt="%s" loading="lazy">'
                      '<b>%s</b><i>%s</i></a>') % (sid, img, esc(g['name']), esc(g['name']), esc(note))
        simblock = '<h2>容易认错</h2><div class="sim">%s</div>\n' % cards

    lo, hi = f['capCm']
    is_cap = f['silhouette'] in ('umbrella', 'funnel')
    size = ('%s cm' % lo) if lo == hi else ('%s–%s cm' % (lo, hi))
    size += '（%s）' % ('菌盖直径' if is_cap else '整体大小')

    aka = list(f.get('aka') or [])
    akahtml = ('<div class="aka">又名　%s</div>' % esc(' · '.join(aka))) if aka else ''
    nameEnPart = (' · ' + esc(f['nameEn'])) if f.get('nameEn') else ''

    ld = {
        '@context': 'https://schema.org', '@type': 'Taxon',
        'name': f['name'], 'alternateName': ([f['nameEn']] if f.get('nameEn') else []) + aka,
        'scientificName': f['latin'], 'taxonRank': 'species',
        'parentTaxon': f['family'],
        'description': '；'.join(idk),
        'image': BASE + '/assets/photos/real/%s.webp' % f['id'],
        'url': BASE + '/m/%s.html' % f['id'],
        'inLanguage': 'zh-CN',
    }

    pn = []
    if prev:
        pn.append('<a href="%s.html">&lsaquo; %s</a>' % (prev['id'], esc(prev['name'])))
    else:
        pn.append('<span></span>')
    if nxt:
        pn.append('<a href="%s.html" style="text-align:right">%s &rsaquo;</a>' % (nxt['id'], esc(nxt['name'])))
    else:
        pn.append('<span></span>')

    habitat = f.get('habitat')
    habitatrow = '' if _dup(habitat, f.get('substrate')) else '<dt>生境</dt><dd>%s</dd>\n' % esc(habitat)

    return PAGE.format(
        base=BASE, css=CSS, id=f['id'], name=esc(f['name']), nameEn=esc(f.get('nameEn') or ''),
        nameEnPart=nameEnPart, latin=esc(f['latin']), family=esc(f['family']),
        desc=esc(desc), img='assets/photos/real/%s.webp' % f['id'],
        akahtml=akahtml, badges=''.join(badges), edibNote=esc(edib_note),
        idk=''.join('<li>%s</li>' % esc(k) for k in idk),
        hymenium=esc(HYMENIUM.get(f['hymenium'], f['hymenium'])),
        substrate=esc(SUBSTRATE.get(f['substrate'], f['substrate'])),
        size=size, encounter=esc(ENCOUNTER.get(f['encounter'], f['encounter'])),
        habitatrow=habitatrow,
        simblock=simblock, fact=esc(f['fact']),
        ld=json.dumps(ld, ensure_ascii=False),
        prevnext=''.join(pn))


def main():
    sp = json.load(open(os.path.join(ROOT, 'data', 'mushrooms.json'), encoding='utf-8'))
    by_id = {f['id']: f for f in sp}
    order = sorted(sp, key=lambda f: f.get('pinyin') or f['id'])
    os.makedirs(OUT, exist_ok=True)
    for i, f in enumerate(order):
        prev = order[i - 1] if i else None
        nxt = order[i + 1] if i + 1 < len(order) else None
        html = build_page(f, prev, nxt, by_id)
        open(os.path.join(OUT, f['id'] + '.html'), 'w', encoding='utf-8').write(html)

    today = date.today().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
             '  <url><loc>%s/</loc><lastmod>%s</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>' % (BASE, today)]
    for f in order:
        lines.append('  <url><loc>%s/m/%s.html</loc><lastmod>%s</lastmod>'
                      '<changefreq>monthly</changefreq><priority>0.7</priority></url>' % (BASE, f['id'], today))
    lines.append('</urlset>')
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

    total = sum(os.path.getsize(os.path.join(OUT, n)) for n in os.listdir(OUT) if n.endswith('.html'))
    print('m/ %d 个物种页，共 %.1f MB' % (len(order), total / 1048576))
    print('sitemap.xml %d 条 URL' % (len(order) + 1))


if __name__ == '__main__':
    main()
