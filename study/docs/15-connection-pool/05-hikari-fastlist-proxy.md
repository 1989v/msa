---
parent: 15-connection-pool
seq: 05
title: FastList + ProxyConnection — JDBC 호출까지 최적화한 영역
type: deep
created: 2026-05-01
---

# 05. FastList + ProxyConnection

ConcurrentBag 이 풀 *내부* 의 contention 을 없앴다면, FastList 와 ProxyConnection 은 *connection 사용 중* 의 호출 자체를 최적화한다.

---

## FastList — ArrayList 의 *얇은* 대체

JDBC connection 은 자기가 만들어낸 Statement 를 추적해야 한다 (close 시 함께 정리). HikariCP 의 ProxyConnection 은 이 추적을 위한 List 를 한 개 보유한다.

ArrayList 를 그대로 쓰면:

```java
// ArrayList.get(i) 의 바이트코드 일부
public E get(int index) {
    Objects.checkIndex(index, size);     // ← range check
    return (E) elementData[index];
}

// ArrayList.remove(Object o) 는 더 비쌈
public boolean remove(Object o) {
    if (o == null) { ... }
    else {
        for (int index = 0; index < size; index++) {  // ← O(n) scan
            if (o.equals(elementData[index])) { ... }
        }
    }
    return false;
}
```

문제점:
- range check 는 매 호출마다 — JIT 가 inline 해도 분기 한 번 추가
- `remove(Object)` 는 O(n) + `equals` 호출
- ArrayList 는 thread-safety 없지만 일부 메서드 (modCount) 가 `synchronized` 의 fence 효과를 줘 JIT 가 최적화 어려움

### FastList 의 트릭

`com.zaxxer.hikari.util.FastList` (LOC 약 80) 는 다음을 제거.

```java
public final class FastList<T> implements List<T> {
    private final Class<?> clazz;
    private T[] elementData;
    private int size;

    public T get(int index) {
        return elementData[index];           // ← range check 없음
    }

    public boolean remove(Object element) {
        for (int index = size - 1; index >= 0; index--) {
            if (element == elementData[index]) {   // == 비교 (equals 아님)
                final int numMoved = size - index - 1;
                if (numMoved > 0) {
                    System.arraycopy(elementData, index + 1, elementData, index, numMoved);
                }
                elementData[--size] = null;
                return true;
            }
        }
        return false;
    }
}
```

세 가지 차이:

1. **range check 제거** — connection 사용 패턴이 *항상 자기가 만든* Statement 만 다루므로 IndexOutOfBounds 가 사실상 발생 불가 (`get(size())` 같은 호출 없음)
2. **equals → ==** — JDBC Statement 는 *항상 같은 인스턴스* 가 close 되므로 reference equality 면 충분
3. **역방향 스캔** — 마지막에 만든 Statement 가 close 되는 패턴이 압도적으로 많음 (try-with-resources 의 LIFO 순서)

### 효과

벤치마크상 ArrayList 대비 약 2~3배 빠른 remove. 하지만 *전체 풀 latency* 에 미치는 영향은 ConcurrentBag 보다 작음 (1~2 µs 단위 절감).

핵심 메시지: **HikariCP 는 JDBC API 사용 자체에서도 optimization 을 한다** — bytecode 수준의 인지가 있다.

---

## ProxyConnection — Javassist 가 아니라 사실은 Compile-time

이게 면접에서 자주 잘못 알려진 부분이다. "HikariCP 가 javassist 로 런타임에 proxy 만든다" 는 *반은 맞고 반은 틀림*.

### 실제 동작

HikariCP 는 *컴파일 시점* 에 `HikariProxyConnection` / `HikariProxyStatement` / `HikariProxyResultSet` 같은 클래스를 *Maven build* 단계에서 javassist 로 *생성* 해 jar 에 *포함* 시킨다.

```
hikari-cp-*.jar
├── com/zaxxer/hikari/pool/ProxyConnection.class       # abstract
├── com/zaxxer/hikari/pool/HikariProxyConnection.class # 자동 생성됨
├── com/zaxxer/hikari/pool/ProxyStatement.class
├── com/zaxxer/hikari/pool/HikariProxyStatement.class
└── ...
```

빌드 시 `JavassistProxyFactory` 가 JDBC interface 의 *모든* 메서드를 순회하며 다음 형태의 코드를 generate.

```java
// 자동 생성되는 HikariProxyStatement.execute(String sql)
public boolean execute(String sql) throws SQLException {
    try {
        return delegate.execute(sql);     // 실제 driver Statement 호출
    } catch (SQLException e) {
        throw checkException(e);          // 풀 내부 hook
    }
}
```

런타임에 javassist 가 generate 하는 게 *아님*. 따라서:

- **클래스 로딩 cost 0** — 일반 .class
- **JIT 친화적** — 일반 메서드처럼 inline
- **코드 길이 < 35 bytes** — JIT inline 한도 내
- **Java reflection 없음**

### 왜 *동적* proxy 를 안 쓰는가

`java.lang.reflect.Proxy` 사용 시:

- 메서드 호출이 `Method.invoke()` 로 reflection
- args 가 `Object[]` boxing
- exception unwrapping 비용
- JIT 가 inline 못 함

벤치마크상 reflection proxy 는 native call 대비 5~20배 느림. `Statement.execute` 가 1ms 걸려도 reflection overhead 가 5~10 µs 추가. 트래픽 많은 서비스에서 무시 못 할 영역.

### checkException — 왜 모든 메서드를 wrap 하나

`checkException(SQLException e)` 는 다음을 한다.

