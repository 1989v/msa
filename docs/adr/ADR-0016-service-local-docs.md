# ADR-0016 서비스별 문서 분산 배치

## Status
Accepted

## Context

현재 모든 서비스 문서가 루트 `docs/` 디렉토리에 중앙 집중되어 있다:
- `docs/services/{service}.md` — 서비스별 설명서
- `docs/adr/ADR-001~004` — charting 전용 ADR이 플랫폼 ADR과 혼재

문제점:
1. 에이전트가 특정 서비스 작업 시 해당 서비스 문서를 자동으로 참조하지 못함 (경로에 없으므로)
2. charting 전용 ADR이 플랫폼 ADR과 섞여 있어 분류가 모호함
3. 서비스 삭제/분리 시 관련 문서를 별도로 찾아 정리해야 함
4. Claude Code는 작업 경로의 CLAUDE.md를 자동 로드하므로, 서비스별 컨텍스트 파일이 있으면 자동 참조 가능

OpenAI Harness Engineering의 "Strategic Context Management" 원칙 참고:
계층적 문서 구조(루트=공통, 하위=특화)로 토큰 효율성과 컨텍스트 정확성을 높일 수 있다.

## Decision

### 분류 기준
- **루트 `docs/`**: 2개 이상 서비스에 공통으로 적용되는 문서
- **`{service}/docs/`**: 해당 서비스에만 적용되는 문서

### 이동 대상
| 기존 위치 | 이동 위치 |
|-----------|-----------|
| `docs/services/{service}.md` | `{service}/docs/service.md` |
| `docs/adr/ADR-001~004` (charting 전용) | `charting/docs/adr/` |

### 유지 대상 (루트 docs/)
| 디렉토리 | 사유 |
|-----------|------|
| `docs/architecture/` | 플랫폼 공통 아키텍처 |
| `docs/adr/ADR-0001~0015` | 플랫폼 레벨 결정 |
| `docs/conventions/` | 전 서비스 공통 컨벤션 |
| `docs/standards/` | 전 서비스 공통 표준 |
| `docs/specs/` | 피처 스펙 (크로스 서비스 가능) |
| `docs/plans/` | 구현 계획 |
| `docs/runbooks/` | 운영 가이드 |
| `docs/benchmarks/` | 벤치마크 리포트 |

### 서비스별 CLAUDE.md
각 서비스 루트에 CLAUDE.md를 생성하여:
- 서비스 개요 및 로컬 docs 맵
- 서비스 특화 규칙/주의사항
- 빌드 명령어

## Alternatives Considered

1. **현상 유지 (중앙 집중)**: 관리 포인트는 적지만 에이전트 자동 참조 불가
2. **AGENTS.md 별도 사용**: OpenAI Codex용 컨벤션이므로 Claude Code에서는 CLAUDE.md로 통일이 적절

## Consequences

- 에이전트가 서비스 작업 시 해당 서비스의 CLAUDE.md + docs/를 자동 참조
- 서비스 독립성 강화 (삭제/분리 시 문서도 함께 이동)
- `docs/services/` 디렉토리 제거 (역할을 서비스별 docs/로 이관)
- 루트 CLAUDE.md의 Navigation에 서비스별 문서 안내 추가 필요
