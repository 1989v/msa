# Backup Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shell Script + Cron 기반의 프로덕션 데이터 백업/복구 시스템 구현 (MySQL XtraBackup + Binlog PITR, PostgreSQL pg_basebackup + WAL, File rsync) + 자동 페일오버 레이어 비활성 설계

**Architecture:** 모든 백업 스크립트는 `docker/backup/` 하위에 위치한다. 스토리지 업로드는 플러그인 패턴(`STORAGE_PROVIDER` 환경변수)으로 S3/GCS/Local을 교체 가능하게 한다. Orchestrator/ProxySQL은 docker-compose의 `profiles: [ha]`로 정의만 해두고 비활성 상태를 유지한다.

**Tech Stack:** Bash, Percona XtraBackup 8.0, pg_basebackup, rsync, Docker Compose profiles, cron

**Spec:** `docs/superpowers/specs/2026-04-06-backup-management-design.md`

---

## File Structure

```
docker/backup/
├── config/
│   ├── backup.env.example          # 환경변수 템플릿
│   └── databases.conf              # 백업 대상 DB 목록
├── scripts/
│   ├── backup-full.sh              # 일일 풀백업 오케스트레이터
│   ├── backup-mysql.sh             # 단일 MySQL DB XtraBackup 실행
│   ├── backup-postgres.sh          # PostgreSQL pg_basebackup 실행
│   ├── backup-files.sh             # rsync 파일 백업
│   ├── binlog-archive.sh           # binlog 원격 보관 (매 시간)
│   ├── restore-mysql.sh            # MySQL 복구 (풀백업 + PITR)
│   ├── restore-postgres.sh         # PostgreSQL 복구
│   ├── upload.sh                   # 스토리지 업로드 디스패처
│   ├── cleanup.sh                  # 보관 기간 초과 백업 삭제
│   └── notify.sh                   # 알림 (성공/실패)
├── storage-providers/
│   ├── s3.sh                       # AWS S3 / MinIO
│   ├── gcs.sh                      # Google Cloud Storage
│   └── local.sh                    # 로컬/NAS
├── crontab                         # cron 스케줄 정의
├── ha/
│   ├── docker-compose.ha.yml       # Orchestrator + ProxySQL (비활성)
│   ├── orchestrator/
│   │   └── orchestrator.conf.json  # Orchestrator 설정
│   └── proxysql/
│       └── proxysql.cnf            # ProxySQL 설정
└── README.md                       # 운영 가이드
```

---

## Task 1: 환경변수 템플릿 및 DB 목록 설정

**Files:**
- Create: `docker/backup/config/backup.env.example`
- Create: `docker/backup/config/databases.conf`

- [ ] **Step 1: backup.env.example 작성**

```bash
# docker/backup/config/backup.env.example

# ===== Storage Provider =====
# s3 | gcs | local
STORAGE_PROVIDER=local

# S3 / MinIO
S3_BUCKET=msa-backups
S3_ENDPOINT=                          # MinIO: http://minio:9000, AWS: 비워두면 기본
S3_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# GCS
GCS_BUCKET=msa-backups
GOOGLE_APPLICATION_CREDENTIALS=

# Local / NAS
LOCAL_BACKUP_DIR=/mnt/backup

# ===== MySQL =====
MYSQL_ROOT_PASSWORD=commerce_root_pw_2024
MYSQL_BACKUP_USER=root
MYSQL_BACKUP_PASSWORD=${MYSQL_ROOT_PASSWORD}

# ===== PostgreSQL (Charting) =====
PG_HOST=charting-db
PG_PORT=5432
PG_USER=charting
PG_PASSWORD=charting
PG_DATABASE=charting

# ===== File Storage =====
GIFTICON_IMAGES_DIR=/app/storage/gifticon-images

# ===== Retention =====
FULL_BACKUP_RETENTION_DAYS=7
BINLOG_RETENTION_DAYS=2

# ===== Local Backup Staging =====
BACKUP_STAGING_DIR=/backup

# ===== Alert =====
ALERT_WEBHOOK_URL=                    # Slack/Discord webhook URL (비워두면 알림 스킵)

# ===== Schedule =====
FULL_BACKUP_CRON="0 2 * * *"          # 매일 새벽 2시
BINLOG_ARCHIVE_CRON="0 * * * *"       # 매 시간
```

- [ ] **Step 2: databases.conf 작성**

이 파일은 백업 대상 MySQL DB 목록을 정의한다. 스크립트가 이 파일을 읽어 순차 백업한다.

```bash
# docker/backup/config/databases.conf
# FORMAT: db_name|master_host|master_port
# Lines starting with # are ignored

product_db|mysql-product-master|3306
order_db|mysql-order-master|3306
auth_db|mysql-auth-master|3306
gifticon_db|mysql-gifticon-master|3306
code_dictionary_db|mysql-code-dictionary-master|3306
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/config/
git commit -m "feat(backup): add backup config templates (env + database list)"
```

---

## Task 2: 스토리지 플러그인 구현

**Files:**
- Create: `docker/backup/scripts/upload.sh`
- Create: `docker/backup/storage-providers/local.sh`
- Create: `docker/backup/storage-providers/s3.sh`
- Create: `docker/backup/storage-providers/gcs.sh`

- [ ] **Step 1: upload.sh 디스패처 작성**

