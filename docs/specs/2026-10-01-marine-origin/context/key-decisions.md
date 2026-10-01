# Decisions
- 2026-10-02 사용자가 구현 재개 및 이번 한 태스크 수행을 명시. T3 목수 채집·건설·주둔 진행. 과거 계획 전용 제한은 이번 지시로 종료.
- 2026-10-02 전체 코드확인·전체 테스트는 시작/최종 통합 때만 수행. 태스크마다 탐색·광범위 테스트·리뷰를 반복하지 않고 구현에 집중. 오류가 드러난 범위와 변경에 필요한 최소 검증만 수행.
- 2026-10-01 최신 사용자: 이번은 계획·이미지·캐릭터·몬스터 디자인까지만. 실행 코드 편집 금지.
- 원본 게임 환경 충실도가 우선. 다음 버전의 새로운 시스템은 기본판 검증 뒤 별도.
- 일꾼 초기지급·12000자원·수동환전·유료1기 영웅승급·과대 캐릭터의 이전 결정을 폐기.
- 제안 기본값: archer1/worker0/0G,금화단일,worker100G,archer180G,longbow500G,3archer→hero.
- Three.js는 기존 renderer기반을 재사용할 계획. Godot/3D엔진 전환 없음.
- 2인 host authority, GameRelay/PlatformAdapter 재사용,64KB/4096char/40msg 제약 준수.
- 기존 ADR-0088/0092 범위내, 신규 architecture ADR 현재 불필요. 추후 공용 API/인증/서버구조 변경 발생시 별도 검토.
- 새 문서가 기본판 사양의 source of truth. 2026-09-30 문서는 폐기 프로토타입 이력으로 보존.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/lib/platform.js -->
