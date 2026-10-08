# Engineer Review — security (1라운드)

스펙: `docs/specs/2026-10-09-place-longtail-landings/spec.md`
체크리스트: hns 0.15.1 `reviewers/security/checklist.md`

## 위협 모델 요약 (STRIDE)
공개 관광 데이터의 빌드타임 정적 HTML 과 읽기 전용 SPA 화면이다. 인증·인가·PII·결제·시크릿·서비스 간 통신 변경이 없다(`spec.md:4` "새 서비스·스키마·통신 없음"). 빌드는 기존과 같은 공개 API 원점을 쓴다(`prerender-seo.mjs:106`). S·R·E 해당 없음. 남는 면은 T/I(정적 HTML 주입)와 D(빌드 호출량)다.

## Findings

### S1. 원천 문자열을 정적 HTML 에 넣는 경로의 이스케이프 규칙이 스펙에 없다 (체크: 입력 검증 바운더리 — XSS)
- 스펙: 랜딩 목록(이름·분류·주소, `spec.md:14`), 편집 페이지 카드·비교 표(요금·휴무 — 색인 값, `spec.md:25,27`).
- 코드: 요금·휴무는 TourAPI 원문(introRaw)이라 태그가 섞여 오고, 평문화는 `placeIntroText`/`sourceText` 한 함수가 맡는다(`copy.mjs:695-696,838-844` "두 벌로 나뉘면 한쪽만 고쳐지고 다른 쪽에 태그가 남는다"). 프리렌더 선례는 값마다 `escapeHtml` 을 건다(`prerender-seo.mjs:1176-1180`).
- 또 편집 페이지 본문은 render-content 의 출력 트립와이어(금지 태그·이벤트 속성·주소 스킴, `render-content.mjs:144-182`)를 통과하지만, 카드를 그 뒤에 끼우면 그 검사를 거치지 않는다.
- 수정안: SR-1.3·SR-3.1 에 「원천 값은 `sourceText`/`placeIntroText` 로 평문화 후 `escapeHtml`, 링크는 `attractionPath`/`regionPath` 로만 만든다」 한 줄. 카드 삽입 후 최종 HTML 에 같은 `check` 를 다시 돌리거나, 카드 HTML 은 고정 템플릿 + 이스케이프만 쓴다고 적는다.

### S2. 선정 근거 파일이 공개 경로에 나간다 (체크: 정보 노출 — 낮음)
- 스펙: `dist/prerender/landings.json` 에 남긴다(`spec.md:13`).
- 코드: `location /` 가 `try_files $uri` 로 dist 의 아무 파일이나 내보내므로(`nginx.conf:331-332`) `https://place.1989v.com/prerender/landings.json` 으로 열린다. 내용은 공개 집계라 민감하지 않지만, 크롤 가능한 JSON 이 늘고 동일 경로의 다른 프리렌더 파일도 원 주소 밖에서 읽힌다(기존 성질).
- 수정안: 빌드 로그·`dist/` 밖(예: 이미지에 안 들어가는 `build-meta/`)에 두거나, I4(implementation) 대로 레포 커밋 목록으로 대체하면 이 항목은 사라진다. 비차단.

## 통과 항목
- 인증/인가: 모든 경로 공개 읽기. `/guides` draft 는 noindex 일 뿐 접근 제한이 아니다 — 초안이 공개 주소로 열려도 되는지는 사용자 판단 사항이라 Q1(`context/open-questions.yml:2-6`)에 이미 있다.
- 시크릿: 정적 지도 API(키·과금)를 쓰지 않기로 해 키 노출 면이 없다(`spec.md:15`).
- Rate limiting/DoS: 빌드 추가 호출은 facets 약 500회 수준으로 기존 열거보다 작다(implementation 리뷰 통과 항목 참조). 런타임 공개 면은 기존 검색 API 그대로.
- 감사 로깅: 해당 없음.

VERDICT: REVISE
