#!/usr/bin/env bash
# schema-enum-check — 운영 MySQL 에 남은 ENUM 컬럼을 전부 나열한다 (읽기 전용).
#
# 운영 스키마 일부는 Flyway 이전에 Hibernate(ddl-auto) 가 만들어 @Enumerated(STRING) 컬럼이
# MySQL ENUM 으로 남아 있다. Flyway 기준선은 VARCHAR 라 새 스키마 테스트는 통과하는데,
# 상태 값을 하나 늘리면 운영에서만 INSERT 가 "Data truncated for column" 으로 잘린다.
# 각 도메인의 `*_enum_to_varchar` / `*_status_varchar` 마이그레이션이 배포된 뒤 이 스크립트가
# 0행을 내야 정상이다. 행이 남아 있으면 그 컬럼의 소유 모듈에 같은 마이그레이션을 추가한다.
#
# Usage:
#   scripts/ops/schema-enum-check.sh                 # oci-mysql 로 운영 조회
#   RUNNER=my-mysql scripts/ops/schema-enum-check.sh # 다른 실행기(인자: <db> <sql>)
#
# 종료 코드: 0 = ENUM 없음, 1 = ENUM 컬럼이 남아 있음, 2 = 조회 실패
set -euo pipefail

RUNNER="${RUNNER:-oci-mysql}"
command -v "$RUNNER" >/dev/null 2>&1 || { echo "실행기 '$RUNNER' 를 찾을 수 없다" >&2; exit 2; }

SQL="SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE DATA_TYPE = 'enum'
  AND TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys')
ORDER BY TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME"

out=$("$RUNNER" information_schema "$SQL") || { echo "조회 실패" >&2; exit 2; }
printf '%s\n' "$out"

# mysql --table 출력: '|' 로 시작하는 줄 = 머리글 1 + 데이터 행. 0행이면 아무것도 안 찍힌다.
lines=$(printf '%s\n' "$out" | grep -c '^|' || true)
rows=$(( lines > 0 ? lines - 1 : 0 ))
if [ "$rows" -gt 0 ]; then
    echo "ENUM 컬럼 ${rows}개가 남아 있다 — 소유 모듈에 VARCHAR 전환 마이그레이션이 필요하다" >&2
    exit 1
fi
echo "ENUM 컬럼 없음"