```bash
#!/usr/bin/env bash
# docker/backup/scripts/upload.sh
# Usage: upload.sh <local_path> <remote_path>
#   Uploads a file or directory to the configured storage provider.
# Usage: upload.sh --cleanup <prefix> <retention_days>
#   Removes backups older than retention_days under the given prefix.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

# Load config
if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

STORAGE_PROVIDER="${STORAGE_PROVIDER:-local}"
PROVIDER_SCRIPT="${SCRIPT_DIR}/../storage-providers/${STORAGE_PROVIDER}.sh"

if [[ ! -f "$PROVIDER_SCRIPT" ]]; then
    echo "ERROR: Unknown storage provider: ${STORAGE_PROVIDER}" >&2
    exit 1
fi

source "$PROVIDER_SCRIPT"

if [[ "${1:-}" == "--cleanup" ]]; then
    shift
    cleanup_remote "$@"
else
    upload_file "$@"
fi
```

- [ ] **Step 2: local.sh 플러그인 작성**

```bash
#!/usr/bin/env bash
# docker/backup/storage-providers/local.sh

upload_file() {
    local src="$1"
    local dest="${LOCAL_BACKUP_DIR}/${2}"

    mkdir -p "$(dirname "$dest")"

    if [[ -d "$src" ]]; then
        rsync -a "$src/" "$dest/"
    else
        cp "$src" "$dest"
    fi

    echo "Uploaded to local: $dest"
}

cleanup_remote() {
    local prefix="$1"
    local retention_days="$2"
    local target_dir="${LOCAL_BACKUP_DIR}/${prefix}"

    if [[ -d "$target_dir" ]]; then
        find "$target_dir" -maxdepth 1 -mindepth 1 -mtime +"$retention_days" -exec rm -rf {} +
        echo "Cleaned up local: $target_dir (older than ${retention_days} days)"
    fi
}
```

- [ ] **Step 3: s3.sh 플러그인 작성**

```bash
#!/usr/bin/env bash
# docker/backup/storage-providers/s3.sh

_s3_cmd() {
    local cmd="aws s3"
    if [[ -n "${S3_ENDPOINT:-}" ]]; then
        cmd+=" --endpoint-url ${S3_ENDPOINT}"
    fi
    if [[ -n "${S3_REGION:-}" ]]; then
        cmd+=" --region ${S3_REGION}"
    fi
    echo "$cmd"
}

upload_file() {
    local src="$1"
    local dest="s3://${S3_BUCKET}/${2}"

    if [[ -d "$src" ]]; then
        $(_s3_cmd) sync "$src/" "$dest/"
    else
        $(_s3_cmd) cp "$src" "$dest"
    fi

    echo "Uploaded to S3: $dest"
}

cleanup_remote() {
    local prefix="$1"
    local retention_days="$2"
    local cutoff_date
    cutoff_date=$(date -d "-${retention_days} days" +%Y-%m-%d 2>/dev/null \
                  || date -v-${retention_days}d +%Y-%m-%d)

    # List and delete directories older than cutoff
    $(_s3_cmd) ls "s3://${S3_BUCKET}/${prefix}/" | while read -r line; do
        local dir_date
        dir_date=$(echo "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
        if [[ -n "$dir_date" && "$dir_date" < "$cutoff_date" ]]; then
            $(_s3_cmd) rm --recursive "s3://${S3_BUCKET}/${prefix}/${dir_date}/"
            echo "Deleted S3: s3://${S3_BUCKET}/${prefix}/${dir_date}/"
        fi
    done

    echo "Cleaned up S3: ${prefix} (older than ${retention_days} days)"
}
```

- [ ] **Step 4: gcs.sh 플러그인 작성**

```bash
#!/usr/bin/env bash
# docker/backup/storage-providers/gcs.sh

upload_file() {
    local src="$1"
    local dest="gs://${GCS_BUCKET}/${2}"

    if [[ -d "$src" ]]; then
        gsutil -m rsync -r "$src/" "$dest/"
    else
        gsutil cp "$src" "$dest"
    fi

    echo "Uploaded to GCS: $dest"
}

cleanup_remote() {
    local prefix="$1"
    local retention_days="$2"
    local cutoff_date
    cutoff_date=$(date -d "-${retention_days} days" +%Y-%m-%d 2>/dev/null \
                  || date -v-${retention_days}d +%Y-%m-%d)

    gsutil ls "gs://${GCS_BUCKET}/${prefix}/" | while read -r dir; do
        local dir_date
        dir_date=$(echo "$dir" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
        if [[ -n "$dir_date" && "$dir_date" < "$cutoff_date" ]]; then
            gsutil -m rm -r "$dir"
            echo "Deleted GCS: $dir"
        fi
    done

    echo "Cleaned up GCS: ${prefix} (older than ${retention_days} days)"
}
```

