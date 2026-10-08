# 3라운드 전 판정: place hreflang · 피드 · IndexNow — 2라운드 발견 10건

2라운드 발견 10건을 모두 유지합니다. 인용한 `file:line` 은 하나씩 열어 봤고, 반증이 나온 발견은 없습니다. 기각과 강등은 0건입니다.

I-1 하나만 REVISE 에서 BLOCK 으로 올렸습니다. 스펙 결정(SR-4.1·4.2)과 코드 근거(`Dockerfile:79` envsubst 필터, `nginx.conf` 의 변수 `return`, oci-arm 의 수동 Secret 관례)를 둘 다 인용하고 있어 헌법 6 의 BLOCK 조건을 채웁니다. 스펙대로 구현하면 portal-fe 롤아웃이 멈추거나 nginx 가 기동하지 못합니다. 그러면 모든 호스트가 함께 내려갑니다.

## 1. 묶음 표

| 묶음 | 발견 | 판정 | 등급 |
|---|---|---|---|
| IndexNow 키·nginx 배선 | I-1 | keep (승격) | BLOCK |
| | S-1 | keep | REVISE |
| | I-2 | keep | REVISE |
| 짝 스위치 검증·운영 | T-1 | keep | REVISE |
| | T-3 | keep (U-1 과 근거 같음) | REVISE |
| | U-1 | keep | REVISE |
| | U-2 | keep | REVISE |
| | A-1 | keep | REVISE |
| 오라클 | T-2 | keep | REVISE |
| 용어 | D-1 | keep | MINOR |

## 2. 발견별 판정

