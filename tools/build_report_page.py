"""Render docs/design/DESIGN.md into a standalone HTML report page.

Usage:  pip install markdown && python3 tools/build_report_page.py
Output: build/mushroomid-design.html
"""
import os, re, html, markdown

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SRC = os.path.join(ROOT, "docs/design/DESIGN.md")
OUT = os.path.join(ROOT, "build/mushroomid-design.html")

md = open(SRC, encoding="utf-8").read()

# drop the H1 + intro blockquote (rendered as hero) and the trailing note
md = md.split("\n---\n", 1)[1]

body = markdown.markdown(md, extensions=["tables", "fenced_code"])

# split into sections on h2
parts = re.split(r"(?=<h2>)", body)
sections, toc = [], []
for p in parts:
    m = re.match(r"<h2>(.*?)</h2>", p)
    if not m:
        continue
    title = m.group(1)
    num = re.match(r"(\d+)\.\s*(.*)", title)
    if num:
        n, t = num.group(1), num.group(2)
        sid = "s" + n
        eyebrow = f"§ {n}"
    else:
        n, t, sid, eyebrow = "", title, "appendix", "附录"
    short = re.sub(r"（.*?）|\(.*?\)", "", t).strip()
    toc.append(f'<a href="#{sid}"><span class="n">{eyebrow}</span>{html.escape(short)}</a>')
    rest = p[m.end():]
    cls = "sec"
    if n == "0": cls += " lead"
    if n == "6": cls += " safety"
    sections.append(
        f'<section id="{sid}" class="{cls}"><div class="eyebrow">{eyebrow}</div>'
        f'<h2>{t}</h2>{rest}</section>'
    )

# wrap tables for horizontal scroll
content = "\n".join(sections)
content = content.replace("<table>", '<div class="tw"><table>').replace("</table>", "</table></div>")
# italic latin names inside *..* already handled; mark ☠️ rows
content = re.sub(r"<code>(\w+_v1|mush_\w+|\.spore|MGAME1)</code>", r"<code class=key>\1</code>", content)

