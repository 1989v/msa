# ADR-0094 — ClickHouse 스키마 관리

- Status: Proposed
- Date: 2026-09-12
- Relates: ADR-0017(analytics 스코어링), ADR-0033(quant 통합 플랫폼), ADR-0044~0049(추천),
  ADR-0093(토폴로지 재편) / 선행 사례: `verifyFlywayWiring`(MySQL 쪽 같은 문제)

## Context

ClickHouse 를 쓰는 모듈이 셋이고, 셋 다 `.sql` 파일을 레포에 갖고 있는데
**운영 ClickHouse 에는 앱 데이터베이스가 하나도 없다.**

| 모듈 | `.sql` 위치 | 파일 | 적용기 | 운영 호출 |
|---|---|---|---|---|
| quant | `quant/feature/…/resources/clickhouse/quant/` · `…/quant_audit/` | 14 | `SchemaBootstrapper` | **0** |
| analytics | `analytics/app/…/resources/clickhouse/analytics/` | 4 | 없음 | — |
| engagement(recommendation) | `engagement/app/…/resources/db/migration-clickhouse/` | 4 | 없음 | — |

`SchemaBootstrapper` 는 `src/main` 의 운영 코드다. **그것을 부르는 곳이 테스트 하나뿐이다** —
`ClickHouseSchemaSmokeSpec` 이 Testcontainers 로 일회용 ClickHouse 를 띄워 DDL 을 붓고
테이블이 생기는 것을 확인한다. CI 러너(`ubuntu-24.04-arm`)에 도커가 있으므로 이 스펙은 **통과한다.**
기제가 검증된 것처럼 읽히지만 운영은 그 경로를 지나지 않는다.

목록도 멈춰 있다. `ddlResourcePaths()` 는 `V001~V004` 까지고 `V005~V012` 여덟 개가 빠져 있다.
그중 하나가 `V011__fundamentals.sql` 이다.

```
SchemaBootstrapper.ddlResourcePaths()   ← 손으로 유지하는 목록
  V001 V002 V003 V004                   ← 여기서 멈춤
  (V005 … V012)                          ← 파일은 있는데 목록에 없음
```

**검사가 스키마가 아니라 이 목록을 재고 있었다.** 파일을 더 놓아도 아무 일이 일어나지 않는다.

### 지금 무엇이 깨져 있나

| CronJob | 실패 | 원인 |
|---|---|---|
| `search-eval-daily` | 4회 연속 · 성공 이력 없음 | `analytics.search_judgments` 없음 (`Code: 60`) |
| `quant-ingest-fundamentals` | 2회 연속 · 성공 이력 없음 | `Database quant does not exist` + `KRX_ID`/`KRX_PW` 미설정 |

MySQL 쪽에서 같은 모양을 이미 겪었다 — 마이그레이션 파일은 있는데 운영에 안 붙어
스키마가 Hibernate 산물이 됐고, `verifyFlywayWiring` 게이트로 막았다.
**ClickHouse 는 그 게이트의 사각이다.**

### 접속 방식은 이미 통일돼 있다

`analytics.ClickHouseConfig` 와 `quant.ClickHouseConfig` 둘 다 ClickHouse JDBC 위의
평범한 Hikari `DataSource` 를 만든다. 즉 **`DataSource` 하나를 받는 적용기면 세 모듈에 다 붙는다.**

## Decision (제안)

**`common` 에 ClickHouse 마이그레이션 적용기를 두고, 세 모듈이 기동 시 자기 데이터베이스에 대해 호출한다.**

설계에서 물러서지 않을 지점 셋:

1. **파일 목록을 손으로 유지하지 않는다.** 클래스패스에서 `clickhouse/{db}/V*__*.sql` 을
   찾아 버전 순으로 적용한다. 지금 깨진 원인이 바로 손 목록이므로, 같은 모양을 남기면
   고친 것이 아니다. 목록이 없으면 드리프트할 것도 없다 —
   **「잡히게 만드는 것보다 쓸 수 없게 만드는 것이 낫다.」**
2. **버전 원장을 ClickHouse 안에 둔다.** `{db}.schema_history`(버전·체크섬·적용시각).
   `CREATE TABLE IF NOT EXISTS` 는 멱등이지만 `ALTER` 는 아니고,
   체크섬이 없으면 적용된 파일을 되고쳐도 아무도 모른다.
3. **적용 결과를 값으로 확인한다.** 적용 후 기대 테이블이 실재하는지 질의해 확인하고,
   그 확인을 `/actuator/ingest` 와 같은 자리에서 밖으로 내보낸다.
   「적용기를 불렀다」와 「테이블이 있다」는 다른 사실이다.

