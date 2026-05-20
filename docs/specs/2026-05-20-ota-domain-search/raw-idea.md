<!-- source: search -->
# Raw Idea — OTA 도메인 검색 (Region / Attraction / Synonyms / Package)

## 배경

사용자 (gideok.kwon) 의 운영 경험은 MyRealTrip — OTA(Online Travel Agency) 도메인. 본 commerce 레포에 작성된 ADR-0050 의 일반화된 ranking/MAB 인프라 위에, OTA 특화 도메인을 별도 spec 으로 분리해서 다룬다.

원 요청 (2026-05-19, ADR-0050 작성 시점):
- 지역별 MAB 분기
- 여행사별 다양성 정렬, 부스팅
- 패키지 검색 시 프리텍스트(자유 텍스트) 도입 여부
- 명소 기반 검색
- 도메인 특화 동의어 (예: "깜란" → "나트랑" 상품 포함)

## 현재 상태 (commerce 레포)

| 영역 | 현재 |
|---|---|
| 지역 모델 | 없음 (Product 에 categoryId 만). ADR-0050 Phase 3 의 `scope=region:{id}` 사용 불가 |
| 여행사 모델 | T1 (2026-05-20) 에서 `Product.brand` 신설. seller diversity 활용 가능 — `brand=tour-operator-id` 매핑 시 즉시 작동 |
| 패키지 모델 | 없음 (Product 는 단일 상품). 패키지=여러 상품 묶음의 모델링이 별도 필요 |
| 명소 모델 | 없음 |
| 동의어 | ES `nori` 분석기만 사용, synonyms graph 미구성 |

## 본 spec 의 목적

OTA 도메인 모델을 commerce 레포에 도입하면 본 레포가 "general commerce + OTA" 의 두 가지 정체성을 가지게 됨 → **별도 레포 후보** 가 자연스럽다. 본 spec 은 다음 둘 중 하나의 결정을 유도:

1. **OTA 별도 레포로 분리** — 본 commerce 코드를 그대로 두고, search 의 일반화된 인프라(ADR-0050) 만 차용하는 자매 레포
2. **commerce 안에 OTA 모듈 추가** — `ota/` 디렉토리 신설, region/attraction/package 도메인을 분리 모듈로

본 spec 은 결정 자체는 미루고, **두 path 의 trade-off + 4-Phase 도입 로드맵** 만 정리한다. 최종 결정은 사용자/이해관계자 협의.

## 4-Phase 로드맵 (높은 수준)

| Phase | 범위 | 사이즈 |
|---|---|---|
| OTA-1 | region 모델 + `Product.regionId` + ES 매핑 + `scope=region:{id}` MAB 활성화 | ~5md |
| OTA-2 | synonyms (깜란↔나트랑 등 도메인 동의어) ES analyzer 재구성 + 운영 가이드 | ~3md |
| OTA-3 | attraction 모델 + Product↔attraction N:M + attraction 기반 검색 (필터 → 자유 텍스트) | ~10md |
| OTA-4 | package 모델 + 패키지 프리텍스트 검색 + 패키지 ranking | ~10md+ |

총 ~30md+. **본 spec 은 OTA-1, OTA-2 만 상세 설계**. OTA-3/4 는 high-level 만.

## OTA 사용자 컨텍스트 (분석가 노트)

> 메모리: `user_recsys_experience.md` — 여행 OTA 추천 엔진 운영 경험, 알고리즘 디테일 약함.

OTA 검색의 본질적 어려움:
- **의도가 모호함** — "나트랑" 검색 시 항공/숙박/투어 모두 후보
- **시간 의존성** — 같은 query 도 출발일/여행기간에 따라 결과 다름
- **재고가 동적** — 상품 가용성 ↔ 검색 결과 연결 강함
- **도메인 동의어가 풍부** — 지명 변형 ("나트랑"="Nha Trang"="냐짱"="깜란 인근")
- **명소 ↔ 지역 ↔ 상품의 N:M:M** — 단순 categoryId 로 표현 안 됨
