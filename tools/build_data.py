"""Generate js/data.gen.js from data/*.json.

Structured question types (name_from_image, edibility_class, feature,
lookalike) are derived from the species records so they can never drift
out of sync with the data. Hand-written trivia, cold_fact and
myth_buster questions come from data/questions_curated.json.

Usage: python3 tools/build_data.py
"""
import json, os, random, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECIES = os.path.join(ROOT, "data/mushrooms.json")
CURATED = os.path.join(ROOT, "data/questions_curated.json")
OUT = os.path.join(ROOT, "js/data.gen.js")

RARITY_ORDER = ["common", "rare", "epic", "legend"]

EDIBILITY_CLASS = {
    "cultivated": "栽培食用菌",
    "wild_edible": "资料记载为野生食用菌",
    "medicinal": "传统药用，不作食物",
    "poisonous": "有毒",
    "deadly": "剧毒，有致死记录",
}
SPORE_LABEL = {
    "white": "白色", "cream": "乳白色", "pink": "粉红色", "brown": "褐色",
    "rusty": "锈褐色", "purple_brown": "紫褐色", "black": "黑色",
    "green": "绿色", "olive": "橄榄色", "lilac": "淡紫色",
}
HYMENIUM_LABEL = {
    "gills": "菌褶", "pores": "菌管（菌孔）", "teeth": "菌齿（肉刺）",
    "ridges": "棱脊（假褶）", "smooth": "光滑的子实层", "gleba": "包在内部的孢体",
}
SUBSTRATE_LABEL = {
    "wood": "木头上（枯木、树桩或段木）",
    "soil": "地面土壤中",
    "grass": "草地上",
    "litter": "落叶层、腐殖土上",
    "mycorrhizal": "与活树根共生的林地上",
    "termite": "白蚁巢上",
    "insect": "昆虫的虫体或蛹上",
    "parasitic": "寄生在其他生物体上",
    "conifer_cone": "掉落的松果上",
}
SEASON_LABEL = {"spring": "春季（3–5 月）", "summer": "夏季（6–8 月）",
                "autumn": "秋季（9–11 月）", "winter": "冬季（12–2 月）"}
DISCLAIMER = "本题考察的是资料如何记载，不是「能不能吃」。任何野生蘑菇都不应凭记忆或图片判断食用。"


def season_bucket(months):
    """Dominant season of a species, or None when it fruits year-round."""
    if not months or len(months) >= 10:
        return None
    buckets = {"spring": 0, "summer": 0, "autumn": 0, "winter": 0}
    for m in months:
        if m in (3, 4, 5):
            buckets["spring"] += 1
        elif m in (6, 7, 8):
            buckets["summer"] += 1
        elif m in (9, 10, 11):
            buckets["autumn"] += 1
        else:
            buckets["winter"] += 1
    top = max(buckets.values())
    winners = [k for k, v in buckets.items() if v == top]
    return winners[0] if len(winners) == 1 else None


def pick_distractors(target, pool, key, n, rng, prefer_lookalikes=True):
    """Distractor priority: lookalikes, then same genus/family, then same rarity."""
    seen, out = {key(target)}, []

    def take(cands):
        for c in cands:
            k = key(c)
            if k not in seen and len(out) < n:
                seen.add(k)
                out.append(c)

    by_id = {m["id"]: m for m in pool}
    if prefer_lookalikes:
        take([by_id[i] for i in target.get("lookalikes", []) if i in by_id])
    take(rng.sample([m for m in pool if m["family"] == target["family"]],
                    min(8, len([m for m in pool if m["family"] == target["family"]]))))
    take(rng.sample([m for m in pool if m["rarity"] == target["rarity"]],
                    min(12, len([m for m in pool if m["rarity"] == target["rarity"]]))))
    take(rng.sample(pool, min(20, len(pool))))
    return out[:n]


