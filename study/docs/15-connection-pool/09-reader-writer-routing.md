---
parent: 15-connection-pool
seq: 09
title: Reader/Writer 분리 — AbstractRoutingDataSource + LazyConnectionDataSourceProxy + readOnly
type: deep
created: 2026-05-01
---

# 09. Reader/Writer 분리 패턴

읽기 부하를 replica 로 분산하는 표준 패턴. msa 코드베이스의 DataSourceConfig.kt (`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`) 가 이미 이 패턴으로 구현되어 있다.

세 컴포넌트의 *조합* 이 핵심: AbstractRoutingDataSource + LazyConnectionDataSourceProxy + `@Transactional(readOnly=true)`.

---

## 왜 분리하는가

### master 부하 패턴

| 작업 | 비율 (커머스) | 자원 비용 |
|---|---|---|
| 상품 조회 | 70~80% | low (read) |
| 상품 검색 | 10~15% | medium (full-text) |
| 주문 생성 | 5~10% | high (write + lock) |
| 관리자 / 보고서 | < 5% | high (aggregation) |

읽기가 압도적이다. 모든 트래픽이 master 로 가면:

- master CPU 가 read 로 70% 사용
- write throughput 이 read 와 경쟁
- master 한 대 = SPOF

### replica 의 역할

- read-only 트래픽을 처리해 master CPU 보호
- replica 는 N 대로 늘릴 수 있음 (read scaling)
- replica failure 가 *읽기만* 영향 (graceful)

---

## 단순한 두 DataSource 만으로는 부족한 이유

```kotlin
// ⚠ 안티패턴
class ProductService(
    @Qualifier("master") private val masterTemplate: JdbcTemplate,
    @Qualifier("replica") private val replicaTemplate: JdbcTemplate,
) {
    fun read(id: Long) = replicaTemplate.queryForObject(...)
    fun write(p: Product) = masterTemplate.update(...)
}
```

문제:
- *호출자가* 매번 master / replica 선택 → 누락 위험
- `@Transactional` 안에서 두 template 섞으면 *별개 트랜잭션*
- 코드 review 로 routing 정책 강제 어려움

---

## 표준 패턴: 3-컴포넌트 조합

```
                       ┌─────────────────────────────┐
                       │  @Transactional(readOnly)   │
                       │  ↓ TransactionSync.is...()  │
                       └─────────────┬───────────────┘
                                     │ "이 트랜잭션은 readOnly 인가"
                                     ▼
                       ┌─────────────────────────────┐
                       │  RoutingDataSource          │
                       │  (AbstractRoutingDataSource)│
                       │  determineCurrentLookupKey  │
                       │  → MASTER / REPLICA         │
                       └─────────────┬───────────────┘
                                     │
                ┌────────────────────┴────────────────────┐
                ▼                                          ▼
       ┌─────────────────┐                       ┌─────────────────┐
       │ master DataSrc  │                       │ replica DataSrc │
       │ (HikariCP A)    │                       │ (HikariCP B)    │
       └─────────────────┘                       └─────────────────┘
```

---

## 컴포넌트 1: AbstractRoutingDataSource

Spring 이 제공하는 추상 클래스. *런타임에 한 DataSource 를 선택* 하는 dispatcher.

```kotlin
// msa 의 product/DataSourceConfig.kt 발췌
enum class DataSourceType { MASTER, REPLICA }

class RoutingDataSource : AbstractRoutingDataSource() {
    override fun determineCurrentLookupKey(): DataSourceType =
        if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
}
```

핵심:

- `determineCurrentLookupKey()` 가 매번 호출되어 lookup key 반환
- `setTargetDataSources(map)` 으로 key → DataSource 매핑
- `setDefaultTargetDataSource(default)` — lookup key null 일 때 fallback

```kotlin
@Bean
fun routingDataSource(
    @Qualifier("masterDataSource") master: DataSource,
    @Qualifier("replicaDataSource") replica: DataSource
): DataSource = RoutingDataSource().apply {
    setTargetDataSources(mapOf(
        DataSourceType.MASTER to master,
        DataSourceType.REPLICA to replica
    ))
    setDefaultTargetDataSource(master)
    afterPropertiesSet()
}
```

---

## 컴포넌트 2: TransactionSynchronizationManager

`@Transactional(readOnly=true)` 가 어떻게 lookup key 결정에 흘러들어가는가.

