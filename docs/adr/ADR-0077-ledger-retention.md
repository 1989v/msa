# ADR-0077 — 원장 보존기간: 방침에 적은 기간을 실제로 지우는 것이 있어야 한다

- 상태: 채택 (2026-08-22)
- 관련: ADR-0076(AdSense·개인정보처리방침 — 이 결정의 계기), ADR-0072(블로그 조회 원장),
  ADR-0069(혜택 링크 클릭 원장·linkcheck 배치), ADR-0064(이력서 열람 기록),
  ADR-0031(NetworkPolicy), ADR-0019(K8s 배포 모드)

## 맥락

ADR-0076 에서 개인정보처리방침을 쓰다가 **적을 수 있는 보관 기간이 없다**는 것이 드러났다.
초안에는 "접속 기록 1년 파기"라고 썼는데 두 겹으로 틀렸다 — 접속 기록(IP)을 애초에 어느
테이블에도 저장하지 않고, 1년이라는 주기도 근거가 없었다.

실측한 저장 구조는 이렇다.

| 원장 | 식별자 | 성격 |
|---|---|---|
| `blog_post_view` | `visitor_key` = 게이트웨이 발급 무작위 UUID (`VisitorIdFilter`) | 하루 1표 중복 방지 + 일별 추이 |
| `deal_offer_click` | 없음 (`referrer_host`, `ua_family`) | 클릭 통계 |
| `resume_access_log` | 없음 (`share_link_id`, `slug`) | 제출처가 열었는지 확인 |
| `game_rating.device_id` | localStorage 무작위 UUID | 평점 본체 — 정리 대상 아님 |

IP 는 `RateLimiterConfig` 의 Redis 키로만 쓰이고 TTL 로 만료된다. 서버 접속 로그는 컨테이너
표준출력뿐이고 별도 저장소에 적재하지 않는다. **어느 원장에도 IP·UA 원문이 없다.**

무작위 UUID 단독으로는 개인을 특정하지 못하니 엄밀히는 가명정보에 가깝다. 그래도 개인정보로
취급한다 — 같은 브라우저에 로그인 세션과 방문자 쿠키가 함께 있으면 "다른 정보와 쉽게 결합"할
여지가 생기고(개인정보보호법 2조 1호 나목), `blog_post_like.voter_key` 는 MEMBER 타입일 때
아예 회원 id 다.

정리 로직의 실태는 갈렸다.

- `deal_offer_click` — 90일, **자동으로 돈다** (`DealLinkCheckRunner` 가 링크 점검 겸 호출).
- `blog_post_view` — `RETENTION_DAYS = 90` 상수와 `purgeOlderThan` 이 있는데 **호출자가 없다.**
  주석의 "어드민에서 수동 실행"조차 그 엔드포인트가 없었다. 무기한 누적.
- `resume_access_log` — 정리 경로 자체가 없었다.

## 결정

### 1) 보존기간은 원장마다 다르다 — 근거가 다르기 때문이다

| 원장 | 보존기간 | 근거 |
|---|---|---|
| `blog_post_view` | 90일 | 중복 방지에는 하루면 되고, 남기는 값은 일별 추이다. 분기 단위로 충분하다 |
| `deal_offer_click` | 90일 | 위와 같음 (기존 값 유지) |
| `resume_access_log` | 365일 | **통계가 아니다.** 지원부터 결과까지 몇 달씩 걸리므로 90일이면 진행 중인 건의 기록이 사라진다 |

이력서 열람 기록을 길게 두는 데는 대가가 있다 — 이 원장이 링크별 방문 수 통계의 원본이라
(별도 누계 컬럼이 없다) 정리한 만큼 어드민 화면의 방문 수가 줄어든다. 보존기간을 지원
주기보다 길게 잡은 이유가 이것이다.

