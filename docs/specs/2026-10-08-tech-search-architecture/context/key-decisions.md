# 결정 기록 — /tech/search

### 2026-10-08 TG1 구현 해석 (구현자 제안, 메인 채택)
- slug 의 「백틱 제외」는 백틱 문자만 지우고 코드 내용은 남긴다. 연속 `-` 는 합치지 않는다(스펙 문자 그대로).
- 링크 ⑤ 는 `//host` 도 막는다(스펙보다 엄격 — 같은 출처만).
- heading 과 §4 행 id 는 한 중복 집합(겹치면 `-2`) — 링크가 못 맞추면 ⑨ 가 세운다.
- fencesvg 의 `<div style="overflow-x:auto">` 래퍼를 벗기고 `<figure class="fs-figure">` 만 낸다 — 가로 스크롤은 페이지 CSS 가 figure 에.
- `slugify` 를 export — 원본 md 작성 시 요약 불릿 링크 계산에 쓴다.
- (TG3) 요약 블록은 따로 만들지 않고 생성 html 을 첫 `<h2` 에서 나눠 앞부분을 요약 섹션으로. `techArticleJsonLd` headline 은 「검색 아키텍처」 고정(원문 문장을 두 곳에 두지 않는다). fencesvg 변수 13종을 `--kh-*`/`--ko-*` 로 매핑.
