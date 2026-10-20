# 통합 검색 런처 배포 기록 — 2026-10-21

이 기록은 부모 세션의 실제 CLI 배포·HTTP/API·OpenSearch·actuator 확인 결과를 인계받아 작성했다.
브라우저 시각·실제 PWA 설치·실기기 IME 검증을 실행한 기록은 아니다.

## 배포 기준과 작업 위치

- 실제 release checkout: `/private/tmp/search-launcher-release-20261021`.
- 기준 SHA: `59644dd328bfc2821654cef4646513bd9eb1b97a`.
- 구현 source SHA: `12f31ae7e9342746a159d6146bcad7b53edf38fa`.
- 세 이미지 태그 반영 manifest SHA: `cd91ba1431a87d9d5a59383f3a5c46f5721fcf35`.
- 첫 이미지 workflow [39470270460](https://github.com/1989v/msa/actions/runs/39470270460): 성공.
- 생성 drill JSON 줄번호 동기화 repair SHA: `2385f4096` (로컬 `c2150fac1`을 manifest 커밋 위로 재배치한 최종 SHA).
- 후속 이미지 workflow [39471925138](https://github.com/1989v/msa/actions/runs/39471925138): **SUCCESS**.
- 후속 manifest SHA: `1cb7c8a567fb07378d7effdba1a7f16754606fe0`.
- 실제 portal은 `2385f40` 이미지로 rollout 성공했고 search는 `12f31ae`를 유지한다.

초기 공유 작업 트리는 원격보다 오래되어 이미 배포된 통합 검색 구조를 놓쳤다.
그 트리의 구현을 그대로 배포하지 않고 최신 원격 기준으로 호환 패키지를 격리 재구성했다.
원본 `/Users/gideok-kwon/IdeaProjects/msa`의 코드·staged/dirty·서브모듈 포인터는 의도적으로 보존했다.
따라서 원본 작업 트리 코드를 현재 배포 코드라고 판단하면 안 된다. 이곳의 feature 문서만 실제 release 기준으로 동기화했다.

## 실제 배포 구조

- `/search` 독립 런처와 query 보존 `/s` 정규화. 기본 첫 결과/방향키/Enter/IME/취소·역순 응답 보호.
- 기존 grouped `GET /api/search/unified`는 `{query, understood, groups:[{type,total,hits}]}`를 유지하며 기본값 0 page를 추가했다.
- 새로운 flat 계약은 `GET /api/search/unified/suggest`뿐이며 mode는 `bm25`다. 자동완성에서 벡터를 호출하지 않는다.
- 기존 `unified`의 여섯 타입과 매핑·읽기/쓰기 문서 계약을 보존하고 `cafe_drink`를 기존 facets(group/brand)로 추가했다.
- 관광지는 기존 `attractions` 별도 인덱스와 모델·query-vector/sidecar·hybrid 경로를 그대로 사용한다.
  관광지 벡터를 unified에 복제하지 않았고 새로운 hybrid 설정 플래그를 만들지 않았다.
- 게임·음료는 문서 벡터가 없는 keyword 검색이다. 의미 검색이 된다고 보고하지 않는다.
- 기존 active `unified-reindex` CronJob의 UTC 20:10·Forbid·리소스·재시도를 보존했다.
  bulk 오류와 refresh 후 정확한 count 검사를 추가했다. 기존 live-count 하한과 안전한 retention도 유지한다.
- 검색 manifest ID/start_url/scope `/search`, 192/512 PNG, manifest MIME 제공. 서비스 워커/API 캐시는 없다.

## Rollout·재색인·코퍼스 보존

search app과 portal rollout이 성공했다. 후속 portal `2385f40` rollout 뒤에도 `/search`, `/s`,
`/search.webmanifest` HTTP 200과 `amp&type=game` → AMP ARENA를 재확인했다.
Argo는 `1cb7c8a567fb07378d7effdba1a7f16754606fe0`에 **Synced**다.
Argo 앱 전체의 aggregate 상태는 **Degraded**이며 lastTransition이 10월 4일인 기존 상태다.
이를 이번 search/portal rollout 실패로 해석하지 않는다.
운영 Job `unified-launcher-20261021-12f31ae`가 **12초에 COMPLETED**, **6,096문서·오류 0**으로 종료했다.
기존 여섯 타입 건수를 그대로 보존하고 음료 1,922문서를 추가했다.

| 타입 | 배포 전 | 재색인 후 |
|---|---:|---:|
| concept | 4,032 | 4,032 |
| game | 83 | 83 |
| product | 25 | 25 |
| blog_post | 15 | 15 |
| service | 10 | 10 |
| deal_offer | 9 | 9 |
| cafe_drink | 0 | 1,922 |
| 합계 | 4,174 | 6,096 |

관광지는 별도 인덱스를 유지했다. 배포 전 읽기 확인은 총 67,488문서·모델 스탬프 일치 벡터 59,682건·OpenSearch green이었다.

## 운영 HTTP/API·벡터 분기 확인

- `/search`, `/s`: HTTP 200. 검색 manifest: HTTP 200.
- suggest `q=amp&type=game` → **AMP ARENA**.
- suggest `q=경복궁&type=attraction` → **경복궁, id 1**.
- suggest `q=라떼&type=cafe_drink` → 음료 결과.
- full grouped 음료 검색: total **537** 확인.
- 의미 질의 `아이와 갈만한 곳` → 어린이 공원 결과.
  함께 확인한 actuator `search.attraction.hybrid COUNT 1`은 실제 벡터 분기가 실행됐다는 증거다.
  이 단일 질의가 전체 검색 품질의 정량 평가를 대신하지는 않는다.

## 검증과 남은 신호

- 격리 release: Gradle app 757 + batch 137 + domain 262 = **1,156 tests**, 실패·오류 0;
  `verifyArchitecture` 포함 `BUILD SUCCESSFUL in 33s`.
- FE tsc -b exit 0; 8 files / **33 tests** passed; production build exit 0.
- 생성 router/nginx `/search`·`/s`, manifest scope/start_url, PNG 크기 CLI PASS.
- generated JSON mismatch 보수 후 일반 no-write `DrillExportSpec` **2 tests** 실패·오류 0,
  `BUILD SUCCESSFUL in 7s`. 테스트를 약화하지 않았고 줄번호 네 곳만 동기화했다.
- 후속 CI [39471925144](https://github.com/1989v/msa/actions/runs/39471925144): backend 구조·컴파일·테스트 컴파일 **SUCCESS**,
  YAML/Kustomize **SUCCESS**. 기록 시점 FE 검사는 running이므로 전체 CI 성공으로 기록하지 않는다.
- 앞선 전체 CI는 **기존 네 실패가 세 파일** `dataSources` / `footerLinksGolden` / `gameCatalogGuides`에 남았다.
  이전 run `39444821430`에도 정확히 같은 실패가 있어 이번 범위에서 수정하지 않았다. 전체 CI green이라고 보고하지 않는다.
- Docs Health의 기존 10월 18일 계획 문서 broken link 2개도 범위 밖으로 유지했다.
- 빌드의 기존 landslide 상세 API 500은 기존 스크립트의 요약 대체 경고로 유지했다.
- 브라우저 도구는 연결 불가 상태여서 실제 화면·설치·실기기 IME 검증은 미실시다.

로그: `/private/tmp/search-release-{compile,gradle,tsc,fe-tests,build}.log`,
`/private/tmp/search-release-drill-{test,export,verify}.log`.