숫자를 하나로 통일하지 않았다. 통일하면 짧은 쪽에 맞추거나(이력서 기록이 쓸모를 잃는다)
긴 쪽에 맞춰야(조회 원장을 필요 이상으로 오래 쥔다) 한다.

### 2) 전용 CronJob 을 만든다 — `deal-linkcheck` 에 얹지 않는다

`deal-linkcheck` 에 얹으면 파드가 늘지 않아 매력적이다. 그러나 그 CronJob 은
**외부 `:443` egress 가 열린 유일한 배치**다 (network-policy/11). 네트워크가 필요 없는
정리 작업에 그 권한을 함께 주게 된다.

`retention` 은 그 화이트리스트에 없다. DB 만 만진다.

상주 비용은 여전히 0 이다 — code-dictionary 이미지를 그대로 띄웠다 내린다. 앞으로 생길
원장 정리는 전부 여기 모은다.

```
--spring.main.web-application-type=none
--spring.profiles.active=kubernetes,retention
```

일요일 05:00 UTC(14:00 KST). `deal-linkcheck`(04:00 UTC)보다 한 시간 뒤 — 같은 이미지를
띄우는 배치 둘이 겹치면 단일 노드에서 메모리가 함께 뛴다. 게임 주간 통계 리셋
(월요일 00:00 KST = 일요일 15:00 UTC)과도 떨어뜨렸다.

### 3) 원장 하나가 실패해도 나머지는 돈다

`runCatching` 으로 원장마다 격리하고 결과를 한 줄로 남긴다.

한 원장의 실패가 배치 전체를 멈추면 다음 주까지 두 원장이 같이 쌓여 **보존기간이 조용히
두 배가 된다.** 방침에 적은 기간과 실제가 어긋나는 경로가 정확히 여기라, 격리를 테스트로
고정했다 (`RetentionRunnerSpec`).

### 4) 방침에는 실제로 도는 것만 적는다

`/privacy` 6항의 숫자는 이 배치가 지우는 값과 같아야 한다. 한쪽만 고치면 방침이 거짓이 된다.
보존기간을 바꾸려면 상수·방침·이 문서를 함께 고친다.

## 결과

**켜짐**

- 방침의 보관 기간에 근거가 생겼다. "90일 보관 후 자동 삭제"가 실제로 참이다.
- `blog_post_view` 가 더 이상 무기한 누적되지 않는다.
- 외부 egress 권한과 정리 작업이 분리됐다.

**대가**

- CronJob 이 하나 늘었다 (상주 파드는 아니지만 관리 대상이다).
- 이력서 어드민의 링크별 방문 수가 1년 지나면 줄어든다. 누계가 필요해지면 별도 컬럼이 필요하다.
- 보존기간이 세 곳(상수·방침·ADR)에 적혀 있다.

**되돌리기**

`k8s/base/kustomization.yaml` 에서 `retention` 을 빼면 배치가 멈춘다. 코드는 남아 있어도
`retention` 프로파일이 활성화되지 않으면 러너가 뜨지 않는다. 다만 그때는 방침 6항의
숫자도 함께 되돌려야 한다.

## 구현 위치

| 무엇 | 파일 |
|---|---|
| 배치 러너 · 이력서 보존기간 | `code-dictionary/app/.../infrastructure/retention/RetentionRunner.kt` |
| 실패 격리 테스트 | `code-dictionary/app/src/test/.../retention/RetentionRunnerSpec.kt` |
| 블로그 조회 원장 보존기간·정리 | `blog/feature/.../application/service/BlogViewService.kt` |
| 이력서 열람 원장 정리 | `code-dictionary/app/.../resume/port/ResumePorts.kt` + 어댑터/JPA |
| 혜택 클릭 원장 정리 (기존) | `deal/feature/.../linkcheck/DealLinkCheckRunner.kt` |
| CronJob | `k8s/base/retention/` |
| 방침 본문 | `portal-fe/src/pages/PrivacyPage.tsx` §6 |
