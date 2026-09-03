"""Validate data/mushrooms.json and the generated question bank.

Run:  python3 tools/build_data.py && python3 test/check_data.py
Exits non-zero on any failure, so it can gate a commit or a deploy.

The reachability check is the one that matters most: fishId shipped with
43% of its questions unreachable because the picker config and the bank
drifted apart. Here every (type, difficulty) bucket the bank contains
must be requested by at least one difficulty setting, and every bucket a
setting requests must hold enough questions to avoid repetition.
"""
import json, os, re, sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

RARITIES = {"common", "rare", "epic", "legend"}
EDIBILITY = {"cultivated", "wild_edible", "conditional", "medicinal",
             "inedible", "unknown", "poisonous", "deadly"}
BIOMES = {"pine", "broadleaf", "deadwood", "meadow", "special"}
SUBSTRATES = {"wood", "soil", "grass", "litter", "mycorrhizal", "termite",
              "insect", "parasitic", "conifer_cone"}
HYMENIA = {"gills", "pores", "teeth", "ridges", "smooth", "gleba"}
BEHAVIORS = {"default", "puff", "glow", "bruise", "jelly", "cluster", "ink",
             "stink", "hygro", "splash", "coral", "veil", "shelf", "parasite"}
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")

# Mirror of GameConfig.quiz.levels in js/game/config.js. Kept here so the
# check can run without a JS runtime; core.test.js asserts the two agree.
LEVELS = {
    "beginner":     {"image": [1, 2], "knowledge": {"edibility_class": [2],
                                                    "trivia": [2, 3],
                                                    "myth_buster": [1, 2]}},
    "intermediate": {"image": [2, 3], "knowledge": {"feature": [2, 3],
                                                    "trivia": [3, 4],
                                                    "edibility_class": [3, 4]}},
    "expert":       {"image": [3, 4, 5], "knowledge": {"lookalike": [3, 4, 5],
                                                       "feature": [4, 5],
                                                       "cold_fact": [4, 5]}},
}
MIN_BUCKET = 20

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def check_species(species):
    ids = set()
    for m in species:
        sid = m.get("id", "<no id>")
        if sid in ids:
            err("duplicate id: %s" % sid)
        ids.add(sid)
        for f in ("name", "nameEn", "latin", "family", "rarity", "edibility",
                  "biome", "substrate", "habitat", "fact", "quote", "art"):
            if not m.get(f):
                err("%s: missing field %s" % (sid, f))
        if m.get("rarity") not in RARITIES:
            err("%s: bad rarity %r" % (sid, m.get("rarity")))
        if m.get("edibility") not in EDIBILITY:
            err("%s: bad edibility %r" % (sid, m.get("edibility")))
        if m.get("biome") not in BIOMES:
            err("%s: bad biome %r" % (sid, m.get("biome")))
        if m.get("substrate") not in SUBSTRATES:
            err("%s: bad substrate %r" % (sid, m.get("substrate")))
        if m.get("hymenium") not in HYMENIA:
            err("%s: bad hymenium %r" % (sid, m.get("hymenium")))
        if m.get("behavior", "default") not in BEHAVIORS:
            err("%s: bad behavior %r" % (sid, m.get("behavior")))
        if not isinstance(m.get("season"), list) or not m["season"]:
            err("%s: season must be a non-empty list of months" % sid)
        elif any(not isinstance(x, int) or not 1 <= x <= 12 for x in m["season"]):
            err("%s: season months out of range" % sid)
        if not isinstance(m.get("size"), (int, float)) or not 0.1 <= m["size"] <= 2.0:
            err("%s: size must be between 0.1 and 2.0" % sid)
        # latin binomial, loosely: "Genus species" possibly with extra epithets
        if not re.match(r"^[A-Z][a-z]+ [a-z-]+", m.get("latin", "")):
            err("%s: latin name does not look like a binomial: %r" % (sid, m.get("latin")))
        for k, v in (m.get("art") or {}).items():
            if isinstance(v, str) and k.endswith("Color") and v != "none" and not HEX.match(v):
                err("%s: art.%s is not a hex colour: %r" % (sid, k, v))

    # lookalikes must resolve, and must be mutual
    for m in species:
        for l in m.get("lookalikes", []):
            if l not in ids:
                err("%s: lookalike %r not in dataset" % (m["id"], l))
            elif l == m["id"]:
                err("%s: lookalike points at itself" % m["id"])
    by_id = {m["id"]: m for m in species}
    for m in species:
        for l in m.get("lookalikes", []):
            if l in by_id and m["id"] not in by_id[l].get("lookalikes", []):
                warn("%s lists %s as a lookalike but not the other way round"
                     % (m["id"], l))

    # safety: a dangerous species must never be quietly unremarkable
    for m in species:
        if m.get("edibility") in ("poisonous", "deadly"):
            if len(m.get("fact", "")) < 20:
                err("%s: %s species needs a substantive fact"
                    % (m["id"], m["edibility"]))
    return ids