```
@Transactional(readOnly=true) 시작
        │
        ▼
TransactionInterceptor.invoke()
        │
        ▼ "트랜잭션 시작"
TransactionSynchronizationManager.setCurrentTransactionReadOnly(true)  // ThreadLocal
        │
        ▼
DataSourceTransactionManager.doBegin()
        │
        ▼ "Connection 획득"
dataSource.getConnection()   // ← RoutingDataSource.determineCurrentLookupKey()
        │                       Returns: REPLICA (because readOnly=true)
        ▼
실제 쿼리 실행
        │
        ▼
TransactionSynchronizationManager.unbindResource()
```

`TransactionSynchronizationManager.isCurrentTransactionReadOnly()` 는 ThreadLocal 기반이므로:

- 하나의 트랜잭션 내에서 일관된 값 반환
- thread 간 leak 없음
- `@Transactional` 이 없으면 `false` 반환 → MASTER 로 routing

---

## 컴포넌트 3: LazyConnectionDataSourceProxy — 결정적 wrapper

```kotlin
@Bean
@Primary
fun dataSource(@Qualifier("routingDataSource") routingDataSource: DataSource): DataSource =
    LazyConnectionDataSourceProxy(routingDataSource)
```

이게 *없으면 동작 안 함*. 가장 자주 빠뜨리는 부분.

### 왜 필요한가

`DataSourceTransactionManager.doBegin()` 의 흐름:

```java
protected void doBegin(Object transaction, TransactionDefinition definition) {
    // ① 트랜잭션 시작 시점에 connection 획득
    Connection newCon = obtainDataSource().getConnection();
    txObject.setConnectionHolder(new ConnectionHolder(newCon), true);
    
    // ② readOnly / isolation 등 설정
    DataSourceUtils.prepareConnectionForTransaction(con, definition);
    
    // ③ readOnly 정보를 ThreadLocal 에 binding
    TransactionSynchronizationManager.setCurrentTransactionReadOnly(definition.isReadOnly());
    ...
}
```

문제: ① 의 `getConnection()` 시점에는 ③ 이 *아직 실행되지 않음*. 즉 RoutingDataSource 가 lookup key 를 결정할 때 `isCurrentTransactionReadOnly()` 가 *false* (디폴트). → 항상 MASTER 로 routing 되는 버그.

### LazyConnectionDataSourceProxy 가 해결

```java
public Connection getConnection() throws SQLException {
    return (Connection) Proxy.newProxyInstance(
        ConnectionProxy.class.getClassLoader(),
        new Class<?>[]{ConnectionProxy.class},
        new LazyConnectionInvocationHandler()
    );
}

// invocation handler
public Object invoke(Object proxy, Method method, Object[] args) {
    if (method.getName().equals("close")) {
        if (target != null) target.close();
        return null;
    }
    // 첫 *실제* 쿼리 시점에 진짜 connection 획득
    if (target == null) {
        target = targetDataSource.getConnection();
    }
    return method.invoke(target, args);
}
```

핵심:

- `getConnection()` 호출 시 *진짜 connection 을 안 만들고* proxy 반환
- 진짜 SQL 메서드 (executeQuery 등) 가 호출되는 시점에 *비로소* 진짜 connection 획득
- 그 시점에는 `TransactionSynchronizationManager` 의 readOnly 가 *이미 binding 되어 있음*
- 따라서 RoutingDataSource 가 올바른 lookup key 결정

### 보너스 효과

`@Transactional` 이 시작됐지만 *쿼리를 실제로 실행하지 않은* 메서드는 connection 자체를 borrow 하지 않음. 풀 절약.

```kotlin
@Transactional(readOnly = true)
fun getCached(id: Long): Cached? {
    return cache.get(id)   // ← DB 안 감, connection 도 안 빌림
}
```

---

## 사용법

### Service 레이어

```kotlin
@Service
class ProductService(
    private val productRepository: ProductRepository,
) {
    
    @Transactional(readOnly = true)
    fun findById(id: Long): Product? = productRepository.findById(id)
    
    @Transactional(readOnly = true)
    fun search(query: String): List<Product> = productRepository.searchByName(query)
    
    @Transactional   // readOnly = false (default)
    fun create(req: CreateProductRequest): Product {
        val product = Product.from(req)
        return productRepository.save(product)
    }
    
    @Transactional
    fun updateStock(id: Long, delta: Int) {
        val product = productRepository.findById(id) ?: error("not found")
        product.adjustStock(delta)
        productRepository.save(product)
    }
}
```

