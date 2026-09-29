# Key Decisions

- **반려동물은 세 값** (TG1): 운영 `petAcmpyType` 원문은 `전구역 동반가능`·`일부구역 동반가능` 두 가지뿐이고 「불가」가 없다. `chkpet` 계열은 4만 4천 건 중 3건만 채워져 원천으로 쓰지 않는다.
- **요금은 접힌 `useFee` 만** (TG1): introRaw `usefeeleports` 를 읽지 않는다 — 유형별 키 매핑을 세 번째로 복사하지 않는다는 스펙 원칙. 표본에서 이로 빠지는 「무료」는 ko 1건 · en 3건.
- **chk `없음` → 불가는 가정** (TG1): 관광지(12) `chkcreditcard` 가 `없음` 99 · `가능` 22 라 「정보 없음」일 수 있다. T7 라벨 측정으로 판정한다. 필터는 긍정 값만 받으므로 틀려도 영향은 배지·건수.
- **보수적 해석** (TG1): `※`·`*` 뒤 덧붙임은 버림, 괄호 조건이 붙은 휴무는 전체 UNKNOWN, 유형 없는 문서는 지역 집계 제외.
- **분류 이름 원천** (TG2): place `/api/places/attractions/category-codes?lang=` (TourAPI 코드표, sync_lcls_codes.py). 회차당 언어별 한 번.
- **attributes·region null = 옛 색인 문서** (TG2): 「모두 UNKNOWN」과 구분한다.
- **발견(미수정)**: `fetchSidoNames` 가 영문 문서에도 국문 이름을 넣어 영문 `sidoName` 이 한글이다.
