"""운영용 관광지 LTR 모델을 학습해 search:app 리소스로 내보낸다.

학습 설정은 사람 블라인드 비교를 받은 모델(pairs.py)과 같다 — 등급 상한 3, label_gain [0,1,3,7], 트리 200.
다른 점은 겹을 나누지 않고 판정 세트 전체로 한 번 학습한다는 것뿐이다. 같은 설정의 5겹 교차검증 nDCG@10 도 함께 낸다.

  uv run --with lightgbm --with numpy python export.py rows.json judgments.json <모델.json> <대조.json>

<모델.json> 은 LightGBM dump_model 의 트리에서 평가에 쓰는 키만 남기고 피처 이름표를 더한 것이고, 서버의 트리 평가기가 읽는다.
<대조.json> 은 학습 행 일부의 피처 벡터와 LightGBM 이 낸 점수다 — 서버 평가기가 같은 점수를 내는지 테스트가 본다.
"""
import json, math, random, sys
import numpy as np
import lightgbm as lgb

rows_path, judg_path, model_path, parity_path = sys.argv[1:5]
rows = json.load(open(rows_path))
judg = {(j["query"], j["lang"]): j["grades"] for j in json.load(open(judg_path))}
CATS = sorted({r["category"] for r in rows})
TYPES = sorted({r["content_type"] for r in rows})
NUM = ["c_rank", "a_rank", "b_rank", "bm_title", "bm_overview", "bm_address", "bm_all", "phrase_title", "knn",
       "title_len", "overview_len", "title_has_query"]
NAMES = NUM + [f"cat={c}" for c in CATS] + [f"type={t}" for t in TYPES] + ["setting=indoor", "lang=en"]


def vec(r):
    return [float(r[k]) for k in NUM] + [float(r["category"] == c) for c in CATS] + \
        [float(r["content_type"] == t) for t in TYPES] + [float(r["setting"] == "indoor"), float(r["lang"] == "en")]


def ranker(seed):
    return lgb.LGBMRanker(objective="lambdarank", n_estimators=200, learning_rate=0.05, num_leaves=15,
                          min_child_samples=10, subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
                          label_gain=[0, 1, 3, 7], verbose=-1, random_state=seed)


def matrix(qs):
    X, y, g = [], [], []
    for q in qs:
        rs = sorted(by[q], key=lambda r: r["c_rank"])
        X += [vec(r) for r in rs]; y += [min(3, judg[q].get(r["doc"], 0)) for r in rs]; g.append(len(rs))
    return np.array(X), np.array(y), g


def ndcg(ranked, grades, k=10):
    dcg = sum((2 ** grades.get(d, 0) - 1) / math.log2(i + 2) for i, d in enumerate(ranked[:k]))
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else None


by = {}
for r in rows:
    by.setdefault((r["query"], r["lang"]), []).append(r)
qs = sorted(q for q in by if q in judg)

# 5겹 교차검증 — 학습에 쓴 질의로 시험하지 않는다
order = qs[:]; random.Random(42).shuffle(order); folds = [order[i::5] for i in range(5)]
cv = {"ko": [], "en": []}
for f, test in enumerate(folds):
    X, y, g = matrix([q for q in qs if q not in set(test)])
    m = ranker(f); m.fit(X, y, group=g)
    for q in test:
        rs = sorted(by[q], key=lambda r: r["c_rank"])
        s = m.predict(np.array([vec(r) for r in rs]))
        c, l = ndcg([r["doc"] for r in rs], judg[q]), ndcg([rs[i]["doc"] for i in np.argsort(-s, kind="stable")], judg[q])
        if c is not None: cv[q[1]].append((c, l))
for lang, v in cv.items():
    c = np.array([a for a, _ in v]); l = np.array([b for _, b in v]); d = l - c
    print(f"5겹 {lang}: 질의 {len(v)} C {c.mean():.4f} LTR {l.mean():.4f} 차 {d.mean():+.4f} ±{1.96 * d.std(ddof=1) / math.sqrt(len(d)):.4f}")

X, y, g = matrix(qs)
model = ranker(0); model.fit(X, y, group=g)
KEEP = {"split_feature", "threshold", "decision_type", "default_left", "missing_type", "left_child", "right_child", "leaf_value"}


def prune(node):
    """평가에 쓰는 키만 남긴다 — 분할 이득·표본 수 같은 학습 기록이 파일의 2/3 다."""
    return {k: prune(v) if isinstance(v, dict) else v for k, v in node.items() if k in KEEP}


raw_dump = model.booster_.dump_model()
dump = {"objective": raw_dump["objective"], "feature_names": NAMES,
        "trees": [prune(t["tree_structure"]) for t in raw_dump["tree_info"]]}
json.dump(dump, open(model_path, "w"), ensure_ascii=False, separators=(",", ":"))
print("모델", model_path, "트리", len(dump["trees"]), "피처", len(NAMES), "질의", len(qs), "행", len(X))

idx = random.Random(7).sample(range(len(X)), 60)
raw = model.booster_.predict(X[idx], raw_score=True)
json.dump({"feature_names": NAMES, "cases": [{"x": X[i].tolist(), "score": float(s)} for i, s in zip(idx, raw)]},
          open(parity_path, "w"), ensure_ascii=False, separators=(",", ":"))
print("대조", parity_path, len(idx))
