# -*- coding: utf-8 -*-
"""生成物种静态页（中英双语）+ sitemap.xml。

  m/<id>.html      中文，166 页
  m/en/<id>.html   英文，166 页

改版前整站只有一个可索引页面（index.html，单页应用）。每种菌一个静态页是长尾搜索入口：
中文标题「毒鹅膏 Amanita phalloides — 怎么认？识别要点与图片」，英文标题
「Death cap (Amanita phalloides) — How to Identify It」，正文即详情页内容，带 Taxon
结构化数据，底部深链回 #/m/<id>（js/game/app.js 的 deepLink() 已能接这个 hash）。
中文按拼音排上一种/下一种，英文按英文名排。

双语的三条规矩（见 skill static-site-seo §四）：
  · 每个语言版本 canonical 指自己，绝不跨语言指——指过去等于告诉搜索引擎这一语言是重复内容
  · hreflang 两个版本互指、都列全（含自己）、绝对 URL，x-default 指英文
  · 166 种两种语言都有，所以每页都发 hreflang；哪天出现只有一种语言的种，那一页必须不发

lastmod 只在页面内容真变时才动：tools/species_pages_lastmod.json 记每页的内容哈希与日期
（进 git），重跑时哈希没变就沿用旧日期。否则每次重跑全站日期一起跳到当天，等于对爬虫撒谎。
日期用本地日期（date.today()），不用 UTC。

⚠ 安全红线同样适用于静态页：不给「能不能吃」的结论，食性标签必须带 note 一起出现，
毒/致命种必须显示「不能用于野外鉴定」的免责声明——这不是详情页独有的责任，是
整个产品的责任，静态页不能因为是「SEO 页面」就绕过。两种语言的安全文案分别取自
config.js 的 safety.detail 中英文，字面一致。

用法：python tools/make_species_pages.py
"""
import hashlib, json, os
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://mushroomid.ai-speeds.com'
MANIFEST = os.path.join(ROOT, 'tools', 'species_pages_lastmod.json')

