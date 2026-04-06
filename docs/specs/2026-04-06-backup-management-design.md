# Backup Management Design

## 1. Overview

MSA Commerce Platform 프로덕션 환경의 데이터 백업 및 복구 프로세스 설계.
Shell Script + Cron 기반으로 구현하며, 자동 페일오버(Orchestrator/ProxySQL)는 설계만 포함하고 활성화는 이후 필요 시 진행한다.

---

## 2. Requirements

| 항목 | 결정 |
|------|------|
| 환경 | 프로덕션 |
| RPO | ~0 (Binlog PITR) |
| RTO | 수 분 (풀백업 복원 + binlog replay) |
| 백업 방식 | Percona XtraBackup (MySQL) + pg_basebackup (PostgreSQL) + rsync (File) |
| 스토리지 | 클라우드 무관 — S3/GCS/MinIO 플러그인 방식 |
| 보관 정책 | 풀백업 7일 + binlog 2일 |
| 페일오버 | Orchestrator + ProxySQL (설계 포함, 비활성 상태) |

### 2.1 백업 대상

| 저장소 | 인스턴스 | 백업 방식 |
|--------|----------|-----------|
| MySQL 8.0 | product_db, order_db, auth_db, gifticon_db, code_dictionary_db (각 Master-Replica) | XtraBackup + Binlog PITR |
| PostgreSQL 16 | charting (pgvector) | pg_basebackup + WAL archiving |
| File Storage | gifticon-images 볼륨 | rsync |

### 2.2 백업 제외 대상 (원본 재생성 가능)

| 저장소 | 제외 사유 |
|--------|-----------|
| Redis Cluster | 캐시/세션 — 유실 시 재생성/재로그인 |
| Elasticsearch | MySQL(product)이 원본, 재색인으로 복구 |
| OpenSearch | MySQL(code-dictionary)이 원본, 재색인으로 복구 |
| Kafka | 메시징 용도, 7일 retention 후 자연 소멸 |

---

## 3. Architecture

### 3.1 선택: Shell Script + Cron (Approach A)

```
cron (매일 새벽 2시)
  └→ backup-full.sh
       ├→ xtrabackup --backup (MySQL 5개 순차)
       ├→ pg_basebackup (PostgreSQL)
       ├→ rsync (gifticon 이미지)
       ├→ upload.sh → 외부 스토리지 (플러그인)
       └→ cleanup.sh (7일 초과 삭제)

cron (매 시간)
  └→ binlog-archive.sh
       ├→ mysqlbinlog --read-from-remote-server (각 Master)
       └→ upload.sh → 외부 스토리지
```

### 3.2 디렉토리 구조

```
docker/backup/
├── scripts/
│   ├── backup-full.sh          # 일일 풀백업 오케스트레이터
│   ├── backup-mysql.sh         # XtraBackup 실행
│   ├── backup-postgres.sh      # pg_basebackup 실행
│   ├── backup-files.sh         # rsync 실행
│   ├── binlog-archive.sh       # binlog 원격 보관
│   ├── restore-mysql.sh        # MySQL 복구 (풀백업 + PITR)
│   ├── restore-postgres.sh     # PostgreSQL 복구
│   ├── cleanup.sh              # 보관 기간 초과 백업 삭제
│   └── upload.sh               # 스토리지 업로드 (플러그인 분기)
├── storage-providers/
│   ├── s3.sh                   # AWS S3 / S3 호환 (MinIO)
│   ├── gcs.sh                  # Google Cloud Storage
│   └── local.sh                # 로컬/NAS
├── config/
│   ├── backup.env              # 스토리지 설정, 보관 기간, DB 접속 정보
│   ├── backup.env.example      # 템플릿
│   └── databases.conf          # 백업 대상 DB 목록
├── crontab                     # cron 스케줄 정의
├── ha/
│   ├── docker-compose.ha.yml   # Orchestrator + ProxySQL (비활성)
│   ├── orchestrator/
│   │   └── orchestrator.conf.json
│   └── proxysql/
│       └── proxysql.cnf
└── README.md                   # 운영 가이드
```

### 3.3 스토리지 플러그인

`upload.sh`에서 `STORAGE_PROVIDER` 환경변수로 분기:

```bash
# backup.env
STORAGE_PROVIDER=s3          # s3 | gcs | local
S3_BUCKET=msa-backups
S3_ENDPOINT=                 # MinIO 등 커스텀 엔드포인트 (비워두면 AWS 기본)
GCS_BUCKET=msa-backups
LOCAL_BACKUP_DIR=/mnt/backup
```

```bash
# upload.sh
source "$(dirname "$0")/storage-providers/${STORAGE_PROVIDER}.sh"
upload_file "$LOCAL_PATH" "$REMOTE_PATH"
```

### 3.4 백업 흐름 상세

#### MySQL (XtraBackup + Binlog PITR)

```
1. xtrabackup --backup --target-dir=/backup/mysql/{db}/{date}
2. xtrabackup --prepare --target-dir=/backup/mysql/{db}/{date}
3. upload.sh /backup/mysql/{db}/{date} → remote:mysql/{db}/{date}/
4. binlog-archive.sh (매 시간):
   - mysqlbinlog --read-from-remote-server --host={master} --raw
   - upload.sh → remote:mysql/{db}/binlog/
```

#### PostgreSQL (pg_basebackup + WAL)

```
1. pg_basebackup -h {host} -D /backup/postgres/charting/{date} -Ft -z
2. upload.sh → remote:postgres/charting/{date}/
3. WAL archiving: archive_command으로 WAL 파일 자동 전송
```

#### File Storage

```
1. rsync -az /app/storage/gifticon-images/ /backup/files/gifticon/{date}/
2. upload.sh → remote:files/gifticon/{date}/
```

