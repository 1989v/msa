<!-- source: docs/specs/2026-10-29-game-platform-links/spec.md, docs/specs/2026-10-29-game-platform-links/progress.md -->

# 검증·배포 상태

## 코드 검증

- 도메인105개·feature40개 (실제 MySQL 통합18개 포함): failures/errors/skipped=0.
- Portal 타입 검사 및 관련 컴포넌트10개: 통과. Admin 타입 검사 및 관련 컴포넌트8개: 통과.
- verifyArchitecture 및 독립 소스 재검토: 차단 결함 없음.
- 부모가 최종 소스에서 명령 재실행 및 JUnit XML을 확인했다. 상세 명령은 progress.md.
- [운영 코드 CI](https://github.com/1989v/msa/actions/runs/40760776017): success. 포털 전체 테스트와 컴파일/구조 검사 포함.
- [이미지 배포](https://github.com/1989v/msa/actions/runs/40760776032): success. 기능 커밋 `e800b48852a9763346e7d6b9fa06f9dac9840f45`.

## 별도 문서 검사

[Docs Health](https://github.com/1989v/msa/actions/runs/40760775923)는 기존 Skybound 인계 문서가 가리키는 `.qa/retired-skybound/` 보관 파일3개의 CI 체크아웃 내 누락으로 실패했다. 해당 문서는 이번 diff에 포함되지 않았다. 이를 이번 기능 검사 통과로 표현하지 않으며, 문서 원본/보관 정책 수정은 이번 범위 밖이다.

## 운영 확인 결과

- content/portal-fe/admin-fe 모두 이미지 e800b48, Ready=1/Updated=1, rollout successfully rolled out 확인. 매니페스트 커밋27dc3e1a73b0958ab3594304f38ac07a5af4501e.
- 운영 공개 API PASS: 인피니티 스탭 platformLinks=[], 기존 entryUrl 유지, 목록5개·유사8개·컬렉션33개에 availablePlatforms 배열 확인.
- 관리자 API 미인증 GET은 401/403 차단 확인.
- 포털 HTTP로 GameDetailPage-Bqtne5sD.js의 새 링크 코드 확인. 관리자 외부 HTTP는 리디렉션/403으로 제한되어 로그인 조작은 하지 않았고, 실행 중 admin-fe 컨테이너의 index-DNVfiFcQ.js에 platform-releases 코드 확인. 실제 브라우저/로그인 조작은 미검증이며 DOM 검사는 실화면 검증을 대신하지 않는다.
- 실제 Roblox Place ID는 아직 없고 운영 링크는 등록하지 않았다. 등록 절차는 [운영 안내](operations.md).

## 2026-11-10 관리자 통합 저장 검증

- 작업 위치: `/Users/gideok-kwon/.codex/worktrees/game-save-20261110`, branch `feat/game-editor-unified-save-20261110`, base `origin/main 38b597269`.
- `cd admin/frontend && npm test -- --run`: **26 files / 109 tests passed**, exit 0 (03:54:36). 기존 GamesPage 테스트의 미모킹 조회 XHR stderr는 있으나 실패 없음.
- 최종 타입 완전한 fixture 반영 후 `npm test -- --run src/pages/games/GameEditDialog.test.tsx src/pages/games/GameEditCollections.test.tsx src/pages/games/PlatformReleasesPanel.test.tsx src/components/ui/dialog.test.tsx`: **4 files / 17 tests passed**, exit 0 (03:55:23).
- `npm run build`: **tsc -b 성공, Vite built in 391ms**, exit 0. 기존 번들 500kB 경고 유지.
- 변경된 8개 TS/TSX 파일 `eslint`: **0 errors / 1 existing useReactTable compiler warning**, exit 0.
- `npm run lint` 전체: **35 errors / 9 warnings**, exit 1. 변경 범위 밖의 기존 랭킹/shared·PrivateGamesPage 등 오류이며 수정하지 않음.
- `git diff --check`: exit 0.
- 부모의 독립 검토에서 stale GET/PUT 경합 및 모달 외부 포커스 Escape 누락 2건을 유지 판정했다. 플랫폼 조회 취소와 열린 최상단 Dialog의 document listener로 수정하고 회귀 테스트를 추가했다. 부모 재검토 결과 **SHIP**.
- 부모 독립 재실행: 집중 4 files / 17 tests passed (03:54:42), exit 0.
- 이번 작업은 UI 자동화·운영 데이터 변경·push·배포를 수행하지 않았다. DOM 테스트는 실제 viewport 시각 검증을 대신하지 않는다.
- 이 격리 worktree에는 ai submodule 스크립트가 체크아웃되지 않아 doc_scan/doc_map 자동 검사는 실행하지 않았다. 기능 명세·작업·결정·진행·상태를 직접 동기화했다.