### 대안과 기각 사유

| 안 | 기각 사유 |
|---|---|
| **Flyway ClickHouse 플러그인** | Flyway 의 ClickHouse 지원은 커뮤니티 기여분이라 Boot 4 / Flyway 11 조합의 수명을 보장하기 어렵다. MySQL 쪽과 도구가 같아지는 이점은 크지만, 세 모듈 21개 파일 규모에 서드파티 의존을 새로 들이는 값은 아니다 |
| **k8s Job / initContainer 에서 `clickhouse-client`** | 이미지가 하나 늘고 순서·체크섬 로직이 앱 밖에 또 생긴다. 레포는 배치에도 새 이미지를 만들지 않는 쪽을 이미 택했다(`deal-linkcheck` 은 호스트 앱을 웹서버 없이 띄운다) |
| **모듈마다 각자 적용기** | 지금 상태가 그것이다. 셋 중 하나만 있고 그것도 안 불린다 |
| **아무것도 안 하고 손으로 `CREATE TABLE`** | 아래 "하지 않은 것" 참조 |

### 하지 않은 것 — 수동 DDL

`analytics.search_judgments` 를 손으로 만들면 `search-eval-daily` 는 **그날부터 통과한다.**
판정 세트는 여전히 비어 있고, 0건을 평가한 지표가 화면에 걸린다.
지금은 「실패」라서 보이는 문제가 「초록불」이 되어 사라진다 —
이 ADR 이 없애려는 침묵을 하나 더 만드는 셈이다.

**판정 세트를 채우는 것은 별개의 데이터 과제다.** 스키마가 생겨도 그것은 해결되지 않는다.

## Consequences

**좋아지는 것**

- 배치 두 건의 뿌리가 사라진다(`quant` 는 `KRX_ID`/`KRX_PW` 가 남는다)
- `V005~V012` 여덟 개가 처음으로 운영에 닿는다
- 테스트가 검증하는 대상과 운영이 지나는 경로가 같아진다 — 스모크 스펙이 비로소 의미를 갖는다

**감수하는 것**

- 기동 시 DDL 을 적용하므로 ClickHouse 가 죽어 있으면 기동이 늦거나 실패한다.
  quant·quant_audit·recommendation 의 ClickHouse Hikari 풀은 `initializationFailTimeout=-1` 로
  **기동 때 연결하지 않게** 해 뒀다(폴드 후 관계없는 두 도메인이 같이 내려가는 것을 막으려고).
  analytics 의 풀에는 그 설정이 없다 — Hikari 기본값이라 기동 때 연결을 시도한다.
  적용기를 기동 경로에 넣으면 앞의 완화가 무효가 된다 —
  **실패 시 무엇을 할지를 이 ADR 이 정해야 한다.**
  제안: 적용 실패는 기동을 막지 않고 `/actuator/ingest` 가 `NEVER` 로 보고한다.
  침묵하지 않으면서 다른 도메인을 끌고 내려가지도 않는다.
- 첫 적용은 기존 테이블이 없는 상태라 baseline 이 필요 없다. 다만 운영에 `quant` DB 가
  **부분적으로라도** 생긴 뒤에 이 결정을 미루면 baseline 문제가 새로 생긴다

**열린 결정 (사용자)**

1. 적용기를 `common` 에 둘지, 아니면 ClickHouse 를 쓰는 모듈이 셋뿐이니 `analytics` 에 두고
   나머지가 참조할지 — `common` 쪽이 방향에 맞지만 `common` 이 이미 넓다
2. 적용 실패를 기동 실패로 볼지, 위 제안대로 `NEVER` 보고로 넘길지
3. `engagement` 의 `db/migration-clickhouse/` 는 파일명 규약이 다르다(`V1__` vs `V001__`).
   규약을 맞출지, 적용기가 둘 다 받을지

## 검증 기준

이 ADR 이 구현됐다고 말하려면 다음이 값으로 확인돼야 한다.

- 운영 ClickHouse 에 `analytics`·`quant`·`quant_audit` 데이터베이스와 각 `.sql` 이 정의한 테이블이 실재한다
- `{db}.schema_history` 에 적용된 버전이 파일 수와 같다
- `V005~V012` 가 적용 목록에 있다 — **파일을 하나 더 놓고 재기동했을 때 자동으로 잡히는지**로 확인한다
  (목록에 손으로 넣어 통과시키면 이 ADR 을 안 지킨 것이다)
- `search-eval-daily` 의 실패 원인이 `Code: 60` 에서 **판정 세트 부재**로 바뀐다