BANNED = [
    (r"可以放心(吃|食用)", "绝对化的安全表述"),
    (r"保证(无毒|安全)", "绝对化的安全表述"),
    (r"[^不]一定没(毒|事)", "绝对化的安全表述"),
    (r"煮\s*\d+\s*分钟就(没事|安全|无毒)", "去毒操作指引"),
    (r"(可以|能)治疗", "功效宣称"),
    (r"抗癌", "功效宣称"),
]


def check_wording(species, questions):
    blobs = [(m["id"], " ".join(str(m.get(f, "")) for f in
                                ("fact", "quote", "habitat", "edibilityNote")))
             for m in species]
    blobs += [(q["id"], " ".join([q.get("q", ""), q.get("explanation", "")]
                                 + [str(o) for o in q.get("options", [])]))
              for q in questions]
    for ident, text in blobs:
        for pat, why in BANNED:
            if re.search(pat, text):
                err("%s: %s（匹配 /%s/）" % (ident, why, pat))


def check_questions(questions, ids):
    seen = set()
    for q in questions:
        qid = q.get("id", "<no id>")
        if qid in seen:
            err("duplicate question id: %s" % qid)
        seen.add(qid)
        if q.get("entityId") and q["entityId"] not in ids:
            err("%s: entityId %r not in dataset" % (qid, q["entityId"]))
        opts = q.get("options") or []
        if len(opts) != 4:
            err("%s: needs exactly 4 options, has %d" % (qid, len(opts)))
        if len(set(opts)) != len(opts):
            err("%s: duplicate options %r" % (qid, opts))
        ai = q.get("answerIndex")
        if not isinstance(ai, int) or not 0 <= ai < len(opts):
            err("%s: answerIndex %r out of range" % (qid, ai))
        if not isinstance(q.get("difficulty"), int) or not 1 <= q["difficulty"] <= 5:
            err("%s: difficulty must be 1-5" % qid)
        if q.get("optionsEn") and len(q["optionsEn"]) != len(opts):
            err("%s: optionsEn length differs from options" % qid)

    # every species needs at least one image question and two others
    per_entity = Counter(q["entityId"] for q in questions if q.get("entityId"))
    img = {q["entityId"] for q in questions if q["type"] == "name_from_image"}
    for sid in ids:
        if sid not in img:
            err("%s: no name_from_image question" % sid)
        if per_entity[sid] < 3:
            err("%s: only %d questions, need at least 3" % (sid, per_entity[sid]))


def check_reachability(questions):
    """No orphan buckets, and no bucket too thin to draw from."""
    bank = defaultdict(int)
    for q in questions:
        bank[(q["type"], q["difficulty"])] += 1

    requested = set()
    for level in LEVELS.values():
        for d in level["image"]:
            requested.add(("name_from_image", d))
        for t, ds in level["knowledge"].items():
            for d in ds:
                requested.add((t, d))

    for bucket, n in sorted(bank.items()):
        if bucket not in requested:
            err("orphan bucket: %s d%d holds %d questions no difficulty "
                "setting ever asks for" % (bucket[0], bucket[1], n))
    for bucket in sorted(requested):
        if bank.get(bucket, 0) == 0:
            err("empty bucket: a difficulty setting asks for %s d%d but the "
                "bank has none" % bucket)

    # Depth is what stops a player seeing the same question twice in a
    # session, and a slot draws from the whole pool a level requests, not
    # from one bucket. So the size test belongs at pool level.
    for name, level in LEVELS.items():
        img = sum(bank.get(("name_from_image", d), 0) for d in level["image"])
        know = sum(bank.get((t, d), 0)
                   for t, ds in level["knowledge"].items() for d in ds)
        if img < MIN_BUCKET:
            err("%s: image pool holds only %d questions (want >= %d)"
                % (name, img, MIN_BUCKET))
        if know < MIN_BUCKET:
            err("%s: knowledge pool holds only %d questions (want >= %d)"
                % (name, know, MIN_BUCKET))
        print("pool %-13s image %4d   knowledge %4d" % (name, img, know))
    return bank


def main():
    species = json.load(open(os.path.join(ROOT, "data/mushrooms.json"), encoding="utf-8"))
    curated = json.load(open(os.path.join(ROOT, "data/questions_curated.json"), encoding="utf-8"))
    import build_data
    questions = build_data.build_questions(species) + curated

    ids = check_species(species)
    check_questions(questions, ids)
    check_wording(species, questions)
    bank = check_reachability(questions)

    print("species  : %d" % len(species))
    print("questions: %d" % len(questions))
    print("rarity   : %s" % dict(Counter(m["rarity"] for m in species)))
    print("edibility: %s" % dict(Counter(m["edibility"] for m in species)))
    print("\nbuckets (type x difficulty):")
    for (t, d), n in sorted(bank.items()):
        print("  %-16s d%d  %4d" % (t, d, n))

    if warnings:
        print("\n%d warning(s):" % len(warnings))
        for w in warnings[:40]:
            print("  ! %s" % w)
        if len(warnings) > 40:
            print("  ... and %d more" % (len(warnings) - 40))
    if errors:
        print("\n%d ERROR(s):" % len(errors))
        for e in errors[:60]:
            print("  x %s" % e)
        if len(errors) > 60:
            print("  ... and %d more" % (len(errors) - 60))
        sys.exit(1)
    print("\nOK — no errors.")


if __name__ == "__main__":
    main()
