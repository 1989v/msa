-- 표류 대륙을 공개 목록에 노출 (BETA → PUBLISHED).
-- 공개 리스트는 PUBLISHED 만 반환하므로 BETA 상태에서는 상세 링크로만 접근됐다.
-- 아직 P1(수직 슬라이스) 분량이라는 점은 설명 문구의 "(P1 — 계속 확장되는 장편)" 으로 알린다.

UPDATE game SET status = 'PUBLISHED', updated_at = NOW(6) WHERE slug = 'drift-continent';
