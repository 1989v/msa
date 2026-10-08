# 스펙 리뷰 2라운드 — place hreflang · 피드 · IndexNow

범위: 심판 1라운드 §5(`review-verdict-round1.md:350-359`). 1라운드에서 판정한 항목은 다시 열지 않고, 이번 편집에서 새로 생긴 결함만 적는다.
근거는 전부 워크트리 `wt-impl` 에서 읽은 값이다.

| 차원 | 판정 | 새 결함 |
|---|---|---|
| implementation | REVISE | 2 |
| test-strategy | REVISE | 3 |
| architecture | REVISE | 1 |
| domain | REVISE | 1 (MINOR) |
| security | REVISE | 1 |
| usecase | REVISE | 2 |

## 부록 A 재현 (s1-8-review-pages.json)

원자료에서 #4·#15·#16·#17·#19·#21·#22·#24·#25·#26~#30 을 SR-1.2~1.4 규칙으로 다시 판정했다. 기대값은 모두 부록 A와 같다.
- #4: 13645 `titleLocal` 「고하도 해상테마파크」(`s1-8-review-pages.json:487`)는 4085 「고하도 해상테마파크」(`:557`)와 같고, 2477 「고하도 전망대」(`:3717`)와는 다르다. 간선이 하나라서 짝이다.
- #15: 같은 placeId 를 가진 국문은 22911·22869·22857·22851 넷이다. 이 중 제목이 맞는 것은 22911(`:2295`)뿐이라 짝이다.
- #16: 「아산 영인산자연휴양림 숲속야영장」(`:2383`)과 「아산 영인산자연휴양림」(`:2453`)은 제목이 달라 짝이 아니다. #17 은 76(attraction)과 28(leisure)로 유형이 달라 짝이 아니다. 그래서 15093 의 간선은 0개다.
- #25: 75 와 28 은 대응표에서 둘 다 leisure 다. 제목이 같고 거리는 약 6m 라 짝이다.
- **결함 하나(아래 T-2)**: #27 은 placeId 가 없는 쌍이 아니다. **둘 다 있는데 값이 다르다**. 기대값 「없음」은 맞고, 이유 칸만 틀렸다.

이 밖에 `RegionAggregator.distanceMeters` 가 `Int` 로 반올림한다는 점(`RegionAggregator.kt:106`)도 확인했다. 그래서 「≤ 50」의 실제 경계는 50.5m 미만이다. 합성 51m 사례는 그대로 성립한다.

---

## implementation — REVISE

체크 #4(NFR) · #5(배포·롤백)

**I-1. `optional: false` 와 envsubst 를 함께 쓰면, Secret 이 없을 때 portal-fe 가 뜨지 못한다.**
- 근거
  - `spec.md:111-112` 는 portal-fe 와 place-ingest 가 Secret 을 `optional: false` 로 읽게 정한다.
  - 운영 오버레이(oci-arm)에는 SealedSecrets 컨트롤러가 없다. `sealed` 는 `k8s/infra/prod/**`(prod-k8s) 와 README 에만 나온다.
  - 이 레포의 관례는 Secret 을 레포 밖에서 `kubectl create secret` 으로 만들고 `optional: true` 로 읽는 것이다(`place/ingest/README.md:72`, `k8s/base/place-ingest/cronjob-media.yaml:63-66`).
  - `portal-fe/Dockerfile:79` 의 envsubst 는 **정의된 변수만** 치환한다. `INDEXNOW_KEY` 가 없으면 `return 200 "${INDEXNOW_KEY}"` 가 nginx 변수 참조로 남는다. 그러면 「unknown variable」 오류로 nginx 가 기동하지 않는다.
  - nginx.conf 는 바로 이 위험을 피하려고 변수 resolver 를 쓴다(`portal-fe/nginx.conf:183-184`: 「search 가 없는 환경에서 nginx 가 안 뜨고 모든 호스트가 같이 내려간다」).
  - portal-fe 는 `replicas: 1` 이다(`k8s/base/portal-fe/deployment.yaml:10`). 새 파드가 `CreateContainerConfigError` 에 걸리면 롤아웃이 멈추고, 그 뒤의 모든 FE 배포가 막힌다. 옛 파드가 축출되면 모든 호스트가 내려간다.
  - 「꺼 둔 채 배포」가 안전하다는 전제가 여기서 깨진다.
