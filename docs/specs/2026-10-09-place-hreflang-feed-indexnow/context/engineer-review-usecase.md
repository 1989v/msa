# Engineer Review — usecase (1라운드)

- 대상: `docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md`
- 체크리스트: `hns/0.15.1/.../reviewers/usecase/checklist.md` (0.16.1 경로 없음)

## 액터·목표 (스펙에서 재구성)
| 액터 | 목표 | 스펙 근거 |
|---|---|---|
| 검색엔진 크롤러(구글) | 국·영 상세를 같은 장소의 언어판으로 묶는다 | `spec.md:15` |
| IndexNow 참여 엔진(Bing·Naver 등) | 바뀐 주소만 빨리 다시 가져간다 | `spec.md:28` |
| RSS 구독자·수집기 | 최근 갱신 50건 | `spec.md:23` |
| 운영자(사용자) | 확인 뒤 IndexNow 켜기 | `spec.md:28`, `context/open-questions.yml:2-6` |
| 배치(place-ingest·search:batch) | 시각 기록·짝 계산·송신 | `spec.md:12,19,28` |

액터 표가 스펙에 없지만 위처럼 복원된다. U1~U5 가 보완점이다.

## Findings

### U1. 계획의 완료 기준 「hreflang 오류 0」이 AC 로 옮겨지지 않았다
- 계획: `docs/plans/2026-10-08-place-growth-work-plan.md:98`(S3-5 완료 = hreflang 오류 0), `:103`(S3-9 = 올바른 변경 URL 제출·응답 처리)
- 스펙: `spec.md:34` 는 표본 3곳 존재 확인뿐이다. 「오류」의 정의(상호 링크, 양쪽 200, 양쪽 색인 대상, 자기 canonical 일치, x-default 대상 존재)가 없다.
- 수정안: SR-5.3 에 「운영 전수 검사: `alternateId` 가 있는 모든 문서에 대해 상대 문서의 `alternateId` 가 자기를 가리키고, 양쪽 모두 noindex 가 아님」을 색인 질의 하나로 세는 AC 를 더한다(0이 통과). noindex 쪽을 가리키는 경우는 implementation I5.

### U2. 예외·대안 흐름이 비어 있다
| 흐름 | 지금 스펙 | 정해야 할 것 |
|---|---|---|
| 짝의 한쪽이 INACTIVE·삭제됨 | 없음 | 재색인이 ACTIVE 만 투영하므로(`AttractionApiReindexTasklet.kt:399`) 자동으로 풀린다 — 정적 sitemap 은 다음 FE 빌드까지 남는다(`prerender-seo.mjs:816-826`). 수용 여부를 적는다 |
| `/en/attractions/{국문id}` 처럼 어긋난 주소 | 없음 | 문서 언어 기준으로 canonical 을 잡는 기존 규칙(`AttractionPage.tsx:150-152`, `ADR-0062-…:139-140`)을 hreflang 에도 적용한다고 명시 |
| 새 관광지 등록 | 없음 | 새 URL 이 IndexNow·RSS 에 나가는지 — domain D3 |
| ACTIVE → INACTIVE(페이지 404) | 없음 | IndexNow 는 사라진 URL 도 알리는 용도다. 해시는 상태를 안 보므로(`spec.md:19`) 안 나간다 — 의도라면 Out of Scope 에 한 줄 |
| RSS 조회 실패 | 없음 | 503(빈 200 금지 — `nginx.conf:71-74` 선례) |
| IndexNow 400/403/422/429·타임아웃 | 200·202·「그 밖」(`spec.md:28`) | 403 = 키 불일치라 운영자가 봐야 한다 — 로그 문구를 구분 |
| 바뀐 관광지 0건 | 없음 | 요청을 보내지 않고 「0건」 로그 |
| 첫 실행(전량 첫 채움) | `spec.md:18` | 첫날 IndexNow 대상 0건이 정상이라는 기대값을 배포 확인에 적는다 |

### U3. 사전·사후 조건
- 사전: 키 Secret 이 두 파드에 같은 값(security S1), 재색인이 끝난 뒤 송신(implementation I3), place 가 search:batch 보다 먼저 배포(새 응답 필드 — `ADR-0103-…:77` 의 순서 선례).
- 사후: 「켜진 상태에서 제출한 URL 은 그 시점에 이미 새 본문을 SSR 로 낸다」 — 지금 스케줄(tour-sync UTC 18:10 `cronjob-tour-sync.yaml:26`, 재색인 UTC 21:30 `cronjob-attraction-reindex.yaml:21`)로는 성립하지 않는다.
- 수정안: SR-4 에 두 조건을 적는다.

### U4. 운영자 흐름(Q1)이 열려 있다
- `context/open-questions.yml:3-6` — 「마지막에 사용자 확인」. 켜는 절차(어느 매니페스트의 `INDEXNOW_ENABLED`, 켠 뒤 첫 실행에서 볼 로그 줄, 되돌리기)를 스펙 끝에 3줄로 두면 사용자 몫이 한 번에 끝난다.

### U5. x-default = en 의 근거
- 스펙: `spec.md:15`. 허브 헬퍼도 x-default 를 영문으로 둔다(`portal-fe/src/seo/copy.mjs:541-546`) — 일관성은 맞다. 다만 계획의 90일 타깃은 국내 자유여행자다(`work-plan.md:49` D-1 ⓐ). 허브와 같은 규칙을 따른다는 한 줄이면 충분하다.

### U6. 엣지 사례 확장 — 오라클 밖
- 한 영문이 국문 여럿과 맞는 아울렛 매장(placeId 공유, `s1-8-place-id-pairs.md:77-79,85-87`) — 일대일 조건이 막는다. OK.
- 대표점이 50m 를 넘는 긴 항구·해변(`s1-8-place-id-pairs.md:112`) — 짝을 놓친다(재현율 손실, 오류 아님). 수용으로 명시.
- 영문 `titleLocal` 없음(300 중 5건, `s1-8-place-id-pairs.md:12`) — 제목 조건을 더하면 짝 없음.

## 체크 항목
| 항목 | 결과 |
|---|---|
| 액터-목표 | 복원 가능, 표 없음 — 위 표를 스펙에 |
| 주/대안/예외 흐름 | U2 |
| 사전/사후 조건 | U3 |
| AC 추적 | U1 |
| 엣지 사례 | U2·U6 |
| 테스트 매핑 | SR-5 에 있음(`spec.md:31-34`) — test-strategy T1·T3 보완 |

VERDICT: REVISE
