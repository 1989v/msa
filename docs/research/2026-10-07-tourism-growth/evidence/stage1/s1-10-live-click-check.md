# S1-10 보충 — 비로그인 찜 클릭 실측 (CDP)

- 측정: 2026-10-08 04:4x KST, 헤드리스 Chrome(세션 스크래치패드 프로필, `scripts/cdp-chrome.sh` start → 측정 → stop), Node 22 CDP, 뷰포트 1280, 페이지 로드 8초 대기 → 찜 버튼 `click()` → 5초 뒤 `Page.getNavigationHistory` 의 현재 URL
- 왜 보충인가: 코덱스 S1-10 은 샌드박스에서 Chrome 이 `SIGABRT` 로 죽고 `pgrep` 도 안 돼 클릭 실측을 「미확인」으로 남기고 코드로 계산한 URL 만 적었다. 여기서는 실제 클릭 결과다.
- 로그인은 하지 않았다(apex 로그인 화면 도착까지만). 계정 생성·로그인 없음.

| 시작 페이지 | 찜 버튼 | 클릭 뒤 도착 URL | `next` 디코딩 |
|---|---|---|---|
| `https://place.1989v.com/attractions/1` | 1개 (`button.favorite-btn`, aria-label 「관광지 찜」) | `https://1989v.com/login?next=https%3A%2F%2Fplace.1989v.com%2Fattractions%2F1` | `https://place.1989v.com/attractions/1` |
| `https://place.1989v.com/` (허브 첫 화면, 카드 30개의 첫 별) | 30개 (`button.favorite-btn.is-compact`) | `https://1989v.com/login?next=https%3A%2F%2Fplace.1989v.com%2F` | `https://place.1989v.com/` |

결론: 코덱스가 origin/main 코드로 계산한 이동 URL 과 **정확히 일치**한다. 상세에서는 장소 ID 가 `next` 에 남지만, 허브에서는 어느 카드의 별을 눌렀는지(대상 관광지)·검색 조건·선택 상태가 전혀 실리지 않는다. 로그인 뒤 돌아와도 사용자는 다시 별을 눌러야 하고, 허브에서는 그 카드를 다시 찾아야 한다.

미확인(그대로 남김): 로그인 완료 뒤 복귀 화면의 상태 복원 — 테스트 계정이 있어야 한다. 코드상으로는 `portal_login_next` 에 next 만 보관하고 저장 의도 큐는 없다(S1-10 본문).
