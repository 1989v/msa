"""Google Places Text Search(New) 커넥터 — place_id 만 받는다 (data-sources.md §7).

구글맵 딥링크(`query_place_id=`)에 쓸 id 하나가 목적이라 fieldMask 를 `places.id` 로
고정한다 — **ID-only 는 Essentials(무과금) SKU 다.** 다른 필드를 실수로 넣는 순간
Pro SKU 로 과금이 시작되므로, 마스크는 상수로 못 박고 스모크가 지킨다.

**저장도 id 뿐이다.** Google Places 정책이 무기한 저장을 허용하는 유일한 필드가
place_id 다. 이름·주소·평점은 응답에 있어도 받지 않고(마스크), 남기지 않는다.
"""
from __future__ import annotations

import json
import urllib.request

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
# 이 마스크가 무과금(Essentials)의 경계다 — places.id 외에는 절대 넣지 않는다.
FIELD_MASK = "places.id"


def find_place_id(api_key: str, title: str, address: str | None, lang: str) -> str | None:
    """표시명(+주소)으로 장소 하나를 찾아 place_id 를 돌려준다. 없으면 None.

    질의는 `"{표시명} {주소}"` — 이름만으로는 동명이소(전국의 '향교')가 엉뚱한 장소로
    붙는다. 주소가 없는 행만 이름 단독으로 묻는다.
    """
    query = f"{title} {address}" if address else title
    body = json.dumps(
        {"textQuery": query, "languageCode": lang, "pageSize": 1},
        ensure_ascii=False,
    ).encode()
    req = urllib.request.Request(
        SEARCH_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": FIELD_MASK,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        payload = json.loads(r.read().decode())
    places = payload.get("places") or []
    place_id = ((places[0] if places else {}).get("id") or "").strip()
    return place_id or None
