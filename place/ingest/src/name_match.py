"""원천 관광지 이름 + 시군구 → 우리 관광지 행. 집중률(`congestion`)과 연관 관광지가 같이 쓴다.

두 원천(한국관광공사 빅데이터 `TatsCnctrRateService` · `TarRlteTarService1`)은 TourAPI contentId 를 주지 않는다 —
이름(`tAtsNm`)과 법정동 시군구 코드(`signguCd`)뿐이다. 같은 시군구의 국문 행 제목과 아래 순서로 견준다:

  ① 정확 — 제목이 글자 그대로 같다
  ② 정규화 — 괄호 안 · 공백 · 구두점을 지운 두 이름이 같다
  ③ 포함 — 정규화한 두 이름 중 한쪽이 다른 쪽을 품고, 짧은 쪽이 3자 이상

단계마다 후보(서로 다른 관광지 id)가 하나일 때만 잇는다. 둘 이상이면 같은 장소의 중복 등록인지 먼저 가린다 —
원천(TourAPI)이 한 장소를 관광지와 쇼핑으로 따로 올리거나(부산타워 12 · 38), 같은 유형으로 두 번 올린 곳이 있다(익선동 한옥거리).
  ⓐ 쇼핑·음식점·행사·숙박이 아닌 후보가 하나만 남으면 그것 — 원천 이름은 관광지 집중률·이동 기반이라 관광 쪽이 맞다
  ⓑ 남은 후보가 모두 같은 유형이면 개요가 가장 긴 하나 — 두 번 올라온 같은 곳 중 내용이 많은 쪽
그래도 가려지지 않으면 `AMBIGUOUS` 로 멈춘다 — 다음 단계로 넘어가 엉뚱한 하나를 고르지 않는다. 정확 단계를 먼저 하는 이유: 「열안지오름(봉개동)」·「열안지오름(오라동)」은
정규화하면 같은 이름이 되지만 정확 단계에서 각자 자기 행에 붙는다.

실측(2026-10-02, 종로구 · 제주시 · 해운대구 376곳): 정확 284 · 정규화까지 306 · 포함 21(+모호 5) · 못 맞춤 44.
③ 은 정밀도가 확인되기 전에는 화면에 쓰지 않는다(Q-P2-MATCH) — 여기서는 결과를 그대로 내고, 무엇을 쓸지는 place 가 정한다.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable

#: 관광지 id 를 잇는 방법. 나머지(`AMBIGUOUS` · `NONE`)는 id 가 없다.
LINKED = ("EXACT", "NORMALIZED", "CONTAINS")
#: 포함 단계의 짧은 쪽 최소 글자 수 — 2자(「우도」 등)는 너무 많은 이름에 들어간다.
CONTAINS_MIN = 3

# 여는 괄호부터 닫는 괄호까지(종류는 섞여도 된다). 원천·우리 제목 모두 (), [], 〈〉 등을 쓴다.
_BRACKETS = re.compile(r"[(\[{（〈<「『【][^)\]}）〉>」』】]*[)\]}）〉>」』】]")


@dataclass(frozen=True)
class Candidate:
    """같은 시군구의 우리 국문 관광지 한 행."""

    attraction_id: int
    title: str
    #: 겹친 후보를 가릴 때만 쓴다 — 없으면(옛 픽스처) 가리지 않는다
    content_type_id: str | None = None
    overview_len: int = 0


#: 원천 이름이 관광지를 가리킬 때 뒤로 미는 유형 — 쇼핑 · 음식점 · 행사 · 숙박
#: (국문 38 · 39 · 15 · 32, 영문 79 · 82 · 85 · 80). 같은 이름의 축제·숙소가 관광지와 겹쳐 올라온다(삼랑성 12 · 15).
SECONDARY_TYPES = frozenset({"38", "39", "15", "32", "79", "82", "85", "80"})


@dataclass(frozen=True)
class Match:
    """`attraction_id` 는 [LINKED] 방법일 때만 있다. `candidates` 는 그 단계에서 걸린 id 전부(오름차순) — 모호 원인을 로그로 본다."""

    attraction_id: int | None
    method: str
    candidates: tuple[int, ...]


def normalize(name: str) -> str:
    """괄호 안 · 공백 · 구두점(유니코드 P*·S*)을 지운다. 글자 크기는 바꾸지 않는다(설계 §2.1 그대로)."""
    stripped = _BRACKETS.sub("", name)
    return "".join(ch for ch in stripped if not (ch.isspace() or unicodedata.category(ch)[0] in "PS"))


def candidates_by_sigungu(rows: Iterable[dict]) -> dict[str, list[Candidate]]:
    """관광지 행(place 목록 응답) → 법정동 시군구 코드 5자리별 국문 후보. 시군구 코드가 없는 행은 넣지 않는다."""
    out: dict[str, list[Candidate]] = {}
    for row in rows:
        regn, signgu = row.get("ldongRegnCd"), row.get("ldongSignguCd")
        if row.get("lang") != "ko" or not regn or not signgu or not row.get("title"):
            continue
        out.setdefault(f"{regn}{signgu}", []).append(Candidate(
            int(row["id"]), str(row["title"]),
            content_type_id=str(row.get("contentTypeId") or "") or None,
            overview_len=len(row.get("overview") or ""),
        ))
    return out


def _settle(found: list[Candidate]) -> int | None:
    """같은 이름으로 걸린 서로 다른 행 중 하나를 고른다(위 ⓐ · ⓑ). 못 고르면 None."""
    primary = [c for c in found if c.content_type_id and c.content_type_id not in SECONDARY_TYPES]
    if len(primary) == 1 and any(c.content_type_id in SECONDARY_TYPES for c in found):
        return primary[0].attraction_id
    pool = primary or found
    types = {c.content_type_id for c in pool}
    if len(types) == 1 and None not in types:
        longest = max(c.overview_len for c in pool)
        top = [c for c in pool if c.overview_len == longest]
        if len(top) == 1 and longest > 0:
            return top[0].attraction_id
    return None


def _decide(found: list[Candidate], method: str) -> Match | None:
    by_id = {c.attraction_id: c for c in found}
    if not by_id:
        return None
    ordered = tuple(sorted(by_id))
    if len(ordered) == 1:
        return Match(ordered[0], method, ordered)
    picked = _settle(list(by_id.values()))
    return Match(picked, method, ordered) if picked is not None else Match(None, "AMBIGUOUS", ordered)


def _contains(a: str, b: str) -> bool:
    short, long_ = (a, b) if len(a) <= len(b) else (b, a)
    return len(short) >= CONTAINS_MIN and short in long_


def match(name: str, candidates: list[Candidate]) -> Match:
    """원천 이름 하나를 같은 시군구 후보에 견준다."""
    exact = _decide([c for c in candidates if c.title == name], "EXACT")
    if exact:
        return exact
    key = normalize(name)
    if not key:
        return Match(None, "NONE", ())
    keyed = [(c, normalize(c.title)) for c in candidates]
    normalized = _decide([c for c, k in keyed if k == key], "NORMALIZED")
    if normalized:
        return normalized
    contains = _decide([c for c, k in keyed if k and _contains(k, key)], "CONTAINS")
    return contains or Match(None, "NONE", ())