- [ ] **Step 5: 모든 스크립트에 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/upload.sh
chmod +x docker/backup/storage-providers/*.sh
```

- [ ] **Step 6: Commit**

```bash
git add docker/backup/scripts/upload.sh docker/backup/storage-providers/
git commit -m "feat(backup): add storage provider plugins (S3, GCS, local)"
```

---

## Task 3: 알림 스크립트 구현

**Files:**
- Create: `docker/backup/scripts/notify.sh`

- [ ] **Step 1: notify.sh 작성**

```bash
#!/usr/bin/env bash
# docker/backup/scripts/notify.sh
# Usage: notify.sh <status> <message>
#   status: SUCCESS | FAILURE
#   message: 알림 본문

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

STATUS="${1:-UNKNOWN}"
MESSAGE="${2:-No message}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
HOSTNAME=$(hostname)

if [[ -z "${ALERT_WEBHOOK_URL:-}" ]]; then
    echo "[${TIMESTAMP}] [${STATUS}] ${MESSAGE} (no webhook configured, skipping alert)"
    exit 0
fi

ICON="✅"
if [[ "$STATUS" == "FAILURE" ]]; then
    ICON="🚨"
fi

PAYLOAD=$(cat <<EOJSON
{
    "text": "${ICON} *Backup ${STATUS}*\nHost: ${HOSTNAME}\nTime: ${TIMESTAMP}\n${MESSAGE}"
}
EOJSON
)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$ALERT_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
    echo "[${TIMESTAMP}] Alert sent (HTTP ${HTTP_CODE})"
else
    echo "[${TIMESTAMP}] WARNING: Alert failed (HTTP ${HTTP_CODE})" >&2
fi
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/notify.sh
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/scripts/notify.sh
git commit -m "feat(backup): add notification script (webhook)"
```

---

## Task 4: MySQL 백업 스크립트 구현

**Files:**
- Create: `docker/backup/scripts/backup-mysql.sh`

- [ ] **Step 1: backup-mysql.sh 작성**

이 스크립트는 단일 MySQL DB에 대해 XtraBackup 풀백업을 수행한다. `backup-full.sh`가 `databases.conf`를 순회하며 이 스크립트를 호출한다.

```bash
#!/usr/bin/env bash
# docker/backup/scripts/backup-mysql.sh
# Usage: backup-mysql.sh <db_name> <master_host> <master_port>
#
# Performs a full XtraBackup of the specified MySQL database.
# Outputs the backup directory path on success.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

DB_NAME="$1"
MASTER_HOST="$2"
MASTER_PORT="$3"
DATE=$(date +%Y-%m-%d)
STAGING="${BACKUP_STAGING_DIR:-/backup}"
TARGET_DIR="${STAGING}/mysql/${DB_NAME}/${DATE}"

echo "[$(date '+%H:%M:%S')] Starting XtraBackup: ${DB_NAME} from ${MASTER_HOST}:${MASTER_PORT}"

# 1. Backup
mkdir -p "$TARGET_DIR"
xtrabackup --backup \
    --host="$MASTER_HOST" \
    --port="$MASTER_PORT" \
    --user="${MYSQL_BACKUP_USER:-root}" \
    --password="${MYSQL_BACKUP_PASSWORD}" \
    --databases="$DB_NAME" \
    --target-dir="$TARGET_DIR" \
    --no-timestamp \
    2>&1 | tail -5

# 2. Prepare (apply logs for consistency)
xtrabackup --prepare \
    --target-dir="$TARGET_DIR" \
    2>&1 | tail -3

echo "[$(date '+%H:%M:%S')] XtraBackup complete: ${TARGET_DIR}"

# 3. Upload to remote storage
"${SCRIPT_DIR}/upload.sh" "$TARGET_DIR" "mysql/${DB_NAME}/${DATE}"

echo "[$(date '+%H:%M:%S')] Uploaded: mysql/${DB_NAME}/${DATE}"
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/backup-mysql.sh
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/scripts/backup-mysql.sh
git commit -m "feat(backup): add MySQL XtraBackup script"
```

---

## Task 5: Binlog 아카이브 스크립트 구현

**Files:**
- Create: `docker/backup/scripts/binlog-archive.sh`

- [ ] **Step 1: binlog-archive.sh 작성**

매 시간 실행되어 각 MySQL Master의 binlog를 원격 스토리지에 보관한다.

```bash
#!/usr/bin/env bash
# docker/backup/scripts/binlog-archive.sh
# Usage: binlog-archive.sh
#
# Archives binary logs from all MySQL masters to remote storage.
# Reads database list from databases.conf.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

STAGING="${BACKUP_STAGING_DIR:-/backup}"
DATE=$(date +%Y-%m-%d)
HOUR=$(date +%H)
ERRORS=0

while IFS='|' read -r db_name master_host master_port; do
    [[ "$db_name" =~ ^#.*$ || -z "$db_name" ]] && continue

    BINLOG_DIR="${STAGING}/mysql/${db_name}/binlog/${DATE}"
    mkdir -p "$BINLOG_DIR"

    echo "[$(date '+%H:%M:%S')] Archiving binlogs: ${db_name} from ${master_host}"

    # Flush logs to rotate and get a clean boundary
    mysql --host="$master_host" --port="$master_port" \
        --user="${MYSQL_BACKUP_USER:-root}" \
        --password="${MYSQL_BACKUP_PASSWORD}" \
        -e "FLUSH BINARY LOGS;" 2>/dev/null || true

    # Copy binary logs using mysqlbinlog
    # --read-from-remote-server: read from master
    # --raw: save as binary files (not SQL)
    # --result-file: output directory prefix
    # --stop-never would stream continuously; we just do a one-shot copy
    mysqlbinlog \
        --host="$master_host" \
        --port="$master_port" \
        --user="${MYSQL_BACKUP_USER:-root}" \
        --password="${MYSQL_BACKUP_PASSWORD}" \
        --read-from-remote-server \
        --raw \
        --result-file="${BINLOG_DIR}/" \
        --to-last-log \
        mysql-bin.000001 \
        2>&1 | tail -3 || {
            echo "WARNING: binlog archive failed for ${db_name}" >&2
            ERRORS=$((ERRORS + 1))
            continue
        }

    # Upload
    "${SCRIPT_DIR}/upload.sh" "$BINLOG_DIR" "mysql/${db_name}/binlog/${DATE}"
    echo "[$(date '+%H:%M:%S')] Binlog archived: ${db_name}"

done < "${CONFIG_DIR}/databases.conf"

if [[ $ERRORS -gt 0 ]]; then
    "${SCRIPT_DIR}/notify.sh" "FAILURE" "Binlog archive: ${ERRORS} database(s) failed"
    exit 1
fi

echo "[$(date '+%H:%M:%S')] Binlog archive complete for all databases"
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/binlog-archive.sh
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/scripts/binlog-archive.sh
git commit -m "feat(backup): add binlog archive script (hourly)"
```

---

## Task 6: PostgreSQL 백업 스크립트 구현

**Files:**
- Create: `docker/backup/scripts/backup-postgres.sh`

- [ ] **Step 1: backup-postgres.sh 작성**

```bash
#!/usr/bin/env bash
# docker/backup/scripts/backup-postgres.sh
# Usage: backup-postgres.sh
#
# Performs a full pg_basebackup of the charting PostgreSQL database.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

DATE=$(date +%Y-%m-%d)
STAGING="${BACKUP_STAGING_DIR:-/backup}"
TARGET_DIR="${STAGING}/postgres/charting/${DATE}"

echo "[$(date '+%H:%M:%S')] Starting pg_basebackup: charting"

mkdir -p "$TARGET_DIR"

export PGPASSWORD="${PG_PASSWORD}"

# -Ft: tar format, -z: gzip compression, -Xs: stream WAL during backup
pg_basebackup \
    -h "${PG_HOST:-charting-db}" \
    -p "${PG_PORT:-5432}" \
    -U "${PG_USER:-charting}" \
    -D "$TARGET_DIR" \
    -Ft -z -Xs \
    -P \
    2>&1 | tail -5

unset PGPASSWORD

echo "[$(date '+%H:%M:%S')] pg_basebackup complete: ${TARGET_DIR}"

# Upload
"${SCRIPT_DIR}/upload.sh" "$TARGET_DIR" "postgres/charting/${DATE}"

echo "[$(date '+%H:%M:%S')] Uploaded: postgres/charting/${DATE}"
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/backup-postgres.sh
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/scripts/backup-postgres.sh
git commit -m "feat(backup): add PostgreSQL pg_basebackup script"
```

---

## Task 7: 파일 백업 스크립트 구현

**Files:**
- Create: `docker/backup/scripts/backup-files.sh`

- [ ] **Step 1: backup-files.sh 작성**

```bash
#!/usr/bin/env bash
# docker/backup/scripts/backup-files.sh
# Usage: backup-files.sh
#
# Backs up gifticon images using rsync.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

DATE=$(date +%Y-%m-%d)
STAGING="${BACKUP_STAGING_DIR:-/backup}"
SRC="${GIFTICON_IMAGES_DIR:-/app/storage/gifticon-images}"
TARGET_DIR="${STAGING}/files/gifticon/${DATE}"

if [[ ! -d "$SRC" ]]; then
    echo "WARNING: Source directory not found: ${SRC}, skipping file backup"
    exit 0
fi

echo "[$(date '+%H:%M:%S')] Starting file backup: gifticon images"

mkdir -p "$TARGET_DIR"

rsync -az --delete "$SRC/" "$TARGET_DIR/"

echo "[$(date '+%H:%M:%S')] rsync complete: ${TARGET_DIR}"

# Upload
"${SCRIPT_DIR}/upload.sh" "$TARGET_DIR" "files/gifticon/${DATE}"

echo "[$(date '+%H:%M:%S')] Uploaded: files/gifticon/${DATE}"
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/backup-files.sh
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/scripts/backup-files.sh
git commit -m "feat(backup): add gifticon file backup script (rsync)"
```

---

## Task 8: 정리(Cleanup) 스크립트 구현

**Files:**
- Create: `docker/backup/scripts/cleanup.sh`

- [ ] **Step 1: cleanup.sh 작성**

```bash
#!/usr/bin/env bash
# docker/backup/scripts/cleanup.sh
# Usage: cleanup.sh
#
# Removes backups older than retention period from local staging and remote storage.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

STAGING="${BACKUP_STAGING_DIR:-/backup}"
FULL_DAYS="${FULL_BACKUP_RETENTION_DAYS:-7}"
BINLOG_DAYS="${BINLOG_RETENTION_DAYS:-2}"

echo "[$(date '+%H:%M:%S')] Starting cleanup (full: ${FULL_DAYS}d, binlog: ${BINLOG_DAYS}d)"

# --- Local cleanup ---

# MySQL full backups
for db_dir in "${STAGING}"/mysql/*/; do
    [[ -d "$db_dir" ]] || continue
    # Skip binlog subdirectory
    find "$db_dir" -maxdepth 1 -mindepth 1 -type d -not -name "binlog" -mtime +"$FULL_DAYS" -exec rm -rf {} + 2>/dev/null || true
