# 스펙 G2(place-hreflang-feed-indexnow) TG8.1 — 회귀 주입(SR-5.2) + 구현 때 「처음부터 초록」이던 항목

- 2026-10-09 KST. 임시 사본 `scratchpad/wt-inject-g2`(detached `c7c6f8c0c`). 원본 wt-impl·메인 트리는 손대지 않았고 커밋하지 않았다. 끝난 뒤 사본을 제거했다.
- 사본 준비: 서브모듈 ai·auth·gifticon 은 메인 `.git/modules` 에서 `clone --shared` 한 뒤 포인터 sha 로 checkout 했다. `portal-fe/node_modules` 는 wt-impl 것을 심링크했다(package-lock.json `cmp` 동일 확인).
- nginx 검사(16번)는 워크트리 밖 사본 `inject-g2/nginx-copy/` 의 `15-indexnow-key.sh`·`nginx.conf` 를 `ENTRYPOINT_SCRIPT`·`NGINX_CONF` 로 넘겨 돌렸다. 레포의 스크립트 파일은 바꾸지 않았다.
- 주입 전 기준선(모두 종료 0):
  - Kotlin: `AlternateLanguagePairerTest` 16/0, `AttractionApiReindexTaskletTest` 39/0, `AttractionSyncFromTest` 18/0 + `AttractionTest` 10/0, `AttractionRepositoryAdapterTest` 5/0, `AttractionFeedRendererTest` 14/0, `AttractionHreflangParityTest` 3/0 + `AttractionPageRendererTest` 107/0, `AttractionContentHashTest` 9/0, `PlaceSchemaIntegrationSpec` 15/0(skipped 0)
  - pytest `indexnow_test.py` 15 passed · vitest `AttractionPage.test.tsx` 75 passed · `check-nginx-indexnow.sh` PASSED
  - `tsc -b` 기준선 오류 9건은 모두 생성 파일 `search-architecture.json` 이 없어서 나는 것이다(`routes.test.tsx`·`SearchArchitecturePage*`).
- 각 주입은 한 번에 하나씩 넣었다. 대상 테스트만 돌린 뒤 `git checkout -- .` 와 nginx 사본 재복사로 되돌렸고, `git status --porcelain` 은 33회 모두 clean 이었다. Kotlin 은 `--rerun` 으로 돌렸다.
- 컴파일 확인:
  - Kotlin: 결과 xml 이 나왔고 `e:` 줄이 없다. 즉 컴파일 후 테스트가 실행됐다.
  - FE: 주입마다 `tsc -b` 를 돌렸고 기준선 9건 외 새 오류는 0건이다. 15번 첫 판(`&& false`)은 좁히기가 깨져 TS18048 2건이 났다. 그래서 `&& attractionHreflangAlternates.length < 0` 으로 바꿔 다시 쟀다.
  - Python 은 `py_compile`, 셸은 `sh -n` 으로 확인했고 모두 종료 0 이다.
- 빨강은 모두 단언 실패다. 같은 스위트의 다른 테스트가 통과하므로 모듈은 정상 로드됐다. 16번만 nginx 기동 실패가 빨강이다(아래 비고).
- 진행 메모: 사전 점검 스크립트가 `run.py` 를 import 하는 바람에 1~11번이 기준선보다 먼저 한 차례 돌았다(12번 도중 중단, 사본 원복 확인). 그래서 기준선을 잰 뒤 1~13·17~20·22~24 를 실패 테스트 이름 기록과 함께 처음부터 다시 돌렸다. 두 번의 결과 수치는 같다. 아래 표는 재실행 값이다.

## 회귀 주입