→ `findById`, `search` 는 replica 풀로, `create`, `updateStock` 은 master 풀로.

### 주의: 같은 트랜잭션 안에서는 mix 불가

```kotlin
@Transactional(readOnly = true)
fun complexLogic() {
    val items = repo.findAll()              // replica
    repo.save(newItem)                      // ⚠ readOnly 트랜잭션이라 실패 (또는 silent fail)
}
```

`readOnly = true` 트랜잭션 안에서 write 하면 안 됨. Hibernate 는 flush 를 skip 할 수도 있음 (silent data loss). MySQL replica 는 read-only mode 이므로 write 자체가 reject.

---

## class-level 적용 (msa 권장 X)

```kotlin
@Service
@Transactional(readOnly = true)              // ⚠ 클래스 전체 readOnly
class ProductService(...) {
    
    fun findById(id: Long): Product? = ...
    
    @Transactional                            // 메서드 단위 override
    fun create(req: CreateProductRequest): Product = ...
}
```

ADR-0020 (`docs/adr/ADR-0020-transactional-usage.md`) 에서 *클래스 레벨 금지*. 이유:

- 명시성 부족 — 메서드만 봐서는 트랜잭션 속성 모름
- override 누락 시 silent fail
- 다른 컴포넌트 (saga 등) 와 충돌

따라서 msa 는 *메서드별 명시* 패턴.

---

## 트랜잭션 없이 호출되는 read

```kotlin
@RestController
class ProductController(private val service: ProductService) {
    
    @GetMapping("/{id}")
    fun get(@PathVariable id: Long): Product? = service.findById(id)
    //                                          ↑
    // 만약 service.findById 에 @Transactional 없으면?
    // → TransactionSync.isCurrentTransactionReadOnly() = false
    // → MASTER 로 라우팅 ⚠
}
```

해결: read-only service 메서드에는 *항상* `@Transactional(readOnly = true)` 명시. 이게 ADR-0020 (`docs/adr/ADR-0020-transactional-usage.md`) 의 일부.

---

## 두 풀 분리 운영 — 모니터링 분리

```yaml
spring:
  datasource:
    master:
      hikari:
        maximum-pool-size: 10
        pool-name: product-master-pool
    replica:
      hikari:
        maximum-pool-size: 20         # read 가 더 많으니 큰 풀
        pool-name: product-replica-pool
```

`pool-name` 을 다르게 설정하면 메트릭에서 분리됨:

```promql
hikaricp_connections_active{pool="product-master-pool"}    # write 부하
hikaricp_connections_active{pool="product-replica-pool"}   # read 부하
```

---

## 정리: 3-컴포넌트 모두 필요한 이유

| 컴포넌트 | 빠지면 | 결과 |
|---|---|---|
| AbstractRoutingDataSource | dispatcher 없음 | 라우팅 자체 불가 |
| TransactionSynchronizationManager | readOnly 정보 없음 | 항상 MASTER |
| LazyConnectionDataSourceProxy | connection 을 begin 시점에 잡음 | readOnly 정보 안 보고 결정 → 항상 MASTER |
| `@Transactional(readOnly=true)` | 호출자가 명시 안 함 | 항상 MASTER (default) |

---

## 핵심 포인트

- 표준 조합: AbstractRoutingDataSource + LazyConnectionDataSourceProxy + @Transactional(readOnly=true)
- LazyConnectionDataSourceProxy 가 빠지면 *무조건 MASTER* — 가장 자주 빠뜨림
- `TransactionSynchronizationManager.isCurrentTransactionReadOnly()` 가 ThreadLocal 기반 dispatcher 신호
- 메서드별 명시 (ADR-0020), 클래스 레벨 readOnly 금지
- pool-name 분리로 메트릭에서 read/write 부하 따로 관측

## 다음 학습

- [10-replica-lag-consistency.md](10-replica-lag-consistency.md) — replica lag 시 read-after-write 보장
- [15-codebase-audit.md](15-codebase-audit.md) — msa 11 서비스 R/W 적용 현황
- [17-improvements.md](17-improvements.md) — replica 활용 개선
