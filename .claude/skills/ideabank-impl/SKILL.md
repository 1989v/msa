---
name: ideabank-impl
description: 완성된 PRD(status ready)를 기반으로 실제 서비스를 구현한다. 아이디어 구현, 서비스 만들어줘, PRD 구현 등의 자연어 요청에도 반응.
argument-hint: [아이디어 번호]
---

# Idea Bank — Implement (서비스 구현)

status가 `ready`인 PRD를 기반으로 실제 서비스 프로젝트를 생성하고 구현한다.

## 트리거

- `/ideabank-impl` — ready 상태인 PRD 목록을 보여주고 선택
- `/ideabank-impl 3` — 3번 PRD를 바로 구현 시작
- 자연어: "아이디어 구현해줘", "서비스 만들어줘", "PRD 구현 시작", "아이디어 뱅크에서 하나 꺼내서 구현"

## 실행 단계

### 1. PRD 선택 및 검증

1. `ideabank/docs/` 디렉토리를 스캔 (Glob 도구)
2. 각 PRD의 frontmatter status 확인 (Read 도구)

- **번호가 주어진 경우**: 해당 PRD를 열고 status 확인
- **번호가 없는 경우**: `ready` 상태인 PRD 목록을 표시하고 선택 요청

```
| # | 제목 | 상태 | 서비스 디렉토리 |
|---|------|------|----------------|
| 1 | 퀀트 트레이더 자동매매 | ready | quant-trader/ |
| 6 | 한동 파이프 웹 서비스 | ready | handong-pipe/ |
```

**status가 ready가 아닌 경우**:
- `draft`: `/ideabank-init {번호}` 후 `/ideabank-bs {번호}` 안내
- `refined`: `/ideabank-bs {번호}` 로 추가 브레인스토밍 안내
- `implemented`: 이미 구현 완료됨을 알림

### 2. Private Repo 여부 확인

PRD 검증 후, 서비스를 private repo로 관리할지 사용자에게 확인한다.

AskUserQuestion으로 질문:
- **"이 서비스를 private repo로 관리할까요?"**
- 옵션 1: **Public** — msa 메인 repo에 포함 (기본)
- 옵션 2: **Private** — 별도 private repo + git submodule로 분리

**Private 선택 시**:
- 구현 완료 후 `/private-repo {서비스 디렉토리}` 스킬을 자동 호출하여 분리
- PRD frontmatter에 `visibility: private` 추가

**Public 선택 시**:
- PRD frontmatter에 `visibility: public` 추가
- 기존 방식대로 msa 루트 하위에 디렉토리 생성

### 3. PRD 분석 및 구현 계획

선택된 PRD를 읽고:

1. **PRD 요약 출력** — 핵심 기능, 기술 스택, 서비스 구조
2. **구현 계획 수립** — PRD 내용을 기반으로 단계별 구현 계획 작성
3. **사용자 확인** — 계획을 보여주고 승인 요청

구현 계획에 포함할 사항:
- 서비스 디렉토리 구조 (msa 루트 하위에 독립 디렉토리로 생성)
- 기술 스택 및 의존성
- 핵심 기능별 구현 순서
- MVP 범위 (1차 구현 범위)
- Private/Public 여부 (2단계에서 결정된 사항 반영)

### 3. 서비스 프로젝트 생성

사용자 승인 후:

1. msa 루트 디렉토리 하위에 서비스 디렉토리 생성 (예: `quant-trader/`, `handong-pipe/`)
2. PRD의 기술 스택에 맞는 프로젝트 초기화
3. 기본 구조 scaffolding

**중요**: 각 서비스는 msa 루트의 독립 디렉토리로 생성된다 (charting/ 처럼).
기존 MSA 커머스 플랫폼(product, order, search 등)의 nested submodule 구조와는 별개.

### 4. 단계별 구현

- 구현 계획에 따라 순차적으로 기능 구현
- 각 단계 완료 시 사용자에게 진행 상황 보고
- 복잡한 구현의 경우 `superpowers:writing-plans` 스킬을 호출하여 상세 실행 계획 수립
- 구현 중 설계 변경이 필요하면 사용자와 협의

### 5. Private Repo 분리 (visibility: private인 경우)

PRD의 `visibility`가 `private`인 경우, 구현 완료 직후:

1. `/private-repo {서비스 디렉토리}` 스킬을 호출하여 자동 분리
2. 분리 완료 후 다음 단계(6단계) 진행

### 6. 구현 완료 처리

모든 구현이 끝나면:

1. **PRD 상태 업데이트**: `status: ready` → `status: implemented`
2. **PRD에 구현 결과 추가**: 실제 서비스 디렉토리, 실행 방법 등, private 여부
3. **tempidea.md 업데이트** (PRD 현황 표 + Completed Ideas):
   - PRD 현황 표에서 해당 행의 상태를 `implemented`로 업데이트
   - Pending Ideas에서 해당 아이디어를 제거
   - Completed Ideas 섹션으로 이동 (형식: `[번호]. [제목] — PRD: ideabank/docs/{파일명} | 서비스: {directory}/`)
4. **결과 보고**: 구현된 서비스 요약, 실행 방법, 향후 개선 사항, private/public 상태

## 구현 원칙

- PRD에 명시된 MVP 범위를 우선 구현
- 과도한 엔지니어링 금지 — PRD에 있는 것만 구현
- 서비스가 독립적으로 실행 가능해야 함
- README.md에 실행 방법 문서화

## 에러 처리

- PRD가 없는 번호 지정 시: `/ideabank-init {번호}` 안내
- ready 상태가 아닌 PRD 지정 시: 현재 상태와 필요한 다음 단계 안내
- 구현 중 기술적 제약 발견 시: 사용자와 협의 후 PRD 수정