### 3.5 복구 흐름

#### MySQL PITR 복구

```bash
# 1. 풀백업 복원
restore-mysql.sh --db product_db --date 2026-04-05

# 2. PITR (특정 시점까지 binlog replay)
restore-mysql.sh --db product_db --date 2026-04-05 --pitr "2026-04-06 10:30:00"

# 내부 동작:
# xtrabackup --prepare → xtrabackup --copy-back
# mysqlbinlog --stop-datetime="2026-04-06 10:30:00" binlog.* | mysql
```

#### PostgreSQL 복구

```bash
restore-postgres.sh --db charting --date 2026-04-05
# pg_basebackup 복원 + recovery.conf로 WAL replay
```

### 3.6 보관 정책

```bash
# cleanup.sh
FULL_BACKUP_RETENTION_DAYS=7
BINLOG_RETENTION_DAYS=2

# 로컬 정리
find /backup/mysql -maxdepth 2 -mindepth 2 -mtime +${FULL_BACKUP_RETENTION_DAYS} -exec rm -rf {} +

# 원격 정리 (스토리지 플러그인별 구현)
# s3.sh  → aws s3 rm --recursive (또는 S3 Lifecycle Policy로 위임)
# gcs.sh → gsutil rm -r (또는 GCS Lifecycle Rule로 위임)
# local.sh → find + rm (로컬과 동일)
source "$(dirname "$0")/storage-providers/${STORAGE_PROVIDER}.sh"
cleanup_remote "mysql" "$FULL_BACKUP_RETENTION_DAYS"
cleanup_remote "binlog" "$BINLOG_RETENTION_DAYS"
```

### 3.7 모니터링/알림

백업 스크립트 종료 코드 기반으로 알림:

```bash
# backup-full.sh 마지막
if [ $EXIT_CODE -ne 0 ]; then
    # webhook 알림 (Slack, Discord 등)
    curl -X POST "$ALERT_WEBHOOK_URL" -d "{\"text\": \"Backup FAILED: ${DB_NAME}\"}"
fi
```

---

## 4. Auto-Failover Layer (비활성 설계)

필요 시 `cd ha/ && docker compose -f docker-compose.ha.yml --profile ha up -d`로 활성화.

> Note: MySQL 서비스는 별도 compose 파일(docker-compose.infra.yml)에서 관리되므로 depends_on 대신 commerce-network(external)를 통해 통신한다.

### 4.1 docker-compose.ha.yml

```yaml
services:
  orchestrator:
    image: openarkcode/orchestrator:latest
    profiles: [ha]
    ports:
      - "3000:3000"
    volumes:
      - ./orchestrator/orchestrator.conf.json:/etc/orchestrator.conf.json

  proxysql:
    image: proxysql/proxysql:latest
    profiles: [ha]
    ports:
      - "6033:6033"   # MySQL 프로토콜
      - "6032:6032"   # Admin
    volumes:
      - ./proxysql/proxysql.cnf:/etc/proxysql.cnf
```

### 4.2 동작 원리

```
App → ProxySQL:6033 → Master (정상 시)
                     → Replica 승격 (장애 시, Orchestrator가 판단)

Orchestrator:
  - Master 헬스체크 (3초 간격)
  - 장애 감지 → Replica를 Master로 승격 (GTID 기반)
  - ProxySQL 라우팅 자동 갱신
```

### 4.3 활성화 시 앱 변경사항

```yaml
# application-docker.yml (각 서비스)
spring:
  datasource:
    master:
      url: jdbc:mysql://proxysql:6033/{db}  # 직접 Master 대신 ProxySQL 경유
```

---

## 5. Alternative Approaches

선택하지 않았지만 상황에 따라 고려할 수 있는 대안.

### 5.1 Approach B: Docker 전용 백업 컨테이너

```
docker-compose.backup.yml
  ├→ backup-scheduler (cron 컨테이너)
  ├→ backup-agent (xtrabackup + pg_basebackup)
  └→ backup-uploader (스토리지 업로드)
```

**고려 시점:**
- 백업 환경을 호스트에서 완전히 격리하고 싶을 때
- CI/CD 파이프라인에서 백업 컨테이너를 자동 배포할 때
- Kubernetes 전환 시 CronJob으로 자연스럽게 마이그레이션 가능

**트레이드오프:** 볼륨 마운트 복잡도 증가, 디버깅 시 컨테이너 진입 필요

### 5.2 Approach C: Ansible/Terraform IaC

```
ansible-playbook backup-setup.yml
  ├→ role: mysql-backup
  ├→ role: postgres-backup
  ├→ role: file-backup
  └→ role: storage-provider
```

**고려 시점:**
- 멀티 서버/멀티 리전으로 확장 시
- 동일 백업 구성을 여러 환경(staging, production)에 반복 적용할 때
- 인프라 변경 이력을 코드로 관리하고 싶을 때

**트레이드오프:** 러닝 커브, 단일 호스트에서는 과잉

### 5.3 Cloud Managed (AWS RDS 등)

**고려 시점:**
- 운영 인력이 제한적이고 백업/복구 자동화를 완전 위임하고 싶을 때
- 자동 스냅샷, 자동 페일오버, 리전 간 복제가 필요할 때

**트레이드오프:** 비용이 높고 벤더 종속

---

## 6. Implementation Checklist

1. `docker/backup/scripts/` 스크립트 구현
2. `docker/backup/storage-providers/` 플러그인 구현
3. `docker/backup/config/backup.env.example` 작성
4. `docker/backup/crontab` 스케줄 정의
5. `docker/backup/docker-compose.ha.yml` Orchestrator/ProxySQL 정의 (비활성)
6. 복구 테스트 절차 문서화
7. 모니터링/알림 webhook 연동
