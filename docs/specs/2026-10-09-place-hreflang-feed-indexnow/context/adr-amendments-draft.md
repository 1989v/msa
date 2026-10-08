# ADR 개정 초안 (제안 — 사용자 승인 전)

## ADR-0062 §8 끝에 덧붙임

#### 개정 — 언어 대체 짝에만 hreflang (2026-10-09)

위 「hreflang 을 걸지 않는다」는 짝을 알 수 없어서였다. S1-8 실측(영문 300·수동 30쌍)으로 짝을 고르는 규칙이 생겨,
**그 규칙을 통과한 일대일 짝에만** 상세 hreflang 을 걸 수 있게 한다. 거는지 여부는 search:batch 설정
`search.alternate-pairs.enabled`(CronJob env `SEARCH_ALTERNATE_PAIRS_ENABLED`)가 정하고 **기본은 꺼짐**이다 —
꺼져 있으면 짝을 계산해 로그만 남기고 문서 `alternateId` 는 null 이라 hreflang 이 0건이다. 켜는 것은 사용자 승인 뒤 운영 30쌍
수동 확인과 함께 한다. 되돌리면 재색인 뒤 portal-fe 를 다시 빌드해 sitemap 에서도 지운다. 나머지 상세는 지금처럼 없다.

- 규칙: googlePlaceId 같음 · 50m 이내 · 언어 중립 유형 같음(국 12 ↔ 영 76 등 대응표) · 영문 `titleLocal` 과 국문 표시명이
  NFKC·공백 제거·소문자화 후 같음 · 후보 간선이 양쪽 모두 하나뿐 · 양쪽 모두 개요 있음(noindex 아님). 행사·코스는 제외.
  placeId·거리·유형만으로는 관광특구 ↔ 놀이공원, 같은 아울렛의 다른 브랜드가 이어졌다(S1-8 #19~#22) — 제목 조건이 그것을 막는다.
- 계산은 재색인 1차 패스의 search:domain 순수 함수(`AlternateLanguagePairer`), 결과는 문서 필드 `alternateId`.
  SSR·하이드레이션·sitemap 이 같은 헬퍼 값을 쓴다(x-default = 영문, 허브와 같은 규칙).
- 검증: S1-8 30쌍 오라클에서 짝 16 · 오탐 0. 운영 AC 는 「상호 참조·양쪽 색인 대상 위반 0」.
- 감수: placeId 가 없거나 서로 다른 짝·대표점이 50m 를 넘는 긴 시설은 놓친다(재현율 손실, 오연결 아님).
- `/en/attractions/{국문id}` 같은 어긋난 주소에서도 문서 `lang` 기준으로 ko·en 을 정한다(위 canonical 규칙과 같다).

## ADR-0103 끝에 새 절

## 개정 — 본문 변경 시각은 place 에 둔다: 결정 4 의 예외 (2026-10-09)

- **문제**: RSS·IndexNow 는 「이 사이트 본문이 실제로 바뀐 관광지」가 필요하다. 원천 수정일은 그 시각이 아니고(S1-9),
  수집은 전량 upsert 라 바뀐 행을 모른다.
- **결정**: place `attractions` 에 `content_hash`·`content_updated_at`(V34)을 둔다. 병합이 끝난 자기 필드의 정규화 해시가
  이전과 다를 때만 시각을 올린다. 정규화는 place:domain 이 따로 갖는다(search `sourceText` 와 일치를 요구하지 않는다 —
  자기 이전 값과만 비교하므로).
- **결정 4·대안 「파생 속성을 place 컬럼으로 — 기각」과 다른 이유**: 결정 4 의 파생값은 원천의 순수 함수라 매 재색인이
  다시 계산하면 된다. 본문 변경 시각은 **이전 실행과의 비교**라 상태가 필요하다. search 는 매일 새 색인을 만들어
  이전 값을 들고 있지 않다. 그래서 색인 시점 순수 함수로 만들 수 없다. 이 두 열 외의 파생값은 여전히 결정 4 를 따른다.
- **부담**: `syncFrom` 은 두 열을 source 에서 읽지 않는다(전체 동기화가 지우지 않게). 첫 채움은 변경으로 세지 않고
  원천 수정일을 쓴다. 정규화를 바꾸면 해시 접두 버전을 올려 시각을 보존한다.
- 소비자: search 색인 `contentUpdatedAt`(RSS 정렬), place 내부 조회 `/internal/attractions/content-updated`(IndexNow 제출 잡).