- 수정안
  - SR-4.1 을 레포 관례로 바꾼다. Secret 은 레포 밖에서 만들고(사용자, OCI), 두 파드 모두 `optional: true` 로 읽는다. 오버레이에 SealedSecret 을 두지 않는다.
  - SR-4.2 의 키 파일 location 은 nginx.conf 본문에 두지 않는다. `/docker-entrypoint.d/` 스크립트가 `INDEXNOW_KEY` 가 `^[0-9a-f]{32}$` 일 때만 별도 conf 조각을 쓰게 한다. nginx.conf 는 그 조각을 `include …/indexnow*.conf;` 글롭으로 읽는다. 글롭은 0건이어도 오류가 나지 않는다.
  - 이렇게 하면 키가 없을 때 키 파일만 없고 nginx 는 뜬다. `NGINX_ENVSUBST_FILTER` 를 바꿀 필요도 없어진다. 바꾸게 되더라도 필터는 정규식이므로 `NGINX_LOCAL_RESOLVERS|INDEXNOW_KEY` 형태라고 적는다.
  - SR-5.3 배포 순서 맨 앞에 「Secret `place-indexnow` 생성(사용자)」을 넣는다.

**I-2. 「`/.txt` 404」 기대값은 지금 nginx 설정에서 성립하지 않는다.**
- 근거
  - `spec.md:156` 은 `/.txt` 가 404 이기를 기대한다.
  - `location = /{key}.txt` 는 정확 일치라서 `/.txt` 나 틀린 키는 `location /` 로 떨어진다. 거기서는 `try_files $uri /index.html` 이 SPA 셸을 **200** 으로 낸다(`portal-fe/nginx.conf:331-333`).
- 수정안
  - 기대값을 「`/.txt`·틀린 키 → 키 본문이 아님(SPA 셸)」으로 고친다.
  - 404 가 꼭 필요하면 `location ~ ^/[0-9a-f]{32}\.txt$ { return 404; }` 를 정확 일치 location 과 함께 두라고 명시한다. 정확 일치가 정규식보다 먼저 잡힌다.

## test-strategy — REVISE

체크 #1(AC↔테스트) · #4(데이터) · #5(음성 사례)

**T-1. 짝 스위치에 회귀 주입이 없다.**
- 근거: 스위치 단위 테스트는 있다(`spec.md:51` 「꺼짐 → 모든 문서 null」). 그런데 회귀 주입 13종(`spec.md:145-147`)에는 「스위치 무시(꺼져도 `alternateId` 를 실음)」가 없다.
- 이 분기는 ADR-0062 §8 을 뒤집는 결정을 막는 유일한 장치다. 빨강을 보지 않은 채 「켰다」고 할 수 없다.
- 수정안: SR-5.2 에 「스위치 분기 삭제」를 더한다.

