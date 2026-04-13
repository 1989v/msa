---
name: portfolio-gen
description: 코드베이스를 분석하여 기술 포트폴리오(docs/portfolio/)를 자동 생성/갱신한다. 포트폴리오 갱신, 기술 정리, 이력서 업데이트 등의 자연어 요청에도 반응.
argument-hint: [--full | --section 01-architecture | --diff]
---

# Tech Portfolio Generator

코드베이스, ADR, docs, 실제 코드를 분석하여 `docs/portfolio/` 하위에 10년차 개발자 관점의 기술 포트폴리오를 생성/갱신한다.

## 트리거

- `/portfolio-gen` — 전체 재생성
- `/portfolio-gen --section 01-architecture` — 특정 섹션만 갱신
- `/portfolio-gen --diff` — 마지막 갱신 이후 변경분만 반영
- 자연어: "포트폴리오 갱신", "기술 정리 업데이트", "이력서 자료 갱신"

## 출력 구조

```
docs/portfolio/
├── README.md                 # 상위 요약본 + 매핑 테이블
├── 01-architecture.md        # System Architecture
├── 02-distributed-systems.md # Distributed Systems Patterns
├── 03-data-platform.md       # Data Platform
├── 04-infrastructure.md      # Cloud Native & DevOps
├── 05-security.md            # Security
├── 06-testing.md             # Testing Strategy
├── 07-frontend.md            # Frontend & Visualization
├── 08-ai-engineering.md      # AI Engineering
└── 09-polyglot.md            # Polyglot & DX
```

## 실행 단계

### 1. 코드베이스 분석 (3개 병렬 에이전트)

3개 Explore 에이전트를 병렬로 실행하여 최신 코드베이스 상태를 파악:

**Agent A — Architecture & Patterns**:
- `settings.gradle.kts` 서비스 목록 확인
- `docs/adr/` 전체 ADR 목록 & 주요 결정 사항
- `docs/architecture/` 아키텍처 문서
- 각 서비스의 Clean Architecture 구조 확인 (domain/app 분리)
- 분산 시스템 패턴 적용 코드 탐색 (Circuit Breaker, Outbox, Idempotent Consumer 등)

**Agent B — Infrastructure & DevOps**:
- `k8s/` 디렉토리 구조 & Kustomize 설정
- `buildSrc/` Convention Plugin
- `.github/workflows/` CI/CD
- `docker/backup/` 백업 인프라
- `scripts/` 유틸리티
- `gradle/libs.versions.toml` 버전 카탈로그

**Agent C — Services & Frontend**:
- 각 서비스 CLAUDE.md, 주요 코드 패턴
- 프론트엔드 서비스 (code-dictionary-fe, admin, charting-fe)
- Python 서비스 (charting)
- `common/` 공통 라이브러리
- `agent-os/` AI 하네스
- `ideabank/` 아이디어 파이프라인
- `docs/specs/`, `docs/plans/` 스펙 & 계획

### 2. 문서 생성/갱신

분석 결과를 바탕으로 각 섹션 파일을 생성 또는 갱신:

- `--full`: 전체 재생성 (기존 파일 덮어쓰기)
- `--section {name}`: 해당 섹션만 갱신
- `--diff`: `git diff` 기반 변경 서비스/파일 식별 → 관련 섹션만 갱신

각 섹션에는 반드시 포함:
- **기술 포인트**: 10년차 개발자 관점에서 어필할 수 있는 핵심 역량
- **코드 위치**: 실제 구현 파일 경로
- **ADR/문서 근거**: 아키텍처 결정의 배경
- **패턴 예시**: 구체적 코드 스니펫 (간결하게)

### 3. README.md 갱신

모든 섹션 파일 기반으로 README.md의 매핑 테이블과 서비스 맵을 갱신.

### 4. 타임스탬프

README.md 하단의 `Last updated:` 날짜를 현재 날짜로 갱신.

## 작성 원칙

1. **이력서 관점**: 기술 나열이 아닌, "왜 이 선택을 했는지" 의사결정 역량 강조
2. **코드 증거**: 모든 주장에 코드 경로 첨부
3. **간결함**: 각 섹션 200줄 이내, README.md는 100줄 이내
4. **ADR 연결**: 가능하면 ADR 번호로 근거 명시
5. **최신성**: 현재 코드베이스 기준 (과거 기록은 git log 참조)

## 주의사항

- 없는 기능을 있는 것처럼 쓰지 않는다 (Phase 2 계획은 "계획"으로 명시)
- 코드 경로는 실제 존재하는 파일만 기재 (glob으로 확인)
- 민감 정보 (키, 비밀번호, 내부 URL) 포함하지 않음