| # | 주입 | 대상 테스트 | 결과 | 잡은 테스트 |
|---|---|---|---|---|
| 1 | 대응표 무시 — `ContentTypeLang` 대신 `k.contentTypeId == e.contentTypeId` | AlternateLanguagePairerTest | 종료 1 · tests=16 failures=9 | 오라클 「짝 16 · 없음 14」, 국 12↔영 76, 국 28↔영 75 외 |
| 2 | 제목 조건 삭제 | AlternateLanguagePairerTest | 종료 1 · failures=3 | 오라클, 「제목이 다르면 짝이 아니다」, 카운트 |
| 3 | 일대일 삭제(차수 ≥1 이면 통과) | AlternateLanguagePairerTest | 종료 1 · failures=2 | 합성 일대다 「어느 쪽도 짝이 아니다」, 카운트 |
| 4 | 좌표 조건 삭제 | AlternateLanguagePairerTest | 종료 1 · failures=1 | 합성 「50m 는 짝, 51m 는 짝이 아니다」 |
| 5 | 개요 조건 삭제 | AlternateLanguagePairerTest | 종료 1 · failures=2 | 「개요 없는 상세는 noindex 라…짝이 아니다」, 카운트 |
| 6 | 짝 스위치 분기 삭제 — 꺼져도 `alternateId` 를 실음 | :search:batch AttractionApiReindexTaskletTest | 종료 1 · tests=39 failures=1 | 「모든 문서에 alternateId 가 없다」 |
| 7 | 해시 비교 삭제 — 같은 버전이면 항상 now | :place:domain AttractionSyncFromTest + AttractionTest | 종료 1 · SyncFrom 18/3 · AttractionTest 10/0 | 「해시도 시각도 그대로다」, 「병합이 개요를 지키므로…」, 「무시한다 — 자기 계산값」 |
| 8 | 병합 전 source 로 해시 계산 | 〃 | 종료 1 · SyncFrom 18/5 | 「병합된 원천 수정일로 시작」, 「새 해시와 now」 외 |
| 9 | 첫 채움 처리 삭제 — 이전 해시 null 도 now | 〃 | 종료 1 · SyncFrom 18/2 | 「원천 수정일로 시작한다」류 2건 |
| 10 | 새 행 처리 삭제 — 어댑터가 `stampNew` 를 부르지 않음 | :place:feature AttractionRepositoryAdapterTest | 종료 1 · tests=5 failures=1 | 「stampNew 를 거쳐 해시가 붙고 시각은 서울 기준 지금」 |
| 11 | 새 행 처리 삭제 — `stampNew` 가 시각을 안 매김 | :place:domain AttractionSyncFromTest | 종료 1 · SyncFrom 18/1 | 「해시를 계산하고 시각은 now — 새 주소는 변경」 |
| 12 | RSS 정렬 뒤집기 — `contentUpdatedAt` Asc | :search:app AttractionFeedRendererTest | 종료 1 · tests=14 failures=1 | 「본문 변경 시각 내림차순, 같은 시각이면 숫자 id 오름차순」 |
| 13 | XML 금지 문자 제거 삭제 | AttractionFeedRendererTest | 종료 1 · failures=1 | 「XML 1.0 금지 문자…를 지워 파서를 통과한다」 |
| 14 | IndexNow 꺼짐 분기 삭제 | pytest indexnow_test.py | 종료 1 · 2 failed, 13 passed | `test_disabled_sends_nothing_and_reports_count[false]`·`[None]` |
| 15 | AttractionPage alternates 전달 삭제(조건에 항상 거짓 항) | vitest AttractionPage.test.tsx | 종료 1 · 2 failed \| 73 passed (75) | 「짝이 있고 색인 대상이면 세 줄」, 「어긋난 주소로 와도 문서 언어 기준」 |
| 16 | 키 형식 검사를 줄 단위 `grep -qE '^[0-9a-f]{32}$'` 로(사본) | check-nginx-indexnow.sh | 종료 1 · FAILED | ② `multiline — 기동 실패`, `trailing-newline — 기동 실패`(nginx `[emerg] invalid number of arguments in "location"`). ①·③·semicolon 은 ok |
| 17 | hreflang SSR — 문서 언어 무시(자기=국문 고정) | :search:app AttractionHreflangParityTest + AttractionPageRendererTest | 종료 1 · Parity 3/1 · Renderer 107/1 | Parity `en-document`, Renderer 「영문 문서도 같은 세 줄 — 문서 언어 기준」 |
| 18 | hreflang SSR — noindex 문서도 대체 주소 선언 | 〃 | 종료 1 · Parity 3/0 · Renderer 107/1 | Renderer 「짝이어도 개요가 없어 noindex 면 0줄」(Parity 는 noindex 사례가 없어 초록. 정상) |
| 19 | hreflang SSR — x-default 를 국문으로 | 〃 | 종료 1 · Parity 3/2 · Renderer 107/3 | Parity ko/en-document, Renderer 세 줄·docLang·영문 |
| 20 | hreflang SSR — 짝 줄을 아예 안 냄 | 〃 | 종료 1 · Parity 3/2 · Renderer 107/3 | 19번과 같은 5건 |
| 21 | 상세 feeds 줄 삭제(`[placeFeed(docLang)].slice(1)`) | vitest AttractionPage.test.tsx | 종료 1 · 1 failed \| 74 passed (75) | 「국문 상세는 국문 피드 링크 하나를 단다」 |
| 22 | content hash 필드 하나 빼기 — `parkingFee` | :place:domain AttractionContentHashTest | 종료 1 · tests=9 failures=1 | 「스펙의 순서 그대로다」(필드 목록 단언)**만** |
| 23 | content hash 필드 하나 빼기 — `useFee` | 〃 | 종료 1 · failures=2 | 필드 목록 단언 + 「요금이 바뀌면 다르다」 |
| 24 | 내부 조회 since 경계 포함→제외(`>=`→`>`) | :place:feature PlaceSchemaIntegrationSpec | 종료 1 · tests=15 skipped=0 failures=1 | 「since 는 포함·until 은 제외…」(Testcontainers MySQL 실행, skipped 0) |

