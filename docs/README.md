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
│   ├── README.md              (핵심 구동 명령 요약)
│   ├── k8s-deployment.md      (K8s / k3s 배포 전체 가이드)
│   ├── local-dev-setup.md     (로컬 개발: bare-metal + k3d)
│   └── docker-infra.md        (레거시 compose 안내 / 백업 브랜치 포인터)
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
| **K8s / k3s 구동 (핵심 명령)** | [runbooks/README.md](runbooks/README.md) |
| **K8s / k3s 배포 상세 런북** | [runbooks/k8s-deployment.md](runbooks/k8s-deployment.md) |
| **K8s 배포 모델 (아키텍처)** | [architecture/k8s-deployment-model.md](architecture/k8s-deployment-model.md) |
| K8s 마이그레이션 결정 기록 | [adr/ADR-0019-k8s-migration.md](adr/ADR-0019-k8s-migration.md) |
| 로컬 개발 환경 | [runbooks/local-dev-setup.md](runbooks/local-dev-setup.md) |
| 전체 아키텍처 | [architecture/platform-overview.md](architecture/platform-overview.md) |
| Clean Architecture 원칙 | [architecture/00.clean-architecture.md](architecture/00.clean-architecture.md) |
| 서비스 경계 | [architecture/service-boundary.md](architecture/service-boundary.md) |
| ADR 목록 | [adr/](adr/) |
| 백업 스크립트 (source of truth) | [../docker/backup/README.md](../docker/backup/README.md) |
| 백업 K8s CronJob | [../k8s/infra/prod/backup/README.md](../k8s/infra/prod/backup/README.md) |

## ADR Numbering

- `ADR-0001` ~ `ADR-0009`: 커머스 플랫폼 핵심 결정 (4자리 번호)
- `ADR-001` ~ `ADR-004`: 차팅 서비스 결정 (3자리 번호, 별도 도메인)

새 ADR 작성 시 `_template.md`를 복사하여 사용한다.
커머스 플랫폼 ADR은 `ADR-0010`부터, 차팅 서비스 ADR은 `ADR-005`부터 이어간다.

## Governance

- 아키텍처 변경은 반드시 ADR을 먼저 작성하고 승인받은 후 구현한다.
- 기존 ADR과 충돌하는 결정이 필요하면, 기존 ADR을 Superseded 처리하고 새 ADR에서 명시적으로 참조한다.
- CLAUDE.md (루트)가 AI 에이전트의 최상위 작업 규약이다.
