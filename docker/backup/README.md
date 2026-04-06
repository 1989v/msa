# Backup Management

MSA Commerce Platform 프로덕션 데이터 백업/복구 시스템.

## Quick Start

1. 설정 파일 생성:
   ```bash
   cp config/backup.env.example config/backup.env
   # backup.env를 환경에 맞게 수정
   ```

2. 수동 풀백업 실행:
   ```bash
   ./scripts/backup-full.sh
   ```

3. cron 등록:
   ```bash
   # crontab 내용의 /path/to/를 실제 경로로 수정 후:
   crontab crontab
   ```

## Backup Schedule

| 작업 | 주기 | 스크립트 |
|------|------|----------|
| 풀백업 (MySQL + PostgreSQL + Files) | 매일 02:00 | `scripts/backup-full.sh` |
| Binlog 아카이브 | 매 시간 | `scripts/binlog-archive.sh` |
| 보관 기간 초과 삭제 | 풀백업 후 자동 | `scripts/cleanup.sh` |

## Restore

### MySQL (풀백업만)
```bash
./scripts/restore-mysql.sh --db product_db --date 2026-04-05
```

### MySQL (PITR — 특정 시점 복구)
```bash
./scripts/restore-mysql.sh --db product_db --date 2026-04-05 --pitr "2026-04-06 10:30:00"
```

### PostgreSQL
```bash
./scripts/restore-postgres.sh --db charting --date 2026-04-05
```

## Storage Providers

`config/backup.env`의 `STORAGE_PROVIDER`로 전환:

| Provider | 값 | 필요 도구 |
|----------|----|-----------|
| AWS S3 / MinIO | `s3` | `aws` CLI |
| Google Cloud Storage | `gcs` | `gsutil` CLI |
| 로컬/NAS | `local` | 없음 |

## Auto-Failover (비활성)

Orchestrator + ProxySQL 기반 자동 페일오버. 필요 시 활성화:

```bash
cd ha/
docker compose -f docker-compose.ha.yml --profile ha up -d
```

활성화 후 각 서비스의 `application-docker.yml`에서 datasource URL을 `proxysql:6033`으로 변경 필요.

## Retention Policy

| 대상 | 보관 기간 |
|------|-----------|
| 풀백업 (MySQL, PostgreSQL, Files) | 7일 |
| Binlog | 2일 |