합계: 주입 24건. 대상 실행은 33회다(hreflang SSR 4건은 두 스위트를 함께 돌렸다). **빨강 24/24, 끝까지 초록으로 남은 주입 0건.**
- tasks.md TG8 표 15건: 1~6·7·8·9·10(+11)·12·13·14·15·16
- 사용자 지정 추가분: 짝 스위치(6), grep(16), hreflang SSR(17~20), RSS 정렬(12), feeds(21), 해시 필드(22·23), since 경계(24)

## 비고
- **22번은 필드 목록 단언 한 줄만 잡는다.** 이 단언은 `HASH_FIELDS`(대상이 내놓는 값)를 기대 목록과 비교한다. 그래서 `parkingFee` 값만 바뀐 행이 「변경 없음」으로 처리되는 행동을 직접 재는 테스트는 없다. 같은 주입에서 `useFee` 는 행동 테스트(「요금이 바뀌면 다르다」)도 함께 잡았다. 목록 단언이 있어 회귀는 잡히므로 결함은 아니다. 기록만 남긴다.
- **16번은 「조각 없음」 단언보다 앞에서 nginx 기동 실패로 빨강이 됐다.** 여러 줄 값의 첫 줄만 grep 이 통과시키고, 둘째 줄이 location 지시어 안으로 들어가 설정이 깨진다. 스크립트 머리말이 막으려던 바로 그 경로다. 운영에서는 portal-fe 가 모든 호스트에서 내려가는 형태로 드러난다.
- **18번에서 Parity 는 초록이다.** 골든이 짝 있는 색인 문서 두 사례뿐이어서다. noindex 조건은 Renderer 의 짝 케이스가 잡는다. 구현 때 빨강을 못 본 서버 쪽 hreflang(TG4 메모 「Kotlin 쪽 빨강은 TG8 회귀 주입에서 확인」)은 17~20 으로 확인했다. Parity 는 17·19·20 에서, Renderer 짝 케이스는 17~20 모두에서 빨강을 봤다.

## 근거 파일
- `scratchpad/inject-g2/run.py` — 주입 정의·실행기
- `base.out` · `tsc-base.log` — 기준선
- `inj*-{kt,vt,py,sh}.log` — 주입별 출력
- `inj*-failnames.txt` — Kotlin 실패 테스트 이름
- `tsc-inj15.log`·`tsc-inj21.log` — 컴파일 확인
- `rows.tsv`·`rerun-kt.out`·`inj12-24.out` — 결과 행
