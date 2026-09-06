"""애매한 판정 골라내기 — LLM 초안 중 사람이 다시 봐야 할 것만 (P0-2).

872건을 다시 보라는 건 판정을 처음부터 하라는 말과 같다. **경계 등급(1·2)이면서 모델이 상위에 올린 것**만 남긴다 —
등급이 흔들리면 nDCG 가 흔들리는 것들이다. 상위에 아예 안 나오는 후보는 등급이 틀려도 결과에 영향이 없다.

  python -m embed.doubts --judgments judgments.yml --rerank rerank/ --out doubts.md [--top 5]
"""
from __future__ import annotations

import argparse
import glob
import json
from collections import defaultdict

import yaml


def load_ranks(rerank_dir: str, top: int) -> dict[tuple[str, str], dict[str, int]]:
    ranks: dict[tuple[str, str], dict[str, int]] = defaultdict(dict)
    for f in sorted(glob.glob(f"{rerank_dir}/rerank_*.json")):
        r = json.load(open(f, encoding="utf-8"))
        for q, hits in r["per_query"].items():
            for i, h in enumerate(hits[:top], start=1):
                ranks[(q, str(h["id"]))][r["model"]] = i
    return ranks


def collect(doc: dict, ranks: dict, only_llm: bool = True) -> list[dict]:
    out = []
    for q in doc["queries"]:
        for c in q.get("candidates", []) + q.get("vector_candidates", []):
            g = c.get("grade")
            if g is None or (only_llm and c.get("by") != "llm"):
                continue
            r = ranks.get((q["query"], str(c["id"])), {})
            if g in (1, 2) and r:                       # 경계 등급 + 상위 노출 = 결과를 흔든다
                out.append({"query": q["query"], "lang": q.get("lang", "ko"), "id": str(c["id"]),
                            "title": c["title"], "category": c.get("category") or "", "grade": g,
                            "ranks": r, "best": min(r.values())})
    out.sort(key=lambda x: (x["best"], -len(x["ranks"])))
    return out


def render(items: list[dict], doc: dict) -> str:
    by_q: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        by_q[it["query"]].append(it)
    intents = {q["query"]: q.get("intent", "") for q in doc["queries"]}
    L = ["# 다시 볼 판정 — LLM 초안 중 경계 등급(1·2) × 모델 상위 노출", "",
         f"전체 872건 중 **{len(items)}건**. 여기 없는 것은 등급이 바뀌어도 상위 10 에 안 나와 nDCG 가 안 흔들린다.",
         "`ranks` 는 그 문서를 상위로 올린 모델과 순위(`q8#2` = qwen3-8b 2위).", "",
         "| 질의 | 문서 | 분류 | 내 등급 | 올린 모델 |", "|---|---|---|---|---|"]
    for q in sorted(by_q, key=lambda k: -len(by_q[k])):
        for it in by_q[q]:
            rk = " ".join(f"{m.replace('qwen3-','q').replace('-270m','').replace('harrier','har')}#{r}"
                          for m, r in sorted(it["ranks"].items(), key=lambda x: x[1]))
            L.append(f"| {q} | {it['title']} `{it['id']}` | {it['category']} | **{it['grade']}** | {rk} |")
    L += ["", "## 질의별 의도(참고)", ""]
    for q in sorted(by_q, key=lambda k: -len(by_q[k])):
        L.append(f"- **{q}** — {intents.get(q,'')}")
    return "\n".join(L)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--judgments", required=True)
    ap.add_argument("--rerank", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--include-human", action="store_true")
    a = ap.parse_args()
    doc = yaml.safe_load(open(a.judgments, encoding="utf-8"))
    items = collect(doc, load_ranks(a.rerank, a.top), only_llm=not a.include_human)
    open(a.out, "w", encoding="utf-8").write(render(items, doc))
    print(f"wrote {a.out} — {len(items)}건 (상위 {a.top} 노출 × 등급 1·2)")


if __name__ == "__main__":
    main()
