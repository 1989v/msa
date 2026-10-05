"""관광지 LTR 오프라인 실험 — 라이브(C) top-20 을 LambdaMART 로 다시 정렬했을 때 nDCG@10 이 C 보다 오르는가.

쿼리 단위 5겹 교차검증: 학습에 쓴 쿼리로 시험하지 않는다. nDCG 의 이상값(ideal)은 판정 세트 전체 등급에서 —
live-eval.py 와 같은 정의라 숫자를 매일 평가와 견줄 수 있다.

  uv run --with lightgbm --with numpy python train.py rows.json judgments.json
"""
import json, math, random, sys
import numpy as np
import lightgbm as lgb

rows = json.load(open(sys.argv[1]))
judg = {(j["query"], j["lang"]): j["grades"] for j in json.load(open(sys.argv[2]))}

CATS = sorted({r["category"] for r in rows})
TYPES = sorted({r["content_type"] for r in rows})
NUM = ["c_rank", "a_rank", "b_rank", "bm_title", "bm_overview", "bm_address", "bm_all", "phrase_title", "knn",
       "title_len", "overview_len", "title_has_query"]
NAMES = NUM + [f"cat={c}" for c in CATS] + [f"type={t}" for t in TYPES] + ["setting=indoor", "lang=en"]


def vec(r):
    return [float(r[k]) for k in NUM] + [float(r["category"] == c) for c in CATS] + \
        [float(r["content_type"] == t) for t in TYPES] + [float(r["setting"] == "indoor"), float(r["lang"] == "en")]


def ndcg(ranked, grades, k=10):
    dcg = sum((2 ** grades.get(d, 0) - 1) / math.log2(i + 2) for i, d in enumerate(ranked[:k]))
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else None


by_q = {}
for r in rows:
    by_q.setdefault((r["query"], r["lang"]), []).append(r)
queries = sorted(by_q)
random.Random(42).shuffle(queries)
folds = [queries[i::5] for i in range(5)]

result = {}  # (q,lang) -> (c, ltr)
orders = {}  # (q,lang) -> (c 순서, ltr 순서)
importance = np.zeros(len(NAMES))
for f, test in enumerate(folds):
    train = [q for q in queries if q not in set(test)]
    X, y, grp = [], [], []
    for q in train:
        rs = sorted(by_q[q], key=lambda r: r["c_rank"])
        X += [vec(r) for r in rs]; y += [judg[q].get(r["doc"], 0) for r in rs]; grp.append(len(rs))
    model = lgb.LGBMRanker(objective="lambdarank", n_estimators=200, learning_rate=0.05, num_leaves=15,
                           min_child_samples=10, subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
                           label_gain=[0, 1, 3, 7], verbose=-1, random_state=f)
    model.fit(np.array(X), np.array(y), group=grp)
    importance += model.booster_.feature_importance(importance_type="gain")
    for q in test:
        rs = sorted(by_q[q], key=lambda r: r["c_rank"])
        s = model.predict(np.array([vec(r) for r in rs]))
        order = [rs[i]["doc"] for i in np.argsort(-s, kind="stable")]
        result[q] = (ndcg([r["doc"] for r in rs], judg[q]), ndcg(order, judg[q]))
        orders[q] = ([r["doc"] for r in rs], order)


def summary(lang):
    v = [x for q, x in result.items() if q[1] == lang and x[0] is not None]
    c = sum(a for a, _ in v) / len(v); l = sum(b for _, b in v) / len(v)
    up = sum(1 for a, b in v if b > a + 1e-9); down = sum(1 for a, b in v if b < a - 1e-9)
    # 쿼리 단위 차이의 표준오차 — 평균 차가 이보다 작으면 우연과 구별이 안 된다
    d = [b - a for a, b in v]; se = np.std(d, ddof=1) / math.sqrt(len(d))
    return f"{lang}: C {c:.4f} → LTR {l:.4f} ({l - c:+.4f}, 표준오차 ±{se:.4f}) · 오름 {up} · 내림 {down} · 쿼리 {len(v)}"


print(summary("ko")); print(summary("en"))
top = np.argsort(-importance)[:12]
print("피처 중요도(gain) 상위:", ", ".join(f"{NAMES[i]} {importance[i] / importance.sum():.0%}" for i in top))
worst = sorted(result.items(), key=lambda kv: kv[1][1] - kv[1][0])[:6]
print("가장 내린 쿼리:", "; ".join(f"{q[0]}({q[1]}) {a:.2f}→{b:.2f}" for q, (a, b) in worst))
best = sorted(result.items(), key=lambda kv: kv[1][0] - kv[1][1])[:6]
print("가장 올린 쿼리:", "; ".join(f"{q[0]}({q[1]}) {a:.2f}→{b:.2f}" for q, (a, b) in best))


# ── 라벨 출처 점검: Sonnet 이 매기지 않은 등급만으로 같은 재정렬을 잰다 ──
# 학습·시험 라벨이 같은 채점기면 모델이 채점기의 습관을 배운 것일 수 있다.
old = {(j["query"], j["lang"]): j["grades"] for j in json.load(open(sys.argv[3]))}
for lang in ("ko", "en"):
    v = [(ndcg(orders[q][0], old[q]), ndcg(orders[q][1], old[q])) for q in orders if q in old and q[1] == lang]
    v = [x for x in v if x[0] is not None]
    d = [b - a for a, b in v]; se = np.std(d, ddof=1) / math.sqrt(len(d))
    print(f"[옛 세트 등급만] {lang}: C {sum(a for a,_ in v)/len(v):.4f} → LTR {sum(b for _,b in v)/len(v):.4f} ({sum(d)/len(d):+.4f}, ±{se:.4f}) · 쿼리 {len(v)}")

# 사람 100건: 같은 쿼리 안에서 사람 등급이 다른 두 문서의 순서를 LTR 이 C 보다 더 맞히는가
human = json.load(open(sys.argv[4]))
hq = {}
for h in human: hq.setdefault((h["q"], h["l"]), {})[h["doc"]] = h["g"]
agree = {"C": 0, "LTR": 0}; pairs = 0
for q, g in hq.items():
    if q not in orders: continue
    for name, order in (("C", orders[q][0]), ("LTR", orders[q][1])):
        pos = {d: i for i, d in enumerate(order)}
        docs = [d for d in g if d in pos]
        for i in range(len(docs)):
            for j in range(i + 1, len(docs)):
                a, b = docs[i], docs[j]
                if g[a] == g[b]: continue
                if name == "C": pairs += 1
                better = a if g[a] > g[b] else b; worse = b if better == a else a
                agree[name] += pos[better] < pos[worse]
print(f"[사람 등급 쌍 순서 맞힘] 쌍 {pairs} · C {agree['C']} · LTR {agree['LTR']}")
