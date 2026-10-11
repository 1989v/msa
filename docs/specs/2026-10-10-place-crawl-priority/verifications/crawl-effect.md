# 크롤 효과 판정 (SR-8) — 기준선

2026-10-11 12:35 KST 기록. 배포(portal-fe · search `4b9a5bf`)는 2026-10-11 12:17 KST 전후다.

## ① 배포 전 기준선 — Googlebot × `detail` × 일 합계 7일: **미확인**

- 선행 I0-6(봇 일 집계, `place/ingest` `crawl-stats` CronJob 매시 5분)은 배포됐지만 ClickHouse 쓰기가 403(Code 516)으로 실패하다
  a6b35ea83(analytics 계정으로 쓰기)에서 고쳐졌다. 조회 시점에 표가 비어 있다:
  ```
  $ ssh msa-oci … clickhouse-client -q "SELECT toDate(hour,'Asia/Seoul') d, path_type, sum(requests) FROM analytics.crawler_requests_hourly
      WHERE bot='googlebot' AND host='place.1989v.com' GROUP BY d, path_type"
  (0행)
  $ … "SELECT min(hour), max(hour), count() FROM analytics.crawler_log_coverage_hourly"
  1970-01-01 00:00:00	1970-01-01 00:00:00	0
  ```
- 집계기는 현재 컨테이너 로그만 읽어 이미 교체된 파드의 시간은 채워지지 않는다(`cronjob-crawl-stats.yaml` 주석). portal-fe 파드가 배포로 바뀌었으므로
  배포 전 7일은 이제 만들 수 없다. 스펙 작성 때의 참고값은 「하루 약 17건」(spec 머리말, 접근 로그 표본)이고 7일 집계가 아니다.

## ② 배포 전후 48시간 접근 로그 대조 (core 교집합 비율): **배포 전 쪽 미확인**

- 배포 전 portal-fe 파드 로그가 파드 교체로 사라져 「배포 전」 쪽을 잴 수 없다. 배포 뒤 쪽만 남는다.
- 배포 뒤 48시간(2026-10-13 12:17 KST 까지)의 Googlebot `/attractions/{id}`·`/en/attractions/{id}` 요청 id 와 `sitemap-places-core.xml` `<loc>` 교집합 비율을 잰다.
  무작위 기준치는 약 30%(core 상세 18,997 / 정적 상세 62,984 = 30.2%). 파드가 그 사이 다시 교체되면 로그가 끊기므로 중간에 한 번 받아 둔다.
- sitemap 파일별 수신 횟수(`/sitemap-places-core.xml` · `-1` · `-2` · `-3` · `-events`)를 같은 로그에서 센다.

## ③ 4주 뒤 판정 — 사용자 몫

- 판정일: 2026-11-08 전후(배포 + 4주).
- 재료: I0-6 일 집계(Googlebot × `detail` 일 합계 — 배포 뒤 쌓인 값)와 ②의 교집합 비율, GSC 「페이지」 보고서의 sitemap 별 색인 수(core 를 따로 고를 수 있으면 core).
- 스펙 SR-8.3 규칙: 「①이 기준선 이상이고 ②가 기준치보다 높으면 효과 있음, 아니면 Q1 을 다시 연다」.
- 기준선 ①이 미확인이라 앞 조건은 비교 대상이 없다. 판정 때 쓸 수 있는 대체는 「하루 약 17건」(스펙 참고값)과의 비교이고, 표본 출처가 달라 엄밀하지 않다 — 받아들일지는 사용자가 정한다.
