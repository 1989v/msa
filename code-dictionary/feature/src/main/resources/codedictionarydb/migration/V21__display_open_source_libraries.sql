-- 메인 오픈소스 전시에 라이브러리 둘을 더한다.
--
-- card-dispenser 는 이 사이트가 실제로 쓰는 장치다 — 메인 서비스 섹션 넷과 place·game·blog·shop 의
-- "뽑기"가 전부 이 패키지를 부른다(portal-fe 는 npm 의존성으로 받는다). 사본을 두지 않으므로
-- 여기 걸린 저장소가 곧 화면에서 도는 그 코드다.
--
-- fencesvg 행은 운영 DB 에만 손으로 들어가 있었다. 새 환경을 세우면 빠지므로 같은 문장에 넣는다 —
-- INSERT IGNORE 라 이미 있는 운영 행은 건드리지 않는다 (V16 과 같은 규칙).

INSERT IGNORE INTO display_open_source (slug, name, tagline, description, repo_url, language, order_no) VALUES
    ('fencesvg', 'fencesvg',
     '마크다운 mermaid 펜스를 사이트 톤의 SVG 로 — 의존성 0, gzip 8.4KB',
     'Renders mermaid-syntax markdown fences as SVG that matches your site''s design tokens and survives your sanitizer, style lint, server renderer and CommonMark''s blank-line rule. Five diagram types, zero runtime dependencies.',
     'https://github.com/1989v/fencesvg', 'TypeScript', 60),
    ('card-dispenser', 'card-dispenser',
     '회전판에 옆으로 꽂힌 카드 중 정면 것이 일어나는 뽑기 장치 — 의존성 0, CSS 3D',
     'A rotating card dispenser: cards stand edge-on around a drum, the one that reaches the front rises to face you. Scroll-scrub, drag, keyboard, and a spin-to-pick that lands on one real item. Zero dependencies, CSS 3D.',
     'https://github.com/1989v/card-dispenser', 'TypeScript', 70);
