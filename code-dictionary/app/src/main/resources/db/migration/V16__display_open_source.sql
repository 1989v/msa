-- 1989v.com 메인에 전시하는 공개 오픈소스 저장소 (ADR-0066 의 전시 축 확장).
--
-- display_service 와 같은 축이다: 배포 단위가 아니라 방문자가 클릭해 들어가는 진입점.
-- 다만 목적지가 플랫폼 안 화면이 아니라 GitHub 저장소라 상태 기계가 필요 없다 —
-- OPEN/PREOPEN/HOLD 를 그대로 가져오면 "오픈 예정인 공개 저장소" 같은 성립하지 않는
-- 상태가 생기므로, 전시 여부는 active 플래그 하나로 가른다.

CREATE TABLE display_open_source (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(60) NOT NULL,
    name VARCHAR(100) NOT NULL,
    tagline VARCHAR(200) NOT NULL,
    description VARCHAR(500) NULL,
    repo_url VARCHAR(300) NOT NULL,
    language VARCHAR(40) NOT NULL,
    order_no INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_display_open_source_slug (slug),
    INDEX idx_display_open_source_active_order (active, order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- slug 가 이미 있으면 건드리지 않는다 — 어드민/운영에서 손본 값을 배포가 되돌리면 안 된다 (V9 와 같은 규칙).
-- language 는 GitHub 언어 통계 실측값이다. description 은 저장소의 영문 원문 설명.
INSERT IGNORE INTO display_open_source (slug, name, tagline, description, repo_url, language, order_no) VALUES
    ('muxbar', 'muxbar',
     'macOS 메뉴바 tmux 세션 관리 · Keep Awake/뚜껑 닫힘 모드',
     'Native macOS menu bar app — tmux session manager, Keep Awake / closed-lid mode (lid shut, work running), long-running script launcher. Swift + SwiftUI.',
     'https://github.com/1989v/muxbar', 'Swift', 10),
    ('kafka-lens', 'kafka-lens',
     '자체 호스팅 Kafka UI — 토픽 전문 검색 · 컨슈머 랙 차트 · DLQ 재처리',
     'Self-hosted Kafka UI with free-text search across topics (substring + JSON dotted-path), real-time consumer-lag charts, DLQ flow visualization, and reprocess-only DLQ writes.',
     'https://github.com/1989v/kafka-lens', 'Kotlin · TypeScript', 20),
    ('aieye', 'aieye',
     'Claude Code·Codex 백그라운드 세션 통합 메뉴바 뷰어',
     'Native macOS menu bar app for Claude Code, Codex, and Claude background agents — unified session list, in-panel reply, sub-agent view, smart resume.',
     'https://github.com/1989v/aieye', 'Rust', 30),
    ('claude-md-toggler', 'claude-md-toggler',
     'CLAUDE.md 하네스 프로필 토글 메뉴바 앱',
     'Cross-platform menu bar app to toggle Claude Code harness profiles (CLAUDE.md.{suffix} convention).',
     'https://github.com/1989v/claude-md-toggler', 'Rust', 40),
    ('ai', 'ai',
     'Claude Code 플러그인 모노레포 — SDD 파이프라인 · API 디버거',
     'Claude Code plugin collection: AI harness engineering (SDD pipeline), API debugger, content analyzer, submodule manager.',
     'https://github.com/1989v/ai', 'Shell · Python', 50);
