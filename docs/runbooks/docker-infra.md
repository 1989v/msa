# Docker Infrastructure (Legacy)

> **이 문서는 역사 참조용이다.** docker-compose 기반 인프라 운영 경로는
> 2026-04-10 [ADR-0019](../adr/ADR-0019-k8s-migration.md) Phase 6에서
> 완전히 제거됐다. 현재 main 브랜치에는 `docker/docker-compose*.yml`과
> `docker/{mysql,elasticsearch,clickhouse,nginx,monitoring,debezium}/` 전체가
> 없으며, 과거 경로를 쓰려면 백업 브랜치로 전환해야 한다.

## 현재 진입점

| 목적 | 가이드 |
|------|--------|
| 로컬 단일 서비스 개발 | [`local-dev-setup.md`](local-dev-setup.md) |
| 전체 스택 통합 기동 | [`README.md`](README.md), [`k8s-deployment.md`](k8s-deployment.md) |
| 운영 배포 (managed K8s) | [`k8s-deployment.md`](k8s-deployment.md) §2 |

## 레거시 docker-compose 상태가 필요할 때

`backup/docker-compose-snapshot` 브랜치가 `cdebf27` (Phase 6 직전 시점)을
가리킨다. 원격에도 push돼 있다.

```bash
# 별도 worktree로 꺼내서 쓰는 게 안전 (메인 작업과 격리)
git worktree add ../msa-compose backup/docker-compose-snapshot
cd ../msa-compose

# 예전 명령 그대로 작동
docker compose -f docker/docker-compose.infra.yml up -d
docker compose -f docker/docker-compose.yml up -d
```

주의:

- 이 브랜치는 **수정·커밋하지 않고** 참조 용도로만 쓴다.
- main 브랜치로 돌아올 땐 worktree를 정리: `git worktree remove ../msa-compose`.
- 백업 브랜치는 최소 12개월 보존 정책 (ADR-0019 §Consequences).

## 현 저장소에 남아 있는 Docker 자산

`docker/` 디렉토리가 완전히 사라진 것은 아니다. 남아 있는 것:

| 파일/디렉토리 | 용도 |
|---------------|------|
| `docker/Dockerfile` | Phase 5 backup-runner 이미지 빌드 컨텍스트 + 향후 비 JVM 서비스용 |
| `docker/backup/scripts/`, `config/`, `storage-providers/`, `README.md`, `crontab` | source of truth. Phase 5의 `k8s/infra/prod/backup/Dockerfile`이 COPY해서 이미지 빌드 |
| `docker/.env` / `.env.example` | 환경 변수 샘플 (저위험, 추후 정리 대상) |

사라진 것 (Phase 6에서 삭제, 백업 브랜치에서만 조회 가능):

- `docker/docker-compose.yml`, `.infra.yml`, `.monitoring.yml`, `.nginx.yml`
- `docker/docker-down.sh`
- `docker/nginx/`, `docker/mysql/`, `docker/elasticsearch/`, `docker/clickhouse/`, `docker/debezium/`
- `docker/monitoring/` (Grafana 대시보드 3개는 `k8s/infra/prod/monitoring/dashboards/`로 이관)
- `docker/backup/ha/` (Orchestrator + ProxySQL failover compose — Percona Operator로 대체)

## "docker 데몬 자체도 안 쓰냐?"

ADR-0019의 "Docker 잔재 zero"는 **운영 의존성 제거**로 정의된다. 즉
"docker-compose로 운영 스택을 올리지 않는다"는 뜻이고, **Docker 런타임(엔진)은
여전히 필요**하다. 이유:

- **k3d**는 Docker 컨테이너 안에 k3s 노드를 띄운다 → Docker 엔진 필수.
- **Jib**는 이미지 빌드 자체엔 Docker 엔진이 필요 없지만(`jibBuildTar`),
  로컬 테스트 용으로 `jibDockerBuild`를 쓰면 엔진이 필요하다.
- **백업 러너 이미지**는 `k8s/infra/prod/backup/Dockerfile`로 빌드하며, 이
  과정에서 `docker build`를 쓴다 (또는 Buildx, Kaniko, Buildpacks 등).

대체 런타임(Colima, Podman, Rancher Desktop)을 써도 무방하다. 핵심은 OCI
런타임이 로컬에 있어야 k3d / kind / 이미지 빌드가 동작한다는 것이다.

## 참고

- [ADR-0019: K8s 마이그레이션 결정](../adr/ADR-0019-k8s-migration.md)
- [k8s-deployment.md](k8s-deployment.md) — 새 배포 가이드 전체
- [architecture/k8s-deployment-model.md](../architecture/k8s-deployment-model.md) — 아키텍처 요약
