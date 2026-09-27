"""실내·실외 값을 place_db.attractions.setting 에 쓰는 SQL 을 만든다.

  python3 apply.py rules            # 분류 규칙 — 규칙이 정하는 행은 늘 규칙값으로 (규칙을 고치면 다시 돌린다)
  python3 apply.py llm <판정.csv>   # LLM 판정 — 규칙이 정하지 않는 국문 행만, 값마다 한 문장

출력한 문장을 oci-mysql 로 넣는다:  ~/.local/bin/oci-mysql --write place_db "$(python3 apply.py rules)"
"""
import csv, sys

from rules import INDOOR, OUTDOOR


def like_any(prefixes):
    return " OR ".join(f"lcls_systm3 LIKE '{p}%'" for p in sorted(prefixes))


def rules_sql():
    # 긴 접두가 이기도록 실내를 먼저 본다 — 두 목록은 접두가 겹치지 않게 짜여 있다(rules.py)
    return (f"UPDATE attractions SET setting = CASE WHEN {like_any(INDOOR)} THEN 'indoor' ELSE 'outdoor' END "
            f"WHERE {like_any(INDOOR)} OR {like_any(OUTDOOR)}")


def llm_sql(path):
    by_value = {}
    for row in csv.DictReader(open(path, encoding="utf-8")):
        if row["setting"] in ("indoor", "outdoor", "mixed"):
            by_value.setdefault(row["setting"], []).append(row["content_id"])
    rule_rows = f"({like_any(INDOOR)} OR {like_any(OUTDOOR)})"
    return ";\n".join(
        f"UPDATE attractions SET setting = '{v}' WHERE lang = 'ko' AND NOT {rule_rows} "
        f"AND content_id IN ({','.join(repr(c) for c in sorted(ids))})"
        for v, ids in sorted(by_value.items())
    )


if __name__ == "__main__":
    print(rules_sql() if sys.argv[1] == "rules" else llm_sql(sys.argv[2]))
