# 속성 원문 → 파생 값 대응 표

근거 표본: `attr-raw-values.json` (운영 국·영 각 2,000건). 파서는 `search/domain` 의
`AttractionAttributeParser` (판 `VERSION = 1`), 픽스처는 `search/domain/src/test/resources/attributes/raw-fixtures.tsv`.

## petAcmpyType → petPolicy

| 원문 (`petAcmpyType`) | 표본 건수 (ko) | `petPolicy` |
|---|---|---|
| `전구역 동반가능` | 404 | `ALLOWED` |
| `일부구역 동반가능` | 25 | `PARTIAL` |
| 빈 값 · 없음 | 1,571 | `UNKNOWN` |
| (그 밖의 값) | 0 | `UNKNOWN` |

- 표본의 distinct 값은 위 두 개가 전부다(ko `distinct 2`). 공백 차이는 무시하고 비교한다.
- 원천에 「불가」를 뜻하는 값이 없어 `petPolicy` 에 부정 값을 두지 않았다. 빈 값을 불가로 읽지 않는다.
- 영문 문서는 `petAcmpyType` 이 전부 비어 있다(en `filled 0`) → 전부 `UNKNOWN`.
- 원문은 그대로 두고(`petAcmpyType` 필드 유지) 파생 값만 더한다.

## chk 값 해석 (신용카드 · 유모차 대여)

introRaw 에서 아래 키 중 값이 있는 첫 키를 읽는다.

- 신용카드: `chkcreditcard` · `chkcreditcardculture` · `chkcreditcardfood` · `chkcreditcardleports` · `chkcreditcardshopping`
- 유모차 대여: `chkbabycarriage` · `chkbabycarriageculture` · `chkbabycarriageleports` · `chkbabycarriageshopping`

| 원문 (공백 무시) | 파생 |
|---|---|
| `가능` · `있음` · `모든 카드 사용 가능` · `모든카드 사용가능` | `YES` |
| `불가` · `불가능` · `불가 (현금만 가능)` · `없음` | `NO` |
| `매장마다 상이` · `가능(점포마다 상이함)` · `일부 매장 가능` · 빈 값 · 그 밖 | `UNKNOWN` |

- **`없음` 을 `NO` 로 읽는 것은 가정이다.** 원천이 「해당 없음」과 「정보 없음」을 가르지 않는다.
  관광지(12) `chkcreditcard` 는 `없음` 99 · `가능` 22 로 `없음` 이 압도적이라, 실제로는 「정보 없음」일 가능성이 있다.
  사람 라벨 정확도 측정(T7)에서 확인하고, 틀리면 `없음` 을 `UNKNOWN` 으로 옮기고 판을 올린다.
  필터는 긍정 값만 받으므로 이 가정이 틀려도 필터 결과는 바뀌지 않고, 배지·건수 표시만 영향을 받는다.
- 영문 문서에는 chk 키가 없다(en `introKeys` 에 없음) → 전부 `UNKNOWN`.

## 참고: 다른 속성의 해석 규칙 요약

- 정기휴무: 원문 전체가 연중무휴 표기(`연중무휴` · `연중 무휴` · `연중개방` · `N/A (Open all year round)` · `Open 24/7` · `N/A (Open 24 hr)`)면 `AlwaysOpen`.
  아니면 쉼표·빗금·줄바꿈으로 쪼개 모든 항목이 「매주 요일」 또는 「명절·공휴일·1월 1일」일 때만 `Weekly(요일 집합)` —
  명절만이면 빈 집합. 항목 하나라도 모르는 표기(격주·월 n회·괄호 조건·「상이함」 등)면 `Unknown`. `※`·`*` 뒤 덧붙임은 버린다.
- 주차: 접힌 `parking` 컬럼. 태그 제거 뒤 `불가`·`없음`·`Not available`·`No `·`N/A` 로 시작하면 `NO`, `가능`·`있음`·`주차장 있음`·`Available`·`Y` 로 시작하면 `YES`, 그 밖 `UNKNOWN`.
- 입장 무료: 접힌 `useFee` 컬럼만 읽는다(introRaw `usefeeleports` 는 읽지 않는다). `무료`/`Free` 로 시작하고 금액이 없으면 `FREE`,
  금액(`원`·`won`·`KRW`)이나 `유료`가 있으면 `PAID`, 무료로 시작하는데 금액도 있으면 `UNKNOWN`, 그 밖 `UNKNOWN`.
  관광지(12)·레포츠(28)는 접힌 컬럼이 비어 구조적으로 `UNKNOWN`.
