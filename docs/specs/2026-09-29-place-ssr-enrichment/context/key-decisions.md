# Key Decisions

- **반려동물은 세 값** (TG1): 운영 `petAcmpyType` 원문은 `전구역 동반가능`·`일부구역 동반가능` 두 가지뿐이고 「불가」가 없다. `chkpet` 계열은 4만 4천 건 중 3건만 채워져 원천으로 쓰지 않는다.
- **요금은 접힌 `useFee` 만** (TG1): introRaw `usefeeleports` 를 읽지 않는다 — 유형별 키 매핑을 세 번째로 복사하지 않는다는 스펙 원칙. 표본에서 이로 빠지는 「무료」는 ko 1건 · en 3건.
- **chk `없음` → 불가는 가정** (TG1): 관광지(12) `chkcreditcard` 가 `없음` 99 · `가능` 22 라 「정보 없음」일 수 있다. T7 라벨 측정으로 판정한다. 필터는 긍정 값만 받으므로 틀려도 영향은 배지·건수.
- **보수적 해석** (TG1): `※`·`*` 뒤 덧붙임은 버림, 괄호 조건이 붙은 휴무는 전체 UNKNOWN, 유형 없는 문서는 지역 집계 제외.
- **분류 이름 원천** (TG2): place `/api/places/attractions/category-codes?lang=` (TourAPI 코드표, sync_lcls_codes.py). 회차당 언어별 한 번.
- **attributes·region null = 옛 색인 문서** (TG2): 「모두 UNKNOWN」과 구분한다.
- **발견(미수정)**: `fetchSidoNames` 가 영문 문서에도 국문 이름을 넣어 영문 `sidoName` 이 한글이다.
- **`X-Render: shell-fallback`** (TG3): 색인 조회 실패로 셸을 낸 응답은 `ssr` 이 아니다 — 운영 확인이 실패를 성공으로 세지 않게.
- **openingHoursSpecification 은 요일만** (TG3): ALWAYS_OPEN·NO_WEEKLY 는 7일, WEEKLY 는 휴무 제외, UNKNOWN·옛 문서는 생략. 시각은 싣지 않는다.
- **서버 본문에 반경 주변·편의시설은 없음** (TG3): 관광지당 조회 한 번 규칙. 화면이 그린다.
- **유형 라벨 표 출처** (TG3): portal-fe 에 표가 없어 place-ingest `sync_tour.py` CONTENT_TYPES + TourAPI 코드표.
- **상세 응답에 속성(색인 표기)·지역(단건만)** (TG3): 하이드레이션이 서버 JSON-LD 를 다시 쓰므로 화면도 같은 값을 받아야 한다.
- **place 목록 키셋 페이징** (TG2 수정): `afterId` 선택 파라미터 · `nextAfterId` · 키셋 응답의 합계 필드는 -1(기존 non-null 호출자 호환). OFFSET 경로는 파이썬 호출자(place/ingest·tools/embed)용으로 남긴다.
- **배포 순서**: place(content) 가 search-batch 보다 먼저 떠야 한다. 옛 place 는 afterId 를 몰라 첫 100건만 주고, 배치는 별칭 교체 검사(라이브의 90%)에 걸려 실패한다(사용자 영향 없음).
- **예전 재색인 소요는 9분 34초~12분**(에이전트 보고 「2분대」는 틀림). 실측으로만 판단한다.
