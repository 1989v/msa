# Engineer Review — security (round 1)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md` (origin/main a05ab2765 작업 트리)
체크리스트: hns 0.16.1 `spec-review/reviewers/security/checklist.md`

## 결론

차단·수정 이슈 없음. 리더가 짚은 세 위험(원천 대장 누출, 사용자별 응답에 ETag, 304 의 타인 본문 재사용)은 모두 현재 코드·스펙 결정으로 닫혀 있다. 아래 참고 2건은 비차단이며 판정에 넣지 않는다.

## 1. 원천 대장 → 공개 페이지 (Information Disclosure)

- 공개 범위는 대장 §1 표의 데이터·원천·라이선스 세 열이다 (spec.md:4 결정 ②, spec.md:13). 키·적재 경로 열은 빠진다.
- 대장 `docs/architecture/data-sources.md:66-97` 를 행마다 확인했다. 환경변수 이름(`TOUR_API_KEY` :78-85, `OPINET_API_KEY` :97)은 전부 **키 열**에만 있다. 내부 경로(`place/ingest --job=…`, `tools/seed/...`, `weather_grid.py`)와 호출 횟수·한도는 전부 **적재 경로 열**에만 있다. 두 열 모두 공개 대상이 아니다.
- 원천 열에 남는 것은 data.go.kr 데이터셋 번호(예: 15101897)와 오퍼레이션 이름(`detailCommon2` 등)이다. 둘 다 공공데이터포털에 공개된 값이라 비밀이 아니다.
- Secret 이름·클러스터 주소는 §1 표 어느 열에도 없다.
- 데이터는 TS 상수이고 대장은 테스트에서만 읽는다 (spec.md:14-15). 빌드 산출물에 대장 원문이 실리지 않는다.

판정: 누출 경로 없음.

## 2. ETag 가 사용자별 내용에 붙는가 (캐시 오염)

- 상세 SSR 로 가는 nginx location 은 업스트림 요청에서 쿠키와 인증 헤더를 비운다 (`portal-fe/nginx.conf:199-200`, 의도 주석 :188-189). search 는 로그인 상태를 볼 수 없다.
- 컨트롤러 입력은 경로의 숫자 id 와 언어뿐이다 (`AttractionPageController.kt:22-26`). 요청 헤더·쿠키·세션 파라미터를 받지 않는다.
- Host 도 본문 입력이 아니다. 변수 `proxy_pass` 에 `proxy_set_header Host` 가 없어 search 는 늘 같은 내부 호스트를 받는다 (`nginx.conf:195-196`).
- 본문의 시간 의존은 KST 오늘 날짜 하나다 (`AttractionPageService.kt:35`). 모든 사용자에게 같고, 날이 바뀌면 해시가 바뀌어 재검증이 새 본문을 받는다.
- 셸에 번들 해시 파일명이 들어가므로 배포 뒤에도 ETag 가 바뀐다. 스펙이 해시 대상을 "본문 바이트"로 정한 것(spec.md:27)이 이것을 보장한다.
- HTML 은 엣지 캐시 대상이 아니다 (`docs/adr/ADR-0105-place-public-read-edge-cache.md:40`). 이 경로는 게이트웨이를 거치지 않아 `Set-Cookie` 도 붙지 않는다. Cloudflare 설정 변경은 범위 밖이다 (spec.md:39).

판정: ETag 가 붙는 응답은 사용자와 무관한 공개 본문뿐이다.

## 3. 304 가 다른 사용자의 본문을 재사용하는가

- 304 는 본문을 보내지 않는다. 클라이언트는 **자기 캐시**의 본문을 쓴다. 공유 캐시는 위 2절대로 HTML 을 쥐지 않는다.
- 같은 URL 의 본문이 사용자마다 같으므로(2절), 어느 캐시가 쥔 사본이든 내용이 같다.
- 약한 비교(`W/"x"`) 수용(spec.md:28)은 RFC 9110 의 If-None-Match 규칙과 맞다. nginx gzip 이 강한 ETag 를 약하게 바꾸는 표현 차이만 흡수하고, 내용이 다른 본문을 같게 보지 않는다.
- 404·셸 폴백에는 ETag 를 달지 않는다 (spec.md:27). 폴백 셸이 정상 본문의 ETag 로 고정되는 경로가 없다.
- 업스트림 5xx 때 nginx 가 내는 `index.html`(`nginx.conf:205-212`)은 nginx 정적 ETag 를 쓴다. SSR 해시와 값 공간이 달라 우연 일치로 304 가 나지 않는다.
- nginx 는 304 를 가로채지 않는다. `error_page` 는 500·502·503·504 만 잡는다 (`nginx.conf:201-202`).

판정: 타인 본문 재사용 경로 없음.

## 4. 나머지 체크리스트

| 항목 | 판정 | 근거 |
|---|---|---|
| STRIDE | 해당 위협 없음 | 새 쓰기 경로·인증 경계 없음. 공개 읽기 페이지와 응답 헤더 추가뿐 |
| 인증/인가 경계 | 변화 없음 | `/data-sources` 는 `/about`·`/contact` 와 같은 공개 정적 location (spec.md:12, `nginx.conf:145-149`) |
| 민감 데이터 흐름 | 해당 없음 | PII·토큰이 새 경로에 들어오지 않는다 (2절) |
| 입력 검증 | 기존 그대로 | id 는 nginx `[0-9]{1,12}`(`nginx.conf:192`)와 컨트롤러 정규식(`AttractionPageController.kt:50`) 두 겹. If-None-Match 파싱은 Spring 몫이고 ETag 값은 16자 hex 라 헤더 주입 여지가 없다 |
| 서비스 간 통신 | 변화 없음 | `/internal/render` 는 게이트웨이 라우트 밖 (`AttractionPageController.kt:14-15`) |
| 시크릿 관리 | 해당 없음 | 새 시크릿 없음 |
| 해싱 | 적절 | SHA-256 앞 16자는 무결성이 아니라 변경 감지용이라 충분하다 |
| 감사 로깅 | 해당 없음 | 공개 읽기 |
| Rate Limiting / DoS | 영향 없음 | 해시는 렌더 뒤 한 번이라 추가 비용이 렌더에 비해 무시할 수준이다 |
| 결제·주문 | 해당 없음 | |

## 참고 (비차단, 판정 미반영)

1. **프리렌더 표 이스케이프**: `/data-sources` 프리렌더 본문(spec.md:24)을 만들 때 기존 관례대로 셀마다 `escapeHtml` 을 쓴다 (`portal-fe/scripts/prerender-seo.mjs:376`, 바닥글 선례 :472). 값은 레포 상수라 신뢰 입력이지만, 대장 문구가 `<`·`&` 를 담게 되면 마크업이 깨진다.
2. **대장 문구를 그대로 옮기는 범위**: 라이선스 열에는 내부 메모 성격의 문구가 섞여 있다 (`data-sources.md:75-77` 의 `cpyrhtDivCd` 필드명, :88 의 "포털 표기 미확인"). 비밀은 아니라 보안 이슈는 아니다. 공개 문구로 적절한지는 도메인 차원의 판단이다.

VERDICT: SHIP
