# MySQL 논리 백업

`db-backup-mysql` CronJob 이 매일 03:00 UTC(12:00 KST)에 전 스키마를 덤프해
`db-backup` PVC 에 gzip 으로 남긴다. 보관 7일.

## 무엇을 막고 무엇을 못 막나

| 손실 유형 | 막는가 |
|---|---|
| `DROP TABLE`·잘못된 마이그레이션·앱 버그로 인한 논리 손실 | **막는다** |
| MySQL 파드/PVC 손상 | 막는다 |
| **노드 또는 디스크 손실** | **못 막는다** |

`local-path` 가 유일한 StorageClass 라 백업 PVC 가 데이터 PVC 와 **같은 물리 디스크**에 놓인다.
노드 손실까지 덮으려면 오프노드 사본(OCI Object Storage 등)이 따로 필요하다.

## 상태 확인

```bash
kubectl -n commerce get cronjob db-backup-mysql
kubectl -n commerce logs -l app.kubernetes.io/name=db-backup --tail=20
```

마지막 줄이 `backup ok <파일명> <바이트>` 면 덤프가 끝까지 돌았다는 뜻이다.
Job 이 성공했는데 파일이 잘려 있는 경우를 막으려고, gzip 무결성과 mysqldump 완료 표식
(`-- Dump completed`)을 둘 다 확인한 뒤에만 성공으로 끝난다.

## 즉시 1회 실행

```bash
kubectl -n commerce create job --from=cronjob/db-backup-mysql db-backup-manual
```

## 복구

전체 복구는 되돌릴 수 없다. **먼저 지금 상태를 한 번 더 덤프**하고 시작한다.

```bash
# 1. 백업 목록
kubectl -n commerce run bk --rm -it --restart=Never --image=busybox:1.36 \
  --overrides='{"spec":{"containers":[{"name":"bk","image":"busybox:1.36","command":["ls","-la","/backup"],
  "volumeMounts":[{"name":"b","mountPath":"/backup"}]}],
  "volumes":[{"name":"b","persistentVolumeClaim":{"claimName":"db-backup"}}]}}'

# 2. 한 스키마만 복구 — 전체 복구보다 이쪽이 대부분의 상황에 맞는다
kubectl -n commerce exec -i mysql-0 -- sh -c \
  'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql --user=root --one-database <스키마명>' < dump.sql
```

덤프에는 `mysql` 스키마(계정·권한)도 들어 있다. 계정까지 되돌릴 의도가 아니라면
`--one-database` 로 대상 스키마를 한정한다.

## 대상 밖

- **quant-postgres** — 앱 테이블 0개. 대상에 넣지 않는다.
- **ClickHouse** — 앱 DB 없이 `system` 로그뿐. 원본이 아니라 파생이라 대상이 아니다.