**T-2. 오라클 #27 의 이유 칸이 원자료와 다르다.**
- 근거: 영문 18066 의 `googlePlaceId` 는 `ChIJ82MIn6VHbjUR9p9xv_1Gl5s`(`s1-8-review-pages.json:4127`)이고, 국문 16043 은 `ChIJHXIVBbpHbjURQDWjiLi2sKk`(`:4198`)다. 둘 다 있고 값이 다르다.
- 부록 A `spec.md:202` 는 placeId 칸을 「없음」, 이유를 「placeId 없음」으로 적었다. Out of Scope `spec.md:170` 도 #27 을 「placeId 없는 짝」으로 묶었다.
- 수정안
  - #27 을 「placeId 다름 · 조건 ① 실패」로 고친다.
  - SR-5.1 의 「조건 ① 실패」 사례에 #27 을 실제 사례로 붙인다. 지금은 합성 사례만 있다.
  - Out of Scope 는 「placeId 없음(#26·#29) · placeId 불일치(#27)」로 나눈다.

**T-3. 배포 뒤 AC 가 스위치 기본값에서 아무것도 재지 않는다.** usecase U-1 과 근거가 같다. 테스트 쪽 수정만 적는다.
- 수정안: 「hreflang 오류 0」 단언 앞에 「`alternateId` 있는 문서 수 ≥ 1」 전제를 둔다. 0건이면 실패로 친다. 지금 그대로면 0건일 때 위반 0으로 통과한다.

## architecture — REVISE

체크 #4(경계 변경의 근거 명시)

**A-1. ADR-0062 개정 초안이 스위치와 적용 시점을 적지 않는다.**
- 근거: `adr-amendments-draft.md:7-8` 은 「그 규칙을 통과한 일대일 짝에만 상세 hreflang 을 건다」고 단정한다. 반면 스펙은 기본값을 꺼짐으로 정하고, 사용자 승인 뒤 env 로 켠다(`spec.md:6`).
- SR-1.7 은 「hreflang 없음」 주석 세 곳(`AttractionPageRenderer.kt:65` 등)을 새 규칙으로 고치게 한다. 이 초안이 구현 커밋에 함께 들어가면, 운영에는 hreflang 이 0건인데 ADR 과 주석은 「건다」가 된다.
- 수정안: ADR-0062 개정에 다음을 적는다.
  - 「`search.alternate-pairs.enabled` 로 켠다. 기본 꺼짐」
  - 「이 개정 블록은 사용자 승인 시점에 커밋한다」
  - 주석 문구도 「스위치가 켜졌을 때만」으로 맞춘다.
- ADR-0103 개정과 내부 조회 포트(ADR-0083 형태, `/internal/attractions/**` 관례: `place/CLAUDE.md:137-138`)는 문제없다.

## domain — REVISE (MINOR)

체크 #5(용어 일관성)

**D-1. 「본문 변경 시각」 정의가 SR-2.3 표와 어긋난다.**
- 근거: 세 시각 표 `spec.md:17` 은 「SR-2 해시가 달라졌을 때만 오른다」고 정의한다. 그런데 `spec.md:86-87` 은 새 행에 `now`, 첫 채움에 `source_modified_at` 을 넣는다.
- 그래서 RSS `pubDate`(`spec.md:103`)에 원천 수정일이 섞여 나간다.
- 수정안: 정의를 「해시가 달라졌거나 새 행일 때 `now`. 첫 채움은 원천 수정일로 시작값을 둔다」로 고친다.

해시 입력 필드를 바꾸는 경로가 `syncFrom` 하나뿐인지도 확인했다(심판 NOTES 2번).
- `Attraction.kt` 의 변경 메서드는 `syncFrom`(325)과 `enrichGooglePlaceId`(415) 둘이다. 뒤엣것은 해시 필드가 아니다.
- place:feature 의 `@Modifying` 질의는 전부 다른 테이블의 DELETE·UPSERT 다.
- 개요·소개 수집도 `bulk_upsert`(`place_client.py:96`) → `AttractionRepositoryAdapter.kt:40` `syncFrom` 을 지난다.
- 따라서 SR-2.3 의 위치는 맞다.

## security — REVISE

체크 #6(시크릿 관리) · #4(입력 검증)

**S-1. SR-4.1 이 정한 시크릿 방식은 운영에서 만들 수 없다. 키 값이 nginx 설정에 그대로 들어간다.**
- 근거: `spec.md:111` 은 「SealedSecret 으로 암호문만 레포에」를 정한다. 그런데 운영(oci-arm)에는 컨트롤러가 없고, 레포 관례는 레포 밖에서 만든 Secret 이다(`place/ingest/README.md:68-76`).
- 이대로 구현하면 Argo 가 모르는 CRD 에서 동기화에 실패한다. 아니면 구현자가 평문 Secret 을 base 에 커밋하는 쪽으로 샌다.
- 키 값은 envsubst 로 nginx 설정 문법 안에 그대로 들어간다(`spec.md:115`). 따옴표나 `;` 가 섞이면 설정이 주입된다.
- IndexNow 키는 원래 공개값이라 유출 자체는 위험이 낮다. 위험은 운영 쪽(I-1)과 설정 주입이다.
- 수정안: I-1 수정안과 같이 레포 밖 Secret · `optional: true` 로 바꾸고, 조각을 쓰기 전에 `^[0-9a-f]{32}$` 로 검사한다. 맞지 않으면 조각을 쓰지 않고 경고 한 줄을 남긴다.
- SR-3.3(XML 금지 문자 → 이스케이프 순서)은 문제없다.

## usecase — REVISE

체크 #3(사전·사후 조건) · #4(AC 추적)

**U-1. 「hreflang 오류 0(AC)」와 표본 확인을 스위치가 꺼진 상태에서는 할 수 없다.**
- 근거
  - 기본값이 꺼짐이면 모든 문서의 `alternateId` 가 null 이다(`spec.md:6`, `:51`).
  - 그런데 SR-5.4 는 배포 직후 운영 응답의 `alternateId`, 양쪽 SSR 세 줄, 「`alternateId` 있는 문서 전부 스크롤」을 확인하게 한다(`spec.md:151-155`).
  - 대상이 0건이라 위반도 0건이 되고, 아무것도 재지 않은 채 통과한다.
- 수정안: SR-5.4 를 둘로 나눈다.
  - **배포 직후(꺼짐)**: 재색인 로그 `enabled=false` 와 `Alternate pairs: N` 에서 N ≥ 1 을 본다. 응답과 SSR 에는 hreflang 이 0줄이어야 한다.
  - **켠 뒤**: 표본 #2·#3·#9 확인, AC(대상 ≥ 1 전제), 무작위 30쌍 수동 확인.

**U-2. 짝 스위치를 켜고 되돌리는 절차가 없고, 되돌려도 sitemap 에는 남는다.**
- 근거
  - IndexNow 에는 부록 B(`spec.md:211-215`)가 있다. 짝 스위치는 머리말 한 문장(`spec.md:6`)뿐이다. 어느 파일의 어떤 env 를 바꾸는지, ADR 커밋, 30쌍 확인 기록 위치가 정해져 있지 않다.
  - 지금 CronJob 에는 그 env 가 아예 없다(`k8s/base/search-batch/cronjob-attraction-reindex.yaml:54-71`).
  - 정적 sitemap 의 alternates 는 FE 빌드 시점 값이다(`spec.md:63-64`, `prerender-seo.mjs:816-826`). 스위치를 끄고 재색인해도 다음 portal-fe 빌드까지 sitemap 에 hreflang 이 남는다.
- 수정안
  - 「부록 C — 짝 스위치」를 둔다.
    1. 사용자가 ADR-0062 개정을 승인한다.
    2. `cronjob-attraction-reindex.yaml` 의 `SEARCH_ALTERNATE_PAIRS_ENABLED` 를 `"true"` 로 커밋한다.
    3. 다음 KST 06:30 재색인 로그와 표본을 확인한다.
    4. 30쌍 수동 확인 결과를 `evidence/` 에 남긴다.
    5. 되돌릴 때는 `"false"` 로 바꾸고 재색인한 뒤 **portal-fe 를 다시 빌드**해 sitemap 을 비운다.
  - 구현 단계에서 env 를 `"false"` 로 미리 넣어 둔다.

VERDICT: REVISE
