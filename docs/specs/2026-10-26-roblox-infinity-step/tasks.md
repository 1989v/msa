# Task Breakdown: Roblox Infinity Step

## Overview
Total Task Groups: 1 bounded standalone prototype. User authorization: “일단 그거 먼저 진행해 줘” plus paid revival request, following the proposed first-slice description.

### Task Group 1: First course, controls and optional revival
**Dependencies:** reviewed specification
**Phase:** prototype
**Required Skills:** hns agent behavior; source-first verification
- [x] 1.0 Complete local prototype (runtime acceptance remains pending)
  - [x] 1.1 Focused actual-Luau tests for five-level jumps, route reach, last-platform/fall snapshots and free continuation.
  - [x] 1.2 Focused tests for receipt retries, single use, failure recovery, lifecycle changes and competing sessions.
  - [x] 1.3 Implement editable course, Roblox movement/server adapters and touch/keyboard HUD.
  - [x] 1.4 Implement atomic persistent ticket ledger, explicit use and disabled-by-default live purchase UI.
  - [x] 1.5 Reproducibly build self-contained `.rbxlx`, project mapping and README.
  - [x] 1.6 Verify: `LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/infinity-step/tools/verify.py`
  - [x] 1.7 Fresh-context implementation review and evidence report.
  - [x] 1.8 Deliver reusable porting prompt and sourced Roblox development guide; verify local links.

**Acceptance Criteria:** spec SR-1–4 executable checks pass; generated place embeds exact source; runtime-dependent checks are explicitly listed unverified; no unrelated paths modified; no live publication or product creation.

## Execution Order
Tests and pure modules → Roblox adapters and course → artifact → scoped verification → fresh review → report.

## 2026-10-28 원작 기준 복원 작업

사용자의 원작과 다르다는 지적 및 작업 재개 요청에 따른 수정이다. 기존 기술 샘플 완료 표시는 원작 이식 완료를 뜻하지 않는다.

### 작업 그룹 2: 원작 기준 데이터와 맵 복원
**Dependencies:** spec.md의 2026-10-28 개정
**Phase:** fidelity
**Required Skills:** 원본 코드 우선, 실제 출력에 근거한 검증
- [ ] 2.1 원작을 수정하지 않는 지형 내보내기 도구와 원본 해시/시드/난이도 기준 자료
- [ ] 2.2 정상 고도·보장 경로·7개 구간·발판 종류·경사·동적 데이터 검증
- [ ] 2.3 기존 9개 발판 대신 기준 지형·원작 팔레트·바닥·벽·배경 반영

### 작업 그룹 3: 원작 조작과 진행 복원
**Dependencies:** 작업 그룹 2
**Phase:** fidelity
**Required Skills:** 실제 Luau 모듈 검사, 상태·시간 경계 검증
- [ ] 3.1 걷기·달리기·달리기 도약·낙하 종단/조향·매달림·벽 등반·스태미나
- [ ] 3.2 58도 궤도 카메라·고도별 연출·한글 HUD·정상 상태
- [ ] 3.3 동적 발판·진행 저장·마지막 발판 부활 연결과 기존 결제 안전성 회귀 검사

### 작업 그룹 4: 산출물과 검증
**Dependencies:** 작업 그룹 2, 3
**Phase:** verification
**Required Skills:** 독립 리뷰, 실행 증거
- [ ] 4.1 Luau 전체 검증과 원작 기준 비교, 결정적 파일 생성, 크기/객체 수 측정
- [ ] 4.2 독립 코드 리뷰와 보완
- [ ] 4.3 실제 스튜디오/웹 플레이 비교 (도구 승인 거절 시 미검증으로 유지)
- [ ] 4.4 한글 실행 안내·한계·검증 기록, 관련 변경만 커밋

## 최우선 작업 정정 — 2026-10-28 사용자 의도 반영

원본 좌표/개수 일치는 목표가 아니다. 작업그룹2의 원본 추출은 참고 자료 확보 단계로 종료하고, 2.3의 원본 월드 일대일 반영은 다음 작업으로 대체한다. 작업그룹3의 게임 조작·진행·부활 연결과 작업그룹4의 검증은 유지하되 새 맵을 대상으로 한다.

### 작업 그룹 5: 로블록스용 구성으로 게임 이식
**Dependencies:** spec.md 최우선 개정
**Phase:** roblox-adaptation
**Required Skills:** 게임 정체성 보존, 네이티브 구성, 실제 코드 검증
- [x] 5.1 원본 추출 도구/자료를 기본 빌드에서 분리해 선택적 참고 자료로 보존
- [x] 5.2 7개 구간과 공간/장치 변화를 갖는 결정적 로블록스용 맵 생성기
- [x] 5.3 기본 Part/Truss 중심의 도시·등반 구조, 경사 타일 복제 제거, 객체 수/스트리밍 예산
- [x] 5.4 새 경로 도달/착지/위험 검사와 기존 조작·진행·부활 연결 (실제 엔진과 구분)
- [x] 5.5 일반 빌드/검증에 Unity 또는 .NET 의존 없음, 한글 안내와 지원 차이 기록
- [x] 5.6 독립 리뷰, 실제 플레이 미검증 항목 구분, 관련 변경만 커밋

부모 최종 검증과 리뷰 증거: `status.md` 및 `verifications/2026-10-28-adaptation.md`. 실제 플레이 확인인4.3은 미완료로 유지한다. 이전 그룹2~4의 원본 일대일 지도 반영은 최신 사용자 정정으로 폐기/대체됐으며 추가 구현 요구가 아니다.