```java
SQLException checkException(SQLException sqle) {
    final var cause = (sqle.getCause() instanceof SQLException scause) ? scause : sqle;
    if (cause instanceof Throwable && Objects.equals(cause.getSQLState(), "08S01")
        || cause instanceof SQLException && cause.getErrorCode() == ...) {
        // connection 이 죽었다 → bag 에서 evict
        evictConnection();
    }
    return sqle;
}
```

connection 이 *고장난 상태로 풀로 돌아가지 않게* 하는 안전망. 이게 없으면 dead connection 이 풀 안에서 계속 borrow → fail 을 반복.

---

## try-with-resources 의 implicit 반납

```kotlin
// JDBC 직접 사용 (희귀, JdbcTemplate 가 더 흔함)
dataSource.connection.use { conn ->                     // ← borrow
    conn.prepareStatement("SELECT ...").use { ps ->     // FastList add
        ps.executeQuery().use { rs ->                   // FastList add
            // ...
        }                                               // rs.close → ps.close 호출
    }                                                   // ps.close → conn.close 시 정리됨
}                                                       // ← requite (반납)
```

ProxyConnection.close() 의 흐름:

```java
public void close() {
    // ① FastList 에 남은 Statement 들 close
    for (int i = openStatements.size() - 1; i >= 0; i--) {
        Statement stmt = openStatements.get(i);
        try { stmt.close(); } catch (SQLException ignored) {}
    }
    openStatements.clear();

    // ② transaction 미완료 검사
    if (!autoCommit && !isReadOnly) {
        delegate.rollback();   // ← 이것 때문에 명시 commit 없으면 rollback
    }

    // ③ session state reset (autoCommit, isolation)
    resetSessionState();

    // ④ ConcurrentBag.requite — 진짜 반납
    poolEntry.recycle();
}
```

**중요한 깨달음**: `connection.close()` 는 *실제로 닫지 않는다*. ProxyConnection 이 가로채서 풀로 *반납* 한다. 진짜 driver Connection 의 close 는 maxLifetime / evict 시점에서만 호출.

---

## 실 driver Connection 은 누가 갖고 있나

```
HikariDataSource
   └── HikariPool
        └── ConcurrentBag<PoolEntry>
              └── PoolEntry
                    ├── delegate: java.sql.Connection (실 driver)
                    ├── proxyConnection: HikariProxyConnection
                    └── openStatements: FastList<Statement>
```

borrow 시 사용자에게 주는 건 *ProxyConnection* (HikariProxyConnection 인스턴스), 진짜 Connection 은 PoolEntry 가 보유. 사용자는 진짜 객체를 직접 만질 수 없다.

`Connection.unwrap(Connection.class)` 로 강제 추출 가능 — 단, 이걸로 close() 호출하면 *진짜* 닫혀버려 풀이 깨짐.

---

## bytecode-level 최적화 사례

HikariCP 메서드 길이 정책: `< 35 bytes` (HotSpot C1 inline 한도).

```java
// HikariPool.getConnection — 단순화된 형태
public Connection getConnection(long hardTimeout) {
    long startTime = ClockSource.currentTime();
    try {
        long timeout = hardTimeout;
        do {
            PoolEntry poolEntry = connectionBag.borrow(timeout, MILLISECONDS);
            if (poolEntry == null) break;

            if (poolEntry.isMarkedEvicted() || ...isAlive(poolEntry)) {
                closeConnection(poolEntry, ...);
                timeout = hardTimeout - elapsedMillis(startTime);
            } else {
                return poolEntry.createProxyConnection(...);    // ← inline 가능
            }
        } while (timeout > 0);
    }
    ...
}
```

`createProxyConnection` 같은 hot path 는 일부러 작게 유지 → JIT 가 inline → CPU 명령어 수 자체가 줄어듦. 이런 *byte-level* 최적화는 다른 풀에는 없다.

---

## 다른 자료구조 — `Sequence`

```java
// HikariPool 안에 PoolEntry 의 *수* 를 atomic 으로 추적
private final ConcurrentLinkedDeque<PoolEntry> totalConnections;
```

Hikari 5.x 부터 ConcurrentLinkedDeque 사용. 이전 버전은 AtomicInteger 와 별도 list. 풀 사이즈 변경 정책이 가벼움.

---

## 면접 모의 답변

> "HikariCP 가 빠른 이유는 ConcurrentBag 외에 두 가지 더 있다. 첫째는 FastList — connection 이 자기가 만든 Statement 추적용으로 쓰는 list 다. ArrayList 의 range check 와 equals 호출을 제거하고, == 와 역방향 스캔으로 close 시 LIFO 패턴을 빠르게 처리한다. 둘째는 ProxyConnection — JDBC interface 의 모든 메서드에 대해 빌드 시점에 javassist 로 *컴파일된* proxy 클래스를 생성한다. 런타임 reflection proxy 는 native call 대비 5~20배 느려서 이걸 피하려는 설계다. 이 proxy 가 close() 를 가로채 실제로는 풀로 반납하고, SQLException 이 fatal 이면 connection 을 evict 시킨다. 즉 *풀 외부* 의 JDBC 호출도 풀이 책임진다."

---

## 핵심 포인트

- FastList = ArrayList - range check - equals - 역방향 스캔
- ProxyConnection 은 *빌드 시점* 에 javassist 로 정적 생성된 .class — 런타임 reflection 아님
- close() 는 진짜 닫지 않고 풀로 반납 (autoCommit/isReadOnly 복구 + Statement cleanup 후)
- checkException 이 dead connection 을 풀에서 자동 evict

## 다음 학습

- [04-hikari-concurrent-bag.md](04-hikari-concurrent-bag.md) — Bag 자체
- [06-hikari-housekeeper.md](06-hikari-housekeeper.md) — maxLifetime / leak detection 이 어떻게 작동하는가
