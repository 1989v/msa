"""판정 보조 — 후보를 사람이 훑기 좋은 표로 낸다 (P0-2).

`judgments.yml` 의 후보 550건을 그대로 읽으면 어느 것이 어느 모델에서 왔는지, BM25 와 벡터가 무엇을 다르게 봤는지가 안 보인다.
질의별로 한 화면에 모아 **판정할 것만** 남긴다. grade 는 만들지 않는다.

  python -m embed.review sheet --judgments judgments.yml --out review.md [--queries 궁궐,한옥] [--only-ungraded]
  python -m embed.review stats --judgments judgments.yml
"""
from __future__ import annotations

import argparse
from collections import Counter

import yaml

CORE = ["궁궐", "한옥", "바다가 보이는 곳", "아이와 갈만한 곳", "조용한 사찰", "야경 명소",
        "일출 명소", "실내 놀거리", "palace in seoul", "kids friendly place"]


def load(path: str) -> dict:
    return yaml.safe_load(open(path, encoding="utf-8"))


def rows(query: dict) -> list[dict]:
    """BM25 후보와 벡터 후보를 한 목록으로. 같은 문서가 양쪽에 있으면 출처를 합친다."""
    merged: dict[str, dict] = {}
    for rank, c in enumerate(query.get("candidates", []), start=1):
        merged[str(c["id"])] = {"id": str(c["id"]), "title": c["title"], "category": c.get("category") or "",
                                "address": (c.get("address") or "")[:20], "from": [f"bm25#{rank}"], "grade": c.get("grade")}
    for c in query.get("vector_candidates", []):
        key = str(c["id"])
        src = [f"vec:{m}" for m in c.get("models", [])]
        if key in merged:
            merged[key]["from"] += src
        else:
            merged[key] = {"id": key, "title": c["title"], "category": c.get("category") or "",
                           "address": (c.get("address") or "")[:20], "from": src, "grade": c.get("grade")}
    return list(merged.values())


def sheet(doc: dict, queries: list[str] | None, only_ungraded: bool) -> str:
    out = ["# 판정 시트 — grade 를 3(정확) / 2(관련) / 1(약함) / 0(무관) 으로 적는다",
           "",
           "> 빠르게 하려면 **3 과 0 만** 써도 된다. 판정하지 않은 질의는 평가에서 빠진다(자동 정답 없음).",
           "> `from` 은 그 문서를 어디서 찾았는지다 — `bm25#n` 은 현재 검색의 n위, `vec:모델` 은 그 모델의 벡터 상위 10.",
           ""]
    for q in doc["queries"]:
        if queries and q["query"] not in queries:
            continue
        rs = rows(q)
        if only_ungraded:
            rs = [r for r in rs if r["grade"] is None]
        if not rs:
            continue
        out += [f"## {q['query']}  `{q.get('lang','ko')}`", "", f"의도: {q.get('intent','')}", "",
                "| grade | 제목 | 분류 | 주소 | 찾은 곳 |", "|---|---|---|---|---|"]
        for r in sorted(rs, key=lambda x: (0 if any(f.startswith("bm25") for f in x["from"]) else 1, x["title"])):
            g = "" if r["grade"] is None else str(r["grade"])
            out.append(f"| {g} | {r['title']} | {r['category']} | {r['address']} | {' '.join(r['from'])} |")
        out.append("")
    return "\n".join(out)


def stats(doc: dict) -> str:
    qs = doc["queries"]
    bm = sum(len(q.get("candidates", [])) for q in qs)
    vc = sum(len(q.get("vector_candidates", [])) for q in qs)
    graded = sum(1 for q in qs for c in q.get("candidates", []) + q.get("vector_candidates", []) if c.get("grade") is not None)
    per_model = Counter(m for q in qs for c in q.get("vector_candidates", []) for m in c.get("models", []))
    judged_q = sum(1 for q in qs if any(c.get("grade") is not None for c in q.get("candidates", []) + q.get("vector_candidates", [])))
    lines = [f"질의 {len(qs)}개 · 후보 {bm + vc}건 (BM25 {bm} + 벡터 {vc}) · 판정됨 {graded}건 / 판정된 질의 {judged_q}개",
             "모델별 벡터 후보 기여: " + (", ".join(f"{k} {v}" for k, v in per_model.most_common()) or "(없음)")]
    overlap = [len({str(c["id"]) for c in q.get("candidates", [])} &
                   {str(c["id"]) for c in q.get("vector_candidates", [])}) for q in qs]
    lines.append(f"질의당 BM25∩벡터 겹침 평균 {sum(overlap)/max(len(overlap),1):.1f}건 — 겹침이 작을수록 벡터가 새로 찾은 것이 많다")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sheet"); s.add_argument("--judgments", required=True); s.add_argument("--out", required=True)
    s.add_argument("--queries", help="쉼표 구분. 'core' 면 핵심 10질의")
    s.add_argument("--only-ungraded", action="store_true")
    t = sub.add_parser("stats"); t.add_argument("--judgments", required=True)
    a = ap.parse_args()
    doc = load(a.judgments)
    if a.cmd == "stats":
        print(stats(doc)); return
    qs = CORE if a.queries == "core" else (a.queries.split(",") if a.queries else None)
    open(a.out, "w", encoding="utf-8").write(sheet(doc, qs, a.only_ungraded))
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