CSS = r"""
:root{
  --ground:#F3F4EC; --ink:#1F261D; --ink-2:#4A5346; --muted:#6E7866;
  --moss:#4F7A3A; --moss-soft:#E3ECDB; --rule:#D5D9CC; --code-bg:#E9ECE1;
  --warn:#B0203A; --warn-soft:#F6E4E6;
  --c-common:#7EC8A0; --c-rare:#4DA6FF; --c-epic:#B57BFF; --c-legend:#E0B400;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#131813; --ink:#E4E8DC; --ink-2:#BFC7B6; --muted:#96A08D;
    --moss:#8CC46E; --moss-soft:#1E2A1B; --rule:#2B352A; --code-bg:#1C241B;
    --warn:#E0687A; --warn-soft:#2E1A1E; --c-legend:#FFD166; color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --ground:#131813; --ink:#E4E8DC; --ink-2:#BFC7B6; --muted:#96A08D;
  --moss:#8CC46E; --moss-soft:#1E2A1B; --rule:#2B352A; --code-bg:#1C241B;
  --warn:#E0687A; --warn-soft:#2E1A1E; --c-legend:#FFD166; color-scheme:dark;
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font-family:"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  font-size:15.5px;line-height:1.75;-webkit-font-smoothing:antialiased}
a{color:var(--moss)}
a:focus-visible{outline:2px solid var(--moss);outline-offset:2px}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}

/* hero */
header.hero{border-bottom:1px solid var(--rule);padding:56px 0 36px}
.hero .kicker{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--muted);display:flex;gap:18px;flex-wrap:wrap}
.hero h1{font-family:"Noto Serif SC","Songti SC","SimSun",serif;font-weight:700;font-size:clamp(30px,4.2vw,46px);
  line-height:1.2;margin:14px 0 6px;text-wrap:balance;letter-spacing:-.01em}
.hero h1 .en{display:block;font-family:"IBM Plex Mono",monospace;font-weight:400;font-size:.42em;color:var(--muted);letter-spacing:.06em;margin-top:8px}
.hero .thesis{font-family:"Noto Serif SC",serif;font-size:20px;color:var(--moss);margin:14px 0 18px;max-width:40ch}
.hero .sub{color:var(--ink-2);max-width:66ch;margin:0}
.rarity{display:flex;gap:0;margin-top:26px;border:1px solid var(--rule);border-radius:4px;overflow:hidden;max-width:560px}
.rarity div{flex:1;padding:8px 10px;font-size:12px;font-family:"IBM Plex Mono",monospace;display:flex;align-items:center;gap:8px;border-right:1px solid var(--rule);color:var(--ink-2)}
.rarity div:last-child{border-right:0}
.rarity i{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none}
.rarity b{color:var(--ink);font-weight:600;font-family:"Noto Sans SC",sans-serif}

/* layout */
.page{display:grid;grid-template-columns:220px minmax(0,1fr);gap:56px;padding:40px 0 96px}
nav.toc{position:sticky;top:24px;align-self:start;font-size:13px;line-height:1.5}
nav.toc .lbl{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
nav.toc a{display:grid;grid-template-columns:44px 1fr;gap:6px;padding:5px 0;color:var(--ink-2);text-decoration:none;border-top:1px solid var(--rule)}
nav.toc a:last-child{border-bottom:1px solid var(--rule)}
nav.toc a .n{font-family:"IBM Plex Mono",monospace;color:var(--muted);font-size:11px;padding-top:2px}
nav.toc a:hover{color:var(--moss)}
main{max-width:760px;min-width:0}
@media (max-width:900px){.page{grid-template-columns:1fr;gap:28px}nav.toc{position:static}}

/* sections */
.sec{padding:34px 0 10px;border-top:1px solid var(--rule)}
.sec:first-child{border-top:0;padding-top:0}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.14em;color:var(--moss)}
h2{font-family:"Noto Serif SC",serif;font-size:27px;line-height:1.3;margin:6px 0 18px;text-wrap:balance;font-weight:700}
h3{font-size:17px;margin:30px 0 10px;font-weight:600;color:var(--ink)}
h3::before{content:"";display:inline-block;width:8px;height:8px;background:var(--moss);border-radius:2px;margin-right:10px;vertical-align:2px}
p{margin:0 0 14px;max-width:70ch}
ul,ol{padding-left:1.4em;margin:0 0 14px;max-width:70ch}
li{margin:4px 0}
li p{margin:0}
strong{font-weight:600}
em{font-family:"Noto Serif SC",serif;font-style:italic}
blockquote{margin:16px 0;padding:12px 18px;border-left:3px solid var(--moss);background:var(--moss-soft);color:var(--ink);font-family:"Noto Serif SC",serif;font-size:16px}
blockquote p{margin:0}
code{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:.86em;background:var(--code-bg);padding:1px 5px;border-radius:3px}
pre{background:var(--code-bg);border:1px solid var(--rule);border-radius:4px;padding:14px 16px;overflow-x:auto;font-size:12.5px;line-height:1.55;margin:14px 0}
pre code{background:none;padding:0;font-size:inherit}
hr{display:none}

/* tables */
.tw{overflow-x:auto;margin:14px 0 22px;border:1px solid var(--rule);border-radius:4px}
table{border-collapse:collapse;width:100%;font-size:13.5px;line-height:1.5;font-variant-numeric:tabular-nums}
th,td{padding:8px 11px;vertical-align:top;border-bottom:1px solid var(--rule);text-align:left}
th{font-weight:600;font-size:12px;letter-spacing:.04em;color:var(--muted);background:var(--moss-soft);white-space:nowrap}
tr:last-child td{border-bottom:0}
td:first-child{font-weight:600;color:var(--ink);white-space:nowrap}
td code{white-space:nowrap}

/* lead spec table */
.sec.lead .tw{border:0;border-top:2px solid var(--moss);border-radius:0}
.sec.lead td:first-child{width:9em;color:var(--moss)}
.sec.lead th{display:none}

/* safety section */
.sec.safety .eyebrow{color:var(--warn)}
.sec.safety h3::before{background:var(--warn)}
.sec.safety blockquote{border-color:var(--warn);background:var(--warn-soft)}
.sec.safety pre{border-color:var(--warn)}

footer{border-top:1px solid var(--rule);padding:22px 0 60px;color:var(--muted);font-size:12.5px;font-family:"IBM Plex Mono",monospace}
@media (prefers-reduced-motion:no-preference){a{transition:color .15s}}
"""

HERO = """
<header class="hero"><div class="wrap">
  <div class="kicker"><span>设计报告 · v0.1</span><span>2026-09-02</span><span>依据 5 份并行调研 R1–R5</span></div>
  <h1>菌菇图鉴 设计报告<span class="en">mushroomId · product &amp; technical design</span></h1>
  <p class="thesis">不教你吃，只教你认。</p>
  <p class="sub">看真实照片答题 → 抽卡收集 → 种进菌菇园，菌菇按真实时间生长并产出孢子。纯前端、无账号、localStorage，与鱼鱼图鉴同一技术栈；复用其约 70% 骨架，重写鱼缸为菌菇园。</p>
  <div class="rarity">
    <div><i style="background:var(--c-common)"></i><b>普通</b>60%</div>
    <div><i style="background:var(--c-rare)"></i><b>稀有</b>30%</div>
    <div><i style="background:var(--c-epic)"></i><b>珍稀</b>8%</div>
    <div><i style="background:var(--c-legend)"></i><b>传说</b>2%</div>
  </div>
</div></header>
"""

page = f"""<title>菌菇图鉴设计报告</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Noto+Sans+SC:wght@400;500;600&family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&display=swap">
<style>{CSS}</style>
{HERO}
<div class="wrap page">
  <nav class="toc"><div class="lbl">目录</div>{''.join(toc)}</nav>
  <main>{content}</main>
</div>
<footer><div class="wrap">源文件 docs/design/DESIGN.md · 调研原文 docs/research/01–05 · 分支 claude/mushroomid-app-design-hwzt1f</div></footer>
"""
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(page)
print(len(page), "bytes;", len(toc), "sections")
