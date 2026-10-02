# Test Quality: 광고 형태 (개정 3)

## 시나리오

| id | 층 | 시나리오 | SR | critical |
|---|---|---|---|---|
| U1 | unit | 지면 형태 규격: 형태별 비율·최저가, 같은 형태 중복 거절, 마지막 규격 제거 거절, 최저가 < 1,000 거절 | 1 | ✓ |
| U2 | unit | 유료 캠페인 저장: 규격 없는 (지면, 형태) 거절(문구에 키·형태), CPM 경계 — BANNER 최저 0.05 에 0.05 통과·0.049 거절, CARD 최저 0.10 에 0.05 거절, 두 형태를 받는 지면으로 | 2 | ✓ |
| U3 | unit | 시작 검사(`verifyTargeting`): 규격 제거·인상 뒤 거절 | 1·2 | ✓ |
| U4 | unit | HOUSE 면제: BANNER 전용 지면을 타기팅한 CARD 기본 HOUSE 캠페인 저장·재개 통과 | 2 | ✓ |
| U5 | unit | 소재 내용: `BannerCreativeContent` 대체 텍스트 1~40, 카드 규칙 그대로, `submit` 에서 캠페인 형태와 내용 종류 불일치 거절, 카드↔띠배너 수정 거절, CARD 기본 HOUSE 캠페인에 `HouseCreativeContent` 등록·수정 통과 | 3 | ✓ |
| U6 | unit | 이미지 검사: 두 형태 지면에서 BANNER 캠페인 6.4:1 통과·1.91:1 거절(합집합 판정이면 빨간불), HOUSE 는 어느 규격이든 통과, 6.4:1 헤더 폭탄 거절 | 3 | ✓ |
| U7 | unit | 경매: 한 지면 CARD·BANNER 후보가 eCPM 으로 한 우승자, 형태별 최저가 필터 — `blog-post-end` 에서 eCPM 0.07 BANNER 통과·0.07 CARD 제외 | 4 | ✓ |
| I1 | integration | V4: Flyway target=3 까지 올리고 어드민 지면(비율 둘, 비시드)을 넣은 뒤 V4 → 규격 백필 값·시드 값·옛 컬럼 보존(game-list-banner 는 6.4:1/50000, `paid_allowed` FALSE 유지)·`creative_format` 기본 CARD · 되돌리기 SQL(스펙 SR-8 원본을 `ads/CLAUDE.md` 의 SQL 블록에서 읽어 실행) 뒤 BANNER 소재는 ARCHIVED·`body` 비어 있지 않음, CARD·HOUSE 행 그대로 | 8 | ✓ |
| I2 | integration | `AdsSchemaIntegrationSpec:65-70` 의 「유료 불가 = game-list-banner」 핀은 **고치지 않고 유지** — V4 는 `paid_allowed` 를 켜지 않는다 | 8 | ✓ |
| I3 | integration | 광고주 API: BANNER 캠페인 만들기 → 6.4:1 소재 → 승인 → 결정 응답 `format=BANNER`·`body=''` · 문구만 수정도 형태 검사 · 수정 요청의 형태 필드 무시 | 2·3·4 | ✓ |
| I4 | integration | 인덱스 사전 필터: `blog-post-end` 에서 BANNER eCPM 0.07 남음 · CARD 0.07 제외 · 규격 없는 (지면, 형태) 제외 · 규격 비율과 다른 이미지 제외 · BANNER 행이 (광고주 종류, 캠페인 형태) 변환으로 읽힘 | 3·4 | ✓ |
| I5 | integration | V4 뒤 game-list-banner 결정에 HOUSE 3종 그대로 — `DecisionIntegrationSpec:88` 은 고치지 않고 유지 | 2 | ✓ |
| I6 | integration | 카탈로그: 형태 규격 목록 + 업로드 규칙(형식·바이트·픽셀·허용 오차) + V5 까지 옛 필드(`format`·`aspectRatios`·`floorMicros`)가 대표 규격 값으로 함께 | 2·8 | ✓ |
| I7 | integration | 어드민 규격 추가·최저가 변경·제거, 감사 요약에 형태별 최저가, 옛 컬럼에 대표 규격 쓰기, 옛 컬럼을 다른 값으로 바꿔도 검사·결정은 규격 값을 따름, 응답에 옛 필드 동반·옛 모양 PATCH 는 대표 규격에 | 1·8 | ✓ |
| I9 | integration | 형태 없는 캠페인 생성 요청 → CARD · 광고주 소재 목록이 BANNER 행을 읽음(500 없음) | 2·3·8 | ✓ |
| I8 | integration | BANNER 노출·클릭 과금이 카드와 같은 원장 경로 | 4 | ✓ |
| C1 | component | `parseAd`: format 없음 → CARD, BANNER + 빈 body → 받음, 모르는 값 → 버림 | 5 | ✓ |
| C2 | component | AdSlot BANNER → 띠배너(alt·「광고」 이미지 밖·rel sponsored·리다이렉터), CARD → AdCard, 띠배너 가시 노출 계측 + 음성(50% 미만·1초 미만은 보고 안 함) | 5 | ✓ |
| C3 | component | HouseBanner: 유료 BANNER → 띠배너 + aria「광고」 + fill `PAID`, 없으면 HOUSE + aria「홍보」 | 5 | ✓ |
| C4 | component | 콘솔 형태: 새 캠페인만 선택, 바꾸면 규격 없는 지면 빠지고 알림, 기존 캠페인 읽기 전용 문구, 규격 사라진 선택 해제 가능, 소재 목록 띠배너는 「대체 텍스트」 라벨 | 6 | |
| C5 | component | 업로드: 앞 바이트 형식(빈 MIME PNG 통과, png 확장자 JPEG 헤더 판정), 300KB·2000px(헤더)·비율 실패는 전송 안 함 + 실제/허용 값, 여러 파일 첫 파일, 창 기본 동작 막음, 카탈로그 값이 바뀌면 판정도 바뀐다, 고치기 모드 놓은 파일 취소, 종료 캠페인은 드롭 영역 없음 | 6 | ✓ |
| C6 | component | 어드민 규격 편집 · 심사 화면 띠배너 | 7 | |
| V1 | CDP | 띠배너 360·390·1280 폭 × 라이트·다크: 높이 예약(이미지 로드 전후 레이아웃 이동 0), 「광고」 표시 대비 | 5 | ✓ |
| E1 | 운영 | 띠배너 캠페인 집행(사용자 로그인) → game-list-banner 노출 · 정산 | — | |

