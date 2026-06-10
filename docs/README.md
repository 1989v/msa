# Commerce Platform Documentation Index

이 디렉토리는 MSA Commerce Platform의 모든 기술 문서를 포함한다.

## Directory Structure

```
docs/
├── README.md                  ← 이 파일 (문서 색인)
├── architecture/              ← 아키텍처 설계 문서 (clean-architecture, module-structure,
│                                 platform-overview, k8s-deployment-model, kafka-convention …)
├── adr/                       ← Architecture Decision Records (ADR-0001 ~)
├── conventions/               ← 코딩 컨벤션 (kotlin-style, jpa-persistence, logging,
│                                 entity-mutation, transactional-usage, frontend-design …)
├── standards/                 ← 프로세스/도구 표준 (test-rules, design-md, agent-behavior,
│                                 doc-index-tracking …)
├── specs/                     ← 피처 스펙 ({date}-{feature}/planning/…)
├── plans/                     ← 구현 계획서
├── product/                   ← 프로덕트 컨텍스트 (mission, glossary …)
├── runbooks/                  ← 운영 가이드 (k8s-deployment, local-dev-setup, oci-ops-journal …)
├── retrospectives/            ← 세션 회고
├── study/                     ← 학습/개념 정리 (위치 정책은 ADR-0026 참조)
├── portfolio/                 ← 기술 포트폴리오 (portfolio-gen 산출물)
├── backup/ · benchmarks/ · assets/ · site/
```

> 서비스별 기술 문서는 `docs/services/` 가 아니라 **각 서비스 디렉토리의
> `CLAUDE.md` + `docs/`** 에 있다 (ADR-0016 service-local docs).
> 차팅 서비스는 ADR-0036 에서 quant 로 통합 후 제거됨 (2026-05-02),
> discovery(Eureka) 는 ADR-0019 K8s 전환에서 제거됨.

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

- `ADR-0001` ~ : 커머스 플랫폼 결정 (4자리 번호, 단일 시퀀스)
- 새 ADR 작성 시 `_template.md` 를 복사하고, **반드시 `ls docs/adr/ | sort | tail` 로
  마지막 번호를 확인한 뒤 +1** 한다 (번호 중복 사고 방지 — 2026-06-10 에 0015/0025/0026
  3쌍 충돌을 0052~0054 로 정리한 전례가 있다).
- 서비스 특화 ADR 은 해당 서비스의 `docs/adr/` 에 둔다 (예: `quant/docs/adr/`).

## Governance

- 아키텍처 변경은 반드시 ADR을 먼저 작성하고 승인받은 후 구현한다.
- 기존 ADR과 충돌하는 결정이 필요하면, 기존 ADR을 Superseded 처리하고 새 ADR에서 명시적으로 참조한다.
- CLAUDE.md (루트)가 AI 에이전트의 최상위 작업 규약이다.