```json
[
  { "id": "I-1 optional:false + envsubst → portal-fe 기동 불가",
    "verdict": "keep", "severity": "BLOCK",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 111, "quote": "Secret `place-indexnow`(키 `key`, SealedSecret 으로 암호문만 레포에)로 두고" },
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 115, "quote": "return 200 \"${INDEXNOW_KEY}\"; }" },
      { "file": "portal-fe/Dockerfile", "line": 79, "quote": "NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS" },
      { "file": "portal-fe/nginx.conf", "line": 184, "quote": "search 가 없는 환경(docker run 단독 등)에서 nginx 가 안 뜨고 모든 호스트가 같이 내려간다" },
      { "file": "k8s/overlays/oci-arm/kustomization.yaml", "line": 50, "quote": "cf-origin-ca-tls 와 동일하게 OCI 에서 수동 등록 (git 미포함)." },
      { "file": "k8s/base/place-ingest/cronjob-media.yaml", "line": 66, "quote": "optional: true" },
      { "file": "k8s/base/portal-fe/deployment.yaml", "line": 10, "quote": "replicas: 1" }
    ],
    "reason": "스펙 결정과 코드·관례 위반이 둘 다 인용됐다. 'sealed' 는 k8s/infra/prod/** 와 README 에만 있고 oci-arm 은 수동 Secret 이다. 키가 없으면 정의된 변수만 치환하는 envsubst 가 `${INDEXNOW_KEY}` 를 남겨 nginx 가 기동하지 못한다. 그래서 BLOCK 으로 올린다." },
  { "id": "S-1 SealedSecret 운영 불가 · 키 값 설정 주입",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 111, "quote": "SealedSecret 으로 암호문만 레포에" },
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 115, "quote": "location = /${INDEXNOW_KEY}.txt { ... return 200 \"${INDEXNOW_KEY}\"; }" }
    ],
    "reason": "운영 불가 부분의 원인은 I-1 과 같다. 키 형식 검사 없이 설정 문법에 값을 넣는다는 별도 결함이 실재해 유지한다." },
  { "id": "I-2 「/.txt 404」 기대값 불성립",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 156, "quote": "키 파일 200·본문 = 키, apex·blog 호스트 404, `/.txt` 404." },
      { "file": "portal-fe/nginx.conf", "line": 332, "quote": "try_files $uri /index.html;" }
    ],
    "reason": "location 목록을 grep 했다. /.txt 를 잡는 정규식 location 이 없어 `location /` 로 떨어지고 SPA 셸 200 이 나간다." },
  { "id": "T-1 짝 스위치에 회귀 주입 없음",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 147, "quote": "IndexNow 꺼짐 분기 삭제 · AttractionPage alternates 전달 삭제." } ],
    "reason": "회귀 주입 목록(145-147)에 짝 스위치 분기 삭제가 없다. 꺼짐 분기는 IndexNow 것뿐이다." },
  { "id": "T-2 오라클 #27 이유 칸 오류",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-review-pages.json", "line": 4127, "quote": "\"googlePlaceId\": \"ChIJ82MIn6VHbjUR9p9xv_1Gl5s\"  (id 18066, en)" },
      { "file": "docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-review-pages.json", "line": 4198, "quote": "\"googlePlaceId\": \"ChIJHXIVBbpHbjURQDWjiLi2sKk\"  (id 16043, ko)" },
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 202, "quote": "| 27 | 18066 | 16043 | 78/14 | 없음 | 0.0 | 예 | 같은 범위 | 없음 | 〃 |" }
    ],
    "reason": "원자료에서 두 문서 모두 placeId 가 있고 값이 달랐다. 기대값 「없음」은 맞지만 사유와 Out of Scope 분류가 틀렸다." },
  { "id": "T-3 배포 뒤 AC 가 대상 0건에서 공허 통과",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 154, "quote": "`alternateId` 있는 문서 전부를 스크롤해 ... 위반 건수 0." } ],
    "reason": "스위치 기본값 false(spec.md:6)에서는 대상이 0건이다. 그래도 AC 가 통과하므로 전제 단언이 필요하다. U-1 과 같은 편집으로 해소한다." },
  { "id": "U-1 꺼진 상태에서 SR-5.4 확인 불가",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 6, "quote": "search.alternate-pairs.enabled`(기본 false" },
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 152, "quote": "운영 응답 `alternateId` 와 양쪽 SSR `<link hreflang>` 세 줄을 확인." }
    ],
    "reason": "기본값이 꺼짐인데 배포 직후 단계가 켜진 상태의 산출물을 확인하라고 적혀 있다. 원문과 일치한다." },
  { "id": "U-2 짝 스위치 켜기·되돌리기 절차 부재, sitemap 잔존",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "k8s/base/search-batch/cronjob-attraction-reindex.yaml", "line": 54, "quote": "env: OPENSEARCH_URIS … CLICKHOUSE_PASSWORD (SEARCH_ALTERNATE_PAIRS_ENABLED 없음)" },
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 816, "quote": "export function placeDetailSitemapEntries(places) {" }
    ],
    "reason": "CronJob 에 env 가 없다(grep ALTERNATE 0건). sitemap 은 빌드 시점 값이라 끄고 재색인해도 다음 빌드까지 남는다." },
  { "id": "A-1 ADR-0062 개정 초안에 스위치·적용 시점 없음",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/context/adr-amendments-draft.md", "line": 8, "quote": "**그 규칙을 통과한 일대일 짝에만** 상세 hreflang 을 건다." },
      { "file": "search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt", "line": 65, "quote": "// hreflang 없음 — TourAPI 국문/영문은 별도 콘텐츠라 짝을 모른다 (ADR-0062 §8)" }
    ],
    "reason": "초안은 단정형이고 스펙은 기본 꺼짐이라 서로 어긋난다. 원문과 일치한다." },
  { "id": "D-1 「본문 변경 시각」 정의와 SR-2.3 표 불일치",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 17, "quote": "아래 SR-2 해시가 달라졌을 때만 오른다. RSS·IndexNow 의 기준" },
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 87, "quote": "| 기존 행, 이전 해시 null (첫 채움) | 계산 | `source_modified_at` (null 이면 null) |" }
    ],
    "reason": "정의 문장과 표가 다르다. 표의 규칙 자체는 1라운드에서 판정을 마쳤으므로 정의 문구만 고치면 된다." }
]
```

## 3. 편집 목록

### spec.md

**E1 (D-1)** — 「세 시각」 표에서 `| 본문 변경 시각 |` 행을 아래로 바꿉니다.
```text
| 본문 변경 시각 | `content_updated_at` / `contentUpdatedAt` | 새 행이거나 SR-2 해시가 달라졌을 때 `now` 로 오른다. 첫 채움·해시 버전 교체 때는 원천 수정일로 시작값을 둔다(SR-2.3 표). RSS·IndexNow 의 기준 — 그래서 RSS `pubDate` 에는 첫 채움 행의 원천 수정일이 섞일 수 있다(수용) |
```

**E2 (I-1·S-1)** — SR-4 의 항목 1(「**키**: 32자 hex 키 하나를 Secret `place-indexnow`…」부터 「…로그에 쓰지 않는다.」까지)을 바꿉니다.
```text
1. **키**: 32자 hex 키 하나를 Secret `place-indexnow`(키 `key`)로 둔다. 운영(oci-arm)은 레포 밖에서 만든다(사용자, `ssh msa-oci` 에서 `kubectl -n commerce create secret generic place-indexnow --from-literal=key=…`) — oci-arm 에는 SealedSecrets 컨트롤러가 없고 이 레포의 운영 Secret 은 수동 등록이 관례다(`cf-origin-ca-tls`·`place-ingest-secrets`). 레포에는 Secret 도 SealedSecret 도 두지 않는다.
   portal-fe · place-ingest 가 **같은 Secret** 을 env `INDEXNOW_KEY`(secretKeyRef, **`optional: true`**)로 읽는다 — Secret 이 없어도 두 파드는 뜨고, 키 파일이 없을 뿐이다. k3s-lite 도 Secret 을 두지 않는다(없음이 정상). 키·요청 본문은 로그에 쓰지 않는다.
