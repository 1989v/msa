# MySQL 논리 백업

`db-backup-mysql` CronJob 이 매일 03:00 UTC(12:00 KST)에 전 스키마를 덤프해
`db-backup` PVC 에 gzip 으로 남긴다. 보관 7일.

## 무엇을 막고 무엇을 못 막나

| 손실 유형 | 막는가 |
|---|---|
| `DROP TABLE`·잘못된 마이그레이션·앱 버그로 인한 논리 손실 | **막는다** |
| MySQL 파드/PVC 손상 | 막는다 |
| **노드 또는 디스크 손실** | **막는다 (2026-09-13~)** — OCI Object Storage 사본 |
| 리전 손실 | 못 막는다 — `ap-chuncheon-1` 은 단일 AD 다 |

`local-path` 가 유일한 StorageClass 라 백업 PVC 가 데이터 PVC 와 **같은 물리 디스크**(`/dev/sda1`)에
놓인다. 그래서 덤프가 끝난 뒤 OCI Object Storage 로 한 부 더 올린다 — 아래 「오프노드 사본」.

## 오프노드 사본

버킷 `msa-db-backup`(`ap-chuncheon-1`, 루트 구획)에 **PAR(미리 인증된 요청)** 로 올린다.
URL 자체가 자격증명이라 레포에 두지 않고 Secret `db-backup-par` 의 `url` 키에만 있다.

```bash
kubectl -n commerce create secret generic db-backup-par --from-file=url=<URL 이 담긴 파일>
```

`--from-literal` 이 아니라 `--from-file` 을 쓰는 이유는 URL 이 프로세스 목록과 셸 히스토리에
남지 않게 하려는 것이다.

### 왜 쓰기 전용인가

PAR 액세스 유형은 **객체 쓰기 허용**뿐이다. 이 URL 은 Secret 을 거쳐 컨테이너 환경으로
들어가므로 완벽히 보호되는 자리가 아니다 — 읽기까지 주면 URL 이 새는 순간 운영 DB 전체가
내려받아진다(`mysql.user` 25계정 해시 · 이력서 공유 토큰 · 앞으로 채워질 기프티콘 바코드와
거래소 API 키). 쓰기만 주면 최악이 「내 버킷에 쓰레기가 올라감」이고 PAR 재발급으로 끝난다.

**대가**: 올린 것을 되읽어 대조할 수 없다. 그래서 `Content-MD5` 를 실어
**오라클 서버가 받은 바이트를 대조**하게 한다. 틀리면 `400 UnmatchedContentMD5` 로 거부한다.
실측으로 확인했다 — 올바른 MD5 `200` / 틀린 MD5 `400` / `GET` `404`.

객체가 실제로 버킷에 있는지는 클러스터에서 볼 수 없다. **콘솔의 객체 목록·지표**로 본다.

> **PAR 만료: 2027-09-13.** 만료되면 업로드가 404 로 죽는다. Job 이 실패하도록 해 뒀으니
> 조용히 지나가지는 않지만, 그때는 콘솔에서 PAR 을 새로 만들어 Secret 을 교체해야 한다.
> 만료된 채 두면 **로컬 사본만 쌓이면서 오프노드가 있다고 믿게 된다.**

### 버킷 쪽 보관

PAR 쓰기 권한에는 삭제가 없다. 오래된 객체는 버킷의 **수명 주기 정책 규칙**이 지운다
(`delete-after-14-days`, 삭제, 14일). 안 걸면 무료 20 GB 를 향해 계속 쌓인다 —
하루 약 190 MB 이므로 100일 남짓이면 한도다.

### 복구 시

버킷에서 내려받는 것은 콘솔이나 정식 인증으로 한다(쓰기 전용 PAR 로는 못 읽는다).
내려받은 뒤 절차는 아래 「복구」와 같다 — **`--default-character-set=utf8mb4` 주의사항 포함**.

## 상태 확인

```bash
kubectl -n commerce get cronjob db-backup-mysql
kubectl -n commerce logs -l app.kubernetes.io/name=db-backup --tail=20
```

마지막 두 줄이 `backup ok <파일명> <바이트>` + `upload ok <파일명> md5=<값>` 이면
로컬 덤프와 오프노드 사본이 둘 다 끝났다는 뜻이다. `upload ok` 가 없으면 Job 이 실패한다.
Job 이 성공했는데 파일이 잘려 있는 경우를 막으려고, gzip 무결성과 mysqldump 완료 표식
(`-- Dump completed`)을 둘 다 확인한 뒤에만 성공으로 끝난다.

## 즉시 1회 실행

```bash
kubectl -n commerce create job --from=cronjob/db-backup-mysql db-backup-manual
```

## 복구

전체 복구는 되돌릴 수 없다. **먼저 지금 상태를 한 번 더 덤프**하고 시작한다.

> **`--default-character-set=utf8mb4` 를 반드시 붙인다.** 빼면 한글이 깨진 채로 들어가는데
> 행 수는 그대로라 정상으로 보인다. 복구 검증에서 실제로 겪었다 —
> `진행 중인 여행 혜택 모음` 이 `ì§„í–‰ ì¤‘ì¸ ...` 으로 들어갔고 행 수 대조는 9/9 로 통과했다.
> 덤프 일부만 잘라 쓸 때는 `SET NAMES utf8mb4` 가 있는 **헤더를 같이** 넣어야 한다.

```bash
# 1. 백업 목록
kubectl -n commerce run bk --rm -it --restart=Never --image=busybox:1.36 \
  --overrides='{"spec":{"containers":[{"name":"bk","image":"busybox:1.36","command":["ls","-la","/backup"],
  "volumeMounts":[{"name":"b","mountPath":"/backup"}]}],
  "volumes":[{"name":"b","persistentVolumeClaim":{"claimName":"db-backup"}}]}}'

# 2. 한 스키마만 복구 — 전체 복구보다 이쪽이 대부분의 상황에 맞는다
gzip -dc mysql-latest.sql.gz \
  | kubectl -n commerce exec -i mysql-0 -- sh -c \
      'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql --user=root --default-character-set=utf8mb4 \
         --one-database <스키마명>'
```

덤프에는 `mysql` 스키마(계정·권한)도 들어 있다. 계정까지 되돌릴 의도가 아니라면
`--one-database` 로 대상 스키마를 한정한다.

## 복구가 실제로 되는지 확인하는 법

"파일이 있다"와 "복구된다"는 다르다. **행 수만 대조하면 안 된다** — 인코딩이 깨져도 행 수는 맞는다.
새 스키마로 한 도메인만 복원해 `CHECKSUM TABLE` 을 원본과 대조한다.

```bash
# restore_probe 로 복원한 뒤
mysql -N -e 'CHECKSUM TABLE deal_db.deal_offer'
mysql -N -e 'CHECKSUM TABLE restore_probe.deal_offer'   # 두 값이 같아야 한다
```

## 대상 밖

- **quant-postgres** — 앱 테이블 0개. 대상에 넣지 않는다.
- **ClickHouse** — 앱 DB 없이 `system` 로그뿐. 원본이 아니라 파생이라 대상이 아니다.
