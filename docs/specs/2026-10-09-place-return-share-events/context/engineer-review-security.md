# Engineer Review — security (1라운드)

대상: `spec.md`(SR-1~SR-4) · `docs/adr/ADR-0107-wishlist-collection-share-links.md`
근거 코드: 워크트리 `wt-impl` 기준

## 판정 요약

| 체크 | 결과 |
|---|---|
| 위협 모델링(STRIDE) | 부분 — I(정보 노출)·D(열거) 는 ADR Consequences 에 있음. S(신원 헤더 위조)·E(공개 라우트로 소유자 API 도달) 누락 → #1 |
| 인증/인가 경계 | 부분 — 소유자 API 거부 코드가 403/404 로 미정 → #5 |
| 민감 데이터 흐름 | 부분 — 탈퇴 시 공유 링크 처리 없음 → #3, 저장 의도 재생 범위 → #6 |
| 입력 검증 바운더리 | 부분 — sessionStorage 복원값 검증 미기술 → #6 |
| 서비스 간 통신 | 해당 없음(새 서비스 간 호출 없음) |
| 시크릿/크리덴셜 | 통과 — 토큰은 SecureRandom(ADR-0107 §1), 선례 `ResumeAdminService.kt:128-138` 과 같은 10자 base62 |
| 암호화/해싱 | 통과 — 59비트 무작위 토큰은 해시 저장 불요 수준(아래 #2 계산) |
| 감사 로깅 | 부분 — 열람 원장의 정리 주체·목적이 없음 → #4 |
| Rate Limiting / Abuse | 부분 — 리미터 키가 사실상 전역 → #2 |
| 결제·주문 권한 | 해당 없음 |

로그인 next 검증: **문제 없음.** SR-1.4 는 next 를 바꾸지 않고, `LoginPage.tsx:34` 가 `safeNext`(`auth.ts:102-115`, https + `*.1989v.com` 또는 `//` 아닌 상대 경로)로 거른다. 허브 상태를 주소에 넣지 않는 결정이 next 를 키우지 않아 오히려 안전하다.

404 존재 은닉·소유자 정보 비노출: ADR-0107 §2 와 SR-2.2·SR-4.2 가 없음·폐기·만료·설정 꺼짐을 같은 404 로 묶고 소유자 id·이름을 빼 둔 것은 적절하다. 다만 아래 #1·#3·#5 가 이 은닉을 우회하는 길이다.

## 이슈

### #1 공개 라우트가 신원 헤더를 지우지 않고 메서드·경로가 넓다 (체크: 인증/인가, STRIDE-S·E)
- 스펙: SR-2.3 「공개 라우트 `/api/v1/wishlist/shared/**` 를 인증 필터 예외로」 — 메서드 제한·헤더 제거가 없다.
- 코드: 인증 필터를 걸지 않은 라우트는 클라이언트가 붙인 `X-User-Id` 가 그대로 백엔드에 간다(`GatewayRouteConfig.kt:713-714` 주석). 백엔드는 이 prefix 전체에서 `X-User-Id` 를 신뢰한다(`WishlistController.kt:27-28`). 그리고 `PUT|DELETE /{targetType}/{targetKey}`(`WishlistController.kt:40-45,64-69`)·`PATCH /{targetType}/{targetKey}/collection`(`:181-186`) 이 `/shared/{token}` 모양과 겹친다. 지금은 `parseTargetType("shared")` 가 400 으로 끊어서(`:200-202`) 우연히 막힌다. 나중에 `/shared/**` 아래 매핑이 하나 늘거나 대상 타입 이름이 겹치면, 위조 헤더로 남의 찜을 쓰는 길이 열린다.
- 수정안: SR-2.3 을 이렇게 고친다. 「`GET` 만, 경로는 `/api/v1/wishlist/shared/{token}` 한 세그먼트, `removeRequestHeader("X-User-Id")`·`("X-User-Roles")`·`("Authorization")`(선례 `GatewayRouteConfig.kt:250-258`), `wishlist-service` 라우트보다 앞에 선언(`:360-361`)」. SR-4.2 게이트웨이 테스트에 「`PUT /api/v1/wishlist/shared/x` 는 공개 라우트에 안 걸린다」와 「`X-User-Id` 가 백엔드에 닿지 않는다」를 더하고, SR-4.3 회귀 주입에 「헤더 제거 삭제」를 더한다.

### #2 레이트리밋 키가 사실상 전역 버킷이라 ADR 의 방어선 서술이 과장돼 있다 (체크: Rate Limiting, STRIDE-D)
- 스펙: SR-2.3 「레이트리밋(ADR-0106 단축 경로 선례)」, ADR-0107 Consequences 「토큰 길이·레이트리밋·404 은닉이 방어선」.
- 코드: 선례 `shortLinkLimit` 은 `ipKeyResolver`(`GatewayRouteConfig.kt:41-45`)를 쓰고, 이것은 `remoteAddress` 다(`RateLimiterConfig.kt:14-16`). 같은 파일이 「클러스터 안에서 remoteAddress 는 ingress 파드 IP 하나라 모든 방문자가 한 통을 나눠 쓴다」고 적어 두었다(`RateLimiterConfig.kt:33-35`). 버킷은 100/s·버스트 200 이다(`:55-56`).
- 영향: 열거 방어는 엔트로피만으로 충분하다. 62^10 ≈ 8.4×10^17 이고, 전역 상한 100/s 로 1년(약 3.2×10^9 회)을 시도해도 살아 있는 링크 하나당 적중 확률은 약 4×10^-9 다. 반면 레이트리밋은 열거를 막는 장치가 아니라, 한 사람이 모든 방문자의 `/c/`·공유 열람을 429 로 막을 수 있는 공유 자원이다.
- 수정안: ADR-0107 Consequences 를 「방어선은 토큰 엔트로피(약 59비트)와 404 은닉. 레이트리밋은 부하 상한이고 키가 ingress IP 라 방문자별이 아니다」로 고친다. 방문자별 제한이 필요하면 `adsClientIpKeyResolver` + Host 허용 목록(`RateLimiterConfig.kt:32-44` 선례)을 쓰고, 아니면 단축 경로 선례와 같은 수준이라는 사실만 적는다. 둘 중 어느 쪽인지 스펙에 한 줄 남긴다.

### #3 탈퇴 회원의 공유 링크가 계속 열린다 (체크: 민감 데이터 흐름, STRIDE-I)
- 스펙: ADR-0107 §4 는 「묶음을 지우면 링크도 폐기」만 다룬다. 탈퇴는 언급이 없다.
- 코드: 탈퇴 처리는 찜 항목만 지운다(`MemberEventConsumer.kt:32` → `WishlistRepositoryAdapter.kt:68-70` 은 `wishlistItemJpaRepository.deleteAllByMemberId` 하나). 묶음 행(`V3__collections.sql:7-16`)은 남는다. 「만료 없음」 링크(ADR-0107 §1)라면 탈퇴 뒤에도 회원이 붙인 묶음 이름(자유 문자열 40자)이 로그인 없이 계속 공개된다.
- 수정안: SR-2 에 「`member.withdrawn` 수신 시 그 회원의 `collection_share` 를 폐기(또는 삭제)한다」를 넣고, SR-4.2 Kotest 에 「탈퇴 이벤트 → 토큰 조회 404」를 더한다. 묶음 행 자체가 남는 기존 문제는 이번 범위 밖이라 보고만 한다.

### #4 열람 원장 정리 주체가 없고 수집 목적이 비어 있다 (체크: 감사 로깅·민감 데이터, 방침 숫자 일치)
- 스펙: SR-2.6 「보존 90일(retention CronJob 대상 표에 한 줄, `/privacy` §6 에 한 줄)」.
- 코드: 정리 배치는 이미지별이고 「원장은 그것을 아는 도메인 모듈이 정리한다」(`RetentionRunner.kt:25-28`). CronJob 은 atlas 용 `k8s/base/retention/cronjob.yaml` 과 content 용 `cronjob-content.yaml` 둘뿐이다. wishlist 가 접힌 account 이미지의 정리 배치는 없다. 「표에 한 줄」로는 아무것도 지워지지 않아 방침의 90일이 거짓이 된다(ADR-0077 의 문제 제기 그대로, `ADR-0077-ledger-retention.md:1,90`). 보존기간은 상수·방침·ADR 세 곳에 적힌다(`ADR-0077-ledger-retention.md:104`). 그런데 SR-2.6 에는 ADR-0077 표(`:44-50`)가 빠져 있다.
- 목적: 「공유 열람 통계 화면」이 Out of Scope 라 이 원장을 읽는 곳이 없다. 읽는 곳이 없는 수집은 방침에 목적을 적을 수 없다.
- 수정안: SR-2.6 에 다음을 명시한다. ① account 이미지의 `WishlistRetentionRunner`(profile `retention`)와 `k8s/base/retention/cronjob-account.yaml` ② `RETENTION_DAYS = 90` 상수 ③ ADR-0077 표 한 줄 ④ `privacyRetention.test.ts`(`portal-fe/src/pages/__tests__/privacyRetention.test.ts:52` 이후) 에 대조 케이스. 목적이 정해지지 않았으면 원장을 이번 범위에서 빼는 편이 더 단순하다(YAGNI).

### #5 소유자 아닌 요청의 응답이 403/404 로 미정 (체크: 인증/인가 경계)
- 스펙: SR-4.2 「소유자 아닌 사람 403/404」.
- 코드: 기존 묶음 API 는 남의 묶음에 404 를 낸다(`WishlistService.kt:131-133`). 묶음 id 는 AUTO_INCREMENT 라(`V3__collections.sql:8`) 403 을 내면 「그 id 의 묶음이 있다」가 드러난다.
- 수정안: 「404 하나」로 고정하고, 테스트는 없는 id 와 남의 id 의 응답이 같은지(상태·본문)를 본다.

### #6 저장 의도 재생 범위·복원값 검증 미기술 (체크: 입력 검증, STRIDE-T)
- 스펙: SR-1.1 은 의도에 `targetKey` 와 시각만 남긴다. SR-1.3 은 로그인 복귀 시 그 키로 PUT 을 보낸다.
- 코드: 별 버튼은 한 컴포넌트가 네 타입을 다룬다(`FavoriteButton.tsx:15-16,62-63`). apex 한 호스트에 상점·공유 화면 등 여러 타입의 별이 같이 있다. 타입 없이 키만 남기면 다른 타입 화면이 그 키로 PUT 할 수 있다. 사용자가 누르지 않은 대상이 찜되는 무결성 문제다.
- 민감도: 의도(대상 키)와 허브 상태(검색어·필터·선택 id)는 탭 범위 sessionStorage 에 10분만 남고 토큰·회원 정보가 없다. 저장 자체는 허용 가능하다. 다만 복원값은 외부 입력과 같이 다뤄야 한다(같은 오리진 스크립트라면 누구나 쓸 수 있다).
- 수정안: ① 의도에 `type` 을 넣고, 재생은 같은 `type` 의 `useFavorites` 만 한다. ② 키 형식이 그 타입 규칙에 맞지 않으면 버린다. ③ 허브 상태 복원은 URL 파라미터와 같은 파서·허용값 검사를 거친다. 모양이 틀리면 통째로 버리고 지운다. ④ `clearLocalSession`(`auth.ts:59-67`)에서 두 키를 지운다. SR-4.1 vitest 에 「다른 type 의도는 PUT 0회」와 「모양이 틀린 상태는 복원 안 함」을 더한다.

## 참고(비차단, 이슈 수에 넣지 않음)
- 공개 응답의 `addedAt`(SR-2.2)은 소유자의 활동 시각이다. 화면이 쓰지 않으면 빼거나 날짜 단위로 줄이는 편이 소유자 정보 비노출 취지에 맞다.
- 묶음 이름은 소유자가 쓴 자유 문자열이다. 수신자 화면은 텍스트로만 렌더하고(`dangerouslySetInnerHTML` 금지), `useSeo` title 에 넣으면 noindex 라도 공유 미리보기에 그대로 실린다는 점을 의식한다.
- 토큰이 경로(`/shared/{token}`, `/c/{token}`)에 실려 ingress 접근 로그에는 IP 와 함께 남는다. 원장에 IP 를 안 남긴다는 ADR-0107 §6 서술은 원장 한정이라는 점을 방침 문구에서 혼동하지 않게 한다.

VERDICT: REVISE
