#!/bin/bash
# kine 이 안 하는 컴팩션을 대신 한다 — **작은 배치로만**.
#
# 왜 필요한가: 이 노드의 kine 은 compact_rev_key 가 113일 동안 0 이었다. 컴팩션이 한 번도
# 진척되지 않아 리스 갱신만으로 하루 4만 행씩 쌓여 state.db 가 26GB 가 됐고, apiserver 의
# 모든 질의가 그 표를 지나 ReplicaSet 동기화 하나가 4.5초를 먹었다.
#
# 왜 작은 배치인가: 한 번에 10만 행을 지우면 인덱스 5개를 10만 번 갱신하느라 트랜잭션이
# 3분을 넘기고 디스크를 포화시켜 apiserver 가 굶는다(2026-09-07 실제로 사이트가 6분 죽었다).
# 2,000 행은 1초 안에 커밋된다.
#
# 처리량: 한 번에 최대 40,000 행 · 10분마다 = 하루 576만 행. 클러스터가 만드는 양(하루 4만)의
# 100배 이상이라 밀릴 수 없다. 이것이 "물리적으로 막는다"의 뜻이다.
set -uo pipefail
DB=/var/lib/rancher/k3s/server/db/state.db
CHUNK=2000
MAX_CHUNKS=20
WARN_ROWS=200000

exec 9>/var/lock/kine-guard.lock
flock -n 9 || { echo "이전 실행이 아직 돈다 — 건너뜀"; exit 0; }
[ -f "$DB" ] || { echo "state.db 없음"; exit 0; }

before=$(sqlite3 "$DB" "SELECT count(*) FROM kine;" 2>/dev/null) || exit 0
deleted=0
for _ in $(seq 1 $MAX_CHUNKS); do
  n=$(sqlite3 "$DB" "
    DELETE FROM kine WHERE id IN (
      SELECT k.id FROM kine k
       WHERE k.id <= (SELECT max(id) - 1000 FROM kine)
         AND (k.deleted != 0
              OR EXISTS (SELECT 1 FROM kine n WHERE n.name = k.name AND n.id > k.id))
       LIMIT $CHUNK);
    SELECT changes();" 2>/dev/null) || break
  deleted=$((deleted + n))
  [ "$n" -lt "$CHUNK" ] && break
done
after=$(sqlite3 "$DB" "SELECT count(*) FROM kine;" 2>/dev/null)
size=$(stat -c %s "$DB")

echo "kine-guard: $deleted 행 삭제 · $before → $after 행 · $((size/1048576))MB"
if [ "${after:-0}" -gt "$WARN_ROWS" ]; then
  echo "kine-guard: 경고 — 행이 $after 로 임계 $WARN_ROWS 를 넘었다. 한 번에 지울 양을 늘리거나 원인을 본다"
fi
