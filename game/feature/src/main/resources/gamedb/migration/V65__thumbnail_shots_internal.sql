-- V12 가 손그림 SVG/부재 경로를 실플레이 캡처로 바꿨는데 6종이 남아 있었다.
-- 남은 경로(/games/thumbs/<slug>.svg)는 파일이 없어 nginx SPA 폴백이 index.html 을 200 으로
-- 돌려준다 — 목록 카드는 onError 폴백이 가려 주지만 프리렌더 HTML 에는 폴백이 없다.
-- 캡처: 각 게임을 구동해 대표 장면을 320x180 PNG 로 축소 저장 (portal-fe 정적 자산)

UPDATE game SET thumbnail_url = CONCAT('/games/thumbs/shots/', slug, '.png'), updated_at = NOW(6)
WHERE slug IN ('snake', 'overworld-quest', 'concept-memory', 'fill-blank-quiz', 'concept-cascade');

-- code-magnifier 는 제외한다. 개념 상세의 codeSnippets 가 전부 비어 있어 게임이
-- 스니펫을 찾지 못하고 개념 162개를 순회한 끝에 "없음" 으로 끝난다 — 플레이가 되지 않으니
-- 찍을 화면도 없다. 스니펫 적재가 선행되어야 한다.