done

# MySQL binlogs
for binlog_dir in "${STAGING}"/mysql/*/binlog/; do
    [[ -d "$binlog_dir" ]] || continue
    find "$binlog_dir" -maxdepth 1 -mindepth 1 -type d -mtime +"$BINLOG_DAYS" -exec rm -rf {} + 2>/dev/null || true
done

# PostgreSQL full backups
if [[ -d "${STAGING}/postgres" ]]; then
    find "${STAGING}/postgres" -maxdepth 2 -mindepth 2 -type d -mtime +"$FULL_DAYS" -exec rm -rf {} + 2>/dev/null || true
fi

# File backups
if [[ -d "${STAGING}/files" ]]; then
    find "${STAGING}/files" -maxdepth 2 -mindepth 2 -type d -mtime +"$FULL_DAYS" -exec rm -rf {} + 2>/dev/null || true
fi

echo "[$(date '+%H:%M:%S')] Local cleanup complete"

# --- Remote cleanup ---

# MySQL full backups per DB
while IFS='|' read -r db_name _ _; do
    [[ "$db_name" =~ ^#.*$ || -z "$db_name" ]] && continue
    "${SCRIPT_DIR}/upload.sh" --cleanup "mysql/${db_name}" "$FULL_DAYS"
    "${SCRIPT_DIR}/upload.sh" --cleanup "mysql/${db_name}/binlog" "$BINLOG_DAYS"
done < "${CONFIG_DIR}/databases.conf"

# PostgreSQL
"${SCRIPT_DIR}/upload.sh" --cleanup "postgres/charting" "$FULL_DAYS"

# Files
"${SCRIPT_DIR}/upload.sh" --cleanup "files/gifticon" "$FULL_DAYS"

echo "[$(date '+%H:%M:%S')] Remote cleanup complete"
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/cleanup.sh
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/scripts/cleanup.sh
git commit -m "feat(backup): add cleanup script (retention enforcement)"
```

---

## Task 9: 풀백업 오케스트레이터 구현

**Files:**
- Create: `docker/backup/scripts/backup-full.sh`

- [ ] **Step 1: backup-full.sh 작성**

이 스크립트가 cron에서 매일 새벽 2시에 호출되는 진입점이다.

```bash
#!/usr/bin/env bash
# docker/backup/scripts/backup-full.sh
# Usage: backup-full.sh
#
# Daily full backup orchestrator.
# Runs MySQL backups (all databases), PostgreSQL backup, file backup, then cleanup.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

START_TIME=$(date '+%Y-%m-%d %H:%M:%S')
ERRORS=0
RESULTS=()

echo "========================================"
echo " Full Backup Started: ${START_TIME}"
echo "========================================"

# --- MySQL backups ---
while IFS='|' read -r db_name master_host master_port; do
    [[ "$db_name" =~ ^#.*$ || -z "$db_name" ]] && continue

    if "${SCRIPT_DIR}/backup-mysql.sh" "$db_name" "$master_host" "$master_port"; then
        RESULTS+=("MySQL/${db_name}: OK")
    else
        RESULTS+=("MySQL/${db_name}: FAILED")
        ERRORS=$((ERRORS + 1))
    fi
done < "${CONFIG_DIR}/databases.conf"

# --- PostgreSQL backup ---
if "${SCRIPT_DIR}/backup-postgres.sh"; then
    RESULTS+=("PostgreSQL/charting: OK")
else
    RESULTS+=("PostgreSQL/charting: FAILED")
    ERRORS=$((ERRORS + 1))
fi

# --- File backup ---
if "${SCRIPT_DIR}/backup-files.sh"; then
    RESULTS+=("Files/gifticon: OK")
else
    RESULTS+=("Files/gifticon: FAILED")
    ERRORS=$((ERRORS + 1))
fi

# --- Cleanup ---
if "${SCRIPT_DIR}/cleanup.sh"; then
    RESULTS+=("Cleanup: OK")
else
    RESULTS+=("Cleanup: FAILED")
    ERRORS=$((ERRORS + 1))
fi

# --- Summary ---
END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
SUMMARY=$(printf '%s\n' "${RESULTS[@]}")

echo "========================================"
echo " Full Backup Finished: ${END_TIME}"
echo " Results:"
printf '  %s\n' "${RESULTS[@]}"
echo "========================================"

if [[ $ERRORS -gt 0 ]]; then
    "${SCRIPT_DIR}/notify.sh" "FAILURE" "Full backup: ${ERRORS} task(s) failed\n${SUMMARY}"
    exit 1
else
    "${SCRIPT_DIR}/notify.sh" "SUCCESS" "Full backup completed successfully\n${SUMMARY}"
fi
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/backup-full.sh
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/scripts/backup-full.sh
git commit -m "feat(backup): add full backup orchestrator"
```

---

## Task 10: MySQL 복구 스크립트 구현

**Files:**
- Create: `docker/backup/scripts/restore-mysql.sh`

- [ ] **Step 1: restore-mysql.sh 작성**

```bash
#!/usr/bin/env bash
# docker/backup/scripts/restore-mysql.sh
# Usage:
#   restore-mysql.sh --db <db_name> --date <YYYY-MM-DD>
#   restore-mysql.sh --db <db_name> --date <YYYY-MM-DD> --pitr "YYYY-MM-DD HH:MM:SS"
#
# Restores a MySQL database from XtraBackup, optionally applying binlog up to a point-in-time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

# --- Parse arguments ---
DB_NAME=""
BACKUP_DATE=""
PITR_TIMESTAMP=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --db) DB_NAME="$2"; shift 2 ;;
        --date) BACKUP_DATE="$2"; shift 2 ;;
        --pitr) PITR_TIMESTAMP="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

if [[ -z "$DB_NAME" || -z "$BACKUP_DATE" ]]; then
    echo "Usage: restore-mysql.sh --db <db_name> --date <YYYY-MM-DD> [--pitr <timestamp>]" >&2
    exit 1
fi

STAGING="${BACKUP_STAGING_DIR:-/backup}"
BACKUP_DIR="${STAGING}/mysql/${DB_NAME}/${BACKUP_DATE}"

# --- Resolve master host from databases.conf ---
MASTER_HOST=""
MASTER_PORT=""
while IFS='|' read -r name host port; do
    [[ "$name" =~ ^#.*$ || -z "$name" ]] && continue
    if [[ "$name" == "$DB_NAME" ]]; then
        MASTER_HOST="$host"
        MASTER_PORT="$port"
        break
    fi
done < "${CONFIG_DIR}/databases.conf"

if [[ -z "$MASTER_HOST" ]]; then
    echo "ERROR: Database ${DB_NAME} not found in databases.conf" >&2
    exit 1
fi

# --- Download backup if not present locally ---
if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "Backup not found locally, downloading from remote storage..."
    # TODO: implement download from remote (reverse of upload)
    echo "ERROR: Local backup not found: ${BACKUP_DIR}" >&2
    echo "Please manually download the backup to ${BACKUP_DIR} first." >&2
    exit 1
fi

echo "========================================"
echo " MySQL Restore: ${DB_NAME}"
echo " Backup Date: ${BACKUP_DATE}"
echo " PITR Target: ${PITR_TIMESTAMP:-N/A (full backup only)}"
echo "========================================"
echo ""
echo "WARNING: This will STOP the MySQL instance and REPLACE its data."
echo "Press Ctrl+C within 10 seconds to abort..."
sleep 10

# --- Step 1: Stop MySQL ---
echo "[$(date '+%H:%M:%S')] Stopping MySQL: ${MASTER_HOST}"
docker stop "${MASTER_HOST}" || true

# --- Step 2: Clear data directory ---
VOLUME_NAME="mysql-${DB_NAME//_/-}-master-data"
DATA_DIR="/var/lib/mysql"

echo "[$(date '+%H:%M:%S')] Clearing data directory"
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    mysql:8.0 \
    bash -c "rm -rf ${DATA_DIR}/*"

# --- Step 3: Copy backup to data directory ---
echo "[$(date '+%H:%M:%S')] Restoring from backup: ${BACKUP_DIR}"
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    -v "${BACKUP_DIR}:/backup:ro" \
    percona/percona-xtrabackup:8.0 \
    xtrabackup --copy-back --target-dir=/backup --datadir="${DATA_DIR}"

# Fix permissions
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    mysql:8.0 \
    chown -R mysql:mysql "${DATA_DIR}"

# --- Step 4: Start MySQL ---
echo "[$(date '+%H:%M:%S')] Starting MySQL: ${MASTER_HOST}"
docker start "${MASTER_HOST}"

# Wait for MySQL to be ready
echo "[$(date '+%H:%M:%S')] Waiting for MySQL to be ready..."
for i in $(seq 1 30); do
    if docker exec "${MASTER_HOST}" mysqladmin ping -u root -p"${MYSQL_BACKUP_PASSWORD}" --silent 2>/dev/null; then
        echo "[$(date '+%H:%M:%S')] MySQL is ready"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "ERROR: MySQL did not start within 30 seconds" >&2
        exit 1
    fi
    sleep 1
done

# --- Step 5: PITR (optional) ---
if [[ -n "$PITR_TIMESTAMP" ]]; then
    BINLOG_DIR="${STAGING}/mysql/${DB_NAME}/binlog/${BACKUP_DATE}"

    if [[ ! -d "$BINLOG_DIR" ]]; then
        echo "WARNING: Binlog directory not found: ${BINLOG_DIR}" >&2
        echo "PITR skipped. Database restored to backup point only." >&2
        exit 0
    fi

    echo "[$(date '+%H:%M:%S')] Applying binlog up to: ${PITR_TIMESTAMP}"

    # Find binlog files and replay up to the target timestamp
    BINLOG_FILES=$(find "$BINLOG_DIR" -name "mysql-bin.*" -not -name "*.index" | sort)

    if [[ -n "$BINLOG_FILES" ]]; then
        mysqlbinlog \
            --database="$DB_NAME" \
            --stop-datetime="$PITR_TIMESTAMP" \
            $BINLOG_FILES \
        | docker exec -i "${MASTER_HOST}" \
            mysql -u root -p"${MYSQL_BACKUP_PASSWORD}"

        echo "[$(date '+%H:%M:%S')] PITR complete: restored to ${PITR_TIMESTAMP}"
    else
        echo "WARNING: No binlog files found in ${BINLOG_DIR}" >&2
    fi
fi

echo "========================================"
echo " Restore complete: ${DB_NAME}"
echo "========================================"
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/restore-mysql.sh
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/scripts/restore-mysql.sh
git commit -m "feat(backup): add MySQL restore script (full + PITR)"
```

---

## Task 11: PostgreSQL 복구 스크립트 구현

**Files:**
- Create: `docker/backup/scripts/restore-postgres.sh`

- [ ] **Step 1: restore-postgres.sh 작성**

```bash
#!/usr/bin/env bash
# docker/backup/scripts/restore-postgres.sh
# Usage: restore-postgres.sh --db <db_name> --date <YYYY-MM-DD>
#
# Restores a PostgreSQL database from pg_basebackup.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

# --- Parse arguments ---
DB_NAME=""
BACKUP_DATE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --db) DB_NAME="$2"; shift 2 ;;
        --date) BACKUP_DATE="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

if [[ -z "$DB_NAME" || -z "$BACKUP_DATE" ]]; then
    echo "Usage: restore-postgres.sh --db <db_name> --date <YYYY-MM-DD>" >&2
    exit 1
fi

STAGING="${BACKUP_STAGING_DIR:-/backup}"
BACKUP_DIR="${STAGING}/postgres/${DB_NAME}/${BACKUP_DATE}"

if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "ERROR: Backup not found: ${BACKUP_DIR}" >&2
    exit 1
fi

CONTAINER="charting-db"
VOLUME_NAME="charting-db-data"
DATA_DIR="/var/lib/postgresql/data"

echo "========================================"
echo " PostgreSQL Restore: ${DB_NAME}"
echo " Backup Date: ${BACKUP_DATE}"
echo "========================================"
echo ""
echo "WARNING: This will STOP PostgreSQL and REPLACE its data."
echo "Press Ctrl+C within 10 seconds to abort..."
sleep 10

# --- Step 1: Stop PostgreSQL ---
echo "[$(date '+%H:%M:%S')] Stopping PostgreSQL: ${CONTAINER}"
docker stop "${CONTAINER}" || true

# --- Step 2: Clear data directory ---
echo "[$(date '+%H:%M:%S')] Clearing data directory"
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    postgres:16 \
    bash -c "rm -rf ${DATA_DIR}/*"

# --- Step 3: Extract backup ---
echo "[$(date '+%H:%M:%S')] Extracting backup: ${BACKUP_DIR}"
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    -v "${BACKUP_DIR}:/backup:ro" \
    postgres:16 \
    bash -c "cd ${DATA_DIR} && tar xzf /backup/base.tar.gz && chown -R postgres:postgres ${DATA_DIR}"

# --- Step 4: Start PostgreSQL ---
echo "[$(date '+%H:%M:%S')] Starting PostgreSQL: ${CONTAINER}"
docker start "${CONTAINER}"

# Wait for ready
for i in $(seq 1 30); do
    if docker exec "${CONTAINER}" pg_isready -U "${PG_USER:-charting}" -d "${DB_NAME}" 2>/dev/null; then
        echo "[$(date '+%H:%M:%S')] PostgreSQL is ready"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "ERROR: PostgreSQL did not start within 30 seconds" >&2
        exit 1
    fi
    sleep 1
done

echo "========================================"
echo " Restore complete: ${DB_NAME}"
echo "========================================"
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x docker/backup/scripts/restore-postgres.sh
```

- [ ] **Step 3: Commit**

```bash
git add docker/backup/scripts/restore-postgres.sh
git commit -m "feat(backup): add PostgreSQL restore script"
```

---

## Task 12: Crontab 정의

**Files:**
- Create: `docker/backup/crontab`

- [ ] **Step 1: crontab 작성**

```bash
# docker/backup/crontab
# Install: crontab docker/backup/crontab
# Or append: crontab -l | cat - docker/backup/crontab | crontab -

# Daily full backup at 02:00 AM
0 2 * * * /path/to/docker/backup/scripts/backup-full.sh >> /var/log/backup-full.log 2>&1

# Hourly binlog archive
0 * * * * /path/to/docker/backup/scripts/binlog-archive.sh >> /var/log/binlog-archive.log 2>&1
```

- [ ] **Step 2: Commit**

```bash
git add docker/backup/crontab
git commit -m "feat(backup): add crontab schedule definition"
```

---

## Task 13: Auto-Failover 비활성 설계 (Orchestrator + ProxySQL)

**Files:**
- Create: `docker/backup/ha/docker-compose.ha.yml`
- Create: `docker/backup/ha/orchestrator/orchestrator.conf.json`
- Create: `docker/backup/ha/proxysql/proxysql.cnf`

- [ ] **Step 1: docker-compose.ha.yml 작성**

```yaml
# docker/backup/ha/docker-compose.ha.yml
#
# Auto-failover layer (Orchestrator + ProxySQL).
# Inactive by default. Activate with:
#   docker compose -f docker-compose.ha.yml --profile ha up -d

services:
  orchestrator:
    image: openarkcode/orchestrator:latest
    container_name: orchestrator
    profiles: [ha]
    ports:
      - "3000:3000"
    volumes:
      - ./orchestrator/orchestrator.conf.json:/etc/orchestrator.conf.json
    networks:
      commerce-network:
        ipv4_address: 172.20.5.1
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  proxysql:
    image: proxysql/proxysql:latest
    container_name: proxysql
    profiles: [ha]
    ports:
      - "6033:6033"
      - "6032:6032"
    volumes:
      - ./proxysql/proxysql.cnf:/etc/proxysql.cnf
      - proxysql-data:/var/lib/proxysql
    networks:
      commerce-network:
        ipv4_address: 172.20.5.2
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-P", "6032", "-u", "admin", "-padmin"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  proxysql-data:

networks:
  commerce-network:
    external: true
```

- [ ] **Step 2: orchestrator.conf.json 작성**

```json
{
  "Debug": false,
  "ListenAddress": ":3000",
  "MySQLTopologyUser": "root",
  "MySQLTopologyPassword": "commerce_root_pw_2024",
  "MySQLReplicaUser": "replicator",
  "MySQLReplicaPassword": "replication_pw_2024",
  "BackendDB": "sqlite",
  "SQLite3DataFile": "/var/lib/orchestrator/orchestrator.db",
  "DiscoverByShowSlaveHosts": true,
  "InstancePollSeconds": 3,
  "UnseenInstanceForgetHours": 1,
  "RecoveryPeriodBlockSeconds": 600,
  "RecoverMasterClusterFilters": ["*"],
  "RecoverIntermediateMasterClusterFilters": ["*"],
  "AutoPseudoGTID": false,
  "DetectClusterAliasQuery": "SELECT @@hostname",
  "DetachLostReplicasAfterMasterFailover": true,
  "ApplyMySQLPromotionAfterMasterFailover": true,
  "PostFailoverProcesses": [
    "/usr/local/bin/orchestrator-failover-hook.sh {failureType} {failedHost} {successorHost}"
  ]
}
```

- [ ] **Step 3: proxysql.cnf 작성**

```cnf
# docker/backup/ha/proxysql/proxysql.cnf

datadir="/var/lib/proxysql"

admin_variables=
{
    admin_credentials="admin:admin"
    mysql_ifaces="0.0.0.0:6032"
}

mysql_variables=
{
    threads=4
    max_connections=2048
    default_query_delay=0
    default_query_timeout=36000000
    have_compress=true
    poll_timeout=2000
    interfaces="0.0.0.0:6033"
    default_schema="information_schema"
    stacksize=1048576
    server_version="8.0.35"
    connect_timeout_server=3000
    monitor_username="root"
    monitor_password="commerce_root_pw_2024"
    monitor_history=600000
    monitor_connect_interval=60000
    monitor_ping_interval=10000
    monitor_read_only_interval=1500
    monitor_read_only_timeout=500
    ping_interval_server_msec=120000
    ping_timeout_server=500
    commands_stats=true
    sessions_sort=true
    connect_retries_on_failure=10
}

# Hostgroup 10 = writer (master), Hostgroup 20 = reader (replica)
mysql_servers =
(
    # Product
    { address="mysql-product-master", port=3306, hostgroup=10, weight=1 },
    { address="mysql-product-replica", port=3306, hostgroup=20, weight=1 },
    # Order
    { address="mysql-order-master", port=3306, hostgroup=11, weight=1 },
    { address="mysql-order-replica", port=3306, hostgroup=21, weight=1 },
    # Auth
    { address="mysql-auth-master", port=3306, hostgroup=12, weight=1 },
    { address="mysql-auth-replica", port=3306, hostgroup=22, weight=1 },
    # Gifticon
    { address="mysql-gifticon-master", port=3306, hostgroup=13, weight=1 },
    { address="mysql-gifticon-replica", port=3306, hostgroup=23, weight=1 },
    # Code Dictionary
    { address="mysql-code-dictionary-master", port=3306, hostgroup=14, weight=1 },
    { address="mysql-code-dictionary-replica", port=3306, hostgroup=24, weight=1 }
)

mysql_users =
(
    { username="commerce", password="commerce_pw_2024", default_hostgroup=10 }
)

mysql_query_rules =
(
    { rule_id=1, active=1, match_pattern="^SELECT .* FOR UPDATE$", destination_hostgroup=10, apply=1 },
    { rule_id=2, active=1, match_pattern="^SELECT", destination_hostgroup=20, apply=1 }
)
```

- [ ] **Step 4: Commit**

```bash
git add docker/backup/ha/
git commit -m "feat(backup): add auto-failover layer (Orchestrator + ProxySQL, inactive)"
```

---

## Task 14: README 운영 가이드 작성

**Files:**
- Create: `docker/backup/README.md`

- [ ] **Step 1: README.md 작성**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docker/backup/README.md
git commit -m "docs(backup): add operations guide README"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** 모든 스펙 요구사항(MySQL XtraBackup, Binlog PITR, PostgreSQL pg_basebackup, File rsync, 스토리지 플러그인, 보관 정책, 알림, 페일오버 비활성 설계, 대안 문서화) 이 Task 1~14에 매핑됨
- [x] **Placeholder scan:** 복구 스크립트의 원격 다운로드 부분에 `TODO` 1건 — 의도적으로 수동 다운로드 가이드로 대체 (자동 다운로드는 별도 스코프)
- [x] **Type consistency:** 환경변수명(`STORAGE_PROVIDER`, `MYSQL_BACKUP_PASSWORD`, `BACKUP_STAGING_DIR` 등)이 backup.env.example과 모든 스크립트에서 동일하게 사용됨
- [x] **databases.conf 포맷:** `db_name|master_host|master_port` 파이프 구분자가 모든 스크립트에서 동일한 `IFS='|' read` 패턴으로 파싱됨
