# S1-6 보충 — 허브 카드 실화면 엔티티 노출 (CDP 실측)

- 측정: 2026-10-08 04:3x KST, 헤드리스 Chrome(세션 스크래치패드 프로필, `scripts/cdp-chrome.sh` start → 측정 → stop), Node 22 CDP `Runtime.evaluate`, 뷰포트 1280, 페이지 로드 8초 대기 후 DOM 의 잎 텍스트 노드 검사
- 패턴: `&rsquo;` `&nbsp;` `&amp;` `&lt;` `&gt;` `&quot;` `&#N;` `<br />` 가 **텍스트로 보이는** 경우
- 왜 보충인가: 코덱스 S1-6 은 샌드박스에서 `pgrep` 이 안 돼 Chrome 을 띄우지 않았고 허브 카드 실화면을 「미확인」으로 남겼다

| 페이지 | 잎 텍스트 노드 | 노출 건수 | 노출 요소 | 「Not closed today / 오늘 정기휴무 아님」 |
|---|---|---|---|---|
| `https://place.1989v.com/en` | 242 | **3** | `p.place-card-overview` ×3 | 1 (패싯 칩) |
| `https://place.1989v.com/en?q=palace` | 242 | **3** | 같은 카드 3개 (쿼리가 URL 로 전달되지 않아 같은 첫 화면) | 1 |
| `https://place.1989v.com/` | 225 | 0 | — | 1 |

노출 표본(카드 개요문, 앞 90자):

- `◎ Travel information to meet Hallyu&rsquo;s charm<br /><br />Youngchive Seongsu is the sel…`
- `K-movie &lt;PARASITE&gt; - A town full of nostalgia<br />On the day Kitaek's family return…`
- Songhyeon Green Plaza 카드(패턴 매치는 본문 뒤쪽)

결론: 코덱스 S1-6 의 코드 판독(「상세는 정규화하지만 허브 카드·선택 패널은 overview 원문을 출력」)이 실화면으로 확인된다. 영문 허브 첫 화면 카드 중 3개가 엔티티·`<br />` 를 그대로 보여 준다. 국문 허브는 0건. 수정 지점은 허브 카드(`place-card-overview`)의 렌더 경로이며, 상세 서버 렌더와 같은 정규화를 쓰면 된다.

`?q=palace` 가 같은 첫 화면을 낸 것은 검색이 URL 상태를 만들지 않는다는 기존 관찰과 일치한다.