```

**E3 (I-1·S-1)** — SR-4 의 항목 2(「**키 파일**: `portal-fe/Dockerfile` `NGINX_ENVSUBST_FILTER` 에…」부터 「…디렉터리 마운트 금지.」까지)를 바꿉니다.
```text
2. **키 파일**: nginx.conf 본문에 키를 넣지 않는다(envsubst 는 정의된 변수만 치환해서, 키가 없으면 `${INDEXNOW_KEY}` 가 nginx 변수로 남아 기동이 실패하고 모든 호스트가 내려간다). `NGINX_ENVSUBST_FILTER` 는 그대로 둔다.
   - `portal-fe` 이미지에 `/docker-entrypoint.d/` 스크립트(20-envsubst 보다 앞 번호)를 넣는다. `INDEXNOW_KEY` 가 `^[0-9a-f]{32}$` 에 맞을 때만 `/etc/nginx/conf.d/indexnow/indexnow.conf` 조각을 쓴다. 비었거나 형식이 다르면 조각을 쓰지 않고 경고 한 줄을 남긴다(키 값은 찍지 않는다).
   - 조각 내용: `location = /{key}.txt { if ($host != "place.1989v.com") { return 404; } default_type text/plain; add_header Cache-Control "public, max-age=300"; return 200 "{key}"; }`
   - nginx.conf 의 server 블록에 `include /etc/nginx/conf.d/indexnow/*.conf;` — 글롭은 0건이어도 오류가 아니다.
   - 넓은 정규식(`\.txt$`)·디렉터리 마운트 금지. 검증: 키 없음 → nginx 기동·키 파일 없음, 형식 틀린 키(`;` 포함) → 조각 없음·기동, 정상 키 → 200·본문 = 키.
```

**E4 (I-1)** — SR-5.3 「**배포 순서**: place(V34·…」 문장을 바꿉니다.
```text
3. **배포 순서**: Secret `place-indexnow` 생성(사용자, OCI — 없어도 배포는 안전하고 키 파일만 없다) → place(V34·응답 필드·내부 조회) → search:batch·app → portal-fe → place-ingest CronJob.
```

**E5 (I-2)** — SR-5.4 의 「- 키 파일 200·본문 = 키, apex·blog 호스트 404, `/.txt` 404.」를 바꿉니다.
```text
   - 키 파일 200·본문 = 키, apex·blog 호스트 404. `/.txt`·틀린 키 → 키 본문이 아님(SPA 셸 — 정확 일치 location 밖은 `location /` 로 떨어진다).
