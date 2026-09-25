-- 광고 네트워크(ADR-0098)의 광고주 콘솔을 전시 서비스에 올린다. 주소는 화면이 ads 서브도메인으로 승격한다(serviceHref).
INSERT IGNORE INTO display_service (code, label, tagline, href, status, order_no) VALUES
    ('ads', '광고', '광고주 콘솔 · 캠페인 · 소재 · 리포트', '/ads', 'OPEN', 48);

-- 운영에 손으로 넣었던 클로드 아티팩트 카탈로그 행. 아티팩트는 페이지마다 공개 범위가 달라
-- 방문자가 열 수 없는 링크가 섞이므로 전시하지 않는다 — 다시 올릴 일이 없어 HOLD 가 아니라 삭제.
DELETE FROM display_service WHERE code = 'artifacts';
