# Tasks — K-관광 검색 P1

> Spec: spec.md (P1 범위). 각 그룹은 독립 커밋 단위. 그룹 내 테스트 포함(Kotest BehaviorSpec+MockK).
> **상태: P1 전체 완료 (2026-08-11)** — 운영 E2E 검증 통과 (샘플 30건, 공개 API 5종 + FE)

## TG1. place — Attraction SSOT

- [x] `:place:domain` `Attraction` (contentId+lang 자연키, 좌표 VO 재사용) + 도메인 테스트
- [x] Flyway `V..__create_attractions.sql` — UNIQUE(content_id, lang), INDEX(area_code/category)
- [x] JPA 엔티티/리포지토리 (enum STRING, jpa-persistence.md 준수)
- [x] `POST /api/places/attractions/bulk` (ADMIN, 멱등 upsert) — 청크 단위, ApiResponse
- [x] `GET /api/places/attractions` (page 스캔) + `GET .../{id}`
- [x] app 테스트 (upsert 멱등성, 페이지네이션)

## TG2. ETL — tools/seed/tour/

- [x] `sync_tour.py` — KorService2/EngService2 areaBasedList2 (+`--with-overview` detailCommon2 cap)
- [x] cat1/2/3 → 자체 카테고리 매핑 상수 + `--from-sample` 모드
- [x] `attractions.sample.jsonl` (ko 20 + en 10, 실스키마 동일) + README (키 발급·사용법)

## TG3. search — 색인 파이프라인

- [x] `attractions-index.json` (nori + english 서브필드, geo_point, popularity)
- [x] `IndexAliasManager` alias 파라미터화 (products 하드코딩 제거 — 기존 잡 회귀 없음 확인)
- [x] `AttractionApiReindexJob` + Tasklet (place 페이지 풀스캔 → alias swap) + 테스트
- [x] `k8s/base/search-batch/cronjob-attraction-reindex.yaml` — suspend, **enabled 플래그·part-of 라벨 포함**

## TG4. search — 검색 API

- [x] `AttractionDocument`/`AttractionSearchPort` (domain) + `SearchAttractionService`
- [x] `ProductSearchAdapter` 패턴의 `AttractionSearchAdapter` — keyword(bool: title/overview/addr,
      lang·areaCode·category filter) + geo_distance filter/sort + 결정적 tiebreaker
- [x] `GET /api/search/attractions` + `/{id}` 컨트롤러, ApiResponse
- [x] app 테스트 (쿼리 빌드, geo 파라미터, 빈 결과)

## TG5. portal-fe — /tour 지도 UI

- [x] 라우트 `/tour`·`/en/tour` (ADR-0062), 섹션 컴포넌트 (DESIGN.md 토큰)
- [x] Google Maps JS 로더 (빌드타임 키 env, 키 부재 시 리스트-only 폴백)
- [x] 마커 ↔ 결과 리스트 연동 (클러스터링은 실데이터 볼륨에서 도입 — 페이지당 ≤30 마커), "이 지역 재검색", "내 주변"(geolocation)
- [x] 검색바 + 카테고리 칩 + 지역 셀렉트, 상세 패널(사진/개요/구글맵 딥링크)

## TG6. 인프라·배포·E2E

- [x] NP `allow-search-batch-to-place` (04 파일 컨벤션)
- [x] place 활성화 — place_db SQL(문서 절차), oci-arm replicas 가드 제거, tier S 패치
- [x] 이미지 빌드·배포 (CI 또는 로컬 Jib 폴백) + 샘플 30건 적재 + reindex
- [x] spec P1 검증 curl 4종 + FE 확인

## TG7. 문서 동기화

- [x] CLAUDE.md place 행 갱신(활성), ADR-0065 Accepted 전환
- [x] 인계서 키 발급 목록에 TourAPI 추가, portal-fe 라우트 표 갱신
