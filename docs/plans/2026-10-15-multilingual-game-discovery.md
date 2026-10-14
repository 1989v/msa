# 랜덤레이스·핀볼 한영 검색 발견성 개선

## 승인과 범위

사용자(2026-10-15)는 내기 게임, 핀볼게임, 핀볼, 핀볼 내기, 핀볼 추첨으로 검색되도록 수정하고 분석을 정리하며, 영문 검색과 모든 서비스 콘텐츠에 적용할 원칙을 메모리에 기록하도록 요청했다. 구현·검증·커밋·푸시·배포는 기존 진행 범위를 따른다. 검색 순위 또는 즉시 색인 보장을 뜻하지 않는다.

이번 구현은 구슬 레이스 상세와 랜덤레이스 진입의 ko/en 콘텐츠·초기 HTML·색인·내부 링크에 집중한다. 다른 서비스에는 재사용 가능한 공개 콘텐츠 기준과 향후 점검 순서를 적용한다. 전체 서비스의 사적 화면이나 기능·게임 규칙을 일괄 변경하지 않는다. 새 DB 스키마·서비스·외부 의존은 없으므로 ADR 대상이 아니다.

## 관찰한 문제

- 운영 `/draw`: 초기 title `1989v`, 소개 본문·canonical 없음. 실제 배포 DrawPage 청크가 `noindex: true`를 전달한다. 사이트맵에 없다.
- `/games/marble-race`: title `구슬 레이스 — 무료 온라인 플레이 | 1989v 게임`; 초기 제목·설명·본문에 목표 다섯 표현과 `핀볼`이 없다.
- 상세 소개는 DB 시드의 `맵 3종`, `꼴찌가 걸린다`, `같은 같은 코드`를 여전히 표시한다. 게임 수정과 검색용 소개가 분리돼 있다.
- robots는 수집 허용이며 상세 canonical·한영 hreflang·사이트맵은 이미 있다. 상세 lastmod는 2026-09-10이었다.
- 5개 키워드의 수집된 네이버 첫 결과 HTML에서 자체 도메인 결과 링크를 찾지 못했다. 구글 직접 결과는 JS 확인에 막혔다. 이는 검색엔진 전체 미색인 또는 정확한 순위의 증거가 아니다.

## 페이지와 검색 의도

| 대표 페이지 | 한국어 | 영어 표현 |
| --- | --- | --- |
| `/games/marble-race`, `/en/games/marble-race` | 핀볼 추첨, 핀볼 내기, 핀볼게임/핀볼 게임, 핀볼 | pinball random picker, pinball raffle, pinball draw, online pinball game, friendly pinball bets |
| `/draw`, `/en/draw` | 내기 게임, 랜덤레이스, 커피·점심 내기 | party decision games, friendly betting games, random picker |

영어는 직역 검색어 나열 대신 이름 뽑기·친구끼리 순서 정하기 문맥에서 사용한다. 현금 베팅·배당·실물 경품 제공 기능이 있는 것처럼 표현하지 않는다. 한국어·영문 모두 실제 기능만 설명한다. 넓은 `핀볼`은 플리퍼 게임/기기 등의 의도와 경쟁하므로 순위를 보장하지 않는다.

## 구현 계약

1. 기존 순수 공유 SEO 계층에서 해당 게임의 검증된 소개와 ko/en 메타를 관리한다. 프리렌더·실제 소개·JSON-LD가 같은 원본을 사용하고, 오래된 DB 소개를 다시 노출하지 않는다. 다른 게임의 기본 fallback은 유지한다.
2. 구슬 레이스 title은 한국어 `핀볼 추첨·내기 게임 — 구슬 레이스 | 1989v 게임` 방향, 영문은 Pinball Random Picker/Marble Race 중심의 자연스러운 제목으로 한다. 실제 이름과 관련성 있는 본문·사용법·내부 링크를 함께 제공한다. 게임 내부 모드 이름이나 UI 버튼에 SEO 단어를 억지로 추가하지 않는다.
3. `/draw`, `/en/draw`는 공개 소개와 사용법을 초기 HTML에도 제공하고 noindex를 해제한다. 참가자 이름·로컬 저장·방 상태는 프리렌더하지 않는다. 게임·초대 기능은 그대로다.
4. 네 페이지는 언어별 self-canonical, 양방향 ko/en 및 기존 방식의 x-default, HTML lang, 사이트맵, 실제 편집일 lastmod를 제공한다. nginx가 생성한 draw 프리렌더를 실제 URL에서 서빙하도록 연결한다. 영어 페이지 본문도 영어여야 한다.
5. 루트/장르/상세/랜덤레이스의 관련 위치에 실제 `<a href>` 링크를 둔다. 루트의 전체 웹게임 정체성을 핀볼 하나로 바꾸지 않는다. SEO만을 위한 동일 콘텐츠 URL을 추가하지 않는다.
6. 파티 방·계정·원시 게임 프레임 등 기존 비공개/보조 화면의 noindex는 유지한다. 임의 쿼리·초대 코드는 사이트맵에 넣지 않는다. 가짜 평점·FAQ 리치 결과 보장·키워드 메타 반복은 추가하지 않는다.

## 검증과 완료

- ko/en title·description·주요 본문이 초기 HTML과 실제 React에서 의미상 일치한다.
- 네 URL의 canonical·양방향 hreflang·사이트맵·편집일, draw 색인 허용과 다른 비공개 화면 보존을 검사한다.
- 오래된 API 설명이 있어도 구슬 레이스의 실제 소개·프리렌더·JSON-LD에는 최신 소개가 나온다. 다른 게임 소개는 바뀌지 않는다.
- draw의 입력·시작·초대 회귀와 영어 본문·내부 링크를 focused test로 확인한다. 기존 물리/완주 매트릭스는 반복하지 않는다.
- lint·type·build·fresh review 이후 커밋·푸시하고 운영 HTTP HTML/헤더/사이트맵을 검사한다. 브라우저 사용 승인은 현재 없으므로 UI 자동화는 하지 않는다.
- Search Console/서치어드바이저의 제출·색인 검사·노출/클릭/평균순위 측정은 계정 접근과 실제 수행 여부를 구분해 보고한다. 실행하지 않은 제출 또는 순위 상승을 완료라고 쓰지 않는다.

## 근거

- https://developers.google.com/search/docs/appearance/title-link?hl=ko
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics?hl=ko
- https://developers.google.com/search/docs/specialty/international/localized-versions?hl=ko
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=ko
- https://searchadvisor.naver.com/guide/markup-content
- https://searchadvisor.naver.com/guide/seo-advanced-javascript

재사용 원칙은 `docs/conventions/search-discoverability.md`를 정본으로 하고, feedback 메모리는 사용자 의도와 이 문서의 참조를 보존한다.
