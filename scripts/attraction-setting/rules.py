"""분류 코드만으로 실내·실외가 정해지는 것. 여기 없는 코드만 LLM 에 넘긴다 (색인 쪽 규칙과 같은 목록)."""
INDOOR = ["VE0701", "VE0702", "VE0703", "VE0704", "VE0705", "VE0706", "VE0601", "VE0602", "VE0901", "VE0902",
          "VE0903", "VE1201", "VE1202", "VE0204", "EX0501", "EX0502", "EX0505", "VE1002", "EX02"]
OUTDOOR = ["NA", "HS01", "HS02", "HS03", "AC05", "VE03", "VE04", "VE0203", "VE0103", "VE0104", "VE0105", "VE0106",
           "VE0107", "VE0108", "VE0109", "LS0102", "LS0103", "LS0104", "LS0105", "LS0106", "LS0107", "LS0108",
           "LS0110", "LS0111", "LS0112", "LS0113", "LS0114", "LS0115", "LS0116", "LS0117", "LS0118", "LS0201",
           "LS0202", "LS0203", "LS0204", "LS0205", "LS0206", "LS0208", "LS0209", "LS0210", "LS0211", "LS0212",
           "LS0213", "LS0214", "LS03", "EX0302", "EX0304"]


def by_rule(code):
    code = code or ""
    for p in sorted(INDOOR + OUTDOOR, key=len, reverse=True):
        if code.startswith(p):
            return "indoor" if p in INDOOR else "outdoor"
    return None
