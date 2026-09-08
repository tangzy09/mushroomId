"""drop_species.py — 从数据里整体移除若干物种（2026-09-08 用于去掉 15 个无照片种）

    python tools/drop_species.py id1,id2,...   [--dry]

做的事：
  1. data/mushrooms.json 删掉这些条目
  2. 其余条目的 lookalikes / lookalikeNotes 里去掉指向它们的引用
  3. data/questions_curated.json 里 entityId 指向它们的题一并删
  4. 打印每一步的计数；--dry 只打印不写
之后必须重跑 tools/build_data.py 与 test/check_data.py。
"""
import json, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SP = os.path.join(ROOT, 'data', 'mushrooms.json')
QC = os.path.join(ROOT, 'data', 'questions_curated.json')


def main():
    if len(sys.argv) < 2:
        print(__doc__); return 2
    ids = set(x for x in sys.argv[1].split(',') if x)
    dry = '--dry' in sys.argv
    sp = json.load(open(SP, encoding='utf-8'))
    have = {m['id'] for m in sp}
    missing = ids - have
    if missing:
        print('unknown ids:', sorted(missing)); return 2
    kept = [m for m in sp if m['id'] not in ids]
    refs = notes = 0
    for m in kept:
        la = m.get('lookalikes') or []
        nl = [x for x in la if x not in ids]
        refs += len(la) - len(nl)
        m['lookalikes'] = nl
        ln = m.get('lookalikeNotes') or {}
        for k in list(ln):
            if k in ids:
                del ln[k]; notes += 1
    qc = json.load(open(QC, encoding='utf-8'))
    qk = [q for q in qc if q.get('entityId') not in ids]
    print('species %d -> %d (dropped %d)' % (len(sp), len(kept), len(sp) - len(kept)))
    print('lookalike refs removed %d, lookalikeNotes removed %d' % (refs, notes))
    print('curated questions %d -> %d' % (len(qc), len(qk)))
    if dry:
        return 0
    json.dump(kept, open(SP, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    json.dump(qk, open(QC, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    # 读回校验
    back = json.load(open(SP, encoding='utf-8'))
    assert len(back) == len(kept) and not ({m['id'] for m in back} & ids)
    for m in back:
        assert not (set(m.get('lookalikes') or []) & ids)
        assert not (set((m.get('lookalikeNotes') or {}).keys()) & ids)
    print('written and verified')
    return 0


if __name__ == '__main__':
    sys.exit(main())
