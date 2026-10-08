# Engineer Review — security (1라운드)

- 대상: `docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md`
- 체크리스트: `hns/0.15.1/.../reviewers/security/checklist.md` (0.16.1 경로 없음)

## 위협 모델 (STRIDE 요약)
| 자산 / 경로 | 위협 | 현재 스펙 | 판단 |
|---|---|---|---|
| IndexNow 키 | Spoofing — 키를 아는 누구나 이 호스트 URL 을 제출 | Secret 마운트(`spec.md:27`) | 키는 설계상 공개 파일이라 피해는 「크롤 요청 유발」뿐. 낮음 |
| 키 파일 location | Information disclosure / 다른 호스트로 누출 | 미정 | S2 |
| `/feed.xml` | Tampering(XML 주입), DoS(요청마다 색인 조회) | 이스케이프 테스트만(`spec.md:32`) | S3·S5 |
| `/internal/render/feed.xml` | 우회 호스트 노출 | 상세 SSR 선례 | OK — 게이트웨이 라우트 밖, 우회 호스트 `/internal/**` 404 실측(`ADR-0103-…:22,25,67`) |
| ingest → api.indexnow.org | 새 egress | place-ingest 는 이미 :443 허용 | S4 |

## Findings

### S1. 키가 두 파드에 같은 값으로 가야 하는데 한쪽만 적혀 있다
- 스펙: `spec.md:27`(nginx 가 Secret 마운트로 키 파일), `spec.md:28`(ingest 가 제출 — 요청 본문에 `key` 필요)
- 근거: 키 파일은 portal-fe nginx(`portal-fe/nginx.conf` 가 모든 호스트를 서빙), 제출은 place-ingest 파드(`k8s/base/place-ingest/cronjob-*.yaml`). 값이 다르면 IndexNow 가 403 을 낸다.
- 수정안: 「한 Secret(예: `place-indexnow`) — SealedSecret 으로 레포에 암호문만 — 을 portal-fe(파일 마운트)와 place-ingest(env) 가 함께 참조」로 명시. 키를 로그에 쓰지 않는다(요청 본문 로그 금지)도 한 줄.

### S2. 키 파일 location 은 place 호스트 전용·정확 일치여야 한다
- 근거: 행사 sitemap 은 place 호스트 외 404(`portal-fe/nginx.conf:68,76-78`). 키 파일을 `location ~ \.txt$` 같은 넓은 규칙으로 열면 다른 호스트(apex·blog)에도 같은 키 파일이 생기고, 마운트 디렉터리의 다른 파일까지 노출될 수 있다.
- 수정안: nginx 템플릿 치환(`${NGINX_LOCAL_RESOLVERS}` 와 같은 방식, `nginx.conf:79`)으로 `location = /${INDEXNOW_KEY}.txt` 정확 일치 + `if ($host != "place.1989v.com") { return 404; }` + `default_type text/plain`. 키가 비어 있으면 location 을 만들지 않는다(ads.txt 의 「빈 값 = 없음」 원칙, `nginx.conf:107-116`).

### S3. RSS 의 XML 안전성 — 이스케이프만으로 부족한 문자
- 근거: 원천 텍스트에는 태그·엔티티가 섞인다(`AttractionSeoText.kt:43-45`). 기존 `escapeHtml` 은 `'` 를 이스케이프하지 않고 HTML 용이다(`AttractionSeoText.kt:70-78`). XML 1.0 은 U+0000–U+001F(탭·LF·CR 제외) 제어문자가 하나만 있어도 문서 전체가 파싱 실패한다 — `sourceText` 는 숫자 엔티티 제어문자만 지우고 날 제어문자는 남긴다(`AttractionSeoText.kt:53-57`).
- 수정안: SR-3 에 「`sourceText` → XML 1.0 금지 문자 제거 → XML 이스케이프(& < > " ')」 순서를 고정하고, SR-5.1 RSS 테스트에 「제어문자 포함 제목 → 유효 XML」 사례를 더한다. 링크는 id 로 조립한 내부 주소만(렌더 선례 `AttractionPageRenderer.kt:41`).

### S4. 송신 대장·네트워크 정책 문서 갱신
- 근거: place-ingest 는 이미 외부 :443 허용 목록에 있다(`k8s/base/network-policy/11-allow-egress-https-public.yaml:11-13,33`) — 정책 변경은 불요. 다만 이 파일의 용도 주석과 대장(`spec.md:29`)이 함께 가야 「무엇을 밖으로 보내나」가 한곳에서 보인다.
- 수정안: 정책 주석 11행에 「+ IndexNow 송신(api.indexnow.org)」을 더하는 것을 태스크에 넣는다. 보내는 것은 공개 URL 과 공개 키뿐임을 대장 행에 적는다(개인정보 없음).

### S5. 피드 엔드포인트 부하
- 근거: 요청마다 search 가 정렬 조회 한 번(`spec.md:23`). Cloudflare 는 기본적으로 `.xml` 을 캐시 대상 확장자로 보지 않아 `max-age=600` 이 엣지 캐시를 보장하지 않는다(추정 — 운영 확인 필요).
- 수정안: 50건·한 언어 고정이라 조회 비용은 작다. 수용하되 search 쪽 결과 메모리 캐시(예: 10분)나 nginx `proxy_cache` 중 하나를 고를지 스펙에 「측정 뒤」로 남긴다(조기 최적화 금지 원칙 — 지금은 넣지 않아도 됨).

## 체크 항목
| 항목 | 결과 |
|---|---|
| 위협 모델링 | 위 표 — 스펙에는 없음, S1~S5 로 보완 |
| 인증/인가 경계 | 피드·키 파일·SSR 은 공개, 렌더는 내부 경로 — OK |
| 민감 데이터 흐름 | PII 없음. 키는 S1 |
| 입력 검증 | S3. nginx 는 고정 upstream 경로(`nginx.conf:69-70`) |
| 서비스 간 통신 | portal-fe → search 기존 정책 재사용(`ADR-0103-…:57`) |
| 시크릿 관리 | S1·S2 |
| 암호화/해싱 | SHA-256 은 변경 감지용(보안 목적 아님) — 적절 |
| 감사 로깅 | 제출 건수·응답 코드 로그(`spec.md:28`) — 충분 |
| 결제·주문 | 해당 없음 |
| Rate limiting | S5 |

VERDICT: REVISE
