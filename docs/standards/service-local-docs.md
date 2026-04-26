# 서비스별 문서 분산 배치 표준

> **출처**: ADR-0016 에서 이전 (ADR-0026 분류 정책에 따른 재배치). 문서 조직 정책이라 standards/ 가 본질적 위치.
> **History**: 원본 ADR 본문은 git history 의 `ADR-0016-service-local-docs.md` 참조.

## Context

기존에는 모든 서비스 문서가 루트 `docs/` 에 중앙 집중 (`docs/services/{service}.md`, `docs/adr/ADR-001~004` 가 charting 전용 포함). 다음 문제가 있었다:

1. 에이전트가 특정 서비스 작업 시 해당 서비스 문서를 자동으로 참조하지 못함 (경로에 없으므로)
2. charting 전용 ADR 이 플랫폼 ADR 과 섞여 있어 분류 모호
3. 서비스 삭제/분리 시 관련 문서 별도 정리 필요
4. Claude Code 는 작업 경로의 CLAUDE.md 를 자동 로드하므로, 서비스별 컨텍스트 파일이 있으면 자동 참조 가능

OpenAI Harness Engineering 의 "Strategic Context Management" 원칙: 계층적 문서 구조 (루트=공통, 하위=특화) 로 토큰 효율성과 컨텍스트 정확성 향상.

## 분류 기준

- **루트 `docs/`**: 2개 이상 서비스에 공통으로 적용되는 문서
- **`{service}/docs/`**: 해당 서비스에만 적용되는 문서

## 이동 대상

| 기존 위치 | 이동 위치 |
|-----------|-----------|
| `docs/services/{service}.md` | `{service}/docs/service.md` |
| `docs/adr/ADR-001~004` (charting 전용) | `charting/docs/adr/` |

## 유지 대상 (루트 docs/)

| 디렉토리 | 사유 |
|-----------|------|
| `docs/architecture/` | 플랫폼 공통 아키텍처 |
| `docs/adr/ADR-0001~` (플랫폼) | 플랫폼 레벨 결정 |
| `docs/conventions/` | 전 서비스 공통 컨벤션 |
| `docs/standards/` | 전 서비스 공통 표준 (본 문서 포함) |
| `docs/specs/` | 피처 스펙 (크로스 서비스 가능) |
| `docs/plans/` | 구현 계획 |
| `docs/runbooks/` | 운영 가이드 |
| `docs/benchmarks/` | 벤치마크 리포트 |

## 서비스별 CLAUDE.md

각 서비스 루트에 CLAUDE.md 를 생성하여:
- 서비스 개요 및 로컬 docs 맵
- 서비스 특화 규칙/주의사항
- 빌드 명령어

## 효과

- 에이전트가 서비스 작업 시 해당 서비스의 CLAUDE.md + docs/ 를 자동 참조
- 서비스 독립성 강화 (삭제/분리 시 문서도 함께 이동)
- `docs/services/` 디렉토리 제거 (역할을 서비스별 docs/ 로 이관)
- 루트 CLAUDE.md 의 Navigation 에 서비스별 문서 안내 포함

## 거부된 대안

1. **현상 유지 (중앙 집중)**: 관리 포인트는 적지만 에이전트 자동 참조 불가
2. **AGENTS.md 별도 사용**: OpenAI Codex 용 컨벤션이므로 Claude Code 에서는 CLAUDE.md 로 통일이 적절

## References

- 본 표준의 거버넌스: ADR-0026 docs taxonomy
- 문서-소스 추적: `docs/standards/doc-index-tracking.md`
