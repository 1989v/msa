# Review Verdict — 개정 1 (2026-09-27)

심판: `hns:review-verdict` (읽기 전용이라 이 파일은 메인이 판정 원문을 옮겨 적었다). 입력 41건(A 7 · D 7 · I 6 · R 3 · 테스트 전략 T-F1~F8 · 유스케이스 U-F1~F10).

**SUMMARY: keep 41 / demote 0 / dismiss 0.** 모든 인용 코드를 심판이 직접 확인했다. T-F2 의 「옛 파드 인덱스 갱신이 NPE 로 통째 실패」만 틀렸다 — 소재 행 변환은 `skipInvalid` 안이라 그 행만 빠진다(`CandidateSourceAdapter.kt:77,105-110`). 목록 API 500 은 I-4 대로 맞다(`CreativeService.kt:47`).

| id | 판정 | 등급 | 묶인 주제 |
|---|---|---|---|
| A-1 · D5 · I-1 · U-F2 | keep | REVISE | ① HOUSE 면제 |
| A-2 · I-2 · I-3 | keep | REVISE | ② 옛 지면 컬럼 쓰기·배포 겹침 (I-3b 배포 중 지면 생성은 고유) |
| A-3 · I-5 · U-F8 · T-F2 | keep | REVISE | ③ format 없음 = CARD + 릴리스 순서 |
| I-4 · T-F2 | keep | REVISE | ④ body `''` + 되돌리기 |
| D3 · A-7 · I-6 · R-3 · U-F4 | keep | REVISE (I-6·A-7 MINOR) | ⑤ 형태 잠금 강제 위치·동시성 |
| D4 · A-7 | keep | REVISE | ⑥ BANNER 내용 모델 |
| D6 · A-4 · U-F10 | keep | REVISE | ⑦ 형태 규격 소속·로더 하나·제거 효과 |
| U-F1 · U-F3 · U-F9 | keep | REVISE (U-F3·U-F9 MINOR) | ⑧ 콘솔 선택 정리·문구 |
| R-2 · A-5 · U-F5 | keep | REVISE (A-5 MINOR) | ⑨ 클라이언트 사전 검사 |
| R-1 · U-F6 · U-F7 | keep | REVISE (U-F7 MINOR) | ⑩ 띠배너 표시·접근성·밀림 |
| D1 · D2 · D7 · A-6 | keep | REVISE (D7·A-6 MINOR) | ⑪ 용어집·이름 |
| T-F1 · T-F3 · T-F4 · T-F5 · T-F6 · T-F7 · T-F8 | keep | REVISE (T-F7 MINOR) | ⑫ 테스트 계획 |

## 개정 2 에서 고른 방향 (메인)

- ⑤ 대안 중 단순한 쪽 — **형태는 만들 때 정하고 바꿀 수 없다**. 소재 수와 무관하므로 두 애그리거트에 걸친 불변식과 잠금이 사라진다. 소재 등록·수정(이미지 없는 수정 포함)은 캠페인 형태로 내용 종류를 검사한다
- ④ `body` NOT NULL 유지, BANNER 는 `''`
- ③ 백엔드와 FE 를 **다른 푸시**로 낸다(같은 푸시면 두 이미지가 동시에 롤아웃돼 순서를 보장할 수 없다)
- ⑩ 밀림 없음은 이미지 로딩에 한정 — 결정 대기 중 동작은 지금과 같다(범위를 좁힘)
- ⑪ `PlacementFormat` 은 이름을 유지하고 KDoc 을 「광고 형태」로 고친다. 규격 VO 는 `FormatSpec`

# Review Verdict — 개정 2 (2차)

보안·도메인 SHIP, 나머지 REVISE. 심판 판정 **keep 14 / demote 0 / dismiss 0**(보안 0건).

| 주제 | 항목 | 등급 | 개정 3 반영 |
|---|---|---|---|
| 소재 행 변환 판별자 | arch R2-1 · impl R2-2 | REVISE | SR-3 (광고주 종류, 캠페인 형태) 변환 하나 |
| 유료 내용 상위 타입·검사 위치·HOUSE 짝 | arch R2-2 · domain N1·N2 · test R2-1 | REVISE/MINOR | SR-3 `PaidContent`, `submit` 한 곳, SR-2 HOUSE 짝, SR-9 |
| ①~② 창 | impl R2-3 · usecase R2-1 · arch 참고 | REVISE/MINOR | SR-8 옛 필드 동반·옛 PATCH·형태 없는 생성=CARD, game-list-banner 유료는 ②' 에서, API BANNER 창 수용 |
| 되돌리기 | impl R2-1 | REVISE | SR-8 ARCHIVED + `body = title` |
| 테스트 픽스처·음성 | test R2-2 · R2-3 | REVISE/MINOR | test-quality U7·I4 0.07 쌍, I7·I9, C2 음성, C4·C5, 주입표, 명명 |
| 콘솔 안내 | usecase R2-2·R2-3 | MINOR | SR-6 종료 캠페인 드롭 숨김·모바일 56px·DRAFT 종료 안내 |

# 3차 (개정 3)

아키텍처 SHIP · 구현 SHIP(R3-1 서술 정정 반영) · 유스케이스 REVISE MINOR 1(R3-1 DRAFT 종료 안내 → 리뷰어 수정안 (b) 문장 삭제 반영) · 테스트 전략 REVISE MINOR 3(I2 핀 유지·I6 옛 필드·되돌리기 SQL 검증 → 리뷰어 수정안대로 반영). REVISE 2회 상한을 넘었으므로 규칙상 사용자에게 보고하고 진행 여부를 받는다 — 남은 것은 리뷰어 자신의 수정안을 그대로 옮긴 문장·표 행뿐이라 재리뷰 없이 반영했다.
