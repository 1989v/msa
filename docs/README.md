# Commerce Platform Documentation Index

이 디렉토리는 MSA Commerce Platform의 모든 기술 문서를 포함한다.

## Directory Structure

```
docs/
├── README.md                  ← 이 파일 (문서 색인)
├── architecture/              ← 아키텍처 설계 문서
│   ├── 00.clean-architecture.md
│   ├── platform-overview.md
│   ├── service-boundary.md
│   ├── communication.md
│   ├── data-strategy.md
│   ├── resilience-strategy.md
│   └── cdc-pipeline.md
├── adr/                       ← Architecture Decision Records
│   ├── _template.md
│   ├── ADR-0001 ~ ADR-0009   (커머스 플랫폼)
│   └── ADR-001 ~ ADR-004     (차팅 서비스)
├── services/                  ← 서비스별 기술 문서
│   ├── product.md
│   ├── order.md
│   ├── search.md
│   ├── gateway.md
│   ├── discovery.md
│   ├── common.md
│   └── charting.md
├── conventions/               ← 코딩/운영 컨벤션
│   ├── package-structure.md
│   ├── testing.md
│   ├── api-format.md
│   └── kafka-topics.md
├── runbooks/                  ← 운영 가이드
│   ├── local-dev-setup.md
│   └── docker-infra.md
├── study/                     ← 학습/개념 정리
│   ├── git-submodule.md
│   └── database-backup-concepts.md
└── plans/                     ← 구현 계획서
    ├── 2026-03-02-msa-commerce-platform.md
    ├── 2026-03-09-search-batch-db-reader.md
    ├── 2026-03-09-search-pipeline.md
    ├── 2026-03-10-pattern-chart-ui-design.md
    └── 2026-03-10-pattern-chart-ui.md
```

## Quick Links

| 주제 | 문서 |
|------|------|
| 전체 아키텍처 | [platform-overview.md](architecture/platform-overview.md) |
| Clean Architecture 원칙 | [00.clean-architecture.md](architecture/00.clean-architecture.md) |
| 서비스 경계 | [service-boundary.md](architecture/service-boundary.md) |
| ADR 목록 | [adr/](adr/) |
| 로컬 개발 환경 | [local-dev-setup.md](runbooks/local-dev-setup.md) |
| 백업 설계 스펙 | [backup-management-design.md](superpowers/specs/2026-04-06-backup-management-design.md) |
| 백업 운영 가이드 | [docker/backup/README.md](../docker/backup/README.md) |

## ADR Numbering

- `ADR-0001` ~ `ADR-0009`: 커머스 플랫폼 핵심 결정 (4자리 번호)
- `ADR-001` ~ `ADR-004`: 차팅 서비스 결정 (3자리 번호, 별도 도메인)

새 ADR 작성 시 `_template.md`를 복사하여 사용한다.
커머스 플랫폼 ADR은 `ADR-0010`부터, 차팅 서비스 ADR은 `ADR-005`부터 이어간다.

## Governance

- 아키텍처 변경은 반드시 ADR을 먼저 작성하고 승인받은 후 구현한다.
- 기존 ADR과 충돌하는 결정이 필요하면, 기존 ADR을 Superseded 처리하고 새 ADR에서 명시적으로 참조한다.
- CLAUDE.md (루트)가 AI 에이전트의 최상위 작업 규약이다.