## 회귀 주입 (돈·차단 경로 — 빨간불을 본 것만 켰다고 친다)

| 대상 | 주입 | 무는 테스트 |
|---|---|---|
| 형태 최저가 | 규격 최저가 대신 지면 대표(CARD) 최저가 사용 | U2·I4 |
| 형태 최저가 | 두 형태 최저가 중 최솟값 사용 | U2·U7 |
| 비율 | 형태 규격 대신 지면 규격 합집합으로 판정 | U6 |
| HOUSE 면제 | HOUSE 에도 형태 검사 | U4·U5·I5·`AdminApiIntegrationSpec:190-220` |
| 업로드 | 검사 실패에도 전송 | C5 |
| 행 변환 | 광고주 종류만으로 내용 종류 결정 | I4·I9 |
| 시드 | V4 가 `game-list-banner` 의 `paid_allowed` 를 켬 | I1·I2 |
| parseAd | format 없음을 버림 | C1 |
| 업로드 | 헤더 대신 디코딩으로 크기 판정 | C5(폭탄 픽스처) |

## 데이터

- 명명: 단위는 `*Test`(Kotest BehaviorSpec), 통합은 `*IntegrationSpec`(`docs/standards/test-rules.md`)
- `AdminApiIntegrationSpec:190-220` 은 픽스처 인자만 형태 규격으로 바꾸고 단언은 유지

- 도메인·통합 픽스처의 `placement(...)` 빌더를 형태 규격 목록 인자로 바꾼다. 기본값은 CARD 1.91:1 0.10 하나라 기존 테스트 뜻이 유지된다
- 6.4:1 테스트 이미지(1280×200 PNG)와 6.4:1 헤더 폭탄(20000×3125)
- 새 통합 케이스 회원 id 대역 12xxx (`AdsFixtures` KDoc 표에 추가)
