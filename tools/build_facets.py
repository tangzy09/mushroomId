#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""build_facets.py — 一期 B 的三个检索字段：silhouette / colorGroup / pinyin 三件套

    python tools/build_facets.py            # 写回 data/mushrooms.json
    python tools/build_facets.py --report   # 只打印每种的判定，不写

三个字段都是从已有字段派生 + 人工修正表，不是从头标注：
- silhouette：art.cap 的 31 个值归并成 8 组（设计 §2）。
- colorGroup：art.capColor 按 HSL 分桶，再套修正表。⚠ 自动分桶只是起点：
  米白色的饱和度常常不低，白色桶第一版一个都没有，大马勃被判成黄。
- pinyin / pyAbbr / initial：pypinyin 生成，多音字修正表。
"""
import json, io, os, sys, colorsys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECIES = os.path.join(ROOT, "data", "mushrooms.json")

# ---- 轮廓：31 -> 8 -------------------------------------------------------
SILHOUETTE = {
    "umbrella": ["convex", "flat", "bell", "conical", "cylinder", "egg", "spoon"],
    "funnel":   ["funnel", "trumpet", "cup"],
    "shelf":    ["fan", "kidney", "hoof"],
    "ball":     ["ball", "pear", "tuber", "lump", "round", "star", "cage"],
    "coral":    ["branch", "frill", "tentacles"],
    "club":     ["club", "finger", "tongue"],
    "brain":    ["brain", "honeycomb", "saddle"],
    "jelly":    ["ear", "blob"],
}
CAP_TO_SIL = {cap: sil for sil, caps in SILHOUETTE.items() for cap in caps}

# ---- 颜色：HSL 分桶 + 修正 ------------------------------------------------
COLORS = ["white", "yellow", "orange", "red", "brown", "grey", "black", "purple", "green"]


def bucket(hexcolor):
    h = hexcolor.lstrip("#")
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    hue, l, s = colorsys.rgb_to_hls(r, g, b)
    hue *= 360
    if l > 0.78 and s < 0.45:
        return "white"
    if l < 0.16:
        return "black"
    if s < 0.14:
        return "grey" if l > 0.4 else "black"
    if hue < 12 or hue >= 335:
        return "red" if l > 0.28 else "brown"
    if hue < 38:
        return "orange" if s > 0.5 and l > 0.42 else "brown"
    if hue < 68:
        return "yellow" if l > 0.45 else "brown"
    if hue < 170:
        return "green"
    if hue < 265:
        return "purple" if s > 0.25 else "grey"
    return "purple" if s > 0.3 else "grey"


# 人工修正：键是 id，值是完整的颜色组（覆盖自动结果）。依据是已选定的照片。
COLOR_FIX = {
    "destroyingangel": ["white"], "exitialis": ["white"], "smithiana": ["white"],
    "giantpuffball": ["white"], "puffball": ["white"], "ivory": ["white"],
    "button": ["white", "brown"], "horsemushroom": ["white"], "fieldmushroom": ["white"],
    "yellowstainer": ["white"], "japonica": ["white"], "grisette": ["grey"],
    "coralhericium": ["white"], "lionsmane": ["white"], "snowfungus": ["white"],
    "crested": ["white"], "candlesnuff": ["white", "black"], "saddle": ["white"],
    "strawmushroom": ["grey", "brown"], "enoki": ["brown", "orange"],
    "flyagaric": ["red", "white"], "sickener": ["red", "white"], "caesar": ["orange", "yellow"],
    "amanitajack": ["orange", "red"], "eggamanita": ["orange"], "scarletcup": ["red"],
    "firecoral": ["red", "orange"], "redcage": ["red"], "devilsfingers": ["red"],
    "bleedingtooth": ["white", "red"], "scarletwaxcap": ["red"], "beefsteak": ["red", "brown"],
    "lobster": ["orange", "red"], "chanterelle": ["yellow", "orange"], "chickenwoods": ["orange", "yellow"],
    "goldenoyster": ["yellow"], "leucocoprinus": ["yellow"], "sulphurtuft": ["yellow", "green"],
    "equestre": ["yellow", "green"], "larchbolete": ["yellow"], "jackolantern": ["orange"],
    "laughing": ["orange"], "stagshorn": ["orange", "yellow"], "stagshornCoral": ["yellow"],
    "orangepeel": ["orange"], "jellybaby": ["yellow", "brown"], "witchbutter": ["yellow", "orange"],
    "goldenear": ["white", "yellow"], "greenrussula": ["green"], "parrot": ["green", "yellow"],
    "greenelfcup": ["green"], "deathcap": ["green", "yellow"], "greenspored": ["white", "brown"],
    "amethyst": ["purple"], "violetwebcap": ["purple"], "woodblewit": ["purple"],
    "violetcoral": ["purple"], "lilacbonnet": ["purple"], "sordida": ["purple"],
    "bluemushroom": ["purple"], "indigomilk": ["purple"], "cornflower": ["yellow"],
    "turkeytail": ["brown", "grey"], "chaga": ["black", "brown"], "deadmanfingers": ["black"],
    "kingalfred": ["black", "brown"], "blackwitch": ["black"], "earthtongue": ["black"],
    "blacktruffle": ["black"], "chinesetruffle": ["black"], "blacktrumpet": ["black", "grey"],
    "ergot": ["black", "purple"], "zombieant": ["brown"], "inkcap": ["grey", "brown"],
    "magpie": ["black", "white"], "splitgill": ["white", "grey"], "shaggyink": ["white"],
    "micaceus": ["orange", "brown"], "subnigricans": ["white", "grey"], "blackening": ["white", "black"],
    "charcoalburner": ["purple", "green", "grey"], "tsukiyotake": ["brown", "purple"],
    "fuliginea": ["grey", "black"], "panther": ["brown", "white"], "blusher": ["brown", "red"],
    "citrina": ["yellow", "white"], "subjunquillea": ["yellow"], "matsutake": ["brown", "white"],
    "artistconk": ["brown", "white"], "reishi": ["red", "brown"], "sanghuang": ["brown", "yellow"],
    "tinder": ["grey", "brown"], "redbelt": ["red", "black"], "birchpolypore": ["white", "brown"],
    "dryadsaddle": ["yellow", "brown"], "hedgehog": ["white", "orange"], "earthstar": ["brown"],
    "barometer": ["brown"], "birdsnest": ["brown"], "whitebirdsnest": ["white", "yellow"],
    "bambooveil": ["white"], "redveil": ["red", "white"], "stinkhorn": ["white", "green"],
    "dogstinkhorn": ["white", "orange"], "morel": ["yellow", "brown"], "blackmorel": ["black", "brown"],
    "falsemorel": ["brown", "red"], "verpa": ["brown"], "glowmycena": ["white", "grey"],
    "bittermycena": ["brown", "white"], "oyster": ["white", "grey"], "lateoyster": ["green", "yellow"],
    "kingoyster": ["brown", "white"], "shiitake": ["brown"], "woodear": ["brown", "black"],
    "jellyear": ["brown"], "hatsudake": ["orange", "red"], "saffronmilk": ["orange", "green"],
    "woollymilk": ["orange", "white"], "porcini": ["brown", "white"], "satan": ["white", "red"],
    "jianshouqing": ["brown", "red"], "venenatus": ["yellow", "brown"], "whiteonion": ["white", "yellow"],
    "bainiugan": ["white", "brown"], "magnificus": ["red", "brown"], "earthball": ["yellow", "brown"],
    "pisolithus": ["brown"], "trogia": ["white"], "candolle": ["white", "brown"], "fairyring": ["brown"],
    "conocybe": ["brown", "yellow"], "lepiotabrun": ["brown", "white"], "parasol": ["brown", "white"],
    "chlorophyllumB": ["brown", "white"], "termite": ["grey", "white"], "bigred": ["red"],
    "mongolica": ["white"], "cauliflower": ["white", "yellow"], "maitake": ["grey", "brown"],
    "ganbajun": ["grey", "white"], "poria": ["brown", "white"], "caterpillar": ["brown", "yellow"],
    "militaris": ["orange"], "gomphus": ["orange", "white"], "formosa": ["orange", "yellow"],
    "coralRamaria": ["white", "purple"], "livid": ["white", "grey"], "deerpluteus": ["brown", "white"],
    "rollrim": ["brown"], "poisonpie": ["white", "brown"], "deadlywebcap": ["orange", "brown"],
    "gypsy": ["brown", "white"], "funeralbell": ["brown", "yellow"], "woodtuft": ["brown", "yellow"],
    "velvetfoot": ["orange", "brown"], "honey": ["brown", "yellow"], "humongous": ["brown"],
    "hypholomaL": ["red", "brown"], "wrinkledpeach": ["orange", "red"], "winecap": ["red", "brown"],
    "nameko": ["brown", "orange"], "shimeji": ["brown", "white"], "almond": ["brown", "white"],
    "blackskin": ["black", "white"], "fakematsutake": ["brown", "white"], "slipperyjack": ["brown"],
    "chestnutbolete": ["brown", "orange"], "bitterbolete": ["brown"], "pinecone": ["black", "grey"],
    "tigerpaw": ["brown"], "waxcapconic": ["red", "orange", "black"], "yellowfoot": ["brown", "yellow"],
    "giantpolypore": ["brown", "white"], "falseturkey": ["orange", "yellow"], "stereumostrea": ["orange", "brown"],
    "summertruffle": ["black"], "whitetruffle": ["white", "yellow"], "seldom": [],
}

# ---- 拼音 ------------------------------------------------------------------
from pypinyin import lazy_pinyin, Style

PINYIN_FIX = {
    # 多音字：菌 jun，鹅膏 e gao，鬼伞 gui san，块菌 kuai jun，茯苓 fu ling
}


def pinyin3(name):
    full = "".join(lazy_pinyin(name))
    abbr = "".join(lazy_pinyin(name, style=Style.FIRST_LETTER))
    full = PINYIN_FIX.get(name, full)
    return full, abbr, (abbr[:1] or "#").upper()


def main(report=False):
    sp = json.load(io.open(SPECIES, encoding="utf-8"))
    unknown_caps = set()
    changed = 0
    for m in sp:
        cap = (m.get("art") or {}).get("cap", "convex")
        sil = CAP_TO_SIL.get(cap)
        if not sil:
            unknown_caps.add(cap); sil = "umbrella"
        auto = [bucket((m.get("art") or {}).get("capColor", "#888888"))]
        cols = COLOR_FIX.get(m["id"]) or auto
        cols = [c for c in cols if c in COLORS][:3] or auto
        py, ab, ini = pinyin3(m["name"])
        new = {"silhouette": sil, "colorGroup": cols, "pinyin": py, "pyAbbr": ab, "initial": ini}
        if report:
            print("%-16s %-8s %-9s %-24s %s  %s" % (m["id"], cap, sil, ",".join(cols),
                  "" if m["id"] in COLOR_FIX else "(auto %s)" % auto[0], py))
        for k, v in new.items():
            if m.get(k) != v:
                m[k] = v; changed += 1
    if unknown_caps:
        print("⚠ 绘制值没有归组，先落到伞形：%s" % sorted(unknown_caps))
    if not report:
        io.open(SPECIES, "w", encoding="utf-8").write(json.dumps(sp, ensure_ascii=False, indent=2) + "\n")
    print("silhouette 分布:", dict(Counter(m["silhouette"] for m in sp)))
    print("colorGroup 分布:", dict(Counter(c for m in sp for c in m["colorGroup"])))
    print("未人工修正颜色的:", sum(1 for m in sp if m["id"] not in COLOR_FIX), "种")
    print("写入 %d 个字段值" % changed if not report else "（report 模式，未写入）")


if __name__ == "__main__":
    main(report="--report" in sys.argv)
