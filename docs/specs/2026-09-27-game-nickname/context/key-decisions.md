# Decisions

- 2026-09-27: 사용자가 요청한 회원별 고유 닉네임 및 전역 수정 모달을 구현한다.
- game 프로필은 게임 도메인 소유이며 member DB를 참조하지 않는다.
- 기존 익명 기록을 이름 일치만으로 회원에게 귀속하지 않는다.
- 공유 작업 트리에 다른 작업이 다수 있으므로 본 작업의 파일·변경만 커밋한다.

- 사용자 확정: 비로그인도 별도 게스트 계정으로 닉네임·랭킹 사용.
- 기존 member_id도 nickname 기반 claim이었으므로 legacy 전체를 보존하고 신규 UUID 원장으로 분리한다.
- profile PUT은 자동 auth retry를 하지 않는다. 계정 A 요청의 지연401을 B로 재전송하지 않도록 한다.
- rank PUT 성공은 저장 중 시작한 GET까지 무효화한다. 과거 GET이 새 이름을 덮거나 pending을 지우지 못한다.
- MySQL 실제 동시점수 테스트에서 REPEATABLE_READ snapshot 문제가 재현됨. READ_COMMITTED+profile FOR UPDATE로 해결했다.
