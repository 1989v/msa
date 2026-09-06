"""nDCG@10 표 — 판정 세트로 BM25 · 벡터 · 하이브리드(RRF)를 같은 잣대로 잰다 (P0-6).

세 표를 따로 낸다. **섞으면 안 된다** —

1. **전 코퍼스**: `embed.pool` 이 44,924건 전부에서 뽑은 상위 10. BM25(운영)와 공정 비교가 되는 유일한 표.
2. **하이브리드(RRF)**: 같은 전 코퍼스 결과를 BM25 순위와 RRF 로 융합. 플랜이 실제로 하려는 것이다.
3. **후보 재순위**: 678건(BM25∪벡터 후보)에서만 줄 세운 것. 큰 모델(4B·8B)은 전 코퍼스가 불가능해 이 표에만 나온다.
   후보가 이미 걸러진 상태라 **1번 표와 숫자를 비교하면 안 된다.**

  python -m embed.evaluate --judgments judgments.yml --pool pool/ --rerank rerank/ --lang ko --out eval.md
"""
from __future__ import annotations

import argparse
import glob
import json
import math
from collections import defaultdict

import yaml

RRF_K = 60


def grades_of(q: dict) -> dict[str, int]:
    g = {}
    for c in q.get("candidates", []) + q.get("vector_candidates", []):
        if c.get("grade") is not None:
            g[str(c["id"])] = int(c["grade"])
    return g


def ndcg(ranked: list[str], grades: dict[str, int], k: int = 10) -> float | None:
    if not grades or max(grades.values()) == 0:
        return None
    dcg = sum((2 ** grades.get(d, 0) - 1) / math.log2(i + 2) for i, d in enumerate(ranked[:k]))
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else None


def rrf(*rank_lists: list[str], k: int = RRF_K) -> list[str]:
    """순위만 쓰는 융합 — 점수 척도가 다른 둘을 정규화 없이 합친다(플랜 §2.5)."""
    score: dict[str, float] = defaultdict(float)
    for lst in rank_lists:
        for i, d in enumerate(lst, start=1):
            score[d] += 1.0 / (k + i)
    return sorted(score, key=lambda d: -score[d])


def load_runs(pattern: str, lang: str) -> dict[str, dict]:
    out = {}
    for f in sorted(glob.glob(pattern)):
        r = json.load(open(f, encoding="utf-8"))
        if r.get("lang") == lang:
            out[r["model"]] = r
    return out


def mean(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 4) if xs else None


