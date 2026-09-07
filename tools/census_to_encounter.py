#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""census_to_encounter.py — iNat 观察数 -> encounter 四档，并套本土种修正表

    python tools/census_to_encounter.py C:/tmp/mushroomId/census181/census.json

阈值来自设计稿 §5。⛔ iNat 观察数对中国物种系统性偏低（用户集中在欧美），
所以修正表不是补丁，是这个字段成立的前提：菜市场买得到的一律不低于 occasional。
"""
import json, sys, io, os
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECIES = os.path.join(ROOT, "data", "mushrooms.json")


def band(n):
    if n is None:
        return "seldom"
    if n >= 10000:
        return "common"
    if n >= 1000:
        return "occasional"
    if n >= 100:
        return "rare"
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
    cen = {r["id"]: r.get("observations")
           for r in json.load(io.open(census_path, encoding="utf-8"))}
    sp = json.load(io.open(SPECIES, encoding="utf-8"))
    changed = 0
    for m in sp:
        e = band(cen.get(m["id"]))
        if m["id"] in FLOOR and ORDER.index(FLOOR[m["id"]]) > ORDER.index(e):
            e = FLOOR[m["id"]]
        if m.get("encounter") != e:
            m["encounter"] = e
            changed += 1
    io.open(SPECIES, "w", encoding="utf-8").write(
        json.dumps(sp, ensure_ascii=False, indent=2) + "\n")
    print("写入 %d 条，分布 %s" % (changed, dict(Counter(m["encounter"] for m in sp))))


if __name__ == "__main__":
    main(sys.argv[1])