# ---------------------------------------------------------------- per-language text
# 标签字符串与 js/game/config.js（中文原值 / I18N_EN_OVERRIDES）、locales/*.js 的栏目标题
# 逐字一致：静态页和 app 详情页说的必须是同一句话。
LANGS = {
    'zh': {
        'html_lang': 'zh-CN', 'hreflang': 'zh-CN',
        'dir': '', 'up': '..',                       # m/<id>.html，回到根是 ..
        'brand': '菌菇图鉴',
        'title': '{name} {latin} — 怎么认？识别要点与图片 | 菌菇图鉴',
        'og_title': '{name} {latin} — 怎么认？',
        'desc': '{name}（{latin}）怎么认：{k0}{sep}{k1}',
        'keywords': '{name},{nameEn},{latin},{family},菌菇图鉴,蘑菇识别,野生菌',
        'other_lang_label': 'English',
        'aka': '又名　',
        'safety': '同一种蘑菇在不同地区、不同成熟度可能有不同记载，且存在大量肉眼无法区分的相似种。'
                  '请勿凭本页信息判断真实蘑菇能否食用。野生蘑菇不采、不买、不吃。',
        'howToTell': '怎么认', 'basics': '基础数据', 'lookalikes': '容易认错', 'funFact': '趣味知识',
        'family': '科', 'hymenium': '子实层', 'growsOn': '长在哪', 'howBig': '多大',
        'encounter': '遇见率', 'habitat': '生境',
        'capDiameter': '菌盖直径', 'overallSize': '整体大小',
        'idKeysFootnote': '识别要点由 AI 据公开资料整理，未经真菌学家审校，仅供学习，不能作为采食依据。',
        'cta': '在图鉴里打开 · 可叠加筛选与照片 ›',
        'footer': '照片来自 iNaturalist / Wikimedia Commons / GBIF 的可商用开放授权，逐张标注摄影者。'
                  '<a href="{up}/index.html">菌菇图鉴</a> 收录 {n} 种真实菌类，'
                  '按轮廓 / 长在哪 / 颜色 / 大小 / 名字五路检索，支持离线使用。',
        'ENCOUNTER': {'common': '常见', 'occasional': '偶见', 'rare': '罕见', 'seldom': '难得一见'},
        'EDIBILITY': {
            'cultivated':  ('🍽 栽培食用', '商业栽培食用菌。野生个体请通过正规渠道购买。'),
            'wild_edible': ('🍽 资料载可食', '资料记载为野生食用菌。本图鉴不提供任何采食依据。'),
            'conditional': ('🔥 条件可食', '资料记载须专业处理后食用，误食有中毒记录。'),
            'medicinal':   ('💊 药用', '传统上用作药材，不作食物。'),
            'inedible':    ('❓ 不可食', '无毒但质地木质或极苦，不作食物。'),
            'unknown':     ('❓ 食性不明', '食性不明，视同有毒。'),
            'poisonous':   ('⚠️ 有毒', '资料记载为有毒蘑菇。'),
            'deadly':      ('☠️ 剧毒', '资料记载为剧毒，有致死记录。'),
        },
        'HYMENIUM': {'gills': '菌褶', 'pores': '菌管', 'teeth': '菌齿', 'ridges': '棱脊', 'smooth': '光滑', 'gleba': '孢体'},
        'SUBSTRATE': {'wood': '木生', 'soil': '土生', 'grass': '草地', 'litter': '落叶层', 'mycorrhizal': '菌根共生',
                      'termite': '白蚁巢', 'insect': '虫生', 'parasitic': '寄生', 'conifer_cone': '松果'},
        'sep': '。',
    },
    'en': {
        'html_lang': 'en', 'hreflang': 'en',
        'dir': 'en/', 'up': '../..',                 # m/en/<id>.html，回到根是 ../..
        'brand': 'Mushroom Guide',
        'title': '{name} ({latin}) — How to Identify It: Field Marks & Photos | Mushroom Guide',
        'og_title': '{name} ({latin}) — How to Identify It',
        'desc': 'How to recognise {name} ({latin}): {k0}{sep}{k1}',
        'keywords': '{name},{nameZh},{latin},{family},mushroom guide,mushroom identification,wild mushrooms',
        'other_lang_label': '中文',
        'aka': '',
        'safety': 'The same species can be described differently across regions and stages of maturity, '
                  'and countless look-alike species cannot be told apart by eye. Never use the information '
                  'on this page to judge whether a real mushroom is safe to eat.',
        'howToTell': 'How to Tell', 'basics': 'Basics', 'lookalikes': 'Easily Confused With', 'funFact': 'Fun Fact',
        'family': 'Family', 'hymenium': 'Hymenium', 'growsOn': 'Grows On', 'howBig': 'How Big',
        'encounter': 'Encounter Rate', 'habitat': 'Habitat',
        'capDiameter': 'cap diameter', 'overallSize': 'overall size',
        'idKeysFootnote': 'ID notes are compiled by AI from public sources, not reviewed by a mycologist, '
                          'for learning only — never a basis for foraging.',
        'cta': 'Open in the guide · filters & photos ›',
        'footer': 'Photos come from iNaturalist / Wikimedia Commons / GBIF under open licences that permit '
                  'commercial use, each credited to its photographer. '
                  '<a href="{up}/index.html">Mushroom Guide</a> covers {n} real species with five ways to '
                  'search — silhouette, where it grows, colour, size and name — and works offline.',
        'ENCOUNTER': {'common': 'Common', 'occasional': 'Occasional', 'rare': 'Rare', 'seldom': 'Rarely Seen'},
        'EDIBILITY': {
            'cultivated':  ('🍽 Cultivated Edible', 'A commercially cultivated edible fungus. Buy wild specimens only through reputable, regulated sources.'),
            'wild_edible': ('🍽 Reported Edible (Wild)', 'Reference sources describe this as an edible wild fungus. This guide provides no basis whatsoever for foraging or consumption.'),
            'conditional': ('🔥 Edible With Preparation', 'Sources report it requires expert processing before it can be eaten; cases of poisoning from improper handling have been recorded.'),
            'medicinal':   ('💊 Medicinal', 'Traditionally used as a medicinal ingredient, not as food.'),
            'inedible':    ('❓ Inedible', 'Non-toxic, but woody or intensely bitter in texture — not eaten as food.'),
            'unknown':     ('❓ Edibility Unknown', 'Edibility is unknown and should be treated as poisonous.'),
            'poisonous':   ('⚠️ Poisonous', 'Reference sources list this as a poisonous mushroom.'),
            'deadly':      ('☠️ Deadly Poisonous', 'Reference sources describe this as highly toxic, with recorded fatalities.'),
        },
        'HYMENIUM': {'gills': 'Gills', 'pores': 'Pores', 'teeth': 'Teeth', 'ridges': 'Ridges', 'smooth': 'Smooth', 'gleba': 'Gleba'},
        'SUBSTRATE': {'wood': 'Wood', 'soil': 'Soil', 'grass': 'Grassland', 'litter': 'Leaf Litter', 'mycorrhizal': 'Mycorrhizal',
                      'termite': 'Termite Mound', 'insect': 'Insects', 'parasitic': 'Parasitic', 'conifer_cone': 'Conifer Cone'},
        'sep': '. ',
    },
}