def build_questions(species):
    rng = random.Random(20260902)
    qs = []
    by_id = {m["id"]: m for m in species}

    for m in species:
        sid = m["id"]
        rare_i = RARITY_ORDER.index(m["rarity"])
        has_look = bool(m.get("lookalikes"))

        # --- name_from_image, d1-d5 -------------------------------------
        # Difficulty rises with rarity and with having confusable relatives.
        diff = min(5, 1 + rare_i + (1 if has_look else 0))
        opts = [m] + pick_distractors(m, species, lambda x: x["name"], 3, rng)
        rng.shuffle(opts)
        qs.append({
            "id": "q_%s_img" % sid, "type": "name_from_image", "entityId": sid,
            "difficulty": diff, "q": "这是什么蘑菇？",
            "options": [o["name"] for o in opts],
            "optionsEn": [o["nameEn"] for o in opts],
            "answerIndex": opts.index(m),
        })

        # --- edibility_class, d2-d4 -------------------------------------
        # Only for species whose category is unambiguous; never for
        # conditional / unknown / inedible.
        if m["edibility"] in EDIBILITY_CLASS:
            correct = EDIBILITY_CLASS[m["edibility"]]
            others = [v for k, v in EDIBILITY_CLASS.items() if v != correct]
            opts = [correct] + rng.sample(others, 3)
            rng.shuffle(opts)
            d = {"cultivated": 2, "wild_edible": 3, "medicinal": 3,
                 "poisonous": 3, "deadly": 2}[m["edibility"]]
            if m["edibility"] in ("poisonous", "deadly") and has_look:
                d = 4
            qs.append({
                "id": "q_%s_edib" % sid, "type": "edibility_class", "entityId": sid,
                "difficulty": d,
                "q": "资料记载中，%s（%s）属于以下哪一类？" % (m["name"], m["latin"]),
                "options": opts, "answerIndex": opts.index(correct),
                "explanation": m.get("edibilityNote") or DISCLAIMER,
                "disclaimer": True,
            })

        # --- feature: spore print, d3-d5 --------------------------------
        if m.get("sporePrint") in SPORE_LABEL:
            correct = SPORE_LABEL[m["sporePrint"]]
            others = [v for v in SPORE_LABEL.values() if v != correct]
            opts = [correct] + rng.sample(others, 3)
            rng.shuffle(opts)
            qs.append({
                "id": "q_%s_spore" % sid, "type": "feature", "subtype": "spore_print",
                "entityId": sid, "difficulty": 3 if rare_i < 2 else (4 if rare_i < 3 else 5),
                "q": "%s的孢子印是什么颜色？" % m["name"],
                "options": opts, "answerIndex": opts.index(correct),
                "explanation": "孢子印颜色是区分近似种最可靠的特征之一，做法是把菌盖扣在纸上静置数小时。",
            })

        # --- feature: substrate, d2-d3 ----------------------------------
        if m.get("substrate") in SUBSTRATE_LABEL:
            correct = SUBSTRATE_LABEL[m["substrate"]]
            others = [v for v in SUBSTRATE_LABEL.values() if v != correct]
            opts = [correct] + rng.sample(others, 3)
            rng.shuffle(opts)
            qs.append({
                "id": "q_%s_subst" % sid, "type": "feature", "subtype": "substrate",
                "entityId": sid, "difficulty": 2 if rare_i < 2 else 3,
                "q": "%s通常长在哪里？" % m["name"],
                "options": opts, "answerIndex": opts.index(correct),
                "explanation": "基质常常是区分外形相近物种的关键，而这恰恰是照片里看不出来的信息。",
            })

        # --- feature: hymenium, d2-d4 -----------------------------------
        if m.get("hymenium") in HYMENIUM_LABEL:
            correct = HYMENIUM_LABEL[m["hymenium"]]
            others = [v for v in HYMENIUM_LABEL.values() if v != correct]
            opts = [correct] + rng.sample(others, 3)
            rng.shuffle(opts)
            qs.append({
                "id": "q_%s_hymen" % sid, "type": "feature", "subtype": "morphology",
                "entityId": sid, "difficulty": 2 if rare_i < 1 else (3 if rare_i < 3 else 4),
                "q": "%s的孢子长在什么结构上？" % m["name"],
                "options": opts, "answerIndex": opts.index(correct),
                "explanation": "菌褶、菌管、菌齿、棱脊是四类常见的子实层，先看这一点能把范围缩小很多。",
            })

        # --- feature: season, d2-d3 -------------------------------------
        sb = season_bucket(m.get("season"))
        if sb:
            correct = SEASON_LABEL[sb]
            others = [v for v in SEASON_LABEL.values() if v != correct]
            opts = [correct] + rng.sample(others, 3)
            rng.shuffle(opts)
            qs.append({
                "id": "q_%s_season" % sid, "type": "feature", "subtype": "season",
                "entityId": sid, "difficulty": 2 if rare_i < 2 else 3,
                "q": "%s主要出现在什么季节？" % m["name"],
                "options": opts, "answerIndex": opts.index(correct),
            })

        # --- lookalike, d3-d5 -------------------------------------------
        looks = [by_id[i] for i in m.get("lookalikes", []) if i in by_id]
        if looks:
            correct = looks[0]
            others = pick_distractors(
                m, [s for s in species if s["id"] not in
                    {correct["id"], m["id"]} | set(m.get("lookalikes", []))],
                lambda x: x["name"], 3, rng, prefer_lookalikes=False)
            opts = [correct] + others
            rng.shuffle(opts)
            risky = correct["edibility"] in ("poisonous", "deadly")
            qs.append({
                "id": "q_%s_look" % sid, "type": "lookalike", "entityId": sid,
                "difficulty": 3 if rare_i < 2 else (4 if rare_i < 3 else 5),
                "q": "%s最容易与下面哪一种混淆？" % m["name"],
                "options": [o["name"] for o in opts], "answerIndex": opts.index(correct),
                "explanation": ("两者外观相近，%s的记载是%s。外形相似的物种往往需要显微或分子手段才能确认，"
                                "不要凭肉眼下结论。" % (correct["name"],
                                                 EDIBILITY_CLASS.get(correct["edibility"], "食性不明"))
                                ) if risky else "外形相近的物种常常分属不同的科，需要看孢子印、基质等特征才能区分。",
            })
    return qs


def main():
    species = json.load(open(SPECIES, encoding="utf-8"))
    curated = json.load(open(CURATED, encoding="utf-8"))
    generated = build_questions(species)
    questions = generated + curated

    # attach question ids back onto each species
    by_entity = {}
    for q in questions:
        if q.get("entityId"):
            by_entity.setdefault(q["entityId"], []).append(q["id"])
    for m in species:
        m["questions"] = by_entity.get(m["id"], [])

    js = ["// GENERATED by tools/build_data.py — do not edit by hand.",
          "// Source of truth: data/mushrooms.json, data/questions_curated.json",
          "var MUSHROOM_DATA = %s;" % json.dumps(species, ensure_ascii=False, separators=(",", ":")),
          "var QUESTIONS = %s;" % json.dumps(questions, ensure_ascii=False, separators=(",", ":")),
          ""]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write("\n".join(js))

    from collections import Counter
    print("species  : %d" % len(species))
    print("questions: %d generated + %d curated = %d"
          % (len(generated), len(curated), len(questions)))
    for t, n in sorted(Counter(q["type"] for q in questions).items()):
        print("  %-16s %4d" % (t, n))
    print("wrote %s (%.0f KB)" % (OUT, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