```

**E6 (T-1)** — SR-5.2 끝의 「· IndexNow 꺼짐 분기 삭제 · AttractionPage alternates 전달 삭제.」를 바꿉니다.
```text
· IndexNow 꺼짐 분기 삭제 · AttractionPage alternates 전달 삭제 · 짝 스위치 분기 삭제(꺼져도 `alternateId` 를 실음 — 「꺼짐 → 모든 문서 null」 테스트가 잡는다).
```

**E7 (T-2)** — 네 군데를 고칩니다.
- SR-5.1 첫 항목의 「조건 ①~④ 각각 실패」를 아래로 바꿉니다.
```text
조건 ①~④ 각각 실패(① 은 오라클 #27 — placeId 둘 다 있고 다름 — 과 합성 사례)
```
- 부록 A 의 #27 행을 바꿉니다.
```text
| 27 | 18066 | 16043 | 78/14 | 다름 | 0.0 | 예 | 같은 범위 | 없음 | placeId 불일치 · 조건 ① 실패(재현율 손실) |
```
- 부록 A 합계 줄의 「placeId 없는 같은 범위 3」을 바꿉니다.
```text
placeId 없거나 다른 같은 범위 3 — 없음 #26·#29, 다름 #27
```
- Out of Scope 의 「placeId 없는 짝(#26·#27·#29)」을 바꿉니다.
```text
placeId 없는 짝(#26·#29)·placeId 가 다른 짝(#27)
```

**E8 (U-1·T-3)** — SR-5.4 의 「- 재색인 로그 `Alternate pairs` 줄. 표본 3곳 …」부터 「…위반 건수 0.」까지(두 항목)를 바꿉니다.
```text
   - **배포 직후(스위치 꺼짐)**: 재색인 로그 `Alternate pairs: N (… enabled=false)` 에서 N ≥ 1. 운영 응답 `alternateId` 는 전부 null, SSR·sitemap 의 상세 hreflang 은 0줄.
   - **켠 뒤(부록 C)**: 표본 3곳 = 오라클 「짝」 중 우선 #2(en 2180 ↔ ko 5337) · #3(14206 ↔ 7935) · #9(13515 ↔ 5318).
     운영 응답 `alternateId` 와 양쪽 SSR `<link hreflang>` 세 줄을 확인. 운영 전역 판정에서 짝이 없으면 그 사실을 적고 부록 A 의 다음 「짝」 번호로.
     반례 #19(en 1676·ko 160)·#24(ko 2477)에 hreflang 없음.
   - **hreflang 오류 0(AC, 켠 뒤)**: 전제 — `alternateId` 있는 문서 수 ≥ 1(0건이면 AC 실패). 그 문서 전부를 스크롤해 — 상대 문서 존재 · 상대 `alternateId` = 자기 · 언어 다름 ·
     양쪽 overview 비어 있지 않음 — 위반 건수 0. 무작위 30쌍 수동 확인(S1-8 방식).
```

**E9 (U-2)** — 세 군데를 고칩니다.
- SR-1.5 끝 「(테스트: 꺼짐 → 모든 문서 null · 로그 N 은 켜짐과 같음)」 뒤에 덧붙입니다.
```text
구현 커밋에서 `k8s/base/search-batch/cronjob-attraction-reindex.yaml` env 에 `SEARCH_ALTERNATE_PAIRS_ENABLED: "false"` 를 미리 넣는다. 켜기·되돌리기는 부록 C.
```
- Out of Scope 첫머리 「IndexNow 실제 제출 켜기(사용자 — 부록 B),」 뒤에 덧붙입니다.
```text
짝 스위치 켜기(사용자 — 부록 C),
```
- 파일 끝에 새 절을 둡니다.
```text
## 부록 C — 짝 스위치 켜기·되돌리기(사용자)
1. 사용자가 ADR-0062 §8 개정(스위치를 켜는 결정)을 승인한다.
2. `k8s/base/search-batch/cronjob-attraction-reindex.yaml` 의 `SEARCH_ALTERNATE_PAIRS_ENABLED` 를 `"true"` 로 커밋한다.
3. 다음 KST 06:30 재색인 로그 `enabled=true` 와 SR-5.4 「켠 뒤」 항목을 확인한다.
4. 무작위 30쌍 수동 확인 결과를 `docs/research/2026-10-07-tourism-growth/evidence/` 아래에 남긴다. 범위 다름이 1건이라도 나오면 3단계로 되돌린다.
5. 되돌리기: `"false"` 로 커밋 → 재색인 → **portal-fe 를 다시 빌드·배포**해 정적 sitemap 의 alternates 를 비운다(sitemap 은 빌드 시점 값이라 재색인만으로는 남는다).
```

**E10 (A-1, SR-1.7 쪽)** — SR-1.7 의 「「hreflang 없음」 주석 세 곳(…)을 새 규칙으로 고친다.」를 바꿉니다.
```text
「hreflang 없음」 주석 세 곳(`AttractionPageRenderer.kt:65,117`, `AttractionPage.tsx:171-173`, `prerender-seo.mjs:707-708`)을 「언어 대체 짝이고 짝 스위치(`search.alternate-pairs.enabled`, 기본 꺼짐)가 켜졌을 때만 hreflang (ADR-0062 §8 개정)」으로 고친다.
```

### adr-amendments-draft.md

**E11 (A-1)** — ADR-0062 블록 본문 첫 문단(「위 「hreflang 을 걸지 않는다」는 짝을 알 수 없어서였다. … 나머지 상세는 지금처럼 없다.」)을 바꿉니다.
```text
위 「hreflang 을 걸지 않는다」는 짝을 알 수 없어서였다. S1-8 실측(영문 300·수동 30쌍)으로 짝을 고르는 규칙이 생겨,
**그 규칙을 통과한 일대일 짝에만** 상세 hreflang 을 걸 수 있게 한다. 거는지 여부는 search:batch 설정
`search.alternate-pairs.enabled`(CronJob env `SEARCH_ALTERNATE_PAIRS_ENABLED`)가 정하고 **기본은 꺼짐**이다 —
꺼져 있으면 짝을 계산해 로그만 남기고 문서 `alternateId` 는 null 이라 hreflang 이 0건이다. 켜는 것은 사용자 승인 뒤 운영 30쌍
수동 확인과 함께 한다. 되돌리면 재색인 뒤 portal-fe 를 다시 빌드해 sitemap 에서도 지운다. 나머지 상세는 지금처럼 없다.
```

**E12 (T-2 연동)** — 「- 감수: placeId 없는 짝·대표점이 50m 를 넘는 긴 시설은 놓친다」를 바꿉니다.
```text
- 감수: placeId 가 없거나 서로 다른 짝·대표점이 50m 를 넘는 긴 시설은 놓친다(재현율 손실, 오연결 아님).
```

## 4. 3라운드(마지막) 재리뷰 차원

| 차원 | 필수 여부 | 볼 곳 |
|---|---|---|
| implementation | 필수 | SR-4.1·4.2(entrypoint 조각·include 글롭·`optional: true`), SR-5.3 순서, 부록 C 5단계 |
| security | 필수 | SR-4.2 키 형식 검사, 경고 로그에 키 미노출 |
| usecase | 필수 | SR-5.4 두 단계 분리, AC 전제, 부록 B·C 의 대칭 |
| test-strategy | 변경 절만 | SR-5.1 #27 사례, SR-5.2 스위치 주입, 키 파일 검증 세 경우 |
| architecture | 변경 절만 | ADR-0062 개정 문단(E11)과 SR-1.7 주석 문구가 맞는지 |
| domain | 생략 가능 | E1 한 줄. 표 규칙은 바뀌지 않았다 |

## 5. 사용자 판단 항목

1. **ADR-0062 개정을 언제 커밋할지.**
   - **권고: 구현 커밋에 함께 넣습니다.** E11 문안처럼 「규칙과 스위치가 있고 기본 꺼짐, 켜는 것은 사용자」로 적으면, 운영 상태(0건)와 ADR·주석이 어느 시점에도 맞습니다.
   - 대안은 리뷰어 원안대로 승인 시점에 커밋하는 것입니다. 이 경우 그 사이에는 코드에 있는 스위치가 ADR 에 적혀 있지 않게 됩니다.
2. **`/.txt`·틀린 키를 404 로 막을지.**
   - **권고: 막지 않습니다.** E5 처럼 「키 본문이 아님(SPA 셸)」을 기대값으로 둡니다. 키는 공개값이고 셸 200 은 해가 없습니다.
   - 404 가 필요하면 조각에 `location ~ ^/[0-9a-f]{32}\.txt$ { return 404; }` 를 함께 씁니다. 다만 키가 없을 때는 조각 자체가 없어 여전히 셸이 나갑니다.
3. **Secret 생성 시점.** **권고**: 배포 전에 사용자가 OCI 에서 만듭니다. `optional: true` 이므로 늦어져도 배포는 안전합니다.

## 6. 남긴 메모

판정 범위 밖이라 발견으로 올리지 않은 것이 하나 있습니다. `place/ingest/README.md:68` 의 「운영은 SealedSecret」은 oci-arm 의 실제 관례(수동 등록, `kustomization.yaml:50`)와 어긋납니다. 이 스펙의 범위는 아닙니다.

SUMMARY: keep 10 / demote 0 / dismiss 0

NOTES: place/ingest/README.md 의 「운영은 SealedSecret」 문구가 oci-arm 수동 Secret 관례와 다르다(범위 밖).