def table(rows: list[dict], cols: list[str]) -> str:
    head = "| " + " | ".join(cols) + " |\n|" + "---|" * len(cols)
    body = "\n".join("| " + " | ".join(str(r.get(c, "")) for c in cols) + " |" for r in rows)
    return head + "\n" + body


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--judgments", required=True)
    ap.add_argument("--pool"); ap.add_argument("--rerank")
    ap.add_argument("--lang", default="ko"); ap.add_argument("--out", required=True)
    ap.add_argument("--k", type=int, default=10)
    a = ap.parse_args()

    doc = yaml.safe_load(open(a.judgments, encoding="utf-8"))
    qs = [q for q in doc["queries"] if q.get("lang", "ko") == a.lang]
    G = {q["query"]: grades_of(q) for q in qs}
    BM25 = {q["query"]: [str(c["id"]) for c in q.get("candidates", [])] for q in qs}

    pools = load_runs(f"{a.pool}/pool_*.json", a.lang) if a.pool else {}
    reranks = load_runs(f"{a.rerank}/rerank_*.json", a.lang) if a.rerank else {}

    L = [f"# nDCG@{a.k} — 판정 세트 기준 ({a.lang}, 질의 {len(qs)}개)", "",
         f"판정 출처는 사람 + LLM 초안이 섞여 있다(`judgments.yml` 의 `by:`). RRF 상수 {RRF_K}.", ""]

    # 1) 전 코퍼스
    base = [n for q in qs if (n := ndcg(BM25[q["query"]], G[q["query"]], a.k)) is not None]
    rows = [{"순위 방식": "**BM25 (운영 현재)**", f"nDCG@{a.k}": mean(base), "질의": len(base), "비고": "44,924건에서 상위 10"}]
    for m, r in sorted(pools.items()):
        sc = [n for q in qs if (n := ndcg([str(h["id"]) for h in r["per_query"].get(q["query"], [])], G[q["query"]], a.k)) is not None]
        rows.append({"순위 방식": f"벡터 `{m}`", f"nDCG@{a.k}": mean(sc), "질의": len(sc), "비고": f"{r['docs']:,}건 전수 인코딩"})
    L += ["## 1. 전 코퍼스 — BM25 와 공정 비교되는 표", "", table(rows, ["순위 방식", f"nDCG@{a.k}", "질의", "비고"]), ""]

    # 2) 하이브리드
    rows = [{"순위 방식": "BM25 단독", f"nDCG@{a.k}": mean(base), "델타": "—"}]
    b = mean(base) or 0
    for m, r in sorted(pools.items()):
        sc = []
        for q in qs:
            vec = [str(h["id"]) for h in r["per_query"].get(q["query"], [])]
            n = ndcg(rrf(BM25[q["query"]], vec), G[q["query"]], a.k)
            if n is not None:
                sc.append(n)
        v = mean(sc)
        rows.append({"순위 방식": f"**하이브리드** BM25 + `{m}`", f"nDCG@{a.k}": v,
                     "델타": f"{v - b:+.4f}" if v is not None else "—"})
    L += ["## 2. 하이브리드(RRF) — 플랜이 하려는 것", "",
          "벡터 결과는 상위 10 만 저장돼 있어 그 밖은 융합에 안 들어간다(실제 구현은 `k=100`). **하한으로 읽는다.**", "",
          table(rows, ["순위 방식", f"nDCG@{a.k}", "델타"]), ""]

    # 3) 후보 재순위
    if reranks:
        rows = []
        for m, r in sorted(reranks.items(), key=lambda x: -(mean([n for q in qs if (n := ndcg([str(h["id"]) for h in x[1]["per_query"].get(q["query"], [])], G[q["query"]], a.k)) is not None]) or 0)):
            sc = [n for q in qs if (n := ndcg([str(h["id"]) for h in r["per_query"].get(q["query"], [])], G[q["query"]], a.k)) is not None]
            rows.append({"모델": f"`{m}`", f"nDCG@{a.k}": mean(sc), "인코딩": f"{r['elapsed_s']:.0f}초"})
        L += [f"## 3. 후보 재순위 — 큰 모델 포함 ({reranks[list(reranks)[0]]['docs']}건 후보 안에서)", "",
              "**1번 표와 비교 금지.** 후보가 이미 BM25∪벡터로 걸러져 있어 숫자가 높게 나온다. 모델 간 비교에만 쓴다.", "",
              table(rows, ["모델", f"nDCG@{a.k}", "인코딩"]), ""]

    # 질의별 (하이브리드 이득이 큰/작은 순)
    best = max(pools, key=lambda m: mean([n for q in qs if (n := ndcg(rrf(BM25[q["query"]], [str(h["id"]) for h in pools[m]["per_query"].get(q["query"], [])]), G[q["query"]], a.k)) is not None]) or 0) if pools else None
    if best:
        per = []
        for q in qs:
            qq = q["query"]
            b1 = ndcg(BM25[qq], G[qq], a.k)
            h1 = ndcg(rrf(BM25[qq], [str(h["id"]) for h in pools[best]["per_query"].get(qq, [])]), G[qq], a.k)
            if b1 is not None and h1 is not None:
                per.append({"질의": qq, "BM25": f"{b1:.3f}", "하이브리드": f"{h1:.3f}", "델타": f"{h1-b1:+.3f}", "_d": h1 - b1})
        per.sort(key=lambda r: -r["_d"])
        L += [f"## 4. 질의별 — BM25 vs 하이브리드(`{best}`)", "", table(per, ["질의", "BM25", "하이브리드", "델타"]), ""]

    open(a.out, "w", encoding="utf-8").write("\n".join(L))
    print(f"wrote {a.out}")
    for line in L:
        if line.startswith("|") or line.startswith("##"):
            print(line)


if __name__ == "__main__":
    main()