def esc(s):
    return (str(s if s is not None else '').replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


CSS = """*{box-sizing:border-box}body{margin:0;background:#F7F4EF;color:#2A2620;
font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
font-size:16px;line-height:1.7}
.wrap{max-width:680px;margin:0 auto;background:#fff;min-height:100vh}
header{padding:14px 18px;border-bottom:.5px solid #E6DFD3;font-size:13px;color:#8A7F6B;display:flex;justify-content:space-between;gap:12px}
header a{color:#5B8C3A;text-decoration:none}
img.hero{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#EDE7D9}
main{padding:18px 18px 40px}
h1{font-size:27px;margin:0;line-height:1.25}
.sci{font-family:"Songti SC",Georgia,serif;font-style:italic;font-size:15px;margin-top:2px;color:#6B6252}
.sci b{font-style:normal;font-weight:400;font-family:inherit}
.aka{color:#8A7F6B;font-size:13px;margin-top:4px}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}
.bdg{font-size:12px;padding:3px 10px;border-radius:3px;background:#EAF0E2;color:#3E6425;font-weight:600}
.bdg.grey{background:#F2EEE3;color:#8A7F6B}
.bdg.warn{background:#FBEAEA;color:#A32F3A}
.note{font-size:13px;color:#8A7F6B;margin:2px 0 0}
.safety{background:#F5EDE6;border:1px solid #E6D6C6;color:#6E5A48;font-size:12.5px;
line-height:1.5;padding:10px 12px;border-radius:8px;margin:14px 0}
h2{font-size:12px;font-weight:700;letter-spacing:.12em;color:#8A7F6B;margin:26px 0 8px;text-transform:uppercase}
ul.idk{list-style:none;margin:0;padding:0}
ul.idk li{padding-left:20px;position:relative;margin-bottom:7px}
ul.idk li::before{content:"\\2713";position:absolute;left:0;color:#5B8C3A;font-weight:700}
dl{display:grid;grid-template-columns:minmax(70px,auto) 1fr;gap:7px 12px;margin:0;font-size:15px}
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
<html lang="{html_lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="keywords" content="{keywords}">
<link rel="canonical" href="{self_url}">
<link rel="alternate" hreflang="zh-CN" href="{zh_url}">
<link rel="alternate" hreflang="en" href="{en_url}">
<link rel="alternate" hreflang="x-default" href="{en_url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{og_title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{base}/{img}">
<meta property="og:url" content="{self_url}">
<meta property="og:locale" content="{og_locale}">
<link rel="icon" href="{up}/assets/icons/icon-192.png">
<meta name="theme-color" content="#F7F4EF">
<style>{css}</style>
<script type="application/ld+json">{ld}</script>
</head>
<body>
<div class="wrap">
<header><span><a href="{up}/index.html">{brand}</a> &rsaquo; {name}</span><a href="{other_url}" hreflang="{other_hreflang}" lang="{other_hreflang}">{other_lang_label}</a></header>
<img class="hero" src="{up}/{img}" alt="{name} {latin}" loading="eager">
<main>
<h1>{name}</h1>
<div class="sci">{latin}{sciPart}</div>
{akahtml}
<div class="badges">{badges}</div>
<p class="note">{edibNote}</p>
<div class="safety">{safety}</div>

<h2>{L_howToTell}</h2>
<ul class="idk">{idk}</ul>
<p class="note">{L_idKeysFootnote}</p>

<h2>{L_basics}</h2>
<dl>
<dt>{L_family}</dt><dd>{family}</dd>
<dt>{L_hymenium}</dt><dd>{hymenium}</dd>
<dt>{L_growsOn}</dt><dd>{substrate}</dd>
<dt>{L_howBig}</dt><dd>{size}</dd>
<dt>{L_encounter}</dt><dd>{encounter}</dd>
{habitatrow}</dl>
{simblock}
<h2>{L_funFact}</h2>
<p class="fact">{fact}</p>

<a class="cta" href="{up}/index.html#/m/{id}">{L_cta}</a>
<nav class="pn">{prevnext}</nav>
</main>
<footer>{footer}</footer>
</div>
</body>
</html>
"""


def _dup(a, b):
    a, b = (a or '').strip(), (b or '').strip()
    return not a or a == b or a in b or b in a


def _texts(keys):
    """idKeys 是 [{text, src}]，idKeysEn 是 [str]；两种形状都接。"""
    return [(k['text'] if isinstance(k, dict) else k) for k in (keys or [])]


def _fields(f, lang):
    """每种语言从数据里取哪个字段。缺英文时明确回落到中文——比空着更好，但门会数一下。"""
    if lang == 'en':
        return {
            'name': f.get('nameEn') or f['name'],
            'idk': _texts(f.get('idKeysEn')) or _texts(f['idKeys']),
            'habitat': f.get('habitatEn') or f.get('habitat'),
            'fact': f.get('factEn') or f['fact'],
            'notes': f.get('lookalikeNotesEn') or {},
        }
    return {
        'name': f['name'],
        'idk': _texts(f['idKeys']),
        'habitat': f.get('habitat'),
        'fact': f['fact'],
        'notes': f.get('lookalikeNotes') or {},
    }


def page_url(lang, sid):
    return '%s/m/%s%s.html' % (BASE, LANGS[lang]['dir'], sid)


def build_page(f, prev, nxt, by_id, lang, n_total):
    L = LANGS[lang]
    T = _fields(f, lang)
    other = 'en' if lang == 'zh' else 'zh'

    edib_label, edib_note = L['EDIBILITY'][f['edibility']]
    toxic = f['edibility'] in ('poisonous', 'deadly')
    # 科名只有中文（数据没有 familyEn，app 英文模式同样显示中文科名）；英文页上标 lang，不编译名
    badges = ['<span class="bdg">%s</span>' % esc(L['ENCOUNTER'].get(f['encounter'], f['encounter'])),
              '<span class="bdg grey"%s>%s</span>' % ('' if lang == 'zh' else ' lang="zh-CN"', esc(f['family'])),
              '<span class="bdg%s">%s</span>' % ('' if toxic else ' grey', esc(edib_label))]

    idk = T['idk']
    k0 = idk[0]
    sep = L['sep'] if k0 and k0[-1] not in '。！？.!?' else (' ' if lang == 'en' else '')
    desc = L['desc'].format(name=T['name'], latin=f['latin'], k0=k0, sep=sep, k1=idk[1] if len(idk) > 1 else '')
    if len(desc) > 160:
        # 英文按词截，别把 "bulbous base ring" 切成 "base rin"；中文没有词边界，按字截
        cut = desc[:160]
        desc = cut.rsplit(' ', 1)[0] if lang == 'en' and ' ' in cut else cut

    sims = [s for s in (f.get('lookalikes') or []) if s in by_id]
    simblock = ''
    if sims:
        cards = ''
        for sid in sims:
            g = by_id[sid]
            G = _fields(g, lang)
            note = T['notes'].get(sid) or G['notes'].get(f['id']) or (G['idk'][0] if G['idk'] else '')
            img = 'assets/photos/thumb/%s.webp' % sid
            cards += ('<a href="%s.html"><img src="%s/%s" alt="%s" loading="lazy">'
                      '<b>%s</b><i>%s</i></a>') % (sid, L['up'], img, esc(G['name']), esc(G['name']), esc(note))
        simblock = '<h2>%s</h2><div class="sim">%s</div>\n' % (L['lookalikes'], cards)

    lo, hi = f['capCm']
    is_cap = f['silhouette'] in ('umbrella', 'funnel')
    size = ('%s cm' % lo) if lo == hi else ('%s–%s cm' % (lo, hi))
    size += ('（%s）' if lang == 'zh' else ' (%s)') % (L['capDiameter'] if is_cap else L['overallSize'])

    aka = list(f.get('aka') or [])
    if lang == 'zh':
        akahtml = ('<div class="aka">%s%s</div>' % (L['aka'], esc(' · '.join(aka)))) if aka else ''
        sciPart = (' · ' + esc(f['nameEn'])) if f.get('nameEn') else ''
        alt_names = ([f['nameEn']] if f.get('nameEn') else []) + aka
    else:
        akahtml = ''
        sciPart = ' · <b lang="zh-CN">%s</b>' % esc(f['name'])
        alt_names = [f['name']] + aka

    self_url = page_url(lang, f['id'])
    ld = {
        '@context': 'https://schema.org', '@type': 'Taxon',
        'name': T['name'], 'alternateName': alt_names,
        'scientificName': f['latin'], 'taxonRank': 'species',
        'parentTaxon': f['family'],
        'description': ('；' if lang == 'zh' else '; ').join(idk),
        'image': BASE + '/assets/photos/real/%s.webp' % f['id'],
        'url': self_url,
        'inLanguage': L['html_lang'],
    }

    pn = []
    if prev:
        pn.append('<a href="%s.html">&lsaquo; %s</a>' % (prev['id'], esc(_fields(prev, lang)['name'])))
    else:
        pn.append('<span></span>')
    if nxt:
        pn.append('<a href="%s.html" style="text-align:right">%s &rsaquo;</a>' % (nxt['id'], esc(_fields(nxt, lang)['name'])))
    else:
        pn.append('<span></span>')

    sub_label = L['SUBSTRATE'].get(f['substrate'], f['substrate'])
    habitat = T['habitat']
    habitatrow = '' if _dup(habitat, sub_label) and _dup(habitat, f.get('substrate')) or not habitat \
        else '<dt>%s</dt><dd>%s</dd>\n' % (L['habitat'], esc(habitat))

    return PAGE.format(
        html_lang=L['html_lang'], base=BASE, up=L['up'], css=CSS, id=f['id'],
        title=esc(L['title'].format(name=T['name'], latin=f['latin'])),
        og_title=esc(L['og_title'].format(name=T['name'], latin=f['latin'])),
        og_locale='zh_CN' if lang == 'zh' else 'en_US',
        keywords=esc(L['keywords'].format(name=T['name'], nameEn=f.get('nameEn') or '', nameZh=f['name'],
                                          latin=f['latin'], family=f['family'])),
        self_url=self_url, zh_url=page_url('zh', f['id']), en_url=page_url('en', f['id']),
        other_url=('en/' if lang == 'zh' else '../') + f['id'] + '.html',
        other_hreflang=LANGS[other]['hreflang'], other_lang_label=L['other_lang_label'],
        brand=L['brand'], name=esc(T['name']), latin=esc(f['latin']), family=esc(f['family']),
        desc=esc(desc), img='assets/photos/real/%s.webp' % f['id'],
        sciPart=sciPart, akahtml=akahtml, badges=''.join(badges), edibNote=esc(edib_note),
        safety=L['safety'],
        L_howToTell=L['howToTell'], L_basics=L['basics'], L_funFact=L['funFact'],
        L_family=L['family'], L_hymenium=L['hymenium'], L_growsOn=L['growsOn'],
        L_howBig=L['howBig'], L_encounter=L['encounter'], L_idKeysFootnote=L['idKeysFootnote'],
        L_cta=L['cta'],
        idk=''.join('<li>%s</li>' % esc(k) for k in idk),
        hymenium=esc(L['HYMENIUM'].get(f['hymenium'], f['hymenium'])),
        substrate=esc(sub_label),
        size=size, encounter=esc(L['ENCOUNTER'].get(f['encounter'], f['encounter'])),
        habitatrow=habitatrow, simblock=simblock, fact=esc(T['fact']),
        footer=L['footer'].format(up=L['up'], n=n_total),
        ld=json.dumps(ld, ensure_ascii=False),
        prevnext=''.join(pn))


def _load_manifest():
    try:
        return json.load(open(MANIFEST, encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def main():
    sp = json.load(open(os.path.join(ROOT, 'data', 'mushrooms.json'), encoding='utf-8'))
    by_id = {f['id']: f for f in sp}
    n = len(sp)
    orders = {
        'zh': sorted(sp, key=lambda f: f.get('pinyin') or f['id']),
        'en': sorted(sp, key=lambda f: (f.get('nameEn') or f['id']).lower()),
    }
    today = date.today().isoformat()          # 本地日期，不是 UTC
    manifest = _load_manifest()
    fresh = {}
    written = {}

    for lang in ('zh', 'en'):
        out_dir = os.path.join(ROOT, 'm', LANGS[lang]['dir'])
        os.makedirs(out_dir, exist_ok=True)
        order = orders[lang]
        for i, f in enumerate(order):
            prev = order[i - 1] if i else None
            nxt = order[i + 1] if i + 1 < len(order) else None
            html = build_page(f, prev, nxt, by_id, lang, n)
            rel = 'm/%s%s.html' % (LANGS[lang]['dir'], f['id'])
            open(os.path.join(ROOT, rel), 'w', encoding='utf-8').write(html)
            h = hashlib.sha1(html.encode('utf-8')).hexdigest()[:16]
            old = manifest.get(rel)
            mod = old['mod'] if old and old.get('hash') == h else today
            fresh[rel] = {'hash': h, 'mod': mod}
            written.setdefault(lang, 0)
            written[lang] += 1

    json.dump(fresh, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
             'xmlns:xhtml="http://www.w3.org/1999/xhtml">',
             '  <url><loc>%s/</loc><lastmod>%s</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>' % (BASE, today)]
    for lang in ('zh', 'en'):
        for f in orders[lang]:
            rel = 'm/%s%s.html' % (LANGS[lang]['dir'], f['id'])
            lines.append(
                '  <url><loc>%s/%s</loc><lastmod>%s</lastmod><changefreq>monthly</changefreq><priority>0.7</priority>'
                '<xhtml:link rel="alternate" hreflang="zh-CN" href="%s"/>'
                '<xhtml:link rel="alternate" hreflang="en" href="%s"/>'
                '<xhtml:link rel="alternate" hreflang="x-default" href="%s"/></url>'
                % (BASE, rel, fresh[rel]['mod'], page_url('zh', f['id']), page_url('en', f['id']), page_url('en', f['id'])))
    lines.append('</urlset>')
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

    changed = sum(1 for r, v in fresh.items() if v['mod'] == today and (manifest.get(r) or {}).get('hash') != v['hash'])
    print('m/ zh %d 页, m/en/ en %d 页；本次内容有变 %d 页' % (written['zh'], written['en'], changed))
    print('sitemap.xml %d 条 URL' % (n * 2 + 1))


if __name__ == '__main__':
    main()
