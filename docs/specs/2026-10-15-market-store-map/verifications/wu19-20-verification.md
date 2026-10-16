# WU-19·WU-20 검증 (2026-10-16)

대상 커밋: `0fcc8b88c`(WU-19 음식 사전·관련 업종 검색·TourAPI 메뉴), WU-20 영문(이 문서와 같은 커밋).

## 단위 테스트 (세션 직접 실행)
| 명령 | 결과 |
|---|---|
| `./gradlew --no-daemon :place:feature:test --tests '*Market*'` (WU-19 뒤) | `tests 156 failures 0 errors 0` |
| `python3 -m pytest tests -q` (`place/ingest`) | `355 passed` |
| `./gradlew --no-daemon :place:feature:test --tests '*Market*' --tests '*Roman*'` (WU-20 뒤) | `tests 203 failures 0 errors 0` |

## 회귀 주입 (Codex 실행, 원복 확인)
| 뺀 것 | 빨간불 |
|---|---|
| TourAPI 매칭의 50 m 조건 | `restaurants beyond 50 metres do not attach` 1건 |
| 로마자 연음 규칙 | 38건 중 9건(해돋이·같이·굳이·옷이·떡이·놓아·값이·싫어·닳아) |

## 사전·번역표가 재는 것
- `dishes.csv` 152행·26업종. 업종 이름은 **운영 `market_store_search.category_sub` 207종 스냅샷**(`src/test/resources/market/category-subs.txt`, 2026-10-16)과 대조한다 — Codex 초안은 「확인 가능한 11종」만 넣고 `size in 90..120` 범위를 단정하고 있어서, 행을 늘리면 깨지는 가짜 불변식이었다. 「중복 (dish, category) 없음 + 운영 업종 포함」으로 바꿨다.
- `categories-en.csv` 는 같은 207종을 전부 번역해야 테스트가 통과한다(`MarketEnglishDictionaryTest`).
- 로마자 변환기 고정 예시 24건 + 연음 사례(순희네빈대떡 Sunhuine Bindaetteok, 독립문 Dongnimmun, 왕십리 Wangsimni, 해돋이 Haedoji, 좋고 Joko, 싫어 Sireo, 닳아 Dara …).

## 영문 질의 경로에서 고친 것
- 로마자 이름 비교가 저장값에서만 공백을 지우고 질의에서는 안 지워 `sunhuine bindaetteok` 이 0건이었다 → 질의도 같은 정규화.
- `tteokbokki` 는 로마자 이름 일치(떡볶이집) + 관련 업종(분식집) 2건이 맞다 — 단일 결과를 기대한 테스트를 고쳤다.

## 범위 밖으로 남긴 것
- 가게 영문 이름 수동 입력·저장(override 필드)은 없다. `nameEn` 은 로마자뿐이다. 필요해지면 `market_store_override` 에 `NAME_EN` 필드를 더한다.

## 운영 반영 뒤 확인할 것 (배포 전이라 못 했다)
- V44·V45 적용 뒤 기동 시 `name_roman` 백필(828곳)과 `POST /internal/markets/tour-menus` 한 번 — 매칭 수(`matched`)를 기록.
- `/api/v1/place/markets/search?q=떡볶이` 가 `RELATED_CATEGORY` 행을 뒤 순위로 내는지, `q=tteokbokki` 도 같은지.
- 광장시장(순희네빈대떡)에서 `tourMenu` 가 붙는지, 영문 상세에서 `nameEn`·`categoryEn`·`firstMenuEn` 이 나오는지.
- 남대문·광장·망원·광명 CDP 4조합(국문·영문).
