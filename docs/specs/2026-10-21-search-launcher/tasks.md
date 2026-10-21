# Release tasks

- [x] 최신 원격 코드·실제 배포 구조 확인, 호환 설계 부모 승인
- [x] 기존 그룹/API/인덱스 계약 보존 + suggest/음료/페이지 확장
- [x] 독립 런처/PWA/8타입 목적지·URL 복원
- [x] 격리 Gradle/architecture/FE 회귀 검증
- [x] production build 종료 확인·증거 확정
- [ ] hook 적용 커밋 후 부모에게 인계
- [ ] 부모: push/selective image build/deploy/reindex/live 확인

## 검색 화면 개정

- [x] 종류 필터/type 상태 제거, legacy type URL 전체 검색 회귀
- [x] K-Heritage 프리미티브·정경 토큰 적용, 기존 테마 토글 스타일 보존
- [x] 관련 FE/route/shell 테스트·ESLint 검증 (40 tests passed, exit0)
- [x] production build exit0 확인, 정상 hook 커밋으로 부모 인계

## GNB 서비스 탐색 자동완성

- [x] /search 공통 hook 추출, ServiceExplorer 자동완성/첫 Enter 직접 이동
- [x] IME/native form submit·취소/역순응답·빈/오류/로딩 보호
- [x] Escape 우선순위, dialog 초점, 카드/한영 지원, 전체 결과 링크 유지
- [x] scoped 6 files/45 tests passed, ESLint 및 tsc-b exit0
- [x] 최종 production build exit0 확인·정상 hook 커밋·부모 인계
